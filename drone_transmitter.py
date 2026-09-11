#!/usr/bin/env python3
"""
Virtual Drone GCS & Remote ID Telemetry Transmitter
ASTM F3411-22a (OpenDroneID) Standard Compliant
WebSocket Server running on 0.0.0.0:8765
"""

import asyncio
import json
import math
import time
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, Set, Optional, Any
from pydantic import BaseModel, Field
import websockets

# Setup logging with tactical format
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [GCS-CORE] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("drone_transmitter")

# ---------------------------------------------------------
# CONSTANTS & PROTOCOL DEFINITIONS
# ---------------------------------------------------------
HOST = "0.0.0.0"
PORT = 8765
KINEMATICS_FREQ_HZ = 20      # 50ms physics update tick
BROADCAST_FREQ_HZ = 2        # 500ms ASTM F3411 broadcast rate
EARTH_RADIUS_M = 6378137.0   # WGS84 major radius
REGULATORY_CEILING_M = 120.0 # Standard DGCA / FAA Category limit

class TransmissionState(str, Enum):
    BROADCASTING = "BROADCASTING"
    SILENT_DARK = "SILENT_DARK"
    SPOOFED_ID = "SPOOFED_ID"

class FlightMode(str, Enum):
    MANUAL = "MANUAL"
    AUTO_PATROL = "AUTO_PATROL"
    RTH = "RTH"
    LOITER = "LOITER"
    EVASION = "EVASION"

# ---------------------------------------------------------
# PYDANTIC SCHEMAS (ASTM F3411-22a COMPLIANT)
# ---------------------------------------------------------
class OperatorLocation(BaseModel):
    lat: float = Field(..., description="GCS Pilot Latitude WGS84")
    lon: float = Field(..., description="GCS Pilot Longitude WGS84")
    alt_geo_m: float = Field(default=12.0, description="Pilot Geodetic Altitude")

class ASTMTelemetryPacket(BaseModel):
    # ASTM F3411 OpenDroneID Core Message Elements
    uas_id: str = Field(..., description="UAS Identification serial or CAA registration")
    ua_type: str = Field(default="Aeroplane/Multirotor", description="UAS Airframe Category")
    id_type: str = Field(default="Serial/CAA Registration", description="ID Classification")
    timestamp: str = Field(..., description="ISO-8601 UTC timestamp")
    lat: float = Field(..., description="Current Latitude (WGS84)")
    lon: float = Field(..., description="Current Longitude (WGS84)")
    alt_geo_m: float = Field(..., description="Geodetic Altitude (m)")
    alt_pressure_m: float = Field(..., description="Barometric Pressure Altitude (m)")
    height_agl_m: float = Field(..., description="Height Above Ground Level (m)")
    speed_horizontal_mps: float = Field(..., description="Ground Speed (m/s)")
    speed_vertical_mps: float = Field(..., description="Vertical Climb/Descent (m/s)")
    heading_deg: float = Field(..., description="Direction of Travel (0-360 deg)")
    pitch_deg: float = Field(..., description="Attitude Pitch (-90 to +90 deg)")
    roll_deg: float = Field(..., description="Attitude Roll (-180 to +180 deg)")
    yaw_deg: float = Field(..., description="Attitude Yaw (0-360 deg)")
    operator_location: OperatorLocation = Field(..., description="Operator/Pilot Location")
    operator_id: str = Field(default="OP-IND-TN-9821", description="Registered Pilot ID")
    rssi_dbm: int = Field(default=-45, description="Received Signal Strength Indication")
    status: str = Field(default="AIRBORNE", description="Operational Status")
    operational_status: str = Field(default="In Flight / Nominally Cooperative", description="Detailed status string")
    transmission_state: TransmissionState = Field(default=TransmissionState.BROADCASTING)
    flight_mode: FlightMode = Field(default=FlightMode.AUTO_PATROL)
    battery_percent: float = Field(default=96.0, description="Battery Charge Remaining")
    gps_satellites: int = Field(default=18, description="Locked GNSS Constellation SVs")
    protocol: str = Field(default="ASTM_F3411_22A", description="Protocol Standard Version")
    sequence_number: int = Field(default=0, description="Incremental Packet Counter")
    auth_data: str = Field(default="0x4A89C2E3[ASTM-SEC-VALID]", description="ASTM Authentication Block")

# ---------------------------------------------------------
# DRONE STATE MACHINE & KINEMATICS ENGINE
# ---------------------------------------------------------
class DroneState:
    def __init__(self):
        # Base Identification
        self.default_uas_id = "UIN-IND-2026-X89"
        self.uas_id = self.default_uas_id
        self.default_operator_id = "OP-IND-TN-9821"
        self.operator_id = self.default_operator_id
        
        # Spatial Coordinates (Chennai Urban Hub center)
        self.lat = 13.062500
        self.lon = 80.275000
        self.alt_m = 60.0
        self.alt_pressure_m = 60.2
        self.height_agl_m = 60.0
        
        # Velocity & Orientation
        self.speed_mps = 12.5
        self.target_speed_mps = 12.5
        self.speed_vertical_mps = 0.0
        self.target_speed_vertical_mps = 0.0
        self.heading = 45.0
        self.target_heading = 45.0
        
        # Flight Attitude (Degrees)
        self.pitch = 1.8
        self.roll = 0.0
        self.yaw = 45.0
        
        # Ground Control Station Location
        self.pilot_lat = 13.060000
        self.pilot_lon = 80.272000
        self.pilot_alt_m = 12.0
        
        # Transmission & Operational States
        self.transmission_state = TransmissionState.BROADCASTING
        self.flight_mode = FlightMode.AUTO_PATROL
        self.status = "AIRBORNE"
        self.operational_status = "In Flight / Nominally Cooperative"
        
        # Avionics Telemetry
        self.rssi_dbm = -45
        self.battery_percent = 96.0
        self.gps_satellites = 18
        self.sequence_number = 0
        
        # Autopilot Waypoints (Patrol loop around Chennai urban core)
        self.waypoints = [
            (13.0625, 80.2750, 60.0), # Central hub
            (13.0680, 80.2820, 65.0), # Northeast sector
            (13.0720, 80.2730, 70.0), # North sector
            (13.0660, 80.2650, 65.0), # Northwest sector
            (13.0580, 80.2680, 60.0), # Southwest sector
            (13.0570, 80.2780, 60.0), # Southeast sector
        ]
        self.current_wp_index = 0
        self.last_kinematics_time = time.time()
        self.last_battery_drain = time.time()

    def update_kinematics(self, dt: float):
        """High-precision kinematic integration solver running at 20 Hz."""
        current_time = time.time()
        
        # Gradual battery drain (0.1% every 10s)
        if current_time - self.last_battery_drain > 10.0:
            self.battery_percent = max(5.0, round(self.battery_percent - 0.1, 2))
            self.last_battery_drain = current_time

        # Autopilot navigation logic when in AUTO_PATROL or RTH mode
        if self.flight_mode == FlightMode.AUTO_PATROL:
            target_lat, target_lon, target_alt = self.waypoints[self.current_wp_index]
            dlat = target_lat - self.lat
            dlon = target_lon - self.lon
            # Distance to current waypoint
            dist_m = math.sqrt((dlat * 111139.0)**2 + (dlon * 111139.0 * math.cos(math.radians(self.lat)))**2)
            
            if dist_m < 35.0: # Reached waypoint -> switch to next
                self.current_wp_index = (self.current_wp_index + 1) % len(self.waypoints)
            else:
                # Calculate desired heading towards waypoint
                bearing_rad = math.atan2(
                    dlon * math.cos(math.radians(self.lat)),
                    dlat
                )
                desired_heading = (math.degrees(bearing_rad) + 360.0) % 360.0
                self.target_heading = desired_heading
                
                # Desired vertical rate
                alt_diff = target_alt - self.alt_m
                self.target_speed_vertical_mps = max(-3.0, min(3.0, alt_diff * 0.5))

        elif self.flight_mode == FlightMode.RTH:
            # Fly directly to Pilot GCS Coordinates
            dlat = self.pilot_lat - self.lat
            dlon = self.pilot_lon - self.lon
            dist_m = math.sqrt((dlat * 111139.0)**2 + (dlon * 111139.0 * math.cos(math.radians(self.lat)))**2)
            if dist_m < 15.0:
                self.target_speed_mps = 0.0
                self.target_speed_vertical_mps = -1.5 if self.alt_m > 2.0 else 0.0
                if self.alt_m <= 2.0:
                    self.status = "LANDED"
                    self.flight_mode = FlightMode.LOITER
            else:
                bearing_rad = math.atan2(
                    dlon * math.cos(math.radians(self.lat)),
                    dlat
                )
                self.target_heading = (math.degrees(bearing_rad) + 360.0) % 360.0
                self.target_speed_mps = 14.0

        elif self.flight_mode == FlightMode.LOITER:
            self.target_speed_mps = 0.0
            self.target_speed_vertical_mps = 0.0

        elif self.flight_mode == FlightMode.EVASION:
            self.target_speed_mps = 26.0

        # Smooth Heading Interpolation (Turn rate limit ~ 45 deg/sec)
        heading_diff = (self.target_heading - self.heading + 180.0) % 360.0 - 180.0
        max_turn = 45.0 * dt
        turn_amount = max(-max_turn, min(max_turn, heading_diff))
        self.heading = (self.heading + turn_amount) % 360.0
        self.yaw = self.heading
        
        # Bank Roll based on turning rate (coordinated turn banking)
        target_roll = -turn_amount / dt * 0.65  # e.g., turning right banks right
        self.roll += (target_roll - self.roll) * min(1.0, 6.0 * dt)
        
        # Smooth Speed Interpolation (Acceleration limit ~ 6 m/s^2)
        speed_diff = self.target_speed_mps - self.speed_mps
        max_accel = 6.0 * dt
        self.speed_mps += max(-max_accel, min(max_accel, speed_diff))
        
        # Pitch response to acceleration & forward flight
        target_pitch = max(-20.0, min(20.0, (self.speed_mps - self.target_speed_mps) * 1.5 + (self.speed_mps * 0.15)))
        self.pitch += (target_pitch - self.pitch) * min(1.0, 5.0 * dt)
        
        # Smooth Altitude Climb / Sink rate
        vspeed_diff = self.target_speed_vertical_mps - self.speed_vertical_mps
        self.speed_vertical_mps += max(-4.0 * dt, min(4.0 * dt, vspeed_diff))
        self.alt_m = max(0.0, min(350.0, self.alt_m + self.speed_vertical_mps * dt))
        self.alt_pressure_m = round(self.alt_m + 0.2 * math.sin(current_time), 2)
        self.height_agl_m = round(self.alt_m, 2)
        
        # Kinematic coordinate integration:
        # Distance moved in meters: delta_d = speed * dt
        delta_d = self.speed_mps * dt
        heading_rad = math.radians(self.heading)
        
        # Delta lat / lon in degrees
        delta_lat = (delta_d * math.cos(heading_rad)) / 111139.0
        cos_lat = math.cos(math.radians(self.lat))
        if abs(cos_lat) < 1e-6:
            cos_lat = 1e-6
        delta_lon = (delta_d * math.sin(heading_rad)) / (111139.0 * cos_lat)
        
        self.lat += delta_lat
        self.lon += delta_lon
        
        # Jitter RSSI slightly based on distance to operator
        d_pilot_lat = self.pilot_lat - self.lat
        d_pilot_lon = self.pilot_lon - self.lon
        pilot_dist_km = math.sqrt((d_pilot_lat * 111.139)**2 + (d_pilot_lon * 111.139 * cos_lat)**2)
        base_rssi = -42 - int(pilot_dist_km * 8)
        self.rssi_dbm = max(-95, min(-35, base_rssi + int(math.sin(current_time * 2.0) * 2)))

    def apply_scenario(self, scenario_name: str) -> str:
        """Inject demo scenarios instantly."""
        sc_upper = scenario_name.strip().upper()
        logger.info(f"Injecting Scenario: {sc_upper}")
        
        if sc_upper in ("PATROL", "NORMAL_PATROL"):
            self.uas_id = self.default_uas_id
            self.operator_id = self.default_operator_id
            self.transmission_state = TransmissionState.BROADCASTING
            self.flight_mode = FlightMode.AUTO_PATROL
            self.target_speed_mps = 12.5
            self.target_speed_vertical_mps = 0.0
            self.alt_m = 60.0
            self.status = "AIRBORNE"
            self.operational_status = "In Flight / Nominally Cooperative"
            return "Activated Normal Patrol mode (ID: UIN-IND-2026-X89, Alt: 60m, Tx: ON)"

        elif sc_upper in ("BREACH", "BREACH_CEILINGS", "CEILING_BREACH"):
            self.flight_mode = FlightMode.MANUAL
            self.target_speed_vertical_mps = 6.0
            self.alt_m = 160.0 # Instant climb to breach >120m ceiling
            self.status = "CEILING_BREACH_ALERT"
            self.operational_status = "WARNING: Operating Above Regulatory Ceiling (>120m AGL)"
            return "Triggered Altitude Ceiling Breach: 160m AGL (>120m DGCA Limit)"

        elif sc_upper in ("DARK", "GO_DARK", "CUT_TRANSMITTER", "SILENT_DARK"):
            self.transmission_state = TransmissionState.SILENT_DARK
            self.status = "STEALTH_SILENT"
            self.operational_status = "NON-COOPERATIVE / EMISSIONS SILENCED"
            return "Transmitter Cut: Entering SILENT_DARK rogue mode (Telemetry muted to surveillance)"

        elif sc_upper in ("SPOOF", "SPOOF_IDENTITY", "SPOOFED_ID"):
            self.uas_id = "UNAUTH-DRONE-999"
            self.operator_id = "UNKNOWN_ROGUE_OPERATOR"
            self.transmission_state = TransmissionState.SPOOFED_ID
            self.status = "SECURITY_ALERT_UNAUTHORIZED"
            self.operational_status = "CRITICAL: Unregistered / Rogue UAS Identity Broadcast"
            return "Identity Spoofed: Emitting as UNAUTH-DRONE-999"

        elif sc_upper in ("RTH", "RETURN_HOME", "RETURN_TO_LAUNCH"):
            self.flight_mode = FlightMode.RTH
            self.status = "RETURNING_TO_HOME"
            self.operational_status = "Autonomous Return to Pilot GCS Coordinates"
            return "Autopilot engaged: Returning to Launch (GCS Operator)"

        elif sc_upper in ("LOITER", "HOVER", "HOLD"):
            self.flight_mode = FlightMode.LOITER
            self.target_speed_mps = 0.0
            self.target_speed_vertical_mps = 0.0
            self.status = "LOITERING"
            self.operational_status = "Stationary Hover Position Hold"
            return "Loiter Mode: Holding current 3D position"

        elif sc_upper in ("EVASION", "HIGH_SPEED"):
            self.flight_mode = FlightMode.EVASION
            self.target_speed_mps = 26.0
            self.status = "EVASION_SPRINT"
            self.operational_status = "High-speed tactical maneuver"
            return "Evasion Mode: Acceleration to 26 m/s"

        else:
            return f"Unknown scenario: {scenario_name}"

    def build_astm_packet(self) -> ASTMTelemetryPacket:
        """Constructs an ASTM F3411-22a conformant telemetry payload."""
        self.sequence_number += 1
        now_iso = datetime.now(timezone.utc).isoformat()
        
        return ASTMTelemetryPacket(
            uas_id=self.uas_id,
            ua_type="Aeroplane/Multirotor",
            id_type="Serial/CAA Registration",
            timestamp=now_iso,
            lat=round(self.lat, 6),
            lon=round(self.lon, 6),
            alt_geo_m=round(self.alt_m, 1),
            alt_pressure_m=round(self.alt_pressure_m, 1),
            height_agl_m=round(self.height_agl_m, 1),
            speed_horizontal_mps=round(self.speed_mps, 1),
            speed_vertical_mps=round(self.speed_vertical_mps, 1),
            heading_deg=round(self.heading, 1),
            pitch_deg=round(self.pitch, 1),
            roll_deg=round(self.roll, 1),
            yaw_deg=round(self.yaw, 1),
            operator_location=OperatorLocation(
                lat=round(self.pilot_lat, 6),
                lon=round(self.pilot_lon, 6),
                alt_geo_m=round(self.pilot_alt_m, 1)
            ),
            operator_id=self.operator_id,
            rssi_dbm=self.rssi_dbm,
            status=self.status,
            operational_status=self.operational_status,
            transmission_state=self.transmission_state,
            flight_mode=self.flight_mode,
            battery_percent=self.battery_percent,
            gps_satellites=self.gps_satellites,
            protocol="ASTM_F3411_22A",
            sequence_number=self.sequence_number,
            auth_data=f"0x{int(time.time()):08X}[ASTM-SEC-VALID]"
        )

# Global drone state instance
drone = DroneState()

# Connected WebSocket clients mapped by role: 'gcs' or 'surveillance_listener'
class ClientSession:
    def __init__(self, ws: websockets.WebSocketServerProtocol, role: str = "gcs"):
        self.ws = ws
        self.role = role # 'gcs' gets full local telemetry even when dark; 'listener' simulates external air surveillance

connected_clients: Set[ClientSession] = set()

# ---------------------------------------------------------
# ASYNC WORKERS (KINEMATICS + ASTM BROADCAST)
# ---------------------------------------------------------
async def kinematics_loop():
    """Calculates smooth trajectory dynamics at 20 Hz."""
    dt = 1.0 / KINEMATICS_FREQ_HZ
    while True:
        try:
            drone.update_kinematics(dt)
        except Exception as e:
            logger.error(f"Error in kinematics tick: {e}", exc_info=True)
        await asyncio.sleep(dt)

async def broadcast_loop():
    """Pushes ASTM F3411-22a packets to connected clients at 2 Hz."""
    interval = 1.0 / BROADCAST_FREQ_HZ
    while True:
        try:
            packet = drone.build_astm_packet()
            packet_dict = packet.model_dump()
            
            # Formulate GCS internal message (always contains full state)
            gcs_message = json.dumps({
                "type": "telemetry",
                "data": packet_dict
            })
            
            # Formulate Surveillance Console message:
            # If SILENT_DARK is active, external surveillance receives no packets or "SIGNAL_LOST"
            is_dark = (drone.transmission_state == TransmissionState.SILENT_DARK)
            surveillance_message = None if is_dark else json.dumps({
                "type": "astm_broadcast",
                "data": packet_dict
            })
            
            dead_sessions = set()
            for session in list(connected_clients):
                try:
                    if session.role == "gcs":
                        await session.ws.send(gcs_message)
                    else:
                        # External surveillance listener
                        if surveillance_message is not None:
                            await session.ws.send(surveillance_message)
                except websockets.exceptions.ConnectionClosed:
                    dead_sessions.add(session)
                except Exception as ex:
                    logger.warning(f"Error sending to client: {ex}")
                    dead_sessions.add(session)
            
            for dead in dead_sessions:
                connected_clients.discard(dead)
                
        except Exception as e:
            logger.error(f"Error in broadcast tick: {e}", exc_info=True)
            
        await asyncio.sleep(interval)

# ---------------------------------------------------------
# WEBSOCKET CONNECTION & COMMAND HANDLER
# ---------------------------------------------------------
async def handle_client(websocket: websockets.WebSocketServerProtocol):
    session = ClientSession(websocket, role="gcs")
    connected_clients.add(session)
    client_ip = websocket.remote_address
    logger.info(f"Client connected from {client_ip}. Total active: {len(connected_clients)}")
    
    # Send immediate state sync on connect
    initial_packet = drone.build_astm_packet()
    await websocket.send(json.dumps({
        "type": "init_state",
        "data": initial_packet.model_dump(),
        "regulatory_ceiling_m": REGULATORY_CEILING_M
    }))

    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                msg_type = data.get("type", "")
                
                if msg_type == "identify":
                    session.role = data.get("role", "gcs")
                    logger.info(f"Client {client_ip} registered role: {session.role}")
                    await websocket.send(json.dumps({
                        "type": "ack",
                        "message": f"Registered as {session.role}"
                    }))

                elif msg_type == "control":
                    # Flight control inputs from UI / Keyboard
                    drone.flight_mode = FlightMode.MANUAL
                    
                    if "throttle_delta" in data:
                        drone.target_speed_mps = max(0.0, min(30.0, drone.target_speed_mps + float(data["throttle_delta"])))
                    if "speed_set" in data:
                        drone.target_speed_mps = max(0.0, min(30.0, float(data["speed_set"])))
                    if "yaw_delta" in data:
                        drone.target_heading = (drone.target_heading + float(data["yaw_delta"])) % 360.0
                    if "heading_set" in data:
                        drone.target_heading = float(data["heading_set"]) % 360.0
                    if "climb_delta" in data:
                        drone.target_speed_vertical_mps = max(-5.0, min(6.0, float(data["climb_delta"])))
                    if "alt_set" in data:
                        target_alt = max(0.0, min(300.0, float(data["alt_set"])))
                        drone.alt_m = target_alt
                    
                    # Manual pitch/roll override if provided directly (e.g. from joystick)
                    if "pitch" in data:
                        drone.pitch = float(data["pitch"])
                    if "roll" in data:
                        drone.roll = float(data["roll"])

                elif msg_type == "set_scenario":
                    scenario = data.get("scenario", "")
                    result = drone.apply_scenario(scenario)
                    # Broadcast scenario feedback
                    feedback_msg = json.dumps({
                        "type": "scenario_feedback",
                        "scenario": scenario,
                        "result": result,
                        "state": drone.build_astm_packet().model_dump()
                    })
                    for s in connected_clients:
                        try:
                            await s.ws.send(feedback_msg)
                        except:
                            pass

                elif msg_type == "set_state":
                    # Direct state overrides
                    if "uas_id" in data:
                        drone.uas_id = str(data["uas_id"])
                    if "transmission_state" in data:
                        drone.transmission_state = TransmissionState(data["transmission_state"])
                    if "flight_mode" in data:
                        drone.flight_mode = FlightMode(data["flight_mode"])
                    if "lat" in data:
                        drone.lat = float(data["lat"])
                    if "lon" in data:
                        drone.lon = float(data["lon"])
                    if "alt_m" in data:
                        drone.alt_m = float(data["alt_m"])
                    if "speed_mps" in data:
                        drone.speed_mps = float(data["speed_mps"])
                        drone.target_speed_mps = drone.speed_mps
                    if "heading" in data:
                        drone.heading = float(data["heading"]) % 360.0
                        drone.target_heading = drone.heading

                elif msg_type == "ping":
                    # RTT Latency measurement
                    client_ts = data.get("client_ts", time.time() * 1000)
                    await websocket.send(json.dumps({
                        "type": "pong",
                        "client_ts": client_ts,
                        "server_ts": time.time() * 1000
                    }))

            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON received from {client_ip}")
            except Exception as e:
                logger.error(f"Error handling message: {e}", exc_info=True)

    except websockets.exceptions.ConnectionClosed:
        logger.info(f"Client disconnected: {client_ip}")
    finally:
        connected_clients.discard(session)

# ---------------------------------------------------------
# MAIN ENTRYPOINT
# ---------------------------------------------------------
async def main():
    logger.info("=========================================================")
    logger.info("  VIRTUAL DRONE GCS & ASTM F3411 REMOTE ID TRANSMITTER  ")
    logger.info("=========================================================")
    logger.info(f"Starting WebSocket server on ws://{HOST}:{PORT}")
    logger.info(f"Kinematics Tick Rate: {KINEMATICS_FREQ_HZ} Hz | ASTM Broadcast Rate: {BROADCAST_FREQ_HZ} Hz")
    logger.info(f"Initial UAS ID: {drone.uas_id} | Initial Location: ({drone.lat}, {drone.lon})")
    
    server = await websockets.serve(handle_client, HOST, PORT)
    
    # Launch background async tasks
    await asyncio.gather(
        kinematics_loop(),
        broadcast_loop(),
        server.wait_closed()
    )

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Transmitter server stopped by user.")

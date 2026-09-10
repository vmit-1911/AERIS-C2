import asyncio
import csv
from datetime import datetime, timezone
import io
json_lib = __import__("json")
import logging
import uuid
from typing import Dict, List, Any, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("AERIS-C2")

TELEMETRY_TIMEOUT_SECONDS = 5.0
DEFAULT_RETENTION_DAYS = 7

app = FastAPI(title="AERIS-C2 Civil Security & Alert Intelligence Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# Drone Registry
# ============================================================
DRONE_REGISTRY = {
    "UAV-001": {
        "registration": "REG-IND-001",
        "operator": "ABC Survey Pvt Ltd",
        "authorization_status": "ACTIVE",
        "drone_type": "Multirotor",
        "classification": "Consumer/Commercial"
    },
    "UAV-002": {
        "registration": "REG-IND-002",
        "operator": "Coastal Mapping Ltd",
        "authorization_status": "ACTIVE",
        "drone_type": "Fixed-Wing",
        "classification": "Commercial Infrastructure"
    },
    "UAV-003": {
        "registration": "REG-IND-003",
        "operator": "Apex Logistics",
        "authorization_status": "REVOKED",
        "drone_type": "Multirotor",
        "classification": "Cargo Delivery"
    }
}

def lookup_drone_registry(drone_id: str) -> dict:
    reg_data = DRONE_REGISTRY.get(drone_id)
    if reg_data and reg_data.get("authorization_status") == "ACTIVE":
        return {
            "registration": reg_data["registration"],
            "operator": reg_data["operator"],
            "authorization_status": "ACTIVE",
            "drone_type": reg_data["drone_type"],
            "classification": reg_data["classification"],
            "is_registered": True
        }
    elif reg_data:
        return {
            "registration": reg_data["registration"],
            "operator": reg_data["operator"],
            "authorization_status": reg_data["authorization_status"],
            "drone_type": reg_data["drone_type"],
            "classification": reg_data["classification"],
            "is_registered": True
        }
    else:
        return {
            "registration": "NOT-REGISTERED",
            "operator": "UNKNOWN OPERATOR",
            "authorization_status": "UNAUTHORIZED",
            "drone_type": "Unidentified Multirotor",
            "classification": "Unregistered Drone",
            "is_registered": False
        }

# ============================================================
# Point-in-Polygon Engine
# ============================================================
def point_in_polygon(lng: float, lat: float, polygon_coords: List[List[float]]) -> bool:
    inside = False
    n = len(polygon_coords)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        xi, yi = polygon_coords[i][0], polygon_coords[i][1]
        xj, yj = polygon_coords[j][0], polygon_coords[j][1]
        intersect = ((yi > lat) != (yj > lat)) and (lng < (xj - xi) * (lat - yi) / (yj - yi + 1e-12) + xi)
        if intersect:
            inside = not inside
        j = i
    return inside

# ============================================================
# GeoJSON Default Zones
# ============================================================
DEFAULT_ZONES = [
    {
        "zone_id": "ZONE-GREEN-01",
        "name": "Ajmer Civil Aviation Corridor",
        "zone_type": "GREEN",
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [74.6200, 26.4350],
                [74.6650, 26.4350],
                [74.6650, 26.4700],
                [74.6200, 26.4700],
                [74.6200, 26.4350]
            ]]
        },
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": None,
        "min_altitude": 0.0,
        "max_altitude": 120.0,
        "operator_id": "SYSTEM",
        "declared_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "zone_id": "ZONE-YELLOW-01",
        "name": "Municipal Advisory Buffer Zone",
        "zone_type": "YELLOW",
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [74.6400, 26.4450],
                [74.6600, 26.4450],
                [74.6600, 26.4600],
                [74.6400, 26.4600],
                [74.6400, 26.4450]
            ]]
        },
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": None,
        "min_altitude": 0.0,
        "max_altitude": 150.0,
        "operator_id": "SYSTEM",
        "declared_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "zone_id": "ZONE-RED-01",
        "name": "High Security Government Enclave",
        "zone_type": "RED",
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [74.6450, 26.4520],
                [74.6530, 26.4520],
                [74.6530, 26.4580],
                [74.6450, 26.4580],
                [74.6450, 26.4520]
            ]]
        },
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": None,
        "min_altitude": 0.0,
        "max_altitude": 500.0,
        "operator_id": "SYSTEM",
        "declared_at": datetime.now(timezone.utc).isoformat()
    }
]

# ============================================================
# Zone Manager
# ============================================================
class ZoneManager:
    def __init__(self):
        self.zones: Dict[str, dict] = {}
        for z in DEFAULT_ZONES:
            self.zones[z["zone_id"]] = z

    def get_all_zones(self) -> List[dict]:
        now_dt = datetime.now(timezone.utc)
        result = []
        for z_id, z in self.zones.items():
            z_copy = dict(z)
            if z_copy.get("expires_at"):
                try:
                    exp_dt = datetime.fromisoformat(z_copy["expires_at"])
                    rem = (exp_dt - now_dt).total_seconds()
                    rem_sec = max(0.0, rem)
                    z_copy["remaining_seconds"] = rem_sec
                    if rem_sec <= 0:
                        z_copy["active"] = False
                        z["active"] = False
                        z["remaining_seconds"] = 0.0
                except Exception:
                    z_copy["remaining_seconds"] = 0.0
            else:
                z_copy["remaining_seconds"] = None
            result.append(z_copy)
        return result

    def get_active_zones(self) -> List[dict]:
        now_dt = datetime.now(timezone.utc)
        active_list = []
        for z in self.zones.values():
            if not z.get("active", True):
                continue
            if z.get("expires_at"):
                try:
                    exp_dt = datetime.fromisoformat(z["expires_at"])
                    if now_dt >= exp_dt:
                        z["active"] = False
                        z["remaining_seconds"] = 0.0
                        continue
                except Exception:
                    pass
            active_list.append(z)
        return active_list

    def add_zone(self, name: str, zone_type: str, geometry: dict,
                 min_alt: float = 0.0, max_alt: float = 120.0,
                 duration_seconds: Optional[float] = None,
                 operator_id: str = "OPERATOR-01") -> dict:
        """Generic zone creation: RED, YELLOW, TEMPORARY_RED, GREEN."""
        now_dt = datetime.now(timezone.utc)
        zone_type_upper = zone_type.upper()
        prefix_map = {"RED": "RED", "YELLOW": "YLW", "TEMPORARY_RED": "TEMP-RED", "GREEN": "GRN"}
        prefix = prefix_map.get(zone_type_upper, "ZONE")
        zone_id = f"{prefix}-{uuid.uuid4().hex[:6].upper()}"

        expires_at = None
        remaining_seconds = None
        if duration_seconds and duration_seconds > 0:
            exp_dt = datetime.fromtimestamp(now_dt.timestamp() + duration_seconds, tz=timezone.utc)
            expires_at = exp_dt.isoformat()
            remaining_seconds = float(duration_seconds)

        zone_dict = {
            "zone_id": zone_id,
            "name": name or f"{zone_type_upper} Zone",
            "zone_type": zone_type_upper,
            "geometry": geometry,
            "active": True,
            "created_at": now_dt.isoformat(),
            "expires_at": expires_at,
            "remaining_seconds": remaining_seconds,
            "min_altitude": min_alt,
            "max_altitude": max_alt,
            "operator_id": operator_id,
            "declared_at": now_dt.isoformat()
        }
        self.zones[zone_id] = zone_dict
        logger.info(f"Zone created: {zone_id} ({zone_type_upper}) by {operator_id}")
        return zone_dict

    def add_temporary_red_zone(self, name: str, geometry: dict, duration_seconds: float,
                               min_alt: float = 0.0, max_alt: float = 100.0,
                               operator_id: str = "OPERATOR-01") -> dict:
        """Backward-compatible helper — delegates to add_zone."""
        return self.add_zone(
            name=name or f"Temporary Red Zone ({int(duration_seconds)}s)",
            zone_type="TEMPORARY_RED",
            geometry=geometry,
            min_alt=min_alt,
            max_alt=max_alt,
            duration_seconds=duration_seconds,
            operator_id=operator_id
        )

    def deactivate_zone(self, zone_id: str) -> Optional[dict]:
        if zone_id not in self.zones:
            return None
        self.zones[zone_id]["active"] = False
        self.zones[zone_id]["remaining_seconds"] = 0.0
        logger.info(f"Zone deactivated: {zone_id}")
        return self.zones[zone_id]

    def expire_outdated_zones(self) -> List[str]:
        now_dt = datetime.now(timezone.utc)
        expired_ids = []
        for z_id, z in list(self.zones.items()):
            if z.get("active") and z.get("expires_at"):
                try:
                    exp_dt = datetime.fromisoformat(z["expires_at"])
                    if now_dt >= exp_dt:
                        z["active"] = False
                        z["remaining_seconds"] = 0.0
                        expired_ids.append(z_id)
                        logger.info(f"ZONE EXPIRED automatically: {z_id}")
                except Exception:
                    pass
        return expired_ids

zone_manager = ZoneManager()

# ============================================================
# Geofence Evaluation Engine
# ============================================================
def evaluate_geofence(lng: float, lat: float, alt: float) -> dict:
    active_zones = zone_manager.get_active_zones()
    matching_zones = []
    for zone in active_zones:
        coords = zone.get("geometry", {}).get("coordinates", [])
        if not coords:
            continue
        poly_ring = coords[0] if len(coords) > 0 and isinstance(coords[0][0], list) else coords
        if point_in_polygon(lng, lat, poly_ring):
            matching_zones.append(zone)

    if not matching_zones:
        return {
            "current_zone_id": "NONE",
            "current_zone_name": "Unrestricted Civil Airspace",
            "current_zone_type": "GREEN",
            "min_altitude": 0.0,
            "max_altitude": 120.0,
            "altitude_inside": 0.0 <= alt <= 120.0,
            "geofence_status": "COMPLIANT" if 0.0 <= alt <= 120.0 else "ALTITUDE_ENVELOPE_VIOLATION"
        }

    priority_map = {"TEMPORARY_RED": 1, "RED": 2, "YELLOW": 3, "GREEN": 4}
    matching_zones.sort(key=lambda z: priority_map.get(z["zone_type"], 5))

    primary_zone = matching_zones[0]
    min_alt = primary_zone.get("min_altitude", 0.0)
    max_alt = primary_zone.get("max_altitude", 120.0)
    alt_inside = (min_alt <= alt <= max_alt)

    z_type = primary_zone["zone_type"]
    if z_type in ["RED", "TEMPORARY_RED"]:
        geofence_status = "RED_ZONE_VIOLATION"
    elif not alt_inside:
        geofence_status = "ALTITUDE_ENVELOPE_VIOLATION"
    else:
        geofence_status = "COMPLIANT"

    return {
        "current_zone_id": primary_zone["zone_id"],
        "current_zone_name": primary_zone["name"],
        "current_zone_type": z_type,
        "min_altitude": min_alt,
        "max_altitude": max_alt,
        "altitude_inside": alt_inside,
        "geofence_status": geofence_status
    }

# ============================================================
# Append-Only Audit Log Manager
# ============================================================
class AuditManager:
    def __init__(self):
        self.log: List[dict] = []
        self.next_id: int = 1000
        self.record_event(
            operator_id="SYSTEM",
            role="ADMIN",
            action="SYSTEM_STARTUP",
            alert_id=None,
            track_id=None,
            reason="AERIS-C2 Security & Monitoring Engine initialized."
        )

    def record_event(
        self,
        operator_id: str,
        role: str,
        action: str,
        alert_id: Optional[str] = None,
        track_id: Optional[str] = None,
        reason: Optional[str] = ""
    ) -> dict:
        event_id = f"AUDIT-{self.next_id}"
        self.next_id += 1
        now_iso = datetime.now(timezone.utc).isoformat()

        entry = {
            "event_id": event_id,
            "timestamp": now_iso,
            "operator_id": operator_id or "OPERATOR-DEFAULT",
            "role": role or "OPERATOR",
            "action": action,
            "alert_id": alert_id or "",
            "track_id": track_id or "",
            "reason": reason or ""
        }
        self.log.append(entry)
        logger.info(f"AUDIT [{event_id}]: {action} by {entry['operator_id']} — {entry['reason'][:80]}")
        return entry

audit_manager = AuditManager()

# ============================================================
# Evidence Manager — Zone Entry Events (Append-Only, Deduplicated)
# ============================================================
class EvidenceManager:
    """
    Creates structured evidence records when a drone enters a RED/YELLOW/TEMPORARY_RED zone.
    Deduplication: one ZONE_ENTRY event per (drone_id, zone_id) entry episode.
    Camera evidence is only referenced if a recent REAL or MOCK vision observation exists
    within 15 seconds. It is NEVER fabricated.
    """
    def __init__(self):
        self.evidence: List[dict] = []
        self.next_ev_num: int = 1
        # Maps drone_id -> zone_id they are currently inside (for deduplication)
        self.drone_zone_state: Dict[str, str] = {}

    def check_zone_entry(self, track: dict) -> Optional[dict]:
        """
        Call after every telemetry or simulated position update.
        Returns a new EvidenceRecord if a zone entry is detected, otherwise None.
        """
        drone_id = track["drone_id"]
        current_zone_id = track.get("current_zone_id") or "NONE"
        current_zone_type = track.get("current_zone_type", "GREEN")
        prev_zone_id = self.drone_zone_state.get(drone_id, "NONE")

        # No zone change — no new event
        if current_zone_id == prev_zone_id:
            return None

        # Always update zone state
        self.drone_zone_state[drone_id] = current_zone_id

        # Only generate evidence for entry INTO RED/YELLOW/TEMP_RED zones
        if current_zone_type not in ("RED", "YELLOW", "TEMPORARY_RED"):
            return None

        # Build evidence record
        ev_id = f"EV-{self.next_ev_num:04d}"
        self.next_ev_num += 1

        # Check for a recent vision observation — NEVER fabricate camera data
        camera_ref: Any = "NOT_AVAILABLE"
        now_dt = datetime.now(timezone.utc)
        for obs in reversed(vision_manager.observations):
            try:
                obs_dt = datetime.fromisoformat(obs["timestamp"])
                if abs((now_dt - obs_dt).total_seconds()) <= 15.0:
                    camera_ref = {
                        "observation_id": obs["observation_id"],
                        "camera_id": obs["camera_id"],
                        "timestamp": obs["timestamp"],
                        "detected_class": obs.get("class", "drone"),
                        "confidence": obs.get("confidence", 0.0),
                        "bbox": obs.get("bbox"),
                        "is_mock": obs.get("is_mock", True),
                        "note": (
                            "MOCK/DEMO observation — not from a calibrated real camera feed"
                            if obs.get("is_mock", True) else "Real camera observation"
                        )
                    }
                    break
            except Exception:
                pass

        ev_dict = {
            "evidence_id": ev_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event_type": "ZONE_ENTRY",
            "track_id": track["track_id"],
            "drone_id": drone_id,
            "latitude": track["latitude"],
            "longitude": track["longitude"],
            "altitude": track.get("altitude", 0),
            "speed": track.get("speed", 0),
            "heading": track.get("heading", 0),
            "zone_id": current_zone_id,
            "zone_name": track.get("current_zone_name", ""),
            "zone_type": current_zone_type,
            "classification": track.get("current_classification", "UNKNOWN"),
            "registration": track.get("registration", "UNKNOWN"),
            "operator": track.get("operator", "UNKNOWN"),
            "telemetry_source": track.get("telemetry_source", "UNKNOWN"),
            "camera_evidence": camera_ref
        }

        self.evidence.append(ev_dict)
        logger.info(
            f"EVIDENCE [{ev_id}]: ZONE_ENTRY — {drone_id} entered "
            f"{current_zone_type} zone {current_zone_id}"
        )
        return ev_dict

evidence_manager = EvidenceManager()

# ============================================================
# Alert Engine & Deduplication Hub
# ============================================================
SUGGESTED_ACTIONS = {
    "UNREGISTERED": "Verify drone identity and initiate officer assessment.",
    "OUT_OF_ENVELOPE": "Verify flight authorization and assess escalation.",
    "LOST_LINK": "Attempt telemetry verification and visually confirm track.",
    "AUTHORISED": "Maintain standard monitoring.",
    "YELLOW_ZONE": "Monitor drone in advisory zone. Verify flight plan if required."
}

VALID_REASON_CODES = [
    "CONFIRMED_VIOLATION",
    "AUTHORIZED_OPERATION",
    "FALSE_POSITIVE",
    "DUPLICATE_ALERT",
    "LOST_LINK_RESOLVED",
    "IDENTITY_VERIFIED",
    "ESCALATED_TO_SUPERVISOR",
    "OTHER"
]

class AlertManager:
    def __init__(self):
        self.alerts: Dict[str, dict] = {}
        self.active_drone_alerts: Dict[str, str] = {}  # drone_id -> alert_id
        self.next_alert_num: int = 1001
        # Yellow zone advisory deduplication
        self.drone_yellow_zone: Dict[str, str] = {}  # drone_id -> yellow zone_id

    def process_track_classification(self, track: dict) -> Optional[dict]:
        drone_id = track["drone_id"]
        classification = track["current_classification"]

        if classification == "AUTHORISED":
            # Resolve existing open non-advisory alert for this drone
            if drone_id in self.active_drone_alerts:
                open_alert_id = self.active_drone_alerts.pop(drone_id)
                if open_alert_id in self.alerts:
                    alert = self.alerts[open_alert_id]
                    if alert["status"] in ["OPEN", "ESCALATED"]:
                        alert["status"] = "RESOLVED"
                        alert["reason"] = "Track returned to AUTHORISED state."
                        logger.info(f"ALERT RESOLVED [{open_alert_id}] for {drone_id}")
                        return alert
            # Check for yellow zone advisory
            return self._check_yellow_zone_advisory(track)

        # Determine priority & reason for non-authorised classifications
        if classification == "OUT_OF_ENVELOPE":
            zone_type = track.get("current_zone_type", "")
            if zone_type == "TEMPORARY_RED":
                priority = "CRITICAL"
                reason = (f"Drone operating inside TEMPORARY_RED ZONE "
                          f"({track.get('current_zone_name','')}) at {track.get('altitude',0)}m altitude.")
            else:
                priority = "HIGH"
                reason = (f"Drone violating airspace envelope ({track.get('geofence_status','')}) "
                          f"in {track.get('current_zone_name','')}.")
        elif classification == "LOST_LINK":
            priority = "HIGH"
            reason = f"Telemetry stream interrupted for drone {drone_id} (>{TELEMETRY_TIMEOUT_SECONDS}s)."
        elif classification == "UNREGISTERED":
            priority = "MEDIUM"
            reason = f"Unregistered drone {drone_id} operating without active civil aviation registry."
        else:
            priority = "LOW"
            reason = f"Track classification anomaly: {classification}"

        suggested_action = SUGGESTED_ACTIONS.get(classification, "Initiate standard civil monitoring.")

        # DEDUPLICATION: update in-place if active alert exists for this drone
        existing_alert_id = self.active_drone_alerts.get(drone_id)
        if existing_alert_id and existing_alert_id in self.alerts:
            existing_alert = self.alerts[existing_alert_id]
            existing_alert["latitude"] = track["latitude"]
            existing_alert["longitude"] = track["longitude"]
            existing_alert["altitude"] = track.get("altitude", 0)
            existing_alert["timestamp"] = track["last_seen"]
            if existing_alert["status"] in ["OPEN", "ESCALATED"]:
                existing_alert["classification"] = classification
                existing_alert["priority"] = priority
                existing_alert["reason"] = reason
                existing_alert["suggested_action"] = suggested_action
            return existing_alert

        # Create new alert
        alert_id = f"ALERT-{self.next_alert_num}"
        self.next_alert_num += 1

        alert_dict = {
            "alert_id": alert_id,
            "track_id": track["track_id"],
            "drone_id": drone_id,
            "classification": classification,
            "priority": priority,
            "reason": reason,
            "suggested_action": suggested_action,
            "timestamp": track["last_seen"],
            "latitude": track["latitude"],
            "longitude": track["longitude"],
            "altitude": track.get("altitude", 0),
            "status": "OPEN",
            "operator_disposition": None
        }

        self.alerts[alert_id] = alert_dict
        self.active_drone_alerts[drone_id] = alert_id
        logger.info(f"NEW ALERT [{alert_id}]: {priority} — {classification} for {drone_id}")
        return alert_dict

    def _check_yellow_zone_advisory(self, track: dict) -> Optional[dict]:
        """Creates a LOW priority advisory when a COMPLIANT drone enters a YELLOW zone."""
        drone_id = track["drone_id"]
        zone_type = track.get("current_zone_type", "GREEN")
        zone_id = track.get("current_zone_id", "NONE")

        if zone_type != "YELLOW" or zone_id == "NONE":
            self.drone_yellow_zone.pop(drone_id, None)
            return None

        # Deduplication: same zone → no new advisory
        if self.drone_yellow_zone.get(drone_id) == zone_id:
            return None

        self.drone_yellow_zone[drone_id] = zone_id

        alert_id = f"ALERT-{self.next_alert_num}"
        self.next_alert_num += 1
        alert_dict = {
            "alert_id": alert_id,
            "track_id": track["track_id"],
            "drone_id": drone_id,
            "classification": "AUTHORISED",
            "priority": "LOW",
            "reason": (f"Drone {drone_id} entered YELLOW advisory zone: "
                       f"{track.get('current_zone_name','')}. Flight plan verification recommended."),
            "suggested_action": SUGGESTED_ACTIONS["YELLOW_ZONE"],
            "timestamp": track["last_seen"],
            "latitude": track["latitude"],
            "longitude": track["longitude"],
            "altitude": track.get("altitude", 0),
            "status": "OPEN",
            "operator_disposition": None
        }
        self.alerts[alert_id] = alert_dict
        logger.info(f"YELLOW ZONE ADVISORY [{alert_id}] for {drone_id} in {zone_id}")
        return alert_dict

    def apply_disposition(self, alert_id: str, action: str, reason_code: str,
                          operator_id: str, role: str) -> dict:
        if alert_id not in self.alerts:
            raise HTTPException(status_code=404, detail="Alert not found")

        alert = self.alerts[alert_id]

        if not action or action.upper() not in ["CONFIRM", "DISMISS", "ESCALATE"]:
            raise HTTPException(status_code=400, detail="Invalid action. Must be CONFIRM, DISMISS, or ESCALATE")

        if not reason_code or reason_code not in VALID_REASON_CODES:
            raise HTTPException(
                status_code=400,
                detail=f"Valid reason_code required. Must be one of: {VALID_REASON_CODES}"
            )

        if not operator_id or not operator_id.strip():
            raise HTTPException(status_code=400, detail="operator_id is required")

        now_iso = datetime.now(timezone.utc).isoformat()
        status_map = {"CONFIRM": "CONFIRMED", "DISMISS": "DISMISSED", "ESCALATE": "ESCALATED"}
        new_status = status_map[action.upper()]

        alert["status"] = new_status
        alert["operator_disposition"] = {
            "action": action.upper(),
            "reason_code": reason_code,
            "operator_id": operator_id.strip(),
            "role": role or "OPERATOR",
            "timestamp": now_iso
        }

        audit_manager.record_event(
            operator_id=operator_id.strip(),
            role=role or "OPERATOR",
            action=f"ALERT_{new_status}",
            alert_id=alert_id,
            track_id=alert["track_id"],
            reason=f"Disposition: {action.upper()} | ReasonCode: {reason_code}"
        )

        return alert

alert_manager = AlertManager()

# ============================================================
# Pydantic Request Models
# ============================================================
class DispositionRequest(BaseModel):
    action: str
    reason_code: str
    operator_id: str
    role: Optional[str] = "OPERATOR"

class TempRedZoneRequest(BaseModel):
    name: Optional[str] = "Temporary Red Zone"
    geometry: dict
    duration_seconds: float = 60.0
    min_altitude: float = 0.0
    max_altitude: float = 100.0
    operator_id: Optional[str] = "OPERATOR-01"
    role: Optional[str] = "OPERATOR"

class SimulatePositionRequest(BaseModel):
    """
    SIMULATION / DEMO ONLY.
    Updates a drone's position for demonstration purposes.
    Live telemetry from the Python sender resumes naturally on next packet.
    """
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    speed: Optional[float] = None
    heading: Optional[float] = None
    operator_id: Optional[str] = "OPERATOR-01"
    role: Optional[str] = "OPERATOR"

class CreateZoneRequest(BaseModel):
    """Generic zone creation: RED, YELLOW, TEMPORARY_RED, GREEN."""
    name: str
    zone_type: str
    geometry: dict
    min_altitude: float = 0.0
    max_altitude: float = 120.0
    duration_seconds: Optional[float] = None
    operator_id: Optional[str] = "OPERATOR-01"
    role: Optional[str] = "OPERATOR"

class DeactivateZoneRequest(BaseModel):
    operator_id: Optional[str] = "OPERATOR-01"
    role: Optional[str] = "OPERATOR"

# ============================================================
# Data Retention Policy Manager
# ============================================================
class DataRetentionManager:
    def __init__(self, retention_days: int = DEFAULT_RETENTION_DAYS):
        self.retention_days = retention_days

    def purge_expired_records(self) -> dict:
        now_dt = datetime.now(timezone.utc)
        cutoff_seconds = self.retention_days * 86400
        purged_counts = {"telemetry": 0, "audit": 0}

        stale_drones = []
        for drone_id, track in list(track_manager.tracks.items()):
            try:
                last_seen_dt = datetime.fromisoformat(track["last_seen"])
                if (now_dt - last_seen_dt).total_seconds() > cutoff_seconds:
                    stale_drones.append(drone_id)
            except Exception:
                pass

        for d_id in stale_drones:
            del track_manager.tracks[d_id]
            purged_counts["telemetry"] += 1

        return purged_counts

retention_manager = DataRetentionManager()

# ============================================================
# Vision Engine & YOLO-Class Detector (Mock/Demo)
# ============================================================
class VisionObservation(BaseModel):
    observation_id: str
    camera_id: str
    timestamp: str
    detected_class: str = Field(alias="class", default="drone")
    confidence: float
    bbox: List[float]
    image_url: Optional[str] = None
    is_mock: bool = True

class VisionDetectorInterface:
    """Standardized YOLO-Class Detector Interface — plug-and-play for real model replacement."""
    def detect_frame(self, frame_bytes: bytes, camera_id: str, timestamp: str) -> List[dict]:
        raise NotImplementedError

class MockYOLOv8Detector(VisionDetectorInterface):
    """
    Demonstration YOLO-class detector.
    Note: Current vision mode is demonstration/mock.
    Precision/Recall: Unmeasured (Mock inference mode).
    """
    def __init__(self):
        self.mode = "DEMONSTRATION/MOCK"
        self.model_name = "YOLOv8-Drone-Detector (Demo Interface)"

    def detect_frame(self, frame_bytes: bytes, camera_id: str, timestamp: str) -> List[dict]:
        return [{"class": "drone", "confidence": 0.94, "bbox": [180.0, 110.0, 310.0, 220.0]}]

class VisionManager:
    def __init__(self):
        self.detector = MockYOLOv8Detector()
        self.observations: List[dict] = []
        self.next_obs_id: int = 5001
        self.model_status_info = {
            "mode": "DEMONSTRATION/MOCK",
            "model_name": "YOLOv8-Civil-Drone (Demo)",
            "evaluation_status": "Model evaluation pending; current vision mode is demonstration/mock.",
            "metrics": {
                "precision": "UNMEASURED (MOCK/DEMO)",
                "recall": "UNMEASURED (MOCK/DEMO)",
                "dataset": "Simulated Airspace Video Feed",
                "confidence_threshold": 0.50
            }
        }

    def process_frame_observation(self, camera_id: str, timestamp: str = None, raw_bytes: bytes = None,
                                   detected_class: str = "drone", confidence: float = 0.94,
                                   bbox: List[float] = None) -> dict:
        obs_id = f"VIS-OBS-{self.next_obs_id}"
        self.next_obs_id += 1
        now_iso = timestamp or datetime.now(timezone.utc).isoformat()
        if bbox is None:
            bbox = [180.0, 110.0, 310.0, 220.0]

        obs_dict = {
            "observation_id": obs_id,
            "camera_id": camera_id or "CAM-01",
            "timestamp": now_iso,
            "class": detected_class,
            "confidence": round(confidence, 2),
            "bbox": bbox,
            "is_mock": True,
            "correlation": self.correlate_observation(now_iso, camera_id)
        }
        self.observations.append(obs_dict)
        logger.info(f"VISION [{obs_id}]: {detected_class} ({confidence*100:.1f}%) on {camera_id}")
        return obs_dict

    def correlate_observation(self, obs_timestamp_iso: str, camera_id: str) -> dict:
        """Correlates visual observation with active telemetry tracks (temporal heuristic only)."""
        active_tracks = list(track_manager.tracks.values())
        if not active_tracks:
            return {"status": "UNMATCHED", "correlated_track_id": None, "correlated_drone_id": None,
                    "confidence_score": 0.0, "correlation_type": "None",
                    "notes": "No active telemetry tracks in airspace."}

        try:
            obs_dt = datetime.fromisoformat(obs_timestamp_iso)
        except Exception:
            obs_dt = datetime.now(timezone.utc)

        candidates = []
        for track in active_tracks:
            try:
                track_dt = datetime.fromisoformat(track["last_seen"])
                delta_sec = abs((obs_dt - track_dt).total_seconds())
            except Exception:
                delta_sec = 999.0
            if delta_sec <= 15.0 and track.get("link_status") == "CONNECTED":
                candidates.append((delta_sec, track))

        if not candidates:
            return {"status": "UNMATCHED", "correlated_track_id": None, "correlated_drone_id": None,
                    "confidence_score": 0.0, "correlation_type": "None",
                    "notes": "No temporally proximate telemetry track found within window."}

        candidates.sort(key=lambda c: c[0])
        best_delta, best_track = candidates[0]
        correlation_status = "CORRELATED" if best_delta <= 5.0 else "POTENTIAL MATCH"

        return {
            "status": correlation_status,
            "correlated_track_id": best_track["track_id"],
            "correlated_drone_id": best_track["drone_id"],
            "time_delta_seconds": round(best_delta, 2),
            "correlation_type": "Temporal & Operational Track Association",
            "notes": (f"Potential correlation with {best_track['drone_id']} "
                      f"({best_track['current_classification']}) — Camera {camera_id} (Uncalibrated Visual Bearing)")
        }

vision_manager = VisionManager()

class TelemetryResult(tuple):
    def __new__(cls, track, alert, evidence=None):
        obj = super().__new__(cls, (track, alert))
        obj.track = track
        obj.alert = alert
        obj.evidence = evidence
        return obj

# ============================================================
# Track Manager Hub
# ============================================================
class TrackManager:
    def __init__(self):
        self.tracks: Dict[str, dict] = {}
        self.drone_track_map: Dict[str, str] = {}
        self.next_track_number: int = 1
        self.dashboard_connections: List[WebSocket] = []

    def get_or_create_track_id(self, drone_id: str) -> str:
        if drone_id not in self.drone_track_map:
            track_id = f"TRACK-{self.next_track_number:03d}"
            self.next_track_number += 1
            self.drone_track_map[drone_id] = track_id
        return self.drone_track_map[drone_id]

    def find_drone_by_track_id(self, track_id: str) -> Optional[str]:
        """Returns drone_id for a given track_id, or None."""
        for drone_id, t_id in self.drone_track_map.items():
            if t_id == track_id:
                return drone_id
        return None

    def update_telemetry(self, data: dict) -> tuple:
        """Process incoming telemetry. Returns (track, alert, evidence) tuple."""
        drone_id = str(data.get("drone_id", "UNKNOWN"))
        now_dt = datetime.now(timezone.utc)
        now_iso = now_dt.isoformat()
        timestamp = str(data.get("timestamp") or now_iso)

        lat = float(data.get("latitude", 0.0))
        lng = float(data.get("longitude", 0.0))
        alt = float(data.get("altitude", 0.0))

        track_id = self.get_or_create_track_id(drone_id)
        existing_track = self.tracks.get(drone_id)
        first_seen = existing_track["first_seen"] if existing_track else now_iso

        reg_info = lookup_drone_registry(drone_id)
        geo_info = evaluate_geofence(lng, lat, alt)

        if not reg_info["is_registered"] or reg_info["authorization_status"] != "ACTIVE":
            current_classification = "UNREGISTERED"
        elif geo_info["geofence_status"] in ["RED_ZONE_VIOLATION", "ALTITUDE_ENVELOPE_VIOLATION"]:
            current_classification = "OUT_OF_ENVELOPE"
        else:
            current_classification = "AUTHORISED"

        track_dict = {
            "track_id": track_id,
            "drone_id": drone_id,
            "drone_type": reg_info["drone_type"],
            "classification": reg_info["classification"],
            "registration": reg_info["registration"],
            "operator": reg_info["operator"],
            "telemetry_source": str(data.get("source") or "Simulated Python Sender"),

            "latitude": lat,
            "longitude": lng,
            "altitude": alt,
            "speed": float(data.get("speed", 0.0)),
            "heading": float(data.get("heading", 0.0)),
            "timestamp": timestamp,

            "authorization_status": reg_info["authorization_status"],
            "current_classification": current_classification,
            "first_seen": first_seen,
            "last_seen": now_iso,
            "link_status": "CONNECTED",

            "current_zone_id": geo_info["current_zone_id"],
            "current_zone_name": geo_info["current_zone_name"],
            "current_zone_type": geo_info["current_zone_type"],
            "min_altitude": geo_info["min_altitude"],
            "max_altitude": geo_info["max_altitude"],
            "altitude_inside": geo_info["altitude_inside"],
            "geofence_status": geo_info["geofence_status"]
        }

        self.tracks[drone_id] = track_dict
        alert = alert_manager.process_track_classification(track_dict)

        # Zone-entry evidence detection (deduplication inside EvidenceManager)
        evidence = evidence_manager.check_zone_entry(track_dict)
        if evidence:
            audit_manager.record_event(
                operator_id="SYSTEM",
                role="ADMIN",
                action=f"ZONE_ENTRY_{geo_info['current_zone_type']}",
                track_id=track_id,
                reason=(f"Drone {drone_id} entered {geo_info['current_zone_type']} zone "
                        f"{geo_info['current_zone_id']} at ({lat:.5f},{lng:.5f}) "
                        f"Alt:{alt}m | {track_dict['telemetry_source']}")
            )

        return TelemetryResult(track_dict, alert, evidence)

    def reevaluate_all_tracks(self) -> List[tuple]:
        """Re-run geofence evaluation on all connected tracks. Returns (track, alert, evidence) tuples."""
        updated = []
        for drone_id, track in self.tracks.items():
            if track["link_status"] == "CONNECTED":
                geo_info = evaluate_geofence(track["longitude"], track["latitude"], track["altitude"])
                track.update({
                    "current_zone_id": geo_info["current_zone_id"],
                    "current_zone_name": geo_info["current_zone_name"],
                    "current_zone_type": geo_info["current_zone_type"],
                    "min_altitude": geo_info["min_altitude"],
                    "max_altitude": geo_info["max_altitude"],
                    "altitude_inside": geo_info["altitude_inside"],
                    "geofence_status": geo_info["geofence_status"]
                })
                reg_info = lookup_drone_registry(drone_id)
                if not reg_info["is_registered"] or reg_info["authorization_status"] != "ACTIVE":
                    track["current_classification"] = "UNREGISTERED"
                elif geo_info["geofence_status"] in ["RED_ZONE_VIOLATION", "ALTITUDE_ENVELOPE_VIOLATION"]:
                    track["current_classification"] = "OUT_OF_ENVELOPE"
                else:
                    track["current_classification"] = "AUTHORISED"

                alert = alert_manager.process_track_classification(track)
                evidence = evidence_manager.check_zone_entry(track)
                updated.append((track, alert, evidence))
        return updated

    def evaluate_lost_links(self) -> List[tuple]:
        now_dt = datetime.now(timezone.utc)
        lost = []
        for drone_id, track in self.tracks.items():
            if track["current_classification"] == "LOST_LINK":
                continue
            try:
                last_seen_dt = datetime.fromisoformat(track["last_seen"])
                elapsed = (now_dt - last_seen_dt).total_seconds()
            except Exception:
                elapsed = 0.0

            if elapsed > TELEMETRY_TIMEOUT_SECONDS:
                logger.warning(f"LOST LINK [{drone_id}]: {elapsed:.1f}s elapsed")
                track["current_classification"] = "LOST_LINK"
                track["link_status"] = "LOST_LINK"
                alert = alert_manager.process_track_classification(track)
                lost.append(TelemetryResult(track, alert, None))
        return lost

    async def connect_dashboard(self, websocket: WebSocket):
        await websocket.accept()
        self.dashboard_connections.append(websocket)
        initial_payload = {
            "type": "initial_state",
            "tracks": list(self.tracks.values()),
            "zones": zone_manager.get_all_zones(),
            "alerts": list(alert_manager.alerts.values()),
            "audit_log": audit_manager.log[-50:],
            "evidence": evidence_manager.evidence[-50:],
            "vision_observations": vision_manager.observations[-20:],
            "vision_model_status": vision_manager.model_status_info,
            "retention_days": retention_manager.retention_days,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await websocket.send_text(json_lib.dumps(initial_payload))

    def disconnect_dashboard(self, websocket: WebSocket):
        if websocket in self.dashboard_connections:
            self.dashboard_connections.remove(websocket)

    async def broadcast_to_dashboards(self, message: dict):
        if not self.dashboard_connections:
            return
        payload_str = json_lib.dumps(message)
        disconnected = []
        for ws in self.dashboard_connections:
            try:
                await ws.send_text(payload_str)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            self.disconnect_dashboard(ws)

track_manager = TrackManager()

# ============================================================
# Unified Background Inspector
# ============================================================
async def periodic_background_inspector():
    while True:
        try:
            # 1. Check for expired zones
            expired_ids = zone_manager.expire_outdated_zones()
            if expired_ids:
                for z_id in expired_ids:
                    audit_manager.record_event(
                        operator_id="SYSTEM",
                        role="ADMIN",
                        action="ZONE_EXPIRATION",
                        reason=f"Zone {z_id} duration elapsed and expired automatically."
                    )

                reevaluated = track_manager.reevaluate_all_tracks()
                await track_manager.broadcast_to_dashboards({
                    "type": "zones_updated",
                    "zones": zone_manager.get_all_zones(),
                    "expired_ids": expired_ids
                })
                for tr, alert, evidence in reevaluated:
                    await track_manager.broadcast_to_dashboards({"type": "track_update", "track": tr})
                    if alert:
                        await track_manager.broadcast_to_dashboards({"type": "alert_update", "alert": alert})
                    if evidence:
                        await track_manager.broadcast_to_dashboards({"type": "evidence_created", "evidence": evidence})

            # 2. Check for lost links
            lost = track_manager.evaluate_lost_links()
            for track, alert, _ in lost:
                await track_manager.broadcast_to_dashboards({"type": "track_update", "track": track})
                if alert:
                    await track_manager.broadcast_to_dashboards({"type": "alert_update", "alert": alert})

        except Exception as e:
            logger.error(f"Background inspector error: {e}")
        await asyncio.sleep(1.0)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(periodic_background_inspector())
    logger.info("AERIS-C2 Phase 5 — Drag Simulation + Evidence + Zone Management initialized.")

# ============================================================
# REST API Endpoints
# ============================================================

# --- Tracks ---
@app.get("/api/tracks")
def get_tracks():
    return {"status": "success", "count": len(track_manager.tracks),
            "tracks": list(track_manager.tracks.values())}

@app.post("/api/tracks/{track_id}/simulate-position")
async def simulate_track_position(track_id: str, req: SimulatePositionRequest):
    """
    DEMO / SIMULATION MODE ONLY.
    Moves a drone to a new simulated position, runs geofence + alert + evidence evaluation,
    and broadcasts updated state to all dashboard clients.
    Live telemetry from the Python sender resumes on the next packet and will take precedence.
    """
    drone_id = track_manager.find_drone_by_track_id(track_id)
    if not drone_id:
        raise HTTPException(status_code=404, detail=f"Track '{track_id}' not found")

    existing = track_manager.tracks.get(drone_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"No active track data for '{track_id}'")

    lat = float(req.latitude)
    lng = float(req.longitude)
    alt = float(req.altitude) if req.altitude is not None else existing["altitude"]
    speed = float(req.speed) if req.speed is not None else existing["speed"]
    heading = float(req.heading) if req.heading is not None else existing["heading"]

    now_iso = datetime.now(timezone.utc).isoformat()
    reg_info = lookup_drone_registry(drone_id)
    geo_info = evaluate_geofence(lng, lat, alt)

    if not reg_info["is_registered"] or reg_info["authorization_status"] != "ACTIVE":
        current_classification = "UNREGISTERED"
    elif geo_info["geofence_status"] in ["RED_ZONE_VIOLATION", "ALTITUDE_ENVELOPE_VIOLATION"]:
        current_classification = "OUT_OF_ENVELOPE"
    else:
        current_classification = "AUTHORISED"

    updated_track = {
        **existing,
        "latitude": lat,
        "longitude": lng,
        "altitude": alt,
        "speed": speed,
        "heading": heading,
        "timestamp": now_iso,
        "last_seen": now_iso,
        "link_status": "CONNECTED",
        "telemetry_source": f"SIMULATED_DRAG [{req.operator_id or 'OPERATOR'}]",
        "current_classification": current_classification,
        "authorization_status": reg_info["authorization_status"],
        "current_zone_id": geo_info["current_zone_id"],
        "current_zone_name": geo_info["current_zone_name"],
        "current_zone_type": geo_info["current_zone_type"],
        "min_altitude": geo_info["min_altitude"],
        "max_altitude": geo_info["max_altitude"],
        "altitude_inside": geo_info["altitude_inside"],
        "geofence_status": geo_info["geofence_status"]
    }

    track_manager.tracks[drone_id] = updated_track
    alert = alert_manager.process_track_classification(updated_track)
    evidence = evidence_manager.check_zone_entry(updated_track)

    if evidence:
        audit_manager.record_event(
            operator_id=req.operator_id or "OPERATOR-01",
            role=req.role or "OPERATOR",
            action=f"ZONE_ENTRY_{geo_info['current_zone_type']}_SIMULATED",
            track_id=track_id,
            reason=(f"[SIMULATION] {drone_id} dragged into {geo_info['current_zone_type']} zone "
                    f"{geo_info['current_zone_id']} at ({lat:.5f},{lng:.5f}) Alt:{alt}m")
        )
        await track_manager.broadcast_to_dashboards({"type": "evidence_created", "evidence": evidence})

    # Audit simulation position change
    audit_manager.record_event(
        operator_id=req.operator_id or "OPERATOR-01",
        role=req.role or "OPERATOR",
        action="SIMULATION_POSITION_UPDATE",
        track_id=track_id,
        reason=(f"[SIMULATION] Drag to ({lat:.5f},{lng:.5f}) Alt:{alt}m | "
                f"Zone:{geo_info['current_zone_type']} | Class:{current_classification}")
    )

    await track_manager.broadcast_to_dashboards({"type": "track_update", "track": updated_track})
    if alert:
        await track_manager.broadcast_to_dashboards({"type": "alert_update", "alert": alert})

    return {"status": "success", "track": updated_track, "alert": alert, "evidence": evidence}

# --- Zones ---
@app.get("/api/zones")
def get_zones():
    return {"status": "success", "zones": zone_manager.get_all_zones()}

@app.post("/api/zones")
async def create_zone(req: CreateZoneRequest):
    """Create and immediately activate a zone: RED, YELLOW, TEMPORARY_RED, or GREEN."""
    if not req.geometry or "coordinates" not in req.geometry:
        raise HTTPException(status_code=400, detail="Invalid GeoJSON geometry")

    zone_type = req.zone_type.upper()
    if zone_type not in ("RED", "YELLOW", "TEMPORARY_RED", "GREEN"):
        raise HTTPException(status_code=400,
                            detail="Invalid zone_type. Must be RED, YELLOW, TEMPORARY_RED, or GREEN")

    zone = zone_manager.add_zone(
        name=req.name,
        zone_type=zone_type,
        geometry=req.geometry,
        min_alt=req.min_altitude,
        max_alt=req.max_altitude,
        duration_seconds=req.duration_seconds,
        operator_id=req.operator_id or "OPERATOR-01"
    )

    duration_note = f" ({int(req.duration_seconds)}s)" if req.duration_seconds else ""
    audit_entry = audit_manager.record_event(
        operator_id=req.operator_id or "OPERATOR-01",
        role=req.role or "OPERATOR",
        action="ZONE_DECLARED",
        reason=(f"Zone {zone['zone_id']} ({zone_type}{duration_note}) declared active. "
                f"Alt envelope: {req.min_altitude}m–{req.max_altitude}m")
    )

    reevaluated = track_manager.reevaluate_all_tracks()

    await track_manager.broadcast_to_dashboards({
        "type": "zone_created",
        "zone": zone,
        "audit_entry": audit_entry
    })
    for tr, alert, evidence in reevaluated:
        await track_manager.broadcast_to_dashboards({"type": "track_update", "track": tr})
        if alert:
            await track_manager.broadcast_to_dashboards({"type": "alert_update", "alert": alert})
        if evidence:
            await track_manager.broadcast_to_dashboards({"type": "evidence_created", "evidence": evidence})

    return {"status": "success", "zone": zone}

@app.post("/api/zones/temporary-red")
async def create_temporary_red_zone(req: TempRedZoneRequest):
    """Backward-compatible temporary red zone endpoint."""
    if not req.geometry or "coordinates" not in req.geometry:
        raise HTTPException(status_code=400, detail="Invalid GeoJSON geometry")

    zone = zone_manager.add_temporary_red_zone(
        name=req.name,
        geometry=req.geometry,
        duration_seconds=req.duration_seconds,
        min_alt=req.min_altitude,
        max_alt=req.max_altitude,
        operator_id=req.operator_id or "OPERATOR-01"
    )

    audit_entry = audit_manager.record_event(
        operator_id=req.operator_id or "OPERATOR-01",
        role=req.role or "OPERATOR",
        action="ZONE_CREATION",
        reason=f"Created Temporary Red Zone {zone['zone_id']} ({int(req.duration_seconds)}s)"
    )

    reevaluated = track_manager.reevaluate_all_tracks()

    await track_manager.broadcast_to_dashboards({
        "type": "zone_created",
        "zone": zone,
        "audit_entry": audit_entry
    })
    for tr, alert, evidence in reevaluated:
        await track_manager.broadcast_to_dashboards({"type": "track_update", "track": tr})
        if alert:
            await track_manager.broadcast_to_dashboards({"type": "alert_update", "alert": alert})
        if evidence:
            await track_manager.broadcast_to_dashboards({"type": "evidence_created", "evidence": evidence})

    return {"status": "success", "zone": zone}

@app.post("/api/zones/{zone_id}/deactivate")
async def deactivate_zone(zone_id: str, req: Optional[DeactivateZoneRequest] = None):
    """Deactivate an active zone. Does not delete — preserves operational history."""
    op_id = (req.operator_id if req else None) or "OPERATOR-01"
    role = (req.role if req else None) or "OPERATOR"

    zone = zone_manager.deactivate_zone(zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found")

    audit_entry = audit_manager.record_event(
        operator_id=op_id,
        role=role,
        action="ZONE_DEACTIVATED",
        reason=f"Zone {zone_id} ({zone.get('zone_type','')}) deactivated by {op_id}."
    )

    reevaluated = track_manager.reevaluate_all_tracks()

    await track_manager.broadcast_to_dashboards({
        "type": "zones_updated",
        "zones": zone_manager.get_all_zones(),
        "expired_ids": [zone_id]
    })
    for tr, alert, _ in reevaluated:
        await track_manager.broadcast_to_dashboards({"type": "track_update", "track": tr})
        if alert:
            await track_manager.broadcast_to_dashboards({"type": "alert_update", "alert": alert})

    return {"status": "success", "zone": zone, "audit_entry": audit_entry}

# --- Alerts ---
@app.get("/api/alerts")
def get_alerts():
    priority_order = {"CRITICAL": 1, "HIGH": 2, "MEDIUM": 3, "LOW": 4}
    sorted_alerts = sorted(
        list(alert_manager.alerts.values()),
        key=lambda a: (priority_order.get(a["priority"], 5), a["timestamp"])
    )
    return {"status": "success", "count": len(sorted_alerts), "alerts": sorted_alerts}

@app.post("/api/alerts/{alert_id}/disposition")
async def post_alert_disposition(alert_id: str, req: DispositionRequest):
    updated_alert = alert_manager.apply_disposition(
        alert_id=alert_id,
        action=req.action,
        reason_code=req.reason_code,
        operator_id=req.operator_id,
        role=req.role or "OPERATOR"
    )

    await track_manager.broadcast_to_dashboards({
        "type": "alert_update",
        "alert": updated_alert,
        "audit_entry": audit_manager.log[-1]
    })

    return {"status": "success", "alert": updated_alert}

# --- Evidence ---
@app.get("/api/evidence")
def get_evidence():
    return {
        "status": "success",
        "count": len(evidence_manager.evidence),
        "evidence": evidence_manager.evidence
    }

@app.get("/api/evidence/export")
def export_evidence(format: str = "json"):
    """Export all zone-entry evidence records as JSON or CSV."""
    if format.lower() == "csv":
        output = io.StringIO()
        fieldnames = [
            "evidence_id", "timestamp", "event_type", "track_id", "drone_id",
            "latitude", "longitude", "altitude", "speed", "heading",
            "zone_id", "zone_name", "zone_type", "classification",
            "registration", "operator", "telemetry_source", "camera_evidence"
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for ev in evidence_manager.evidence:
            row = dict(ev)
            row["camera_evidence"] = str(row.get("camera_evidence", "NOT_AVAILABLE"))
            writer.writerow(row)
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=aeris_c2_evidence.csv"}
        )
    else:
        content = json_lib.dumps(evidence_manager.evidence, indent=2)
        return Response(
            content=content,
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=aeris_c2_evidence.json"}
        )

@app.get("/api/evidence/{evidence_id}")
def get_evidence_record(evidence_id: str):
    for ev in evidence_manager.evidence:
        if ev["evidence_id"] == evidence_id:
            return {"status": "success", "evidence": ev}
    raise HTTPException(status_code=404, detail=f"Evidence '{evidence_id}' not found")

# --- Audit ---
@app.get("/api/audit")
def get_audit_log():
    return {"status": "success", "count": len(audit_manager.log), "audit_log": audit_manager.log}

@app.get("/api/audit/export")
def export_audit_log(format: str = "csv"):
    if format.lower() == "json":
        json_content = json_lib.dumps(audit_manager.log, indent=2)
        return Response(
            content=json_content,
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=aeris_c2_audit_log.json"}
        )
    else:
        output = io.StringIO()
        writer = csv.DictWriter(
            output,
            fieldnames=["event_id", "timestamp", "operator_id", "role", "action",
                        "alert_id", "track_id", "reason"]
        )
        writer.writeheader()
        for entry in audit_manager.log:
            writer.writerow(entry)
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=aeris_c2_audit_log.csv"}
        )

# --- Vision ---
class VisionManualRequest(BaseModel):
    camera_id: Optional[str] = "CAM-01"
    timestamp: Optional[str] = None
    detected_class: Optional[str] = "drone"
    confidence: Optional[float] = 0.94
    bbox: Optional[List[float]] = [180.0, 110.0, 310.0, 220.0]

@app.get("/api/vision/status")
def get_vision_status():
    return {
        "status": "success",
        "model_status": vision_manager.model_status_info,
        "observation_count": len(vision_manager.observations),
        "detector_class": vision_manager.detector.__class__.__name__
    }

@app.get("/api/vision/observations")
def get_vision_observations():
    return {"status": "success", "count": len(vision_manager.observations),
            "observations": vision_manager.observations}

@app.post("/api/vision/detect")
async def post_vision_detect(req: VisionManualRequest):
    obs = vision_manager.process_frame_observation(
        camera_id=req.camera_id,
        timestamp=req.timestamp,
        detected_class=req.detected_class,
        confidence=req.confidence,
        bbox=req.bbox
    )
    await track_manager.broadcast_to_dashboards({"type": "vision_observation", "observation": obs})
    return {"status": "success", "observation": obs}

class FrameUploadRequest(BaseModel):
    camera_id: Optional[str] = "CAM-01"
    confidence: Optional[float] = 0.94
    frame_data_b64: Optional[str] = None
    filename: Optional[str] = "drone_flight_clip.mp4"

@app.post("/api/vision/upload-frame")
async def upload_vision_frame(req: FrameUploadRequest):
    obs = vision_manager.process_frame_observation(
        camera_id=req.camera_id or "CAM-01",
        confidence=req.confidence or 0.94
    )
    await track_manager.broadcast_to_dashboards({"type": "vision_observation", "observation": obs})
    return {"status": "success", "observation": obs}

# --- Retention ---
class RetentionConfig(BaseModel):
    retention_days: int

@app.get("/api/retention")
def get_retention_policy():
    return {
        "status": "success",
        "retention_days": retention_manager.retention_days,
        "description": f"Data older than {retention_manager.retention_days} days is purged automatically."
    }

@app.post("/api/retention/purge")
def purge_retention_data(req: Optional[RetentionConfig] = None):
    if req and req.retention_days > 0:
        retention_manager.retention_days = req.retention_days
    results = retention_manager.purge_expired_records()
    return {"status": "success", "purged": results,
            "current_retention_days": retention_manager.retention_days}

# ============================================================
# Static Files & WebSocket Endpoints
# ============================================================
import os

@app.get("/")
def serve_index():
    if os.path.exists("dist/index.html"):
        return FileResponse("dist/index.html")
    return FileResponse("static/index.html")

@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    await websocket.accept()
    client_host = websocket.client.host if websocket.client else "unknown"
    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                data = json_lib.loads(raw_text)
            except json_lib.JSONDecodeError:
                continue

            if "drone_id" not in data or "latitude" not in data or "longitude" not in data:
                continue

            res = track_manager.update_telemetry(data)
            updated_track, alert, evidence = res.track, res.alert, res.evidence
            await track_manager.broadcast_to_dashboards({"type": "track_update", "track": updated_track})
            if alert:
                await track_manager.broadcast_to_dashboards({"type": "alert_update", "alert": alert})
            if evidence:
                await track_manager.broadcast_to_dashboards({"type": "evidence_created", "evidence": evidence})

    except WebSocketDisconnect:
        logger.info(f"Telemetry client disconnected: {client_host}")
    except Exception as e:
        logger.error(f"Error in telemetry websocket: {e}")

@app.websocket("/ws/dashboard")
async def websocket_dashboard(websocket: WebSocket):
    await track_manager.connect_dashboard(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        track_manager.disconnect_dashboard(websocket)

if os.path.exists("dist/assets"):
    app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")

app.mount("/static", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

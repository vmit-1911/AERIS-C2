import argparse
import asyncio
from datetime import datetime, timezone
import json
import math
import sys
import urllib.request
import websockets

DEFAULT_SERVER_URI = "ws://172.17.101.134:8000/ws/telemetry"
DEFAULT_HTTP_HOST = "http://172.17.101.134:8000"

DRONE_CONFIGS = {
    "UAV-001": {"start_lat": 26.4499, "start_lng": 74.6399, "radius": 0.005, "speed": 14.5, "alt": 85.0},
    "UAV-002": {"start_lat": 26.4600, "start_lng": 74.6500, "radius": 0.008, "speed": 22.0, "alt": 120.0},
    "UAV-003": {"start_lat": 26.4350, "start_lng": 74.6200, "radius": 0.004, "speed": 9.0, "alt": 45.0},
    "UAV-999": {"start_lat": 26.4550, "start_lng": 74.6300, "radius": 0.006, "speed": 18.0, "alt": 95.0},
}

def trigger_demo_temp_red_zone(http_host: str):
    payload = {
        "name": "DEMO TEMP RED ZONE (60s Expiry)",
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [74.6350, 26.4450],
                [74.6480, 26.4450],
                [74.6480, 26.4560],
                [74.6350, 26.4560],
                [74.6350, 26.4450]
            ]]
        },
        "duration_seconds": 60.0,
        "min_altitude": 0.0,
        "max_altitude": 100.0,
        "operator_id": "SUPERVISOR-ALPHA",
        "role": "SUPERVISOR"
    }
    req = urllib.request.Request(
        f"{http_host}/api/zones/temporary-red",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    try:
        res = urllib.request.urlopen(req)
        res_data = json.loads(res.read())
        print(f"\n >>> CREATED DEMO TEMPORARY RED ZONE: {res_data['zone']['zone_id']} ({res_data['zone']['name']}) <<< \n")
    except Exception as e:
        print(f"Error creating demo zone: {e}")

def trigger_demo_vision_detection(http_host: str, camera_id: str = "CAM-01", confidence: float = 0.94):
    payload = {
        "camera_id": camera_id,
        "detected_class": "drone",
        "confidence": confidence,
        "bbox": [180.0, 110.0, 310.0, 220.0]
    }
    req = urllib.request.Request(
        f"{http_host}/api/vision/detect",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    try:
        res = urllib.request.urlopen(req)
        res_data = json.loads(res.read())
        obs = res_data["observation"]
        corr = obs["correlation"]
        print(f"\n >>> TRIGGERED VISION DETECTION [{obs['observation_id']}]: {obs['class']} ({int(obs['confidence']*100)}%) on {obs['camera_id']}")
        print(f"     Correlation Status: {corr['status']} | Associated Track: {corr['correlated_drone_id']} | Notes: {corr['notes']} <<< \n")
    except Exception as e:
        print(f"Error triggering demo vision observation: {e}")

async def perform_phase4_escalation_demo(http_host: str):
    """Queries generated alerts, performs disposition ESCALATE, and checks audit log."""
    await asyncio.sleep(2.0)
    print("\n >>> DEMO: Checking Alert Queue & Submitting Operator Escalation... <<<")
    
    try:
        res_alerts = urllib.request.urlopen(f"{http_host}/api/alerts").read()
        alerts_data = json.loads(res_alerts)
        alerts = alerts_data.get("alerts", [])
        
        if not alerts:
            print("No active alerts found for disposition.")
            return

        target_alert = alerts[0]
        print(f"Found Target Alert: {target_alert['alert_id']} ({target_alert['classification']}, Priority: {target_alert['priority']})")
        print(f"Suggested Action: {target_alert['suggested_action']}")

        # Submit Disposition
        disp_payload = {
            "action": "ESCALATE",
            "reason_code": "ESCALATED_TO_SUPERVISOR",
            "operator_id": "OFFICER-402",
            "role": "SUPERVISOR"
        }
        disp_req = urllib.request.Request(
            f"{http_host}/api/alerts/{target_alert['alert_id']}/disposition",
            data=json.dumps(disp_payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        disp_res = urllib.request.urlopen(disp_req)
        disp_data = json.loads(disp_res.read())
        print(f"Disposition Applied Successfully! Alert Status: {disp_data['alert']['status']}")

        # Fetch Audit Log
        res_audit = urllib.request.urlopen(f"{http_host}/api/audit").read()
        audit_data = json.loads(res_audit)
        print("\n --- AUDIT LOG EVENT CHAIN VERIFICATION ---")
        for evt in audit_data["audit_log"][-4:]:
            print(f"  [{evt['event_id']}] {evt['action']} by {evt['operator_id']} ({evt['role']}): {evt['reason']}")
            
    except Exception as e:
        print(f"Error in demo workflow: {e}")

async def simulate_drone(
    server_uri: str,
    http_host: str,
    drone_id: str,
    demo_timeout: bool = False,
    demo_geofence: bool = False,
    demo_phase4: bool = False,
    demo_vision: bool = False,
    demo_all: bool = False
):
    config = DRONE_CONFIGS.get(drone_id, {
        "start_lat": 26.4499, "start_lng": 74.6399, "radius": 0.005, "speed": 15.0, "alt": 80.0
    })

    print(f"[{drone_id}] Connecting to {server_uri} over Wi-Fi...")
    angle = 0.0
    tick_count = 0

    try:
        async with websockets.connect(server_uri) as websocket:
            print(f"[{drone_id}] Connected! Streaming live telemetry...")
            while True:
                tick_count += 1

                # Scenario 4: Lost Link Timeout Demo
                if (demo_timeout or demo_all) and tick_count == 12:
                    print(f"\n >>> SCENARIO 4 (LOST_LINK): Pausing [{drone_id}] telemetry for 7 seconds... <<< \n")
                    await asyncio.sleep(7.0)
                    print(f"\n >>> SCENARIO 4 (RECOVERY): Resuming [{drone_id}] telemetry... <<< \n")

                # Scenario 3: Temporary Red Zone Creation Demo
                if (demo_geofence or demo_phase4 or demo_all) and tick_count == 4:
                    trigger_demo_temp_red_zone(http_host)

                # Scenario 3: Escalation & Audit Demo Chain
                if (demo_phase4 or demo_all) and tick_count == 7:
                    asyncio.create_task(perform_phase4_escalation_demo(http_host))

                # Scenario 5: Camera / ML Optical Detection Sighting
                if (demo_vision or demo_all) and tick_count == 9:
                    trigger_demo_vision_detection(http_host, "CAM-01", 0.94)

                angle += 0.05
                lat = config["start_lat"] + (config["radius"] * math.sin(angle))
                lng = config["start_lng"] + (config["radius"] * math.cos(angle))
                heading = (math.degrees(math.atan2(math.cos(angle), -math.sin(angle))) + 360) % 360

                telemetry = {
                    "drone_id": drone_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "latitude": round(lat, 6),
                    "longitude": round(lng, 6),
                    "altitude": round(config["alt"] + (math.sin(angle * 2) * 5), 1),
                    "speed": round(config["speed"], 1),
                    "heading": round(heading, 1),
                    "source": "Wi-Fi Simulated Python Sender (Laptop 2)"
                }

                await websocket.send(json.dumps(telemetry))
                print(f"[{drone_id}] => Lat: {telemetry['latitude']}, Lng: {telemetry['longitude']}, Alt: {telemetry['altitude']}m, Hdg: {telemetry['heading']}°")
                await asyncio.sleep(1.0)

    except websockets.exceptions.ConnectionClosed:
        print(f"[{drone_id}] Connection closed.")
    except Exception as e:
        print(f"[{drone_id}] Error: {e}")

async def run_multi(server_uri: str, http_host: str, demo_timeout: bool = False, demo_geofence: bool = False, demo_phase4: bool = False, demo_vision: bool = False, demo_all: bool = False):
    print(f"Launching multi-drone simulation (UAV-001, UAV-002, UAV-003, UAV-999) to {server_uri}...")
    tasks = [
        asyncio.create_task(simulate_drone(server_uri, http_host, "UAV-001", demo_timeout, demo_geofence, demo_phase4, demo_vision, demo_all)),
        asyncio.create_task(simulate_drone(server_uri, http_host, "UAV-002")),
        asyncio.create_task(simulate_drone(server_uri, http_host, "UAV-003")),
        asyncio.create_task(simulate_drone(server_uri, http_host, "UAV-999")),
    ]
    await asyncio.gather(*tasks)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AERIS-C2 Wi-Fi Virtual Drone Sender")
    parser.add_argument("--server-ip", default="172.17.101.134", help="IP address of Laptop 1 (C2 Server)")
    parser.add_argument("--port", default="8000", help="Port of Laptop 1 server")
    parser.add_argument("--drone", default="UAV-001", help="Drone ID (e.g. UAV-001 [Auth], UAV-999 [Unreg])")
    parser.add_argument("--multi", action="store_true", help="Simulate 4 drones simultaneously")
    parser.add_argument("--scenario-1", action="store_true", help="Scenario 1: Authorized drone (UAV-001)")
    parser.add_argument("--scenario-2", action="store_true", help="Scenario 2: Unregistered drone (UAV-999)")
    parser.add_argument("--scenario-3", action="store_true", help="Scenario 3: Temporary Red-Zone violation & Escalation")
    parser.add_argument("--scenario-4", action="store_true", help="Scenario 4: Lost telemetry link & auto-recovery")
    parser.add_argument("--scenario-5", action="store_true", help="Scenario 5: Camera / ML optical detection & correlation")
    parser.add_argument("--demo-all", action="store_true", help="Complete end-to-end multi-scenario integration demo")

    args = parser.parse_args()

    server_ws_uri = f"ws://{args.server_ip}:{args.port}/ws/telemetry"
    server_http_host = f"http://{args.server_ip}:{args.port}"

    demo_timeout = args.scenario_4
    demo_geofence = args.scenario_3
    demo_phase4 = args.scenario_3
    demo_vision = args.scenario_5
    demo_all = args.demo_all

    target_drone = "UAV-999" if args.scenario_2 else args.drone

    if args.multi or args.demo_all:
        asyncio.run(run_multi(server_ws_uri, server_http_host, demo_timeout, demo_geofence, demo_phase4, demo_vision, demo_all))
    else:
        asyncio.run(simulate_drone(server_ws_uri, server_http_host, target_drone, demo_timeout, demo_geofence, demo_phase4, demo_vision, demo_all))

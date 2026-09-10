import asyncio
from datetime import datetime, timezone
import json
import time
try:
    import pytest
except ImportError:
    pytest = None
from fastapi.testclient import TestClient

from main import app, track_manager, zone_manager, alert_manager, audit_manager

client = TestClient(app)

def reset_system_state():
    """Resets in-memory managers between tests for isolation."""
    track_manager.tracks.clear()
    track_manager.drone_track_map.clear()
    track_manager.next_track_number = 1
    alert_manager.alerts.clear()
    alert_manager.active_drone_alerts.clear()
    alert_manager.next_alert_num = 1001
    audit_manager.log.clear()
    audit_manager.next_id = 1000
    # Re-seed startup event
    audit_manager.record_event(
        operator_id="SYSTEM",
        role="ADMIN",
        action="SYSTEM_STARTUP",
        reason="AERIS-C2 Security Engine initialized."
    )

# ----------------------------------------------------
# 1. Authorized track works
# ----------------------------------------------------
def test_1_authorized_track():
    reset_system_state()
    # UAV-001 is active in registry, send telemetry in green corridor (Ajmer Civil Aviation)
    telemetry = {
        "drone_id": "UAV-001",
        "latitude": 26.4400,
        "longitude": 74.6300,
        "altitude": 80.0,
        "speed": 10.0,
        "heading": 90.0,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    track, alert = track_manager.update_telemetry(telemetry)
    assert track["current_classification"] == "AUTHORISED"
    assert track["authorization_status"] == "ACTIVE"
    assert alert is None  # No violation alert created for authorized track

# ----------------------------------------------------
# 2. Unknown drone creates UNREGISTERED state/alert
# ----------------------------------------------------
def test_2_unregistered_drone_alert():
    reset_system_state()
    # UAV-999 is not in registry
    telemetry = {
        "drone_id": "UAV-999",
        "latitude": 26.4400,
        "longitude": 74.6300,
        "altitude": 50.0,
        "speed": 12.0,
        "heading": 180.0,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    track, alert = track_manager.update_telemetry(telemetry)
    assert track["current_classification"] == "UNREGISTERED"
    assert alert is not None
    assert alert["classification"] == "UNREGISTERED"
    assert alert["priority"] == "MEDIUM"
    assert alert["suggested_action"] == "Verify drone identity and initiate officer assessment."
    assert "interdiction" not in alert["suggested_action"].lower()

# ----------------------------------------------------
# 3. Geofence violation creates OUT_OF_ENVELOPE alert
# ----------------------------------------------------
def test_3_geofence_violation_alert():
    reset_system_state()
    # UAV-001 entering permanent Red Zone (ZONE-RED-01: 74.6450-74.6530, 26.4520-26.4580)
    telemetry = {
        "drone_id": "UAV-001",
        "latitude": 26.4550,
        "longitude": 74.6500,
        "altitude": 100.0,
        "speed": 15.0,
        "heading": 45.0,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    track, alert = track_manager.update_telemetry(telemetry)
    assert track["current_classification"] == "OUT_OF_ENVELOPE"
    assert alert is not None
    assert alert["classification"] == "OUT_OF_ENVELOPE"
    assert alert["priority"] == "HIGH"
    assert alert["suggested_action"] == "Verify flight authorization and assess escalation."

# ----------------------------------------------------
# 4. Telemetry timeout creates LOST_LINK
# ----------------------------------------------------
def test_4_telemetry_timeout_lost_link():
    reset_system_state()
    # Send telemetry in past (6 seconds ago)
    old_time = datetime.fromtimestamp(time.time() - 6.0, tz=timezone.utc).isoformat()
    telemetry = {
        "drone_id": "UAV-001",
        "latitude": 26.4400,
        "longitude": 74.6300,
        "altitude": 80.0,
        "speed": 10.0,
        "heading": 90.0,
        "timestamp": old_time
    }
    track_manager.update_telemetry(telemetry)
    # Manually set last_seen to old_time to simulate 6s elapsed
    track_manager.tracks["UAV-001"]["last_seen"] = old_time

    lost_pairs = track_manager.evaluate_lost_links()
    assert len(lost_pairs) == 1
    track, alert = lost_pairs[0]
    assert track["current_classification"] == "LOST_LINK"
    assert alert is not None
    assert alert["classification"] == "LOST_LINK"
    assert alert["priority"] == "HIGH"
    assert alert["suggested_action"] == "Attempt telemetry verification and visually confirm track."

# ----------------------------------------------------
# 5. Alerts do not duplicate uncontrollably
# ----------------------------------------------------
def test_5_alert_deduplication():
    reset_system_state()
    # Send 10 consecutive telemetry points for unregistered drone UAV-999
    alerts_generated = []
    for i in range(10):
        telemetry = {
            "drone_id": "UAV-999",
            "latitude": 26.4400 + (i * 0.0001),
            "longitude": 74.6300,
            "altitude": 50.0,
            "speed": 12.0,
            "heading": 180.0,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        _, alert = track_manager.update_telemetry(telemetry)
        alerts_generated.append(alert["alert_id"])

    # All 10 updates should reference the EXACT SAME alert ID (ALERT-1001)
    assert len(alert_manager.alerts) == 1
    assert set(alerts_generated) == {"ALERT-1001"}

# ----------------------------------------------------
# 6. Confirm works
# ----------------------------------------------------
def test_6_disposition_confirm():
    reset_system_state()
    # Create alert via unregistered drone
    telemetry = {"drone_id": "UAV-999", "latitude": 26.4400, "longitude": 74.6300, "altitude": 50.0, "timestamp": datetime.now(timezone.utc).isoformat()}
    _, alert = track_manager.update_telemetry(telemetry)
    alert_id = alert["alert_id"]

    response = client.post(f"/api/alerts/{alert_id}/disposition", json={
        "action": "CONFIRM",
        "reason_code": "CONFIRMED_VIOLATION",
        "operator_id": "OFFICER-201",
        "role": "OPERATOR"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["alert"]["status"] == "CONFIRMED"
    assert data["alert"]["operator_disposition"]["action"] == "CONFIRM"
    assert data["alert"]["operator_disposition"]["reason_code"] == "CONFIRMED_VIOLATION"

# ----------------------------------------------------
# 7. Dismiss works
# ----------------------------------------------------
def test_7_disposition_dismiss():
    reset_system_state()
    telemetry = {"drone_id": "UAV-999", "latitude": 26.4400, "longitude": 74.6300, "altitude": 50.0, "timestamp": datetime.now(timezone.utc).isoformat()}
    _, alert = track_manager.update_telemetry(telemetry)
    alert_id = alert["alert_id"]

    response = client.post(f"/api/alerts/{alert_id}/disposition", json={
        "action": "DISMISS",
        "reason_code": "FALSE_POSITIVE",
        "operator_id": "OFFICER-202",
        "role": "OPERATOR"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["alert"]["status"] == "DISMISSED"
    assert data["alert"]["operator_disposition"]["reason_code"] == "FALSE_POSITIVE"

# ----------------------------------------------------
# 8. Escalate works
# ----------------------------------------------------
def test_8_disposition_escalate():
    reset_system_state()
    telemetry = {"drone_id": "UAV-999", "latitude": 26.4400, "longitude": 74.6300, "altitude": 50.0, "timestamp": datetime.now(timezone.utc).isoformat()}
    _, alert = track_manager.update_telemetry(telemetry)
    alert_id = alert["alert_id"]

    response = client.post(f"/api/alerts/{alert_id}/disposition", json={
        "action": "ESCALATE",
        "reason_code": "ESCALATED_TO_SUPERVISOR",
        "operator_id": "OFFICER-203",
        "role": "SUPERVISOR"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["alert"]["status"] == "ESCALATED"
    assert data["alert"]["operator_disposition"]["reason_code"] == "ESCALATED_TO_SUPERVISOR"

# ----------------------------------------------------
# 9. Reason code is required
# ----------------------------------------------------
def test_9_reason_code_required():
    reset_system_state()
    telemetry = {"drone_id": "UAV-999", "latitude": 26.4400, "longitude": 74.6300, "altitude": 50.0, "timestamp": datetime.now(timezone.utc).isoformat()}
    _, alert = track_manager.update_telemetry(telemetry)
    alert_id = alert["alert_id"]

    # Missing reason code -> HTTP 400
    response = client.post(f"/api/alerts/{alert_id}/disposition", json={
        "action": "CONFIRM",
        "reason_code": "",
        "operator_id": "OFFICER-101"
    })
    assert response.status_code == 400

    # Invalid reason code -> HTTP 400
    response_invalid = client.post(f"/api/alerts/{alert_id}/disposition", json={
        "action": "CONFIRM",
        "reason_code": "NOT_A_VALID_REASON",
        "operator_id": "OFFICER-101"
    })
    assert response_invalid.status_code == 400

# ----------------------------------------------------
# 10. Audit record is created
# ----------------------------------------------------
def test_10_audit_record_creation():
    reset_system_state()
    # 1. Create alert and disposition
    telemetry = {"drone_id": "UAV-999", "latitude": 26.4400, "longitude": 74.6300, "altitude": 50.0, "timestamp": datetime.now(timezone.utc).isoformat()}
    _, alert = track_manager.update_telemetry(telemetry)
    alert_id = alert["alert_id"]

    client.post(f"/api/alerts/{alert_id}/disposition", json={
        "action": "CONFIRM",
        "reason_code": "CONFIRMED_VIOLATION",
        "operator_id": "OFFICER-301",
        "role": "OPERATOR"
    })

    # 2. Create Temporary Red Zone
    client.post("/api/zones/temporary-red", json={
        "name": "TEST TEMP ZONE",
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[74.63, 26.44], [74.65, 26.44], [74.65, 26.46], [74.63, 26.46], [74.63, 26.44]]]
        },
        "duration_seconds": 60.0,
        "operator_id": "SUPERVISOR-01",
        "role": "SUPERVISOR"
    })

    audit_res = client.get("/api/audit")
    assert audit_res.status_code == 200
    logs = audit_res.json()["audit_log"]
    
    # Startup, ALERT_CONFIRMED, ZONE_CREATION
    actions = [l["action"] for l in logs]
    assert "ALERT_CONFIRMED" in actions
    assert "ZONE_CREATION" in actions

    # Verify fields on audit record
    alert_entry = next(l for l in logs if l["action"] == "ALERT_CONFIRMED")
    assert alert_entry["operator_id"] == "OFFICER-301"
    assert alert_entry["role"] == "OPERATOR"
    assert alert_entry["alert_id"] == alert_id

# ----------------------------------------------------
# 11. Audit export works (CSV & JSON)
# ----------------------------------------------------
def test_11_audit_export():
    reset_system_state()
    # Export JSON
    res_json = client.get("/api/audit/export?format=json")
    assert res_json.status_code == 200
    assert res_json.headers["content-type"] == "application/json"
    exported_data = json.loads(res_json.text)
    assert isinstance(exported_data, list)
    assert len(exported_data) >= 1
    assert "operator_id" in exported_data[0]
    assert "timestamp" in exported_data[0]

    # Export CSV
    res_csv = client.get("/api/audit/export?format=csv")
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
    csv_lines = res_csv.text.strip().split("\n")
    assert csv_lines[0].startswith("event_id,timestamp,operator_id")
    assert len(csv_lines) >= 2  # Header + at least 1 entry

# ----------------------------------------------------
# 12. Existing system continues working
# ----------------------------------------------------
def test_12_existing_system_functional():
    reset_system_state()
    # GET /api/tracks
    res_tracks = client.get("/api/tracks")
    assert res_tracks.status_code == 200
    assert "tracks" in res_tracks.json()

    # GET /api/zones
    res_zones = client.get("/api/zones")
    assert res_zones.status_code == 200
    assert len(res_zones.json()["zones"]) >= 3  # Default green, yellow, red zones

    # GET /api/alerts
    res_alerts = client.get("/api/alerts")
    assert res_alerts.status_code == 200
    assert "alerts" in res_alerts.json()

if __name__ == "__main__":
    try:
        import pytest
        pytest.main(["-v", __file__])
    except ImportError:
        print("pytest module not found, running tests via custom python runner...")
        test_funcs = [
            ("1. Authorized track works", test_1_authorized_track),
            ("2. Unknown drone creates UNREGISTERED state/alert", test_2_unregistered_drone_alert),
            ("3. Geofence violation creates OUT_OF_ENVELOPE alert", test_3_geofence_violation_alert),
            ("4. Telemetry timeout creates LOST_LINK", test_4_telemetry_timeout_lost_link),
            ("5. Alerts do not duplicate uncontrollably", test_5_alert_deduplication),
            ("6. Confirm works", test_6_disposition_confirm),
            ("7. Dismiss works", test_7_disposition_dismiss),
            ("8. Escalate works", test_8_disposition_escalate),
            ("9. Reason code is required", test_9_reason_code_required),
            ("10. Audit record is created", test_10_audit_record_creation),
            ("11. Audit export works", test_11_audit_export),
            ("12. Existing system continues working", test_12_existing_system_functional),
        ]
        passed = 0
        failed = 0
        for name, func in test_funcs:
            try:
                func()
                print(f"[PASS] {name}")
                passed += 1
            except Exception as e:
                print(f"[FAIL] {name}: {e}")
                failed += 1
        print(f"\nSummary: {passed} passed, {failed} failed.")
        if failed > 0:
            exit(1)


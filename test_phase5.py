import asyncio
from datetime import datetime, timezone
import json
import time
from fastapi.testclient import TestClient

from main import (
    app,
    track_manager,
    zone_manager,
    alert_manager,
    audit_manager,
    vision_manager,
    retention_manager,
    lookup_drone_registry,
    evaluate_geofence
)

client = TestClient(app)

def reset_system_state():
    """Resets all in-memory managers between tests for isolation."""
    from main import DEFAULT_ZONES
    zone_manager.zones.clear()
    for z in DEFAULT_ZONES:
        zone_manager.zones[z["zone_id"]] = dict(z)
        zone_manager.zones[z["zone_id"]]["active"] = True

    track_manager.tracks.clear()
    track_manager.drone_track_map.clear()
    track_manager.next_track_number = 1
    alert_manager.alerts.clear()
    alert_manager.active_drone_alerts.clear()
    alert_manager.next_alert_num = 1001
    audit_manager.log.clear()
    audit_manager.next_id = 1000
    vision_manager.observations.clear()
    vision_manager.next_obs_id = 5001
    retention_manager.retention_days = 7
    # Re-seed startup event
    audit_manager.record_event(
        operator_id="SYSTEM",
        role="ADMIN",
        action="SYSTEM_STARTUP",
        reason="AERIS-C2 Phase 5 Integrated Security Engine initialized."
    )

# ----------------------------------------------------
# Test A to G: Telemetry, Map, Track Info, Registry, Authorization
# ----------------------------------------------------
def test_a_to_g_telemetry_registry_authorization():
    reset_system_state()
    # UAV-001 (Authorized Active drone)
    t1 = {
        "drone_id": "UAV-001",
        "latitude": 26.4400,
        "longitude": 74.6300,
        "altitude": 80.0,
        "speed": 14.5,
        "heading": 90.0,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    track1, alert1 = track_manager.update_telemetry(t1)
    assert track1["track_id"] == "TRACK-001"
    assert track1["current_classification"] == "AUTHORISED"
    assert track1["authorization_status"] == "ACTIVE"
    assert track1["registration"] == "REG-IND-001"
    assert track1["operator"] == "ABC Survey Pvt Ltd"
    assert alert1 is None  # Compliant track

    # UAV-999 (Unregistered unknown drone)
    t2 = {
        "drone_id": "UAV-999",
        "latitude": 26.4450,
        "longitude": 74.6350,
        "altitude": 65.0,
        "speed": 12.0,
        "heading": 180.0,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    track2, alert2 = track_manager.update_telemetry(t2)
    assert track2["track_id"] == "TRACK-002"
    assert track2["current_classification"] == "UNREGISTERED"
    assert track2["authorization_status"] == "UNAUTHORIZED"
    assert alert2 is not None
    assert alert2["classification"] == "UNREGISTERED"
    assert alert2["priority"] == "MEDIUM"

# ----------------------------------------------------
# Test H to J: Temporary Red Zone & OUT_OF_ENVELOPE Latency Alert
# ----------------------------------------------------
def test_h_to_j_temp_red_zone_alert_latency():
    reset_system_state()
    # 1. Create Temporary Red Zone
    zone_res = client.post("/api/zones/temporary-red", json={
        "name": "TACTICAL NO-FLY ENCLAVE",
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[74.63, 26.44], [74.65, 26.44], [74.65, 26.46], [74.63, 26.46], [74.63, 26.44]]]
        },
        "duration_seconds": 60.0,
        "operator_id": "SUPERVISOR-01",
        "role": "SUPERVISOR"
    })
    assert zone_res.status_code == 200
    zone_data = zone_res.json()["zone"]
    assert zone_data["zone_type"] == "TEMPORARY_RED"

    # 2. Send UAV-001 into Temporary Red Zone
    t_start = time.time()
    t_violation = {
        "drone_id": "UAV-001",
        "latitude": 26.4500,
        "longitude": 74.6400,
        "altitude": 50.0,
        "speed": 15.0,
        "heading": 45.0,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    track, alert = track_manager.update_telemetry(t_violation)
    t_elapsed = time.time() - t_start

    # Alert generation latency target <= 5 seconds
    assert t_elapsed < 5.0
    assert track["current_classification"] == "OUT_OF_ENVELOPE"
    assert track["geofence_status"] == "RED_ZONE_VIOLATION"
    assert alert is not None
    assert alert["priority"] == "CRITICAL"
    assert alert["classification"] == "OUT_OF_ENVELOPE"
    assert "Verify flight authorization" in alert["suggested_action"]
    assert "interdiction" not in alert["suggested_action"].lower()

# ----------------------------------------------------
# Test K to M: Disposition Alert, Audit Log & Export
# ----------------------------------------------------
def test_k_to_m_disposition_audit_export():
    reset_system_state()
    # Trigger alert
    t_unreg = {"drone_id": "UAV-999", "latitude": 26.44, "longitude": 74.63, "altitude": 50.0, "timestamp": datetime.now(timezone.utc).isoformat()}
    _, alert = track_manager.update_telemetry(t_unreg)
    alert_id = alert["alert_id"]

    # Apply ESCALATE disposition
    disp_res = client.post(f"/api/alerts/{alert_id}/disposition", json={
        "action": "ESCALATE",
        "reason_code": "ESCALATED_TO_SUPERVISOR",
        "operator_id": "OFFICER-402",
        "role": "SUPERVISOR"
    })
    assert disp_res.status_code == 200
    assert disp_res.json()["alert"]["status"] == "ESCALATED"

    # Check Audit Log
    audit_res = client.get("/api/audit")
    assert audit_res.status_code == 200
    entries = audit_res.json()["audit_log"]
    escalate_entry = next(e for e in entries if e["action"] == "ALERT_ESCALATED")
    assert escalate_entry["operator_id"] == "OFFICER-402"
    assert escalate_entry["role"] == "SUPERVISOR"
    assert escalate_entry["alert_id"] == alert_id

    # Test CSV & JSON Export
    csv_exp = client.get("/api/audit/export?format=csv")
    assert csv_exp.status_code == 200
    assert "ALERT_ESCALATED" in csv_exp.text

    json_exp = client.get("/api/audit/export?format=json")
    assert json_exp.status_code == 200
    assert isinstance(json.loads(json_exp.text), list)

# ----------------------------------------------------
# Test N to O: Zone Expiry & Automatic De-enforcement
# ----------------------------------------------------
def test_n_to_o_zone_expiry_de_enforcement():
    reset_system_state()
    # Add a zone that expires in the past located at [74.63, 26.44]
    now_dt = datetime.now(timezone.utc)
    expired_dt = datetime.fromtimestamp(now_dt.timestamp() - 10.0, tz=timezone.utc).isoformat()
    zone_dict = {
        "zone_id": "TEMP-RED-EXPIRED",
        "name": "Expired Zone",
        "zone_type": "TEMPORARY_RED",
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[74.625, 26.438], [74.635, 26.438], [74.635, 26.448], [74.625, 26.448], [74.625, 26.438]]]
        },
        "active": True,
        "created_at": now_dt.isoformat(),
        "expires_at": expired_dt,
        "min_altitude": 0.0,
        "max_altitude": 100.0
    }
    zone_manager.zones["TEMP-RED-EXPIRED"] = zone_dict

    # Run expiration check
    expired_ids = zone_manager.expire_outdated_zones()
    assert "TEMP-RED-EXPIRED" in expired_ids
    assert zone_manager.zones["TEMP-RED-EXPIRED"]["active"] is False

    # Drone in this area (inside Ajmer Civil Aviation Corridor) now evaluates to GREEN corridor
    geo = evaluate_geofence(74.6300, 26.4400, 50.0)
    assert geo["current_zone_type"] in ["GREEN", "YELLOW"]
    assert geo["geofence_status"] == "COMPLIANT"

# ----------------------------------------------------
# Test P to S: LOST_LINK Detection & Telemetry Recovery
# ----------------------------------------------------
def test_p_to_s_lost_link_and_recovery():
    reset_system_state()
    # Send initial telemetry in green corridor
    old_time = datetime.fromtimestamp(time.time() - 8.0, tz=timezone.utc).isoformat()
    t_old = {"drone_id": "UAV-001", "latitude": 26.4400, "longitude": 74.6300, "altitude": 80.0, "timestamp": old_time}
    track_manager.update_telemetry(t_old)
    track_manager.tracks["UAV-001"]["last_seen"] = old_time

    # Evaluate timeout
    lost_pairs = track_manager.evaluate_lost_links()
    assert len(lost_pairs) == 1
    tr, al = lost_pairs[0]
    assert tr["current_classification"] == "LOST_LINK"
    assert al["priority"] == "HIGH"
    assert al["suggested_action"] == "Attempt telemetry verification and visually confirm track."

    # Resume telemetry -> Recovery to AUTHORISED
    now_time = datetime.now(timezone.utc).isoformat()
    t_resumed = {"drone_id": "UAV-001", "latitude": 26.4400, "longitude": 74.6300, "altitude": 80.0, "timestamp": now_time}
    tr_rec, al_rec = track_manager.update_telemetry(t_resumed)
    assert tr_rec["current_classification"] == "AUTHORISED"
    assert tr_rec["link_status"] == "CONNECTED"
    # Alert should be marked resolved
    assert al_rec is not None
    assert al_rec["status"] == "RESOLVED"

# ----------------------------------------------------
# Test T to W: Track A Vision Detection & Correlation
# ----------------------------------------------------
def test_t_to_w_vision_detection_and_correlation():
    reset_system_state()
    # 1. Establish active telemetry track for UAV-001
    now_iso = datetime.now(timezone.utc).isoformat()
    t_active = {"drone_id": "UAV-001", "latitude": 26.44, "longitude": 74.63, "altitude": 80.0, "timestamp": now_iso}
    track_manager.update_telemetry(t_active)

    # 2. Check Vision Model Status Endpoint (clearly labeled DEMO / MOCK)
    status_res = client.get("/api/vision/status")
    assert status_res.status_code == 200
    model_info = status_res.json()["model_status"]
    assert model_info["mode"] == "DEMONSTRATION/MOCK"
    assert "pending" in model_info["evaluation_status"].lower()
    assert model_info["metrics"]["precision"] == "UNMEASURED (MOCK/DEMO)"

    # 3. Post Optical Drone Observation
    vis_res = client.post("/api/vision/detect", json={
        "camera_id": "CAM-01",
        "timestamp": now_iso,
        "detected_class": "drone",
        "confidence": 0.94,
        "bbox": [180.0, 110.0, 310.0, 220.0]
    })
    assert vis_res.status_code == 200
    obs = vis_res.json()["observation"]
    assert obs["observation_id"].startswith("VIS-OBS-")
    assert obs["class"] == "drone"
    assert obs["confidence"] == 0.94
    assert obs["bbox"] == [180.0, 110.0, 310.0, 220.0]

    # 4. Check Correlation Interface
    corr = obs["correlation"]
    assert corr["status"] in ["CORRELATED", "POTENTIAL MATCH"]
    assert corr["correlated_drone_id"] == "UAV-001"
    assert corr["correlated_track_id"] == "TRACK-001"
    assert "Uncalibrated Visual Bearing" in corr["notes"]

    # 5. Check Observations List endpoint
    list_res = client.get("/api/vision/observations")
    assert list_res.status_code == 200
    assert list_res.json()["count"] >= 1

# ----------------------------------------------------
# Test: Data Retention Purge Policy
# ----------------------------------------------------
def test_data_retention_purge_policy():
    reset_system_state()
    # Establish stale track 10 days old
    ten_days_ago = datetime.fromtimestamp(time.time() - (10 * 86400), tz=timezone.utc).isoformat()
    t_stale = {"drone_id": "UAV-STALE", "latitude": 26.44, "longitude": 74.63, "altitude": 80.0, "timestamp": ten_days_ago}
    track_manager.update_telemetry(t_stale)
    track_manager.tracks["UAV-STALE"]["last_seen"] = ten_days_ago

    assert "UAV-STALE" in track_manager.tracks

    # Purge with RETENTION_DAYS=7
    purge_res = client.post("/api/retention/purge", json={"retention_days": 7})
    assert purge_res.status_code == 200
    assert purge_res.json()["purged"]["telemetry"] == 1
    assert "UAV-STALE" not in track_manager.tracks

if __name__ == "__main__":
    test_suite = [
        ("A-G. Telemetry, Map, Track Info, Registry & Authorization", test_a_to_g_telemetry_registry_authorization),
        ("H-J. Temporary Red Zone & Latency Violation Alert", test_h_to_j_temp_red_zone_alert_latency),
        ("K-M. Operator Disposition, Audit Trail & CSV/JSON Export", test_k_to_m_disposition_audit_export),
        ("N-O. Automatic Zone Expiration & De-enforcement", test_n_to_o_zone_expiry_de_enforcement),
        ("P-S. LOST_LINK Timeout & Telemetry Recovery", test_p_to_s_lost_link_and_recovery),
        ("T-W. Track A Vision Detection & Correlation Layer", test_t_to_w_vision_detection_and_correlation),
        ("Retention Policy & Telemetry Purge", test_data_retention_purge_policy),
    ]

    print("==================================================")
    print("AERIS-C2 PHASE 5 FINAL ACCEPTANCE TEST SUITE")
    print("==================================================")
    passed = 0
    failed = 0
    for name, func in test_suite:
        try:
            func()
            print(f"[PASS] {name}")
            passed += 1
        except Exception as e:
            print(f"[FAIL] {name}: {e}")
            failed += 1
    print(f"\nResults: {passed} passed, {failed} failed.")
    if failed > 0:
        exit(1)

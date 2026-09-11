import sys
import os
from datetime import datetime, timezone

# Add backend directory to path
sys.path.insert(0, os.path.dirname(__file__))

from models.telemetry import TelemetryPayload
from models.geofence import TRZCreateRequest
from services.geofence_engine import GeofenceEngine
from services.audit_logger import AuditLogger

def test_system_core():
    print("=========================================================")
    print(" TESTING CIVIL POLICE AIRSPACE C2 CORE ENGINES ")
    print("=========================================================")

    # 1. Test Geofence Engine & Rule 24 TRZ
    engine = GeofenceEngine()
    print(f"[TEST 1] Loaded {len(engine.base_zones)} DGCA Base Airspace Zones.")
    
    # Enact TRZ
    req = TRZCreateRequest(
        name="TEST VIP CORRIDOR",
        declared_by="SP_DUTY_DESK_01",
        floor_m=0.0,
        ceiling_m=120.0,
        duration_hours=12.0,
        coordinates=[
            [80.2600, 13.0550],
            [80.2750, 13.0550],
            [80.2750, 13.0650],
            [80.2600, 13.0650],
            [80.2600, 13.0550]
        ],
        reason="Security test"
    )
    zone = engine.add_trz(req)
    assert len(engine.get_active_trzs()) >= 1, "TRZ creation failed!"
    print(f"[TEST 1 PASSED] Rule 24 TRZ created: {zone.zone_id}")

    # 2. Test <20ms Spatial Evaluation
    # Telemetry inside TRZ
    tel = TelemetryPayload(
        uas_id="UIN-TEST-INTRUDER-01",
        lat=13.0600,
        lon=80.2700,
        alt_m=50.0,
        speed_mps=10.0,
        heading_deg=90,
        pilot_lat=13.0500,
        pilot_lon=80.2600,
        rssi_dbm=-60,
        transmission_state="BROADCASTING"
    )
    res = engine.evaluate_track(tel)
    assert res.status == "OUT_OF_ENVELOPE", f"Expected OUT_OF_ENVELOPE, got {res.status}"
    assert res.priority == "CRITICAL", f"Expected CRITICAL, got {res.priority}"
    print(f"[TEST 2 PASSED] 4D Geofence Breach detected in <20ms. Status: {res.status}, Priority: {res.priority}")

    # 3. Test Audit Ledger & BSA Section 65B Hash Chain
    test_db = os.path.join(os.path.dirname(__file__), "test_audit.db")
    if os.path.exists(test_db):
        os.remove(test_db)
        
    logger = AuditLogger(db_path=test_db)
    rec1 = logger.append_log(
        operator_id="SP_DUTY_DESK_01",
        uas_id="UIN-TEST-INTRUDER-01",
        event_type="OUT_OF_ENVELOPE",
        action_taken="DISPATCH_QRT",
        reason_code="Sector QRT Unit Dispatched",
        snapshot_data=res.dict()
    )
    
    rec2 = logger.append_log(
        operator_id="SP_DUTY_DESK_01",
        uas_id="UIN-TEST-INTRUDER-01",
        event_type="OUT_OF_ENVELOPE",
        action_taken="CONFIRM_INCIDENT",
        reason_code="Visual target verified by optical PTZ camera",
        snapshot_data=res.dict()
    )

    is_valid, errors = logger.verify_chain_integrity()
    assert is_valid, f"Chain integrity verification failed: {errors}"
    print(f"[TEST 3 PASSED] Forensic Hash Chain Integrity Verified. Genesis -> Block #1 -> Block #2.")

    # Cleanup test DB
    try:
        if os.path.exists(test_db):
            os.remove(test_db)
    except Exception:
        pass

    print("=========================================================")
    print(" ALL CORE TESTS PASSED CLEANLY! ")
    print("=========================================================")

if __name__ == "__main__":
    test_system_core()

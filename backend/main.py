import asyncio
import json
import math
import os
import time
from datetime import datetime, timezone
from typing import Dict, List, Set, Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from models.telemetry import TelemetryPayload, TrackEvaluationResult
from models.geofence import TRZCreateRequest, TRZZone
from models.audit import AlertDispositionRequest
from services.geofence_engine import GeofenceEngine
from services.vision_service import VisionSurveillanceService
from services.audit_logger import AuditLogger

app = FastAPI(
    title="Civil Police Airspace Reconnaissance, Tracking & Rule 24 TRZ Enforcement Server",
    version="1.0.0",
    description="Backend tactical C2 engine under Rule 24 Drone Rules, 2021 & BSA Section 65B"
)

# Enable CORS for LAN & Web Workstations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Core Tactical Services
geofence_engine = GeofenceEngine(registry_path=os.path.join(os.path.dirname(__file__), "authorized_uas_registry.json"))
vision_service = VisionSurveillanceService(camera_index=0)
audit_logger = AuditLogger(db_path=os.path.join(os.path.dirname(__file__), "audit_ledger.db"))

# Global In-Memory Airspace State
active_tracks: Dict[str, Dict[str, Any]] = {}
active_alerts: Dict[str, Dict[str, Any]] = {}
console_websockets: Set[WebSocket] = set()

# Seed default Rule 24 TRZ for immediate visual demo on Saveetha Campus
default_trz_request = TRZCreateRequest(
    name="SAVEETHA COLLEGE VIP SECURITY CORRIDOR (RULE 24 TRZ-SEC-01)",
    declared_by="SUPERINTENDENT_OF_POLICE_SEC",
    floor_m=0.0,
    ceiling_m=120.0,
    duration_hours=24.0,
    coordinates=[
        [80.0125, 13.0235],
        [80.0210, 13.0235],
        [80.0210, 13.0305],
        [80.0125, 13.0305],
        [80.0125, 13.0235]
    ],
    reason="Superintendent Order #SEC-402: Emergency VIP Airspace Protection for Saveetha Engineering College Campus"
)
geofence_engine.add_trz(default_trz_request)


# --------------------------------------------------------------------------
# REST API ENDPOINTS
# --------------------------------------------------------------------------

@app.get("/drone", response_class=HTMLResponse)
async def serve_mobile_controller():
    """Serves the mobile phone Remote ID controller page."""
    html_path = os.path.join(os.path.dirname(__file__), "static", "mobile_controller.html")
    if os.path.exists(html_path):
        with open(html_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    raise HTTPException(status_code=404, detail="Mobile controller template not found")


@app.post("/api/trz", response_model=TRZZone)
async def create_trz(req: TRZCreateRequest):
    """
    Enacts a dynamic Temporary Red Zone (TRZ) under Rule 24 of Drone Rules, 2021.
    """
    zone = geofence_engine.add_trz(req)
    
    # Audit Log Entry
    audit_logger.append_log(
        operator_id=req.declared_by,
        uas_id=zone.zone_id,
        event_type="TRZ_DECLARED",
        action_taken="ENACT_RULE_24_TRZ",
        reason_code=req.reason,
        snapshot_data={
            "zone_id": zone.zone_id,
            "name": zone.name,
            "ceiling_m": zone.ceiling_m,
            "expires_at": zone.expires_at,
            "coordinates": zone.coordinates
        }
    )
    return zone


@app.delete("/api/trz/{zone_id}")
async def revoke_trz(zone_id: str, operator_id: str = "SUPERINTENDENT_OF_POLICE_CHQ", reason: str = "Order Revoked by SP"):
    """
    Revokes an active TRZ before natural expiry.
    """
    success = geofence_engine.revoke_trz(zone_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"TRZ {zone_id} not found or already expired.")

    # Audit Log Entry
    audit_logger.append_log(
        operator_id=operator_id,
        uas_id=zone_id,
        event_type="TRZ_REVOKED",
        action_taken="REVOKE_RULE_24_TRZ",
        reason_code=reason,
        snapshot_data={"zone_id": zone_id, "revoked_at": datetime.now(timezone.utc).isoformat()}
    )
    return {"message": f"TRZ {zone_id} revoked successfully.", "zone_id": zone_id}


@app.get("/api/trz")
async def list_trzs():
    """Returns all currently active dynamic TRZs."""
    return geofence_engine.get_active_trzs()


@app.post("/api/alert/disposition")
async def handle_alert_disposition(req: AlertDispositionRequest):
    """
    Accepts Duty Officer triage actions (DISPATCH_QRT, LOG_AND_ESCALATE, DISMISS_FALSE_ALARM).
    Logs entry to tamper-evident SHA-256 ledger.
    """
    uas_id = req.uas_id
    
    # Update track state in active alerts
    if uas_id in active_alerts:
        active_alerts[uas_id]["disposition"] = req.action_taken
        active_alerts[uas_id]["disposition_reason"] = req.reason_code
        active_alerts[uas_id]["disposition_by"] = req.operator_id
        active_alerts[uas_id]["disposition_at"] = datetime.now(timezone.utc).isoformat()

    # Append to BSA Section 65B Audit Ledger
    record = audit_logger.append_log(
        operator_id=req.operator_id,
        uas_id=req.uas_id,
        event_type=req.event_type,
        action_taken=req.action_taken,
        reason_code=req.reason_code,
        snapshot_data=req.snapshot_data or active_alerts.get(uas_id, {})
    )

    return {
        "status": "SUCCESS",
        "uas_id": uas_id,
        "action_taken": req.action_taken,
        "audit_record": record.model_dump() if hasattr(record, 'model_dump') else record.dict()
    }


@app.get("/api/audit/export")
async def export_audit_ledger():
    """
    Generates Section 65B BSA Forensic Dossier JSON file for legal evidentiary submission.
    """
    dossier = audit_logger.export_bsa_dossier()
    headers = {"Content-Disposition": "attachment; filename=BSA_Section65B_Airspace_Audit_Ledger.json"}
    return JSONResponse(content=dossier, headers=headers)


@app.get("/api/audit/verify")
async def verify_audit_ledger():
    """
    Recalculates cryptographic SHA-256 chain to prove zero tampering.
    """
    is_valid, errors = audit_logger.verify_chain_integrity()
    return {
        "is_valid": is_valid,
        "errors": errors,
        "verified_at": datetime.now(timezone.utc).isoformat()
    }


@app.get("/video_feed")
async def video_feed():
    """
    Streams optical surveillance camera output (YOLOv8 annotated MJPEG stream).
    """
    def frame_generator():
        while True:
            frame_bytes = vision_service.process_frame(active_tracks)
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            time.sleep(0.033) # ~30 FPS

    return StreamingResponse(frame_generator(), media_type="multipart/x-mixed-replace; boundary=frame")


# --------------------------------------------------------------------------
# WEBSOCKET ROUTERS
# --------------------------------------------------------------------------

@app.websocket("/ws/drone")
async def drone_telemetry_ingest_ws(websocket: WebSocket):
    """
    Ingests ASTM F3411-22a Remote ID telemetry streams from external nodes (phones, Unity, simulated streams).
    Evaluates geofencing in <20ms and updates global airspace state.
    """
    await websocket.accept()
    try:
        while True:
            data_text = await websocket.receive_text()
            data_json = json.loads(data_text)
            
            # Parse & validate ASTM payload
            telemetry = TelemetryPayload(**data_json)
            
            # Run high-performance spatial evaluation
            eval_result = geofence_engine.evaluate_track(telemetry)
            
            # Update global active tracks table
            track_dict = eval_result.dict()
            uas_id = telemetry.uas_id
            
            # Append breadcrumb path history (keep last 30 points)
            prev_history = active_tracks.get(uas_id, {}).get("breadcrumbs", [])
            new_breadcrumb = {"lat": telemetry.lat, "lon": telemetry.lon, "alt": telemetry.alt_m}
            breadcrumbs = (prev_history + [new_breadcrumb])[-30:]
            track_dict["breadcrumbs"] = breadcrumbs

            active_tracks[uas_id] = track_dict

            # Handle Alerts
            if eval_result.status != "AUTHORISED":
                if uas_id not in active_alerts or active_alerts[uas_id].get("status") != eval_result.status:
                    active_alerts[uas_id] = {
                        "uas_id": uas_id,
                        "status": eval_result.status,
                        "priority": eval_result.priority,
                        "breached_zones": eval_result.breached_zones,
                        "sop_instruction": eval_result.sop_instruction,
                        "intercept_vector": eval_result.intercept_vector,
                        "telemetry": telemetry.dict(),
                        "first_detected": datetime.now(timezone.utc).isoformat(),
                        "disposition": None
                    }
            else:
                # Clear alert if track returned to normal and wasn't manually triaged
                if uas_id in active_alerts and active_alerts[uas_id].get("disposition") is None:
                    del active_alerts[uas_id]

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS TELEMETRY ERROR] {e}")


@app.websocket("/ws/console")
async def console_broadcaster_ws(websocket: WebSocket):
    """
    Pushes combined airspace operating picture state (tracks, TRZs, alerts, metrics) to frontend at 2 Hz.
    """
    await websocket.accept()
    console_websockets.add(websocket)
    try:
        while True:
            # Build combined C2 payload
            vision_status = vision_service.get_status()
            
            # Synchronize optical Dark Target into alert queue if detected
            if vision_status.get("dark_target_detected"):
                dark_id = "DARK-TARGET-PTZ-01"
                if dark_id not in active_alerts:
                    active_alerts[dark_id] = {
                        "uas_id": dark_id,
                        "status": "DARK_TARGET_DETECTED",
                        "priority": "CRITICAL",
                        "breached_zones": ["OPTICAL PTZ FOV SECTOR-1"],
                        "sop_instruction": "🚨 NON-COOPERATIVE AERIAL TARGET ACQUIRED BY ROOFTOP PTZ CAMERA. ZERO REMOTE ID BROADCAST. IMMEDIATELY VECTOR FIELD PATROL & INITIATE OPTICAL TRACKING.",
                        "intercept_vector": {
                            "pilot_lat": 13.0610,
                            "pilot_lon": 80.2730,
                            "target_lat": 13.0640,
                            "target_lon": 80.2710,
                            "target_alt_m": 75.0,
                            "distance_m": 350.0
                        },
                        "telemetry": {
                            "uas_id": dark_id,
                            "lat": 13.0640,
                            "lon": 80.2710,
                            "alt_m": 75.0,
                            "speed_mps": 11.5,
                            "heading_deg": 140,
                            "pilot_lat": 13.0610,
                            "pilot_lon": 80.2730,
                            "transmission_state": "SILENT_DARK"
                        },
                        "first_detected": datetime.now(timezone.utc).isoformat(),
                        "disposition": None
                    }

            c2_payload = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "active_tracks": list(active_tracks.values()),
                "active_trzs": [zone.model_dump() if hasattr(zone, 'model_dump') else zone.dict() for zone in geofence_engine.get_active_trzs()],
                "base_zones": [bz.model_dump() if hasattr(bz, 'model_dump') else bz.dict() for bz in geofence_engine.base_zones],
                "active_alerts": list(active_alerts.values()),
                "metrics": {
                    "total_tracks": len(active_tracks),
                    "active_trzs_count": len(geofence_engine.get_active_trzs()),
                    "active_alerts_count": len(active_alerts),
                    "camera_status": "ONLINE" if vision_service.is_running else "OFFLINE",
                    "camera_using_synthetic": vision_status.get("using_synthetic", False)
                },
                "vision_status": vision_status,
                "recent_audit_records": [r.model_dump() if hasattr(r, 'model_dump') else r.dict() for r in audit_logger.get_all_records(limit=10)]
            }

            await websocket.send_text(json.dumps(c2_payload))
            await asyncio.sleep(0.5) # 2 Hz refresh rate
    except WebSocketDisconnect:
        console_websockets.remove(websocket)
    except Exception as e:
        console_websockets.discard(websocket)


# --------------------------------------------------------------------------
# BACKGROUND DEMO SIMULATION LOOP
# --------------------------------------------------------------------------

async def simulation_loop():
    """
    Generates realistic tactical drone trajectories for immediate live demonstration:
    1. Authorized Sector Police Unit (Green envelope)
    2. Unregistered TRZ Intruder Target (Breaches Rule 24 TRZ)
    3. High Altitude Violation Target (>120m ceiling)
    """
    print("[SIMULATOR] Launching background drone telemetry simulator...")
    step = 0
    while True:
        try:
            step += 1
            t = step * 0.5
            
            # Drone 1: Police Authorized Patrol (Circles around 13.0600, 80.2600)
            lat1 = 13.0580 + math.sin(t * 0.05) * 0.004
            lon1 = 80.2600 + math.cos(t * 0.05) * 0.004
            tel1 = TelemetryPayload(
                uas_id="UIN-IND-2026-POLICE-01",
                lat=lat1,
                lon=lon1,
                alt_m=65.0 + math.sin(t * 0.1) * 10,
                speed_mps=8.5,
                heading_deg=(int(t * 5) % 360),
                pitch_deg=1.0,
                roll_deg=-1.5,
                pilot_lat=13.0570,
                pilot_lon=80.2590,
                rssi_dbm=-58,
                transmission_state="BROADCASTING"
            )
            eval1 = geofence_engine.evaluate_track(tel1)
            t1_dict = eval1.dict()
            t1_dict["breadcrumbs"] = (active_tracks.get("UIN-IND-2026-POLICE-01", {}).get("breadcrumbs", []) + [{"lat": lat1, "lon": lon1, "alt": 65.0}])[-30:]
            active_tracks["UIN-IND-2026-POLICE-01"] = t1_dict

            # Drone 2: Unregistered Intruder Target (Crosses inside Rule 24 TRZ corridor)
            lat2 = 13.0610 + math.sin(t * 0.08) * 0.005
            lon2 = 80.2720 + math.cos(t * 0.08) * 0.005
            tel2 = TelemetryPayload(
                uas_id="UIN-UNAUTH-TARGET-99",
                lat=lat2,
                lon=lon2,
                alt_m=95.0,
                speed_mps=14.0,
                heading_deg=135,
                pitch_deg=3.0,
                roll_deg=0.5,
                pilot_lat=13.0690,
                pilot_lon=80.2790,
                rssi_dbm=-75,
                transmission_state="BROADCASTING"
            )
            eval2 = geofence_engine.evaluate_track(tel2)
            t2_dict = eval2.dict()
            t2_dict["breadcrumbs"] = (active_tracks.get("UIN-UNAUTH-TARGET-99", {}).get("breadcrumbs", []) + [{"lat": lat2, "lon": lon2, "alt": 95.0}])[-30:]
            active_tracks["UIN-UNAUTH-TARGET-99"] = t2_dict
            
            # Handle alert queue for Drone 2
            if eval2.status != "AUTHORISED":
                if "UIN-UNAUTH-TARGET-99" not in active_alerts or active_alerts["UIN-UNAUTH-TARGET-99"].get("status") != eval2.status:
                    active_alerts["UIN-UNAUTH-TARGET-99"] = {
                        "uas_id": "UIN-UNAUTH-TARGET-99",
                        "status": eval2.status,
                        "priority": eval2.priority,
                        "breached_zones": eval2.breached_zones,
                        "sop_instruction": eval2.sop_instruction,
                        "intercept_vector": eval2.intercept_vector,
                        "telemetry": tel2.dict(),
                        "first_detected": datetime.now(timezone.utc).isoformat(),
                        "disposition": None
                    }

            # Drone 3: High Altitude Breach Target (Altitude > 120m)
            lat3 = 13.0530 + math.sin(t * 0.03) * 0.003
            lon3 = 80.2650 + math.cos(t * 0.03) * 0.003
            tel3 = TelemetryPayload(
                uas_id="UIN-IND-2026-POLICE-02",
                lat=lat3,
                lon=lon3,
                alt_m=155.0, # Altitude violation (>120m ceiling)
                speed_mps=11.0,
                heading_deg=220,
                pitch_deg=0.0,
                roll_deg=0.0,
                pilot_lat=13.0520,
                pilot_lon=80.2640,
                rssi_dbm=-62,
                transmission_state="BROADCASTING"
            )
            eval3 = geofence_engine.evaluate_track(tel3)
            t3_dict = eval3.dict()
            t3_dict["breadcrumbs"] = (active_tracks.get("UIN-IND-2026-POLICE-02", {}).get("breadcrumbs", []) + [{"lat": lat3, "lon": lon3, "alt": 155.0}])[-30:]
            active_tracks["UIN-IND-2026-POLICE-02"] = t3_dict

            if eval3.status != "AUTHORISED":
                if "UIN-IND-2026-POLICE-02" not in active_alerts or active_alerts["UIN-IND-2026-POLICE-02"].get("status") != eval3.status:
                    active_alerts["UIN-IND-2026-POLICE-02"] = {
                        "uas_id": "UIN-IND-2026-POLICE-02",
                        "status": eval3.status,
                        "priority": eval3.priority,
                        "breached_zones": eval3.breached_zones,
                        "sop_instruction": eval3.sop_instruction,
                        "intercept_vector": eval3.intercept_vector,
                        "telemetry": tel3.dict(),
                        "first_detected": datetime.now(timezone.utc).isoformat(),
                        "disposition": None
                    }

        except Exception as e:
            print(f"[SIMULATOR ERROR] {e}")

        await asyncio.sleep(1.0)


@app.on_event("startup")
async def on_startup():
    """Starts background simulation loop on server startup."""
    asyncio.create_task(simulation_loop())


@app.on_event("shutdown")
async def on_shutdown():
    """Cleans up vision camera service on shutdown."""
    vision_service.close()

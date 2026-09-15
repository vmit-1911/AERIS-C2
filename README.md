# AERIS-C2: Tactical Civil Security & Drone Activity C2 Console

**AERIS-C2** (Civil Security Command & Control) is a standalone, on-premise civil law enforcement drone airspace monitoring and threat alerting console. It provides real-time telemetry ingestion, GeoJSON geofencing, temporary red-zone enforcement, canonical track classification, non-interdiction alerting, operator disposition with mandatory reason codes, append-only audit logging, and Track A optical detection with telemetry correlation.

---

## 🏗️ System Architecture

```
                                 ┌────────────────────────┐
                                 │ Python Virtual Drone   │
                                 │   Simulator (LAN/WAN)  │
                                 └───────────┬────────────┘
                                             │
                       WebSocket Telemetry   │  /ws/telemetry
                                             v
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AERIS-C2 FASTAPI BACKEND                          │
│                                                                             │
│  ┌───────────────────────┐   ┌───────────────────────┐   ┌───────────────┐  │
│  │   Track Manager Hub   │<--│ Drone Registry Engine │   │ GeoJSON Zone  │  │
│  │  (Canonical State)    │   │ (Simulated Civil DB)  │   │ Manager Engine│  │
│  └───────────┬───────────┘   └───────────────────────┘   └───────┬───────┘  │
│              │                                                   │          │
│              ├───────────────────────────────────────────────────┘          │
│              v                                                              │
│  ┌───────────────────────┐   ┌───────────────────────┐   ┌───────────────┐  │
│  │ Operational Alert     │-->│ Operator Disposition  │-->│  Append-Only  │  │
│  │ Engine (Deduplicated) │   │ Mandatory Reason Code │   │   Audit Log   │  │
│  └───────────┬───────────┘   └───────────────────────┘   └───────┬───────┘  │
│              │                                                   │          │
│              │               ┌───────────────────────┐           │          │
│              │               │ Track A Vision Engine │           │          │
│              │               │  (YOLOv8 Demo/Mock)   │           │          │
│              │               └───────────┬───────────┘           │          │
│              │                           v                       │          │
│              │               ┌───────────────────────┐           │          │
│              │               │ Correlation Layer     │           │          │
│              │               │ (Temporal & Track)    │           │          │
│              │               └───────────┬───────────┘           │          │
│              v                           v                       v          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │               WebSocket Live Broadcaster (/ws/dashboard)              │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │
                                       v
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AERIS-C2 TACTICAL OPERATOR DASHBOARD                     │
│  - Real-time Leaflet Dark Airspace Map with Breadcrumbs & Headings          │
│  - Active Tracks Roster with Altitude Envelopes & Registry Info             │
│  - Priority Alert Queue with 1-Click Map Centering & Dispositions           │
│  - Track A Camera / ML Vision Viewport with Bounding Box & Correlation Box  │
│  - Immutable Security Event Audit Trail with CSV/JSON Exporters             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Track A Vision Component & YOLO Model Metrics

### Vision Service Pipeline:
1. **Video Ingestion**: Camera stream / frame upload via `/api/vision/upload-frame` or `/api/vision/detect`.
2. **YOLO-Class Detector**: `MockYOLOv8Detector` implementing the `VisionDetectorInterface`.
3. **Vision Observation Model**:
   ```json
   {
     "observation_id": "VIS-OBS-5001",
     "camera_id": "CAM-01",
     "timestamp": "2026-09-10T12:00:00Z",
     "class": "drone",
     "confidence": 0.94,
     "bbox": [180.0, 110.0, 310.0, 220.0],
     "is_mock": true
   }
   ```
4. **Correlation Layer**: Correlates optical sightings with active telemetry tracks based on temporal proximity and operational track states. Results are labeled as `CORRELATED`, `POTENTIAL MATCH`, or `UNMATCHED`.
5. **No Direct GPS Fabrication**: As camera calibration / extrinsic geolocation parameters are uncalibrated in demo mode, sightings are clearly represented as *Potential correlation (Uncalibrated Visual Bearing)* without claiming fabricated GPS coordinates.

### Model Evaluation & Metrics Statement:
> **Status**: `Model evaluation pending; current vision mode is demonstration/mock.`  
> **Precision / Recall**: `UNMEASURED (MOCK/DEMO)`  
> **Confidence Threshold**: `0.50`  
> **Mock/Demo Disclaimer**: In compliance with evaluation rules, all metrics are explicitly identified as demonstration mocks. The detector interface (`VisionDetectorInterface`) is plug-and-play and ready to receive weights from a custom-trained YOLOv8 PyTorch model (`.pt` / ONNX).

---

## 🛡️ Operational Alert Engine & Canonical Classifications

The backend classifies every active track into 4 canonical states:
1. `AUTHORISED`: Drone is registered in civil registry with active authorization and flying within altitude envelope of open airspace.
2. `UNREGISTERED`: Drone is not recognized in civil registry (`NOT-REGISTERED`) or has revoked authorization.
3. `OUT_OF_ENVELOPE`: Drone is in breach of red-zone geofence, temporary emergency zone, or altitude ceiling.
4. `LOST_LINK`: Telemetry stream interrupted for $> 5.0\text{ s}$.

### Non-Interdiction Suggested Actions:
- **UNREGISTERED**: *"Verify drone identity and initiate officer assessment."*
- **OUT_OF_ENVELOPE**: *"Verify flight authorization and assess escalation."*
- **LOST_LINK**: *"Attempt telemetry verification and visually confirm track."*
- **AUTHORISED**: *"Maintain standard monitoring."*

> ⚠️ **Strict Security Boundary**: The system is strictly detection, classification, geofencing, optical correlation, alerting, and evidence logging. It strictly prohibits electronic counter-measures (jamming, spoofing, takeover, GNSS interference, interdiction) and biometric/facial recognition.

---

## 🔒 Append-Only Audit Log & Export

All operational events are captured immutably with operator identification:
- Alert Dispositions (`ALERT_CONFIRMED`, `ALERT_DISMISSED`, `ALERT_ESCALATED`)
- Temporary Zone Creation (`ZONE_CREATION`)
- Automatic Zone Expiration (`ZONE_EXPIRATION`)
- System Configuration & Startups (`SYSTEM_STARTUP`)

### Export Formats:
- **CSV**: `GET /api/audit/export?format=csv`
- **JSON**: `GET /api/audit/export?format=json`

---

## 🚀 Laptop-to-Laptop Quickstart Guide

### 1. Setup Backend on Laptop 1 (C2 Server)

Open PowerShell / Terminal in the project directory:
```powershell
python main.py
```
*The server binds to `0.0.0.0:8000`, making it accessible across the local network.*

### 2. Open Console in Browser on Laptop 1
Navigate to:
```
http://localhost:8000
```
*(Or `http://<LAPTOP_1_IP>:8000` from any authorized station on LAN).*

### 3. Connect Laptop 2 (Python Virtual Drone Simulator)

Find Laptop 1's LAN IP (`ipconfig` on Windows or `ifconfig` on Linux).  
On **Laptop 2**, run the simulator:

```bash
# Scenario 1: Authorized Drone (UAV-001)
python virtual_drone_sender.py --uri ws://<LAPTOP_1_IP>:8000/ws/telemetry --scenario-1

# Scenario 2: Unregistered Rogue Drone (UAV-999)
python virtual_drone_sender.py --uri ws://<LAPTOP_1_IP>:8000/ws/telemetry --scenario-2

# Scenario 3: Temporary Red-Zone Violation & Escalation Demo
python virtual_drone_sender.py --uri ws://<LAPTOP_1_IP>:8000/ws/telemetry --scenario-3

# Scenario 4: Lost Telemetry Link & Auto-Recovery Demo
python virtual_drone_sender.py --uri ws://<LAPTOP_1_IP>:8000/ws/telemetry --scenario-4

# Scenario 5: Camera / ML Vision Detection & Correlation
python virtual_drone_sender.py --uri ws://<LAPTOP_1_IP>:8000/ws/telemetry --scenario-5

# Multi-Drone End-to-End Simulation
python virtual_drone_sender.py --uri ws://<LAPTOP_1_IP>:8000/ws/telemetry --demo-all --multi
```

---

## ⚡ Performance Targets & Data Retention

- **Telemetry Ingestion Latency**: $\le 2.0\text{ s}$ over WebSocket.
- **Violation to Alert Latency**: $\le 5.0\text{ s}$ via in-memory polygon engine.
- **Data Retention**: Configured via `DEFAULT_RETENTION_DAYS=7`. Old telemetry data is purged automatically via `/api/retention/purge`.
- **Offline / On-Premise Capability**: 100% functional in isolated LAN air-gapped networks without cloud dependencies.

---

## 🧪 Automated Test Verification

Run the full end-to-end integration test suite:

```bash
python test_phase5.py
```

### Output:
```
==================================================
AERIS-C2 PHASE 5 FINAL ACCEPTANCE TEST SUITE
==================================================
[PASS] A-G. Telemetry, Map, Track Info, Registry & Authorization
[PASS] H-J. Temporary Red Zone & Latency Violation Alert
[PASS] K-M. Operator Disposition, Audit Trail & CSV/JSON Export
[PASS] N-O. Automatic Zone Expiration & De-enforcement
[PASS] P-S. LOST_LINK Timeout & Telemetry Recovery
[PASS] T-W. Track A Vision Detection & Correlation Layer
[PASS] Retention Policy & Telemetry Purge

Results: 7 passed, 0 failed.
```

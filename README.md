# Civil Police Airspace C2 & Dynamic TRZ Enforcement System
### Autonomous Drone Activity Monitoring, Spatiotemporal Enforcement & Forensic Audit Ledger

An enterprise-grade, distributed Command & Control (C2) situational awareness platform built for civil law enforcement, district police control rooms, and incident commanders.

The system operationalizes digital airspace governance under **Rule 24 of the Indian Drone Rules, 2021** (dynamic 48-hour Temporary Red Zones), detects non-cooperative aerial intrusions via integrated **YOLOv8 optical verification**, and logs tamper-evident evidentiary chains compliant with **Section 65B of the Bharatiya Sakshya Adhiniyam (BSA)**.

---

## 1. System Overview & Topology

The platform operates as a distributed edge network divided into field nodes (smartphones / simulators) and a centralized police command desk:

┌────────────────────────────────────────────────────────┐
│               NODE 1: FIELD TRANSMITTER                │
│              (Mobile PWA / Unity Engine)               │
│                                                        │
│  • Reads IMU orientation (Compass Heading & Tilt)      │
│  • Emits ASTM F3411-22a Remote ID packets at 2 Hz      │
│  • One-touch incursion triggers (Breach, Dark, Alt)    │
└───────────────────────────┬────────────────────────────┘
│
│ WebSocket Telemetry (ws://<LAPTOP_IP>:8000/ws/drone)
▼
┌────────────────────────────────────────────────────────┐
│            NODE 2: CIVIL POLICE C2 DESK                │
│            (FastAPI + MapLibre GL + YOLOv8)            │
│                                                        │
│  1. Ingestion: Many-to-one WebSocket ingestion gateway │
│  2. Evaluation: 4D Spatiotemporal Geofencing (<20ms)   │
│     - DGCA Green / Yellow / Red Base Zone checking     │
│     - Dynamic Rule 24 TRZ 3D polygon/altitude bounds   │
│  3. Optical Cross-Check: YOLOv8 Computer Vision        │
│     - Detects silent craft missing Remote ID (Dark)    │
│  4. Command Common Operating Picture (COP):            │
│     - 3D MapLibre tactical digital twin map            │
│     - Standard Operating Procedures (SOP) dispatch     │
│  5. Evidentiary Ledger: SQLite SHA-256 Hash Chain      │
│     - Section 65B BSA prosecution dossier export       │
└────────────────────────────────────────────────────────┘


---

## 2. Technical Workflow & Decision Architecture

### End-to-End Operational Sequence

1. **Airspace Initialization:** The police operator loads baseline DGCA airspace layers (Green Zones up to 120m, Yellow controlled corridors, Red airport buffers).
2. **Dynamic TRZ Enactment:** Under Rule 24 of the Drone Rules, 2021, the duty officer clicks points on the tactical map surrounding a public gathering or disaster zone, defines an altitude ceiling (e.g., 100m AGL), sets an operational duration (e.g., 2 hours), and enacts the zone.
3. **Telemetry Streaming:** Active UAS units transmit telemetry containing coordinate tracks, altitude AMSL, ground speed, and pilot launch coordinates.
4. **Sub-50ms Geofence Evaluation:** The FastAPI backend evaluates each frame:
   - **Whitelist Check:** Is `uas_id` recognized? If not, it is flagged as `UNREGISTERED`.
   - **4D Envelope Check:** Does the drone intersect an active TRZ within the floor/ceiling bounds before expiration? If yes, it is flagged as `OUT_OF_ENVELOPE`.
   - **Ceiling Check:** Does the drone exceed 120m in a standard zone? If yes, it is flagged as `ALTITUDE_VIOLATION`.
5. **Surveillance Cross-Check:** The optical YOLOv8 service inspects physical airspace. If an aerial target is detected but lacks matching cooperative Remote ID telemetry, the console sounds a `DARK_TARGET` alarm.
6. **Tactical Triage & Prosecution Logging:** The duty officer receives an actionable SOP card showing the pilot's launch coordinates. Selecting `[DISPATCH QRT]` or `[CONFIRM]` writes the event snapshot, previous block hash, and current digest to an append-only SQLite ledger.

### 4D Geofence Decision Logic Flowchart

                      [ Incoming Telemetry Frame ]
                                   │
                                   ▼
                 { uas_id in Authorized Registry? }
                            ╱             ╲
                         No                Yes
                         ╱                   ╲
       [ Flag: UNREGISTERED TARGET ]          │
       [ Priority: HIGH            ]          │
                         │                   │
                         └─────────┬─────────┘
                                   ▼
                 { Inside Active TRZ Polygon? }
                            ╱             ╲
                         Yes               No
                         ╱                   ╲
         { Floor <= alt_m <= Ceiling? }       │
               ╱               ╲             │
            Yes                 No           │
            ╱                     ╲          │
[ Flag: OUT_OF_ENVELOPE ]          │          │
[ Priority: CRITICAL    ]          │          │
            │                      ▼          ▼
            │             { alt_m > 120m Statutory Ceiling? }
            │                          ╱             ╲
            │                       Yes               No
            │                       ╱                   ╲
            │        [ Flag: ALTITUDE_VIOLATION ]  [ Flag: AUTHORISED ]
            │        [ Priority: MEDIUM         ]  [ Priority: NORMAL ]
            │                       │                     │
            └───────────────────────┼─────────────────────┘
                                    ▼
                       [ Push to Police C2 Queue ]

---

## 3. Empathy Map & Business Model Canvas

### Empathy Map: Police Duty Officer / Superintendent of Police
- **Who are we empathizing with?** District Police Commanders and Control Room Duty Officers responsible for public safety, VIP security, and statutory airspace enforcement during public events[cite: 2].
- **What do they see?** Conflicting CCTV screens, paper gazette notifications, and drones hovering over crowds with no identification transponders[cite: 2].
- **What do they hear?** Urgent radio calls demanding to know who owns a hovering drone, and legal warnings that manual screen grabs won't hold up in court under Section 65B of the Bharatiya Sakshya Adhiniyam[cite: 2].
- **What do they say?** *"We cannot shoot or jam drones because RF jamming drops them into the crowd. Give me the pilot's location so I can send a team to the ground."*[cite: 2]
- **What do they do?** Deploy foot patrols to search parks and parking structures after an unauthorized flight has already begun[cite: 2].
- **Pains:** Anxiety regarding unvetted payloads entering crowded venues, alert fatigue from raw radar feeds, and operational paralysis caused by unknown aerial craft[cite: 2].
- **Gains:** Automated certainty, sub-second breach alerts, exact GPS launch coordinates for pilot interception, and a court-ready cryptographic audit dossier[cite: 2].

### Business Model Canvas (GovTech SaaS & Appliance)
- **Key Partners:** DGCA/DigitalSky for vector layers, State Police IT Cells, Smart City ICCC operators, and edge compute hardware OEMs[cite: 1].
- **Key Activities:** Core 4D geofence development, YOLOv8 vision pipeline tuning, BSA Section 65B legal compliance verification, and tactical simulation drills[cite: 1].
- **Key Resources:** Proprietary 4D spatiotemporal geofence engine, low-latency WebSocket broker, and SHA-256 evidentiary chain architecture[cite: 1].
- **Value Propositions:** Operationalizes Rule 24 in three clicks; identifies non-cooperative craft by cross-referencing camera feeds with Remote ID; directs intercept patrols to pilot launch coordinates; and provides an automated, tamper-evident legal dossier for court prosecution[cite: 1].
- **Customer Relationships:** Dedicated deployment engineers, joint simulation drills with police academies, and automated regulatory software updates[cite: 1].
- **Channels:** Government e-Marketplace (GeM), public-safety defense system integrators, and homeland security procurement tenders[cite: 1].
- **Customer Segments:** State Police Headquarters, City Police Commissionerates, Smart City ICCCs, Prison Departments, and Port Authorities[cite: 1].
- **Cost Structure:** Core software R&D salaries, edge compute hardware, localized map caching infrastructure, and statutory forensic certifications[cite: 1].
- **Revenue Streams:** Tiered annual software subscription per control room console, turnkey hardware edge-appliance markups, and Annual Maintenance Contracts (AMC)[cite: 1].

---

## 4. Novelty & Feasibility

### Novelty (Differentiators vs. Existing Solutions)
1. **Closing the "Dark Craft" Gap:** Unlike standard UTM platforms that are blind to silent drones, this platform cross-checks optical camera detections (YOLOv8) with active Remote ID radio packets. If an object is detected visually but emits no telemetry, it triggers a `DARK_TARGET` alarm.
2. **Dynamic 4D TRZ Enforcement:** Automates Rule 24 of India's Drone Rules, 2021 by enabling duty officers to draw temporary, 48-hour volume-restricted airspaces that automatically expire, complete with vertical floor and ceiling constraints.
3. **Pilot Launch Interception:** Extracts the pilot's launch coordinates from the ASTM F3411 payload, allowing ground patrols to intercept operators without dangerous kinetic interception or RF jamming.
4. **Court-Admissible Hash Ledger (BSA Section 65B):** Log entries are chained together using cryptographic SHA-256 hashes ($H_n = \text{SHA-256}(H_{n-1} + \text{Payload})$), preventing evidence tampering and providing a defensible prosecution dossier.

### Feasibility
- **Standard WebSockets:** Many-to-one architecture allows hundreds of devices to connect simultaneously over standard HTTP/WS ports.
- **Sub-20ms Evaluation:** Uses lightweight point-in-polygon ray-casting algorithms that run without heavy database overhead.
- **Browser-Native Sensors:** Accesses hardware gyroscope and compass APIs via standard mobile web browsers, eliminating the need to install native APKs.

---

## 5. Alignment with UN Sustainable Development Goals (SDGs)

- **SDG 16 (Peace, Justice & Strong Institutions):**
  - *Target 16.a:* Equips civil law enforcement with real-time perimeter visibility over prisons, government secretariats, and public gatherings to prevent violence and illegal aerial surveillance.
  - *Target 16.6:* Ensures transparent, accountable legal evidence through append-only SHA-256 cryptographic audit logs compliant with Section 65B of the Bharatiya Sakshya Adhiniyam.
- **SDG 11 (Sustainable Cities & Communities):**
  - *Target 11.7:* Protects dense civilian gatherings, sports stadiums, and open public arenas by automating low-altitude airspace geofencing.
  - *Target 11.5:* Protects disaster response routes, emergency air corridors, and fire-fighting operations from civilian drone interference.
- **SDG 9 (Industry, Innovation & Infrastructure):**
  - *Target 9.1:* Establishes open, non-proprietary digital UTM infrastructure (ASTM F3411) necessary to scale commercial drone operations safely.

---

## 6. Directory Structure

```text
secc-airspace-c2/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # Core FastAPI backend, WebSockets & pure Python geofencing
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── telemetry.py         # ASTM F3411 Remote ID Pydantic schema
│   │   │   ├── geofence.py          # 4D TRZ declaration schema
│   │   │   └── audit.py             # Section 65B audit record schema
│   │   └── static/
│   │       └── mobile_drone.html    # Standalone mobile transmitter UI
│   ├── requirements.txt
│   └── audit_ledger.db              # Auto-generated cryptographic ledger
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── TacticalMap.jsx      # MapLibre 3D map with volumetric TRZ extrusions
│   │   │   ├── AlertQueue.jsx       # Real-time triage feed & police dispatch SOPs
│   │   │   ├── TrzDrawer.jsx        # Interactive 48-hour polygon drawing tool
│   │   │   ├── PTZCameraPIP.jsx     # Live YOLOv8 webcam surveillance overlay
│   │   │   └── AuditLogModal.jsx    # Forensic hash verification viewer
│   │   ├── App.jsx                  # Main dashboard layout
│   │   └── index.css                # Tactical dark-slate styling
│   ├── package.json
│   └── vite.config.js
└── README.md
7. Installation & Quick Start
Prerequisites
Python 3.11 or higher

Node.js 18+ and npm

A shared Local Area Network or Mobile Wi-Fi Hotspot

Step 1: Backend Setup
Bash
cd backend
pip install fastapi uvicorn websockets pydantic
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
Step 2: Frontend Console Setup
In a new terminal:

Bash
cd frontend
npm install
npm run dev -- --host
Open http://localhost:5173 on your laptop to view the Command & Control desk.

Step 3: Connect Mobile Drone Transmitters
Find your laptop's local IP address (ipconfig on Windows or ifconfig on Linux/macOS).

Open Chrome or Safari on any smartphone connected to the same network.

Navigate to:

Plaintext
http://<YOUR_LAPTOP_IP>:8000/drone
Select a drone identity (UIN-IND-2026-X89, MED-AIR-CORRIDOR-04, or ROGUE-PHANTOM-99).

Tap "Enable Gyro / Compass" to stream physical phone orientation directly into the tactical radar.

Use the scenario buttons (Breach Police TRZ, Alt > 120m, Cut Remote ID) to trigger real-time alerts on the police console.

8. API & WebSocket Reference
WebSocket Channels
ws://<LAPTOP_IP>:8000/ws/drone — Ingests ASTM F3411 telemetry from field devices at 2 Hz.

ws://<LAPTOP_IP>:8000/ws/console — Pushes unified track states and geofence alerts to the dashboard.

Key REST Routes
GET /drone — Serves the mobile transmitter web interface.

POST /api/trz — Declares a dynamic 4D Temporary Red Zone under Rule 24.

POST /api/alert/disposition — Records police operator actions (DISPATCH_QRT, CONFIRM, DISMISS).

GET /api/audit/export — Exports the complete, verified SHA-256 evidentiary chain for judicial prosecution under Section 65B of the Bharatiya Sakshya Adhiniyam.

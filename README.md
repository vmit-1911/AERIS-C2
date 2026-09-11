# Virtual Drone GCS & ASTM F3411-22a Remote ID Telemetry Transmitter

An interactive, tactical **Virtual Drone Ground Control Station (GCS) and Remote ID Telemetry Transmitter** running on Laptop 1 that streams real-time flight data to external surveillance radars and air traffic consoles over WebSockets (`ws://0.0.0.0:8765`).

---

## 🎯 Architecture & Standard Compliance

```
+-----------------------------------------------------------------------------------+
|                            LAPTOP 1 (GCS & TRANSMITTER)                          |
|                                                                                   |
|   +---------------------------------------------------------------------------+   |
|   |                       PYTHON BACKEND (:8765)                              |   |
|   |   * State Machine: UAS ID, Lat/Lon, Alt, Pitch, Roll, Yaw, Spd, Hdg      |   |
|   |   * 20 Hz Kinematics Solver (Realistic Inertia, Aerodynamics, Turn Rate)  |   |
|   |   * 2 Hz ASTM F3411-22a (OpenDroneID) Broadcast Encapsulator              |   |
|   |   * Scenario Engine: Normal, Ceiling Breach, Silent Dark, Spoofed ID      |   |
|   +---------------------------------------------------------------------------+   |
|                                   ▲               │                               |
|                     Control Link  │               │ ASTM F3411 Broadcast          |
|                     (Bi-direct.)  │               ▼                               |
|   +---------------------------------------+  +--------------------------------+   |
|   |      COCKPIT WEB UI (React + Three.js)|  | EXTERNAL SURVEILLANCE CONSOLE  |   |
|   |   * 3D Attitude Indicator (ADI)       |  |   * Air Traffic / Police Radar |   |
|   |   * Primary Flight Display (PFD) HUD  |  |   * OpenDroneID Packet Sink    |   |
|   |   * Tactical Radar Map (Leaflet)      |  |   * Rogue / Spoofing Alarms    |   |
|   |   * Hardware Keyboard Flight Control  |  +--------------------------------+   |
|   |   * ASTM F3411 Live Protocol Inspector|                                       |
|   +---------------------------------------+                                       |
+-----------------------------------------------------------------------------------+
```

---

## 🚀 1-Command Startup

### Method 1: PowerShell Script
```powershell
.\start.ps1
```

### Method 2: Windows Batch
Double-click `start.bat` or run:
```cmd
start.bat
```

### Method 3: Manual Execution
In Terminal 1:
```bash
python drone_transmitter.py
```

In Terminal 2:
```bash
npm run dev
```

Then open your browser at `http://localhost:5173`.

---

## 🕹️ Flight Controls

| Key | Function |
|---|---|
| **[W]** | Throttle Up / Accelerate Ground Speed (+2 m/s) |
| **[S]** | Throttle Down / Brake Ground Speed (-2 m/s) |
| **[A]** | Turn Heading Yaw Left (-10°) & Bank Left |
| **[D]** | Turn Heading Yaw Right (+10°) & Bank Right |
| **[↑] Arrow Up** | Climb Altitude (+3 m/s) |
| **[↓] Arrow Down** | Descend / Sink Altitude (-3 m/s) |
| **[Space]** | Emergency Loiter / Hover Hold (Instant Stop) |

---

## 🧪 Live Demo Scenarios

1. **Normal Patrol (Compliant Baseline)**:
   - Sets UAS ID: `UIN-IND-2026-X89`
   - Altitude: `60m AGL` (< 120m regulatory ceiling)
   - Transmission: `BROADCASTING` (Tx ON)
   - Standard 2Hz ASTM F3411 packets emitted to all external listeners.

2. **Breach Ceilings (Regulatory Violation)**:
   - Climbs instantly to `160m AGL` (> 120m DGCA ceiling).
   - HUD triggers flashing red alarm: `REGULATORY CEILING VIOLATION`.
   - External surveillance console receives violation alerts in real time.

3. **Cut Transmitter (Go Dark - Rogue Stealth)**:
   - Sets transmission state to `SILENT_DARK`.
   - Instantly mutes all telemetry emissions to external listeners.
   - GCS cockpit shows stealth indicator, while surveillance console triggers `CRITICAL: SIGNAL LOST / NON-COOPERATIVE ROGUE UAS DETECTED`.

4. **Spoof Identity (Security Alert)**:
   - Alters UAS ID to `UNAUTH-DRONE-999` and operator to `UNKNOWN_ROGUE_OPERATOR`.
   - Triggers `SECURITY ALERT: UNREGISTERED / SPOOFED UAS` on the surveillance listener.

---

## 📡 ASTM F3411-22a Payload Structure

```json
{
  "uas_id": "UIN-IND-2026-X89",
  "ua_type": "Aeroplane/Multirotor",
  "id_type": "Serial/CAA Registration",
  "timestamp": "2026-09-10T14:53:10.500Z",
  "lat": 13.062500,
  "lon": 80.275000,
  "alt_geo_m": 60.0,
  "alt_pressure_m": 60.2,
  "height_agl_m": 60.0,
  "speed_horizontal_mps": 12.5,
  "speed_vertical_mps": 0.0,
  "heading_deg": 45.0,
  "pitch_deg": 1.8,
  "roll_deg": 0.0,
  "yaw_deg": 45.0,
  "operator_location": {
    "lat": 13.060000,
    "lon": 80.272000,
    "alt_geo_m": 12.0
  },
  "operator_id": "OP-IND-TN-9821",
  "rssi_dbm": -45,
  "status": "AIRBORNE",
  "operational_status": "In Flight / Nominally Cooperative",
  "transmission_state": "BROADCASTING",
  "flight_mode": "AUTO_PATROL",
  "battery_percent": 96.0,
  "gps_satellites": 18,
  "protocol": "ASTM_F3411_22A",
  "sequence_number": 1420,
  "auth_data": "0x4A89C2E3[ASTM-SEC-VALID]"
}
```

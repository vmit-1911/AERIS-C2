# UAS Digital Twin — Urban Airspace Simulation

A Unity-based 3D digital twin of a drone (UAS) flying around a procedurally generated city block, streaming live Remote ID telemetry to an external enforcement console over WebSockets. Built as "Node 1" in a small distributed C2 setup — think of it as the flight-sim half of a cop's-eye-view airspace monitoring demo.

No external asset packs, no paid plugins. Everything — the city, the restricted-zone volume, the drone itself — is built from primitives at runtime so you can clone this into a blank URP project and hit Play.

## What it actually does

You fly a quadcopter around a small procedurally generated city (plain cubes, a bit of wireframe detailing, the odd rooftop helipad). While you fly, the sim continuously works out your real-world-style GPS position from your Unity coordinates and broadcasts it as ASTM F3411-22a-shaped Remote ID JSON over a native WebSocket connection — no external networking DLLs, just `System.Net.WebSockets.ClientWebSocket`.

There's a glowing red cylindrical "Temporary Red Zone" hovering over part of the map. Fly into it and it pulses angrily. There's also a tactical HUD with five buttons that let you fake different scenarios instantly for a live demo — normal flight, an airspace breach, an altitude violation, going dark (killing the transmitter mid-flight while the drone keeps flying — a classic non-cooperative-craft trick), and spoofing the aircraft's registered ID.

It's meant to sit alongside a separate FastAPI + MapLibre "police console" app that receives the telemetry and plots it on a live map. This repo is just the drone side.

## Why it's built this way

- **Everything's procedural.** Buildings, the TRZ volume, even the wireframe edges — generated in code at `Start()`. Nobody has to download a city asset pack just to test this.
- **Zero GC pressure where it matters.** The flight controller and telemetry tick avoid allocating garbage every frame — no LINQ, no string concatenation in `Update()`. It's meant to run comfortably on a laptop GPU at 60 FPS.
- **The network layer doesn't care if nobody's listening.** `DroneNetworkBridge` retries the WebSocket connection every couple of seconds if the console app isn't up yet, and reconnects automatically if the link drops.
- **The scripts are decoupled on purpose.** Flight physics doesn't know about networking, networking doesn't know about the HUD. You can rip any one of these out and reuse it elsewhere.

## Scripts in this repo

| File | What it's responsible for |
|---|---|
| `DroneFlightController.cs` | 6-DOF-ish kinematic flight — WASD/QE/Space/Ctrl controls, banking tilt, soft altitude ceiling, rotor spin |
| `GeoSpatialBridge.cs` | Converts Unity world position ↔ WGS-84 lat/lon/alt using a local flat-earth approximation |
| `DroneNetworkBridge.cs` | Async WebSocket client, ASTM F3411-style JSON payloads, 2 Hz broadcast, auto-reconnect |
| `ProceduralAirspace.cs` | Builds the city grid and the volumetric red-zone cylinder, no imported meshes |
| `TacticalFlightHUD.cs` | On-screen telemetry readout + the 5-button scenario panel for live demos |
| `CameraController.cs` | Third-person follow cam plus a downward-angled "police PTZ" cam rendered into a picture-in-picture window |

## Getting it running

1. New Unity project (2022.3 LTS or Unity 6), URP template.
2. Drop all six `.cs` files into `Assets/Scripts/`.
3. Build the scene hierarchy and wire up the components — full walkthrough is in [`SETUP_GUIDE.md`](./SETUP_GUIDE.md), including exactly which fields to drag where.
4. Point `DroneNetworkBridge.targetIp` at whatever machine is running your enforcement console.
5. Start the console first (so there's a socket to connect to), then hit Play in Unity.

Controls: `W`/`A`/`S`/`D` to move, `Q`/`E` to yaw, `Space`/`Left Ctrl` to climb and descend.

## Known shortcuts / things to be aware of

- The "Breach TRZ" demo button currently **teleports** the drone straight into the red zone rather than flying it there gradually — it's a deliberate shortcut so live demos are reliable and don't depend on someone actually flying accurately in front of an audience. Swap it for a `MoveTowards` ramp in `Update()` if you'd rather see it fly in.
- The HUD is IMGUI, not UGUI — that was a "get it running today" choice. It's functional but not going to win a design award. Worth rebuilding in Canvas/UGUI if this becomes more than a demo.
- Coordinates use a flat-earth approximation (`1° lat ≈ 111,139 m`), which is plenty accurate for airspace ranges of a few kilometers but will drift at larger scales.
- Only one `AudioListener` should be active in the scene — if you duplicate a camera, remember to strip the extra one off.

## License

Add whatever license fits your use case — nothing in here assumes one.

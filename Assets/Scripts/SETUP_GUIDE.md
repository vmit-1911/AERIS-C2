# UAS Digital Twin — Unity Setup Guide

Target: Unity 2022.3 LTS or Unity 6, URP template, empty scene.

## 1. Project setup
1. Create a new project with the **URP (Universal 3D)** template (or convert an existing project's pipeline asset to URP).
2. Create a folder `Assets/Scripts/` and drop in all five `.cs` files from this delivery:
   `DroneFlightController.cs`, `GeoSpatialBridge.cs`, `DroneNetworkBridge.cs`,
   `ProceduralAirspace.cs`, `TacticalFlightHUD.cs`, `CameraController.cs`.
3. Confirm **Project Settings → Player → Api Compatibility Level** is set to **.NET Standard 2.1** (default in modern Unity) — required for `System.Net.WebSockets.ClientWebSocket`.

## 2. Scene hierarchy
Build this hierarchy in a fresh, empty URP scene:

```
Scene
├── Environment                (empty GameObject)
│     → add ProceduralAirspace.cs
├── Drone                      (empty GameObject, root)
│     → add Rigidbody (useGravity OFF, isKinematic OFF, interpolate ON)
│     → add DroneFlightController.cs
│     → add GeoSpatialBridge.cs
│     → add DroneNetworkBridge.cs
│     ├── Body                 (Cube or your drone mesh, scaled small, child of Drone)
│     ├── Rotor_FL, Rotor_FR, Rotor_RL, Rotor_RR  (small cylinders/props, children of Drone)
│     └── GimbalMount           (empty child transform, used as gimbal camera anchor if drone-mounted)
├── CameraRig                  (empty GameObject)
│     → add CameraController.cs
│     ├── FollowCamera          (Camera component)
│     └── GimbalCamera          (Camera component; disable "audio listener" on this one — keep only one AudioListener in scene)
├── HUDCanvas                  (UGUI Canvas, Screen Space - Overlay)
│     └── PiP_RawImage          (RawImage, bottom-right corner, ~320x240) + child Reticle (small Image, crosshair sprite or simple plus shape)
└── HUD                        (empty GameObject)
      → add TacticalFlightHUD.cs
```

## 3. Component wiring
- **Drone → DroneFlightController**: drag the 4 rotor transforms into the `Rotors` array.
- **Drone → GeoSpatialBridge**: leave default lat/lon (13.062500, 80.275000) or edit to your real anchor point.
- **Drone → DroneNetworkBridge**: set `Target Ip` to the enforcement console laptop's LAN IP (e.g. `192.168.1.42`), port `8765`, path `/ws/drone`.
- **CameraRig → CameraController**:
  - `Drone Target` = the `Drone` transform.
  - `Follow Camera` = `FollowCamera`.
  - `Gimbal Camera` = `GimbalCamera`.
  - `Pip Raw Image` = `PiP_RawImage`.
  - `Reticle` = the `Reticle` RectTransform.
  - Toggle `Gimbal Mounted On Drone` on/off depending on whether you want a chase-mounted gimbal or a fixed rooftop PTZ tower (set `Gimbal Tower Position` for the latter).
- **HUD → TacticalFlightHUD**: assign `Flight` = Drone's `DroneFlightController`, `Geo` = Drone's `GeoSpatialBridge`, `Network` = Drone's `DroneNetworkBridge`, `Airspace` = `Environment`'s `ProceduralAirspace`.

## 4. Camera / audio listener note
Unity allows only one active `AudioListener`. Keep it on `FollowCamera` and remove/disable the one Unity auto-adds to `GimbalCamera` if you copy-pasted the camera.

## 5. Running the simulation
1. Start your FastAPI/MapLibre enforcement console first so a WebSocket server is listening on `ws://<console-ip>:8765/ws/drone`.
2. Press Play in Unity. `DroneNetworkBridge` auto-connects and retries every 2s until the socket is reachable, then streams telemetry at 2 Hz.
3. Fly with `W/A/S/D` (pitch/roll), `Q/E` (yaw), `Space`/`Left Ctrl` (climb/descend).
4. Use the on-screen scenario buttons (top-right panel) to drive the live demo:
   - **Green Zone Normal** — resets altitude to 60 m and restores nominal broadcast state.
   - **Breach 4D TRZ** — teleports the craft into the red volumetric zone and pulses it red.
   - **Altitude Breach (>120m)** — overrides the soft ceiling and climbs to 160 m.
   - **Kill Transmitter (Go Dark)** — closes the socket while the drone keeps flying visually, simulating a non-cooperative craft.
   - **Tamper Serial / Unregistered** — swaps the broadcast `uas_id` to `ROGUE-UAV-999`.

## 6. Switching the WebSocket target IP at runtime
`DroneNetworkBridge.targetIp` is a public field — expose an inspector-editable value per build, or add a simple IMGUI text field in `TacticalFlightHUD` if you need to change the console IP without recompiling (call `network.StopConnection()` → set `targetIp` → `network.StartConnection()`).

## 7. Performance notes
- All per-frame logic in `DroneFlightController.Update()` avoids heap allocation (no LINQ, no string building).
- `ProceduralAirspace` generation runs once in `Start()`, not per-frame.
- Telemetry JSON serialization only happens at the 2 Hz tick, not every frame.
- `JsonUtility` is used instead of reflection-heavy serializers to avoid GC pressure on a laptop GPU/CPU budget.

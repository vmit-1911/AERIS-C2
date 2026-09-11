using UnityEngine;

/// <summary>
/// IMGUI-based tactical cyberpunk-style HUD: telemetry readouts (compass, altitude,
/// speed, lat/lon) plus the demo scenario-injection button panel. Uses IMGUI for
/// zero-setup instant deployment; swap for UGUI Canvas widgets for a production look.
/// Attach to any GameObject in the scene (typically an empty "HUD" object) and
/// wire up the drone references in the inspector.
/// </summary>
public class TacticalFlightHUD : MonoBehaviour
{
    [Header("References")]
    public DroneFlightController flight;
    public GeoSpatialBridge geo;
    public DroneNetworkBridge network;
    public ProceduralAirspace airspace;

    [Header("Style")]
    public Color hudColor = new Color(0f, 1f, 0.85f);
    public Color warnColor = new Color(1f, 0.15f, 0.15f);
    public int fontSize = 16;

    GUIStyle _labelStyle;
    GUIStyle _warnStyle;
    GUIStyle _buttonStyle;
    bool _stylesInit;

    Vector3 _trzForwardVector = new Vector3(0f, 0f, 40f);

    void InitStyles()
    {
        if (_stylesInit) return;
        _labelStyle = new GUIStyle(GUI.skin.label)
        {
            fontSize = fontSize,
            normal = { textColor = hudColor }
        };
        _warnStyle = new GUIStyle(_labelStyle) { normal = { textColor = warnColor }, fontStyle = FontStyle.Bold };
        _buttonStyle = new GUIStyle(GUI.skin.button) { fontSize = fontSize - 2 };
        _stylesInit = true;
    }

    void OnGUI()
    {
        InitStyles();
        if (flight == null || geo == null) return;

        DrawTelemetryReadouts();
        DrawScenarioPanel();
        DrawLinkStatus();
    }

    void DrawTelemetryReadouts()
    {
        var g = geo.WorldToGeo(flight.transform.position);
        bool overCeiling = flight.transform.position.y > flight.regulatoryCeilingMeters;

        GUILayout.BeginArea(new Rect(16, 16, 340, 220), GUI.skin.box);
        GUILayout.Label("=== REMOTE ID TELEMETRY ===", _labelStyle);
        GUILayout.Label($"HEADING   {flight.headingDeg,6:0.0}°", _labelStyle);
        GUILayout.Label($"SPEED     {flight.CurrentSpeedMps,6:0.0} m/s", _labelStyle);

        GUILayout.Label($"ALTITUDE  {flight.transform.position.y,6:0.0} m",
            overCeiling ? _warnStyle : _labelStyle);

        GUILayout.Label($"LAT       {g.lat:0.000000}", _labelStyle);
        GUILayout.Label($"LON       {g.lon:0.000000}", _labelStyle);
        GUILayout.Label($"PITCH/ROLL {flight.pitchDeg:0.0} / {flight.rollDeg:0.0}", _labelStyle);
        GUILayout.EndArea();
    }

    void DrawLinkStatus()
    {
        if (network == null) return;
        string state = network.isConnected ? "LINK: BROADCASTING" : "LINK: DOWN";
        GUIStyle style = network.transmissionState == "SILENT_DARK" ? _warnStyle
            : (network.isConnected ? _labelStyle : _warnStyle);

        GUILayout.BeginArea(new Rect(16, 244, 340, 60), GUI.skin.box);
        GUILayout.Label(network.transmissionState == "SILENT_DARK" ? "LINK: SILENT / DARK" : state, style);
        GUILayout.Label($"UAS ID: {network.uasId}", _labelStyle);
        GUILayout.EndArea();
    }

    void DrawScenarioPanel()
    {
        GUILayout.BeginArea(new Rect(Screen.width - 300, 16, 280, 260), GUI.skin.box);
        GUILayout.Label("=== SCENARIO INJECTION ===", _labelStyle);

        if (GUILayout.Button("1. Green Zone Normal", _buttonStyle)) Scenario_GreenZoneNormal();
        if (GUILayout.Button("2. Breach 4D TRZ", _buttonStyle)) Scenario_BreachTrz();
        if (GUILayout.Button("3. Altitude Breach (>120m)", _buttonStyle)) Scenario_AltitudeBreach();
        if (GUILayout.Button("4. Kill Transmitter (Go Dark)", _buttonStyle)) Scenario_KillTransmitter();
        if (GUILayout.Button("5. Tamper Serial / Unregistered", _buttonStyle)) Scenario_TamperSerial();

        GUILayout.EndArea();
    }

    // --- Scenario button handlers ---

    void Scenario_GreenZoneNormal()
    {
        flight.SetAltitudeInstant(60f);
        flight.SetIncursionOverride(false);
        if (network != null) network.SetScenarioNormal();
        if (airspace != null) airspace.SetAlertPulsing(false);
    }

    void Scenario_BreachTrz()
    {
        // Vector the drone forward, toward the TRZ perimeter.
        flight.SetPositionOffset(flight.transform.forward * 1f); // nudge so movement reads as intentional
        flight.transform.position = Vector3.MoveTowards(
            flight.transform.position,
            airspace != null ? new Vector3(airspace.trzCenterWorld.x, flight.transform.position.y, airspace.trzCenterWorld.z)
                              : flight.transform.position + _trzForwardVector,
            9999f) ; // teleport straight to the TRZ center for a reliable live demo
        if (network != null) network.SetScenarioTrzBreach();
        if (airspace != null) airspace.SetAlertPulsing(true);
    }

    void Scenario_AltitudeBreach()
    {
        flight.SetIncursionOverride(true);
        flight.SetAltitudeInstant(160f);
        if (network != null) network.SetScenarioAltitudeBreach();
    }

    void Scenario_KillTransmitter()
    {
        if (network != null) network.KillTransmitter();
    }

    void Scenario_TamperSerial()
    {
        if (network != null) network.SetScenarioRogueId();
    }
}

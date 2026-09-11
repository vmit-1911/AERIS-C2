using System;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Net.WebSockets;
using UnityEngine;

/// <summary>
/// Streams ASTM F3411-22a-style Remote ID telemetry to an external enforcement
/// console over a native ClientWebSocket connection. Zero external DLL dependencies.
/// Runs the network I/O on a background Task loop and marshals state onto the main thread
/// via simple locked fields (no UnityEngine API calls off the main thread).
/// </summary>
[RequireComponent(typeof(DroneFlightController))]
[RequireComponent(typeof(GeoSpatialBridge))]
public class DroneNetworkBridge : MonoBehaviour
{
    [Header("Connection")]
    [Tooltip("IP address of the companion enforcement console (Laptop 2).")]
    public string targetIp = "127.0.0.1";
    public int targetPort = 8765;
    public string path = "/ws/drone";

    [Header("Telemetry")]
    public string uasId = "UIN-IND-2026-X89";
    public double pilotLatitude = 13.061000;
    public double pilotLongitude = 80.273000;
    [Tooltip("Broadcast interval in seconds (2 Hz default per ASTM F3411 minimum cadence).")]
    public float tickIntervalSeconds = 0.5f;

    [Header("Scenario State (driven by HUD)")]
    public string transmissionState = "BROADCASTING"; // BROADCASTING | SILENT_DARK
    public string scenarioState = "NORMAL";            // NORMAL | TRZ_BREACH | ALT_BREACH | ROGUE

    [Header("Runtime Status (read-only)")]
    public bool isConnected;
    public string lastError = "";

    DroneFlightController _flight;
    GeoSpatialBridge _geo;

    ClientWebSocket _socket;
    CancellationTokenSource _cts;
    Task _runLoopTask;

    float _tickAccumulator;
    volatile bool _transmitterKilled;

    [Serializable]
    public class RemoteIdPayload
    {
        public string uas_id;
        public string timestamp;
        public double lat;
        public double lon;
        public double alt_m;
        public double speed_mps;
        public double heading_deg;
        public double pitch_deg;
        public double roll_deg;
        public double pilot_lat;
        public double pilot_lon;
        public string transmission_state;
        public string scenario_state;
    }

    void Awake()
    {
        _flight = GetComponent<DroneFlightController>();
        _geo = GetComponent<GeoSpatialBridge>();
    }

    void OnEnable()
    {
        StartConnection();
    }

    void OnDisable()
    {
        StopConnection();
    }

    void OnDestroy()
    {
        StopConnection();
    }

    public void StartConnection()
    {
        StopConnection();
        _transmitterKilled = false;
        _cts = new CancellationTokenSource();
        _runLoopTask = RunLoopAsync(_cts.Token);
    }

    public void StopConnection()
    {
        try
        {
            _cts?.Cancel();
            _socket?.Abort();
            _socket?.Dispose();
        }
        catch { /* best-effort teardown */ }
        finally
        {
            _socket = null;
            isConnected = false;
        }
    }

    /// <summary>HUD "Kill Transmitter (Go Dark)" button hook.</summary>
    public void KillTransmitter()
    {
        transmissionState = "SILENT_DARK";
        _transmitterKilled = true;
        StopConnection(); // craft goes dark: no further packets leave the aircraft
    }

    /// <summary>HUD "Green Zone Normal" button hook — restores link.</summary>
    public void RestoreTransmitter()
    {
        transmissionState = "BROADCASTING";
        if (!isConnected && !_transmitterKilled)
        {
            StartConnection();
        }
        else if (_transmitterKilled)
        {
            _transmitterKilled = false;
            StartConnection();
        }
    }

    void Update()
    {
        if (_transmitterKilled) return;

        _tickAccumulator += Time.deltaTime;
        if (_tickAccumulator < tickIntervalSeconds) return;
        _tickAccumulator = 0f;

        var geo = _geo.WorldToGeo(_flight.transform.position);
        var payload = new RemoteIdPayload
        {
            uas_id = uasId,
            timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"),
            lat = Math.Round(geo.lat, 6),
            lon = Math.Round(geo.lon, 6),
            alt_m = Math.Round(geo.altAmsl, 1),
            speed_mps = Math.Round(_flight.CurrentSpeedMps, 1),
            heading_deg = Math.Round(_flight.headingDeg, 1),
            pitch_deg = Math.Round(_flight.pitchDeg, 1),
            roll_deg = Math.Round(_flight.rollDeg, 1),
            pilot_lat = pilotLatitude,
            pilot_lon = pilotLongitude,
            transmission_state = transmissionState,
            scenario_state = scenarioState
        };

        string json = JsonUtility.ToJson(payload);
        EnqueueSend(json);
    }

    // Simple single-slot queue; at 2 Hz this is more than sufficient and avoids GC-heavy collections.
    string _pendingJson;
    readonly object _sendLock = new object();

    void EnqueueSend(string json)
    {
        lock (_sendLock)
        {
            _pendingJson = json;
        }
    }

    async Task RunLoopAsync(CancellationToken token)
    {
        string uri = $"ws://{targetIp}:{targetPort}{path}";

        while (!token.IsCancellationRequested)
        {
            try
            {
                _socket = new ClientWebSocket();
                await _socket.ConnectAsync(new Uri(uri), token);
                isConnected = true;
                lastError = "";

                while (!token.IsCancellationRequested && _socket.State == WebSocketState.Open)
                {
                    string toSend = null;
                    lock (_sendLock)
                    {
                        if (_pendingJson != null)
                        {
                            toSend = _pendingJson;
                            _pendingJson = null;
                        }
                    }

                    if (toSend != null)
                    {
                        byte[] bytes = Encoding.UTF8.GetBytes(toSend);
                        await _socket.SendAsync(new ArraySegment<byte>(bytes),
                            WebSocketMessageType.Text, true, token);
                    }

                    await Task.Delay(50, token); // poll interval, independent of telemetry tick rate
                }
            }
            catch (OperationCanceledException)
            {
                break; // normal shutdown
            }
            catch (Exception ex)
            {
                lastError = ex.Message;
                isConnected = false;
            }
            finally
            {
                isConnected = false;
                try { _socket?.Dispose(); } catch { }
                _socket = null;
            }

            if (token.IsCancellationRequested) break;

            // Auto-reconnect backoff.
            try
            {
                await Task.Delay(2000, token);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    // --- Public API used by HUD demo buttons for scenario injection ---
    public void SetScenarioNormal()
    {
        scenarioState = "NORMAL";
        uasId = "UIN-IND-2026-X89";
        RestoreTransmitter();
    }

    public void SetScenarioTrzBreach() => scenarioState = "TRZ_BREACH";
    public void SetScenarioAltitudeBreach() => scenarioState = "ALT_BREACH";
    public void SetScenarioRogueId() => uasId = "ROGUE-UAV-999";
}

using UnityEngine;

/// <summary>
/// Kinematic 6-DOF multirotor flight controller.
/// Attach to the root Drone GameObject. Requires a Rigidbody (kinematic=false, useGravity=false)
/// for clean physics-based movement, or set UseRigidbody=false to drive the Transform directly.
/// </summary>
[DisallowMultipleComponent]
public class DroneFlightController : MonoBehaviour
{
    [Header("References")]
    [Tooltip("Rotor transforms to spin around local Y axis (leave empty if none).")]
    public Transform[] rotors;

    [Header("Input Speeds")]
    public float maxHorizontalSpeed = 12f;      // m/s
    public float maxVerticalSpeed = 6f;         // m/s
    public float yawSpeedDegPerSec = 90f;

    [Header("Aerodynamics / Feel")]
    public float accelResponsiveness = 3.5f;    // higher = snappier accel
    public float dragDeceleration = 2.5f;       // deceleration when input released
    public float maxBankAngleDeg = 25f;
    public float bankResponsiveness = 6f;

    [Header("Altitude Limits")]
    public float regulatoryCeilingMeters = 120f;
    [Tooltip("When true, the drone is allowed to fly above the regulatory ceiling (used by the Altitude Breach demo button).")]
    public bool incursionOverride = false;

    [Header("Rotor Spin")]
    public float maxRotorSpinDegPerSec = 1800f;

    [Header("Runtime State (read-only)")]
    public Vector3 velocity;            // current world-space velocity, m/s
    public float currentThrottle01;     // 0..1 for rotor visualization
    public float pitchDeg;
    public float rollDeg;
    public float headingDeg;

    Rigidbody _rb;
    float _targetBankPitch;
    float _targetBankRoll;

    void Awake()
    {
        _rb = GetComponent<Rigidbody>();
        if (_rb != null)
        {
            _rb.useGravity = false;
            _rb.linearDamping = 0f;
            _rb.angularDamping = 0f;
            _rb.interpolation = RigidbodyInterpolation.Interpolate;
        }
    }

    void Update()
    {
        HandleInputAndKinematics(Time.deltaTime);
        SpinRotors(Time.deltaTime);
    }

    void HandleInputAndKinematics(float dt)
    {
        // --- Raw input axes ---
        float pitchInput = 0f; // W/S -> forward/back
        float rollInput = 0f;  // A/D -> left/right
        float yawInput = 0f;   // Q/E -> rotate
        float vertInput = 0f;  // Space/Ctrl -> climb/descend

        if (Input.GetKey(KeyCode.W)) pitchInput += 1f;
        if (Input.GetKey(KeyCode.S)) pitchInput -= 1f;
        if (Input.GetKey(KeyCode.D)) rollInput += 1f;
        if (Input.GetKey(KeyCode.A)) rollInput -= 1f;
        if (Input.GetKey(KeyCode.E)) yawInput += 1f;
        if (Input.GetKey(KeyCode.Q)) yawInput -= 1f;
        if (Input.GetKey(KeyCode.Space)) vertInput += 1f;
        if (Input.GetKey(KeyCode.LeftControl)) vertInput -= 1f;

        // --- Yaw (rotate the whole craft around world/local Y) ---
        float yawDelta = yawInput * yawSpeedDegPerSec * dt;
        transform.Rotate(Vector3.up, yawDelta, Space.World);
        headingDeg = NormalizeAngle(transform.eulerAngles.y);

        // --- Desired velocity in local space, translated to world space ---
        Vector3 desiredLocalVel = new Vector3(
            rollInput * maxHorizontalSpeed,
            vertInput * maxVerticalSpeed,
            pitchInput * maxHorizontalSpeed
        );
        Vector3 desiredWorldVel = transform.TransformDirection(new Vector3(desiredLocalVel.x, 0f, desiredLocalVel.z));
        desiredWorldVel.y = desiredLocalVel.y;

        bool hasInput = Mathf.Abs(pitchInput) > 0.01f || Mathf.Abs(rollInput) > 0.01f || Mathf.Abs(vertInput) > 0.01f;

        if (hasInput)
        {
            velocity = Vector3.Lerp(velocity, desiredWorldVel, 1f - Mathf.Exp(-accelResponsiveness * dt));
        }
        else
        {
            velocity = Vector3.MoveTowards(velocity, Vector3.zero, dragDeceleration * dt);
        }

        // --- Altitude clamp (soft ceiling) ---
        float projectedY = transform.position.y + velocity.y * dt;
        if (!incursionOverride && projectedY > regulatoryCeilingMeters && velocity.y > 0f)
        {
            velocity.y = 0f;
        }
        if (transform.position.y <= 0f && velocity.y < 0f)
        {
            velocity.y = 0f; // ground clamp
        }

        // --- Apply movement ---
        if (_rb != null)
        {
            _rb.linearVelocity = velocity;
        }
        else
        {
            transform.position += velocity * dt;
        }

        // --- Banking tilt proportional to velocity ---
        Vector3 localVel = transform.InverseTransformDirection(velocity);
        _targetBankPitch = Mathf.Clamp(localVel.z / Mathf.Max(maxHorizontalSpeed, 0.001f), -1f, 1f) * maxBankAngleDeg;
        _targetBankRoll = Mathf.Clamp(-localVel.x / Mathf.Max(maxHorizontalSpeed, 0.001f), -1f, 1f) * maxBankAngleDeg;

        pitchDeg = Mathf.LerpAngle(pitchDeg, -_targetBankPitch, 1f - Mathf.Exp(-bankResponsiveness * dt));
        rollDeg = Mathf.LerpAngle(rollDeg, _targetBankRoll, 1f - Mathf.Exp(-bankResponsiveness * dt));

        Vector3 euler = transform.eulerAngles;
        transform.rotation = Quaternion.Euler(pitchDeg, euler.y, rollDeg);

        // --- Throttle value (0..1) used for rotor spin/HUD ---
        currentThrottle01 = Mathf.Clamp01(velocity.magnitude / Mathf.Max(maxHorizontalSpeed, maxVerticalSpeed));
    }

    void SpinRotors(float dt)
    {
        if (rotors == null) return;
        float spinRate = Mathf.Lerp(maxRotorSpinDegPerSec * 0.25f, maxRotorSpinDegPerSec, currentThrottle01);
        for (int i = 0; i < rotors.Length; i++)
        {
            if (rotors[i] == null) continue;
            rotors[i].Rotate(Vector3.up, spinRate * dt, Space.Self);
        }
    }

    static float NormalizeAngle(float deg)
    {
        deg %= 360f;
        if (deg < 0f) deg += 360f;
        return deg;
    }

    // --- Public API used by HUD demo buttons ---
    public void SetIncursionOverride(bool value) => incursionOverride = value;

    public void SetAltitudeInstant(float targetAltitude)
    {
        Vector3 pos = transform.position;
        pos.y = targetAltitude;
        transform.position = pos;
        velocity.y = 0f;
    }

    public void SetPositionOffset(Vector3 worldOffset)
    {
        transform.position += worldOffset;
    }

    public float CurrentSpeedMps => velocity.magnitude;
}

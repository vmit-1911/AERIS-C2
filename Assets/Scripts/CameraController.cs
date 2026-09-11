using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// Manages two cameras:
///  - Follow Cam: smooth damped 3rd-person chase camera.
///  - Gimbal Cam: downward-canted "police optical PTZ" camera rendered to a
///    Picture-in-Picture RawImage with a targeting reticle overlay.
/// Attach to an empty "CameraRig" GameObject and assign references in inspector.
/// </summary>
public class CameraController : MonoBehaviour
{
    [Header("Target")]
    public Transform droneTarget;

    [Header("Follow Camera")]
    public Camera followCamera;
    public Vector3 followOffset = new Vector3(0f, 4f, -9f);
    public float followDamping = 6f;
    public float lookDamping = 8f;

    [Header("Gimbal / PTZ Camera")]
    public Camera gimbalCamera;
    [Tooltip("If true, gimbal is mounted on the drone; if false it stays fixed on a rooftop tower position.")]
    public bool gimbalMountedOnDrone = false;
    public Vector3 gimbalTowerPosition = new Vector3(40f, 35f, 40f);
    public float gimbalDownwardCantDeg = 35f;
    public RenderTexture gimbalRenderTexture;

    [Header("PiP UI")]
    public RawImage pipRawImage;
    public RectTransform reticle;
    public Color reticleColor = Color.green;

    Vector3 _followVelocity;

    void Start()
    {
        if (gimbalCamera != null)
        {
            if (gimbalRenderTexture == null)
            {
                gimbalRenderTexture = new RenderTexture(512, 512, 16) { name = "GimbalFeed" };
            }
            gimbalCamera.targetTexture = gimbalRenderTexture;

            if (pipRawImage != null)
            {
                pipRawImage.texture = gimbalRenderTexture;
            }
        }

        if (reticle != null)
        {
            Image img = reticle.GetComponent<Image>();
            if (img != null) img.color = reticleColor;
        }
    }

    void LateUpdate()
    {
        if (droneTarget == null) return;

        UpdateFollowCamera();
        UpdateGimbalCamera();
    }

    void UpdateFollowCamera()
    {
        if (followCamera == null) return;

        Vector3 desiredPos = droneTarget.TransformPoint(followOffset);
        followCamera.transform.position = Vector3.SmoothDamp(
            followCamera.transform.position, desiredPos, ref _followVelocity, 1f / Mathf.Max(followDamping, 0.001f));

        Quaternion desiredRot = Quaternion.LookRotation((droneTarget.position - followCamera.transform.position).normalized, Vector3.up);
        followCamera.transform.rotation = Quaternion.Slerp(followCamera.transform.rotation, desiredRot, Time.deltaTime * lookDamping);
    }

    void UpdateGimbalCamera()
    {
        if (gimbalCamera == null) return;

        if (gimbalMountedOnDrone)
        {
            gimbalCamera.transform.position = droneTarget.position + Vector3.down * 0.3f;
            Quaternion droneYaw = Quaternion.Euler(0f, droneTarget.eulerAngles.y, 0f);
            gimbalCamera.transform.rotation = droneYaw * Quaternion.Euler(gimbalDownwardCantDeg, 0f, 0f);
        }
        else
        {
            gimbalCamera.transform.position = gimbalTowerPosition;
            Vector3 toDrone = droneTarget.position - gimbalTowerPosition;
            if (toDrone.sqrMagnitude > 0.001f)
            {
                Quaternion lookAtDrone = Quaternion.LookRotation(toDrone.normalized, Vector3.up);
                gimbalCamera.transform.rotation = Quaternion.Slerp(gimbalCamera.transform.rotation, lookAtDrone, Time.deltaTime * 4f);
            }
        }
    }
}

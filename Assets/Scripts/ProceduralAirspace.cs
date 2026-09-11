using UnityEngine;

/// <summary>
/// Generates a lightweight procedural urban backdrop plus a 3D volumetric
/// Temporary Red Zone (TRZ) restricted-airspace cylinder, entirely from
/// primitives so the scene needs no external asset packages.
/// Attach to an empty "Environment" GameObject.
/// </summary>
public class ProceduralAirspace : MonoBehaviour
{
    [Header("City Grid")]
    public int gridSizeX = 8;
    public int gridSizeZ = 8;
    public float cellSize = 20f;
    public float minBuildingHeight = 8f;
    public float maxBuildingHeight = 45f;
    [Range(0f, 1f)] public float buildingDensity = 0.65f;
    public Color buildingColor = new Color(0.08f, 0.09f, 0.12f);
    public Color wireframeColor = new Color(0f, 0.85f, 1f);
    public Color helipadColor = new Color(0.9f, 0.75f, 0.1f);

    [Header("TRZ Volume")]
    public Vector3 trzCenterWorld = new Vector3(60f, 0f, 60f);
    public float trzRadius = 35f;
    public float trzHeight = 120f; // 0m to regulatory ceiling
    public int trzSegments = 32;
    public Color trzColorNormal = new Color(1f, 0f, 0f, 0.18f);
    public Color trzColorAlert = new Color(1f, 0.05f, 0.05f, 0.55f);
    public float pulseSpeed = 4f;

    Material _trzMaterial;
    MeshRenderer _trzRenderer;
    bool _alertPulsing;

    void Start()
    {
        BuildCityGrid();
        BuildTrzVolume();
    }

    void Update()
    {
        if (_alertPulsing && _trzMaterial != null)
        {
            float t = (Mathf.Sin(Time.time * pulseSpeed) + 1f) * 0.5f;
            _trzMaterial.color = Color.Lerp(trzColorNormal, trzColorAlert, t);
        }
    }

    /// <summary>Call from a trigger/breach check to visually escalate the TRZ.</summary>
    public void SetAlertPulsing(bool active)
    {
        _alertPulsing = active;
        if (!active && _trzMaterial != null) _trzMaterial.color = trzColorNormal;
    }

    void BuildCityGrid()
    {
        var root = new GameObject("ProceduralCity").transform;
        root.SetParent(transform, false);

        Material buildingMat = CreateUnlitMaterial(buildingColor);
        Material helipadMat = CreateUnlitMaterial(helipadColor);

        float originOffsetX = -(gridSizeX * cellSize) * 0.5f;
        float originOffsetZ = -(gridSizeZ * cellSize) * 0.5f;

        for (int gx = 0; gx < gridSizeX; gx++)
        {
            for (int gz = 0; gz < gridSizeZ; gz++)
            {
                if (Random.value > buildingDensity) continue;

                float height = Random.Range(minBuildingHeight, maxBuildingHeight);
                float footprint = cellSize * Random.Range(0.55f, 0.85f);

                Vector3 pos = new Vector3(
                    originOffsetX + gx * cellSize + cellSize * 0.5f,
                    height * 0.5f,
                    originOffsetZ + gz * cellSize + cellSize * 0.5f);

                GameObject building = GameObject.CreatePrimitive(PrimitiveType.Cube);
                building.name = $"Building_{gx}_{gz}";
                building.transform.SetParent(root, false);
                building.transform.position = pos;
                building.transform.localScale = new Vector3(footprint, height, footprint);
                building.GetComponent<Renderer>().sharedMaterial = buildingMat;

                AddWireframeEdges(building.transform, footprint, height);

                if (Random.value > 0.6f)
                {
                    GameObject pad = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                    pad.name = "Helipad";
                    pad.transform.SetParent(building.transform.parent, false);
                    pad.transform.position = pos + Vector3.up * (height * 0.5f + 0.05f);
                    pad.transform.localScale = new Vector3(footprint * 0.4f, 0.05f, footprint * 0.4f);
                    pad.GetComponent<Renderer>().sharedMaterial = helipadMat;
                }
            }
        }
    }

    void AddWireframeEdges(Transform buildingTransform, float footprint, float height)
    {
        // Lightweight edge highlight using a slightly larger wireframe-colored line renderer box outline.
        GameObject wire = new GameObject("EdgeWire");
        wire.transform.SetParent(buildingTransform, false);
        var lr = wire.AddComponent<LineRenderer>();
        lr.useWorldSpace = false;
        lr.loop = false;
        lr.widthMultiplier = 0.03f;
        lr.material = CreateUnlitMaterial(wireframeColor);
        lr.positionCount = 10;

        float hx = 0.5f, hy = 0.5f, hz = 0.5f;
        Vector3[] pts = new Vector3[]
        {
            new Vector3(-hx, -hy, -hz), new Vector3(hx, -hy, -hz),
            new Vector3(hx, -hy, hz), new Vector3(-hx, -hy, hz),
            new Vector3(-hx, -hy, -hz), new Vector3(-hx, hy, -hz),
            new Vector3(hx, hy, -hz), new Vector3(hx, hy, hz),
            new Vector3(-hx, hy, hz), new Vector3(-hx, hy, -hz)
        };
        lr.SetPositions(pts);
    }

    void BuildTrzVolume()
    {
        GameObject trzObj = new GameObject("TRZ_RestrictedVolume");
        trzObj.transform.SetParent(transform, false);
        trzObj.transform.position = new Vector3(trzCenterWorld.x, trzHeight * 0.5f, trzCenterWorld.z);

        MeshFilter mf = trzObj.AddComponent<MeshFilter>();
        _trzRenderer = trzObj.AddComponent<MeshRenderer>();

        mf.sharedMesh = BuildCylinderMesh(trzRadius, trzHeight, trzSegments);

        _trzMaterial = CreateUnlitMaterial(trzColorNormal);
        _trzMaterial.SetFloat("_Surface", 1); // URP unlit transparent surface flag (if using URP Lit/Unlit shader graph conventions)
        _trzRenderer.sharedMaterial = _trzMaterial;

        // No collider by default — use a trigger box for breach detection so it doesn't obstruct flight physics.
        BoxCollider trigger = trzObj.AddComponent<BoxCollider>();
        trigger.isTrigger = true;
        trigger.size = new Vector3(trzRadius * 2f, trzHeight, trzRadius * 2f);
    }

    static Mesh BuildCylinderMesh(float radius, float height, int segments)
    {
        Mesh mesh = new Mesh { name = "TRZCylinder" };
        int vertCount = (segments + 1) * 2;
        Vector3[] vertices = new Vector3[vertCount];
        int[] triangles = new int[segments * 6];

        for (int i = 0; i <= segments; i++)
        {
            float angle = (float)i / segments * Mathf.PI * 2f;
            float x = Mathf.Cos(angle) * radius;
            float z = Mathf.Sin(angle) * radius;
            vertices[i] = new Vector3(x, -height * 0.5f, z);
            vertices[i + segments + 1] = new Vector3(x, height * 0.5f, z);
        }

        int t = 0;
        for (int i = 0; i < segments; i++)
        {
            int bl = i;
            int br = i + 1;
            int tl = i + segments + 1;
            int tr = i + segments + 2;

            triangles[t++] = bl; triangles[t++] = tl; triangles[t++] = br;
            triangles[t++] = br; triangles[t++] = tl; triangles[t++] = tr;
        }

        mesh.vertices = vertices;
        mesh.triangles = triangles;
        mesh.RecalculateNormals();
        mesh.RecalculateBounds();
        return mesh;
    }

    static Material CreateUnlitMaterial(Color color)
    {
        Shader shader = Shader.Find("Universal Render Pipeline/Unlit");
        if (shader == null) shader = Shader.Find("Unlit/Color");
        if (shader == null) shader = Shader.Find("Sprites/Default"); // last-resort fallback

        Material mat = new Material(shader);
        if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", color);
        if (mat.HasProperty("_Color")) mat.SetColor("_Color", color);

        if (color.a < 1f)
        {
            mat.SetFloat("_Surface", 1f); // 1 = Transparent in URP Lit/Unlit
            mat.SetOverrideTag("RenderType", "Transparent");
            mat.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
            mat.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
            mat.SetInt("_ZWrite", 0);
            mat.DisableKeyword("_ALPHATEST_ON");
            mat.EnableKeyword("_ALPHABLEND_ON");
            mat.renderQueue = (int)UnityEngine.Rendering.RenderQueue.Transparent;
        }
        return mat;
    }
}

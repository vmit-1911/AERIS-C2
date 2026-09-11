using UnityEngine;

/// <summary>
/// Converts Unity world-space transform coordinates into WGS-84 geographic
/// coordinates (lat/lon/alt) using a local flat-earth approximation anchored
/// at a configurable origin. Accurate enough for airspace ranges of a few km.
/// </summary>
public class GeoSpatialBridge : MonoBehaviour
{
    [Header("Origin Anchor (maps to Vector3.zero)")]
    public double baseLatitude = 13.062500;
    public double baseLongitude = 80.275000;
    public double baseElevationAmsl = 0.0;

    // Standard degree-to-meter approximations.
    const double MetersPerDegreeLat = 111139.0;

    double _lonPerMeter;

    public struct GeoCoordinate
    {
        public double lat;
        public double lon;
        public double altAmsl;
    }

    void Awake()
    {
        RecomputeProjectionConstants();
    }

    void RecomputeProjectionConstants()
    {
        double lonMetersPerDegree = MetersPerDegreeLat * System.Math.Cos(baseLatitude * System.Math.PI / 180.0);
        _lonPerMeter = 1.0 / lonMetersPerDegree;
    }

    /// <summary>
    /// Convert a Unity world position into WGS-84 lat/lon/alt.
    /// Unity +Z (north) drives latitude, +X (east) drives longitude, +Y is altitude AMSL.
    /// </summary>
    public GeoCoordinate WorldToGeo(Vector3 worldPos)
    {
        double latPerMeter = 1.0 / MetersPerDegreeLat;

        GeoCoordinate geo;
        geo.lat = baseLatitude + (worldPos.z * latPerMeter);
        geo.lon = baseLongitude + (worldPos.x * _lonPerMeter);
        geo.altAmsl = baseElevationAmsl + worldPos.y;
        return geo;
    }

    /// <summary>Inverse transform: geographic coordinate back to Unity world space.</summary>
    public Vector3 GeoToWorld(double lat, double lon, double altAmsl)
    {
        double latPerMeter = 1.0 / MetersPerDegreeLat;
        float z = (float)((lat - baseLatitude) / latPerMeter);
        float x = (float)((lon - baseLongitude) / _lonPerMeter);
        float y = (float)(altAmsl - baseElevationAmsl);
        return new Vector3(x, y, z);
    }

#if UNITY_EDITOR
    void OnValidate()
    {
        RecomputeProjectionConstants();
    }
#endif
}

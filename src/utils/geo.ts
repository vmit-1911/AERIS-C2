import { GeoJSONGeometry, Track } from '../types';

/**
 * Converts GeoJSON Polygon coordinates [[lng, lat], ...] to Leaflet [[lat, lng], ...]
 */
export function geoJsonToLeafletLatLngs(geometry: GeoJSONGeometry): [number, number][] {
  if (!geometry || !geometry.coordinates || !geometry.coordinates[0]) {
    return [];
  }
  return geometry.coordinates[0].map((coord) => [coord[1], coord[0]]);
}

/**
 * Converts array of Leaflet [lat, lng] points to a closed GeoJSON Polygon geometry
 */
export function leafletLatLngsToGeoJson(points: [number, number][]): GeoJSONGeometry {
  if (points.length < 3) {
    throw new Error('Polygon must contain at least 3 points.');
  }
  const ring: number[][] = points.map(([lat, lng]) => [lng, lat]);
  // Close the ring if not already closed
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }
  return {
    type: 'Polygon',
    coordinates: [ring],
  };
}

/**
 * Calculates bounding box of all active tracks
 */
export function calculateTrackBounds(tracks: Track[]): [[number, number], [number, number]] | null {
  if (!tracks || tracks.length === 0) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const t of tracks) {
    if (typeof t.latitude === 'number' && typeof t.longitude === 'number') {
      minLat = Math.min(minLat, t.latitude);
      maxLat = Math.max(maxLat, t.latitude);
      minLng = Math.min(minLng, t.longitude);
      maxLng = Math.max(maxLng, t.longitude);
    }
  }

  if (minLat === Infinity) return null;

  // Add small padding
  const latPad = Math.max(0.005, (maxLat - minLat) * 0.15);
  const lngPad = Math.max(0.005, (maxLng - minLng) * 0.15);

  return [
    [minLat - latPad, minLng - lngPad],
    [maxLat + latPad, maxLng + lngPad],
  ];
}

/**
 * Formats coordinates for tactical display
 */
export function formatCoordinates(lat: number, lng: number): string {
  if (typeof lat !== 'number' || typeof lng !== 'number') return '--, --';
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(5)}° ${latDir}, ${Math.abs(lng).toFixed(5)}° ${lngDir}`;
}

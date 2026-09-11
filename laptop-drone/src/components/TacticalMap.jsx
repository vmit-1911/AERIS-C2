import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, Radio, MapPin, Crosshair, Layers, Trash2 } from 'lucide-react';

// Custom Map Controller to smoothly pan with drone
function MapUpdater({ center, autoCenter }) {
  const map = useMap();
  useEffect(() => {
    if (autoCenter && center && center[0] && center[1]) {
      map.panTo(center, { animate: true, duration: 0.5 });
    }
  }, [center, autoCenter, map]);
  return null;
}

/**
 * Tactical Geographic Map & Radar Tracking Display
 */
export default function TacticalMap({ 
  telemetry, 
  onSendWaypoint 
}) {
  const [autoCenter, setAutoCenter] = useState(true);
  const [trail, setTrail] = useState([]);
  const [mapType, setMapType] = useState('dark'); // 'dark' or 'satellite'
  const maxTrailLength = 150;

  const lat = telemetry?.lat || 13.0625;
  const lon = telemetry?.lon || 80.2750;
  const heading = telemetry?.heading_deg || 0;
  const alt = telemetry?.alt_geo_m || 60.0;
  const uasId = telemetry?.uas_id || 'UIN-IND-2026-X89';
  const pilotLat = telemetry?.operator_location?.lat || 13.0600;
  const pilotLon = telemetry?.operator_location?.lon || 80.2720;
  const isCeilingBreached = alt > 120.0;
  const isDark = telemetry?.transmission_state === 'SILENT_DARK';

  // Append positions to flight trail
  useEffect(() => {
    if (lat && lon) {
      setTrail(prev => {
        const last = prev[prev.length - 1];
        if (!last || Math.abs(last[0] - lat) > 0.00005 || Math.abs(last[1] - lon) > 0.00005) {
          const newTrail = [...prev, [lat, lon, alt]];
          return newTrail.slice(-maxTrailLength);
        }
        return prev;
      });
    }
  }, [lat, lon, alt]);

  // Create Custom Tactical Drone Icon with dynamic rotation
  const createDroneIcon = (deg, breached, dark) => {
    const strokeColor = dark ? '#b5179e' : breached ? '#ff2a5f' : '#00ffcc';
    const fillColor = dark ? '#2a0845' : breached ? '#550a1a' : '#0a2228';
    
    return L.divIcon({
      className: 'tactical-drone-marker',
      html: `
        <div style="transform: rotate(${deg}deg); transition: transform 0.2s ease-out;" class="relative flex items-center justify-center w-10 h-10">
          <!-- Heading Vector Cone -->
          <div style="position: absolute; top: -20px; width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-bottom: 24px solid ${strokeColor}44;"></div>
          <!-- Drone Glyph -->
          <svg width="34" height="34" viewBox="0 0 24 24" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 6px ${strokeColor});">
            <polygon points="12 2 19 21 12 17 5 21 12 2"/>
          </svg>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
  };

  // Custom Operator / Pilot GCS Icon
  const pilotIcon = L.divIcon({
    className: 'tactical-pilot-marker',
    html: `
      <div class="relative flex items-center justify-center w-8 h-8">
        <div class="absolute w-7 h-7 rounded-full bg-amber-400/20 animate-ping-slow"></div>
        <div class="w-6 h-6 rounded-full bg-tactical-900 border-2 border-amber-400 flex items-center justify-center shadow-amber-glow">
          <div class="w-2 h-2 rounded-full bg-amber-400"></div>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  const clearTrail = () => setTrail([]);

  return (
    <div className="relative w-full h-full flex flex-col rounded-xl border border-tactical-700 bg-tactical-950 overflow-hidden shadow-2xl">
      {/* Tactical Top Bar */}
      <div className="absolute top-2 left-3 right-3 z-[1000] flex items-center justify-between pointer-events-none">
        <div className="flex items-center space-x-2 bg-tactical-900/90 border border-tactical-700 px-3 py-1.5 rounded-lg shadow-lg pointer-events-auto backdrop-blur-md">
          <div className={`w-2.5 h-2.5 rounded-full ${isDark ? 'bg-cyber-purple' : isCeilingBreached ? 'bg-cyber-red' : 'bg-cyber-cyan'} animate-pulse`}></div>
          <span className="text-xs font-bold text-slate-200 font-orbitron tracking-wider">
            RADAR GEO-TRACK
          </span>
          <span className="text-[11px] text-cyber-cyan font-mono border-l border-tactical-700 pl-2">
            CHENNAI AIRSPACE
          </span>
        </div>

        {/* Map Control Buttons */}
        <div className="flex items-center space-x-1.5 pointer-events-auto">
          <button
            onClick={() => setAutoCenter(!autoCenter)}
            className={`px-2.5 py-1 text-xs rounded border transition-all flex items-center space-x-1 shadow-md ${autoCenter ? 'bg-cyber-cyan/20 border-cyber-cyan text-cyber-cyan font-bold' : 'bg-tactical-900/90 border-tactical-700 text-slate-400'}`}
            title="Auto-center map on drone position"
          >
            <Crosshair size={13} />
            <span>{autoCenter ? 'LOCK CAM' : 'FREE CAM'}</span>
          </button>

          <button
            onClick={() => setMapType(prev => prev === 'dark' ? 'satellite' : 'dark')}
            className="px-2.5 py-1 text-xs rounded border border-tactical-700 bg-tactical-900/90 hover:bg-tactical-800 text-slate-300 transition-all flex items-center space-x-1 shadow-md"
            title="Toggle Map Style"
          >
            <Layers size={13} />
            <span>{mapType === 'dark' ? 'DARK TILES' : 'SATELLITE'}</span>
          </button>

          <button
            onClick={clearTrail}
            className="p-1.5 text-xs rounded border border-tactical-700 bg-tactical-900/90 hover:bg-tactical-800 text-slate-400 hover:text-cyber-red transition-all shadow-md"
            title="Clear Flight Trail Breadcrumbs"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Leaflet Map Component */}
      <div className="w-full h-full min-h-[320px]">
        <MapContainer
          center={[lat, lon]}
          zoom={15}
          scrollWheelZoom={true}
          zoomControl={false}
          className="w-full h-full"
        >
          <MapUpdater center={[lat, lon]} autoCenter={autoCenter} />

          {/* CartoDB Dark Matter or Satellite Tiles */}
          {mapType === 'dark' ? (
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              className="tactical-map-tiles"
            />
          ) : (
            <TileLayer
              attribution='&copy; ESRI'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          )}

          {/* Regulatory 120m Ceiling Buffer Circle around GCS */}
          <Circle
            center={[pilotLat, pilotLon]}
            radius={2500}
            pathOptions={{
              color: '#00ffcc',
              fillColor: '#00ffcc',
              fillOpacity: 0.04,
              dashArray: '4, 8',
              weight: 1.5
            }}
          />

          {/* Pilot GCS Station Marker */}
          <Marker position={[pilotLat, pilotLon]} icon={pilotIcon}>
            <Popup className="tactical-popup">
              <div className="font-mono text-xs text-slate-900 p-1">
                <div className="font-bold text-amber-700">PILOT GCS OPERATOR</div>
                <div>ID: {telemetry?.operator_id || 'OP-IND-TN-9821'}</div>
                <div>Loc: {pilotLat.toFixed(4)}, {pilotLon.toFixed(4)}</div>
              </div>
            </Popup>
          </Marker>

          {/* Range Link Line from Pilot to Drone */}
          <Polyline
            positions={[[pilotLat, pilotLon], [lat, lon]]}
            pathOptions={{
              color: isDark ? '#b5179e' : '#00ffcc',
              weight: 1.5,
              dashArray: '3, 6',
              opacity: 0.7
            }}
          />

          {/* Flight Path Breadcrumb Trail */}
          {trail.length > 1 && (
            <Polyline
              positions={trail.map(p => [p[0], p[1]])}
              pathOptions={{
                color: isCeilingBreached ? '#ff2a5f' : '#00ffcc',
                weight: 3,
                opacity: 0.8
              }}
            />
          )}

          {/* Active Drone Marker */}
          <Marker position={[lat, lon]} icon={createDroneIcon(heading, isCeilingBreached, isDark)}>
            <Popup className="tactical-popup">
              <div className="font-mono text-xs text-slate-900 p-1">
                <div className="font-bold text-cyan-800">{uasId}</div>
                <div>Alt: {alt.toFixed(1)}m {isCeilingBreached ? '(CEILING BREACH)' : ''}</div>
                <div>Speed: {(telemetry?.speed_horizontal_mps || 0).toFixed(1)} m/s</div>
                <div>Hdg: {Math.round(heading)}°</div>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      {/* Bottom Map Status Readouts */}
      <div className="absolute bottom-2 left-3 right-3 z-[1000] flex items-center justify-between text-[11px] font-mono bg-tactical-950/90 border border-tactical-700/80 px-3 py-1.5 rounded-lg text-slate-300 pointer-events-none backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <span>LAT: <strong className="text-cyber-cyan">{lat.toFixed(6)}</strong></span>
          <span>LON: <strong className="text-cyber-cyan">{lon.toFixed(6)}</strong></span>
          <span>ALT: <strong className={isCeilingBreached ? 'text-cyber-red' : 'text-cyber-cyan'}>{alt.toFixed(1)}m</strong></span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-slate-400">TRAIL PTS: {trail.length}</span>
          <div className="w-2 h-2 rounded-full bg-cyber-green"></div>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, Radio, MapPin, Crosshair, Layers, Trash2, Target } from 'lucide-react';

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

// Click handler to deploy direct waypoints
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    }
  });
  return null;
}

/**
 * Tactical Geographic Radar Map & Flight Track Visualizer
 */
export default function TacticalMap({ 
  telemetry, 
  onSendWaypoint 
}) {
  const [autoCenter, setAutoCenter] = useState(true);
  const [trail, setTrail] = useState([]);
  const [mapType, setMapType] = useState('dark'); // 'dark' or 'satellite'
  const [waypointNotice, setWaypointNotice] = useState(null);
  const maxTrailLength = 180;

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
        if (!last || Math.abs(last[0] - lat) > 0.00004 || Math.abs(last[1] - lon) > 0.00004) {
          const newTrail = [...prev, [lat, lon, alt]];
          return newTrail.slice(-maxTrailLength);
        }
        return prev;
      });
    }
  }, [lat, lon, alt]);

  // Click-to-Waypoint handler
  const handleMapClick = (clickLat, clickLon) => {
    if (onSendWaypoint) {
      onSendWaypoint(clickLat, clickLon);
      setWaypointNotice({
        lat: clickLat.toFixed(5),
        lon: clickLon.toFixed(5),
        time: new Date().toLocaleTimeString()
      });
      setTimeout(() => setWaypointNotice(null), 3500);
    }
  };

  // Custom Tactical Drone Icon
  const createDroneIcon = (deg, breached, dark) => {
    const strokeColor = dark ? '#a855f7' : breached ? '#ff2e63' : '#00f0ff';
    const fillColor = dark ? '#2a0845' : breached ? '#4a0d18' : '#06202c';
    
    return L.divIcon({
      className: 'tactical-drone-marker',
      html: `
        <div style="transform: rotate(${deg}deg); transition: transform 0.2s ease-out;" class="relative flex items-center justify-center w-11 h-11">
          <div style="position: absolute; top: -22px; width: 0; height: 0; border-left: 9px solid transparent; border-right: 9px solid transparent; border-bottom: 26px solid ${strokeColor}44;"></div>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 8px ${strokeColor});">
            <polygon points="12 2 19 21 12 17 5 21 12 2"/>
          </svg>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });
  };

  // Custom GCS Pilot Station Icon
  const pilotIcon = L.divIcon({
    className: 'tactical-pilot-marker',
    html: `
      <div class="relative flex items-center justify-center w-9 h-9">
        <div class="absolute w-8 h-8 rounded-full bg-amber-400/25 animate-beacon-ping"></div>
        <div class="w-7 h-7 rounded-full bg-tactical-950 border-2 border-amber-400 flex items-center justify-center shadow-amber-glow">
          <div class="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });

  const clearTrail = () => setTrail([]);

  return (
    <div className="relative w-full h-full min-h-[360px] flex flex-col rounded-xl border border-tactical-700/80 bg-tactical-950 glass-panel tactical-bracket overflow-hidden shadow-2xl">
      {/* Tactical Top Bar */}
      <div className="absolute top-2.5 left-3 right-3 z-[1000] flex items-center justify-between pointer-events-none">
        <div className="flex items-center space-x-2.5 bg-tactical-950/90 border border-tactical-700/80 px-3 py-1.5 rounded-lg shadow-xl pointer-events-auto backdrop-blur-md">
          <div className={`w-2.5 h-2.5 rounded-full ${isDark ? 'bg-cyber-purple' : isCeilingBreached ? 'bg-cyber-red' : 'bg-cyber-cyan'} animate-pulse shadow-cyan-glow`}></div>
          <span className="text-xs font-bold text-slate-100 font-orbitron tracking-wider">
            RADAR GEO-TRACK
          </span>
          <span className="text-[11px] text-cyber-cyan font-mono border-l border-tactical-700 pl-2">
            CHENNAI SEC-4
          </span>
        </div>

        {/* Map Controls */}
        <div className="flex items-center space-x-1.5 pointer-events-auto">
          <button
            onClick={() => setAutoCenter(!autoCenter)}
            className={`px-2.5 py-1 text-xs rounded-lg border transition-all flex items-center space-x-1.5 shadow-md font-orbitron ${
              autoCenter 
                ? 'bg-cyber-cyan/20 border-cyber-cyan text-cyber-cyan font-bold shadow-cyan-glow' 
                : 'bg-tactical-900/90 border-tactical-700 text-slate-400'
            }`}
            title="Auto-center map on drone position"
          >
            <Crosshair size={13} />
            <span>{autoCenter ? 'LOCK CAM' : 'FREE CAM'}</span>
          </button>

          <button
            onClick={() => setMapType(prev => prev === 'dark' ? 'satellite' : 'dark')}
            className="px-2.5 py-1 text-xs rounded-lg border border-tactical-700 bg-tactical-900/90 hover:bg-tactical-800 text-slate-200 transition-all flex items-center space-x-1.5 shadow-md font-orbitron"
            title="Toggle Map Style"
          >
            <Layers size={13} />
            <span>{mapType === 'dark' ? 'DARK RADAR' : 'SATELLITE'}</span>
          </button>

          <button
            onClick={clearTrail}
            className="p-1.5 text-xs rounded-lg border border-tactical-700 bg-tactical-900/90 hover:bg-tactical-800 text-slate-400 hover:text-cyber-red transition-all shadow-md"
            title="Clear Flight Trail Breadcrumbs"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Leaflet Map Engine */}
      <div className="w-full h-full min-h-[320px]">
        <MapContainer
          center={[lat, lon]}
          zoom={15}
          scrollWheelZoom={true}
          zoomControl={false}
          className="w-full h-full"
        >
          <MapUpdater center={[lat, lon]} autoCenter={autoCenter} />
          <MapClickHandler onMapClick={handleMapClick} />

          {/* Map Layer */}
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

          {/* 120m DGCA Regulatory Perimeter */}
          <Circle
            center={[pilotLat, pilotLon]}
            radius={2500}
            pathOptions={{
              color: '#00f0ff',
              fillColor: '#00f0ff',
              fillOpacity: 0.03,
              dashArray: '5, 8',
              weight: 1.5
            }}
          />

          {/* GCS Pilot Station Marker */}
          <Marker position={[pilotLat, pilotLon]} icon={pilotIcon}>
            <Popup className="tactical-popup">
              <div className="font-mono text-xs p-1">
                <div className="font-bold text-cyber-amber font-orbitron">GCS PILOT OPERATOR</div>
                <div className="text-slate-300">ID: {telemetry?.operator_id || 'OP-IND-TN-9821'}</div>
                <div className="text-slate-400">LOC: {pilotLat.toFixed(5)}, {pilotLon.toFixed(5)}</div>
              </div>
            </Popup>
          </Marker>

          {/* Pilot to Drone Range Link Line */}
          <Polyline
            positions={[[pilotLat, pilotLon], [lat, lon]]}
            pathOptions={{
              color: isDark ? '#a855f7' : '#00f0ff',
              weight: 1.8,
              dashArray: '4, 6',
              opacity: 0.75
            }}
          />

          {/* Flight Path Breadcrumb Trail */}
          {trail.length > 1 && (
            <Polyline
              positions={trail.map(p => [p[0], p[1]])}
              pathOptions={{
                color: isCeilingBreached ? '#ff2e63' : '#00f0ff',
                weight: 3.5,
                opacity: 0.85
              }}
            />
          )}

          {/* Active Drone Marker */}
          <Marker position={[lat, lon]} icon={createDroneIcon(heading, isCeilingBreached, isDark)}>
            <Popup className="tactical-popup">
              <div className="font-mono text-xs p-1">
                <div className="font-bold text-cyber-cyan font-orbitron">{uasId}</div>
                <div className="text-slate-200">ALT: {alt.toFixed(1)}m {isCeilingBreached ? '(CEILING BREACH)' : ''}</div>
                <div className="text-slate-300">SPEED: {(telemetry?.speed_horizontal_mps || 0).toFixed(1)} m/s</div>
                <div className="text-cyber-green font-bold">HDG: {Math.round(heading)}°</div>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      {/* Real-time Waypoint Feedback Alert */}
      {waypointNotice && (
        <div className="absolute top-14 left-3 right-3 z-[1000] p-2 rounded-lg bg-tactical-950/95 border border-cyber-cyan text-cyber-cyan text-xs flex items-center justify-between shadow-cyan-glow animate-fadeIn pointer-events-none">
          <div className="flex items-center space-x-2">
            <Target size={15} className="animate-spin" style={{ animationDuration: '4s' }} />
            <span>NEW WAYPOINT DISPATCHED: <strong>{waypointNotice.lat}, {waypointNotice.lon}</strong></span>
          </div>
          <span className="text-[10px] text-slate-400">{waypointNotice.time}</span>
        </div>
      )}

      {/* Bottom Map Telemetry Rail */}
      <div className="absolute bottom-2.5 left-3 right-3 z-[1000] flex items-center justify-between text-[11px] font-mono bg-tactical-950/90 border border-tactical-700/80 px-3.5 py-1.5 rounded-lg text-slate-300 pointer-events-none backdrop-blur-md">
        <div className="flex items-center space-x-3.5">
          <span>LAT: <strong className="text-cyber-cyan">{lat.toFixed(6)}</strong></span>
          <span>LON: <strong className="text-cyber-cyan">{lon.toFixed(6)}</strong></span>
          <span>ALT: <strong className={isCeilingBreached ? 'text-cyber-red font-bold' : 'text-cyber-cyan'}>{alt.toFixed(1)}m</strong></span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-slate-400">TRAIL NODES: {trail.length}</span>
          <div className="w-2 h-2 rounded-full bg-cyber-green shadow-green-glow"></div>
        </div>
      </div>
    </div>
  );
}

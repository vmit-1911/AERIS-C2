import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { Eye, Navigation, Compass, Layers, ShieldAlert, Crosshair, Sparkles } from 'lucide-react';
import TrzDrawer from './TrzDrawer';

export default function TacticalMap({
  activeTracks,
  activeTrzs,
  baseZones,
  onCenterTarget,
  selectedTargetId,
  onCreateTrz,
  cameraMode = 'FREE_TACTICAL', // FREE_TACTICAL | FOLLOW_TARGET | FPV_CHASE
  setCameraMode
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  // References for smooth 60 FPS lerp state
  const targetStatesRef = useRef({}); // uas_id -> { current, target, markerObj }
  const animationFrameRef = useRef(null);
  const isDrawModeRef = useRef(false);

  const [isDrawMode, setIsDrawMode] = useState(false);
  const [drawPoints, setDrawPoints] = useState([]);
  const [pitch3D, setPitch3D] = useState(60);
  const [followTargetId, setFollowTargetId] = useState(selectedTargetId || null);

  useEffect(() => {
    isDrawModeRef.current = isDrawMode;
  }, [isDrawMode]);

  useEffect(() => {
    if (selectedTargetId) {
      setFollowTargetId(selectedTargetId);
    }
  }, [selectedTargetId]);

  // 1. Initialize MapLibre GL JS Map Instance
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const mapStyle = {
      version: 8,
      sources: {
        'esri-dark': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors &copy; Esri'
        },
        'osm-standard': {
          type: 'raster',
          tiles: [
            'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors'
        }
      },
      layers: [
        {
          id: 'base-map-layer',
          type: 'raster',
          source: 'osm-standard',
          minzoom: 0,
          maxzoom: 19
        }
      ]
    };

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: [80.01686, 13.02685], // Saveetha Engineering College Campus, Chennai
      zoom: 15.5,
      pitch: 60,
      bearing: -15,
      maxPitch: 85,
      antialias: true,
      touchZoomRotate: true,
      touchPitch: true
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

    map.on('load', () => {
      mapRef.current = map;

      // 3D Extruded Buildings Layer
      map.addSource('3d-buildings-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: generateDetailed3DBuildings([80.2730, 13.0610])
        }
      });

      map.addLayer({
        id: '3d-buildings-layer',
        type: 'fill-extrusion',
        source: '3d-buildings-source',
        paint: {
          'fill-extrusion-color': [
            'case',
            ['boolean', ['get', 'isCommandHq'], false], '#00f0ff',
            '#0f172a'
          ],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.85
        }
      });

      // TRZ Drawing Preview Source & Layers
      map.addSource('trz-draw-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'trz-draw-fill',
        type: 'fill',
        source: 'trz-draw-source',
        paint: {
          'fill-color': '#ff003b',
          'fill-opacity': 0.25
        }
      });

      map.addLayer({
        id: 'trz-draw-line',
        type: 'line',
        source: 'trz-draw-source',
        paint: {
          'line-color': '#ff003b',
          'line-width': 3,
          'line-dasharray': [2, 2]
        }
      });

      // DGCA Base Zones Source & Layers
      map.addSource('dgca-base-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'dgca-base-fill',
        type: 'fill',
        source: 'dgca-base-source',
        paint: {
          'fill-color': [
            'match',
            ['get', 'category'],
            'GREEN', 'rgba(0, 240, 255, 0.12)',
            'YELLOW', 'rgba(255, 183, 3, 0.15)',
            'RED', 'rgba(255, 0, 59, 0.25)',
            'rgba(0, 240, 255, 0.1)'
          ],
          'fill-outline-color': [
            'match',
            ['get', 'category'],
            'GREEN', '#00f0ff',
            'YELLOW', '#ffb703',
            'RED', '#ff003b',
            '#00f0ff'
          ]
        }
      });

      // 3D Dynamic Rule 24 TRZ Envelopes
      map.addSource('active-trz-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'active-trz-extrusion',
        type: 'fill-extrusion',
        source: 'active-trz-source',
        paint: {
          'fill-extrusion-color': '#ff003b',
          'fill-extrusion-height': ['get', 'ceiling_m'],
          'fill-extrusion-base': ['get', 'floor_m'],
          'fill-extrusion-opacity': 0.4
        }
      });

      map.addLayer({
        id: 'active-trz-line',
        type: 'line',
        source: 'active-trz-source',
        paint: {
          'line-color': '#ff003b',
          'line-width': 3.5
        }
      });

      // Dynamic Flight Breadcrumb Trails
      map.addSource('breadcrumbs-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'breadcrumbs-line',
        type: 'line',
        source: 'breadcrumbs-source',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 3.5,
          'line-opacity': 0.9
        }
      });
    });

    // Handle Map Clicks for TRZ Polygon Drawing
    map.on('click', (e) => {
      if (mapRef.current && isDrawModeRef.current) {
        setDrawPoints(prev => [...prev, e.lngLat]);
      }
    });

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      map.remove();
    };
  }, []);

  // Helper to safely fetch source after style is loaded
  const getMapSource = (sourceId) => {
    const map = mapRef.current;
    if (!map) return null;
    try {
      if (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded()) {
        return null;
      }
      return map.getSource(sourceId);
    } catch (e) {
      return null;
    }
  };

  // 2. Sync Base Zones & Active TRZs
  useEffect(() => {
    if (!baseZones) return;
    const source = getMapSource('dgca-base-source');
    if (source) {
      const features = baseZones.map(bz => ({
        type: 'Feature',
        properties: { category: bz.category, name: bz.name },
        geometry: { type: 'Polygon', coordinates: [bz.coordinates] }
      }));
      source.setData({ type: 'FeatureCollection', features });
    }
  }, [baseZones]);

  useEffect(() => {
    if (!activeTrzs) return;
    const source = getMapSource('active-trz-source');
    if (source) {
      const features = activeTrzs.map(trz => ({
        type: 'Feature',
        properties: {
          zone_id: trz.zone_id,
          ceiling_m: trz.ceiling_m,
          floor_m: trz.floor_m,
          name: trz.name
        },
        geometry: { type: 'Polygon', coordinates: [trz.coordinates] }
      }));
      source.setData({ type: 'FeatureCollection', features });
    }
  }, [activeTrzs]);

  // 3. Sync Draw Preview
  useEffect(() => {
    const source = getMapSource('trz-draw-source');
    if (source) {
      if (drawPoints.length === 0) {
        source.setData({ type: 'FeatureCollection', features: [] });
      } else if (drawPoints.length === 1) {
        source.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [drawPoints[0].lng, drawPoints[0].lat] }
          }]
        });
      } else {
        const coords = drawPoints.map(p => [p.lng, p.lat]);
        if (coords.length >= 3) coords.push(coords[0]);
        source.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: {
              type: coords.length >= 4 ? 'Polygon' : 'LineString',
              coordinates: coords.length >= 4 ? [coords] : coords
            }
          }]
        });
      }
    }
  }, [drawPoints]);

  // 4. Update Target Trajectories & Initialize 3D Marker Elements
  useEffect(() => {
    if (!mapRef.current || !activeTracks) return;

    const map = mapRef.current;
    const activeIds = new Set();
    const breadcrumbFeatures = [];

    activeTracks.forEach(track => {
      const tel = track.telemetry;
      const uasId = tel.uas_id;
      activeIds.add(uasId);

      const isBreaching = track.status !== 'AUTHORISED';
      const color = isBreaching ? '#ff003b' : '#00f0ff';

      // Breadcrumb lines
      if (track.breadcrumbs && track.breadcrumbs.length > 1) {
        breadcrumbFeatures.push({
          type: 'Feature',
          properties: { uas_id: uasId, color: color },
          geometry: {
            type: 'LineString',
            coordinates: track.breadcrumbs.map(b => [b.lon, b.lat])
          }
        });
      }

      // Initialize or update lerp targets
      if (!targetStatesRef.current[uasId]) {
        // Create 3D Drop Stem & Chevron Marker Element
        const container = document.createElement('div');
        container.className = 'uas-3d-container relative flex flex-col items-center justify-end pointer-events-auto';
        container.style.width = '64px';
        container.style.height = '140px';

        container.innerHTML = `
          <!-- Ground Target Shadow Disc -->
          <div class="ground-shadow w-8 h-3 rounded-full ${isBreaching ? 'bg-red-500/40 border border-red-500/80 animate-ping' : 'bg-cyan-500/30 border border-cyan-400/60'}" style="transform: perspective(100px) rotateX(60deg);"></div>
          
          <!-- 3D Altitude Drop Line / Stem -->
          <div class="alt-stem w-0.5 bg-gradient-to-t ${isBreaching ? 'from-red-500 via-red-400 to-transparent' : 'from-cyan-400 via-cyan-300 to-transparent'} my-1 flex items-center justify-center relative" style="height: 60px;">
            <span class="alt-badge absolute left-2 bg-[#0f172a]/95 text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-700 font-bold whitespace-nowrap shadow-lg" style="color: ${color}">
              ${tel.alt_m.toFixed(0)}m AMSL
            </span>
          </div>

          <!-- 3D Aircraft Aircraft Icon Header -->
          <div class="aircraft-head relative flex items-center justify-center">
            <div class="absolute -inset-1 rounded-full ${isBreaching ? 'bg-red-500/40 animate-ping' : 'bg-cyan-500/20'}"></div>
            <svg class="chevron-svg w-8 h-8 drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]" viewBox="0 0 24 24" fill="${color}">
              <path d="M12 2L2 22l10-4 10 4L12 2z"/>
            </svg>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 35, closeButton: false }).setHTML(`
          <div class="font-mono text-xs text-slate-100 p-1">
            <div class="font-bold border-b border-slate-700 pb-1 mb-1 flex items-center justify-between" style="color: ${color}">
              <span>${uasId}</span>
              <span class="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">${track.status}</span>
            </div>
            <div class="text-[11px] space-y-0.5 text-slate-300">
              <div>ALTITUDE: <b>${tel.alt_m.toFixed(1)}m AMSL</b></div>
              <div>SPEED: <b>${tel.speed_mps.toFixed(1)} m/s</b> (${(tel.speed_mps * 3.6).toFixed(1)} km/h)</div>
              <div>HEADING: <b>${(tel.heading_deg || 0).toFixed(0)}&deg;</b></div>
              <div class="text-[10px] text-slate-400 mt-1">PILOT: ${tel.pilot_lat.toFixed(4)}, ${tel.pilot_lon.toFixed(4)}</div>
            </div>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: container, anchor: 'bottom' })
          .setLngLat([tel.lon, tel.lat])
          .setPopup(popup)
          .addTo(map);

        // Click event on marker to follow
        container.addEventListener('click', () => {
          setFollowTargetId(uasId);
          if (setCameraMode) setCameraMode('FOLLOW_TARGET');
        });

        targetStatesRef.current[uasId] = {
          current: {
            lng: tel.lon,
            lat: tel.lat,
            alt: tel.alt_m,
            heading: tel.heading_deg || 0
          },
          target: {
            lng: tel.lon,
            lat: tel.lat,
            alt: tel.alt_m,
            heading: tel.heading_deg || 0
          },
          marker,
          container,
          color,
          uasId
        };
      } else {
        // Update destination target coordinates for lerp
        const state = targetStatesRef.current[uasId];
        state.target = {
          lng: tel.lon,
          lat: tel.lat,
          alt: tel.alt_m,
          heading: tel.heading_deg || 0
        };
        state.color = color;
      }
    });

    // Clean up markers no longer active
    Object.keys(targetStatesRef.current).forEach(id => {
      if (!activeIds.has(id)) {
        targetStatesRef.current[id].marker.remove();
        delete targetStatesRef.current[id];
      }
    });

    // Update Breadcrumb Source
    const bSource = getMapSource('breadcrumbs-source');
    if (bSource) {
      bSource.setData({ type: 'FeatureCollection', features: breadcrumbFeatures });
    }
  }, [activeTracks]);

  // 5. 60 FPS RequestAnimationFrame Lerp Animation Engine
  useEffect(() => {
    const animate = () => {
      const map = mapRef.current;
      if (map) {
        Object.keys(targetStatesRef.current).forEach(uasId => {
          const item = targetStatesRef.current[uasId];
          const { current, target, marker, container, color } = item;

          // Lerp factor
          const factor = 0.12;
          current.lng += (target.lng - current.lng) * factor;
          current.lat += (target.lat - current.lat) * factor;
          current.alt += (target.alt - current.alt) * factor;

          // Shortest angle rotation lerp
          let diffH = (target.heading - current.heading) % 360;
          if (diffH > 180) diffH -= 360;
          if (diffH < -180) diffH += 360;
          current.heading += diffH * factor;

          // Update marker position
          marker.setLngLat([current.lng, current.lat]);

          // Update stem height dynamically scaled with altitude
          const stemEl = container.querySelector('.alt-stem');
          const badgeEl = container.querySelector('.alt-badge');
          const svgEl = container.querySelector('.chevron-svg');

          if (stemEl) {
            const pixelStemHeight = Math.min(120, Math.max(20, current.alt * 0.6));
            stemEl.style.height = `${pixelStemHeight}px`;
          }
          if (badgeEl) {
            badgeEl.innerText = `${current.alt.toFixed(0)}m AMSL`;
          }
          if (svgEl) {
            svgEl.style.transform = `rotate(${current.heading}deg)`;
            svgEl.style.transition = 'transform 0.1s linear';
          }

          // Camera Tracking Mode Updates
          if (followTargetId === uasId) {
            if (cameraMode === 'FOLLOW_TARGET') {
              map.easeTo({
                center: [current.lng, current.lat],
                duration: 100,
                easing: t => t
              });
            } else if (cameraMode === 'FPV_CHASE') {
              map.easeTo({
                center: [current.lng, current.lat],
                bearing: current.heading,
                pitch: 75,
                zoom: 16.5,
                duration: 100,
                easing: t => t
              });
            }
          }
        });
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [followTargetId, cameraMode]);

  // Handle explicit centering prop from parent
  useEffect(() => {
    if (!mapRef.current || !onCenterTarget) return;
    mapRef.current.flyTo({
      center: [onCenterTarget.lon, onCenterTarget.lat],
      zoom: 16.5,
      pitch: 65,
      duration: 1200
    });
  }, [onCenterTarget]);

  // Toggle 2D / 3D Pitch
  const togglePitch = () => {
    if (!mapRef.current) return;
    const newPitch = pitch3D === 0 ? 65 : 0;
    setPitch3D(newPitch);
    mapRef.current.easeTo({ pitch: newPitch, duration: 800 });
  };

  return (
    <div className="relative w-full h-full bg-[#070b14] overflow-hidden select-none">
      {/* MapLibre Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating 3D Tactical Camera Control Toolbar */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 font-mono text-xs">
        <button
          onClick={togglePitch}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border backdrop-blur-md transition-all shadow-lg ${
            pitch3D > 0
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
              : 'bg-[#0f172a]/80 border-slate-700 text-slate-300'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{pitch3D > 0 ? '3D PERSPECTIVE (65°)' : '2D OVERHEAD'}</span>
        </button>

        {setCameraMode && (
          <div className="flex items-center bg-[#0f172a]/90 border border-slate-700 rounded-lg backdrop-blur-md p-0.5 shadow-lg">
            <button
              onClick={() => setCameraMode('FREE_TACTICAL')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                cameraMode === 'FREE_TACTICAL' ? 'bg-cyan-500 text-[#070b14] font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              FREE CAM
            </button>
            <button
              onClick={() => setCameraMode('FOLLOW_TARGET')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                cameraMode === 'FOLLOW_TARGET' ? 'bg-cyan-500 text-[#070b14] font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              TRACK TARGET
            </button>
            <button
              onClick={() => setCameraMode('FPV_CHASE')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                cameraMode === 'FPV_CHASE' ? 'bg-amber-500 text-[#070b14] font-bold animate-pulse' : 'text-slate-300 hover:text-white'
              }`}
            >
              FPV CHASE CAM
            </button>
          </div>
        )}
      </div>

      {/* Interactive TRZ Drawer Toolbar */}
      <TrzDrawer
        isDrawMode={isDrawMode}
        setIsDrawMode={setIsDrawMode}
        drawPoints={drawPoints}
        onClearPoints={() => setDrawPoints([])}
        onCreateTrz={(req) => {
          onCreateTrz(req);
          setIsDrawMode(false);
          setDrawPoints([]);
        }}
      />

      {/* Map Airspace Classification Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-[#0f172a]/90 border border-[#1e293b] p-3 rounded-lg font-mono text-[11px] backdrop-blur-md space-y-1.5 shadow-xl hidden sm:block">
        <div className="font-bold text-slate-300 border-b border-slate-800 pb-1 mb-1 flex items-center justify-between">
          <span>DRONE CLASSIFICATION (DGCA / RULE 24)</span>
          <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.2 rounded">REAL-TIME 3D</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded bg-red-500/80 border border-red-500"></span>
          <span className="text-red-300">Rule 24 Temporary Red Zone (TRZ)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded bg-cyan-500/30 border border-cyan-400"></span>
          <span className="text-cyan-300">Green Civil Zone (&le;120m Unrestricted)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded bg-amber-500/30 border border-amber-400"></span>
          <span className="text-amber-300">Yellow Controlled Corridor (&gt;120m)</span>
        </div>
      </div>
    </div>
  );
}

// Generate Detailed 3D extruded urban & campus buildings around Saveetha Engineering College
function generateDetailed3DBuildings(center) {
  const [clon, clat] = center;
  const features = [];

  // Saveetha Main Command & Administration HQ Tower
  features.push({
    type: 'Feature',
    properties: { height: 95, isCommandHq: true, name: 'SAVEETHA MAIN ACADEMIC COMMAND TOWER' },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [clon - 0.0008, clat - 0.0008],
        [clon + 0.0008, clat - 0.0008],
        [clon + 0.0008, clat + 0.0008],
        [clon - 0.0008, clat + 0.0008],
        [clon - 0.0008, clat - 0.0008]
      ]]
    }
  });

  // Saveetha Convention Center & Auditorium
  features.push({
    type: 'Feature',
    properties: { height: 45, name: 'SAVEETHA CONVENTION CENTER & AUDITORIUM' },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [clon + 0.0020, clat + 0.0010],
        [clon + 0.0035, clat + 0.0010],
        [clon + 0.0035, clat + 0.0022],
        [clon + 0.0020, clat + 0.0022],
        [clon + 0.0020, clat + 0.0010]
      ]]
    }
  });

  // Saveetha Alan Turing IT & CSE Research Block
  features.push({
    type: 'Feature',
    properties: { height: 60, name: 'SAVEETHA ALAN TURING IT & CSE BLOCK' },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [clon - 0.0025, clat + 0.0012],
        [clon - 0.0012, clat + 0.0012],
        [clon - 0.0012, clat + 0.0025],
        [clon - 0.0025, clat + 0.0025],
        [clon - 0.0025, clat + 0.0012]
      ]]
    }
  });

  // Saveetha Aerospace & Robotics Research Lab
  features.push({
    type: 'Feature',
    properties: { height: 50, name: 'SAVEETHA AEROSPACE & ROBOTICS LAB' },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [clon - 0.0020, clat - 0.0022],
        [clon - 0.0008, clat - 0.0022],
        [clon - 0.0008, clat - 0.0010],
        [clon - 0.0020, clat - 0.0010],
        [clon - 0.0020, clat - 0.0022]
      ]]
    }
  });

  // Saveetha Student Hostel & Residential Complex
  features.push({
    type: 'Feature',
    properties: { height: 70, name: 'SAVEETHA HOSTEL COMPLEX TOWERS' },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [clon + 0.0015, clat - 0.0025],
        [clon + 0.0030, clat - 0.0025],
        [clon + 0.0030, clat - 0.0012],
        [clon + 0.0015, clat - 0.0012],
        [clon + 0.0015, clat - 0.0025]
      ]]
    }
  });

  // Surrounding campus sector grid of 3D structures
  for (let i = 0; i < 35; i++) {
    const dx = (Math.random() - 0.5) * 0.025;
    const dy = (Math.random() - 0.5) * 0.025;
    const blon = clon + dx;
    const blat = clat + dy;
    const size = 0.0005 + Math.random() * 0.0007;
    const height = 15 + Math.random() * 55;

    features.push({
      type: 'Feature',
      properties: { height: height, name: `SAVEETHA CAMPUS BUILDING #${i+101}` },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [blon - size, blat - size],
          [blon + size, blat - size],
          [blon + size, blat + size],
          [blon - size, blat + size],
          [blon - size, blat - size]
        ]]
      }
    });
  }

  return features;
}


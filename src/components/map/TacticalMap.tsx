import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Track, Zone, GeoJSONGeometry } from '../../types';
import { getZoneStyle } from '../../utils/formatting';
import { geoJsonToLeafletLatLngs, calculateTrackBounds, leafletLatLngsToGeoJson } from '../../utils/geo';
import { ZoneLegend } from './ZoneLegend';
import { MapControls } from './MapControls';
import { Check, X } from 'lucide-react';

interface TacticalMapProps {
  tracks: Map<string, Track>;
  trails: Map<string, [number, number][]>;
  zones: Zone[];
  selectedDroneId: string | null;
  onSelectDrone: (droneId: string | null) => void;
  followDrone: boolean;
  onToggleFollow: () => void;
  isDrawingMode: boolean;
  onFinishDrawing: (geometry: GeoJSONGeometry) => void;
  onCancelDrawing: () => void;
  isDetailPanelOpen: boolean;

  // Feature 1: Drag & Drop simulation props
  isSimulationMode: boolean;
  onToggleSimulationMode: () => void;
  onSimulatePosition: (trackId: string, lat: number, lng: number) => void;
}

export const TacticalMap: React.FC<TacticalMapProps> = ({
  tracks,
  trails,
  zones,
  selectedDroneId,
  onSelectDrone,
  followDrone,
  onToggleFollow,
  isDrawingMode,
  onFinishDrawing,
  onCancelDrawing,
  isDetailPanelOpen,
  isSimulationMode,
  onToggleSimulationMode,
  onSimulatePosition,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layer cache refs to avoid recreating DOM elements
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const trailsRef = useRef<Map<string, L.Polyline>>(new Map());
  const zonesRef = useRef<Map<string, L.Polygon>>(new Map());
  const hasAutoCenteredRef = useRef<boolean>(false);

  // Ref to hold current props for leaflet event handlers without stale closures
  const simPropsRef = useRef({ isSimulationMode, onSimulatePosition });
  useEffect(() => {
    simPropsRef.current = { isSimulationMode, onSimulatePosition };
  }, [isSimulationMode, onSimulatePosition]);

  // Drawing mode state
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const drawMarkersRef = useRef<L.CircleMarker[]>([]);
  const drawLineRef = useRef<L.Polyline | null>(null);

  // Helper to create tactical SVG drone icon — quadcopter UAV silhouette
  const createDroneIcon = useCallback(
    (heading: number, classification: string, isSelected: boolean, isSimMode: boolean) => {
      let strokeColor = '#3b82f6';
      let bodyColor = 'rgba(59, 130, 246, 0.95)';
      let rotorColor = 'rgba(59, 130, 246, 0.45)';

      if (classification === 'OUT_OF_ENVELOPE') {
        strokeColor = '#ef4444';
        bodyColor = 'rgba(239, 68, 68, 0.95)';
        rotorColor = 'rgba(239, 68, 68, 0.38)';
      } else if (classification === 'UNREGISTERED') {
        strokeColor = '#f97316';
        bodyColor = 'rgba(249, 115, 22, 0.92)';
        rotorColor = 'rgba(249, 115, 22, 0.38)';
      } else if (classification === 'LOST_LINK') {
        strokeColor = '#eab308';
        bodyColor = 'rgba(234, 179, 8, 0.9)';
        rotorColor = 'rgba(234, 179, 8, 0.35)';
      } else if (classification === 'AUTHORISED') {
        strokeColor = '#10b981';
        bodyColor = 'rgba(16, 185, 129, 0.92)';
        rotorColor = 'rgba(16, 185, 129, 0.38)';
      }

      if (isSelected) {
        strokeColor = '#00f2fe';
      }

      // In simulation mode, add a purple dashed outline indicator
      const simRing = isSimMode
        ? `<div style="position:absolute;inset:-6px;border:2px dashed #a855f7;border-radius:50%;animation:spin 6s linear infinite;pointer-events:none;"></div>`
        : '';

      const pulseHtml = isSelected || classification === 'OUT_OF_ENVELOPE'
        ? `<div class="drone-pulse-ring" style="border-color: ${strokeColor};"></div>`
        : '';

      // Quadcopter UAV silhouette — 48x48 viewBox, center at 24,24
      const svgInner = `
        <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style="width:36px;height:36px;display:block;">
          <line x1="24" y1="24" x2="9.5" y2="9.5" stroke="${strokeColor}" stroke-width="2.4" stroke-linecap="round"/>
          <line x1="24" y1="24" x2="38.5" y2="9.5" stroke="${strokeColor}" stroke-width="2.4" stroke-linecap="round"/>
          <line x1="24" y1="24" x2="9.5" y2="38.5" stroke="${strokeColor}" stroke-width="2.4" stroke-linecap="round"/>
          <line x1="24" y1="24" x2="38.5" y2="38.5" stroke="${strokeColor}" stroke-width="2.4" stroke-linecap="round"/>
          <circle cx="9.5" cy="9.5" r="6" fill="${rotorColor}" stroke="${strokeColor}" stroke-width="1.6"/>
          <circle cx="38.5" cy="9.5" r="6" fill="${rotorColor}" stroke="${strokeColor}" stroke-width="1.6"/>
          <circle cx="9.5" cy="38.5" r="6" fill="${rotorColor}" stroke="${strokeColor}" stroke-width="1.6"/>
          <circle cx="38.5" cy="38.5" r="6" fill="${rotorColor}" stroke="${strokeColor}" stroke-width="1.6"/>
          <rect x="19.5" y="19.5" width="9" height="9" rx="2.5" fill="${bodyColor}" stroke="${strokeColor}" stroke-width="1.6"/>
          <polygon points="24,12.5 21.5,17.5 24,15.8 26.5,17.5" fill="${strokeColor}"/>
        </svg>
      `;

      const html = `
        <div class="drone-marker-container" style="position:relative;cursor:${isSimMode ? 'grab' : 'pointer'};">
          ${simRing}
          ${pulseHtml}
          <div class="drone-marker-rotator" style="transform: rotate(${heading}deg);">
            ${svgInner}
          </div>
        </div>
      `;

      return L.divIcon({
        html,
        className: '',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
    },
    []
  );

  // 1. Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center at simulated mission area (Ajmer / Rajasthan)
    const map = L.map(mapContainerRef.current, {
      center: [26.4499, 74.6399],
      zoom: 14,
      zoomControl: false,
      preferCanvas: true,
    });

    // Stadia Maps Alidade Smooth Dark
    L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
      maxZoom: 20,
      minZoom: 2,
    }).addTo(map);

    // Zoom control at top-left
    L.control.zoom({ position: 'topleft' }).addTo(map);

    mapInstanceRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Handle Container Resizing
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
    }
  }, [isDetailPanelOpen]);

  // 3. Drawing Mode Map Click Listener
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (!isDrawingMode) return;
      const { lat, lng } = e.latlng;
      const newPoint: [number, number] = [lat, lng];

      // Place visual marker
      const marker = L.circleMarker([lat, lng], {
        radius: 5,
        color: '#f43f5e',
        fillColor: '#f43f5e',
        fillOpacity: 1,
        weight: 2,
      }).addTo(map);
      drawMarkersRef.current.push(marker);

      setDrawPoints((prev) => {
        const updated = [...prev, newPoint];
        if (!drawLineRef.current) {
          drawLineRef.current = L.polyline(updated, {
            color: '#f43f5e',
            dashArray: '5, 5',
            weight: 2,
          }).addTo(map);
        } else {
          drawLineRef.current.setLatLngs(updated);
        }
        return updated;
      });
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [isDrawingMode]);

  // Clear drawing layers when exiting drawing mode
  const cleanupDrawingLayers = useCallback(() => {
    const map = mapInstanceRef.current;
    if (map) {
      drawMarkersRef.current.forEach((m) => map.removeLayer(m));
      if (drawLineRef.current) {
        map.removeLayer(drawLineRef.current);
        drawLineRef.current = null;
      }
    }
    drawMarkersRef.current = [];
    setDrawPoints([]);
  }, []);

  const handleFinishDrawing = () => {
    if (drawPoints.length < 3) {
      alert('Click at least 3 points on the map to define a polygon zone.');
      return;
    }
    try {
      const geometry = leafletLatLngsToGeoJson(drawPoints);
      cleanupDrawingLayers();
      onFinishDrawing(geometry);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleCancelDrawing = () => {
    cleanupDrawingLayers();
    onCancelDrawing();
  };

  // 4. Update Zones
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentZoneIds = new Set<string>();

    zones.forEach((zone) => {
      currentZoneIds.add(zone.zone_id);
      const { zone_id, name, zone_type, geometry, active, min_altitude, max_altitude, remaining_seconds } = zone;

      if (!active) {
        if (zonesRef.current.has(zone_id)) {
          map.removeLayer(zonesRef.current.get(zone_id)!);
          zonesRef.current.delete(zone_id);
        }
        return;
      }

      const latLngs = geoJsonToLeafletLatLngs(geometry);
      if (latLngs.length === 0) return;

      const style = getZoneStyle(zone_type);
      let tooltipContent = `
        <div style="font-family: var(--font-mono); font-size: 11px;">
          <b style="color: #fff;">${name}</b><br/>
          <span style="color: ${style.color};">Type: ${zone_type}</span><br/>
          <span style="color: var(--text-dim);">Alt: ${min_altitude}m - ${max_altitude}m</span>
      `;
      if (remaining_seconds !== null && remaining_seconds !== undefined && remaining_seconds > 0) {
        tooltipContent += `<br/><span style="color: #f43f5e; font-weight: bold;">Expires in: ${Math.ceil(remaining_seconds)}s</span>`;
      }
      tooltipContent += `</div>`;

      if (!zonesRef.current.has(zone_id)) {
        const polygon = L.polygon(latLngs, style).addTo(map);
        polygon.bindTooltip(tooltipContent, {
          permanent: zone_type === 'TEMPORARY_RED',
          direction: 'center',
          className: 'tactical-tooltip',
        });
        zonesRef.current.set(zone_id, polygon);
      } else {
        const polygon = zonesRef.current.get(zone_id)!;
        polygon.setLatLngs(latLngs);
        polygon.setStyle(style);
        polygon.setTooltipContent(tooltipContent);
      }
    });

    // Remove obsolete zones
    zonesRef.current.forEach((layer, zId) => {
      if (!currentZoneIds.has(zId)) {
        map.removeLayer(layer);
        zonesRef.current.delete(zId);
      }
    });
  }, [zones]);

  // 5. Update Drone Markers & Trails
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentDroneIds = new Set<string>();

    tracks.forEach((track) => {
      currentDroneIds.add(track.drone_id);
      const { drone_id, track_id, latitude, longitude, heading, current_classification } = track;
      if (typeof latitude !== 'number' || typeof longitude !== 'number') return;

      const latLng: [number, number] = [latitude, longitude];

      // Auto-center map on the first drone received if never centered
      if (!hasAutoCenteredRef.current) {
        map.setView(latLng, 14);
        hasAutoCenteredRef.current = true;
      }

      // Follow mode: If enabled and this drone is selected
      if (followDrone && selectedDroneId === drone_id) {
        map.panTo(latLng, { animate: true, duration: 0.5 });
      }

      // 5a. Marker Update
      const isSelected = selectedDroneId === drone_id;
      const icon = createDroneIcon(heading, current_classification, isSelected, isSimulationMode);

      const tooltipContent = isSimulationMode
        ? `[SIM/DRAGGABLE] ${track_id} | ${drone_id}`
        : `${track_id} | ${drone_id} [${current_classification}]`;

      const classKey = (current_classification || 'authorised').toLowerCase();

      if (!markersRef.current.has(drone_id)) {
        const marker = L.marker(latLng, {
          icon,
          draggable: isSimulationMode,
        }).addTo(map);

        marker.bindTooltip(tooltipContent, {
          permanent: true,
          direction: 'top',
          offset: [0, -18],
          className: `marker-label-tooltip ${classKey}`,
        });

        marker.on('click', () => onSelectDrone(drone_id));

        // Drag end listener for Feature 1
        marker.on('dragend', (e: L.DragEndEvent) => {
          const m = e.target as L.Marker;
          const pos = m.getLatLng();
          if (simPropsRef.current.isSimulationMode) {
            simPropsRef.current.onSimulatePosition(track_id, pos.lat, pos.lng);
          }
        });

        markersRef.current.set(drone_id, marker);
      } else {
        const marker = markersRef.current.get(drone_id)!;
        marker.setLatLng(latLng);
        marker.setIcon(icon);
        marker.setTooltipContent(tooltipContent);

        // Dynamic update of dragging state when SIMULATION MODE toggles
        if (marker.dragging) {
          if (isSimulationMode) {
            marker.dragging.enable();
          } else {
            marker.dragging.disable();
          }
        }
      }

      // 5b. Trail Update
      const droneTrail = trails.get(drone_id) || [latLng];
      const trailColor = current_classification === 'OUT_OF_ENVELOPE'
        ? '#ef4444'
        : current_classification === 'UNREGISTERED'
        ? '#f97316'
        : '#10b981';

      if (!trailsRef.current.has(drone_id)) {
        const polyline = L.polyline(droneTrail, {
          color: trailColor,
          weight: 2,
          opacity: 0.65,
          dashArray: '4, 6',
        }).addTo(map);
        trailsRef.current.set(drone_id, polyline);
      } else {
        const polyline = trailsRef.current.get(drone_id)!;
        polyline.setLatLngs(droneTrail);
        polyline.setStyle({ color: trailColor });
      }
    });

    // Cleanup disconnected drones
    markersRef.current.forEach((marker, dId) => {
      if (!currentDroneIds.has(dId)) {
        map.removeLayer(marker);
        markersRef.current.delete(dId);
      }
    });

    trailsRef.current.forEach((polyline, dId) => {
      if (!currentDroneIds.has(dId)) {
        map.removeLayer(polyline);
        trailsRef.current.delete(dId);
      }
    });
  }, [tracks, trails, selectedDroneId, followDrone, createDroneIcon, onSelectDrone, isSimulationMode]);

  // Fit bounds helper
  const handleFitAll = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const trackList = Array.from(tracks.values());
    const bounds = calculateTrackBounds(trackList);
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  };

  const handleCenterSelected = () => {
    const map = mapInstanceRef.current;
    if (!map || !selectedDroneId) return;
    const track = tracks.get(selectedDroneId);
    if (track && typeof track.latitude === 'number' && typeof track.longitude === 'number') {
      map.setView([track.latitude, track.longitude], 15);
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
      className={isDrawingMode ? 'drawing-active-map' : ''}
    >
      {/* Map DOM target */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Zone Legend */}
      <ZoneLegend />

      {/* Map Interactive Controls */}
      <MapControls
        onFitAll={handleFitAll}
        followDrone={followDrone}
        onToggleFollow={onToggleFollow}
        hasSelectedDrone={!!selectedDroneId}
        onCenterSelected={handleCenterSelected}
        isSimulationMode={isSimulationMode}
        onToggleSimulationMode={onToggleSimulationMode}
      />

      {/* Simulation Mode Active Banner */}
      {isSimulationMode && !isDrawingMode && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 600,
            background: 'rgba(24, 9, 43, 0.95)',
            border: '1px solid #a855f7',
            borderRadius: '6px',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 0 20px rgba(168, 85, 247, 0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#a855f7',
                boxShadow: '0 0 8px #a855f7',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '11px',
                color: '#c084fc',
                letterSpacing: '1px',
              }}
            >
              SIMULATION / DEMO MODE ACTIVE
            </span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Drag drone markers to test geofence breaches & alert engine.
          </span>
        </div>
      )}

      {/* Temporary Red Zone Drawing Banner */}
      {isDrawingMode && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 600,
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid #f43f5e',
            borderRadius: '6px',
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 0 20px rgba(244, 63, 94, 0.4)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '12px',
                color: '#f43f5e',
                letterSpacing: '1px',
              }}
            >
              ZONE DRAW MODE ACTIVE ({drawPoints.length} points placed)
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Click on the map to define polygon boundary (min 3 points).
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleFinishDrawing}
              disabled={drawPoints.length < 3}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: drawPoints.length >= 3 ? '#ef4444' : 'rgba(239, 68, 68, 0.3)',
                color: '#fff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                cursor: drawPoints.length >= 3 ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
              }}
            >
              <Check size={13} />
              FINISH ZONE
            </button>
            <button
              onClick={handleCancelDrawing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'rgba(255, 255, 255, 0.1)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-dim)',
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <X size={13} />
              CANCEL
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { Track } from '../../types';
import { getClassificationMeta, formatTimestamp, formatRelativeTime } from '../../utils/formatting';
import { formatCoordinates } from '../../utils/geo';
import { X, Shield, Navigation, Compass, Radio } from 'lucide-react';

interface DroneDetailPanelProps {
  track: Track | null;
  onClose: () => void;
}

export const DroneDetailPanel: React.FC<DroneDetailPanelProps> = ({ track, onClose }) => {
  if (!track) return null;

  const meta = getClassificationMeta(track.current_classification);

  return (
    <aside
      style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        width: '320px',
        maxHeight: 'calc(100% - 32px)',
        zIndex: 550,
        background: 'rgba(9, 15, 24, 0.94)',
        border: '1px solid var(--border-focus)',
        borderRadius: '6px',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        pointerEvents: 'auto',
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          background: 'rgba(17, 27, 39, 0.95)',
          borderBottom: '1px solid var(--border-dim)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Navigation size={14} color="var(--accent-cyan)" />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '13px',
              letterSpacing: '1px',
              color: '#ffffff',
            }}
          >
            TRACK INTELLIGENCE
          </span>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Panel Body Scrollable */}
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
        
        {/* SECTION 1: IDENTITY & REGISTRY */}
        <div>
          <div
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              letterSpacing: '0.8px',
              color: 'var(--accent-cyan)',
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <Shield size={11} />
            IDENTITY & REGISTRY
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px',
              background: 'rgba(6, 9, 14, 0.6)',
              border: '1px solid var(--border-dim)',
              borderRadius: '4px',
              padding: '8px',
            }}
          >
            <div>
              <div style={{ fontSize: '8px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>TRACK ID</div>
              <div style={{ fontSize: '11px', color: '#fff', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {track.track_id}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '8px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>DRONE ID</div>
              <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                {track.drone_id}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '8px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>REGISTRATION</div>
              <div style={{ fontSize: '10px', color: '#fff', fontFamily: 'var(--font-mono)' }}>
                {track.registration || 'UNREGISTERED'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '8px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>DRONE TYPE</div>
              <div style={{ fontSize: '10px', color: '#fff', fontFamily: 'var(--font-mono)' }}>
                {track.drone_type || 'Multirotor'}
              </div>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: '8px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>OPERATOR</div>
              <div style={{ fontSize: '11px', color: '#fff', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {track.operator || 'Unknown Operator'}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: POSITION & KINEMATICS */}
        <div>
          <div
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              letterSpacing: '0.8px',
              color: 'var(--accent-blue)',
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <Compass size={11} />
            POSITION & KINEMATICS
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px',
              background: 'rgba(6, 9, 14, 0.6)',
              border: '1px solid var(--border-dim)',
              borderRadius: '4px',
              padding: '8px',
            }}
          >
            <div>
              <div style={{ fontSize: '8px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>LATITUDE</div>
              <div style={{ fontSize: '11px', color: '#fff', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {track.latitude.toFixed(6)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '8px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>LONGITUDE</div>
              <div style={{ fontSize: '11px', color: '#fff', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {track.longitude.toFixed(6)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '8px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>ALTITUDE</div>
              <div style={{ fontSize: '12px', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                {Math.round(track.altitude)} m
              </div>
            </div>

            <div>
              <div style={{ fontSize: '8px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>SPEED</div>
              <div style={{ fontSize: '12px', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                {Math.round(track.speed)} m/s
              </div>
            </div>

            <div>
              <div style={{ fontSize: '8px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>HEADING</div>
              <div style={{ fontSize: '11px', color: '#fff', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {Math.round(track.heading)}°
              </div>
            </div>

            <div>
              <div style={{ fontSize: '8px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>LAST SEEN</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {formatRelativeTime(track.last_seen)}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: GEOFENCE & ALTITUDE ENVELOPE */}
        <div>
          <div
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              letterSpacing: '0.8px',
              color: 'var(--accent-yellow)',
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <Radio size={11} />
            GEOFENCE & ENVELOPE
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              background: 'rgba(6, 9, 14, 0.6)',
              border: '1px solid var(--border-dim)',
              borderRadius: '4px',
              padding: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>ZONE:</span>
              <span style={{ fontSize: '10px', color: '#fff', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {track.current_zone_name || 'Unrestricted Airspace'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>ENVELOPE:</span>
              <span style={{ fontSize: '10px', color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>
                {track.min_altitude || 0}m - {track.max_altitude || 120}m
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>GEOFENCE:</span>
              <span
                style={{
                  fontSize: '9px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color:
                    track.geofence_status === 'RED_ZONE_VIOLATION'
                      ? '#ef4444'
                      : track.geofence_status === 'ALTITUDE_ENVELOPE_VIOLATION'
                      ? '#f97316'
                      : '#10b981',
                }}
              >
                {(track.geofence_status || 'COMPLIANT').replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 4: CANONICAL STATUS */}
        <div>
          <div
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              letterSpacing: '0.8px',
              color: meta.color,
              marginBottom: '6px',
            }}
          >
            OPERATIONAL STATE
          </div>

          <div
            style={{
              background: meta.fill,
              border: `1px solid ${meta.stroke}`,
              borderRadius: '4px',
              padding: '8px 10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#fff' }}>
              {track.current_classification}
            </span>
            <span style={{ fontSize: '10px', color: '#fff', fontFamily: 'var(--font-mono)' }}>
              LINK: {track.link_status}
            </span>
          </div>
        </div>

      </div>
    </aside>
  );
};

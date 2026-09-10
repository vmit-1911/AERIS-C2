import React from 'react';
import { Track } from '../../types';
import { getClassificationMeta, formatRelativeTime } from '../../utils/formatting';
import { Compass, Gauge, ArrowUp } from 'lucide-react';

interface TrackCardProps {
  track: Track;
  isSelected: boolean;
  onSelect: (droneId: string) => void;
}

export const TrackCard: React.FC<TrackCardProps> = ({ track, isSelected, onSelect }) => {
  const meta = getClassificationMeta(track.current_classification);

  return (
    <div
      onClick={() => onSelect(track.drone_id)}
      style={{
        background: isSelected
          ? 'linear-gradient(135deg, rgba(0, 242, 254, 0.12) 0%, rgba(13, 22, 35, 0.95) 100%)'
          : 'rgba(13, 22, 35, 0.75)',
        border: isSelected
          ? '1px solid var(--accent-cyan)'
          : '1px solid var(--border-dim)',
        borderLeft: `4px solid ${meta.color}`,
        borderRadius: '4px',
        padding: '10px 12px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        transition: 'all 0.15s ease',
        boxShadow: isSelected ? '0 0 12px rgba(0, 242, 254, 0.25)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = 'rgba(0, 242, 254, 0.4)';
          e.currentTarget.style.background = 'rgba(19, 32, 50, 0.85)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = 'var(--border-dim)';
          e.currentTarget.style.background = 'rgba(13, 22, 35, 0.75)';
        }
      }}
    >
      {/* Top Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: '12px',
              color: '#ffffff',
            }}
          >
            {track.drone_id}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--accent-blue)',
            }}
          >
            [{track.track_id}]
          </span>
        </div>

        {/* Classification Badge */}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize: '9px',
            padding: '2px 6px',
            borderRadius: '3px',
            border: `1px solid ${meta.stroke}`,
            background: meta.fill,
            color: '#fff',
            letterSpacing: '0.5px',
          }}
        >
          {track.current_classification}
        </span>
      </div>

      {/* Operator & Registry Info */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
          Op: {track.operator || 'Unknown Operator'}
        </span>
        <span style={{ color: 'var(--text-dim)' }}>
          {formatRelativeTime(track.last_seen)}
        </span>
      </div>

      {/* Real-time Kinematic Telemetry Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '4px',
          background: 'rgba(6, 9, 14, 0.6)',
          border: '1px solid rgba(56, 189, 248, 0.08)',
          borderRadius: '3px',
          padding: '4px 6px',
          marginTop: '2px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '8px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>ALT</span>
          <span style={{ fontSize: '11px', color: '#fff', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            {Math.round(track.altitude)}m
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '8px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>SPD</span>
          <span style={{ fontSize: '11px', color: '#fff', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            {Math.round(track.speed)}m/s
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '8px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>HDG</span>
          <span style={{ fontSize: '11px', color: '#fff', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            {Math.round(track.heading)}°
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '8px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>ZONE</span>
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              color:
                track.current_zone_type === 'RED' || track.current_zone_type === 'TEMPORARY_RED'
                  ? '#f87171'
                  : track.current_zone_type === 'YELLOW'
                  ? '#facc15'
                  : '#34d399',
            }}
          >
            {track.current_zone_type || 'GREEN'}
          </span>
        </div>
      </div>
    </div>
  );
};

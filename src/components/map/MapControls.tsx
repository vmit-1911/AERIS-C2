import React from 'react';
import { Maximize2, Crosshair, Navigation, Move } from 'lucide-react';

interface MapControlsProps {
  onFitAll: () => void;
  followDrone: boolean;
  onToggleFollow: () => void;
  hasSelectedDrone: boolean;
  onCenterSelected: () => void;
  isSimulationMode?: boolean;
  onToggleSimulationMode?: () => void;
}

export const MapControls: React.FC<MapControlsProps> = ({
  onFitAll,
  followDrone,
  onToggleFollow,
  hasSelectedDrone,
  onCenterSelected,
  isSimulationMode = false,
  onToggleSimulationMode,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        zIndex: 500,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        pointerEvents: 'auto',
      }}
    >
      {/* Simulation / Drag Toggle */}
      {onToggleSimulationMode && (
        <button
          onClick={onToggleSimulationMode}
          title="Toggle Simulation Drag Mode for Drones (DEMO)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: isSimulationMode
              ? 'rgba(168, 85, 247, 0.25)'
              : 'rgba(9, 15, 24, 0.88)',
            border: isSimulationMode
              ? '1px solid #a855f7'
              : '1px solid var(--border-dim)',
            borderRadius: '4px',
            padding: '6px 10px',
            color: isSimulationMode ? '#c084fc' : 'var(--text-main)',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            boxShadow: isSimulationMode ? '0 0 12px rgba(168,85,247,0.4)' : '0 2px 10px rgba(0,0,0,0.5)',
            transition: 'all 0.15s',
          }}
        >
          <Move size={13} color={isSimulationMode ? '#c084fc' : 'var(--text-dim)'} />
          <span>SIM DRAG: {isSimulationMode ? 'ON' : 'OFF'}</span>
        </button>
      )}

      {/* Fit All Tracks */}
      <button
        onClick={onFitAll}
        title="Fit Map to All Active Tracks"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(9, 15, 24, 0.88)',
          border: '1px solid var(--border-dim)',
          borderRadius: '4px',
          padding: '6px 10px',
          color: 'var(--text-main)',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent-cyan)';
          e.currentTarget.style.color = '#fff';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-dim)';
          e.currentTarget.style.color = 'var(--text-main)';
        }}
      >
        <Maximize2 size={13} color="var(--accent-cyan)" />
        <span>FIT ALL TRACKS</span>
      </button>

      {/* Follow Drone Toggle */}
      <button
        onClick={onToggleFollow}
        title="Automatically Pan Map to Follow Selected Drone"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: followDrone
            ? 'rgba(0, 242, 254, 0.2)'
            : 'rgba(9, 15, 24, 0.88)',
          border: followDrone
            ? '1px solid var(--accent-cyan)'
            : '1px solid var(--border-dim)',
          borderRadius: '4px',
          padding: '6px 10px',
          color: followDrone ? 'var(--accent-cyan)' : 'var(--text-main)',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          boxShadow: followDrone ? '0 0 10px rgba(0,242,254,0.3)' : '0 2px 10px rgba(0,0,0,0.5)',
          transition: 'all 0.15s',
        }}
      >
        <Navigation size={13} color={followDrone ? 'var(--accent-cyan)' : 'var(--text-dim)'} />
        <span>FOLLOW: {followDrone ? 'ON' : 'OFF'}</span>
      </button>

      {/* Center on Selected Drone */}
      {hasSelectedDrone && (
        <button
          onClick={onCenterSelected}
          title="Center Map on Selected Drone"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(9, 15, 24, 0.88)',
            border: '1px solid var(--border-dim)',
            borderRadius: '4px',
            padding: '6px 10px',
            color: 'var(--text-main)',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-blue)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-dim)';
          }}
        >
          <Crosshair size={13} color="var(--accent-blue)" />
          <span>CENTER TARGET</span>
        </button>
      )}
    </div>
  );
};

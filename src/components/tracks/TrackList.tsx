import React from 'react';
import { Track } from '../../types';
import { TrackCard } from './TrackCard';
import { Radio } from 'lucide-react';

interface TrackListProps {
  tracks: Track[];
  selectedDroneId: string | null;
  onSelectDrone: (droneId: string) => void;
}

export const TrackList: React.FC<TrackListProps> = ({
  tracks,
  selectedDroneId,
  onSelectDrone,
}) => {
  if (tracks.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          textAlign: 'center',
          color: 'var(--text-dim)',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '2px dashed var(--accent-cyan)',
            animation: 'radar-sweep 3s linear infinite',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Radio size={18} color="var(--accent-cyan)" />
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
          Listening for active drone telemetry over WebSocket (/ws/dashboard)...
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
          Launch virtual_drone_sender.py or test scenarios to stream telemetry.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '12px',
        overflowY: 'auto',
        height: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color: 'var(--text-dim)',
          borderBottom: '1px solid var(--border-dim)',
          paddingBottom: '4px',
        }}
      >
        <span>ACTIVE SENSORS ({tracks.length})</span>
        <span>STREAM: LIVE</span>
      </div>

      {tracks.map((track) => (
        <TrackCard
          key={track.drone_id}
          track={track}
          isSelected={selectedDroneId === track.drone_id}
          onSelect={onSelectDrone}
        />
      ))}
    </div>
  );
};

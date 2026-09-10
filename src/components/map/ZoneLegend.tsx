import React from 'react';

export const ZoneLegend: React.FC = () => {
  const legendItems = [
    { label: 'Green Corridor', color: '#10b981', desc: 'Civil Airspace Envelope' },
    { label: 'Yellow Advisory', color: '#eab308', desc: 'Municipal Advisory' },
    { label: 'Red Restricted', color: '#ef4444', desc: 'Govt Enclave' },
    { label: 'Temp Red Zone', color: '#f43f5e', desc: 'Dynamic Enforcement', dashed: true },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        zIndex: 500,
        background: 'rgba(9, 15, 24, 0.88)',
        border: '1px solid var(--border-dim)',
        borderRadius: '6px',
        padding: '8px 12px',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '1px',
          color: 'var(--accent-cyan)',
          borderBottom: '1px solid var(--border-dim)',
          paddingBottom: '3px',
          marginBottom: '2px',
        }}
      >
        AIRSPACE GEOFENCE LAYERS
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {legendItems.map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '2px',
                background: item.color,
                opacity: 0.8,
                border: item.dashed ? `1px dashed ${item.color}` : `1px solid ${item.color}`,
              }}
            />
            <span style={{ fontSize: '10px', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

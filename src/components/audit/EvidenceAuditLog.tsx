import React, { useState } from 'react';
import { EvidenceRecord } from '../../types';
import { Download, FileSearch, Camera, ShieldAlert, MapPin } from 'lucide-react';
import { formatTimestamp, getZoneStyle, getClassificationMeta } from '../../utils/formatting';
import { getEvidenceExportUrl } from '../../services/api';

interface EvidenceAuditLogProps {
  evidenceRecords: EvidenceRecord[];
}

export const EvidenceAuditLog: React.FC<EvidenceAuditLogProps> = ({ evidenceRecords }) => {
  const [selectedRecord, setSelectedRecord] = useState<EvidenceRecord | null>(null);

  const handleExport = (format: 'csv' | 'json') => {
    window.open(getEvidenceExportUrl(format), '_blank');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-secondary)',
      }}
    >
      {/* Header with Export Controls */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-dim)',
          background: '#090f18',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileSearch size={14} color="#a855f7" />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--text-main)',
              letterSpacing: '0.8px',
            }}
          >
            EVIDENCE AUDIT LOG
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              padding: '1px 6px',
              borderRadius: '10px',
              background: 'rgba(168, 85, 247, 0.2)',
              color: '#c084fc',
              fontWeight: 700,
            }}
          >
            {evidenceRecords.length}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => handleExport('json')}
            title="Export Evidence Audit Log as JSON"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(168, 85, 247, 0.15)',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              color: '#c084fc',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <Download size={11} />
            JSON
          </button>

          <button
            onClick={() => handleExport('csv')}
            title="Export Evidence Audit Log as CSV"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-dim)',
              color: 'var(--text-main)',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <Download size={11} />
            CSV
          </button>
        </div>
      </div>

      {/* Sub-header Notice */}
      <div
        style={{
          padding: '6px 14px',
          background: 'rgba(15, 23, 42, 0.6)',
          borderBottom: '1px solid var(--border-dim)',
          fontSize: '10px',
          color: 'var(--text-dim)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <ShieldAlert size={12} color="#a855f7" />
        <span>Append-only records generated upon RED/YELLOW zone entry events.</span>
      </div>

      {/* Evidence Records List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {evidenceRecords.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 16px',
              color: 'var(--text-dim)',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
            }}
          >
            <FileSearch size={32} color="var(--border-dim)" style={{ marginBottom: '10px' }} />
            <div>NO ZONE ENTRY EVENTS RECORDED</div>
            <div style={{ fontSize: '10px', marginTop: '4px', color: 'var(--text-muted)' }}>
              Events will appear automatically when drones enter restricted zones.
            </div>
          </div>
        ) : (
          evidenceRecords.map((ev) => {
            const isSelected = selectedRecord?.evidence_id === ev.evidence_id;
            const zoneStyle = getZoneStyle(ev.zone_type as any);

            return (
              <div
                key={ev.evidence_id}
                onClick={() => setSelectedRecord(isSelected ? null : ev)}
                style={{
                  background: isSelected ? 'rgba(168, 85, 247, 0.12)' : 'rgba(9, 15, 24, 0.6)',
                  border: isSelected ? '1px solid #a855f7' : '1px solid var(--border-dim)',
                  borderRadius: '6px',
                  padding: '10px',
                  marginBottom: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {/* Top Line */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#c084fc',
                      }}
                    >
                      {ev.evidence_id}
                    </span>
                    <span
                      style={{
                        fontSize: '9px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '3px',
                        background: zoneStyle.fillColor + '33',
                        color: zoneStyle.color,
                        border: `1px solid ${zoneStyle.color}`,
                      }}
                    >
                      {ev.zone_type} ENTRY
                    </span>
                  </div>

                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                    {formatTimestamp(ev.timestamp)}
                  </span>
                </div>

                {/* Main Event Info */}
                <div style={{ fontSize: '11px', color: 'var(--text-main)', marginBottom: '6px' }}>
                  <b>{ev.drone_id}</b> ({ev.track_id}) entered <b>{ev.zone_name}</b>
                </div>

                {/* Details grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '4px 10px',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    marginBottom: '6px',
                  }}
                >
                  <div>
                    <MapPin size={10} style={{ display: 'inline', marginRight: '3px' }} />
                    {ev.latitude.toFixed(4)}, {ev.longitude.toFixed(4)}
                  </div>
                  <div>Alt: {ev.altitude}m</div>
                  <div>Operator: {ev.operator}</div>
                  <div>Source: {ev.telemetry_source}</div>
                </div>

                {/* Camera Evidence Tag */}
                <div
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: ev.camera_evidence === 'NOT_AVAILABLE' ? 'rgba(255,255,255,0.03)' : 'rgba(16, 185, 129, 0.1)',
                    border: ev.camera_evidence === 'NOT_AVAILABLE' ? '1px dashed var(--border-dim)' : '1px solid rgba(16, 185, 129, 0.3)',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Camera size={11} color={ev.camera_evidence === 'NOT_AVAILABLE' ? 'var(--text-dim)' : '#10b981'} />
                    <span style={{ color: ev.camera_evidence === 'NOT_AVAILABLE' ? 'var(--text-dim)' : '#6ee7b7' }}>
                      Camera Ref: {ev.camera_evidence === 'NOT_AVAILABLE' ? 'NONE (NOT AVAILABLE)' : (ev.camera_evidence as any).observation_id}
                    </span>
                  </div>

                  {ev.camera_evidence !== 'NOT_AVAILABLE' && (
                    <span style={{ fontSize: '9px', color: '#10b981', fontWeight: 700 }}>
                      {((ev.camera_evidence as any).confidence * 100).toFixed(0)}% MATCH
                    </span>
                  )}
                </div>

                {/* Expanded view for camera details & note */}
                {isSelected && ev.camera_evidence !== 'NOT_AVAILABLE' && (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '8px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: '4px',
                      border: '1px solid var(--border-dim)',
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <div style={{ color: '#6ee7b7', fontWeight: 700, marginBottom: '3px' }}>
                      Camera Evidence Details:
                    </div>
                    <div style={{ color: 'var(--text-main)' }}>
                      Cam: {(ev.camera_evidence as any).camera_id} | Class: {(ev.camera_evidence as any).detected_class}
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '9px', marginTop: '2px' }}>
                      {(ev.camera_evidence as any).note}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

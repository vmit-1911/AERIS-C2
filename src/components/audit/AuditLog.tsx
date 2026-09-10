import React from 'react';
import { AuditEvent } from '../../types';
import { formatTimestamp } from '../../utils/formatting';
import { getAuditExportUrl } from '../../services/api';
import { ShieldCheck, Download } from 'lucide-react';

interface AuditLogProps {
  auditEvents: AuditEvent[];
}

export const AuditLog: React.FC<AuditLogProps> = ({ auditEvents }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '12px',
        overflowY: 'auto',
        height: '100%',
      }}
    >
      {/* Header with Export Buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '6px',
          borderBottom: '1px solid var(--border-dim)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldCheck size={14} color="var(--accent-cyan)" />
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#fff' }}>
            SECURITY EVENT LOG ({auditEvents.length})
          </span>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <a
            href={getAuditExportUrl('csv')}
            download="aeris_c2_audit_log.csv"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid var(--accent-blue)',
              color: 'var(--accent-blue)',
              fontSize: '9px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              padding: '3px 7px',
              borderRadius: '3px',
              textDecoration: 'none',
            }}
          >
            <Download size={10} />
            CSV
          </a>

          <a
            href={getAuditExportUrl('json')}
            download="aeris_c2_audit_log.json"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(0, 242, 254, 0.15)',
              border: '1px solid var(--accent-cyan)',
              color: 'var(--accent-cyan)',
              fontSize: '9px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              padding: '3px 7px',
              borderRadius: '3px',
              textDecoration: 'none',
            }}
          >
            <Download size={10} />
            JSON
          </a>
        </div>
      </div>

      {/* Events List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {auditEvents.slice(-40).reverse().map((evt) => (
          <div
            key={evt.event_id}
            style={{
              background: 'rgba(13, 22, 35, 0.75)',
              border: '1px solid var(--border-dim)',
              borderRadius: '4px',
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color:
                    evt.action.includes('EXPIRATION')
                      ? '#facc15'
                      : evt.action.includes('CREATION')
                      ? '#f87171'
                      : evt.action.includes('ALERT')
                      ? '#38bdf8'
                      : '#34d399',
                }}
              >
                {evt.event_id} • {evt.action}
              </span>

              <span style={{ fontSize: '9px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                {formatTimestamp(evt.timestamp)}
              </span>
            </div>

            <div style={{ fontSize: '10px', color: 'var(--text-main)', lineHeight: '1.3' }}>
              {evt.reason || 'No description provided'}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '9px',
                color: 'var(--text-dim)',
                fontFamily: 'var(--font-mono)',
                marginTop: '2px',
              }}
            >
              <span>By: <b style={{ color: 'var(--accent-cyan)' }}>{evt.operator_id}</b> ({evt.role})</span>
              {evt.track_id && <span>Track: {evt.track_id}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

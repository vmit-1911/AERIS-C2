import React from 'react';
import { Alert, AlertPriority } from '../../types';
import { getPriorityMeta, formatRelativeTime } from '../../utils/formatting';
import { AlertTriangle, CheckCircle2, XCircle, ArrowUpRight } from 'lucide-react';

interface AlertQueueProps {
  alerts: Alert[];
  onSelectDrone: (droneId: string) => void;
  onOpenDisposition: (alert: Alert, action: 'CONFIRM' | 'DISMISS' | 'ESCALATE') => void;
}

export const AlertQueue: React.FC<AlertQueueProps> = ({
  alerts,
  onSelectDrone,
  onOpenDisposition,
}) => {
  // Priority ordering
  const priorityRank: Record<AlertPriority, number> = {
    CRITICAL: 1,
    HIGH: 2,
    MEDIUM: 3,
    LOW: 4,
  };

  const activeAlerts = alerts
    .filter((a) => a.status === 'OPEN' || a.status === 'ESCALATED')
    .sort((a, b) => {
      const pDiff = (priorityRank[a.priority] || 5) - (priorityRank[b.priority] || 5);
      if (pDiff !== 0) return pDiff;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

  if (activeAlerts.length === 0) {
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
          gap: '8px',
        }}
      >
        <AlertTriangle size={24} color="var(--accent-green)" />
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-green)' }}>
          NO ACTIVE ALERTS
        </div>
        <div style={{ fontSize: '10px' }}>Airspace perimeter and altitude envelopes normal.</div>
      </div>
    );
  }

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
        <span>PRIORITY ALERT QUEUE ({activeAlerts.length})</span>
        <span style={{ color: '#ef4444', fontWeight: 700 }}>ACTION REQUIRED</span>
      </div>

      {activeAlerts.map((alert) => {
        const isCritical = alert.priority === 'CRITICAL';
        const prioColor = isCritical ? '#ef4444' : alert.priority === 'HIGH' ? '#f97316' : '#eab308';

        return (
          <div
            key={alert.alert_id}
            onClick={() => onSelectDrone(alert.drone_id)}
            style={{
              background: isCritical
                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(13, 22, 35, 0.9) 100%)'
                : 'rgba(13, 22, 35, 0.85)',
              border: `1px solid ${isCritical ? 'rgba(239, 68, 68, 0.6)' : 'var(--border-dim)'}`,
              borderLeft: `4px solid ${prioColor}`,
              borderRadius: '4px',
              padding: '10px 12px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = prioColor;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = isCritical ? 'rgba(239, 68, 68, 0.6)' : 'var(--border-dim)';
            }}
          >
            {/* Alert Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '11px', color: '#fff' }}>
                  {alert.alert_id}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent-cyan)' }}>
                  [{alert.drone_id}]
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '3px',
                    background: prioColor,
                    color: '#fff',
                  }}
                >
                  {alert.priority}
                </span>
                <span style={{ fontSize: '9px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  {formatRelativeTime(alert.timestamp)}
                </span>
              </div>
            </div>

            {/* Classification & Reason */}
            <div style={{ fontSize: '10px', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              {alert.classification}
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-main)', lineHeight: '1.4' }}>
              {alert.reason}
            </div>

            {/* Suggested Operational Action */}
            <div
              style={{
                background: 'rgba(6, 9, 14, 0.7)',
                border: '1px solid rgba(56, 189, 248, 0.15)',
                borderRadius: '3px',
                padding: '5px 8px',
                fontSize: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <span style={{ fontSize: '8px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                SUGGESTED OPERATIONAL ACTION
              </span>
              <span style={{ color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {alert.suggested_action}
              </span>
            </div>

            {/* Disposition Buttons Bar */}
            <div
              style={{
                display: 'flex',
                gap: '6px',
                marginTop: '4px',
                paddingTop: '6px',
                borderTop: '1px solid var(--border-dim)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => onOpenDisposition(alert, 'CONFIRM')}
                style={{
                  flex: 1,
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  color: '#fca5a5',
                  fontSize: '9px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  padding: '5px 4px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                }}
              >
                <CheckCircle2 size={11} />
                CONFIRM
              </button>

              <button
                onClick={() => onOpenDisposition(alert, 'DISMISS')}
                style={{
                  flex: 1,
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.5)',
                  color: '#6ee7b7',
                  fontSize: '9px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  padding: '5px 4px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(16, 185, 129, 0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)';
                }}
              >
                <XCircle size={11} />
                DISMISS
              </button>

              <button
                onClick={() => onOpenDisposition(alert, 'ESCALATE')}
                style={{
                  flex: 1,
                  background: 'rgba(234, 179, 8, 0.15)',
                  border: '1px solid rgba(234, 179, 8, 0.5)',
                  color: '#fef08a',
                  fontSize: '9px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  padding: '5px 4px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(234, 179, 8, 0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(234, 179, 8, 0.15)';
                }}
              >
                <ArrowUpRight size={11} />
                ESCALATE
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

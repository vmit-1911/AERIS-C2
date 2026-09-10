import React, { useState } from 'react';
import { Alert, ReasonCode, OperatorRole } from '../../types';
import { ShieldAlert, X } from 'lucide-react';

interface DispositionModalProps {
  alert: Alert | null;
  action: 'CONFIRM' | 'DISMISS' | 'ESCALATE' | null;
  operatorId: string;
  operatorRole: OperatorRole;
  onClose: () => void;
  onSubmit: (alertId: string, action: 'CONFIRM' | 'DISMISS' | 'ESCALATE', reasonCode: ReasonCode) => Promise<void>;
}

export const DispositionModal: React.FC<DispositionModalProps> = ({
  alert,
  action,
  operatorId,
  operatorRole,
  onClose,
  onSubmit,
}) => {
  const [reasonCode, setReasonCode] = useState<ReasonCode | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!alert || !action) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonCode) {
      setErrorMsg('A mandatory reason code is required to complete disposition.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSubmit(alert.alert_id, action, reasonCode as ReasonCode);
      onClose();
    } catch (err) {
      setErrorMsg((err as Error).message || 'Failed to submit disposition');
    } finally {
      setIsSubmitting(false);
    }
  };

  const reasonCodeOptions: { value: ReasonCode; label: string }[] = [
    { value: 'CONFIRMED_VIOLATION', label: 'CONFIRMED_VIOLATION (Active Non-compliance)' },
    { value: 'ESCALATED_TO_SUPERVISOR', label: 'ESCALATED_TO_SUPERVISOR (Requires Tactical Assessment)' },
    { value: 'AUTHORIZED_OPERATION', label: 'AUTHORIZED_OPERATION (Valid Exception Confirmed)' },
    { value: 'IDENTITY_VERIFIED', label: 'IDENTITY_VERIFIED (Civil Registry / Owner Checked)' },
    { value: 'LOST_LINK_RESOLVED', label: 'LOST_LINK_RESOLVED (Telemetry Restored / Regained)' },
    { value: 'FALSE_POSITIVE', label: 'FALSE_POSITIVE (Sensor Noise / False Trigger)' },
    { value: 'DUPLICATE_ALERT', label: 'DUPLICATE_ALERT (Redundant Event)' },
    { value: 'OTHER', label: 'OTHER (Documented in Audit Record)' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(6, 9, 14, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          background: '#0d1623',
          border: '1px solid var(--border-focus)',
          borderRadius: '6px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.8)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 18px',
            background: 'rgba(17, 27, 39, 0.95)',
            borderBottom: '1px solid var(--border-dim)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={16} color="var(--accent-cyan)" />
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '14px',
                letterSpacing: '1px',
                color: '#ffffff',
              }}
            >
              OPERATOR DISPOSITION & AUDIT
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
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Target Alert Details */}
          <div
            style={{
              background: 'rgba(6, 9, 14, 0.6)',
              border: '1px solid var(--border-dim)',
              borderRadius: '4px',
              padding: '10px 12px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
            }}
          >
            <div>
              <div style={{ fontSize: '8px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>ALERT ID</div>
              <div style={{ fontSize: '11px', color: '#fff', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                {alert.alert_id}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '8px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>TARGET DRONE</div>
              <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                {alert.drone_id} ({alert.track_id})
              </div>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: '8px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>SUGGESTED ACTION</div>
              <div style={{ fontSize: '11px', color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>
                {alert.suggested_action}
              </div>
            </div>
          </div>

          {/* Action & Officer */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: '4px' }}>
                SELECTED ACTION
              </label>
              <input
                type="text"
                readOnly
                value={action}
                style={{
                  width: '100%',
                  background: 'rgba(17, 27, 39, 0.8)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: '4px',
                  padding: '6px 8px',
                  color: action === 'CONFIRM' ? '#f87171' : action === 'ESCALATE' ? '#facc15' : '#34d399',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  fontSize: '11px',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: '4px' }}>
                DISPOSITION OFFICER
              </label>
              <input
                type="text"
                readOnly
                value={`${operatorId} (${operatorRole})`}
                style={{
                  width: '100%',
                  background: 'rgba(17, 27, 39, 0.8)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: '4px',
                  padding: '6px 8px',
                  color: '#fff',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Mandatory Reason Code Select */}
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-main)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
              MANDATORY REASON CODE <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value as ReasonCode)}
              required
              style={{
                width: '100%',
                background: 'rgba(6, 9, 14, 0.9)',
                border: errorMsg ? '1px solid #ef4444' : '1px solid var(--border-focus)',
                borderRadius: '4px',
                padding: '8px 10px',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                outline: 'none',
              }}
            >
              <option value="">-- Select Required Disposition Reason --</option>
              {reasonCodeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {errorMsg && (
            <div style={{ fontSize: '11px', color: '#f87171', fontFamily: 'var(--font-mono)' }}>
              {errorMsg}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--border-dim)',
                color: 'var(--text-muted)',
                padding: '7px 14px',
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                border: '1px solid var(--accent-cyan)',
                color: '#ffffff',
                padding: '7px 16px',
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                letterSpacing: '0.5px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 0 10px rgba(0, 242, 254, 0.3)',
              }}
            >
              {isSubmitting ? 'SUBMITTING...' : 'SUBMIT DISPOSITION & AUDIT'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

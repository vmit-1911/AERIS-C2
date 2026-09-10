import React, { useState } from 'react';
import { GeoJSONGeometry, OperatorRole, TempRedZonePayload } from '../../types';
import { AlertOctagon, X } from 'lucide-react';

interface TempZoneModalProps {
  geometry: GeoJSONGeometry | null;
  operatorId: string;
  operatorRole: OperatorRole;
  onClose: () => void;
  onSubmit: (payload: TempRedZonePayload) => Promise<void>;
}

export const TempZoneModal: React.FC<TempZoneModalProps> = ({
  geometry,
  operatorId,
  operatorRole,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('TEMP-EMERGENCY-NOFLY-ZONE');
  const [duration, setDuration] = useState(60);
  const [minAlt, setMinAlt] = useState(0);
  const [maxAlt, setMaxAlt] = useState(100);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!geometry) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (duration < 10) {
      setErrorMsg('Duration must be at least 10 seconds.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSubmit({
        name,
        geometry,
        duration_seconds: duration,
        min_altitude: minAlt,
        max_altitude: maxAlt,
        operator_id: operatorId,
        role: operatorRole,
      });
      onClose();
    } catch (err) {
      setErrorMsg((err as Error).message || 'Failed to create temporary red zone');
    } finally {
      setIsSubmitting(false);
    }
  };

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
          maxWidth: '460px',
          background: '#0d1623',
          border: '1px solid #f43f5e',
          borderRadius: '6px',
          boxShadow: '0 12px 40px rgba(244, 63, 94, 0.25)',
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
            background: 'rgba(239, 68, 68, 0.15)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertOctagon size={16} color="#f43f5e" />
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '14px',
                letterSpacing: '1px',
                color: '#fecaca',
              }}
            >
              CREATE TEMPORARY RED ZONE
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
        <form onSubmit={handleSubmit} style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-main)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
              ZONE DESIGNATION / NAME
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(6, 9, 14, 0.9)',
                border: '1px solid var(--border-focus)',
                borderRadius: '4px',
                padding: '8px 10px',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-main)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                DURATION (SECONDS)
              </label>
              <input
                type="number"
                min="10"
                max="3600"
                required
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                style={{
                  width: '100%',
                  background: 'rgba(6, 9, 14, 0.9)',
                  border: '1px solid var(--border-focus)',
                  borderRadius: '4px',
                  padding: '8px 10px',
                  color: 'var(--accent-cyan)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  fontWeight: 700,
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: '4px' }}>
                ISSUING OFFICER
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
                  padding: '8px 10px',
                  color: '#fff',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-main)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                MIN ALTITUDE (METERS)
              </label>
              <input
                type="number"
                min="0"
                max="2000"
                required
                value={minAlt}
                onChange={(e) => setMinAlt(Number(e.target.value))}
                style={{
                  width: '100%',
                  background: 'rgba(6, 9, 14, 0.9)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: '4px',
                  padding: '8px 10px',
                  color: '#fff',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-main)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                MAX ALTITUDE (METERS)
              </label>
              <input
                type="number"
                min="10"
                max="5000"
                required
                value={maxAlt}
                onChange={(e) => setMaxAlt(Number(e.target.value))}
                style={{
                  width: '100%',
                  background: 'rgba(6, 9, 14, 0.9)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: '4px',
                  padding: '8px 10px',
                  color: '#fff',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {errorMsg && (
            <div style={{ fontSize: '11px', color: '#f87171', fontFamily: 'var(--font-mono)' }}>
              {errorMsg}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
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
                background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                border: '1px solid #f87171',
                color: '#ffffff',
                padding: '7px 16px',
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                letterSpacing: '0.5px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 0 12px rgba(239, 68, 68, 0.4)',
              }}
            >
              {isSubmitting ? 'ENFORCING...' : 'ACTIVATE TEMPORARY RED ZONE'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

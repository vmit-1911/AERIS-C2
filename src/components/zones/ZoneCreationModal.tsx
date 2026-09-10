import React, { useState } from 'react';
import { GeoJSONGeometry, OperatorRole, ZoneType, CreateZonePayload } from '../../types';
import { ShieldAlert, X, AlertOctagon, Info } from 'lucide-react';

interface ZoneCreationModalProps {
  geometry: GeoJSONGeometry | null;
  operatorId: string;
  operatorRole: OperatorRole;
  onClose: () => void;
  onSubmit: (payload: CreateZonePayload) => Promise<void>;
}

export const ZoneCreationModal: React.FC<ZoneCreationModalProps> = ({
  geometry,
  operatorId,
  operatorRole,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('CIVIL-RESTRICTED-AIRSPACE');
  const [zoneType, setZoneType] = useState<ZoneType>('RED');
  const [hasDuration, setHasDuration] = useState<boolean>(true);
  const [duration, setDuration] = useState<number>(60);
  const [minAlt, setMinAlt] = useState<number>(0);
  const [maxAlt, setMaxAlt] = useState<number>(120);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!geometry) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasDuration && duration < 10) {
      setErrorMsg('Duration must be at least 10 seconds.');
      return;
    }
    if (minAlt >= maxAlt) {
      setErrorMsg('Max altitude must be strictly greater than min altitude.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSubmit({
        name,
        zone_type: zoneType,
        geometry,
        min_altitude: minAlt,
        max_altitude: maxAlt,
        duration_seconds: hasDuration ? duration : undefined,
        operator_id: operatorId,
        role: operatorRole,
      });
      onClose();
    } catch (err) {
      setErrorMsg((err as Error).message || 'Failed to declare active zone');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getBorderColor = () => {
    if (zoneType === 'RED' || zoneType === 'TEMPORARY_RED') return '#f43f5e';
    if (zoneType === 'YELLOW') return '#f59e0b';
    return '#10b981';
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(6, 9, 14, 0.8)',
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
          border: `1px solid ${getBorderColor()}`,
          borderRadius: '6px',
          boxShadow: `0 12px 40px ${getBorderColor()}33`,
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
            background: `${getBorderColor()}20`,
            borderBottom: `1px solid ${getBorderColor()}40`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertOctagon size={16} color={getBorderColor()} />
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '14px',
                letterSpacing: '1px',
                color: '#ffffff',
              }}
            >
              DECLARE & ACTIVATE AIRSPACE ZONE
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
          
          {/* Zone Type Selection */}
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-main)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
              ZONE TYPE / SEVERITY
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setZoneType('RED')}
                style={{
                  padding: '8px',
                  borderRadius: '4px',
                  border: zoneType === 'RED' ? '1px solid #f43f5e' : '1px solid var(--border-dim)',
                  background: zoneType === 'RED' ? 'rgba(244, 63, 94, 0.2)' : 'rgba(9, 15, 24, 0.6)',
                  color: zoneType === 'RED' ? '#fecaca' : 'var(--text-muted)',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🔴 RED ZONE (No-Fly Violation)
              </button>

              <button
                type="button"
                onClick={() => setZoneType('YELLOW')}
                style={{
                  padding: '8px',
                  borderRadius: '4px',
                  border: zoneType === 'YELLOW' ? '1px solid #f59e0b' : '1px solid var(--border-dim)',
                  background: zoneType === 'YELLOW' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(9, 15, 24, 0.6)',
                  color: zoneType === 'YELLOW' ? '#fef3c7' : 'var(--text-muted)',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🟡 YELLOW ZONE (Advisory Buffer)
              </button>
            </div>
          </div>

          {/* Name */}
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-main)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
              ZONE NAME / DESIGNATION
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

          {/* Altitude Envelope */}
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
                min="1"
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

          {/* Expiration Options */}
          <div
            style={{
              padding: '10px',
              background: 'rgba(15, 23, 42, 0.6)',
              borderRadius: '4px',
              border: '1px solid var(--border-dim)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <input
                type="checkbox"
                id="hasDuration"
                checked={hasDuration}
                onChange={(e) => setHasDuration(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="hasDuration" style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 600 }}>
                Enable Automatic Expiry Timer
              </label>
            </div>

            {hasDuration && (
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: '4px' }}>
                  DURATION (SECONDS)
                </label>
                <input
                  type="number"
                  min="10"
                  max="86400"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  style={{
                    width: '100%',
                    background: 'rgba(6, 9, 14, 0.9)',
                    border: '1px solid var(--border-focus)',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    color: 'var(--accent-cyan)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    fontWeight: 700,
                    outline: 'none',
                  }}
                />
              </div>
            )}
          </div>

          <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Info size={11} color="var(--accent-cyan)" />
            <span>Issuing Officer: {operatorId} ({operatorRole})</span>
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
                background: zoneType === 'RED'
                  ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
                  : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: `1px solid ${getBorderColor()}`,
                color: '#ffffff',
                padding: '7px 16px',
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                letterSpacing: '0.5px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: `0 0 12px ${getBorderColor()}66`,
              }}
            >
              {isSubmitting ? 'ENFORCING...' : `ACTIVATE ${zoneType} ZONE`}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

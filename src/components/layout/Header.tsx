import React, { useEffect, useState } from 'react';
import { Shield, Radio, AlertTriangle, Clock, PlusCircle } from 'lucide-react';
import { ConnectionStatus, OperatorRole } from '../../types';

interface HeaderProps {
  connectionStatus: ConnectionStatus;
  activeTracksCount: number;
  openAlertsCount: number;
  operatorId: string;
  setOperatorId: (id: string) => void;
  operatorRole: OperatorRole;
  setOperatorRole: (role: OperatorRole) => void;
  onOpenDrawZone: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  connectionStatus,
  activeTracksCount,
  openAlertsCount,
  operatorId,
  setOperatorId,
  operatorRole,
  setOperatorRole,
  onOpenDrawZone,
}) => {
  const [utcTime, setUtcTime] = useState<string>('--:--:-- UTC');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().split(' ')[4] + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = () => {
    if (connectionStatus === 'ONLINE') {
      return {
        text: 'SYSTEM ONLINE',
        bg: 'rgba(16, 185, 129, 0.12)',
        border: 'rgba(16, 185, 129, 0.4)',
        dot: '#10b981',
        textCol: '#34d399',
      };
    } else if (connectionStatus === 'RECONNECTING') {
      return {
        text: 'RECONNECTING...',
        bg: 'rgba(234, 179, 8, 0.12)',
        border: 'rgba(234, 179, 8, 0.4)',
        dot: '#eab308',
        textCol: '#facc15',
      };
    } else {
      return {
        text: 'SYSTEM OFFLINE',
        bg: 'rgba(239, 68, 68, 0.12)',
        border: 'rgba(239, 68, 68, 0.4)',
        dot: '#ef4444',
        textCol: '#f87171',
      };
    }
  };

  const statusMeta = getStatusBadge();

  return (
    <header
      style={{
        height: '54px',
        background: '#090f18',
        borderBottom: '1px solid rgba(56, 189, 248, 0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 100,
        flexShrink: 0,
      }}
    >
      {/* Brand Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            background: 'linear-gradient(135deg, #00f2fe 0%, #0369a1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(0, 242, 254, 0.35)',
          }}
        >
          <Shield size={18} color="#06090e" strokeWidth={2.5} />
        </div>
        <div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '16px',
              letterSpacing: '1.5px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            AERIS-C2
            <span
              style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                background: 'rgba(0, 242, 254, 0.15)',
                color: 'var(--accent-cyan)',
                border: '1px solid rgba(0, 242, 254, 0.3)',
                padding: '1px 5px',
                borderRadius: '3px',
              }}
            >
              CIVIL DEFENSE
            </span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            Airspace Surveillance & Threat Alerting Console
          </div>
        </div>
      </div>

      {/* Operator Controls & Action Trigger */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(17, 27, 39, 0.8)',
            border: '1px solid var(--border-dim)',
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <span style={{ color: 'var(--text-dim)' }}>OP:</span>
          <input
            type="text"
            value={operatorId}
            onChange={(e) => setOperatorId(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--accent-cyan)',
              width: '80px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
            }}
          />
          <select
            value={operatorRole}
            onChange={(e) => setOperatorRole(e.target.value as OperatorRole)}
            style={{
              background: 'rgba(6, 9, 14, 0.8)',
              border: '1px solid var(--border-dim)',
              color: 'var(--text-main)',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              padding: '2px 4px',
              borderRadius: '3px',
              outline: 'none',
            }}
          >
            <option value="OPERATOR">OPERATOR</option>
            <option value="SUPERVISOR">SUPERVISOR</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>

        <button
          onClick={onOpenDrawZone}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(244, 63, 94, 0.3) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            color: '#fecaca',
            fontSize: '11px',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            letterSpacing: '0.5px',
            padding: '5px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#ef4444';
            e.currentTarget.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <PlusCircle size={13} color="#f87171" />
          DRAW & DECLARE ZONE
        </button>
      </div>

      {/* System Status & Metrics Pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Connection Status Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: statusMeta.bg,
            border: `1px solid ${statusMeta.border}`,
            padding: '4px 9px',
            borderRadius: '4px',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            color: statusMeta.textCol,
          }}
        >
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: statusMeta.dot,
              boxShadow: `0 0 6px ${statusMeta.dot}`,
            }}
          />
          {statusMeta.text}
        </div>

        {/* Tracks Metric */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(17, 27, 39, 0.8)',
            border: '1px solid var(--border-dim)',
            padding: '4px 9px',
            borderRadius: '4px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <Radio size={12} color="var(--accent-blue)" />
          <span style={{ color: 'var(--text-dim)', fontSize: '10px' }}>TRACKS:</span>
          <span style={{ color: '#fff', fontWeight: 700 }}>{activeTracksCount.toString().padStart(2, '0')}</span>
        </div>

        {/* Alerts Metric */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: openAlertsCount > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(17, 27, 39, 0.8)',
            border: openAlertsCount > 0 ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid var(--border-dim)',
            padding: '4px 9px',
            borderRadius: '4px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <AlertTriangle size={12} color={openAlertsCount > 0 ? '#ef4444' : 'var(--text-dim)'} />
          <span style={{ color: openAlertsCount > 0 ? '#fca5a5' : 'var(--text-dim)', fontSize: '10px' }}>ALERTS:</span>
          <span style={{ color: openAlertsCount > 0 ? '#ef4444' : '#fff', fontWeight: 700 }}>
            {openAlertsCount.toString().padStart(2, '0')}
          </span>
        </div>

        {/* Clock */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--accent-cyan)',
            padding: '4px 8px',
          }}
        >
          <Clock size={12} color="var(--accent-cyan)" />
          <span>{utcTime}</span>
        </div>
      </div>
    </header>
  );
};

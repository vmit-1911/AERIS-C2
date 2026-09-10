import React from 'react';
import { Radio, AlertTriangle, Video, ShieldAlert, FileSearch } from 'lucide-react';

export type SidebarTabId = 'tracks' | 'alerts' | 'evidence' | 'vision' | 'audit';

interface SidebarTabsProps {
  activeTab: SidebarTabId;
  setActiveTab: (tab: SidebarTabId) => void;
  tracksCount: number;
  alertsCount: number;
  evidenceCount: number;
}

export const SidebarTabs: React.FC<SidebarTabsProps> = ({
  activeTab,
  setActiveTab,
  tracksCount,
  alertsCount,
  evidenceCount,
}) => {
  const tabs = [
    { id: 'tracks' as const, label: 'Tracks', icon: Radio, count: tracksCount, badgeColor: 'cyan' },
    { id: 'alerts' as const, label: 'Alerts', icon: AlertTriangle, count: alertsCount, badgeColor: 'red' },
    { id: 'evidence' as const, label: 'Evidence', icon: FileSearch, count: evidenceCount, badgeColor: 'purple' },
    { id: 'vision' as const, label: 'Camera', icon: Video, count: null, badgeColor: null },
    { id: 'audit' as const, label: 'Audit Log', icon: ShieldAlert, count: null, badgeColor: null },
  ];

  return (
    <div
      style={{
        display: 'flex',
        background: '#090f18',
        borderBottom: '1px solid var(--border-dim)',
        padding: '4px 4px 0 4px',
        gap: '2px',
        flexShrink: 0,
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '8px 2px',
              background: isActive ? '#0d1623' : 'transparent',
              borderTop: isActive ? '2px solid var(--accent-cyan)' : '2px solid transparent',
              borderLeft: isActive ? '1px solid var(--border-dim)' : '1px solid transparent',
              borderRight: isActive ? '1px solid var(--border-dim)' : '1px solid transparent',
              borderBottom: 'none',
              borderTopLeftRadius: '4px',
              borderTopRightRadius: '4px',
              color: isActive ? '#ffffff' : 'var(--text-muted)',
              fontSize: '10px',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              letterSpacing: '0.3px',
              cursor: 'pointer',
              transition: 'all 0.15s',
              minWidth: 0,
            }}
          >
            <Icon size={11} color={isActive ? 'var(--accent-cyan)' : 'var(--text-dim)'} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {tab.label}
            </span>
            {tab.count !== null && (
              <span
                style={{
                  fontSize: '9px',
                  fontFamily: 'var(--font-mono)',
                  padding: '0 4px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  background:
                    tab.badgeColor === 'red' && tab.count > 0
                      ? '#ef4444'
                      : tab.badgeColor === 'purple' && tab.count > 0
                      ? '#a855f7'
                      : isActive
                      ? 'rgba(0, 242, 254, 0.2)'
                      : 'rgba(255, 255, 255, 0.1)',
                  color:
                    (tab.badgeColor === 'red' || tab.badgeColor === 'purple') && tab.count > 0
                      ? '#ffffff'
                      : isActive
                      ? 'var(--accent-cyan)'
                      : 'var(--text-muted)',
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import TacticalMap from './components/TacticalMap';
import AlertQueue from './components/AlertQueue';
import PTZCameraPIP from './components/PTZCameraPIP';
import AuditLogModal from './components/AuditLogModal';

export default function App() {
  const [c2Data, setC2Data] = useState({
    active_tracks: [],
    active_trzs: [],
    base_zones: [],
    active_alerts: [],
    metrics: {},
    vision_status: {},
    recent_audit_records: []
  });

  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [centerTarget, setCenterTarget] = useState(null);
  const [selectedTargetId, setSelectedTargetId] = useState(null);
  const [cameraMode, setCameraMode] = useState('FREE_TACTICAL'); // FREE_TACTICAL | FOLLOW_TARGET | FPV_CHASE
  const [isMobileQueueOpen, setIsMobileQueueOpen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef(null);

  // WebSocket Connection to Backend Console Router
  useEffect(() => {
    const connectWs = () => {
      const host = window.location.hostname || 'localhost';
      const port = window.location.port === '5173' ? '8000' : (window.location.port || '8000');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${host}:${port}/ws/console`;

      console.log(`[C2 CONSOLE] Connecting to backend WebSocket: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        console.log('[C2 CONSOLE] WebSocket Connected.');
      };

      ws.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          setC2Data(payload);
        } catch (err) {
          console.error('[C2 CONSOLE] Error parsing WS payload:', err);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        console.log('[C2 CONSOLE] WebSocket Disconnected. Reconnecting in 2s...');
        setTimeout(connectWs, 2000);
      };

      ws.onerror = (err) => {
        console.error('[C2 CONSOLE] WebSocket error:', err);
      };
    };

    connectWs();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Handle TRZ Creation API
  const handleCreateTrz = async (reqPayload) => {
    try {
      const res = await fetch('/api/trz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqPayload)
      });
      if (!res.ok) throw new Error('Failed to enact TRZ');
      const data = await res.json();
      console.log('[C2 CONSOLE] Rule 24 TRZ Enacted:', data);
    } catch (err) {
      alert(`Error enacting Rule 24 TRZ: ${err.message}`);
    }
  };

  // Handle Alert Disposition Action
  const handleAlertDisposition = async (dispositionReq) => {
    try {
      const res = await fetch('/api/alert/disposition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dispositionReq)
      });
      if (!res.ok) throw new Error('Failed to record disposition');
      const data = await res.json();
      console.log('[C2 CONSOLE] Alert Disposition Committed:', data);
    } catch (err) {
      alert(`Error recording alert disposition: ${err.message}`);
    }
  };

  // Handle BSA Section 65B Dossier Export Download
  const handleExportBsaDossier = () => {
    window.open('/api/audit/export', '_blank');
  };

  const handleCenterAndSelectTarget = (targetPos, uasId) => {
    setCenterTarget(targetPos);
    if (uasId) setSelectedTargetId(uasId);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#070b14] overflow-hidden select-none">
      {/* Top Tactical Command Bar */}
      <Header
        metrics={c2Data.metrics}
        onOpenAuditModal={() => setIsAuditModalOpen(true)}
        onExportBsaDossier={handleExportBsaDossier}
        isMobileQueueOpen={isMobileQueueOpen}
        onToggleMobileQueue={() => setIsMobileQueueOpen(!isMobileQueueOpen)}
      />

      {/* Main Workspace Layout */}
      <div className="relative flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Central 3D Tactical Map Viewport */}
        <div className="flex-1 relative h-full w-full">
          <TacticalMap
            activeTracks={c2Data.active_tracks}
            activeTrzs={c2Data.active_trzs}
            baseZones={c2Data.base_zones}
            onCenterTarget={centerTarget}
            selectedTargetId={selectedTargetId}
            onCreateTrz={handleCreateTrz}
            cameraMode={cameraMode}
            setCameraMode={setCameraMode}
          />

          {/* Optical PTZ Camera PIP Overlay */}
          <PTZCameraPIP
            visionStatus={c2Data.vision_status}
            isDarkTargetActive={c2Data.active_alerts?.some(a => a.status === 'DARK_TARGET_DETECTED')}
          />
        </div>

        {/* Live Alert & Triage Sidebar (Responsive Drawer on Mobile) */}
        <AlertQueue
          activeAlerts={c2Data.active_alerts}
          onCenterTarget={handleCenterAndSelectTarget}
          onAlertDisposition={handleAlertDisposition}
          isMobileQueueOpen={isMobileQueueOpen}
          setIsMobileQueueOpen={setIsMobileQueueOpen}
        />
      </div>

      {/* Forensic Audit Ledger Modal */}
      <AuditLogModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        auditRecords={c2Data.recent_audit_records}
        onExportBsaDossier={handleExportBsaDossier}
      />
    </div>
  );
}


import React, { useState, useCallback, useEffect } from 'react';
import { Header } from '../components/layout/Header';
import { SidebarTabs, SidebarTabId } from '../components/layout/SidebarTabs';
import { TacticalMap } from '../components/map/TacticalMap';
import { TrackList } from '../components/tracks/TrackList';
import { DroneDetailPanel } from '../components/telemetry/DroneDetailPanel';
import { AlertQueue } from '../components/alerts/AlertQueue';
import { DispositionModal } from '../components/alerts/DispositionModal';
import { ZoneCreationModal } from '../components/zones/ZoneCreationModal';
import { CameraPanel } from '../components/camera/CameraPanel';
import { AuditLog } from '../components/audit/AuditLog';
import { EvidenceAuditLog } from '../components/audit/EvidenceAuditLog';

import { useDashboardSocket } from '../hooks/useDashboardSocket';
import { useTracks } from '../hooks/useTracks';
import {
  Zone,
  Alert,
  AuditEvent,
  EvidenceRecord,
  VisionObservation,
  VisionModelStatus,
  OperatorRole,
  ReasonCode,
  GeoJSONGeometry,
  CreateZonePayload,
  DashboardWebSocketMessage,
} from '../types';
import {
  submitAlertDisposition,
  createZone,
  simulateDronePosition,
  fetchAuditLog,
} from '../services/api';

export const Dashboard: React.FC = () => {
  // Operator Identity
  const [operatorId, setOperatorId] = useState<string>('OFFICER-101');
  const [operatorRole, setOperatorRole] = useState<OperatorRole>('OPERATOR');

  // UI State
  const [activeTab, setActiveTab] = useState<SidebarTabId>('tracks');
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false);
  const [drawnGeometry, setDrawnGeometry] = useState<GeoJSONGeometry | null>(null);
  const [isSimulationMode, setIsSimulationMode] = useState<boolean>(false);

  // Modal State
  const [selectedAlertForDisp, setSelectedAlertForDisp] = useState<Alert | null>(null);
  const [dispAction, setDispAction] = useState<'CONFIRM' | 'DISMISS' | 'ESCALATE' | null>(null);
  const [isZoneCreationModalOpen, setIsZoneCreationModalOpen] = useState<boolean>(false);

  // Data State
  const {
    tracks,
    tracksList,
    trails,
    selectedDroneId,
    selectedTrack,
    followDrone,
    selectTrack,
    updateTrack,
    setInitialTracks,
    toggleFollow,
  } = useTracks();

  const [zones, setZones] = useState<Zone[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [evidenceLog, setEvidenceLog] = useState<EvidenceRecord[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);
  const [visionObservations, setVisionObservations] = useState<VisionObservation[]>([]);
  const [visionModelStatus, setVisionModelStatus] = useState<VisionModelStatus | null>(null);

  // 1. Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback(
    (msg: DashboardWebSocketMessage) => {
      switch (msg.type) {
        case 'initial_state':
          setInitialTracks(msg.tracks || []);
          if (msg.zones) setZones(msg.zones);
          if (msg.alerts) setAlerts(msg.alerts);
          if (msg.audit_log) setAuditLog(msg.audit_log);
          if (msg.evidence) setEvidenceLog(msg.evidence);
          if (msg.vision_observations) setVisionObservations(msg.vision_observations);
          if (msg.vision_model_status) setVisionModelStatus(msg.vision_model_status);
          break;

        case 'track_update':
          updateTrack(msg.track);
          break;

        case 'alert_update':
          setAlerts((prev) => {
            const index = prev.findIndex((a) => a.alert_id === msg.alert.alert_id);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = msg.alert;
              return updated;
            }
            return [msg.alert, ...prev];
          });
          if (msg.audit_entry) {
            setAuditLog((prev) => [...prev, msg.audit_entry!]);
          }
          break;

        case 'evidence_created':
          setEvidenceLog((prev) => [msg.evidence, ...prev]);
          break;

        case 'zone_created':
          setZones((prev) => {
            const exists = prev.some((z) => z.zone_id === msg.zone.zone_id);
            if (exists) {
              return prev.map((z) => (z.zone_id === msg.zone.zone_id ? msg.zone : z));
            }
            return [msg.zone, ...prev];
          });
          if (msg.audit_entry) {
            setAuditLog((prev) => [...prev, msg.audit_entry!]);
          }
          break;

        case 'zones_updated':
          setZones(msg.zones || []);
          break;

        case 'vision_observation':
          setVisionObservations((prev) => [...prev, msg.observation]);
          break;
      }
    },
    [setInitialTracks, updateTrack]
  );

  const { connectionStatus } = useDashboardSocket(handleWebSocketMessage);

  // Periodic zone timer countdown helper
  useEffect(() => {
    const timer = setInterval(() => {
      setZones((prev) =>
        prev.map((z) => {
          if (typeof z.remaining_seconds === 'number' && z.remaining_seconds > 0) {
            const nextSec = z.remaining_seconds - 1;
            if (nextSec <= 0) {
              return { ...z, remaining_seconds: 0, active: false };
            }
            return { ...z, remaining_seconds: nextSec };
          }
          if (typeof z.remaining_seconds === 'number' && z.remaining_seconds <= 0 && z.active) {
            return { ...z, active: false };
          }
          return z;
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handlers for Operator Actions
  const handleOpenDrawZone = () => {
    setIsDrawingMode(true);
  };

  const handleFinishDrawing = (geometry: GeoJSONGeometry) => {
    setDrawnGeometry(geometry);
    setIsDrawingMode(false);
    setIsZoneCreationModalOpen(true);
  };

  const handleCancelDrawing = () => {
    setIsDrawingMode(false);
    setDrawnGeometry(null);
  };

  const handleSubmitZone = async (payload: CreateZonePayload) => {
    await createZone(payload);

    // Refresh audit log
    const updatedAudit = await fetchAuditLog().catch(() => []);
    if (updatedAudit.length > 0) setAuditLog(updatedAudit);
  };

  const handleSimulatePosition = async (trackId: string, lat: number, lng: number) => {
    try {
      const res = await simulateDronePosition(trackId, {
        latitude: lat,
        longitude: lng,
        operator_id: operatorId,
        role: operatorRole,
      });
      if (res.track) updateTrack(res.track);
      if (res.alert) {
        setAlerts((prev) => {
          const idx = prev.findIndex((a) => a.alert_id === res.alert!.alert_id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = res.alert!;
            return copy;
          }
          return [res.alert!, ...prev];
        });
      }
      if (res.evidence) {
        setEvidenceLog((prev) => [res.evidence!, ...prev]);
      }
    } catch (err) {
      console.error('[Simulate Position Error]', err);
    }
  };

  const handleOpenDisposition = (alert: Alert, action: 'CONFIRM' | 'DISMISS' | 'ESCALATE') => {
    setSelectedAlertForDisp(alert);
    setDispAction(action);
  };

  const handleSubmitDisposition = async (
    alertId: string,
    action: 'CONFIRM' | 'DISMISS' | 'ESCALATE',
    reasonCode: ReasonCode
  ) => {
    const updatedAlert = await submitAlertDisposition(alertId, {
      action,
      reason_code: reasonCode,
      operator_id: operatorId,
      role: operatorRole,
    });

    setAlerts((prev) => prev.map((a) => (a.alert_id === alertId ? updatedAlert : a)));

    // Refresh audit log
    const updatedAudit = await fetchAuditLog().catch(() => []);
    if (updatedAudit.length > 0) setAuditLog(updatedAudit);
  };

  const handleSelectDrone = (droneId: string | null) => {
    selectTrack(droneId);
  };

  const handleNewVisionObservation = (obs: VisionObservation) => {
    setVisionObservations((prev) => [...prev, obs]);
  };

  const openAlertsCount = alerts.filter((a) => a.status === 'OPEN' || a.status === 'ESCALATED').length;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        background: 'var(--bg-primary)',
        overflow: 'hidden',
      }}
    >
      {/* 1. Header Bar */}
      <Header
        connectionStatus={connectionStatus}
        activeTracksCount={tracksList.length}
        openAlertsCount={openAlertsCount}
        operatorId={operatorId}
        setOperatorId={setOperatorId}
        operatorRole={operatorRole}
        setOperatorRole={setOperatorRole}
        onOpenDrawZone={handleOpenDrawZone}
      />

      {/* 2. Main Workspace Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        
        {/* 2a. Left Operations Sidebar (340px) */}
        <aside
          style={{
            width: '340px',
            background: 'var(--bg-secondary)',
            borderRight: '1px solid var(--border-dim)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 200,
            flexShrink: 0,
          }}
        >
          <SidebarTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tracksCount={tracksList.length}
            alertsCount={openAlertsCount}
            evidenceCount={evidenceLog.length}
          />

          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            {activeTab === 'tracks' && (
              <TrackList
                tracks={tracksList}
                selectedDroneId={selectedDroneId}
                onSelectDrone={handleSelectDrone}
              />
            )}

            {activeTab === 'alerts' && (
              <AlertQueue
                alerts={alerts}
                onSelectDrone={handleSelectDrone}
                onOpenDisposition={handleOpenDisposition}
              />
            )}

            {activeTab === 'evidence' && (
              <EvidenceAuditLog evidenceRecords={evidenceLog} />
            )}

            {activeTab === 'vision' && (
              <CameraPanel
                observations={visionObservations}
                modelStatus={visionModelStatus}
                tracks={tracks}
                onNewObservation={handleNewVisionObservation}
              />
            )}

            {activeTab === 'audit' && (
              <AuditLog auditEvents={auditLog} />
            )}
          </div>
        </aside>

        {/* 2b. Dominant Tactical Map Surface */}
        <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <TacticalMap
            tracks={tracks}
            trails={trails}
            zones={zones}
            selectedDroneId={selectedDroneId}
            onSelectDrone={handleSelectDrone}
            followDrone={followDrone}
            onToggleFollow={toggleFollow}
            isDrawingMode={isDrawingMode}
            onFinishDrawing={handleFinishDrawing}
            onCancelDrawing={handleCancelDrawing}
            isDetailPanelOpen={!!selectedTrack}
            isSimulationMode={isSimulationMode}
            onToggleSimulationMode={() => setIsSimulationMode(!isSimulationMode)}
            onSimulatePosition={handleSimulatePosition}
          />

          {/* 2c. Floating Selected Drone Inspection Detail Panel */}
          {selectedTrack && (
            <DroneDetailPanel
              track={selectedTrack}
              onClose={() => selectTrack(null)}
            />
          )}
        </main>

      </div>

      {/* 3. Operator Disposition Modal */}
      {selectedAlertForDisp && dispAction && (
        <DispositionModal
          alert={selectedAlertForDisp}
          action={dispAction}
          operatorId={operatorId}
          operatorRole={operatorRole}
          onClose={() => {
            setSelectedAlertForDisp(null);
            setDispAction(null);
          }}
          onSubmit={handleSubmitDisposition}
        />
      )}

      {/* 4. Zone Creation & Declaration Modal */}
      {isZoneCreationModalOpen && drawnGeometry && (
        <ZoneCreationModal
          geometry={drawnGeometry}
          operatorId={operatorId}
          operatorRole={operatorRole}
          onClose={() => {
            setIsZoneCreationModalOpen(false);
            setDrawnGeometry(null);
          }}
          onSubmit={handleSubmitZone}
        />
      )}
    </div>
  );
};

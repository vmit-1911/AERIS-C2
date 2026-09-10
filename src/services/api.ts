import {
  Track,
  Zone,
  Alert,
  AuditEvent,
  EvidenceRecord,
  VisionObservation,
  VisionModelStatus,
  TempRedZonePayload,
  CreateZonePayload,
  SimulatePositionPayload,
  AlertDispositionPayload,
} from '../types';

const API_BASE = ''; // uses proxy in dev, relative path in production

// ─── Tracks ───────────────────────────────────────────────
export async function fetchTracks(): Promise<Track[]> {
  const res = await fetch(`${API_BASE}/api/tracks`);
  if (!res.ok) throw new Error('Failed to fetch tracks');
  const data = await res.json();
  return data.tracks || [];
}

/**
 * SIMULATION / DEMO ONLY.
 * Sends a simulated position update for a track to the backend.
 * The backend will re-run geofence, classification, alert, and evidence logic.
 */
export async function simulateDronePosition(
  trackId: string,
  payload: SimulatePositionPayload
): Promise<{ track: Track; alert: Alert | null; evidence: EvidenceRecord | null }> {
  const res = await fetch(
    `${API_BASE}/api/tracks/${encodeURIComponent(trackId)}/simulate-position`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to simulate position');
  }
  return res.json();
}

// ─── Zones ────────────────────────────────────────────────
export async function fetchZones(): Promise<Zone[]> {
  const res = await fetch(`${API_BASE}/api/zones`);
  if (!res.ok) throw new Error('Failed to fetch zones');
  const data = await res.json();
  return data.zones || [];
}

/** Create any zone type: RED, YELLOW, TEMPORARY_RED, GREEN */
export async function createZone(payload: CreateZonePayload): Promise<Zone> {
  const res = await fetch(`${API_BASE}/api/zones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to create zone');
  }
  const data = await res.json();
  return data.zone;
}

/** Backward-compatible temporary red zone creation */
export async function createTemporaryRedZone(payload: TempRedZonePayload): Promise<Zone> {
  const res = await fetch(`${API_BASE}/api/zones/temporary-red`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to create temporary red zone');
  }
  const data = await res.json();
  return data.zone;
}

/** Deactivate a zone (does not delete — preserves history) */
export async function deactivateZone(
  zoneId: string,
  operatorId: string,
  role = 'OPERATOR'
): Promise<Zone> {
  const res = await fetch(
    `${API_BASE}/api/zones/${encodeURIComponent(zoneId)}/deactivate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operator_id: operatorId, role }),
    }
  );
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to deactivate zone');
  }
  const data = await res.json();
  return data.zone;
}

// ─── Alerts ───────────────────────────────────────────────
export async function fetchAlerts(): Promise<Alert[]> {
  const res = await fetch(`${API_BASE}/api/alerts`);
  if (!res.ok) throw new Error('Failed to fetch alerts');
  const data = await res.json();
  return data.alerts || [];
}

export async function submitAlertDisposition(
  alertId: string,
  payload: AlertDispositionPayload
): Promise<Alert> {
  const res = await fetch(
    `${API_BASE}/api/alerts/${encodeURIComponent(alertId)}/disposition`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to submit disposition');
  }
  const data = await res.json();
  return data.alert;
}

// ─── Evidence ─────────────────────────────────────────────
export async function fetchEvidence(): Promise<EvidenceRecord[]> {
  const res = await fetch(`${API_BASE}/api/evidence`);
  if (!res.ok) throw new Error('Failed to fetch evidence');
  const data = await res.json();
  return data.evidence || [];
}

export function getEvidenceExportUrl(format: 'csv' | 'json' = 'json'): string {
  return `/api/evidence/export?format=${format}`;
}

// ─── Audit ────────────────────────────────────────────────
export async function fetchAuditLog(): Promise<AuditEvent[]> {
  const res = await fetch(`${API_BASE}/api/audit`);
  if (!res.ok) throw new Error('Failed to fetch audit log');
  const data = await res.json();
  return data.audit_log || [];
}

export function getAuditExportUrl(format: 'csv' | 'json' = 'csv'): string {
  return `/api/audit/export?format=${format}`;
}

// ─── Vision ───────────────────────────────────────────────
export async function fetchVisionStatus(): Promise<{
  model_status: VisionModelStatus;
  observation_count: number;
  detector_class: string;
}> {
  const res = await fetch(`${API_BASE}/api/vision/status`);
  if (!res.ok) throw new Error('Failed to fetch vision status');
  return res.json();
}

export async function triggerVisionDetect(payload?: {
  camera_id?: string;
  detected_class?: string;
  confidence?: number;
  bbox?: [number, number, number, number];
}): Promise<VisionObservation> {
  const res = await fetch(`${API_BASE}/api/vision/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      payload || {
        camera_id: 'CAM-01',
        detected_class: 'drone',
        confidence: 0.94,
        bbox: [180.0, 110.0, 310.0, 220.0],
      }
    ),
  });
  if (!res.ok) throw new Error('Failed to trigger vision detection');
  const data = await res.json();
  return data.observation;
}

export async function uploadVisionFrame(payload: {
  camera_id?: string;
  confidence?: number;
  filename?: string;
  frame_data_b64?: string | null;
}): Promise<VisionObservation> {
  const res = await fetch(`${API_BASE}/api/vision/upload-frame`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to upload vision frame');
  const data = await res.json();
  return data.observation;
}

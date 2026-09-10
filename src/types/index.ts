// AERIS-C2 Tactical Civil Security System Types

export type CanonicalClassification = 'AUTHORISED' | 'UNREGISTERED' | 'OUT_OF_ENVELOPE' | 'LOST_LINK';
export type AuthorizationStatus = 'ACTIVE' | 'REVOKED' | 'UNAUTHORIZED';
export type GeofenceStatus = 'COMPLIANT' | 'RED_ZONE_VIOLATION' | 'ALTITUDE_ENVELOPE_VIOLATION' | 'UNRESTRICTED_OPEN_AIRSPACE';
export type ZoneType = 'GREEN' | 'YELLOW' | 'RED' | 'TEMPORARY_RED';
export type AlertPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type AlertStatus = 'OPEN' | 'CONFIRMED' | 'DISMISSED' | 'ESCALATED' | 'RESOLVED';
export type OperatorRole = 'OPERATOR' | 'SUPERVISOR' | 'ADMIN';
export type ConnectionStatus = 'ONLINE' | 'RECONNECTING' | 'OFFLINE';

export type ReasonCode =
  | 'CONFIRMED_VIOLATION'
  | 'AUTHORIZED_OPERATION'
  | 'FALSE_POSITIVE'
  | 'DUPLICATE_ALERT'
  | 'LOST_LINK_RESOLVED'
  | 'IDENTITY_VERIFIED'
  | 'ESCALATED_TO_SUPERVISOR'
  | 'OTHER';

export interface GeoJSONGeometry {
  type: 'Polygon';
  coordinates: number[][][]; // GeoJSON: [ [ [lng, lat], ... ] ]
}

export interface Telemetry {
  drone_id: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  heading: number;
  timestamp?: string;
  battery_level?: number;
  source?: string;
}

export interface DroneRegistryEntry {
  registration: string;
  operator: string;
  authorization_status: AuthorizationStatus;
  drone_type: string;
  classification: string;
  is_registered: boolean;
}

export interface Track {
  track_id: string;
  drone_id: string;
  registration: string;
  operator: string;
  drone_type: string;
  classification: string;
  telemetry_source: string;

  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  heading: number;
  timestamp: string;

  authorization_status: AuthorizationStatus;
  current_classification: CanonicalClassification;
  first_seen: string;
  last_seen: string;
  link_status: 'CONNECTED' | 'LOST_LINK';

  current_zone_id?: string | null;
  current_zone_name?: string | null;
  current_zone_type?: ZoneType | string | null;
  min_altitude?: number;
  max_altitude?: number;
  altitude_inside?: boolean;
  geofence_status: GeofenceStatus | string;
}

export interface Zone {
  zone_id: string;
  name: string;
  zone_type: ZoneType;
  geometry: GeoJSONGeometry;
  active: boolean;
  created_at: string;
  expires_at?: string | null;
  remaining_seconds?: number | null;
  min_altitude: number;
  max_altitude: number;
  operator_id?: string;
  declared_at?: string;
}

export interface Alert {
  alert_id: string;
  drone_id: string;
  track_id: string;
  classification: CanonicalClassification | string;
  priority: AlertPriority;
  reason: string;
  suggested_action: string;
  latitude: number;
  longitude: number;
  altitude: number;
  timestamp: string;
  status: AlertStatus;
  operator_disposition?: {
    action: string;
    reason_code: ReasonCode;
    operator_id: string;
    role: OperatorRole;
    timestamp: string;
  } | null;
}

export interface AlertDispositionPayload {
  action: 'CONFIRM' | 'DISMISS' | 'ESCALATE';
  reason_code: ReasonCode;
  operator_id: string;
  role: OperatorRole;
}

export interface AuditEvent {
  event_id: string;
  timestamp: string;
  operator_id: string;
  role: string;
  action: string;
  alert_id?: string | null;
  track_id?: string | null;
  reason?: string | null;
}

// Evidence record generated when a drone enters a RED/YELLOW/TEMP_RED zone
export interface CameraEvidenceRef {
  observation_id: string;
  camera_id: string;
  timestamp: string;
  detected_class: string;
  confidence: number;
  bbox?: number[];
  is_mock: boolean;
  note: string;
}

export interface EvidenceRecord {
  evidence_id: string;
  timestamp: string;
  event_type: 'ZONE_ENTRY' | 'ZONE_EXIT';
  track_id: string;
  drone_id: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  heading: number;
  zone_id: string;
  zone_name: string;
  zone_type: ZoneType | string;
  classification: CanonicalClassification | string;
  registration: string;
  operator: string;
  telemetry_source: string;
  /** 'NOT_AVAILABLE' or a CameraEvidenceRef object */
  camera_evidence: 'NOT_AVAILABLE' | CameraEvidenceRef;
}

export interface VisionCorrelation {
  status: 'CORRELATED' | 'POTENTIAL MATCH' | 'UNMATCHED';
  correlated_drone_id?: string | null;
  correlated_track_id?: string | null;
  notes?: string;
}

export interface VisionObservation {
  observation_id: string;
  camera_id: string;
  timestamp: string;
  class: string;
  confidence: number;
  bbox: [number, number, number, number];
  is_mock?: boolean;
  correlation: VisionCorrelation;
}

export interface VisionModelStatus {
  status: string;
  model_name: string;
  precision: string;
  recall: string;
  confidence_threshold: number;
  notes: string;
}

export interface TempRedZonePayload {
  name: string;
  geometry: GeoJSONGeometry;
  duration_seconds: number;
  min_altitude: number;
  max_altitude: number;
  operator_id: string;
  role: OperatorRole;
}

export interface CreateZonePayload {
  name: string;
  zone_type: ZoneType;
  geometry: GeoJSONGeometry;
  min_altitude: number;
  max_altitude: number;
  duration_seconds?: number;
  operator_id: string;
  role: OperatorRole;
}

export interface SimulatePositionPayload {
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  operator_id?: string;
  role?: OperatorRole;
}

// WebSocket message schemas from backend (/ws/dashboard)
export type DashboardWebSocketMessage =
  | {
      type: 'initial_state';
      tracks: Track[];
      zones: Zone[];
      alerts: Alert[];
      audit_log: AuditEvent[];
      evidence: EvidenceRecord[];
      vision_observations: VisionObservation[];
      vision_model_status: VisionModelStatus;
      retention_days: number;
      timestamp: string;
    }
  | {
      type: 'track_update';
      track: Track;
    }
  | {
      type: 'alert_update';
      alert: Alert;
      audit_entry?: AuditEvent;
    }
  | {
      type: 'zone_created';
      zone: Zone;
      audit_entry?: AuditEvent;
    }
  | {
      type: 'zones_updated';
      zones: Zone[];
      expired_ids?: string[];
    }
  | {
      type: 'vision_observation';
      observation: VisionObservation;
    }
  | {
      type: 'evidence_created';
      evidence: EvidenceRecord;
    };

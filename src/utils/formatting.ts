import { CanonicalClassification, ZoneType, AlertPriority } from '../types';

export function formatTimestamp(isoString?: string | null): string {
  if (!isoString) return '--:--:--';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleTimeString('en-GB', { hour12: false });
  } catch {
    return isoString;
  }
}

export function formatFullDateTime(isoString?: string | null): string {
  if (!isoString) return '--';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  } catch {
    return isoString;
  }
}

export function formatRelativeTime(isoString?: string | null): string {
  if (!isoString) return '--';
  try {
    const past = new Date(isoString).getTime();
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - past) / 1000));
    if (diffSec < 2) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    return `${Math.floor(diffMin / 60)}h ago`;
  } catch {
    return '--';
  }
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function getClassificationMeta(classification: CanonicalClassification) {
  switch (classification) {
    case 'AUTHORISED':
      return {
        label: 'AUTHORISED',
        color: '#10b981',
        bgClass: 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40',
        stroke: '#10b981',
        fill: 'rgba(16, 185, 129, 0.9)',
      };
    case 'UNREGISTERED':
      return {
        label: 'UNREGISTERED',
        color: '#f97316',
        bgClass: 'bg-orange-950/60 text-orange-400 border-orange-500/40',
        stroke: '#f97316',
        fill: 'rgba(249, 115, 22, 0.9)',
      };
    case 'OUT_OF_ENVELOPE':
      return {
        label: 'OUT OF ENVELOPE',
        color: '#ef4444',
        bgClass: 'bg-rose-950/70 text-rose-300 border-rose-500/60 animate-pulse',
        stroke: '#ef4444',
        fill: 'rgba(239, 68, 68, 0.95)',
      };
    case 'LOST_LINK':
      return {
        label: 'LOST LINK',
        color: '#eab308',
        bgClass: 'bg-yellow-950/60 text-yellow-400 border-yellow-500/40',
        stroke: '#eab308',
        fill: 'rgba(234, 179, 8, 0.9)',
      };
    default:
      return {
        label: classification || 'UNKNOWN',
        color: '#94a3b8',
        bgClass: 'bg-slate-900 text-slate-300 border-slate-700',
        stroke: '#94a3b8',
        fill: 'rgba(148, 163, 184, 0.9)',
      };
  }
}

export function getPriorityMeta(priority: AlertPriority) {
  switch (priority) {
    case 'CRITICAL':
      return { color: '#ef4444', badge: 'bg-red-950 text-red-300 border-red-500' };
    case 'HIGH':
      return { color: '#f97316', badge: 'bg-orange-950 text-orange-300 border-orange-500' };
    case 'MEDIUM':
      return { color: '#eab308', badge: 'bg-yellow-950 text-yellow-300 border-yellow-500' };
    case 'LOW':
    default:
      return { color: '#3b82f6', badge: 'bg-blue-950 text-blue-300 border-blue-500' };
  }
}

export function getZoneStyle(zoneType: ZoneType) {
  switch (zoneType) {
    case 'GREEN':
      return { color: '#10b981', fillColor: '#10b981', fillOpacity: 0.14, weight: 2 };
    case 'YELLOW':
      return { color: '#eab308', fillColor: '#eab308', fillOpacity: 0.16, weight: 2 };
    case 'RED':
      return { color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.25, weight: 2.5 };
    case 'TEMPORARY_RED':
      return {
        color: '#f43f5e',
        fillColor: '#f43f5e',
        fillOpacity: 0.35,
        weight: 3,
        dashArray: '6, 6',
      };
    default:
      return { color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 2 };
  }
}

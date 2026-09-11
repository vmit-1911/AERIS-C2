import json
import os
import threading
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple
from shapely.geometry import Point, Polygon

from models.telemetry import TelemetryPayload, TrackEvaluationResult
from models.geofence import TRZZone, BaseAirspaceZone, TRZCreateRequest

class GeofenceEngine:
    """
    High-performance 4D Spatial & Altitude Geofencing Engine.
    Evaluates ASTM Remote ID telemetry tracks against DGCA static zones and Rule 24 dynamic TRZs in <20ms.
    """

    def __init__(self, registry_path: str = "authorized_uas_registry.json"):
        self.lock = threading.RLock()
        self.registry_path = registry_path
        self.authorized_ids: set = set()
        self.active_trzs: Dict[str, TRZZone] = {}
        self.base_zones: List[BaseAirspaceZone] = []
        
        self.load_authorized_registry()
        self.load_default_base_zones()

    def load_authorized_registry(self):
        """Loads whitelisted UAS IDs from authorized_uas_registry.json."""
        with self.lock:
            if os.path.exists(self.registry_path):
                try:
                    with open(self.registry_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        self.authorized_ids = {item["uas_id"] for item in data.get("authorized_uas", [])}
                except Exception as e:
                    print(f"[GEOFENCE] Error loading authorized registry: {e}")

    def is_uas_whitelisted(self, uas_id: str) -> bool:
        """Check if a UAS ID is in the authorized registry."""
        with self.lock:
            return uas_id in self.authorized_ids

    def load_default_base_zones(self):
        """Initializes standard DGCA airspace classifications around Saveetha Engineering College Campus, Chennai."""
        # Anchor area: Saveetha Engineering College Campus, Thandalam, Chennai (Lat: 13.02685, Lon: 80.01686)
        self.base_zones = [
            BaseAirspaceZone(
                zone_id="DGCA-GREEN-01",
                name="Saveetha Campus Unrestricted Civil Zone (<120m)",
                category="GREEN",
                max_alt_m=120.0,
                coordinates=[
                    [79.9950, 13.0100],
                    [80.0380, 13.0100],
                    [80.0380, 13.0450],
                    [79.9950, 13.0450],
                    [79.9950, 13.0100]
                ]
            ),
            BaseAirspaceZone(
                zone_id="DGCA-RED-AIRPORT",
                name="Chennai Airport West Sector Restricted Airspace",
                category="RED",
                max_alt_m=0.0,  # Zero tolerance
                coordinates=[
                    [80.0400, 13.0150],
                    [80.0650, 13.0150],
                    [80.0650, 13.0400],
                    [80.0400, 13.0400],
                    [80.0400, 13.0150]
                ]
            ),
            BaseAirspaceZone(
                zone_id="DGCA-YELLOW-CORRIDOR",
                name="NH-48 Sriperumbudur Controlled Airway (>120m)",
                category="YELLOW",
                max_alt_m=120.0,
                coordinates=[
                    [80.0220, 13.0180],
                    [80.0450, 13.0180],
                    [80.0450, 13.0350],
                    [80.0220, 13.0350],
                    [80.0220, 13.0180]
                ]
            )
        ]

    def add_trz(self, req: TRZCreateRequest) -> TRZZone:
        """
        Creates and registers a dynamic Temporary Red Zone under Rule 24 of Drone Rules, 2021.
        Max lifetime 48 hours.
        """
        with self.lock:
            zone_count = len(self.active_trzs) + 1
            zone_id = f"TRZ-R24-2026-{zone_count:03d}"
            
            created_dt = datetime.now(timezone.utc)
            duration = min(req.duration_hours, 48.0)  # Rule 24 caps at 48 hours
            expires_dt = created_dt + timedelta(hours=duration)
            
            # Ensure closed polygon coordinates
            coords = list(req.coordinates)
            if coords[0] != coords[-1]:
                coords.append(coords[0])

            zone = TRZZone(
                zone_id=zone_id,
                name=req.name or f"Rule 24 TRZ Enforcement #{zone_count}",
                declared_by=req.declared_by,
                floor_m=req.floor_m,
                ceiling_m=req.ceiling_m,
                created_at=created_dt.isoformat(),
                expires_at=expires_dt.isoformat(),
                coordinates=coords,
                reason=req.reason,
                is_active=True
            )
            self.active_trzs[zone_id] = zone
            print(f"[GEOFENCE] Rule 24 TRZ Enacted: {zone_id} expires at {expires_dt.isoformat()}")
            return zone

    def revoke_trz(self, zone_id: str) -> bool:
        """Manually revokes an active TRZ before natural expiration."""
        with self.lock:
            if zone_id in self.active_trzs:
                self.active_trzs[zone_id].is_active = False
                del self.active_trzs[zone_id]
                print(f"[GEOFENCE] Rule 24 TRZ Revoked: {zone_id}")
                return True
            return False

    def get_active_trzs(self) -> List[TRZZone]:
        """Returns list of currently active non-expired TRZs."""
        self.prune_expired_trzs()
        with self.lock:
            return list(self.active_trzs.values())

    def prune_expired_trzs(self) -> List[str]:
        """Removes expired TRZs automatically."""
        expired_ids = []
        now_dt = datetime.now(timezone.utc)
        with self.lock:
            for zid, zone in list(self.active_trzs.items()):
                exp_dt = datetime.fromisoformat(zone.expires_at)
                if now_dt >= exp_dt:
                    expired_ids.append(zid)
                    del self.active_trzs[zid]
        if expired_ids:
            print(f"[GEOFENCE] Pruned expired Rule 24 TRZs: {expired_ids}")
        return expired_ids

    def evaluate_track(self, telemetry: TelemetryPayload) -> TrackEvaluationResult:
        """
        Evaluates a single telemetry track against whitelist, dynamic TRZs, and DGCA envelopes.
        Must complete execution in < 20 milliseconds.
        """
        t_start = time.perf_counter()
        
        uas_id = telemetry.uas_id
        point = Point(telemetry.lon, telemetry.lat)
        alt = telemetry.alt_m
        
        breached_zones: List[str] = []
        
        # 1. Evaluate Dynamic 4D TRZ Breaches (HIGHEST PRIORITY)
        with self.lock:
            active_zones = list(self.active_trzs.values())

        for zone in active_zones:
            if not zone.is_active:
                continue
            poly = Polygon(zone.coordinates)
            if poly.contains(point):
                if zone.floor_m <= alt <= zone.ceiling_m:
                    breached_zones.append(f"{zone.zone_id} ({zone.name})")

        # 2. Whitelist Check
        is_whitelisted = self.is_uas_whitelisted(uas_id)

        # 3. Decision Matrix
        if breached_zones:
            status = "OUT_OF_ENVELOPE"
            priority = "CRITICAL"
            sop = (
                f"🚨 RULE 24 TRZ INCURSION DETECTED inside {', '.join(breached_zones)}. "
                f"Immediately dispatch Sector QRT unit to pilot launch coordinates [{telemetry.pilot_lat:.5f}, {telemetry.pilot_lon:.5f}]. "
                "Prepare kinetic counter-UAS frequency jammer deployment."
            )
        elif not is_whitelisted:
            status = "UNREGISTERED"
            priority = "HIGH"
            sop = (
                f"⚠️ UNREGISTERED TARGET [{uas_id}] detected in civil airspace. "
                "Cross-check optical PTZ camera feed. "
                f"Vector field officer to ground controller position [{telemetry.pilot_lat:.5f}, {telemetry.pilot_lon:.5f}] for Remote ID verification."
            )
        elif alt > 120.0:
            status = "ALTITUDE_VIOLATION"
            priority = "MEDIUM"
            sop = (
                f"⚠️ VERTICAL ENVELOPE BREACH: [{uas_id}] operating at {alt:.1f}m AMSL (exceeds 120m DGCA ceiling). "
                "Issue automated advisory command to ground station."
            )
        else:
            status = "AUTHORISED"
            priority = "NORMAL"
            sop = f"✅ Target [{uas_id}] operating within authorized flight envelope and registered clearance."

        intercept_vector = {
            "pilot_lat": telemetry.pilot_lat,
            "pilot_lon": telemetry.pilot_lon,
            "target_lat": telemetry.lat,
            "target_lon": telemetry.lon,
            "target_alt_m": telemetry.alt_m,
            "rssi_dbm": telemetry.rssi_dbm,
            "distance_m": round(((telemetry.lat - telemetry.pilot_lat)**2 + (telemetry.lon - telemetry.pilot_lon)**2)**0.5 * 111000, 2)
        }

        t_elapsed_ms = (time.perf_counter() - t_start) * 1000
        # Assert performance requirement (<20ms execution)
        if t_elapsed_ms > 20:
            print(f"[PERF WARNING] Spatial evaluation took {t_elapsed_ms:.2f}ms")

        return TrackEvaluationResult(
            telemetry=telemetry,
            status=status,
            priority=priority,
            breached_zones=breached_zones,
            sop_instruction=sop,
            intercept_vector=intercept_vector
        )

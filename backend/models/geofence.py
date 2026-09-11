from datetime import datetime, timezone, timedelta
from typing import List, Optional
from pydantic import BaseModel, Field

class TRZCreateRequest(BaseModel):
    """
    Request payload to declare a Temporary Red Zone under Rule 24 of Drone Rules, 2021.
    """
    name: Optional[str] = Field("SP_TEMPORARY_RED_ZONE", description="Human-readable zone label")
    declared_by: str = Field("SUPERINTENDENT_OF_POLICE_CHQ", description="Authority declaring TRZ")
    floor_m: float = Field(0.0, ge=0.0, description="Minimum vertical boundary in meters")
    ceiling_m: float = Field(120.0, le=500.0, description="Maximum vertical boundary in meters")
    duration_hours: float = Field(24.0, ge=0.5, le=48.0, description="Duration in hours (Max 48 hours per Rule 24)")
    coordinates: List[List[float]] = Field(..., description="Array of [longitude, latitude] coordinates forming a polygon")
    reason: str = Field("VIP Movement & Security Protocol under Rule 24 Drone Rules 2021", description="Tactical justification")

class TRZZone(BaseModel):
    """
    Active 4D TRZ model stored in memory and synchronized across console workstations.
    """
    zone_id: str = Field(..., description="Unique zone identifier (e.g. TRZ-IND-2026-001)")
    name: str = Field(...)
    declared_by: str = Field(...)
    floor_m: float = Field(...)
    ceiling_m: float = Field(...)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    expires_at: str = Field(...)
    coordinates: List[List[float]] = Field(...)
    reason: str = Field(...)
    is_active: bool = Field(True)

class BaseAirspaceZone(BaseModel):
    """
    Pre-configured DGCA base airspace zones (Green, Yellow, Red).
    """
    zone_id: str
    name: str
    category: str  # "GREEN", "YELLOW", "RED"
    max_alt_m: float
    coordinates: List[List[float]]

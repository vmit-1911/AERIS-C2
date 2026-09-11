from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field

class TelemetryPayload(BaseModel):
    """
    ASTM F3411-22a Remote ID standard payload representation.
    Serves as the compliant data structure for incoming drone telemetry streams.
    """
    uas_id: str = Field(..., description="Unique Aircraft Identification Number / UIN (e.g. UIN-IND-2026-X89)")
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat(), description="ISO-8601 UTC timestamp")
    lat: float = Field(..., description="Latitude in decimal degrees WGS84")
    lon: float = Field(..., description="Longitude in decimal degrees WGS84")
    alt_m: float = Field(..., description="Altitude Above Mean Sea Level (AMSL) or Above Ground Level in meters")
    speed_mps: float = Field(0.0, description="Ground speed in meters per second")
    heading_deg: float = Field(0.0, description="Heading relative to True North in degrees (0-360)")
    pitch_deg: float = Field(0.0, description="Pitch angle in degrees")
    roll_deg: float = Field(0.0, description="Roll angle in degrees")
    pilot_lat: float = Field(..., description="Ground station / pilot location latitude")
    pilot_lon: float = Field(..., description="Ground station / pilot location longitude")
    rssi_dbm: int = Field(-65, description="Received Signal Strength Indicator in dBm")
    transmission_state: str = Field("BROADCASTING", description="BROADCASTING, SILENT_DARK, or SPOOFED_ID")

class TrackEvaluationResult(BaseModel):
    """
    Enriched target state evaluated against dynamic 4D geofences & DGCA airspace rules.
    """
    telemetry: TelemetryPayload
    status: str = Field(..., description="AUTHORISED, UNREGISTERED, OUT_OF_ENVELOPE, ALTITUDE_VIOLATION")
    priority: str = Field(..., description="NORMAL, MEDIUM, HIGH, CRITICAL")
    breached_zones: list[str] = Field(default_factory=list)
    sop_instruction: str = Field(...)
    intercept_vector: dict = Field(...)
    evaluated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

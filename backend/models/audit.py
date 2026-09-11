from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

class AuditRecord(BaseModel):
    """
    Cryptographic Audit Ledger record conforming to BSA Section 65B requirements.
    """
    log_index: int = Field(..., description="Monotonically increasing log index")
    timestamp: str = Field(..., description="ISO-8601 UTC timestamp")
    operator_id: str = Field(..., description="Authenticated Duty Officer / Superintendent ID")
    uas_id: str = Field(..., description="UAS ID or Zone ID involved")
    event_type: str = Field(..., description="TRZ_BREACH, UNREGISTERED_TARGET, DARK_VESSEL_TARGET, ALTITUDE_BREACH, TRZ_DECLARED")
    action_taken: str = Field(..., description="DISPATCH_QRT, CONFIRM_INCIDENT, DISMISS_FALSE_ALARM, ENACT_TRZ")
    reason_code: str = Field(..., description="Tactical/Operational rationale")
    snapshot_data: Dict[str, Any] = Field(default_factory=dict, description="Full state snapshot at time of decision")
    prev_hash: str = Field(..., description="SHA-256 hash of preceding ledger entry")
    curr_hash: str = Field(..., description="SHA-256 hash of current entry")

class AlertDispositionRequest(BaseModel):
    """
    Request model for Duty Officer triage actions.
    """
    operator_id: str = Field("SP_DUTY_DESK_01", description="Operator taking action")
    uas_id: str = Field(...)
    event_type: str = Field(...)
    action_taken: str = Field(..., description="DISPATCH_QRT, LOG_AND_ESCALATE, DISMISS_FALSE_ALARM")
    reason_code: str = Field(..., description="Mandatory reason code")
    snapshot_data: Optional[Dict[str, Any]] = None

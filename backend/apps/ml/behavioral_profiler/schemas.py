"""
Pydantic schemas for Behavioral Profiler.

Author: Rubina Khadim
Date: 2026-07-27
"""

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class MessageRecord(BaseModel):
    """Single message record."""

    text: str
    intent: str
    severity_score: float = Field(ge=0.0, le=1.0)
    timestamp: datetime
    platform: str


class BehaviorProfile(BaseModel):
    """Behavioral profile for a single contact."""

    contact_id: str
    platform: str
    first_seen: datetime
    last_seen: datetime
    total_messages: int
    intent_counts: Dict[str, int]
    average_severity: float
    severity_trend: str  # "increasing", "decreasing", "stable"
    escalation_status: bool
    recent_alerts: List[str] = []


class EscalationAlert(BaseModel):
    """Escalation alert record."""

    contact_id: str
    platform: str
    alert_time: datetime
    severity_before: float
    severity_after: float
    message: str = ""

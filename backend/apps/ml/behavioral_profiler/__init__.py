"""
Behavioral Profiler Module.

Tracks user behavior over time, builds profiles, and detects escalation.

Author: Rubina Khadim
Date: 2026-07-27
"""

from .features import average_severity, intent_distribution, is_escalating, severity_trend
from .profiler import BehavioralProfiler
from .schemas import BehaviorProfile, EscalationAlert, MessageRecord

__all__ = [
    "BehavioralProfiler",
    "BehaviorProfile",
    "EscalationAlert",
    "MessageRecord",
    "average_severity",
    "intent_distribution",
    "severity_trend",
    "is_escalating",
]

"""
Feature extraction for Behavioral Profiler.

Author: Rubina Khadim
Date: 2026-07-27
"""

from collections import Counter
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import numpy as np


def count_messages_per_day(messages: List[dict]) -> Dict[str, int]:
    """Count messages per day."""
    days = [m["timestamp"].date().isoformat() for m in messages]
    return dict(Counter(days))


def average_severity(messages: List[dict]) -> float:
    """Compute average severity score."""
    if not messages:
        return 0.0
    scores = [m["severity_score"] for m in messages]
    return round(sum(scores) / len(scores), 3)


def severity_trend(messages: List[dict], window_days: int = 7) -> str:
    """
    Determine severity trend over time using sliding windows.

    Args:
        messages: List of message dicts with 'severity_score' and 'timestamp'.
        window_days: Size of time window in days.

    Returns:
        "increasing", "decreasing", or "stable"
    """
    if len(messages) < 5:
        return "stable"

    # Sort by timestamp
    sorted_msgs = sorted(messages, key=lambda x: x["timestamp"])
    timestamps = [m["timestamp"] for m in sorted_msgs]
    scores = [m["severity_score"] for m in sorted_msgs]

    # Compute average severity per window
    windows = []
    current = sorted_msgs[0]["timestamp"]
    end = sorted_msgs[-1]["timestamp"]

    while current <= end:
        window_end = current + timedelta(days=window_days)
        window_scores = [
            m["severity_score"] for m in sorted_msgs if current <= m["timestamp"] < window_end
        ]
        if window_scores:
            windows.append(sum(window_scores) / len(window_scores))
        current = window_end

    if len(windows) < 2:
        return "stable"

    # Compute slope
    x = np.arange(len(windows))
    y = np.array(windows)
    slope = np.polyfit(x, y, 1)[0]

    if slope > 0.02:
        return "increasing"
    elif slope < -0.02:
        return "decreasing"
    return "stable"


def intent_distribution(messages: List[dict]) -> Dict[str, int]:
    """Count messages by intent."""
    intents = [m["intent"] for m in messages]
    return dict(Counter(intents))


def is_escalating(messages: List[dict], window_days: int = 7, threshold: float = 0.10) -> bool:
    """
    Detect escalation by comparing recent severity to historical average.

    Args:
        messages: List of message dicts.
        window_days: Size of recent window.
        threshold: Minimum increase to trigger escalation.

    Returns:
        True if escalating.
    """
    if len(messages) < 10:
        return False

    # Split messages
    now = datetime.now()
    cutoff = now - timedelta(days=window_days)

    recent = [m for m in messages if m["timestamp"] >= cutoff]
    historic = [m for m in messages if m["timestamp"] < cutoff]

    if not recent or not historic:
        return False

    recent_avg = average_severity(recent)
    historic_avg = average_severity(historic)

    return (recent_avg - historic_avg) > threshold

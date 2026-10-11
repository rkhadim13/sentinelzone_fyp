"""
Behavioral Profiler – Core Engine

Tracks user behavior over time, builds profiles, and detects escalation.

Author: Rubina Khadim
Date: 2026-07-27
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .features import average_severity, intent_distribution, is_escalating, severity_trend
from .schemas import BehaviorProfile, EscalationAlert, MessageRecord

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class BehavioralProfiler:
    """
    Behavioral Profiler – tracks and analyzes user behavior over time.

    Stores data in memory (can be extended to use a database).
    """

    def __init__(self, storage_path: Optional[Path] = None):
        """
        Initialize the profiler.

        Args:
            storage_path: Path to JSON file for persistent storage.
        """
        self.storage_path = storage_path
        self.profiles: Dict[str, Dict] = {}
        self.message_history: Dict[str, List[Dict]] = {}
        self.alerts: Dict[str, List[Dict]] = {}

        if storage_path and storage_path.exists():
            self._load_from_disk()

    def process_message(
        self,
        contact_id: str,
        platform: str,
        text: str,
        intent: str,
        severity_score: float,
        timestamp: Optional[datetime] = None,
    ) -> BehaviorProfile:
        """
        Process a new message and update the contact's behavioral profile.

        Args:
            contact_id: Unique identifier for the contact.
            platform: Platform (e.g., WhatsApp, Instagram).
            text: Message content.
            intent: Detected intent (Safe, Harassment, Fraud, etc.).
            severity_score: Threat severity (0.0 to 1.0).
            timestamp: Message timestamp (defaults to now).

        Returns:
            Updated BehaviorProfile.
        """
        if timestamp is None:
            timestamp = datetime.now()

        # Create message record
        message = {
            "text": text,
            "intent": intent,
            "severity_score": severity_score,
            "timestamp": timestamp,
            "platform": platform,
        }

        # Initialize history if new contact
        key = f"{contact_id}_{platform}"
        if key not in self.message_history:
            self.message_history[key] = []
            self.profiles[key] = {
                "contact_id": contact_id,
                "platform": platform,
                "first_seen": timestamp,
                "last_seen": timestamp,
                "total_messages": 0,
                "intent_counts": {},
                "average_severity": 0.0,
                "severity_trend": "stable",
                "escalation_status": False,
                "recent_alerts": [],
            }

        # Add message to history
        self.message_history[key].append(message)

        # Update profile
        profile_data = self.profiles[key]
        profile_data["last_seen"] = timestamp
        profile_data["total_messages"] += 1

        # Update intent counts
        if intent not in profile_data["intent_counts"]:
            profile_data["intent_counts"][intent] = 0
        profile_data["intent_counts"][intent] += 1

        # Recalculate features
        messages = self.message_history[key]
        profile_data["average_severity"] = average_severity(messages)
        profile_data["severity_trend"] = severity_trend(messages)
        profile_data["escalation_status"] = is_escalating(messages)

        # Check for escalation alert
        if profile_data["escalation_status"]:
            self._raise_alert(key, profile_data, messages)

        # Save to disk if storage path provided
        if self.storage_path:
            self._save_to_disk()

        logger.info(
            f" Updated profile for {contact_id} on {platform} "
            f"(total: {profile_data['total_messages']}, "
            f"escalation: {profile_data['escalation_status']})"
        )

        return self.get_profile(contact_id, platform)

    def get_profile(self, contact_id: str, platform: str) -> BehaviorProfile:
        """Get the behavioral profile for a contact."""
        key = f"{contact_id}_{platform}"
        if key not in self.profiles:
            raise ValueError(f"Profile not found for {contact_id} on {platform}")

        data = self.profiles[key]
        return BehaviorProfile(
            contact_id=data["contact_id"],
            platform=data["platform"],
            first_seen=data["first_seen"],
            last_seen=data["last_seen"],
            total_messages=data["total_messages"],
            intent_counts=data["intent_counts"],
            average_severity=data["average_severity"],
            severity_trend=data["severity_trend"],
            escalation_status=data["escalation_status"],
            recent_alerts=data["recent_alerts"][-5:],  # List of strings
        )

    def get_all_profiles(self) -> List[BehaviorProfile]:
        """Get all behavioral profiles."""
        profiles = []
        for key, data in self.profiles.items():
            try:
                profiles.append(self.get_profile(data["contact_id"], data["platform"]))
            except ValueError:
                continue
        return profiles

    def get_alerts(self, contact_id: Optional[str] = None) -> List[Dict]:
        """Get escalation alerts, optionally for a specific contact."""
        if contact_id:
            key = next((k for k in self.profiles if k.startswith(contact_id)), None)
            return self.alerts.get(key, [])
        return [a for alerts in self.alerts.values() for a in alerts]

    def _raise_alert(self, key: str, profile: Dict, messages: List[Dict]) -> None:
        """Raise an escalation alert."""
        if key not in self.alerts:
            self.alerts[key] = []

        # Avoid duplicate alerts within 24 hours
        if self.alerts[key]:
            last = self.alerts[key][-1]
            last_time = last["alert_time"]
            if isinstance(last_time, str):
                last_time = datetime.fromisoformat(last_time)
            if (datetime.now() - last_time).total_seconds() < 86400:
                return

        recent_avg = average_severity(messages[-7:]) if len(messages) >= 7 else 0.0
        historic_avg = average_severity(messages[:-7]) if len(messages) > 7 else 0.0

        alert = {
            "contact_id": profile["contact_id"],
            "platform": profile["platform"],
            "alert_time": datetime.now(),
            "severity_before": historic_avg,
            "severity_after": recent_avg,
            "message": messages[-1]["text"][:200] if messages else "",
        }

        self.alerts[key].append(alert)
        # Store only the message string in recent_alerts to match Pydantic
        profile["recent_alerts"].append(alert["message"])

        logger.warning(
            f" ESCALATION ALERT! Contact: {profile['contact_id']} "
            f"on {profile['platform']} | Severity: {historic_avg:.2f} → {recent_avg:.2f}"
        )

    def _save_to_disk(self) -> None:
        """Save all data to JSON file."""
        if not self.storage_path:
            return

        data = {
            "profiles": self.profiles,
            "message_history": self.message_history,
            "alerts": self.alerts,
        }

        with open(self.storage_path, "w", encoding="utf-8") as f:
            json.dump(data, f, default=str, indent=2)

        logger.debug(f" Data saved to {self.storage_path}")

    def _load_from_disk(self) -> None:
        """Load data from JSON file."""
        if not self.storage_path or not self.storage_path.exists():
            return

        try:
            with open(self.storage_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            self.profiles = data.get("profiles", {})
            self.message_history = data.get("message_history", {})
            self.alerts = data.get("alerts", {})

            # Convert timestamp strings to datetime for message_history
            for key, messages in self.message_history.items():
                for msg in messages:
                    if isinstance(msg.get("timestamp"), str):
                        msg["timestamp"] = datetime.fromisoformat(msg["timestamp"])

            # Convert profile timestamps and fix recent_alerts
            for key, profile in self.profiles.items():
                if isinstance(profile.get("first_seen"), str):
                    profile["first_seen"] = datetime.fromisoformat(profile["first_seen"])
                if isinstance(profile.get("last_seen"), str):
                    profile["last_seen"] = datetime.fromisoformat(profile["last_seen"])

                # Ensure recent_alerts is a list of strings
                if "recent_alerts" in profile:
                    profile["recent_alerts"] = [
                        a if isinstance(a, str) else a.get("message", str(a))
                        for a in profile["recent_alerts"]
                    ]

            # Convert alert_time strings for alerts
            for key, alert_list in self.alerts.items():
                for alert in alert_list:
                    if isinstance(alert.get("alert_time"), str):
                        alert["alert_time"] = datetime.fromisoformat(alert["alert_time"])

            logger.info(f" Loaded data from {self.storage_path}")

        except Exception as e:
            logger.error(f" Failed to load data: {e}")

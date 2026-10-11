"""
Publishes a live alert to two places:
  1. The Alert table (scoped to a user where applicable)
  2. The WebSocket alert server for live broadcast
"""

import logging

import requests
from django.conf import settings
from django.utils import timezone

from .models import Alert

logger = logging.getLogger(__name__)


def publish_alert(
    payload: dict,
    source_message=None,
    confidence: float | None = None,
    user=None,
) -> Alert:
    """
    Persist an Alert row and push it live to any connected WebSocket client.

    Args:
        payload: dict with keys sender, type, risk and optionally
                 time, message, username.
        source_message: optional SocialMessage instance this alert originated from.
        confidence: optional ML confidence score (0.0 - 1.0).
        user: optional owner user (None = global alert).

    Returns:
        Alert: the created Alert instance.
    """
    message_text = (payload.get("message") or "").strip()
    if len(message_text) > 200:
        message_text = message_text[:197] + "..."

    alert = Alert.objects.create(
        user=user,
        sender=payload.get("sender", "Unknown"),
        type=payload.get("type", "Alert"),
        risk=payload.get("risk", "Medium"),
        time_label=payload.get("time", ""),
        message_preview=message_text,
        username=payload.get("username", ""),
        full_timestamp=timezone.now(),
        source_message=source_message,
        confidence=confidence,
    )

    try:
        resp = requests.post(
            f"{settings.ALERT_SERVER_URL}/publish",
            json=payload,
            timeout=3,
        )
        resp.raise_for_status()
        alert.delivered = True
        alert.save(update_fields=["delivered"])
    except requests.RequestException as exc:
        logger.warning("Could not push live alert to alert_server: %s", exc)

    return alert
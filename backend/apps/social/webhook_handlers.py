"""
Webhook payload handlers for Meta platforms (WhatsApp, Instagram, Facebook).

Each platform sends a slightly different JSON structure. This module:
  1. Detects the platform from the top-level 'object' key.
  2. Extracts the message text, sender/recipient IDs, and media attachments.
  3. Deduplicates messages:
     a) Primary key: Meta's unique message ID (mid) — catches simple retries.
     b) Secondary key: same (platform, sender_id, message_text) within 60s —
        catches Meta's dual delivery when the app is subscribed to two
        contexts (an IG app + a Page, or two connected IG accounts), which
        sends the SAME content with two DIFFERENT mids.
  4. Calls the ML model (intent classification + behavioral profiler).
  5. Downloads & analyzes media attachments via the ML microservice.
  6. Persists the message to the database (including media results).
  7. Saves flagged media as tamper-proof EvidenceItem records.
  8. Publishes an alert to the Dashboard/WebSocket pipeline for
     Harassment/Fraud intents, detected deepfakes, or escalation.
"""

import io
import logging
import mimetypes
import uuid
from datetime import timedelta

import requests
from django.conf import settings
from django.core.files.base import ContentFile
from django.utils import timezone

from .models import SocialMessage, SocialAlert
from apps.alerts.publisher import publish_alert

logger = logging.getLogger(__name__)

# --- Media download / analysis tuning ---
MEDIA_DOWNLOAD_TIMEOUT = 15          # seconds
MEDIA_ANALYSIS_TIMEOUT = 90          # seconds
MEDIA_MAX_BYTES = 50 * 1024 * 1024   # 50 MB

# --- Content dedup window ---
# Meta sometimes delivers the same message twice within ~1 second (two
# different webhook contexts). A short window catches those without
# blocking legitimate re-sends hours later.
CONTENT_DEDUP_WINDOW_SECONDS = 60

# --- Fallback MIME types by media_type ---
DEFAULT_MIME = {
    "image": "image/jpeg",
    "audio": "audio/mpeg",
    "video": "video/mp4",
}


# ============================================================
# ML TEXT PREDICTION BRIDGE
# ============================================================
def get_ml_prediction(text: str, contact_id: str, platform: str) -> dict:
    """Classify a text message and update the behavioral profiler."""
    try:
        from apps.ml import model_loader

        result = model_loader.text_classifier(text)[0]
        intent = model_loader.TEXT_LABEL_MAP.get(result["label"], result["label"])
        confidence = float(result["score"])

        profile = model_loader.profiler.process_message(
            contact_id=contact_id,
            platform=platform,
            text=text,
            intent=intent,
            severity_score=confidence,
        )

        return {
            "intent": intent,
            "confidence": confidence,
            "escalation": bool(profile.escalation_status),
        }

    except Exception as exc:
        logger.exception("ML prediction failed for a webhook message: %s", exc)
        return {
            "intent": "Unknown",
            "confidence": 0.0,
            "escalation": False,
        }


# ============================================================
# MEDIA — DOWNLOAD
# ============================================================
def _download_media(media_url: str) -> bytes:
    """Download raw bytes from a media URL. Returns b'' on failure."""
    if not media_url:
        return b""
    try:
        logger.info("Downloading media from %s", media_url[:80])
        resp = requests.get(media_url, timeout=MEDIA_DOWNLOAD_TIMEOUT, stream=True)
        resp.raise_for_status()
        content = resp.content

        if len(content) > MEDIA_MAX_BYTES:
            logger.warning(
                "Media exceeds %d MB (got %d bytes) — skipping",
                MEDIA_MAX_BYTES // (1024 * 1024),
                len(content),
            )
            return b""
        return content

    except requests.RequestException as exc:
        logger.warning("Failed to download media: %s", exc)
        return b""


# ============================================================
# MEDIA — ANALYZE (via ML microservice)
# ============================================================
def _analyze_media_bytes(content: bytes, media_type: str) -> dict:
    """Send raw media bytes to the ML microservice for deepfake detection."""
    empty = {"verdict": "", "confidence": 0.0, "raw": {}}

    if not content or media_type not in ("image", "audio", "video"):
        return empty

    ml_url = f"{settings.ML_SERVICE_URL}/infer/{media_type}"
    mime = DEFAULT_MIME.get(media_type, "application/octet-stream")

    try:
        files = {"file": (f"media.{media_type}", io.BytesIO(content), mime)}
        resp = requests.post(ml_url, files=files, timeout=MEDIA_ANALYSIS_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()

        return {
            "verdict": data.get("verdict", ""),
            "confidence": float(data.get("confidence", 0.0)),
            "raw": data,
        }

    except requests.RequestException as exc:
        logger.warning("ML service call failed for media analysis: %s", exc)
        return empty
    except Exception as exc:
        logger.exception("Unexpected media analysis error: %s", exc)
        return empty


# ============================================================
# MEDIA — SAVE AS EVIDENCE
# ============================================================
def _save_media_as_evidence(
    content: bytes,
    media_url: str,
    media_type: str,
    sender_id: str,
    platform: str,
    verdict: str,
) -> str:
    """Save raw media bytes as a tamper-proof EvidenceItem. Returns UUID str or ""."""
    if not content:
        return ""

    try:
        from apps.evidence.models import EvidenceItem
        from apps.evidence.services import append_event

        guessed_mime, _ = mimetypes.guess_type(media_url or "")
        mime = guessed_mime or DEFAULT_MIME.get(media_type, "application/octet-stream")

        ext_map = {"image": ".jpg", "audio": ".mp3", "video": ".mp4"}
        ext = ext_map.get(media_type, ".bin")

        file_name = f"{platform}_{sender_id}_{uuid.uuid4().hex[:8]}{ext}"
        django_file = ContentFile(content, name=file_name)

        evidence = EvidenceItem.objects.create(
            case_id=None,
            source=f"social_{platform}_webhook",
            title=f"{media_type.capitalize()} from {sender_id} ({platform})",
            type=media_type.capitalize(),
            content=media_url,
            reason=verdict,
            file=django_file,
            mime_type=mime,
        )

        append_event(evidence, "ingested", {
            "action": "ingested",
            "source": evidence.source,
            "platform": platform,
            "sender_id": sender_id,
            "original_url": media_url,
            "media_type": media_type,
            "verdict": verdict,
        })

        logger.info("💾 Media saved as evidence: %s (%s)", evidence.id, file_name)
        return str(evidence.id)

    except Exception as exc:
        logger.exception("Failed to save media as evidence: %s", exc)
        return ""


# ============================================================
# MEDIA TYPE NORMALIZATION
# ============================================================
def _normalize_media_type(raw_type: str) -> str:
    raw_type = (raw_type or "").lower()
    if raw_type in ("image", "photo", "sticker"):
        return "image"
    if raw_type in ("video", "reel", "ig_reel", "share"):
        return "video"
    if raw_type in ("audio", "voice"):
        return "audio"
    return ""


# ============================================================
# PLATFORM-SPECIFIC PARSERS
# ============================================================
def _extract_whatsapp(payload: dict) -> list:
    messages = []
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            phone_number_id = value.get("metadata", {}).get("phone_number_id", "")

            for msg in value.get("messages", []):
                msg_type = (msg.get("type") or "").lower()
                sender = msg.get("from", "")
                text = ""
                media_url = ""
                media_type = ""

                if msg_type == "text":
                    text = msg.get("text", {}).get("body", "").strip()
                elif msg_type in ("image", "video", "audio", "document"):
                    media_block = msg.get(msg_type, {}) or {}
                    media_url = media_block.get("id", "")
                    media_type = _normalize_media_type(msg_type)

                if not text and media_type:
                    text = f"[{media_type} attachment]"
                if not sender or (not text and not media_type):
                    continue

                messages.append({
                    "platform": "whatsapp",
                    "sender_id": sender,
                    "recipient_id": phone_number_id,
                    "text": text,
                    "media_url": media_url,
                    "media_type": media_type,
                    "external_id": msg.get("id", ""),
                    "raw": msg,
                })
    return messages


def _extract_instagram(payload: dict) -> list:
    messages = []
    for entry in payload.get("entry", []):
        for event in entry.get("messaging", []):
            message = event.get("message", {})
            text = message.get("text", "").strip()
            sender = event.get("sender", {}).get("id", "")
            recipient = event.get("recipient", {}).get("id", "")

            attachments = message.get("attachments", []) or []
            media_url = ""
            media_type = ""
            if attachments:
                first = attachments[0] or {}
                media_type = _normalize_media_type(first.get("type", ""))
                media_url = (first.get("payload", {}) or {}).get("url", "")

            if not text and media_type:
                text = f"[{media_type} attachment]"
            if not sender or (not text and not media_type):
                continue

            messages.append({
                "platform": "instagram",
                "sender_id": sender,
                "recipient_id": recipient,
                "text": text,
                "media_url": media_url,
                "media_type": media_type,
                "external_id": message.get("mid", ""),
                "raw": event,
            })
    return messages


def _extract_facebook(payload: dict) -> list:
    messages = []
    for entry in payload.get("entry", []):
        for event in entry.get("messaging", []):
            message = event.get("message", {})
            text = message.get("text", "").strip()
            sender = event.get("sender", {}).get("id", "")
            recipient = event.get("recipient", {}).get("id", "")

            attachments = message.get("attachments", []) or []
            media_url = ""
            media_type = ""
            if attachments:
                first = attachments[0] or {}
                media_type = _normalize_media_type(first.get("type", ""))
                media_url = (first.get("payload", {}) or {}).get("url", "")

            if not text and media_type:
                text = f"[{media_type} attachment]"
            if not sender or (not text and not media_type):
                continue

            messages.append({
                "platform": "facebook",
                "sender_id": sender,
                "recipient_id": recipient,
                "text": text,
                "media_url": media_url,
                "media_type": media_type,
                "external_id": message.get("mid", ""),
                "raw": event,
            })
    return messages


# ============================================================
# MASTER DISPATCHER
# ============================================================
def process_payload(payload: dict) -> list:
    obj = payload.get("object", "")

    if obj == "whatsapp_business_account":
        return _extract_whatsapp(payload)
    elif obj == "instagram":
        return _extract_instagram(payload)
    elif obj == "page":
        return _extract_facebook(payload)
    else:
        logger.warning("Unknown webhook object type: %r", obj)
        return []


# ============================================================
# FULL MESSAGE PIPELINE
# ============================================================
def _find_duplicate(msg: dict, platform: str) -> SocialMessage:
    """
    Return an existing SocialMessage that this webhook represents, or None.

    Two checks, tried in order:
      1. Same (platform, external_id) — catches simple retries.
      2. Same (platform, sender_id, message_text) received within the last
         CONTENT_DEDUP_WINDOW_SECONDS — catches Meta's dual delivery when
         the app is subscribed to two contexts and receives the SAME
         content twice with two DIFFERENT mids.
    """
    external_id = msg.get("external_id", "")

    if external_id:
        existing = SocialMessage.objects.filter(
            platform=platform,
            external_id=external_id,
        ).first()
        if existing:
            logger.info(
                "⏭️  Skipping duplicate (same mid=%s, platform=%s)",
                external_id, platform,
            )
            return existing

    sender_id = msg.get("sender_id", "")
    text = msg.get("text", "")
    if sender_id and text:
        window_start = timezone.now() - timedelta(seconds=CONTENT_DEDUP_WINDOW_SECONDS)
        existing = SocialMessage.objects.filter(
            platform=platform,
            sender_id=sender_id,
            message_text=text,
            received_at__gte=window_start,
        ).order_by("-received_at").first()
        if existing:
            logger.info(
                "⏭️  Skipping duplicate (same content from %s on %s within %ds)",
                sender_id, platform, CONTENT_DEDUP_WINDOW_SECONDS,
            )
            return existing

    return None


def handle_message(msg: dict) -> SocialMessage:
    """
    Complete pipeline for a single message.
    Publishes alerts that carry a link to the source SocialMessage and
    the ML confidence score. Skips duplicates via _find_duplicate().
    """
    platform = msg["platform"]
    sender_id = msg["sender_id"]
    contact_id = f"{platform}_{sender_id}"

    # --- Deduplication (mid + content window) ---
    duplicate = _find_duplicate(msg, platform)
    if duplicate is not None:
        return duplicate

    # 1. Text intent
    prediction = get_ml_prediction(
        text=msg["text"],
        contact_id=contact_id,
        platform=platform,
    )

    # 2. Download media (once)
    media_url = msg.get("media_url", "")
    media_type = msg.get("media_type", "")
    media_bytes = b""
    if media_url and media_type:
        media_bytes = _download_media(media_url)

    # 3. Analyze media
    media_analysis = {"verdict": "", "confidence": 0.0, "raw": {}}
    if media_bytes:
        media_analysis = _analyze_media_bytes(media_bytes, media_type)

    media_is_fake = (
        media_analysis["verdict"].lower().startswith("fake")
        and media_analysis["confidence"] > 60
    )

    # 4. Save the message
    db_message = SocialMessage.objects.create(
        platform=platform,
        sender_id=sender_id,
        recipient_id=msg.get("recipient_id", ""),
        message_text=msg["text"],
        intent=prediction["intent"],
        confidence=prediction["confidence"],
        escalation_detected=prediction["escalation"],
        raw_payload=msg.get("raw", {}),
        external_id=msg.get("external_id", ""),
        media_url=media_url,
        media_type=media_type,
        media_verdict=media_analysis["verdict"],
        media_confidence=media_analysis["confidence"],
    )

    logger.info(
        "[%s] %s -> %s (%.2f) | escalation=%s | media=%s | verdict=%s",
        platform,
        sender_id,
        prediction["intent"],
        prediction["confidence"],
        prediction["escalation"],
        media_type or "none",
        media_analysis["verdict"] or "n/a",
    )

    # 5. Save flagged media as evidence
    if media_is_fake and media_bytes:
        evidence_id = _save_media_as_evidence(
            content=media_bytes,
            media_url=media_url,
            media_type=media_type,
            sender_id=sender_id,
            platform=platform,
            verdict=media_analysis["verdict"],
        )
        if evidence_id:
            db_message.media_evidence_id = evidence_id
            db_message.save(update_fields=["media_evidence_id"])
            logger.info("🔗 Linked evidence %s to message %s", evidence_id, db_message.id)

    # 6. Escalation alert (internal record)
    if prediction["escalation"]:
        SocialAlert.objects.create(
            message=db_message,
            alert_type="ESCALATION",
            description=(
                f"Escalation detected for {sender_id} on {platform}. "
                f"Intent: {prediction['intent']} "
                f"(confidence {prediction['confidence']:.2f})."
            ),
        )
        logger.warning(
            "🚨 ESCALATION ALERT: %s on %s (intent=%s, conf=%.2f)",
            sender_id,
            platform,
            prediction["intent"],
            prediction["confidence"],
        )

    # 7. Publish to Dashboard (with link + confidence)
    should_publish = (
        prediction["intent"] in ("Harassment", "Fraud")
        or prediction["escalation"]
        or media_is_fake
    )

    if should_publish:
        if media_is_fake:
            alert_type = f"{media_type.capitalize()}: {media_analysis['verdict']}"
            risk = "High Risk"
            confidence = media_analysis["confidence"] / 100.0
        else:
            risk_map = {
                "Harassment": "High Risk",
                "Fraud": "High Risk",
                "Unknown": "Medium Risk",
            }
            alert_type = prediction["intent"]
            risk = risk_map.get(prediction["intent"], "Medium Risk")
            confidence = prediction["confidence"]

        sender_label = f"{platform.capitalize()} · {sender_id}"

        payload = {
            "sender": sender_label,
            "type": alert_type,
            "risk": risk,
            "message": (msg["text"][:80] + "...") if len(msg["text"]) > 80 else msg["text"],
        }

        try:
            publish_alert(
                payload,
                source_message=db_message,
                confidence=confidence,
            )
            logger.info("📣 Published alert to Dashboard: %s", payload)
        except Exception as exc:
            logger.exception("Failed to publish alert: %s", exc)

    return db_message
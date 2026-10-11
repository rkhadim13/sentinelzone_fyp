import mimetypes
import os

import requests
from django.conf import settings
from django.core.exceptions import ValidationError

from .hashing import sha256_fileobj, sha256_text, event_hash
from .models import EvidenceItem, EvidenceEvent


def guess_type_from_mime(mime_type: str) -> str:
    if not mime_type:
        return "File"
    if mime_type.startswith("image"):
        return "Image"
    if mime_type.startswith("audio"):
        return "Audio"
    if mime_type.startswith("video"):
        return "Video"
    if mime_type.startswith("text"):
        return "Text"
    return "File"


def validate_upload(upload_file):
    if upload_file.size > settings.MAX_UPLOAD_SIZE_BYTES:
        raise ValidationError(
            f"File exceeds max upload size of {settings.MAX_UPLOAD_SIZE_BYTES} bytes."
        )
    mime_type = upload_file.content_type or mimetypes.guess_type(upload_file.name)[0] or ""
    if settings.ALLOWED_UPLOAD_CONTENT_TYPES and mime_type not in settings.ALLOWED_UPLOAD_CONTENT_TYPES:
        raise ValidationError(f"Unsupported content type: {mime_type}")
    return mime_type


def append_event(evidence: EvidenceItem, event_type: str, payload: dict) -> EvidenceEvent:
    last = evidence.events.order_by("-created_at").last()
    prev_hash = last.event_hash if last else None
    ehash = event_hash(prev_hash, payload)
    return EvidenceEvent.objects.create(
        evidence=evidence,
        event_type=event_type,
        prev_event_hash=prev_hash,
        event_hash=ehash,
        payload_json=payload,
    )


def create_evidence_from_file(*, upload_file, title=None, type_=None, reason="", case_id=None, source="manual_upload"):
    mime_type = validate_upload(upload_file)
    sha = sha256_fileobj(upload_file)

    evidence = EvidenceItem.objects.create(
        case_id=case_id,
        source=source,
        title=title or upload_file.name,
        type=type_ or guess_type_from_mime(mime_type),
        content=upload_file.name,
        reason=reason or "",
        file=upload_file,
        mime_type=mime_type,
        sha256=sha,
    )
    append_event(evidence, "ingested", {
        "action": "ingested",
        "source": evidence.source,
        "sha256": sha,
        "mime_type": mime_type,
        "original_filename": upload_file.name,
    })
    return evidence


def create_evidence_from_text(*, text, title=None, type_="Text", reason="", case_id=None, source="manual_entry"):
    sha = sha256_text(text)
    evidence = EvidenceItem.objects.create(
        case_id=case_id,
        source=source,
        title=title or "Text Evidence",
        type=type_,
        content=text,
        reason=reason or "",
        sha256=sha,
    )
    append_event(evidence, "ingested", {
        "action": "ingested",
        "source": evidence.source,
        "sha256": sha,
    })
    return evidence


def analyze_with_ml_service(evidence: EvidenceItem) -> dict:
    """
    Calls the FastAPI ML microservice's /infer/<kind> route depending on
    evidence.type, and returns a result shaped like:
    {"confidence": 0-100 float, "verdict": str, "category": str,
     "signals": {...}, "model": {...}}
    matching what src/components/AIContentChecker.js expects in `result`.
    """
    kind_map = {"Image": "image", "Audio": "audio", "Video": "video"}
    kind = kind_map.get(evidence.type)
    if not kind or not evidence.file:
        raise ValueError(f"Evidence type '{evidence.type}' is not analyzable (image/audio/video only).")

    url = f"{settings.ML_SERVICE_URL}/infer/{kind}"
    with evidence.file.open("rb") as f:
        files = {"file": (os.path.basename(evidence.file.name), f, evidence.mime_type or "application/octet-stream")}
        resp = requests.post(url, files=files, timeout=300)
    resp.raise_for_status()
    result = resp.json()

    # Mirror AIContentChecker.js's own logic: if confidence > 75 the item
    # gets auto-tagged with the verdict + confidence in `reason`.
    if result.get("confidence", 0) > 75:
        evidence.reason = f"{result['verdict']} ({round(result['confidence'])}% confidence)"
        evidence.save(update_fields=["reason"])

    append_event(evidence, "analyzed", {"action": "analyzed", "ml_result": result})
    return result


def verify_integrity(evidence: EvidenceItem) -> dict:
    """
    Recomputes the sha256 of the stored file/text and compares it to the
    hash captured at ingestion time -- server-side equivalent of
    verifyEvidence() in AppContext.js.
    """
    if evidence.file:
        with evidence.file.open("rb") as f:
            computed = sha256_fileobj(f)
    else:
        computed = sha256_text(evidence.content or "")

    ok = computed == evidence.sha256
    evidence.verified = ok
    evidence.save(update_fields=["verified"])

    append_event(evidence, "verified", {
        "action": "verified",
        "computed_sha256": computed,
        "stored_sha256": evidence.sha256,
        "ok": ok,
    })
    return {"computed_sha256": computed, "stored_sha256": evidence.sha256, "ok": ok}

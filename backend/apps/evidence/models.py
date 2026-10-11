"""
Evidence models for the CyberShield AI Vault.

Field names mirror the shape of items in Member-3's
src/AppContext.js `evidenceList` / `seedEvidence` exactly:
id, title, type, content, reason, timestamp, hash, verified, dataUrl.

Performance indexes added to support fast filtering and dashboard queries.
"""

import uuid
from django.db import models


class EvidenceItem(models.Model):
    """
    Field names mirror the shape of items in Member-3's
    src/AppContext.js `evidenceList` / `seedEvidence` exactly:
    id, title, type, content, reason, timestamp, hash, verified, dataUrl.
    """

    TYPE_CHOICES = [
        ("Image", "Image"),
        ("Audio", "Audio"),
        ("Video", "Video"),
        ("Text", "Text"),
        ("File", "File"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case = models.ForeignKey(
        "reports.Case",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="evidence_items",
    )

    title = models.CharField(max_length=255)
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    content = models.TextField(blank=True, default="")  # text body, or filename for files
    reason = models.CharField(max_length=255, blank=True, default="")

    file = models.FileField(upload_to="evidence/", null=True, blank=True)
    mime_type = models.CharField(max_length=100, blank=True, default="")
    sha256 = models.CharField(max_length=64)  # == frontend "hash"

    # True / False / None(=null) matches item.verified tri-state in the UI
    verified = models.BooleanField(null=True, blank=True, default=None)

    source = models.CharField(max_length=50, default="manual_upload")
    created_at = models.DateTimeField(auto_now_add=True)  # == frontend "timestamp"

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"], name="evidence_created_desc_idx"),
            models.Index(fields=["verified"], name="evidence_verified_idx"),
            models.Index(fields=["type"], name="evidence_type_idx"),
            models.Index(fields=["source"], name="evidence_source_idx"),
            models.Index(fields=["sha256"], name="evidence_sha256_idx"),
        ]

    def __str__(self):
        return f"{self.title} ({self.type})"


class EvidenceEvent(models.Model):
    """Append-only chain-of-custody log for one EvidenceItem."""

    EVENT_TYPES = [
        ("ingested", "ingested"),
        ("analyzed", "analyzed"),
        ("verified", "verified"),
        ("exported", "exported"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    evidence = models.ForeignKey(
        EvidenceItem,
        on_delete=models.CASCADE,
        related_name="events",
    )
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    prev_event_hash = models.CharField(max_length=64, null=True, blank=True)
    event_hash = models.CharField(max_length=64)
    payload_json = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["evidence", "created_at"], name="evidence_event_chain_idx"),
            models.Index(fields=["event_type"], name="evidence_event_type_idx"),
        ]

    def __str__(self):
        return f"{self.event_type} @ {self.created_at:%Y-%m-%d %H:%M}"
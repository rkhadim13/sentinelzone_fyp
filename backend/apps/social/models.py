"""
Database models for storing incoming social media messages.

Includes:
  - SocialMessage  : Every incoming Instagram/WhatsApp/Facebook message,
                     including optional media attachment analysis.
  - SocialAlert    : Escalation alerts derived from messages.

Deduplication: each message stores Meta's unique `mid` in `external_id`.
Webhook retries (which Meta sends when our server returns 5xx) are
silently skipped by checking external_id before insert.
"""

from django.db import models


class SocialMessage(models.Model):
    """Stores every incoming message from WhatsApp, Instagram, or Facebook."""

    PLATFORM_CHOICES = [
        ("whatsapp", "WhatsApp"),
        ("instagram", "Instagram"),
        ("facebook", "Facebook"),
    ]

    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    sender_id = models.CharField(max_length=255, db_index=True)
    recipient_id = models.CharField(max_length=255)
    message_text = models.TextField()
    intent = models.CharField(max_length=50, blank=True, default="")
    confidence = models.FloatField(default=0.0)
    escalation_detected = models.BooleanField(default=False)
    raw_payload = models.JSONField(default=dict)

    # --- Deduplication: Meta's unique message ID (mid) ---
    external_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
        db_index=True,
        help_text="Meta's unique message ID (mid). Prevents duplicate rows on webhook retries.",
    )

    # --- Media attachment analysis ---
    media_url = models.URLField(max_length=1000, blank=True, default="")
    media_type = models.CharField(max_length=20, blank=True, default="")
    media_verdict = models.CharField(max_length=100, blank=True, default="")
    media_confidence = models.FloatField(default=0.0)
    media_evidence_id = models.UUIDField(null=True, blank=True)

    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-received_at"]
        indexes = [
            models.Index(fields=["platform", "sender_id"], name="social_platform_sender_idx"),
            models.Index(fields=["received_at"], name="social_received_idx"),
            models.Index(fields=["media_type"], name="social_media_type_idx"),
            models.Index(fields=["external_id"], name="social_external_id_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["platform", "external_id"],
                condition=models.Q(external_id__gt=""),
                name="unique_platform_external_id",
            ),
        ]

    def __str__(self):
        return f"[{self.platform}] {self.sender_id}: {self.message_text[:50]}"

    @property
    def has_media(self):
        """Convenience flag: did this message include a media attachment?"""
        return bool(self.media_url and self.media_type)


class SocialAlert(models.Model):
    """Stores alerts generated when escalation is detected."""
    message = models.ForeignKey(
        SocialMessage,
        on_delete=models.CASCADE,
        related_name="social_alerts",
    )
    alert_type = models.CharField(max_length=50)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Alert for {self.message.sender_id}: {self.alert_type}"
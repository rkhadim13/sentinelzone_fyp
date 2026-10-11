"""
Alert model for the CyberShield AI dashboard.

Alerts are scoped to a user (except webhook-sourced alerts which have
user=None until the platform-account linking feature is added).
"""

import uuid
from django.conf import settings
from django.db import models


class Alert(models.Model):
    """
    Matches the alert shape consumed by Dashboard.js's onAlert() callback:
      { sender, type, risk, time }

    Extended with forensic fields and user scoping.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # --- Owner (null = system/global alert, e.g. from a public webhook) ---
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="alerts",
    )

    # --- Dashboard display fields ---
    sender = models.CharField(max_length=255)
    type = models.CharField(max_length=255)
    risk = models.CharField(max_length=50)
    time_label = models.CharField(max_length=50, blank=True, default="")

    # --- Forensic fields (Improvement #1) ---
    message_preview = models.CharField(max_length=200, blank=True, default="")
    username = models.CharField(max_length=150, blank=True, default="")
    full_timestamp = models.DateTimeField(null=True, blank=True)

    # --- Forensic link to the originating social message ---
    source_message = models.ForeignKey(
        "social.SocialMessage",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="dashboard_alerts",
    )
    confidence = models.FloatField(null=True, blank=True)

    # --- Delivery tracking ---
    delivered = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"], name="alert_user_created_idx"),
            models.Index(fields=["delivered"], name="alert_delivered_idx"),
            models.Index(fields=["risk"], name="alert_risk_idx"),
        ]

    def __str__(self):
        owner = self.user.username if self.user else "global"
        return f"[{owner}] {self.risk} — {self.sender} — {self.type}"
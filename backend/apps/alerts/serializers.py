"""
Serializers for the alerts app.

Exposes:
  - Dashboard display fields (sender, type, risk, time)
  - Forensic fields added in Improvement #1
    (message_preview, username, full_timestamp)
  - Forensic link fields pulled from the linked SocialMessage
    (source_message details: raw_payload, sha256, evidence_id,
    media_type, media_verdict, plus the ML confidence)
"""

from rest_framework import serializers

from .models import Alert


class AlertSerializer(serializers.ModelSerializer):
    # --- Aliases for backward compatibility ---
    time = serializers.CharField(source="time_label", read_only=True)

    # --- Forensic fields pulled from the linked SocialMessage ---
    platform = serializers.SerializerMethodField()
    raw_payload = serializers.SerializerMethodField()
    sha256 = serializers.SerializerMethodField()
    evidence_id = serializers.SerializerMethodField()
    media_type = serializers.SerializerMethodField()
    media_verdict = serializers.SerializerMethodField()
    media_confidence = serializers.SerializerMethodField()
    message_text = serializers.SerializerMethodField()

    class Meta:
        model = Alert
        fields = [
            # --- Display ---
            "id",
            "sender",
            "type",
            "risk",
            "time",
            "delivered",
            "created_at",
            # --- Forensic (Improvement #1) ---
            "message_preview",
            "username",
            "full_timestamp",
            "confidence",
            # --- Forensic link (from source SocialMessage) ---
            "platform",
            "message_text",
            "raw_payload",
            "sha256",
            "evidence_id",
            "media_type",
            "media_verdict",
            "media_confidence",
        ]

    # --- SerializerMethodField implementations ---

    def get_platform(self, obj):
        """Return the platform from the linked message, or infer from sender."""
        if obj.source_message:
            return obj.source_message.platform
        # Fallback: sender field is "Instagram · 12345"
        if obj.sender and "·" in obj.sender:
            return obj.sender.split("·")[0].strip().lower()
        return ""

    def get_message_text(self, obj):
        """Full message text from the linked SocialMessage."""
        if obj.source_message:
            return obj.source_message.message_text
        return obj.message_preview or ""

    def get_raw_payload(self, obj):
        """Original Meta JSON payload from the linked SocialMessage."""
        if obj.source_message:
            return obj.source_message.raw_payload
        return None

    def get_sha256(self, obj):
        """SHA-256 hash of the linked evidence (if any)."""
        if not obj.source_message or not obj.source_message.media_evidence_id:
            return ""
        try:
            from apps.evidence.models import EvidenceItem
            evidence = EvidenceItem.objects.get(id=obj.source_message.media_evidence_id)
            return evidence.sha256 or ""
        except Exception:
            return ""

    def get_evidence_id(self, obj):
        """UUID of the linked EvidenceItem (if any)."""
        if not obj.source_message:
            return None
        return obj.source_message.media_evidence_id

    def get_media_type(self, obj):
        """Media type from the linked SocialMessage."""
        if obj.source_message:
            return obj.source_message.media_type
        return ""

    def get_media_verdict(self, obj):
        """Media deepfake verdict from the linked SocialMessage."""
        if obj.source_message:
            return obj.source_message.media_verdict
        return ""

    def get_media_confidence(self, obj):
        """Media deepfake confidence (0-100) from the linked SocialMessage."""
        if obj.source_message:
            return obj.source_message.media_confidence
        return 0.0
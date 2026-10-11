import base64
import os

from django.conf import settings
from rest_framework import serializers

from .models import EvidenceItem, EvidenceEvent


class EvidenceEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvidenceEvent
        fields = ["id", "event_type", "prev_event_hash", "event_hash", "payload_json", "created_at"]


class EvidenceItemSerializer(serializers.ModelSerializer):
    """
    Output keys are named to match Member-3's frontend evidence objects
    exactly (title, type, content, reason, timestamp, hash, verified,
    dataUrl) so the React app can consume this response with the same
    shape it already renders in EvidenceVault.js / AppContext.js.
    """

    hash = serializers.CharField(source="sha256", read_only=True)
    timestamp = serializers.SerializerMethodField()
    dataUrl = serializers.SerializerMethodField()
    fileUrl = serializers.SerializerMethodField()
    caseId = serializers.PrimaryKeyRelatedField(source="case", read_only=True)

    class Meta:
        model = EvidenceItem
        fields = [
            "id", "caseId", "title", "type", "content", "reason",
            "hash", "verified", "timestamp", "dataUrl", "fileUrl",
            "mime_type", "source",
        ]

    def get_timestamp(self, obj):
        return obj.created_at.strftime("%Y-%m-%d %H:%M")

    def get_fileUrl(self, obj):
        if not obj.file:
            return None
        request = self.context.get("request")
        url = obj.file.url
        return request.build_absolute_uri(url) if request else url

    def get_dataUrl(self, obj):
        """
        For small files, inline them as a base64 data: URL -- this lets
        the frontend keep using `item.dataUrl` directly (e.g. for <img
        src> or the jsPDF media attachment flow in AppContext.js)
        without needing a second network round trip. Larger files
        should use `fileUrl` instead.
        """
        if not obj.file:
            return None
        try:
            size = obj.file.size
        except (FileNotFoundError, ValueError):
            return None
        if size > settings.INLINE_DATA_URL_MAX_BYTES:
            return None
        with obj.file.open("rb") as f:
            encoded = base64.b64encode(f.read()).decode("ascii")
        mime = obj.mime_type or "application/octet-stream"
        return f"data:{mime};base64,{encoded}"


class EvidenceUploadSerializer(serializers.Serializer):
    file = serializers.FileField(required=False)
    text = serializers.CharField(required=False, allow_blank=True)
    title = serializers.CharField(required=False)
    type = serializers.ChoiceField(choices=[c[0] for c in EvidenceItem.TYPE_CHOICES], required=False)
    reason = serializers.CharField(required=False, allow_blank=True)
    case_id = serializers.UUIDField(required=False, allow_null=True)

    def validate(self, attrs):
        if not attrs.get("file") and not attrs.get("text"):
            raise serializers.ValidationError("Either 'file' or 'text' is required.")
        return attrs

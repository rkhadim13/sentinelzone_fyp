from rest_framework import serializers
from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    time = serializers.CharField(source="sent_at")

    class Meta:
        model = Message
        fields = ["id", "sender", "text", "time", "flagged", "reason", "risk", "order"]


class ConversationSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)
    escalationLevel = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ["id", "contact_label", "platform", "created_at", "messages", "escalationLevel"]

    def get_escalationLevel(self, obj):
        from .classifier import escalation_level
        risks = [m.risk for m in obj.messages.all() if m.flagged]
        return escalation_level(risks)


class MessageInSerializer(serializers.Serializer):
    sender = serializers.ChoiceField(choices=["me", "them"])
    text = serializers.CharField()
    time = serializers.CharField(required=False, allow_blank=True)


class ConversationAnalyzeSerializer(serializers.Serializer):
    contact_label = serializers.CharField(required=False, default="Unknown Number")
    platform = serializers.CharField(required=False, allow_blank=True, default="")
    case_id = serializers.UUIDField(required=False, allow_null=True)
    messages = MessageInSerializer(many=True)


class ConversationImportSerializer(serializers.Serializer):
    """
    Improvement #7 — accepts a block of pasted conversation text.

    The view parses raw_text into individual messages, then runs the
    same analyze/save pipeline used by /api/timeline/analyze/.

    Supported line formats (tried in order):
        [12/25/24, 10:30:15 AM] Name: message
        12/25/24, 10:30 - Name: message
        Name: message
    """
    raw_text = serializers.CharField()
    contact_label = serializers.CharField(required=False, allow_blank=True, default="")
    platform = serializers.CharField(required=False, allow_blank=True, default="")
    case_id = serializers.UUIDField(required=False, allow_null=True)
    my_name = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        help_text="Optional. Lines whose sender matches this name are marked "
                  "as 'me'; all others are marked as 'them'.",
    )
from rest_framework import serializers
from .models import Case


class CaseSerializer(serializers.ModelSerializer):
    flaggedCount = serializers.IntegerField(source="flagged_count", read_only=True)

    class Meta:
        model = Case
        fields = ["id", "title", "date", "platform", "status", "flaggedCount", "created_at"]


class CaseCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Case
        fields = ["title", "date", "platform", "status"]

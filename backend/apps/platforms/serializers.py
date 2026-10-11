from rest_framework import serializers
from .models import PlatformConnection


class PlatformConnectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformConnection
        fields = ["name", "connected", "updated_at"]

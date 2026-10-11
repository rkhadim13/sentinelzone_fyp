from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PlatformConnection
from .serializers import PlatformConnectionSerializer

DEFAULT_PLATFORMS = ["WhatsApp", "Instagram", "Facebook"]


def _ensure_defaults():
    for name in DEFAULT_PLATFORMS:
        PlatformConnection.objects.get_or_create(name=name)


class PlatformListView(APIView):
    """
    GET /api/platforms/  -> {"WhatsApp": false, "Instagram": false, "Facebook": false}
    matches the `platforms` object read by ConnectSources.js / Settings.js
    """

    def get(self, request):
        _ensure_defaults()
        qs = PlatformConnection.objects.all()
        return Response({p.name: p.connected for p in qs})


class PlatformToggleView(APIView):
    """POST /api/platforms/<name>/toggle/  -> matches togglePlatform() in AppContext.js"""

    def post(self, request, name):
        _ensure_defaults()
        platform = get_object_or_404(PlatformConnection, name=name)
        platform.connected = not platform.connected
        platform.save(update_fields=["connected"])
        return Response(PlatformConnectionSerializer(platform).data)

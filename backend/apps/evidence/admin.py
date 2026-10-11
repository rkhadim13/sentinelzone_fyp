from django.contrib import admin
from .models import EvidenceItem, EvidenceEvent


@admin.register(EvidenceItem)
class EvidenceItemAdmin(admin.ModelAdmin):
    list_display = ["id", "title", "type", "verified", "created_at"]
    list_filter = ["type", "verified"]
    search_fields = ["title", "content", "sha256"]


@admin.register(EvidenceEvent)
class EvidenceEventAdmin(admin.ModelAdmin):
    list_display = ["id", "evidence", "event_type", "created_at"]

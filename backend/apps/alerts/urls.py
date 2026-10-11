"""
URL routing for the alerts app.

Mounted at /api/alerts/ by config/urls.py.

Endpoints:
    GET  /api/alerts/                       - Paginated list (scoped per user)
    POST /api/alerts/publish/               - Manual/test alert publisher
    POST /api/alerts/clear/                 - Clear alerts (scoped)
    GET  /api/alerts/stats/                 - Aggregated analytics
    POST /api/alerts/<uuid:id>/save-to-vault/ - Save an alert as evidence
"""

from django.urls import path
from .views import (
    AlertListView,
    AlertPublishView,
    AlertClearView,
    AlertSaveToVaultView,
    AlertStatsView,
)

urlpatterns = [
    path("", AlertListView.as_view(), name="alerts-list"),
    path("publish/", AlertPublishView.as_view(), name="alerts-publish"),
    path("clear/", AlertClearView.as_view(), name="alerts-clear"),
    path("stats/", AlertStatsView.as_view(), name="alerts-stats"),
    path("<uuid:id>/save-to-vault/", AlertSaveToVaultView.as_view(), name="alerts-save-to-vault"),
]
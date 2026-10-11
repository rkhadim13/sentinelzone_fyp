from django.urls import path
from .views import (
    EvidenceListView,
    EvidenceUploadView,
    EvidenceDetailView,
    EvidenceAnalyzeView,
    EvidenceVerifyView,
    EvidenceExportView,
    EvidenceFileView,
    EvidenceEventsView,
)

urlpatterns = [
    path("", EvidenceListView.as_view()),
    path("upload/", EvidenceUploadView.as_view()),
    path("<uuid:evidence_id>/", EvidenceDetailView.as_view()),
    path("<uuid:evidence_id>/analyze/", EvidenceAnalyzeView.as_view()),
    path("<uuid:evidence_id>/verify/", EvidenceVerifyView.as_view()),
    path("<uuid:evidence_id>/export/", EvidenceExportView.as_view()),
    path("<uuid:evidence_id>/file/", EvidenceFileView.as_view()),
    # Chain-of-custody visualizer
    path("<uuid:evidence_id>/events/", EvidenceEventsView.as_view()),
]
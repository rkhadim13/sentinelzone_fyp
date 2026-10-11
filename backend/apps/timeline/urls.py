"""
URL routing for the timeline app. Mounted at /api/timeline/ by config/urls.py.

Endpoints:
    GET  /api/timeline/         - List conversations
    POST /api/timeline/analyze/ - Analyze structured message list
    POST /api/timeline/import/  - Analyze pasted raw text (#7)
"""

from django.urls import path
from .views import (
    ConversationListView,
    ConversationAnalyzeView,
    ConversationImportView,
)

urlpatterns = [
    path("", ConversationListView.as_view(), name="timeline-list"),
    path("analyze/", ConversationAnalyzeView.as_view(), name="timeline-analyze"),
    path("import/", ConversationImportView.as_view(), name="timeline-import"),
]
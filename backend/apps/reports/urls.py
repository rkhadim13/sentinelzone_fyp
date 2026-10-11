from django.urls import path
from .views import CaseListView, CaseDetailView, CaseExportView

urlpatterns = [
    path("cases/", CaseListView.as_view()),
    path("cases/<uuid:case_id>/", CaseDetailView.as_view()),
    path("case/<uuid:case_id>/export/", CaseExportView.as_view()),
]

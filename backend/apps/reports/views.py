from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.evidence.models import EvidenceItem
from apps.evidence.services import append_event
from .models import Case
from .pdf import build_case_report
from .serializers import CaseSerializer, CaseCreateSerializer


class CaseListView(APIView):
    """
    GET  /api/reports/cases/   -> matches the `cases` array in ReportGenerator.js
    POST /api/reports/cases/   -> create a new case
    """

    def get(self, request):
        return Response(CaseSerializer(Case.objects.all(), many=True).data)

    def post(self, request):
        serializer = CaseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        case = serializer.save()
        return Response(CaseSerializer(case).data, status=status.HTTP_201_CREATED)


class CaseDetailView(APIView):
    def get(self, request, case_id):
        case = get_object_or_404(Case, id=case_id)
        return Response(CaseSerializer(case).data)


class CaseExportView(APIView):
    """POST /api/reports/case/<case_id>/export/ -> PDF, matches ReportGenerator.js's handleDownload()"""

    def post(self, request, case_id):
        case = get_object_or_404(Case, id=case_id)
        evidence_qs = EvidenceItem.objects.filter(case_id=case_id).order_by("created_at")

        pdf_bytes = build_case_report(case, evidence_qs)

        for ev in evidence_qs:
            append_event(ev, "exported", {"action": "exported", "case_id": str(case_id)})

        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="SentinelZone_Report_{case_id}.pdf"'
        return response

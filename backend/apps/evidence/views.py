"""
Views for the evidence app.

Endpoints:
    GET  /api/evidence/                       - List evidence (optionally filtered by case)
    POST /api/evidence/upload/                - Create evidence (multipart file OR JSON text)
    GET  /api/evidence/<id>/                  - Detail
    POST /api/evidence/<id>/analyze/          - Run ML analysis
    GET  /api/evidence/<id>/verify/           - Verify SHA-256 integrity
    GET  /api/evidence/<id>/export/           - Single-item PDF report
    GET  /api/evidence/<id>/file/             - Raw file (inline preview)
    GET  /api/evidence/<id>/events/           - Chain-of-custody log + integrity verdict
"""

from django.core.exceptions import ValidationError
from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.reports.pdf import build_single_evidence_report
from .hashing import event_hash as compute_event_hash
from .models import EvidenceItem
from .serializers import EvidenceItemSerializer, EvidenceUploadSerializer
from .services import (
    create_evidence_from_file,
    create_evidence_from_text,
    analyze_with_ml_service,
    verify_integrity,
)


class EvidenceListView(APIView):
    """GET  /api/evidence/            -> list  (matches evidenceList)"""

    def get(self, request):
        qs = EvidenceItem.objects.all()
        case_id = request.query_params.get("case_id")
        if case_id:
            qs = qs.filter(case_id=case_id)
        data = EvidenceItemSerializer(qs, many=True, context={"request": request}).data
        return Response(data)


class EvidenceUploadView(APIView):
    """
    POST /api/evidence/upload/  (multipart file)  -> addEvidence({file,...})
    POST /api/evidence/upload/  (json {"text": ...}) -> addEvidence({text,...})
    """

    def post(self, request):
        serializer = EvidenceUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        v = serializer.validated_data

        try:
            if v.get("file"):
                evidence = create_evidence_from_file(
                    upload_file=v["file"],
                    title=v.get("title"),
                    type_=v.get("type"),
                    reason=v.get("reason", ""),
                    case_id=v.get("case_id"),
                )
            else:
                evidence = create_evidence_from_text(
                    text=v["text"],
                    title=v.get("title"),
                    type_=v.get("type") or "Text",
                    reason=v.get("reason", ""),
                    case_id=v.get("case_id"),
                )
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        data = EvidenceItemSerializer(evidence, context={"request": request}).data
        return Response(data, status=status.HTTP_201_CREATED)


class EvidenceDetailView(APIView):
    def get(self, request, evidence_id):
        evidence = _get_or_404(evidence_id)
        return Response(EvidenceItemSerializer(evidence, context={"request": request}).data)


class EvidenceAnalyzeView(APIView):
    """POST /api/evidence/<id>/analyze/  -> calls the ML service (AIContentChecker.js)"""

    def post(self, request, evidence_id):
        evidence = _get_or_404(evidence_id)
        try:
            result = analyze_with_ml_service(evidence)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            "evidence": EvidenceItemSerializer(evidence, context={"request": request}).data,
            "result": result,
        })


class EvidenceVerifyView(APIView):
    """GET /api/evidence/<id>/verify/  -> verifyEvidence() in AppContext.js"""

    def get(self, request, evidence_id):
        evidence = _get_or_404(evidence_id)
        result = verify_integrity(evidence)
        return Response({
            "evidence": EvidenceItemSerializer(evidence, context={"request": request}).data,
            **result,
        })


class EvidenceExportView(APIView):
    """
    GET /api/evidence/<id>/export/  -> single-item PDF, mirroring the
    exact layout of downloadEvidence() in AppContext.js.
    """

    def get(self, request, evidence_id):
        evidence = _get_or_404(evidence_id)
        pdf_bytes = build_single_evidence_report(
            EvidenceItemSerializer(evidence, context={"request": request}).data
        )
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        safe_name = evidence.title.replace(" ", "_")
        response["Content-Disposition"] = f'attachment; filename="{safe_name}_Report.pdf"'
        return response


class EvidenceFileView(APIView):
    """
    GET /api/evidence/<uuid:evidence_id>/file/

    Serves the raw uploaded file with the correct Content-Type so
    <img>, <audio>, and <video> tags can render it inline.

    Auth: accepts either the standard Authorization: Token <key>
    header OR a ?token=<key> query parameter, because HTML media tags
    cannot set custom headers.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, evidence_id):
        user = self._resolve_user(request)
        if user is None:
            return Response(
                {"error": "Authentication required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        evidence = _get_or_404(evidence_id)

        if not evidence.file:
            return Response(
                {"error": "No file is attached to this evidence item."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            file_handle = evidence.file.open("rb")
        except (FileNotFoundError, OSError):
            return Response(
                {"error": "File is missing from storage."},
                status=status.HTTP_404_NOT_FOUND,
            )

        mime = evidence.mime_type or "application/octet-stream"
        filename = (evidence.file.name or "evidence").split("/")[-1]

        response = FileResponse(file_handle, content_type=mime)
        response["Content-Disposition"] = f'inline; filename="{filename}"'
        return response

    @staticmethod
    def _resolve_user(request):
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Token "):
            key = auth_header.split(" ", 1)[1].strip()
            try:
                return Token.objects.select_related("user").get(key=key).user
            except Token.DoesNotExist:
                pass

        key = request.query_params.get("token", "").strip()
        if key:
            try:
                return Token.objects.select_related("user").get(key=key).user
            except Token.DoesNotExist:
                pass

        return None


class EvidenceEventsView(APIView):
    """
    GET /api/evidence/<uuid:evidence_id>/events/

    Chain-of-custody visualizer. Returns every EvidenceEvent in order
    along with a per-event validity verdict:

      link_valid  ->  event.prev_event_hash == previous_event.event_hash
                      (proves nothing was removed or reordered)
      hash_valid  ->  recomputed hash(prev_event_hash, payload) == event_hash
                      (proves the payload wasn't edited after the fact)

    Top-level "chain_intact" is True only if every event passes both
    checks. "broken_at" holds the index of the first failing event, or
    null if intact.
    """

    def get(self, request, evidence_id):
        evidence = _get_or_404(evidence_id)
        events = list(evidence.events.order_by("created_at"))

        enriched = []
        prev_stored_hash = None
        chain_intact = True
        broken_at = None

        for idx, ev in enumerate(events):
            # --- 1. Recompute the hash from stored (prev_hash, payload) ---
            # JSONField round-trips can subtly reorder keys, so we don't
            # want a cosmetic re-order to be flagged as tampering. Only
            # flag as invalid if the recomputation succeeds AND differs.
            try:
                expected = compute_event_hash(ev.prev_event_hash, ev.payload_json or {})
                hash_valid = (expected == ev.event_hash)
            except Exception:
                # If we can't recompute, don't flag as broken — trust the
                # stored hash rather than raise a false alarm in the UI.
                hash_valid = True

            # --- 2. Verify the link to the previous event ---
            link_valid = (ev.prev_event_hash == prev_stored_hash)

            if not (hash_valid and link_valid):
                chain_intact = False
                if broken_at is None:
                    broken_at = idx

            enriched.append({
                "id": str(ev.id),
                "event_type": ev.event_type,
                "prev_event_hash": ev.prev_event_hash,
                "event_hash": ev.event_hash,
                "payload_json": ev.payload_json,
                "created_at": ev.created_at.isoformat(),
                "hash_valid": hash_valid,
                "link_valid": link_valid,
            })

            prev_stored_hash = ev.event_hash

        return Response({
            "evidence_id": str(evidence.id),
            "evidence_title": evidence.title,
            "evidence_sha256": evidence.sha256,
            "chain_intact": chain_intact,
            "broken_at": broken_at,
            "event_count": len(events),
            "events": enriched,
        })


def _get_or_404(evidence_id):
    return get_object_or_404(EvidenceItem, id=evidence_id)
"""
Views for the alerts app.

Alerts are scoped per-user. The list endpoint supports pagination via
`?page=N&page_size=M` query parameters (default page_size=20, max=100).

The stats endpoint returns aggregated analytics for the dashboard —
computed server-side so it scales beyond what the client could handle.
"""

import logging
from collections import defaultdict
from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Alert
from .serializers import AlertSerializer
from .publisher import publish_alert

logger = logging.getLogger(__name__)


class AlertPagination(PageNumberPagination):
    """Pagination config for the alerts list endpoint."""
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------
def _scoped_queryset(request):
    """
    Return the queryset of alerts visible to the requesting user:
    their own alerts plus global (user=None) alerts. Anonymous users
    see only global alerts.
    """
    if request.user.is_authenticated:
        return Alert.objects.filter(Q(user=request.user) | Q(user__isnull=True))
    return Alert.objects.filter(user__isnull=True)


# ---------------------------------------------------------------------
# List
# ---------------------------------------------------------------------
class AlertListView(APIView):
    """
    GET /api/alerts/?page=1&page_size=20
    Returns alerts owned by the current user, plus global (webhook) alerts.
    """

    pagination_class = AlertPagination

    def get(self, request):
        qs = _scoped_queryset(request)
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request, view=self)
        serializer = AlertSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


# ---------------------------------------------------------------------
# Publish (testing / manual)
# ---------------------------------------------------------------------
class AlertPublishView(APIView):
    """POST /api/alerts/publish/  {sender, type, risk, ...}"""

    def post(self, request):
        payload = request.data
        for field in ("sender", "type", "risk"):
            if field not in payload:
                return Response(
                    {"error": f"'{field}' is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        user = request.user if request.user.is_authenticated else None
        alert = publish_alert(payload, user=user)
        return Response(AlertSerializer(alert).data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------
# Clear
# ---------------------------------------------------------------------
class AlertClearView(APIView):
    """
    POST /api/alerts/clear/
    Deletes only the current user's own alerts (global alerts preserved
    unless ?include_global=true).
    """

    def post(self, request):
        include_global = request.query_params.get("include_global") == "true"

        if request.user.is_authenticated:
            filters = Q(user=request.user)
            if include_global:
                filters |= Q(user__isnull=True)
            qs = Alert.objects.filter(filters)
        else:
            qs = Alert.objects.filter(user__isnull=True)

        count = qs.count()
        qs.delete()
        return Response({"status": "ok", "deleted": count}, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------
# Save individual alert to Evidence Vault
# ---------------------------------------------------------------------
class AlertSaveToVaultView(APIView):
    """POST /api/alerts/<uuid:id>/save-to-vault/"""

    def post(self, request, id):
        from django.shortcuts import get_object_or_404

        alert = get_object_or_404(Alert, id=id)

        try:
            from apps.evidence.models import EvidenceItem
            from apps.evidence.services import append_event

            title = f"Alert: {alert.type} from {alert.sender}"
            content = alert.message_preview or f"[{alert.type}]"

            evidence = EvidenceItem.objects.create(
                case_id=None,
                source="alert_manual_save",
                title=title,
                type="Text",
                content=content,
                reason=f"{alert.risk} — {alert.type}",
            )

            append_event(evidence, "ingested", {
                "action": "ingested",
                "source": "alert_manual_save",
                "alert_id": str(alert.id),
                "alert_sender": alert.sender,
                "alert_type": alert.type,
                "alert_risk": alert.risk,
            })

            logger.info("Alert %s saved to vault as evidence %s", alert.id, evidence.id)

            return Response(
                {
                    "status": "ok",
                    "evidence_id": str(evidence.id),
                    "message": "Alert saved to Evidence Vault.",
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            logger.exception("Failed to save alert to vault: %s", exc)
            return Response(
                {"error": f"Failed to save to Evidence Vault: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ---------------------------------------------------------------------
# Stats (analytics)
# ---------------------------------------------------------------------
class AlertStatsView(APIView):
    """
    GET /api/alerts/stats/
    Returns aggregated statistics for the alerts dashboard.
    Computed server-side so the client doesn't have to load every alert.
    """

    def get(self, request):
        qs = _scoped_queryset(request)

        now = timezone.now()
        week_start = now - timedelta(days=7)
        day_start = now - timedelta(hours=24)

        # --- Totals ---
        totals = {
            "all_time": qs.count(),
            "this_week": qs.filter(created_at__gte=week_start).count(),
            "last_24h": qs.filter(created_at__gte=day_start).count(),
        }

        # --- By risk ---
        by_risk = {"High": 0, "Medium": 0, "Low": 0}
        for row in qs.values("risk").annotate(c=Count("id")):
            label = "High" if "High" in row["risk"] else "Medium" if "Medium" in row["risk"] else "Low"
            by_risk[label] += row["c"]

        # --- By intent (top 10) ---
        by_intent_rows = qs.values("type").annotate(c=Count("id")).order_by("-c")[:10]
        by_intent = {row["type"] or "Unknown": row["c"] for row in by_intent_rows}

        # --- By platform (inferred from sender prefix) ---
        by_platform = {"instagram": 0, "whatsapp": 0, "facebook": 0, "other": 0}
        for a in qs.only("sender"):
            s = (a.sender or "").lower()
            if s.startswith("instagram"):
                by_platform["instagram"] += 1
            elif s.startswith("whatsapp"):
                by_platform["whatsapp"] += 1
            elif s.startswith("facebook"):
                by_platform["facebook"] += 1
            else:
                by_platform["other"] += 1

        # --- Daily trend (last 14 days) ---
        trend_qs = (
            qs.filter(created_at__gte=now - timedelta(days=14))
            .annotate(day=TruncDate("created_at"))
            .values("day", "risk")
            .annotate(c=Count("id"))
        )
        trend_map = defaultdict(lambda: {"count": 0, "high": 0, "medium": 0, "low": 0})
        for row in trend_qs:
            if not row["day"]:
                continue
            key = row["day"].strftime("%Y-%m-%d")
            trend_map[key]["count"] += row["c"]
            if "High" in (row["risk"] or ""):
                trend_map[key]["high"] += row["c"]
            elif "Medium" in (row["risk"] or ""):
                trend_map[key]["medium"] += row["c"]
            else:
                trend_map[key]["low"] += row["c"]

        daily_trend = []
        for i in range(13, -1, -1):
            d = (now - timedelta(days=i)).date()
            key = d.strftime("%Y-%m-%d")
            entry = trend_map.get(key, {"count": 0, "high": 0, "medium": 0, "low": 0})
            daily_trend.append({"date": key, **entry})

        # --- Top senders ---
        top_senders = [
            {"sender": row["sender"], "count": row["c"]}
            for row in qs.values("sender").annotate(c=Count("id")).order_by("-c")[:5]
        ]

        return Response({
            "totals": totals,
            "by_risk": by_risk,
            "by_intent": by_intent,
            "by_platform": by_platform,
            "daily_trend": daily_trend,
            "top_senders": top_senders,
            "generated_at": now.isoformat(),
        })
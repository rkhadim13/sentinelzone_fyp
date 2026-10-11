"""
Views for the timeline app.

    GET  /api/timeline/         - List all conversations
    POST /api/timeline/analyze/ - Analyze a structured message list
    POST /api/timeline/import/  - Analyze a pasted raw-text conversation (#7)

The analyze pipeline is shared via _run_analysis(), so behavior (flagging,
evidence creation, live alerts) stays identical across both endpoints.
"""

import re

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.evidence.services import create_evidence_from_text
from apps.alerts.publisher import publish_alert
from .classifier import classify_message, escalation_level
from .models import Conversation, Message
from .serializers import (
    ConversationSerializer,
    ConversationAnalyzeSerializer,
    ConversationImportSerializer,
)


# =====================================================================
# Raw-text parser (improvement #7)
# =====================================================================
# Three formats tried in order. The third one (Name: message) is
# deliberately last so a chat log that happens to start with a name
# doesn't shadow a more specific WhatsApp format.
_LINE_PATTERNS = [
    # [12/25/24, 10:30:15 AM] Name: message
    re.compile(r"^\[(?P<time>[^\]]+)\]\s*(?P<sender>[^:]+?)\s*:\s*(?P<text>.+)$"),
    # 12/25/24, 10:30 - Name: message   (also 10:30 AM - Name: message)
    re.compile(
        r"^(?P<time>[\d]{1,4}[\/\-][\d]{1,2}[\/\-][\d]{1,4},?\s+[\d:]+\s*(?:[APap][Mm])?)\s*-\s*(?P<sender>[^:]+?)\s*:\s*(?P<text>.+)$"
    ),
    # Name: message  (fallback)
    re.compile(r"^(?P<sender>[^:]{1,60}?)\s*:\s*(?P<text>.+)$"),
]


def parse_raw_conversation(raw_text: str, my_name: str = "") -> list:
    """
    Split pasted conversation text into [{sender, text, time}, ...].

    - Blank lines and non-matching lines are skipped.
    - A line's sender becomes 'me' when it matches `my_name`
      (case-insensitive). Otherwise it becomes 'them'.
    - Returns [] if nothing matched, so the caller can return a 400.
    """
    my_name_l = (my_name or "").strip().lower()
    parsed = []

    for raw_line in (raw_text or "").splitlines():
        line = raw_line.strip()
        if not line:
            continue

        for pattern in _LINE_PATTERNS:
            match = pattern.match(line)
            if not match:
                continue

            groups = match.groupdict()
            sender_raw = (groups.get("sender") or "").strip()
            text = (groups.get("text") or "").strip()
            time_str = (groups.get("time") or "").strip()

            if not sender_raw or not text:
                continue

            sender = "me" if my_name_l and sender_raw.lower() == my_name_l else "them"
            parsed.append({
                "sender": sender,
                "text": text,
                "time": time_str,
            })
            break  # stop at first matching pattern for this line

    return parsed


# =====================================================================
# Shared analyze / save pipeline
# =====================================================================
def _run_analysis(v: dict) -> tuple:
    """
    Given validated input {contact_label, platform, case_id?, messages},
    persist the conversation, classify each message, save evidence for
    flagged ones, and publish live alerts for High-risk findings.

    Returns (conversation, flagged_risks_list).
    """
    conversation = Conversation.objects.create(
        contact_label=v.get("contact_label") or "Unknown Number",
        platform=v.get("platform", "") or "",
        case_id=v.get("case_id"),
    )

    flagged_risks = []
    for idx, m in enumerate(v["messages"]):
        flagged, reason, risk = classify_message(m["text"])
        Message.objects.create(
            conversation=conversation,
            sender=m["sender"],
            text=m["text"],
            sent_at=m.get("time", "") or "",
            flagged=flagged,
            reason=reason or "",
            risk=risk or "",
            order=idx,
        )

        if flagged:
            flagged_risks.append(risk)
            create_evidence_from_text(
                text=m["text"],
                title=f"Timeline - {reason}",
                type_="Text",
                reason=reason,
                case_id=v.get("case_id"),
                source="conversation_timeline",
            )
            if risk == "High":
                publish_alert({
                    "sender": conversation.contact_label,
                    "type": reason,
                    "risk": f"{risk} Risk",
                    "time": m.get("time") or "just now",
                })

    return conversation, flagged_risks


# =====================================================================
# Views
# =====================================================================
class ConversationListView(APIView):
    """GET /api/timeline/ — list every conversation."""

    def get(self, request):
        qs = Conversation.objects.all()
        return Response(ConversationSerializer(qs, many=True).data)


class ConversationAnalyzeView(APIView):
    """
    POST /api/timeline/analyze/
    body: {contact_label, platform, case_id?, messages: [{sender, text, time}]}
    """

    def post(self, request):
        serializer = ConversationAnalyzeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        v = serializer.validated_data

        conversation, flagged_risks = _run_analysis(v)

        return Response({
            "conversation": ConversationSerializer(conversation).data,
            "escalationLevel": escalation_level(flagged_risks),
            "flaggedCount": len(flagged_risks),
        }, status=status.HTTP_201_CREATED)


class ConversationImportView(APIView):
    """
    POST /api/timeline/import/
    body: {raw_text, contact_label?, platform?, case_id?, my_name?}

    Improvement #7 — paste-a-conversation. Splits raw text into individual
    messages, then runs the same analyze pipeline as /analyze/.
    """

    def post(self, request):
        serializer = ConversationImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        v = serializer.validated_data

        parsed = parse_raw_conversation(v["raw_text"], v.get("my_name", ""))

        if not parsed:
            return Response(
                {
                    "error": (
                        "Could not parse any messages from the pasted text. "
                        "Each line should look like 'Name: message' or "
                        "'12/25/24, 10:30 - Name: message'."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        analyze_input = {
            "contact_label": v.get("contact_label") or "Unknown Number",
            "platform": v.get("platform", "") or "",
            "case_id": v.get("case_id"),
            "messages": parsed,
        }

        conversation, flagged_risks = _run_analysis(analyze_input)

        return Response({
            "conversation": ConversationSerializer(conversation).data,
            "escalationLevel": escalation_level(flagged_risks),
            "flaggedCount": len(flagged_risks),
            "parsedCount": len(parsed),
        }, status=status.HTTP_201_CREATED)
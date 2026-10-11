"""
Webhook views for the social app.

This module provides a single endpoint that receives all webhook traffic from
Meta platforms (WhatsApp, Instagram, Facebook).

  GET  - Meta uses this to verify the webhook. We must echo back the
         'hub.challenge' parameter if the verify token matches.
  POST - Meta sends this whenever a new message arrives. We verify the
         signature, parse the payload, and run the ML pipeline.
"""

import json
import logging

from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .signature_verify import verify_meta_signature
from .webhook_handlers import process_payload, handle_message
from rest_framework.decorators import throttle_classes


logger = logging.getLogger(__name__)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def social_webhook(request):
    """
    Single webhook endpoint for WhatsApp, Instagram, and Facebook.

    The same URL is registered in the Meta Developer Dashboard for all three
    products. Meta distinguishes them via the top-level 'object' field in the
    POST payload.
    """
    # ---------------------------------------------------------
    # VERIFICATION HANDSHAKE (GET)
    # ---------------------------------------------------------
    if request.method == "GET":
        mode = request.GET.get("hub.mode")
        token = request.GET.get("hub.verify_token")
        challenge = request.GET.get("hub.challenge")

        expected_token = getattr(settings, "META_VERIFY_TOKEN", "")

        if mode == "subscribe" and token and token == expected_token:
            logger.info("Webhook verification succeeded.")
            return HttpResponse(challenge or "", status=200)

        logger.warning(
            "Webhook verification failed. mode=%r token_match=%s",
            mode,
            token == expected_token,
        )
        return HttpResponse("Verification failed", status=403)

    # ---------------------------------------------------------
    # INCOMING MESSAGES (POST)
    # ---------------------------------------------------------
    if not verify_meta_signature(request):
        logger.warning("Rejected webhook POST: invalid signature.")
        return JsonResponse({"error": "Invalid signature"}, status=403)

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        logger.warning("Invalid JSON in webhook payload: %s", exc)
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    object_type = payload.get("object", "unknown")
    logger.info("Webhook received: object=%s", object_type)

    # Meta sends test payloads with object == 'page' and an empty entry list.
    # Simply acknowledge them.
    try:
        messages = process_payload(payload)
    except Exception as exc:
        logger.exception("Failed to parse webhook payload: %s", exc)
        # Always return 200 to Meta so it doesn't retry indefinitely.
        return JsonResponse({"status": "parse_error"}, status=200)

    saved_count = 0
    for msg in messages:
        try:
            handle_message(msg)
            saved_count += 1
        except Exception as exc:
            logger.exception("Failed to handle message: %s", exc)

    logger.info("Processed %d message(s) from webhook.", saved_count)

    # Meta requires a 200 OK response, otherwise it will retry.
    return JsonResponse({"status": "ok", "processed": saved_count}, status=200)
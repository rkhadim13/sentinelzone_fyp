"""
Signature verification for Meta webhook requests.

Meta signs every webhook POST request with an HMAC-SHA256 hash using the
App Secret. We recompute the hash and compare it with the header Meta sends
(X-Hub-Signature-256). If they match, the request is authentic.

In development (DEBUG=True and META_APP_SECRET unset), verification is
skipped so you can test the webhook with curl/requests. In production the
secret MUST be set, and requests with a missing/invalid signature are
rejected.
"""

import hmac
import hashlib
import logging

from django.conf import settings

logger = logging.getLogger(__name__)


def verify_meta_signature(request) -> bool:
    """
    Verify the X-Hub-Signature-256 header sent by Meta.

    Returns:
        bool: True if the request is authentic (or if dev bypass is active),
              False otherwise.
    """
    app_secret = getattr(settings, "META_APP_SECRET", "") or ""

    # --- DEV BYPASS ---
    # If no App Secret is configured AND DEBUG is on, skip verification.
    # This lets you test locally without signing requests.
    if not app_secret and settings.DEBUG:
        logger.warning(
            "META_APP_SECRET not set and DEBUG=True: skipping signature check."
        )
        return True

    # --- PRODUCTION PATH ---
    if not app_secret:
        logger.error("META_APP_SECRET is not set. Rejecting webhook request.")
        return False

    signature_header = request.headers.get("X-Hub-Signature-256", "")
    if not signature_header:
        logger.warning("Missing X-Hub-Signature-256 header.")
        return False

    if not signature_header.startswith("sha256="):
        logger.warning("Malformed X-Hub-Signature-256 header.")
        return False

    received_signature = signature_header.split("sha256=", 1)[1].strip()

    expected_signature = hmac.new(
        key=app_secret.encode("utf-8"),
        msg=request.body,
        digestmod=hashlib.sha256,
    ).hexdigest()

    is_valid = hmac.compare_digest(received_signature, expected_signature)
    if not is_valid:
        logger.warning("Signature mismatch. Possible spoofed webhook request.")
    return is_valid
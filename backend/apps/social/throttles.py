"""
Custom DRF throttle classes for the social app.

The webhook endpoint is public (Meta sends messages to it) and therefore
must be rate-limited per IP to prevent abuse. Django REST Framework's
built-in throttling handles this cleanly.
"""

from rest_framework.throttling import AnonRateThrottle


class WebhookThrottle(AnonRateThrottle):
    """
    Rate limit for the public webhook endpoint.

    Scope is defined in settings.py under DEFAULT_THROTTLE_RATES.
    Because Meta sends webhooks without an authenticated user, we throttle
    by IP address using AnonRateThrottle.
    """

    scope = "webhook"
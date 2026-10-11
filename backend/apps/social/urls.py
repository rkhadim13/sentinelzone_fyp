"""
URL routing for the social app.

Mounted at /api/social/ by config/urls.py.

Provides:
    /api/social/webhook/    - single webhook endpoint for Meta platforms
"""

from django.urls import path
from . import views

app_name = "social"

urlpatterns = [
    path("webhook/", views.social_webhook, name="webhook"),
]
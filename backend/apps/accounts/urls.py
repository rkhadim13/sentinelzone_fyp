"""
URL routing for the accounts app.

Mounted at /api/auth/ by config/urls.py.
"""

from django.urls import path
from .views import (
    SignupView,
    LoginView,
    ForgotPasswordView,
    DeleteAccountDataView,
    MeView,
    UpdateProfileView,
    ChangePasswordView,
)

urlpatterns = [
    path("signup/", SignupView.as_view(), name="signup"),
    path("login/", LoginView.as_view(), name="login"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot-password"),
    path("delete-account/", DeleteAccountDataView.as_view(), name="delete-account"),
    # NEW endpoints (used by the updated frontend)
    path("me/", MeView.as_view(), name="me"),
    path("profile/", UpdateProfileView.as_view(), name="update-profile"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
]
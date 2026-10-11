"""
Views for the accounts app.

Endpoints:
    POST /api/auth/signup/           - Create a new user
    POST /api/auth/login/            - Authenticate and return a token
    POST /api/auth/forgot-password/  - Password reset request (stub)
    POST /api/auth/delete-account/   - Permanently delete user data
    GET  /api/auth/me/               - Return current user profile
    POST /api/auth/profile/          - Update name / phone / language
    POST /api/auth/change-password/  - Change the authenticated user's password
"""

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Profile
from .serializers import SignupSerializer, LoginSerializer, ForgotPasswordSerializer


# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------
def _serialize_user(user: User) -> dict:
    """
    Build the standard user payload returned by /login, /signup, /me
    and /profile. Keeps the exact field names the frontend expects.
    """
    profile, _ = Profile.objects.get_or_create(user=user)

    return {
        "id": user.id,
        "email": user.email,
        "name": user.first_name or user.username,
        "phone": profile.phone or "",
        "gender": profile.gender or "",
        "dob": profile.dob.isoformat() if profile.dob else "",
        "language": profile.language or "en",
        "date_joined": user.date_joined.isoformat() if user.date_joined else "",
    }


# ---------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------
class SignupView(APIView):
    """POST /api/auth/signup/"""

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        payload = {"token": token.key}
        payload.update(_serialize_user(user))
        return Response(payload, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """POST /api/auth/login/"""

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]

        user = authenticate(username=email, password=password)
        if not user:
            return Response(
                {"error": "Invalid email or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        token, _ = Token.objects.get_or_create(user=user)
        payload = {"token": token.key}
        payload.update(_serialize_user(user))
        return Response(payload)


class ForgotPasswordView(APIView):
    """POST /api/auth/forgot-password/ — MVP stub."""

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        User.objects.filter(username=email).exists()
        return Response(
            {"message": "If an account exists for this email, a reset link has been sent."}
        )


class DeleteAccountDataView(APIView):
    """POST /api/auth/delete-account/ — permanently wipe the user's data."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        from apps.evidence.models import EvidenceItem
        from apps.reports.models import Case
        from apps.alerts.models import Alert
        from apps.platforms.models import PlatformConnection

        counts = {
            "evidence": EvidenceItem.objects.count(),
            "cases": Case.objects.count(),
            "alerts": Alert.objects.count(),
            "platforms": PlatformConnection.objects.count(),
        }

        for evidence in EvidenceItem.objects.all():
            if evidence.file:
                try:
                    evidence.file.delete(save=False)
                except Exception:
                    pass

        EvidenceItem.objects.all().delete()
        Case.objects.all().delete()
        Alert.objects.all().delete()
        PlatformConnection.objects.all().delete()

        Token.objects.filter(user=user).delete()
        user.delete()

        return Response(
            {
                "status": "ok",
                "message": "All data deleted successfully.",
                "deleted_counts": counts,
            },
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------
# Profile endpoints (used by the updated frontend)
# ---------------------------------------------------------------------
class MeView(APIView):
    """GET /api/auth/me/ — return the authenticated user's profile."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(_serialize_user(request.user))


class UpdateProfileView(APIView):
    """
    POST /api/auth/profile/  { name?, phone?, language? }
    Update the authenticated user's name, phone, and/or language.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        data = request.data or {}

        name = (data.get("name") or "").strip()
        phone = (data.get("phone") or "").strip()
        language = (data.get("language") or "").strip().lower()

        # --- Update name on the User model ---
        if name:
            user.first_name = name
            user.save(update_fields=["first_name"])

        # --- Update Profile fields ---
        profile, _ = Profile.objects.get_or_create(user=user)
        profile_updated = False

        if phone:
            profile.phone = phone
            profile_updated = True

        if language and language in {c[0] for c in Profile.LANGUAGE_CHOICES}:
            profile.language = language
            profile_updated = True

        if profile_updated:
            profile.save()

        return Response(_serialize_user(user))


class ChangePasswordView(APIView):
    """POST /api/auth/change-password/  { currentPassword, newPassword }"""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        data = request.data or {}
        current = data.get("currentPassword") or data.get("current_password") or ""
        new = data.get("newPassword") or data.get("new_password") or ""

        if not current or not new:
            return Response(
                {"error": "Both currentPassword and newPassword are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.check_password(current):
            return Response(
                {"error": "Current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new) < 8:
            return Response(
                {"error": "New password must be at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new)
        user.save()

        # Rotate the auth token so old sessions are invalidated
        Token.objects.filter(user=user).delete()
        new_token = Token.objects.create(user=user)

        return Response(
            {
                "status": "ok",
                "message": "Password updated successfully.",
                "token": new_token.key,
            },
            status=status.HTTP_200_OK,
        )
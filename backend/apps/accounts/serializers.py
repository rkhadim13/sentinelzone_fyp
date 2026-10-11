"""
Serializers for the accounts app.

Signup saves the extra Profile fields (gender, dob, phone, language)
that the frontend's sign-up form collects, so they aren't dropped.
"""

from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import serializers

from .models import Profile


# ---------------------------------------------------------------------
# Signup
# ---------------------------------------------------------------------
class SignupSerializer(serializers.Serializer):
    """
    Validates and creates a new User + Profile from the signup form.

    Expected payload:
        {
            "name": "Full Name",
            "email": "user@example.com",
            "password": "...",
            "gender": "male" | "female" | "other" (optional),
            "dob": "YYYY-MM-DD" (optional),
            "phone": "03XXXXXXXXX" (optional),
            "language": "en" | "ur" (optional, default "en")
        }
    """

    name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    gender = serializers.CharField(required=False, allow_blank=True, max_length=10)
    dob = serializers.DateField(required=False, allow_null=True)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=20)
    language = serializers.CharField(required=False, allow_blank=True, max_length=2)

    def validate_email(self, value):
        email = value.lower().strip()
        if User.objects.filter(username=email).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return email

    def validate_gender(self, value):
        if not value:
            return ""
        value = value.lower().strip()
        valid = {choice[0] for choice in Profile.GENDER_CHOICES}
        if value not in valid:
            raise serializers.ValidationError(f"Gender must be one of: {sorted(valid)}.")
        return value

    def validate_language(self, value):
        if not value:
            return "en"
        value = value.lower().strip()
        valid = {choice[0] for choice in Profile.LANGUAGE_CHOICES}
        if value not in valid:
            return "en"
        return value

    @transaction.atomic
    def create(self, validated_data):
        email = validated_data["email"]
        password = validated_data["password"]
        name = validated_data["name"].strip()

        # --- Create the User (username = email) ---
        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=name,
        )

        # --- Create/update the Profile with extra fields ---
        profile, _ = Profile.objects.get_or_create(user=user)
        profile.gender = validated_data.get("gender", "") or ""
        profile.dob = validated_data.get("dob")
        profile.phone = validated_data.get("phone", "") or ""
        profile.language = validated_data.get("language", "en") or "en"
        profile.save()

        return user


# ---------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------
class LoginSerializer(serializers.Serializer):
    """Validates the login form. Actual auth happens in the view."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate_email(self, value):
        return value.lower().strip()


# ---------------------------------------------------------------------
# Forgot Password
# ---------------------------------------------------------------------
class ForgotPasswordSerializer(serializers.Serializer):
    """Validates the forgot-password form (email only)."""

    email = serializers.EmailField()

    def validate_email(self, value):
        return value.lower().strip()
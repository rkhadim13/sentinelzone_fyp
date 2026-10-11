"""
Models for the accounts app.

Profile extends Django's built-in User with fields the frontend needs
that aren't part of the default User model: gender, dob, phone, language.

A post_save signal guarantees every User (existing or new) has a Profile
row, so views can safely access `user.profile` without try/except guards.
"""

from django.conf import settings
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class Profile(models.Model):
    """Extra signup fields collected by Login.js's sign-up form."""

    GENDER_CHOICES = [
        ("male", "Male"),
        ("female", "Female"),
        ("other", "Other"),
    ]

    LANGUAGE_CHOICES = [
        ("en", "English"),
        ("ur", "Urdu (اردو)"),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    gender = models.CharField(
        max_length=10,
        choices=GENDER_CHOICES,
        blank=True,
        default="",
    )
    dob = models.DateField(null=True, blank=True)
    phone = models.CharField(
        max_length=20,
        blank=True,
        default="",
    )  # validated as 03XXXXXXXXX on the frontend

    # --- Language preference for the UI (Improvement #11) ---
    language = models.CharField(
        max_length=2,
        choices=LANGUAGE_CHOICES,
        default="en",
        help_text="UI language preference: 'en' (English) or 'ur' (Urdu).",
    )

    def __str__(self):
        return self.user.username


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def _create_profile_for_new_user(sender, instance, created, **kwargs):
    """Ensure every User has a Profile row."""
    if created:
        Profile.objects.get_or_create(user=instance)
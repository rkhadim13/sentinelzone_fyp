import uuid
from django.db import models


class Conversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case = models.ForeignKey(
        "reports.Case", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="conversations",
    )
    contact_label = models.CharField(max_length=255, default="Unknown Number")
    platform = models.CharField(max_length=50, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class Message(models.Model):
    SENDER_CHOICES = [("me", "me"), ("them", "them")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.CharField(max_length=10, choices=SENDER_CHOICES)
    text = models.TextField()
    sent_at = models.CharField(max_length=50, blank=True, default="")  # display string, e.g. "10:02 AM"
    flagged = models.BooleanField(default=False)
    reason = models.CharField(max_length=255, blank=True, default="")
    risk = models.CharField(max_length=10, blank=True, default="")
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

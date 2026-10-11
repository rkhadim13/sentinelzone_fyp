import uuid
from django.db import models


class Case(models.Model):
    """
    Field names match the `cases` array hardcoded in Member-3's
    src/components/ReportGenerator.js: id, title, date, flaggedCount,
    plus platform/status referenced in the generated PDF body.
    """

    STATUS_CHOICES = [
        ("Open — Pending Review", "Open — Pending Review"),
        ("Under Investigation", "Under Investigation"),
        ("Submitted to FIA", "Submitted to FIA"),
        ("Closed", "Closed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    date = models.DateField()
    platform = models.CharField(max_length=100, default="WhatsApp / Instagram / Facebook")
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default="Open — Pending Review")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    @property
    def flagged_count(self):
        conv_count = sum(c.messages.filter(flagged=True).count() for c in self.conversations.all())
        return conv_count

    def __str__(self):
        return self.title

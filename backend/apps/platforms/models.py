from django.db import models


class PlatformConnection(models.Model):
    """
    Matches the `platforms` state object in AppContext.js:
    { WhatsApp: bool, Instagram: bool, Facebook: bool }
    """
    name = models.CharField(max_length=50, unique=True)
    connected = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name}: {'connected' if self.connected else 'not connected'}"

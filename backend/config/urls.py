from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/evidence/", include("apps.evidence.urls")),
    path("api/timeline/", include("apps.timeline.urls")),
    path("api/reports/", include("apps.reports.urls")),
    path("api/platforms/", include("apps.platforms.urls")),
    path("api/alerts/", include("apps.alerts.urls")),
    path("api/ml/", include("apps.ml.urls")),
    path("api/social/", include("apps.social.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

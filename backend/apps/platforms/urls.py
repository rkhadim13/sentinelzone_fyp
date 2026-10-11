from django.urls import path
from .views import PlatformListView, PlatformToggleView

urlpatterns = [
    path("", PlatformListView.as_view()),
    path("<str:name>/toggle/", PlatformToggleView.as_view()),
]

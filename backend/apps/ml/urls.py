from django.urls import path
from . import views

app_name = "ml"

urlpatterns = [
    path("predict/text/", views.TextPredictionView.as_view(), name="predict-text"),
    path("predict/image/", views.ImagePredictionView.as_view(), name="predict-image"),
    path("predict/audio/", views.AudioPredictionView.as_view(), name="predict-audio"),
]
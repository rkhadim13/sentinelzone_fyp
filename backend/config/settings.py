"""
Django settings for SentinelZone Member-2 backend.

Field/endpoint names in this project are deliberately matched to the
naming already used by Member-3's React frontend (title, type, content,
reason, hash, verified, timestamp, dataUrl, platforms, liveAlerts,
emailAlerts, sender/type/risk/time for alerts) so that the frontend can
swap its mocked AppContext.js logic for real fetch() calls with minimal
changes. See docs/api_contracts.md for the full contract.
"""
from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-secret-key-change-me")
DEBUG = os.getenv("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "*").split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "apps.evidence",
    "apps.timeline",
    "apps.reports",
    "apps.platforms",
    "apps.accounts",
    "apps.alerts",    
    "apps.ml", 
    "apps.social",        


]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Karachi"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

MEDIA_URL = "/media/"
MEDIA_ROOT = os.getenv("MEDIA_ROOT", str(BASE_DIR / "media"))

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    # Rate limiting (throttling) — protects public endpoints from abuse.
    # Scopes are referenced by custom throttle classes and applied per-view.
    "DEFAULT_THROTTLE_CLASSES": [],
    "DEFAULT_THROTTLE_RATES": {
        # Meta sends webhook POSTs from their servers. 100/min per IP is
        # generous for real traffic but blocks bot spam.
        "webhook": "100/min",
        # Destructive or expensive actions are throttled per user.
        "alerts_clear": "10/hour",
        "evidence_upload": "30/hour",
    },
}
INSTALLED_APPS += ["rest_framework.authtoken"]

# CORS - the React dev server runs on :3000 by default (create-react-app)
CORS_ALLOWED_ORIGINS = os.getenv(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
).split(",")
CORS_ALLOW_ALL_ORIGINS = os.getenv("CORS_ALLOW_ALL_ORIGINS", "1") == "1"

# --- SentinelZone shared service config ---
ML_SERVICE_URL = os.getenv("ML_SERVICE_URL", "http://localhost:8001")
ALERT_SERVER_URL = os.getenv("ALERT_SERVER_URL", "http://localhost:4001")  # HTTP publish side-channel
ALERT_WS_URL = os.getenv("ALERT_WS_URL", "ws://localhost:4000")  # matches frontend services/socket.js

# Upload hard limits (security MVP)
DATA_UPLOAD_MAX_MEMORY_SIZE = 15 * 1024 * 1024  # 15 MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 15 * 1024 * 1024  # 15 MB
MAX_UPLOAD_SIZE_BYTES = int(os.getenv("MAX_UPLOAD_SIZE_BYTES", 15 * 1024 * 1024))
ALLOWED_UPLOAD_CONTENT_TYPES = [
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4",
    "video/mp4", "video/webm", "video/quicktime",
    "text/plain",
]

# Data-URL inline size threshold: files smaller than this are also returned
# as base64 data URLs in API responses so the frontend can keep using
# item.dataUrl exactly the way AppContext.js already expects.
INLINE_DATA_URL_MAX_BYTES = int(os.getenv("INLINE_DATA_URL_MAX_BYTES", 2 * 1024 * 1024))

# --- Social Media / Meta Configuration ---
META_APP_ID = os.getenv("META_APP_ID", "")
META_APP_SECRET = os.getenv("META_APP_SECRET", "")
META_VERIFY_TOKEN = os.getenv("META_VERIFY_TOKEN", "cybershield_secret_2026")

WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
WHATSAPP_ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")

INSTAGRAM_PAGE_ACCESS_TOKEN = os.getenv("INSTAGRAM_PAGE_ACCESS_TOKEN", "")
INSTAGRAM_ACCOUNT_ID = os.getenv("INSTAGRAM_ACCOUNT_ID", "")

FACEBOOK_PAGE_ACCESS_TOKEN = os.getenv("FACEBOOK_PAGE_ACCESS_TOKEN", "")
FACEBOOK_PAGE_ID = os.getenv("FACEBOOK_PAGE_ID", "")

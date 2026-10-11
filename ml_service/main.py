"""
CyberShield AI — FastAPI ML Microservice

Entry point. Loads ML models once at startup and exposes a health endpoint.
Inference endpoints are added in the next step.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from model_loader import load_all_models

# --- Logging ---
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run code before the server accepts requests, and after it shuts down."""
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    logger.info(f"Device: {settings.device}")
    load_all_models(settings)
    logger.info("Microservice is ready to receive requests.")
    yield
    logger.info("Shutting down ML microservice.")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Deepfake detection microservice for CyberShield AI",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Include inference routes ---
from routers.inference import router as inference_router
app.include_router(inference_router)


@app.get("/health")
async def health():
    """Health check for orchestration tools and Django."""
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
    }


@app.get("/")
async def root():
    """Root endpoint with service metadata."""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/health",
    }
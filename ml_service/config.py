"""
CyberShield AI — ML Microservice Configuration

Centralized settings for the microservice. All values can be overridden
via environment variables or a .env file.
"""

from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # --- Server ---
    app_name: str = "CyberShield AI - ML Microservice"
    app_version: str = "1.0.0"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8001

    # --- Paths ---
    base_dir: Path = Path(__file__).parent
    models_dir: Path = base_dir / "ml_models"
    audio_model_path: Path = models_dir / "audio_deepfake.pth"

    # --- CORS ---
    allowed_origins: list[str] = [
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # --- Inference ---
    device: str = "cpu"
    max_upload_mb: int = 50

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


settings = Settings()
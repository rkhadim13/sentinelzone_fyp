"""
CyberShield AI — Model Loader
Stores Hugging Face cache inside the project folder for portability.
"""

import os
from pathlib import Path

# ⚠️ IMPORTANT: Set HF_HOME BEFORE importing transformers
PROJECT_ROOT = Path(__file__).parent
HF_CACHE_DIR = PROJECT_ROOT / "hf_cache"
HF_CACHE_DIR.mkdir(parents=True, exist_ok=True)
os.environ["HF_HOME"] = str(HF_CACHE_DIR)

# Now import everything else
import logging
import torch
import torch.nn as nn
from torchvision import models
from transformers import AutoImageProcessor, AutoModelForImageClassification

logger = logging.getLogger(__name__)

# --- Global model registry ---
image_model = None
image_processor = None
image_classes: list[str] = []
audio_model = None
audio_classes: list[str] = []

# Image model: pre-trained AI vs Real detector
IMAGE_MODEL_NAME = "dima806/ai_vs_real_image_detection"


def load_image_model() -> None:
    """Load the pre-trained AI vs Real image detector (ViT)."""
    global image_model, image_processor, image_classes

    logger.info(f"Loading image model: {IMAGE_MODEL_NAME}")
    logger.info(f"Cache directory: {HF_CACHE_DIR}")

    image_processor = AutoImageProcessor.from_pretrained(IMAGE_MODEL_NAME)
    image_model = AutoModelForImageClassification.from_pretrained(IMAGE_MODEL_NAME)
    image_model.eval()

    image_classes = [
        image_model.config.id2label[i]
        for i in range(len(image_model.config.id2label))
    ]
    logger.info(f"Image model ready | classes={image_classes}")


def load_audio_model(path: Path) -> None:
    """Load the audio deepfake model (ResNet-18)."""
    global audio_model, audio_classes

    if not path.exists():
        raise FileNotFoundError(f"Model file not found: {path}")
    logger.info(f"Loading checkpoint: {path.name}")

    checkpoint = torch.load(str(path), map_location="cpu")
    num_classes = checkpoint.get("num_classes", 2)
    classes = checkpoint.get("classes", ["fake", "real"])

    model = models.resnet18(weights=None)
    model.conv1 = nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3, bias=False)
    model.fc = nn.Linear(model.fc.in_features, num_classes)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    audio_model = model
    audio_classes = classes
    logger.info(f"Audio model ready | classes={classes}")


def load_all_models(settings) -> None:
    """Load all models. Called once from the FastAPI lifespan."""
    load_image_model()
    load_audio_model(settings.audio_model_path)
    logger.info("All models loaded into memory.")
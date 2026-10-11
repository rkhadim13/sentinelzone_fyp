"""
ML Model Loader for CyberShield AI
Stores Hugging Face cache inside the project folder for portability.
"""

import os
from pathlib import Path

# ⚠️ IMPORTANT: Set HF_HOME BEFORE importing transformers
BASE_DIR = Path(__file__).parent.parent.parent  # backend root
HF_CACHE_DIR = BASE_DIR / "hf_cache"
HF_CACHE_DIR.mkdir(parents=True, exist_ok=True)
os.environ["HF_HOME"] = str(HF_CACHE_DIR)

# Now import everything else
import torch
import torch.nn as nn
from torchvision import models
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    pipeline,
    AutoImageProcessor,
    AutoModelForImageClassification,
)
import torchaudio
from torchaudio import transforms as T

# Set device
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Base directory for models
MODELS_DIR = BASE_DIR / "ml_models"

# ============================================================
# 1. TEXT MODEL
# ============================================================
print("Loading text intent model...")
TEXT_MODEL_PATH = MODELS_DIR / "intent_classifier"
text_tokenizer = AutoTokenizer.from_pretrained(str(TEXT_MODEL_PATH))
text_model = AutoModelForSequenceClassification.from_pretrained(str(TEXT_MODEL_PATH))
text_classifier = pipeline(
    "text-classification",
    model=text_model,
    tokenizer=text_tokenizer,
    device=0 if torch.cuda.is_available() else -1,
)
TEXT_LABEL_MAP = {'LABEL_0': 'Safe', 'LABEL_1': 'Harassment', 'LABEL_2': 'Fraud'}
print("Text model loaded.")

# ============================================================
# 2. IMAGE MODEL (Pre-trained ViT from Hugging Face)
# ============================================================
print("Loading image deepfake model...")
print(f"Cache directory: {HF_CACHE_DIR}")
IMAGE_MODEL_NAME = "dima806/ai_vs_real_image_detection"
image_processor = AutoImageProcessor.from_pretrained(IMAGE_MODEL_NAME)
image_model = AutoModelForImageClassification.from_pretrained(IMAGE_MODEL_NAME)
image_model = image_model.to(DEVICE)
image_model.eval()

IMAGE_CLASSES = [
    image_model.config.id2label[i]
    for i in range(len(image_model.config.id2label))
]
print(f"Image model loaded. Classes: {IMAGE_CLASSES}")

# ============================================================
# 3. AUDIO MODEL
# ============================================================
print("Loading audio deepfake model...")
AUDIO_MODEL_PATH = MODELS_DIR / "audio_deepfake.pth"
SAMPLE_RATE = 16000
N_MELS = 128
MAX_LENGTH = 16000 * 4

audio_state = torch.load(AUDIO_MODEL_PATH, map_location=DEVICE)
if isinstance(audio_state, dict):
    audio_state = audio_state['model_state_dict']

audio_model = models.resnet18(weights=None)
audio_model.conv1 = nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3, bias=False)
audio_model.fc = nn.Linear(audio_model.fc.in_features, 2)
audio_model.load_state_dict(audio_state)
audio_model = audio_model.to(DEVICE)
audio_model.eval()

mel_spectrogram = T.MelSpectrogram(
    sample_rate=SAMPLE_RATE,
    n_fft=1024,
    hop_length=512,
    n_mels=N_MELS,
    power=2.0
)
print("Audio model loaded.")

# ============================================================
# 4. BEHAVIORAL PROFILER
# ============================================================
print("Initializing Behavioral Profiler...")
from .behavioral_profiler import BehavioralProfiler

PROFILER_STORAGE_PATH = MODELS_DIR / "profiler_data" / "profiler_data.json"
PROFILER_STORAGE_PATH.parent.mkdir(parents=True, exist_ok=True)

profiler = BehavioralProfiler(storage_path=PROFILER_STORAGE_PATH)
print("Behavioral Profiler initialized.")


def get_profiler_status(contact_id, platform="whatsapp"):
    """Retrieve the behavioral profile for a given contact."""
    try:
        profile = profiler.get_profile(contact_id, platform)
        return {
            "total_messages": profile.total_messages,
            "average_severity": profile.average_severity,
            "severity_trend": profile.severity_trend,
            "escalation_status": profile.escalation_status,
            "recent_alerts": profile.recent_alerts[-3:],
        }
    except ValueError:
        return None
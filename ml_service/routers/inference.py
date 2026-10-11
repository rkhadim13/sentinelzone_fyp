"""
CyberShield AI — Inference Router
"""

import io
import logging
import os
import tempfile
from pathlib import Path

import torch
import torch.nn.functional as F
from fastapi import APIRouter, File, HTTPException, UploadFile
from PIL import Image

from config import settings
import model_loader
from utils.preprocessing import preprocess_audio

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/infer", tags=["Inference"])

# --- Constraints ---
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_AUDIO_TYPES = {
    "audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3",
    "audio/mp4", "audio/webm", "audio/ogg",
}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
MAX_UPLOAD_BYTES = settings.max_upload_mb * 1024 * 1024

# Confidence threshold for the image model:
# Only flag as "AI-Generated" if the model is at least 80% confident.
FAKE_CONFIDENCE_THRESHOLD = 0.80


def _validate_upload(file: UploadFile, allowed_types: set[str]) -> None:
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported content type '{file.content_type}'. Allowed: {sorted(allowed_types)}",
        )


async def _read_file_with_limit(file: UploadFile) -> bytes:
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum size of {settings.max_upload_mb} MB.",
        )
    return data


def _format_response(
    confidence_pct: float,
    classes: list[str],
    predicted_idx: int,
    category: str,
    model_name: str,
) -> dict:
    label = classes[predicted_idx].lower()
    is_fake = "ai" in label or "fake" in label

    if is_fake:
        verdict = f"Fake (AI-Generated) — {confidence_pct:.1f}% confidence"
    else:
        verdict = f"Real — {confidence_pct:.1f}% confidence"

    return {
        "confidence": round(confidence_pct, 2),
        "verdict": verdict,
        "category": category,
        "signals": {
            "label": label,
            "is_fake": is_fake,
            "all_scores": {c: None for c in classes},
        },
        "model": {
            "name": model_name,
            "version": "1.0.0",
            "device": settings.device,
        },
    }


def _ensure_model_loaded(model_obj, category: str) -> None:
    if model_obj is None:
        raise HTTPException(
            status_code=503,
            detail=f"{category} model is not loaded. Check the microservice startup logs.",
        )


# ------------------------------------------------------------
# POST /infer/image
# ------------------------------------------------------------
@router.post("/image")
async def infer_image(file: UploadFile = File(...)):
    """Detect whether an image is real or AI-generated."""
    _validate_upload(file, ALLOWED_IMAGE_TYPES)
    data = await _read_file_with_limit(file)
    _ensure_model_loaded(model_loader.image_model, "Image")

    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
        inputs = model_loader.image_processor(images=img, return_tensors="pt")
        tensor = inputs.pixel_values
    except Exception as e:
        logger.exception("Image preprocessing failed")
        raise HTTPException(status_code=400, detail=f"Image preprocessing failed: {e}")

    with torch.no_grad():
        outputs = model_loader.image_model(tensor)
        probs = F.softmax(outputs.logits, dim=1)[0]

    classes = model_loader.image_classes
    # Find the index of the AI/fake class
    ai_idx = next(
        (i for i, c in enumerate(classes) if "ai" in c.lower() or "fake" in c.lower()),
        1,
    )
    real_idx = 1 - ai_idx

    prob_ai = probs[ai_idx].item()
    prob_real = probs[real_idx].item()

    # 80% threshold: only flag as AI if the model is very confident
    if prob_ai > FAKE_CONFIDENCE_THRESHOLD:
        predicted_idx = ai_idx
        confidence_pct = prob_ai * 100
    else:
        predicted_idx = real_idx
        confidence_pct = prob_real * 100

    result = _format_response(
        confidence_pct=confidence_pct,
        classes=classes,
        predicted_idx=predicted_idx,
        category="Image",
        model_name="ViT (AI vs Real Detector)",
    )
    result["signals"]["all_scores"] = {
        classes[i]: round(float(probs[i].item()) * 100, 2)
        for i in range(len(classes))
    }
    return result


# ------------------------------------------------------------
# POST /infer/audio
# ------------------------------------------------------------
@router.post("/audio")
async def infer_audio(file: UploadFile = File(...)):
    """Detect whether an audio clip is real or AI-generated."""
    _validate_upload(file, ALLOWED_AUDIO_TYPES)
    data = await _read_file_with_limit(file)
    _ensure_model_loaded(model_loader.audio_model, "Audio")

    tmp_path = None
    try:
        suffix = Path(file.filename or "audio.wav").suffix or ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(data)
            tmp_path = tmp.name

        tensor = preprocess_audio(tmp_path)
    except Exception as e:
        logger.exception("Audio preprocessing failed")
        raise HTTPException(status_code=400, detail=f"Audio preprocessing failed: {e}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

    with torch.no_grad():
        logits = model_loader.audio_model(tensor)
        probs = F.softmax(logits, dim=1)[0]

    predicted_idx = int(torch.argmax(probs).item())
    confidence_pct = float(probs[predicted_idx].item()) * 100
    classes = model_loader.audio_classes

    result = _format_response(
        confidence_pct=confidence_pct,
        classes=classes,
        predicted_idx=predicted_idx,
        category="Audio",
        model_name="ResNet-18 (Audio Deepfake)",
    )
    result["signals"]["all_scores"] = {
        classes[i]: round(float(probs[i].item()) * 100, 2)
        for i in range(len(classes))
    }
    return result


# ------------------------------------------------------------
# POST /infer/video
# ------------------------------------------------------------
@router.post("/video")
async def infer_video(file: UploadFile = File(...)):
    """Detect whether a video is real or AI-generated (frame-by-frame)."""
    _validate_upload(file, ALLOWED_VIDEO_TYPES)
    data = await _read_file_with_limit(file)
    _ensure_model_loaded(model_loader.image_model, "Image (used for video frames)")

    tmp_path = None
    try:
        suffix = Path(file.filename or "video.mp4").suffix or ".mp4"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(data)
            tmp_path = tmp.name

        import cv2
        import numpy as np

        cap = cv2.VideoCapture(tmp_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames == 0:
            cap.release()
            raise ValueError("Video could not be read.")

        num_samples = min(16, total_frames)
        indices = np.linspace(0, total_frames - 1, num_samples, dtype=int)

        fake_votes = 0
        real_votes = 0
        confidences = []

        classes = model_loader.image_classes
        ai_idx = next(
            (i for i, c in enumerate(classes) if "ai" in c.lower() or "fake" in c.lower()),
            1,
        )

        for i in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(i))
            ret, frame = cap.read()
            if not ret:
                continue

            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            img = Image.fromarray(frame_rgb)
            inputs = model_loader.image_processor(images=img, return_tensors="pt")
            tensor = inputs.pixel_values

            with torch.no_grad():
                outputs = model_loader.image_model(tensor)
                probs = F.softmax(outputs.logits, dim=1)[0]

            prob_ai = probs[ai_idx].item()
            if prob_ai > FAKE_CONFIDENCE_THRESHOLD:
                fake_votes += 1
                confidences.append(prob_ai * 100)
            else:
                real_votes += 1
                confidences.append((1 - prob_ai) * 100)

        cap.release()

        if fake_votes + real_votes == 0:
            raise ValueError("No frames could be analyzed.")

        fake_ratio = fake_votes / (fake_votes + real_votes)
        avg_conf = sum(confidences) / len(confidences)
        predicted_idx = ai_idx if fake_ratio >= 0.5 else (1 - ai_idx)

        result = _format_response(
            confidence_pct=avg_conf,
            classes=classes,
            predicted_idx=predicted_idx,
            category="Video",
            model_name="ViT (Frame-level Video Deepfake)",
        )
        result["signals"]["frames_analyzed"] = fake_votes + real_votes
        result["signals"]["fake_votes"] = fake_votes
        result["signals"]["real_votes"] = real_votes
        result["signals"]["fake_ratio"] = round(fake_ratio, 3)
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Video inference failed")
        raise HTTPException(status_code=400, detail=f"Video inference failed: {e}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
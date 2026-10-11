"""
CyberShield AI — Preprocessing Utilities

Converts raw uploaded files (images, audio) into model-ready tensors.
Must match the exact preprocessing used during training.
"""

from io import BytesIO
import librosa
import numpy as np
import torch
import torchaudio
from PIL import Image
from torchvision import transforms

# --- Image preprocessing (matches training) ---
IMAGE_TRANSFORM = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])

# --- Audio preprocessing (matches training) ---
AUDIO_SR = 16000
AUDIO_N_MELS = 128
AUDIO_N_FFT = 1024
AUDIO_HOP_LENGTH = 512
AUDIO_MAX_LENGTH = 16000 * 4  # 4 seconds

MEL_SPECTROGRAM = torchaudio.transforms.MelSpectrogram(
    sample_rate=AUDIO_SR,
    n_fft=AUDIO_N_FFT,
    hop_length=AUDIO_HOP_LENGTH,
    n_mels=AUDIO_N_MELS,
    power=2.0,
)


def preprocess_image(image_bytes: bytes) -> torch.Tensor:
    """Convert raw image bytes into a normalized (1, 3, 224, 224) tensor."""
    img = Image.open(BytesIO(image_bytes)).convert("RGB")
    return IMAGE_TRANSFORM(img).unsqueeze(0)


def preprocess_audio(file_path: str) -> torch.Tensor:
    """
    Convert an audio file path into a 3-channel mel-spectrogram tensor
    shaped (1, 3, 128, 128).
    """
    waveform, _ = librosa.load(file_path, sr=AUDIO_SR, mono=True)
    waveform = torch.from_numpy(waveform).float().unsqueeze(0)

    if waveform.size(1) < AUDIO_MAX_LENGTH:
        pad = AUDIO_MAX_LENGTH - waveform.size(1)
        waveform = torch.nn.functional.pad(waveform, (0, pad))
    else:
        waveform = waveform[:, :AUDIO_MAX_LENGTH]

    mel = MEL_SPECTROGRAM(waveform)
    mel = torch.nn.functional.interpolate(
        mel.unsqueeze(0), size=(AUDIO_N_MELS, 128), mode="bilinear"
    ).squeeze(0)
    mel = mel.repeat(3, 1, 1).unsqueeze(0)
    return mel
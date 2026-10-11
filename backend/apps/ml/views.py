import os
import tempfile
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import librosa
import torch
from PIL import Image
from . import model_loader


# Define allowed file types
ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
ALLOWED_AUDIO_TYPES = ['audio/wav', 'audio/mpeg', 'audio/mp3']

# Confidence threshold for image classification:
# Only flag as "AI-Generated" if the model is at least 80% confident.
FAKE_CONFIDENCE_THRESHOLD = 0.80


class TextPredictionView(APIView):
    def post(self, request):
        text = request.data.get('text', '').strip()
        contact_id = request.data.get('contact_id', 'anonymous')
        platform = request.data.get('platform', 'whatsapp')

        if not text:
            return Response({'error': 'Text field is required'}, status=status.HTTP_400_BAD_REQUEST)

        result = model_loader.text_classifier(text)[0]
        intent = model_loader.TEXT_LABEL_MAP.get(result['label'], result['label'])
        confidence = result['score']

        profile = model_loader.profiler.process_message(
            contact_id=contact_id,
            platform=platform,
            text=text,
            intent=intent,
            severity_score=confidence
        )

        response_data = {
            'intent': intent,
            'confidence': confidence,
            'text': text,
            'profile': {
                'total_messages': profile.total_messages,
                'average_severity': profile.average_severity,
                'severity_trend': profile.severity_trend,
                'escalation_status': profile.escalation_status,
                'recent_alerts': profile.recent_alerts[-3:]
            }
        }

        if profile.escalation_status:
            response_data['alert'] = {
                'triggered': True,
                'message': '⚠️ Escalation detected! This user is becoming increasingly threatening.'
            }
        else:
            response_data['alert'] = {'triggered': False}

        return Response(response_data, status=status.HTTP_200_OK)


class ImagePredictionView(APIView):
    def post(self, request):
        if 'image' not in request.FILES:
            return Response({'error': 'No image file provided'}, status=status.HTTP_400_BAD_REQUEST)

        image_file = request.FILES['image']
        if image_file.content_type not in ALLOWED_IMAGE_TYPES:
            return Response(
                {'error': 'Unsupported image format. Use JPEG, PNG, or WebP.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            img = Image.open(image_file).convert('RGB')
            inputs = model_loader.image_processor(images=img, return_tensors="pt")
            img_tensor = inputs.pixel_values.to(model_loader.DEVICE)

            with torch.no_grad():
                outputs = model_loader.image_model(img_tensor)
                probs = torch.softmax(outputs.logits, dim=1)[0]

            classes = model_loader.IMAGE_CLASSES
            ai_idx = next(
                (i for i, c in enumerate(classes) if "ai" in c.lower() or "fake" in c.lower()),
                1,
            )
            real_idx = 1 - ai_idx

            prob_ai = probs[ai_idx].item()
            prob_real = probs[real_idx].item()

            # 80% threshold: only flag as AI if the model is very confident
            if prob_ai > FAKE_CONFIDENCE_THRESHOLD:
                label = classes[ai_idx]
                confidence = prob_ai
            else:
                label = classes[real_idx]
                confidence = prob_real

            return Response({
                'prediction': label,
                'confidence': confidence,
                'all_scores': {
                    classes[i]: round(float(probs[i].item()), 4)
                    for i in range(len(classes))
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'error': f'Failed to process image: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )


class AudioPredictionView(APIView):
    def post(self, request):
        if 'audio' not in request.FILES:
            return Response({'error': 'No audio file provided'}, status=status.HTTP_400_BAD_REQUEST)

        audio_file = request.FILES['audio']
        if audio_file.content_type not in ALLOWED_AUDIO_TYPES:
            return Response(
                {'error': 'Unsupported audio format. Use WAV, MP3, or MPEG.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                for chunk in audio_file.chunks():
                    tmp.write(chunk)
                tmp_path = tmp.name

            waveform, sr = librosa.load(tmp_path, sr=model_loader.SAMPLE_RATE, mono=True)
            waveform = torch.from_numpy(waveform).float().unsqueeze(0)
            os.unlink(tmp_path)

            if waveform.size(1) < model_loader.MAX_LENGTH:
                pad = model_loader.MAX_LENGTH - waveform.size(1)
                waveform = torch.nn.functional.pad(waveform, (0, pad))
            else:
                waveform = waveform[:, :model_loader.MAX_LENGTH]

            mel = model_loader.mel_spectrogram(waveform)
            mel = torch.nn.functional.interpolate(
                mel.unsqueeze(0),
                size=(model_loader.N_MELS, 128),
                mode='bilinear'
            ).squeeze(0)
            mel = mel.repeat(3, 1, 1).unsqueeze(0).to(model_loader.DEVICE)

            with torch.no_grad():
                output = model_loader.audio_model(mel)
                probs = torch.softmax(output, dim=1)
                confidence, pred = torch.max(probs, 1)

            label = "Real" if pred.item() == 1 else "Fake (AI-Generated)"
            return Response({
                'prediction': label,
                'confidence': confidence.item()
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'error': f'Failed to process audio: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
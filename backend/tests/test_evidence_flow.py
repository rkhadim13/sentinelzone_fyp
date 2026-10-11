"""
Run with: DJANGO_SETTINGS_MODULE=config.settings pytest backend/tests -q
(requires backend/ on PYTHONPATH; see backend/pytest.ini)
"""
import io
import pytest
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_text_evidence_upload_and_verify():
    client = APIClient()

    resp = client.post("/api/evidence/upload/", {"text": "hello world", "title": "Test", "type": "Text"})
    assert resp.status_code == 201
    evidence_id = resp.data["id"]
    assert resp.data["hash"]
    assert resp.data["verified"] is None

    resp = client.get(f"/api/evidence/{evidence_id}/verify/")
    assert resp.status_code == 200
    assert resp.data["ok"] is True


@pytest.mark.django_db
def test_file_evidence_upload():
    client = APIClient()
    fake_file = io.BytesIO(b"fake image bytes")
    fake_file.name = "test.jpg"

    resp = client.post(
        "/api/evidence/upload/",
        {"file": fake_file, "title": "Photo evidence"},
        format="multipart",
    )
    assert resp.status_code == 201
    assert resp.data["type"] == "Image"
    assert resp.data["hash"]


@pytest.mark.django_db
def test_evidence_list():
    client = APIClient()
    client.post("/api/evidence/upload/", {"text": "sample", "title": "T1"})
    resp = client.get("/api/evidence/")
    assert resp.status_code == 200
    assert len(resp.data) >= 1

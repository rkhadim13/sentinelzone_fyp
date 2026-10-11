import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_conversation_analyze_flags_and_saves_evidence():
    client = APIClient()
    payload = {
        "contact_label": "Unknown Number",
        "messages": [
            {"sender": "them", "text": "Hey, how are you?", "time": "10:00 AM"},
            {"sender": "them", "text": "Send me money urgently, it's an emergency.", "time": "10:01 AM"},
            {"sender": "them", "text": "Do not tell anyone about this conversation.", "time": "10:02 AM"},
        ],
    }
    resp = client.post("/api/timeline/analyze/", payload, format="json")
    assert resp.status_code == 201
    assert resp.data["flaggedCount"] == 2
    assert resp.data["escalationLevel"] in ("High", "Medium")

    evidence_resp = client.get("/api/evidence/")
    titles = [e["title"] for e in evidence_resp.data]
    assert any("Timeline -" in t for t in titles)

import json
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.database import engine
from app.main import app
from app.services.speech import RATE, Window


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_mysql_health(client):
    assert client.get("/api/health").json() == {"status": "ok", "database": "connected"}
    with engine.connect() as db:
        assert db.scalar(text("SELECT VERSION()")).startswith("8.")


def test_record_lifecycle(client):
    base = "/api/transcriptions"
    stats = "/api/dashboard/stats"
    first = client.get(stats).json()
    title = "QA " + uuid4().hex
    response = client.post(base, json={"title": title, "content": "आज project review है", "language": "mixed", "duration": 7.5})
    assert response.status_code == 201
    record = response.json()
    path = f"{base}/{record['id']}"
    try:
        assert client.get(path).json() == record
        results = client.get(base, params={"q": title, "page": 1, "limit": 1}).json()
        assert results == {"items": [record], "total": 1}
        assert not client.get(base, params={"q": title, "page": 2, "limit": 1}).json()["items"]
        current = client.get(stats).json()
        assert current["total"] == first["total"] + 1
        assert current["today"] == first["today"] + 1
        assert current["duration"] == pytest.approx(first["duration"] + 7.5)
        assert current["recent"][0]["id"] == record["id"]
        changed = client.put(path, json={"title": title + " revised", "content": "नया पाठ"}).json()
        assert changed["content"] == "नया पाठ" and changed["language"] == "mixed"
        assert client.get(path).json()["title"] == title + " revised"
    finally:
        assert client.delete(path).status_code == 204
    assert client.get(path).status_code == 404
    assert client.delete(path).status_code == 404


def test_validation(client):
    assert client.post("/api/transcriptions", json={"title": "  ", "content": "", "duration": -1, "language": "no"}).status_code == 422
    assert client.get("/api/transcriptions?page=0").status_code == 422


@pytest.mark.parametrize("message", ["bogus", json.dumps({"type": "start", "mime": "text/plain"}), "[]"])
def test_invalid_handshake(client, message):
    with client.websocket_connect("/ws/transcribe") as ws:
        ws.send_text(message)
        assert ws.receive_json()["type"] == "error"


@pytest.mark.parametrize("data", [b"", b"not audio", None])
def test_invalid_audio(client, data):
    with client.websocket_connect("/ws/transcribe") as ws:
        ws.send_json({"type": "start", "mime": "audio/webm", "language": "mixed"})
        assert ws.receive_json()["state"] == "ready"
        if data is not None:
            ws.send_bytes(data)
        if data != b"":
            ws.send_json({"type": "stop"})
        assert ws.receive_json()["type"] == "error"


def test_overlap_preserves_repeated_spoken_words():
    w = Window()
    w.audio.extend(bytes(4 * RATE * 2))
    assert w.apply([(0, 1, " go"), (2.8, 3.5, " go")]) == ("go", "go")
    w.audio.extend(bytes(RATE * 2))
    assert w.apply([(0, 1, " go"), (2.8, 3.5, " go")], final=True) == ("go", "")

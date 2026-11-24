from __future__ import annotations

import sys
from pathlib import Path

from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from main import app  # noqa: E402
from store import store  # noqa: E402

client = TestClient(app)


def setup_function() -> None:
    store.seed()


def test_health_and_request_id_envelope() -> None:
    resp = client.get("/health", headers={"X-Request-ID": "req_test_health"})
    assert resp.status_code == 200
    assert resp.headers["X-Request-ID"] == "req_test_health"
    body = resp.json()
    assert body["request_id"] == "req_test_health"
    assert "timestamp" in body
    assert body["data"]["status"] == "ok"


def test_list_threads_and_send_message_extracts_memory_and_traces() -> None:
    list_resp = client.get("/api/v1/threads")
    assert list_resp.status_code == 200
    threads = list_resp.json()["data"]["threads"]
    assert len(threads) >= 4

    msg_resp = client.post(
        "/api/v1/threads/thr_whatsapp_01/messages",
        json={
            "content": "Can we book Thursday at 2:30 PM? I prefer Spanish reminders.",
            "sender": "customer",
        },
    )
    assert msg_resp.status_code == 200
    data = msg_resp.json()["data"]
    assert data["ai_message"] is not None
    assert len(data["traces"]) >= 1
    assert any(t["tool_name"] == "check_calendar_slots" for t in data["traces"])
    fact_keys = {f["key"] for f in data["extracted_facts"]}
    assert "Preferred Time" in fact_keys
    assert "Language" in fact_keys


def test_handoff_toggle_pauses_ai_auto_reply() -> None:
    toggle_resp = client.post(
        "/api/v1/threads/thr_web_02/handoff",
        json={"mode": "human_handoff"},
    )
    assert toggle_resp.status_code == 200
    assert toggle_resp.json()["data"]["status"] == "human_handoff"

    msg_resp = client.post(
        "/api/v1/threads/thr_web_02/messages",
        json={"content": "Hello, is anyone there?", "sender": "customer"},
    )
    assert msg_resp.status_code == 200
    assert msg_resp.json()["data"]["ai_message"] is None

    resume_resp = client.post(
        "/api/v1/threads/thr_web_02/handoff",
        json={"mode": "ai_active"},
    )
    assert resume_resp.status_code == 200
    assert resume_resp.json()["data"]["status"] == "ai_active"


def test_memory_crud_and_delete() -> None:
    add_resp = client.post(
        "/api/v1/threads/thr_whatsapp_01/memory",
        json={"key": "Account Tier", "value": "VIP Priority", "category": "identity"},
    )
    assert add_resp.status_code == 200
    fact_id = add_resp.json()["data"]["fact"]["id"]

    get_resp = client.get("/api/v1/threads/thr_whatsapp_01/memory")
    assert get_resp.status_code == 200
    assert any(f["id"] == fact_id for f in get_resp.json()["data"]["memory_facts"])

    del_resp = client.delete(f"/api/v1/threads/thr_whatsapp_01/memory/{fact_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["data"]["deleted_fact_id"] == fact_id


def test_traces_and_whatsapp_webhook_ingestor() -> None:
    wh_resp = client.post(
        "/api/v1/webhooks/whatsapp",
        json={
            "thread_id": "thr_whatsapp_01",
            "from_number": "+14155550192",
            "sender_name": "Sarah Jenkins",
            "message_text": "Where is my order #ORD-99201?",
        },
    )
    assert wh_resp.status_code == 200
    data = wh_resp.json()["data"]
    assert data["verified"] is True
    assert any(t["tool_name"] == "lookup_order" for t in data["traces"])

    traces_resp = client.get("/api/v1/traces")
    assert traces_resp.status_code == 200
    assert len(traces_resp.json()["data"]["traces"]) >= 1

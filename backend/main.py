from __future__ import annotations

import os
import time
import uuid
from typing import Any

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from engine import process_agent_turn
from models import (
    APIEnvelope,
    AddMemoryFactRequest,
    HandoffRequest,
    MemoryFact,
    MessageItem,
    SendMessageRequest,
    ToggleToolRequest,
    WebhookDeliveryLog,
    WhatsAppWebhookPayload,
    utc_now_iso,
)
from store import store

app = FastAPI(
    title="RelayAgent Ops API",
    description="Omnichannel AI Agent, Persistent Memory & Tool-Execution Trace Backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next: Any) -> Response:
    req_id = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:10]}"
    request.state.request_id = req_id
    response: Response = await call_next(request)
    response.headers["X-Request-ID"] = req_id
    return response


def _envelope(request: Request, data: Any) -> dict[str, Any]:
    req_id = getattr(request.state, "request_id", f"req_{uuid.uuid4().hex[:10]}")
    return APIEnvelope(request_id=req_id, data=data).model_dump()


@app.get("/health")
async def health(request: Request) -> dict[str, Any]:
    return _envelope(
        request,
        {
            "status": "ok",
            "service": "relay-agent-backend",
            "threads_count": len(store.threads),
            "traces_count": len(store.traces),
            "llm_mode": "openai" if bool(os.getenv("OPENAI_API_KEY", "").strip()) else "deterministic",
        },
    )


@app.get("/api/v1/threads")
async def list_threads(request: Request) -> dict[str, Any]:
    threads = sorted(store.threads.values(), key=lambda t: t.updated_at, reverse=True)
    return _envelope(request, {"threads": [t.model_dump() for t in threads]})


@app.get("/api/v1/threads/{thread_id}")
async def get_thread(thread_id: str, request: Request) -> dict[str, Any]:
    thread = store.threads.get(thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail=f"Thread '{thread_id}' not found")
    return _envelope(request, {"thread": thread.model_dump()})


@app.post("/api/v1/threads/{thread_id}/messages")
async def send_message(thread_id: str, payload: SendMessageRequest, request: Request) -> dict[str, Any]:
    thread = store.threads.get(thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail=f"Thread '{thread_id}' not found")

    req_id = request.state.request_id
    incoming_msg = MessageItem(
        id=f"msg_{uuid.uuid4().hex[:8]}",
        thread_id=thread.id,
        sender=payload.sender,
        content=payload.content.strip(),
    )
    thread.messages.append(incoming_msg)
    thread.unread_count = 0
    thread.updated_at = utc_now_iso()

    if payload.sender == "human_agent":
        return _envelope(
            request,
            {
                "thread": thread.model_dump(),
                "user_message": incoming_msg.model_dump(),
                "ai_message": None,
                "extracted_facts": [],
                "traces": [],
            },
        )

    ai_msg, extracted_facts, spans = await process_agent_turn(
        store=store,
        thread=thread,
        user_text=payload.content.strip(),
        request_id=req_id,
    )
    return _envelope(
        request,
        {
            "thread": thread.model_dump(),
            "user_message": incoming_msg.model_dump(),
            "ai_message": ai_msg.model_dump() if ai_msg else None,
            "extracted_facts": [f.model_dump() for f in extracted_facts],
            "traces": [s.model_dump() for s in spans],
        },
    )


@app.post("/api/v1/threads/{thread_id}/handoff")
async def toggle_handoff(thread_id: str, payload: HandoffRequest, request: Request) -> dict[str, Any]:
    thread = store.threads.get(thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail=f"Thread '{thread_id}' not found")

    if payload.mode:
        thread.status = payload.mode
    else:
        thread.status = "ai_active" if thread.status == "human_handoff" else "human_handoff"

    note = (
        "Operator paused AI automation and took over the conversation."
        if thread.status == "human_handoff"
        else "AI agent resumed autonomous handling for this thread."
        if thread.status == "ai_active"
        else "Thread marked as resolved."
    )
    sys_msg = MessageItem(
        id=f"msg_{uuid.uuid4().hex[:8]}",
        thread_id=thread.id,
        sender="system",
        content=note,
    )
    thread.messages.append(sys_msg)
    thread.updated_at = utc_now_iso()

    return _envelope(request, {"thread": thread.model_dump(), "status": thread.status})


@app.get("/api/v1/threads/{thread_id}/memory")
async def get_thread_memory(thread_id: str, request: Request) -> dict[str, Any]:
    thread = store.threads.get(thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail=f"Thread '{thread_id}' not found")
    return _envelope(
        request,
        {
            "thread_id": thread.id,
            "customer": thread.customer.model_dump(),
            "memory_facts": [f.model_dump() for f in thread.memory_facts],
        },
    )


@app.post("/api/v1/threads/{thread_id}/memory")
async def upsert_memory_fact(thread_id: str, payload: AddMemoryFactRequest, request: Request) -> dict[str, Any]:
    thread = store.threads.get(thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail=f"Thread '{thread_id}' not found")

    existing = next((f for f in thread.memory_facts if f.key.lower() == payload.key.strip().lower()), None)
    if existing:
        existing.value = payload.value.strip()
        existing.category = payload.category
        existing.source = "manual"
        existing.updated_at = utc_now_iso()
        fact = existing
    else:
        fact = MemoryFact(
            id=f"fact_{uuid.uuid4().hex[:8]}",
            key=payload.key.strip(),
            value=payload.value.strip(),
            category=payload.category,
            confidence=1.0,
            source="manual",
        )
        thread.memory_facts.append(fact)

    key_lower = payload.key.strip().lower()
    if key_lower == "name":
        thread.customer.name = payload.value.strip()
    elif key_lower == "preferred time":
        thread.customer.preferred_time = payload.value.strip()
    elif key_lower == "language":
        thread.customer.language = payload.value.strip()
    elif key_lower == "intent":
        thread.customer.intent = payload.value.strip()

    thread.updated_at = utc_now_iso()
    return _envelope(
        request,
        {
            "fact": fact.model_dump(),
            "memory_facts": [f.model_dump() for f in thread.memory_facts],
        },
    )


@app.delete("/api/v1/threads/{thread_id}/memory/{fact_id}")
async def delete_memory_fact(thread_id: str, fact_id: str, request: Request) -> dict[str, Any]:
    thread = store.threads.get(thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail=f"Thread '{thread_id}' not found")

    before = len(thread.memory_facts)
    thread.memory_facts = [f for f in thread.memory_facts if f.id != fact_id]
    if len(thread.memory_facts) == before:
        raise HTTPException(status_code=404, detail=f"Memory fact '{fact_id}' not found")

    thread.updated_at = utc_now_iso()
    return _envelope(
        request,
        {
            "deleted_fact_id": fact_id,
            "memory_facts": [f.model_dump() for f in thread.memory_facts],
        },
    )


@app.get("/api/v1/traces")
async def list_traces(request: Request, thread_id: str | None = None) -> dict[str, Any]:
    traces = store.traces
    if thread_id:
        traces = [t for t in traces if t.thread_id == thread_id]
    return _envelope(request, {"traces": [t.model_dump() for t in traces[:60]]})


@app.get("/api/v1/tools")
async def list_tools(request: Request) -> dict[str, Any]:
    return _envelope(
        request,
        {
            "tools": [t.model_dump() for t in store.tools.values()],
            "webhooks": [w.model_dump() for w in store.webhooks[:40]],
        },
    )


@app.patch("/api/v1/tools/{tool_name}")
async def toggle_tool(tool_name: str, payload: ToggleToolRequest, request: Request) -> dict[str, Any]:
    tool = store.tools.get(tool_name)
    if not tool:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_name}' not found")
    tool.enabled = payload.enabled
    return _envelope(request, {"tool": tool.model_dump()})


@app.post("/api/v1/webhooks/whatsapp")
async def ingest_whatsapp_webhook(payload: WhatsAppWebhookPayload, request: Request) -> dict[str, Any]:
    expected_secret = os.getenv("WHATSAPP_WEBHOOK_SECRET", "").strip()
    if expected_secret:
        provided = request.headers.get("X-Relay-Webhook-Secret", "")
        if provided != expected_secret:
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    started = time.perf_counter()
    req_id = request.state.request_id
    target_id = payload.thread_id or "thr_whatsapp_01"
    thread = store.threads.get(target_id)
    if not thread:
        raise HTTPException(status_code=404, detail=f"Target thread '{target_id}' not found")

    inbound_msg = MessageItem(
        id=payload.message_id or f"wamid_{uuid.uuid4().hex[:8]}",
        thread_id=thread.id,
        sender="customer",
        content=payload.message_text.strip(),
    )
    thread.messages.append(inbound_msg)
    ai_msg, extracted_facts, spans = await process_agent_turn(
        store=store,
        thread=thread,
        user_text=payload.message_text.strip(),
        request_id=req_id,
    )

    elapsed_ms = max(12, int((time.perf_counter() - started) * 1000))
    log = WebhookDeliveryLog(
        id=f"wh_{uuid.uuid4().hex[:8]}",
        request_id=req_id,
        direction="inbound",
        endpoint="/api/v1/webhooks/whatsapp",
        event_type="messages.received",
        status_code=200,
        latency_ms=elapsed_ms,
        payload_preview={
            "object": payload.object,
            "from": payload.from_number,
            "sender_name": payload.sender_name,
            "text": payload.message_text[:100],
        },
    )
    store.webhooks.insert(0, log)

    return _envelope(
        request,
        {
            "verified": True,
            "webhook_log": log.model_dump(),
            "thread": thread.model_dump(),
            "ai_message": ai_msg.model_dump() if ai_msg else None,
            "extracted_facts": [f.model_dump() for f in extracted_facts],
            "traces": [s.model_dump() for s in spans],
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8002")), reload=True)

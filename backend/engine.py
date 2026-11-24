from __future__ import annotations

import os
import re
import uuid
from typing import Any, List, Tuple

import httpx

from models import (
    MemoryCategory,
    MemoryFact,
    MessageItem,
    ThreadRecord,
    ToolTraceSpan,
    WebhookDeliveryLog,
    utc_now_iso,
)
from store import InMemoryStore


def _short_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def extract_memory_facts(text: str, thread: ThreadRecord) -> List[MemoryFact]:
    """Deterministic structured memory extractor from user messages."""
    extracted: List[Tuple[str, str, MemoryCategory]] = []

    name_match = re.search(r"\b(?:my name is|i am|i'm|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)", text, re.IGNORECASE)
    if name_match:
        candidate = name_match.group(1).strip().title()
        if candidate.lower() not in {"calling", "looking", "trying", "asking", "urgent", "interested", "available"}:
            extracted.append(("Name", candidate, "identity"))
            thread.customer.name = candidate

    time_match = re.search(
        r"\b((?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)\s*(?:at\s*)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}(?::\d{2})?\s*(?:am|pm)|mornings?|afternoons?|evenings?)\b",
        text,
        re.IGNORECASE,
    )
    if time_match:
        val = time_match.group(1).strip()
        extracted.append(("Preferred Time", val, "preference"))
        thread.customer.preferred_time = val

    lang_match = re.search(r"\b(arabic|spanish|french|german|english|portuguese|japanese)\b", text, re.IGNORECASE)
    if lang_match:
        val = lang_match.group(1).strip().title()
        extracted.append(("Language", val, "preference"))
        thread.customer.language = val

    order_match = re.search(r"(#?ORD-\d{4,8})", text, re.IGNORECASE)
    if order_match:
        val = order_match.group(1).upper()
        if not val.startswith("#"):
            val = f"#{val}"
        extracted.append(("Order ID", val, "order"))

    email_match = re.search(r"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})", text)
    if email_match:
        extracted.append(("Email", email_match.group(1).lower(), "contact"))

    if re.search(r"\b(whatsapp|sms|email)\s+(?:reminders?|alerts?|updates?)\b", text, re.IGNORECASE):
        ch_match = re.search(r"\b(whatsapp|sms|email)\s+(?:reminders?|alerts?|updates?)\b", text, re.IGNORECASE)
        if ch_match:
            extracted.append(("Channel Preference", ch_match.group(0).strip().title(), "preference"))

    if re.search(r"\b(urgent|supervisor|human|manager|double[- ]charged|refund|escalat)\b", text, re.IGNORECASE):
        extracted.append(("Escalation Flag", "High Priority / Human Review", "escalation"))

    new_facts: List[MemoryFact] = []
    for key, value, category in extracted:
        existing = next((f for f in thread.memory_facts if f.key.lower() == key.lower()), None)
        if existing:
            existing.value = value
            existing.category = category
            existing.source = "extracted"
            existing.updated_at = utc_now_iso()
            new_facts.append(existing)
        else:
            fact = MemoryFact(
                id=_short_id("fact"),
                key=key,
                value=value,
                category=category,
                confidence=0.95,
                source="extracted",
            )
            thread.memory_facts.append(fact)
            new_facts.append(fact)

    return new_facts


def _execute_tool(
    store: InMemoryStore,
    request_id: str,
    thread_id: str,
    tool_name: str,
    input_payload: dict[str, Any],
    output_payload: dict[str, Any],
    latency_ms: int,
    created: bool = False,
) -> ToolTraceSpan:
    tool_cfg = store.tools.get(tool_name)
    if tool_cfg and not tool_cfg.enabled:
        span = ToolTraceSpan(
            id=_short_id("trc"),
            request_id=request_id,
            thread_id=thread_id,
            tool_name=tool_name,
            status="409 DISABLED",
            latency_ms=4,
            input_payload=input_payload,
            output_payload={"error": f"Tool '{tool_name}' is disabled in registry"},
        )
        store.traces.insert(0, span)
        return span

    if tool_cfg:
        tool_cfg.calls_count += 1

    span = ToolTraceSpan(
        id=_short_id("trc"),
        request_id=request_id,
        thread_id=thread_id,
        tool_name=tool_name,
        status="201 CREATED" if created else "200 OK",
        latency_ms=latency_ms,
        input_payload=input_payload,
        output_payload=output_payload,
    )
    store.traces.insert(0, span)
    return span


async def _optional_openai_polish(user_text: str, draft_reply: str, thread: ThreadRecord) -> str:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return draft_reply

    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": model,
                    "temperature": 0.3,
                    "max_tokens": 180,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You are RelayAgent, an enterprise omnichannel support assistant. "
                                "Rewrite the grounded draft reply concisely without inventing facts."
                            ),
                        },
                        {
                            "role": "user",
                            "content": (
                                f"Customer ({thread.customer.name}, {thread.channel}): {user_text}\n"
                                f"Grounded draft: {draft_reply}"
                            ),
                        },
                    ],
                },
            )
            if resp.status_code == 200:
                content = resp.json()["choices"][0]["message"]["content"]
                if content and content.strip():
                    return content.strip()
    except Exception:
        pass
    return draft_reply


async def process_agent_turn(
    store: InMemoryStore,
    thread: ThreadRecord,
    user_text: str,
    request_id: str,
) -> tuple[MessageItem | None, List[MemoryFact], List[ToolTraceSpan]]:
    """Run memory extraction, intent routing, tool execution, and reply synthesis."""
    new_facts = extract_memory_facts(user_text, thread)

    # If human handoff is active, do not auto-reply with AI
    if thread.status == "human_handoff":
        thread.unread_count += 1
        thread.updated_at = utc_now_iso()
        return None, new_facts, []

    lower = user_text.lower()
    spans: List[ToolTraceSpan] = []

    if any(k in lower for k in ["urgent", "supervisor", "human", "manager", "double-charged", "double charged", "refund", "escalat"]):
        thread.customer.intent = "Urgent Escalation"
        ticket_id = f"TKT-{uuid.uuid4().hex[:4].upper()}"
        s1 = _execute_tool(
            store,
            request_id,
            thread.id,
            "create_ticket",
            {"thread_id": thread.id, "priority": "P1", "reason": user_text[:120]},
            {"ticket_id": ticket_id, "queue": "tier-2-escalations", "sla_minutes": 15},
            latency_ms=138,
            created=True,
        )
        spans.append(s1)
        s2 = _execute_tool(
            store,
            request_id,
            thread.id,
            "dispatch_webhook",
            {"event": "handoff.triggered", "ticket_id": ticket_id, "customer": thread.customer.name},
            {"delivered": True, "destination": "ops-escalation-webhook"},
            latency_ms=61,
        )
        spans.append(s2)
        store.webhooks.insert(
            0,
            WebhookDeliveryLog(
                id=_short_id("wh"),
                request_id=request_id,
                direction="outbound",
                endpoint="https://hooks.ops.example/escalations",
                event_type="handoff.triggered",
                status_code=200 if s2.status == "200 OK" else 409,
                latency_ms=s2.latency_ms,
                payload_preview={"ticket_id": ticket_id, "thread_id": thread.id, "priority": "P1"},
            ),
        )
        thread.status = "human_handoff"
        if s1.status == "409 DISABLED":
            draft_reply = (
                f"I've flagged your message as urgent and switched this thread to **Human Handoff** "
                f"(note: `create_ticket` tool is currently disabled in the registry)."
            )
        else:
            draft_reply = (
                f"I've escalated this immediately under priority ticket **{ticket_id} (P1)** and paused AI auto-replies. "
                f"A specialist has been notified and will take over right here."
            )

    elif any(k in lower for k in ["order", "ord-", "track", "shipping", "delivery", "package"]):
        thread.customer.intent = "Order Tracking"
        order_match = re.search(r"(ORD-\d{4,8})", user_text, re.IGNORECASE)
        order_id = order_match.group(1).upper() if order_match else "ORD-88412"
        s1 = _execute_tool(
            store,
            request_id,
            thread.id,
            "lookup_order",
            {"order_id": order_id, "customer": thread.customer.name},
            {
                "order_id": order_id,
                "status": "OUT_FOR_DELIVERY",
                "carrier": "DHL Express",
                "eta": "Tomorrow by 4:30 PM",
                "last_scan": "Regional Distribution Hub",
            },
            latency_ms=116,
        )
        spans.append(s1)
        if s1.status == "409 DISABLED":
            draft_reply = (
                f"I'd love to look up **#{order_id}**, but the `lookup_order` tool is currently disabled in the MCP registry. "
                f"Re-enable it in the Inspector to fetch live carrier telemetry."
            )
        else:
            draft_reply = (
                f"Order **#{order_id}** is currently **Out for Delivery** via DHL Express (last scan: Regional Distribution Hub). "
                f"Estimated arrival is **Tomorrow by 4:30 PM**."
            )

    elif any(k in lower for k in ["book", "appointment", "reschedule", "slot", "calendar", "thursday", "friday", "tomorrow", "pm", "am"]):
        thread.customer.intent = "Appointment Booking"
        requested_slot = thread.customer.preferred_time or "Thursday 2:30 PM"
        s1 = _execute_tool(
            store,
            request_id,
            thread.id,
            "check_calendar_slots",
            {"requested_window": requested_slot, "duration_min": 30, "customer": thread.customer.name},
            {"confirmed_slot": requested_slot, "calendar_event_id": f"cal_{uuid.uuid4().hex[:6]}", "available": True},
            latency_ms=149,
        )
        spans.append(s1)
        s2 = _execute_tool(
            store,
            request_id,
            thread.id,
            "dispatch_webhook",
            {"event": "booking.confirmed", "slot": requested_slot, "channel": thread.channel},
            {"delivered": True, "http_status": 200},
            latency_ms=59,
        )
        spans.append(s2)
        store.webhooks.insert(
            0,
            WebhookDeliveryLog(
                id=_short_id("wh"),
                request_id=request_id,
                direction="outbound",
                endpoint="https://crm.example.internal/hooks/calendar-sync",
                event_type="booking.confirmed",
                status_code=200 if s2.status == "200 OK" else 409,
                latency_ms=s2.latency_ms,
                payload_preview={"customer": thread.customer.name, "slot": requested_slot},
            ),
        )
        if s1.status == "409 DISABLED":
            draft_reply = (
                f"I noted your preferred time (**{requested_slot}**) in memory, but `check_calendar_slots` is currently disabled. "
                f"Enable it in the Webhooks & MCP Tools tab to confirm live availability."
            )
        else:
            draft_reply = (
                f"Done, {thread.customer.name.split()[0]}! I verified availability and reserved **{requested_slot}** "
                f"for your 30-minute session, and dispatched a confirmation event to our CRM."
            )

    elif any(k in lower for k in ["nearest", "location", "branch", "address", "open", "center", "places", "hours"]):
        thread.customer.intent = "Service Center Location"
        s1 = _execute_tool(
            store,
            request_id,
            thread.id,
            "search_google_places",
            {"query": user_text[:80], "open_now": True},
            {
                "name": "Downtown Financial District Hub",
                "address": "420 Market St, Suite 120",
                "distance_km": 1.4,
                "open_until": "20:30",
                "wait_minutes": 5,
            },
            latency_ms=172,
        )
        spans.append(s1)
        if s1.status == "409 DISABLED":
            draft_reply = (
                "The `search_google_places` tool is currently disabled in the tool registry. "
                "Toggle it back on to query live branch locations and hours."
            )
        else:
            draft_reply = (
                "The nearest open location is **Downtown Financial District Hub** (420 Market St, 1.4 km away). "
                "It's open until **8:30 PM** today with an estimated 5-minute wait."
            )

    else:
        s1 = _execute_tool(
            store,
            request_id,
            thread.id,
            "dispatch_webhook",
            {"event": "memory.synced", "thread_id": thread.id, "facts_count": len(thread.memory_facts)},
            {"delivered": True, "synced_facts": len(thread.memory_facts)},
            latency_ms=54,
        )
        spans.append(s1)
        fact_note = (
            f" I also saved **{', '.join(f'{f.key}: {f.value}' for f in new_facts)}** to your profile memory."
            if new_facts
            else ""
        )
        draft_reply = (
            f"Got it, {thread.customer.name.split()[0]}!{fact_note} I can help check an order (`#ORD-88412`), "
            f"book or reschedule an appointment, find a nearby branch, or escalate to a human specialist."
        )

    final_reply = await _optional_openai_polish(user_text, draft_reply, thread)

    ai_msg = MessageItem(
        id=_short_id("msg"),
        thread_id=thread.id,
        sender="ai",
        content=final_reply,
        tool_calls=[
            {"tool_name": s.tool_name, "status": s.status, "latency_ms": s.latency_ms}
            for s in spans
        ],
        extracted_facts=[f"{f.key}: {f.value}" for f in new_facts],
    )
    thread.messages.append(ai_msg)
    thread.updated_at = utc_now_iso()
    return ai_msg, new_facts, spans

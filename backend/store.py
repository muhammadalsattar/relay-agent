from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, List

from models import (
    CustomerProfile,
    MemoryFact,
    MessageItem,
    ThreadRecord,
    ToolRegistryItem,
    ToolTraceSpan,
    WebhookDeliveryLog,
)


def _iso_ago(minutes: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(minutes=minutes)).isoformat()


class InMemoryStore:
    def __init__(self) -> None:
        self.threads: Dict[str, ThreadRecord] = {}
        self.traces: List[ToolTraceSpan] = []
        self.tools: Dict[str, ToolRegistryItem] = {}
        self.webhooks: List[WebhookDeliveryLog] = []
        self.seed()

    def seed(self) -> None:
        self.tools = {
            "lookup_order": ToolRegistryItem(
                name="lookup_order",
                description="Fetch live shipment, ETA, and carrier telemetry from OMS.",
                protocol="MCP Tool",
                enabled=True,
                avg_latency_ms=118,
                calls_count=14,
            ),
            "check_calendar_slots": ToolRegistryItem(
                name="check_calendar_slots",
                description="Query open booking windows and reserve slots in Calendar API.",
                protocol="MCP Tool",
                enabled=True,
                avg_latency_ms=145,
                calls_count=22,
            ),
            "search_google_places": ToolRegistryItem(
                name="search_google_places",
                description="Resolve nearest service center hours, distance, and live capacity.",
                protocol="REST API",
                enabled=True,
                avg_latency_ms=176,
                calls_count=9,
            ),
            "create_ticket": ToolRegistryItem(
                name="create_ticket",
                description="Create prioritized Zendesk/Linear escalation ticket with SLA timer.",
                protocol="MCP Tool",
                enabled=True,
                avg_latency_ms=132,
                calls_count=6,
            ),
            "dispatch_webhook": ToolRegistryItem(
                name="dispatch_webhook",
                description="Emit signed event payload to downstream CRM / WhatsApp Cloud API.",
                protocol="Webhook",
                enabled=True,
                avg_latency_ms=64,
                calls_count=31,
            ),
        }

        t1 = ThreadRecord(
            id="thr_whatsapp_01",
            channel="whatsapp",
            status="ai_active",
            unread_count=2,
            scenario_tag="Appointment Booking",
            customer=CustomerProfile(
                name="Sarah Jenkins",
                phone_or_handle="+1 (415) 555-0192",
                preferred_time="Weekday Afternoons (2–4 PM)",
                language="English",
                intent="Consultation Reschedule",
                vip_tier="Gold",
            ),
            updated_at=_iso_ago(3),
            memory_facts=[
                MemoryFact(
                    id="fact_101",
                    key="Name",
                    value="Sarah Jenkins",
                    category="identity",
                    confidence=0.99,
                    source="seeded",
                    updated_at=_iso_ago(42),
                ),
                MemoryFact(
                    id="fact_102",
                    key="Preferred Time",
                    value="Weekday Afternoons (2–4 PM)",
                    category="preference",
                    confidence=0.94,
                    source="extracted",
                    updated_at=_iso_ago(14),
                ),
                MemoryFact(
                    id="fact_103",
                    key="Channel Preference",
                    value="WhatsApp reminders",
                    category="preference",
                    confidence=0.92,
                    source="extracted",
                    updated_at=_iso_ago(14),
                ),
                MemoryFact(
                    id="fact_104",
                    key="VIP Tier",
                    value="Gold",
                    category="identity",
                    confidence=0.99,
                    source="seeded",
                    updated_at=_iso_ago(42),
                ),
            ],
            messages=[
                MessageItem(
                    id="msg_101",
                    thread_id="thr_whatsapp_01",
                    sender="customer",
                    content="Hi! I need to book a 30-minute onboarding consultation sometime tomorrow afternoon.",
                    timestamp=_iso_ago(15),
                ),
                MessageItem(
                    id="msg_102",
                    thread_id="thr_whatsapp_01",
                    sender="ai",
                    content=(
                        "Hi Sarah! I checked our calendar for tomorrow afternoon and found two open "
                        "slots: **2:00 PM** and **3:30 PM** (UTC-5). Would you like me to lock in "
                        "one of those and send a WhatsApp confirmation?"
                    ),
                    timestamp=_iso_ago(14),
                    tool_calls=[
                        {"tool_name": "check_calendar_slots", "status": "200 OK", "latency_ms": 142},
                        {"tool_name": "dispatch_webhook", "status": "200 OK", "latency_ms": 58},
                    ],
                    extracted_facts=["Preferred Time: Weekday Afternoons (2–4 PM)"],
                ),
            ],
        )

        t2 = ThreadRecord(
            id="thr_web_02",
            channel="web_widget",
            status="ai_active",
            unread_count=1,
            scenario_tag="Order Status Lookup",
            customer=CustomerProfile(
                name="Marcus Vance",
                phone_or_handle="marcus.vance@northstar.io",
                preferred_time="Mornings",
                language="English",
                intent="Order Tracking",
                vip_tier="Silver",
            ),
            updated_at=_iso_ago(8),
            memory_facts=[
                MemoryFact(
                    id="fact_201",
                    key="Name",
                    value="Marcus Vance",
                    category="identity",
                    confidence=0.99,
                    source="seeded",
                    updated_at=_iso_ago(30),
                ),
                MemoryFact(
                    id="fact_202",
                    key="Order ID",
                    value="#ORD-88412",
                    category="order",
                    confidence=0.98,
                    source="extracted",
                    updated_at=_iso_ago(9),
                ),
                MemoryFact(
                    id="fact_203",
                    key="Intent",
                    value="Order Tracking",
                    category="intent",
                    confidence=0.96,
                    source="extracted",
                    updated_at=_iso_ago(9),
                ),
            ],
            messages=[
                MessageItem(
                    id="msg_201",
                    thread_id="thr_web_02",
                    sender="customer",
                    content="Hey, can you check the live shipping status for order #ORD-88412?",
                    timestamp=_iso_ago(9),
                ),
                MessageItem(
                    id="msg_202",
                    thread_id="thr_web_02",
                    sender="ai",
                    content=(
                        "Order **#ORD-88412** is currently **In Transit** via DHL Express (Hub: Chicago). "
                        "Estimated delivery is **Tomorrow by 5:00 PM**. Let me know if you want SMS delivery alerts enabled."
                    ),
                    timestamp=_iso_ago(8),
                    tool_calls=[
                        {"tool_name": "lookup_order", "status": "200 OK", "latency_ms": 114},
                    ],
                    extracted_facts=["Order ID: #ORD-88412"],
                ),
            ],
        )

        t3 = ThreadRecord(
            id="thr_sms_03",
            channel="sms",
            status="human_handoff",
            unread_count=3,
            scenario_tag="Urgent Escalation",
            customer=CustomerProfile(
                name="Elena Rostova",
                phone_or_handle="+1 (212) 555-0148",
                preferred_time="Immediate",
                language="English",
                intent="Billing Escalation",
                vip_tier="Enterprise",
            ),
            updated_at=_iso_ago(19),
            memory_facts=[
                MemoryFact(
                    id="fact_301",
                    key="Name",
                    value="Elena Rostova",
                    category="identity",
                    confidence=0.99,
                    source="seeded",
                    updated_at=_iso_ago(55),
                ),
                MemoryFact(
                    id="fact_302",
                    key="Escalation Priority",
                    value="P1 — Duplicate Charge ($490)",
                    category="escalation",
                    confidence=0.97,
                    source="extracted",
                    updated_at=_iso_ago(20),
                ),
                MemoryFact(
                    id="fact_303",
                    key="VIP Tier",
                    value="Enterprise",
                    category="identity",
                    confidence=0.99,
                    source="seeded",
                    updated_at=_iso_ago(55),
                ),
            ],
            messages=[
                MessageItem(
                    id="msg_301",
                    thread_id="thr_sms_03",
                    sender="customer",
                    content="Urgent: our corporate card was charged twice ($490) for invoice INV-2204. I need a billing specialist.",
                    timestamp=_iso_ago(20),
                ),
                MessageItem(
                    id="msg_302",
                    thread_id="thr_sms_03",
                    sender="ai",
                    content=(
                        "I've created priority ticket **TKT-4902 (P1)** and paused automated replies "
                        "so our Enterprise Billing Specialist can review invoice INV-2204 right away."
                    ),
                    timestamp=_iso_ago(19),
                    tool_calls=[
                        {"tool_name": "create_ticket", "status": "201 CREATED", "latency_ms": 136},
                        {"tool_name": "dispatch_webhook", "status": "200 OK", "latency_ms": 62},
                    ],
                    extracted_facts=["Escalation Priority: P1 — Duplicate Charge ($490)"],
                ),
            ],
        )

        t4 = ThreadRecord(
            id="thr_whatsapp_04",
            channel="whatsapp",
            status="resolved",
            unread_count=0,
            scenario_tag="Branch & Hours Lookup",
            customer=CustomerProfile(
                name="Tariq Al-Mansoor",
                phone_or_handle="+971 50 555 0174",
                preferred_time="Evenings (6–8 PM)",
                language="Arabic / English",
                intent="Service Center Location",
                vip_tier="Gold",
            ),
            updated_at=_iso_ago(47),
            memory_facts=[
                MemoryFact(
                    id="fact_401",
                    key="Name",
                    value="Tariq Al-Mansoor",
                    category="identity",
                    confidence=0.99,
                    source="seeded",
                    updated_at=_iso_ago(90),
                ),
                MemoryFact(
                    id="fact_402",
                    key="Language",
                    value="Arabic / English",
                    category="preference",
                    confidence=0.95,
                    source="extracted",
                    updated_at=_iso_ago(48),
                ),
            ],
            messages=[
                MessageItem(
                    id="msg_401",
                    thread_id="thr_whatsapp_04",
                    sender="customer",
                    content="Which downtown service hub is open past 6 PM today?",
                    timestamp=_iso_ago(48),
                ),
                MessageItem(
                    id="msg_402",
                    thread_id="thr_whatsapp_04",
                    sender="ai",
                    content=(
                        "The **Downtown Financial District Hub** (420 Market St) is open until **8:30 PM** today "
                        "with a current wait time of ~5 minutes."
                    ),
                    timestamp=_iso_ago(47),
                    tool_calls=[
                        {"tool_name": "search_google_places", "status": "200 OK", "latency_ms": 178},
                    ],
                ),
            ],
        )

        self.threads = {t.id: t for t in [t1, t2, t3, t4]}

        self.traces = [
            ToolTraceSpan(
                id="trc_901",
                request_id="req_seed_901",
                thread_id="thr_whatsapp_01",
                tool_name="check_calendar_slots",
                status="200 OK",
                latency_ms=142,
                timestamp=_iso_ago(14),
                input_payload={"date": "tomorrow", "window": "afternoon", "duration_min": 30},
                output_payload={"available_slots": ["14:00", "15:30"], "timezone": "UTC-5"},
            ),
            ToolTraceSpan(
                id="trc_902",
                request_id="req_seed_901",
                thread_id="thr_whatsapp_01",
                tool_name="dispatch_webhook",
                status="200 OK",
                latency_ms=58,
                timestamp=_iso_ago(14),
                input_payload={"event": "memory.updated", "thread_id": "thr_whatsapp_01"},
                output_payload={"delivered": True, "http_status": 200},
            ),
            ToolTraceSpan(
                id="trc_903",
                request_id="req_seed_902",
                thread_id="thr_web_02",
                tool_name="lookup_order",
                status="200 OK",
                latency_ms=114,
                timestamp=_iso_ago(8),
                input_payload={"order_id": "ORD-88412"},
                output_payload={
                    "order_id": "ORD-88412",
                    "status": "IN_TRANSIT",
                    "carrier": "DHL Express",
                    "eta": "Tomorrow 17:00",
                },
            ),
            ToolTraceSpan(
                id="trc_904",
                request_id="req_seed_903",
                thread_id="thr_sms_03",
                tool_name="create_ticket",
                status="201 CREATED",
                latency_ms=136,
                timestamp=_iso_ago(19),
                input_payload={"priority": "P1", "category": "billing_duplicate", "amount": 490},
                output_payload={"ticket_id": "TKT-4902", "assigned_queue": "enterprise-billing"},
            ),
            ToolTraceSpan(
                id="trc_905",
                request_id="req_seed_904",
                thread_id="thr_whatsapp_04",
                tool_name="search_google_places",
                status="200 OK",
                latency_ms=178,
                timestamp=_iso_ago(47),
                input_payload={"query": "downtown service hub", "open_after": "18:00"},
                output_payload={
                    "place": "Downtown Financial District Hub",
                    "address": "420 Market St",
                    "closes_at": "20:30",
                },
            ),
        ]

        self.webhooks = [
            WebhookDeliveryLog(
                id="wh_501",
                request_id="req_seed_901",
                direction="inbound",
                endpoint="/api/v1/webhooks/whatsapp",
                event_type="messages.received",
                status_code=200,
                latency_ms=34,
                timestamp=_iso_ago(15),
                payload_preview={"from": "+14155550192", "text": "Hi! I need to book a 30-minute onboarding consultation..."},
            ),
            WebhookDeliveryLog(
                id="wh_502",
                request_id="req_seed_901",
                direction="outbound",
                endpoint="https://crm.example.internal/hooks/memory-sync",
                event_type="memory.updated",
                status_code=200,
                latency_ms=58,
                timestamp=_iso_ago(14),
                payload_preview={"thread_id": "thr_whatsapp_01", "facts_added": 1},
            ),
            WebhookDeliveryLog(
                id="wh_503",
                request_id="req_seed_903",
                direction="outbound",
                endpoint="https://hooks.slack.example/escalations",
                event_type="handoff.triggered",
                status_code=200,
                latency_ms=62,
                timestamp=_iso_ago(19),
                payload_preview={"ticket_id": "TKT-4902", "priority": "P1", "customer": "Elena Rostova"},
            ),
        ]


store = InMemoryStore()

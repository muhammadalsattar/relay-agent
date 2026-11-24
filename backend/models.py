from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field


ChannelType = Literal["whatsapp", "web_widget", "sms"]
ThreadStatus = Literal["ai_active", "human_handoff", "resolved"]
SenderType = Literal["customer", "ai", "human_agent", "system"]
MemoryCategory = Literal["identity", "preference", "intent", "order", "contact", "escalation"]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ToolTraceSpan(BaseModel):
    id: str
    request_id: str
    thread_id: str
    tool_name: str
    status: Literal["200 OK", "201 CREATED", "409 DISABLED", "500 ERROR"] = "200 OK"
    latency_ms: int
    timestamp: str = Field(default_factory=utc_now_iso)
    input_payload: dict[str, Any] = Field(default_factory=dict)
    output_payload: dict[str, Any] = Field(default_factory=dict)


class MessageItem(BaseModel):
    id: str
    thread_id: str
    sender: SenderType
    content: str
    timestamp: str = Field(default_factory=utc_now_iso)
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)
    extracted_facts: list[str] = Field(default_factory=list)


class MemoryFact(BaseModel):
    id: str
    key: str
    value: str
    category: MemoryCategory = "preference"
    confidence: float = 0.95
    source: Literal["extracted", "manual", "seeded"] = "extracted"
    updated_at: str = Field(default_factory=utc_now_iso)


class CustomerProfile(BaseModel):
    name: str
    phone_or_handle: str
    preferred_time: str = "Not set"
    language: str = "English"
    intent: str = "General Inquiry"
    vip_tier: Literal["Standard", "Silver", "Gold", "Enterprise"] = "Standard"


class ThreadRecord(BaseModel):
    id: str
    channel: ChannelType
    status: ThreadStatus = "ai_active"
    unread_count: int = 0
    scenario_tag: str
    customer: CustomerProfile
    messages: list[MessageItem] = Field(default_factory=list)
    memory_facts: list[MemoryFact] = Field(default_factory=list)
    updated_at: str = Field(default_factory=utc_now_iso)


class ToolRegistryItem(BaseModel):
    name: str
    description: str
    protocol: Literal["MCP Tool", "Webhook", "REST API"] = "MCP Tool"
    enabled: bool = True
    avg_latency_ms: int = 120
    calls_count: int = 0


class WebhookDeliveryLog(BaseModel):
    id: str
    request_id: str
    direction: Literal["inbound", "outbound"]
    endpoint: str
    event_type: str
    status_code: int = 200
    latency_ms: int
    timestamp: str = Field(default_factory=utc_now_iso)
    payload_preview: dict[str, Any] = Field(default_factory=dict)


class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    sender: Literal["customer", "human_agent"] = "customer"


class HandoffRequest(BaseModel):
    mode: Optional[Literal["human_handoff", "ai_active", "resolved"]] = None


class AddMemoryFactRequest(BaseModel):
    key: str = Field(..., min_length=1, max_length=80)
    value: str = Field(..., min_length=1, max_length=240)
    category: MemoryCategory = "preference"


class ToggleToolRequest(BaseModel):
    enabled: bool


class WhatsAppWebhookPayload(BaseModel):
    object: str = "whatsapp_business_account"
    thread_id: Optional[str] = None
    from_number: str = "+14155550192"
    sender_name: str = "Sarah Jenkins"
    message_text: str = Field(..., min_length=1, max_length=2000)
    message_id: Optional[str] = None


class APIEnvelope(BaseModel):
    request_id: str
    timestamp: str = Field(default_factory=utc_now_iso)
    data: Any

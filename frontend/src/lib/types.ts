export type ChannelType = "whatsapp" | "web_widget" | "sms";
export type ThreadStatus = "ai_active" | "human_handoff" | "resolved";
export type SenderType = "customer" | "ai" | "human_agent" | "system";
export type MemoryCategory =
  | "identity"
  | "preference"
  | "intent"
  | "order"
  | "contact"
  | "escalation";

export interface InlineToolCall {
  tool_name: string;
  status: string;
  latency_ms: number;
}

export interface ToolTraceSpan {
  id: string;
  request_id: string;
  thread_id: string;
  tool_name: string;
  status: "200 OK" | "201 CREATED" | "409 DISABLED" | "500 ERROR";
  latency_ms: number;
  timestamp: string;
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown>;
}

export interface MessageItem {
  id: string;
  thread_id: string;
  sender: SenderType;
  content: string;
  timestamp: string;
  tool_calls: InlineToolCall[];
  extracted_facts: string[];
}

export interface MemoryFact {
  id: string;
  key: string;
  value: string;
  category: MemoryCategory;
  confidence: number;
  source: "extracted" | "manual" | "seeded";
  updated_at: string;
}

export interface CustomerProfile {
  name: string;
  phone_or_handle: string;
  preferred_time: string;
  language: string;
  intent: string;
  vip_tier: "Standard" | "Silver" | "Gold" | "Enterprise";
}

export interface ThreadRecord {
  id: string;
  channel: ChannelType;
  status: ThreadStatus;
  unread_count: number;
  scenario_tag: string;
  customer: CustomerProfile;
  messages: MessageItem[];
  memory_facts: MemoryFact[];
  updated_at: string;
}

export interface ToolRegistryItem {
  name: string;
  description: string;
  protocol: "MCP Tool" | "Webhook" | "REST API";
  enabled: boolean;
  avg_latency_ms: number;
  calls_count: number;
}

export interface WebhookDeliveryLog {
  id: string;
  request_id: string;
  direction: "inbound" | "outbound";
  endpoint: string;
  event_type: string;
  status_code: number;
  latency_ms: number;
  timestamp: string;
  payload_preview: Record<string, unknown>;
}

export interface APIEnvelope<T> {
  request_id: string;
  timestamp: string;
  data: T;
}

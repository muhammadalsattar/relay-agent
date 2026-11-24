import {
  MemoryCategory,
  MemoryFact,
  MessageItem,
  ThreadRecord,
  ThreadStatus,
  ToolRegistryItem,
  ToolTraceSpan,
  WebhookDeliveryLog,
} from "./types";

interface RelayEngineState {
  threads: Map<string, ThreadRecord>;
  traces: ToolTraceSpan[];
  tools: Map<string, ToolRegistryItem>;
  webhooks: WebhookDeliveryLog[];
}

const globalForRelay = globalThis as unknown as {
  __relayAgentState?: RelayEngineState;
};

function isoAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function shortId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function createSeedState(): RelayEngineState {
  const tools = new Map<string, ToolRegistryItem>([
    [
      "lookup_order",
      {
        name: "lookup_order",
        description: "Fetch live shipment, ETA, and carrier telemetry from OMS.",
        protocol: "MCP Tool",
        enabled: true,
        avg_latency_ms: 118,
        calls_count: 14,
      },
    ],
    [
      "check_calendar_slots",
      {
        name: "check_calendar_slots",
        description: "Query open booking windows and reserve slots in Calendar API.",
        protocol: "MCP Tool",
        enabled: true,
        avg_latency_ms: 145,
        calls_count: 22,
      },
    ],
    [
      "search_google_places",
      {
        name: "search_google_places",
        description: "Resolve nearest service center hours, distance, and live capacity.",
        protocol: "REST API",
        enabled: true,
        avg_latency_ms: 176,
        calls_count: 9,
      },
    ],
    [
      "create_ticket",
      {
        name: "create_ticket",
        description: "Create prioritized Zendesk/Linear escalation ticket with SLA timer.",
        protocol: "MCP Tool",
        enabled: true,
        avg_latency_ms: 132,
        calls_count: 6,
      },
    ],
    [
      "dispatch_webhook",
      {
        name: "dispatch_webhook",
        description: "Emit signed event payload to downstream CRM / WhatsApp Cloud API.",
        protocol: "Webhook",
        enabled: true,
        avg_latency_ms: 64,
        calls_count: 31,
      },
    ],
  ]);

  const seedThreads: ThreadRecord[] = [
    {
      id: "thr_whatsapp_01",
      channel: "whatsapp",
      status: "ai_active",
      unread_count: 2,
      scenario_tag: "Appointment Booking",
      customer: {
        name: "Sarah Jenkins",
        phone_or_handle: "+1 (415) 555-0192",
        preferred_time: "Weekday Afternoons (2–4 PM)",
        language: "English",
        intent: "Consultation Reschedule",
        vip_tier: "Gold",
      },
      updated_at: isoAgo(3),
      memory_facts: [
        {
          id: "fact_101",
          key: "Name",
          value: "Sarah Jenkins",
          category: "identity",
          confidence: 0.99,
          source: "seeded",
          updated_at: isoAgo(42),
        },
        {
          id: "fact_102",
          key: "Preferred Time",
          value: "Weekday Afternoons (2–4 PM)",
          category: "preference",
          confidence: 0.94,
          source: "extracted",
          updated_at: isoAgo(14),
        },
        {
          id: "fact_103",
          key: "Channel Preference",
          value: "WhatsApp reminders",
          category: "preference",
          confidence: 0.92,
          source: "extracted",
          updated_at: isoAgo(14),
        },
        {
          id: "fact_104",
          key: "VIP Tier",
          value: "Gold",
          category: "identity",
          confidence: 0.99,
          source: "seeded",
          updated_at: isoAgo(42),
        },
      ],
      messages: [
        {
          id: "msg_101",
          thread_id: "thr_whatsapp_01",
          sender: "customer",
          content:
            "Hi! I need to book a 30-minute onboarding consultation sometime tomorrow afternoon.",
          timestamp: isoAgo(15),
          tool_calls: [],
          extracted_facts: [],
        },
        {
          id: "msg_102",
          thread_id: "thr_whatsapp_01",
          sender: "ai",
          content:
            "Hi Sarah! I checked our calendar for tomorrow afternoon and found two open slots: 2:00 PM and 3:30 PM (UTC-5). Would you like me to lock in one of those and send a WhatsApp confirmation?",
          timestamp: isoAgo(14),
          tool_calls: [
            { tool_name: "check_calendar_slots", status: "200 OK", latency_ms: 142 },
            { tool_name: "dispatch_webhook", status: "200 OK", latency_ms: 58 },
          ],
          extracted_facts: ["Preferred Time: Weekday Afternoons (2–4 PM)"],
        },
      ],
    },
    {
      id: "thr_web_02",
      channel: "web_widget",
      status: "ai_active",
      unread_count: 1,
      scenario_tag: "Order Status Lookup",
      customer: {
        name: "Marcus Vance",
        phone_or_handle: "marcus.vance@northstar.io",
        preferred_time: "Mornings",
        language: "English",
        intent: "Order Tracking",
        vip_tier: "Silver",
      },
      updated_at: isoAgo(8),
      memory_facts: [
        {
          id: "fact_201",
          key: "Name",
          value: "Marcus Vance",
          category: "identity",
          confidence: 0.99,
          source: "seeded",
          updated_at: isoAgo(30),
        },
        {
          id: "fact_202",
          key: "Order ID",
          value: "#ORD-88412",
          category: "order",
          confidence: 0.98,
          source: "extracted",
          updated_at: isoAgo(9),
        },
        {
          id: "fact_203",
          key: "Intent",
          value: "Order Tracking",
          category: "intent",
          confidence: 0.96,
          source: "extracted",
          updated_at: isoAgo(9),
        },
      ],
      messages: [
        {
          id: "msg_201",
          thread_id: "thr_web_02",
          sender: "customer",
          content: "Hey, can you check the live shipping status for order #ORD-88412?",
          timestamp: isoAgo(9),
          tool_calls: [],
          extracted_facts: [],
        },
        {
          id: "msg_202",
          thread_id: "thr_web_02",
          sender: "ai",
          content:
            "Order #ORD-88412 is currently In Transit via DHL Express (Hub: Chicago). Estimated delivery is Tomorrow by 5:00 PM. Let me know if you want SMS delivery alerts enabled.",
          timestamp: isoAgo(8),
          tool_calls: [{ tool_name: "lookup_order", status: "200 OK", latency_ms: 114 }],
          extracted_facts: ["Order ID: #ORD-88412"],
        },
      ],
    },
    {
      id: "thr_sms_03",
      channel: "sms",
      status: "human_handoff",
      unread_count: 3,
      scenario_tag: "Urgent Escalation",
      customer: {
        name: "Elena Rostova",
        phone_or_handle: "+1 (212) 555-0148",
        preferred_time: "Immediate",
        language: "English",
        intent: "Billing Escalation",
        vip_tier: "Enterprise",
      },
      updated_at: isoAgo(19),
      memory_facts: [
        {
          id: "fact_301",
          key: "Name",
          value: "Elena Rostova",
          category: "identity",
          confidence: 0.99,
          source: "seeded",
          updated_at: isoAgo(55),
        },
        {
          id: "fact_302",
          key: "Escalation Priority",
          value: "P1 — Duplicate Charge ($490)",
          category: "escalation",
          confidence: 0.97,
          source: "extracted",
          updated_at: isoAgo(20),
        },
        {
          id: "fact_303",
          key: "VIP Tier",
          value: "Enterprise",
          category: "identity",
          confidence: 0.99,
          source: "seeded",
          updated_at: isoAgo(55),
        },
      ],
      messages: [
        {
          id: "msg_301",
          thread_id: "thr_sms_03",
          sender: "customer",
          content:
            "Urgent: our corporate card was charged twice ($490) for invoice INV-2204. I need a billing specialist.",
          timestamp: isoAgo(20),
          tool_calls: [],
          extracted_facts: [],
        },
        {
          id: "msg_302",
          thread_id: "thr_sms_03",
          sender: "ai",
          content:
            "I've created priority ticket TKT-4902 (P1) and paused automated replies so our Enterprise Billing Specialist can review invoice INV-2204 right away.",
          timestamp: isoAgo(19),
          tool_calls: [
            { tool_name: "create_ticket", status: "201 CREATED", latency_ms: 136 },
            { tool_name: "dispatch_webhook", status: "200 OK", latency_ms: 62 },
          ],
          extracted_facts: ["Escalation Priority: P1 — Duplicate Charge ($490)"],
        },
      ],
    },
    {
      id: "thr_whatsapp_04",
      channel: "whatsapp",
      status: "resolved",
      unread_count: 0,
      scenario_tag: "Branch & Hours Lookup",
      customer: {
        name: "Tariq Al-Mansoor",
        phone_or_handle: "+971 50 555 0174",
        preferred_time: "Evenings (6–8 PM)",
        language: "Arabic / English",
        intent: "Service Center Location",
        vip_tier: "Gold",
      },
      updated_at: isoAgo(47),
      memory_facts: [
        {
          id: "fact_401",
          key: "Name",
          value: "Tariq Al-Mansoor",
          category: "identity",
          confidence: 0.99,
          source: "seeded",
          updated_at: isoAgo(90),
        },
        {
          id: "fact_402",
          key: "Language",
          value: "Arabic / English",
          category: "preference",
          confidence: 0.95,
          source: "extracted",
          updated_at: isoAgo(48),
        },
      ],
      messages: [
        {
          id: "msg_401",
          thread_id: "thr_whatsapp_04",
          sender: "customer",
          content: "Which downtown service hub is open past 6 PM today?",
          timestamp: isoAgo(48),
          tool_calls: [],
          extracted_facts: [],
        },
        {
          id: "msg_402",
          thread_id: "thr_whatsapp_04",
          sender: "ai",
          content:
            "The Downtown Financial District Hub (420 Market St) is open until 8:30 PM today with a current wait time of ~5 minutes.",
          timestamp: isoAgo(47),
          tool_calls: [
            { tool_name: "search_google_places", status: "200 OK", latency_ms: 178 },
          ],
          extracted_facts: [],
        },
      ],
    },
  ];

  const traces: ToolTraceSpan[] = [
    {
      id: "trc_901",
      request_id: "req_seed_901",
      thread_id: "thr_whatsapp_01",
      tool_name: "check_calendar_slots",
      status: "200 OK",
      latency_ms: 142,
      timestamp: isoAgo(14),
      input_payload: { date: "tomorrow", window: "afternoon", duration_min: 30 },
      output_payload: { available_slots: ["14:00", "15:30"], timezone: "UTC-5" },
    },
    {
      id: "trc_902",
      request_id: "req_seed_901",
      thread_id: "thr_whatsapp_01",
      tool_name: "dispatch_webhook",
      status: "200 OK",
      latency_ms: 58,
      timestamp: isoAgo(14),
      input_payload: { event: "memory.updated", thread_id: "thr_whatsapp_01" },
      output_payload: { delivered: true, http_status: 200 },
    },
    {
      id: "trc_903",
      request_id: "req_seed_902",
      thread_id: "thr_web_02",
      tool_name: "lookup_order",
      status: "200 OK",
      latency_ms: 114,
      timestamp: isoAgo(8),
      input_payload: { order_id: "ORD-88412" },
      output_payload: {
        order_id: "ORD-88412",
        status: "IN_TRANSIT",
        carrier: "DHL Express",
        eta: "Tomorrow 17:00",
      },
    },
    {
      id: "trc_904",
      request_id: "req_seed_903",
      thread_id: "thr_sms_03",
      tool_name: "create_ticket",
      status: "201 CREATED",
      latency_ms: 136,
      timestamp: isoAgo(19),
      input_payload: { priority: "P1", category: "billing_duplicate", amount: 490 },
      output_payload: { ticket_id: "TKT-4902", assigned_queue: "enterprise-billing" },
    },
    {
      id: "trc_905",
      request_id: "req_seed_904",
      thread_id: "thr_whatsapp_04",
      tool_name: "search_google_places",
      status: "200 OK",
      latency_ms: 178,
      timestamp: isoAgo(47),
      input_payload: { query: "downtown service hub", open_after: "18:00" },
      output_payload: {
        place: "Downtown Financial District Hub",
        address: "420 Market St",
        closes_at: "20:30",
      },
    },
  ];

  const webhooks: WebhookDeliveryLog[] = [
    {
      id: "wh_501",
      request_id: "req_seed_901",
      direction: "inbound",
      endpoint: "/api/v1/webhooks/whatsapp",
      event_type: "messages.received",
      status_code: 200,
      latency_ms: 34,
      timestamp: isoAgo(15),
      payload_preview: {
        from: "+14155550192",
        text: "Hi! I need to book a 30-minute onboarding consultation...",
      },
    },
    {
      id: "wh_502",
      request_id: "req_seed_901",
      direction: "outbound",
      endpoint: "https://crm.example.internal/hooks/memory-sync",
      event_type: "memory.updated",
      status_code: 200,
      latency_ms: 58,
      timestamp: isoAgo(14),
      payload_preview: { thread_id: "thr_whatsapp_01", facts_added: 1 },
    },
    {
      id: "wh_503",
      request_id: "req_seed_903",
      direction: "outbound",
      endpoint: "https://hooks.slack.example/escalations",
      event_type: "handoff.triggered",
      status_code: 200,
      latency_ms: 62,
      timestamp: isoAgo(19),
      payload_preview: { ticket_id: "TKT-4902", priority: "P1", customer: "Elena Rostova" },
    },
  ];

  const threads = new Map<string, ThreadRecord>();
  for (const t of seedThreads) {
    threads.set(t.id, t);
  }
  return { threads, traces, tools, webhooks };
}

export function getState(): RelayEngineState {
  if (!globalForRelay.__relayAgentState) {
    globalForRelay.__relayAgentState = createSeedState();
  }
  return globalForRelay.__relayAgentState;
}

function extractFacts(text: string, thread: ThreadRecord): MemoryFact[] {
  const candidates: Array<{ key: string; value: string; category: MemoryCategory }> = [];

  const nameMatch = text.match(
    /\b(?:my name is|i am|i'm|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i
  );
  if (nameMatch?.[1]) {
    const val = nameMatch[1].trim();
    const skip = new Set(["calling", "looking", "trying", "asking", "urgent", "interested"]);
    if (!skip.has(val.toLowerCase())) {
      const titled = val
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
      candidates.push({ key: "Name", value: titled, category: "identity" });
      thread.customer.name = titled;
    }
  }

  const timeMatch = text.match(
    /\b((?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)\s*(?:at\s*)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}(?::\d{2})?\s*(?:am|pm)|mornings?|afternoons?|evenings?)\b/i
  );
  if (timeMatch?.[1]) {
    const val = timeMatch[1].trim();
    candidates.push({ key: "Preferred Time", value: val, category: "preference" });
    thread.customer.preferred_time = val;
  }

  const langMatch = text.match(/\b(arabic|spanish|french|german|english|portuguese|japanese)\b/i);
  if (langMatch?.[1]) {
    const val = langMatch[1].charAt(0).toUpperCase() + langMatch[1].slice(1).toLowerCase();
    candidates.push({ key: "Language", value: val, category: "preference" });
    thread.customer.language = val;
  }

  const orderMatch = text.match(/(#?ORD-\d{4,8})/i);
  if (orderMatch?.[1]) {
    const raw = orderMatch[1].toUpperCase();
    const val = raw.startsWith("#") ? raw : `#${raw}`;
    candidates.push({ key: "Order ID", value: val, category: "order" });
  }

  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch?.[1]) {
    candidates.push({ key: "Email", value: emailMatch[1].toLowerCase(), category: "contact" });
  }

  const chanMatch = text.match(/\b(whatsapp|sms|email)\s+(?:reminders?|alerts?|updates?)\b/i);
  if (chanMatch?.[0]) {
    candidates.push({
      key: "Channel Preference",
      value: chanMatch[0].trim(),
      category: "preference",
    });
  }

  if (/\b(urgent|supervisor|human|manager|double[- ]charged|refund|escalat)/i.test(text)) {
    candidates.push({
      key: "Escalation Flag",
      value: "High Priority / Human Review",
      category: "escalation",
    });
  }

  const touched: MemoryFact[] = [];
  const now = new Date().toISOString();

  for (const c of candidates) {
    const existing = thread.memory_facts.find(
      (f) => f.key.toLowerCase() === c.key.toLowerCase()
    );
    if (existing) {
      existing.value = c.value;
      existing.category = c.category;
      existing.source = "extracted";
      existing.updated_at = now;
      touched.push(existing);
    } else {
      const fact: MemoryFact = {
        id: shortId("fact"),
        key: c.key,
        value: c.value,
        category: c.category,
        confidence: 0.95,
        source: "extracted",
        updated_at: now,
      };
      thread.memory_facts.push(fact);
      touched.push(fact);
    }
  }

  return touched;
}

function execTool(
  state: RelayEngineState,
  requestId: string,
  threadId: string,
  toolName: string,
  inputPayload: Record<string, unknown>,
  outputPayload: Record<string, unknown>,
  latencyMs: number,
  created = false
): ToolTraceSpan {
  const cfg = state.tools.get(toolName);
  const now = new Date().toISOString();

  if (cfg && !cfg.enabled) {
    const span: ToolTraceSpan = {
      id: shortId("trc"),
      request_id: requestId,
      thread_id: threadId,
      tool_name: toolName,
      status: "409 DISABLED",
      latency_ms: 4,
      timestamp: now,
      input_payload: inputPayload,
      output_payload: { error: `Tool '${toolName}' is disabled in registry` },
    };
    state.traces.unshift(span);
    return span;
  }

  if (cfg) {
    cfg.calls_count += 1;
  }

  const span: ToolTraceSpan = {
    id: shortId("trc"),
    request_id: requestId,
    thread_id: threadId,
    tool_name: toolName,
    status: created ? "201 CREATED" : "200 OK",
    latency_ms: latencyMs,
    timestamp: now,
    input_payload: inputPayload,
    output_payload: outputPayload,
  };
  state.traces.unshift(span);
  return span;
}

export function runSendMessage(
  threadId: string,
  content: string,
  sender: "customer" | "human_agent",
  requestId: string
) {
  const state = getState();
  const thread = state.threads.get(threadId);
  if (!thread) return null;

  const now = new Date().toISOString();
  const userMsg: MessageItem = {
    id: shortId("msg"),
    thread_id: thread.id,
    sender,
    content: content.trim(),
    timestamp: now,
    tool_calls: [],
    extracted_facts: [],
  };
  thread.messages.push(userMsg);
  thread.unread_count = 0;
  thread.updated_at = now;

  if (sender === "human_agent") {
    return {
      thread,
      user_message: userMsg,
      ai_message: null,
      extracted_facts: [] as MemoryFact[],
      traces: [] as ToolTraceSpan[],
    };
  }

  const extractedFacts = extractFacts(content, thread);

  if (thread.status === "human_handoff") {
    thread.unread_count += 1;
    return {
      thread,
      user_message: userMsg,
      ai_message: null,
      extracted_facts: extractedFacts,
      traces: [] as ToolTraceSpan[],
    };
  }

  const lower = content.toLowerCase();
  const spans: ToolTraceSpan[] = [];
  let reply = "";

  if (
    /urgent|supervisor|human|manager|double[- ]charged|refund|escalat/.test(lower)
  ) {
    thread.customer.intent = "Urgent Escalation";
    const ticketId = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;
    const s1 = execTool(
      state,
      requestId,
      thread.id,
      "create_ticket",
      { thread_id: thread.id, priority: "P1", reason: content.slice(0, 120) },
      { ticket_id: ticketId, queue: "tier-2-escalations", sla_minutes: 15 },
      138,
      true
    );
    const s2 = execTool(
      state,
      requestId,
      thread.id,
      "dispatch_webhook",
      { event: "handoff.triggered", ticket_id: ticketId, customer: thread.customer.name },
      { delivered: true, destination: "ops-escalation-webhook" },
      61
    );
    spans.push(s1, s2);
    state.webhooks.unshift({
      id: shortId("wh"),
      request_id: requestId,
      direction: "outbound",
      endpoint: "https://hooks.ops.example/escalations",
      event_type: "handoff.triggered",
      status_code: s2.status === "200 OK" ? 200 : 409,
      latency_ms: s2.latency_ms,
      timestamp: now,
      payload_preview: { ticket_id: ticketId, thread_id: thread.id, priority: "P1" },
    });
    thread.status = "human_handoff";
    reply =
      s1.status === "409 DISABLED"
        ? "I flagged your message as urgent and paused AI replies for Human Handoff (note: create_ticket is disabled in the MCP registry)."
        : `I've escalated this immediately under priority ticket ${ticketId} (P1) and paused AI auto-replies. A specialist has been notified and will take over right here.`;
  } else if (/order|ord-|track|shipping|delivery|package/.test(lower)) {
    thread.customer.intent = "Order Tracking";
    const m = content.match(/(ORD-\d{4,8})/i);
    const orderId = m ? m[1].toUpperCase() : "ORD-88412";
    const s1 = execTool(
      state,
      requestId,
      thread.id,
      "lookup_order",
      { order_id: orderId, customer: thread.customer.name },
      {
        order_id: orderId,
        status: "OUT_FOR_DELIVERY",
        carrier: "DHL Express",
        eta: "Tomorrow by 4:30 PM",
        last_scan: "Regional Distribution Hub",
      },
      116
    );
    spans.push(s1);
    reply =
      s1.status === "409 DISABLED"
        ? `I'd check #${orderId} right away, but lookup_order is currently disabled in the MCP tool registry.`
        : `Order #${orderId} is currently Out for Delivery via DHL Express (last scan: Regional Distribution Hub). Estimated arrival is Tomorrow by 4:30 PM.`;
  } else if (
    /book|appointment|reschedule|slot|calendar|thursday|friday|tomorrow|pm|am/.test(lower)
  ) {
    thread.customer.intent = "Appointment Booking";
    const slot = thread.customer.preferred_time || "Thursday 2:30 PM";
    const s1 = execTool(
      state,
      requestId,
      thread.id,
      "check_calendar_slots",
      { requested_window: slot, duration_min: 30, customer: thread.customer.name },
      { confirmed_slot: slot, calendar_event_id: shortId("cal"), available: true },
      149
    );
    const s2 = execTool(
      state,
      requestId,
      thread.id,
      "dispatch_webhook",
      { event: "booking.confirmed", slot, channel: thread.channel },
      { delivered: true, http_status: 200 },
      59
    );
    spans.push(s1, s2);
    state.webhooks.unshift({
      id: shortId("wh"),
      request_id: requestId,
      direction: "outbound",
      endpoint: "https://crm.example.internal/hooks/calendar-sync",
      event_type: "booking.confirmed",
      status_code: s2.status === "200 OK" ? 200 : 409,
      latency_ms: s2.latency_ms,
      timestamp: now,
      payload_preview: { customer: thread.customer.name, slot },
    });
    reply =
      s1.status === "409 DISABLED"
        ? `I saved your preferred time (${slot}) in memory, but check_calendar_slots is currently disabled in the tool registry.`
        : `Done, ${thread.customer.name.split(" ")[0]}! I verified availability, reserved ${slot} for your 30-minute session, and dispatched a booking webhook to our CRM.`;
  } else if (/nearest|location|branch|address|open|center|places|hours/.test(lower)) {
    thread.customer.intent = "Service Center Location";
    const s1 = execTool(
      state,
      requestId,
      thread.id,
      "search_google_places",
      { query: content.slice(0, 80), open_now: true },
      {
        name: "Downtown Financial District Hub",
        address: "420 Market St, Suite 120",
        distance_km: 1.4,
        open_until: "20:30",
        wait_minutes: 5,
      },
      172
    );
    spans.push(s1);
    reply =
      s1.status === "409 DISABLED"
        ? "search_google_places is currently disabled in the MCP registry. Re-enable it to query live branch hours."
        : "The nearest open location is Downtown Financial District Hub (420 Market St, 1.4 km away). It's open until 8:30 PM today with a ~5 minute wait.";
  } else {
    const s1 = execTool(
      state,
      requestId,
      thread.id,
      "dispatch_webhook",
      { event: "memory.synced", thread_id: thread.id, facts_count: thread.memory_facts.length },
      { delivered: true, synced_facts: thread.memory_facts.length },
      54
    );
    spans.push(s1);
    const factNote =
      extractedFacts.length > 0
        ? ` I also saved ${extractedFacts.map((f) => `${f.key}: ${f.value}`).join(", ")} to your persistent profile.`
        : "";
    reply = `Got it, ${thread.customer.name.split(" ")[0]}!${factNote} I can check an order (#ORD-88412), book or reschedule an appointment, locate a nearby branch, or escalate to a human specialist.`;
  }

  const aiMsg: MessageItem = {
    id: shortId("msg"),
    thread_id: thread.id,
    sender: "ai",
    content: reply,
    timestamp: new Date().toISOString(),
    tool_calls: spans.map((s) => ({
      tool_name: s.tool_name,
      status: s.status,
      latency_ms: s.latency_ms,
    })),
    extracted_facts: extractedFacts.map((f) => `${f.key}: ${f.value}`),
  };
  thread.messages.push(aiMsg);
  thread.updated_at = aiMsg.timestamp;

  return {
    thread,
    user_message: userMsg,
    ai_message: aiMsg,
    extracted_facts: extractedFacts,
    traces: spans,
  };
}

export function runToggleHandoff(threadId: string, mode?: ThreadStatus) {
  const state = getState();
  const thread = state.threads.get(threadId);
  if (!thread) return null;

  thread.status =
    mode ?? (thread.status === "human_handoff" ? "ai_active" : "human_handoff");

  const note =
    thread.status === "human_handoff"
      ? "Operator paused AI automation and took over the conversation."
      : thread.status === "ai_active"
      ? "AI agent resumed autonomous handling for this thread."
      : "Thread marked as resolved.";

  const now = new Date().toISOString();
  thread.messages.push({
    id: shortId("msg"),
    thread_id: thread.id,
    sender: "system",
    content: note,
    timestamp: now,
    tool_calls: [],
    extracted_facts: [],
  });
  thread.updated_at = now;
  return { thread, status: thread.status };
}

export function runUpsertMemory(
  threadId: string,
  key: string,
  value: string,
  category: MemoryCategory
) {
  const state = getState();
  const thread = state.threads.get(threadId);
  if (!thread) return null;

  const now = new Date().toISOString();
  const cleanKey = key.trim();
  const cleanVal = value.trim();
  let fact = thread.memory_facts.find(
    (f) => f.key.toLowerCase() === cleanKey.toLowerCase()
  );
  if (fact) {
    fact.value = cleanVal;
    fact.category = category;
    fact.source = "manual";
    fact.updated_at = now;
  } else {
    fact = {
      id: shortId("fact"),
      key: cleanKey,
      value: cleanVal,
      category,
      confidence: 1.0,
      source: "manual",
      updated_at: now,
    };
    thread.memory_facts.push(fact);
  }

  const kl = cleanKey.toLowerCase();
  if (kl === "name") thread.customer.name = cleanVal;
  if (kl === "preferred time") thread.customer.preferred_time = cleanVal;
  if (kl === "language") thread.customer.language = cleanVal;
  if (kl === "intent") thread.customer.intent = cleanVal;

  thread.updated_at = now;
  return { fact, memory_facts: thread.memory_facts };
}

export function runDeleteMemory(threadId: string, factId: string) {
  const state = getState();
  const thread = state.threads.get(threadId);
  if (!thread) return null;

  const before = thread.memory_facts.length;
  thread.memory_facts = thread.memory_facts.filter((f) => f.id !== factId);
  if (thread.memory_facts.length === before) return null;
  thread.updated_at = new Date().toISOString();
  return { deleted_fact_id: factId, memory_facts: thread.memory_facts };
}

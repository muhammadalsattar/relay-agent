import { NextRequest } from "next/server";
import { getState, runSendMessage } from "@/lib/engine";
import { envelope, makeRequestId, proxyToFastAPI } from "@/lib/proxy";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    thread_id?: string;
    from_number?: string;
    sender_name?: string;
    message_text?: string;
  };

  const proxied = await proxyToFastAPI("/api/v1/webhooks/whatsapp", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (proxied) return proxied;

  const reqId = makeRequestId();
  const threadId = body.thread_id || "thr_whatsapp_01";
  const text =
    body.message_text?.trim() ||
    "Hi! Please confirm my WhatsApp appointment for Friday at 3:00 PM.";

  const result = runSendMessage(threadId, text, "customer", reqId);
  if (!result) {
    return envelope({ error: `Thread '${threadId}' not found` }, reqId, 404);
  }

  const state = getState();
  const log = {
    id: `wh_${Math.random().toString(36).slice(2, 10)}`,
    request_id: reqId,
    direction: "inbound" as const,
    endpoint: "/api/v1/webhooks/whatsapp",
    event_type: "messages.received",
    status_code: 200,
    latency_ms: 28,
    timestamp: new Date().toISOString(),
    payload_preview: {
      object: "whatsapp_business_account",
      from: body.from_number || "+14155550192",
      sender_name: body.sender_name || result.thread.customer.name,
      text: text.slice(0, 100),
    },
  };
  state.webhooks.unshift(log);

  return envelope(
    {
      verified: true,
      webhook_log: log,
      thread: result.thread,
      ai_message: result.ai_message,
      extracted_facts: result.extracted_facts,
      traces: result.traces,
    },
    reqId
  );
}

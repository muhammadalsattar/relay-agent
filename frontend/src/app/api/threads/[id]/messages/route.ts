import { NextRequest } from "next/server";
import { runSendMessage } from "@/lib/engine";
import { envelope, makeRequestId, proxyToFastAPI } from "@/lib/proxy";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    content?: string;
    sender?: "customer" | "human_agent";
  };

  const proxied = await proxyToFastAPI(`/api/v1/threads/${id}/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (proxied) return proxied;

  const content = body.content?.trim();
  if (!content) {
    return envelope({ error: "Message content is required" }, makeRequestId(), 400);
  }

  const reqId = request.headers.get("X-Request-ID") ?? makeRequestId();
  const result = runSendMessage(id, content, body.sender ?? "customer", reqId);
  if (!result) {
    return envelope({ error: `Thread '${id}' not found` }, reqId, 404);
  }

  return envelope(result, reqId);
}

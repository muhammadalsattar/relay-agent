import { NextRequest } from "next/server";
import { runToggleHandoff } from "@/lib/engine";
import { envelope, makeRequestId, proxyToFastAPI } from "@/lib/proxy";
import { ThreadStatus } from "@/lib/types";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    mode?: ThreadStatus;
  };

  const proxied = await proxyToFastAPI(`/api/v1/threads/${id}/handoff`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (proxied) return proxied;

  const reqId = makeRequestId();
  const result = runToggleHandoff(id, body.mode);
  if (!result) {
    return envelope({ error: `Thread '${id}' not found` }, reqId, 404);
  }

  return envelope(result, reqId);
}

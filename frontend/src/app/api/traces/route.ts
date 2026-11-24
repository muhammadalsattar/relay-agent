import { NextRequest } from "next/server";
import { getState } from "@/lib/engine";
import { envelope, proxyToFastAPI } from "@/lib/proxy";

export async function GET(request: NextRequest) {
  const threadId = request.nextUrl.searchParams.get("thread_id");
  const query = threadId ? `?thread_id=${encodeURIComponent(threadId)}` : "";
  const proxied = await proxyToFastAPI(`/api/v1/traces${query}`);
  if (proxied) return proxied;

  const state = getState();
  const traces = threadId
    ? state.traces.filter((t) => t.thread_id === threadId)
    : state.traces;
  return envelope({ traces: traces.slice(0, 60) });
}

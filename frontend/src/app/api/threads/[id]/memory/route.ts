import { NextRequest } from "next/server";
import { getState, runUpsertMemory } from "@/lib/engine";
import { envelope, makeRequestId, proxyToFastAPI } from "@/lib/proxy";
import { MemoryCategory } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const proxied = await proxyToFastAPI(`/api/v1/threads/${id}/memory`);
  if (proxied) return proxied;

  const thread = getState().threads.get(id);
  if (!thread) {
    return envelope({ error: `Thread '${id}' not found` }, makeRequestId(), 404);
  }
  return envelope({
    thread_id: thread.id,
    customer: thread.customer,
    memory_facts: thread.memory_facts,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    key?: string;
    value?: string;
    category?: MemoryCategory;
  };

  const proxied = await proxyToFastAPI(`/api/v1/threads/${id}/memory`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (proxied) return proxied;

  if (!body.key?.trim() || !body.value?.trim()) {
    return envelope({ error: "Both key and value are required" }, makeRequestId(), 400);
  }

  const res = runUpsertMemory(id, body.key, body.value, body.category ?? "preference");
  if (!res) {
    return envelope({ error: `Thread '${id}' not found` }, makeRequestId(), 404);
  }
  return envelope(res);
}

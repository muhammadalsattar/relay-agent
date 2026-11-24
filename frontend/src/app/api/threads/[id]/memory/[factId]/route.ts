import { NextRequest } from "next/server";
import { runDeleteMemory } from "@/lib/engine";
import { envelope, makeRequestId, proxyToFastAPI } from "@/lib/proxy";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; factId: string }> }
) {
  const { id, factId } = await context.params;
  const proxied = await proxyToFastAPI(`/api/v1/threads/${id}/memory/${factId}`, {
    method: "DELETE",
  });
  if (proxied) return proxied;

  const res = runDeleteMemory(id, factId);
  if (!res) {
    return envelope(
      { error: `Memory fact '${factId}' not found` },
      makeRequestId(),
      404
    );
  }
  return envelope(res);
}

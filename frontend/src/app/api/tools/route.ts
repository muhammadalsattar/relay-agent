import { NextRequest } from "next/server";
import { getState } from "@/lib/engine";
import { envelope, makeRequestId, proxyToFastAPI } from "@/lib/proxy";

export async function GET() {
  const proxied = await proxyToFastAPI("/api/v1/tools");
  if (proxied) return proxied;

  const state = getState();
  return envelope({
    tools: Array.from(state.tools.values()),
    webhooks: state.webhooks.slice(0, 40),
  });
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as { tool_name?: string; enabled?: boolean };
  if (!body.tool_name || typeof body.enabled !== "boolean") {
    return envelope(
      { error: "tool_name and boolean enabled are required" },
      makeRequestId(),
      400
    );
  }

  const proxied = await proxyToFastAPI(`/api/v1/tools/${body.tool_name}`, {
    method: "PATCH",
    body: JSON.stringify({ enabled: body.enabled }),
  });
  if (proxied) return proxied;

  const state = getState();
  const tool = state.tools.get(body.tool_name);
  if (!tool) {
    return envelope({ error: `Tool '${body.tool_name}' not found` }, makeRequestId(), 404);
  }
  tool.enabled = body.enabled;
  return envelope({ tool });
}

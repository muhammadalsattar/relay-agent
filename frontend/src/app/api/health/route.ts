import { getState } from "@/lib/engine";
import { envelope, proxyToFastAPI } from "@/lib/proxy";

export async function GET() {
  const proxied = await proxyToFastAPI("/health");
  if (proxied) return proxied;

  const state = getState();
  return envelope({
    status: "ok",
    service: "relay-agent-edge",
    threads_count: state.threads.size,
    traces_count: state.traces.length,
    llm_mode: "in-app-deterministic",
  });
}

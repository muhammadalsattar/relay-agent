import { getState } from "@/lib/engine";
import { envelope, proxyToFastAPI } from "@/lib/proxy";

export async function GET() {
  const proxied = await proxyToFastAPI("/api/v1/threads");
  if (proxied) return proxied;

  const state = getState();
  const threads = Array.from(state.threads.values()).sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at)
  );
  return envelope({ threads });
}

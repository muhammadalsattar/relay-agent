import { NextResponse } from "next/server";

export function makeRequestId(): string {
  return `req_${Math.random().toString(36).slice(2, 12)}`;
}

export function envelope<T>(data: T, requestId = makeRequestId(), status = 200) {
  return NextResponse.json(
    {
      request_id: requestId,
      timestamp: new Date().toISOString(),
      data,
    },
    {
      status,
      headers: {
        "X-Request-ID": requestId,
      },
    }
  );
}

export async function proxyToFastAPI(
  path: string,
  init?: RequestInit
): Promise<NextResponse | null> {
  const baseUrl = process.env.FASTAPI_URL?.trim();
  if (!baseUrl) return null;

  const url = `${baseUrl.replace(/\/+$/, "")}${path}`;
  try {
    const upstream = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    const payload = await upstream.json();
    const reqId = upstream.headers.get("X-Request-ID") ?? makeRequestId();
    return NextResponse.json(payload, {
      status: upstream.status,
      headers: { "X-Request-ID": reqId },
    });
  } catch {
    return null;
  }
}

import { acceptTinyFishWebhook } from "../../../deploy-ops.server";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store, private",
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const localRunId = url.searchParams.get("localRunId") ?? "";
  const nonce = url.searchParams.get("nonce") ?? "";
  const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
  try {
    const probe = await acceptTinyFishWebhook(localRunId, nonce, payload);
    return json({ ok: true, verified: true, status: probe.status, ready: probe.ready });
  } catch {
    // Do not reveal whether a run or nonce exists. TinyFish treats 4xx as final;
    // invalid callbacks should not be retried.
    return json({ ok: false, error: "invalid_webhook" }, 400);
  }
}

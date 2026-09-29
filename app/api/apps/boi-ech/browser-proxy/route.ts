import { resolveClientOrigin } from "../../../../client-origin.server";

export const dynamic = "force-dynamic";

const JSON_PATHS = new Set(["/api/control/overview", "/api/control/content", "/api/control/ai"]);
const QUERY_KEYS = new Set(["activityDays", "deviceCodes", "deviceCode", "versionId", "deviceId"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "cache-control": "no-store, private" } });
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) return error("Yêu cầu không hợp lệ.", 415);
  if (Number(request.headers.get("content-length")) > 100_000) return error("Yêu cầu quá lớn.", 413);
  try {
    const input = await request.json() as Record<string, unknown>;
    const baseUrl = input.baseUrl;
    const token = input.token;
    const path = input.path;
    const query = input.query ?? "";
    const method = input.method ?? "GET";
    if (typeof baseUrl !== "string" || typeof token !== "string" || !/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) || token.length > 4096
      || typeof path !== "string" || !JSON_PATHS.has(path) && path !== "/api/control/payment-proof"
      || typeof query !== "string" || query.length > 1000 || typeof method !== "string" || !["GET", "POST"].includes(method)) {
      return error("Yêu cầu bridge không hợp lệ.", 400);
    }
    const origin = await resolveClientOrigin("boi-ech");
    if (origin.baseUrl !== baseUrl) return error("Origin Bơi ếch không khớp cấu hình.", 400);
    const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
    if ((query && !query.startsWith("?")) || [...params.keys()].some((key) => !QUERY_KEYS.has(key))) return error("Tham số bridge không hợp lệ.", 400);
    const image = path === "/api/control/payment-proof";
    if (image && (method !== "GET" || !/^[a-f0-9]{64}$/.test(params.get("deviceId") ?? ""))) return error("Chứng từ không hợp lệ.", 400);
    if (method === "POST" && (image || !input.body || typeof input.body !== "object" || Array.isArray(input.body))) return error("Lệnh bridge không hợp lệ.", 400);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const upstream = await fetch(`${baseUrl}${path}${query}`, {
        method,
        headers: { authorization: `Bearer ${token}`, ...(method === "POST" ? { "content-type": "application/json" } : {}) },
        body: method === "POST" ? JSON.stringify(input.body) : undefined,
        cache: "no-store",
        signal: controller.signal,
      });
      if (image && upstream.ok) {
        const type = (upstream.headers.get("content-type") ?? "").split(";", 1)[0].toLowerCase();
        const bytes = await upstream.arrayBuffer();
        if (!["image/jpeg", "image/png", "image/webp"].includes(type) || bytes.byteLength > MAX_IMAGE_BYTES) return error("Chứng từ không đúng định dạng hoặc vượt 8 MB.", 502);
        return new Response(bytes, { headers: { "content-type": type, "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
      }
      const data = await upstream.text();
      if (data.length > 2_000_000) return error("Phản hồi Bơi ếch quá lớn.", 502);
      return new Response(data, { status: upstream.status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
    } finally {
      clearTimeout(timeout);
    }
  } catch (caught) {
    return error(caught instanceof Error && caught.name === "AbortError" ? "Bơi ếch không phản hồi trong 12 giây." : "Không kết nối được bridge Bơi ếch.", 502);
  }
}

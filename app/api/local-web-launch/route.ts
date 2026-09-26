import { getChatGPTUser } from "../../chatgpt-auth";
import { resolveClientOrigin } from "../../client-origin.server";

export const dynamic = "force-dynamic";

const LOCAL_TARGETS = {
  "boi-ech": { label: "Bơi ếch", url: "http://127.0.0.1:3004/" },
  "health-care": { label: "Sức khỏe Y tế", url: "http://127.0.0.1:3001/suc-khoe-tre" },
  "ru-life": { label: "Hòa nhập Nga", url: "http://127.0.0.1:3002/" },
  "bauman-master-ai": { label: "Bauman Runtime", url: "http://127.0.0.1:3005/" },
  "nc03-modem": { label: "NC03 Control Center", url: null },
} as const;

type LocalAppId = keyof typeof LOCAL_TARGETS;

function isLoopback(hostname: string) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
}

function text(message: string, status: number) {
  return new Response(message, {
    status,
    headers: {
      "cache-control": "no-store, private",
      "content-type": "text/plain; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  if (!isLoopback(requestUrl.hostname)) {
    return text("Local Web Launcher chỉ hoạt động trên localhost/127.0.0.1.", 403);
  }

  const user = await getChatGPTUser();
  if (!user) return text("Phiên quản trị local chưa được xác thực.", 401);

  const appId = requestUrl.searchParams.get("app") as LocalAppId | null;
  if (!appId || !(appId in LOCAL_TARGETS)) return text("Ứng dụng local không hợp lệ.", 400);

  // RUN_LOCAL.bat already verifies every client runtime before starting the
  // Application Management server. Do not probe a loopback client again from
  // the Cloudflare/Vite worker here: that execution context can report a false
  // negative for host loopback even when the browser can reach the runtime.
  // Redirect the authenticated local browser to the verified runtime instead.
  const target = LOCAL_TARGETS[appId];
  if (appId === "nc03-modem") {
    try {
      const resolved = await resolveClientOrigin("nc03-runtime");
      return Response.redirect(`${resolved.baseUrl}/`, 307);
    } catch {
      return text("NC03 local runtime chưa sẵn sàng hoặc chưa được resolve đúng origin.", 503);
    }
  }
  return Response.redirect(target.url, 307);
}

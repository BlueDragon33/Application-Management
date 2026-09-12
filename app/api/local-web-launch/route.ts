import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

const LOCAL_TARGETS = {
  "boi-ech": { label: "Bơi ếch", url: "http://127.0.0.1:3004/" },
  "health-care": { label: "Sức khỏe Y tế", url: "http://127.0.0.1:3001/suc-khoe-tre" },
  "ru-life": { label: "Hòa nhập Nga", url: "http://127.0.0.1:3002/" },
  "bauman-master-ai": { label: "Bauman Runtime", url: "http://127.0.0.1:3005/" },
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

async function targetReady(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2_500);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
      headers: { "user-agent": "Application-Management-Local-Launcher/1.0" },
    });
    return response.status >= 200 && response.status < 400;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
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

  const target = LOCAL_TARGETS[appId];
  if (!(await targetReady(target.url))) {
    return text(`${target.label} chưa sẵn sàng tại ${target.url}. Hãy kiểm tra cửa sổ RUN_LOCAL.bat.`, 503);
  }

  return Response.redirect(target.url, 307);
}

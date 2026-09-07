/** Cloudflare Worker entry point for Learning Management. */
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  BOI_ECH_BASE_URL?: string;
  CONTROL_SERVICE_SECRET?: string;
  CONTROL_OWNER_EMAILS?: string;
  SITE_SURFACE?: string;
  MEDICINE_SERVICE_SECRET?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (env.SITE_SURFACE === "integration-russia") {
      const url = new URL(request.url);
      const serviceControlRequest = request.method === "POST"
        && url.pathname === "/api/medicine/control"
        && typeof env.MEDICINE_SERVICE_SECRET === "string"
        && env.MEDICINE_SERVICE_SECRET.length >= 32
        && request.headers.get("x-medicine-service-secret") === env.MEDICINE_SERVICE_SECRET;
      const publicPath = url.pathname === "/" || url.pathname === "/ru-medcheck" || url.pathname.startsWith("/ru-medcheck/")
        || url.pathname === "/api/medicine/rules" || url.pathname === "/api/medicine/reviews" || url.pathname.startsWith("/api/medicine/reviews/")
        || url.pathname === "/api/auth/bridge"
        || serviceControlRequest || url.pathname.startsWith("/_next/") || url.pathname.startsWith("/assets/")
        || ["/sw.js", "/offline.html", "/ru-medcheck.webmanifest", "/favicon.svg", "/icon-192.png", "/icon-512.png"].includes(url.pathname);
      if (!publicPath) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
      if (request.method === "GET" && url.pathname === "/") {
        url.pathname = "/ru-medcheck";
        return handler.fetch(new Request(url, request), env, ctx);
      }
    }
    return handler.fetch(request, env, ctx);
  },
};

export default worker;

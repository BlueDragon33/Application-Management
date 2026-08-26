/** Cloudflare Worker entry point for Learning Management. */
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  BOI_ECH_BASE_URL?: string;
  CONTROL_SERVICE_SECRET?: string;
  CONTROL_OWNER_EMAILS?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handler.fetch(request, env, ctx);
  },
};

export default worker;

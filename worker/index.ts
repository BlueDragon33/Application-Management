/** Cloudflare Worker entry point for Application Management. */
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  BOI_ECH_BASE_URL?: string;
  CONTROL_SERVICE_SECRET?: string;
  CONTROL_OWNER_EMAILS?: string;
  HEALTH_CARE_BASE_URL?: string;
  HEALTH_CONTROL_SERVICE_SECRET?: string;
  RU_LIFE_BASE_URL?: string;
  RU_LIFE_CONTROL_SERVICE_SECRET?: string;
  BAUMAN_CONTROL_BASE_URL?: string;
  BAUMAN_CONTROL_SERVICE_SECRET?: string;
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

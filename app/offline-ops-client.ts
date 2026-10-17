"use client";

import manifest from "../control/local-ops-apps.json";

export type OperatingMode = "offline" | "online";
export type LocalOpsAppStatus = { id: string; port: number | null; url: string | null; ready: boolean; note: string | null; sourceSha?: string | null; phase?: string; pid?: number | null; error?: string | null; evidence?: string | null };
export type PullResult = { name: string; state: "current" | "updated" | "skipped" | "error"; reason?: string; sha?: string; from?: string; restartRequired?: boolean };
export type LocalOpsStatus = {
  ok: boolean;
  workspace: string;
  agent: string;
  busy: string;
  runtime: string;
  centerRuntime?: string;
  centerPid?: number | null;
  centerError?: string | null;
  webAll?: {status:string; startedAt:string; finishedAt?:string; error?:string; results:{id:string;status:string;port?:number;reason?:string}[]} | null;
  runtimePid: number | null;
  runtimeStartedAt: string | null;
  restartRequired: boolean;
  sourceVerified: boolean;
  sourceSnapshot: Record<string, string> | null;
  runtimeEvidence: string | null;
  restartControl: { status: string; reason?: string; missingUnits?: string[]; finishedAt?: string } | null;
  error: string | null;
  pull: { status: string; startedAt: string; finishedAt?: string; results: PullResult[]; error?: string } | null;
  apps: LocalOpsAppStatus[];
};
const BASE = "http://127.0.0.1:" + manifest.agentPort;
let token: string | null = null;
let sessionPending: Promise<string> | null = null;

export function localApp(id: string) {
  return manifest.apps.find((app) => app.id === id) ?? null;
}
export function hasOfflineWeb(id: string) {
  return Boolean(localApp(id)?.port);
}
export function publishedUrl(url?: string) {
  if (!url) return "";
  try { const value = new URL(url); return value.protocol === "https:" ? value.href : ""; }
  catch { return ""; }
}
async function session(): Promise<string> {
  if (token) return token;
  if (!sessionPending) sessionPending = (async () => {
    const response = await fetch(BASE + "/session", { cache: "no-store" });
    if (!response.ok) throw new Error("Local Ops chưa hoạt động. Khởi động bằng START_BAUMANWEB.vbs trên Windows.");
    const payload = await response.json() as { token?: string };
    if (!payload.token) throw new Error("Local Ops không trả phiên hợp lệ.");
    token = payload.token;
    return token;
  })().finally(() => { sessionPending = null; });
  return sessionPending;
}
async function call<T>(path: string, method: "GET" | "POST" = "GET"): Promise<T> {
  const secret = await session();
  const response = await fetch(BASE + path, {
    method,
    cache: "no-store",
    headers: { authorization: "Bearer " + secret, ...(method === "POST" ? { "content-type": "application/json" } : {}) },
  });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (response.status === 401) token = null;
  if (!response.ok) throw new Error(data.error || "Local Ops HTTP " + response.status);
  return data;
}
export function localOpsStatus() { return call<LocalOpsStatus>("/status"); }
export function localOpsStart() { return call<{ok: boolean; runtime: string}>("/start", "POST"); }
export function localOpsStartWebAll() { return call<{ok:boolean; state:string; mode:string}>("/start-web-all", "POST"); }
export function localOpsStartApp(id:string) {
  if(!localApp(id)?.port)throw Error("OFFLINE_APP_NOT_REGISTERED");
  return call<{ok:boolean; id:string; state:string}>("/start-app/"+encodeURIComponent(id),"POST");
}
export function localOpsPullAll() { return call<{ok: boolean; message: string}>("/pull-all", "POST"); }
export function localOpsRestart() { return call<{ok: boolean; message: string}>("/restart", "POST"); }
export function localOpsAutoRestart() { return call<{ok: boolean; message: string}>("/restart-auto", "POST"); }

export async function launchOffline(appId: string): Promise<string> {
  const target = localApp(appId);
  if (!target?.port) throw new Error(target?.note || "Ứng dụng chưa có runtime localhost được xác minh.");
  let current = await localOpsStatus();
  if (current.restartRequired) throw new Error("RUNTIME_STALE_RESTART_REQUIRED: Dừng stack cũ an toàn trước khi khởi động lại BaumanWeb.");
  if (current.apps.some((app) => app.id === appId && app.ready)) return current.apps.find((app) => app.id === appId)!.url!;
  // If Run All is warming apps, join that operation instead of POSTing a competing
  // /start-app and receiving LOCAL_OPERATION_BUSY. An existing single-app boot
  // similarly joins the same launch; otherwise request this app when idle.
  let requested = current.busy === "start-web-all" || current.busy === "start-app:" + appId
    || current.webAll?.status === "running";
  if (!requested && !current.busy) {
    await localOpsStartApp(appId);
    requested = true;
  }
  // Fail closed: no online fallback, only a verified live localhost port.
  for (let count = 0; count < 75; count += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    current = await localOpsStatus();
    if (current.restartRequired) throw new Error("RUNTIME_STALE_RESTART_REQUIRED: Cần khởi động lại BaumanWeb.");
    const ready = current.apps.find((app) => app.id === appId);
    if (ready?.ready && ready.url) return ready.url;
    if (ready?.error) throw new Error(ready.error);
    if (ready?.phase === "blocked") throw new Error("WEB_FRONTEND_BLOCKED: " + appId);
    const all = current.webAll;
    if (all?.status === "finished" && all.results.find((item) => item.id === appId)?.status === "blocked") {
      throw new Error(all.results.find((item) => item.id === appId)?.reason || "WEB_ALL_APP_BLOCKED");
    }
    if (!requested && !current.busy) {
      await localOpsStartApp(appId);
      requested = true;
    }
  }
  throw new Error("Runtime offline chưa sẵn sàng. Kiểm tra trạng thái và .local-ops-web-" + appId + ".log trong Application-Management.");
}

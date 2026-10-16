"use client";

import manifest from "../control/local-ops-apps.json";

export type OperatingMode = "offline" | "online";
export type LocalOpsAppStatus = { id: string; port: number | null; url: string | null; ready: boolean; note: string | null };
export type PullResult = { name: string; state: "current" | "updated" | "skipped" | "error"; reason?: string; sha?: string; from?: string; restartRequired?: boolean };
export type LocalOpsStatus = {
  ok: boolean;
  workspace: string;
  agent: string;
  busy: string;
  runtime: string;
  runtimePid: number | null;
  runtimeStartedAt: string | null;
  restartRequired: boolean;
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
export function localOpsPullAll() { return call<{ok: boolean; message: string}>("/pull-all", "POST"); }

export async function launchOffline(appId: string): Promise<string> {
  const target = localApp(appId);
  if (!target?.port) throw new Error(target?.note || "Ứng dụng chưa có runtime localhost được xác minh.");
  let current = await localOpsStatus();
  if (current.restartRequired) throw new Error("RUNTIME_STALE_RESTART_REQUIRED: Dừng và khởi động lại BaumanWeb để dùng mã mới.");
  if (current.apps.some((app) => app.id === appId && app.ready)) return current.apps.find((app) => app.id === appId)!.url!;
  await localOpsStart();
  // No online fallback: wait for the actual port to respond, not merely for a child PID.
  for (let count = 0; count < 90; count += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    current = await localOpsStatus();
    if (current.restartRequired) throw new Error("RUNTIME_STALE_RESTART_REQUIRED: Cần khởi động lại BaumanWeb.");
    const ready = current.apps.find((app) => app.id === appId);
    if (ready?.ready && ready.url) return ready.url;
    if (current.runtime === "error") throw new Error(current.error || "Không thể khởi động runtime offline.");
  }
  throw new Error("Runtime offline chưa sẵn sàng. Xem .local-ops-runtime.log trong Application-Management.");
}

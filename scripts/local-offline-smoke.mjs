import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const launcherPath = join(root, "scripts", "run-all.mjs");
const forwarded = process.argv.slice(2).filter((arg) => arg !== "--local" && arg !== "--no-browser");
const centralOrigin = "http://127.0.0.1:3000";

if (forwarded.some((arg) => arg === "--hybrid" || arg === "--mode=hybrid")) {
  throw new Error("local:offline-smoke chỉ chạy chế độ local; không cho phép hybrid/remote fallback.");
}

const checks = [
  ["Sức khỏe Y tế", "http://127.0.0.1:3001/api/control/contract"],
  ["Hòa nhập Nga", "http://127.0.0.1:3002/api/control/status"],
  ["Bauman Control", "http://127.0.0.1:3003/health"],
  ["Bơi ếch", "http://127.0.0.1:3004/api/control/runtime"],
  ["Bauman Runtime", "http://127.0.0.1:3005/_local/health"],
  ["GrowUP Runtime", "http://127.0.0.1:3006/control/application-management.contract.json"],
  ["GrowUP Control", "http://127.0.0.1:3007/health"],
  ["PriceReport Runtime", "http://127.0.0.1:3008/management-contract.json"],
  ["PriceReport Control", "http://127.0.0.1:3009/health"],
  ["Application Management", `${centralOrigin}/`],
];

const expectedManagedApps = [
  "boi-ech",
  "health-care",
  "ru-life",
  "bauman-master-ai",
  "growup-mychildren",
  "price-report-tunggiabao",
];

const forbiddenRenderedLabels = [
  "Quản trị Ứng dụng Ver2",
  "Kiểm soát Ver2",
  "v2.0",
  "device control v4",
  "Bauman Control v4",
  "Device Gate v4",
];

function wait(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function requestReady(name, url, cancelSignal, timeoutMs = 240_000) {
  const deadline = Date.now() + timeoutMs;
  let last = "chưa kết nối";
  while (Date.now() < deadline) {
    if (cancelSignal.aborted) throw new Error(`${name} smoke đã hủy vì local system dừng.`);
    try {
      const response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.any([cancelSignal, AbortSignal.timeout(1_200)]),
      });
      last = `HTTP ${response.status}`;
      if (response.status < 500) return response;
    } catch (error) {
      if (cancelSignal.aborted) throw new Error(`${name} smoke đã hủy vì local system dừng.`);
      last = error instanceof Error ? error.message : String(error);
    }
    await wait(600);
  }
  throw new Error(`${name} không sẵn sàng: ${last}`);
}

async function requestJson(path, body, cancelSignal, timeoutMs = 20_000) {
  const response = await fetch(`${centralOrigin}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.any([cancelSignal, AbortSignal.timeout(timeoutMs)]),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload && typeof payload === "object" && typeof payload.error === "string" ? payload.error : `HTTP ${response.status}`;
    throw new Error(`${path} thất bại: ${detail}`);
  }
  return payload;
}

async function signedControlBody(deviceId, keyPair, body, cancelSignal) {
  const challengePayload = await requestJson("/api/device", { action: "challenge", deviceId }, cancelSignal);
  const challenge = challengePayload?.challenge;
  if (typeof challenge !== "string" || !/^[A-Za-z0-9_-]{40,100}$/.test(challenge)) {
    throw new Error("Challenge quản trị local không hợp lệ.");
  }
  const message = new TextEncoder().encode(`learning-control:${deviceId}:${challenge}`);
  const signed = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keyPair.privateKey, message);
  return {
    ...body,
    deviceId,
    challenge,
    signature: Buffer.from(signed).toString("base64url"),
  };
}

async function assertCentralUi(cancelSignal) {
  const response = await fetch(`${centralOrigin}/`, {
    redirect: "manual",
    signal: AbortSignal.any([cancelSignal, AbortSignal.timeout(2_000)]),
  });
  if (response.status !== 200) throw new Error(`Application Management local phải trả HTTP 200, nhận ${response.status}.`);
  const html = await response.text();
  if (!html.includes("Quản trị Ứng dụng")) {
    throw new Error("Trang local đã chạy nhưng không render tiêu đề Quản trị Ứng dụng.");
  }
  for (const label of forbiddenRenderedLabels) {
    if (html.includes(label)) {
      throw new Error(`Trang local không được render nhãn phiên bản/phát hành ${JSON.stringify(label)}.`);
    }
  }
}

async function assertAuthenticatedOperations(cancelSignal) {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const registered = await requestJson("/api/device", { action: "register", publicKey }, cancelSignal);
  const device = registered?.device;
  if (!device || typeof device.deviceId !== "string" || !/^[a-f0-9]{64}$/.test(device.deviceId)) {
    throw new Error("Thiết bị smoke local không được đăng ký với deviceId hợp lệ.");
  }
  if (device.status !== "approved" || device.role !== "owner") {
    throw new Error(`Thiết bị smoke local phải là Owner approved, nhận ${device.status ?? "unknown"}/${device.role ?? "unknown"}.`);
  }

  const bootstrap = await requestJson(
    "/api/operations",
    await signedControlBody(device.deviceId, keyPair, { action: "bootstrap" }, cancelSignal),
    cancelSignal,
    35_000,
  );

  if (!Array.isArray(bootstrap?.summaries)) throw new Error("Operations bootstrap không trả danh sách ứng dụng.");
  const summaryById = new Map(bootstrap.summaries.map((item) => [item?.appId, item]));
  const failed = [];
  for (const appId of expectedManagedApps) {
    const summary = summaryById.get(appId);
    if (!summary || summary.connection !== "connected") {
      failed.push(`${appId}: ${summary?.connection ?? "missing"}${summary?.note ? ` · ${summary.note}` : ""}`);
    }
  }
  if (failed.length) {
    throw new Error(`Operations bridge chưa kết nối đủ 6 ứng dụng: ${failed.join(" | ")}`);
  }

  console.log(`[offline-smoke] PASS Authenticated operations bridge · ${expectedManagedApps.length}/6 ứng dụng connected`);

  const boiAccess = await requestJson(
    "/api/apps/boi-ech/access",
    await signedControlBody(device.deviceId, keyPair, { action: "bootstrap" }, cancelSignal),
    cancelSignal,
    35_000,
  );
  if (boiAccess?.application !== "boi-ech" || !Array.isArray(boiAccess?.devices)) {
    throw new Error("Thanh toán & Quyền Bơi ếch không trả registry hợp lệ.");
  }
  if (!boiAccess.counts || typeof boiAccess.counts !== "object" || boiAccess.counts.total !== boiAccess.devices.length) {
    throw new Error("Thanh toán & Quyền Bơi ếch trả tổng hợp không khớp registry.");
  }
  console.log(`[offline-smoke] PASS Thanh toán & Quyền Bơi ếch · signed bootstrap · ${boiAccess.devices.length} thiết bị`);

}

function stop(child) {
  if (!child || child.killed || child.exitCode !== null) return;
  try { child.kill("SIGTERM"); } catch { /* already stopped */ }
}

async function main() {
  console.log("[offline-smoke] Khởi động full local stack gồm 6 client qua run:all. Không deploy, không dùng production D1.");
  console.log("[offline-smoke] Dependency bootstrap được giao cho run-all/run-local-system để kiểm thử đúng đường chạy người dùng.");
  const child = spawn(process.execPath, [launcherPath, "--local", "--no-browser", ...forwarded], {
    cwd: root,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[local-system] ${String(chunk)}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[local-system] ${String(chunk)}`));

  const cancel = new AbortController();
  const earlyExit = new Promise((_, reject) => {
    child.once("exit", (code, signal) => {
      cancel.abort();
      reject(new Error(`Local system dừng sớm (code=${code}, signal=${signal ?? "none"}).`));
    });
  });

  try {
    await Promise.race([
      (async () => {
        for (const [name, url] of checks) {
          const response = await requestReady(name, url, cancel.signal);
          console.log(`[offline-smoke] PASS ${name} · HTTP ${response.status}`);
        }
        await assertCentralUi(cancel.signal);
        console.log("[offline-smoke] PASS Application Management render · Quản trị Ứng dụng · không nhãn phiên bản phát hành");
        await assertAuthenticatedOperations(cancel.signal);
      })(),
      earlyExit,
    ]);
    console.log("\n[offline-smoke] PASS · Full local stack, authenticated operations bridge và quản trị quyền hoạt động trên 127.0.0.1:3000–3009, không publish.");
  } finally {
    cancel.abort();
    stop(child);
    if (child.exitCode === null) {
      await Promise.race([new Promise((resolvePromise) => child.once("exit", resolvePromise)), wait(6_000)]);
    }
  }
}

main().catch((error) => {
  console.error(`[offline-smoke] FAIL · ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
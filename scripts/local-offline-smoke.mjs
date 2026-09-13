import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const launcherPath = join(root, "scripts", "run-local-system.mjs");
const centralOrigin = "http://127.0.0.1:3000";
const forwarded = process.argv.slice(2).filter((arg) => arg !== "--local" && arg !== "--no-browser");
const primaryAppIds = ["boi-ech", "health-care", "ru-life", "bauman-master-ai"];

if (forwarded.some((arg) => arg === "--hybrid" || arg === "--mode=hybrid")) {
  throw new Error("local:offline-smoke chỉ chạy chế độ local; không cho phép hybrid/remote fallback.");
}

const checks = [
  ["Sức khỏe Y tế", "http://127.0.0.1:3001/api/control/contract"],
  ["Hòa nhập Nga", "http://127.0.0.1:3002/api/control/status"],
  ["Bauman Control", "http://127.0.0.1:3003/health"],
  ["Bơi ếch", "http://127.0.0.1:3004/api/control/overview?activityDays=0"],
  ["Bauman Runtime", "http://127.0.0.1:3005/_local/health"],
  ["Application Management", `${centralOrigin}/`],
];

function wait(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function base64Url(bytes) {
  return Buffer.from(bytes).toString("base64url");
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

async function postJson(path, body, cancelSignal) {
  const response = await fetch(`${centralOrigin}${path}`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.any([cancelSignal, AbortSignal.timeout(12_000)]),
  });
  const data = await response.json().catch(() => null);
  return { response, data };
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
}

async function localOwnerCredential(cancelSignal) {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const registered = await postJson("/api/device", { action: "register", publicKey }, cancelSignal);
  if (registered.response.status !== 200 || !registered.data?.device) {
    throw new Error(`Đăng ký thiết bị owner local thất bại · HTTP ${registered.response.status} · ${registered.data?.error ?? "phản hồi không hợp lệ"}`);
  }
  const device = registered.data.device;
  if (device.status !== "approved" || device.role !== "owner" || !device.owner) {
    throw new Error(`Thiết bị local không được xác nhận Owner/approved: ${JSON.stringify({ status: device.status, role: device.role, owner: device.owner })}`);
  }
  return { privateKey: keyPair.privateKey, device };
}

async function signedProof(credential, cancelSignal) {
  const challengeResult = await postJson(
    "/api/device",
    { action: "challenge", deviceId: credential.device.deviceId },
    cancelSignal,
  );
  if (challengeResult.response.status !== 200 || typeof challengeResult.data?.challenge !== "string") {
    throw new Error(`Không lấy được challenge local · HTTP ${challengeResult.response.status} · ${challengeResult.data?.error ?? "phản hồi không hợp lệ"}`);
  }
  const challenge = challengeResult.data.challenge;
  const message = new TextEncoder().encode(`learning-control:${credential.device.deviceId}:${challenge}`);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    credential.privateKey,
    message,
  );
  return {
    deviceId: credential.device.deviceId,
    challenge,
    signature: base64Url(new Uint8Array(signature)),
  };
}

async function assertCentralControlHandshake(cancelSignal) {
  const credential = await localOwnerCredential(cancelSignal);
  const proof = await signedProof(credential, cancelSignal);
  const result = await postJson("/api/operations", { action: "bootstrap", ...proof }, cancelSignal);
  if (result.response.status !== 200 || !result.data) {
    throw new Error(`Operations bootstrap local thất bại · HTTP ${result.response.status} · ${result.data?.error ?? "phản hồi không hợp lệ"}`);
  }
  if (result.data.actor?.role !== "owner") {
    throw new Error(`Operations bootstrap không xác nhận actor Owner: ${JSON.stringify(result.data.actor ?? null)}`);
  }
  if (!Array.isArray(result.data.summaries)) {
    throw new Error("Operations bootstrap không trả summaries hợp lệ.");
  }
  const summaryMap = new Map(result.data.summaries.map((item) => [item.appId, item]));
  const failures = [];
  for (const appId of primaryAppIds) {
    const summary = summaryMap.get(appId);
    if (!summary) failures.push(`${appId}: missing`);
    else if (summary.connection !== "connected") failures.push(`${appId}: ${summary.connection} · ${summary.note ?? "không có ghi chú"}`);
  }
  if (failures.length) {
    throw new Error(`Central → client handshake chưa đạt: ${failures.join(" | ")}`);
  }
  console.log(`[offline-smoke] PASS Central control handshake · ${primaryAppIds.join(", ")} = connected`);
}

function stop(child) {
  if (!child || child.killed || child.exitCode !== null) return;
  try { child.kill("SIGTERM"); } catch { /* already stopped */ }
}

async function main() {
  console.log("[offline-smoke] Khởi động trực tiếp full local control plane. Không deploy, không dùng production D1.");
  console.log("[offline-smoke] Dependency bootstrap được giao cho run-local-system.mjs để kiểm thử đúng đường chạy người dùng.");
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
        console.log("[offline-smoke] PASS Application Management render · Quản trị Ứng dụng");
        await assertCentralControlHandshake(cancel.signal);
      })(),
      earlyExit,
    ]);
    console.log("\n[offline-smoke] PASS · Full local stack + central control handshake hoạt động trên 127.0.0.1:3000–3005, không publish.");
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

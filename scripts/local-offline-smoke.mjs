import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const launcherPath = join(root, "scripts", "run-local-system.mjs");
const forwarded = process.argv.slice(2).filter((arg) => arg !== "--local" && arg !== "--no-browser");

if (forwarded.some((arg) => arg === "--hybrid" || arg === "--mode=hybrid")) {
  throw new Error("local:offline-smoke chỉ chạy chế độ local; không cho phép hybrid/remote fallback.");
}

const checks = [
  ["Sức khỏe Y tế", "http://127.0.0.1:3001/api/control/contract"],
  ["Hòa nhập Nga", "http://127.0.0.1:3002/api/control/status"],
  ["Bauman Control", "http://127.0.0.1:3003/health"],
  ["Bơi ếch", "http://127.0.0.1:3004/api/control/overview?activityDays=0"],
  ["Bauman Runtime", "http://127.0.0.1:3005/_local/health"],
  ["Application Management", "http://127.0.0.1:3000/"],
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

async function assertCentralUi(cancelSignal) {
  const response = await fetch("http://127.0.0.1:3000/", {
    redirect: "manual",
    signal: AbortSignal.any([cancelSignal, AbortSignal.timeout(2_000)]),
  });
  if (response.status !== 200) throw new Error(`Application Management local phải trả HTTP 200, nhận ${response.status}.`);
  const html = await response.text();
  if (!html.includes("Quản trị Ứng dụng")) {
    throw new Error("Trang local đã chạy nhưng không render tiêu đề Quản trị Ứng dụng.");
  }
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
      })(),
      earlyExit,
    ]);
    console.log("\n[offline-smoke] PASS · Full local stack hoạt động trên 127.0.0.1:3000–3005, không publish.");
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

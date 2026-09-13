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

async function requestReady(name, url, timeoutMs = 240_000) {
  const deadline = Date.now() + timeoutMs;
  let last = "chưa kết nối";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(1_200) });
      last = `HTTP ${response.status}`;
      if (response.status < 500) return response;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await wait(600);
  }
  throw new Error(`${name} không sẵn sàng: ${last}`);
}

async function assertCentralUi() {
  const response = await fetch("http://127.0.0.1:3000/", { redirect: "manual", signal: AbortSignal.timeout(2_000) });
  if (response.status !== 200) throw new Error(`Application Management local phải trả HTTP 200, nhận ${response.status}.`);
  const html = await response.text();
  if (!html.includes("Quản trị Ứng dụng")) {
    throw new Error("Trang local đã chạy nhưng không render tiêu đề Quản trị Ứng dụng.");
  }
}

function stop(child) {
  if (!child || child.killed) return;
  try { child.kill("SIGTERM"); } catch { /* already stopped */ }
}

async function main() {
  console.log("[offline-smoke] Khởi động toàn bộ local control plane. Không deploy, không dùng production D1.");
  const child = spawn(process.execPath, [launcherPath, "--local", "--no-browser", ...forwarded], {
    cwd: root,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[local-system] ${String(chunk)}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[local-system] ${String(chunk)}`));

  const earlyExit = new Promise((_, reject) => {
    child.once("exit", (code, signal) => reject(new Error(`Local system dừng sớm (code=${code}, signal=${signal ?? "none"}).`)));
  });

  try {
    await Promise.race([
      (async () => {
        for (const [name, url] of checks) {
          const response = await requestReady(name, url);
          console.log(`[offline-smoke] PASS ${name} · HTTP ${response.status}`);
        }
        await assertCentralUi();
        console.log("[offline-smoke] PASS Application Management render · Quản trị Ứng dụng");
      })(),
      earlyExit,
    ]);
    console.log("\n[offline-smoke] PASS · Full local stack hoạt động trên 127.0.0.1:3000–3005, không publish.");
  } finally {
    stop(child);
    await Promise.race([new Promise((resolvePromise) => child.once("exit", resolvePromise)), wait(6_000)]);
  }
}

main().catch((error) => {
  console.error(`[offline-smoke] FAIL · ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const defaultAppsRoot = resolve(root, "..");
const launcherPath = join(root, "scripts", "run-local-system.mjs");
const isWindows = process.platform === "win32";
const rawArgs = process.argv.slice(2);
const forwarded = rawArgs.filter((arg) => arg !== "--local" && arg !== "--no-browser");

if (forwarded.some((arg) => arg === "--hybrid" || arg === "--mode=hybrid")) {
  throw new Error("local:offline-smoke chỉ chạy chế độ local; không cho phép hybrid/remote fallback.");
}

function appsRootFromArgs(args) {
  let appsRoot = defaultAppsRoot;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--apps-root") {
      if (!args[index + 1]) throw new Error("--apps-root cần một đường dẫn.");
      appsRoot = resolve(args[index + 1]);
      index += 1;
    } else if (arg.startsWith("--apps-root=")) {
      appsRoot = resolve(arg.slice("--apps-root=".length));
    }
  }
  return appsRoot;
}

function commandSpec(command, args) {
  if (!isWindows || !/\.cmd$/i.test(command)) return { file: command, args };
  return {
    file: process.env.ComSpec || "cmd.exe",
    args: ["/d", "/s", "/c", command, ...args],
  };
}

function installDependencies(label, cwd) {
  if (existsSync(join(cwd, "node_modules"))) {
    console.log(`[offline-smoke] Dependency ${label} đã có, bỏ qua cài đặt.`);
    return;
  }
  const locked = existsSync(join(cwd, "package-lock.json")) || existsSync(join(cwd, "npm-shrinkwrap.json"));
  const mode = locked ? "ci" : "install";
  console.log(`[offline-smoke] Cài dependency ${label} bằng npm ${mode}${locked ? "" : " (repo chưa có lockfile)"}.`);
  const npm = isWindows ? "npm.cmd" : "npm";
  const command = commandSpec(npm, [mode, "--no-audit", "--no-fund"]);
  const result = spawnSync(command.file, command.args, { cwd, stdio: "inherit", env: process.env, shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Cài dependency ${label} thất bại với mã ${result.status}.`);
}

function bootstrapDependencies(appsRoot) {
  const baumanRoot = join(appsRoot, "Bauman-master-ai-system");
  const targets = [
    ["Application Management", root],
    ["Sức khỏe Y tế", join(appsRoot, "Health_Care")],
    ["Hòa nhập Nga", join(appsRoot, "RU_LIFE")],
    ["Bơi ếch", join(appsRoot, "BOIECH_AI", "boi-ech")],
    ["Bauman Control", join(baumanRoot, "control-service")],
  ];
  for (const [label, cwd] of targets) installDependencies(label, cwd);
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
  console.log("[offline-smoke] Khởi động toàn bộ local control plane. Không deploy, không dùng production D1.");
  const appsRoot = appsRootFromArgs(rawArgs);
  const skipInstall = rawArgs.includes("--skip-install");
  if (!skipInstall) bootstrapDependencies(appsRoot);

  const launcherArgs = [launcherPath, "--local", "--no-browser", ...forwarded];
  if (!skipInstall && !launcherArgs.includes("--skip-install")) launcherArgs.push("--skip-install");
  const child = spawn(process.execPath, launcherArgs, {
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

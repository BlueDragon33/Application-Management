import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const centralRoot = resolve(scriptDir, "..");
const defaultAppsRoot = resolve(centralRoot, "..");
const isWindows = process.platform === "win32";
const npm = isWindows ? "npm.cmd" : "npm";
const npx = isWindows ? "npx.cmd" : "npx";

function commandSpec(command, args) {
  if (!isWindows || !/\.cmd$/i.test(command)) return { file: command, args };
  return {
    file: process.env.ComSpec || "cmd.exe",
    args: ["/d", "/s", "/c", command, ...args],
  };
}

function parseArgs(argv) {
  const options = {
    mode: "local",
    appsRoot: defaultAppsRoot,
    skipInstall: false,
    skipMigrate: false,
    noBrowser: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--hybrid") options.mode = "hybrid";
    else if (arg === "--local") options.mode = "local";
    else if (arg === "--skip-install") options.skipInstall = true;
    else if (arg === "--skip-migrate") options.skipMigrate = true;
    else if (arg === "--no-browser") options.noBrowser = true;
    else if (arg === "--apps-root") {
      const value = argv[index + 1];
      if (!value) throw new Error("--apps-root cần một đường dẫn.");
      options.appsRoot = resolve(value);
      index += 1;
    } else if (arg.startsWith("--apps-root=")) {
      options.appsRoot = resolve(arg.slice("--apps-root=".length));
    } else if (arg.startsWith("--mode=")) {
      const value = arg.slice("--mode=".length);
      if (value !== "local" && value !== "hybrid") throw new Error("--mode chỉ nhận local hoặc hybrid.");
      options.mode = value;
    } else {
      throw new Error(`Tham số không hỗ trợ: ${arg}`);
    }
  }
  return options;
}

function ensureNodeVersion() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 13)) {
    throw new Error(`Cần Node.js >= 22.13.0, hiện tại là ${process.versions.node}.`);
  }
}

function requirePath(path, label) {
  if (!existsSync(path)) throw new Error(`${label} chưa tồn tại: ${path}`);
}

function parseEnvFile(path) {
  const values = {};
  if (!existsSync(path)) return values;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[key] = value;
  }
  return values;
}

function ensureCentralDevVars() {
  const target = join(centralRoot, ".dev.vars");
  const example = join(centralRoot, ".dev.vars.example");
  if (!existsSync(target)) {
    requirePath(example, ".dev.vars.example");
    writeFileSync(target, readFileSync(example));
    console.log("[local-system] Đã tạo .dev.vars từ mẫu local-only.");
  }
  const values = parseEnvFile(target);
  if (values.LOCAL_DEV_AUTH !== "1") throw new Error(".dev.vars phải có LOCAL_DEV_AUTH=1 để dùng local control plane trên loopback.");
  if (!values.LOCAL_DEV_USER_EMAIL) throw new Error(".dev.vars thiếu LOCAL_DEV_USER_EMAIL.");
  return values;
}

function ephemeralSecret() {
  return randomBytes(48).toString("base64url");
}

function commandResult(command, args, cwd, env = process.env) {
  const spec = commandSpec(command, args);
  return spawnSync(spec.file, spec.args, { cwd, env, stdio: "inherit", shell: false });
}

function runChecked(label, command, args, cwd, env = process.env) {
  console.log(`\n[local-system] ${label}`);
  const result = commandResult(command, args, cwd, env);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} thất bại với mã ${result.status}.`);
}

function hasNpmLockfile(cwd) {
  return existsSync(join(cwd, "package-lock.json")) || existsSync(join(cwd, "npm-shrinkwrap.json"));
}

function ensureDependencies(label, cwd, preferCi, skipInstall) {
  if (skipInstall || existsSync(join(cwd, "node_modules"))) return;
  const useCi = preferCi && hasNpmLockfile(cwd);
  if (preferCi && !useCi) {
    console.log(`[local-system] ${label} chưa có npm lockfile; chuyển an toàn từ npm ci sang npm install.`);
  }
  runChecked(`Cài dependency · ${label}`, npm, [useCi ? "ci" : "install", "--no-audit", "--no-fund"], cwd);
}

function portAvailable(port) {
  const script = isWindows
    ? `[bool](-not (Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue))`
    : `! (lsof -iTCP:${port} -sTCP:LISTEN -t 2>/dev/null | grep -q .)`;
  const command = isWindows ? "powershell.exe" : "sh";
  const args = isWindows ? ["-NoProfile", "-Command", script] : ["-c", script];
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (isWindows) return result.status === 0 && result.stdout.trim().toLowerCase() === "true";
  return result.status === 0;
}

function requirePorts(ports) {
  const occupied = ports.filter((port) => !portAvailable(port));
  if (occupied.length) throw new Error(`Các port đang được sử dụng: ${occupied.join(", ")}. Hãy đóng phiên local cũ trước.`);
}

function migrateLocalDatabases(paths, skipMigrate) {
  if (skipMigrate) return;
  runChecked(
    "Migration D1 local · Application Management",
    npx,
    ["wrangler", "d1", "migrations", "apply", "learning-management-db", "--local", "--config", "wrangler.local.jsonc"],
    paths.central,
  );
  runChecked(
    "Migration D1 local · Sức khỏe Y tế",
    npx,
    ["wrangler", "d1", "migrations", "apply", "health-care-local-db", "--local", "--config", "wrangler.local.jsonc"],
    paths.health,
  );
  runChecked(
    "Migration D1 local · Hòa nhập Nga",
    npx,
    ["wrangler", "d1", "migrations", "apply", "ru-life-local", "--local", "--config", "wrangler.local.jsonc"],
    paths.ruLife,
  );
  runChecked(
    "Migration D1 local · Bauman Control",
    npx,
    ["wrangler", "d1", "migrations", "apply", "bauman-control-local", "--local", "--config", "wrangler.local.jsonc"],
    paths.baumanControl,
  );
  runChecked(
    "Migration D1 local · Bơi ếch",
    npx,
    ["wrangler", "d1", "migrations", "apply", "boi-ech-local", "--local", "--config", "wrangler.local.jsonc"],
    paths.boi,
  );
}

function spawnService({ name, command, args, cwd, env }) {
  const spec = commandSpec(command, args);
  const child = spawn(spec.file, spec.args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    windowsHide: false,
  });
  const prefix = `[${name}]`;
  child.stdout.on("data", (chunk) => process.stdout.write(`${prefix} ${String(chunk).replace(/\n/g, `\n${prefix} `)}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`${prefix} ${String(chunk).replace(/\n/g, `\n${prefix} `)}`));
  child.on("exit", (code, signal) => {
    if (!shuttingDown && code !== 0) {
      console.error(`\n[local-system] ${name} đã dừng ngoài dự kiến (code=${code}, signal=${signal ?? "none"}).`);
      void shutdown(1);
    }
  });
  return child;
}

async function waitForEndpoint(name, url, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(900) });
      if (response.status < 500) {
        console.log(`[local-system] ${name} sẵn sàng · HTTP ${response.status}`);
        return;
      }
    } catch {
      // Retry until timeout.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 450));
  }
  throw new Error(`${name} không sẵn sàng sau ${Math.round(timeoutMs / 1000)} giây: ${url}`);
}

function openBrowser(url) {
  try {
    if (process.platform === "win32") spawn("cmd.exe", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    else if (process.platform === "darwin") spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    else spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
  } catch {
    // Browser opening is convenience only; runtime remains usable.
  }
}

function killTree(child) {
  if (!child || child.killed) return;
  if (isWindows && child.pid) {
    spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  try { child.kill("SIGTERM"); } catch { /* already stopped */ }
}

let children = [];
let shuttingDown = false;

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\n[local-system] Đang dừng các runtime...");
  for (const child of [...children].reverse()) killTree(child);
  children = [];
  process.exit(exitCode);
}

async function main() {
  ensureNodeVersion();
  const options = parseArgs(process.argv.slice(2));
  const baumanRoot = join(options.appsRoot, "Bauman-master-ai-system");
  const paths = {
    central: centralRoot,
    health: join(options.appsRoot, "Health_Care"),
    ruLife: join(options.appsRoot, "RU_LIFE"),
    baumanRuntime: baumanRoot,
    baumanControl: join(baumanRoot, "control-service"),
    boi: join(options.appsRoot, "BOIECH_AI", "boi-ech"),
  };

  for (const [key, path] of Object.entries(paths)) requirePath(path, key);
  requirePath(join(paths.health, "wrangler.local.jsonc"), "Health_Care/wrangler.local.jsonc");
  requirePath(join(paths.ruLife, "wrangler.local.jsonc"), "RU_LIFE/wrangler.local.jsonc");
  requirePath(join(paths.baumanControl, "wrangler.local.jsonc"), "Bauman control-service/wrangler.local.jsonc");
  requirePath(join(paths.boi, "wrangler.local.jsonc"), "BOIECH_AI/boi-ech/wrangler.local.jsonc");
  requirePath(join(paths.baumanRuntime, "scripts", "serve-local-runtime.mjs"), "Bauman scripts/serve-local-runtime.mjs");
  requirePorts([3000, 3001, 3002, 3003, 3004, 3005]);

  ensureDependencies("Application Management", paths.central, true, options.skipInstall);
  ensureDependencies("Sức khỏe Y tế", paths.health, true, options.skipInstall);
  ensureDependencies("Hòa nhập Nga", paths.ruLife, true, options.skipInstall);
  ensureDependencies("Bơi ếch", paths.boi, true, options.skipInstall);
  ensureDependencies("Bauman Control", paths.baumanControl, false, options.skipInstall);

  const devVars = ensureCentralDevVars();
  migrateLocalDatabases(paths, options.skipMigrate);

  const centralOrigin = "http://127.0.0.1:3000";
  const baumanRuntimeOrigin = "http://127.0.0.1:3005";
  const healthSecret = ephemeralSecret();
  const ruSecret = ephemeralSecret();
  const baumanSecret = ephemeralSecret();
  const boiSecret = ephemeralSecret();

  const commonClientEnv = {
    APPLICATION_MANAGEMENT_ORIGIN: centralOrigin,
    LOCAL_CONTROL_PLANE: "true",
    WRANGLER_LOG_PATH: ".wrangler/wrangler.log",
  };

  children.push(spawnService({
    name: "HEALTH",
    command: npx,
    args: ["vite", "--host", "127.0.0.1", "--port", "3001"],
    cwd: paths.health,
    env: { ...commonClientEnv, HEALTH_CONTROL_SERVICE_SECRET: healthSecret },
  }));
  children.push(spawnService({
    name: "RU",
    command: npx,
    args: ["vite", "--host", "127.0.0.1", "--port", "3002"],
    cwd: paths.ruLife,
    env: { ...commonClientEnv, RU_LIFE_CONTROL_SERVICE_SECRET: ruSecret },
  }));
  children.push(spawnService({
    name: "BAUMAN-CONTROL",
    command: npx,
    args: [
      "wrangler", "dev", "--local", "--config", "wrangler.local.jsonc", "--ip", "127.0.0.1", "--port", "3003",
      "--var", `BAUMAN_CONTROL_SERVICE_SECRET:${baumanSecret}`,
      "--var", `APPLICATION_MANAGEMENT_ORIGIN:${centralOrigin}`,
      "--var", `BAUMAN_APP_ORIGIN:${baumanRuntimeOrigin}`,
    ],
    cwd: paths.baumanControl,
    env: { WRANGLER_SEND_METRICS: "false" },
  }));
  children.push(spawnService({
    name: "BOI",
    command: npx,
    args: ["vite", "--host", "127.0.0.1", "--port", "3004"],
    cwd: paths.boi,
    env: { ...commonClientEnv, CONTROL_SERVICE_SECRET: boiSecret },
  }));
  children.push(spawnService({
    name: "BAUMAN-RUNTIME",
    command: process.execPath,
    args: ["scripts/serve-local-runtime.mjs", "--host", "127.0.0.1", "--port", "3005"],
    cwd: paths.baumanRuntime,
    env: {},
  }));

  await Promise.all([
    waitForEndpoint("Sức khỏe Y tế", "http://127.0.0.1:3001/api/control/contract"),
    waitForEndpoint("Hòa nhập Nga", "http://127.0.0.1:3002/api/control/status"),
    waitForEndpoint("Bauman Control", "http://127.0.0.1:3003/health"),
    waitForEndpoint("Bơi ếch", "http://127.0.0.1:3004/api/control/overview?activityDays=0"),
    waitForEndpoint("Bauman Runtime", `${baumanRuntimeOrigin}/_local/health`),
  ]);

  const centralEnv = {
    ...devVars,
    LOCAL_DEV_AUTH: "1",
    CONTROL_PLANE_NETWORK_MODE: options.mode,
    HEALTH_CARE_LOCAL_BASE_URL: "http://127.0.0.1:3001",
    HEALTH_CONTROL_SERVICE_SECRET: healthSecret,
    RU_LIFE_LOCAL_BASE_URL: "http://127.0.0.1:3002",
    RU_LIFE_CONTROL_SERVICE_SECRET: ruSecret,
    BAUMAN_CONTROL_LOCAL_BASE_URL: "http://127.0.0.1:3003",
    BAUMAN_APP_LOCAL_ORIGIN: baumanRuntimeOrigin,
    BAUMAN_CONTROL_SERVICE_SECRET: baumanSecret,
    BOI_ECH_LOCAL_BASE_URL: "http://127.0.0.1:3004",
    CONTROL_SERVICE_SECRET: boiSecret,
  };

  children.push(spawnService({
    name: "ADMIN",
    command: npx,
    args: ["vite", "--host", "127.0.0.1", "--port", "3000"],
    cwd: paths.central,
    env: centralEnv,
  }));

  await waitForEndpoint("Application Management", centralOrigin);

  console.log("\n===============================================================");
  console.log(" Local Control Plane đang hoạt động");
  console.log("===============================================================");
  console.log(` Chế độ          : ${options.mode}`);
  console.log(` Trung tâm       : ${centralOrigin}`);
  console.log(" Sức khỏe Y tế   : http://127.0.0.1:3001");
  console.log(" Hòa nhập Nga    : http://127.0.0.1:3002");
  console.log(" Bauman Control  : http://127.0.0.1:3003 · D1 bauman-control-local");
  console.log(" Bơi ếch         : http://127.0.0.1:3004");
  console.log(` Bauman Runtime  : ${baumanRuntimeOrigin} · Device Gate`);
  console.log("---------------------------------------------------------------");
  console.log(" D1 local nằm trong .wrangler của từng repo và KHÔNG phải D1 production.");
  console.log(" Secret liên-app chỉ tồn tại trong process hiện tại, không ghi vào GitHub.");
  console.log(" Bauman Runtime phải được duyệt bằng mã BM- trong Application Management trước khi mở nội dung học.");
  console.log(" Nhấn Ctrl+C để dừng toàn bộ hệ thống.");
  console.log("===============================================================\n");

  if (!options.noBrowser) openBrowser(centralOrigin);
  await new Promise(() => {});
}

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));
process.on("uncaughtException", (error) => {
  console.error(error);
  void shutdown(1);
});
process.on("unhandledRejection", (error) => {
  console.error(error);
  void shutdown(1);
});

main().catch((error) => {
  console.error(`\n[local-system] ${error instanceof Error ? error.message : String(error)}`);
  void shutdown(1);
});
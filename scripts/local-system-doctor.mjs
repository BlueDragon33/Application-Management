import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import net from "node:net";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const centralRoot = resolve(scriptDir, "..");
const defaultAppsRoot = resolve(centralRoot, "..");

function parseArgs(argv) {
  const options = { appsRoot: defaultAppsRoot, json: false, strictPorts: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") options.json = true;
    else if (arg === "--strict-ports") options.strictPorts = true;
    else if (arg === "--apps-root") {
      const value = argv[index + 1];
      if (!value) throw new Error("--apps-root cần một đường dẫn.");
      options.appsRoot = resolve(value);
      index += 1;
    } else if (arg.startsWith("--apps-root=")) {
      options.appsRoot = resolve(arg.slice("--apps-root=".length));
    } else {
      throw new Error(`Tham số không hỗ trợ: ${arg}`);
    }
  }
  return options;
}

function nodeVersionOk() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  return major > 22 || (major === 22 && minor >= 13);
}

function text(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function hasAll(value, tokens) {
  return tokens.every((token) => value.includes(token));
}

function syntaxCheck(path) {
  if (!existsSync(path)) return false;
  const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
  return result.status === 0;
}

function portFree(port) {
  return new Promise((resolvePromise) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolvePromise(false));
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
      server.close(() => resolvePromise(true));
    });
  });
}

function createReporter() {
  const checks = [];
  const add = (level, name, detail) => checks.push({ level, name, detail });
  return {
    checks,
    pass(name, detail = "OK") { add("pass", name, detail); },
    warn(name, detail) { add("warn", name, detail); },
    fail(name, detail) { add("fail", name, detail); },
  };
}

function checkFile(reporter, path, label) {
  if (existsSync(path)) reporter.pass(label, path);
  else reporter.fail(label, `Thiếu: ${path}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const reporter = createReporter();
  const baumanRoot = join(options.appsRoot, "Bauman-master-ai-system");
  const paths = {
    central: centralRoot,
    health: join(options.appsRoot, "Health_Care"),
    ruLife: join(options.appsRoot, "RU_LIFE"),
    baumanRuntime: baumanRoot,
    baumanControl: join(baumanRoot, "control-service"),
    boi: join(options.appsRoot, "BOIECH_AI", "boi-ech"),
    growUp: join(options.appsRoot, "GrowUP_MyChildren"),
    growUpControl: join(options.appsRoot, "GrowUP_MyChildren", "control-service"),
    price: join(options.appsRoot, "PriceReport_Tunggiabao"),
    priceControl: join(options.appsRoot, "PriceReport_Tunggiabao", "control-service"),
    nc03: join(options.appsRoot, "NC03_Modem"),
  };

  if (nodeVersionOk()) reporter.pass("Node.js", process.versions.node);
  else reporter.fail("Node.js", `Cần >=22.13.0, hiện tại ${process.versions.node}`);

  for (const [key, root] of Object.entries(paths)) checkFile(reporter, root, `Repo/runtime ${key}`);

  const requiredFiles = [
    [join(paths.central, "package.json"), "Application Management package"],
    [join(paths.central, "wrangler.local.jsonc"), "Application Management local D1"],
    [join(paths.central, ".dev.vars.example"), "Application Management local auth sample"],
    [join(paths.central, "scripts", "run-local-system.mjs"), "Core local-system launcher"],
    [join(paths.central, "scripts", "run-all.mjs"), "Run-all orchestrator"],
    [join(paths.health, "package.json"), "Health package"],
    [join(paths.health, "vite.config.ts"), "Health local bindings"],
    [join(paths.health, "wrangler.d1.jsonc"), "Health local D1 config"],
    [join(paths.ruLife, "package.json"), "RU_LIFE package"],
    [join(paths.ruLife, "vite.config.ts"), "RU_LIFE local bindings"],
    [join(paths.ruLife, "wrangler.local.jsonc"), "RU_LIFE local D1 config"],
    [join(paths.baumanControl, "package.json"), "Bauman Control package"],
    [join(paths.baumanControl, "wrangler.jsonc"), "Bauman Control Wrangler config"],
    [join(paths.baumanControl, "wrangler.local.jsonc"), "Bauman Control local D1 config"],
    [join(paths.baumanRuntime, "index.html"), "Bauman learning runtime"],
    [join(paths.baumanRuntime, "assets", "js", "platform", "runtime-config.js"), "Bauman runtime control config"],
    [join(paths.baumanRuntime, "assets", "js", "platform", "device-access-gate.js"), "Bauman Device Gate"],
    [join(paths.baumanRuntime, "assets", "css", "device-access-gate.css"), "Bauman Device Gate styles"],
    [join(paths.baumanRuntime, "scripts", "serve-local-runtime.mjs"), "Bauman local static runtime server"],
    [join(paths.boi, "package.json"), "Bơi ếch package"],
    [join(paths.boi, "vite.config.ts"), "Bơi ếch local bindings"],
    [join(paths.boi, "wrangler.d1.jsonc"), "Bơi ếch local D1 config"],
    [join(paths.growUp, "index.html"), "GrowUP runtime"],
    [join(paths.growUp, "control", "application-management.contract.json"), "GrowUP management contract"],
    [join(paths.growUp, "control", "local-device-gateway.js"), "GrowUP local device gateway"],
    [join(paths.growUpControl, "local-control.mjs"), "GrowUP local Control Service"],
    [join(paths.price, "package.json"), "PriceReport runtime package"],
    [join(paths.price, "public", "management-contract.json"), "PriceReport management contract"],
    [join(paths.priceControl, "package.json"), "PriceReport Control package"],
    [join(paths.priceControl, "wrangler.local.jsonc"), "PriceReport Control local config"],
    [join(paths.nc03, "package.json"), "NC03 runtime package"],
    [join(paths.nc03, "index.html"), "NC03 runtime entry"],
  ];
  for (const [path, label] of requiredFiles) checkFile(reporter, path, label);

  const resolver = text(join(paths.central, "app", "client-origin.server.ts"));
  if (hasAll(resolver, [
    '"production" | "local" | "hybrid"',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    'http://127.0.0.1:3003',
    'http://127.0.0.1:3004',
    'http://127.0.0.1:3009',
    'url.protocol === "https:"',
  ])) reporter.pass("Hybrid origin resolver", "Production HTTPS + local control ports gồm PriceReport :3009");
  else reporter.fail("Hybrid origin resolver", "Resolver thiếu mode/port/HTTPS guard chuẩn.");

  const launcherPath = join(paths.central, "scripts", "run-local-system.mjs");
  const launcher = text(launcherPath);
  if (syntaxCheck(launcherPath)) reporter.pass("Launcher syntax", "node --check PASS");
  else reporter.fail("Launcher syntax", "Không parse được scripts/run-local-system.mjs");

  const runAllPath = join(paths.central, "scripts", "run-all.mjs");
  const runAll = text(runAllPath);
  if (syntaxCheck(runAllPath)) reporter.pass("Run-all syntax", "node --check PASS");
  else reporter.fail("Run-all syntax", "Không parse được scripts/run-all.mjs");

  if (hasAll(runAll, [
    "GROWUP_PORT = 3006",
    "GROWUP_CONTROL_PORT = 3007",
    "PRICE_PORT = 3008",
    "PRICE_CONTROL_PORT = 3009",
    "NC03_PORT = 3010",
    "NC03_Modem",
    "nc03-modem",
    "GROWUP_CONTROL_SERVICE_SECRET",
    "PRICE_REPORT_CONTROL_SERVICE_SECRET",
    "price-report-tunggiabao",
  ])) reporter.pass("Run-all wiring", "6 client quản trị + NC03 runtime :3010 + ephemeral secrets");
  else reporter.fail("Run-all wiring", "run:all chưa nối đủ các client và NC03 runtime.");

  if (launcher && !launcher.includes('"--remote"') && !launcher.includes("workers.dev")) {
    reporter.pass("Local D1 isolation", "Launcher không dùng --remote/workers.dev");
  } else {
    reporter.fail("Local D1 isolation", "Phát hiện dấu hiệu remote deployment trong launcher local.");
  }

  if (hasAll(launcher, [
    'baumanRuntimeOrigin = "http://127.0.0.1:3005"',
    'BAUMAN_APP_ORIGIN',
    'scripts/serve-local-runtime.mjs',
    'BAUMAN-RUNTIME',
    '/_local/health',
  ])) reporter.pass("Bauman local runtime bridge", "Runtime :3005 được khóa qua Bauman Control :3003");
  else reporter.fail("Bauman local runtime bridge", "Launcher chưa nối đầy đủ Bauman runtime :3005 với Control Service.");

  const runtimeServerPath = join(paths.baumanRuntime, "scripts", "serve-local-runtime.mjs");
  if (syntaxCheck(runtimeServerPath)) reporter.pass("Bauman runtime server syntax", "node --check PASS");
  else reporter.fail("Bauman runtime server syntax", "Không parse được scripts/serve-local-runtime.mjs");

  const runtimeHtml = text(join(paths.baumanRuntime, "index.html"));
  const runtimeConfig = text(join(paths.baumanRuntime, "assets", "js", "platform", "runtime-config.js"));
  const runtimeGate = text(join(paths.baumanRuntime, "assets", "js", "platform", "device-access-gate.js"));
  if (hasAll(runtimeHtml, ["assets/css/device-access-gate.css", "assets/js/platform/runtime-config.js", "assets/js/platform/device-access-gate.js"])) {
    reporter.pass("Bauman runtime gate wiring", "index.html nạp Device Gate trước ứng dụng học");
  } else reporter.fail("Bauman runtime gate wiring", "index.html chưa nạp đủ runtime config/gate.");

  if (hasAll(runtimeConfig, ["bauman-control-v4", "http://127.0.0.1:3003", "deviceAccess: true"]) && hasAll(runtimeGate, [
    "/api/device/register",
    "/api/device/challenge",
    "/api/device/verify",
    "/api/device/heartbeat",
    "ECDSA",
    "P-256",
    "offline-grace",
  ])) reporter.pass("Bauman Device Gate contract", "P-256 + session + heartbeat + offline grace");
  else reporter.fail("Bauman Device Gate contract", "Device Gate không khớp contract điều khiển hiện tại.");

  const healthVite = text(join(paths.health, "vite.config.ts"));
  if (hasAll(healthVite, ["HEALTH_CONTROL_SERVICE_SECRET", "APPLICATION_MANAGEMENT_ORIGIN", "LOCAL_CONTROL_ALLOW_LAN"])) {
    reporter.pass("Health local bridge", "Bindings local đã có");
  } else reporter.fail("Health local bridge", "Health chưa có đủ local control bindings.");

  const ruVite = text(join(paths.ruLife, "vite.config.ts"));
  if (hasAll(ruVite, ["RU_LIFE_CONTROL_SERVICE_SECRET", "APPLICATION_MANAGEMENT_ORIGIN", "LOCAL_CONTROL_ALLOW_LAN"])) {
    reporter.pass("RU_LIFE local bridge", "Bindings local đã có");
  } else reporter.fail("RU_LIFE local bridge", "RU_LIFE chưa có đủ local control bindings.");

  const boiVite = text(join(paths.boi, "vite.config.ts"));
  if (hasAll(boiVite, ["CONTROL_SERVICE_SECRET", "APPLICATION_MANAGEMENT_ORIGIN", "LOCAL_CONTROL_ALLOW_LAN"])) {
    reporter.pass("Bơi ếch local bridge", "Bindings local đã có");
  } else reporter.fail("Bơi ếch local bridge", "Bơi ếch chưa có đủ local control bindings.");

  const growUpEntry = text(join(paths.growUp, "src", "runtime-entry.js"));
  const growUpControl = text(join(paths.growUpControl, "local-control.mjs"));
  if (hasAll(growUpEntry, ["127.0.0.1", "3006", "local-device-gateway.js"])
    && hasAll(growUpControl, ["GROWUP_CONTROL_SERVICE_SECRET", "registryInstanceId", "childRecordsExposed", "healthRecordsExposed"])) {
    reporter.pass("GrowUP local control contract", "Runtime :3006 + Control :3007 + privacy boundary");
  } else reporter.fail("GrowUP local control contract", "GrowUP integration branch thiếu runtime/control contract local.");

  const priceControl = text(join(paths.priceControl, "src", "index.ts"));
  const priceDeviceStore = text(join(paths.priceControl, "src", "device-store.ts"));
  if (hasAll(priceControl, [
    "PRICE_REPORT_CONTROL_SERVICE_SECRET",
    "price-report-control-v1",
    "/api/control/devices",
    "/api/control/device-commands",
  ]) && hasAll(priceDeviceStore, [
    "P-256",
    "ECDSA",
    "commandId",
    "expectedStatus",
  ])) reporter.pass("PriceReport local control contract", "KT- registry + signed control API + P-256 + concurrency guard");
  else reporter.fail("PriceReport local control contract", "PriceReport Control chưa đủ contract quản trị thiết bị.");

  const portResults = await Promise.all([3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010].map(async (port) => [port, await portFree(port)]));
  for (const [port, free] of portResults) {
    if (free) reporter.pass(`Port ${port}`, "Đang trống");
    else if (options.strictPorts) reporter.fail(`Port ${port}`, "Đang có tiến trình lắng nghe");
    else reporter.warn(`Port ${port}`, "Đang có tiến trình lắng nghe; có thể hệ local đã chạy");
  }

  const failures = reporter.checks.filter((item) => item.level === "fail");
  const warnings = reporter.checks.filter((item) => item.level === "warn");

  if (options.json) {
    console.log(JSON.stringify({ ok: failures.length === 0, failures: failures.length, warnings: warnings.length, appsRoot: options.appsRoot, checks: reporter.checks }, null, 2));
  } else {
    console.log("\n===============================================================");
    console.log(" Application Management · LOCAL SYSTEM DOCTOR");
    console.log("===============================================================");
    for (const item of reporter.checks) {
      const marker = item.level === "pass" ? "[PASS]" : item.level === "warn" ? "[WARN]" : "[FAIL]";
      console.log(`${marker} ${item.name} · ${item.detail}`);
    }
    console.log("---------------------------------------------------------------");
    console.log(`Kết quả: ${failures.length === 0 ? "SẴN SÀNG" : "CHƯA SẴN SÀNG"} · lỗi ${failures.length} · cảnh báo ${warnings.length}`);
    console.log("Doctor chỉ đọc/kiểm tra; không migration, không cài package, không sửa dữ liệu.");
    console.log("===============================================================\n");
  }

  process.exitCode = failures.length === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(`[local-doctor] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

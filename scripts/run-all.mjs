import { randomBytes } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const centralRoot = resolve(scriptDir, "..");
const defaultAppsRoot = resolve(centralRoot, "..");
const isWindows = process.platform === "win32";
const npm = isWindows ? "npm.cmd" : "npm";
const npx = isWindows ? "npx.cmd" : "npx";

const GROWUP_PORT = 3006;
const GROWUP_CONTROL_PORT = 3007;
const PRICE_PORT = 3008;
const PRICE_CONTROL_PORT = 3009;
const NC03_PORT = 3010;
const GROWUP_ORIGIN = `http://127.0.0.1:${GROWUP_PORT}`;
const GROWUP_CONTROL_ORIGIN = `http://127.0.0.1:${GROWUP_CONTROL_PORT}`;
const PRICE_ORIGIN = `http://127.0.0.1:${PRICE_PORT}`;
const PRICE_CONTROL_ORIGIN = `http://127.0.0.1:${PRICE_CONTROL_PORT}`;
const NC03_ORIGIN = `http://127.0.0.1:${NC03_PORT}`;
const CENTRAL_ORIGIN = "http://127.0.0.1:3000";

const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".woff2", "font/woff2"],
]);

function parseArgs(argv) {
  let appsRoot = defaultAppsRoot;
  const forwarded = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apps-root") {
      const value = argv[index + 1];
      if (!value) throw new Error("--apps-root cần một đường dẫn.");
      appsRoot = resolve(value);
      forwarded.push(arg, value);
      index += 1;
      continue;
    }
    if (arg.startsWith("--apps-root=")) appsRoot = resolve(arg.slice("--apps-root=".length));
    forwarded.push(arg);
  }
  return { appsRoot, forwarded };
}

function commandSpec(command, args) {
  if (!isWindows || !/\.cmd$/i.test(command)) return { file: command, args };
  return { file: process.env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c", command, ...args] };
}

function runChecked(label, command, args, cwd) {
  console.log(`\n[RUN-ALL] ${label}`);
  const spec = commandSpec(command, args);
  const result = spawnSync(spec.file, spec.args, {
    cwd,
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      CI: process.env.CI || "1",
      WRANGLER_SEND_METRICS: "false",
      npm_config_update_notifier: "false",
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} thất bại với mã ${result.status}.`);
}

function requireFile(path, label) {
  if (!existsSync(path)) throw new Error(`${label} chưa tồn tại: ${path}`);
}

function ensureDependencies(label, cwd) {
  if (existsSync(join(cwd, "node_modules"))) return;
  const useCi = existsSync(join(cwd, "package-lock.json"));
  runChecked(`Cài dependency · ${label}`, npm, [useCi ? "ci" : "install", "--no-audit", "--no-fund"], cwd);
}

function safeFile(root, requestPath) {
  const rootPath = resolve(root);
  let raw;
  try {
    raw = decodeURIComponent((requestPath || "/").split("?")[0]);
  } catch {
    return null;
  }
  const relative = normalize(raw.replace(/^\/+/, ""));
  if (relative.startsWith("..") || relative.includes(`..${sep}`)) return null;
  let candidate = resolve(rootPath, relative || "index.html");
  if (candidate !== rootPath && !candidate.startsWith(`${rootPath}${sep}`)) return null;
  if (existsSync(candidate) && statSync(candidate).isDirectory()) candidate = join(candidate, "index.html");
  if (!existsSync(candidate) && !extname(relative)) candidate = join(rootPath, "index.html");
  return existsSync(candidate) && statSync(candidate).isFile() ? candidate : null;
}

function startStaticServer(root, port) {
  const server = createServer((request, response) => {
    const file = safeFile(root, request.url || "/");
    if (!file) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "content-type": mime.get(extname(file).toLowerCase()) || "application/octet-stream",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    createReadStream(file).pipe(response);
  });
  return new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolvePromise(server));
  });
}

function spawnService({ name, command, args, cwd, env = {} }) {
  const spec = commandSpec(command, args);
  const child = spawn(spec.file, spec.args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
  const prefix = `[${name}]`;
  child.stdout.on("data", (chunk) => process.stdout.write(`${prefix} ${String(chunk).replace(/\n/g, `\n${prefix} `)}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`${prefix} ${String(chunk).replace(/\n/g, `\n${prefix} `)}`));
  return child;
}

async function waitFor(url, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  let last = "chưa kết nối";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(1_000) });
      last = `HTTP ${response.status}`;
      if (response.ok) return response;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 350));
  }
  throw new Error(`Không nhận được phản hồi từ ${url}: ${last}.`);
}

async function verifyGrowUpContract() {
  const response = await waitFor(`${GROWUP_ORIGIN}/control/application-management.contract.json`);
  if (!response.ok) throw new Error(`GrowUP contract trả HTTP ${response.status}.`);
  const contract = await response.json();
  if (contract?.application?.id !== "growup-mychildren" || contract?.application?.repository !== "BlueDragon33/GrowUP_MyChildren") {
    throw new Error("GrowUP contract local không đúng ứng dụng/repository mong đợi.");
  }
}

async function verifyPriceContract() {
  const response = await waitFor(`${PRICE_ORIGIN}/management-contract.json`);
  if (!response.ok) throw new Error(`PriceReport contract trả HTTP ${response.status}.`);
  const contract = await response.json();
  if (contract?.application?.id !== "price-report-tunggiabao" || contract?.application?.repository !== "BlueDragon33/PriceReport_Tunggiabao") {
    throw new Error("PriceReport contract local không đúng ứng dụng/repository mong đợi.");
  }
}

function kill(child, signal = "SIGTERM") {
  if (!child || child.killed) return;
  if (isWindows && child.pid) {
    spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  try { child.kill(signal); } catch { /* already stopped */ }
}

async function main() {
  const { appsRoot, forwarded } = parseArgs(process.argv.slice(2));
  const growUpRoot = join(appsRoot, "GrowUP_MyChildren");
  const growUpControlScript = join(growUpRoot, "control-service", "local-control.mjs");
  const priceRoot = join(appsRoot, "PriceReport_Tunggiabao");
  const priceControlRoot = join(priceRoot, "control-service");
  const nc03Root = join(appsRoot, "NC03_Modem");

  requireFile(join(growUpRoot, "index.html"), "GrowUP index.html");
  requireFile(join(growUpRoot, "control", "application-management.contract.json"), "GrowUP management contract");
  requireFile(join(growUpRoot, "control", "local-device-gateway.js"), "GrowUP local device gateway");
  requireFile(growUpControlScript, "GrowUP local control service");
  requireFile(join(priceRoot, "package.json"), "PriceReport package.json");
  requireFile(join(priceRoot, "public", "management-contract.json"), "PriceReport management contract");
  requireFile(join(priceControlRoot, "package.json"), "PriceReport Control package.json");
  requireFile(join(priceControlRoot, "wrangler.local.jsonc"), "PriceReport Control local config");
  requireFile(join(nc03Root, "package.json"), "NC03 package.json");
  requireFile(join(nc03Root, "index.html"), "NC03 index.html");

  ensureDependencies("PriceReport Runtime", priceRoot);
  ensureDependencies("PriceReport Control", priceControlRoot);
  runChecked("Xác minh/build · NC03 Control Center", npm, ["run", "verify"], nc03Root);

  runChecked(
    "Migration D1 local · PriceReport Control",
    npx,
    ["--yes", "wrangler@4.136.3", "d1", "migrations", "apply", "price-report-control-local-db", "--local", "--config", "wrangler.local.jsonc"],
    priceControlRoot,
  );

  const growUpSecret = randomBytes(48).toString("base64url");
  const priceSecret = randomBytes(48).toString("base64url");
  const growUpControl = spawnService({
    name: "GROWUP-CONTROL",
    command: process.execPath,
    args: [growUpControlScript],
    cwd: growUpRoot,
    env: { PORT: String(GROWUP_CONTROL_PORT), GROWUP_CONTROL_SERVICE_SECRET: growUpSecret },
  });
  const priceControl = spawnService({
    name: "PRICE-CONTROL",
    command: npx,
    args: [
      "--yes", "wrangler@4.136.3", "dev", "--local", "--config", "wrangler.local.jsonc", "--ip", "127.0.0.1", "--port", String(PRICE_CONTROL_PORT),
      "--var", `PRICE_REPORT_CONTROL_SERVICE_SECRET:${priceSecret}`,
      "--var", `APPLICATION_MANAGEMENT_ORIGIN:${CENTRAL_ORIGIN}`,
      "--var", `PRICE_REPORT_APP_ORIGIN:${PRICE_ORIGIN}`,
    ],
    cwd: priceControlRoot,
    env: { WRANGLER_SEND_METRICS: "false" },
  });
  const priceRuntime = spawnService({
    name: "PRICE",
    command: npx,
    args: ["vite", "--host", "127.0.0.1", "--port", String(PRICE_PORT)],
    cwd: priceRoot,
  });

  let core = null;
  let growUpServer = null;
  let nc03Server = null;
  let closing = false;
  const children = [growUpControl, priceControl, priceRuntime];

  const close = (signal = "SIGTERM") => {
    if (closing) return;
    closing = true;
    kill(core, signal);
    for (const child of [...children].reverse()) kill(child, signal);
    growUpServer?.close(() => {});
    nc03Server?.close(() => {});
  };
  process.on("SIGINT", () => close("SIGINT"));
  process.on("SIGTERM", () => close("SIGTERM"));

  const addonNames = new Map([
    [growUpControl, "GrowUP Control"],
    [priceControl, "PriceReport Control"],
    [priceRuntime, "PriceReport Runtime"],
  ]);
  for (const child of children) {
    child.on("exit", (code, signal) => {
      if (!closing) {
        const name = addonNames.get(child) || "Runtime bổ sung";
        console.error(`[RUN-ALL] ${name} dừng ngoài dự kiến (code=${code ?? "none"}, signal=${signal || "none"}).`);
        close();
        process.exitCode = 1;
      }
    });
  }

  try {
    await waitFor(`${GROWUP_CONTROL_ORIGIN}/health`);
    console.log(`[RUN-ALL] GrowUP Control sẵn sàng · ${GROWUP_CONTROL_ORIGIN}`);
    growUpServer = await startStaticServer(growUpRoot, GROWUP_PORT);
    await verifyGrowUpContract();
    console.log(`[RUN-ALL] GrowUP Runtime sẵn sàng · ${GROWUP_ORIGIN}`);

    await waitFor(`${PRICE_CONTROL_ORIGIN}/health`);
    console.log(`[RUN-ALL] PriceReport Control sẵn sàng · ${PRICE_CONTROL_ORIGIN}`);
    await verifyPriceContract();
    console.log(`[RUN-ALL] PriceReport Runtime sẵn sàng · ${PRICE_ORIGIN}`);

    nc03Server = await startStaticServer(join(nc03Root, "dist"), NC03_PORT);
    await waitFor(NC03_ORIGIN);
    console.log(`[RUN-ALL] NC03 Control Center sẵn sàng · ${NC03_ORIGIN}`);

    core = spawn(process.execPath, [join(scriptDir, "run-local-system.mjs"), ...forwarded], {
      cwd: centralRoot,
      env: {
        ...process.env,
        GROWUP_BASE_URL: GROWUP_ORIGIN,
        GROWUP_CONTROL_LOCAL_BASE_URL: GROWUP_CONTROL_ORIGIN,
        GROWUP_CONTROL_SERVICE_SECRET: growUpSecret,
        PRICE_REPORT_BASE_URL: PRICE_ORIGIN,
        PRICE_REPORT_CONTROL_LOCAL_BASE_URL: PRICE_CONTROL_ORIGIN,
        PRICE_REPORT_CONTROL_SERVICE_SECRET: priceSecret,
        NC03_LOCAL_BASE_URL: NC03_ORIGIN,
        LOCAL_ACTIVE_APPLICATIONS: "boi-ech,health-care,ru-life,bauman-master-ai,growup-mychildren,price-report-tunggiabao,nc03-modem",
      },
      stdio: "inherit",
      shell: false,
    });

    core.on("error", (error) => {
      console.error(`[RUN-ALL] Không khởi động được control plane lõi: ${error.message}`);
      close();
      process.exitCode = 1;
    });
    core.on("exit", (code, signal) => {
      closing = true;
      for (const child of [...children].reverse()) kill(child);
      growUpServer?.close(() => {});
      nc03Server?.close(() => {
        if (signal) console.log(`[RUN-ALL] Control plane lõi dừng bởi ${signal}.`);
        const pendingExitCode = typeof process.exitCode === "number" ? process.exitCode : 0;
        process.exit(pendingExitCode !== 0 ? pendingExitCode : (code ?? 0));
      });
    });

    await waitFor(CENTRAL_ORIGIN, 120_000);
    console.log("\n===============================================================");
    console.log(" RUN ALL · 7 CLIENT RUNTIME/CONTROL ĐÃ KHỞI ĐỘNG");
    console.log("===============================================================");
    console.log(" Trung tâm          : http://127.0.0.1:3000");
    console.log(" Sức khỏe Y tế      : http://127.0.0.1:3001");
    console.log(" Hòa nhập Nga       : http://127.0.0.1:3002");
    console.log(" Bauman Control     : http://127.0.0.1:3003");
    console.log(" Bơi ếch            : http://127.0.0.1:3004");
    console.log(" Bauman Hub         : http://127.0.0.1:3005");
    console.log(" GrowUP Runtime     : http://127.0.0.1:3006");
    console.log(" GrowUP Control     : http://127.0.0.1:3007");
    console.log(" PriceReport Runtime: http://127.0.0.1:3008");
    console.log(" PriceReport Control: http://127.0.0.1:3009");
    console.log(" NC03 Control Center : http://127.0.0.1:3010");
    console.log("---------------------------------------------------------------");
    console.log(" Secret liên-app chỉ tồn tại trong process hiện tại; không ghi vào GitHub.");
    console.log(" 6 client quản trị + NC03 local runtime đã được khởi động trong cùng hệ thống.");
    console.log("===============================================================\n");
  } catch (error) {
    close();
    throw error;
  }
}

main().catch((error) => {
  console.error(`[RUN-ALL] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

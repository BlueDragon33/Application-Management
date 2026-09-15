import { randomBytes } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const centralRoot = resolve(scriptDir, "..");
const defaultAppsRoot = resolve(centralRoot, "..");
const GROWUP_PORT = 3006;
const GROWUP_CONTROL_PORT = 3007;
const GROWUP_ORIGIN = `http://127.0.0.1:${GROWUP_PORT}`;
const GROWUP_CONTROL_ORIGIN = `http://127.0.0.1:${GROWUP_CONTROL_PORT}`;

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

function requireFile(path, label) {
  if (!existsSync(path)) throw new Error(`${label} chưa tồn tại: ${path}`);
}

function safeFile(root, requestPath) {
  const rootPath = resolve(root);
  const raw = decodeURIComponent((requestPath || "/").split("?")[0]);
  const relative = normalize(raw.replace(/^\/+/, ""));
  if (relative.startsWith("..") || relative.includes(`..${sep}`)) return null;
  let candidate = resolve(rootPath, relative || "index.html");
  if (candidate !== rootPath && !candidate.startsWith(`${rootPath}${sep}`)) return null;
  if (existsSync(candidate) && statSync(candidate).isDirectory()) candidate = join(candidate, "index.html");
  if (!existsSync(candidate) && !extname(relative)) candidate = join(rootPath, "index.html");
  return existsSync(candidate) && statSync(candidate).isFile() ? candidate : null;
}

function startGrowUpServer(root) {
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
    server.listen(GROWUP_PORT, "127.0.0.1", () => resolvePromise(server));
  });
}

async function waitFor(url, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(800) });
      if (response.status < 500) return response;
    } catch {
      // Retry until deadline.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`Không nhận được phản hồi từ ${url}.`);
}

async function verifyGrowUpContract() {
  const response = await waitFor(`${GROWUP_ORIGIN}/control/application-management.contract.json`);
  if (!response.ok) throw new Error(`GrowUP contract trả HTTP ${response.status}.`);
  const contract = await response.json();
  if (contract?.application?.id !== "growup-mychildren" || contract?.application?.repository !== "BlueDragon33/GrowUP_MyChildren") {
    throw new Error("GrowUP contract local không đúng ứng dụng/repository mong đợi.");
  }
}

function kill(child, signal = "SIGTERM") {
  if (!child || child.killed) return;
  try { child.kill(signal); } catch { /* already stopped */ }
}

async function main() {
  const { appsRoot, forwarded } = parseArgs(process.argv.slice(2));
  const growUpRoot = join(appsRoot, "GrowUP_MyChildren");
  const growUpControlScript = join(growUpRoot, "control-service", "local-control.mjs");
  requireFile(join(growUpRoot, "index.html"), "GrowUP index.html");
  requireFile(join(growUpRoot, "control", "application-management.contract.json"), "GrowUP management contract");
  requireFile(join(growUpRoot, "control", "local-device-gateway.js"), "GrowUP local device gateway");
  requireFile(growUpControlScript, "GrowUP local control service");

  const growUpSecret = randomBytes(48).toString("base64url");
  const controlChild = spawn(process.execPath, [growUpControlScript], {
    cwd: growUpRoot,
    env: { ...process.env, PORT: String(GROWUP_CONTROL_PORT), GROWUP_CONTROL_SERVICE_SECRET: growUpSecret },
    stdio: "inherit",
    shell: false,
  });

  let centralChild = null;
  let growUpServer = null;
  let closing = false;

  const close = (signal = "SIGTERM") => {
    if (closing) return;
    closing = true;
    kill(centralChild, signal);
    kill(controlChild, signal);
    growUpServer?.close(() => {});
  };

  process.on("SIGINT", () => close("SIGINT"));
  process.on("SIGTERM", () => close("SIGTERM"));

  controlChild.on("exit", (code, signal) => {
    if (!closing && code !== 0) {
      console.error(`[RUN-ALL] GrowUP Control dừng ngoài dự kiến (code=${code}, signal=${signal || "none"}).`);
      close();
    }
  });

  try {
    await waitFor(`${GROWUP_CONTROL_ORIGIN}/health`);
    console.log(`[RUN-ALL] GrowUP Control sẵn sàng · ${GROWUP_CONTROL_ORIGIN}`);

    growUpServer = await startGrowUpServer(growUpRoot);
    await verifyGrowUpContract();
    console.log(`[RUN-ALL] GrowUP Runtime sẵn sàng · ${GROWUP_ORIGIN}`);

    centralChild = spawn(process.execPath, [join(scriptDir, "run-local-system.mjs"), ...forwarded], {
      cwd: centralRoot,
      env: {
        ...process.env,
        GROWUP_BASE_URL: GROWUP_ORIGIN,
        GROWUP_CONTROL_LOCAL_BASE_URL: GROWUP_CONTROL_ORIGIN,
        GROWUP_CONTROL_SERVICE_SECRET: growUpSecret,
      },
      stdio: "inherit",
      shell: false,
    });

    centralChild.on("error", (error) => {
      console.error(`[RUN-ALL] Không khởi động được local control plane: ${error.message}`);
      close();
      process.exitCode = 1;
    });
    centralChild.on("exit", (code, signal) => {
      closing = true;
      kill(controlChild);
      growUpServer?.close(() => {
        if (signal) console.log(`[RUN-ALL] Local control plane dừng bởi ${signal}.`);
        process.exit(code ?? 0);
      });
    });
  } catch (error) {
    close();
    throw error;
  }
}

main().catch((error) => {
  console.error(`[RUN-ALL] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const centralRoot = resolve(scriptDir, "..");
const defaultAppsRoot = resolve(centralRoot, "..");
const GROWUP_PORT = 3006;
const GROWUP_ORIGIN = `http://127.0.0.1:${GROWUP_PORT}`;

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
  const raw = decodeURIComponent((requestPath || "/").split("?")[0]);
  const relative = normalize(raw.replace(/^\/+/, ""));
  if (relative.startsWith("..") || relative.includes(`..${process.platform === "win32" ? "\\" : "/"}`)) return null;
  let candidate = resolve(root, relative || "index.html");
  if (!candidate.startsWith(resolve(root))) return null;
  if (existsSync(candidate) && statSync(candidate).isDirectory()) candidate = join(candidate, "index.html");
  if (!existsSync(candidate) && !extname(relative)) candidate = join(root, "index.html");
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

async function verifyGrowUpContract() {
  const response = await fetch(`${GROWUP_ORIGIN}/control/application-management.contract.json`, { cache: "no-store" });
  if (!response.ok) throw new Error(`GrowUP contract trả HTTP ${response.status}.`);
  const contract = await response.json();
  if (contract?.application?.id !== "growup-mychildren" || contract?.application?.repository !== "BlueDragon33/GrowUP_MyChildren") {
    throw new Error("GrowUP contract local không đúng ứng dụng/repository mong đợi.");
  }
}

async function main() {
  const { appsRoot, forwarded } = parseArgs(process.argv.slice(2));
  const growUpRoot = join(appsRoot, "GrowUP_MyChildren");
  requireFile(join(growUpRoot, "index.html"), "GrowUP index.html");
  requireFile(join(growUpRoot, "control", "application-management.contract.json"), "GrowUP management contract");

  const growUpServer = await startGrowUpServer(growUpRoot);
  await verifyGrowUpContract();
  console.log(`[RUN-ALL] GrowUP sẵn sàng · ${GROWUP_ORIGIN}`);

  const child = spawn(process.execPath, [join(scriptDir, "run-local-system.mjs"), ...forwarded], {
    cwd: centralRoot,
    env: { ...process.env, GROWUP_BASE_URL: GROWUP_ORIGIN },
    stdio: "inherit",
    shell: false,
  });

  let closing = false;
  const close = (signal) => {
    if (closing) return;
    closing = true;
    if (!child.killed) child.kill(signal);
    growUpServer.close(() => {});
  };

  process.on("SIGINT", () => close("SIGINT"));
  process.on("SIGTERM", () => close("SIGTERM"));
  child.on("error", (error) => {
    console.error(`[RUN-ALL] Không khởi động được local control plane: ${error.message}`);
    growUpServer.close(() => process.exit(1));
  });
  child.on("exit", (code, signal) => {
    growUpServer.close(() => {
      if (signal) console.log(`[RUN-ALL] Local control plane dừng bởi ${signal}.`);
      process.exit(code ?? 0);
    });
  });
}

main().catch((error) => {
  console.error(`[RUN-ALL] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

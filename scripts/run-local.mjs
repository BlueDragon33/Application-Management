import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const varsPath = path.join(root, ".dev.vars");
const varsExamplePath = path.join(root, ".dev.vars.example");
const localUrl = "http://127.0.0.1:3000";
const isWindows = process.platform === "win32";

function commandSpec(name, args) {
  if (!isWindows) return { file: name, args };
  const executable = name === "npm" || name === "npx" ? `${name}.cmd` : name;
  return {
    file: process.env.ComSpec || "cmd.exe",
    args: ["/d", "/s", "/c", executable, ...args],
  };
}

function run(name, args, options = {}) {
  const command = commandSpec(name, args);
  execFileSync(command.file, command.args, {
    cwd: root,
    stdio: "inherit",
    env: options.env ?? process.env,
  });
}

function parseVars(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (/^[A-Z0-9_]+$/.test(key)) values[key] = value;
  }
  return values;
}

function ensureLocalVars() {
  if (!fs.existsSync(varsPath)) {
    if (!fs.existsSync(varsExamplePath)) throw new Error("Thiếu .dev.vars.example");
    fs.copyFileSync(varsExamplePath, varsPath);
    console.log("[local] Đã tạo .dev.vars từ mẫu local-only.");
  }
  return parseVars(fs.readFileSync(varsPath, "utf8"));
}

function ensureDependencies() {
  if (fs.existsSync(path.join(root, "node_modules", ".bin"))) return;
  console.log("[local] Chưa có node_modules. Cài dependencies lần đầu bằng npm ci...");
  run("npm", ["ci", "--no-audit", "--no-fund"]);
}

function migrateLocalD1(env) {
  console.log("[local] Áp dụng migrations vào D1 LOCAL. Production D1 không bị truy cập.");
  run("npx", [
    "wrangler",
    "d1",
    "migrations",
    "apply",
    "learning-management-db",
    "--local",
    "--config",
    "wrangler.local.jsonc",
  ], { env });
}

function openBrowser() {
  try {
    if (isWindows) {
      spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "start", "", localUrl], { detached: true, stdio: "ignore" }).unref();
    } else if (process.platform === "darwin") {
      spawn("open", [localUrl], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn("xdg-open", [localUrl], { detached: true, stdio: "ignore" }).unref();
    }
  } catch {
    // Browser opening is convenience only; the dev server remains authoritative.
  }
}

function main() {
  process.chdir(root);
  ensureDependencies();
  const localVars = ensureLocalVars();
  const env = { ...process.env, ...localVars, APP_RUNTIME: "local" };

  if (env.LOCAL_DEV_AUTH !== "1") {
    throw new Error("LOCAL_DEV_AUTH phải bằng 1 trong .dev.vars để dùng launcher local.");
  }

  migrateLocalD1(env);
  console.log(`[local] Khởi động Application Management tại ${localUrl}`);
  console.log("[local] Auth local chỉ được chấp nhận trên localhost/127.0.0.1/[::1].");
  console.log("[local] Ctrl+C để dừng server.");

  const npm = commandSpec("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "3000"]);
  const server = spawn(npm.file, npm.args, {
    cwd: root,
    stdio: "inherit",
    env,
  });

  const timer = setTimeout(openBrowser, 2200);
  const stop = (signal) => {
    clearTimeout(timer);
    if (!server.killed) server.kill(signal);
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));
  server.on("exit", (code) => process.exit(code ?? 0));
}

main();

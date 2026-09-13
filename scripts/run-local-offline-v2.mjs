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

function run(command, args, cwd, stdio = "inherit") {
  const spec = commandSpec(command, args);
  return spawnSync(spec.file, spec.args, { cwd, stdio, shell: false, env: process.env });
}

function checked(label, command, args, cwd) {
  console.log(`\n[offline-v2] ${label}`);
  const result = run(command, args, cwd);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} thất bại với mã ${result.status}.`);
}

function ensurePath(path, label) {
  if (!existsSync(path)) throw new Error(`${label} chưa tồn tại: ${path}`);
}

function hasNpmLockfile(cwd) {
  return existsSync(join(cwd, "package-lock.json")) || existsSync(join(cwd, "npm-shrinkwrap.json"));
}

function ensureDependencies(label, cwd, preferCi = true) {
  if (existsSync(join(cwd, "node_modules"))) {
    console.log(`[offline-v2] ${label}: node_modules đã có, bỏ qua cài lại.`);
    return;
  }

  if (preferCi && hasNpmLockfile(cwd)) {
    console.log(`\n[offline-v2] Cài dependency · ${label} · thử npm ci`);
    const ci = run(npm, ["ci", "--no-audit", "--no-fund"], cwd);
    if (!ci.error && ci.status === 0) return;
    console.warn(`[offline-v2] npm ci của ${label} không dùng được; tự chuyển sang npm install để tiếp tục local.`);
  } else if (preferCi) {
    console.log(`[offline-v2] ${label} chưa có npm lockfile; dùng npm install.`);
  }

  checked(`Cài dependency · ${label} · npm install`, npm, ["install", "--no-audit", "--no-fund"], cwd);
}

function writeLocalConfigIfNeeded(path, content, label) {
  if (existsSync(path)) return;
  writeFileSync(path, content, "utf8");
  console.log(`[offline-v2] Đã tạo ${label} chỉ cho local.`);
}

function parseArgs(argv) {
  const options = { appsRoot: defaultAppsRoot, noBrowser: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--no-browser") options.noBrowser = true;
    else if (arg === "--apps-root") {
      if (!argv[i + 1]) throw new Error("--apps-root cần đường dẫn.");
      options.appsRoot = resolve(argv[++i]);
    } else if (arg.startsWith("--apps-root=")) options.appsRoot = resolve(arg.slice(12));
    else throw new Error(`Tham số không hỗ trợ: ${arg}`);
  }
  return options;
}

function localConfig(name, dbName, dbId = "00000000-0000-0000-0000-000000000004") {
  return `${JSON.stringify({
    $schema: "./node_modules/wrangler/config-schema.json",
    name,
    compatibility_date: "2026-08-26",
    compatibility_flags: ["nodejs_compat"],
    d1_databases: [{ binding: "DB", database_name: dbName, database_id: dbId, migrations_dir: "drizzle" }],
  }, null, 2)}\n`;
}

async function main() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 13)) {
    throw new Error(`Cần Node.js >= 22.13.0, hiện tại ${process.versions.node}.`);
  }

  const options = parseArgs(process.argv.slice(2));
  const baumanRoot = join(options.appsRoot, "Bauman-master-ai-system");
  const paths = {
    central: centralRoot,
    health: join(options.appsRoot, "Health_Care"),
    ruLife: join(options.appsRoot, "RU_LIFE"),
    baumanControl: join(baumanRoot, "control-service"),
    boi: join(options.appsRoot, "BOIECH_AI", "boi-ech"),
  };

  for (const [key, value] of Object.entries(paths)) ensurePath(value, key);

  writeLocalConfigIfNeeded(
    join(paths.health, "wrangler.local.jsonc"),
    localConfig("health-care-local", "health-care-local-db"),
    "Health_Care/wrangler.local.jsonc",
  );
  writeLocalConfigIfNeeded(
    join(paths.boi, "wrangler.local.jsonc"),
    localConfig("boi-ech-local", "boi-ech-local"),
    "BOIECH_AI/boi-ech/wrangler.local.jsonc",
  );

  ensureDependencies("Application Management", paths.central, true);
  ensureDependencies("Sức khỏe Y tế", paths.health, true);
  ensureDependencies("Hòa nhập Nga", paths.ruLife, true);
  ensureDependencies("Bơi ếch", paths.boi, true);
  ensureDependencies("Bauman Control", paths.baumanControl, false);

  checked("Migration D1 local · Application Management", npx,
    ["wrangler", "d1", "migrations", "apply", "learning-management-db", "--local", "--config", "wrangler.local.jsonc"], paths.central);
  checked("Migration D1 local · Sức khỏe Y tế", npx,
    ["wrangler", "d1", "migrations", "apply", "health-care-local-db", "--local", "--config", "wrangler.local.jsonc"], paths.health);
  checked("Migration D1 local · Hòa nhập Nga", npx,
    ["wrangler", "d1", "migrations", "apply", "ru-life-local", "--local", "--config", "wrangler.local.jsonc"], paths.ruLife);
  checked("Migration D1 local · Bauman Control", npx,
    ["wrangler", "d1", "migrations", "apply", "bauman-control-local", "--local", "--config", "wrangler.local.jsonc"], paths.baumanControl);
  checked("Migration D1 local · Bơi ếch", npx,
    ["wrangler", "d1", "migrations", "apply", "boi-ech-local", "--local", "--config", "wrangler.local.jsonc"], paths.boi);

  console.log("\n[offline-v2] Bootstrap local hoàn tất. Khởi động 6 runtime trên 127.0.0.1:3000–3005...");
  const launcher = join(paths.central, "scripts", "run-local-system.mjs");
  const args = [launcher, "--local", "--skip-install", "--skip-migrate", "--apps-root", options.appsRoot];
  if (options.noBrowser) args.push("--no-browser");

  const child = spawn(process.execPath, args, {
    cwd: paths.central,
    stdio: "inherit",
    shell: false,
    env: process.env,
  });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 1);
  });
}

main().catch((error) => {
  console.error(`\n[offline-v2] FAIL · ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

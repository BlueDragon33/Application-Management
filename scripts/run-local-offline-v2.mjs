import { existsSync, writeFileSync } from "node:fs";
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
  const env = {
    ...process.env,
    CI: process.env.CI || "1",
    WRANGLER_SEND_METRICS: "false",
    npm_config_update_notifier: "false",
  };
  return spawnSync(spec.file, spec.args, { cwd, stdio, shell: false, env });
}

function checked(label, command, args, cwd) {
  console.log(`\n[offline-core] ${label}`);
  const result = run(command, args, cwd);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} thất bại với mã ${result.status}. Dữ liệu local được giữ nguyên; hệ thống không tự xóa registry.`);
  }
}

function ensurePath(path, label) {
  if (!existsSync(path)) throw new Error(`${label} chưa tồn tại: ${path}`);
}

function hasCoreApps(root) {
  return existsSync(join(root, "Bauman-master-ai-system"))
    && existsSync(join(root, "BOIECH_AI", "boi-ech"));
}

function resolveAppsRoot(requestedRoot, explicitRoot) {
  if (explicitRoot) return requestedRoot;

  const envRoot = process.env.APPLICATION_APPS_ROOT?.trim();
  const candidates = [
    envRoot ? resolve(envRoot) : null,
    requestedRoot,
    join(requestedRoot, "BaumanWeb"),
    join(requestedRoot, "Apps"),
  ].filter(Boolean);

  const selected = candidates.find((candidate) => hasCoreApps(candidate));
  if (selected) {
    if (selected !== requestedRoot) {
      console.log(`[offline-core] Tự phát hiện workspace ứng dụng: ${selected}`);
    }
    return selected;
  }

  return requestedRoot;
}

function hasNpmLockfile(cwd) {
  return existsSync(join(cwd, "package-lock.json")) || existsSync(join(cwd, "npm-shrinkwrap.json"));
}

function ensureDependencies(label, cwd, preferCi = true) {
  if (existsSync(join(cwd, "node_modules"))) {
    console.log(`[offline-core] ${label}: node_modules đã có, bỏ qua cài lại.`);
    return;
  }

  if (preferCi && hasNpmLockfile(cwd)) {
    console.log(`\n[offline-core] Cài dependency · ${label} · thử npm ci`);
    const ci = run(npm, ["ci", "--no-audit", "--no-fund"], cwd);
    if (!ci.error && ci.status === 0) return;
    console.warn(`[offline-core] npm ci của ${label} không dùng được; tự chuyển sang npm install.`);
  } else if (preferCi) {
    console.log(`[offline-core] ${label} chưa có npm lockfile; dùng npm install.`);
  }

  checked(`Cài dependency · ${label} · npm install`, npm, ["install", "--no-audit", "--no-fund"], cwd);
}

function writeLocalConfigIfNeeded(path, content, label) {
  if (existsSync(path)) return;
  writeFileSync(path, content, "utf8");
  console.log(`[offline-core] Đã tạo ${label} chỉ cho local.`);
}

function parseArgs(argv) {
  const options = { appsRoot: defaultAppsRoot, explicitAppsRoot: false, noBrowser: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--no-browser") options.noBrowser = true;
    else if (arg === "--apps-root") {
      if (!argv[i + 1]) throw new Error("--apps-root cần đường dẫn.");
      options.appsRoot = resolve(argv[++i]);
      options.explicitAppsRoot = true;
    } else if (arg.startsWith("--apps-root=")) {
      options.appsRoot = resolve(arg.slice(12));
      options.explicitAppsRoot = true;
    } else throw new Error(`Tham số không hỗ trợ: ${arg}`);
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
  options.appsRoot = resolveAppsRoot(options.appsRoot, options.explicitAppsRoot);

  const baumanRoot = join(options.appsRoot, "Bauman-master-ai-system");
  const paths = {
    central: centralRoot,
    baumanRuntime: baumanRoot,
    baumanControl: join(baumanRoot, "control-service"),
    boi: join(options.appsRoot, "BOIECH_AI", "boi-ech"),
  };

  if (!hasCoreApps(options.appsRoot)) {
    throw new Error(
      `Không tìm thấy workspace Bauman + Bơi ếch. Đã kiểm tra quanh ${defaultAppsRoot}. `
      + `Có thể chạy lại với --apps-root "E:\\BaumanWeb" nếu repo nằm tại E:\\BaumanWeb\\Bauman-master-ai-system và E:\\BaumanWeb\\BOIECH_AI.`,
    );
  }

  for (const [key, value] of Object.entries(paths)) ensurePath(value, key);

  writeLocalConfigIfNeeded(
    join(paths.boi, "wrangler.local.jsonc"),
    localConfig("boi-ech-local", "boi-ech-local"),
    "BOIECH_AI/boi-ech/wrangler.local.jsonc",
  );

  ensureDependencies("Application Management", paths.central, true);
  ensureDependencies("Bơi ếch", paths.boi, true);
  ensureDependencies("Bauman Control", paths.baumanControl, false);

  checked("Migration D1 local · Application Management", npx,
    ["wrangler", "d1", "migrations", "apply", "learning-management-db", "--local", "--config", "wrangler.local.jsonc"], paths.central);
  checked("Migration D1 local · Bauman Control", npx,
    ["wrangler", "d1", "migrations", "apply", "bauman-control-local", "--local", "--config", "wrangler.local.jsonc"], paths.baumanControl);
  checked("Migration D1 local · Bơi ếch", npx,
    ["wrangler", "d1", "migrations", "apply", "boi-ech-local", "--local", "--config", "wrangler.local.jsonc"], paths.boi);

  console.log("\n[offline-core] Bootstrap hoàn tất. Khởi động Application Management + Bauman Hub + Bơi ếch...");
  console.log(`[offline-core] Workspace ứng dụng: ${options.appsRoot}`);
  console.log("[offline-core] Registry Bauman được giữ nguyên giữa các lần chạy; không còn cơ chế tự xóa .wrangler/state.");
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
  console.error(`\n[offline-core] FAIL · ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

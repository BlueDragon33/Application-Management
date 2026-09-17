import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const isWindows = process.platform === "win32";
const ports = [3000, 3003, 3004, 3005];
const workspaceRoot = resolve(process.cwd(), "..").replaceAll("/", "\\").toLowerCase();

function sleep(ms) {
  const sab = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(sab), 0, 0, ms);
}

function windowsListeners() {
  const ps = [
    "$ports = @(3000,3003,3004,3005)",
    "$items = foreach ($port in $ports) {",
    "  $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1",
    "  if ($conn) {",
    "    $proc = Get-CimInstance Win32_Process -Filter \"ProcessId=$($conn.OwningProcess)\" -ErrorAction SilentlyContinue",
    "    [pscustomobject]@{ Port=$port; Pid=$conn.OwningProcess; Name=$proc.Name; CommandLine=$proc.CommandLine }",
    "  }",
    "}",
    "ConvertTo-Json -InputObject @($items) -Compress",
  ].join("; ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", ps], { encoding: "utf8" });
  if (result.status !== 0) return [];
  const text = result.stdout.trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function unixListeners() {
  const result = [];
  for (const port of ports) {
    const probe = spawnSync("sh", ["-c", `lsof -nP -iTCP:${port} -sTCP:LISTEN -Fpct 2>/dev/null | head -n 4`], { encoding: "utf8" });
    if (probe.status !== 0 || !probe.stdout.trim()) continue;
    const pid = probe.stdout.split(/\r?\n/).find((line) => line.startsWith("p"))?.slice(1);
    if (!pid) continue;
    const cmd = spawnSync("ps", ["-p", pid, "-o", "command="], { encoding: "utf8" }).stdout.trim();
    result.push({ Port: port, Pid: Number(pid), Name: "", CommandLine: cmd });
  }
  return result;
}

function listeners() {
  return isWindows ? windowsListeners() : unixListeners();
}

function belongsToLocalStack(item) {
  const cmd = String(item.CommandLine || "").replaceAll("/", "\\").toLowerCase();
  if (!cmd) return false;
  if (cmd.includes(workspaceRoot)) return true;
  if (item.Port === 3000 && cmd.includes("application-management")) return true;
  if (item.Port === 3003 && (cmd.includes("bauman-master-ai-system") || cmd.includes("control-service"))) return true;
  if (item.Port === 3004 && (cmd.includes("boiech_ai") || cmd.includes("boi-ech"))) return true;
  if (item.Port === 3005 && cmd.includes("bauman-master-ai-system")) return true;
  return false;
}

function stop(item) {
  if (isWindows) {
    const result = spawnSync("taskkill.exe", ["/PID", String(item.Pid), "/T", "/F"], { encoding: "utf8" });
    return result.status === 0;
  }
  const result = spawnSync("kill", ["-TERM", String(item.Pid)], { encoding: "utf8" });
  return result.status === 0;
}

const initial = listeners();
if (!initial.length) {
  console.log("[local-system] Không có runtime cũ chiếm các port 3000/3003/3004/3005.");
  process.exit(0);
}

const foreign = initial.filter((item) => !belongsToLocalStack(item));
const stale = initial.filter(belongsToLocalStack);

for (const item of stale) {
  console.log(`[local-system] Dừng runtime cũ trên port ${item.Port} (PID ${item.Pid})...`);
  stop(item);
}

if (stale.length) sleep(900);

const remaining = listeners();
const remainingLocal = remaining.filter(belongsToLocalStack);
for (const item of remainingLocal) {
  console.log(`[local-system] Dọn lần 2 runtime cũ trên port ${item.Port} (PID ${item.Pid})...`);
  stop(item);
}
if (remainingLocal.length) sleep(700);

const blocked = listeners();
if (!blocked.length) {
  console.log("[local-system] Các port local đã sẵn sàng.");
  process.exit(0);
}

const details = blocked.map((item) => `${item.Port} (PID ${item.Pid}${item.Name ? `, ${item.Name}` : ""})`).join(", ");
const hasForeign = blocked.some((item) => !belongsToLocalStack(item));
if (hasForeign || foreign.length) {
  console.error(`[local-system] Không tự dừng tiến trình không thuộc BaumanWeb: ${details}`);
  console.error("[local-system] Hãy đóng ứng dụng đang dùng các port này rồi chạy lại RUN_LOCAL_SYSTEM.bat.");
} else {
  console.error(`[local-system] Chưa giải phóng được các runtime cũ: ${details}`);
}
process.exit(1);

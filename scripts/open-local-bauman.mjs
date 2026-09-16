import { spawn } from "node:child_process";

const target = "http://127.0.0.1:3005";
const health = `${target}/_local/health`;
const deadline = Date.now() + 90_000;

async function waitUntilReady() {
  while (Date.now() < deadline) {
    try {
      const response = await fetch(health, { cache: "no-store", signal: AbortSignal.timeout(900) });
      if (response.ok) return true;
    } catch {
      // Local runtime is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function openBrowser(url) {
  if (process.platform === "win32") {
    spawn("cmd.exe", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}

if (await waitUntilReady()) openBrowser(target);

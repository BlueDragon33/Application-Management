import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts", "run-r23-owner-pilot-qa.mjs");
const source = fs.readFileSync(script, "utf8");

function check(env = {}) {
  const result = spawnSync(process.execPath, [script, "--check-only"], {
    cwd: root,
    env: {
      PATH: process.env.PATH ?? "",
      ...(process.platform === "win32" ? { SystemRoot: process.env.SystemRoot ?? "", ComSpec: process.env.ComSpec ?? "" } : {}),
      ...env,
    },
    encoding: "utf8",
    timeout: 15000,
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

test("R2.3 launcher uses isolated QA-only owner identity and fails closed before local runtime", () => {
  assert.match(source, /LOCAL_DEV_AUTH: "1"/);
  assert.match(source, /LOCAL_DEV_USER_EMAIL: email/);
  assert.match(source, /CONTROL_OWNER_EMAILS: email/);
  assert.match(source, /APPLICATION_MANAGEMENT_ACCESS_MODE: "standalone"/);
  assert.match(source, /CONTROL_PLANE_NETWORK_MODE: "local"/);
  assert.match(source, /127\.0\.0\.1/);
  assert.match(source, /port = 5191/);
  assert.match(source, /gitBranch\) block/);
  assert.match(source, /--local/);
  assert.doesNotMatch(source, /--remote|DEPLOY_PRODUCTION|wrangler deploy|skipSignature|UPDATE control_devices/);
});

test("R2.3 launcher rejects Production/remote configuration without starting server", () => {
  for (const variable of [
    "CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH",
    "CLOUDFLARE_API_TOKEN",
    "APPLICATION_MANAGEMENT_PRODUCTION_ORIGIN",
    "APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID",
    "APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET",
  ]) {
    const result = check({ [variable]: "forbidden" });
    assert.equal(result.status, 1, variable);
    assert.match(result.output, new RegExp("Production/remote configuration present: " + variable));
  }
  const result = check({ APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL: "cloudflare-production" });
  assert.equal(result.status, 1);
  assert.match(result.output, /Production\/preview deployment channel is not allowed/);
});

test("R2.3 local QA does not make source CI a role or Production readback PASS", () => {
  const sourceGuard = fs.readFileSync(path.join(root, "app", "control-device.server.ts"), "utf8");
  assert.match(sourceGuard, /if \(row\.status !== "approved"\)/);
  assert.match(sourceGuard, /DEVICE_PENDING/);
  assert.match(sourceGuard, /DEVICE_MISMATCH/);
  assert.match(sourceGuard, /isOwnerEmail\(email\)/);
  for (const admin of [
    "app/apps/bauman-master-ai/bauman-admin.tsx",
    "app/apps/price-report-tunggiabao/price-report-admin.tsx",
  ]) {
    const source = fs.readFileSync(path.join(root, admin), "utf8");
    assert.match(source, /if \(!access \|\| access\.status !== "approved"\)/, admin);
  }
});

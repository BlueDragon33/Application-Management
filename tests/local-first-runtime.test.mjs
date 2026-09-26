import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const auth = fs.readFileSync("app/chatgpt-auth.ts", "utf8");
const previewGate = fs.readFileSync("worker/preview-access.ts", "utf8");
const worker = fs.readFileSync("worker/index.ts", "utf8");
const vite = fs.readFileSync("vite.config.ts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const gitignore = fs.readFileSync(".gitignore", "utf8");
const localConfig = fs.readFileSync("wrangler.local.jsonc", "utf8");
const localExample = fs.readFileSync(".dev.vars.example", "utf8");
const cloudflareTemplate = fs.readFileSync("wrangler.cloudflare.example.jsonc", "utf8");
const standard = fs.readFileSync("docs/LOCAL_FIRST_RELEASE_STANDARD.md", "utf8");
const cloudflareTrack = fs.readFileSync("docs/CLOUDFLARE_DEPLOYMENT_TRACK.md", "utf8");
const launcher = fs.readFileSync("scripts/run-local.mjs", "utf8");
const systemLauncher = fs.readFileSync("scripts/run-local-system.mjs", "utf8");
const bat = fs.readFileSync("RUN_LOCAL.bat", "utf8");
const centerOnlyBat = fs.readFileSync("RUN_LOCAL_CENTER_ONLY.bat", "utf8");
const home = fs.readFileSync("app/page.tsx", "utf8");
const applicationHub = fs.readFileSync("app/application-hub.tsx", "utf8");
const localQuickAccess = fs.readFileSync("app/local-quick-access.tsx", "utf8");
const localWebLaunch = fs.readFileSync("app/api/local-web-launch/route.ts", "utf8");
const contractDiagnostics = fs.readFileSync("app/tools/contract-diagnostics/page.tsx", "utf8");

test("local auth is explicit and loopback-only", () => {
  assert.ok(auth.includes('runtime.LOCAL_DEV_AUTH !== "1"'));
  assert.ok(auth.includes("LOOPBACK_HOST.test(host)"));
  assert.match(auth, /localhost\|127\\\.0\\\.0\\\.1\|\\\[::1\\\]/);
  assert.equal(auth.includes("0.0.0.0"), false);
  assert.equal(auth.includes("terminal.local"), false);
  const chat = auth.indexOf("if (userId && email)");
  const local = auth.indexOf("const localUser = localDevelopmentUser");
  const failClosed = auth.indexOf("return null", local);
  assert.ok(chat >= 0 && local > chat && failClosed > local);
  assert.equal(auth.includes("getCloudflareAccessUser"), false);
});

test("local launchers keep isolated D1 and expose one-click full system startup", () => {
  assert.equal(pkg.scripts.dev, "vite");
  assert.equal(pkg.scripts.local, "node scripts/run-local.mjs");
  assert.ok(pkg.scripts["local:db"].includes("--local"));
  assert.ok(localConfig.includes('"migrations_dir": "drizzle"'));
  assert.ok(launcher.includes('"--local"'));
  assert.ok(launcher.includes('"127.0.0.1"'));
  assert.ok(bat.includes("scripts\\run-local-system.mjs --local"));
  assert.ok(centerOnlyBat.includes("scripts\\run-local.mjs"));
});

test("full local launcher tolerates sibling repos without npm lockfiles", () => {
  assert.ok(systemLauncher.includes("function hasNpmLockfile(cwd)"));
  assert.ok(systemLauncher.includes('"package-lock.json"'));
  assert.ok(systemLauncher.includes('"npm-shrinkwrap.json"'));
  assert.ok(systemLauncher.includes('const useCi = preferCi && hasNpmLockfile(cwd)'));
  assert.ok(systemLauncher.includes('[useCi ? "ci" : "install", "--no-audit", "--no-fund"]'));
  assert.ok(systemLauncher.includes("chưa có npm lockfile; chuyển an toàn từ npm ci sang npm install"));
});

test("Windows launchers invoke npm and npx through cmd.exe for Node 24 compatibility", () => {
  assert.ok(launcher.includes('process.env.ComSpec || "cmd.exe"'));
  assert.ok(launcher.includes('`${name}.cmd`'));
  assert.ok(launcher.includes('["/d", "/s", "/c", executable, ...args]'));
  assert.equal(launcher.includes('execFileSync(command(name), args'), false);
  assert.ok(systemLauncher.includes('process.env.ComSpec || "cmd.exe"'));
  assert.ok(systemLauncher.includes('/\\.cmd$/i.test(command)'));
  assert.ok(systemLauncher.includes('["/d", "/s", "/c", command, ...args]'));
  assert.ok(systemLauncher.includes('spawn(spec.file, spec.args'));
  assert.ok(systemLauncher.includes('spawnSync(spec.file, spec.args'));
});

test("secret generator is classified as Tool in Applications, not Settings", () => {
  assert.match(applicationHub, /id: "tool-secret-generator"/);
  assert.match(applicationHub, /category: "Tool"/);
  assert.match(applicationHub, /href: "\/tools\/secret-generator"/);
  assert.match(applicationHub, />Mở Tool ↗<\/Link>/);
  assert.match(applicationHub, />\{tool\.category\}<\/span>/);
  assert.match(applicationHub, /systemTools\.map\(\(tool\) => <option/);
  assert.equal(applicationHub.includes('className={styles.settingsAction} href="/tools/secret-generator"'), false);
  assert.equal(applicationHub.includes('<Link href="/tools/secret-generator">Tạo Key / Secret</Link>'), false);
  assert.equal(localQuickAccess.includes('href: "/tools/secret-generator"'), false);
});

test("management home uses verified local web launcher and compact device labels", () => {
  assert.match(home, /LocalQuickAccess/);
  assert.equal(home.includes('href="/tools/secret-generator"'), false);
  assert.equal(localQuickAccess.includes('position: "fixed"'), false);
  assert.match(localQuickAccess, /renameDeviceActions/);
  assert.match(localQuickAccess, /button\.textContent = "Tự động"/);
  assert.match(localQuickAccess, /button\.textContent = "Xóa hết"/);
  assert.match(localQuickAccess, /replacePendingWebCells/);
  assert.match(localQuickAccess, /\/api\/local-web-launch\?app=/);
  assert.equal(localQuickAccess.includes("http://127.0.0.1:3001"), false);
  assert.match(localQuickAccess, /Chưa có Web/);
  assert.match(localQuickAccess, /\/tools\/contract-diagnostics/);

  assert.match(localWebLaunch, /getChatGPTUser/);
  assert.match(localWebLaunch, /Local Web Launcher chỉ hoạt động trên localhost\/127\.0\.0\.1/);
  assert.match(localWebLaunch, /resolveClientOrigin\("nc03-runtime"\)/);
  assert.match(localWebLaunch, /Response\.redirect\(`\$\{resolved\.baseUrl\}\/`, 307\)/);
  assert.doesNotMatch(localWebLaunch, /nc03-modem[^\n]+127\.0\.0\.1:3010/);
  assert.match(localWebLaunch, /Response\.redirect\(target\.url, 307\)/);
  for (const port of [3001, 3002, 3004, 3005]) assert.ok(localWebLaunch.includes(`127.0.0.1:${port}`));

  assert.match(contractDiagnostics, /connectOperationsDashboard/);
  assert.match(contractDiagnostics, /item\.note/);
  assert.match(contractDiagnostics, /Trạng thái “Chờ contract” ở dashboard không được giả lập thành “Đã kết nối”/);
});

test("local secrets remain untracked and dev bindings are serve-only", () => {
  assert.ok(gitignore.split(/\r?\n/).includes(".dev.vars"));
  assert.ok(localExample.includes("LOCAL_DEV_AUTH=1"));
  assert.ok(localExample.includes("CONTROL_OWNER_EMAILS=local.owner@example.test"));
  assert.ok(vite.includes('if (command !== "serve") return undefined'));
  assert.ok(vite.includes('"LOCAL_DEV_AUTH"'));
});

test("Cloudflare preview never inherits the local auth bypass or Zero Trust dependency", () => {
  assert.equal(/"LOCAL_DEV_AUTH"\s*:/.test(cloudflareTemplate), false);
  assert.equal(cloudflareTemplate.includes("CF_ACCESS_TEAM_DOMAIN"), false);
  assert.equal(cloudflareTemplate.includes("CF_ACCESS_AUD"), false);
  assert.equal(cloudflareTemplate.includes("APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET"), false);
  assert.ok(gitignore.split(/\r?\n/).includes("wrangler.cloudflare.jsonc"));
  assert.ok(previewGate.includes("Authorization: Bearer <preview-secret>"));
  assert.ok(previewGate.includes("secretNeverInUrl"));
  assert.ok(worker.includes("APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET?: string"));
  assert.ok(cloudflareTrack.includes("application-level preview secret"));
  assert.ok(cloudflareTrack.includes("không phụ thuộc Cloudflare Zero Trust"));
});

test("release standard is GitHub -> local -> hosted, not publish-driven development", () => {
  for (const token of ["GitHub", "Local PC", "GitHub Desktop", "RUN_LOCAL.bat", "Gate trước khi publish", "Cloudflare track"]) {
    assert.ok(standard.includes(token), `missing release-standard token: ${token}`);
  }
});

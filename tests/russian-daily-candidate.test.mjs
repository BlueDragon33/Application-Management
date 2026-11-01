import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../public/russian-daily");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/i)?.[1];

function harness(options = {}) {
  const elements = new Map();
  const store = options.store ?? new Map();
  const exported = [];
  const tabs = ["home", "schedule", "vocab", "lock", "settings"].map(tab => ({
    dataset: { tab }, setAttribute(key, value) { this[key] = value; }, addEventListener(key, fn) { this[key] = fn; },
  }));
  function createElement() {
    const styles = new Set();
    return {
      value: "", files: [], innerHTML: "", textContent: "", checked: false,
      style: {}, dataset: {},
      classList: {
        contains(name) { return styles.has(name); },
        add(name) { styles.add(name); },
        remove(name) { styles.delete(name); },
        toggle(name, active) { if (active === undefined) active = !styles.has(name); active ? styles.add(name) : styles.delete(name); },
      },
      scrollIntoView() {}, setAttribute(key, value) { (this.attrs ??= {})[key] = value; }, focus() {}, remove() {}, append() {},
      addEventListener(key, fn) { this[key] = fn; },
      click() { this.onclick?.(); },
    };
  }
  const document = {
    documentElement: { dataset: { theme: "midnight" } },
    getElementById(id) { if (!elements.has(id)) elements.set(id, createElement()); return elements.get(id); },
    querySelectorAll() { return tabs; },
    createElement,
    body: { append() {} },
  };
  const localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => { if (options.blockWrite) throw Error("Storage unavailable"); store.set(key, value); } };
  const Blob = class { constructor(parts, options) { this.content = parts.join(""); this.type = options.type; exported.push(this); } };
  const URL = { createObjectURL: () => "blob:mock", revokeObjectURL() {} };
  new Function("document", "navigator", "localStorage", "window", "URL", "Blob", "SpeechSynthesisUtterance", "confirm", "alert", "location", script)(
    document, {}, localStorage, {}, URL, Blob, class {}, () => true, () => {}, { protocol: "http:" },
  );
  return { $: id => document.getElementById(id), exported, root: document.documentElement, store };
}

test("candidate manifest is isolated and zero-credential", () => {
  assert.ok(script, "Client JavaScript exists");
  assert.doesNotThrow(() => new Function(script));
  const manifest = JSON.parse(readFileSync(resolve(root, "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.id, "/russian-daily/");
  const sw = readFileSync(resolve(root, "sw.js"), "utf8");
  assert.match(sw, /\/russian-daily\//);
  assert.match(sw, /event\.respondWith\(fetch\(event\.request\)/, "Use network-first to avoid stale iPhone preview");
  assert.match(sw, /ASSETS = \["\.\/", "\.\/manifest\.webmanifest"/, "Cache the canonical directory index for offline iPhone access");
  assert.match(sw, /!response\.redirected/, "Never cache redirected Production login");
  assert.match(html, /id="includeSeed"/, "Default-off seeded export opt-in must exist");
  assert.match(html, /Chưa kết nối API/);
  assert.match(html, /chưa tự nhận dạng chữ trong ảnh/);
  assert.equal((html.match(/id="primaryAction"/g) ?? []).length, 1);
});

test("next action, ICS with one nightly reminder per day, manual import and five words", () => {
  const { $, exported } = harness();
  assert.equal(($("eventList").innerHTML.match(/data-edit=/g) ?? []).length, 7);
  $("primaryAction").onclick();
  assert.equal($("schedule").classList.contains("hide"), false);
  assert.equal($("scheduleGuide").classList.contains("hide"), false);
  $("exportIcs").onclick();
  assert.equal(exported.length, 0, "Do not duplicate existing Google Calendar lessons");
  assert.match($("exportStatus").textContent, /Chưa có buổi mới/);
  $("includeSeed").checked = true;
  $("exportIcs").onclick();
  const ics = exported.find(item => item.type.startsWith("text/calendar"))?.content;
  assert.ok(ics);
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 11);
  assert.equal((ics.match(/UID:night-/g) ?? []).length, 4);
  assert.equal((ics.match(/BEGIN:VALARM/g) ?? []).length, 16);
  assert.match(ics, /DTSTART;TZID=Europe\/Moscow:20261103T101500/);
  assert.match(ics, /DTSTART;TZID=Europe\/Moscow:20261102T210000/);
  $("includeSeed").checked = false;
  $("telegramText").value = "31/02/2026 10:15-11:50 phòng 9999\n03/11/2026 25:99-26:88 phòng 7777\n07/11/2026 10:15-11:50 phòng 0209";
  $("parseTelegram").onclick();
  assert.match($("draftList").innerHTML, /0209/);
  assert.doesNotMatch($("draftList").innerHTML, /9999|7777/, "Reject bad dates and clock times");
  $("confirmDraft").onclick();
  $("exportIcs").onclick();
  const newIcs = exported.at(-1).content;
  assert.equal((newIcs.match(/BEGIN:VEVENT/g) ?? []).length, 2);
  assert.equal((newIcs.match(/UID:night-/g) ?? []).length, 1);
  assert.doesNotMatch(newIcs, /stankin-202611-/);
  assert.match($("eventList").innerHTML, /0209/);
  for (let i = 0; i < 7; i++) $("markWord").onclick();
  assert.equal($("counter").textContent, "5/5");
});


test("rejects malformed JSON restore without replacing local lessons", async () => {
  const { $ } = harness();
  const before = $("eventList").innerHTML;
  const malformed = JSON.stringify({events:[{id:"malformed\\r\\n",date:"2026-02-31",title:"Unsafe",room:"0204",start:"25:99",end:"26:00"}]});
  await $("restoreJson").onchange({target:{files:[{text:async()=>malformed}]}});
  assert.match($("savedPrefs").textContent, /không hợp lệ/);
  assert.equal($("eventList").innerHTML, before);
});


test("Russian Daily uses canonical trailing slash after existing Preview and Production authentication", () => {
  const worker = readFileSync(resolve(here, "../worker/index.ts"), "utf8");
  const entry = readFileSync(resolve(here, "../app/tools/russian-daily/page.tsx"), "utf8");
  const previewGate = worker.indexOf("previewRequestAuthorized(request, env.APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET)");
  const productionGate = worker.indexOf("const identity = await productionIdentity(request, env)");
  const alias = worker.indexOf('url.pathname === "/russian-daily" || url.pathname === "/russian-daily/index.html"');
  const canonical = worker.indexOf('url.pathname === "/russian-daily/")');
  const generalStatic = worker.indexOf('if ((isPreview || isProduction) && isCloudflareClientAsset(request, url))');
  assert.ok(previewGate > 0 && productionGate > previewGate);
  assert.ok(alias > productionGate && canonical > alias && generalStatic > canonical,
    "Both canonical routes must follow the existing login gates and precede generic static handling");

  const aliasBlock = worker.slice(alias, canonical);
  const canonicalBlock = worker.slice(canonical, generalStatic);
  assert.match(aliasBlock, /Response\.redirect\(new URL\("\/russian-daily\/", request\.url\)\.toString\(\), 308\)/);
  assert.doesNotMatch(aliasBlock, /Response\.redirect\(new URL\("\/russian-daily\/index\.html"/,
    "Never redirect the canonical folder URL back to index.html");
  assert.match(canonicalBlock, /env\.ASSETS\.fetch\(request\)/,
    "The trailing-slash URL must serve the index via the existing ASSETS binding");
  assert.doesNotMatch(canonicalBlock, /Response\.redirect\(/);
  assert.match(entry, /href="\/russian-daily\/"/);
  assert.doesNotMatch(entry, /href="\/russian-daily\/index\.html"/);
  assert.doesNotMatch(worker.slice(worker.indexOf("function isPublicPwaAsset"), worker.indexOf("function isCloudflareClientAsset")), /russian-daily/,
    "Do not allow unauthenticated Russian Daily static assets");

  // Cloudflare's documented default HTML handling maps directory/index.html to directory/.
  // The old Worker redirected directory/ back to index.html, creating ERR_TOO_MANY_REDIRECTS.
  // Guard the resulting canonical route as a single terminating path.
  function route(path) {
    if (path === "/russian-daily" || path === "/russian-daily/index.html") return "/russian-daily/";
    if (path === "/russian-daily/") return "200 HTML from ASSETS";
    throw Error("Unexpected route " + path);
  }
  for (const path of ["/russian-daily", "/russian-daily/index.html", "/russian-daily/"]) {
    let current = path;
    const visited = new Set();
    while (current !== "200 HTML from ASSETS") {
      assert.equal(visited.has(current), false, "Redirect cycle detected for " + path);
      visited.add(current);
      current = route(current);
    }
    assert.ok(visited.size <= 2, "At most one HTTP redirect is allowed");
  }
});

test("same-origin deployment requires existing authentication and retains offline publish hold", () => {
  const worker = readFileSync(resolve(here, "../worker/index.ts"), "utf8");
  const preview = readFileSync(resolve(here, "../.github/workflows/deploy-application-management-preview.yml"), "utf8");
  const prod = readFileSync(resolve(here, "../.github/workflows/deploy-application-management-production.yml"), "utf8");
  assert.match(worker, /url\.pathname === "\/russian-daily\/index\.html"/);
  assert.match(worker, /isPreview \|\| isProduction/);
  assert.doesNotMatch(worker.slice(worker.indexOf("function isPublicPwaAsset"), worker.indexOf("function isCloudflareClientAsset")), /russian-daily/);
  assert.match(preview, /deploy-preview:\n(?:    #[^\n]*\n)*    if: \$\{\{ false \}\}/);
  assert.match(prod, /inputs\.release_revision == github\.sha/);
  assert.match(prod, /inputs\.confirm == 'DEPLOY_PRODUCTION'/);
});

test("premium Russian Daily UI offers persistent dark and light themes without changing app behavior", () => {
  const { $, root } = harness();
  assert.match(html, /data-theme="midnight"/);
  assert.match(html, /class="brandMark"/);
  assert.equal((html.match(/class="tabIcon"/g) ?? []).length, 5);
  assert.match(html, /prefers-reduced-motion:reduce/);
  assert.equal(root.dataset.theme, "midnight");
  assert.equal($("visualTheme").value, "midnight");
  $("visualTheme").value = "snow";
  $("savePrefs").onclick();
  assert.equal(root.dataset.theme, "snow");
  assert.equal($("themeColor").attrs.content, "#eff4fb");
  assert.match($("savedPrefs").textContent, /Đã lưu trên thiết bị/);
  $("visualTheme").value = "midnight";
  $("savePrefs").onclick();
  assert.equal(root.dataset.theme, "midnight");
  assert.equal($("themeColor").attrs.content, "#081322");
  assert.equal(($("eventList").innerHTML.match(/data-edit=/g) ?? []).length, 7);
});

test("premium themes persist across reloads with original localStorage keys", () => {
  const store = new Map();
  const first = harness({ store });
  first.$("visualTheme").value = "snow";
  first.$("savePrefs").onclick();
  assert.equal(first.root.dataset.theme, "snow");
  assert.ok(store.has("russian-daily-03-prefs"), "Keep the original preferences key");
  assert.equal(JSON.parse(store.get("russian-daily-03-prefs")).visualTheme, "snow");
  const second = harness({ store });
  assert.equal(second.root.dataset.theme, "snow");
  assert.equal(second.$("visualTheme").value, "snow");
  assert.equal((second.$("eventList").innerHTML.match(/data-edit=/g) ?? []).length, 7);
});

test("blocked Safari storage must never claim theme changes were persisted", () => {
  const { $, root } = harness({ blockWrite: true });
  $("visualTheme").value = "snow";
  $("savePrefs").onclick();
  assert.equal(root.dataset.theme, "snow", "Allow temporary in-memory theme preview");
  assert.match($("savedPrefs").textContent, /Không lưu được/);
  assert.doesNotMatch($("savedPrefs").textContent, /Đã lưu trên thiết bị/);
});

test("restoring a backup applies theme and preserves existing offline data keys", async () => {
  const { $, root, store } = harness();
  const backup = {
    version: 3,
    events: [{id:"recovered-1",date:"2026-11-08",title:"Tiếng Nga",room:"0201",start:"10:15",end:"11:50"}],
    prefs: {visualTheme:"snow",night:true,min60:true,min15:true,wordsNotifications:true,daily:5},
    progress: {day:"",count:0,offset:0}
  };
  await $("restoreJson").onchange({target:{files:[{text:async()=>JSON.stringify(backup)}]}});
  assert.equal(root.dataset.theme, "snow");
  assert.equal($("visualTheme").value, "snow");
  assert.equal(JSON.parse(store.get("russian-daily-03-events")).length, 1);
  assert.match($("savedPrefs").textContent, /Đã khôi phục/);
});

test("Polar Day buttons and small labels meet accessible text contrast", () => {
  // White-text endpoints of the light-theme primary gradient must both be >= WCAG AA 4.5:1.
  function luminance(hex) {
    const rgb = hex.slice(1).match(/../g).map(part => Number.parseInt(part, 16) / 255);
    const linear = rgb.map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  }
  const ratio = (first, second) => {
    const a = luminance(first), b = luminance(second);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  assert.match(html, /linear-gradient\(110deg,#0d6f9e,#08766f\)/);
  assert.ok(ratio("#ffffff", "#0d6f9e") >= 4.5);
  assert.ok(ratio("#ffffff", "#08766f") >= 4.5);
  assert.ok(ratio("#a0b3cd", "#14243a") >= 4.5);
  assert.ok(ratio("#5a718e", "#ffffff") >= 4.5);
  assert.equal((html.match(/class="tabIcon"/g) ?? []).length, 5);
  assert.match(html, /aria-label="Điều hướng"/);
});

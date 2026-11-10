import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("academic routes inherit existing Application Management login gate", () => {
  const thesis = file("app/tools/thesis-planner/page.tsx");
  const coursework = file("app/apps/coursework-workbench/page.tsx");
  assert.match(thesis, /requireChatGPTUser\("\/tools\/thesis-planner"\)/);
  assert.match(coursework, /requireChatGPTUser\("\/apps\/coursework-workbench"\)/);
});

test("launcher lists both academic workspaces without connected client claim", () => {
  const launcher = file("app/management-dashboard-v2.tsx");
  assert.match(launcher, /id: "tool-thesis-planner"/);
  assert.match(launcher, /href: "\/tools\/thesis-planner"/);
  assert.match(launcher, /id: "tool-coursework-workbench"/);
  assert.match(launcher, /href: "\/apps\/coursework-workbench"/);
});

test("two independent local stores, scoped by account, with a backup path", () => {
  const thesis = file("app/tools/thesis-planner/thesis-planner.tsx");
  const coursework = file("app/apps/coursework-workbench/coursework-workbench.tsx");
  assert.match(thesis, /application-management:thesis-planner:v1:/);
  assert.match(coursework, /application-management:coursework-workbench:v1:/);
  for (const source of [thesis, coursework]) {
    assert.match(source, /encodeURIComponent\(user\.email/);
    assert.match(source, /localStorage\.setItem/);
    assert.match(source, /JSON\.parse\(await file\.text\(\)\)/);
    assert.match(source, /URL\.createObjectURL/);
    assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|navigator\.sendBeacon/);
  }
});

test("evidence state requires a nonempty user-entered evidence reference", () => {
  const thesis = file("app/tools/thesis-planner/thesis-planner.tsx");
  const coursework = file("app/apps/coursework-workbench/coursework-workbench.tsx");
  assert.match(thesis, /value === "evidence" && !current\.evidence\.trim\(\)/);
  assert.match(coursework, /value === "evidence" && !prior\.evidence\.trim\(\)/);
});

test("academic modules keep independent domain schemas and per-account hydration guards", () => {
  const thesis = file("app/tools/thesis-planner/thesis-planner.tsx");
  const coursework = file("app/apps/coursework-workbench/coursework-workbench.tsx");
  for (const source of [thesis, coursework]) {
    assert.match(source, /loadedKey !== storageKey/);
    assert.match(source, /setStorageBlocked\(true\)/);
    assert.match(source, /addEventListener\("storage", onStorage\)/);
    assert.match(source, /if \(loadedKey !== storageKey\) return/);
  }
  assert.match(thesis, /thesis-domain\.mjs/);
  assert.match(coursework, /coursework-domain\.mjs/);
  assert.doesNotMatch(thesis, /coursework-domain\.mjs/);
  assert.doesNotMatch(coursework, /thesis-domain\.mjs/);
});

test("constitutional guidance is a single actionable CTA scoped to current workflow", () => {
  const thesis = file("app/tools/thesis-planner/thesis-planner.tsx");
  const coursework = file("app/apps/coursework-workbench/coursework-workbench.tsx");
  assert.equal((thesis.match(/HƯỚNG DẪN \/ MỞ VIỆC TIẾP THEO/g) ?? []).length, 1);
  assert.equal((coursework.match(/HƯỚNG DẪN \/ MỞ VIỆC TIẾP THEO/g) ?? []).length, 1);
  for (const source of [thesis, coursework]) {
    assert.match(source, /onClick={openNextAction}/);
    assert.match(source, /aria-expanded={guideOpen}/);
    assert.match(source, /scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/);
    assert.match(source, /focus\(\{ preventScroll: true \}\)/);
    assert.match(source, /Không tự/);
    assert.doesNotMatch(source, /mark.*as.*PASS|automaticallyApproved/);
  }
  assert.match(thesis, /"thesis-task-" \+ next\.id/);
  assert.match(thesis, /"thesis-academic-review"/);
  assert.match(coursework, /"coursework-create"/);
  assert.match(coursework, /"coursework-stage-" \+ next\.id/);
  assert.match(coursework, /"coursework-submission-review"/);
});

test("guidance button has its own focus and mobile layout", () => {
  const thesisCss = file("app/tools/thesis-planner/thesis-planner.module.css");
  const courseworkCss = file("app/apps/coursework-workbench/coursework-workbench.module.css");
  assert.match(thesisCss, /\.guideButton:focus-visible/);
  assert.match(courseworkCss, /\.guideButton:focus-visible/);
  assert.match(courseworkCss, /@media\(max-width:650px\)/);
});

test("local-only Chromium QA script is syntactically valid and fail-closed on revision and origin", async () => {
  const { execFileSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const filename = fileURLToPath(new URL("../scripts/academic-workspaces-browser-qa.mjs", import.meta.url));
  assert.doesNotThrow(() => execFileSync(process.execPath, ["--check", filename], { encoding: "utf8" }));
  const source = file("scripts/academic-workspaces-browser-qa.mjs");
  assert.match(source, /assert\.equal\(actual, expected/);
  assert.match(source, /git", \["status", "--porcelain"/);
  assert.match(source, /const origin = "http:\/\/127\.0\.0\.1:3000"/);
  assert.match(source, /if \(u\.origin !== origin\) return route\.abort/);
  assert.match(source, /await import\("playwright"\)/);
  assert.match(source, /PASS_LOCAL_CHROMIUM_ONLY/);
  assert.match(source, /Physical iPhone Safari/);
  assert.match(source, /scrollWidth <= data\.clientWidth \+ 1/);
  assert.match(source, /schema, "thesis-planner\/v1"/);
  assert.match(source, /schema, "coursework-workbench\/v1"/);
  assert.doesNotMatch(source, /wrangler deploy|gh workflow run|https:\/\/application-management|CLOUDFLARE_API_TOKEN/);
});

test("mobile regression runner is syntax-valid and local-only with exact revision gate", async () => {
  const { execFileSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const filename = fileURLToPath(new URL("../scripts/academic-thesis-mobile-regression.mjs", import.meta.url));
  assert.doesNotThrow(() => execFileSync(process.execPath, ["--check", filename], {encoding:"utf8"}));
  const script = file("scripts/academic-thesis-mobile-regression.mjs");
  assert.match(script, /assert\.equal\(execFileSync\("git", \["rev-parse", "HEAD"\]/);
  assert.match(script, /git", \["status", "--porcelain"/);
  assert.match(script, /const origin = "http:\/\/127\.0\.0\.1:3000"/);
  assert.match(script, /route\.abort\("blockedbyclient"\)/);
  assert.match(script, /Guide before long form and milestones/);
  assert.match(script, /Desktop guide stays right sidebar/);
  assert.doesNotMatch(script, /wrangler deploy|gh workflow run|CLOUDFLARE_API_TOKEN|https:\/\/application-management/);
});

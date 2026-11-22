// Opt-in targeted Chromium regression: mobile Thesis Next Action must be visible near page top.
// Requires the Owner's already installed local Playwright and local server on 127.0.0.1:3000.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
assert.equal(args.length, 2, "Use --sha <exact-40-character-SHA>");
assert.equal(args[0], "--sha");
const expectedSha = args[1];
assert.match(expectedSha, /^[a-f0-9]{40}$/);
assert.equal(execFileSync("git", ["rev-parse", "HEAD"], {encoding:"utf8"}).trim(), expectedSha);
assert.equal(execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {encoding:"utf8"}).trim(), "");
const origin = "http://127.0.0.1:3000";
const outDir = mkdtempSync(path.join(tmpdir(), "academic-thesis-mobile-"));
const checks = [], errors = [], pageErrors = [];
function record(name, pass, observed) {
  checks.push({name,pass,observed});
  console.log((pass ? "PASS " : "FAIL ") + name + " — " + observed);
  if (!pass) errors.push(name + ": " + observed);
}
let browser;
try {
  const { chromium } = await import("playwright");
  browser = await chromium.launch({headless:true});
  const context = await browser.newContext({locale:"vi-VN",viewport:{width:320,height:900}});
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    return url.origin === origin ? route.continue() : route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.on("pageerror", error => pageErrors.push(error.message));
  const response = await page.goto(origin + "/tools/thesis-planner", {waitUntil:"domcontentloaded",timeout:45000});
  assert.equal(response?.status(), 200);
  await page.getByRole("heading",{name:/Thesis Planner/}).waitFor({state:"visible"});
  for (const width of [320,375,430,768,1280]) {
    await page.setViewportSize({width,height:900});
    await page.evaluate(() => window.scrollTo(0,0));
    const v = await page.evaluate(() => {
      const aside = document.querySelector("aside");
      const guide = document.querySelector('[aria-label="Hướng dẫn bước tiếp theo"]');
      const form = [...document.querySelectorAll("section")].find(el => el.querySelector("h2")?.textContent?.startsWith("Thông tin đề tài"));
      const first = document.getElementById("thesis-task-scope");
      if (!aside || !guide || !form || !first) throw new Error("Missing Thesis elements");
      const a=aside.getBoundingClientRect(),g=guide.getBoundingClientRect();
      const f=form.getBoundingClientRect(),m=first.getBoundingClientRect();
      return { guideTop:g.top,guideBottom:g.bottom,formTop:f.top,formLeft:f.left,
        milestoneTop:m.top,asideLeft:a.left,scrollWidth:document.documentElement.scrollWidth,
        viewport:document.documentElement.clientWidth,guideButton:!!guide.querySelector("button") };
    });
    record("No horizontal overflow " + width, v.scrollWidth<=v.viewport+1,
      String(v.scrollWidth)+"/"+String(v.viewport));
    if (width<=780) {
      record("Guide before long form and milestones " + width,
        v.guideTop<v.formTop && v.guideBottom<v.milestoneTop && v.guideBottom<=900 && v.guideButton,
        JSON.stringify({guideTop:Math.round(v.guideTop),guideBottom:Math.round(v.guideBottom),
          formTop:Math.round(v.formTop),milestoneTop:Math.round(v.milestoneTop)}));
    } else {
      record("Desktop guide stays right sidebar " + width,
        v.asideLeft>v.formLeft && v.guideButton,
        JSON.stringify({asideLeft:Math.round(v.asideLeft),formLeft:Math.round(v.formLeft)}));
    }
    await page.screenshot({path:path.join(outDir,"thesis-"+width+"-postfix.png"),fullPage:true});
  }
  await page.setViewportSize({width:320,height:900});
  await page.getByRole("button",{name:"HƯỚNG DẪN / MỞ VIỆC TIẾP THEO"}).click();
  const focusOk=await page.evaluate(() => document.activeElement?.id==="thesis-task-scope");
  record("Mobile CTA still focuses first milestone",focusOk,String(focusOk));
  record("No browser pageerrors",pageErrors.length===0,JSON.stringify(pageErrors));
  await context.close();
} catch (error) {
  errors.push(String(error?.stack ?? error));
  console.error("Targeted browser QA failed: "+String(error?.stack ?? error));
} finally {
  if (browser) await browser.close();
  writeFileSync(path.join(outDir,"thesis-mobile-qa-report.json"),JSON.stringify({
    sourceRevision:expectedSha,origin,status:errors.length?"FAIL":"PASS_TARGETED_CHROMIUM_ONLY",
    checks,errors,pageErrors,
    pending:["Physical iPhone Safari","VoiceOver","Independent human reviewer","Full gradient WCAG"],
  },null,2));
  console.log("Targeted QA evidence: "+outDir);
  console.log("Status: "+(errors.length?"FAIL":"PASS_TARGETED_CHROMIUM_ONLY"));
  if (errors.length) process.exitCode=1;
}

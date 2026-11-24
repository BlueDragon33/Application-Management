import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer as reserveServer } from "node:net";
import path from "node:path";
import { chromium, devices } from "playwright";
import { createServer } from "vite";

const trainerPath = "/tools/russian-time-trainer";
const evidence = path.resolve(process.env.RUNNER_TEMP ?? "test-results", "russian-time-trainer");
const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
assert.ok(!existsSync(".dev.vars") && !existsSync(".env"), "Use an isolated QA checkout");
if (process.env.TRAINER_QA_EXPECTED_SHA) assert.equal(sha, process.env.TRAINER_QA_EXPECTED_SHA);

const results = [];
let screenshots = 0;
let browser;
let page;
let browserVersion;

function pass(name, detail) {
  results.push({ name, status: "PASS", ...(detail ? { detail } : {}) });
  console.log(JSON.stringify(results.at(-1)));
}

async function screenshot(page, label) {
  await page.screenshot({ path: path.join(evidence, String(++screenshots).padStart(2, "0") + "-" + label + ".png") });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const reservation = reserveServer();
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", () => {
      const port = reservation.address().port;
      reservation.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function withRuntime(authenticated, run) {
  Object.assign(process.env, {
    APP_RUNTIME: "local",
    CONTROL_PLANE_NETWORK_MODE: "local",
    LOCAL_DEV_AUTH: authenticated ? "1" : "0",
    LOCAL_DEV_USER_ID: "russian-time-trainer-qa",
    LOCAL_DEV_USER_EMAIL: "russian-time-trainer@example.test",
    LOCAL_DEV_USER_NAME: "Trainer QA",
    WRANGLER_SEND_METRICS: "false",
    WRANGLER_WRITE_LOGS: "false",
  });
  delete process.env.CONTROL_OWNER_EMAILS;
  const port = await freePort();
  const server = await createServer({
    logLevel: "warn",
    clearScreen: false,
    server: { host: "127.0.0.1", port, strictPort: true, hmr: false },
  });
  try {
    await server.listen();
    assert.equal(server.httpServer.address().address, "127.0.0.1");
    await run("http://127.0.0.1:" + port);
  } finally {
    await server.close();
  }
}

const translate = page => page.getByRole("button", { name: "Translate Перевести", exact: true }).first();
const help = page => page.getByRole("button", { name: "Help Помощь", exact: true });
const translations = page => page.getByRole("dialog", { name: "Translation Перевод" });
const examples = page => page.getByRole("region", { name: /Worked examples/ });
const practice = page => page.getByRole("button", { name: "Practice Практика", exact: true });
const progress = page => page.getByRole("button", { name: "Progress Прогресс", exact: true });
const word = page => examples(page).locator("[data-study-word='Который']").first();

async function defaultLanguages(page) {
  assert.equal(await page.locator("main [lang=vi]").count(), 0);
  assert.equal(await page.locator("main").getAttribute("lang"), "en");
  assert.ok(await page.locator("main span[lang=ru]").count());
}

async function selectPhrase(page) {
  const line = examples(page).locator("[data-study-text]").filter({ hasText: "Который час?" }).first();
  const actual = await line.evaluate(element => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return selection.toString().trim();
  });
  assert.equal(actual, "Который час?");
}

async function noOverflow(page, width) {
  const metrics = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  assert.ok(metrics.document <= width && metrics.viewport <= width, JSON.stringify(metrics));
}

async function makeContext(origin, options) {
  const context = await browser.newContext({ ...options, reducedMotion: "reduce", serviceWorkers: "block" });
  await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  return context;
}

async function focusRestored(locator) {
  await locator.and(locator.page().locator(":focus")).waitFor();
}

async function checkAudioContract(origin) {
  const context = await makeContext(origin, { viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  const speechPage = page;
  await speechPage.addInitScript(() => {
    class Utterance {
      constructor(text) { this.text = text; }
    }
    const voice = { lang: "ru-RU", localService: true };
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: Utterance });
    Object.defineProperty(window, "speechSynthesis", { value: {
      getVoices: () => [{ lang: "ru-RU", localService: false }, voice],
      speak(utterance) {
        window.trainerQASpeech = { text: utterance.text, lang: utterance.lang, local: utterance.voice.localService };
        utterance.onstart();
      },
      cancel() {},
    } });
  });
  await speechPage.goto(origin + trainerPath);
  await speechPage.waitForFunction(() => document.documentElement.lang === "en");
  assert.ok(await speechPage.evaluate(() => speechSynthesis.getVoices().some(voice => voice.localService && voice.lang === "ru-RU")));
  await speechPage.getByRole("button", { name: "Listen: Который час?" }).click();
  await speechPage.getByRole("status").filter({ hasText: "Playing Russian audio." }).waitFor();
  assert.deepEqual(await speechPage.evaluate(() => window.trainerQASpeech), { text: "Который час?", lang: "ru-RU", local: true });
  await context.close();
  pass("Russian pronunciation uses the local ru-RU voice when present", { testDouble: true, audiblePlayback: "UNVERIFIED" });
}

async function exerciseDesktop(origin) {
  const desktop = await makeContext(origin, { viewport: { width: 1440, height: 900 } });
  await desktop.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  page = await desktop.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const home = await page.goto(origin + "/?view=applications");
  assert.equal(home.status(), 200);
  const link = page.locator("a[href='" + trainerPath + "']").first();
  if (!(await link.isVisible())) await page.getByRole("button", { name: /Russian Time Trainer/ }).first().click();
  await link.click();
  await page.waitForURL(url => url.pathname === trainerPath);
  await page.waitForFunction(() => document.documentElement.lang === "en");
  await page.getByRole("heading", { name: "Russian Time Trainer", exact: true }).waitFor();
  await defaultLanguages(page);
  await noOverflow(page, 1440);
  await screenshot(page, "desktop-immersion");
  pass("Desktop 1440×900 normal Tool launcher, default EN/RU and no overflow");

  await word(page).hover();
  await page.locator("aside [lang=vi]").filter({ hasText: "gì, nào" }).waitFor();
  await page.keyboard.press("Escape");
  await defaultLanguages(page);
  await selectPhrase(page);
  await translate(page).click();
  await translations(page).locator("[lang=vi]").filter({ hasText: "Bây giờ là mấy giờ?" }).waitFor();
  await page.keyboard.press("Escape");
  await focusRestored(translate(page));
  await defaultLanguages(page);
  pass("Desktop hover, selected phrase Translate, Escape and focus restoration");

  await page.keyboard.press("Enter");
  const input = translations(page).getByRole("textbox", { name: /Word or phrase/ });
  await input.fill("half past eight");
  await page.keyboard.press("Enter");
  await translations(page).locator("[lang=vi]").filter({ hasText: "tám giờ rưỡi" }).waitFor();
  await page.keyboard.press("Escape");
  await translations(page).waitFor({ state: "hidden" });
  await focusRestored(translate(page));
  await page.keyboard.press("Tab");
  await focusRestored(help(page));
  const outline = await help(page).evaluate(element => getComputedStyle(element).outlineStyle);
  assert.notEqual(outline, "none");
  pass("Keyboard-only translation and visible keyboard focus");

  await page.getByRole("button", { name: "Listen: Который час?" }).click();
  const russianVoices = await page.evaluate(() => window.speechSynthesis?.getVoices()
    .filter(voice => voice.localService && /^ru(?:-|$)/i.test(voice.lang)).length ?? 0);
  if (!russianVoices) {
    await page.getByRole("status").filter({ hasText: "No Russian device voice" }).waitFor();
    await page.getByText("Кото́рый ча́с?", { exact: true }).waitFor();
    pass("Russian pronunciation without an installed voice shows the stress guide");
  }

  await practice(page).click();
  await page.getByRole("button", { name: "Во сколько начинается урок?", exact: true }).click();
  await page.getByText("Проверьте нужную фразу").waitFor();
  await page.getByRole("button", { name: /Try again/ }).click();
  await page.getByRole("button", { name: "Который час?", exact: true }).click();
  await page.getByRole("status").getByText("Верно", { exact: true }).waitFor();
  await page.getByRole("button", { name: /Russian to English/ }).click();
  await page.getByRole("button", { name: "What time is it?", exact: true }).click();
  await page.getByRole("status").getByText("Верно", { exact: true }).waitFor();
  await progress(page).click();
  assert.equal(await page.getByText("2/24", { exact: true }).count(), 2);
  await page.getByRole("button", { name: /^Half and quarter hours/ }).click();
  await page.reload();
  await page.getByRole("button", { name: /^Half and quarter hours/ }).and(page.locator("[aria-current=step]")).waitFor();
  await progress(page).click();
  assert.equal(await page.getByText("2/24", { exact: true }).count(), 2);
  await page.getByText("Saved on this device", { exact: false }).waitFor();
  await defaultLanguages(page);
  pass("Bidirectional practice, corrective feedback and progress restored on reload");

  await help(page).focus();
  await page.keyboard.press("Enter");
  const assistance = page.getByRole("dialog", { name: "Help Помощь" });
  const preview = assistance.getByRole("textbox", { name: /Prompt preview/ });
  const copy = assistance.getByRole("button", { name: /Copy reviewed prompt/ });
  const review = assistance.getByRole("button", { name: /Mark reviewed/ });
  assert.match(await preview.inputValue(), /progress view for the lesson “Half and quarter hours”/);
  assert.ok(await copy.isDisabled());
  const requirements = assistance.getByRole("textbox", { name: /Additional requirements/ });
  await requirements.fill("Verify the Russian pronunciation workflow.");
  await review.click();
  assert.ok(await copy.isEnabled());
  await requirements.fill("Verify local Russian voice and keyboard focus.");
  assert.ok(await copy.isDisabled());
  await review.click();
  await copy.click();
  await assistance.getByRole("status").filter({ hasText: "Prompt copied." }).waitFor();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(clipboard.replace(/\r\n/g, "\n"), await preview.inputValue());
  assert.match(clipboard, /Verify local Russian voice and keyboard focus/);
  await screenshot(page, "desktop-prompt-review");
  await page.keyboard.press("Escape");
  await focusRestored(help(page));
  pass("Help prompt generation, requirements, review invalidation, clipboard and focus");

  for (const width of [800, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow(page, width);
  }
  assert.deepEqual(errors, []);
  pass("800px and 320px layout without horizontal overflow");
  await desktop.close();
}

async function exerciseMobile(origin) {
  const phone = await makeContext(origin, { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } });
  page = await phone.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  assert.equal((await page.goto(origin + trainerPath)).status(), 200);
  await page.waitForFunction(() => document.documentElement.lang === "en");
  await defaultLanguages(page);
  await noOverflow(page, 390);
  await screenshot(page, "mobile-immersion");

  await word(page).tap();
  await defaultLanguages(page);
  const box = await word(page).boundingBox();
  const pointer = await phone.newCDPSession(page);
  await pointer.send("Input.dispatchTouchEvent", {
    type: "touchStart", touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
  });
  try {
    await page.locator("aside [lang=vi]").filter({ hasText: "gì, nào" }).waitFor();
  } finally {
    await pointer.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  await screenshot(page, "mobile-word");
  await page.getByRole("button", { name: "Dismiss translation" }).tap();
  await defaultLanguages(page);
  pass("Mobile 390×844 normal tap stays immersive and touch long-press reveals a word");

  await selectPhrase(page);
  await translate(page).tap();
  await translations(page).locator("[lang=vi]").filter({ hasText: "Bây giờ là mấy giờ?" }).waitFor();
  await screenshot(page, "mobile-phrase");
  await translations(page).getByRole("button", { name: "Close translation" }).tap();
  await translations(page).waitFor({ state: "hidden" });
  await page.locator("main [lang=vi]").first().waitFor({ state: "detached" });
  await defaultLanguages(page);
  await help(page).tap();
  await page.getByRole("dialog", { name: "Help Помощь" }).getByRole("textbox", { name: /Prompt preview/ }).waitFor();
  await page.getByRole("button", { name: "Close help" }).tap();
  pass("Mobile Translate opens the selected phrase and Help opens by touch", { selection: "DOM Range in Chromium touch emulation" });

  const accessibility = await page.evaluate(() => {
    // Help renders its dialog inside the header. Measure the two header triggers.
    const buttons = [...document.querySelectorAll("main > header button")]
      .filter(button => !button.closest("dialog") && button.checkVisibility());
    const linearize = x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4;
    const luminance = color => color.match(/\d+/g).slice(0, 3).map(n => linearize(+n / 255))
      .reduce((total, value, i) => total + value * [.2126, .7152, .0722][i], 0);
    const ratios = buttons.map(button => {
      const style = getComputedStyle(button);
      const pair = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => b - a);
      return (pair[0] + .05) / (pair[1] + .05);
    });
    const longestMotionMs = Math.max(...buttons.flatMap(button => {
      const style = getComputedStyle(button);
      return [style.transitionDuration, style.animationDuration]
        .flatMap(duration => duration.split(",").map(value => parseFloat(value) * 1000));
    }));
    return {
      controls: buttons.length,
      contrast: Math.min(...ratios),
      height: Math.min(...buttons.map(button => button.getBoundingClientRect().height)),
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      longestMotionMs,
    };
  });
  assert.equal(accessibility.controls, 2, JSON.stringify(accessibility));
  assert.ok(accessibility.contrast >= 4.5 && accessibility.height >= 44, JSON.stringify(accessibility));
  // The shared shell's reduced-motion stylesheet caps these durations at .001ms.
  assert.ok(accessibility.reducedMotion && accessibility.longestMotionMs <= 0.001, JSON.stringify(accessibility));
  assert.deepEqual(errors, []);
  pass("Header controls meet computed text contrast and target size in reduced motion", accessibility);
  await phone.close();
}

await mkdir(evidence, { recursive: true });
try {
  await withRuntime(false, async origin => {
    const response = await fetch(origin + trainerPath, { redirect: "manual", signal: AbortSignal.timeout(20000) });
    assert.equal(response.status, 307);
    const location = new URL(response.headers.get("location"), origin);
    assert.equal(location.origin, origin);
    assert.equal(location.pathname, "/signin-with-chatgpt");
    assert.equal(location.searchParams.get("return_to"), trainerPath);
    pass("Trainer route follows the existing anonymous sign-in gate");
  });
  browser = await chromium.launch({ channel: process.env.TRAINER_QA_BROWSER || undefined });
  browserVersion = browser.version();
  console.log(JSON.stringify({ sha, node: process.version, browserVersion }));
  await withRuntime(true, async origin => {
    for (const [group, verify] of [
      ["desktop", exerciseDesktop],
      ["mobile", exerciseMobile],
      ["speech-contract", checkAudioContract],
    ]) {
      try {
        await verify(origin);
      } catch (error) {
        if (page && !page.isClosed()) await screenshot(page, group + "-failure").catch(() => {});
        results.push({ name: group, status: "FAIL", error: error.message });
        console.error(group, error);
        process.exitCode = 1;
      }
    }
  });
} catch (error) {
  if (page && !page.isClosed()) await screenshot(page, "failure").catch(() => {});
  results.push({ status: "FAIL", error: error.message });
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await writeFile(path.join(evidence, "results.json"), JSON.stringify({ sha, node: process.version, browserVersion, results }, null, 2) + "\n");
  const lines = ["# Russian Time Trainer browser QA", "", "Source: " + sha, "", ...results.map(result =>
    "- " + result.status + " — " + (result.name ?? "Runtime") + (result.error ? " (" + result.error + ")" : "") + (result.detail ? " (" + JSON.stringify(result.detail) + ")" : ""),
  )];
  await writeFile(path.join(evidence, "summary.md"), lines.join("\n") + "\n");
}

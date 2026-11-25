import assert from "node:assert/strict";
export async function verifyTrainerV61(origin, { makeContext, pass, screenshot }) {
  const context = await makeContext(origin, { viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const mode = page.getByRole("combobox", { name: /Training mode/ });
  const choice = name => page.getByRole("group", { name: "Adaptive answer choices" }).getByRole("button", { name, exact: true });
  const progress = page.getByRole("button", { name: "Progress Прогресс", exact: true });
  const studio = page.getByRole("button", { name: "Audio practice Аудиотренировка", exact: true });
  const theme = page.getByRole("button", { name: /Dark mode/ });
  const reveal = page.getByRole("button", { name: /Reveal response choices/ });
  const next = page.getByRole("button", { name: /Next task/ });
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", { value: { getVoices: () => [], cancel() {} } });
  });
  try {
    assert.equal((await page.goto(origin + "/tools/russian-time-trainer")).status(), 200);
    await page.getByRole("heading", { name: "Russian Time Trainer", exact: true }).waitFor();
    await page.waitForFunction(() => document.documentElement.lang === "en");
    const focus = page.getByRole("button", { name: /Focus mode/ });
    await focus.click();
    await page.getByRole("button", { name: /Exit focus/ }).waitFor();
    await page.getByRole("navigation", { name: "Trainer sections" }).waitFor({ state: "detached" });
    assert.equal(await page.locator("main").getAttribute("data-focus"), "true");
    await page.getByRole("button", { name: /Exit focus/ }).click();
    await page.getByRole("navigation", { name: "Trainer sections" }).waitFor();
    await theme.click();
    await page.waitForFunction(() => document.querySelector("main")?.getAttribute("data-theme") === "dark");
    const contrast = await page.getByRole("button", { name: /Play word or phrase/ }).evaluate(element => {
      const style = getComputedStyle(element);
      const lum = value => {
        const channels = value.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => n / 255)
          .map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      const a = lum(style.color), b = lum(style.backgroundColor);
      return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
    });
    assert.ok(contrast >= 4.5, "Dark player contrast " + contrast);
    await screenshot(page, "v61-dark-studio");
    await theme.click();
    await page.getByRole("button", { name: /Reveal text/ }).click();
    await page.getByText("Knowledge connections", { exact: false }).click();
    await page.getByRole("button", { name: /за́втра.*Related context|за́втра.*Next/ }).click();
    await page.getByRole("button", { name: /Play word or phrase/ }).and(page.locator(":focus")).waitFor();
    pass("V6.1 focus mode, dark theme contrast and canonical knowledge-link focus", { contrast });
    await mode.selectOption("context");
    await choice("за́втра").click();
    await page.getByRole("status").filter({ hasText: "Correct choice" }).waitFor();
    await next.click();
    await reveal.click();
    await choice("Мы встре́тились вчера́.").click();
    const feedback = page.getByRole("status").filter({ hasText: "Your answer" });
    await feedback.waitFor();
    assert.match(await feedback.innerText(), /Your answer[^\n]*Мы встре́тились вчера́/);
    assert.match(await feedback.innerText(), /Model answer[^\n]*Дава́й встре́тимся за́втра/);
    await screenshot(page, "v61-error-feedback");
    await page.getByRole("button", { name: /Try again/ }).click();
    await reveal.click();
    await choice("Дава́й встре́тимся за́втра.").click();
    await page.getByRole("button", { name: /I needed help/ }).click();
    await next.click();
    await page.getByText("Во ско́лько?", { exact: true }).waitFor();
    await reveal.click();
    await choice("В де́вять часо́в.").click();
    await page.getByRole("status").filter({ hasText: "Correct choice" }).waitFor();
    await progress.click();
    await page.getByText("Personal errors", { exact: false }).click();
    await page.getByText("Corrected / Исправлено").waitFor();
    await theme.click();
    await page.reload();
    await page.waitForFunction(() => document.querySelector("main")?.getAttribute("data-theme") === "dark");
    await progress.click();
    await page.getByText("Personal errors", { exact: false }).click();
    await page.getByText("Corrected / Исправлено").waitFor();
    assert.equal(await page.getByRole("progressbar", { name: "Conversation Lab" }).getAttribute("value"), "3");
    pass("V6.1 prerequisite, wrong answer/model separation, follow-up, corrected errors, theme and real reload persistence");
    await studio.click();
    await mode.selectOption("listen");
    const guide = page.getByRole("region", { name: /Natural Immersion/ });
    await guide.getByRole("button", { name: /Start Natural Immersion/ }).click();
    const advance = guide.getByRole("button", { name: /Next stage/ });
    const play = page.getByRole("button", { name: /Play word or phrase/ });
    assert.ok(await play.isDisabled());
    await advance.click();
    assert.ok(await advance.isDisabled());
    await play.click();
    await page.getByRole("status").filter({ hasText: "Playback finished." }).waitFor();
    await advance.click();
    assert.ok(await advance.isDisabled());
    await play.click();
    await page.getByRole("status").filter({ hasText: "Playback finished." }).waitFor();
    await advance.click();
    assert.ok(await play.isDisabled());
    await page.getByRole("button", { name: /I recalled it/ }).click();
    await guide.getByRole("button", { name: /Next word/ }).waitFor();
    assert.ok(await play.isEnabled());
    await guide.getByRole("button", { name: /Next word/ }).click();
    assert.ok(await play.isDisabled());
    await advance.click();
    await play.click();
    await page.getByRole("status").filter({ hasText: "Playback finished." }).waitFor();
    await advance.click();
    await play.click();
    await page.getByRole("status").filter({ hasText: "Playback finished." }).waitFor();
    await advance.click();
    const beforeReveal = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.includes("memory:")).sort());
    await page.getByRole("button", { name: /Reveal without assessment/ }).click();
    assert.ok(await page.getByRole("button", { name: /I recalled it/ }).isDisabled());
    assert.ok(await play.isEnabled());
    await guide.getByRole("button", { name: /Next word/ }).waitFor();
    assert.deepEqual(await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.includes("memory:")).sort()), beforeReveal);
    await guide.getByRole("button", { name: /Exit guided practice/ }).click();
    pass("Natural Immersion reveal without assessment unlocks comparison without writing memory");
    pass("Natural Immersion uses canonical observe/listen/imitate/recall flow, completed playback and explicit self-report");
    await mode.selectOption("sound");
    const options = page.getByRole("group", { name: "Adaptive answer choices" }).getByRole("button");
    assert.equal(await options.count(), 2);
    assert.ok(await options.first().isDisabled() && await options.last().isDisabled());
    const player = page.getByRole("button", { name: /Play sound/ });
    const speed = page.getByRole("combobox", { name: /Speed/ });
    await page.getByText("Playback settings", { exact: false }).click();
    for (const rate of ["0.5", "0.75", "1"]) {
      await speed.selectOption(rate);
      await player.click();
      await page.getByRole("status").filter({ hasText: "Playback finished." }).filter({ hasText: "Offline synthetic candidate" }).waitFor();
      assert.ok(await options.first().isEnabled());
    }
    await options.first().click();
    await page.getByText("Preview feedback only.", { exact: false }).waitFor();
    await progress.click();
    assert.equal(await page.getByRole("progressbar", { name: "Sound Lab" }).getAttribute("value"), "0");
    await studio.click();
    await mode.selectOption("listen");
    await mode.selectOption("sound");
    pass("V6.1 offline candidate playback through Sound Lab at 0.5/0.75/1x, no device voice and no assessment persistence");
    const clips = await page.evaluate(async () => {
      const ids = ["hard-soft-0","hard-soft-1","final-soft-0","final-soft-1","vowels-0","vowels-1","voicing-0","voicing-1"];
      const results = [];
      for (const id of ids) for (const rate of [0.5, 0.75, 1]) {
        const media = new Audio("/russian-time-trainer/sound-candidate/adaptive-sound-" + id + ".mp3");
        media.playbackRate = rate;
        media.preservesPitch = true;
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => { media.pause(); reject(new Error("Playback timeout " + id)); }, 8000);
          media.onended = () => { clearTimeout(timeout); resolve(); };
          media.onerror = () => { clearTimeout(timeout); reject(new Error("Media error " + id)); };
          media.play().catch(error => { clearTimeout(timeout); reject(error); });
        });
        results.push({ id, rate: media.playbackRate, duration: media.duration, ended: media.ended, pitch: media.preservesPitch });
      }
      return results;
    });
    assert.equal(clips.length, 24);
    assert.ok(clips.every(c => c.ended && c.pitch && c.duration > 0 && [0.5,0.75,1].includes(c.rate)));
    pass("All eight local candidate assets actually play at all three rates in Chromium", { observations: clips, linguisticAcceptance: "UNVERIFIED" });
    await page.route("**/russian-time-trainer/sound-candidate/*.mp3", route => route.abort());
    await player.click();
    await page.getByRole("status").filter({ hasText: "No Russian device voice" }).waitFor();
    assert.ok(await options.first().isDisabled() && await options.last().isDisabled());
    await page.getByRole("button", { name: /Skip for now/ }).click();
    await page.getByRole("group", { name: "Adaptive answer choices" }).waitFor();
    pass("V6.1 blind sound challenge remains locked when bundled candidate is unavailable and no local voice exists; skip does not award results", { voiceAvailability: "forced unavailable negative-path test", humanAudioQuality: "UNVERIFIED" });
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const metrics = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, v: document.documentElement.clientWidth }));
      assert.ok(metrics.w <= width && metrics.v <= width, JSON.stringify(metrics));
    }
    assert.deepEqual(errors, []);
    pass("V6.1 adaptive screen 320–1440px no horizontal overflow and no page errors");
  } catch (error) {
    await screenshot(page, "v61-failure").catch(() => {});
    throw error;
  } finally { await context.close(); }
}

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../public/russian-daily");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/i)?.[1];

function harness() {
  const elements = new Map();
  const store = new Map();
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
      scrollIntoView() {}, setAttribute() {}, focus() {}, remove() {}, append() {},
      addEventListener(key, fn) { this[key] = fn; },
      click() { this.onclick?.(); },
    };
  }
  const document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, createElement()); return elements.get(id); },
    querySelectorAll() { return tabs; },
    createElement,
    body: { append() {} },
  };
  const localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
  const Blob = class { constructor(parts, options) { this.content = parts.join(""); this.type = options.type; exported.push(this); } };
  const URL = { createObjectURL: () => "blob:mock", revokeObjectURL() {} };
  new Function("document", "navigator", "localStorage", "window", "URL", "Blob", "SpeechSynthesisUtterance", "confirm", "alert", "location", script)(
    document, {}, localStorage, {}, URL, Blob, class {}, () => true, () => {}, { protocol: "http:" },
  );
  return { $: id => document.getElementById(id), exported };
}

test("candidate manifest is isolated and zero-credential", () => {
  assert.ok(script, "Client JavaScript exists");
  assert.doesNotThrow(() => new Function(script));
  const manifest = JSON.parse(readFileSync(resolve(root, "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.start_url, "./index.html");
  assert.match(readFileSync(resolve(root, "sw.js"), "utf8"), /\/russian-daily\//);
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

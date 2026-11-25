// Read-only QA asset preparation. Never installs or writes into the application.
// Uses the same upstream voice family as the existing prepared audio course.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { adaptiveTasks } from "../app/tools/russian-time-trainer/adaptive-content.ts";

const output = process.argv[2];
assert.ok(output, "Provide an explicit output directory outside the application");
const out = resolve(output);
assert.ok(out.startsWith(resolve(process.env.RUNNER_TEMP ?? tmpdir()) + "/"), "Output must be a temporary evidence directory");
mkdirSync(out, { recursive: true });
const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
assert.equal(sha, process.env.TRAINER_QA_EXPECTED_SHA);
const versions = execFileSync("dpkg-query", ["-W", "-f=${Package}=${Version}\n", "rhvoice", "rhvoice-russian", "ffmpeg"], { encoding: "utf8" }).trim();
assert.ok(versions.includes("rhvoice=1.8.0+dfsg-3build3") && versions.includes("rhvoice-russian=1.8.0+dfsg-3build3"));
const voiceDir = "/usr/share/RHVoice/voices/aleksandr-hq";
const voiceLicense = readFileSync(join(voiceDir, "README.md"), "utf8");
assert.match(voiceLicense, /creativecommons\.org\/licenses\/by-sa\/4\.0/i);
writeFileSync(join(out, "UPSTREAM-VOICE-README.md"), voiceLicense);
writeFileSync(join(out, "PACKAGE-COPYRIGHT.txt"), readFileSync("/usr/share/doc/rhvoice-russian/copyright"));
const temp = mkdtempSync(join(tmpdir(), "rtt-sound-"));
const tasks = adaptiveTasks.filter(task => task.skill === "sound");
assert.equal(tasks.length, 8);
assert.equal(new Set(tasks.map(task => task.id)).size, 8);
const assets = [];
try {
  for (const task of tasks) {
    assert.match(task.id, /^adaptive-sound-[a-z-]+-[01]$/);
    const word = task.options[task.correct].ru.replaceAll("\u0301", "");
    assert.match(word, /^[а-яё]+$/u);
    const wav = join(temp, task.id + ".wav");
    const mp3 = join(out, task.id + ".mp3");
    execFileSync("RHVoice-test", ["-p", "aleksandr-hq", "-o", wav], { input: word + "\n", timeout: 30000 });
    execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", "-i", wav, "-map_metadata", "-1", "-ar", "24000", "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "64k", mp3], { timeout: 30000 });
    const pcm = execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-i", mp3, "-f", "s16le", "-ac", "1", "-ar", "24000", "-"], { timeout: 30000 });
    const frames = pcm.length / 2;
    assert.ok(Number.isInteger(frames) && frames >= 3600 && frames <= 96000, "Word duration outside 0.15–4 s");
    let peak = 0, squares = 0;
    for (let i = 0; i < pcm.length; i += 2) {
      const sample = pcm.readInt16LE(i) / 32768;
      peak = Math.max(peak, Math.abs(sample));
      squares += sample * sample;
    }
    const rms = Math.sqrt(squares / frames);
    assert.ok(peak > 0.02 && peak < 1 && rms > 0.005, "Silent or clipped audio");
    const digest = createHash("sha256").update(readFileSync(mp3)).digest("hex");
    const evidence = { id: task.id, text: word, file: task.id + ".mp3", sha256: digest, seconds: frames / 24000, peak, rms };
    assets.push(evidence);
    console.log(JSON.stringify(evidence));
  }
  assert.equal(new Set(assets.map(asset => asset.sha256)).size, 8);
  writeFileSync(join(out, "manifest.json"), JSON.stringify({
    schemaVersion: 1, sourceSha: sha, packageVersions: versions, source: "https://github.com/RHVoice/aleksandr-hq-rus",
    distribution: "https://packages.ubuntu.com/noble/rhvoice-russian", voice: "Aleksandr-HQ",
    contributors: ["Artem Plaksin", "Sergey Parshakov", "Beka Gozalishvili", "Zvonimir Stanecic"], speakerBasis: "Aleksander Karlov",
    license: "https://creativecommons.org/licenses/by-sa/4.0/", modification: "Offline synthesis, mono 24 kHz MP3 encoding; no voice model distributed",
    technicalCheck: "decoded PCM, duration, level, distinct hashes", humanAudioQuality: "UNVERIFIED", admission: "CANDIDATE_ONLY", assets
  }, null, 2) + "\n");
  console.log("Eight synthetic audio candidates decoded successfully; human listening and application admission remain UNVERIFIED.");
} finally { rmSync(temp, { recursive: true, force: true }); }

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const worker = fs.readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8");

test("PWA shell assets are explicitly public without exposing app routes", () => {
  for (const asset of [
    "/manifest.webmanifest",
    "/sw.js",
    "/icon-192.png",
    "/icon-512.png",
    "/favicon.svg",
    "/offline.html",
  ]) {
    assert.ok(worker.includes(asset), `missing public PWA asset ${asset}`);
  }
  const start = worker.indexOf("function isPublicPwaAsset");
  const end = worker.indexOf("function isCloudflareClientAsset");
  const block = worker.slice(start, end);
  assert.ok(block.includes("function isPublicPwaAsset"));
  assert.equal(block.includes("/api/"), false);
  assert.equal(block.includes("/tools/"), false);
  assert.equal(block.includes("/apps/"), false);
});

test("PWA shell bypass executes before Preview and Production authentication", () => {
  const bypass = worker.indexOf("if ((isPreview || isProduction) && isPublicPwaAsset(request, url))");
  const previewAuth = worker.indexOf("if (isPreview) {", bypass + 1);
  const productionAuth = worker.indexOf("if (isProduction) {", bypass + 1);
  assert.ok(bypass > 0);
  assert.ok(previewAuth > bypass);
  assert.ok(productionAuth > bypass);
});

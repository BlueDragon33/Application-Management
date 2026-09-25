import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const worker = fs.readFileSync("worker/index.ts", "utf8");

test("Cloudflare dynamic responses are explicitly non-cacheable", () => {
  assert.ok(worker.includes('function freshDynamicResponse(response: Response, cloudflareChannel: boolean)'));
  assert.ok(worker.includes('"cache-control", "no-store, no-cache, must-revalidate, private"'));
  assert.ok(worker.includes('"cloudflare-cdn-cache-control", "no-store"'));
  assert.ok(worker.includes('"pragma", "no-cache"'));
  assert.ok(worker.includes('"expires", "0"'));
  assert.ok(worker.includes("const response = await handler.fetch(request, env, ctx)"));
  assert.ok(worker.includes("return freshDynamicResponse(response, isPreview || isProduction)"));
});

test("authenticated Production cache repair clears only browser cache and redirects to a revision-busted root", () => {
  assert.ok(worker.includes('url.pathname === "/__repair-cache"'));
  assert.ok(worker.includes('clear-site-data'));
  assert.ok(worker.includes(''"cache"''));
  assert.ok(worker.includes('/?fresh='));
  assert.equal(worker.includes('\"cookies\"'), false);
  assert.equal(worker.includes('\"storage\"'), false);
});

test("static asset routing still stays outside the dynamic no-store wrapper", () => {
  const assetRoute = worker.indexOf("isCloudflareClientAsset(request, url)");
  const dynamicHandler = worker.indexOf("const response = await handler.fetch(request, env, ctx)");
  assert.ok(assetRoute >= 0 && dynamicHandler > assetRoute);
  assert.ok(worker.includes("return env.ASSETS.fetch(request);"));
});

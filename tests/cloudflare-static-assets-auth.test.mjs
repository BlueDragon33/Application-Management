import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const worker = fs.readFileSync("worker/index.ts", "utf8");

test("Cloudflare Preview and Production serve client bundles from ASSETS only after access gates", () => {
  assert.ok(worker.includes('url.pathname.startsWith("/assets/")'));
  assert.ok(worker.includes('url.pathname.startsWith("/_next/static/")'));
  assert.ok(worker.includes('url.pathname.startsWith("/_vinext/")'));
  assert.ok(worker.includes('request.method !== "GET" && request.method !== "HEAD"'));
  assert.ok(worker.includes("return env.ASSETS.fetch(request);"));

  const fetchStart = worker.indexOf("async fetch(request: Request");
  assert.ok(fetchStart >= 0, "Worker fetch entry must exist.");
  const runtime = worker.slice(fetchStart);

  const previewGate = runtime.indexOf("previewRequestAuthorized");
  const productionGate = runtime.indexOf("await productionIdentity(request, env)");
  const deploymentRoute = runtime.indexOf('url.pathname === "/__deployment"');
  const assetRoute = runtime.indexOf("isCloudflareClientAsset(request, url)");
  const applicationHandler = runtime.lastIndexOf("const response = await handler.fetch(request, env, ctx)");

  assert.ok(previewGate >= 0 && previewGate < assetRoute, "Preview access must be authorized before static assets are served.");
  assert.ok(productionGate >= 0 && productionGate < assetRoute, "Production session must be authorized before static assets are served.");
  assert.ok(deploymentRoute >= 0 && deploymentRoute < assetRoute, "Deployment health route must remain explicit before static asset routing.");
  assert.ok(assetRoute < applicationHandler, "Authenticated static bundles must be served before Vinext dynamic routing.");
});

test("static asset routing is Cloudflare-channel scoped and does not replace local/Sites handling", () => {
  assert.ok(worker.includes("(isPreview || isProduction) && isCloudflareClientAsset(request, url)"));
  assert.equal(worker.includes("if (isCloudflareClientAsset(request, url)) {\n      return env.ASSETS.fetch(request);"), false);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  return (await import(workerUrl.href)).default;
}

const environment = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
};

const executionContext = {
  waitUntil() {},
  passThroughOnException() {},
};

test("redirects unauthenticated visitors to ChatGPT sign-in", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" }, redirect: "manual" }),
    environment,
    executionContext,
  );

  assert.equal(response.status, 307);
  const location = new URL(response.headers.get("location"));
  assert.equal(location.pathname, "/signin-with-chatgpt");
  assert.equal(location.searchParams.get("return_to"), "/");
});

test("declares Application Management as the authenticated root product", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.match(page, /requireChatGPTUser\("\/"\)/);
  assert.match(page, /<ApplicationHub/);
  assert.match(layout, /Application Management · Trung tâm quản trị ứng dụng/);
  assert.match(layout, /codex-preview/);
  assert.equal(packageJson.displayName, "Application Management");
});

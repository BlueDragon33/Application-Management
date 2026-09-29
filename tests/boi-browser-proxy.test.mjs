import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/api/apps/boi-ech/browser-proxy/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const mock = `data:text/javascript,${encodeURIComponent('export async function resolveClientOrigin(){return {baseUrl:"https://boi.example.test"}}')}`;
const { POST } = await import(`data:text/javascript;base64,${Buffer.from(compiled.replace('"../../../../client-origin.server"', JSON.stringify(mock))).toString("base64")}`);

function request(input) {
  return new Request("https://management.example.test/api/apps/boi-ech/browser-proxy", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ baseUrl: "https://boi.example.test", token: "v1.payload.signature", path: "/api/control/overview", ...input }),
  });
}

test("proxy forwards only the configured origin and authorized control path", async () => {
  const originalFetch = globalThis.fetch;
  const forwarded = [];
  globalThis.fetch = async (url, init) => {
    forwarded.push({ url, init });
    return Response.json({ devices: [{ deviceId: "one" }] });
  };
  try {
    const invalid = await POST(request({ baseUrl: "https://other.example.test" }));
    assert.equal(invalid.status, 400);
    const blocked = await POST(request({ path: "/api/private" }));
    assert.equal(blocked.status, 400);
    const valid = await POST(request({ query: "?activityDays=0" }));
    assert.equal(valid.status, 200);
    assert.equal((await valid.json()).devices.length, 1);
    assert.equal(forwarded.length, 1);
    assert.equal(forwarded[0].url, "https://boi.example.test/api/control/overview?activityDays=0");
    assert.equal(forwarded[0].init.headers.authorization, "Bearer v1.payload.signature");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

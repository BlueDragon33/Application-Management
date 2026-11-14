import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path,"utf8");
const dashboard = read("app/management-dashboard-v2.tsx");
const route = read("app/tools/web-app-guide/page.tsx");
const component = read("app/tools/web-app-guide/web-app-guide.tsx");
const data = read("app/tools/web-app-guide/guide-data.ts");
const css = read("app/tools/web-app-guide/web-app-guide.module.css");

test("Web-App guide is one Tool in the canonical catalog, not a managed app or a second admin screen",()=>{
  assert.equal(dashboard.match(/id: "tool-web-app-guide"/g)?.length,1);
  assert.equal(dashboard.match(/href: "\/tools\/web-app-guide"/g)?.length,1);
  assert.match(dashboard,/name: "Hướng dẫn về lập trình Web-App"/);
  assert.match(dashboard,/id: "tool-web-app-guide"[\s\S]{0,160}category: "Tool"/);
});
test("Guide route uses existing authenticated central access and contains no server mutators",()=>{
  assert.match(route,/requireChatGPTUser\("\/tools\/web-app-guide"\)/);
  assert.match(route,/return <WebAppGuide displayName=\{user\.displayName\} \/>/);
  assert.doesNotMatch(route,/wrangler|deploy\(|d1 migrations|secret|mutation|POST/);
  assert.doesNotMatch(component,/fetch\(|XMLHttpRequest|localStorage|sessionStorage|wrangler|ssh|deploy\(/);
});
test("Cloudflare guide covers exactly nine G0–G8 evidence-gated phases",()=>{
  const ids = [...data.matchAll(/\bid:"(G[0-8])",title:/g)].map(x=>x[1]);
  assert.deepEqual(ids,["G0","G1","G2","G3","G4","G5","G6","G7","G8"]);
  assert.match(data,/Bằng chứng|evidence:|stop:/);
  assert.match(data,/ACCOUNT_CONTROL_REQUIRED/);
  assert.match(data,/Worker Version ID/);
  assert.match(data,/tối đa 3 phương án/);
  assert.match(data,/không chạy deploy|không triển khai|không tự.*deploy/i);
});
test("Batch recommendations state policy is evidence/authority gated, not an invented fixed-turn law",()=>{
  assert.match(data,/G0 \+ G1/);
  assert.match(data,/G2 \+ G3/);
  assert.match(data,/G6 \| G7 \| G8/);
  assert.match(component,/không phải giới hạn số lượt do Hiến pháp áp đặt/);
  assert.match(component,/Không suy ra kết quả từ một PDF hoặc screenshot cũ/);
});
test("Layout remains isolated, mobile accessible, keyboard focus visible; no global selectors",()=>{
  assert.match(css,/\.shell\{/);
  assert.match(css,/\.gateNav/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/@media\(max-width:600px\)/);
  assert.doesNotMatch(css,/^body\s*\{|^:root\s*\{|^html\s*\{/m);
});

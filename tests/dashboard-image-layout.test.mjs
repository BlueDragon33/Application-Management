import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("approved dashboard layout is mounted after legacy presentation layers", () => {
  const page = source("app/page.tsx");
  assert.match(page, /management-dashboard-image-layout\.css/);
});

test("desktop overview places queue above applications and keeps a right rail", () => {
  const css = source("app/management-dashboard-image-layout.css");
  assert.match(css, /\[class\*="queuePanel"\][\s\S]*grid-column:\s*1[\s\S]*grid-row:\s*3/);
  assert.match(css, /\[class\*="appsPanel"\][\s\S]*grid-column:\s*1[\s\S]*grid-row:\s*4/);
  assert.match(css, /\[class\*="rightRail"\][\s\S]*grid-column:\s*2[\s\S]*grid-row:\s*3 \/ span 2/);
});

test("desktop overview fills one viewport and removes decorative process/footer strips", () => {
  const css = source("app/management-dashboard-image-layout.css");
  assert.match(css, /height:\s*calc\(100dvh - 70px\)/);
  assert.match(css, /\[class\*="processPanel"\][\s\S]*display:\s*none/);
  assert.match(css, /\[class\*="statusFooter"\][\s\S]*display:\s*none/);
});

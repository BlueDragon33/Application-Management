import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync("app/management-dashboard-v2.tsx", "utf8");
const css = fs.readFileSync("app/management-app-launcher.css", "utf8");
const page = fs.readFileSync("app/page.tsx", "utf8");

test("1. Applications view contains the launcher grid", () => {
  assert.match(dashboard, /data-testid="app-launcher-grid"/);
  assert.match(css, /\.amv2-launcher-grid\s*\{/);
});

test("2. Grid is the default Applications mode", () => {
  assert.match(dashboard, /useState<AppLauncherMode>\("grid"\)/);
});

test("3. Grid and List toggle remain available", () => {
  assert.match(dashboard, />▦ Grid<\/button>/);
  assert.match(dashboard, />☷ List<\/button>/);
  assert.match(dashboard, /data-testid="app-launcher-list"/);
});

test("4. Single click defers selection and opens the anchored popover", () => {
  assert.match(dashboard, /function handleCardClick/);
  assert.match(dashboard, /window\.setTimeout\(\(\) => \{[\s\S]*setSelectedId\(item\.id\)[\s\S]*setAnchorElement\(anchor\)[\s\S]*\}, 240\)/);
  assert.match(dashboard, /getBoundingClientRect\(\)/);
});

test("5. Double click uses the canonical open action", () => {
  assert.match(dashboard, /function handleCardDoubleClick/);
  assert.match(dashboard, /void openLauncherItem\(item\)/);
  assert.match(dashboard, /await launchWeb\(item\.id\)/);
  assert.match(dashboard, /window\.location\.assign\(item\.href\)/);
});

test("6. Double click cancels the pending single-click timer", () => {
  const start = dashboard.indexOf("function handleCardDoubleClick");
  const end = dashboard.indexOf("useEffect", start);
  const block = dashboard.slice(start, end);
  assert.match(block, /cancelSingleClick\(\)/);
  assert.match(dashboard, /window\.clearTimeout\(clickTimerRef\.current\)/);
});

test("7. Only one popover is modeled at a time", () => {
  assert.match(dashboard, /const \[selectedId, setSelectedId\] = useState<string \| null>\(null\)/);
  assert.match(dashboard, /selectedItem \? <div[\s\S]*id="amv2-app-launcher-popover"/);
  assert.doesNotMatch(dashboard, /selectedIds/);
});

test("8. Escape closes the popover", () => {
  assert.match(dashboard, /event\.key === "Escape"\) closePopover\(\)/);
});

test("9. Pointer click outside closes the popover", () => {
  assert.match(dashboard, /document\.addEventListener\("pointerdown", handlePointerDown\)/);
  assert.match(dashboard, /popoverRef\.current\?\.contains\(target\) \|\| anchorElement\?\.contains\(target\)/);
});

test("10. Popover uses real href and management href data", () => {
  assert.match(dashboard, /summary\?\.webHref \?\? app\.publicUrl \?\? \(localRuntime \? app\.localUrl : undefined\)/);
  assert.match(dashboard, /manageHref: app\.href/);
  assert.match(dashboard, /<code title=\{selectedItem\.href\}>\{selectedItem\.href \?\? "—"\}<\/code>/);
});

test("11. Study Plan remains a Bauman-owned internal Tool", () => {
  assert.match(dashboard, /id: "tool-study-plan"/);
  assert.match(dashboard, /href: "\/tools\/study-plan"/);
  assert.match(dashboard, /parentAppId: "bauman-master-ai"/);
  assert.match(dashboard, /manageHref: "\/apps\/bauman-master-ai"/);
  assert.match(dashboard, /data-parent-app=\{item\.parentAppId \?\? ""\}/);
});

test("12. Launcher search includes name, category, description, parent and tags", () => {
  assert.match(dashboard, /item\.name,/);
  assert.match(dashboard, /item\.shortName \?\? ""/);
  assert.match(dashboard, /item\.category,/);
  assert.match(dashboard, /item\.description,/);
  assert.match(dashboard, /item\.parentLabel \?\? ""/);
  assert.match(dashboard, /\.\.\.item\.tags/);
  assert.match(dashboard, /placeholder="Tìm ứng dụng\.\.\."/);
});

test("13. Both Tools and Applications feed the normalized launcher model", () => {
  assert.match(dashboard, /const toolItems = tools\.map/);
  assert.match(dashboard, /const appItems = apps\.map/);
  assert.match(dashboard, /return \[\.\.\.toolItems, \.\.\.appItems\]/);
});

test("14. Responsive launcher covers 5\/4 desktop, 3 tablet, 2 mobile and 1 narrow column", () => {
  assert.match(css, /repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 430px\)[\s\S]*grid-template-columns: 1fr/);
});

test("15. Launcher typography avoids tiny main-content text", () => {
  assert.match(css, /\.amv2-launcher \{[\s\S]*font-size: 14px/);
  assert.match(css, /\.amv2-launcher-card-copy > strong \{[\s\S]*font-size: 16px/);
  assert.match(css, /\.amv2-launcher-card-copy > small \{[\s\S]*font-size: 13px/);
  assert.match(css, /\.amv2-launcher-card-foot > b,[\s\S]*font-size: 12px/);
  assert.doesNotMatch(css, /font-size:\s*(8|9|10)px/);
});

test("launcher stylesheet loads after the existing dashboard typography overrides", () => {
  const typography = page.indexOf('management-dashboard-v2-typography.css');
  const launcher = page.indexOf('management-app-launcher.css');
  assert.ok(typography >= 0 && launcher > typography);
});

test("launcher never invents version or timestamps and only shows backend sync time when present", () => {
  assert.doesNotMatch(dashboard, /launcher[\s\S]{0,6000}version:/i);
  assert.match(dashboard, /lastUpdatedAt \? relativeTime\(lastUpdatedAt\) : "—"/);
});

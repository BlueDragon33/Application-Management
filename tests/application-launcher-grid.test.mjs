import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync("app/management-dashboard-v2.tsx", "utf8");
const css = fs.readFileSync("app/management-app-launcher.css", "utf8");
const page = fs.readFileSync("app/page.tsx", "utf8");

test("Applications view keeps launcher grid as the default mode", () => {
  assert.match(dashboard, /useState<AppLauncherMode>\("grid"\)/);
  assert.match(dashboard, /data-testid="app-launcher-grid"/);
  assert.match(dashboard, /data-testid="app-launcher-list"/);
});

test("launcher cards stay intentionally compact and move detail into the popover", () => {
  const cardStart = dashboard.indexOf('className="amv2-launcher-card"');
  const cardEnd = dashboard.indexOf('!visibleItems.length', cardStart);
  const card = dashboard.slice(cardStart, cardEnd);
  assert.match(card, /<AppIcon appId=\{item\.iconAppId\}\/?>/);
  assert.match(card, /item\.shortName \?\? item\.name/);
  assert.match(card, /item\.statusLabel/);
  assert.match(card, /item\.category/);
  assert.doesNotMatch(card, /item\.description/);
  assert.doesNotMatch(card, /item\.onlineCount/);
  assert.doesNotMatch(card, /item\.pendingCount/);
});

test("popover owns operational details and management link", () => {
  assert.match(dashboard, />Trạng thái<\/span>/);
  assert.match(dashboard, />Online<\/span>/);
  assert.match(dashboard, />Chờ xử lý<\/span>/);
  assert.match(dashboard, />Loại<\/span>/);
  assert.match(dashboard, />Liên kết quản trị<\/span>/);
  assert.match(dashboard, /selectedItem\.manageHref \? <Link/);
});

test("popover exposes compact Open Manage Details actions", () => {
  assert.match(dashboard, /webBusy === selectedItem\.id \? "Đang mở…" : "↗ Mở"/);
  assert.match(dashboard, />⚙ Quản trị<\/Link>/);
  assert.match(dashboard, /ⓘ \{detailOpen \? "Thu gọn" : "Xem chi tiết"\}/);
  assert.match(dashboard, /setDetailOpen\(\(current\) => !current\)/);
});

test("expanded details use only real normalized data", () => {
  assert.match(dashboard, />Contract<\/span>/);
  assert.match(dashboard, />Runtime<\/span>/);
  assert.match(dashboard, /lastUpdatedAt \? relativeTime\(lastUpdatedAt\) : "—"/);
  assert.match(dashboard, /selectedItem\.href \?\? "—"/);
  assert.match(dashboard, /selectedItem\.description \|\| "Chưa có dữ liệu"/);
});

test("single click remains deferred and double click cancels it", () => {
  assert.match(dashboard, /window\.setTimeout\(\(\) => \{[\s\S]*setSelectedId\(item\.id\)[\s\S]*\}, 240\)/);
  const start = dashboard.indexOf("function handleCardDoubleClick");
  const end = dashboard.indexOf("function updateScrollState", start);
  const block = dashboard.slice(start, end);
  assert.match(block, /cancelSingleClick\(\)/);
  assert.match(block, /void openLauncherItem\(item\)/);
});

test("canonical opening remains policy-gated for apps and direct for real tool hrefs", () => {
  assert.match(dashboard, /await launchWeb\(item\.id\)/);
  assert.match(dashboard, /window\.location\.assign\(item\.href\)/);
  assert.match(dashboard, /canOpen = webAccessAvailable\(app, summary, localRuntime\)/);
});

test("only one anchored popover is modeled at a time and closes safely", () => {
  assert.match(dashboard, /const \[selectedId, setSelectedId\] = useState<string \| null>\(null\)/);
  assert.match(dashboard, /getBoundingClientRect\(\)/);
  assert.match(dashboard, /event\.key === "Escape"\) closePopover\(\)/);
  assert.match(dashboard, /document\.addEventListener\("pointerdown", handlePointerDown\)/);
});

test("Study Plan remains a Bauman-owned Tool with canonical links", () => {
  assert.match(dashboard, /id: "tool-study-plan"/);
  assert.match(dashboard, /href: "\/tools\/study-plan"/);
  assert.match(dashboard, /parentAppId: "bauman-master-ai"/);
  assert.match(dashboard, /manageHref: "\/apps\/bauman-master-ai"/);
  assert.match(dashboard, /data-parent-app=\{item\.parentAppId \?\? ""\}/);
});

test("search still indexes hidden detail fields without showing them on cards", () => {
  assert.match(dashboard, /item\.description,/);
  assert.match(dashboard, /item\.parentLabel \?\? ""/);
  assert.match(dashboard, /\.\.\.item\.tags/);
  assert.match(dashboard, /placeholder="Tìm ứng dụng\.\.\."/);
});

test("grid exposes roll buttons only when content actually overflows", () => {
  assert.match(dashboard, /const \[scrollState, setScrollState\] = useState\(\{ up: false, down: false \}\)/);
  assert.match(dashboard, /target\.scrollHeight - target\.clientHeight/);
  assert.match(dashboard, /scrollState\.up \|\| scrollState\.down/);
  assert.match(dashboard, /aria-label="Cuộn lên"/);
  assert.match(dashboard, /aria-label="Cuộn xuống"/);
  assert.match(dashboard, /target\.scrollBy\(/);
});

test("launcher scroll controls are visible overlays and grid owns vertical overflow", () => {
  assert.match(css, /\.amv2-launcher-grid-wrap\s*\{[\s\S]*position:\s*relative/);
  assert.match(css, /\.amv2-launcher-grid\s*\{[\s\S]*overflow-y:\s*auto/);
  assert.match(css, /\.amv2-launcher-scroll-controls\s*\{[\s\S]*position:\s*absolute/);
});

test("responsive grid keeps 5/4/3/2/1 launcher columns", () => {
  assert.match(css, /repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 430px\)[\s\S]*grid-template-columns:\s*1fr/);
});

test("card typography remains readable without oversized cards", () => {
  assert.match(css, /\.amv2-launcher-card\s*\{[\s\S]*min-height:\s*174px/);
  assert.match(css, /\.amv2-launcher-card-copy > strong\s*\{[\s\S]*font-size:\s*15px/);
  assert.match(css, /\.amv2-launcher-card-status\s*\{[\s\S]*font-size:\s*12\.5px/);
});

test("launcher stylesheet remains the final launcher-specific visual layer", () => {
  const typography = page.indexOf('management-dashboard-v2-typography.css');
  const launcher = page.indexOf('management-app-launcher.css');
  assert.ok(typography >= 0 && launcher > typography);
});

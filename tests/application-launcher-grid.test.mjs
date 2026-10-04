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

test("Overview managed-app box is one read-only screen that jumps to Applications", () => {
  assert.match(dashboard, /className="amv2-panel amv2-apps-panel amv2-overview-apps-launcher"/);
  assert.match(dashboard, /role="button"/);
  assert.match(dashboard, /aria-label="Mở tab Ứng dụng"/);
  assert.match(dashboard, /onClick=\{\(\) => switchView\("applications"\)\}/);
  assert.match(dashboard, /className="amv2-overview-app-screen"/);
  assert.match(dashboard, /<b>Online<\/b>/);
  assert.match(dashboard, /item\.status/);
});

test("Overview orders application clients before Tools and contains no per-tile action buttons", () => {
  const start = dashboard.indexOf("const overviewItems = [");
  const end = dashboard.indexOf("return <>", start);
  const model = dashboard.slice(start, end);
  assert.ok(model.indexOf("...apps.map") < model.indexOf("...tools.map"));

  const panelStart = dashboard.indexOf('className="amv2-panel amv2-apps-panel amv2-overview-apps-launcher"');
  const panelEnd = dashboard.indexOf('className="amv2-panel amv2-devices-panel"', panelStart);
  const panel = dashboard.slice(panelStart, panelEnd);
  assert.doesNotMatch(panel, /amv2-web-action|amv2-manage-action|<button/);
});

test("Applications launcher defaults to manual app-first ordering", () => {
  assert.match(dashboard, /useState<AppLauncherSort>\("manual"\)/);
  assert.match(dashboard, /return \[\.\.\.appItems, \.\.\.toolItems\]/);
  assert.match(dashboard, /if \(a\.kind !== b\.kind\) return a\.kind === "app" \? -1 : 1/);
  assert.match(dashboard, /\{ id: "manual", label: "Thủ công" \}/);
  assert.match(dashboard, /\{ id: "category-auto", label: "Tự động theo phân loại" \}/);
});

test("sort picker is fully themed instead of using the browser native select popup", () => {
  const toolbarStart = dashboard.indexOf('className="amv2-launcher-toolbar"');
  const toolbarEnd = dashboard.indexOf('className="amv2-launcher-subbar"', toolbarStart);
  const toolbar = dashboard.slice(toolbarStart, toolbarEnd);
  assert.match(toolbar, /className="amv2-launcher-sort-trigger"/);
  assert.match(toolbar, /className="amv2-launcher-sort-menu"/);
  assert.match(toolbar, /role="listbox"/);
  assert.match(toolbar, /role="option"/);
  assert.doesNotMatch(toolbar, /<select|<option/);
  assert.match(css, /\.amv2-launcher-sort-menu > button:hover/);
  assert.match(css, /\.amv2-launcher-sort-menu > button\[data-active="true"\]/);
});

test("automatic category sorting persists and reacts to category edits", () => {
  assert.match(dashboard, /type AppLauncherSort = "manual" \| "name" \| "category-auto" \| "status"/);
  assert.match(dashboard, /launcherSortStorageKey/);
  assert.match(dashboard, /sortMode === "category-auto"/);
  assert.match(dashboard, /a\.category\.localeCompare\(b\.category, "vi", \{ sensitivity: "base" \}\)/);
  assert.match(dashboard, /window\.localStorage\.setItem\(launcherSortStorageKey, next\)/);
  assert.match(dashboard, /storedSort === "category"/);
  assert.match(dashboard, /setSortMode\("category-auto"\)/);
  assert.match(dashboard, /sửa phân loại → icon tự chuyển nhóm/);
  assert.match(css, /data-auto-sort="true"/);
});

test("long press explicitly returns launcher to persistent manual sorting", () => {
  const start = dashboard.indexOf("function handleCardPointerDown");
  const end = dashboard.indexOf("function handleCardPointerMove", start);
  const block = dashboard.slice(start, end);
  assert.match(block, /changeSortMode\("manual"\)/);
});

test("Holding an icon for 3 seconds enables pointer reorder and persists manual order", () => {
  assert.match(dashboard, /window\.setTimeout\(\(\) => \{[\s\S]*setEditMode\(true\)[\s\S]*\}, 3000\)/);
  assert.match(dashboard, /data-launcher-id=\{item\.id\}/);
  assert.match(dashboard, /handleCardPointerMove/);
  assert.match(dashboard, /document\.elementFromPoint/);
  assert.match(dashboard, /launcherOrderStorageKey/);
  assert.match(dashboard, /localStorage\.setItem\(launcherOrderStorageKey/);
  assert.match(css, /\.amv2-launcher-grid\[data-editing="true"\]/);
});

test("App category can be edited as a display preference without mutating client contract", () => {
  assert.match(dashboard, /launcherCategoryStorageKey/);
  assert.match(dashboard, /categoryOverrides\[app\.id\] \|\| app\.category/);
  assert.match(dashboard, /className="amv2-category-edit-trigger"/);
  assert.match(dashboard, /Phân loại hiển thị/);
  assert.match(dashboard, /saveCategoryOverride\(selectedItem, categoryDraft\)/);
  assert.match(dashboard, /không đổi contract của client/);
});

test("launcher cards behave like phone app tiles and move detail into the popover", () => {
  const cardStart = dashboard.indexOf('className="amv2-launcher-card"');
  const cardEnd = dashboard.indexOf('!visibleItems.length', cardStart);
  const card = dashboard.slice(cardStart, cardEnd);
  assert.match(card, /<AppIcon appId=\{item\.iconAppId\}\/?>/);
  assert.match(card, /item\.shortName \?\? item\.name/);
  assert.match(card, /className="amv2-launcher-app-badge"/);
  assert.match(card, /aria-label=\{item\.statusLabel\}/);
  assert.match(card, /item\.category/);
  assert.doesNotMatch(card, /className="amv2-launcher-card-status"/);
  assert.doesNotMatch(card, /•••/);
  assert.doesNotMatch(card, /item\.description/);
  assert.doesNotMatch(card, /item\.onlineCount/);
  assert.doesNotMatch(card, /item\.pendingCount/);
});

test("popover owns operational details and management link", () => {
  assert.match(dashboard, />Trạng thái<\/span>/);
  assert.match(dashboard, />Online<\/span>/);
  assert.match(dashboard, />Chờ xử lý<\/span>/);
  assert.match(dashboard, />Phân loại<\/span>/);
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

test("responsive grid uses phone-app density across desktop tablet and phone", () => {
  assert.match(css, /repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(css, /repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /repeat\(2, minmax\(0, 1fr\)\)/);
});

test("phone-style tiles keep readable names, compact height and clear boundaries", () => {
  assert.match(css, /\.amv2-launcher-card\s*\{[\s\S]*min-height:\s*148px/);
  assert.match(css, /\.amv2-launcher-card\s*\{[\s\S]*border:\s*1px solid/);
  assert.match(css, /\.amv2-launcher-card\s*\{[\s\S]*border-radius:\s*16px/);
  assert.match(css, /\.amv2-launcher-card-copy > strong\s*\{[\s\S]*font-size:\s*14px/);
  assert.match(css, /\.amv2-launcher-card \.amv2-app-icon\s*\{[\s\S]*width:\s*62px/);
  assert.match(css, /\.amv2-launcher-app-badge\s*\{[\s\S]*width:\s*13px/);
});

test("tool icons use distinct app-like gradients instead of tiny placeholder glyph boxes", () => {
  for (const tool of ["tool-study-plan", "tool-secret-generator", "tool-managed-apps", "tool-deploy-ops", "tool-kd-mid-visa"]) {
    assert.ok(css.includes(`data-app="${tool}"`), `missing styled launcher icon for ${tool}`);
  }
  assert.match(dashboard, /tool-secret-generator"\) return "⚿"/);
  assert.match(dashboard, /tool-managed-apps"\) return "◎"/);
  assert.match(dashboard, /tool-deploy-ops"\) return "☁"/);
  assert.match(dashboard, /tool-kd-mid-visa"\) return "✈"/);
});

test("launcher stylesheet remains the final launcher-specific visual layer", () => {
  const typography = page.indexOf('management-dashboard-v2-typography.css');
  const launcher = page.indexOf('management-app-launcher.css');
  assert.ok(typography >= 0 && launcher > typography);
});

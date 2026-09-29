import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/report-exports.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { csvCell, buildAiOperationsReport } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("CSV cells stay data when opened by a spreadsheet", () => {
  assert.equal(csvCell('=HYPERLINK("https://example.test")'), '"\'=HYPERLINK(""https://example.test"")"');
  assert.equal(csvCell('\t+SUM(1,2)'), '"\' +SUM(1,2)"');
  assert.equal(csvCell('Tên "An"\nLớp 5'), '"Tên ""An"" Lớp 5"');
  assert.equal(csvCell(42), '"42"');
});

test("AI A4 report summarizes a dated period and escapes untrusted learner text", () => {
  const html = buildAiOperationsReport({
    generatedAt: new Date("2026-09-29T02:00:00Z"),
    metrics: { interactions30Days: 34, learners30Days: 7, averageResponseMs: 870, adaptivePassRate: 75, openReports: 2, learnersAtRisk: 1, costMicros: 0 },
    learners: [{ learnerName: '<img src=x onerror=alert(1)>', className: "5A", deviceCode: "A01", alerts: [{ level: "warning", text: "Cần hỗ trợ" }], averageMastery: 61, interactionCount: 3 }],
    engine: { name: "Trợ giảng nội bộ", version: "2" },
  });
  assert.match(html, /BÁO CÁO VẬN HÀNH AI/);
  assert.match(html, /30\/08\/2026 – 29\/09\/2026 \(30 ngày\)/);
  assert.match(html, /Học viên cần hỗ trợ tại thời điểm xuất/);
  assert.match(html, /34/);
  assert.match(html, /Cần hỗ trợ/);
  assert.match(html, /@page\s*\{\s*size:\s*A4/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img src=x onerror=/);
});

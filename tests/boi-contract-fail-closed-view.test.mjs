import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const view = fs.readFileSync(new URL("../app/boi-access-view.tsx", import.meta.url), "utf8");
test("Bơi Ếch V2 contract rejection cannot be displayed as zero real devices", () => {
  assert.match(view,/catch \(caught\) \{\s*setData\(null\)/);
  assert.match(view,/\{data && !error \? <div className=\{styles\.metrics\}>/);
  assert.match(view,/\{data && !error \? <div className=\{styles\.tableWrap\}>/);
  assert.match(view,/Không thể kết luận có 0 thiết bị hoặc dữ liệu đã bị xóa/);
  assert.match(view,/role="status"/);
  assert.match(view,/\{!data \? <div className=\{styles\.empty\}/);
});

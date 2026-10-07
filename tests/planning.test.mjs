// tests/planning.test.mjs — 企劃文件流：tasks.md 章節＝階段、### ＝並行線、M1／M2＝里程碑
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStages, planStatus, PLAN_STAGES } from "../tools/workbench/lib.mjs";

const TASKS = `## 1. 需求
- [x] 1.1 需求來源：Notion 需求池
## 2. 企劃書
- [x] 2.1 Notion 撰寫企劃書（v1.1）
## 3. 示意圖
- [x] 3.1 示意圖 v21
## 4. 需求確認 ◆
- [x] M1 需求確認：企劃書 v1.1＋示意圖 v21（2026-10-07，需求會議）
## 5. 並行製作
### 美術
- [ ] 5.1 視覺稿（完成約九成時通知企劃）
- [ ] M2 規格確認：SPEC 定稿、匯出 spec.md
### 後端
- [x] 5.2 開工單
- [ ] 5.3 後端完成
### 前端
- [ ] 5.4 開工單
## 6. 驗收
- [ ] 6.1 照 SPEC 驗收條件逐條驗
`;

test("階段：章節編號＝階段，第一個沒做完的章節是目前階段", () => {
  const p = parseStages(TASKS);
  assert.equal(p.stages.length, 6);
  assert.deepEqual(p.stages.map(s => s.n), [1, 2, 3, 4, 5, 6]);
  assert.equal(p.stages[3].title, "需求確認");          // ◆ 會被拿掉
  assert.equal(p.current, 5);
  assert.equal(p.total, 10);
  assert.equal(p.done, 5);
});

test("並行線：### 是第 5 階段的線，各自算進度；沒有 ### 的章節只有一條無名線", () => {
  const s5 = parseStages(TASKS).stages.find(s => s.n === 5);
  assert.deepEqual(s5.lanes.map(l => l.name), ["美術", "後端", "前端"]);
  assert.deepEqual(s5.lanes.map(l => `${l.done}/${l.total}`), ["0/2", "1/2", "0/1"]);
  const s1 = parseStages(TASKS).stages.find(s => s.n === 1);
  assert.equal(s1.lanes.length, 1);
  assert.equal(s1.lanes[0].name, "");
});

test("里程碑：M1／M2 開頭的項目，勾了就讀括號裡的註記", () => {
  const { milestones } = parseStages(TASKS);
  assert.equal(milestones.M1.done, true);
  assert.equal(milestones.M1.note, "2026-10-07，需求會議");
  assert.equal(milestones.M1.stage, 4);
  assert.equal(milestones.M2.done, false);
  assert.equal(milestones.M2.note, "");
  assert.equal(milestones.M2.stage, 5);
});

test("狀態：目前階段的名稱；全部勾完＝待歸檔；archive＝已完成", () => {
  const p = parseStages(TASKS);
  assert.equal(planStatus(false, p), "並行製作");
  assert.equal(planStatus(false, parseStages(TASKS.replace(/- \[ \]/g, "- [x]"))), "待歸檔");
  assert.equal(planStatus(true, p), "已完成");
  assert.equal(PLAN_STAGES.find(s => s.n === 4).milestone, "M1");
});

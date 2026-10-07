// 試玩清單（QA）與素材確認（美術）。執行：node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseProposal, readSpectra, qaItems, qaIssueBody, parseQa, QA_MARKER_RE, ISSUE_MARKER_RE, assetSummary } from "../tools/workbench/lib.mjs";
import { setQaItem, failQaItem, parseCsv, toCsv, updateAssetRow, assetCounts, ASSET_STATES, parseQa as parseQaWeb } from "../web/console/shared.js";

// ---------- 試玩清單 ----------
const PROPOSAL = `> 中文標題：球的軌跡隱藏
> 類型：企劃

## Why

第 3 關以後太簡單。

## 試玩重點

- 第 3 關開始，瞄準時看不到預測線
- 第 1、2 關還看得到

## 需要企劃確認的事

無
`;

function project(proposal, spec) {
  const root = mkdtempSync(join(tmpdir(), "qa-"));
  const dir = join(root, "docs/spectra/changes/hide-preview");
  mkdirSync(join(dir, "specs/aim"), { recursive: true });
  writeFileSync(join(dir, "proposal.md"), proposal);
  writeFileSync(join(dir, "tasks.md"), "## 0. 企劃確認\n\n- [x] 0.1 企劃確認（企劃於對話中同意）\n\n## 1. 做\n\n- [x] 1.1 先寫會失敗的測試\n");
  writeFileSync(join(dir, "specs/aim/spec.md"), spec);
  return readSpectra(root).changes[0];
}
const SPEC = `## MODIFIED Requirements

### Requirement: Aim Preview By Stage

> 中文：第 3 關開始不顯示彈道預覽線

#### Scenario: Hidden from stage 3

- **WHEN** stage 3 starts
- **THEN** the preview SHALL NOT be drawn

## REMOVED Requirements

### Requirement: Old Preview

> 中文：舊的預覽規則
`;

test("提案的「試玩重點」讀得出來；規則差異的每條規則（不含移除的）也讀得出來", () => {
  const p = parseProposal(PROPOSAL, "x");
  assert.deepEqual(p.qaFocus, ["第 3 關開始，瞄準時看不到預測線", "第 1、2 關還看得到"]);
  const c = project(PROPOSAL, SPEC);
  assert.deepEqual(c.reqs.map(r => r.zh), ["第 3 關開始不顯示彈道預覽線"]);
});

test("試玩清單：優先用「試玩重點」，沒有就用規則的中文說明；最後加上每次都要試的", () => {
  const c = project(PROPOSAL, SPEC);
  assert.deepEqual(qaItems(c, ["手機上玩一次，沒有卡頓"]), ["第 3 關開始，瞄準時看不到預測線", "第 1、2 關還看得到", "手機上玩一次，沒有卡頓"]);
  const noFocus = project(PROPOSAL.replace(/## 試玩重點[\s\S]*?(?=## 需要)/, ""), SPEC);
  assert.deepEqual(qaItems(noFocus, []), ["第 3 關開始不顯示彈道預覽線"]);
  // 什麼都沒有（例如技術交接）：至少有預設的一項
  assert.ok(qaItems({ qaFocus: [], reqs: [] }).length >= 1);
});

test("試玩清單的討論串：有自己的標記（不會被當成提案的討論串），勾選讀得回來", () => {
  const c = project(PROPOSAL, SPEC);
  const body = qaIssueBody(c, qaItems(c, []), "https://github.com/a/b", "docs/spectra", "https://play.example/");
  assert.equal(body.match(QA_MARKER_RE)?.[1], "hide-preview");
  assert.equal(ISSUE_MARKER_RE.test(body), false);
  assert.match(body, /https:\/\/play\.example\//);
  const q = parseQa(body);
  assert.equal(q.total, 2); assert.equal(q.done, 0); assert.equal(q.failed, 0);
  const ticked = setQaItem(body, 1, true);
  assert.equal(parseQa(ticked).done, 1);
  assert.equal(parseQa(ticked).items[1].done, true);
  assert.equal(parseQa(setQaItem(ticked, 1, false)).done, 0);
});

test("不通過：那一項標上回饋編號、取消勾選；修好再勾，就變成「修好了」", () => {
  const body = qaIssueBody({ id: "x", folder: "x", title: "T" }, ["甲", "乙"], "https://github.com/a/b");
  const failed = failQaItem(setQaItem(body, 0, true), 0, 12);
  let q = parseQa(failed);
  assert.equal(q.failed, 1);
  assert.deepEqual(q.items[0], { done: false, text: "甲", fails: [12], fixed: false });
  q = parseQa(setQaItem(failed, 0, true));
  assert.equal(q.failed, 0);
  assert.deepEqual(q.items[0], { done: true, text: "甲", fails: [12], fixed: true });
  // 再失敗一次：兩個回饋編號都留著
  assert.deepEqual(parseQa(failQaItem(setQaItem(failed, 0, true), 0, 15)).items[0].fails, [12, 15]);
  // 管理台用的 parseQa 跟同步用的一樣
  for (const b of [body, failed, setQaItem(failed, 0, true)]) assert.deepEqual(parseQaWeb(b), parseQa(b));
});

// ---------- 素材確認 ----------
const CSV = "﻿檔名,類別,狀態,規格\r\nfish.png,角色,待製作,512\r\n\"bg, city.png\",背景,方向稿,1024\r\n";

test("CSV：讀進來再寫回去一模一樣（BOM、換行、引號都保留）", () => {
  const rows = parseCsv(CSV);
  assert.deepEqual(rows[2], ["bg, city.png", "背景", "方向稿", "1024"]);
  assert.equal(toCsv(rows, { bom: true, eol: "\r\n" }), CSV);
});

test("美術交件：狀態改成「待確認」，沒有的欄位（交件、意見）自動加上，別的列不動", () => {
  const out = updateAssetRow(CSV, 1, "fish.png", { 狀態: "待確認", 交件: "docs/企劃/圖/交件/fish.png" });
  const rows = parseCsv(out);
  assert.deepEqual(rows[0], ["檔名", "類別", "狀態", "規格", "交件", "意見"]);
  assert.deepEqual(rows[1], ["fish.png", "角色", "待確認", "512", "docs/企劃/圖/交件/fish.png", ""]);
  assert.deepEqual(rows[2], ["bg, city.png", "背景", "方向稿", "1024", "", ""]);
  assert.ok(out.startsWith("﻿") && out.includes("\r\n"));
});

test("企劃退回：附意見；檔名對不上（別人剛改過清單）就不寫", () => {
  const sent = updateAssetRow(CSV, 1, "fish.png", { 狀態: "待確認", 交件: "a.png" });
  const back = parseCsv(updateAssetRow(sent, 1, "fish.png", { 狀態: "退回", 意見: "眼睛再大一點" }));
  assert.equal(back[1][2], "退回"); assert.equal(back[1][5], "眼睛再大一點");
  assert.throws(() => updateAssetRow(CSV, 1, "shark.png", { 狀態: "已採用" }), /清單剛被改過/);
  assert.ok(ASSET_STATES.includes("待確認") && ASSET_STATES.includes("已採用") && ASSET_STATES.includes("退回"));
});

test("素材摘要：美術要做的、企劃要確認的、要放進遊戲的分開算", () => {
  const csv = "檔名,狀態\na,待製作\nb,方向稿\nc,待確認\nd,退回\ne,已採用\nf,已放進遊戲\n";
  const s = assetSummary(csv);
  assert.deepEqual(s.toMake, ["a", "b", "d"]);
  assert.deepEqual(s.toReview, ["c"]);
  assert.deepEqual(s.toPlace, ["e"]);
  assert.deepEqual(s.returned, ["d"]);
  assert.deepEqual(assetCounts(parseCsv(csv)), s);   // 管理台自己算的（舊資料時）跟同步算的一樣
});

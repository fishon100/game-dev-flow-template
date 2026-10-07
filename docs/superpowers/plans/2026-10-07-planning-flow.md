# 企劃文件流（planning flow）實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 範本的管理台多一個 `flow: "planning"` 模式（7 格流程、里程碑、三條並行線、沒有同意／試玩／規則書），並用新建的 `fishon100/playhorny-platform` 專案把「遊戲內頁」當第一張提案跑起來。

**Architecture:** 階段與進度全部從 `tasks.md` 的章節解析（`## N. 標題` ＝階段、`### 線名` ＝第 5 階段的並行線、`M1`／`M2` 開頭的項目＝里程碑）。解析放在 `tools/workbench/lib.mjs`（可測試），`sync.mjs` 把結果與階段定義寫進 `data.json`，管理台 `app.js` 只依 `data.flow.mode` 切換畫面。`flow` 沒設就是原本的遊戲流程，現有畫面與測試不變。

**Tech Stack:** Node 22（ES modules、`node --test`）、純 JS 管理台（無框架）、GitHub Actions、GitHub Pages、`gh` CLI。

## Global Constraints

- 設計文件：`docs/superpowers/specs/2026-10-07-planning-flow-design.md`，所有行為以它為準。
- 對人的文字一律**白話繁體中文**，不用術語（CLAUDE.md）。
- 公開 repo：不寫密鑰、本機路徑、個人 email（CLAUDE.md「注意」）。
- 改了 `web/console/` 的 JS：`index.html` 與 `app.js` 裡的 `?v=` 改成新的時間戳（例 `?v=202610080900`）。
- 每個 commit 訊息結尾加 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`。
- 工作分支：`planning-flow`（已建立，含設計文件 commit）。先 `git checkout planning-flow`。
- 遊戲模式的所有既有測試在每個 task 之後都要仍然通過：`node --test`。

---

### Task 1: lib.mjs — 階段定義與 tasks.md 章節解析

**Files:**
- Modify: `tools/workbench/lib.mjs`（在 `parseTasks` 之後新增）
- Test: `tests/planning.test.mjs`（新建）

**Interfaces:**
- Produces: `PLAN_STAGES`（陣列，7 筆 `{ n, label, sub, milestone? }`）、`parseStages(md) → { stages, current, milestones, total, done }`、`planStatus(archived, plan) → string`。後續 task 都用這三個名字。

- [ ] **Step 1: 寫會失敗的測試**

```js
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/planning.test.mjs`
Expected: 4 個測試都 fail，錯誤含 `does not provide an export named 'parseStages'`。

- [ ] **Step 3: 實作**

在 `tools/workbench/lib.mjs` 的 `approveTasks` 函式之前加：

```js
// ---------- 企劃文件流（workbench.config.json 的 flow: "planning"）：平台專案用 ----------
// 階段寫死在這裡，管理台從 data.json 的 flow.stages 讀，兩邊同一份
export const PLAN_STAGES = [
  { n: 1, label: "需求", sub: "需求池／回饋" },
  { n: 2, label: "企劃書", sub: "Notion" },
  { n: 3, label: "示意圖", sub: "介面向才有" },
  { n: 4, label: "需求確認", sub: "M1", milestone: "M1" },
  { n: 5, label: "並行製作", sub: "美術／後端／前端" },
  { n: 6, label: "驗收", sub: "SPEC 驗收條件" },
  { n: 7, label: "完成", sub: "歸檔" },
];
// 里程碑項目：「M1 需求確認：…（2026-10-07，需求會議）」→ 代號、文字、括號裡的註記
export const MILESTONE_RE = /^(M\d)\s+(.*?)(?:（([^）]*)）)?\s*$/;

/** tasks.md → 階段（## N. 標題）、並行線（### 線名）、里程碑（M1／M2）。目前階段＝第一個還有沒勾項目的章節 */
export function parseStages(md) {
  const stages = [];
  let st = null, lane = null;
  for (const line of md.split("\n")) {
    const h2 = line.match(/^##\s+(\d+)\.\s*(.+?)\s*$/);
    if (h2) { st = { n: +h2[1], title: h2[2].replace(/\s*◆\s*$/, ""), lanes: [] }; lane = null; stages.push(st); continue; }
    const h3 = line.match(/^###\s+(.+?)\s*$/);
    if (h3 && st) { lane = { name: h3[1], items: [] }; st.lanes.push(lane); continue; }
    const it = line.match(/^- \[( |x|X)\] (.*)$/);
    if (it && st) {
      if (!lane) { lane = { name: "", items: [] }; st.lanes.push(lane); }
      const text = it[2].trim(), done = it[1] !== " ", m = text.match(MILESTONE_RE);
      lane.items.push({ done, text, milestone: m ? m[1] : "", note: m && done ? (m[3] || "") : "" });
    }
  }
  const milestones = {};
  for (const s of stages) {
    for (const l of s.lanes) {
      l.total = l.items.length; l.done = l.items.filter(i => i.done).length;
      for (const i of l.items) if (i.milestone) milestones[i.milestone] = { done: i.done, note: i.note, stage: s.n, text: i.text };
    }
    s.total = s.lanes.reduce((a, l) => a + l.total, 0); s.done = s.lanes.reduce((a, l) => a + l.done, 0);
  }
  return {
    stages, milestones,
    current: stages.find(s => s.done < s.total)?.n ?? null,
    total: stages.reduce((a, s) => a + s.total, 0),
    done: stages.reduce((a, s) => a + s.done, 0),
  };
}

/** 企劃文件流的狀態文字：目前階段的名稱／待歸檔／已完成 */
export function planStatus(archived, plan) {
  if (archived) return "已完成";
  if (plan.current == null) return "待歸檔";
  return PLAN_STAGES.find(s => s.n === plan.current)?.label || `第 ${plan.current} 階段`;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test`
Expected: 全部 pass（含原本的 workbench、specsheet、qa-assets、rules 測試）。

- [ ] **Step 5: Commit**

```bash
git add tools/workbench/lib.mjs tests/planning.test.mjs
git commit -m "feat(workbench): 企劃文件流的階段解析（parseStages、planStatus）

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: lib.mjs — 提案欄位（基於、設計稿）與 readSpectra 的企劃模式

**Files:**
- Modify: `tools/workbench/lib.mjs`（`parseProposal` 的回傳物件、`readSpectra` 的簽名與 `change()`）
- Test: `tests/planning.test.mjs`（追加）

**Interfaces:**
- Consumes: Task 1 的 `parseStages`、`planStatus`。
- Produces: `parseProposal` 多回傳 `optimize`（布林）、`base`（字串）、`design`（字串）；`readSpectra(root, specDir, opts)` 的 `opts = { flow: "game" | "planning", changesDir?: string }`；企劃模式下每張提案多 `plan`（`parseStages` 的結果），`status` 改用 `planStatus`。

- [ ] **Step 1: 寫會失敗的測試**（追加到 `tests/planning.test.mjs`）

```js
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseProposal, readSpectra } from "../tools/workbench/lib.mjs";

const PROPOSAL = `> 中文標題：遊戲內頁改版
> 類型：優化
> 基於：game-page-redesign
> 文件：介面向
> 企劃書：https://app.notion.com/p/38711c058c2d8030b36bc9d6bdf36fa3（v1.1）
> 示意圖：docs/提案/game-page-v2/示意圖/遊戲內頁_v22.html
> 設計稿：https://claude.ai/design/p/abc

## 為什麼

舊版不好用。
`;

test("提案：優化案讀得到「基於」，設計稿與企劃書連結原樣保留", () => {
  const p = parseProposal(PROPOSAL, "game-page-v2");
  assert.equal(p.optimize, true);
  assert.equal(p.base, "game-page-redesign");
  assert.equal(p.design, "https://claude.ai/design/p/abc");
  assert.equal(p.brief, "https://app.notion.com/p/38711c058c2d8030b36bc9d6bdf36fa3（v1.1）");
  assert.equal(p.docs, "介面向");
  assert.equal(parseProposal("## Why\n\nx\n", "a").optimize, false);
});

test("readSpectra 企劃模式：提案直接放在 docs/提案/<id>，有 plan 與階段狀態；archive 是已完成", () => {
  const root = mkdtempSync(join(tmpdir(), "plan-"));
  mkdirSync(join(root, "docs/提案/game-page-redesign"), { recursive: true });
  writeFileSync(join(root, "docs/提案/game-page-redesign/proposal.md"), PROPOSAL);
  writeFileSync(join(root, "docs/提案/game-page-redesign/tasks.md"), TASKS);
  mkdirSync(join(root, "docs/提案/archive/2026-09-01-old"), { recursive: true });
  writeFileSync(join(root, "docs/提案/archive/2026-09-01-old/tasks.md"), "## 7. 完成\n- [x] 7.1 歸檔\n");
  const { changes, specs } = readSpectra(root, "docs/提案", { flow: "planning", changesDir: "docs/提案" });
  assert.equal(specs.length, 0);
  const c = changes.find(x => x.id === "game-page-redesign");
  assert.equal(c.status, "並行製作");
  assert.equal(c.plan.current, 5);
  assert.equal(c.plan.milestones.M1.done, true);
  const old = changes.find(x => x.id === "old");
  assert.equal(old.archived, true);
  assert.equal(old.status, "已完成");
  assert.equal(old.date, "2026-09-01");
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/planning.test.mjs`
Expected: 「提案：優化案…」fail（`p.optimize` 是 undefined）；「readSpectra 企劃模式」fail（找不到提案或 `c.plan` undefined）。

- [ ] **Step 3: 實作**

`parseProposal` 的回傳物件，在 `specsheet:` 那一行之後加三個欄位：

```js
    // 優化案：改既有功能；「基於」是原提案的 id（已歸檔的那張）
    optimize: /類型[：:]\s*優化/.test(md),
    base: ((md.match(/^>\s*基於[：:]\s*(\S+)/m) || [])[1] || "").trim(),
    // 設計稿（例：Claude Design 分享連結）：備用，正本是示意圖
    design: ((md.match(/^>\s*設計稿[：:]\s*(.+)$/m) || [])[1] || "").trim(),
```

`readSpectra` 改成：

```js
/** 讀整個 spec 目錄 → { changes, specs }
 *  opts.flow：game（預設）／planning；planning 的提案有 plan（階段、並行線、里程碑），status 是階段名稱
 *  opts.changesDir：提案資料夾（預設 <specDir>/changes；企劃文件流直接用 docs/提案） */
export function readSpectra(root, specDir = "docs/spectra", opts = {}) {
  const base = join(root, specDir);
  const planning = opts.flow === "planning";
  const changesDir = opts.changesDir ? join(root, opts.changesDir) : join(base, "changes");
  const dirs = d => (existsSync(d) ? readdirSync(d).filter(n => !n.startsWith(".") && statSync(join(d, n)).isDirectory()) : []);
  const change = (dir, name, archived) => {
    const tasksMd = read(join(dir, "tasks.md"));
    const tasks = parseTasks(tasksMd);
    const proposal = parseProposal(read(join(dir, "proposal.md")), name);
    const capabilities = dirs(join(dir, "specs"));
    const reqs = capabilities.flatMap(cap => parseDeltaReqs(read(join(dir, "specs", cap, "spec.md")), cap));
    const date = archived ? (name.match(/^\d{4}-\d{2}-\d{2}/) || [""])[0] : "";
    const id = archived ? name.replace(/^\d{4}-\d{2}-\d{2}-/, "") : name;
    const artifacts = { proposal: existsSync(join(dir, "proposal.md")), specs: capabilities.length > 0, design: existsSync(join(dir, "design.md")), tasks: existsSync(join(dir, "tasks.md")) };
    const plan = planning ? parseStages(tasksMd) : undefined;
    return { id, folder: name, archived, date, ...proposal, capabilities, reqs, artifacts, tasks, plan, status: planning ? planStatus(archived, plan) : statusOf({ archived, tasks }) };
  };
  const active = dirs(changesDir).filter(n => n !== "archive").map(n => change(join(changesDir, n), n, false));
  const archived = dirs(join(changesDir, "archive")).map(n => change(join(changesDir, "archive", n), n, true)).sort((a, b) => b.folder.localeCompare(a.folder));
  const specs = dirs(join(base, "specs")).map(name => {
    const md = read(join(base, "specs", name, "spec.md"));
    const purposeZh = (md.match(/## Purpose[\s\S]*?> 中文[：:]\s*(.+)/) || [])[1] || "";
    const purpose = purposeZh || (sections(md).Purpose || "").split("\n")[0];
    const reqs = ("\n" + md).split(/\n(?=### Requirement:)/).slice(1).map(block => ({
      name: block.match(/^### Requirement:\s*(.+)/)[1].trim(),
      zh: (block.match(/> 中文[：:]\s*(.+)/) || [])[1] || "",
      scenarios: [...block.matchAll(/^#### Scenario:\s*(.+)$/gm)].map(m => m[1].trim()),
    }));
    return { name, purpose, requirements: reqs.length, scenarios: reqs.reduce((n, r) => n + r.scenarios.length, 0), reqs };
  });
  return { changes: [...active, ...archived], specs };
}
```

（`read` 是檔案裡既有的 helper；`join(root, opts.changesDir)` 用相對路徑，所以 `changesDir: "docs/提案"` 會變成 `<root>/docs/提案`。）

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test`
Expected: 全部 pass。原本 `tests/workbench.test.mjs` 的「讀資料夾」測試不帶 opts，行為不變。

- [ ] **Step 5: Commit**

```bash
git add tools/workbench/lib.mjs tests/planning.test.mjs
git commit -m "feat(workbench): 提案的基於／設計稿欄位，readSpectra 支援企劃文件流

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: sync.mjs 與本機預覽資料工具

**Files:**
- Modify: `tools/workbench/sync.mjs`
- Create: `tools/workbench/local-data.mjs`
- Modify: `.github/workflows/deploy.yml:44-46`（Pages 路徑可設定）
- Test: `tests/planning.test.mjs`（追加一個對 local-data 的測試）

**Interfaces:**
- Consumes: Task 1/2 的 `PLAN_STAGES`、`readSpectra(root, specDir, { flow, changesDir })`。
- Produces: `data.json` 多兩個欄位：`flow: { mode: "planning", stages: PLAN_STAGES }`（遊戲模式是 `{ mode: "game" }`）、`changesDir: "docs/提案"`（遊戲模式 `"<specDir>/changes"`）。`node tools/workbench/local-data.mjs [root]` 把同樣形狀的資料印到 stdout（沒有 Issue、commit、runs）。

- [ ] **Step 1: 寫會失敗的測試**（追加到 `tests/planning.test.mjs`）

```js
import { execFileSync } from "node:child_process";

test("local-data：企劃模式的 data.json 有 flow.stages 與 changesDir，提案帶 plan", () => {
  const root = mkdtempSync(join(tmpdir(), "plan-data-"));
  mkdirSync(join(root, "docs/提案/game-page-redesign"), { recursive: true });
  writeFileSync(join(root, "docs/提案/game-page-redesign/proposal.md"), PROPOSAL);
  writeFileSync(join(root, "docs/提案/game-page-redesign/tasks.md"), TASKS);
  writeFileSync(join(root, "workbench.config.json"), JSON.stringify({ name: "PlayHorny 平台", flow: "planning", spec_dir: "docs/提案", content_dirs: ["docs/企劃"] }));
  const out = JSON.parse(execFileSync(process.execPath, ["tools/workbench/local-data.mjs", root], { encoding: "utf8" }));
  assert.equal(out.flow.mode, "planning");
  assert.equal(out.flow.stages.length, 7);
  assert.equal(out.changesDir, "docs/提案");
  assert.equal(out.name, "PlayHorny 平台");
  assert.equal(out.changes[0].plan.current, 5);
  assert.deepEqual(out.requests, []);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/planning.test.mjs`
Expected: fail，`Cannot find module … local-data.mjs`。

- [ ] **Step 3: 新增 `tools/workbench/local-data.mjs`**

```js
// 本機預覽用的管理台資料（不碰 GitHub：沒有 Issue、commit、部署紀錄）
// 用法：node tools/workbench/local-data.mjs [專案根目錄] > web/console/demo.json
//      然後 node tools/serve.mjs，開 http://localhost:8080/console/?repo=local/preview&data=demo.json
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { readSpectra, indexContent, PLAN_STAGES } from "./lib.mjs";

const root = resolve(process.argv[2] || ".");
const cfgPath = join(root, "workbench.config.json");
const cfg = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, "utf8")) : {};
const specDir = cfg.spec_dir || "docs/spectra";
const planning = cfg.flow === "planning";
const changesDir = planning ? specDir : `${specDir}/changes`;
const contentDirs = cfg.content_dirs || ["docs/企劃"];
const repo = cfg.repo || "local/preview";
const { changes, specs } = readSpectra(root, specDir, { flow: planning ? "planning" : "game", changesDir: planning ? specDir : undefined });
const data = {
  generatedAt: new Date().toISOString(),
  repo, repoUrl: `https://github.com/${repo}`, specDir, changesDir, private: false, branch: "main",
  contentDirs, content: indexContent(root, contentDirs), assets: null,
  name: cfg.name || repo, links: cfg.links || [], tools: cfg.tools || [],
  flow: planning ? { mode: "planning", stages: PLAN_STAGES } : { mode: "game" },
  changes, specs, requests: [], feedback: [], commits: [], runs: [], pulls: [],
};
process.stdout.write(JSON.stringify(data, null, 1));
```

- [ ] **Step 4: 改 `tools/workbench/sync.mjs`**

(a) import 加 `PLAN_STAGES`：

```js
import { readSpectra, approveTasks, approvalIssueBody, indexContent, approverOf, ISSUE_MARKER_RE, ISSUE_APPROVE_RE, qaItems, qaIssueBody, parseQa, assetSummary, QA_MARKER_RE, QA_ALWAYS, PLAN_STAGES } from "./lib.mjs";
```

(b) `const specDir = …` 之後加：

```js
// 企劃文件流（平台專案）：提案直接放在 spec_dir（docs/提案）；沒有同意、提案 Issue、試玩清單
const planning = cfg.flow === "planning";
const changesDir = planning ? specDir : `${specDir}/changes`;
const readOpts = { flow: planning ? "planning" : "game", changesDir: planning ? specDir : undefined };
```

(c) 把三處 `readSpectra(root, specDir)` 改成 `readSpectra(root, specDir, readOpts)`（第 1 節前、`if (changed.length)`、第 4 節的 `const { specs }`）。

(d) 第 1、2、3、3b 節只在遊戲模式跑：把 `const changed = [];` 與 `let { changes } = readSpectra(root, specDir, readOpts);` 兩行**留在原位**，然後在 `const hasLabel = …` 那一行之前插入 `if (!planning) {`，在第 3b 節最後一行 `c.qa = { … };\n}` 之後、`// ---- 4. 工作台資料 ----` 之前插入 `}`。（`hasLabel`、`setBox`、`issueOf`、`qaOf`、`playUrl` 都只在區塊內用到，一起包進去沒問題。）

(e) `const data = {` 物件裡，在 `repo, repoUrl, specDir,` 之後加：

```js
  changesDir,
  flow: planning ? { mode: "planning", stages: PLAN_STAGES } : { mode: "game" },
```

(f) 最後一行 console.log 改成：

```js
console.log(`工作台資料：提案 ${changes.length}、規則書 ${specs.length}、需求 ${data.requests.length}、回饋 ${data.feedback.length}${planning ? "（企劃文件流）" : ""}`);
```

- [ ] **Step 5: 改 `.github/workflows/deploy.yml`**

`upload-pages-artifact` 的 `path: web` 改成：

```yaml
        with:
          path: ${{ vars.PAGES_PATH || 'web' }}   # 企劃文件流的專案設 PAGES_PATH = .（示意圖在 docs/ 底下）
```

- [ ] **Step 6: 跑測試與語法檢查**

Run: `node --test && node --check tools/workbench/sync.mjs`
Expected: 全部 pass；`--check` 沒輸出。

- [ ] **Step 7: Commit**

```bash
git add tools/workbench/sync.mjs tools/workbench/local-data.mjs tests/planning.test.mjs .github/workflows/deploy.yml
git commit -m "feat(workbench): 企劃文件流不開 Issue、data.json 帶 flow；本機預覽資料工具；Pages 路徑可設定

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: 管理台 — 模式判斷、側欄、總覽、提案列表

**Files:**
- Modify: `web/console/app.js`（`STAGES` 附近、`sideHtml`、`ORDER`、`V.overview`、`V.changes`、`setData`）
- Modify: `web/console/index.html`（`?v=`）

**Interfaces:**
- Consumes: `data.flow.mode`、`data.flow.stages`、`change.plan`、`data.changesDir`。
- Produces: `isPlan()`、`planStageOf(c)`、`msChip(c, key)`、`stageOf(c)`（兩種模式都能用）、`sortKey(c)`。後面的 task 用這些。

- [ ] **Step 1: 加企劃模式的 helper**（放在 `const STAGES = [` 之前）

```js
// ===== 企劃文件流（data.flow.mode === "planning"）：平台專案的 7 格流程，沒有同意／試玩／規則書 =====
const isPlan = () => S.data?.flow?.mode === "planning";
const planStages = () => (S.data?.flow?.stages || []);
const planStageOf = c => c.archived ? 7 : (c.plan?.current ?? 7);
const planLabel = n => planStages().find(s => s.n === n)?.label || "";
// 里程碑小標：◆ M1・2026-10-07，需求會議／◆ M2・待確認
const msChip = (c, key) => { const m = c.plan?.milestones?.[key]; if (!m) return ""; return `<span class="chip ${m.done ? "c-ok" : "c-warn"}" title="${esc(m.text)}">◆ ${key}${m.done ? `・${esc(m.note || "已確認")}` : "・待確認"}</span>`; };
// 第 5 階段的並行線：美術 0/2・後端 1/2・前端 0/1
const lanesText = c => (c.plan?.stages?.find(s => s.n === 5)?.lanes || []).filter(l => l.name).map(l => `${l.name} ${l.done}/${l.total}`).join("・");
const sortKey = c => isPlan() ? (c.archived ? 99 : 10 - planStageOf(c)) : (ORDER[c.status] ?? 5);
```

- [ ] **Step 2: `stageOf` 兩種模式都能用**

把 `const stageOf = c => c.archived ? 8 : …` 改成：

```js
const stageOf = c => isPlan() ? planStageOf(c) : (c.archived ? 8 : c.status === "待驗收" ? 6 : c.status === "製作中" || c.status === "已同意" ? 4 : c.status === "待同意" ? 3 : 2);
```

- [ ] **Step 3: 側欄**（`sideHtml`）

`${item("specs", "scroll", "規則書", d.specs.length)}` 改成 `${isPlan() ? "" : item("specs", "scroll", "規則書", d.specs.length)}`；
`${item("activity", "rocket", "上線紀錄")}` 改成 `${item("activity", "rocket", isPlan() ? "改動紀錄" : "上線紀錄")}`；
`waiting` 改成 `waiting = act.filter(c => isPlan() ? [4, 6].includes(planStageOf(c)) : c.status === "待同意").length`（企劃模式：等需求確認或等驗收的提案數）。

- [ ] **Step 4: 總覽的摘要列與提案表**（`V.overview`）

`const active = [...act].sort((a, b) => ORDER[a.status] - ORDER[b.status]);` 改成 `const active = [...act].sort((a, b) => sortKey(a) - sortKey(b));`。

摘要列 `<div class="strip">…</div>` 改成：

```js
    <div class="strip">
      ${isPlan()
        ? planStages().filter(s => s.n !== 7).map(s => seg(s.milestone ? "checkCircle" : "workflow", s.label, act.filter(c => planStageOf(c) === s.n).length, "flow", s.milestone || s.n === 6 ? "attn" : "")).join("") + seg("archive", "已完成", arc.length, "changes")
        : seg("hourglass", "待同意", by("待同意").length, "flow", "attn") + seg("code", "製作中", by("已同意").length + by("製作中").length, "flow") + seg("flask", "待驗收", by("待驗收").length, "flow", "attn") + seg("archive", "已完成", arc.length, "changes")}
    </div>
```

（原本 `seg("archive", "已完成", …)` 的第四個參數照原檔；上面遊戲模式那一串就是原本的四個 seg，只是放進三元運算。）

「進行中的提案」表格的每一列 `<td>${chip(c.status)}</td>` 後面原本是標題與進度；企劃模式在標題下方加並行線文字：在標題的 `<div class="muted" …>` 之後加 `${isPlan() && planStageOf(c) === 5 ? `<div class="muted">${esc(lanesText(c))}</div>` : ""}`。

- [ ] **Step 5: 提案列表**（`V.changes`）

排序改 `sortKey`；表頭第四欄 `<th>同意</th>` 改成 `<th>${isPlan() ? "里程碑" : "同意"}</th>`；該欄內容（原本顯示 approvalNote 的那格）改成 `${isPlan() ? msChip(c, "M1") + msChip(c, "M2") : <原本的內容>}`。

- [ ] **Step 6: 狀態色**（`setData` 之後、CSS）

`index.html` 的 CSS 在 `.s-製作中` 那一組後面加（顏色沿用既有變數）：

```css
.s-需求, .s-企劃書, .s-示意圖 { background: var(--line-strong); }
.s-需求確認, .s-驗收 { background: var(--warn-bg, #fff4d6); color: var(--warn, #8a5a00); }
.s-並行製作 { background: var(--accent-bg, #e8f0ff); color: var(--accent); }
.s-待歸檔 { background: var(--ok-bg, #e6f6ec); color: var(--ok); }
```

（執行時先看 `index.html` 裡 `.s-待同意`、`.s-待驗收`、`.s-製作中` 實際用的變數名，照同樣的寫法；上面的 `var(--x, 後備色)` 只是保險。）

- [ ] **Step 7: 快取版本**

`index.html` 與 `app.js` 裡所有 `?v=2026…` 改成同一個新值 `?v=202610080900`。

- [ ] **Step 8: 本機看遊戲模式沒壞**

Run: `node tools/serve.mjs`（背景）→ 開 `http://localhost:8080/console/?repo=fishon100/pinball-sling`
Expected: 總覽、流程圖、提案列表與改動前一樣（8 格、待同意／製作中／待驗收）。瀏覽器 console 沒有錯誤。

- [ ] **Step 9: Commit**

```bash
git add web/console/app.js web/console/index.html
git commit -m "feat(console): 企劃文件流的模式判斷、側欄、總覽與提案列表

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: 管理台 — 企劃文件流的流程圖

**Files:**
- Modify: `web/console/app.js`（新增 `flowDiagramPlan`、`drawFlowLinksPlan`；`V.flow` 與 resize 事件分流）

**Interfaces:**
- Consumes: Task 4 的 `isPlan`、`planStages`、`planStageOf`、`msChip`、`lanesText`。
- Produces: `flowDiagramPlan() → { html, lanes }`，`lanes = [{ id, row, st }]` 與遊戲模式同形狀。

- [ ] **Step 1: 新增 `flowDiagramPlan`**（放在 `function flowDiagram()` 之前）

```js
// 企劃文件流的流程圖：上方兩條標準流程（介面向、系統向），下方每張進行中的提案一條泳道
function flowDiagramPlan() {
  const d = S.data, ST = planStages(), act = d.changes.filter(c => !c.archived).sort((a, b) => planStageOf(b) - planStageOf(a));
  const arc = d.changes.filter(c => c.archived);
  const rq = d.requests.filter(i => i.state === "open").length + d.feedback.filter(i => i.state === "open").length;
  let r = 1;
  const at = (col, row, html, cls = "cell") => `<div class="${cls}" style="grid-column:${col + 1};grid-row:${row}">${html}</div>`;
  const node = (id, ic, title, sub, cls = "", tip = "") => `<div class="node ${cls}" data-node="${id}"${tip ? ` title="${esc(tip)}"` : ""}>${I(ic, 18)}<b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
  let h = "";
  for (let i = 0; i <= ST.length; i++) h += `<div class="col-line" style="grid-column:${i + 1}"></div>`;
  h += `<div style="grid-column:1;grid-row:${r}"></div>` + ST.map(s => `<div class="head" style="grid-column:${s.n + 1};grid-row:${r}"><span class="num">${s.n}</span><b>${s.milestone ? "◆ " : ""}${s.label}</b><small>${s.sub}</small></div>`).join("");
  // 標準流程：介面向（7 格）
  r++;
  h += `<div class="lane-label" style="grid-column:1;grid-row:${r}"><span class="pill brand" title="直接影響畫面的功能：企劃書 → 示意圖＋SPEC → 美術／後端／前端並行">${I("layout", 15)}介面向</span></div>`;
  h += at(1, r, node("u1", "lightbulb", "需求", "需求池、回饋"));
  h += at(2, r, node("u2", "fileText", "企劃書", "Notion，repo 放連結"));
  h += at(3, r, node("u3", "layout", "示意圖＋SPEC", "AI 依企劃書做"));
  h += at(4, r, node("u4", "checkCircle", "需求確認 M1", "需求會議"));
  h += at(5, r, node("u5", "users", "並行製作", "美術 ◆M2／後端／前端"));
  h += at(6, r, node("u6", "flask", "驗收", "SPEC 驗收條件"));
  h += at(7, r, node("u7", "archive", "完成", "歸檔"));
  // 標準流程：系統向（跳過示意圖）
  r++;
  h += `<div class="lane-label" style="grid-column:1;grid-row:${r}"><span class="pill" style="background:var(--line-strong);color:var(--ink)" title="只動後端邏輯、資料，畫面沒有明顯改變：只有企劃書">${I("code", 15)}系統向</span></div>`;
  h += at(1, r, node("s1", "lightbulb", "需求", ""));
  h += at(2, r, node("s2", "fileText", "企劃書", "Notion"));
  h += at(4, r, node("s4", "checkCircle", "需求確認 M1", ""));
  h += at(5, r, node("s5", "code", "製作", "後端（需要時加前端）"));
  h += at(6, r, node("s6", "flask", "驗收", ""));
  h += at(7, r, node("s7", "archive", "完成", ""));
  // 每張進行中的提案
  r++;
  h += `<div class="lane-title" style="grid-row:${r}">進行中的提案（${act.length}）</div>`;
  const lanes = [];
  for (const c of act) {
    r++;
    const st = planStageOf(c);
    lanes.push({ id: c.id, row: r, st });
    h += `<div class="lane-label" style="grid-column:1;grid-row:${r}"><button class="pill change" data-change="${esc(c.id)}"><span>${esc(short(c.title, 18))}</span><small>${c.optimize ? "優化・" : ""}${esc(c.docs)}</small></button></div>`;
    for (const s of ST) {
      if (s.n === 3 && c.docs !== "介面向") { h += at(3, r, `<span data-node="${c.id}:3" class="node todo" style="opacity:.35"></span>`, "cell small"); continue; }
      const ms = s.milestone ? c.plan?.milestones?.[s.milestone] : null;
      if (s.n < st) h += at(s.n, r, `<div class="node done" data-node="${c.id}:${s.n}" title="${s.label}：完成${ms?.note ? "・" + esc(ms.note) : ""}">${I("check", 16)}</div>`, "cell small");
      else if (s.n === st) h += at(s.n, r, `<div class="node current" data-node="${c.id}:${s.n}" data-change="${esc(c.id)}" title="${esc(s.label)}">${I(s.n === 5 ? "users" : s.n === 6 ? "flask" : s.milestone ? "checkCircle" : "fileText", 16)}${s.n === 5 ? `<small>${esc(lanesText(c))}</small>` : ""}</div>`, "cell small");
      else h += at(s.n, r, `<span class="node todo" data-node="${c.id}:${s.n}"></span>`, "cell small");
    }
  }
  if (!act.length) { r++; h += `<div class="lane-label" style="grid-column:1;grid-row:${r}"></div><div class="empty" style="grid-column:2 / -1;grid-row:${r};z-index:1">目前沒有進行中的提案。對 AI 說「把 <需求> 開成提案」。</div>`; }
  r++;
  h += `<div class="lane-sep" style="grid-row:${r}"></div>`;
  r++;
  h += `<div class="lane-label" style="grid-column:1;grid-row:${r}"><span class="pill" style="background:var(--line-strong);color:var(--ink)">${I("archive", 15)}其他</span></div>`;
  h += at(1, r, `<div class="node clickable" data-go="issues">${I("lightbulb", 18)}<b>${rq} 則</b><small>還沒處理的需求／回饋</small></div>`);
  h += at(7, r, `<div class="node clickable" data-go="changes">${I("archive", 18)}<b>${arc.length} 張</b><small>已完成的提案</small></div>`);
  return { html: `<div class="flow-wrap"><div class="flow plan" id="flow">${h}<svg class="links" id="flowLinks"></svg></div></div>`, lanes };
}
// 企劃文件流的連接線：介面向 u1→u7、系統向 s1→s2→s4→…、每條泳道完成綠色／之後灰虛線
function drawFlowLinksPlan(lanes) {
  const flow = $("#flow"), svg = $("#flowLinks"); if (!flow || !svg) return;
  const box = flow.getBoundingClientRect();
  const pos = id => { const el = flow.querySelector(`[data-node="${CSS.escape(id)}"]`); if (!el) return null; const r = el.getBoundingClientRect(); return { l: r.left - box.left, r: r.right - box.left, t: r.top - box.top, b: r.bottom - box.top, cx: (r.left + r.right) / 2 - box.left, cy: (r.top + r.bottom) / 2 - box.top }; };
  const paths = [];
  const hline = (a, b, cls = "") => { const A = pos(a), B = pos(b); if (A && B) paths.push(`<path class="${cls}" d="M${A.r} ${A.cy} H${B.l}"/>`); };
  ["u1", "u2", "u3", "u4", "u5", "u6", "u7"].reduce((p, c) => (hline(p, c, "on"), c));
  ["s1", "s2", "s4", "s5", "s6", "s7"].reduce((p, c) => (hline(p, c, "tech"), c));
  for (const L of lanes) {
    const pts = [1, 2, 3, 4, 5, 6, 7].map(n => pos(`${L.id}:${n}`)).filter(Boolean);
    for (let i = 1; i < pts.length; i++) paths.push(`<path class="${i + 1 <= L.st ? "done" : "dash"}" d="M${pts[i - 1].r} ${pts[i - 1].cy} H${pts[i].l}"/>`);
  }
  svg.setAttribute("viewBox", `0 0 ${flow.scrollWidth} ${flow.scrollHeight}`);
  const arrows = [["base", "var(--line-strong)"], ["on", "var(--accent)"], ["tech", "var(--violet)"], ["done", "var(--ok)"]]
    .map(([k, c]) => `<marker id="ar-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" style="fill:${c}"/></marker>`).join("");
  svg.innerHTML = `<defs>${arrows}</defs>` + paths.join("");
}
```

（`pos` 的回傳物件照原本 `drawFlowLinks` 裡的寫法抄，欄位 `l r t b cx cy`；執行時對照原檔第 350 行確認欄位名稱一致。）

- [ ] **Step 2: `V.flow` 與 resize 分流**

```js
V.flow = () => {
  const seg = …（原本的那一行不變）;
  if (S.flowMode === "tree") return vh("workflow", "流程圖", "專案 → 階段 → 提案 → 文件與任務", seg) + flowTreeHtml();
  const { html, lanes } = isPlan() ? flowDiagramPlan() : flowDiagram();
  flowLanes = lanes;
  setTimeout(() => (isPlan() ? drawFlowLinksPlan : drawFlowLinks)(lanes), 0);
  const sub = isPlan() ? "上方是兩條標準流程（介面向、系統向）；下方每張進行中的提案一條泳道，◆ 是里程碑（M1 需求確認、M2 規格確認）" : "上方是兩條標準流程（企劃提案、技術提案）；下方每張進行中的提案一條泳道，亮色格子＝目前在這一步";
  return vh("workflow", "流程圖", sub, seg) + html + `<div class="legend">…（原本的 legend 不變）</div>`;
};
```

resize 事件：`addEventListener("resize", () => { if (S.view === "flow" && S.flowMode === "diagram") (isPlan() ? drawFlowLinksPlan : drawFlowLinks)(flowLanes); });`

- [ ] **Step 3: 流程圖的格數**

`index.html` 的 CSS 找 `.flow {` 的 `grid-template-columns`（8 格＋標籤欄）。加一條：

```css
.flow.plan { grid-template-columns: var(--lane-w, 160px) repeat(7, minmax(120px, 1fr)); }
```

（執行時照原本 `.flow` 的 `grid-template-columns` 寫法，把 `repeat(8, …)` 改成 `repeat(7, …)`，其餘一樣。）

- [ ] **Step 4: 用本機資料看企劃模式**

```bash
node tools/workbench/local-data.mjs <某個 planning 專案根目錄> > web/console/demo.json
node tools/serve.mjs
```
（Task 7 之前還沒有真的 planning 專案：先用 Task 3 測試裡那組 PROPOSAL／TASKS 建一個暫時資料夾，跑完就刪，`demo.json` 不要 commit。）
開 `http://localhost:8080/console/?repo=local/preview&data=demo.json#flow`
Expected: 7 格表頭（第 4 格有 ◆）、介面向與系統向兩條標準流程、一條提案泳道停在第 5 格並顯示「美術 0/2・後端 1/2・前端 0/1」。遊戲專案（`?repo=fishon100/pinball-sling`）仍是 8 格。

- [ ] **Step 5: Commit**

```bash
git add web/console/app.js web/console/index.html
git commit -m "feat(console): 企劃文件流的流程圖（7 格、里程碑、並行線）

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: 管理台 — 提案明細、我的待辦、文件列

**Files:**
- Modify: `web/console/app.js`（`chainHtml`、`docsRow`、`changeDetail`、`ROLES`／`ROLE_TAG`、`myTodo`、`V.help` 的名詞）

**Interfaces:**
- Consumes: Task 4 的 helper；`change.plan`、`change.base`、`change.design`、`change.optimize`。

- [ ] **Step 1: `chainHtml` 企劃模式**

函式開頭加：

```js
  if (isPlan()) {
    const cur = planStageOf(c), st = planStages().filter(s => !(s.n === 3 && c.docs !== "介面向"));
    const now = st.findIndex(s => s.n === cur);
    return `<div class="chain">${st.map((s, i) => { const ok = c.archived || s.n < cur; return `${i ? `<div class="link ${ok ? "done" : ""}"></div>` : ""}<div class="step ${ok ? "done" : i === now ? "now" : ""}" title="${ok ? "完成" : i === now ? "目前在這一步" : "還沒到"}"><div class="dotc">${ok ? I("check", 13) : s.milestone ? "◆" : s.n}</div><span>${esc(s.label)}</span></div>`; }).join("")}</div>`;
  }
```

- [ ] **Step 2: `docsRow` 認得網址**

企劃書是 Notion 連結、設計稿是外部連結：在函式裡把企劃書那一段改成

```js
    ${c.brief ? (/^https?:\/\//.test(c.brief) ? `<a class="btn sm" href="${esc(c.brief.split(/[（(]/)[0].trim())}" target="_blank" rel="noopener" title="${esc(c.brief)}">${I("fileText", 14)}企劃書${/（([^）]+)）/.test(c.brief) ? "・" + esc(c.brief.match(/（([^）]+)）/)[1]) : ""}</a>` : `<button class="btn sm" data-opendoc="${esc(c.brief)}">${I("fileText", 14)}企劃書</button>`) : ""}
    ${c.design ? `<a class="btn sm" href="${esc(c.design)}" target="_blank" rel="noopener" title="設計稿（備用，正本是示意圖）">${I("layout", 14)}設計稿</a>` : ""}
```

並在第一個 `chip` 後面加優化案標記：`${c.optimize ? `<button class="chip c-info" data-change="${esc(c.base)}" title="優化案：基於 ${esc(c.base)}">${I("sparkles", 12)}優化・${esc(c.base)}</button>` : ""}`。

- [ ] **Step 3: `changeDetail` 企劃模式**

把 `<div class="row" style="margin-bottom:14px">…</div>` 這段按鈕列改成：

```js
    <div class="row" style="margin-bottom:14px">
      ${isPlan() ? "" : c.status === "待同意" ? approveBtn(c) : ""}
      ${isPlan() ? (planStageOf(c) === 4 ? sayBtn(`${c.id} 需求確認了`, "") : planStageOf(c) === 5 && c.plan?.milestones?.M2 && !c.plan.milestones.M2.done ? sayBtn(`${c.id} 規格確認了`, "") : planStageOf(c) === 6 ? sayBtn(`${c.id} 驗收通過`, "") : "")
        : ["已同意", "製作中"].includes(c.status) ? sayBtn(`做 ${c.id}`, "") : c.status === "待驗收" ? sayBtn(`${c.id} 驗收通過`, "") : ""}
      ${c.issue && !c.archived ? `<button class="btn" data-comment="${esc(c.id)}">${I("message")}留言／提問</button>` : ""}
      <a class="btn" href="${tree(folder)}" target="_blank" rel="noopener">${I("fileText")}提案檔案</a>
      ${c.issue ? `<a class="btn" href="${esc(c.issue.url)}" target="_blank" rel="noopener" title="GitHub 上的討論串（Issue）">${I("git")}討論串 #${c.issue.number}${c.issue.comments ? `（${c.issue.comments}）` : ""}</a>` : ""}
    </div>
    ${isPlan() ? `<div class="row" style="margin-bottom:14px">${msChip(c, "M1")}${msChip(c, "M2")}</div>` : ""}
```

`folder` 的計算改成 `const folder = `${S.data.changesDir || S.data.specDir + "/changes"}/${c.archived ? "archive/" : ""}${c.folder}`;`。

`${qaHtml(c)}` 改成 `${isPlan() ? "" : qaHtml(c)}`；`影響的規則書` 那一段已經靠 `c.capabilities?.length` 自動不顯示。

任務標題 `<h3 …>任務 ${c.tasks.done}/${c.tasks.total}</h3>` 改成 `<h3 …>${isPlan() ? "階段與任務" : "任務"} ${c.tasks.done}/${c.tasks.total}</h3>`。

- [ ] **Step 4: 角色與我的待辦**

`ROLES` 陣列加兩筆（放在「程式」之後）：

```js
["前端", "layout", "第 5 階段「前端」線的任務；M2 之後補介面細節"], ["後端", "code", "第 5 階段「後端」線的任務；M1 之後就能開工"],
```

`ROLE_TAG` 加 `前端: /【前端】/, 後端: /【後端】/`。

`roleTasks(role)` 之後新增：

```js
// 企劃文件流：第 5 階段的並行線，線名就是角色（美術／後端／前端），不用在任務文字標【角色】
function laneTasks(role) {
  const out = [];
  for (const c of S.data.changes.filter(x => !x.archived)) for (const l of c.plan?.stages?.find(s => s.n === 5)?.lanes || []) if (l.name === role) for (const it of l.items) if (!it.done) out.push({ c, text: it.text });
  return out;
}
```

`myTodo` 開頭、`const is = …` 之後加企劃模式的分支，並讓遊戲模式的區塊不執行：

```js
  if (isPlan()) {
    if (is("企劃")) {
      act.filter(c => planStageOf(c) === 4).forEach(c => add("m1:" + c.id, todoLi("warn", esc(c.title), `等需求確認（M1）：需求會議看企劃書＋示意圖，確認後對 AI 說・${esc(c.id)}`, sayBtn(`${c.id} 需求確認了`) + detailBtn(c))));
      act.filter(c => planStageOf(c) === 5 && c.plan?.milestones?.M2 && !c.plan.milestones.M2.done && (c.plan.stages.find(s => s.n === 5)?.lanes.find(l => l.name === "美術")?.items.filter(i => !i.milestone).every(i => i.done))).forEach(c => add("m2:" + c.id, todoLi("warn", esc(c.title), `美術完成了：補 SPEC 介面細節、匯出 spec.md，確認後對 AI 說・${esc(c.id)}`, sayBtn(`${c.id} 規格確認了`) + detailBtn(c))));
      act.filter(c => planStageOf(c) === 6).forEach(c => add("vf:" + c.id, todoLi("info", esc(c.title), `開發完成：照 SPEC 驗收條件逐條驗，通過後對 AI 說・${esc(c.id)}`, sayBtn(`${c.id} 驗收通過`) + detailBtn(c))));
      if (fbOpen.length + rqOpen.length) add("fb", todoLi("bad", `${fbOpen.length} 則回饋、${rqOpen.length} 則需求還沒處理`, "看過後請 AI 整理成提案或寫回同一張提案", sayBtn(fbOpen.length ? "看回饋" : "看需求") + `<button class="btn sm" data-go="issues">查看</button>`));
    }
    for (const r of ["美術", "後端", "前端"]) if (is(r)) laneTasks(r).forEach(({ c, text }) => add("l:" + c.id + text, todoLi("warn", esc(text), `提案：${esc(c.title)}・${r}`, detailBtn(c))));
    for (const r of ["企劃", "美術", "程式", "QA", "劇本／數值", "前端", "後端"]) if (is(r)) roleTasks(r).forEach(({ c, text }) => add("t:" + c.id + text, todoLi("warn", esc(text), `提案：${esc(c.title)}`, detailBtn(c))));
    return items.map(x => x.html);
  }
```

（放在 `if (is("企劃")) {` 之前；遊戲模式的程式碼在它後面原樣保留。原本「看回饋」那行的 `<button … data-go="issues"` 內容照原檔。）

- [ ] **Step 5: 說明頁名詞**

`V.help` 的名詞表（`["規則書", …]`、`["規劃書", …]` 那個陣列）加兩筆：

```js
  ["企劃文件流", "平台專案的流程：企劃書（Notion）→ 示意圖＋SPEC → 需求確認 M1 → 美術／後端／前端並行（美術完成約九成後規格確認 M2）→ 驗收。程式由公司團隊做，管理台只追進度"],
  ["里程碑", "M1 需求確認、M2 規格確認：企劃對 AI 說「X 需求確認了」「X 規格確認了」，AI 在 tasks.md 勾起來並記日期。取代遊戲專案的「同意」"],
```

- [ ] **Step 6: 本機確認**

同 Task 5 Step 4 的 demo 資料，開 `#overview` 與點提案：
Expected: 明細有 7 步進度鏈（第 4 步是 ◆）、里程碑兩顆 chip（M1 綠、M2 黃）、企劃書是連到 Notion 的外部連結、沒有同意按鈕與試玩清單；角色選「後端」時待辦列出「5.3 後端完成」。遊戲專案的明細不變。

- [ ] **Step 7: Commit**

```bash
git add web/console/app.js
git commit -m "feat(console): 企劃文件流的提案明細、里程碑、我的待辦（美術／後端／前端）

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: 文件與設定（docs/flow、CLAUDE.md、config 範例、projects.json）

**Files:**
- Create: `docs/flow/10 企劃文件流.md`
- Modify: `CLAUDE.md`（「企劃書、示意圖、規格書」一節之後加一節）
- Modify: `workbench.config.json`（加 `_flow說明`）
- Modify: `docs/flow/00 總覽.md`（文件地圖加第 10 列）、`README.md`（「從這裡開始讀」加一列）
- Modify: `web/console/projects.json`（加 playhorny-platform）

- [ ] **Step 1: 寫 `docs/flow/10 企劃文件流.md`**

```markdown
# 10 企劃文件流（平台專案）

> 總覽：[00 總覽](00%20總覽.md)。遊戲專案走 [01 一輪開發](01%20一輪開發.md)；**平台專案**（程式由公司前端／後端團隊做、交付物是文件）走這一份。
> 設計決策與理由：`docs/superpowers/specs/2026-10-07-planning-flow-design.md`。

## 一句話

企劃書（Notion）→ 示意圖＋SPEC（GitHub）→ **M1 需求確認** → 美術／後端／前端並行（美術完成約九成 → **M2 規格確認**）→ 驗收 → 歸檔。
管理台只追進度，不呼叫 AI；AI 由企劃在對話中下指令。

## 開啟方式

`workbench.config.json` 加一行 `"flow": "planning"`，`spec_dir` 指向 `docs/提案`。沒設 `flow` 就是遊戲流程。

## 7 個階段

| # | 階段 | 誰 | 產出／紀錄 |
|---|---|---|---|
| 1 | 需求 | 任何人 | 需求池、回饋 Issue |
| 2 | 企劃書 | 企劃＋AI | Notion 企劃書；proposal.md 只放連結＋版本號 |
| 3 | 示意圖 | AI | 示意圖 HTML（SPEC 行為層一起寫）；**介面向才有**，系統向跳過 |
| 4 | 需求確認 ◆M1 | 企劃 | 需求會議確認企劃書＋示意圖 |
| 5 | 並行製作 | 美術／後端／前端 | 三條線各自待辦；美術線含 ◆M2 規格確認 |
| 6 | 驗收 | 企劃 | 照 SPEC 的驗收條件逐條驗 |
| 7 | 完成 | — | 提案搬到 `archive/` |

後端在 M1 後就能開工（企劃書＋SPEC 行為層夠用）；前端 M1 後先做結構與邏輯，介面細節等 M2。

## tasks.md 怎麼寫（管理台靠它判斷進度）

```markdown
## 1. 需求
- [x] 1.1 需求來源：Notion 需求池
## 2. 企劃書
- [x] 2.1 Notion 撰寫（https://app.notion.com/p/…，v1.1）
## 3. 示意圖
- [x] 3.1 示意圖 v21（docs/提案/<id>/示意圖/…html）
## 4. 需求確認 ◆
- [x] M1 需求確認：企劃書 v1.1＋示意圖 v21（2026-10-07，需求會議）
## 5. 並行製作
### 美術
- [ ] 5.1 視覺稿（完成約九成時通知企劃）
- [ ] M2 規格確認：SPEC 定稿、匯出 spec.md
### 後端
- [ ] 5.2 開工單（Jira 連結）
- [ ] 5.3 後端完成
### 前端
- [ ] 5.4 開工單（Jira 連結）
- [ ] 5.5 前端完成（要在 M2 之後）
## 6. 驗收
- [ ] 6.1 照 SPEC 驗收條件逐條驗
```

- `## N.` 的編號＝階段；目前階段＝第一個還有沒勾項目的章節
- `###` 只用在第 5 階段，線名＝角色（美術、後端、前端）；不需要的線不寫
- 里程碑：`M1 `／`M2 ` 開頭；勾選時括號寫日期與依據

## 對 AI 說

| 企劃說 | AI 做什麼 |
|---|---|
| 把 X 開成提案 | 建 `docs/提案/<id>/proposal.md`、`tasks.md`（照上面格式）；介面向的做示意圖 |
| X 需求確認了 | 勾 M1，括號寫「日期，需求會議／對話中」，推上去 |
| X 規格確認了 | 補 SPEC 介面細節、`node tools/specsheet.mjs` 重新匯出 spec.md、勾 M2，推上去 |
| 後端／前端開工單了：<連結> | 勾對應線的「開工單」，把連結寫進去 |
| X 驗收通過 | 提案搬到 `archive/<日期>-<id>`；優化案在原提案加一行「已由 <id> 優化」 |
| 回饋：… | 提案未歸檔 → 寫進同一張提案的對應階段、取消對應里程碑的勾；已歸檔 → 另開優化案 |

## 優化案

`proposal.md` 開頭多兩行：`> 類型：優化`、`> 基於：<原提案 id>`。企劃書在 Notion **同一頁改版**；示意圖**複製新檔**（v21 → v22，舊檔留著）；SPEC 需求對照頁多一欄「本次變更」（不變／修改／新增）。

## 正本在哪裡

| 內容 | 正本 | repo 放什麼 |
|---|---|---|
| 企劃書、企劃 wiki、名詞表 | Notion | 連結＋版本號 |
| 示意圖＋SPEC | 示意圖 HTML（GitHub，Pages 直接開） | 檔案 |
| spec.md | 由 HTML 匯出 | 副本，不手改 |
| 設計稿（Claude Design） | — | proposal.md 一行連結，備用 |
| 美術素材 | Drive／Figma | 連結 |
| 工單 | Jira | 連結寫在 tasks.md |
```

- [ ] **Step 2: `CLAUDE.md` 加一節**（放在「企劃書、示意圖、規格書」一節之後）

```markdown
## 企劃文件流（`workbench.config.json` 的 `flow: "planning"`；平台專案；2026-10-07 企劃決定）
人讀的說明：`docs/flow/10 企劃文件流.md`。這種專案**AI 不寫程式**（公司前端／後端做），只產出與維護文件、記錄進度：
- 提案放 `docs/提案/<id>/`（沒有 `changes/`），歸檔到 `docs/提案/archive/<日期>-<id>/`。不用 Spectra 指令、不寫 `docs/spectra/specs` 規則書
- `proposal.md` 開頭：`> 中文標題`、`> 類型：企劃／優化`、`> 基於：<原提案>`（優化案）、`> 文件：介面向／系統向`、`> 企劃書：<Notion 連結>（v1.1）`、`> 示意圖：<repo 路徑>`、`> 設計稿：<連結>`（選填）
- **企劃書正本在 Notion**：repo 只放連結＋版本號，不複製內容。改企劃書用 Notion 連接器改同一頁，並更新 proposal.md 的版本號
- **SPEC 正本在示意圖 HTML**：`spec.md` 用 `node tools/specsheet.mjs <html>` 匯出，**不要手改 spec.md**；改規格就改 HTML 再匯出
- `tasks.md` 照 `docs/flow/10` 的格式：`## N.` 是階段、第 5 階段 `###` 分美術／後端／前端、`M1`／`M2` 是里程碑。管理台靠它判斷進度，**每改一項就推上去**
- 沒有「同意」。企劃說「X 需求確認了」→ 勾 M1；「X 規格確認了」→ 匯出 spec.md、勾 M2；括號寫日期與依據（「2026-10-07，需求會議」或「對話中確認」）。**只有企劃說了才勾**
- 跨部門回饋：提案未歸檔 → 寫進同一張提案的對應階段，並把對應里程碑改回 `- [ ]`（提案退回該階段）；已歸檔 → 另開優化案
- 驗收通過 → 搬到 archive；優化案在原提案的 proposal.md 最後加一行「已由 <id> 優化（日期）」
```

- [ ] **Step 3: 其他文件**

- `workbench.config.json` 在 `"_說明"` 之後加 `"_flow說明": "平台專案（企劃文件流）加 \"flow\": \"planning\"，spec_dir 改 docs/提案；見 docs/flow/10 企劃文件流.md",`
- `docs/flow/00 總覽.md` 文件地圖表加一列：`| 10 | [10 企劃文件流](10%20企劃文件流.md) | 企劃、美術、前端、後端 | 平台專案：企劃書 → 示意圖＋SPEC → 需求確認 → 並行製作 → 驗收；程式由公司團隊做 |`
- `README.md`「從這裡開始讀」表加一列：`| 平台專案（程式由公司團隊做） | [10 企劃文件流](docs/flow/10%20企劃文件流.md) |`
- `web/console/projects.json` 的 `projects` 加：`{ "repo": "fishon100/playhorny-platform", "name": "PlayHorny 平台", "note": "企劃文件流（平台專案）" }`

- [ ] **Step 4: 測試與 commit**

Run: `node --test`
Expected: 全部 pass。

```bash
git add "docs/flow/10 企劃文件流.md" CLAUDE.md workbench.config.json "docs/flow/00 總覽.md" README.md web/console/projects.json
git commit -m "docs: 企劃文件流說明、CLAUDE.md 規則、管理台加 PlayHorny 平台

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: 推上 GitHub、開 PR

**Files:** 無新檔。

- [ ] **Step 1: 推分支**

```bash
git push -u origin planning-flow
```

- [ ] **Step 2: 開 PR**（**先問使用者**是否直接合併；CLAUDE.md 規定技術性改動走 PR）

```bash
gh pr create --base main --head planning-flow --title "企劃文件流（planning flow）模式" --body "$(cat <<'EOF'
管理台加 `flow: "planning"` 模式：7 格流程、里程碑 M1／M2、第 5 階段美術／後端／前端並行線；沒有同意／試玩／規則書。`flow` 沒設的遊戲專案畫面不變。

- 設計：docs/superpowers/specs/2026-10-07-planning-flow-design.md
- 說明：docs/flow/10 企劃文件流.md
- 測試：`node --test` 全過（新增 tests/planning.test.mjs）
- 試點專案：fishon100/playhorny-platform

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: 合併**（使用者說可以才做）

```bash
gh pr merge --squash --delete-branch
```
合併後 `test-and-deploy` 會把新版管理台部署到 `https://fishon100.github.io/game-dev-flow-template/console/`。

---

### Task 9: 建立 `fishon100/playhorny-platform` 並搬入第一張提案

**Files（新 repo 裡）:**
- Create: `docs/提案/game-page-redesign/proposal.md`、`tasks.md`、`示意圖/遊戲內頁_v21.html`、`遊戲內頁_v21.spec.md`
- Create: `docs/企劃/README.md`
- Modify: `workbench.config.json`、`CLAUDE.md`「這是什麼專案」一節、`README.md`
- Delete: `web/js/`、`web/tuning.json`、`web/test.html`、`web/index.html`、`docs/spectra/`、`.spectra.yaml`、`docs/notion-import/`、`docs/notion.json`、`docs/企劃/主架構規劃書.md`、`docs/企劃/知識庫/`、`docs/企劃/素材/`、`docs/企劃/開發日誌.md`、`docs/企劃/圖/`、`tools/tables/`、`tools/make-icons.mjs`、`tests/rules.test.mjs`、`tests/qa-assets.test.mjs`、`docs/superpowers/`

**Interfaces:**
- Consumes: Task 1–7 的程式（從 `planning-flow` 分支複製工作樹）。
- 來源：示意圖用本機最新版 `C:\Users\SandyWeng\claude-html\03_遊戲資料內頁\遊戲內頁_v21.html`（含商城入口；game-inner-page 裡的那份是舊的）與同資料夾的 `遊戲內頁_v21.spec.md`。

- [ ] **Step 1: 從範本複製工作樹到新資料夾（不含 .git）**

```bash
cd <scratch>/repos
mkdir playhorny-platform && cd game-dev-flow-template && git archive planning-flow | tar -x -C ../playhorny-platform && cd ../playhorny-platform
```

- [ ] **Step 2: 刪掉遊戲專用的東西**

```bash
rm -rf web/js web/tuning.json web/test.html web/index.html docs/spectra .spectra.yaml docs/notion-import docs/notion.json docs/superpowers tools/tables tools/make-icons.mjs tests/rules.test.mjs tests/qa-assets.test.mjs
rm -rf "docs/企劃/主架構規劃書.md" "docs/企劃/知識庫" "docs/企劃/素材" "docs/企劃/開發日誌.md" "docs/企劃/圖"
```

`web/` 只留 `console/`、`workbench/`。`tests/` 留 `workbench.test.mjs`、`specsheet.test.mjs`、`planning.test.mjs`。

- [ ] **Step 3: `workbench.config.json`**

```json
{
  "_說明": "工作台／管理台的設定。flow: planning ＝企劃文件流（docs/flow/10）；提案放 docs/提案。",
  "name": "PlayHorny 平台",
  "flow": "planning",
  "spec_dir": "docs/提案",
  "content_dirs": ["docs/企劃", "docs/提案"],
  "links": [
    { "label": "文件中心（Notion）", "url": "https://app.notion.com/p/1af11c058c2d80d5a502d3d5052041a8" },
    { "label": "專案工作流程 × SDD", "url": "https://app.notion.com/p/3f211c058c2d8167a64de51e51e6d89c" }
  ],
  "tools": [],
  "qa_always": []
}
```

- [ ] **Step 4: 提案 `docs/提案/game-page-redesign/proposal.md`**

```markdown
> 中文標題：遊戲內頁改版（四區塊決策動線）
> 類型：企劃
> 文件：介面向
> 企劃書：https://app.notion.com/p/38711c058c2d8030b36bc9d6bdf36fa3（v1.1，2026-10-07）
> 示意圖：docs/提案/game-page-redesign/示意圖/遊戲內頁_v21.html
> 規格書：docs/提案/game-page-redesign/遊戲內頁_v21.spec.md（由示意圖的註解模式匯出；在示意圖開「註解模式」點黃色 SPEC 也看得到）
> 設計稿：https://claude.ai/design/p/c5f1f929-a427-47b4-b2c2-4218c3db8a97?file=%E9%81%8A%E6%88%B2%E5%85%A7%E9%A0%81_v20.html&present=1

## 為什麼

玩家多半用手機看遊戲下載頁，現在的頁面資訊架構與下載動線不好用。這次全面重設計，核心目標是**提升用戶決策效率**：玩家依序經過「快速判斷 → 深入了解 → 確認門檻 → 建立信任」四個階段，頁面就照這四段由上到下排。（細節見企劃書「一、背景與目的」）

## 改什麼

- 頁面四個區塊：吸引（主視覺、識別、分級）→ 深入了解（截圖輪播、下載／購買、收藏分享、介紹）→ 規格確認 → 信任建立（瑟瑟商城入口、社群、情報）
- 下載／購買區 12 種主狀態＋2 個疊加層（更新／維護、PC 提醒）；站內預約／報名 4 種是後續優化
- RWD：手機版優先，1024px 以上電腦版（右欄下載區 sticky、往下滾動提示與兩個吸附點）
- 規格全部在示意圖 SPEC：18 個版位、83 條驗收條件（假如／當／則）、需求對照頁（企劃書 § ↔ SPEC）
- 程式由公司前端／後端團隊實作；這張提案追到驗收結束

## 需要企劃確認的事

目前沒有。企劃書 v1.1 與 SPEC v21 已於 2026-10-07 同步（需求對照頁全部「一致」或「已同步」）。
```

- [ ] **Step 5: `docs/提案/game-page-redesign/tasks.md`**

```markdown
## 1. 需求
- [x] 1.1 需求來源：平台優化項目清單（Notion）

## 2. 企劃書
- [x] 2.1 Notion 撰寫企劃書 v1（2026-06-22）
- [x] 2.2 依示意圖 SPEC 同步為 v1.1（2026-10-07）

## 3. 示意圖
- [x] 3.1 示意圖 v20（Claude Design）
- [x] 3.2 示意圖 v21：加需求對照、驗收條件、瑟瑟商城入口；匯出 spec.md（2026-10-07）

## 4. 需求確認 ◆
- [x] M1 需求確認：企劃書 v1.1＋示意圖 v21（2026-10-07，對話中確認）

## 5. 並行製作
### 美術
- [ ] 5.1 依示意圖做視覺稿：主視覺兩種尺寸、下載按鈕各狀態、分級標章、情報卡片、商城入口
- [ ] 5.2 視覺稿完成約九成，通知企劃
- [ ] M2 規格確認：補 SPEC 介面細節（主視覺與截圖尺寸、介紹收合高度、語系 Key 待補項），重新匯出 spec.md
### 後端
- [ ] 5.3 開工單（連結）：狀態判定 API（12 種狀態、疊加層）、商店上架狀態、情報撈取
- [ ] 5.4 後端完成
### 前端
- [ ] 5.5 開工單（連結）：以 spec.md 的驗收條件為驗收依據
- [ ] 5.6 結構與邏輯完成（M1 後可做）
- [ ] 5.7 介面細節完成（M2 之後）

## 6. 驗收
- [ ] 6.1 照 spec.md 的 83 條驗收條件逐條驗（手機版與電腦版）
- [ ] 6.2 回饋寫回本提案對應階段
```

- [ ] **Step 6: 示意圖與 spec.md**

```bash
mkdir -p "docs/提案/game-page-redesign/示意圖"
cp "/c/Users/SandyWeng/claude-html/03_遊戲資料內頁/遊戲內頁_v21.html" "docs/提案/game-page-redesign/示意圖/"
cp "/c/Users/SandyWeng/claude-html/03_遊戲資料內頁/遊戲內頁_v21.spec.md" "docs/提案/game-page-redesign/"
```

確認 `node tools/specsheet.mjs "docs/提案/game-page-redesign/示意圖/遊戲內頁_v21.html" /tmp/check.md` 能跑（打包檔解析），但 **repo 裡放的 spec.md 用示意圖「匯出 spec.md」按鈕的格式**（含驗收條件表），不覆蓋。

- [ ] **Step 7: `docs/企劃/README.md`**

```markdown
# PlayHorny 平台 — 企劃文件

正本都在線上，這裡只放連結與專案共用的東西。

| 內容 | 在哪裡 |
|---|---|
| 企劃書、企劃手冊、名詞表 | [文件中心（Notion）](https://app.notion.com/p/1af11c058c2d80d5a502d3d5052041a8) |
| 流程說明 | [專案工作流程 × SDD — 核心機制](https://app.notion.com/p/3f211c058c2d8167a64de51e51e6d89c)、本 repo `docs/flow/10 企劃文件流.md` |
| 提案（示意圖＋SPEC、進度） | [`docs/提案/`](../提案/)，管理台：https://fishon100.github.io/game-dev-flow-template/console/?repo=fishon100/playhorny-platform |
| 回饋、需求 | 管理台「寫回饋」「提需求」（GitHub Issue） |
| 回饋附圖 | [`回饋/`](回饋/) |
```

建 `docs/企劃/回饋/.gitkeep`。

- [ ] **Step 8: `CLAUDE.md`「這是什麼專案」與 `README.md`**

`CLAUDE.md` 的「## 這是什麼專案」改成：

```markdown
## 這是什麼專案
- PlayHorny 平台（前台／後台的功能企劃）。**企劃文件流**（`flow: planning`，見下方同名一節與 `docs/flow/10`）：AI 不寫程式，產出企劃書（Notion）、示意圖＋SPEC（`docs/提案/`）並記錄進度
- 示意圖線上看：`https://fishon100.github.io/playhorny-platform/docs/提案/<id>/示意圖/<檔名>.html`
- 讀者：企劃、美術、前端、後端 → 一律**白話繁體中文**
```

（其餘節保留；「正本在哪裡」表的「遊戲規則」「手感數值」「試算表」三列刪掉。）

`README.md` 整份換成：

```markdown
# PlayHorny 平台 — 專案管理

平台功能的企劃文件與進度，走 **企劃文件流**（`docs/flow/10 企劃文件流.md`）。

- 管理台：https://fishon100.github.io/game-dev-flow-template/console/?repo=fishon100/playhorny-platform
- 企劃書正本：[Notion 文件中心](https://app.notion.com/p/1af11c058c2d80d5a502d3d5052041a8)
- 提案：`docs/提案/<id>/`（proposal.md、tasks.md、示意圖、spec.md）

範本：[game-dev-flow-template](https://github.com/fishon100/game-dev-flow-template)
```

- [ ] **Step 9: 測試、建 repo、推上去**（建 repo 是對外動作：執行前再跟使用者確認一次）

```bash
node --test
git init -b main && git add -A
git commit -m "PlayHorny 平台：企劃文件流，首張提案 game-page-redesign

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
gh repo create fishon100/playhorny-platform --public --description "PlayHorny 平台企劃文件與進度（企劃文件流）" --source . --push
gh api -X POST repos/fishon100/playhorny-platform/pages -f build_type=workflow
gh api -X PUT repos/fishon100/playhorny-platform/actions/permissions/workflow -f default_workflow_permissions=write -F can_approve_pull_request_reviews=false
gh variable set PAGES_PATH --body "." --repo fishon100/playhorny-platform
gh workflow run workbench --repo fishon100/playhorny-platform
```

- [ ] **Step 10: 驗證**

```bash
gh run list --repo fishon100/playhorny-platform -L 4
curl -s https://raw.githubusercontent.com/fishon100/playhorny-platform/workbench-data/data.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s);console.log(d.flow.mode,d.changes.map(c=>[c.id,c.status,c.plan.current]))})"
```
Expected: `workbench` 與 `test-and-deploy` 都成功；印出 `planning [ [ 'game-page-redesign', '並行製作', 5 ] ]`。
瀏覽器開 `https://fishon100.github.io/playhorny-platform/docs/提案/game-page-redesign/示意圖/遊戲內頁_v21.html`：示意圖與 SPEC 抽屜正常。
範本 PR 合併後開 `https://fishon100.github.io/game-dev-flow-template/console/?repo=fishon100/playhorny-platform`：7 格流程圖、提案停在第 5 格、M1 有日期、沒有同意與試玩。（PR 還沒合併時用本機 `node tools/serve.mjs` 開 `http://localhost:8080/console/?repo=fishon100/playhorny-platform` 看。）

---

## Self-review

- **Spec coverage**：階段與進度判斷（Task 1、2）；里程碑取代同意（Task 1、6）；跨部門回饋與優化案的欄位（Task 2、6）；正本與存放（Task 7 文件、Task 9 結構）；sync 不開 Issue（Task 3）；Pages 直接開示意圖（Task 3 deploy.yml、Task 9）；管理台畫面與驗收條件（Task 4–6、Task 9 Step 10）；遊戲模式不變（每個 task 的 `node --test` 與 Task 4 Step 8）。設計文件「之後再談」的三項不在本計畫內。
- **Placeholder**：Task 4 Step 6 與 Task 5 Step 3 的 CSS 要執行時對照 `index.html` 既有變數名；Task 5 Step 1 的 `pos` 要對照原檔。其餘步驟都有完整內容。
- **名稱一致**：`parseStages`／`planStatus`／`PLAN_STAGES`／`readSpectra(root, specDir, { flow, changesDir })`／`data.flow.mode`／`data.changesDir`／`change.plan`／`isPlan`／`planStageOf`／`msChip`／`lanesText`／`sortKey`／`flowDiagramPlan`／`drawFlowLinksPlan`／`laneTasks` 在各 task 用法一致。

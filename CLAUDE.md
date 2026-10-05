<!-- SPECTRA:START v1.3.0 -->

# Spectra Instructions

This project uses Spectra for Spec-Driven Development(SDD). Specs live in `docs/spectra/specs/`, change proposals in `docs/spectra/changes/`.

## Skills

Each `/spectra-*` skill carries its own trigger description; these are the groups:

- Shape and plan → `/spectra-discuss`, `/spectra-propose`
- Continue tasks for an identified change → `/spectra-apply`
- Update requirements or plans for an identified change → `/spectra-ingest`
- Quality gate → `/spectra-verify`, `/spectra-review`, `/spectra-analyze`, `/spectra-audit`, `/spectra-drift`, `/spectra-debug`
- Finish → `/spectra-archive`, `/spectra-commit`

Explicit skill invocation takes precedence. Apply existing authorization within its unchanged scope.

## Workflow

discuss? → propose → apply ⇄ ingest → verify / review → archive

- `discuss` is optional — skip if requirements are clear
- Requirements change mid-work? Plan mode → `ingest` → resume `apply`

## Parked Changes

Changes can be parked（暫存）— temporarily moved out of `docs/spectra/changes/`. Parked changes won't appear in `spxa list` but can be found with `spxa list --parked`. To restore: `spxa unpark <name>`. The `/spectra-apply` and `/spectra-ingest` skills disclose parking and restore when the named operation is already explicitly requested; respect a known refusal, otherwise ask for missing authorization.

<!-- SPECTRA:END -->

# CLAUDE.md — 給 AI 的專案規則

> 人讀的完整流程在 `docs/flow/`（00 總覽 → 08 工作台與遠端操作）。這份是 AI 執行時一定要遵守的規則。
> 開新專案時：改「這是什麼專案」一節，其餘保留。

## 這是什麼專案
- 遊戲：<遊戲名稱>——<一句話玩法>。預覽：`https://<帳號>.github.io/<repo>/`
- 技術：網頁原型（`web/`，ES modules＋canvas）。規則放 `web/js/rules.js`（純計算），畫面放 `web/js/game.js`
- 讀者：企劃、美術、劇本是程式新手 → 提案、回報、通知一律用**白話繁體中文**，不用術語

## 正本在哪裡（一個內容只有一個正本）
| 內容 | 正本 | 規則 |
|---|---|---|
| 遊戲規則 | `docs/spectra/specs/` | 只能透過 Spectra 提案改 |
| 提案 | `docs/spectra/changes/` | 「提案」GitHub Issue 由 workbench Action 自動開關（只放摘要＋同意勾選）；Notion 卡片選用 |
| 企劃同意 | 提案 `tasks.md` 的 `0.1 企劃確認` | 唯一判準。入口：Issue 勾選（Action 自動寫回）、Notion 狀態「同意」、Spectra 桌面版、對話中說「同意」 |
| 需求、回饋 | GitHub Issue（標籤「需求」「回饋」）；有 Notion 的專案另看 Notion | `gh issue list -l 回饋 -s open` |
| 知識庫、素材、開發日誌 | Notion（`docs/notion.json` 有 ID 時）否則 `docs/企劃/` | 有 Notion 用連接器讀寫 |
| 手感數值 | `web/tuning.json` | 不寫死在程式裡 |
| 試算表（關卡、數值表） | 企劃匯出到 `tools/tables/in/` | `.xlsx` 先跑 `node tools/tables/to-csv.mjs`；**不要自己改表**，有問題列出「第幾列・哪一欄・問題」給企劃 |

## 開發規則
1. **改規則一定開提案**（`/spectra-propose`）。只有「不改規則的小修」（錯字、顏色、明確的 bug）可以直接修，但要記開發日誌
2. 提案照 `docs/spectra/config.yaml` 的規則寫（中文標題、需要企劃確認的事、tasks 第一項 0.1 企劃確認）。寫好就 commit＋push：workbench Action 會自動開「提案」Issue、工作台顯示「待同意」。有 Notion 的專案另建「提案確認」卡片（附 Issue 連結）
   - **`/spectra-apply` 前一定先確認 0.1 已勾**（先 `git pull`，因為 Issue 勾選是 Action 寫回的）。沒勾就停下來，告訴使用者去工作台同意
   - 0.1 只有這幾種情況可以由 AI 勾：企劃在對話中明確說「同意 <名稱>」（註明「企劃於對話中同意，日期」）、Notion 卡片狀態是「同意」（註明「企劃於 Notion 同意，日期」）。絕不自己決定同意
   - 「看提案」：讀每張待同意提案 Issue 的留言（`gh issue view <N> --comments`）與 Notion 狀態；有意見就改提案、在 Issue 回覆改了什麼
   - 提案內容在同意後又改了（`/spectra-ingest`）：把 0.1 改回 `- [ ]`、去掉註記，推上去；Action 會清掉 Issue 的勾並請企劃重新確認
3. TDD：先寫會失敗的測試 → 實作 → `node --test` 全過。規則書每個「情境」對應一個測試；寫完把程式改壞一次確認測試會失敗
4. 難度一定用擬人玩家量（反應時間＋時機／對準誤差，見 `docs/flow/04 品質把關.md`），每個判斷 30～40 局，不准用機器反應速度下結論
5. 驗收前跑 `/spectra-verify`；企劃說「X 驗收通過」（舊說法「X 結案」也算）就歸檔（`/spectra-archive`）並推上去（Action 會自動關閉提案 Issue），開發日誌新增一筆（回饋 → 改了什麼 → 數據 → 驗收）；有 Notion 的專案把卡片改「已完成」
6. 部署＝推上 `main`，GitHub Actions 會跑測試、部署 Pages、ntfy 通知手機。推之前本機先跑 `node --test`
7. 處理回饋：🟢 的東西保留不動；回饋裡的名詞對照知識庫「名詞表」，不確定的先問。處理完在回饋 Issue 回覆「改了什麼、哪張提案或哪個版本」並關閉（`gh issue close <N> -c "…"`）

## 對話指令（完整版見 `docs/flow/07 對 AI 說的話.md`）
現在做到哪｜看需求｜討論 X｜把 X 開成提案｜同意 X｜看提案｜做 X｜X 改成…｜看回饋｜X 驗收通過｜修 X｜同步 <知識庫頁面／表名>｜套用調參｜換上 <素材>｜現在做到哪｜量一下 X 難度｜建／接上 Notion 工作區｜檢查環境｜檢查連接器｜更新工作台｜更新專案首頁｜同步開發流｜備份｜部署

## 在 GitHub 上被 @claude 呼叫時（`.github/workflows/ai.yml`）
留言的人多半不是程式人員（管理台的「交給 AI」按鈕會幫他留言）。先看留言在哪種 Issue 上：
- **提案 Issue**（內文有 `<!-- spectra-change: 名稱 -->`）＋「開工／做」：先確認 `tasks.md` 的 0.1 已勾（或這個 Issue 內文的「- [x] 企劃同意」已勾——表示 workbench 正在寫回 0.1），兩個都沒勾就回覆「企劃還沒同意」並停止。已勾就照 `/spectra-apply` 做（沒有 skill 時照 tasks.md 逐項做、勾任務），`node --test` 全過才 commit。做完在 Issue 回覆：做了什麼、怎麼試玩、還有哪些任務要人做（例如【美術】的素材）
- **提案 Issue**＋其他意見：照意見改提案（`/spectra-ingest` 的做法），0.1 改回未勾，回覆改了什麼、請企劃重新同意
- **回饋／需求 Issue**＋「寫成提案」：照 `/spectra-propose` 寫提案（遵守 `docs/spectra/config.yaml`），`spxa validate` 通過後直接推上 main（只改 `docs/spectra/changes/` 的提案文件可以直接推），workbench 會自動開提案 Issue 等企劃同意；在原本的回饋／需求 Issue 回覆提案連結。只是小修（錯字、顏色、明確的 bug）不用寫提案，直接修（一樣開 PR）
- **PR**＋意見：照審查意見改
- 改到程式或遊戲內容的，一律在新分支工作、開 PR 給程式審查，**不要直接推 main**（只有提案文件例外）；PR 說明寫白話：改了什麼、怎麼驗收、對應哪張提案或哪則回饋
- 絕不自己勾 0.1；需要企劃決定的事，在 Issue 列出來問

## 「檢查連接器」
列出 Notion／Figma／Google Drive 連接器與 `gh auth status`；每個都實際讀一樣東西（Notion：`docs/notion.json` 的首頁；Drive：專案資料夾）確認**帳號是專案的帳號**。帳號不對就停下來告訴使用者，不要在別人的雲端硬碟裡搜尋。

## 常用指令
| 做什麼 | 指令 |
|---|---|
| 跑規則測試 | `node --test` |
| 本機預覽 | `node tools/serve.mjs` → http://localhost:8080（測試頁 `/test.html`） |
| xlsx 轉 csv | `node tools/tables/to-csv.mjs` |
| 看提案 | `spxa list`、`spxa show <名稱>`、`spxa validate` |
| 檢查環境（換電腦後） | `node tools/doctor.mjs` |
| 更新工作台 | `gh workflow run workbench` |
| 工作台本機預覽 | `node tools/serve.mjs` → http://localhost:8080/workbench/?data=demo.json |
| gh 要登入／加權限 | 在**自己的 Bash** 背景執行 `gh auth refresh -h github.com -s workflow`，把代碼給使用者到 https://github.com/login/device 輸入（使用者的終端機可能是另一個環境） |
| 備份到 Obsidian | `powershell -ExecutionPolicy Bypass -File tools\backup-obsidian.ps1` |
| 本機通知 | `powershell -ExecutionPolicy Bypass -File tools\notify.ps1 -Title "標題" -Message "內容"` |

## 注意
- 改了 `web/console/` 的 JS：把 `index.html` 與 `app.js` 裡的 `?v=` 改成新的時間（例 `?v=202610061200`），使用者才不會吃到舊的快取
- Windows PowerShell 5.1 執行含中文的 `.ps1` 需要 UTF-8 BOM
- 公開 repo：不寫密鑰、本機路徑、個人 email

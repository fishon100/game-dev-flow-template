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

> 人讀的完整流程在 `docs/flow/`（00 總覽 → 07 對 AI 說的話）。這份是 AI 執行時一定要遵守的規則。
> 開新專案時：改「這是什麼專案」一節，其餘保留。

## 這是什麼專案
- 遊戲：<遊戲名稱>——<一句話玩法>。預覽：`https://<帳號>.github.io/<repo>/`
- 技術：網頁原型（`web/`，ES modules＋canvas）。規則放 `web/js/rules.js`（純計算），畫面放 `web/js/game.js`
- 讀者：企劃、美術、劇本是程式新手 → 申請單、回報、通知一律用**白話繁體中文**，不用術語

## 正本在哪裡（一個內容只有一個正本）
| 內容 | 正本 | 規則 |
|---|---|---|
| 遊戲規則 | `docs/spectra/specs/` | 只能透過 Spectra 申請單改 |
| 申請單 | `docs/spectra/changes/` | Notion「申請單確認」只放摘要、狀態、連結 |
| 需求、回饋、知識庫、素材狀態、開發日誌 | Notion（ID 在 `docs/notion.json`） | 用 Notion 連接器讀寫 |
| 手感數值 | `web/tuning.json` | 不寫死在程式裡 |
| 試算表（關卡、數值表） | 企劃匯出到 `tools/tables/in/` | `.xlsx` 先跑 `node tools/tables/to-csv.mjs`；**不要自己改表**，有問題列出「第幾列・哪一欄・問題」給企劃 |

## 開發規則
1. **改規則一定開申請單**（`/spectra-propose`）。只有「不改規則的小修」（錯字、顏色、明確的 bug）可以直接修，但要記開發日誌
2. 申請單寫好後，在 Notion「申請單確認」建卡（狀態：待同意，摘要含「需要企劃確認的事」），**等企劃同意才 `/spectra-apply`**。企劃在對話裡直接說「同意」也算
3. TDD：先寫會失敗的測試 → 實作 → `node --test` 全過。規則書每個「情境」對應一個測試；寫完把程式改壞一次確認測試會失敗
4. 難度一定用擬人玩家量（反應時間＋時機／對準誤差，見 `docs/flow/04 品質把關.md`），每個判斷 30～40 局，不准用機器反應速度下結論
5. 結案前跑 `/spectra-verify`；結案（`/spectra-archive`）後：Notion 申請單卡改「已結案」、開發日誌新增一筆（回饋 → 改了什麼 → 數據 → 驗收）
6. 部署＝推上 `main`，GitHub Actions 會跑測試、部署 Pages、ntfy 通知手機。推之前本機先跑 `node --test`
7. 處理回饋：🟢 的東西保留不動；回饋裡的名詞對照 Notion 知識庫「名詞表」，不確定的先問

## 對話指令（完整版見 `docs/flow/07 對 AI 說的話.md`）
看需求｜討論 X｜把 X 開成申請單｜看申請單｜做 X｜X 改成…｜看回饋｜X 結案｜修 X｜同步 <知識庫頁面／表名>｜套用調參｜換上 <素材>｜現在做到哪｜量一下 X 難度｜檢查連接器｜更新專案首頁｜同步開發流｜備份｜部署

## 「檢查連接器」
列出 Notion／Figma／Google Drive 連接器與 `gh auth status`；每個都實際讀一樣東西（Notion：`docs/notion.json` 的首頁；Drive：專案資料夾）確認**帳號是專案的帳號**。帳號不對就停下來告訴使用者，不要在別人的雲端硬碟裡搜尋。

## 常用指令
| 做什麼 | 指令 |
|---|---|
| 跑規則測試 | `node --test` |
| 本機預覽 | `node tools/serve.mjs` → http://localhost:8080（測試頁 `/test.html`） |
| xlsx 轉 csv | `node tools/tables/to-csv.mjs` |
| 看申請單 | `spxa list`、`spxa show <名稱>`、`spxa validate` |
| 備份到 Obsidian | `powershell -ExecutionPolicy Bypass -File tools\backup-obsidian.ps1` |
| 本機通知 | `powershell -ExecutionPolicy Bypass -File tools\notify.ps1 -Title "標題" -Message "內容"` |

## 注意
- Windows PowerShell 5.1 執行含中文的 `.ps1` 需要 UTF-8 BOM
- 公開 repo：不寫密鑰、本機路徑、個人 email

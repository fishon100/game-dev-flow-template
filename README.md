# 遊戲開發流範本（game-dev-flow-template）

讓 **3～5 人的小團隊靠 AI 做完一個遊戲專案**的開發流程＋專案範本。

- **骨幹**：[Spectra](https://github.com/kaochenlong/spectra-app) 規格驅動開發（SDD）＋自動測試（TDD）
- **分工**：人寫需求、確認、試玩（Notion）；AI 寫提案、程式、測試、部署（GitHub）
- **預覽**：每次推上 GitHub 自動跑測試、部署到 GitHub Pages、手機收到通知
- **💻 管理台**：像 Spectra 桌面版的專業介面——多專案目錄、流程圖（泳道）、提案進度鏈、規則書、劇本／角色／世界觀等內容庫、素材庫、專案工具（外掛）；首頁依角色列出**我的待辦**；**不登入也能同意、寫回饋、編輯、上傳**（打開填好的 GitHub 網頁）；需要 AI 的地方按「對 AI 說」複製指令，貼到 Claude → [打開](https://fishon100.github.io/game-dev-flow-template/console/?repo=fishon100/pinball-sling)
- **🧭 工作台**：給不寫程式的人的網頁（手機可加到主畫面）：等我處理、提案進度、同意、寫回饋、提需求、規則書、上線紀錄 → [打開範例](https://fishon100.github.io/game-dev-flow-template/workbench/?repo=fishon100/pinball-sling)
- **在哪裡都能同意**：工作台／GitHub Issue（手機）、Notion、Spectra 桌面版、或跟 AI 說——最後都記在提案任務 0.1

```
 Notion（人）                         GitHub（AI）
 需求池 ──────────────────────────▶ /spectra-propose 寫提案
 提案確認：企劃按「同意」 ◀─────── 摘要＋需要確認的事
                                     /spectra-apply：先寫測試 → 實作 → 測試全過
 手機收到通知 ◀───────────────────── GitHub Actions：測試 → 部署 → ntfy
 回饋 🔴🟡🟢 ──────────────────────▶ 看回饋 → 下一張提案
 開發日誌 ◀───────────────────────── /spectra-archive 驗收
```

## 從這裡開始讀

| 你是 | 先讀 |
|---|---|
| 第一次看 | [00 總覽](docs/flow/00%20總覽.md) → [01 一輪開發](docs/flow/01%20一輪開發.md) |
| 企劃／美術／劇本／數值 | [02 角色分工](docs/flow/02%20角色分工.md) → [07 對 AI 說的話](docs/flow/07%20對%20AI%20說的話.md) |
| 要開新專案 | [06 新專案啟動](docs/flow/06%20新專案啟動.md) |
| 程式 | [03 Notion 與 GitHub](docs/flow/03%20Notion%20與%20GitHub.md)、[04 品質把關](docs/flow/04%20品質把關.md)、[CLAUDE.md](CLAUDE.md) |
| 接手別人的專案、換電腦 | [05 工具與帳號](docs/flow/05%20工具與帳號.md) 的「換一台電腦」「換 Claude 帳號／換人接手」 |
| 用手機參與、不在電腦前 | [08 工作台與遠端操作](docs/flow/08%20工作台與遠端操作.md) |

## 開新專案（摘要）

1. 按 GitHub 上的 **Use this template** 建新 repo，clone 到本機
2. `npm install -g @kaochenlong/spxa`，在專案資料夾跑 `spxa init --tools claude`
3. Settings → Pages → Source 選 **GitHub Actions**；Settings → Actions → Workflow permissions 選 **Read and write**；（選用）Secrets 加 `NTFY_TOPIC`
4. Claude 連好 Notion，說「**建 Notion 工作區**」
5. 寫主架構規劃書，然後說：`/goal 依主架構規劃書做出第一個可玩版本，測試全過、部署並通知`

完整清單：[06 新專案啟動](docs/flow/06%20新專案啟動.md)

## 裡面有什麼

```
docs/flow/              開發流說明（人讀）
docs/spectra/           規則書（specs）與提案（changes）——遊戲規則的正本
docs/notion.json        Notion 頁面與資料庫 ID
docs/notion-import/     Notion 手動匯入用的 CSV
docs/企劃/              沒有 Notion 時的主架構規劃書、名詞表、開發日誌
web/                    遊戲（範例：接球）。rules.js＝規則、game.js＝畫面、tuning.json＝手感數值
tests/                  規則測試（node --test）
tools/serve.mjs         本機預覽
tools/tables/to-csv.mjs 企劃的 xlsx → csv（保留千分位、長數字不變形）
tools/notify.ps1        Windows 通知＋ntfy 手機推播
tools/backup-obsidian.ps1  備份文件到本機 Obsidian
tools/doctor.mjs        檢查環境（換電腦後跑一次）
tools/workbench/        工作台同步（同意寫回、開關提案 Issue、產生工作台資料）
web/workbench/          工作台網頁（手機）
web/console/            管理台網頁（電腦）；projects.json＝專案目錄
.github/ISSUE_TEMPLATE/ 寫回饋、提需求的表單
.github/workflows/      deploy：測試 → 部署 Pages → 手機通知；workbench：同意寫回、提案 Issue、工作台資料
CLAUDE.md               給 AI 的規則
```

## 範例遊戲

`web/` 是一個最小的「接球」遊戲，用來示範規則怎麼對應測試：

| 規則書 | 測試 | 程式 |
|---|---|---|
| [catch-ball/spec.md](docs/spectra/specs/catch-ball/spec.md) 的每個「情境」 | [rules.test.mjs](tests/rules.test.mjs) 的每個 `test` | [rules.js](web/js/rules.js) |

開新專案時，第一張提案就把它換成你的遊戲。

## 實戰案例

**噴漆闖關 SPRAY RUN**（彈珠×打磚塊）：用這套流程走過 7 輪試玩回饋、8 張提案、17 份規則書。
[程式與規則](https://github.com/fishon100/pinball-sling)・[遊戲](https://fishon100.github.io/pinball-sling/street/)

## 授權

範本內容 MIT。Spectra 本身的授權見 [spectra-app](https://github.com/kaochenlong/spectra-app)；它的 skills 由 `spxa init` 在各自的專案產生，不包含在這個 repo。

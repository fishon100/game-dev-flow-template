# 企劃文件流（planning flow）設計

> 日期：2026-10-07　｜　狀態：已與企劃確認
> 目的：讓 game-dev-flow-template 的管理台也能跑「平台專案」的企劃文件流（企劃書 → 示意圖＋SPEC → 美術／後端／前端並行 → 驗收），遊戲專案的既有流程不動。

## 一、為什麼要加這個模式

範本原本的假設：AI 在 repo 裡寫程式、TDD、自動部署，規格正本是 Spectra 規則書。
平台專案的實際情況：**程式由公司前端／後端團隊在別處寫**，交付物是文件（企劃書、示意圖、SPEC），正本在 Notion 與示意圖 HTML。
硬套原流程的結果（game-inner-page）：企劃書複本過期、英文規則書與 SPEC 重複、同意關卡與實際流程對不上。

決定（2026-10-07）：
- 一個產品一個專案（repo），每個功能或優化是一張「提案」。平台與遊戲各自走流程，各自一個 repo。
- 拿掉「同意」按鈕與自動回寫，改成兩個里程碑 M1 需求確認、M2 規格確認，由企劃對 AI 說「確認了」記錄。
- 文件全部放線上：企劃書 Notion、示意圖與提案 GitHub（Pages 直接開）、素材 Drive、工單 Jira。本機只是工作副本。
- 先打基底：公開 repo＋GitHub Pages，進來的人都能看；公開／私人之後再決定。
- 遊戲流程也要調整，但另案討論。

## 二、流程階段

### 介面向

```
1 需求 → 2 企劃書 → 3 示意圖 → 4 ◆需求確認(M1) → 5 並行製作 → 6 驗收 → 7 完成
                                                  ├ 美術：視覺稿約九成 → ◆規格確認(M2)
                                                  ├ 後端：M1 後開工（企劃書＋SPEC 行為層）
                                                  └ 前端：M1 後做結構與邏輯；介面細節在 M2 之後
```

### 系統向

```
1 需求 → 2 企劃書 → 4 ◆需求確認(M1) → 5 製作（後端，需要時加前端）→ 6 驗收 → 7 完成
```
跳過示意圖，沒有 M2。

### 階段定義

| # | 階段 | 誰 | 產出／紀錄 |
|---|---|---|---|
| 1 | 需求 | 任何人 | 需求池／回饋 Issue |
| 2 | 企劃書 | 企劃＋AI | Notion 企劃書；repo 只放連結＋版本號 |
| 3 | 示意圖 | AI | 示意圖 HTML（SPEC 行為層同時寫）；介面向才有 |
| 4 | 需求確認 ◆ | 企劃 | M1：需求會議確認企劃書＋示意圖 |
| 5 | 並行製作 | 美術／後端／前端 | 三條線各自待辦；美術線含 M2 |
| 6 | 驗收 | 企劃 | 照 SPEC 驗收條件逐條驗 |
| 7 | 完成 | — | 歸檔 |

### 進度判斷

- `tasks.md` 的 `## N. 標題` 章節編號＝階段編號；第 5 階段底下用 `### 美術`、`### 後端`、`### 前端` 分線，沒有的線不寫。
- 提案目前階段＝第一個還有未勾項目的章節；全部勾完＝待歸檔；在 `archive/` 下＝完成。
- 里程碑：項目文字以 `M1 ` 或 `M2 ` 開頭，勾選時在括號註明日期與依據，例如 `- [x] M1 需求確認：企劃書 v1.1＋示意圖 v21（2026-10-07，需求會議）`。
- 管理台第 5 格顯示三條線各自的完成數；M1／M2 以 ◆ 標示並顯示日期。

### 跨部門回饋

- 提案未歸檔：回饋寫進**同一張提案**對應階段的待辦，並取消對應里程碑的勾選；提案自動退回該階段。
- 提案已歸檔：另開優化案提案。

### 優化案

- `proposal.md` 開頭加 `> 類型：優化` 與 `> 基於：<原提案 id>`；管理台標示「優化」並連到原提案。
- 企劃書：Notion **同一頁改版**（v1.1 → v2），更新項目寫清楚改了哪些章節。
- 示意圖＋SPEC：**複製新檔**（v21 → v22），舊檔留著，因為前端可能還在照舊版做。
- 需求對照頁加一欄「本次變更」：不變／修改／新增；前端只看修改／新增。
- 歸檔時在原提案加一行「已由 <新提案> 優化」。

## 三、正本與存放

| 內容 | 正本 | repo 裡放什麼 |
|---|---|---|
| 企劃書、企劃 wiki、名詞表 | Notion | 連結＋版本號（寫在 proposal.md 開頭） |
| 示意圖＋SPEC | 示意圖 HTML（GitHub） | 檔案；GitHub Pages 直接開 |
| spec.md | 由 HTML 匯出 | 匯出副本，**不手動修改**，版號與 HTML 一致 |
| Claude Design 分享連結 | — | proposal.md 列一行「設計稿」，備用（要登入、無版本） |
| 規格書 Google Sheet（舊案分開版） | Google Sheet | 連結 |
| 美術素材 | Google Drive／Figma | 連結 |
| 工單 | Jira | 連結寫在 tasks.md 開工單項目 |

拿掉：企劃書複本、Spectra 英文規則書（`docs/spectra/specs`）、遊戲程式（`web/js`、`web/tuning.json`）、`.spectra.yaml` 與 Spectra 指令。

### 專案結構（playhorny-platform）

```
docs/
  提案/
    game-page-redesign/
      proposal.md
      tasks.md
      示意圖/遊戲內頁_v21.html
      遊戲內頁_v21.spec.md
    archive/
  企劃/
    README.md          專案簡介、Notion 文件中心／企劃 wiki／Drive／Jira 連結
    回饋/              回饋附圖
web/console/, web/workbench/   管理台、工作台（照舊）
tools/                 保留 specsheet、workbench 同步；拿掉 to-csv、tuning
tests/                 只留文件格式檢查
workbench.config.json  flow: "planning"、name、links
```

`flow` 未設定＝原本的遊戲流程，範本的遊戲範例完全不動。

## 四、要改的檔案（範本，分支 planning-flow）

| 檔案 | 改什麼 |
|---|---|
| `workbench.config.json` | 加 `flow` 欄位（`"planning"` 或不設） |
| `web/console/app.js` | 階段定義依 `flow` 切換（7 格）；進度改用 tasks 章節判斷；第 5 格三條並行線；M1／M2 以 ◆＋日期顯示；企劃模式隱藏同意按鈕、試玩、規則書、技術提案泳道；提案文件列顯示企劃書連結、示意圖網址、Claude Design、工單 |
| `web/console/index.html` | 企劃模式的導覽項目與用語 |
| `tools/workbench/lib.mjs` | `statusOf` 在企劃模式回傳階段名稱；解析 `類型：`、`基於：`、M1／M2、第 5 階段的三條線 |
| `tools/workbench/sync.mjs`、`.github/workflows/workbench.yml` | 企劃模式不開提案 Issue、不自動回寫同意；仍產生工作台資料 |
| `docs/flow/10 企劃文件流.md` | 新增：平台專案怎麼走（本文件的人讀版） |
| `CLAUDE.md` | 加企劃模式規則：企劃書只放連結、spec.md 不手改、「確認了」＝勾里程碑並註明、回饋寫回同一張提案 |
| `tests/` | 加 tasks 章節解析與里程碑的測試 |
| `web/console/projects.json` | 加 playhorny-platform |

## 五、測試專案與首張提案

- 新建公開 repo `fishon100/playhorny-platform`，Settings → Pages 選 GitHub Actions。
- 從 game-inner-page 搬 `game-page-redesign`，改成第三節的結構；tasks.md 依第二節格式重寫：M1 已勾（2026-10-07，對話中確認），第 5 階段三條線待辦，M2 未勾。
- proposal.md：企劃書連結（Notion v1.1）、示意圖 Pages 網址、Claude Design 連結、為什麼、改什麼、待確認（目前無）。
- game-inner-page 留著不動，新專案跑順後封存。

### 驗收（這次改動做完要能看到）

- 管理台選「PlayHorny 平台」：7 格流程圖；遊戲內頁提案停在第 5 格；三條線各自進度；M1 顯示日期；沒有同意按鈕、試玩、規則書。
- 管理台選「噴漆闖關」：畫面與改動前一樣。
- `node --test` 全過。
- 示意圖在 GitHub Pages 網址能開，SPEC 抽屜正常。

## 六、之後再談

- 遊戲流程的調整。
- 公開／私人 repo 與 Pages 方案。
- claude-html 的示意圖逐步搬進各專案 repo。

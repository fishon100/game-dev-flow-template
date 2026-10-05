// 工作台同步（GitHub Actions 執行；本機要跑需設 GITHUB_TOKEN、GITHUB_REPOSITORY）
//  1. Issue 裡勾了「企劃同意」→ 把 tasks.md 的 0.1 打勾並註明來源（之後由 workflow commit）
//  2. 每張待同意的申請單都有一個「申請單」Issue（沒有就開，企劃在手機就能看、能勾）
//  3. 已同意的 Issue 貼「已同意」標籤；已結案的申請單把 Issue 關掉
//  4. 產生工作台資料 workbench-out/data.json（由 workflow 推到 workbench-data 分支）
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { readSpectra, approveTasks, approvalIssueBody, ISSUE_MARKER_RE, ISSUE_APPROVE_RE } from "./lib.mjs";

const root = process.cwd();
const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
if (!repo || !token) { console.error("需要 GITHUB_REPOSITORY 與 GITHUB_TOKEN"); process.exit(1); }
const cfg = existsSync("workbench.config.json") ? JSON.parse(readFileSync("workbench.config.json", "utf8")) : {};
const specDir = cfg.spec_dir || "docs/spectra";
const repoUrl = `https://github.com/${repo}`;
const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });

async function gh(path, init = {}) {
  const r = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(init.body ? { "Content-Type": "application/json" } : {}) },
  });
  if (!r.ok && r.status !== 422) throw new Error(`${init.method || "GET"} ${path} → ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}
const post = (p, body, method = "POST") => gh(p, { method, body: JSON.stringify(body) });

const LABELS = { 申請單: "5319e7", 已同意: "0e8a16", 需求: "1d76db", 回饋: "d93f0b" };
for (const [name, color] of Object.entries(LABELS)) await post("/labels", { name, color }); // 已存在會回 422，忽略

// ---- 1. 同意：任何一個申請單 Issue 勾了「企劃同意」，就把 tasks.md 0.1 打勾 ----
const allIssues = (await gh("/issues?state=all&per_page=100")).filter(i => !i.pull_request);
const changed = [];
let { changes } = readSpectra(root, specDir);
const hasLabel = (i, name) => i.labels?.some(l => (l.name || l) === name);
const setBox = async (issue, checked) => {
  issue.body = issue.body.replace(ISSUE_APPROVE_RE, `- [${checked ? "x" : " "}] 企劃同意`);
  await post(`/issues/${issue.number}`, { body: issue.body }, "PATCH");
};
for (const issue of allIssues) {
  const id = (issue.body || "").match(ISSUE_MARKER_RE)?.[1];
  const c = id && changes.find(x => x.id === id && !x.archived);
  if (!c || !c.tasks.hasApprovalItem || issue.state !== "open") continue;
  const boxChecked = (issue.body || "").match(ISSUE_APPROVE_RE)?.[1]?.toLowerCase() === "x";
  if (c.tasks.approved) {
    // 在 Spectra 桌面版或對話中同意：把 Issue 的勾也補上，兩邊一致
    if (!boxChecked) {
      await setBox(issue, true);
      await post(`/issues/${issue.number}/comments`, { body: `✅ 已同意（${c.tasks.approvalNote || "在 Spectra 桌面版或對話中"}）。` });
    }
    continue;
  }
  if (hasLabel(issue, "已同意")) {
    // 申請單改過、0.1 被取消：請企劃重新確認
    await setBox(issue, false);
    await gh(`/issues/${issue.number}/labels/${encodeURIComponent("已同意")}`, { method: "DELETE" }).catch(() => {});
    issue.labels = issue.labels.filter(l => (l.name || l) !== "已同意");
    await post(`/issues/${issue.number}`, { body: approvalIssueBody(c, repoUrl, specDir) }, "PATCH");
    await post(`/issues/${issue.number}/comments`, { body: `🔄 申請單 \`${c.id}\` 有修改，已把「企劃同意」取消。請看上面更新後的內容，沒問題再勾一次。` });
    console.log(`重新確認：${c.id}（Issue #${issue.number}）`);
    continue;
  }
  if (!boxChecked) continue;
  const f = join(root, specDir, "changes", c.folder, "tasks.md");
  writeFileSync(f, approveTasks(readFileSync(f, "utf8"), `企劃於 GitHub Issue #${issue.number} 同意，${today}`));
  changed.push(f);
  await post(`/issues/${issue.number}/labels`, { labels: ["已同意"] });
  await post(`/issues/${issue.number}/comments`, { body: `✅ 已記錄企劃同意：申請單 \`${c.id}\` 的任務 0.1 已打勾。對 AI 說「做 ${c.id}」就會開始實作。` });
  console.log(`同意：${c.id}（Issue #${issue.number}）`);
}
if (changed.length) ({ changes } = readSpectra(root, specDir));

// ---- 2、3. 申請單 Issue：沒有就開；已同意貼標籤；已結案就關 ----
const issueOf = id => allIssues.find(i => (i.body || "").match(ISSUE_MARKER_RE)?.[1] === id);
for (const c of changes) {
  let issue = issueOf(c.id);
  if (!c.archived && !issue) {
    issue = await post("/issues", { title: `申請單：${c.title}（${c.id}）`, body: approvalIssueBody(c, repoUrl, specDir), labels: ["申請單"] });
    allIssues.push(issue);
    console.log(`開 Issue #${issue.number}：${c.id}`);
  }
  if (!issue) continue;
  if (c.tasks.approved && !issue.labels?.some(l => (l.name || l) === "已同意")) await post(`/issues/${issue.number}/labels`, { labels: ["已同意"] });
  if (c.archived && issue.state === "open") {
    await post(`/issues/${issue.number}/comments`, { body: `🎉 申請單 \`${c.id}\` 已結案（${c.date}），規則已併回規則書。` });
    await post(`/issues/${issue.number}`, { state: "closed", state_reason: "completed" }, "PATCH");
    issue.state = "closed";
    console.log(`結案關閉 Issue #${issue.number}：${c.id}`);
  }
  c.issue = { number: issue.number, url: issue.html_url, state: issue.state, comments: issue.comments };
}

// ---- 4. 工作台資料 ----
const pick = label => allIssues.filter(i => i.labels?.some(l => (l.name || l) === label))
  .map(i => ({ number: i.number, title: i.title, url: i.html_url, state: i.state, created: i.created_at, user: i.user?.login, labels: i.labels.map(l => l.name || l), comments: i.comments }));
const commits = execSync('git log -15 --date=iso-strict --pretty=format:%H%x1f%ad%x1f%an%x1f%s', { encoding: "utf8" })
  .split("\n").filter(Boolean).map(l => { const [sha, date, author, subject] = l.split("\x1f"); return { sha: sha.slice(0, 7), date, author, subject, url: `${repoUrl}/commit/${sha}` }; });
const runs = (await gh("/actions/runs?per_page=20").catch(() => ({ workflow_runs: [] }))).workflow_runs
  .filter(r => r.name !== "workbench").slice(0, 5)
  .map(r => ({ name: r.name, status: r.status, conclusion: r.conclusion, date: r.created_at, url: r.html_url, title: r.display_title }));
const { specs } = readSpectra(root, specDir);
const data = {
  generatedAt: new Date().toISOString(),
  repo, repoUrl, specDir,
  name: cfg.name || repo.split("/")[1],
  links: cfg.links || [],
  changes, specs,
  requests: pick("需求"), feedback: pick("回饋"),
  commits, runs,
};
mkdirSync("workbench-out", { recursive: true });
writeFileSync("workbench-out/data.json", JSON.stringify(data, null, 1));
writeFileSync("workbench-out/changed.txt", changed.join("\n"));
console.log(`工作台資料：申請單 ${changes.length}、規則書 ${specs.length}、需求 ${data.requests.length}、回饋 ${data.feedback.length}`);

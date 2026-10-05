// 工作台共用：讀 Spectra 的申請單與規則書，整理成工作台要的資料。純函式＋讀檔，Node 與測試都用它。
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

export const APPROVAL_RE = /^- \[( |x|X)\] 0\.1 .*$/m;
export const ISSUE_MARKER = name => `<!-- spectra-change: ${name} -->`;
export const ISSUE_MARKER_RE = /<!-- spectra-change: ([a-z0-9][a-z0-9-]*) -->/;
export const ISSUE_APPROVE_RE = /^- \[( |x|X)\] 企劃同意/m;

const read = f => (existsSync(f) ? readFileSync(f, "utf8").replace(/\r/g, "") : "");

/** 依「## 標題」切段落；回傳 { 標題: 內容 } */
export function sections(md) {
  const out = {};
  for (const block of ("\n" + md).split(/\n(?=## )/).slice(1)) {
    const [head, ...rest] = block.split("\n");
    out[head.replace(/^## /, "").trim()] = rest.join("\n").trim();
  }
  return out;
}

/** 任務清單：總數、完成數、企劃是否同意（0.1）、同意的註記 */
export function parseTasks(md) {
  const items = [...md.matchAll(/^- \[( |x|X)\] (.*)$/gm)].map(m => ({ done: m[1] !== " ", text: m[2].trim() }));
  const approvalItem = items.find(t => /^0\.1 /.test(t.text));
  const work = items.filter(t => t !== approvalItem);
  const note = approvalItem?.done ? (approvalItem.text.match(/（([^）]*同意[^）]*)）\s*$/) || [])[1] || "" : "";
  const groups = [];
  for (const line of md.split("\n")) {
    const h = line.match(/^##\s+(.+)/);
    if (h) groups.push({ title: h[1].trim(), items: [] });
    const m = line.match(/^- \[( |x|X)\] (.*)$/);
    if (m) { if (!groups.length) groups.push({ title: "任務", items: [] }); groups.at(-1).items.push({ done: m[1] !== " ", text: m[2].trim() }); }
  }
  return {
    groups: groups.filter(g => g.items.length),
    total: work.length,
    done: work.filter(t => t.done).length,
    hasApprovalItem: !!approvalItem,
    approved: !!approvalItem?.done,
    approvalNote: note,
    next: work.find(t => !t.done)?.text || "",
  };
}

/** 把 tasks.md 的 0.1 打勾並加註來源；已經勾過就原樣回傳 */
export function approveTasks(md, note) {
  return md.replace(APPROVAL_RE, line => {
    if (/^- \[[xX]\]/.test(line)) return line;
    return line.replace(/^- \[ \]/, "- [x]").replace(/\s*$/, `（${note}）`);
  });
}

/** proposal.md → 中文標題、為什麼、改什麼、需要企劃確認的事 */
export function parseProposal(md, fallbackName) {
  const s = sections(md);
  const pick = re => Object.entries(s).find(([k]) => re.test(k))?.[1] || "";
  const why = pick(/^(Why|為什麼|Problem)/i);
  const title = (md.match(/中文標題[：:]\s*(.+)/) || [])[1]?.trim() ||
    (why.split("\n").find(l => l.trim()) || fallbackName).replace(/[。，,.（(：:].*$/, "").replace(/[`*]/g, "").slice(0, 40);
  return {
    title,
    why,
    what: pick(/^(What Changes|改什麼|Proposed Solution)/i),
    confirm: pick(/企劃.*確認|需要確認|Open Questions/i),
    breaking: /\*\*BREAKING\*\*/.test(md),
  };
}

/** 申請單狀態（給人看的中文） */
export function statusOf({ archived, tasks }) {
  if (archived) return "已結案";
  if (tasks.hasApprovalItem && !tasks.approved) return "待同意";
  if (tasks.total > 0 && tasks.done === tasks.total) return "待結案";
  if (tasks.done > 0) return "實作中";
  return tasks.hasApprovalItem ? "已同意" : "待同意";
}

/** 讀整個 spec 目錄 → { changes, specs } */
export function readSpectra(root, specDir = "docs/spectra") {
  const base = join(root, specDir);
  const dirs = d => (existsSync(d) ? readdirSync(d).filter(n => !n.startsWith(".") && statSync(join(d, n)).isDirectory()) : []);
  const change = (dir, name, archived) => {
    const tasks = parseTasks(read(join(dir, "tasks.md")));
    const proposal = parseProposal(read(join(dir, "proposal.md")), name);
    const capabilities = dirs(join(dir, "specs"));
    const date = archived ? (name.match(/^\d{4}-\d{2}-\d{2}/) || [""])[0] : "";
    const id = archived ? name.replace(/^\d{4}-\d{2}-\d{2}-/, "") : name;
    const artifacts = { proposal: existsSync(join(dir, "proposal.md")), specs: capabilities.length > 0, design: existsSync(join(dir, "design.md")), tasks: existsSync(join(dir, "tasks.md")) };
    return { id, folder: name, archived, date, ...proposal, capabilities, artifacts, tasks, status: statusOf({ archived, tasks }) };
  };
  const changesDir = join(base, "changes");
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

/** 申請單 Issue 的內文（給企劃在手機上看、勾選） */
export function approvalIssueBody(c, repoUrl, specDir = "docs/spectra") {
  const link = `${repoUrl}/tree/main/${specDir}/changes/${c.folder}`;
  const cut = (s, n) => (s.length > n ? s.slice(0, n) + "…" : s);
  return [
    ISSUE_MARKER(c.id),
    `### 為什麼`,
    cut(c.why || "（proposal.md 沒有寫）", 1200),
    ``,
    `### 改什麼`,
    cut(c.what || "（proposal.md 沒有寫）", 1500),
    ``,
    c.confirm ? `### ❓ 需要企劃確認的事\n${cut(c.confirm, 1200)}\n` : "",
    c.breaking ? `> ⚠️ 這張申請單有 **BREAKING**：會拿掉或改變玩家已經習慣的東西。\n` : "",
    `---`,
    `**看完沒問題就勾下面這格**（手機 GitHub App 也可以勾）。勾完幾十秒後，申請單的任務 0.1 會自動打勾，AI 才會開始做。`,
    ``,
    `- [ ] 企劃同意`,
    ``,
    `有意見？直接在下面留言，AI 會照意見修改申請單。`,
    `完整內容：${link}`,
  ].filter(l => l !== "").join("\n").replace(/\n(### )/g, "\n\n$1");
}

/** 內容庫索引：列出 dirs 底下的文件與圖檔（給管理台的內容庫、素材庫用；內容由管理台按需讀取） */
export function indexContent(root, dirs = ["docs/企劃"]) {
  const keep = /\.(md|csv|png|jpe?g|gif|webp|svg|mp3|ogg|wav|json)$/i;
  const out = [];
  const walk = (abs, rel) => {
    if (!existsSync(abs)) return;
    for (const n of readdirSync(abs)) {
      if (n.startsWith(".")) continue;
      const a = join(abs, n), r = rel + "/" + n, st = statSync(a);
      if (st.isDirectory()) walk(a, r);
      else if (keep.test(n)) {
        const ext = n.split(".").pop().toLowerCase();
        const title = ext === "md" ? ((read(a).match(/^# (.+)$/m) || [])[1] || n.replace(/\.md$/, "")).trim() : n.replace(/\.[^.]+$/, "");
        out.push({ path: r.replace(/^\//, ""), name: n, ext, size: st.size, title });
      }
    }
  };
  for (const d of dirs) walk(join(root, d), d);
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

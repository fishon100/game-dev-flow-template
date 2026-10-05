// 開發管理台：多專案、流程樹、申請單、規則書、內容庫（劇本／角色／世界觀…）、素材庫、回饋、上線紀錄
// 資料：各專案 workbench-data 分支的 data.json（GitHub Actions 產生）；文件內容按需從 raw.githubusercontent.com 讀取
// 登入後（github.js）：同意、留言、寫回饋／提需求、編輯內容、上傳素材都在管理台完成
import { auth, verify, tokenUrl, classicTokenUrl, approveChange, comment, createIssue, readFile, saveFile, uploadFile } from "./github.js";
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const qs = new URLSearchParams(location.search);
const ago = iso => { const m = Math.round((Date.now() - new Date(iso)) / 60000); if (m < 1) return "剛剛"; if (m < 60) return `${m} 分鐘前`; const h = Math.round(m / 60); return h < 24 ? `${h} 小時前` : `${Math.round(h / 24)} 天前`; };
const short = (s, n) => { s = String(s || "").replace(/[#*`>_]/g, "").trim(); return s.length > n ? s.slice(0, n) + "…" : s; };
const encPath = p => p.split("/").map(encodeURIComponent).join("/");

const S = { projects: [], repo: "", data: null, view: "overview", arg: "", treeFilter: "", treeActiveOnly: false, assetFilter: "全部", assetCat: "全部" };
const raw = p => `https://raw.githubusercontent.com/${S.repo}/${S.data?.branch || "main"}/${encPath(p)}`;
const blob = p => `${S.data.repoUrl}/blob/${S.data.branch || "main"}/${encPath(p)}`;
const tree = p => `${S.data.repoUrl}/tree/${S.data.branch || "main"}/${encPath(p)}`;
const newIssue = t => `${S.data.repoUrl}/issues/new?template=${t}.yml`;

// ---------- 內容分類 ----------
const IMG = /^(png|jpe?g|gif|webp|svg)$/;
const CATS = [
  { key: "script", label: "劇本", ic: "📖", test: f => /劇情|劇本|腳本|大綱|story|script/i.test(f.path) && !/世界觀/.test(f.name) },
  { key: "chars", label: "角色", ic: "🧑‍🎨", test: f => /角色|character/i.test(f.path) },
  { key: "world", label: "世界觀", ic: "🌏", test: f => /世界|街區|world/i.test(f.path) },
  { key: "terms", label: "名詞", ic: "🏷", test: f => /名詞|命名|term|glossary/i.test(f.name) },
  { key: "numbers", label: "數值", ic: "📊", test: f => /數值|tuning|balance/i.test(f.name) },
  { key: "plans", label: "規劃書", ic: "📘", test: f => /規劃書|主架構|規劃|plan/i.test(f.path) },
  { key: "records", label: "紀錄", ic: "🗂", test: f => /日誌|回饋|紀錄|log/i.test(f.name) },
];
const isAsset = f => IMG.test(f.ext) || /^(mp3|ogg|wav)$/.test(f.ext) || /媒體庫|美術|音樂|音效|素材|assets/i.test(f.path);
function catOf(f) {
  if (f.ext !== "md") return null;
  if (/媒體庫|素材/.test(f.path) && !/美術風格/.test(f.name)) return "assets";
  return (CATS.find(c => c.test(f)) || { key: "other" }).key;
}

// ---------- 側欄 ----------
function sideHtml() {
  const d = S.data, act = d.changes.filter(c => !c.archived), waiting = act.filter(c => c.status === "待同意").length;
  const content = d.content || [];
  const count = k => content.filter(f => catOf(f) === k).length;
  const assets = content.filter(isAsset).length;
  const fbOpen = d.feedback.filter(i => i.state === "open").length + d.requests.filter(i => i.state === "open").length;
  const item = (v, ic, label, n, hot) => `<button class="nav" data-go="${v}" ${S.view === v.split("/")[0] && (!v.includes("/") || S.arg === v.split("/")[1]) ? 'aria-current="page"' : ""}><span class="ic">${ic}</span>${label}${n ? `<span class="n ${hot ? "hot" : ""}">${n}</span>` : ""}</button>`;
  return `<h6>專案</h6>
    ${item("overview", "🏠", "總覽", waiting, true)}
    ${item("tree", "🌳", "流程樹")}
    ${item("changes", "📋", "申請單", act.length)}
    ${item("specs", "📜", "規則書", d.specs.length)}
    <h6>內容庫</h6>
    ${CATS.filter(c => count(c.key)).map(c => item("content/" + c.key, c.ic, c.label, count(c.key))).join("")}
    ${item("assets", "🎨", "素材庫", assets)}
    ${item("files", "🗃", "全部文件", content.length)}
    <h6>協作</h6>
    ${item("issues", "💬", "回饋與需求", fbOpen, fbOpen > 0)}
    ${item("activity", "🚀", "上線紀錄")}
    <h6>系統</h6>
    ${item("projects", "📁", "專案目錄", S.projects.length)}
    ${item("help", "❓", "說明")}`;
}

// ---------- 共用元件 ----------
// 寫回饋／提需求：登入了就在管理台填，沒登入就開 GitHub 表單
const issueBtns = primary => canTriage()
  ? `<button class="btn ${primary ? "primary" : ""}" data-newissue="回饋">🎮 寫回饋</button><button class="btn" data-newissue="需求">💡 提需求</button>`
  : `<a class="btn ${primary ? "primary" : ""}" href="${newIssue("feedback")}" target="_blank" rel="noopener">🎮 寫回饋</a><a class="btn" href="${newIssue("request")}" target="_blank" rel="noopener">💡 提需求</a>`;
const chip = s => `<span class="chip s-${esc(s)}">${esc(s)}</span>`;
const pct = c => (c.tasks.total ? Math.round((c.tasks.done / c.tasks.total) * 100) : c.archived ? 100 : 0);
const barHtml = c => `<div class="bar" title="${c.tasks.done}/${c.tasks.total}"><i style="width:${pct(c)}%"></i></div>`;
const ORDER = { 待同意: 0, 待結案: 1, 實作中: 2, 已同意: 3, 已結案: 9 };

function chainHtml(c) {
  const a = c.artifacts || {}, t = c.tasks;
  const approved = c.archived || t.approved;
  const steps = [
    ["提案", a.proposal], ["規則", a.specs], ["設計", a.design], ["任務", a.tasks],
    ["同意", approved], ["實作", t.total > 0 && t.done === t.total], ["結案", c.archived],
  ];
  const now = steps.findIndex(([, ok]) => !ok);
  return `<div class="chain">${steps.map(([l, ok], i) => `${i ? `<div class="link ${ok ? "done" : ""}"></div>` : ""}<div class="step ${ok ? "done" : i === now ? "now" : ""}" title="${ok ? "完成" : i === now ? "目前在這一步" : "還沒到"}"><div class="dotc">${ok ? "✓" : i + 1}</div><span>${l}</span></div>`).join("")}</div>`;
}

function changeDetail(c) {
  const folder = `${S.data.specDir}/changes/${c.archived ? "archive/" : ""}${c.folder}`;
  const groups = (c.tasks.groups || []).map(g => `<li class="${g.items.every(i => i.done) ? "closed" : ""}"><div class="node"><button class="tw">▾</button><span class="lbl"><b>${esc(g.title)}</b></span><span class="meta muted">${g.items.filter(i => i.done).length}/${g.items.length}</span></div>
      <ul>${g.items.map(i => `<li><div class="node"><span class="tw leaf"></span><span class="${i.done ? "done-x" : "todo-x"}">${i.done ? "☑" : "☐"}</span><span class="lbl" title="${esc(i.text)}">${esc(i.text)}</span></div></li>`).join("")}</ul></li>`).join("");
  return `<button class="ibtn close" data-close>✕</button>
    <div class="row">${chip(c.status)}${c.breaking ? '<span class="chip c-bad">BREAKING</span>' : ""}<span class="muted">${esc(c.id)}${c.date ? "・" + esc(c.date) : ""}</span></div>
    <h2 style="margin:8px 0 0;font-size:18px">${esc(c.title)}</h2>
    ${chainHtml(c)}
    <div class="row" style="margin-bottom:12px">
      ${c.status === "待同意" ? (canTriage() ? approveBtn(c) : c.issue ? `<a class="btn ok" href="${esc(c.issue.url)}" target="_blank" rel="noopener">👍 看內容並同意</a>` : `<button class="btn ok" data-approve="${esc(c.id)}">👍 登入後同意</button>`) : ""}
      ${c.issue && !c.archived && (canTriage() || !auth.user) ? `<button class="btn" data-comment="${esc(c.id)}">💬 留言／提問</button>` : ""}
      <a class="btn" href="${tree(folder)}" target="_blank" rel="noopener">📄 申請單檔案</a>
      ${c.issue ? `<a class="btn" href="${esc(c.issue.url)}" target="_blank" rel="noopener">💬 Issue #${c.issue.number}${c.issue.comments ? `（${c.issue.comments}）` : ""}</a>` : ""}
    </div>
    ${c.tasks.approvalNote ? `<p class="muted">✅ ${esc(c.tasks.approvalNote)}</p>` : ""}
    <h3>為什麼</h3><div class="pre">${esc(c.why || "（沒有寫）")}</div>
    <h3 style="margin-top:14px">改什麼</h3><div class="pre">${esc(c.what || "（沒有寫）")}</div>
    ${c.confirm ? `<h3 style="margin-top:14px">❓ 需要企劃確認的事</h3><div class="ask">${esc(c.confirm)}</div>` : ""}
    ${c.capabilities?.length ? `<h3 style="margin-top:14px">影響的規則書</h3><div class="row">${c.capabilities.map(n => `<button class="chip" data-go="specs/${esc(n)}">📜 ${esc(n)}</button>`).join("")}</div>` : ""}
    <h3 style="margin-top:14px">任務 ${c.tasks.done}/${c.tasks.total}</h3>
    ${groups ? `<ul class="tree">${groups}</ul>` : `<p class="muted">沒有任務清單</p>`}`;
}

// ---------- 各頁 ----------
const V = {};
V.overview = () => {
  const d = S.data, act = d.changes.filter(c => !c.archived), arc = d.changes.filter(c => c.archived);
  const by = s => act.filter(c => c.status === s);
  const rqOpen = d.requests.filter(i => i.state === "open"), fbOpen = d.feedback.filter(i => i.state === "open");
  const stages = [["💡", "需求", rqOpen.length, "issues"], ["⏳", "待同意", by("待同意").length, "tree"], ["🔧", "已同意／實作中", by("已同意").length + by("實作中").length, "tree"], ["🎮", "待結案", by("待結案").length, "tree"], ["📦", "已結案", arc.length, "tree"]];
  const todo = [
    ...by("待同意").map(c => `<li><span class="dot"></span><div class="g"><b>${esc(c.title)}</b> 等企劃同意<div class="muted">${esc(c.id)}</div></div>${canTriage() ? approveBtn(c, "同意") : c.issue ? `<a class="btn ok" href="${esc(c.issue.url)}" target="_blank" rel="noopener">去同意</a>` : ""}<button class="btn" data-change="${esc(c.id)}">明細</button></li>`),
    ...by("待結案").map(c => `<li><span class="dot"></span><div class="g"><b>${esc(c.title)}</b> 做完了：試玩後說「${esc(c.id)} 結案」</div><button class="btn" data-change="${esc(c.id)}">明細</button></li>`),
    ...(fbOpen.length ? [`<li><span class="dot bad"></span><div class="g">${fbOpen.length} 則回饋還沒處理：對 AI 說「看回饋」</div><button class="btn" data-go="issues">查看</button></li>`] : []),
    ...(d.runs[0]?.conclusion === "failure" ? [`<li><span class="dot bad"></span><div class="g">最近一次「${esc(d.runs[0].name)}」失敗</div><a class="btn" href="${esc(d.runs[0].url)}" target="_blank" rel="noopener">看原因</a></li>`] : []),
  ];
  const content = d.content || [];
  return `<div class="vh"><h1>${esc(d.name)}</h1><span class="sub">${esc(d.repo)}</span><div class="spacer"></div>${d.links.map(l => `<a class="btn ${/試玩/.test(l.label) ? "primary" : ""}" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join("")}${issueBtns()}</div>
    <div class="pipe">${stages.map(([ic, l, n, go]) => `<div class="stage" data-go="${go}"><span>${ic} ${l}</span><b>${n}</b></div>`).join("")}</div>
    <div class="grid2">
      <div class="card"><h3>需要處理</h3>${todo.length ? `<ul class="list">${todo.join("")}</ul>` : `<div class="empty">目前沒有等待處理的事 🎉</div>`}</div>
      <div class="card"><h3>專案數字</h3><div class="kpis">
        <div class="kpi"><b>${act.length}</b><span>進行中申請單</span></div><div class="kpi"><b>${arc.length}</b><span>已結案</span></div>
        <div class="kpi"><b>${d.specs.length}</b><span>規則書（${d.specs.reduce((n, s) => n + s.requirements, 0)} 條）</span></div>
        <div class="kpi"><b>${content.filter(f => f.ext === "md").length}</b><span>企劃文件</span></div>
        <div class="kpi"><b>${content.filter(f => IMG.test(f.ext)).length}</b><span>圖片素材</span></div>
        <div class="kpi"><b>${fbOpen.length + rqOpen.length}</b><span>未處理回饋／需求</span></div></div></div>
      <div class="card"><h3>進行中的申請單</h3>${act.length ? `<ul class="list">${act.sort((a, b) => ORDER[a.status] - ORDER[b.status]).map(c => `<li data-change="${esc(c.id)}" style="cursor:pointer">${chip(c.status)}<div class="g"><b>${esc(c.title)}</b><div class="muted">${c.tasks.done}/${c.tasks.total}・${esc(c.tasks.next ? short(c.tasks.next, 40) : "")}</div></div>${barHtml(c)}</li>`).join("")}</ul>` : `<div class="empty">沒有進行中的申請單</div>`}</div>
      <div class="card"><h3>最近上線</h3><ul class="list">${d.runs.slice(0, 5).map(runLi).join("") || `<li class="empty">還沒有紀錄</li>`}</ul></div>
    </div>`;
};
const runLi = r => `<li><span class="dot ${r.conclusion === "success" ? "ok" : r.conclusion === "failure" ? "bad" : ""}"></span><div class="g"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title || r.name)}</a><div class="muted">${esc(r.name)}・${r.conclusion === "success" ? "成功" : r.conclusion === "failure" ? "失敗" : "進行中"}・${ago(r.date)}</div></div></li>`;

V.tree = () => {
  const d = S.data, f = S.treeFilter.trim().toLowerCase();
  const match = c => !f || (c.title + c.id).toLowerCase().includes(f);
  const act = d.changes.filter(c => !c.archived && match(c)), arc = d.changes.filter(c => c.archived && match(c));
  const ch = c => {
    const a = c.artifacts || {}, t = c.tasks;
    const groups = (t.groups || []).map(g => `<li class="closed"><div class="node"><button class="tw">▾</button><span class="lbl">${esc(g.title)}</span><span class="meta muted">${g.items.filter(i => i.done).length}/${g.items.length}</span></div><ul>${g.items.map(i => `<li><div class="node"><span class="tw leaf"></span><span class="${i.done ? "done-x" : "todo-x"}">${i.done ? "☑" : "☐"}</span><span class="lbl" title="${esc(i.text)}">${esc(i.text)}</span></div></li>`).join("")}</ul></li>`).join("");
    const art = (ok, ic, label, extra = "") => `<li><div class="node"><span class="tw leaf"></span><span class="${ok ? "done-x" : "todo-x"}">${ok ? "✓" : "—"}</span><span class="lbl">${ic} ${label}</span>${extra}</div></li>`;
    return `<li class="${c.archived ? "closed" : ""}"><div class="node clickable" data-change="${esc(c.id)}"><button class="tw">▾</button>${chip(c.status)}<span class="lbl"><b>${esc(c.title)}</b> <span class="muted">${esc(c.id)}</span></span><span class="meta">${barHtml(c)}<span class="muted">${t.done}/${t.total}</span></span></div>
      <ul>${art(a.proposal, "📝", "提案 proposal")}${art(a.specs, "📜", "規則差異", c.capabilities?.length ? `<span class="meta muted">${esc(c.capabilities.join("、"))}</span>` : "")}${art(a.design, "🛠", "設計 design")}
      ${art(c.archived || t.approved || !t.hasApprovalItem && c.archived, "👍", "企劃同意", t.approvalNote ? `<span class="meta muted">${esc(short(t.approvalNote, 30))}</span>` : "")}
      <li class="${c.archived ? "closed" : ""}"><div class="node"><button class="tw">▾</button><span class="${t.total && t.done === t.total ? "done-x" : "todo-x"}">☑</span><span class="lbl">任務 tasks</span><span class="meta muted">${t.done}/${t.total}</span></div><ul>${groups}</ul></li></ul></li>`;
  };
  const issues = (list, ic, label) => `<li class="closed"><div class="node"><button class="tw">▾</button><span class="lbl">${ic} <b>${label}</b></span><span class="meta muted">${list.length}</span></div><ul>${list.map(i => `<li><div class="node"><span class="tw leaf"></span><a class="lbl" href="${esc(i.url)}" target="_blank" rel="noopener">#${i.number} ${esc(i.title)}</a></div></li>`).join("") || `<li><div class="node muted"><span class="tw leaf"></span>沒有</div></li>`}</ul></li>`;
  const stage = (ic, label, list, closed) => `<li class="${closed ? "closed" : ""}"><div class="node"><button class="tw">▾</button><span class="lbl">${ic} <b>${label}</b></span><span class="meta muted">${list.length}</span></div><ul>${list.map(ch).join("") || `<li><div class="node muted"><span class="tw leaf"></span>沒有</div></li>`}</ul></li>`;
  const by = s => act.filter(c => c.status === s);
  return `<div class="vh"><h1>🌳 流程樹</h1><span class="sub">專案 → 階段 → 申請單 → 文件與任務</span><div class="spacer"></div>
      <input class="search" id="treeSearch" placeholder="搜尋申請單…" value="${esc(S.treeFilter)}">
      <button class="btn" data-tree="open">全部展開</button><button class="btn" data-tree="close">全部收合</button></div>
    <div class="card"><ul class="tree" id="flowTree">
      <li><div class="node"><button class="tw">▾</button><span class="lbl">🎮 <b>${esc(d.name)}</b></span><span class="meta muted">${d.changes.length} 張申請單・${d.specs.length} 份規則書</span></div><ul>
        ${issues(d.requests.filter(i => i.state === "open"), "💡", "需求（還沒處理）")}
        ${issues(d.feedback.filter(i => i.state === "open"), "🎮", "回饋（還沒處理）")}
        ${stage("⏳", "待同意", by("待同意"), false)}
        ${stage("👍", "已同意", by("已同意"), false)}
        ${stage("🔧", "實作中", by("實作中"), false)}
        ${stage("🎯", "待結案", by("待結案"), false)}
        ${stage("📦", "已結案", arc, !f)}
        <li class="closed"><div class="node"><button class="tw">▾</button><span class="lbl">📜 <b>規則書</b></span><span class="meta muted">${d.specs.length}</span></div><ul>${d.specs.map(s => `<li><div class="node clickable" data-go="specs/${esc(s.name)}"><span class="tw leaf"></span><span class="lbl">${esc(s.name)} <span class="muted">${esc(short(s.purpose, 40))}</span></span><span class="meta muted">${s.requirements} 條</span></div></li>`).join("")}</ul></li>
      </ul></li></ul></div>`;
};

V.changes = () => {
  const d = S.data, list = [...d.changes].sort((a, b) => (ORDER[a.status] - ORDER[b.status]) || b.folder.localeCompare(a.folder));
  return `<div class="vh"><h1>📋 申請單</h1><span class="sub">點一列看明細與進度鏈</span></div>
    <div class="tablewrap"><table class="t"><thead><tr><th>狀態</th><th>申請單</th><th>進度</th><th>同意</th><th>日期</th></tr></thead><tbody>
    ${list.map(c => `<tr class="click ${S.sel === c.id ? "sel" : ""}" data-change="${esc(c.id)}"><td>${chip(c.status)}</td><td><b>${esc(c.title)}</b><div class="muted">${esc(c.id)}</div></td><td style="min-width:120px">${barHtml(c)}<div class="muted">${c.tasks.done}/${c.tasks.total}</div></td><td class="muted">${c.archived || c.tasks.approved ? "✓" : "—"}</td><td class="muted">${esc(c.date || "進行中")}</td></tr>`).join("") || `<tr><td colspan="5" class="empty">還沒有申請單</td></tr>`}
    </tbody></table></div>`;
};

V.specs = () => {
  const d = S.data, open = S.arg;
  return `<div class="vh"><h1>📜 規則書</h1><span class="sub">遊戲「現在」的規則：功能 → 規則 → 情境（每個情境對應一個自動測試）</span></div>
    <div class="card"><ul class="tree">${d.specs.map(s => `<li class="${open === s.name ? "" : "closed"}" id="spec-${esc(s.name)}"><div class="node"><button class="tw">▾</button><span class="lbl"><b>${esc(s.name)}</b> <span class="muted">${esc(short(s.purpose, 70))}</span></span><span class="meta"><span class="muted">${s.requirements} 條・${s.scenarios} 情境</span><a class="chip" href="${blob(`${d.specDir}/specs/${s.name}/spec.md`)}" target="_blank" rel="noopener">全文</a></span></div>
      <ul>${(s.reqs || []).map(r => `<li class="closed"><div class="node"><button class="tw">▾</button><span class="lbl">${esc(r.zh || r.name)}</span><span class="meta muted">${r.scenarios.length} 情境</span></div><ul>${r.scenarios.map(x => `<li><div class="node"><span class="tw leaf"></span><span class="lbl muted">🧪 ${esc(x)}</span></div></li>`).join("")}</ul></li>`).join("")}</ul></li>`).join("") || `<li class="empty">還沒有規則書</li>`}</ul></div>`;
};

function docList(files, cur) {
  return `<div class="flist">${files.map(f => `<button data-doc="${esc(f.path)}" aria-current="${cur === f.path}">${f.ext === "csv" ? "📊" : "📄"} <span>${esc(f.title)}<small>${esc(f.path.replace(/^docs\/企劃\//, ""))}</small></span></button>`).join("") || `<div class="empty">沒有文件</div>`}</div>`;
}
V.content = () => {
  const cat = CATS.find(c => c.key === S.arg) || { label: "其他", ic: "📄" };
  const files = (S.data.content || []).filter(f => catOf(f) === S.arg);
  const cur = S.doc && files.some(f => f.path === S.doc) ? S.doc : files[0]?.path;
  setTimeout(() => cur && openDoc(cur, "#reader"), 0);
  return `<div class="vh"><h1>${cat.ic} ${cat.label}</h1><span class="sub">${files.length} 份${canWrite() ? "" : "・登入後可以直接編輯"}</span><div class="spacer"></div>${canWrite() ? `<button class="btn" data-newdoc="${esc(S.arg)}">＋ 新文件</button>` : ""}</div>
    <div class="split">${docList(files, cur)}<div class="doc" id="reader"><div class="muted">選一份文件</div></div></div>`;
};
V.files = () => {
  const files = (S.data.content || []).filter(f => f.ext === "md" || f.ext === "csv");
  const cur = S.doc && files.some(f => f.path === S.doc) ? S.doc : files[0]?.path;
  setTimeout(() => cur && openDoc(cur, "#reader"), 0);
  return `<div class="vh"><h1>🗃 全部文件</h1><span class="sub">${(S.data.contentDirs || []).join("、")}</span></div><div class="split">${docList(files, cur)}<div class="doc" id="reader"></div></div>`;
};

V.assets = () => {
  const content = S.data.content || [];
  const imgs = content.filter(f => IMG.test(f.ext));
  const audio = content.filter(f => /^(mp3|ogg|wav)$/.test(f.ext));
  const sheets = content.filter(f => f.ext === "csv" && /素材|asset/i.test(f.name));
  const docs = content.filter(f => f.ext === "md" && catOf(f) === "assets");
  setTimeout(() => sheets[0] && loadAssetSheet(sheets[0].path), 0);
  return `<div class="vh"><h1>🎨 素材庫</h1><span class="sub">圖片 ${imgs.length}・聲音 ${audio.length}・清單 ${docs.length}</span><div class="spacer"></div>${canWrite() ? `<button class="btn primary" data-upload>＋ 上傳素材</button>` : ""}</div>
    ${sheets.length ? `<div class="card" style="margin-bottom:14px"><h3>素材進度</h3><div id="assetSheet" class="muted">讀取中…</div></div>` : ""}
    <div class="card" style="margin-bottom:14px"><h3>圖片</h3>${imgs.length ? `<div class="gallery">${imgs.map(f => `<div class="tile" data-img="${esc(f.path)}"><div class="im"><img loading="lazy" src="${raw(f.path)}" alt="${esc(f.title)}"></div><p>${esc(f.name)}</p></div>`).join("")}</div>` : `<div class="empty">還沒有圖片（正式素材放進內容資料夾後會出現在這裡）</div>`}</div>
    ${audio.length ? `<div class="card" style="margin-bottom:14px"><h3>聲音</h3><ul class="list">${audio.map(f => `<li><div class="g">${esc(f.name)}</div><audio controls preload="none" src="${raw(f.path)}"></audio></li>`).join("")}</ul></div>` : ""}
    <div class="card"><h3>素材清單與風格指南</h3><div class="row">${docs.map(f => `<button class="btn" data-doc-detail="${esc(f.path)}">📄 ${esc(f.title)}</button>`).join("") || `<span class="muted">沒有</span>`}</div></div>`;
};
async function loadAssetSheet(path) {
  const el = $("#assetSheet"); if (!el) return;
  try {
    const rows = parseCsv(await (await fetch(raw(path))).text());
    const head = rows[0] || [], body = rows.slice(1).filter(r => r.some(Boolean));
    const iS = head.indexOf("狀態"), iC = head.indexOf("類別");
    const states = ["全部", ...new Set(body.map(r => r[iS]).filter(Boolean))], cats = ["全部", ...new Set(body.map(r => r[iC]).filter(Boolean))];
    const show = body.filter(r => (S.assetFilter === "全部" || r[iS] === S.assetFilter) && (S.assetCat === "全部" || r[iC] === S.assetCat));
    const cnt = s => body.filter(r => r[iS] === s).length;
    const cols = head.map((h, i) => [h, i]).filter(([h]) => !/提示詞|Figma/.test(h));
    el.className = "";
    el.innerHTML = `${iS >= 0 ? `<div class="filters">${states.map(s => `<button class="fbtn" data-af="${esc(s)}" aria-pressed="${S.assetFilter === s}">${esc(s)}${s !== "全部" ? ` ${cnt(s)}` : ` ${body.length}`}</button>`).join("")}</div>` : ""}
      ${iC >= 0 ? `<div class="filters">${cats.map(s => `<button class="fbtn" data-ac="${esc(s)}" aria-pressed="${S.assetCat === s}">${esc(s)}</button>`).join("")}</div>` : ""}
      <div class="tablewrap"><table class="t"><thead><tr>${cols.map(([h]) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${show.map(r => `<tr>${cols.map(([, i]) => `<td>${i === iS ? `<span class="chip ${/完成|放進/.test(r[i]) ? "c-ok" : /待/.test(r[i]) ? "c-warn" : ""}">${esc(r[i])}</span>` : esc(r[i] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <p class="muted">來源：<a href="${blob(path)}" target="_blank" rel="noopener">${esc(path)}</a></p>`;
  } catch (e) { el.textContent = "讀不到素材清單：" + e.message; }
}

V.issues = () => {
  const d = S.data, li = i => `<li><span class="dot ${i.state === "open" ? "" : "ok"}"></span><div class="g"><a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.title)}</a><div class="muted">#${i.number}・${esc(i.user || "")}・${ago(i.created)}${i.comments ? `・💬 ${i.comments}` : ""}</div></div></li>`;
  const open = l => l.filter(i => i.state === "open"), closed = [...d.feedback, ...d.requests].filter(i => i.state !== "open");
  return `<div class="vh"><h1>💬 回饋與需求</h1><div class="spacer"></div>${issueBtns(true)}</div>
    <div class="grid2"><div class="card"><h3>回饋（還沒處理）</h3><ul class="list">${open(d.feedback).map(li).join("") || `<li class="empty">沒有</li>`}</ul></div>
    <div class="card"><h3>需求（還沒處理）</h3><ul class="list">${open(d.requests).map(li).join("") || `<li class="empty">沒有</li>`}</ul></div>
    <div class="card"><h3>已處理</h3><ul class="list">${closed.map(li).join("") || `<li class="empty">還沒有</li>`}</ul></div></div>`;
};
V.activity = () => `<div class="vh"><h1>🚀 上線紀錄</h1></div><div class="grid2"><div class="card"><h3>自動測試與部署</h3><ul class="list">${S.data.runs.map(runLi).join("") || `<li class="empty">還沒有紀錄</li>`}</ul></div>
  <div class="card"><h3>最近的改動</h3><ul class="list">${S.data.commits.map(c => `<li><div class="g"><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.subject)}</a><div class="muted">${esc(c.author)}・${ago(c.date)}・${esc(c.sha)}</div></div></li>`).join("")}</ul></div></div>`;

V.projects = () => `<div class="vh"><h1>📁 專案目錄</h1><span class="sub">點卡片切換專案</span></div>
  <div class="projects" id="plist">${S.projects.map(p => `<div class="card pcard ${p.repo === S.repo ? "cur" : ""}" data-proj="${esc(p.repo)}"><div class="row"><b>📁 ${esc(p.name || p.repo)}</b>${p.local ? '<span class="chip">只在這台</span>' : ""}</div><div class="muted">${esc(p.repo)}</div><p class="muted" style="margin:6px 0">${esc(p.note || "")}</p><div class="muted" data-psum="${esc(p.repo)}">讀取中…</div></div>`).join("")}</div>
  <div class="card" style="margin-top:14px"><h3>加入專案</h3><div class="row"><input class="search" id="addRepo" placeholder="帳號/專案（例：fishon100/pinball-sling）"><button class="btn primary" id="addBtn">加入</button></div>
  <p class="muted">專案要先有 workbench Action（用 game-dev-flow-template 建的專案都有）。這裡加的只存在你這台瀏覽器；要讓全隊看到，請把專案加進範本的 <code>web/console/projects.json</code>。</p></div>`;

V.help = () => `<div class="vh"><h1>❓ 說明</h1></div><div class="card md">
  <h2>這是什麼</h2><p>專案的管理台：所有專案、每張申請單的流程進度、規則書、劇本與角色等企劃內容、素材都在這裡看。手機上快速同意請用 📱 工作台。</p>
  <h2>常用</h2><ul><li><b>流程樹</b>：專案 → 階段（待同意／已同意／實作中／待結案／已結案）→ 申請單 → 提案、規則、設計、同意、任務。點申請單看進度鏈。</li>
  <li><b>同意申請單</b>：申請單明細的「看內容並同意」→ 在 GitHub 勾 ☐ 企劃同意（或 Spectra 桌面版勾任務 0.1、Notion 改「同意」、對 AI 說「同意 xxx」）。</li>
  <li><b>內容庫</b>：劇本、角色、世界觀、名詞、數值、規劃書。登入後每份文件右上角有「✏️ 編輯」，分類頁有「＋ 新文件」。正本在 Obsidian 的專案，改的內容會在下次「同步企劃文件」寫回 Obsidian。</li>
  <li><b>素材庫</b>：圖片、聲音、素材進度表（可依狀態、類別篩選）；登入後可以「＋ 上傳素材」。</li></ul>
  <h2>🔑 登入</h2><p>右上角「登入」→ 按「產生登入碼」（GitHub 權限已勾好）→ 複製貼回來。登入後可以在這裡直接<b>同意申請單、留言、寫回饋、提需求、編輯內容、上傳素材</b>。登入碼只存在這台瀏覽器；共用電腦用完請按頭像登出。</p>
  <h2>資料多新</h2><p>推上 GitHub、Issue 有變動、部署完成時自動更新（約 1 分鐘），另外每小時一次。右上角顯示更新時間，按 ⟳ 重新整理。</p>
  <h2>給程式</h2><p>資料來源：各專案 <code>workbench-data</code> 分支的 <code>data.json</code>（<code>tools/workbench/sync.mjs</code> 產生）。內容庫資料夾在 <code>workbench.config.json</code> 的 <code>content_dirs</code>。完整說明見開發流 <code>08 工作台與遠端操作</code>。</p></div>`;

// ---------- 文件閱讀 ----------
function parseCsv(text) {
  text = text.replace(/^﻿/, ""); const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const resolvePath = (base, rel) => { const parts = base.split("/").slice(0, -1); for (const seg of decodeURIComponent(rel).split("/")) { if (seg === "..") parts.pop(); else if (seg && seg !== ".") parts.push(seg); } return parts.join("/"); };
async function openDoc(path, target) {
  const el = typeof target === "string" ? $(target) : target; if (!el) return;
  S.doc = path;
  const req = (S.docReq = (S.docReq || 0) + 1); // 快速連點時，只顯示最後點的那一份
  document.querySelectorAll("[data-doc]").forEach(b => b.setAttribute("aria-current", b.dataset.doc === path));
  el.innerHTML = `<div class="muted">讀取中…</div>`;
  try {
    // 剛在管理台存過的檔案，raw 網址可能還是舊的（GitHub 快取約 5 分鐘），10 分鐘內先用剛存的內容
    let text;
    const cached = S.saved?.[`${S.repo}:${path}`];
    if (cached && Date.now() - cached.at < 10 * 60000) text = cached.text;
    else { const r = await fetch(raw(path) + `?t=${Date.now()}`); if (!r.ok) throw new Error(r.status); text = await r.text(); }
    if (req !== S.docReq) return;
    const editable = canWrite() && path.endsWith(".md");
    const head = `<div class="row" style="margin-bottom:10px"><span class="muted" style="flex:1">${esc(path)}</span>${editable ? `<button class="chip" data-edit="${esc(path)}">✏️ 編輯</button>` : ""}<a class="chip" href="${blob(path)}" target="_blank" rel="noopener">在 GitHub 打開</a></div>`;
    if (path.endsWith(".csv")) {
      const rows = parseCsv(text);
      el.innerHTML = head + `<div class="tablewrap"><table class="t"><thead><tr>${(rows[0] || []).map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.slice(1).filter(r => r.some(Boolean)).map(r => `<tr>${r.map(c => `<td class="pre">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      return;
    }
    const md = text.replace(/\r/g, "").replace(/^---\n[\s\S]*?\n---\n/, "");
    const html = window.DOMPurify && window.marked ? DOMPurify.sanitize(marked.parse(md)) : `<pre>${esc(md)}</pre>`;
    el.innerHTML = head + `<div class="md">${html}</div>`;
    el.querySelectorAll("img[src]").forEach(img => { const s = img.getAttribute("src"); if (!/^(https?:|data:)/.test(s)) img.src = raw(resolvePath(path, s)); });
    el.querySelectorAll("a[href]").forEach(a => {
      const h = a.getAttribute("href");
      if (/^https?:/.test(h)) { a.target = "_blank"; a.rel = "noopener"; return; }
      if (h.startsWith("#")) return;
      const p = resolvePath(path, h.split("#")[0]);
      if ((S.data.content || []).some(f => f.path === p)) { a.href = "#"; a.addEventListener("click", e => { e.preventDefault(); openDoc(p, el); }); }
      else { a.href = blob(p); a.target = "_blank"; a.rel = "noopener"; }
    });
  } catch (e) { if (req === S.docReq) el.innerHTML = `<div class="err card">讀不到這份文件（${esc(e.message)}）</div>`; }
}
const remember = (path, text) => { S.saved = { ...(S.saved || {}), [`${S.repo}:${path}`]: { text, at: Date.now() } }; };

// ---------- 明細面板 ----------
function showDetail(html) { const d = $("#detail"); d.innerHTML = html; d.classList.add("open"); d.scrollTop = 0; }
function hideDetail() { $("#detail").classList.remove("open"); S.sel = ""; document.querySelectorAll(".sel").forEach(n => n.classList.remove("sel")); }
function selectChange(id) {
  const c = S.data.changes.find(x => x.id === id); if (!c) return;
  S.sel = id; showDetail(changeDetail(c));
  document.querySelectorAll("[data-change]").forEach(n => n.classList.toggle("sel", n.dataset.change === id));
}

// ---------- 路由與繪製 ----------
const urlFor = (repo, route) => `${location.pathname}?repo=${encodeURIComponent(repo)}${qs.get("data") ? `&data=${encodeURIComponent(qs.get("data"))}` : ""}${qs.has("mock") ? "&mock=1" : ""}#${route}`;
function go(route, push = true) {
  if (!leaveOk()) { history.replaceState(null, "", urlFor(S.repo, [S.view, S.arg].filter(Boolean).join("/"))); return; }
  const [v, ...rest] = route.split("/");
  S.view = V[v] ? v : "overview"; S.arg = rest.join("/");
  if (push) history.pushState(null, "", urlFor(S.repo, route));
  closeProjMenu(); render(); document.body.classList.remove("drawer");
}
function render() {
  if (!S.data) return;
  $("#side").innerHTML = sideHtml();
  if (S.dirty && $("#edText")) return; // 編輯中：只更新側欄，不要把編輯器洗掉
  $("#view").innerHTML = V[S.view]();
  $("#view").scrollTop = 0;
  if (S.view === "specs" && S.arg) document.getElementById("spec-" + S.arg)?.scrollIntoView({ block: "center" });
  if (S.view === "projects") loadProjectSums();
  if (S.sel && ["tree", "changes", "overview"].includes(S.view)) selectChange(S.sel); else if (!["tree", "changes", "overview"].includes(S.view)) hideDetail();
}

document.addEventListener("click", e => {
  const t = e.target.closest("[data-go],[data-change],[data-doc],[data-doc-detail],[data-close],[data-tree],[data-proj],[data-img],[data-af],[data-ac],.tw,#addBtn");
  if (!t) return;
  if (t.classList.contains("tw") && !t.classList.contains("leaf")) { e.stopPropagation(); t.closest("li").classList.toggle("closed"); return; }
  if (t.dataset.go) { e.preventDefault(); go(t.dataset.go); return; }
  if (t.dataset.change) { selectChange(t.dataset.change); return; }
  if (t.dataset.doc) { if (leaveOk()) openDoc(t.dataset.doc, "#reader"); return; }
  if (t.dataset.docDetail) { if (!leaveOk()) return; showDetail(`<button class="ibtn close" data-close>✕</button><div id="dd"></div>`); openDoc(t.dataset.docDetail, "#dd"); return; }
  if (t.dataset.img !== undefined && t.dataset.img) { const p = t.dataset.img; showDetail(`<button class="ibtn close" data-close>✕</button><h3>${esc(p.split("/").pop())}</h3><img src="${raw(p)}" style="max-width:100%;border-radius:8px" alt=""><p><a class="btn" href="${blob(p)}" target="_blank" rel="noopener">在 GitHub 打開</a> <a class="btn" href="${raw(p)}" download>下載</a></p><p class="muted">${esc(p)}</p>`); return; }
  if (t.dataset.close !== undefined) { if ($("#detail #edText") && !leaveOk()) return; hideDetail(); return; }
  if (t.dataset.tree) { document.querySelectorAll("#flowTree li").forEach(li => li.classList.toggle("closed", t.dataset.tree === "close" && li.parentElement.id !== "flowTree")); return; }
  if (t.dataset.proj) { switchProject(t.dataset.proj); return; }
  if (t.dataset.af) { S.assetFilter = t.dataset.af; loadAssetSheet((S.data.content || []).find(f => f.ext === "csv" && /素材|asset/i.test(f.name)).path); return; }
  if (t.dataset.ac) { S.assetCat = t.dataset.ac; loadAssetSheet((S.data.content || []).find(f => f.ext === "csv" && /素材|asset/i.test(f.name)).path); return; }
  if (t.id === "addBtn") { const v = $("#addRepo").value.trim().replace(/^https:\/\/github\.com\//, "").replace(/\/$/, ""); if (!/^[\w.-]+\/[\w.-]+$/.test(v)) { alert("格式：帳號/專案"); return; } const local = JSON.parse(store.get("console:projects") || "[]"); if (!local.some(p => p.repo === v)) local.push({ repo: v, name: v.split("/")[1], local: true }); store.set("console:projects", JSON.stringify(local)); S.projects = mergeProjects(S.base, local); switchProject(v); }
});
document.addEventListener("input", e => { if (e.target.id === "treeSearch") { S.treeFilter = e.target.value; const pos = e.target.selectionStart; $("#view").innerHTML = V.tree(); const i = $("#treeSearch"); i.focus(); i.setSelectionRange(pos, pos); } });
addEventListener("popstate", () => { const p = new URLSearchParams(location.search).get("repo"); if (p && p !== S.repo) switchProject(p, false); else go(location.hash.slice(1) || "overview", false); });
// Esc 關明細：打字中、對話框開著、明細裡有編輯器時都不關
addEventListener("keydown", e => { if (e.key === "Escape" && !$("#dlg").open && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) && !$("#detail #edText")) hideDetail(); });
addEventListener("hashchange", () => { const r = location.hash.slice(1); if (r && r !== [S.view, S.arg].filter(Boolean).join("/")) go(r, false); });
$("#menu").addEventListener("click", () => document.body.classList.toggle("drawer"));
$("#scrim").addEventListener("click", () => document.body.classList.remove("drawer"));
// 左上角專案下拉選單：直接切換專案
function closeProjMenu() { $("#projMenu")?.remove(); $("#projBtn").setAttribute("aria-expanded", "false"); }
$("#projBtn").addEventListener("click", e => {
  e.stopPropagation();
  if ($("#projMenu")) return closeProjMenu();
  const m = document.createElement("div");
  m.id = "projMenu"; m.className = "menu"; m.setAttribute("role", "menu");
  m.innerHTML = S.projects.map(p => `<button role="menuitem" data-proj="${esc(p.repo)}" ${p.repo === S.repo ? 'aria-current="true"' : ""}><b>${p.repo === S.repo ? "✓ " : ""}${esc(p.name || p.repo)}</b><small>${esc(p.repo)}</small></button>`).join("") + `<hr><button role="menuitem" data-go="projects">📁 專案目錄（看全部、加入專案）</button>`;
  $("#projBtn").after(m); $("#projBtn").setAttribute("aria-expanded", "true");
  m.style.left = Math.min($("#projBtn").offsetLeft, innerWidth - m.offsetWidth - 8) + "px";
});
document.addEventListener("click", e => { if (!e.target.closest("#projMenu,#projBtn")) closeProjMenu(); });
addEventListener("keydown", e => { if (e.key === "Escape") closeProjMenu(); });
$("#reload").addEventListener("click", () => load(S.repo));
$("#theme").addEventListener("click", () => { const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); const nx = cur === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = nx; store.set("console:theme", nx); });
if (store.get("console:theme")) document.documentElement.dataset.theme = store.get("console:theme");

// ---------- 登入與寫入 ----------
const canWrite = () => !!auth.user?.canWrite;
const canTriage = () => !!auth.user?.canTriage;
// 所有寫入對話框最上面都寫清楚「送到哪個專案」，避免選錯專案
const target = () => `<div class="banner">📁 送到專案：<b>${esc(S.data?.name || S.repo)}</b>（${esc(S.repo)}）　不對的話請先按左上角換專案</div>`;
// 已同意、但 GitHub Actions 還沒寫回的申請單（重新整理後也記得，避免重複同意）
const pendKey = () => `console:pending:${S.repo}`;
const pending = () => { try { const p = JSON.parse(sessionStorage.getItem(pendKey()) || "{}"); for (const k in p) if (Date.now() - p[k] > 10 * 60000) delete p[k]; return p; } catch { return {}; } };
const markPending = id => { try { sessionStorage.setItem(pendKey(), JSON.stringify({ ...pending(), [id]: Date.now() })); } catch {} };
const isPending = c => c.status === "待同意" && !!pending()[c.id];
const approveBtn = (c, label = "👍 同意") => isPending(c) ? `<span class="chip s-已同意">⏳ 已同意，系統寫入中</span>` : `<button class="btn ok" data-approve="${esc(c.id)}">${label}</button>`;
// 編輯中還沒存：離開前要確認
const leaveOk = () => !S.dirty || confirm("文件還沒儲存，確定要離開嗎？改的內容會不見。") && !(S.dirty = false);
addEventListener("beforeunload", e => { if (S.dirty) { e.preventDefault(); e.returnValue = ""; } });
function toast(msg, ms = 3500) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), ms); }
/** 對話框：回傳按下的按鈕 value（取消＝""） */
function dialog(title, body, buttons = [["", "取消"], ["ok", "確定", "primary"]]) {
  const d = $("#dlg");
  // 取消／關閉加 formnovalidate：必填欄位還沒填也要能關掉
  d.innerHTML = `<form method="dialog"><div class="dlg-h">${esc(title)}<span class="spacer"></span><button class="ibtn" value="" formnovalidate aria-label="關閉">✕</button></div><div class="dlg-b">${body}</div><div class="dlg-f">${buttons.map(([v, l, c]) => `<button class="btn ${c || ""}" value="${v}" ${v ? "" : "formnovalidate"}>${l}</button>`).join("")}</div></form>`;
  d.showModal();
  // 用 submit（按按鈕當下就觸發）而不是 close 事件：背景分頁裡 close 事件可能會延遲
  return new Promise(res => {
    const form = d.querySelector("form");
    form.addEventListener("submit", e => res(e.submitter?.value || ""), { once: true });
    d.addEventListener("cancel", () => res(""), { once: true });
  });
}
function renderAuth() {
  const b = $("#loginBtn");
  if (auth.user) { b.innerHTML = `<span class="who"><img src="${esc(auth.user.avatar)}" alt="">${esc(auth.user.login)}${auth.user.noAccess ? " 🔒" : auth.user.canWrite ? "" : " 👀"}</span>`; b.title = auth.user.noAccess ? "已登入，但登入碼沒有包含這個專案" : auth.user.canWrite ? "已登入：可以同意、留言、寫回饋、編輯內容" : "已登入，但對這個專案只有讀取權限"; }
  else { b.textContent = "🔑 登入"; b.title = "登入後可以在管理台直接同意、留言、寫回饋、編輯內容"; }
}
async function checkAuth() {
  if (!auth.token || !S.repo) { auth.user = null; renderAuth(); return; }
  try { await verify(S.repo); } catch (e) { auth.user = null; toast("登入狀態：" + e.message, 6000); }
  renderAuth(); if (S.data) render();
}
async function loginFlow() {
  if (auth.user) {
    const v = await dialog("帳號", `<p><span class="who"><img src="${esc(auth.user.avatar)}" alt=""><b>${esc(auth.user.name)}</b>（${esc(auth.user.login)}）</span></p><p>對「${esc(S.repo)}」的權限：${auth.user.noAccess ? `🔒 登入碼沒有包含這個專案。請<a href="${tokenUrl(S.repo.split("/")[0])}" target="_blank" rel="noopener">重新產生登入碼</a>並勾選它（或選 All repositories），再登出、重新登入。` : auth.user.canWrite ? "✅ 可以同意、留言、寫回饋、編輯內容" : auth.user.canTriage ? "可以同意、留言、寫回饋（不能編輯內容）" : "👀 只能看"}</p><p class="muted">登入碼存在這台瀏覽器。換電腦、共用電腦用完請登出。</p>`, [["", "關閉"], ["out", "登出", "primary"]]);
    if (v === "out") { auth.clear(); renderAuth(); render(); toast("已登出"); }
    return;
  }
  const owner = S.repo.split("/")[0];
  const v = await dialog("登入 GitHub", `
    <p>登入後可以在管理台直接<b>同意申請單、留言、寫回饋、提需求、編輯企劃內容、上傳素材</b>。只要做一次（每台電腦／瀏覽器各一次）。</p>
    <ol class="steps">
      <li>按 <a href="${tokenUrl(owner)}" target="_blank" rel="noopener"><b>產生登入碼</b></a>（會打開 GitHub，權限已經幫你勾好）
        <ul class="muted"><li>「Repository access」選 <b>All repositories</b> 或勾選要管理的專案</li><li>拉到最下面按 <b>Generate token</b>，複製那串 <code>github_pat_…</code></li><li>專案不是你自己的（你是協作者）：改用 <a href="${classicTokenUrl}" target="_blank" rel="noopener">傳統登入碼</a>（勾 repo）</li></ul></li>
      <li>貼在下面，按「登入」</li>
    </ol>
    <label class="fld"><span>登入碼</span><input name="token" type="password" autocomplete="off" placeholder="github_pat_… 或 ghp_…" required></label>
    <label class="row"><input type="checkbox" name="remember" checked> 記住這台電腦（共用電腦請取消）</label>
    <p class="muted">登入碼只存在你的瀏覽器、只會送到 GitHub。不要貼給別人，也不要貼在聊天裡。</p>`, [["", "取消"], ["ok", "登入", "primary"]]);
  if (v !== "ok") return;
  const f = $("#dlg form");
  const token = f.token.value.trim();
  if (!token) return;
  auth.save(token, f.remember.checked);
  try { const u = await verify(S.repo); renderAuth(); render(); toast(`歡迎 ${u.login}！${u.canWrite ? "" : "（這個專案你只有讀取權限）"}`); }
  catch (e) { auth.clear(); renderAuth(); toast("登入失敗：" + e.message, 7000); }
}
$("#loginBtn").addEventListener("click", loginFlow);

async function doApprove(id) {
  const c = S.data.changes.find(x => x.id === id); if (!c) return;
  const v = await dialog("同意申請單", `${target()}<p>確定同意 <b>${esc(c.title)}</b>（${esc(c.id)}）？</p>${c.confirm ? `<div class="ask">❓ ${esc(c.confirm)}</div>` : ""}<p class="muted">同意後 AI 就可以開始實作。如果還有疑問，請改用「留言」。</p>`, [["", "取消"], ["ok", "👍 同意", "ok"]]);
  if (v !== "ok") return;
  try {
    const how = await approveChange(S.repo, c, S.data.specDir, S.data.branch);
    toast(how === "already" ? "這張已經同意過了，系統寫入中 ⏳" : how === "issue" ? "已同意 ✅ 約 1 分鐘後任務 0.1 會自動打勾" : "已同意 ✅ 已寫入任務 0.1");
    markPending(c.id); render();
  } catch (e) { toast("同意失敗：" + e.message, 7000); }
}
async function doComment(id) {
  const c = S.data.changes.find(x => x.id === id); if (!c?.issue) return;
  const v = await dialog(`留言：${c.title}`, `${target()}<label class="fld"><span>想說什麼（問題、要修改的地方都可以）</span><textarea name="msg" required placeholder="例：拖尾顏色跟著街區配色，手機上請再短一點"></textarea></label><p class="muted">留言會出現在申請單 Issue；對 AI 說「看申請單」，AI 會照留言修改。</p>`, [["", "取消"], ["ok", "送出留言", "primary"]]);
  if (v !== "ok") return;
  const msg = $("#dlg form").msg.value.trim(); if (!msg) return;
  try { await comment(S.repo, c.issue.number, msg); c.issue.comments = (c.issue.comments || 0) + 1; toast("已送出留言 💬"); render(); }
  catch (e) { toast("留言失敗：" + e.message, 7000); }
}
async function doNewIssue(kind) {
  const fb = kind === "回饋";
  const v = await dialog(fb ? "🎮 寫回饋" : "💡 提需求", `${target()}
    <label class="fld"><span>${fb ? "一句話說是什麼問題" : "一句話說想要什麼"}</span><input name="title" required placeholder="${fb ? "例：第 5 關球常常卡在右上角" : "例：加一個每日挑戰關卡"}"></label>
    ${fb ? `<label class="fld"><span>等級</span><select name="level"><option>🔴 必修（不改不行）</option><option selected>🟡 建議（改了會更好）</option><option>🟢 很好（請保留不要動）</option></select></label>
      <label class="fld"><span>試玩的版本或日期</span><input name="version" placeholder="v3.7.3 或 10/6"></label>
      <label class="fld"><span>用什麼玩</span><select name="device"><option>手機</option><option>平板</option><option>電腦</option></select></label>`
    : `<label class="fld"><span>優先</span><select name="priority"><option>🔴 必做</option><option selected>🟡 想做</option><option>⚪ 之後再說</option></select></label>`}
    <label class="fld"><span>${fb ? "發生什麼事／想要什麼感覺" : "玩家遇到什麼問題／想要什麼"}</span><textarea name="what" required></textarea></label>
    ${fb ? "" : `<label class="fld"><span>想法、參考（選填）</span><textarea name="idea" style="min-height:70px"></textarea></label><label class="fld"><span>怎樣算做好了（選填）</span><input name="done" placeholder="例：第 1 區新手每關最多掉 1 顆愛心"></label>`}
    <label class="fld"><span>截圖（選填，可以多張）</span><input name="shots" type="file" accept="image/*" multiple></label>
    <p class="muted">名詞請用名詞表裡的名字。送出後對 AI 說「${fb ? "看回饋" : "看需求"}」。</p>`, [["", "取消"], ["ok", "送出", "primary"]]);
  if (v !== "ok") return;
  const f = $("#dlg form");
  const fields = fb
    ? { __title: f.title.value.trim(), "等級": f.level.value, "試玩的版本或日期": f.version.value.trim(), "發生什麼事／想要什麼感覺": f.what.value.trim(), "用什麼玩": f.device.value }
    : { __title: f.title.value.trim(), "優先": f.priority.value, "玩家遇到什麼問題／想要什麼": f.what.value.trim(), "想法、參考": f.idea.value.trim(), "怎樣算做好了": f.done.value.trim() };
  if (!fields.__title) return;
  toast("送出中…", 20000);
  try {
    const i = await createIssue(S.repo, kind, fields, [...(f.shots.files || [])], S.data.branch, (S.data.contentDirs || ["docs/企劃"])[0]);
    (fb ? S.data.feedback : S.data.requests).unshift({ number: i.number, title: i.title, url: i.html_url, state: "open", created: i.created_at, user: auth.user.login, labels: [kind], comments: 0 });
    toast(`已送出 #${i.number} ✅`); render();
  } catch (e) { toast("送出失敗：" + e.message, 7000); }
}

async function doEdit(path, preset, container) {
  const el = container || $("#reader") || $("#dd"); if (!el) return;
  el.innerHTML = `<div class="muted">讀取中…</div>`;
  let file = preset;
  if (!file) try { file = await readFile(S.repo, path, S.data.branch); } catch (e) { el.innerHTML = `<div class="card err">${esc(e.message)}</div>`; return; }
  const mirror = /正本在 Obsidian|鏡像自 Obsidian/.test(file.text);
  el.innerHTML = `<div class="editor">
    <div class="row" style="margin-bottom:10px"><b style="flex:1">✏️ ${esc(path)}</b><button class="btn" data-ed="preview">預覽</button><button class="btn" data-ed="cancel">取消</button><button class="btn primary" data-ed="save">儲存</button></div>
    ${target()}
    ${mirror ? `<div class="banner">這份的正本在 Obsidian，兩邊雙向同步：在這裡儲存後，下次「同步企劃文件」會寫回 Obsidian（兩邊都改過會提醒，不會互相蓋掉）。</div>` : ""}
    <textarea id="edText" spellcheck="false">${esc(file.text)}</textarea>
    <div class="md doc" id="edPrev" hidden></div>
    <label class="fld" style="margin-top:10px"><span>這次改了什麼（會記在 GitHub 的修改紀錄）</span><input id="edMsg" placeholder="例：阿鰭的外型描述改成藍綠色"></label></div>`;
  el.querySelector('[data-ed="preview"]').onclick = () => {
    const p = $("#edPrev"), ta = $("#edText"), showing = !p.hidden;
    if (!showing) p.innerHTML = window.DOMPurify && window.marked ? DOMPurify.sanitize(marked.parse(ta.value.replace(/^---\n[\s\S]*?\n---\n/, ""))) : esc(ta.value);
    p.hidden = showing; ta.hidden = !showing;
    el.querySelector('[data-ed="preview"]').textContent = showing ? "預覽" : "回到編輯";
  };
  el.querySelector("#edText").addEventListener("input", e => { S.dirty = e.target.value !== file.text; });
  el.querySelector('[data-ed="cancel"]').onclick = () => { if (leaveOk()) { S.dirty = false; openDoc(path, el); } };
  const saveBtn = el.querySelector('[data-ed="save"]');
  saveBtn.onclick = async () => {
    const text = $("#edText").value, msg = $("#edMsg").value.trim() || `更新 ${path.split("/").pop()}`;
    if (text === file.text) { toast("沒有改動"); return; }
    saveBtn.disabled = true; saveBtn.textContent = "儲存中…"; // 防止連按兩次
    try { const sha = await saveFile(S.repo, path, text, `內容：${msg}（管理台，${auth.user.login}）`, file.sha, S.data.branch); file = { text, sha }; S.dirty = false; remember(path, text); toast("已儲存 ✅ GitHub 上的檔案已更新"); openDoc(path, el); }
    catch (e) { toast("儲存失敗：" + e.message, 7000); saveBtn.disabled = false; saveBtn.textContent = "儲存"; }
  };
}
async function doNewDoc(catKey) {
  const cat = CATS.find(c => c.key === catKey);
  const files = (S.data.content || []).filter(f => catOf(f) === catKey);
  const folder = files[0] ? files[0].path.split("/").slice(0, -1).join("/") : `${(S.data.contentDirs || ["docs/企劃"])[0]}/知識庫/${cat?.label || "其他"}`;
  const v = await dialog(`＋ 新增${cat?.label || ""}文件`, `${target()}<label class="fld"><span>標題（也是檔名）</span><input name="title" required placeholder="例：${catKey === "chars" ? "新角色－小黑" : "第 2 區劇情"}"></label><p class="muted">會建立在 <code>${esc(folder)}/</code></p>`, [["", "取消"], ["ok", "建立", "primary"]]);
  if (v !== "ok") return;
  const title = $("#dlg form").title.value.trim().replace(/[\\/:*?"<>|]/g, "－"); if (!title) return;
  const path = `${folder}/${title}.md`;
  const text = `# ${title}\n\n`;
  if ((S.data.content || []).some(f => f.path === path)) { toast("已經有同名的文件了，請換一個標題", 6000); return; }
  try { const sha = await saveFile(S.repo, path, text, `內容：新增 ${title}（管理台，${auth.user.login}）`, undefined, S.data.branch); S.data.content.push({ path, name: title + ".md", ext: "md", size: 0, title }); S.doc = path; remember(path, text); render(); setTimeout(() => doEdit(path, { text, sha }), 50); toast("已建立，開始編輯吧"); }
  catch (e) { toast("建立失敗：" + e.message, 7000); }
}
async function doUpload() {
  const dir = `${(S.data.contentDirs || ["docs/企劃"])[0]}/圖`;
  const v = await dialog("＋ 上傳素材", `${target()}<label class="fld"><span>選擇檔案（圖片或聲音，可以多個）</span><input name="files" type="file" accept="image/*,audio/*" multiple required></label><p class="muted">會放到 <code>${esc(dir)}/</code>。檔名請用英文小寫＋底線（例：<code>fish_sleepy.png</code>）。</p>`, [["", "取消"], ["ok", "上傳", "primary"]]);
  if (v !== "ok") return;
  const files = [...($("#dlg form").files.files || [])]; if (!files.length) return;
  toast("上傳中…", 30000);
  try {
    const renamed = [];
    for (const file of files) {
      const r = await uploadFile(S.repo, `${dir}/${file.name}`, file, `素材：上傳 ${file.name}（管理台，${auth.user.login}）`, S.data.branch);
      const name = r.path.split("/").pop();
      if (name !== file.name) renamed.push(`${file.name} → ${name}`);
      S.data.content.push({ path: r.path, name, ext: name.split(".").pop().toLowerCase(), size: file.size, title: name.replace(/\.[^.]+$/, "") });
    }
    toast(`已上傳 ${files.length} 個檔案 ✅${renamed.length ? `（同名已自動改名：${renamed.join("、")}）` : ""}`, renamed.length ? 8000 : 3500); render();
  } catch (e) { toast("上傳失敗：" + e.message, 7000); }
}
document.addEventListener("click", e => {
  const t = e.target.closest("[data-approve],[data-comment],[data-newissue],[data-edit],[data-newdoc],[data-upload]");
  if (!t) return;
  e.preventDefault();
  if (!auth.user) { loginFlow(); return; }
  if (!canTriage()) { toast(auth.user.noAccess ? `你的登入碼沒有包含「${S.repo}」：請重新產生登入碼並勾選這個專案` : "你對這個專案只有讀取權限", 7000); return; }
  if (t.dataset.approve) doApprove(t.dataset.approve);
  else if (t.dataset.comment) doComment(t.dataset.comment);
  else if (t.dataset.newissue) doNewIssue(t.dataset.newissue);
  else if (t.dataset.edit) { if (!canWrite()) return toast("你對這個專案沒有編輯權限"); doEdit(t.dataset.edit, null, t.closest("#reader,#dd")); }
  else if (t.dataset.newdoc) { if (!canWrite()) return toast("你對這個專案沒有編輯權限"); doNewDoc(t.dataset.newdoc); }
  else if (t.dataset.upload !== undefined) { if (!canWrite()) return toast("你對這個專案沒有編輯權限"); doUpload(); }
});

// ---------- 載入 ----------
const mergeProjects = (base, local) => [...base, ...local.filter(l => !base.some(b => b.repo === l.repo))];
async function fetchData(repo) {
  const url = qs.get("data") && repo === S.first ? qs.get("data") : `https://raw.githubusercontent.com/${repo}/workbench-data/data.json?t=${Date.now()}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(r.status === 404 ? "這個專案還沒有管理台資料（要先有 workbench Action 並跑過一次）" : `讀取失敗（${r.status}）`);
  return r.json();
}
async function load(repo) {
  S.repo = repo; $("#projName").textContent = repo; $("#reload").disabled = true;
  try {
    const d = await fetchData(repo); store.set("console:cache:" + repo, JSON.stringify(d)); setData(d, false);
  } catch (e) {
    const c = store.get("console:cache:" + repo);
    if (c) setData(JSON.parse(c), true);
    else { S.data = null; $("#side").innerHTML = ""; $("#view").innerHTML = `<div class="card err">${esc(e.message)}<p><a href="https://github.com/${esc(repo)}/actions" target="_blank" rel="noopener">看 GitHub Actions</a>・<button class="btn" id="toProjects">換專案</button></p></div>`; $("#toProjects").onclick = () => { S.data = { changes: [], specs: [], feedback: [], requests: [], runs: [], commits: [], links: [], content: [] }; go("projects"); }; }
  } finally { $("#reload").disabled = false; }
}
function setData(d, cached) {
  S.data = d; S.repo = d.repo || S.repo;
  $("#projName").textContent = d.name; document.title = `${d.name}｜開發管理台`;
  $("#fresh").textContent = `${cached ? "離線資料・" : ""}更新於 ${ago(d.generatedAt)}`;
  $("#toWorkbench").href = `../workbench/?repo=${encodeURIComponent(S.repo)}`;
  store.set("console:last", S.repo);
  go(location.hash.slice(1) || "overview", false);
  if (auth.token && auth.user?.repo !== S.repo) checkAuth();
}
function switchProject(repo, push = true) {
  if (!leaveOk()) return;
  S.sel = ""; S.doc = ""; hideDetail(); closeProjMenu();
  if (push) history.pushState(null, "", urlFor(repo, "overview"));
  load(repo);
}
async function loadProjectSums() {
  for (const p of S.projects) {
    const el = document.querySelector(`[data-psum="${CSS.escape(p.repo)}"]`); if (!el) continue;
    try {
      const d = p.repo === S.repo ? S.data : await fetchData(p.repo);
      const act = d.changes.filter(c => !c.archived), w = act.filter(c => c.status === "待同意").length;
      el.innerHTML = `${w ? `<span class="chip s-待同意">待同意 ${w}</span> ` : ""}進行中 ${act.length}・已結案 ${d.changes.length - act.length}・規則書 ${d.specs.length}<br>更新於 ${ago(d.generatedAt)}`;
    } catch (e) { el.textContent = e.message; }
  }
}

(async () => {
  if (qs.has("mock")) await import("./mock.js"); // 本機測試：假的 GitHub API，不會寫到真的 repo
  renderAuth();
  let base = [];
  try { base = (await (await fetch("projects.json", { cache: "no-store" })).json()).projects || []; } catch {}
  S.base = base;
  S.projects = mergeProjects(base, JSON.parse(store.get("console:projects") || "[]"));
  const guess = location.hostname.endsWith(".github.io") ? `${location.hostname.split(".")[0]}/${location.pathname.split("/")[1]}` : "";
  S.first = qs.get("repo") || store.get("console:last") || S.projects[0]?.repo || guess;
  load(S.first);
})();

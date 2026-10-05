// 本機測試用：網址加 ?mock=1 時，把對 api.github.com 的呼叫換成假的回應，記錄在 window.__calls。
// 不會碰到真的 GitHub；讀取檔案內容時才會去 raw.githubusercontent.com 拿公開的檔案。
const real = window.fetch.bind(window);
window.__calls = [];
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const b64 = s => { const b = new TextEncoder().encode(s); let x = ""; b.forEach(c => (x += String.fromCharCode(c))); return btoa(x); };
let n = 100;
window.fetch = async (url, init = {}) => {
  const u = String(url);
  if (!u.startsWith("https://api.github.com")) return real(url, init);
  const method = (init.method || "GET").toUpperCase();
  const path = decodeURIComponent(new URL(u).pathname);
  const body = init.body ? JSON.parse(init.body) : null;
  window.__calls.push({ method, path, body });
  if (path === "/user") return json({ login: "demo-planner", name: "示範企劃", avatar_url: "../workbench/icon.svg" });
  let m;
  if ((m = path.match(/^\/repos\/[^/]+\/[^/]+$/))) return json({ permissions: { push: true, triage: true } });
  if ((m = path.match(/\/issues\/(\d+)$/)) && method === "GET") return json({ number: +m[1], body: "<!-- spectra-change: x -->\n### 為什麼\n…\n\n- [ ] 企劃同意\n" });
  if (path.match(/\/issues\/\d+$/) && method === "PATCH") return json({ ok: true });
  if (path.match(/\/issues\/\d+\/comments$/)) return json({ id: 1 }, 201);
  if (path.match(/\/issues$/) && method === "POST") return json({ number: ++n, title: body.title, html_url: "#mock-issue", created_at: new Date().toISOString() }, 201);
  if ((m = path.match(/^\/repos\/([^/]+\/[^/]+)\/contents\/(.+)$/))) {
    if (method === "GET") {
      const r = await real(`https://raw.githubusercontent.com/${m[1]}/main/${m[2].split("/").map(encodeURIComponent).join("/")}`);
      return r.ok ? json({ content: b64(await r.text()), sha: "mock-sha" }) : json({ message: "Not Found" }, 404);
    }
    if (method === "PUT") return json({ content: { sha: "mock-sha-2" } }, 201);
  }
  return json({ message: "mock: 沒有處理 " + method + " " + path }, 404);
};
console.info("[mock] GitHub API 已換成假的回應");

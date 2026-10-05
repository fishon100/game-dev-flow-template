// 把企劃匯出的 .xlsx 轉成 .csv（不用安裝任何套件）。
// 用法：node tools/tables/to-csv.mjs            → 轉 tools/tables/in/ 裡所有 .xlsx
//       node tools/tables/to-csv.mjs a.xlsx     → 只轉這個檔
// 輸出「試算表上看到的值」：千分位格式保留逗號（"152,763" 不會變成 152763），
// 長數字不會變成 1.2E8，整數不會多出 .0。只轉第一個工作表。
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const IN = join(dirname(fileURLToPath(import.meta.url)), "in");

function unzip(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("不是 xlsx（找不到 zip 目錄）");
  const files = {};
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = buf.readUInt16LE(eocd + 10); n > 0; n--) {
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42), name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    files[name] = (method === 8 ? inflateRawSync(raw) : raw).toString("utf8");
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const dec = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, "&");
const text = x => dec((x.match(/<t[^>]*>[\s\S]*?<\/t>/g) || []).map(t => t.replace(/<[^>]+>/g, "")).join(""));
const colIndex = ref => [...ref.replace(/\d+/g, "")].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
const csvCell = s => (s = s == null ? "" : String(s), /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);

export function xlsxToCsv(buf) {
  const z = unzip(buf);
  const ss = (z["xl/sharedStrings.xml"]?.match(/<si>[\s\S]*?<\/si>/g) || []).map(text);
  const xfs = (((z["xl/styles.xml"] || "").match(/<cellXfs[\s\S]*?<\/cellXfs>/) || [""])[0].match(/<xf [^>]*>/g) || [])
    .map(x => +((x.match(/numFmtId="(\d+)"/) || [])[1] || 0));
  const num = (v, s) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return v;
    if (xfs[s] === 3) return Math.round(n).toLocaleString("en-US");
    if (xfs[s] === 4) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return Number.isInteger(n) ? BigInt(n).toString() : String(n);
  };
  const sheetName = Object.keys(z).filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];
  const rows = [];
  for (const r of z[sheetName].match(/<row[^>]*>[\s\S]*?<\/row>|<row[^>]*\/>/g) || []) {
    const row = [];
    for (const c of r.match(/<c [^>]*\/>|<c [^>]*>[\s\S]*?<\/c>/g) || []) {
      const ref = c.match(/ r="([A-Z]+\d+)"/)[1], t = (c.match(/ t="(\w+)"/) || [])[1];
      const v = (c.match(/<v>([\s\S]*?)<\/v>/) || [])[1], s = +((c.match(/ s="(\d+)"/) || [])[1] || 0);
      row[colIndex(ref)] = t === "s" ? ss[+v] : t === "inlineStr" ? text(c) : v == null ? "" : t ? dec(v) : num(v, s);
    }
    rows[+r.match(/ r="(\d+)"/)[1] - 1] = row;
  }
  const width = Math.max(0, ...rows.filter(Boolean).map(r => r.length));
  const lines = Array.from(rows, r => Array.from({ length: width }, (_, j) => csvCell((r || [])[j])).join(","));
  while (lines.length && /^,*$/.test(lines.at(-1))) lines.pop();
  return lines.join("\r\n") + "\r\n";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const targets = process.argv.slice(2).length ? process.argv.slice(2)
    : readdirSync(IN).filter(f => f.toLowerCase().endsWith(".xlsx")).map(f => join(IN, f));
  if (!targets.length) { console.log(`tools/tables/in/ 裡沒有 .xlsx`); process.exit(0); }
  for (const f of targets) {
    const out = f.replace(/\.xlsx$/i, ".csv");
    const csv = xlsxToCsv(readFileSync(f));
    writeFileSync(out, csv, "utf8");
    console.log(`${basename(f)} → ${basename(out)}（${csv.trimEnd().split("\r\n").length} 列）`);
  }
}

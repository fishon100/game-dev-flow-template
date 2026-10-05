// 產生工作台／管理台的 PNG 圖示（iPhone「加到主畫面」要用 PNG）。圖形和 web/workbench/icon.svg 一樣。
// 用法：node tools/make-icons.mjs   → web/workbench/icon-180.png、icon-512.png
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// 64×64 的設計座標（同 icon.svg）
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const A = hex("#0E4B59"), B = hex("#0B6E83"), WHITE = [255, 255, 255], CYAN = hex("#7FE0EE");
const inRoundRect = (x, y, r = 15) => { const cx = Math.min(Math.max(x, r), 64 - r), cy = Math.min(Math.max(y, r), 64 - r); return x >= 0 && x <= 64 && y >= 0 && y <= 64 && (x - cx) ** 2 + (y - cy) ** 2 <= r * r; };
const distSeg = (x, y, x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1, t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy))); return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)); };
// 分支曲線 M21 24 c0 8 7 10 16 10 → 取樣成折線
const curve = []; for (let i = 0; i <= 24; i++) { const t = i / 24, u = 1 - t; curve.push([u ** 3 * 21 + 3 * u * u * t * 21 + 3 * u * t * t * 28 + t ** 3 * 37, u ** 3 * 24 + 3 * u * u * t * 32 + 3 * u * t * t * 34 + t ** 3 * 34]); }
function colorAt(x, y) {
  if (!inRoundRect(x, y)) return null;
  const t = Math.max(0, Math.min(1, (x + y) / 128));
  let c = A.map((v, i) => v + (B[i] - v) * t);
  const onLine = distSeg(x, y, 21, 19, 21, 45) <= 2.25 || curve.some((p, i) => i && distSeg(x, y, ...curve[i - 1], ...p) <= 2.25);
  if (onLine || Math.hypot(x - 21, y - 17) <= 6 || Math.hypot(x - 21, y - 47) <= 6) c = WHITE;
  const d = Math.hypot(x - 43, y - 34);
  if (d <= 8.5) c = d <= 7 - 1.5 ? CYAN : WHITE; // 青色節點＋白框
  return c;
}
function render(size) {
  const out = Buffer.alloc(size * size * 4), S = 4; // 4×4 超取樣做反鋸齒
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const c = colorAt(((px + (sx + 0.5) / S) / size) * 64, ((py + (sy + 0.5) / S) / size) * 64);
      if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
    }
    const o = (py * size + px) * 4;
    if (a) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; out[o + 3] = (255 * a) / (S * S); }
  }
  return png(size, out);
}
for (const size of [180, 512]) {
  const f = new URL(`../web/workbench/icon-${size}.png`, import.meta.url);
  writeFileSync(f, render(size));
  console.log(`icon-${size}.png`);
}

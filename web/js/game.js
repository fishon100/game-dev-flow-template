// 畫面與操作：讀 tuning.json → 用 rules.js 推進 → 畫出來。規則不要寫在這裡。
import { newGame, step, clampPaddle } from "./rules.js";

const T = await (await fetch("tuning.json", { cache: "no-cache" })).json();
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = T.board.width;
canvas.height = T.board.height;

let state = newGame(T);
let paddleX = T.board.width / 2;
let flash = 0;

function pointerX(e) {
  const rect = canvas.getBoundingClientRect();
  return ((e.clientX - rect.left) / rect.width) * T.board.width;
}
canvas.addEventListener("pointermove", e => { paddleX = clampPaddle(pointerX(e), T); });
canvas.addEventListener("pointerdown", e => {
  paddleX = clampPaddle(pointerX(e), T);
  if (state.over) state = newGame(T);
});

const STEP = 1 / 240;
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= STEP) {
    const r = step(state, paddleX, STEP, T);
    state = r.state;
    if (r.events.includes("paddle")) { flash = 0.12; navigator.vibrate?.(15); }
    if (r.events.includes("lost")) navigator.vibrate?.(80);
    acc -= STEP;
  }
  flash = Math.max(0, flash - 1 / 60);
  draw();
  requestAnimationFrame(frame);
}

function draw() {
  const { width: W, height: H } = T.board;
  ctx.fillStyle = "#14121f";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = flash > 0 ? "#ffe066" : "#ff4fa3";
  const py = H - T.paddle.y_from_bottom;
  ctx.fillRect(paddleX - T.paddle.width / 2, py, T.paddle.width, T.paddle.height);
  ctx.fillStyle = "#e8f6ff";
  ctx.beginPath();
  ctx.arc(state.ball.x, state.ball.y, T.ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "bold 18px system-ui, sans-serif";
  ctx.fillText(`♥ ${state.lives}`, 12, 26);
  ctx.textAlign = "right";
  ctx.fillText(`${state.score}`, W - 12, 26);
  ctx.textAlign = "left";
  if (state.over) {
    ctx.textAlign = "center";
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.fillText("GAME OVER", W / 2, H / 2);
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText("點一下重新開始", W / 2, H / 2 + 32);
    ctx.textAlign = "left";
  }
}

draw(); // 一載入就先畫一次，不用等動畫開始（背景分頁會暫停動畫）
window.gameReady = true; // 給 test.html 知道遊戲已經準備好
requestAnimationFrame(frame);

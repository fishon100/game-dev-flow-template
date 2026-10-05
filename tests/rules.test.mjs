// 規則測試：一個 test 對應規則書裡的一個「情境」。執行：node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newGame, step, clampPaddle, paddleBounce } from "../web/js/rules.js";

const T = JSON.parse(readFileSync(new URL("../web/tuning.json", import.meta.url), "utf8"));
const DT = 1 / 240;

test("開局有 start_lives 條命、0 分", () => {
  const s = newGame(T);
  assert.equal(s.lives, T.rules.start_lives);
  assert.equal(s.score, 0);
});

test("滑板不會超出台面左右兩邊", () => {
  assert.equal(clampPaddle(-500, T), T.paddle.width / 2);
  assert.equal(clampPaddle(9999, T), T.board.width - T.paddle.width / 2);
});

test("打中滑板正中間，球往正上方彈", () => {
  const v = paddleBounce(100, 100, T);
  assert.ok(Math.abs(v.vx) < 1e-9);
  assert.ok(v.vy < 0);
});

test("打滑板越邊邊越斜，但不超過 max_angle_deg", () => {
  const edge = paddleBounce(100 + T.paddle.width, 100, T);
  const deg = (Math.atan2(edge.vx, -edge.vy) * 180) / Math.PI;
  assert.ok(Math.abs(deg - T.paddle.max_angle_deg) < 1e-6);
});

test("球掉出底部扣 1 條命並重新發球；命用完就結束", () => {
  let s = { ...newGame(T), lives: 1 };
  s.ball = { x: 10, y: T.board.height + T.ball.radius * 3, vx: 0, vy: 100 };
  const r = step(s, T.board.width - 10, DT, T);
  assert.ok(r.events.includes("lost"));
  assert.equal(r.state.lives, 0);
  assert.equal(r.state.over, true);
});

test("球不會穿牆：最快速度跑 10 秒，球心一直在台面內", () => {
  let s = newGame(T);
  s.ball = { ...s.ball, vx: T.ball.max_speed, vy: -T.ball.max_speed };
  const r = T.ball.radius;
  for (let i = 0; i < 2400; i++) {
    s = step(s, s.ball.x, DT, T).state; // 滑板跟著球，不會掉
    assert.ok(s.ball.x >= r - 1e-9 && s.ball.x <= T.board.width - r + 1e-9, `第 ${i} 步 x=${s.ball.x}`);
    assert.ok(s.ball.y >= r - 1e-9, `第 ${i} 步 y=${s.ball.y}`);
  }
  assert.equal(s.lives, T.rules.start_lives);
});

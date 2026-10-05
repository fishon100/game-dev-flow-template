// 遊戲規則：只放「純計算」，不碰畫面，Node 和瀏覽器都能測。
// 每個函式對應規則書 docs/spectra/specs/ 裡的一條規則；改規則請開申請單。

/** 開局狀態 */
export function newGame(T) {
  return {
    lives: T.rules.start_lives,
    score: 0,
    over: false,
    ball: serve(T),
  };
}

/** 發球：球從上方中間往下發射 */
export function serve(T) {
  return { x: T.board.width / 2, y: T.ball.radius * 4, vx: T.ball.launch_speed * 0.35, vy: T.ball.launch_speed * 0.2 };
}

/** 滑板的位置限制在台面內 */
export function clampPaddle(x, T) {
  const half = T.paddle.width / 2;
  return Math.min(T.board.width - half, Math.max(half, x));
}

/** 球打到滑板後的速度：打中間往正上，打越邊邊角度越斜（最多 max_angle_deg） */
export function paddleBounce(ballX, paddleX, T) {
  const offset = Math.max(-1, Math.min(1, (ballX - paddleX) / (T.paddle.width / 2)));
  const angle = (offset * T.paddle.max_angle_deg * Math.PI) / 180;
  return { vx: Math.sin(angle) * T.paddle.bounce_speed, vy: -Math.cos(angle) * T.paddle.bounce_speed };
}

/**
 * 推進一小步。回傳新的狀態與這一步發生的事件（"wall" | "paddle" | "lost"）。
 * 物理每一步都檢查碰撞，dt 要夠小（遊戲用 1/240 秒），球才不會穿牆。
 */
export function step(state, paddleX, dt, T) {
  if (state.over) return { state, events: [] };
  const events = [];
  const r = T.ball.radius, W = T.board.width, H = T.board.height;
  let { x, y, vx, vy } = state.ball;
  let { lives, score, over } = state;

  vy += T.ball.gravity * dt;
  const sp = Math.hypot(vx, vy);
  if (sp > T.ball.max_speed) { vx *= T.ball.max_speed / sp; vy *= T.ball.max_speed / sp; }
  x += vx * dt; y += vy * dt;

  if (x < r) { x = r; vx = Math.abs(vx) * T.ball.wall_bounce; events.push("wall"); }
  if (x > W - r) { x = W - r; vx = -Math.abs(vx) * T.ball.wall_bounce; events.push("wall"); }
  if (y < r) { y = r; vy = Math.abs(vy) * T.ball.wall_bounce; events.push("wall"); }

  const py = H - T.paddle.y_from_bottom;
  const onPaddle = vy > 0 && y + r >= py && y + r <= py + T.paddle.height + vy * dt &&
    Math.abs(x - paddleX) <= T.paddle.width / 2 + r;
  if (onPaddle) {
    ({ vx, vy } = paddleBounce(x, paddleX, T));
    y = py - r;
    score += 1;
    events.push("paddle");
  }

  let ball = { x, y, vx, vy };
  if (y - r > H) {
    lives -= 1;
    events.push("lost");
    if (lives <= 0) over = true; else ball = serve(T);
  }
  return { state: { lives, score, over, ball }, events };
}

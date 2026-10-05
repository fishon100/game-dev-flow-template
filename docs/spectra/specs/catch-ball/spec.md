# catch-ball Specification

## Purpose

The starter game that ships with the template: one ball, one paddle, three lives. It exists to show how a rule in this spec becomes a test in `tests/rules.test.mjs` and code in `web/js/rules.js`. Replace it with your own game's first change.

> 中文：範本附的範例遊戲（接球）。用來示範「規則 → 測試 → 程式」怎麼對應；開新專案時用第一張申請單把它換掉。

## Requirements

### Requirement: Lives

The game SHALL start with `rules.start_lives` lives and 0 score. When the ball falls below the bottom edge the game SHALL remove one life and serve a new ball; when no lives remain the game SHALL end.

> 中文：開局 3 條命、0 分；球掉出底部扣 1 條命並重新發球，命用完遊戲結束。

#### Scenario: New game

- **WHEN** a new game starts
- **THEN** lives SHALL equal `rules.start_lives` and score SHALL be 0

#### Scenario: Losing the last life ends the game

- **WHEN** the player has 1 life and the ball falls below the bottom edge
- **THEN** lives SHALL become 0 and the game SHALL be over

### Requirement: Paddle

The paddle SHALL follow the player's finger or mouse horizontally and SHALL stay fully inside the board. A ball hitting the paddle center SHALL bounce straight up; the further from the center it hits, the steeper the angle, up to `paddle.max_angle_deg`.

> 中文：滑板跟著手指或滑鼠左右移，不會超出台面；打中間往正上彈，越邊邊越斜，最斜 60 度。

#### Scenario: Paddle stays on the board

- **WHEN** the pointer moves past the left or right edge
- **THEN** the paddle SHALL stop with its edge touching the board edge

#### Scenario: Center hit goes straight up

- **WHEN** the ball hits the exact center of the paddle
- **THEN** the ball SHALL leave with no horizontal speed, moving up

#### Scenario: Edge hit is capped

- **WHEN** the ball hits the paddle at or beyond its edge
- **THEN** the bounce angle SHALL equal `paddle.max_angle_deg`

### Requirement: Walls

The ball SHALL never pass through the left, right or top wall, even at `ball.max_speed`.

> 中文：球不管多快都不會穿牆。

#### Scenario: No tunneling at max speed

- **WHEN** the ball moves at `ball.max_speed` for 10 seconds with the paddle following it
- **THEN** the ball center SHALL stay inside the board on every physics step and no life SHALL be lost

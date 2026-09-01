const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const CELL = 30;
const COLS = 20;
const ROWS = 20;
const STEP_MS = 120; // ms entre movimientos de la serpiente (velocidad fija)
const INITIAL_LENGTH = 3;

const FRUIT_NAMES = Object.keys(window.SPRITE_ATLAS.fruits);

const DIR_KEYS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

let snake = [];
let direction = { x: 1, y: 0 };
let pendingDirection = { x: 1, y: 0 };
let fruit = null;
let score = 0;
let gameState = "playing"; // 'playing' | 'paused' | 'gameover'
let tickAccumulator = 0;

function initGame() {
  const startX = Math.floor(COLS / 2);
  const startY = Math.floor(ROWS / 2);
  snake = [];
  for (let i = 0; i < INITIAL_LENGTH; i++) {
    snake.push({ x: startX - i, y: startY });
  }
  direction = { x: 1, y: 0 };
  pendingDirection = { x: 1, y: 0 };
  score = 0;
  gameState = "playing";
  tickAccumulator = 0;
  spawnFruit();
}

function spawnFruit() {
  let cell;
  do {
    cell = {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS),
    };
  } while (snake.some((s) => s.x === cell.x && s.y === cell.y));
  const type = FRUIT_NAMES[Math.floor(Math.random() * FRUIT_NAMES.length)];
  fruit = { x: cell.x, y: cell.y, type };
}

function moveSnake() {
  direction = pendingDirection;
  const head = snake[0];
  const newHead = { x: head.x + direction.x, y: head.y + direction.y };

  if (
    newHead.x < 0 ||
    newHead.x >= COLS ||
    newHead.y < 0 ||
    newHead.y >= ROWS
  ) {
    gameState = "gameover";
    return;
  }
  if (snake.some((s) => s.x === newHead.x && s.y === newHead.y)) {
    gameState = "gameover";
    return;
  }

  snake.unshift(newHead);

  if (fruit && newHead.x === fruit.x && newHead.y === fruit.y) {
    score += 10;
    spawnFruit();
  } else {
    snake.pop();
  }
}

document.addEventListener("keydown", (e) => {
  const nd = DIR_KEYS[e.key];
  if (nd) {
    // evita revertir 180° sobre sí misma
    if (snake.length > 1 && nd.x === -direction.x && nd.y === -direction.y)
      return;
    pendingDirection = nd;
    return;
  }
  if ((e.key === "p" || e.key === "P") && gameState !== "gameover") {
    gameState = gameState === "paused" ? "playing" : "paused";
  }
  if ((e.key === "Enter" || e.key === " ") && gameState === "gameover") {
    initGame();
  }
});

function update(dt) {
  if (gameState !== "playing") return;

  tickAccumulator += dt * 1000;
  while (tickAccumulator >= STEP_MS) {
    tickAccumulator -= STEP_MS;
    moveSnake();
    if (gameState !== "playing") break;
  }
}

function drawOverlay(message) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 48px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(message, canvas.width / 2, canvas.height / 2);
}

function draw() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (fruit)
    drawSprite(ctx, fruit.type, fruit.x * CELL, fruit.y * CELL, CELL, CELL);

  snake.forEach((seg, i) => {
    ctx.fillStyle = i === 0 ? "#7CFC00" : "#2ecc40";
    ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
  });

  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Score: " + score, 10, 10);

  if (gameState === "paused") drawOverlay("PAUSA");
  if (gameState === "gameover") {
    drawOverlay("GAME OVER");
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(
      "Presiona ENTER para reiniciar",
      canvas.width / 2,
      canvas.height / 2 + 40,
    );
  }
}

let lastTime = null;

function loop(timestamp) {
  if (lastTime === null) lastTime = timestamp;
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

loadSpritesheet(() => {
  initGame();
  requestAnimationFrame(loop);
});

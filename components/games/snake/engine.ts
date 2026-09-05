// Motor de Snake — portado de
// references/resources/started-games/05-snake/game.js (+ assets/sprites.js).
// Lógica pura sin document.getElementById: el fin de partida sale por
// callback (`onGameOver`) para que el wrapper React lo consuma. El HUD
// original ya es on-canvas (dibujado en draw()), así que no requiere
// callback de HUD como Tetris.

import {
  loadSpritesheet,
  drawSprite,
  drawFruitPrimitive,
  FRUIT_NAMES,
  type FruitName,
} from "./sprites";
import {
  getSkin,
  DEFAULT_SKIN,
  type Skin,
  type SkinId,
} from "@/components/games/skins";

export type EngineCallbacks = {
  onGameOver: (score: number) => void;
  /** Skin inicial. Si falta, `clasico` (aspecto original del juego). */
  skin?: SkinId;
};

export type EngineHandle = {
  restart: () => void;
  destroy: () => void;
  /** Cambia la skin en caliente, sin reiniciar la partida en curso. */
  setSkin: (id: SkinId) => void;
};

const W = 600;
const H = 600;
const CELL = 30;
const COLS = 20;
const ROWS = 20;
const STEP_MS = 120; // ms entre movimientos de la serpiente (velocidad fija)
const INITIAL_LENGTH = 3;

type Segment = { x: number; y: number };
type Vec = { x: number; y: number };
type Fruit = { x: number; y: number; type: FruitName };

// Normalizado a e.code (el original usa e.key); para las flechas el nombre
// no cambia, así que el mapa sirve igual.
const DIR_CODES: Record<string, Vec> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

export function createGame(
  canvas: HTMLCanvasElement,
  cb: EngineCallbacks,
): EngineHandle {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) {
    throw new Error("No se pudo obtener el contexto 2D del canvas");
  }
  const ctx: CanvasRenderingContext2D = ctx2d;

  // Estado del juego — vive en el closure de esta llamada a createGame,
  // nunca en scope global ni en variables de módulo compartidas.
  let snake: Segment[] = [];
  let direction: Vec = { x: 1, y: 0 };
  let pendingDirection: Vec = { x: 1, y: 0 };
  let fruit: Fruit | null = null;
  let score = 0;
  let gameState: "playing" | "paused" | "gameover" = "playing";
  let tickAccumulator = 0;
  let destroyed = false;
  let rafId = 0;
  let lastTime: number | null = null;

  // La skin es puro color: vive fuera del estado de partida, así que cambiarla
  // no toca la serpiente, la fruta, la velocidad ni la puntuación.
  let skin: Skin = getSkin(cb.skin ?? DEFAULT_SKIN, "vibora");

  function spawnFruit() {
    let cell: Segment;
    do {
      cell = {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS),
      };
    } while (snake.some((s) => s.x === cell.x && s.y === cell.y));
    const type = FRUIT_NAMES[Math.floor(Math.random() * FRUIT_NAMES.length)];
    fruit = { x: cell.x, y: cell.y, type };
  }

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
    lastTime = null;
    spawnFruit();
  }

  function moveSnake() {
    direction = pendingDirection;
    const head = snake[0];
    const newHead: Segment = {
      x: head.x + direction.x,
      y: head.y + direction.y,
    };

    if (
      newHead.x < 0 ||
      newHead.x >= COLS ||
      newHead.y < 0 ||
      newHead.y >= ROWS
    ) {
      gameState = "gameover";
      cb.onGameOver(score);
      return;
    }
    if (snake.some((s) => s.x === newHead.x && s.y === newHead.y)) {
      gameState = "gameover";
      cb.onGameOver(score);
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

  // ── Input ──────────────────────────────────────────────────────────────
  // Normalizado a e.code. Sin mapa de teclas mantenidas: es un giro
  // discreto por tecla, no movimiento continuo. Restart queda expuesto
  // solo vía EngineHandle.restart() (botón del modal de React), no por
  // teclado — ver Decisiones en la spec.
  function onKeyDown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement) return;

    const nd = DIR_CODES[e.code];
    if (nd) {
      // evita revertir 180° sobre sí misma
      if (snake.length > 1 && nd.x === -direction.x && nd.y === -direction.y) {
        return;
      }
      pendingDirection = nd;
      return;
    }
    if (e.code === "KeyP" && gameState !== "gameover") {
      gameState = gameState === "paused" ? "playing" : "paused";
    }
  }
  window.addEventListener("keydown", onKeyDown);

  function update(dt: number) {
    if (gameState !== "playing") return;

    tickAccumulator += dt * 1000;
    while (tickAccumulator >= STEP_MS) {
      tickAccumulator -= STEP_MS;
      moveSnake();
      if (gameState !== "playing") break;
    }
  }

  function drawOverlay(message: string) {
    ctx.fillStyle = skin.overlay;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = skin.fg;
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, W / 2, H / 2);
  }

  function draw() {
    ctx.fillStyle = skin.bg;
    ctx.fillRect(0, 0, W, H);

    if (fruit) {
      // El sprite fotorrealista solo encaja en la skin clásica; las otras dos
      // dibujan la fruta con primitivas (misma celda, mismo tamaño, misma
      // hitbox — el cambio es únicamente de píxeles).
      if (skin.id === "clasico") {
        drawSprite(ctx, fruit.type, fruit.x * CELL, fruit.y * CELL, CELL, CELL);
      } else {
        drawFruitPrimitive(
          ctx,
          fruit.type,
          fruit.x * CELL,
          fruit.y * CELL,
          CELL,
          CELL,
          skin.entities,
          skin.fg,
        );
      }
    }

    snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? skin.accent : skin.accent2;
      ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
    });

    ctx.fillStyle = skin.fg;
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Score: " + score, 10, 10);

    if (gameState === "paused") drawOverlay("PAUSA");
    if (gameState === "gameover") drawOverlay("GAME OVER");
  }

  function loop(ts: number) {
    // Clamp de dt a 50ms (el original no lo tiene) — evita "spiral of
    // death" en cambios de pestaña, igual que Asteroids/Tetris/Arkanoid.
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function startAfterLoad() {
    if (destroyed) return; // destroy() llegó antes de que cargara la imagen
    initGame();
    rafId = requestAnimationFrame(loop);
  }

  loadSpritesheet(startAfterLoad);

  return {
    restart: () => {
      initGame();
    },
    setSkin: (id: SkinId) => {
      skin = getSkin(id, "vibora");
    },
    destroy: () => {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}

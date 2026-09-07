// Motor de Frogger — construido desde cero (no hay assets originales que
// portar). Lógica pura sin document.getElementById: el fin de partida sale
// por callback (`onGameOver`) para que el wrapper React lo consuma. El HUD
// es on-canvas (dibujado en draw()), así que no requiere callback de HUD
// como Tetris; la pausa también vive dentro del engine (tecla P), igual
// que en snake/engine.ts.

export type EngineCallbacks = {
  onGameOver: (score: number) => void;
};

export type EngineHandle = {
  restart: () => void;
  destroy: () => void;
};

// ── Grid y zonas ───────────────────────────────────────────────────────────
const COLS = 16;
const ROWS = 14;
const CELL = 40; // px
const CANVAS_W = COLS * CELL; // 640
const CANVAS_H = ROWS * CELL; // 560

// Zonas (índice de fila, 0 = arriba)
const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START = 13;

const JUMP_MS = 120; // duración de la animación de salto
const ROUND_TIME_S = 15; // temporizador inicial de ronda
const GOAL_COUNT = 5; // bocas destino en la fila superior

// ── Tipos locales ────────────────────────────────────────────────────────
type Direction = "up" | "down" | "left" | "right";

interface Lane {
  row: number;
  speed: number; // px/frame @ referencia 16ms, escalado por dt
  dir: 1 | -1;
  entities: Entity[];
}

interface Entity {
  col: number; // columna fraccional (permite movimiento sub-celda)
  width: number; // en celdas
  type: "car" | "truck" | "log" | "turtle";
  submerged?: boolean;
}

interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  targetCol: number;
  targetRow: number;
}

const DIR_CODES: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
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
  let lives = 3;
  let score = 0;
  let level = 1;
  let roundTime = ROUND_TIME_S;
  let gameState: "playing" | "paused" | "gameover" = "playing";
  let lanes: Lane[] = [];
  let goalsOccupied: boolean[] = new Array(GOAL_COUNT).fill(false);
  let frog: Frog = makeStartFrog();
  let pendingDir: Direction | null = null;
  let maxRowReached = ROW_START;

  let rafId = 0;
  let lastTime: number | null = null;

  function makeStartFrog(): Frog {
    const startCol = Math.floor(COLS / 2);
    return {
      col: startCol,
      row: ROW_START,
      animating: false,
      animT: 0,
      targetCol: startCol,
      targetRow: ROW_START,
    };
  }

  function initGame() {
    lives = 3;
    score = 0;
    level = 1;
    roundTime = ROUND_TIME_S;
    gameState = "playing";
    goalsOccupied = new Array(GOAL_COUNT).fill(false);
    frog = makeStartFrog();
    pendingDir = null;
    maxRowReached = ROW_START;
    lanes = buildLanes(level);
    lastTime = null;
  }

  // Placeholder — se implementa en el Paso 3 (construir el mapa de carriles).
  function buildLanes(_level: number): Lane[] {
    return [];
  }

  // ── Input ──────────────────────────────────────────────────────────────
  // Normalizado a e.code. Restart queda expuesto solo vía EngineHandle.restart()
  // (botón del modal de React), no por teclado.
  function onKeyDown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement) return;

    const dir = DIR_CODES[e.code];
    if (dir) {
      pendingDir = dir;
      return;
    }
    if (e.code === "KeyP" && gameState !== "gameover") {
      gameState = gameState === "paused" ? "playing" : "paused";
    }
  }
  window.addEventListener("keydown", onKeyDown);

  // Placeholder — se implementa en el Paso 4 (game loop principal).
  function update(_dt: number) {
    if (gameState !== "playing") return;
  }

  // Placeholder — se implementa en el Paso 4 (dibujo + HUD interno).
  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  function loop(ts: number) {
    // Clamp de dt a 50ms — evita "spiral of death" en cambios de pestaña,
    // igual que Asteroids/Tetris/Arkanoid/Snake.
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  initGame();
  rafId = requestAnimationFrame(loop);

  return {
    restart: () => {
      initGame();
    },
    destroy: () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}

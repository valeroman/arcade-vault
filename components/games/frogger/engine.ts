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

// Ciclo de inmersión de las tortugas: visible → bajo el agua → visible…
const RIVER_VISIBLE_MS = 3000;
const RIVER_SUBMERGE_MS = 1500;
const RIVER_CYCLE_MS = RIVER_VISIBLE_MS + RIVER_SUBMERGE_MS;

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
  /** Solo tortugas: visible cuando false. */
  submerged?: boolean;
  /** Solo tortugas: ms transcurridos en la fase actual del ciclo de inmersión. */
  submergeT?: number;
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

  // ── Paso 3: mapa de carriles ─────────────────────────────────────────────
  // Coloca entidades a lo largo de una tira virtual (puede exceder [0, COLS)):
  // el Paso 4 las reintroduce por el lado opuesto al salir de pantalla, así
  // que la posición inicial exacta solo importa para dejar huecos visibles.
  function layoutEntities(
    widths: number[],
    gapRange: [number, number],
  ): { col: number; width: number }[] {
    const out: { col: number; width: number }[] = [];
    let col = Math.random() * COLS;
    for (const width of widths) {
      out.push({ col, width });
      const gap = gapRange[0] + Math.random() * (gapRange[1] - gapRange[0]);
      col += width + gap;
    }
    return out;
  }

  function buildRoadLane(row: number, dir: 1 | -1, speed: number): Lane {
    // 3–4 vehículos por carril; huecos de 2–4 celdas: siempre atravesable.
    const count = 3 + Math.floor(Math.random() * 2);
    const widths = Array.from({ length: count }, () =>
      Math.random() < 0.35 ? 2 + Math.floor(Math.random() * 2) : 1,
    );
    const placed = layoutEntities(widths, [2, 4]);
    const entities: Entity[] = placed.map((p, i) => ({
      col: p.col,
      width: p.width,
      type: widths[i] > 1 ? "truck" : "car",
    }));
    return { row, speed, dir, entities };
  }

  function buildLogLane(row: number, dir: 1 | -1, speed: number): Lane {
    // Troncos de 2–4 celdas, huecos de al menos 1 celda.
    const count = 3 + Math.floor(Math.random() * 2);
    const widths = Array.from(
      { length: count },
      () => 2 + Math.floor(Math.random() * 3),
    );
    const placed = layoutEntities(widths, [1, 3]);
    const entities: Entity[] = placed.map((p) => ({
      col: p.col,
      width: p.width,
      type: "log",
    }));
    return { row, speed, dir, entities };
  }

  function buildTurtleLane(row: number, dir: 1 | -1, speed: number): Lane {
    // Grupos de 2–3 tortugas, huecos de al menos 1 celda; cada grupo arranca
    // en un punto distinto de su ciclo de inmersión para que no se sincronicen.
    const count = 3 + Math.floor(Math.random() * 2);
    const widths = Array.from(
      { length: count },
      () => 2 + Math.floor(Math.random() * 2),
    );
    const placed = layoutEntities(widths, [1, 3]);
    const entities: Entity[] = placed.map((p) => ({
      col: p.col,
      width: p.width,
      type: "turtle",
      submerged: false,
      submergeT: Math.random() * RIVER_CYCLE_MS,
    }));
    return { row, speed, dir, entities };
  }

  function buildLanes(level: number): Lane[] {
    const speedScale = Math.pow(1.15, level - 1);
    const result: Lane[] = [];

    // Carretera: filas ROW_ROAD_TOP..ROW_ROAD_BOT (5 carriles), sentidos
    // alternos, velocidad 1.5–4 px/frame escalada por nivel.
    const roadRows: number[] = [];
    for (let r = ROW_ROAD_TOP; r <= ROW_ROAD_BOT; r++) roadRows.push(r);
    roadRows.forEach((row, i) => {
      const dir: 1 | -1 = i % 2 === 0 ? 1 : -1;
      const t = roadRows.length > 1 ? i / (roadRows.length - 1) : 0;
      const baseSpeed = 1.5 + t * (4 - 1.5);
      result.push(buildRoadLane(row, dir, baseSpeed * speedScale));
    });

    // Río: filas ROW_RIVER_TOP..ROW_RIVER_BOT (6 carriles), alternando
    // troncos y tortugas, velocidad 1–3 px/frame escalada por nivel.
    const riverRows: number[] = [];
    for (let r = ROW_RIVER_TOP; r <= ROW_RIVER_BOT; r++) riverRows.push(r);
    riverRows.forEach((row, i) => {
      const dir: 1 | -1 = i % 2 === 0 ? -1 : 1;
      const t = riverRows.length > 1 ? i / (riverRows.length - 1) : 0;
      const baseSpeed = (1 + t * (3 - 1)) * speedScale;
      result.push(
        i % 2 === 1
          ? buildTurtleLane(row, dir, baseSpeed)
          : buildLogLane(row, dir, baseSpeed),
      );
    });

    return result;
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

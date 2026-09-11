// Motor de Frogger — construido desde cero (no hay assets originales que
// portar). Lógica pura sin document.getElementById: el fin de partida sale
// por callback (`onGameOver`) para que el wrapper React lo consuma. El HUD
// es on-canvas (dibujado en draw()), así que no requiere callback de HUD
// como Tetris; la pausa también vive dentro del engine (tecla P), igual
// que en snake/engine.ts.
//
// Todo el color sale de la skin activa (components/games/skins.ts): el engine
// no tiene literales de color. La skin se puede cambiar en caliente
// (`setSkin`) sin tocar el estado de la partida.

import {
  DEFAULT_SKIN,
  getSkin,
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

// Índices de `Skin.entities` para la skin `rana` (ver components/games/skins.ts).
// Frogger no tiene una paleta rotatoria como Tetris: usa `entities` como una
// lista ordenada y con significado fijo, igual que Arkanoid con sus bloques.
const E_ROAD = 0;
const E_RIVER = 1;
const E_SAFE_MID = 2;
const E_GOALS_BAND = 3;
const E_GOAL_FILL = 4;
/** Coches: 3 colores contiguos, rotados por `row % 3`. */
const E_CAR = 5;
const E_TRUCK_BODY = 8;
const E_TRUCK_CAB = 9;
const E_LOG_BODY = 10;
const E_LOG_GRAIN = 11;
const E_TURTLE_SHELL = 12;
const E_TURTLE_EDGE = 13;
const E_TURTLE_SUBMERGED = 14;
const E_TIME_OK = 15;
const E_TIME_WARN = 16;
const E_TIME_LOW = 17;
/** Detalle oscuro: ruedas de los coches y pupilas de la rana. */
const E_DARK = 18;

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
// Columna inicial de cada boca (ancho 2 celdas), con huecos-barrera de 1
// celda entre ellas: 1+2+1+2+1+2+1+2+1+2+1 = 16 columnas.
const GOAL_COLS = [1, 4, 7, 10, 13];

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

// ── Prerender por skin ─────────────────────────────────────────────────────
// Frogger no carga assets (todo es procedural), pero su dibujo sí tenía mucho
// contenido invariante repetido en cada frame: las bandas del tablero, los
// marcos de las bocas destino y, sobre todo, las vetas de los troncos (hasta
// 16 `stroke()` por tronco y frame, ~126 por frame en total).
//
// Todo eso se pinta una sola vez sobre canvas offscreen cacheados a nivel de
// **módulo** con clave `skin.id` — el mismo patrón que `arkanoid/sprites.ts`.
// Se cachea a nivel de módulo porque es un asset derivado de la skin, no
// estado de partida: el estado sigue viviendo en el closure de `createGame`.
//
// Nota sobre `LINE`: las vetas del tronco y el contorno del caparazón nunca
// fijaban `lineWidth` y heredaban el del draw anterior (2 de los marcos de las
// bocas en régimen estable, 3 durante un salto — de ahí el parpadeo). Se fija
// explícitamente en 2, que es el grosor visible en régimen estable.
const LINE = 2;
const GOAL_MARK_W = 32;
const GOAL_MARK_H = 24;
const PIP = 16;

type SpriteSet = {
  /** Bandas del tablero + marcos de las bocas destino (estático completo). */
  chrome: HTMLCanvasElement;
  frog: HTMLCanvasElement;
  goalMark: HTMLCanvasElement;
  lifePip: HTMLCanvasElement;
  /** Coches: un sprite por color rotado (`row % 3`). */
  cars: HTMLCanvasElement[];
  trucks: Map<number, HTMLCanvasElement>;
  logs: Map<number, HTMLCanvasElement>;
  turtles: Map<number, HTMLCanvasElement>;
  turtlesSub: Map<number, HTMLCanvasElement>;
};

const spriteCache = new Map<SkinId, SpriteSet>();

function layer(w: number, h: number): CanvasRenderingContext2D {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const lctx = c.getContext("2d");
  if (!lctx) throw new Error("No se pudo prerenderizar los sprites de Frogger");
  return lctx;
}

function buildChrome(skin: Skin): HTMLCanvasElement {
  const c = layer(CANVAS_W, CANVAS_H);
  c.fillStyle = skin.bg; // zonas seguras (base del canvas)
  c.fillRect(0, 0, CANVAS_W, CANVAS_H);

  c.fillStyle = skin.entities[E_ROAD]; // carretera
  c.fillRect(
    0,
    ROW_ROAD_TOP * CELL,
    CANVAS_W,
    (ROW_ROAD_BOT - ROW_ROAD_TOP + 1) * CELL,
  );

  c.fillStyle = skin.entities[E_RIVER]; // río
  c.fillRect(
    0,
    ROW_RIVER_TOP * CELL,
    CANVAS_W,
    (ROW_RIVER_BOT - ROW_RIVER_TOP + 1) * CELL,
  );

  c.fillStyle = skin.entities[E_SAFE_MID]; // franja media segura (fila 7)
  c.fillRect(0, ROW_SAFE_MID * CELL, CANVAS_W, CELL);

  c.fillStyle = skin.entities[E_GOALS_BAND]; // banda de las bocas destino
  c.fillRect(0, ROW_GOALS * CELL, CANVAS_W, CELL);

  // Marcos vacíos de las bocas. Lo único dinámico de la fila (la rana ya
  // colocada) se pinta encima en cada frame, en drawGoalMarks().
  c.lineWidth = LINE;
  const y = ROW_GOALS * CELL;
  const w = 2 * CELL;
  for (let i = 0; i < GOAL_COUNT; i++) {
    const x = GOAL_COLS[i] * CELL;
    c.fillStyle = skin.entities[E_GOAL_FILL];
    c.fillRect(x + 2, y + 2, w - 4, CELL - 4);
    c.strokeStyle = skin.grid;
    c.strokeRect(x + 2, y + 2, w - 4, CELL - 4);
  }
  return c.canvas;
}

function buildCar(skin: Skin, colorIndex: number): HTMLCanvasElement {
  const c = layer(CELL, CELL); // los coches siempre miden 1 celda
  c.fillStyle = skin.entities[E_CAR + colorIndex];
  c.fillRect(2, 8, CELL - 4, CELL - 16);
  c.fillStyle = skin.entities[E_DARK];
  c.beginPath();
  c.arc(8, CELL - 8, 5, 0, Math.PI * 2);
  c.arc(CELL - 8, CELL - 8, 5, 0, Math.PI * 2);
  c.fill();
  return c.canvas;
}

function buildTruck(skin: Skin, width: number): HTMLCanvasElement {
  const w = width * CELL;
  const c = layer(w, CELL);
  c.fillStyle = skin.entities[E_TRUCK_BODY];
  c.fillRect(2, 6, w - 4, CELL - 12);
  c.fillStyle = skin.entities[E_TRUCK_CAB];
  c.fillRect(2, 6, Math.min(CELL - 8, w - 4), CELL - 12);
  return c.canvas;
}

function buildLog(skin: Skin, width: number): HTMLCanvasElement {
  const w = width * CELL;
  const c = layer(w, CELL);
  c.fillStyle = skin.entities[E_LOG_BODY];
  c.fillRect(0, 6, w, CELL - 12);
  c.strokeStyle = skin.entities[E_LOG_GRAIN];
  c.lineWidth = LINE;
  for (let lx = 6; lx < w; lx += 10) {
    c.beginPath();
    c.moveTo(lx, 6);
    c.lineTo(lx, CELL - 6);
    c.stroke();
  }
  return c.canvas;
}

function buildTurtle(skin: Skin, width: number): HTMLCanvasElement {
  const c = layer(width * CELL, CELL);
  c.fillStyle = skin.entities[E_TURTLE_SHELL];
  c.strokeStyle = skin.entities[E_TURTLE_EDGE];
  c.lineWidth = LINE;
  for (let i = 0; i < width; i++) {
    c.beginPath();
    c.arc(i * CELL + CELL / 2, CELL / 2, CELL / 2 - 6, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
  return c.canvas;
}

function buildTurtleSub(skin: Skin, width: number): HTMLCanvasElement {
  const w = width * CELL;
  const c = layer(w, CELL);
  c.strokeStyle = skin.entities[E_TURTLE_SUBMERGED];
  c.lineWidth = LINE;
  c.strokeRect(4, 8, w - 8, CELL - 16);
  return c.canvas;
}

function buildFrog(skin: Skin): HTMLCanvasElement {
  const c = layer(CELL, CELL);
  const cx = CELL / 2;
  const cy = CELL / 2;
  c.fillStyle = skin.accent;
  c.beginPath();
  c.ellipse(cx, cy, 14, 12, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = skin.fg; // ojos
  c.beginPath();
  c.arc(cx - 5, cy - 6, 3, 0, Math.PI * 2);
  c.arc(cx + 5, cy - 6, 3, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = skin.entities[E_DARK]; // pupilas
  c.beginPath();
  c.arc(cx - 5, cy - 6, 1.5, 0, Math.PI * 2);
  c.arc(cx + 5, cy - 6, 1.5, 0, Math.PI * 2);
  c.fill();
  return c.canvas;
}

function buildGoalMark(skin: Skin): HTMLCanvasElement {
  const c = layer(GOAL_MARK_W, GOAL_MARK_H);
  c.fillStyle = skin.accent;
  c.beginPath();
  c.ellipse(GOAL_MARK_W / 2, GOAL_MARK_H / 2, 12, 9, 0, 0, Math.PI * 2);
  c.fill();
  return c.canvas;
}

function buildLifePip(skin: Skin): HTMLCanvasElement {
  const c = layer(PIP, PIP);
  c.fillStyle = skin.accent;
  c.beginPath();
  c.arc(PIP / 2, PIP / 2, 7, 0, Math.PI * 2);
  c.fill();
  return c.canvas;
}

function getSprites(skin: Skin): SpriteSet {
  const cached = spriteCache.get(skin.id);
  if (cached) return cached;
  const set: SpriteSet = {
    chrome: buildChrome(skin),
    frog: buildFrog(skin),
    goalMark: buildGoalMark(skin),
    lifePip: buildLifePip(skin),
    cars: [buildCar(skin, 0), buildCar(skin, 1), buildCar(skin, 2)],
    trucks: new Map(),
    logs: new Map(),
    turtles: new Map(),
    turtlesSub: new Map(),
  };
  spriteCache.set(skin.id, set);
  return set;
}

/**
 * Sprite por ancho, construido la primera vez que ese ancho aparece.
 *
 * `build` se recibe como función de módulo (no como arrow inline en el sitio de
 * llamada) y la skin va por parámetro: una arrow literal en `drawEntity()` se
 * asignaría de nuevo en cada entidad y en cada frame (~38 closures/frame), que
 * es justo lo que la puerta G3 prohíbe.
 */
function byWidth(
  cache: Map<number, HTMLCanvasElement>,
  width: number,
  skin: Skin,
  build: (skin: Skin, w: number) => HTMLCanvasElement,
): HTMLCanvasElement {
  let img = cache.get(width);
  if (!img) {
    img = build(skin, width);
    cache.set(width, img);
  }
  return img;
}

export function createGame(
  canvas: HTMLCanvasElement,
  cb: EngineCallbacks,
): EngineHandle {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) {
    throw new Error("No se pudo obtener el contexto 2D del canvas");
  }
  const ctx: CanvasRenderingContext2D = ctx2d;

  // La skin es puro color: vive fuera del estado de partida, así que cambiarla
  // en caliente no toca ni la puntuación ni la posición de nada.
  let skin: Skin = getSkin(cb.skin ?? DEFAULT_SKIN, "rana");
  let sprites: SpriteSet = getSprites(skin);

  // Todos los blits son 1:1 y a coordenadas enteras, así que el filtrado
  // bilineal nunca aporta nada aquí: solo cuesta.
  ctx.imageSmoothingEnabled = false;

  // Estado del juego — vive en el closure de esta llamada a createGame,
  // nunca en scope global ni en variables de módulo compartidas.
  let lives = 3;
  let score = 0;
  let level = 1;
  let roundTime = ROUND_TIME_S;
  let gameState: "playing" | "paused" | "gameover" = "playing";
  let lanes: Lane[] = [];
  /**
   * Índice fila → carril, reconstruido solo al generar los carriles. Evita los
   * 3 `Array.find()` con closure que se ejecutaban en cada frame para resolver
   * el carril de la rana (colisión, soporte y arrastre del tronco).
   */
  const lanesByRow: (Lane | null)[] = new Array(ROWS).fill(null);
  let goalsOccupied: boolean[] = new Array(GOAL_COUNT).fill(false);
  let frog: Frog = makeStartFrog();
  let pendingDir: Direction | null = null;
  let maxRowReached = ROW_START;

  let rafId = 0;
  let lastTime: number | null = null;
  let destroyed = false;

  // Caché de los strings del HUD: se regeneran solo cuando su valor cambia,
  // en vez de concatenar dos strings nuevos en cada frame.
  let scoreText = "";
  let scoreShown = Number.NaN;
  let levelText = "";
  let levelShown = Number.NaN;

  // Objeto de scratch reutilizado por frogRenderPos(): antes devolvía un
  // literal nuevo por frame.
  const renderPos = { x: 0, y: 0, jumping: false };

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
    roundTime = roundTimeForLevel(level);
    gameState = "playing";
    goalsOccupied = new Array(GOAL_COUNT).fill(false);
    frog = makeStartFrog();
    pendingDir = null;
    maxRowReached = ROW_START;
    lanes = buildLanes(level);
    indexLanes();
    lastTime = null;
  }

  /** Refresca `lanesByRow` tras (re)generar los carriles. */
  function indexLanes() {
    for (let r = 0; r < ROWS; r++) lanesByRow[r] = null;
    for (let i = 0; i < lanes.length; i++) lanesByRow[lanes[i].row] = lanes[i];
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
    // Guard de foco: cubre los tres tipos editables/enfocables para que
    // escribir el nombre en el modal (o usar cualquier control de formulario)
    // no maneje la rana.
    const t = e.target;
    if (
      t instanceof HTMLInputElement ||
      t instanceof HTMLSelectElement ||
      t instanceof HTMLTextAreaElement
    ) {
      return;
    }

    const dir = DIR_CODES[e.code];
    if (dir) {
      e.preventDefault(); // sin esto las flechas hacen scroll de la página
      pendingDir = dir;
      return;
    }
    if (e.code === "KeyP" && gameState !== "gameover") {
      e.preventDefault();
      gameState = gameState === "paused" ? "playing" : "paused";
      // Al pausar, el frame en curso pinta el overlay y el loop se detiene
      // solo; al reanudar hay que volver a arrancarlo.
      if (gameState === "playing") scheduleFrame();
    }
  }
  window.addEventListener("keydown", onKeyDown);

  // ── Paso 6: temporizador de ronda por nivel ──────────────────────────────
  function roundTimeForLevel(lvl: number): number {
    return Math.max(6, ROUND_TIME_S - (lvl - 1));
  }

  function isRoadRow(row: number): boolean {
    return row >= ROW_ROAD_TOP && row <= ROW_ROAD_BOT;
  }
  function isRiverRow(row: number): boolean {
    return row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT;
  }

  // ── Paso 5: colisiones y soporte ─────────────────────────────────────────
  // Bucles `for` con índice en vez de find/some: estas dos funciones corren en
  // cada frame mientras la rana no está saltando.
  function checkRoadCollision(f: Frog): boolean {
    const lane = lanesByRow[f.row];
    if (!lane) return false;
    const list = lane.entities;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (f.col >= e.col && f.col < e.col + e.width) return true;
    }
    return false;
  }

  function getSupport(f: Frog): Entity | null {
    const lane = lanesByRow[f.row];
    if (!lane) return null;
    const list = lane.entities;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (f.col >= e.col && f.col < e.col + e.width) {
        // Primer match, igual que el find() original: una tortuga sumergida
        // no sostiene aunque otra entidad también cubra la columna.
        return e.type === "turtle" && e.submerged ? null : e;
      }
    }
    return null;
  }

  function goalIndexForCol(col: number): number {
    const c = Math.round(col);
    return GOAL_COLS.findIndex((start) => c >= start && c < start + 2);
  }

  function checkGoal(
    f: Frog,
    occupied: boolean[],
  ): { ok: boolean; index: number } {
    const idx = goalIndexForCol(f.col);
    if (idx === -1 || occupied[idx]) return { ok: false, index: idx };
    occupied[idx] = true;
    return { ok: true, index: idx };
  }

  // ── Paso 7: gestión de muerte ────────────────────────────────────────────
  function killFrog() {
    lives -= 1;
    if (lives <= 0) {
      lives = 0;
      gameState = "gameover";
      cb.onGameOver(score);
      return;
    }
    frog = makeStartFrog();
    roundTime = roundTimeForLevel(level);
  }

  // ── Paso 6: gestión de ronda completada ──────────────────────────────────
  function completeRound() {
    frog = makeStartFrog();
    goalsOccupied = new Array(GOAL_COUNT).fill(false);
    maxRowReached = ROW_START;
    level += 1;
    lanes = buildLanes(level);
    indexLanes();
    roundTime = roundTimeForLevel(level);
    score += 200;
  }

  // Se ejecuta justo al completar un salto (col/row ya actualizados al destino).
  function onLanded() {
    // +10 por celda avanzada hacia arriba por primera vez en la ronda
    // (fila menor = más arriba; maxRowReached guarda la fila más alta ya
    // alcanzada esta ronda).
    if (frog.row < maxRowReached) {
      score += 10 * (maxRowReached - frog.row);
      maxRowReached = frog.row;
    }

    if (isRoadRow(frog.row)) {
      if (checkRoadCollision(frog)) {
        killFrog();
      }
      return;
    }
    if (isRiverRow(frog.row)) {
      if (!getSupport(frog)) {
        killFrog();
      }
      return;
    }
    if (frog.row === ROW_GOALS) {
      const result = checkGoal(frog, goalsOccupied);
      if (!result.ok) {
        killFrog();
        return;
      }
      score += 50 + Math.round(roundTime) * 10;
      if (goalsOccupied.every(Boolean)) {
        completeRound();
      }
    }
  }

  function applyDirection(
    f: Frog,
    dir: Direction,
  ): { col: number; row: number } | null {
    let col = f.col;
    let row = f.row;
    if (dir === "up") row -= 1;
    else if (dir === "down") row += 1;
    else if (dir === "left") col -= 1;
    else if (dir === "right") col += 1;
    if (col < 0 || col >= COLS) return null; // no cruzar bordes laterales
    if (row < 0 || row > ROW_START) return null; // no salir del mapa vertical
    return { col, row };
  }

  function tryStartJump(dir: Direction) {
    const next = applyDirection(frog, dir);
    if (!next) return;
    frog.animating = true;
    frog.animT = 0;
    frog.targetCol = next.col;
    frog.targetRow = next.row;
  }

  function moveLanes(dt: number) {
    // Bucles con índice, no `for...of`: el iterador de un `for...of` es un
    // objeto nuevo por array y por frame (1 + 11 carriles = 12 allocs/frame).
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      const list = lane.entities;
      const step = lane.speed * lane.dir * dt;
      for (let j = 0; j < list.length; j++) {
        const entity = list[j];
        entity.col += step;
        if (lane.dir > 0 && entity.col > COLS) {
          entity.col = -entity.width;
        } else if (lane.dir < 0 && entity.col + entity.width < 0) {
          entity.col = COLS;
        }

        if (entity.type === "turtle") {
          entity.submergeT = (entity.submergeT ?? 0) + dt * 1000;
          const phase = entity.submergeT % RIVER_CYCLE_MS;
          entity.submerged = phase >= RIVER_VISIBLE_MS;
        }
      }
    }
  }

  // ── Paso 4: game loop principal ──────────────────────────────────────────
  function update(dt: number) {
    if (gameState !== "playing") return;

    moveLanes(dt);

    if (frog.animating) {
      frog.animT += dt * 1000;
      if (frog.animT >= JUMP_MS) {
        frog.animating = false;
        frog.animT = 0;
        frog.col = frog.targetCol;
        frog.row = frog.targetRow;
        onLanded();
        if (gameState !== "playing") return;
      }
    } else {
      if (pendingDir) {
        tryStartJump(pendingDir);
        pendingDir = null;
      }
      // Colisión/soporte continuos entre saltos (un coche o el agua pueden
      // alcanzar a la rana aunque ella no se mueva).
      if (isRoadRow(frog.row) && checkRoadCollision(frog)) {
        killFrog();
        return;
      }
      if (isRiverRow(frog.row)) {
        const lane = lanesByRow[frog.row];
        const support = getSupport(frog);
        if (!support || !lane) {
          killFrog();
          return;
        }
        frog.col += lane.speed * lane.dir * dt;
        if (frog.col < 0 || frog.col > COLS - 1) {
          killFrog();
          return;
        }
      }
    }

    roundTime -= dt;
    if (roundTime <= 0) {
      killFrog();
    }
  }

  /** Escribe en el scratch `renderPos` y lo devuelve; nunca asigna memoria. */
  function frogRenderPos() {
    if (!frog.animating) {
      renderPos.x = frog.col;
      renderPos.y = frog.row;
      renderPos.jumping = false;
      return renderPos;
    }
    const t = Math.min(frog.animT / JUMP_MS, 1);
    renderPos.x = frog.col + (frog.targetCol - frog.col) * t;
    renderPos.y = frog.row + (frog.targetRow - frog.row) * t;
    renderPos.jumping = true;
    return renderPos;
  }

  // Un solo blit por entidad, a coordenadas enteras (antes: hasta 19 ops y
  // coordenadas fraccionales que forzaban antialiasing en cada tronco).
  function drawEntity(lane: Lane, e: Entity) {
    const x = Math.round(e.col * CELL);
    const y = lane.row * CELL;
    let img: HTMLCanvasElement;
    if (e.type === "car") {
      img = sprites.cars[lane.row % 3];
    } else if (e.type === "truck") {
      img = byWidth(sprites.trucks, e.width, skin, buildTruck);
    } else if (e.type === "log") {
      img = byWidth(sprites.logs, e.width, skin, buildLog);
    } else if (e.submerged) {
      img = byWidth(sprites.turtlesSub, e.width, skin, buildTurtleSub);
    } else {
      img = byWidth(sprites.turtles, e.width, skin, buildTurtle);
    }
    ctx.drawImage(img, x, y);
  }

  /** Solo la parte dinámica de las bocas: los marcos ya vienen en `chrome`. */
  function drawGoalMarks() {
    for (let i = 0; i < GOAL_COUNT; i++) {
      if (!goalsOccupied[i]) continue;
      ctx.drawImage(
        sprites.goalMark,
        GOAL_COLS[i] * CELL + CELL - GOAL_MARK_W / 2,
        ROW_GOALS * CELL + CELL / 2 - GOAL_MARK_H / 2,
      );
    }
  }

  function drawFrog() {
    const pos = frogRenderPos();
    const x = pos.x * CELL + CELL / 2;
    const y = pos.y * CELL + CELL / 2;

    if (pos.jumping) {
      // Las patas son la única geometría que no se puede prerenderizar (su
      // trazo depende del salto). save/restore para que `lineWidth` no se
      // filtre al resto del frame.
      ctx.save();
      ctx.strokeStyle = skin.accent2;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 16, y + 6);
      ctx.lineTo(x - 24, y + 16);
      ctx.moveTo(x + 16, y + 6);
      ctx.lineTo(x + 24, y + 16);
      ctx.stroke();
      ctx.restore();
    }

    ctx.drawImage(
      sprites.frog,
      Math.round(x - CELL / 2),
      Math.round(y - CELL / 2),
    );
  }

  function drawHud() {
    if (scoreShown !== score) {
      scoreShown = score;
      scoreText = "SCORE " + score;
    }
    if (levelShown !== level) {
      levelShown = level;
      levelText = "NIVEL " + level;
    }

    ctx.save();
    ctx.fillStyle = skin.fg;
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(scoreText, 8, 4);
    ctx.textAlign = "center";
    ctx.fillText(levelText, CANVAS_W / 2, 4);
    ctx.restore();

    for (let i = 0; i < lives; i++) {
      ctx.drawImage(sprites.lifePip, CANVAS_W - 22 - i * 20, 4);
    }

    const ratio = Math.max(0, roundTime / roundTimeForLevel(level));
    ctx.fillStyle =
      ratio > 0.5
        ? skin.entities[E_TIME_OK]
        : ratio > 0.25
          ? skin.entities[E_TIME_WARN]
          : skin.entities[E_TIME_LOW];
    ctx.fillRect(0, 0, Math.round(ratio * CANVAS_W), 4);
  }

  function drawOverlay(message: string) {
    ctx.save();
    ctx.fillStyle = skin.overlay;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = skin.fg;
    ctx.font = "bold 32px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, CANVAS_W / 2, CANVAS_H / 2);
    ctx.restore();
  }

  function draw() {
    ctx.drawImage(sprites.chrome, 0, 0); // opaco y a canvas completo: no hace falta clear
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      const list = lane.entities;
      for (let j = 0; j < list.length; j++) drawEntity(lane, list[j]);
    }
    drawGoalMarks();
    drawFrog();
    drawHud();
    if (gameState === "paused") drawOverlay("PAUSA");
    else if (gameState === "gameover") drawOverlay("GAME OVER");
  }

  /**
   * Reanuda el loop con guard cancel-then-request (patrón de
   * `tetris/engine.ts:380-381`) para que nunca corran dos rAF en paralelo.
   */
  function scheduleFrame() {
    if (destroyed) return;
    if (rafId) cancelAnimationFrame(rafId);
    lastTime = null; // el primer dt tras reanudar es 0
    rafId = requestAnimationFrame(loop);
  }

  function loop(ts: number) {
    rafId = 0;
    // Clamp de dt a 50ms — evita "spiral of death" en cambios de pestaña,
    // igual que Asteroids/Tetris/Arkanoid/Snake.
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    // El frame en que se entra en pausa o game over sí se pinta (para que el
    // overlay aparezca) y ahí se detiene el rAF: detrás del modal de React el
    // juego no consume CPU.
    if (gameState === "playing" && !destroyed) {
      rafId = requestAnimationFrame(loop);
    }
  }

  initGame();
  scheduleFrame();

  return {
    restart: () => {
      initGame();
      scheduleFrame();
    },
    setSkin: (id: SkinId) => {
      skin = getSkin(id, "rana");
      sprites = getSprites(skin);
      // Con el loop detenido (pausa / game over) hace falta un repintado
      // puntual para que el cambio de skin se vea.
      if (!rafId && !destroyed) draw();
    },
    destroy: () => {
      destroyed = true;
      cancelAnimationFrame(rafId);
      rafId = 0;
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}

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
    roundTime = roundTimeForLevel(level);
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
  function checkRoadCollision(f: Frog, allLanes: Lane[]): boolean {
    const lane = allLanes.find((l) => l.row === f.row);
    if (!lane) return false;
    return lane.entities.some((e) => f.col >= e.col && f.col < e.col + e.width);
  }

  function getSupport(f: Frog, allLanes: Lane[]): Entity | null {
    const lane = allLanes.find((l) => l.row === f.row);
    if (!lane) return null;
    const found = lane.entities.find(
      (e) => f.col >= e.col && f.col < e.col + e.width,
    );
    if (!found) return null;
    if (found.type === "turtle" && found.submerged) return null;
    return found;
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
      if (checkRoadCollision(frog, lanes)) {
        killFrog();
      }
      return;
    }
    if (isRiverRow(frog.row)) {
      if (!getSupport(frog, lanes)) {
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
    for (const lane of lanes) {
      for (const entity of lane.entities) {
        entity.col += lane.speed * lane.dir * dt;
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
      if (isRoadRow(frog.row) && checkRoadCollision(frog, lanes)) {
        killFrog();
        return;
      }
      if (isRiverRow(frog.row)) {
        const lane = lanes.find((l) => l.row === frog.row);
        const support = getSupport(frog, lanes);
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

  function frogRenderPos(): { x: number; y: number; jumping: boolean } {
    if (!frog.animating) {
      return { x: frog.col, y: frog.row, jumping: false };
    }
    const t = Math.min(frog.animT / JUMP_MS, 1);
    const x = frog.col + (frog.targetCol - frog.col) * t;
    const y = frog.row + (frog.targetRow - frog.row) * t;
    return { x, y, jumping: true };
  }

  function drawBackground() {
    ctx.fillStyle = skin.bg; // zonas seguras (base del canvas)
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = skin.entities[E_ROAD]; // carretera
    ctx.fillRect(
      0,
      ROW_ROAD_TOP * CELL,
      CANVAS_W,
      (ROW_ROAD_BOT - ROW_ROAD_TOP + 1) * CELL,
    );

    ctx.fillStyle = skin.entities[E_RIVER]; // río
    ctx.fillRect(
      0,
      ROW_RIVER_TOP * CELL,
      CANVAS_W,
      (ROW_RIVER_BOT - ROW_RIVER_TOP + 1) * CELL,
    );

    ctx.fillStyle = skin.entities[E_SAFE_MID]; // franja media segura (fila 7, entre río y carretera)
    ctx.fillRect(0, ROW_SAFE_MID * CELL, CANVAS_W, CELL);

    ctx.fillStyle = skin.entities[E_GOALS_BAND]; // bocas destino
    ctx.fillRect(0, ROW_GOALS * CELL, CANVAS_W, CELL);
  }

  function drawEntity(lane: Lane, e: Entity) {
    const x = e.col * CELL;
    const y = lane.row * CELL;
    const w = e.width * CELL;

    if (e.type === "car") {
      ctx.fillStyle = skin.entities[E_CAR + (lane.row % 3)];
      ctx.fillRect(x + 2, y + 8, w - 4, CELL - 16);
      ctx.fillStyle = skin.entities[E_DARK];
      ctx.beginPath();
      ctx.arc(x + 8, y + CELL - 8, 5, 0, Math.PI * 2);
      ctx.arc(x + w - 8, y + CELL - 8, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === "truck") {
      ctx.fillStyle = skin.entities[E_TRUCK_BODY];
      ctx.fillRect(x + 2, y + 6, w - 4, CELL - 12);
      ctx.fillStyle = skin.entities[E_TRUCK_CAB];
      ctx.fillRect(x + 2, y + 6, Math.min(CELL - 8, w - 4), CELL - 12);
    } else if (e.type === "log") {
      ctx.fillStyle = skin.entities[E_LOG_BODY];
      ctx.fillRect(x, y + 6, w, CELL - 12);
      ctx.strokeStyle = skin.entities[E_LOG_GRAIN];
      for (let lx = x + 6; lx < x + w; lx += 10) {
        ctx.beginPath();
        ctx.moveTo(lx, y + 6);
        ctx.lineTo(lx, y + CELL - 6);
        ctx.stroke();
      }
    } else if (e.type === "turtle") {
      if (e.submerged) {
        ctx.strokeStyle = skin.entities[E_TURTLE_SUBMERGED];
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 4, y + 8, w - 8, CELL - 16);
      } else {
        ctx.fillStyle = skin.entities[E_TURTLE_SHELL];
        ctx.strokeStyle = skin.entities[E_TURTLE_EDGE];
        for (let i = 0; i < e.width; i++) {
          ctx.beginPath();
          ctx.arc(
            x + i * CELL + CELL / 2,
            y + CELL / 2,
            CELL / 2 - 6,
            0,
            Math.PI * 2,
          );
          ctx.fill();
          ctx.stroke();
        }
      }
    }
  }

  function drawGoals() {
    GOAL_COLS.forEach((startCol, i) => {
      const x = startCol * CELL;
      const y = ROW_GOALS * CELL;
      const w = 2 * CELL;
      ctx.fillStyle = skin.entities[E_GOAL_FILL];
      ctx.fillRect(x + 2, y + 2, w - 4, CELL - 4);
      ctx.strokeStyle = skin.grid;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, w - 4, CELL - 4);
      if (goalsOccupied[i]) {
        ctx.fillStyle = skin.accent;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + CELL / 2, 12, 9, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  function drawFrog() {
    const pos = frogRenderPos();
    const x = pos.x * CELL + CELL / 2;
    const y = pos.y * CELL + CELL / 2;

    if (pos.jumping) {
      ctx.strokeStyle = skin.accent2;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 16, y + 6);
      ctx.lineTo(x - 24, y + 16);
      ctx.moveTo(x + 16, y + 6);
      ctx.lineTo(x + 24, y + 16);
      ctx.stroke();
    }

    ctx.fillStyle = skin.accent;
    ctx.beginPath();
    ctx.ellipse(x, y, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = skin.fg;
    ctx.beginPath();
    ctx.arc(x - 5, y - 6, 3, 0, Math.PI * 2);
    ctx.arc(x + 5, y - 6, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin.entities[E_DARK];
    ctx.beginPath();
    ctx.arc(x - 5, y - 6, 1.5, 0, Math.PI * 2);
    ctx.arc(x + 5, y - 6, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHud() {
    ctx.fillStyle = skin.fg;
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("SCORE " + score, 8, 4);

    ctx.textAlign = "center";
    ctx.fillText("NIVEL " + level, CANVAS_W / 2, 4);

    ctx.textAlign = "right";
    for (let i = 0; i < lives; i++) {
      ctx.beginPath();
      ctx.arc(CANVAS_W - 14 - i * 20, 12, 7, 0, Math.PI * 2);
      ctx.fillStyle = skin.accent;
      ctx.fill();
    }

    const ratio = Math.max(0, roundTime / roundTimeForLevel(level));
    ctx.fillStyle =
      ratio > 0.5
        ? skin.entities[E_TIME_OK]
        : ratio > 0.25
          ? skin.entities[E_TIME_WARN]
          : skin.entities[E_TIME_LOW];
    ctx.fillRect(0, 0, ratio * CANVAS_W, 4);
  }

  function drawOverlay(message: string) {
    ctx.fillStyle = skin.overlay;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = skin.fg;
    ctx.font = "bold 32px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, CANVAS_W / 2, CANVAS_H / 2);
  }

  function draw() {
    drawBackground();
    for (const lane of lanes) {
      for (const e of lane.entities) drawEntity(lane, e);
    }
    drawGoals();
    drawFrog();
    drawHud();
    if (gameState === "paused") drawOverlay("PAUSA");
    if (gameState === "gameover") drawOverlay("GAME OVER");
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
    setSkin: (id: SkinId) => {
      skin = getSkin(id, "rana");
    },
    destroy: () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}

// Motor de Tetris — portado de references/resources/started-games/03-tetris/game.js
// Lógica pura sin document.getElementById: el HUD y el fin de partida salen
// por callbacks (`onHud`, `onGameOver`) para que el wrapper React los consuma.

import {
  getSkin,
  withAlpha,
  type Skin,
  type SkinId,
} from "@/components/games/skins";

export type HudState = { score: number; lines: number; level: number };

export type EngineCallbacks = {
  onHud: (hud: HudState) => void;
  onGameOver: (score: number) => void;
  /** Skin inicial. El wrapper la lee de localStorage antes de montar. */
  skin: SkinId;
};

export type EngineHandle = {
  restart: () => void;
  destroy: () => void;
  /** Cambia la skin en caliente: no reinicia la partida ni toca el estado. */
  setSkin: (id: SkinId) => void;
};

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// `games.id` de Tetris: la clave con la que este motor pide su override de
// skin. Los colores de las piezas viven ahora en `components/games/skins.ts`
// (`SKINS[*].games.tetro.entities`), indexados por `type - 1`.
const GAME_ID = "tetro";

const PIECES: (number[][] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

// La grilla la aporta la skin activa (`skin.grid`). Se sigue sin leer
// `--grid-line` vía getComputedStyle como en el original: la plataforma no
// tiene toggle de tema y el canvas no debe depender del CSS computado.

type Piece = {
  type: number;
  shape: number[][];
  x: number;
  y: number;
};

export function createGame(
  canvas: HTMLCanvasElement,
  nextCanvas: HTMLCanvasElement,
  cb: EngineCallbacks,
): EngineHandle {
  const ctx2d = canvas.getContext("2d");
  const nextCtx2d = nextCanvas.getContext("2d");
  if (!ctx2d || !nextCtx2d) {
    throw new Error("No se pudo obtener el contexto 2D del canvas");
  }
  // Reasignados con tipo explícito no-nulo: el narrowing de arriba no se
  // propaga a las funciones anidadas declaradas más abajo en este closure.
  const ctx: CanvasRenderingContext2D = ctx2d;
  const nextCtx: CanvasRenderingContext2D = nextCtx2d;

  // Estado del juego — vive en el closure de esta llamada a createGame,
  // nunca en scope global ni en variables de módulo compartidas.
  let board: number[][];
  let current: Piece;
  let next: Piece;
  let score = 0;
  let lines = 0;
  let level = 1;
  let paused = false;
  let gameOver = false;
  let lastTime = 0;
  let dropAccum = 0;
  let dropInterval = 1000;
  let animId = 0;

  // Paleta activa. Es lo único que `setSkin` toca: no forma parte del estado
  // de la partida, así que cambiarla no altera tablero, nivel ni puntuación.
  let skin: Skin = getSkin(cb.skin, GAME_ID);

  function createBoard(): number[][] {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }

  function randomPiece(): Piece {
    const type = Math.floor(Math.random() * 8) + 1;
    const shape = PIECES[type]!.map((row) => [...row]);
    return {
      type,
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  }

  function collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function rotateCW(shape: number[][]): number[][] {
    const rows = shape.length,
      cols = shape[0].length;
    const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
    return result;
  }

  function tryRotate() {
    const rotated = rotateCW(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          board[current.y + r][current.x + c] = current.shape[r][c];
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
      updateHUD();
    }
  }

  function ghostY(): number {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function hardDrop() {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
      updateHUD();
    } else {
      lockPiece();
    }
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) {
      endGame();
    }
    drawNext();
  }

  function updateHUD() {
    cb.onHud({ score, lines, level });
  }

  function drawBlock(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    alpha?: number,
  ) {
    if (!colorIndex) return;
    // Módulo por contrato de `entities`: su longitud puede variar por skin.
    const color = skin.entities[(colorIndex - 1) % skin.entities.length];
    context.globalAlpha = alpha ?? 1;
    context.fillStyle = color;
    context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    // highlight — en clásico `fg` es blanco, así que sale el rgba original.
    context.fillStyle = withAlpha(skin.fg, 0.12);
    context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    context.globalAlpha = 1;
  }

  function drawGrid() {
    ctx.strokeStyle = skin.grid;
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, ROWS * BLOCK);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(COLS * BLOCK, r * BLOCK);
      ctx.stroke();
    }
  }

  function draw() {
    // El canvas era transparente y dejaba ver el `#000` de la página. Ahora lo
    // pinta la skin; en clásico ese color es el mismo `#000000`, cero regresión.
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = skin.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid();

    // board
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) drawBlock(ctx, c, r, board[r][c], BLOCK);

    // ghost
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(
            ctx,
            current.x + c,
            gy + r,
            current.shape[r][c],
            BLOCK,
            0.2,
          );

    // current piece
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(
          ctx,
          current.x + c,
          current.y + r,
          current.shape[r][c],
          BLOCK,
        );
  }

  function drawNext() {
    const NB = 30;
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    const shape = next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
  }

  function endGame() {
    gameOver = true;
    cancelAnimationFrame(animId);
    cb.onGameOver(score);
  }

  function togglePause() {
    if (gameOver) return;
    paused = !paused;
    if (!paused) {
      lastTime = performance.now();
      animId = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(animId);
    }
  }

  function loop(ts: number) {
    // Clamp de dt a 50ms (el game.js original no lo tiene) — evita
    // "spiral of death" en cambios de pestaña, igual que Asteroids.
    const dt = Math.min(ts - lastTime, 50);
    lastTime = ts;
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
    if (gameOver) return;
    draw();
    animId = requestAnimationFrame(loop);
  }

  function init() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    paused = false;
    gameOver = false;
    dropInterval = 1000;
    dropAccum = 0;
    lastTime = performance.now();
    next = randomPiece();
    spawn();
    updateHUD();
    cancelAnimationFrame(animId);
    animId = requestAnimationFrame(loop);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement) return;
    if (e.code === "KeyP") {
      togglePause();
      return;
    }
    if (paused || gameOver) return;
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        e.preventDefault();
        hardDrop();
        break;
    }
    updateHUD();
  }

  document.addEventListener("keydown", onKeyDown);

  init();

  return {
    restart: init,
    destroy: () => {
      cancelAnimationFrame(animId);
      document.removeEventListener("keydown", onKeyDown);
    },
    setSkin: (id) => {
      skin = getSkin(id, GAME_ID);
      // Repinta ya: en pausa o tras el game over el loop está detenido y si no
      // el cambio de skin no se vería hasta la siguiente partida.
      draw();
      drawNext();
    },
  };
}

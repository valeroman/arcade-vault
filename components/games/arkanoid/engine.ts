// Motor de Arkanoid — portado de
// references/resources/started-games/04-arkanoid/game.js (+ levels.js).
// Lógica pura sin document.getElementById: el fin de partida sale por
// callback (`onGameOver`) para que el wrapper React lo consuma. El HUD
// original ya es on-canvas (dibujado en draw()), así que no requiere
// callback de HUD como Tetris.

import {
  loadSpritesheet,
  drawBlock,
  drawExplosion,
  drawPaddle,
  drawBall,
  EXPLOSION_DURATION,
  BLOCK_RENDER_W,
  BLOCK_RENDER_H,
  PADDLE_RENDER_W,
  PADDLE_RENDER_H,
  BALL_RENDER,
  type BlockColor,
} from "./sprites";
import { getSkin, type Skin, type SkinId } from "../skins";

export type EngineCallbacks = {
  onGameOver: (score: number) => void;
  /** Skin inicial. Si falta, arranca en `clasico`. */
  skin?: SkinId;
};

export type EngineHandle = {
  restart: () => void;
  destroy: () => void;
  /** Cambia la skin en caliente: no reinicia la partida ni toca el estado. */
  setSkin: (id: SkinId) => void;
};

const W = 800;
const H = 600;

const PADDLE_SPEED = 400;
const BLOCK_COLS = 10;
const BLOCK_ROWS = 6;
// Geometría y tamaño de render son el mismo número, y ese número vive en
// sprites.ts porque es la clave del prerender (los sprites se reescalan una
// vez a esa medida). Importarlo evita que se desincronicen.
const BLOCK_W = BLOCK_RENDER_W;
const BLOCK_H = BLOCK_RENDER_H;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;

type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
};
type Explosion = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  elapsed: number;
};
type LevelBlock = { col: number; row: number; color: BlockColor };
type Level = { speed: number; blocks: LevelBlock[] };

// LEVELS — internalizado de levels.js, sin cambios de lógica.
const LEVELS: Level[] = (() => {
  const rowColors1: BlockColor[] = [
    "red",
    "yellow",
    "cyan",
    "magenta",
    "hotpink",
    "green",
  ];
  const rowColors2: BlockColor[] = [
    "gray",
    "cyan",
    "hotpink",
    "yellow",
    "magenta",
    "green",
  ];
  const rowColors4: BlockColor[] = [
    "cyan",
    "magenta",
    "green",
    "yellow",
    "hotpink",
    "red",
  ];

  const l1: LevelBlock[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      l1.push({ col, row, color: rowColors1[row] });

  const l2: LevelBlock[] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });

  const l3: LevelBlock[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      if ((col + row) % 2 === 0)
        l3.push({ col, row, color: row < 3 ? "yellow" : "magenta" });

  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: LevelBlock[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      if (!gaps4[row].includes(col))
        l4.push({ col, row, color: rowColors4[row] });

  const l5: LevelBlock[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        l5.push({
          col,
          row,
          color: isCross && !isFrame ? "hotpink" : "cyan",
        });
    }

  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
})();

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
  const paddle = {
    x: 0,
    y: 560,
    w: PADDLE_RENDER_W,
    h: PADDLE_RENDER_H,
  };
  const ball = {
    x: 0,
    y: 0,
    w: BALL_RENDER,
    h: BALL_RENDER,
    vx: 200,
    vy: -300,
  };

  // ── Audio ──────────────────────────────────────────────────────────────
  // Pool de voces creado una sola vez. Antes cada rebote hacía
  // `cloneNode(true).play()`: un HTMLAudioElement nuevo por colisión (hasta
  // ~60/s con la bola pegada a una pared), sin ninguna referencia viva, así
  // que `destroy()` no podía detenerlos y seguían sonando tras desmontar.
  const VOICES = 4;
  function makePool(src: string) {
    const pool: HTMLAudioElement[] = [];
    for (let i = 0; i < VOICES; i++) pool.push(new Audio(src));
    return pool;
  }
  const bouncePool = makePool("/games/arkanoid/sounds/ball-bounce.mp3");
  const breakPool = makePool("/games/arkanoid/sounds/break-sound.mp3");
  let bounceVoice = 0;
  let breakVoice = 0;

  let blocks: Block[] = [];
  let blocksAlive = 0;
  // Array mutado en sitio (nunca reasignado): el `filter` por frame que había
  // antes creaba un array + un closure nuevos en cada frame, incluso con cero
  // explosiones vivas.
  const explosions: Explosion[] = [];
  let lives = 3;
  let score = 0;
  let gameState: "playing" | "gameover" | "win" = "playing";
  let currentLevel = 1;
  let isPaused = false;
  let destroyed = false;
  // Solo color: la skin no entra en update(), solo en draw().
  let skin: Skin = getSkin(cb.skin, "ladrillos");
  let rafId = 0;
  let running = false;
  let lastTime: number | null = null;

  // Textos del HUD cacheados: se regeneran solo cuando el valor cambia, no
  // por frame (eran 2 concatenaciones de string por frame, ~120 allocs/s).
  let scoreText = "Score: 0";
  let scoreTextFor = 0;
  let levelText = "Nivel: 1";
  let levelTextFor = 1;

  const keys: Record<string, boolean> = { ArrowLeft: false, ArrowRight: false };

  function playBounce() {
    const node = bouncePool[bounceVoice];
    bounceVoice = (bounceVoice + 1) % VOICES;
    node.currentTime = 0;
    node.play().catch(() => {});
  }
  function playBreak() {
    const node = breakPool[breakVoice];
    breakVoice = (breakVoice + 1) % VOICES;
    node.currentTime = 0;
    node.play().catch(() => {});
  }

  function initPaddle() {
    paddle.x = (W - paddle.w) / 2;
  }

  function loadLevel(n: number) {
    currentLevel = n;
    const level = LEVELS[n - 1];
    blocks = level.blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    blocksAlive = blocks.length;
    explosions.length = 0;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * level.speed;
    ball.vy = BASE_BALL_VY * level.speed;
  }

  function collideAABB(block: Block) {
    return (
      ball.x < block.x + block.w &&
      ball.x + ball.w > block.x &&
      ball.y < block.y + block.h &&
      ball.y + ball.h > block.y
    );
  }

  // ── Input ──────────────────────────────────────────────────────────────
  // Normalizado a e.code (el original usa e.key). Sin control por mouse ni
  // selector de nivel en pausa — decisión confirmada en la Fase 3 de /add-game.
  /**
   * Guard de foco: cubre los tres elementos editables/navegables por teclado.
   * `HTMLSelectElement` es imprescindible acá — el wrapper tiene un `<select>`
   * de skin en la barra inferior, y con él enfocado las flechas cambiaban de
   * skin y movían la pala a la vez.
   */
  function isTypingTarget(t: EventTarget | null) {
    return (
      t instanceof HTMLInputElement ||
      t instanceof HTMLSelectElement ||
      t instanceof HTMLTextAreaElement
    );
  }

  function onKeyDown(e: KeyboardEvent) {
    if (isTypingTarget(e.target)) return;
    if (e.code in keys) {
      keys[e.code] = true;
      e.preventDefault(); // sin esto las flechas scrollean la página
    }
    if (e.code === "KeyP" || e.code === "Escape") {
      e.preventDefault();
      if (gameState === "playing") togglePause();
    }
  }
  function onKeyUp(e: KeyboardEvent) {
    if (e.code in keys) {
      keys[e.code] = false;
      e.preventDefault();
    }
  }
  /** Suelta las teclas al perder el foco: si no, la pala queda "pegada". */
  function releaseKeys() {
    keys.ArrowLeft = false;
    keys.ArrowRight = false;
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", releaseKeys);
  document.addEventListener("visibilitychange", releaseKeys);

  function update(dt: number) {
    if (gameState !== "playing") return;
    if (isPaused) return;

    // Paddle
    if (keys.ArrowLeft) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (keys.ArrowRight)
      paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);

    // Ball movement
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Wall bounces (left, right, top)
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      playBounce();
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -Math.abs(ball.vx);
      playBounce();
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
      playBounce();
    }

    // Paddle bounce
    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
      playBounce();
    }

    // Block collisions — uno por frame, igual que el original.
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (!block.alive) continue;
      if (collideAABB(block)) {
        block.alive = false;
        blocksAlive--;
        explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        score += 10;
        // Resolución del impacto por eje de menor penetración, con corrección
        // posicional (puerta G10). Antes se invertía `vy` siempre y sin sacar
        // la bola del solapamiento: un impacto lateral la devolvía en la
        // dirección equivocada y, al quedar dentro del hueco, podía volver a
        // colisionar con el bloque vecino en el frame siguiente (zigzag +
        // sonido repetido). Ahora se decide el eje comparando cuánto ha
        // penetrado en cada uno y se reposiciona justo fuera del bloque.
        const overlapX = Math.min(
          ball.x + ball.w - block.x,
          block.x + block.w - ball.x,
        );
        const overlapY = Math.min(
          ball.y + ball.h - block.y,
          block.y + block.h - ball.y,
        );
        if (overlapX < overlapY) {
          // Impacto lateral: invierte vx y expulsa por el lado de entrada.
          ball.x = ball.vx > 0 ? block.x - ball.w : block.x + block.w;
          ball.vx = -ball.vx;
        } else {
          // Impacto vertical: el caso de siempre, ahora con la bola fuera.
          ball.y = ball.vy > 0 ? block.y - ball.h : block.y + block.h;
          ball.vy = -ball.vy;
        }
        playBreak();
        if (blocksAlive === 0) {
          if (currentLevel < 5) {
            loadLevel(currentLevel + 1);
          } else {
            gameState = "win";
            cb.onGameOver(score);
          }
        }
        break;
      }
    }

    // Explosions — envejecidas y compactadas en sitio, sin array intermedio.
    let write = 0;
    for (let i = 0; i < explosions.length; i++) {
      const exp = explosions[i];
      exp.elapsed += dt * 1000;
      if (exp.elapsed < EXPLOSION_DURATION) {
        if (write !== i) explosions[write] = exp;
        write++;
      }
    }
    explosions.length = write;

    // Ball lost
    if (ball.y > H) {
      lives--;
      if (lives <= 0) {
        lives = 0;
        gameState = "gameover";
        cb.onGameOver(score);
      } else {
        ball.x = paddle.x + (paddle.w - ball.w) / 2;
        ball.y = paddle.y - ball.h;
        const speed = LEVELS[currentLevel - 1].speed;
        ball.vx = BASE_BALL_VX * speed;
        ball.vy = BASE_BALL_VY * speed;
      }
    }
  }

  // `save()`/`restore()` alrededor del overlay: `font`/`textAlign`/
  // `textBaseline` quedaban puestos al salir y solo sobrevivían por la
  // reasignación exhaustiva del HUD. Ahora no fuga estado al frame siguiente.
  function drawOverlay(message: string) {
    ctx.save();
    ctx.fillStyle = skin.overlay;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = skin.fg;
    ctx.font = "bold 64px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, W / 2, H / 2);
    ctx.restore();
  }

  const LIVES_BALL_SPACING = 4;

  function draw() {
    ctx.fillStyle = skin.bg;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (block.alive) drawBlock(ctx, block.color, block.x, block.y, skin);
    }

    for (let i = 0; i < explosions.length; i++) {
      const exp = explosions[i];
      const frameIndex = Math.min(
        Math.floor((exp.elapsed / EXPLOSION_DURATION) * 4),
        3,
      );
      drawExplosion(ctx, exp.color, frameIndex, exp.x, exp.y, skin);
    }

    drawPaddle(ctx, paddle.x, paddle.y, skin);
    drawBall(ctx, ball.x, ball.y, skin);

    if (gameState === "playing") {
      ctx.save();
      ctx.fillStyle = skin.fg;
      ctx.font = "bold 18px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      if (scoreTextFor !== score) {
        scoreTextFor = score;
        scoreText = "Score: " + score;
      }
      if (levelTextFor !== currentLevel) {
        levelTextFor = currentLevel;
        levelText = "Nivel: " + currentLevel;
      }
      ctx.fillText(scoreText, 10, 10);
      ctx.textAlign = "center";
      ctx.fillText(levelText, W / 2, 10);
      ctx.restore();
      for (let i = 0; i < lives; i++) {
        const bx = W - 10 - (lives - i) * (BALL_RENDER + LIVES_BALL_SPACING);
        drawBall(ctx, bx, 10, skin);
      }
    }

    if (gameState === "gameover") drawOverlay("GAME OVER");
    if (gameState === "win") drawOverlay("¡Completaste el juego!");
    if (isPaused && gameState === "playing") drawOverlay("PAUSA");
  }

  /**
   * El loop se detiene en pausa y en fin de partida en vez de repintar la
   * escena completa a 60fps detrás del modal de React (mismo patrón que
   * `tetris/engine.ts:344,362,380-381`). Dibuja el frame final —el que lleva
   * el overlay— y recién entonces corta el rAF.
   */
  function loop(ts: number) {
    // Clamp de dt a 50ms (el original no lo tiene) — evita "spiral of
    // death" en cambios de pestaña, igual que Asteroids/Tetris.
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    if (destroyed || gameState !== "playing" || isPaused) {
      running = false;
      return;
    }
    rafId = requestAnimationFrame(loop);
  }

  /** Arranca (o reanuda) el loop. Idempotente: nunca deja dos rAF vivos. */
  function start() {
    if (destroyed || running) return;
    running = true;
    lastTime = null; // dt = 0 en el primer frame: no salta al reanudar
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
      // Pinta el overlay "PAUSA" en el acto y corta el frame ya agendado, en
      // vez de esperar una vuelta más del loop para detenerlo.
      draw();
      running = false;
      cancelAnimationFrame(rafId);
    } else {
      start();
    }
  }

  function initGame() {
    lives = 3;
    score = 0;
    gameState = "playing";
    isPaused = false;
    initPaddle();
    loadLevel(1);
    start();
  }

  function startAfterLoad() {
    if (destroyed) return; // destroy() llegó antes de que cargara la imagen
    initGame();
  }

  loadSpritesheet(startAfterLoad);

  return {
    restart: () => {
      if (destroyed) return;
      initGame();
    },
    setSkin: (id: SkinId) => {
      if (destroyed) return;
      skin = getSkin(id, "ladrillos");
      // Con el loop detenido (pausa o fin de partida) nadie repintaría: un
      // repintado puntual mantiene el cambio de skin en caliente sin
      // reactivar el rAF.
      if (!running) draw();
    },
    destroy: () => {
      destroyed = true;
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseKeys);
      document.removeEventListener("visibilitychange", releaseKeys);
      // Corta cualquier voz en vuelo: los clones anteriores sobrevivían al
      // desmontaje y seguían sonando fuera de la pantalla del juego.
      for (const node of bouncePool) node.pause();
      for (const node of breakPool) node.pause();
    },
  };
}

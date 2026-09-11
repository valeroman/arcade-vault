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
  let rafId = 0; // 0 = loop detenido (los ids de rAF empiezan en 1)
  let lastTime: number | null = null;
  let hudScore = -1;
  let hudText = "";
  // Snake es un juego de estado discreto: entre dos ticks (`STEP_MS=120`) el
  // canvas no cambia, así que a 60fps el 86% de los frames repintaba píxeles
  // idénticos. El rAF sigue corriendo (es el reloj del tick), pero `draw()`
  // solo se llama si algo mutó — el canvas conserva lo pintado entre frames,
  // así que no hay diferencia visual. Patrón de `tetris/engine.ts`.
  let needsRedraw = true;

  // La skin es puro color: vive fuera del estado de partida, así que cambiarla
  // no toca la serpiente, la fruta, la velocidad ni la puntuación.
  let skin: Skin = getSkin(cb.skin ?? DEFAULT_SKIN, "vibora");

  // Buffers reutilizados por spawnFruit, asignados una vez por partida.
  const occupied = new Uint8Array(COLS * ROWS);
  const freeCells = new Int16Array(COLS * ROWS);

  // El rechazo por muestreo original (`do { ... } while (snake.some(...))`)
  // es O(longitud) por intento y no termina cuando la rejilla se llena:
  // colgaba el hilo principal. Esto marca las celdas ocupadas una vez y
  // elige uniformemente entre las libres — misma distribución (uniforme
  // sobre celdas libres), sin bucle potencialmente infinito y sin allocs.
  function spawnFruit() {
    occupied.fill(0);
    for (let i = 0; i < snake.length; i++) {
      occupied[snake[i].y * COLS + snake[i].x] = 1;
    }
    let freeCount = 0;
    for (let i = 0; i < occupied.length; i++) {
      if (occupied[i] === 0) freeCells[freeCount++] = i;
    }
    if (freeCount === 0) {
      // Rejilla completa: no queda celda donde poner fruta. La partida sigue
      // con las reglas de siempre (la serpiente choca contra su cuerpo en el
      // siguiente tick); no se inventa condición de victoria.
      fruit = null;
      return;
    }
    const cell = freeCells[Math.floor(Math.random() * freeCount)];
    const type = FRUIT_NAMES[Math.floor(Math.random() * FRUIT_NAMES.length)];
    fruit = { x: cell % COLS, y: Math.floor(cell / COLS), type };
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
    needsRedraw = true;
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
    // Mismo criterio que el `snake.some()` original (incluye la cola que está
    // por salir), en bucle for para no asignar un closure por tick.
    for (let i = 0; i < snake.length; i++) {
      if (snake[i].x === newHead.x && snake[i].y === newHead.y) {
        gameState = "gameover";
        cb.onGameOver(score);
        return;
      }
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
    // El guard cubre los tres controles de formulario: el `<select>` de skin
    // de la barra inferior es `HTMLSelectElement`, y con él enfocado las
    // flechas cambiaban de skin y giraban la serpiente a la vez.
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    const nd = DIR_CODES[e.code];
    if (nd) {
      e.preventDefault(); // las flechas scrolleaban la página
      // evita revertir 180° sobre sí misma
      if (snake.length > 1 && nd.x === -direction.x && nd.y === -direction.y) {
        return;
      }
      pendingDirection = nd;
      return;
    }
    if (e.code === "KeyP" && gameState !== "gameover") {
      e.preventDefault();
      gameState = gameState === "paused" ? "playing" : "paused";
      needsRedraw = true; // pintar/quitar el overlay de PAUSA
      // El loop se detiene solo al entrar en pausa (ver `loop`); al salir hay
      // que volver a agendarlo.
      if (gameState === "playing") resume();
    }
  }
  window.addEventListener("keydown", onKeyDown);

  function update(dt: number) {
    if (gameState !== "playing") return;

    tickAccumulator += dt * 1000;
    while (tickAccumulator >= STEP_MS) {
      tickAccumulator -= STEP_MS;
      moveSnake();
      // Único punto de mutación del estado dibujable: la serpiente se mueve
      // (y, si comió, aparece fruta nueva) exactamente una vez por tick.
      needsRedraw = true;
      if (gameState !== "playing") break;
    }
  }

  function drawOverlay(message: string) {
    // save/restore para que `font`/`textAlign`/`textBaseline` no queden
    // puestos al salir (mismo criterio que `sprites.ts`).
    ctx.save();
    ctx.fillStyle = skin.overlay;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = skin.fg;
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, W / 2, H / 2);
    ctx.restore();
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

    // Bucle for (no forEach) para no asignar un closure por frame. La cabeza
    // sale del bucle: así `fillStyle` se escribe 2 veces en total en vez de
    // una por segmento (con la rejilla llena, 2 en vez de 400).
    if (snake.length > 0) {
      const head = snake[0];
      ctx.fillStyle = skin.accent;
      ctx.fillRect(head.x * CELL + 1, head.y * CELL + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = skin.accent2;
      for (let i = 1; i < snake.length; i++) {
        const seg = snake[i];
        ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
      }
    }

    // El string del HUD se regenera solo cuando la puntuación cambia (una vez
    // por fruta), no en cada frame.
    if (hudScore !== score) {
      hudScore = score;
      hudText = "Score: " + score;
    }
    ctx.fillStyle = skin.fg;
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(hudText, 10, 10);

    if (gameState === "paused") drawOverlay("PAUSA");
    if (gameState === "gameover") drawOverlay("GAME OVER");
  }

  function loop(ts: number) {
    // Clamp de dt a 50ms (el original no lo tiene) — evita "spiral of
    // death" en cambios de pestaña, igual que Asteroids/Tetris/Arkanoid.
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    if (needsRedraw) {
      draw();
      needsRedraw = false;
    }
    // Pausa y game over no cambian nada de un frame al siguiente: se pinta el
    // frame con el overlay y el loop se detiene (patrón de Tetris,
    // `tetris/engine.ts:344,362`). Sin esto, la escena completa se repintaba
    // a 60fps indefinidamente detrás del modal de fin de partida.
    if (gameState !== "playing") {
      rafId = 0;
      return;
    }
    rafId = requestAnimationFrame(loop);
  }

  /** Reanuda el loop si está detenido. Idempotente: nunca deja dos rAF vivos. */
  function resume() {
    if (destroyed || rafId !== 0) return;
    lastTime = null; // no acumular el tiempo que estuvo en pausa
    rafId = requestAnimationFrame(loop);
  }

  function startAfterLoad() {
    if (destroyed) return; // destroy() llegó antes de que cargara la imagen
    initGame();
    resume();
  }

  loadSpritesheet(startAfterLoad);

  return {
    restart: () => {
      initGame();
      // Tras un game over el loop quedó detenido: hay que reanudarlo.
      // `resume()` no agenda un segundo rAF si ya había uno vivo (reinicio
      // en medio de una partida).
      resume();
    },
    setSkin: (id: SkinId) => {
      skin = getSkin(id, "vibora");
      needsRedraw = true;
      // Con el loop detenido (pausa / game over) nadie repintaría: un frame
      // suelto para que el cambio de skin se vea igual que en juego.
      if (rafId === 0 && !destroyed) {
        draw();
        needsRedraw = false;
      }
    },
    destroy: () => {
      destroyed = true;
      cancelAnimationFrame(rafId);
      rafId = 0;
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}

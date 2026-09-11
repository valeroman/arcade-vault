// Sprites y helpers de dibujo — portado de
// references/resources/started-games/04-arkanoid/assets/spritesheet.js
//
// Estado de carga del spritesheet (`ssImg`/`ssLoaded`/`ssCallbacks`) vive a
// nivel de módulo a propósito: es un asset cacheado, no estado de partida —
// se comparte entre montajes para no re-descargar la imagen cada vez que se
// entra a /games/arkanoid, igual que hacía el original en scope global.

import { DEFAULT_SKIN, type Skin } from "../skins";

export type BlockColor =
  | "gray"
  | "red"
  | "yellow"
  | "cyan"
  | "magenta"
  | "hotpink"
  | "green";

/**
 * Orden en el que cada `BlockColor` indexa `skin.entities`. Ojo: estas claves
 * son filas del spritesheet, no colores CSS — el color real de una skin sale
 * siempre de `entities`, nunca del nombre de la clave.
 */
export const BLOCK_TINT_ORDER: BlockColor[] = [
  "gray",
  "red",
  "yellow",
  "cyan",
  "magenta",
  "hotpink",
  "green",
];

type Frame = { sx: number; sy: number; sw: number; sh: number };

export const EXPLOSION_DURATION = 150;

export const EXPLOSION_FRAMES: Record<BlockColor, Frame[]> = {
  red: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
  cyan: [
    { sx: 256, sy: 192, sw: 32, sh: 16 },
    { sx: 288, sy: 192, sw: 32, sh: 16 },
    { sx: 320, sy: 192, sw: 32, sh: 16 },
    { sx: 352, sy: 192, sw: 32, sh: 16 },
  ],
  green: [
    { sx: 256, sy: 208, sw: 32, sh: 16 },
    { sx: 288, sy: 208, sw: 32, sh: 16 },
    { sx: 320, sy: 208, sw: 32, sh: 16 },
    { sx: 352, sy: 208, sw: 32, sh: 16 },
  ],
  magenta: [
    { sx: 256, sy: 224, sw: 32, sh: 16 },
    { sx: 288, sy: 224, sw: 32, sh: 16 },
    { sx: 320, sy: 224, sw: 32, sh: 16 },
    { sx: 352, sy: 224, sw: 32, sh: 16 },
  ],
  yellow: [
    { sx: 256, sy: 240, sw: 32, sh: 16 },
    { sx: 288, sy: 240, sw: 32, sh: 16 },
    { sx: 320, sy: 240, sw: 32, sh: 16 },
    { sx: 352, sy: 240, sw: 32, sh: 16 },
  ],
  hotpink: [
    { sx: 256, sy: 256, sw: 32, sh: 16 },
    { sx: 288, sy: 256, sw: 32, sh: 16 },
    { sx: 320, sy: 256, sw: 32, sh: 16 },
    { sx: 352, sy: 256, sw: 32, sh: 16 },
  ],
  gray: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
};

const SPRITES: Record<"paddle" | "ball", Frame> = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
};

// ── Tamaños de render ────────────────────────────────────────────────────
// Únicos tamaños a los que el juego dibuja cada sprite. Viven acá (y no en
// engine.ts) porque son la clave del prerender: cada sprite se reescala una
// sola vez a estas medidas y después se blitea 1:1, sin filtrado bilineal
// por frame. El engine los importa para su geometría, así que no pueden
// desincronizarse.
export const BLOCK_RENDER_W = 64; // fuente 32 → 2,0×
export const BLOCK_RENDER_H = 24; // fuente 16 → 1,5×
export const PADDLE_RENDER_W = 81; // fuente 162 → 0,5×
export const PADDLE_RENDER_H = 14; // fuente 14 → 1,0×
export const BALL_RENDER = 16; // fuente 16 → 1,0×

const BLOCK_SPRITES: Record<BlockColor, Frame> = {
  gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
  red: { sx: 32, sy: 176, sw: 32, sh: 16 },
  yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
  cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
  magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
  hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
  green: { sx: 32, sy: 208, sw: 32, sh: 16 },
};

let ssImg: HTMLCanvasElement | null = null;
let ssLoaded = false;
let ssCallbacks: Array<() => void> = [];
// Guard de carga en curso: se asigna *antes* del `.src =`, no en `onload`.
// Con `ssImg` (que solo existe una vez decodificada la imagen) dos montajes
// rápidos disparaban dos descargas concurrentes — mismo patrón ya correcto en
// `snake/sprites.ts:66,74`.
let loadingImg: HTMLImageElement | null = null;

export function loadSpritesheet(cb: () => void) {
  if (ssLoaded) {
    cb();
    return;
  }
  ssCallbacks.push(cb);
  if (loadingImg) return; // ya hay una carga en curso

  const rawImg = new Image();
  loadingImg = rawImg;
  rawImg.onload = () => {
    const oc = document.createElement("canvas");
    oc.width = rawImg.width;
    oc.height = rawImg.height;
    const octx = oc.getContext("2d");
    octx?.drawImage(rawImg, 0, 0);
    ssImg = oc;
    ssLoaded = true;
    loadingImg = null;
    const callbacks = ssCallbacks;
    ssCallbacks = [];
    callbacks.forEach((f) => f());
  };
  rawImg.onerror = () => {
    // Libera el guard para que un montaje posterior pueda reintentar; los
    // callbacks encolados siguen esperando ese reintento (nunca se los invoca
    // sin hoja, para no arrancar un loop que dibujaría el vacío).
    loadingImg = null;
    console.error("Failed to load spritesheet");
  };
  rawImg.src = "/games/arkanoid/spritesheet-breakout.png";
}

// ── Re-tinte por skin ────────────────────────────────────────────────────
// El PNG es intocable: cada skin no-clásica genera en runtime una copia
// re-tintada del canvas offscreen, cacheada a nivel de módulo igual que el
// propio spritesheet (es asset derivado, no estado de partida).

const tintedSheets = new Map<string, HTMLCanvasElement>();

/** `#rgb`, `#rrggbb` o `rgb()/rgba()` → componentes 0-255. */
function toRgb(color: string): [number, number, number] {
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(color);
  if (short)
    return [
      parseInt(short[1] + short[1], 16),
      parseInt(short[2] + short[2], 16),
      parseInt(short[3] + short[3], 16),
    ];
  const long = /^#([0-9a-f]{6})$/i.exec(color);
  if (long) {
    const h = long[1];
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(color);
  if (rgb) {
    const [r, g, b] = rgb[1].split(",").map((p) => parseFloat(p.trim()));
    return [r || 0, g || 0, b || 0];
  }
  return [255, 255, 255];
}

/**
 * Re-tinta una región de `src` sobre `dstCtx` conservando el relieve del sprite.
 *
 * El ancla es el *cuerpo* del sprite, no su píxel más claro: se toma el valor
 * HSV más repetido de la región (ignorando el contorno casi negro) y ese nivel
 * se pinta con el color exacto de la skin. Los píxeles más oscuros escalan
 * hacia el negro (bisel y contorno) y los más claros tiran hacia el blanco
 * (brillo). Sin este anclaje, un bloque de cuerpo oscuro — el `gray`, cuyo
 * cuerpo está al 26% de brillo — saldría casi negro y se comería el contraste
 * validado de la paleta.
 *
 * El alfa se mantiene intacto: la silueta no cambia ni un píxel. Siempre lee de
 * `src` (la hoja original) para que re-tintar dos veces la misma región —
 * `gray` y `red` comparten los rects de explosión — nunca acumule.
 */
function tintRegion(
  dstCtx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  f: Frame,
  color: string,
) {
  const [tr, tg, tb] = toRgb(color);
  dstCtx.clearRect(f.sx, f.sy, f.sw, f.sh);
  dstCtx.drawImage(src, f.sx, f.sy, f.sw, f.sh, f.sx, f.sy, f.sw, f.sh);
  const img = dstCtx.getImageData(f.sx, f.sy, f.sw, f.sh);
  const d = img.data;

  // 1) Valor dominante = cuerpo del sprite.
  const counts = new Array<number>(256).fill(0);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const v = Math.max(d[i], d[i + 1], d[i + 2]);
    if (v < 20) continue; // contorno negro: no es cuerpo
    counts[v]++;
  }
  let bodyV = 0;
  let best = 0;
  for (let v = 0; v < 256; v++) {
    if (counts[v] > best) {
      best = counts[v];
      bodyV = v;
    }
  }
  if (bodyV === 0) bodyV = 255; // región íntegramente oscura: escala plana

  // 2) Recolorea relativo a ese cuerpo.
  const headroom = 255 - bodyV;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const v = Math.max(d[i], d[i + 1], d[i + 2]);
    if (v <= bodyV || headroom === 0) {
      const k = v / bodyV;
      d[i] = Math.round(tr * k);
      d[i + 1] = Math.round(tg * k);
      d[i + 2] = Math.round(tb * k);
    } else {
      // Brillos: hacia blanco, pero solo al 60% para no lavar el tono.
      const t = ((v - bodyV) / headroom) * 0.6;
      d[i] = Math.round(tr + (255 - tr) * t);
      d[i + 1] = Math.round(tg + (255 - tg) * t);
      d[i + 2] = Math.round(tb + (255 - tb) * t);
    }
  }
  dstCtx.putImageData(img, f.sx, f.sy);
}

function buildTintedSheet(skin: Skin, src: HTMLCanvasElement) {
  const oc = document.createElement("canvas");
  oc.width = src.width;
  oc.height = src.height;
  const octx = oc.getContext("2d", { willReadFrequently: true });
  if (!octx) return src;
  octx.drawImage(src, 0, 0);

  const palette = skin.entities;
  BLOCK_TINT_ORDER.forEach((blockColor, i) => {
    const color = palette[i % palette.length];
    tintRegion(octx, src, BLOCK_SPRITES[blockColor], color);
    // `gray` reutiliza los rects de explosión de `red` en el PNG original, así
    // que sus fotogramas se tintan una sola vez, con el color de `red` — el
    // mismo solapamiento que ya tenía el juego en clásico.
    if (blockColor === "gray") return;
    for (const frame of EXPLOSION_FRAMES[blockColor])
      tintRegion(octx, src, frame, color);
  });

  tintRegion(octx, src, SPRITES.paddle, skin.accent2);
  tintRegion(octx, src, SPRITES.ball, skin.fg);
  return oc;
}

/** Hoja a dibujar para una skin. En clásico devuelve el PNG sin tocar. */
function sheetFor(skin: Skin): HTMLCanvasElement | null {
  if (!ssLoaded || !ssImg) return null;
  if (skin.id === DEFAULT_SKIN) return ssImg;
  const cached = tintedSheets.get(skin.id);
  if (cached) return cached;
  const built = buildTintedSheet(skin, ssImg);
  tintedSheets.set(skin.id, built);
  return built;
}

// ── Prerender por skin ───────────────────────────────────────────────────
// Todos los sprites salvo la bola se dibujaban con escala no entera en cada
// frame (bloques 32×16→64×24, pala 162×14→81×14): ~66 remuestreos bilineales
// por frame para un resultado que nunca cambia. Acá cada sprite se reescala
// una única vez a su tamaño de render y se cachea a nivel de módulo por
// `skin.id` — el mismo criterio que la hoja re-tintada: asset derivado, no
// estado de partida. Los píxeles resultantes son los mismos que producía el
// escalado por frame; solo se paga una vez.

type Prepared = {
  blocks: Record<BlockColor, HTMLCanvasElement>;
  explosions: Record<BlockColor, HTMLCanvasElement[]>;
  paddle: HTMLCanvasElement;
  ball: HTMLCanvasElement;
};

const preparedSheets = new Map<string, Prepared>();
// Memo del último acceso: `draw()` pide la misma skin ~66 veces por frame y
// así se resuelve con una comparación de string en vez de un `Map.get`.
let lastPreparedId: string | null = null;
let lastPrepared: Prepared | null = null;

function scaleFrame(
  sheet: HTMLCanvasElement,
  f: Frame,
  w: number,
  h: number,
): HTMLCanvasElement {
  const oc = document.createElement("canvas");
  oc.width = w;
  oc.height = h;
  const octx = oc.getContext("2d");
  octx?.drawImage(sheet, f.sx, f.sy, f.sw, f.sh, 0, 0, w, h);
  return oc;
}

function buildPrepared(sheet: HTMLCanvasElement): Prepared {
  const blocks = {} as Record<BlockColor, HTMLCanvasElement>;
  const explosions = {} as Record<BlockColor, HTMLCanvasElement[]>;
  for (const color of BLOCK_TINT_ORDER) {
    blocks[color] = scaleFrame(
      sheet,
      BLOCK_SPRITES[color],
      BLOCK_RENDER_W,
      BLOCK_RENDER_H,
    );
    explosions[color] = EXPLOSION_FRAMES[color].map((f) =>
      scaleFrame(sheet, f, BLOCK_RENDER_W, BLOCK_RENDER_H),
    );
  }
  return {
    blocks,
    explosions,
    paddle: scaleFrame(sheet, SPRITES.paddle, PADDLE_RENDER_W, PADDLE_RENDER_H),
    ball: scaleFrame(sheet, SPRITES.ball, BALL_RENDER, BALL_RENDER),
  };
}

function preparedFor(skin: Skin): Prepared | null {
  if (lastPrepared !== null && lastPreparedId === skin.id) return lastPrepared;
  const cached = preparedSheets.get(skin.id);
  if (cached) {
    lastPreparedId = skin.id;
    lastPrepared = cached;
    return cached;
  }
  const sheet = sheetFor(skin);
  if (!sheet) return null; // hoja todavía sin cargar
  const built = buildPrepared(sheet);
  preparedSheets.set(skin.id, built);
  lastPreparedId = skin.id;
  lastPrepared = built;
  return built;
}

// Las cuatro funciones de dibujo reciben el sprite por parámetro tipado en vez
// de por nombre (`block_${color}`): ese template literal se construía una vez
// por bloque y por frame, con su `startsWith`/`slice` detrás — hasta 120
// strings por frame solo para elegir un rect.

export function drawBlock(
  ctx: CanvasRenderingContext2D,
  color: BlockColor,
  x: number,
  y: number,
  skin: Skin,
) {
  const p = preparedFor(skin);
  if (!p) return;
  ctx.drawImage(p.blocks[color], x, y);
}

export function drawExplosion(
  ctx: CanvasRenderingContext2D,
  color: BlockColor,
  frameIndex: number,
  x: number,
  y: number,
  skin: Skin,
) {
  const p = preparedFor(skin);
  if (!p) return;
  ctx.drawImage(p.explosions[color][frameIndex], x, y);
}

export function drawPaddle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  skin: Skin,
) {
  const p = preparedFor(skin);
  if (!p) return;
  ctx.drawImage(p.paddle, x, y);
}

export function drawBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  skin: Skin,
) {
  const p = preparedFor(skin);
  if (!p) return;
  ctx.drawImage(p.ball, x, y);
}

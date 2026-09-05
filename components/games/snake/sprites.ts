// Sprites y helpers de dibujo — portado de
// references/resources/started-games/05-snake/assets/sprites.js
//
// Estado de carga del spritesheet (`ssImg`/`ssLoaded`/`ssCallbacks`) vive a
// nivel de módulo a propósito: es un asset cacheado, no estado de partida —
// se comparte entre montajes para no re-descargar la imagen cada vez que se
// entra a /games/snake, igual que hace Arkanoid.

export type FruitName =
  | "banana"
  | "orange"
  | "grape"
  | "garlic"
  | "eggplant"
  | "strawberry"
  | "cherry"
  | "carrot"
  | "mushroom"
  | "broccoli"
  | "watermelon"
  | "pepper"
  | "kiwi"
  | "lemon"
  | "peach"
  | "peanut"
  | "apple"
  | "tomato"
  | "berries"
  | "grapes2"
  | "pineapple"
  | "melon";

type Frame = { sx: number; sy: number; sw: number; sh: number };

// Hoja: 3790x442 px, fondo transparente. Fila usada: y=136–295 (160px alto).
const FRUIT_SPRITES: Record<FruitName, Frame> = {
  banana: { sx: 34, sy: 136, sw: 110, sh: 160 },
  orange: { sx: 186, sy: 136, sw: 150, sh: 160 },
  grape: { sx: 378, sy: 136, sw: 110, sh: 160 },
  garlic: { sx: 540, sy: 136, sw: 130, sh: 160 },
  eggplant: { sx: 712, sy: 136, sw: 130, sh: 160 },
  strawberry: { sx: 894, sy: 136, sw: 110, sh: 160 },
  cherry: { sx: 1066, sy: 136, sw: 110, sh: 160 },
  carrot: { sx: 1228, sy: 136, sw: 130, sh: 160 },
  mushroom: { sx: 1400, sy: 136, sw: 130, sh: 160 },
  broccoli: { sx: 1582, sy: 136, sw: 110, sh: 160 },
  watermelon: { sx: 1734, sy: 136, sw: 150, sh: 160 },
  pepper: { sx: 1906, sy: 136, sw: 150, sh: 160 },
  kiwi: { sx: 2068, sy: 136, sw: 170, sh: 160 },
  lemon: { sx: 2250, sy: 136, sw: 140, sh: 160 },
  peach: { sx: 2432, sy: 136, sw: 130, sh: 160 },
  peanut: { sx: 2604, sy: 136, sw: 130, sh: 160 },
  apple: { sx: 2786, sy: 136, sw: 110, sh: 160 },
  tomato: { sx: 2948, sy: 136, sw: 130, sh: 160 },
  berries: { sx: 3110, sy: 136, sw: 150, sh: 160 },
  grapes2: { sx: 3302, sy: 136, sw: 110, sh: 160 },
  pineapple: { sx: 3454, sy: 136, sw: 150, sh: 160 },
  melon: { sx: 3637, sy: 136, sw: 130, sh: 160 },
};

export const FRUIT_NAMES = Object.keys(FRUIT_SPRITES) as FruitName[];

let ssImg: HTMLImageElement | null = null;
let ssLoaded = false;
let ssCallbacks: Array<() => void> = [];
let loadingImg: HTMLImageElement | null = null;

export function loadSpritesheet(cb: () => void) {
  if (ssLoaded) {
    cb();
    return;
  }
  ssCallbacks.push(cb);
  if (loadingImg) return; // ya hay una carga en curso

  loadingImg = new Image();
  loadingImg.onload = () => {
    ssImg = loadingImg;
    ssLoaded = true;
    const callbacks = ssCallbacks;
    ssCallbacks = [];
    callbacks.forEach((f) => f());
  };
  loadingImg.onerror = () => console.error("Failed to load fruits spritesheet");
  loadingImg.src = "/games/snake/fruits.png";
}

/**
 * Fruta dibujada con primitivas de canvas, para las skins `neon` y `retro`.
 *
 * El spritesheet es fotorrealista: teñirlo daría un borrón sucio en vez de una
 * fruta legible, así que en esas skins se sustituye por vectores. `clasico`
 * sigue usando `drawSprite()` con el PNG intacto (cero regresión visual).
 *
 * La forma y el color salen del índice del tipo de fruta, no de un random: la
 * misma fruta se ve siempre igual. Solo dibuja — no altera qué fruta aparece
 * ni cuánto puntúa.
 */
export function drawFruitPrimitive(
  ctx: CanvasRenderingContext2D,
  name: FruitName,
  x: number,
  y: number,
  w: number,
  h: number,
  palette: string[],
  stemColor: string,
) {
  const index = Math.max(0, FRUIT_NAMES.indexOf(name));
  const fill = palette[index % palette.length] ?? stemColor;
  const cx = x + w / 2;
  const cy = y + h / 2 + h * 0.06;

  ctx.save();
  ctx.shadowColor = fill;
  ctx.shadowBlur = Math.round(w * 0.28);
  ctx.fillStyle = fill;

  switch (index % 3) {
    case 0: // baya redonda
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.32, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 1: // par tipo cereza
      ctx.beginPath();
      ctx.arc(cx - w * 0.16, cy + h * 0.06, w * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + w * 0.16, cy + h * 0.02, w * 0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    default: // ovalada tipo pera
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * 0.26, h * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
  }

  // Rabito + hojita, en el color de HUD de la skin.
  ctx.shadowBlur = 0;
  ctx.strokeStyle = stemColor;
  ctx.lineWidth = Math.max(1, w * 0.07);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, y + h * 0.3);
  ctx.lineTo(cx, y + h * 0.12);
  ctx.stroke();

  ctx.fillStyle = stemColor;
  ctx.beginPath();
  ctx.ellipse(
    cx + w * 0.12,
    y + h * 0.16,
    w * 0.11,
    h * 0.05,
    -Math.PI / 5,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  name: FruitName,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (!ssLoaded || !ssImg) return;
  const sp = FRUIT_SPRITES[name];
  ctx.drawImage(ssImg, sp.sx, sp.sy, sp.sw, sp.sh, x, y, w, h);
}

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

/**
 * SPRITE_ATLAS — mapa reutilizable de sprites para el juego de Snake.
 * Obtuve la imagen de: https://www.spriters-resource.com/browser_games/googlesnakegame/
 *
 * Coordenadas detectadas por análisis de píxeles de los PNG.
 * Estructura: { x, y, w, h } — recorte dentro del archivo fuente.
 */
window.SPRITE_ATLAS = {
  sources: {
    fruits: "assets/fruits.png", // bg transparente
  },

  // ── Frutas (fila mediana de fruits.png) ─────────────────────────────────
  // Hoja: 3790x442 px. Fondo transparente.  Fila usada: y=136–295 (160px de alto).
  fruits: {
    banana: { x: 34, y: 136, w: 110, h: 160 },
    orange: { x: 186, y: 136, w: 150, h: 160 },
    grape: { x: 378, y: 136, w: 110, h: 160 },
    garlic: { x: 540, y: 136, w: 130, h: 160 },
    eggplant: { x: 712, y: 136, w: 130, h: 160 },
    strawberry: { x: 894, y: 136, w: 110, h: 160 },
    cherry: { x: 1066, y: 136, w: 110, h: 160 },
    carrot: { x: 1228, y: 136, w: 130, h: 160 },
    mushroom: { x: 1400, y: 136, w: 130, h: 160 },
    broccoli: { x: 1582, y: 136, w: 110, h: 160 },
    watermelon: { x: 1734, y: 136, w: 150, h: 160 },
    pepper: { x: 1906, y: 136, w: 150, h: 160 },
    kiwi: { x: 2068, y: 136, w: 170, h: 160 },
    lemon: { x: 2250, y: 136, w: 140, h: 160 },
    peach: { x: 2432, y: 136, w: 130, h: 160 },
    peanut: { x: 2604, y: 136, w: 130, h: 160 },
    apple: { x: 2786, y: 136, w: 110, h: 160 },
    tomato: { x: 2948, y: 136, w: 130, h: 160 },
    berries: { x: 3110, y: 136, w: 150, h: 160 },
    grapes2: { x: 3302, y: 136, w: 110, h: 160 },
    pineapple: { x: 3454, y: 136, w: 150, h: 160 },
    melon: { x: 3637, y: 136, w: 130, h: 160 },
  },
};

/**
 * Loader + helpers de dibujo, misma API que assets/spritesheet.js de Arkanoid:
 *   loadSpritesheet(cb)                  — carga la imagen; llama cb al terminar
 *   drawSprite(ctx, name, x, y, w, h)    — dibuja una fruta por nombre, escalada a w×h
 */
let ssImg = null;
let ssLoaded = false;
const ssCallbacks = [];

function loadSpritesheet(cb) {
  if (ssLoaded) {
    cb();
    return;
  }
  ssCallbacks.push(cb);
  if (ssImg) return;

  const img = new Image();
  img.onload = () => {
    ssImg = img;
    ssLoaded = true;
    ssCallbacks.forEach((f) => f());
  };
  img.onerror = () => console.error("Failed to load fruits spritesheet");
  img.src = window.SPRITE_ATLAS.sources.fruits;
}

function drawSprite(ctx, name, x, y, w, h) {
  if (!ssLoaded) return;
  const sp = window.SPRITE_ATLAS.fruits[name];
  if (!sp) return;
  ctx.drawImage(ssImg, sp.x, sp.y, sp.w, sp.h, x, y, w, h);
}

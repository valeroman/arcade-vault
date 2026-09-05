/**
 * Skins de Arcade Vault.
 *
 * Las 3 skins son obligatorias en todos los juegos del catálogo:
 *  - `clasico`: los colores actuales del juego, sin cambios. Es el default y es intocable.
 *  - `neon`:    saturado sobre negro puro, reutilizando los tokens de `app/globals.css`.
 *  - `retro`:   fósforo CRT (verde/ámbar), coherente con `.crt` / `.crt-screen`.
 *
 * Solo color: ninguna skin altera mecánica, balance, velocidad ni puntuación.
 * Todos los valores están validados a contraste WCAG contra el `bg` de su propia
 * skin (>= 4.5:1 para `fg`/`dim`, >= 3:1 para `accent`/`accent2`/`entities`).
 */

export type SkinId = "clasico" | "neon" | "retro";

export type Skin = {
  id: SkinId;
  label: string;
  /** Fondo del canvas. */
  bg: string;
  /** HUD y texto principal. */
  fg: string;
  /** Texto secundario. */
  dim: string;
  /** Líneas de grilla / bordes. */
  grid: string;
  /** Actor principal. */
  accent: string;
  /** Secundario. */
  accent2: string;
  /** Paleta rotatoria (piezas, filas, tipos de bloque). */
  entities: string[];
  /** Velo rgba de pausa / game over. */
  overlay: string;
};

export const SKINS: Record<SkinId, Skin> = {
  /**
   * ASTEROIDS mapea así: `fg` = nave/balas/iconos de vida/HUD, `dim` = subtítulo
   * del overlay, `grid` = borde del power-up, `accent` = etiqueta "3x",
   * `accent2` = llama del propulsor, `entities[size - 1]` = contorno del asteroide.
   * Los valores de `clasico` reproducen exactamente los literales originales.
   */
  clasico: {
    id: "clasico",
    label: "CLÁSICO",
    bg: "#000000",
    fg: "#ffffff",
    dim: "rgba(255,255,255,0.65)",
    grid: "#00ffff",
    accent: "#00ffff",
    accent2: "rgba(255, 130, 0, 0.85)",
    entities: ["#ffffff", "#ffffff", "#ffffff"],
    // Asteroids nunca dibujó velo en el game over: transparente = cero regresión.
    overlay: "rgba(0,0,0,0)",
  },
  neon: {
    id: "neon",
    label: "NEÓN",
    bg: "#000000",
    fg: "#00f5ff",
    dim: "#8a8fb5",
    grid: "#ff006e",
    accent: "#f5ff00",
    accent2: "#ff006e",
    entities: ["#f5ff00", "#ff006e", "#00ff88"],
    overlay: "rgba(0,0,0,0.45)",
  },
  retro: {
    id: "retro",
    label: "RETRO",
    bg: "#020a04",
    fg: "#33ff66",
    dim: "#1f9d4d",
    grid: "#ffb000",
    accent: "#ffcf3a",
    accent2: "#ff8a00",
    entities: ["#7dff9f", "#33ff66", "#1fbf55"],
    overlay: "rgba(2,10,4,0.5)",
  },
};

export const DEFAULT_SKIN: SkinId = "clasico";

const STORAGE_KEY = "av_skin";

function isSkinId(value: unknown): value is SkinId {
  return value === "clasico" || value === "neon" || value === "retro";
}

/** Resuelve una skin por id, con fallback a `clasico`. */
export function getSkin(id: string | null | undefined): Skin {
  return isSkinId(id) ? SKINS[id] : SKINS[DEFAULT_SKIN];
}

/** Lee la skin persistida. Seguro en SSR (devuelve el default). */
export function readSkin(): SkinId {
  if (typeof window === "undefined") return DEFAULT_SKIN;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isSkinId(raw) ? raw : DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

/** Persiste la skin elegida. Silencioso si localStorage no está disponible. */
export function writeSkin(id: SkinId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* modo privado / cuota: la skin simplemente no persiste */
  }
}

/**
 * Aplica alfa a un color de skin. Acepta `#rgb`, `#rrggbb` y `rgb()/rgba()`
 * (en cuyo caso multiplica el alfa existente). Se usa para efectos que se
 * desvanecen, como las partículas de explosión de Asteroids.
 */
export function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));

  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(color);
  if (short) {
    const [, r, g, b] = short;
    return `rgba(${parseInt(r + r, 16)},${parseInt(g + g, 16)},${parseInt(b + b, 16)},${a.toFixed(2)})`;
  }

  const long = /^#([0-9a-f]{6})$/i.exec(color);
  if (long) {
    const h = long[1];
    return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a.toFixed(2)})`;
  }

  const rgb = /^rgba?\(([^)]+)\)$/i.exec(color);
  if (rgb) {
    const parts = rgb[1].split(",").map((p) => parseFloat(p.trim()));
    const [r, g, b, existing = 1] = parts;
    return `rgba(${r},${g},${b},${(existing * a).toFixed(2)})`;
  }

  return color;
}

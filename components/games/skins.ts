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

/** `games.id` de los juegos del catálogo (nunca es el slug de la ruta). */
export type SkinGameId = "rocas" | "tetro" | "ladrillos" | "vibora";

/**
 * Override por juego. Existe porque `clasico` es, por definición, "el aspecto
 * actual de cada juego": los campos base no pueden servir a los cuatro a la vez
 * (el `accent` clásico de Asteroids es el cian de la nave, el de Snake es el
 * verde de la cabeza). Un juego sin entrada aquí consume los campos base.
 */
export type SkinOverride = Partial<Omit<Skin, "id" | "label" | "games">>;

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
  /**
   * Paleta rotatoria (piezas, filas, tipos de bloque). Se indexa con módulo,
   * así que su longitud puede variar entre skins sin romper a ningún juego.
   */
  entities: string[];
  /** Velo rgba de pausa / game over. */
  overlay: string;
  /** Ajustes específicos de un juego, aplicados sobre los campos de arriba. */
  games?: Partial<Record<SkinGameId, SkinOverride>>;
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
    games: {
      // SNAKE mapea así: `accent` = cabeza, `accent2` = cuerpo, `fg` = HUD y
      // texto de PAUSA/GAME OVER, `entities` = paleta de la fruta procedural
      // (solo neon/retro; en clásico la fruta sigue siendo el sprite del PNG).
      vibora: {
        accent: "#7cfc00",
        accent2: "#2ecc40",
        overlay: "rgba(0, 0, 0, 0.6)",
      },
      // ARKANOID mapea así: `fg` = HUD, pelota, vidas y texto de los overlays,
      // `accent2` = pala, `entities[i]` = tinte de cada `BlockColor` en el orden
      // de `BLOCK_TINT_ORDER` (`arkanoid/sprites.ts`), `overlay` = velo de
      // PAUSA / GAME OVER. En clásico el spritesheet se dibuja tal cual, sin
      // re-tinte: solo hace falta recuperar su velo original al 60% de negro.
      ladrillos: {
        overlay: "rgba(0, 0, 0, 0.6)",
      },
      // TETRIS mapea así: `bg` = relleno del tablero, `grid` = líneas de la
      // rejilla, `entities[type - 1]` = los 8 tipos de pieza (I, O, T, S, Z, J,
      // L, N) y `fg` al 12% = el brillo superior del bloque. El HUD (SCORE /
      // LINES / LEVEL) es DOM, lo pinta el design system, no la skin.
      // Estos 8 valores son los literales originales de `tetris/engine.ts`.
      tetro: {
        grid: "#22222e",
        entities: [
          "#4dd0e1", // I - cyan
          "#ffd54f", // O - yellow
          "#ba68c8", // T - purple
          "#81c784", // S - green
          "#e57373", // Z - red
          "#90caf9", // J - pale blue
          "#ffb74d", // L - orange
          "#9e9e9e", // N - tuerca (gris metálico)
        ],
      },
    },
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
    games: {
      // Fruta en gama magenta/violeta para que nunca se confunda con la
      // serpiente (amarillo + verde) ni con el HUD (cian).
      vibora: {
        accent: "#f5ff00",
        accent2: "#00ff88",
        entities: ["#ff006e", "#ff5ec7", "#c77dff"],
        overlay: "rgba(0, 0, 0, 0.6)",
      },
      // Siete tintes de bloque bien separados en tono, ninguno igual a la pala
      // (magenta `accent2`) ni a la pelota/HUD (cian `fg`).
      ladrillos: {
        entities: [
          "#c7d0e0", // gray
          "#ff2d55", // red
          "#f5ff00", // yellow
          "#00ffd5", // cyan
          "#c77dff", // magenta
          "#ff8a00", // hotpink
          "#00ff88", // green
        ],
        overlay: "rgba(0, 0, 0, 0.6)",
      },
      // Ocho piezas distinguibles sobre negro puro, apoyadas en los tokens de
      // `app/globals.css` (cian, amarillo, verde, magenta, plata). La rejilla
      // baja a un azul casi negro: el `grid` base (magenta) taparía las piezas.
      tetro: {
        grid: "#16163a",
        entities: [
          "#00f5ff", // I
          "#f5ff00", // O
          "#ff5cff", // T
          "#00ff88", // S
          "#ff2b7a", // Z
          "#6aa8ff", // J
          "#ff9a00", // L
          "#c7d0e0", // N
        ],
      },
    },
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
    games: {
      // Serpiente en fósforo verde, fruta en ámbar: los dos fósforos clásicos
      // de un CRT, sin que la fruta se pierda sobre el cuerpo.
      vibora: {
        accent: "#7dff9f",
        accent2: "#2fd463",
        entities: ["#ffb000", "#ffcf3a", "#ff8a00"],
        overlay: "rgba(2, 10, 4, 0.6)",
      },
      // Gama corta de fósforo: cuatro verdes y tres ámbares, alternados para que
      // dos filas contiguas nunca compartan tono. Ninguno coincide con la pala
      // (`accent2` ámbar) ni con la pelota/HUD (`fg` verde).
      ladrillos: {
        entities: [
          "#8fbf9c", // gray
          "#ff6a1f", // red
          "#ffcf3a", // yellow
          "#7dff9f", // cyan
          "#12d97a", // magenta
          "#ffb000", // hotpink
          "#2fd977", // green (más apagado que `fg`: la pelota nunca se camufla)
        ],
        overlay: "rgba(2, 10, 4, 0.6)",
      },
      // Gama corta de fósforo: cuatro verdes y cuatro ámbares alternados para
      // que dos piezas contiguas nunca compartan tono. Rejilla en verde muy
      // apagado (el `grid` base ámbar competiría con las piezas ámbar).
      tetro: {
        grid: "#0c2a15",
        entities: [
          "#7dff9f", // I
          "#ffcf3a", // O
          "#33ff66", // T
          "#2fd977", // S
          "#ff8a00", // Z
          "#8fffd0", // J
          "#ffb000", // L
          "#b6c9a6", // N
        ],
      },
    },
  },
};

export const DEFAULT_SKIN: SkinId = "clasico";

const STORAGE_KEY = "av_skin";

function isSkinId(value: unknown): value is SkinId {
  return value === "clasico" || value === "neon" || value === "retro";
}

/**
 * Resuelve una skin por id, con fallback a `clasico`. Si se pasa `game`, aplica
 * encima su override (`SKINS[id].games[game]`); sin `game` devuelve la paleta
 * base tal cual.
 */
export function getSkin(
  id: string | null | undefined,
  game?: SkinGameId,
): Skin {
  const base = isSkinId(id) ? SKINS[id] : SKINS[DEFAULT_SKIN];
  const override = game ? base.games?.[game] : undefined;
  return override ? { ...base, ...override } : base;
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

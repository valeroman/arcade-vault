# Guía técnica de port — referencia para /add-game

Patrones verificados en el código real del repo. La skill `/add-game` lee esto en la Fase 2/4 para que el plan de implementación de la spec cite rutas, funciones y clases reales — no inventadas.

---

## El patrón que ya funciona: `components/games/AsteroidsGame.tsx`

Es el único juego portado hoy y la referencia a replicar. Esqueleto real (684 líneas):

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { submitScore } from "@/app/data/scores";

const W = 800; const H = 600;          // tamaño fijo de canvas, a nivel de módulo

export default function AsteroidsGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const restartRef = useRef<(() => void) | null>(null);

  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    if (finalScore === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true); setSaveError(null);
    try {
      await submitScore("rocas", trimmed, finalScore);   // ← id hardcodeado hoy; parametrizar
      setSaved(true);
    } catch {
      setSaveError("NO SE PUDO GUARDAR. INTENTA DE NUEVO.");
    } finally { setSaving(false); }
  };
  const handleRestart = () => restartRef.current?.();
  const handleClose = () => setFinalScore(null);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;

    // ── TODO el estado del juego vive aquí dentro, en el closure ──
    const keys: Record<string, boolean> = {};
    const justPressed: Record<string, boolean> = {};
    function pressed(code: string) {                 // lectura de un solo uso
      const val = justPressed[code]; justPressed[code] = false; return val;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;   // ← guard obligatorio
      if (!keys[e.code]) justPressed[e.code] = true;
      keys[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => { keys[e.code] = false; };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // clases del juego (Bullet, Asteroid, PowerUp, Ship, Particle)…
    let ship, bullets, asteroids, particles, powerUps, score, lives, level, state, deadTimer;

    function initGame() {
      // resetea TODO el estado del juego…
      score = 0; lives = 3; level = 1; state = "playing";
      setFinalScore(null); setName(""); setSaving(false); setSaved(false); setSaveError(null);
    }

    function killShip() {
      lives--;
      if (lives <= 0) { state = "gameover"; setFinalScore(score); }   // ← canvas → React
      else { state = "dead"; deadTimer = 2; }
    }

    function update(dt: number) { /* … */ }
    function draw() { /* … */ }

    let lastTime: number | null = null;
    let rafId: number;
    function loop(ts: number) {
      const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05); // clamp 50ms
      lastTime = ts;
      update(dt); draw();
      rafId = requestAnimationFrame(loop);
    }

    restartRef.current = initGame;
    initGame();
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);   // deps vacío — monta una sola vez

  return (
    <>
      <canvas ref={canvasRef} width={W} height={H} />
      {finalScore !== null && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{finalScore.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase().slice(0, 20))}
                  placeholder="TU NOMBRE" maxLength={20} />
                <button className="btn yellow" onClick={handleSave}
                  disabled={saving || name.trim().length === 0}>
                  {saving ? "GUARDANDO…" : "GUARDAR"}
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            {saveError && <div style={{ color: "var(--magenta)", fontSize: 11, marginTop: 8 }}>{saveError}</div>}
            <div className="actions">
              <button className="btn yellow" onClick={handleRestart}>JUGAR DE NUEVO</button>
              <Link href="/games/rocas" className="btn ghost">VER RANKING</Link>  {/* ← parametrizar */}
              <button className="btn ghost" onClick={handleClose}>CERRAR</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

**Al portar un juego nuevo, extrae el motor (clases + `update`/`draw`/`loop`/`initGame`) a un `engine.ts` separado** en vez de repetir todo inline en el `useEffect` — el motor original de Asteroids está inline porque fue el primero; los siguientes deben separar motor (`engine.ts`, sin JSX ni React) de wrapper (`<Nombre>Game.tsx`, monta/desmonta + overlay). La API mínima del motor:

```ts
export type EngineHandle = { restart: () => void; destroy: () => void };
export type EngineCallbacks = {
  onGameOver: (score: number) => void;
  onHud?: (hud: Record<string, number>) => void;   // solo si el HUD original era DOM
};
export function createGame(canvas: HTMLCanvasElement, cb: EngineCallbacks): EngineHandle;
```

`destroy()` debe cancelar el `requestAnimationFrame` pendiente y quitar todos los listeners — igual que el cleanup del `useEffect` de arriba.

---

## Módulos de datos a reutilizar tal cual (no tocar)

- `app/data/games.ts` — `getGames()`, `getGame(id)`, `deriveCats(games)`, `formatPlays(n)`, `difficultyStars(d)`. El tipo `Game` gana `route: string` solo si la spec introduce esa migración.
- `app/data/scores.ts` — `getTopScores(gameId, limit)`, `submitScore(gameId, playerName, score)`. Ambos ya genéricos por `gameId`.
- `utils/supabase/client.ts` — `createClient()` (browser client, usado incluso desde Server Components porque RLS permite `select` anónimo).
- `components/LibraryClient.tsx`, `components/GameCard.tsx`, `app/games/page.tsx`, `app/hall-of-fame/page.tsx` — 100% data-driven, no requieren cambios al añadir un juego.

---

## Convenciones de estilo (obligatorias)

**El proyecto NO usa utilidades Tailwind para la UI arcade**, pese a tener Tailwind v4 instalado. Toda la interfaz son clases globales escritas a mano en `app/globals.css` (`.card`, `.btn`, `.chip`, `.modal*`, `.leaderboard`, `.cover-*`, `.av-grid`, `.pixel`, `.neon-cyan`) más `style={{}}` puntual para casos únicos. Un juego nuevo sigue la misma convención: añadir CSS a `globals.css`, no introducir utility soup ni `tailwind.config.js`.

Tokens (`:root` en `globals.css`):
```
--bg #0a0a0f  --bg-2 #0f0f18  --bg-3 #15151f
--ink #e6e9ff --ink-dim #8a8fb5 --ink-faint #4a4f70
--cyan #00f5ff --magenta #ff006e --yellow #f5ff00 --green #00ff88
--gold #ffcf3a --silver #c7d0e0 --bronze #d97a3a
--pixel var(--font-pixel)  --mono var(--font-mono)
```

`.btn` variantes existentes: `.btn` (cyan por defecto), `.btn.magenta`, `.btn.yellow`, `.btn.ghost`, tamaños `.lg`/`.xl`, animación `.pulse`. **No existe `.btn.green`** — si el color elegido es `green`, decidir explícitamente en la spec si el botón usa el cyan por defecto o si se añade la variante.

Cover art: `game.cover` es un nombre de clase CSS, no una imagen. Patrón (`cover-rocas` real):
```css
.cover-rocas { background: radial-gradient(circle at 50% 50%, #0a0a30, #000); }
.cover-rocas::after { content: ""; position: absolute; inset: 0; background: /* gradientes de "arte" */; }
.cover-rocas::before { content: "▲"; position: absolute; left: 48%; top: 44%; color: var(--yellow); text-shadow: 0 0 8px var(--yellow); }
```
Antes de crear una nueva, revisar si ya existe un `.cover-*` huérfano reutilizable (quedaron de un catálogo mock eliminado, p. ej. `cover-tetro`, `cover-bricks`).

El modal de fin de partida es genérico y ya existe completo en `globals.css`: `.modal-bd`, `.modal`, `.modal h2`, `.final-label`, `.final`, `.input-row`, `.actions`, `.toast-saved`. Reusar verbatim, no reinventar.

Texto: toda la UI en español, etiquetas con fuente pixel en mayúsculas, números con `.toLocaleString("es-ES")`, fechas con `new Date(x).toLocaleDateString("es-ES")`.

---

## Trampas conocidas por juego de referencia

| Juego | Trampa | Qué hacer al portar |
| --- | --- | --- |
| `02-asteroids` | Ya portado — usar como referencia, no como target de `/add-game` | — |
| `03-tetris` | HUD en DOM (`getElementById('score'/'lines'/'level')`), `style.css` separado, `.DS_Store`/`.Claude` (carpeta legacy) sueltos en la carpeta | HUD → estado React + JSX con clases del proyecto, nunca `getElementById`. Ignorar archivos que no sean `index.html`/`game.js`/`style.css`. |
| `03-tetris` | `localStorage['tetris-theme']` para claro/oscuro | Descartar — la plataforma no tiene modo claro y tiene su propia identidad visual. |
| `04-arkanoid` | `e.key` en vez de `e.code`; sin `'use strict'` | Normalizar a `e.code` para consistencia con el resto del repo si se reescribe el input. |
| `04-arkanoid` | Arranque asíncrono: `loadSpritesheet(cb)` antes de `requestAnimationFrame` | `createGame()` debe esperar la carga antes del primer frame; `destroy()` debe ser seguro aunque se llame antes de que cargue. |
| `04-arkanoid` | No tiene ninguna tecla/botón de restart — game over es terminal | Decidir en la Fase 3 si se añade "JUGAR DE NUEVO" (recomendado, para consistencia con el resto de la plataforma) o se documenta como decisión consciente de mantenerlo terminal. |
| `04-arkanoid` | Trae `assets/spritesheet-breakout.png` + `assets/sounds/*.mp3` con rutas relativas (`'assets/sounds/ball-bounce.mp3'`) | Copiar a `public/games/arkanoid/...` y reescribir cada ruta a absoluta (`/games/arkanoid/assets/sounds/ball-bounce.mp3`). |
| Todos | `dt` sin clamp (arkanoid) puede producir "spiral of death" en cambios de pestaña | Aplicar el mismo clamp de 50ms que usa Asteroids al portar el loop. |

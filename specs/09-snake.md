---
id: 09
title: SNAKE — Arcade Vault
state: Aprobado
date: 2026-09-01
dependencies: [04, 06]
---

**Objetivo:** Portar Snake (vanilla JS + canvas, sin juego de referencia previo — construido
en esta sesión en `references/resources/started-games/05-snake/`) a `/games/snake`,
integrarlo en el catálogo de Supabase con su fila en `games`, y conectar el guardado real
de puntajes a `scores` siguiendo el patrón de Asteroids/Tetris/Arkanoid.

## Scope

### Incluido

- Fila de Snake en la tabla `games` de Supabase (id `vibora`, `route = '/games/snake'`;
  la columna `route` ya existe desde la spec 07. `id` ≠ slug de `route` a propósito —
  ver Decisiones, mismo motivo que rocas/tetro/ladrillos).
- Ruta `/games/snake` — página Next.js con el canvas centrado sobre fondo negro.
- Motor portado en `components/games/snake/engine.ts`.
- Componente `components/games/SnakeGame.tsx` — wrapper client que monta el canvas,
  conecta el motor y muestra el modal de fin de partida.
- Assets originales copiados a `public/games/snake/`: `fruits.png`, con su ruta relativa
  reescrita a absoluta (`/games/snake/fruits.png`).
- Reuso del bloque `.cover-snake` huérfano ya existente en `app/globals.css` como
  `cover` del juego (sin CSS nuevo de cover art).
- Nueva variante `.btn.green` en `app/globals.css` (border-color y hover con glow
  `var(--green)`, mismo patrón que `.btn.magenta`/`.btn.yellow`) — necesaria porque
  `color = 'green'` no tiene variante hoy.
- Normalización de input a `e.code` (el original usa `e.key`) para consistencia con
  el resto del repo, con el guard obligatorio de `HTMLInputElement`.
- Arranque asíncrono respetado: `createGame()` espera `loadSpritesheet()` (carga de
  `fruits.png`) antes del primer frame; `destroy()` es seguro aunque se llame antes
  de que la imagen cargue.
- Clamp de `dt` a 50ms en el loop (el original no lo tiene) para evitar "spiral of
  death" al cambiar de pestaña.
- Guardado real de puntaje: `submitScore("vibora", nombre, score)` al perder,
  visible en `/games/vibora` (detalle/leaderboard vía `[id]`) y `/hall-of-fame`.

### No incluido

- Controles táctiles / mobile.
- Fullscreen API.
- Selector de dificultad/velocidad — la velocidad de tick (120ms) queda fija, igual
  que en el original.
- Tests.

## Data model

Sin nuevas estructuras compartidas — la columna `route` ya existe desde la spec 07.
El estado del juego (`snake[]`, `direction`, `pendingDirection`, `fruit`, `score`,
`gameState`, `tickAccumulator`, detectados en el dossier del `game.js` original) vive
dentro del closure de `createGame()` en `engine.ts` — nunca en scope global ni en
variables de módulo compartidas entre montajes.

Fila a insertar en `games`:

```sql
insert into games (id, title, short, long, cat, cover, color, difficulty, route) values
('vibora', 'SNAKE',
 'Come frutas, crece y evita chocar contra ti mismo.',
 'El clásico juego de la víbora. Guía a la serpiente por un tablero de 20×20 casillas,
  come las 22 frutas del huerto para crecer y sumar puntos — pero cuidado: chocar
  contra la pared o contra tu propio cuerpo termina la partida al instante.',
 'ARCADE', 'cover-snake', 'green', 1, '/games/snake');
```

## Implementation plan

1. **Fila en Supabase** — añadir el `insert` (bloque de arriba) a `supabase/schema.sql` y aplicarlo con el MCP `supabase`.
   _Verificación:_ `select * from games where id = 'vibora'` devuelve la fila.

2. **Assets** — copiar `assets/fruits.png` a `public/games/snake/fruits.png`. Reescribir la única ruta relativa del original (`SPRITE_ATLAS.sources.fruits`) a absoluta: `/games/snake/fruits.png`.

3. **Cover** — confirmar que `.cover-snake` en `app/globals.css` no está referenciado por ninguna fila existente de `games` antes de reusarlo (ya verificado: solo `cover-rocas`, `cover-tetro` y `cover-bricks` están en uso). No se añade CSS nuevo de cover art.

4. **`.btn.green`** — añadir la variante a `app/globals.css` junto a `.btn.magenta`/`.btn.yellow`: `border-color: var(--green)` y hover con `box-shadow`/`color` en verde, mismo patrón exacto que las dos variantes existentes. **Ajuste detectado durante la implementación:** `components/GameCard.tsx` mapeaba `btnClass` con un ternario que solo reconocía `magenta`/`yellow` (dejando `green` — y cualquier color futuro no listado — en el cyan por defecto); se generaliza a `["magenta","yellow","green"].includes(game.color) ? game.color : ""` para que la tarjeta del catálogo también respete `color = 'green'`. Ver Decisiones.

5. **`components/games/snake/engine.ts`** — portar `game.js` + `assets/sprites.js` a `createGame(canvas, callbacks): EngineHandle`, con todo el estado en el closure:
   - `SPRITE_ATLAS` y `loadSpritesheet`/`drawSprite` (de `assets/sprites.js`) se internalizan en el mismo módulo o en un archivo hermano `sprites.ts` sin JSX.
   - `loadSpritesheet(cb)` se envuelve en un callback interno; `createGame()` no llama `requestAnimationFrame` hasta que `fruits.png` cargó. Si `destroy()` se invoca antes de que cargue, cancela el callback pendiente sin lanzar.
   - Modelo de grilla preservado igual: `COLS=20`, `ROWS=20`, `CELL=30` (canvas 600×600).
   - Tick de movimiento preservado: acumulador de `dt` que dispara `moveSnake()` cada `STEP_MS=120` — velocidad fija, independiente del framerate.
   - Input: reemplazar los listeners de `document` por `window`, cambiar `e.key` → `e.code` (`ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`, `KeyP`, `Enter`, `Space`), con el guard `if (e.target instanceof HTMLInputElement) return;`.
   - `gameState` FSM (`'playing'|'paused'|'gameover'`) se preserva igual que el original; al entrar a `'gameover'`, llamar `callbacks.onGameOver(score)`.
   - HUD: ya es on-canvas (dibujado en `draw()`), se preserva tal cual — no requiere `onHud` callback ni JSX de HUD.
   - `restart()` reexpone `initGame()` — el original ya lo tenía (Enter/Espacio en gameover), se mantiene el mismo comportamiento pero disparado desde el botón de React en vez del listener directo de teclado en gameover.
   - `destroy()` cancela el `requestAnimationFrame` pendiente y quita los listeners de teclado.
     _Verificación:_ el motor compila sin referencias a `document`/`window` fuera de los listeners registrados y removidos explícitamente.

6. **`components/games/SnakeGame.tsx`** — wrapper siguiendo el patrón de `ArkanoidGame.tsx`/`TetrisGame.tsx`: estados `finalScore/name/saving/saved/saveError`, `useEffect` que monta `createGame(canvasRef.current, { onGameOver })` y desmonta con `destroy()`, guard de teclado para inputs, modal reutilizando `.modal-bd`/`.modal`/`.final`/`.input-row`/`.actions`/`.toast-saved` con botones `.btn.green`, `submitScore("vibora", …)`, enlace "VER RANKING" a `/games/vibora` (detalle/leaderboard vía `[id]`), botón "JUGAR DE NUEVO" llamando `restartRef.current?.()`.
   _Verificación:_ jugar, perder, ver el modal, pulsar "JUGAR DE NUEVO" y confirmar que el juego reinicia sin recargar la página.

7. **`app/games/snake/page.tsx`** — server component copiando `app/games/asteroids/page.tsx` (flex centrado, fondo negro).
   _Verificación:_ `/games/snake` carga con Nav visible.

8. **Prueba de extremo a extremo** — jugar una partida, comer varias frutas de tipos distintos (confirmar que el score sube +10 c/u y la serpiente crece), perder chocando contra la pared y, en otra corrida, chocando contra el propio cuerpo, guardar el puntaje, verlo reflejado en `/hall-of-fame` y en `/games/vibora`.

Ningún paso toca `GameCard.tsx`, `LibraryClient.tsx`, `app/games/page.tsx` ni `app/hall-of-fame/page.tsx` — ya son data-driven y muestran la fila nueva de `games` automáticamente.

## Acceptance criteria

- [ ] `/games/snake` carga sin errores en el browser.
- [ ] El canvas aparece centrado sobre fondo negro dentro del layout de Arcade Vault (Nav visible).
- [ ] El juego arranca automáticamente al entrar a la página, incluso con la carga asíncrona de `fruits.png`.
- [ ] La serpiente responde a ← ↑ → ↓ con el mismo giro discreto que el original (no permite revertir 180° sobre sí misma).
- [ ] El HUD muestra el score correcto, igual que el original.
- [ ] Comer una fruta hace crecer a la serpiente y suma +10 al score; aparece una fruta nueva de tipo aleatorio.
- [ ] Chocar contra la pared o contra el propio cuerpo termina la partida y aparece el modal con la puntuación final.
- [ ] "JUGAR DE NUEVO" reinicia el juego desde cero sin recargar la página.
- [ ] Guardar el puntaje inserta una fila real en `scores` con `game_id = 'vibora'`.
- [ ] Escribir un espacio en el input de nombre no reinicia el juego.
- [ ] El puntaje guardado aparece en `/hall-of-fame` (tab correspondiente) y en `/games/vibora`.
- [ ] `/games/vibora` (vía `/games/[id]`) muestra "JUGAR AHORA" apuntando a `/games/snake`, sin ser tapada por la ruta estática jugable.
- [ ] Al navegar fuera de `/games/snake` y volver, el juego no acumula listeners ni loops huérfanos.
- [ ] La tarjeta de Snake aparece en `/games` con título, descripción y enlace funcional, usando `.cover-snake` y botón `.btn.green`.
- [ ] `npm run build` no tiene errores de TypeScript ni imports rotos.
- [ ] No hay regresiones en `/`, `/games`, `/games/rocas`, `/games/tetris`, `/games/arkanoid`, `/hall-of-fame`, `/about`, `/auth`.

## Decisions taken and discarded

| Decisión                             | Elegido                                     | Por qué                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id` de Supabase vs. slug de `route` | `id='vibora'`, `route='/games/snake'`       | Mismo problema resuelto en Arkanoid: una ruta estática (`app/games/snake/page.tsx`) siempre gana sobre la dinámica `[id]` para la misma URL, así que la vista de detalle/leaderboard quedaría inalcanzable si `id='snake'`. Se separa `id` del slug, igual que rocas→asteroids, tetro→tetris, ladrillos→arkanoid.                                                 |
| Categoría (`cat`)                    | `ARCADE` (reusada)                          | Snake encaja como arcade clásico igual que Arkanoid; no justifica una categoría nueva solo para un juego.                                                                                                                                                                                                                                                         |
| Color (`color`)                      | `green`                                     | Temático (víbora verde), coincide con los acentos ya presentes en `.cover-snake`.                                                                                                                                                                                                                                                                                 |
| Variante `.btn.green`                | Añadida                                     | `.btn` no tenía variante green; se decidió agregarla (en vez de caer al cyan por defecto) para que los botones del modal combinen con el resto de la ficha del juego.                                                                                                                                                                                             |
| `GameCard.tsx` no mapeaba `green`    | Generalizado el ternario a un `.includes()` | Ambigüedad detectada en el Paso 4: la spec decía "ningún paso toca `GameCard.tsx`" pero pedía el botón `.btn.green` en la tarjeta del catálogo — `btnClass` solo reconocía `magenta`/`yellow` y dejaba `green` en el cyan por defecto. Se generalizó a `["magenta","yellow","green"].includes(game.color) ? game.color : ""`, decisión confirmada por el usuario. |
| Dificultad                           | `1`                                         | Mecánica más simple del catálogo: un solo eje de reto (evitar chocar), velocidad fija sin niveles ni aceleración.                                                                                                                                                                                                                                                 |
| Cover (`cover`)                      | Reuso de `.cover-snake` huérfano            | Ya existía en `globals.css`, literalmente temático (puntos verdes/magenta simulando víbora y fruta). Cero CSS nuevo de cover art.                                                                                                                                                                                                                                 |
| Input (`e.key` → `e.code`)           | Normalizado a `e.code`                      | El original usa `e.key`; se alinea con el patrón ya establecido en Asteroids/Tetris/Arkanoid portados.                                                                                                                                                                                                                                                            |
| Arranque asíncrono                   | Preservado, encapsulado en `createGame()`   | El original carga `fruits.png` antes del primer frame; el motor portado espera esa carga y es seguro si `destroy()` llega antes de que termine.                                                                                                                                                                                                                   |
| Clamp de `dt`                        | Añadido (50ms)                              | Mismo clamp que Asteroids/Arkanoid para evitar "spiral of death" al cambiar de pestaña; el original no lo tenía.                                                                                                                                                                                                                                                  |
| Tick de movimiento fijo              | Preservado (`STEP_MS=120`)                  | Es la mecánica central de Snake (velocidad constante independiente del framerate); se porta tal cual el acumulador del original.                                                                                                                                                                                                                                  |
| Restart                              | Preservado                                  | El original ya tenía restart (Enter/Espacio en `gameover`); se conserva la misma funcionalidad, ahora también disponible como botón "JUGAR DE NUEVO" en el modal de React.                                                                                                                                                                                        |
| Migración de `route`                 | No aplica                                   | Ya se hizo en la spec 07 (Tetris); Snake solo inserta su fila con `route` directo.                                                                                                                                                                                                                                                                                |

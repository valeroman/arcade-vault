---
id: 07
title: TETRIS — Arcade Vault
state: Aprobado
date: 2026-08-31
dependencies: [02, 04, 06]
---

**Objetivo:** Portar Tetris (vanilla JS + canvas) a `/games/tetris`, integrarlo en el
catálogo de Supabase con su fila en `games`, introducir la columna `route` en `games`
(hoy no existe — Asteroids está hardcodeado a `/games/asteroids`), y conectar el
guardado real de puntajes a `scores` siguiendo el patrón de Asteroids.

## Scope

### Incluido

- Columna `route` en `games` (no existe todavía) y su consumo en `app/games/[id]/page.tsx`, reemplazando el `href="/games/asteroids"` hardcodeado.
- Fila de Tetris en la tabla `games` de Supabase (id `tetris`).
- Ruta `/games/tetris` — página Next.js con el canvas centrado sobre fondo negro.
- Motor portado en `components/games/tetris/engine.ts`, incluyendo HUD vía callback (`onHud`) en vez de `getElementById`.
- Componente `components/games/TetrisGame.tsx` — wrapper client que monta el canvas, conecta el motor, renderiza el HUD (score/lines/level) y el preview de "siguiente pieza" en React, y muestra el modal de fin de partida.
- Bloque de estilos: reutilización de `.cover-tetro` (huérfano existente en `app/globals.css:407`) como cover de Tetris — no se crea CSS nuevo para el cover.
- Guardado real de puntaje: `submitScore("tetris", nombre, score)` al perder, visible en `/games/tetris` y `/hall-of-fame`.

### No incluido

- Controles táctiles / mobile.
- Fullscreen API.
- Tests.
- Toggle de tema claro/oscuro y su `localStorage['tetris-theme']` — la plataforma no tiene modo claro, se descarta.
- Nueva variante `.btn.green` — no aplica, se usa `cyan` (default).
- Traducción de `style.css` original — se descarta entero, la UI usa las clases globales del proyecto (`.card`, `.btn`, `.modal*`, etc.).

## Data model

Sin nuevas estructuras compartidas salvo la migración `route`. El estado del juego (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `dropAccum`, `animId`) vive dentro del closure de `createGame()` en `engine.ts` — nunca en scope global ni en variables de módulo compartidas entre montajes.

Migración `route`:

```sql
alter table games add column route text;
update games set route = '/games/asteroids' where id = 'rocas';
alter table games alter column route set not null;
```

```ts
// app/data/games.ts — Game gana un campo:
route: string;
```

Fila a insertar en `games`:

```sql
insert into games (id, title, short, long, cat, cover, color, difficulty, route) values
('tetris', 'TETRIS', 'Encaja piezas y despeja líneas antes de que se acumulen.',
 'El clásico juego de bloques. Rota y posiciona las 7 piezas estándar (más una pieza extra) para completar líneas horizontales. La velocidad aumenta con cada nivel — usa la pieza fantasma para planear tu caída.',
 'PUZZLE', 'cover-tetro', 'cyan', 3, '/games/tetris');
```

## Implementation plan

1. **Migración `route`** — `alter table games add column route text`, backfill `update games set route = '/games/asteroids' where id = 'rocas'`, `alter table games alter column route set not null`; añadir `route: string` al tipo `Game` en `app/data/games.ts`; en `app/games/[id]/page.tsx` cambiar `<Link href="/games/asteroids" className="btn xl pulse">` (línea 65) por `href={game.route}`.
   _Verificación:_ `select route from games` devuelve `/games/asteroids` para `rocas`, sin nulls.
2. **Fila en Supabase** — añadir el `insert` de Tetris a `supabase/schema.sql` y aplicarlo con el MCP `supabase`.
   _Verificación:_ `select * from games where id = 'tetris'` devuelve la fila con `route = '/games/tetris'`.
3. **Cover** — confirmar reutilización de `.cover-tetro` (ya existe en `app/globals.css:407`); no se toca CSS de covers.
4. **`components/games/tetris/engine.ts`** — portar la lógica de `game.js` (referencia: `references/resources/started-games/03-tetris/game.js`) a `createGame(canvas, nextCanvas, callbacks): EngineHandle`:
   - Constantes `COLS=10`, `ROWS=20`, `BLOCK=30`, `COLORS[1..8]`, `PIECES[1..8]`, `LINE_SCORES=[0,100,300,500,800]` tal cual.
   - Funciones puras portadas sin cambios de lógica: `createBoard`, `randomPiece`, `collide`, `rotateCW`, `tryRotate`, `merge`, `clearLines`, `ghostY`, `hardDrop`, `softDrop`, `lockPiece`, `spawn`, `drawBlock`, `drawGrid`, `draw`, `drawNext`.
   - `drawGrid()` deja de leer `getComputedStyle(document.body).getPropertyValue('--grid-line')` — usa un color fijo (p. ej. `#22222e`, el valor del tema oscuro original) ya que no hay toggle de tema.
   - `updateHUD()` deja de tocar `getElementById` — llama `cb.onHud({ score, lines, level })`.
   - `endGame()` deja de manipular `overlay`/`overlayTitle` — llama `cb.onGameOver(score)`.
   - `togglePause()` se mantiene igual (booleano `paused`, no hay overlay propio que dibujar desde el motor — el wrapper decide si muestra un overlay de pausa vía `onHud`/estado propio, opcional).
   - Listener de teclado: un solo `keydown` con `switch(e.code)` igual al original (`ArrowLeft/Right/Down/Up`, `KeyX`, `Space`, `KeyP`), con el guard `if (e.target instanceof HTMLInputElement) return;` añadido al inicio.
   - `restart()` = re-ejecuta el cuerpo de `init()` (crea board, resetea score/lines/level/paused/gameOver/dropInterval/dropAccum, `next = randomPiece()`, `spawn()`, relanza `requestAnimationFrame(loop)`).
   - `destroy()` cancela `animId` con `cancelAnimationFrame` y remueve el listener de `keydown`.
   - Clamp de `dt` a 50ms en `loop()` igual que Asteroids (evita "spiral of death" en cambios de pestaña) — el `game.js` original no lo tiene.
     _Verificación:_ el motor compila sin JSX ni referencias a `document.getElementById`.
5. **`components/games/TetrisGame.tsx`** — wrapper siguiendo el patrón de `AsteroidsGame.tsx`:
   - Estados: `hud` (`{score, lines, level}`), `finalScore/name/saving/saved/saveError`.
   - `useEffect` monta `createGame(canvasRef.current, nextCanvasRef.current, { onHud: setHud, onGameOver: setFinalScore })` una sola vez (deps `[]`), guarda `restart` en `restartRef`, cleanup llama `destroy()`.
   - JSX: `<canvas>` 300×600 para el tablero + `<canvas>` 120×120 para "next", panel lateral con HUD en React (`SCORE`/`LINES`/`LEVEL` leídos de `hud`), reemplazando el `<aside class="panel">` del HTML original con las clases equivalentes que ya existan en `globals.css` (o `style={{}}` puntual si no hay clase genérica de panel — no crear utility soup).
   - Modal de fin de partida: reutilizar `.modal-bd`/`.modal`/`.final-label`/`.final`/`.input-row`/`.actions`/`.toast-saved` tal cual el de Asteroids, con `submitScore("tetris", trimmed, finalScore)` y `<Link href="/games/tetris" className="btn ghost">VER RANKING</Link>`.
   - Botón "JUGAR DE NUEVO" llama `restartRef.current?.()`.
     _Verificación:_ jugar, perder, ver el modal con la puntuación final.
6. **`app/games/tetris/page.tsx`** — server component copiando `app/games/asteroids/page.tsx` (flex centrado, fondo negro).
   _Verificación:_ `/games/tetris` carga con Nav visible.
7. **Prueba de extremo a extremo** — jugar una partida de Tetris, perder, guardar el puntaje, verlo reflejado en `/hall-of-fame` y en `/games/tetris`. Verificar también que `/games/rocas` sigue funcionando igual tras la migración `route`.

Ningún paso toca `GameCard.tsx`, `LibraryClient.tsx`, `app/games/page.tsx` ni `app/hall-of-fame/page.tsx` — ya son data-driven y muestran cualquier fila nueva de `games` automáticamente.

## Acceptance criteria

- [ ] `/games/tetris` carga sin errores en el browser.
- [ ] El canvas del tablero y el de "next" aparecen centrados sobre fondo negro dentro del layout de Arcade Vault (Nav visible).
- [ ] El juego arranca automáticamente al entrar a la página.
- [ ] Los controles responden igual que en la versión original (`←`/`→` mover, `↑`/`X` rotar, `↓` soft drop, `Espacio` hard drop, `P` pausa).
- [ ] El HUD (score, lines, level) se muestra vía estado React, no `getElementById`.
- [ ] La pieza fantasma (ghost piece) y el preview de "next" se ven correctamente.
- [ ] Al terminar la partida (pieza nueva colisiona al spawnear) aparece el modal con la puntuación final.
- [ ] Guardar el puntaje inserta una fila real en `scores` con `game_id = 'tetris'`.
- [ ] Escribir un espacio en el input de nombre no reinicia el juego.
- [ ] El puntaje guardado aparece en `/hall-of-fame` (tab correspondiente) y en `/games/tetris`.
- [ ] `/games/tetris` (vía `/games/[id]`) muestra "JUGAR AHORA" apuntando a `/games/tetris` usando `game.route`.
- [ ] `/games/rocas` (vía `/games/[id]`) sigue apuntando correctamente a `/games/asteroids` tras la migración `route`.
- [ ] Al navegar fuera de `/games/tetris` y volver, el juego no acumula listeners ni loops huérfanos (RAF cancelado, keydown removido).
- [ ] La tarjeta de Tetris aparece en `/games` con título, descripción y enlace funcional, categoría `PUZZLE`.
- [ ] `npm run build` no tiene errores de TypeScript ni imports rotos.
- [ ] No hay regresiones en `/`, `/games`, `/games/rocas`, `/hall-of-fame`, `/about`, `/auth`.

## Decisions taken and discarded

| Decisión                                             | Resolución                                                                                                                                                |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Categoría                                            | `PUZZLE` (nueva) — Tetris no encaja en `SHOOTER`, único cat existente.                                                                                    |
| Color                                                | `cyan` — coincide con el azul (`#7aa2f7`) del arte original; es el `.btn` default, sin variante nueva.                                                    |
| Cover                                                | Reusar `.cover-tetro`, huérfano ya existente en `globals.css:407` — cero CSS nuevo.                                                                       |
| Dificultad                                           | 3 (media, curva progresiva por nivel).                                                                                                                    |
| HUD DOM → React                                      | El original usa `getElementById('score'/'lines'/'level')`. Se porta a estado React vía callback `onHud` del motor — nunca `getElementById` en el wrapper. |
| `style.css` separado                                 | Se descarta completo; la UI usa las clases globales del proyecto (`.modal-bd`, `.btn`, etc.), no las clases originales (`.panel`, `.value`, `.label`...). |
| Toggle claro/oscuro + `localStorage['tetris-theme']` | Se descarta — la plataforma no tiene modo claro. `drawGrid()` usa un color de grid fijo en vez de leer la variable CSS del tema.                          |
| Restart                                              | Ya existía (`#restart-btn` → `init()`) — se porta tal cual a `restart()` del motor, sin necesidad de añadirlo.                                            |
| `route` en `games`                                   | No existía (Asteroids hardcodea `/games/asteroids`). Esta spec la introduce, siendo la primera en requerir enrutamiento multi-juego real.                 |
| `dt` sin clamp                                       | El original no clampea `dt` en el loop; se añade clamp de 50ms como en Asteroids para evitar spiral of death.                                             |

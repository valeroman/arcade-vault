# SPEC — Frogger: integración core del juego

> **Estado:** Implementado
> **Depende de:** 06-games-table-leaderboard-supabase
> **Fecha:** 2026-05-20
> **Objetivo:** Integrar Frogger (canvas puro, construido desde cero) como juego jugable en Arcade Vault con `games.id = 'rana'` (ruta `/games/frogger`), conectando score, vidas, nivel y game over vía el motor `engine.ts` y el wrapper estándar de la plataforma.

---

## Scope

**In:**

- INSERT SQL para añadir la fila `rana` a la tabla `games` en Supabase.
- Crear `components/games/frogger/engine.ts` — lógica del juego agnóstica de framework, contrato estándar de la plataforma (igual que Snake/Arkanoid): `createGame(canvas, { onGameOver }) → EngineHandle { restart, destroy }`. Sin callbacks de score/vidas/nivel ni prop `paused` externa — el HUD (score, vidas, nivel, temporizador) se dibuja íntegramente en canvas y la pausa se maneja dentro del engine.
- Crear `components/games/FroggerGame.tsx` — wrapper `"use client"` con `canvasRef`/`restartRef`, los cinco state vars estándar (`finalScore`, `name`, `saving`, `saved`, `saveError`), `handleSave`/`handleRestart`/`handleClose`, `useEffect` de montaje único que crea el engine sobre el canvas (640 × 560 px lógicos) y hace `handle.destroy()` en el cleanup, más el modal de game over — mismo patrón que `SnakeGame.tsx`.
- Game loop construido desde cero en `engine.ts`: cuadrícula de 16 columnas × 14 filas de 40 × 40 px. El mapa vertical se divide en tres zonas fijas: zona segura inferior (fila 13 — base de inicio), zona de carretera (filas 12–8, 5 carriles de tráfico), zona de río (filas 7–2, 6 carriles fluviales) y zona de metas (fila 1, 5 bocas destino).
- Entidades de carretera: coches y camiones de distintas longitudes (1–3 celdas), velocidades y direcciones por carril; se mueven horizontalmente en loop continuo; colisión con la rana es letal.
- Entidades de río: troncos (longitud 2–4 celdas) y tortugas (grupos de 2–3) por carril; se mueven horizontalmente. La rana sólo sobrevive en el río si está encima de un tronco o tortugas visibles; si cae al agua, muere. Las tortugas pueden sumergirse periódicamente (fase visible → bajo el agua → visible); mientras están bajo el agua no sirven de apoyo.
- Movimiento de la rana: basado en saltos discretos de 1 celda (40 px) en 4 direcciones (↑ ↓ ← →); cada pulsación desplaza la rana exactamente una celda tras completar una animación de salto de 120 ms. La rana no puede moverse fuera de los bordes laterales.
- Condición de meta alcanzada: la rana llega a una de las 5 bocas destino de la fila superior (cada boca ocupa 2 columnas de las 16). Una boca ya ocupada no puede volver a usarse en la misma ronda. Al rellenar las 5 bocas se completa la ronda y comienza la siguiente.
- Condición de muerte: (a) colisión con vehículo, (b) caída al agua, (c) sumergirse la tortuga bajo la rana, (d) salir por los bordes izquierdo/derecho del río, (e) agotar el temporizador de ronda (15 s iniciales reducidos en niveles altos).
- Sistema de vidas: la rana arranca con 3 vidas (estado interno del engine, `lives`). Cada muerte resta 1 vida. Si `lives` llega a 0, se llama `cb.onGameOver(score)` y el loop se detiene.
- Puntuación: +10 pts por cada celda avanzada hacia arriba por primera vez en la ronda; +50 pts al ocupar una boca destino; +200 pts al completar una ronda; +bonus de tiempo = `tiempo_restante × 10` al ocupar una boca.
- Temporizador de ronda visible en HUD: 15 s por defecto, decrementado en rondas altas.
- HUD interno del canvas (score top-left, vidas como iconos de rana top-right, nivel top-center, barra de tiempo en la fila 0) — único HUD, dibujado por `draw()`, mismo patrón que Snake/Arkanoid.
- Pausa: tecla `KeyP` alterna un `gameState` interno (`"playing" | "paused" | "gameover"`) dentro de `engine.ts`; en pausa, `update()` no ejecuta lógica pero `draw()` sigue dibujando un overlay "PAUSA" — mismo mecanismo que `snake/engine.ts`.
- Limpiar los event listeners (`keydown` en `window`) en `destroy()`.
- Crear `app/games/frogger/page.tsx` — server page de 17 líneas que centra `FroggerGame` en negro, mismo patrón que `app/games/{asteroids,tetris,arkanoid,snake}/page.tsx`.
- Guardar score al terminar: modal React pre-rellena nombre desde `localStorage` (`av_player_name`), inserta con `submitScore("rana", playerName, score)` de `app/data/scores.ts` y persiste el nombre para la próxima partida.

**Fuera de alcance:**

- Sprites bitmap externos — todos los elementos se dibujan con primitivas canvas (rectángulos, arcos, formas compuestas) con colores temáticos; no se carga ninguna imagen.
- Controles táctiles o mobile (los añade `mobile-porter` en un paso posterior de la cadena).
- Skins (`clasico`/`neon`/`retro`) — las añade `skin-designer` en un paso posterior de la cadena; este spec entrega el engine "clásico" sin parametrizar colores.
- Animaciones de muerte elaboradas (explosiones, partículas) — se cubre en spec secundario.
- Power-ups especiales (mosca en la boca destino, cocodrilo disfrazado de tronco) — se cubre en spec secundario.
- Supabase Auth y RLS — no se agrega `user_id`; la tabla `scores` no tiene esa columna.
- Realtime en el leaderboard.
- Componente genérico `CanvasGame` (YAGNI).

---

## Data model

### INSERT en tabla `games`

```sql
INSERT INTO games (id, title, short, long, cat, cover, color, route)
VALUES (
  'rana',
  'FROGGER',
  'Cruza la carretera y el río sin convertirte en papilla.',
  'Guía a tu rana a través de una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.',
  'ARCADE',
  'cover-rana',
  'green',
  '/games/frogger'
);
```

Tres ajustes sobre el data model original del spec:

- `id = 'rana'` (no `'frogger'`): mismo patrón que `tetro`/`ladrillos`/`vibora` — id en español distinto del slug de `route` en inglés. Si `id` fuera `'frogger'` igual que el route `/games/frogger`, la ruta estática ganaría siempre sobre `/games/[id]` para esa misma URL y la página de detalle/leaderboard quedaría inalcanzable (convención crítica de la plataforma).
- `cover = 'cover-rana'` (no `'cover-frogger'`): bloque huérfano ya existente en `globals.css:825` (catálogo mock eliminado), temáticamente de rana/agua — se reutiliza en vez de crear un `.cover-frogger` nuevo, mismo criterio que Arkanoid reusando `.cover-bricks`.
- `color = 'green'` (no `'lime'`): el check constraint de `games.color` y el union type `Game['color']` en `app/data/games.ts` solo aceptan `cyan/magenta/yellow/green`. Snake (`vibora`) ya usa `'green'` — el color no es único por juego, solo estilo del chip/badge. `route` se incluye explícitamente porque la columna es `NOT NULL` sin default.

### Contrato del engine (`components/games/frogger/engine.ts`)

```ts
export type EngineCallbacks = {
  onGameOver: (score: number) => void;
};
export type EngineHandle = {
  restart: () => void;
  destroy: () => void;
};
// createGame(canvas: HTMLCanvasElement, cb: EngineCallbacks): EngineHandle
```

Mismo contrato mínimo que `snake/engine.ts` (antes de que `skin-designer` le añada `skin?`/`setSkin`, que no es parte de este spec). El estado (`lives`, `score`, `level`) vive en el closure de `createGame`, nunca en callbacks externos ni en variables de módulo.

No se introducen nuevas tablas ni tipos TypeScript de Supabase — se reutilizan `Game` (`app/data/games.ts`) y `ScoreRow`/`submitScore` (`app/data/scores.ts`). `lib/supabase/types.ts` no existe en este repo (no hay carpeta `lib/`); descartado.

---

## Implementation plan

1. **INSERT en Supabase** — ejecutar el SQL del data model en el SQL Editor de Supabase.
   Verificación: la fila `rana` aparece en el Table Editor; `/games` muestra la card FROGGER con cover `cover-rana` y color `green`.

2. **Definir constantes y tipos** dentro de `components/games/frogger/engine.ts`:

   ```ts
   const COLS = 16;
   const ROWS = 14;
   const CELL = 40; // px
   const CANVAS_W = COLS * CELL; // 640
   const CANVAS_H = ROWS * CELL; // 560
   // Zonas (índice de fila, 0 = arriba)
   const ROW_GOALS = 0;
   const ROW_RIVER_TOP = 1;
   const ROW_RIVER_BOT = 6;
   const ROW_SAFE_MID = 7;
   const ROW_ROAD_TOP = 8;
   const ROW_ROAD_BOT = 12;
   const ROW_START = 13;
   ```

   Tipos locales (no exportados):

   ```ts
   type Direction = "up" | "down" | "left" | "right";
   interface Lane {
     row: number;
     speed: number;
     dir: 1 | -1;
     entities: Entity[];
   }
   interface Entity {
     col: number;
     width: number;
     type: "car" | "truck" | "log" | "turtle";
     submerged?: boolean;
   }
   interface Frog {
     col: number;
     row: number;
     animating: boolean;
     animT: number;
     targetCol: number;
     targetRow: number;
   }
   ```

3. **Construir el mapa de carriles** — función `buildLanes(level: number): Lane[]`:
   - Carriles de carretera (filas 8–12): velocidades entre 1.5 y 4 px/frame (escaladas por nivel); sentidos alternos; entidades precargadas con huecos para que sean atravesables.
   - Carriles de río (filas 1–6): velocidades entre 1 y 3 px/frame; troncos de 2–4 celdas con huecos de al menos 1 celda; grupos de tortugas de 2–3 con ciclo de inmersión de 3 s visible / 1.5 s bajo el agua.
   - Cada nivel incrementa todas las velocidades en un 15 %.
     Verificación: al imprimir el array `lanes` en consola, cada carril tiene al menos 2 entidades y los huecos son visibles.

4. **Game loop principal** con `requestAnimationFrame` (clamp de `dt` a 50 ms, igual que los demás engines):
   - Input: `keydown` en `window`, normalizado a `e.code` (flechas `Arrow*` mueven la rana, `KeyP` alterna pausa), con guarda `if (e.target instanceof HTMLInputElement) return;`.
   - `update(dt: number)`:
     - Si `gameState !== "playing"`, saltar toda lógica.
     - Avanzar posición de cada entidad en su carril (`entity.col += lane.speed * lane.dir * dt / 16`); cuando una entidad sale del borde, se reintroduce por el lado opuesto (`col = -entity.width` o `col = COLS`).
     - Si la rana no está animando: comprobar input (`pendingDir`); si hay dirección pendiente, iniciar animación (`animating = true`, `animT = 0`, calcular `targetCol/targetRow`).
     - Si la rana está animando: avanzar `animT += dt`; si `animT >= 120`, completar salto (`col = targetCol`, `row = targetRow`, `animating = false`), resolver lógica de celda destino (detección de muerte/meta/puntuación).
     - Si la rana está en el río y no animando: aplicar el desplazamiento horizontal de la entidad sobre la que descansa (se verifica con `getSupport(frog, lanes)`).
     - Decrementar temporizador de ronda; si llega a 0, muerte por tiempo.
   - `draw()`:
     - Fondo por zonas: negro para carretera, azul oscuro para río, verde oscuro para filas seguras, verde claro para bocas destino.
     - Dibujar entidades de cada carril: coches (rectángulo rojo/amarillo/azul con ruedas circulares), camiones (rectángulo gris con cabina diferenciada), troncos (rectángulo marrón con textura de líneas), tortugas visibles (círculo verde con patrón de escamas), tortugas sumergidas (contorno semitransparente).
     - Dibujar rana: cuerpo verde brillante (elipse 28×24 px) con ojos blancos/negros (dos círculos), patas extendidas durante animación de salto.
     - Dibujar bocas destino: rectángulo de meta verde oscuro con borde dorado; si ocupada, dibujar silueta de rana dentro.
     - HUD interno: score top-left (fuente blanca 16 px), nivel top-center, iconos de rana top-right (un círculo verde por vida), barra de tiempo (rectángulo en fila 0, anchura proporcional al tiempo restante, color verde → amarillo → rojo).
     - Si `gameState === "paused"`, overlay "PAUSA" (igual que `snake/engine.ts`); si `"gameover"`, overlay "GAME OVER" antes de que el wrapper muestre el modal.

5. **Detección de colisiones y soporte**:
   - `checkRoadCollision(frog, lanes)`: itera entidades de carriles de carretera; si `frog.col` está dentro del rango `[entity.col, entity.col + entity.width)` y `frog.row === lane.row`, devuelve `true`.
   - `getSupport(frog, lanes)`: itera entidades de carriles de río; devuelve la entidad cuyo rango cubre la columna de la rana en el mismo carril, o `null`. Si la entidad es una tortuga con `submerged === true`, devuelve `null` (sin soporte).
   - `checkGoal(frog, goals)`: si `frog.row === ROW_GOALS`, calcula la boca que corresponde a `frog.col`; si no está ocupada, la marca y suma puntos; si ya estaba ocupada o `frog.col` no es una boca, es muerte.

6. **Gestión de ronda completada** — `completeRound()`:
   - Resetea la posición de la rana a `ROW_START`, columna central.
   - Vacía las bocas ocupadas.
   - Incrementa `level` (variable interna del engine).
   - Reconstruye los carriles con `buildLanes(level)`.
   - Resetea el temporizador.

7. **Gestión de muerte** — `killFrog()`:
   - Decrementa `lives` (variable interna del engine).
   - Si `lives === 0`: `gameState = "gameover"`, llama `cb.onGameOver(score)`, detiene el loop (`cancelAnimationFrame`).
   - Si `lives > 0`: resetea la posición de la rana a `ROW_START`, columna central; resetea temporizador.

8. **Crear `components/games/FroggerGame.tsx` + `app/games/frogger/page.tsx`**:
   - `FroggerGame.tsx`: mismo esqueleto que `SnakeGame.tsx` — `canvasRef`, `restartRef`, `finalScore`/`name`/`saving`/`saved`/`saveError`, `handleSave` (llama `submitScore("rana", trimmed, finalScore)`), `handleRestart`, `handleClose`, `useEffect` de montaje único (`createGame(canvas, { onGameOver: (score) => setFinalScore(score) })`, cleanup con `handle.destroy()`), bisel `.game-crt` + modal `.modal-bd`/`.modal`/`.final` de fin de partida (nombre pre-rellenado desde `localStorage.getItem('av_player_name')`, persistido al guardar).
   - `app/games/frogger/page.tsx`: wrapper de 17 líneas que centra `<FroggerGame />` en negro (idéntico a `app/games/snake/page.tsx`).
     Verificación: el HUD interno del canvas refleja score, vidas y nivel en tiempo real; no hay HUD React adicional.

9. **Verificación final** — `npm run build` termina sin errores de TypeScript. Ninguna ruta existente devuelve 500.

---

## Acceptance criteria

- [x] La fila `rana` existe en la tabla `games` de Supabase con los valores del data model (`route = '/games/frogger'`).
- [x] La card de Frogger aparece en `/games` con cover `cover-rana` y color `green`.
- [x] La ruta `/games/frogger` carga sin errores de SSR ni de TypeScript.
- [x] El canvas (640 × 560) se renderiza con las tres zonas visualmente diferenciadas (carretera, río, zonas seguras, bocas destino).
- [x] La rana aparece centrada en la fila de inicio al cargar la partida.
- [x] La rana salta exactamente una celda (40 px) por pulsación de tecla de dirección con animación de 120 ms.
- [x] La rana no puede salir por los bordes laterales.
- [x] Los coches y camiones se mueven horizontalmente en loop por sus carriles; se reintroducen por el lado opuesto al salir.
- [x] Los troncos y tortugas se mueven horizontalmente en loop por sus carriles.
- [x] Las tortugas alternan entre visible y sumergida con el ciclo definido.
- [x] La rana muere al ser alcanzada por un vehículo de carretera.
- [x] La rana muere al caer al agua (no estar sobre tronco ni tortugas visibles).
- [x] La rana muere cuando la tortuga que la soporta se sumerge.
- [x] La rana muere al agotar el temporizador de ronda.
- [x] Al morir, se resta 1 vida y la rana vuelve a la fila de inicio; el icono de vidas del HUD interno se actualiza.
- [x] Al llegar a una boca libre, la boca queda marcada y se suma el bonus de puntuación.
- [x] Al llegar a una boca ya ocupada, la rana muere.
- [x] Al completar las 5 bocas, la ronda termina y comienza la siguiente con `level` incrementado.
- [x] El HUD interno (nivel) refleja el incremento al iniciar cada nueva ronda.
- [x] La velocidad de entidades aumenta con cada nivel.
- [x] El temporizador de ronda disminuye con cada nivel.
- [x] El HUD interno del canvas (score, nivel, vidas-iconos, barra de tiempo) se dibuja correctamente y en tiempo real.
- [x] La tecla `KeyP` alterna pausa (overlay "PAUSA") congelando `update()` sin detener `draw()`.
- [x] Escribir en el input del modal de nombre no mueve la rana ni pausa/despausa el juego.
- [x] Al llegar a `lives = 0`, `cb.onGameOver(score)` se dispara; aparece el modal React con overlay "GAME OVER" de fondo.
- [x] El modal pre-rellena el nombre desde `av_player_name` si existe en localStorage.
- [x] Al confirmar el nombre, el score se inserta en Supabase vía `submitScore("rana", name, score)` y el nombre se persiste en localStorage.
- [x] El botón de guardar se deshabilita tras el primer envío (sin doble inserción).
- [x] El botón "JUGAR DE NUEVO" reinicia la partida desde cero (`handle.restart()`).
- [x] El score guardado aparece en `/games/rana` (detalle) y en `/hall-of-fame` al recargar.
- [x] `npm run build` completa sin errores de TypeScript.
- [x] Ninguna ruta existente devuelve 500.

---

## Decisions

- **Sí: Primitivas canvas sin sprites bitmap** — coches, camiones, troncos, tortugas y rana se dibujan con formas geométricas canvas y colores temáticos. Razón: no existen assets de Frogger en el repositorio; dibujar por código elimina dependencias de carga de imágenes y permite ajustar visual sin archivos externos.

- **Sí: Cuadrícula discreta de 40 px con animación de salto de 120 ms** — el movimiento de la rana es celda a celda, no continuo. Razón: mecánica canónica de Frogger; el movimiento discreto simplifica enormemente la detección de colisiones y el soporte en el río al comparar filas/columnas enteras.

- **Sí: HUD único, dibujado en canvas** (no doble HUD React+canvas) — score, vidas, nivel y temporizador se dibujan solo dentro de `draw()`. Razón: coincide con el patrón real de Snake/Arkanoid (2 de los 4 juegos portados); solo Tetris expone HUD vía callback (`onHud`) por venir de un HUD DOM original. Mantiene el contrato de engine mínimo (`{onGameOver}` → `{restart, destroy}`) que `skin-designer`/`mobile-porter` ya saben tratar.

- **Sí: Pausa interna vía tecla `KeyP`** — el engine alterna su propio `gameState` (`"playing"|"paused"|"gameover"`) igual que `snake/engine.ts`, sin prop `paused` externa ni botón "PAUSA"/"REANUDAR" en la play-page (ese control de plataforma no existe en Snake/Arkanoid; lo añadirá `mobile-porter` como parte de la `.game-bottom-bar` en su propio spec/paso).

- **Sí: 3 vidas** — Frogger original arranca con 3 vidas. Razón: fiel a la mecánica clásica; coherente con Arkanoid y Snake.

- **Sí: Tortugas con ciclo de inmersión** — alternan entre soporte y peligro con temporizador independiente por grupo. Razón: mecánica diferenciadora de Frogger respecto a un río de sólo troncos; añade gestión de riesgo sin complejidad de implementación excesiva.

- **Sí: Temporizador de ronda** — 15 s iniciales, decrementados en niveles altos. La muerte por tiempo añade urgencia. Razón: mecánica original de Frogger; impide que el jugador espere indefinidamente en la zona segura.

- **Sí: 5 bocas destino** — requieren llenarse todas para completar la ronda. Razón: mecánica original que da estructura de objetivo claro por ronda sin ser un nivel único lineal.

- **Sí: Canvas 640 × 560 px (16 × 14 celdas de 40 px)** — relación de aspecto vertical cercana a la original. Razón: el mapa de Frogger es vertical (el jugador avanza hacia arriba); un canvas más ancho que alto no representaría bien el recorrido.

- **Sí: `id = 'rana'`, `route = '/games/frogger'`, `cover = 'cover-rana'`** — ver Data model. Razón: evita colisión `id`/route estática y reutiliza un bloque CSS huérfano ya temático.

- **Sí: `components/games/frogger/engine.ts` separado del wrapper** — mismo patrón que Tetris/Arkanoid/Snake (Asteroids es la única excepción histórica ya documentada). Razón: mantiene la cadena `skin-designer` → `mobile-porter` de este mismo comando funcionando sin adaptación manual.

- **Sí: `app/games/frogger/page.tsx` (wrapper de 17 líneas)** — en lugar de una play-page anidada bajo `/play`. Razón: coherencia estructural con los 4 juegos ya portados; `LibraryClient`/`GameCard`/`hall-of-fame` son data-driven y no necesitan cambios.

- **No: Movimiento continuo (interpolado)** — la rana no se desliza; salta de celda en celda. Razón: la interpolación continua requeriría colisiones AABB en espacio continuo para el río y la carretera, aumentando la complejidad sin añadir diversión.

- **No: Cocodrilo disfrazado de tronco ni mosca bonus en bocas** — se cubren en el spec secundario de power-ups y eventos. Razón: son capas de dificultad y recompensa independientes de la mecánica base.

- **No: Componente genérico `CanvasGame`** — cada juego tiene su componente propio. Razón: YAGNI.

- **No: RLS en este spec** — las tablas quedan abiertas (INSERT y SELECT públicos). Razón: se mitiga en el spec futuro de seguridad.

- **No: Realtime en leaderboards** — los scores se ven al recargar. Razón: la complejidad de subscriptions no aporta valor mientras haya pocos jugadores activos.

- **No: Skins ni controles táctiles en este spec** — los aplican `skin-designer` y `mobile-porter` como pasos posteriores de la misma cadena de `/spec-impl-game`, no este spec.

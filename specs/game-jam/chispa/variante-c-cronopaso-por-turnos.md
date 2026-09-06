---
id: 10
title: CHISPA — Arcade Vault
state: Draft
date: 2026-09-03
dependencies: [04, 06]
---

**Objetivo:** Crear CHISPA (juego original de la game jam «Frogger») en `/games/spark`
desde cero con canvas 2D, integrarlo en el catálogo de Supabase con su fila en `games`,
y conectar el guardado real de puntajes a `scores` siguiendo el patrón de
Asteroids/Tetris/Arkanoid/Snake.

**Variante C — Cronopaso: cruce por turnos con previsualización:** el tablero solo avanza
cuando el jugador actúa. Cada pulsación (moverse o esperar) es un tick que desplaza
exactamente una celda a todos los pulsos, y un fantasma semitransparente muestra dónde
caerán en el tick siguiente. No hay reflejos: hay presupuesto de pasos, ruta óptima y
muerte de un solo toque. Las placas se generan con un PRNG sembrado por número de placa,
así que todos los jugadores del leaderboard resuelven exactamente el mismo tablero.

## Scope

### Incluido

- Fila de CHISPA en la tabla `games` de Supabase (id `chispa`, `route = '/games/spark'`;
  la columna `route` ya existe desde la spec 07, no requiere migración. `id` ≠ slug de
  `route` a propósito — ver Decisiones, mismo motivo que rocas/tetro/ladrillos/vibora).
- Ruta `/games/spark` — página Next.js con el canvas centrado sobre fondo negro
  (`app/games/spark/page.tsx`).
- Motor original en `components/games/spark/engine.ts`, con el contrato
  `createGame(canvas, { onGameOver }): EngineHandle`.
- Componente `components/games/SparkGame.tsx` — wrapper client que monta el canvas,
  conecta el motor y muestra el modal de fin de partida.
- Reuso del bloque `.cover-rana` huérfano ya existente en `app/globals.css` como
  `cover` del juego (sin CSS nuevo de cover art) — ver Decisiones.
- Modelo de turnos puro: el mundo no avanza con `dt`; solo `stepWorld()` (llamado por
  input) mueve los pulsos una celda por su carril. El `requestAnimationFrame` se usa
  únicamente para animar la interpolación del salto y el parpadeo del fantasma.
- Tablero fijo de 15×15 celdas de 40 px (canvas 600×640 con franja de HUD), generado por
  `buildBoard(level)` con un PRNG sembrado (`seed = 1000 + level`): mismo número de placa
  → mismo tablero siempre, para que el leaderboard sea comparable.
- Previsualización fantasma: cada pulso dibuja un contorno semitransparente en la celda
  que ocupará tras el próximo tick — la afordancia central de esta variante.
- Presupuesto de pasos: `STEP_BUDGET = 40` por placa; moverse y esperar (`Space`)
  consumen 1 paso cada uno. Quedarse a 0 pasos termina la partida.
- Tres nodos obligatorios por placa repartidos en las filas intermedias: hay que tocar
  los tres (en cualquier orden) antes de que el borde superior cuente como salida.
- Muerte de un solo toque: si un pulso entra en la celda de la chispa, o si chispa y
  pulso intercambian celdas en el mismo tick (regla de swap), la partida termina.
- Scoring: +150 por nodo, +500 al completar placa, +25 por cada paso sobrante y una
  racha `perfectStreak` que suma +250 extra por cada placa resuelta sin esperar ni
  retroceder.
- HUD dibujado on-canvas: score, placa, barra de pasos restantes, los 3 nodos
  (recogido/pendiente), contador de ticks y leyenda "◇ = próxima posición".
- Input normalizado a `e.code` (`ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`,
  `Space` para esperar un tick, `KeyP` para pausa) con el guard obligatorio
  `if (e.target instanceof HTMLInputElement) return;`.
- Guardado real de puntaje: `submitScore("chispa", nombre, score)` al morir o quedarse
  sin pasos, visible en `/games/chispa` (detalle/leaderboard vía `[id]`) y `/hall-of-fame`.

### No incluido

- Controles táctiles / mobile.
- Fullscreen API.
- Tests.
- Assets binarios (sprites, audio): el juego se dibuja 100% por código con primitivas
  de canvas (rectángulos, gradientes, `arc`), igual que Asteroids y Tetris.
- Scroll vertical infinito y score por altura — es la propuesta de la variante A.
- Batería, células, power-ups y capacitores múltiples — variante B.
- Vidas: aquí la muerte es de un solo toque y termina la partida (ver Decisiones).
- Deshacer / rebobinar turnos: se consideró y se descarta porque anula el riesgo y hace
  que cualquier score sea alcanzable con paciencia infinita.
- Carriles de buses sobre vacío: esta variante usa un único tipo de peligro (pulsos) para
  que la previsualización de un tick sea suficiente para razonar la jugada.

## Data model

Sin nuevas estructuras compartidas — la columna `route` ya existe desde la spec 07.
Todo el estado vive dentro del closure de `createGame()` en `components/games/spark/engine.ts`,
nunca en scope global ni en variables de módulo compartidas entre montajes:
`player` (`{ col, row, colFrom, rowFrom, hopT }`), `lanes[]` (15 filas fijas, cada una
`{ row, kind: 'copper' | 'pulse', dir, cells: boolean[] }` con los pulsos en celdas
discretas, no en píxeles), `nodes[]` (`{ col, row, taken }` × 3), `stepsLeft`, `tick`,
`level`, `score`, `perfectStreak`, `usedWait`, `movedDown`, `rng` (PRNG sembrado con
`seed = 1000 + level`), `gameState` (`'playing' | 'paused' | 'levelclear' | 'gameover'`),
`rafId` y `lastTime` (solo para la animación del salto).

Fila a insertar en `games`:

```sql
insert into games (id, title, short, long, cat, cover, color, difficulty, route) values
('chispa', 'CHISPA',
 'Cruza la placa por turnos: cada paso tuyo mueve también a los pulsos.',
 'Un cruce de carriles jugado como ajedrez. La placa solo avanza cuando tú te mueves:
  cada paso desplaza una celda a todos los pulsos de datos, y una previsualización
  fantasma te enseña dónde caerán. Toca los tres nodos y alcanza el borde superior con
  el menor número de pasos posible — un solo contacto y se acabó.',
 'ACCIÓN', 'cover-rana', 'cyan', 2, '/games/spark');
```

Sin migración de `route` — ya existe desde la spec 07. Sin CSS nuevo de cover:
`.cover-rana` (bandas horizontales cian + punto verde brillante) ya existe en
`app/globals.css` y no está referenciado por ninguna fila de `games`.

## Implementation plan

1. **Fila en Supabase** — añadir el `insert` (bloque de arriba) a `supabase/schema.sql`, con un comentario explicando `id ≠ slug de route` igual que los bloques de tetro/ladrillos/vibora, y aplicarlo con el MCP `supabase`.
   _Verificación:_ `select * from games where id = 'chispa'` devuelve la fila con `route = '/games/spark'`.

2. **Cover** — confirmar que `.cover-rana` en `app/globals.css` no está referenciado por ninguna fila existente de `games` (hoy en uso: `cover-rocas`, `cover-tetro`, `cover-bricks`, `cover-snake`) y reusarlo tal cual. No se añade CSS nuevo de cover art.
   _Verificación:_ la tarjeta de CHISPA en `/games` y el panel `.detail-cover` de `/games/chispa` muestran las bandas de carriles sin huecos vacíos.

3. **`components/games/spark/engine.ts`** — motor original con `createGame(canvas, { onGameOver }): EngineHandle` y todo el estado en el closure:
   - Constantes de tablero: `COLS = 15`, `ROWS = 15`, `CELL = 40`, `HUD_H = 40`, canvas `600×640`, `STEP_BUDGET = 40`, `HOP_MS = 90`.
   - `makeRng(seed)` — PRNG determinista (mulberry32 o xorshift de 12 líneas) usado exclusivamente por `buildBoard`; nada de `Math.random()` en la generación, para que la placa N sea idéntica en todas las partidas.
   - `buildBoard(level)` — elige qué filas son `pulse` (entre 6 y 9 según el nivel), su `dir` y su patrón de ocupación (`cells[]` con densidad creciente por nivel), coloca los 3 nodos en filas `copper` distintas y garantiza por construcción que existe al menos una ruta resoluble dentro del presupuesto (validada con una BFS sobre el espacio `(col, row, tick mod periodo)`).
   - `stepWorld()` — el corazón de la variante: desplaza cada carril `pulse` una celda en su `dir` con envolvimiento, incrementa `tick` y descuenta 1 de `stepsLeft`. Se invoca una vez por input aceptado, nunca desde el loop de render.
   - `tryMove(dCol, dRow)` — valida límites, guarda la posición previa, aplica el movimiento del jugador, llama `stepWorld()` y después `resolveTick()`; ignora el input mientras `hopT < 1`.
   - `resolveTick()` — comprueba en este orden: colisión directa (pulso en la celda del jugador), colisión por swap (el jugador y un pulso intercambiaron celdas en el mismo tick), recogida de nodo, salida por el borde superior con los 3 nodos, y `stepsLeft === 0`.
   - `drawGhosts()` — por cada pulso, dibuja el contorno de la celda que ocupará tras el próximo `stepWorld()`; parpadeo suave con `lastTime` para que se distinga del pulso real.
   - `completeLevel()` — `score += 500 + 150 * 3 + 25 * stepsLeft` (+250 si `!usedWait && !movedDown`), `perfectStreak` se actualiza, `level++`, `buildBoard(level)` y `stepsLeft = STEP_BUDGET`.
   - `gameOver(reason)` — pasa a `'gameover'` y llama `callbacks.onGameOver(score)` una sola vez, con `reason` (`'contacto'` | `'sin pasos'`) dibujado en el canvas.
   - `draw()` — placa, carriles, pulsos, fantasmas, nodos, la chispa (interpolada entre `colFrom/rowFrom` y su celda actual) y el HUD on-canvas, todo con primitivas: cero imágenes, cero audio.
   - Loop de render con `dt = Math.min((ts - lastTime) / 1000, 0.05)` usado **solo** para `hopT` y el parpadeo; input en `window` con `e.code` y el guard de `HTMLInputElement`; `restart()` vuelve a la placa 1 con score, pasos y racha a cero; `destroy()` cancela el `requestAnimationFrame` pendiente y quita los listeners.
     _Verificación:_ el motor compila sin referencias a `document`/`window` fuera de los listeners registrados y removidos explícitamente, y sin ninguna variable de estado a nivel de módulo; dejando la pestaña abierta sin tocar el teclado, el tablero no cambia ni una celda.

4. **`components/games/SparkGame.tsx`** — wrapper `"use client"` siguiendo el patrón de `SnakeGame.tsx`: `canvasRef`/`restartRef`, estados `finalScore/name/saving/saved/saveError`, `useEffect` mount-once que monta `createGame(canvasRef.current, { onGameOver })` y desmonta con `handle.destroy()`, guard de teclado para inputs, modal reutilizando `.modal-bd`/`.modal`/`.final`/`.input-row`/`.actions`/`.toast-saved`, `submitScore("chispa", …)`, enlace "VER RANKING" a `/games/chispa` y botón "JUGAR DE NUEVO" llamando `restartRef.current?.()`.
   _Verificación:_ jugar, morir por contacto, ver el modal con el score final, pulsar "JUGAR DE NUEVO" y confirmar que la partida reinicia en la placa 1 sin recargar la página.

5. **`app/games/spark/page.tsx`** — server component copiando `app/games/asteroids/page.tsx` (flex centrado, fondo negro, padding `24px 0`).
   _Verificación:_ `/games/spark` carga con Nav visible y el canvas centrado.

6. **Prueba de extremo a extremo** — resolver las placas 1 y 2, comprobar el bonus de pasos sobrantes y el de placa perfecta, morir por swap (entrar de frente en un pulso que viene hacia ti), guardar el puntaje y verlo reflejado en `/hall-of-fame` y en `/games/chispa`.

7. **Verificación del determinismo** — recargar `/games/spark` tres veces y comprobar que la placa 1 es idéntica celda a celda (mismo layout de carriles, mismos nodos, mismo patrón inicial de pulsos), y que la placa 3 también coincide entre partidas. Sin esto el leaderboard no es comparable.
   _Verificación:_ capturas de la placa 1 en dos partidas distintas son indistinguibles.

8. **Tuning de presupuesto y densidad** — calibrar `STEP_BUDGET` (arranque en 40) y la densidad de pulsos por nivel para que la placa 1 se resuelva cómodamente con ~10 pasos de margen y a partir de la placa 5 el margen sea de 2–3 pasos; comprobar con la BFS de `buildBoard` que ninguna placa generada es irresoluble. Documentar los valores finales como constantes nombradas al inicio del engine.

Ningún paso toca `GameCard.tsx`, `LibraryClient.tsx`, `app/games/page.tsx` ni `app/hall-of-fame/page.tsx` — ya son data-driven y muestran cualquier fila nueva de `games` automáticamente.

## Acceptance criteria

- [ ] `/games/spark` carga sin errores en el browser.
- [ ] El canvas aparece centrado sobre fondo negro dentro del layout de Arcade Vault (Nav visible).
- [ ] El juego arranca automáticamente al entrar a la página, sin esperar ninguna carga de assets.
- [ ] Con el teclado quieto, el tablero no se mueve: los pulsos solo avanzan una celda por cada input aceptado.
- [ ] La chispa responde a ← ↑ → ↓ con saltos discretos de una celda y a `Space` para esperar un tick; ambos descuentan 1 paso.
- [ ] Cada pulso dibuja su fantasma en la celda que ocupará en el próximo tick, distinguible del pulso real.
- [ ] Entrar en la celda de un pulso, o intercambiar celdas con él en el mismo tick (swap), termina la partida al instante.
- [ ] Quedarse sin pasos termina la partida y el modal indica la puntuación final igual que la muerte por contacto.
- [ ] Los 3 nodos deben tocarse antes de que el borde superior cuente como salida; el HUD refleja cuáles faltan.
- [ ] Completar una placa suma 500 + 150 por nodo + 25 por paso sobrante, y +250 extra si no se usó espera ni se retrocedió.
- [ ] La placa N es idéntica entre partidas distintas (generación sembrada), verificado al menos en las placas 1 y 3.
- [ ] "JUGAR DE NUEVO" reinicia desde la placa 1 con score, pasos y racha a cero, sin recargar la página.
- [ ] Guardar el puntaje inserta una fila real en `scores` con `game_id = 'chispa'`; escribir un espacio en el input de nombre no consume un turno ni reinicia el juego.
- [ ] El puntaje guardado aparece en `/hall-of-fame` (tab correspondiente) y en `/games/chispa`; `/games/chispa` (vía `/games/[id]`) muestra "JUGAR AHORA" apuntando a `/games/spark`.
- [ ] `npm run build` no tiene errores de TypeScript ni imports rotos, y `public/games/spark/` no existe (juego 100% procedural).
- [ ] No hay regresiones en `/`, `/games`, `/games/rocas`, `/games/tetro`, `/games/ladrillos`, `/games/vibora`, `/hall-of-fame`, `/about`, `/auth`.

## Decisions taken and discarded

| Decisión                             | Elegido                                                     | Por qué                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id` de Supabase vs. slug de `route` | `id='chispa'`, `route='/games/spark'`                       | En Next.js una ruta estática (`app/games/spark/page.tsx`) siempre gana sobre la dinámica `[id]` para la misma URL: si `id` fuera `spark`, la ficha de detalle/leaderboard sería inalcanzable. Se separa el `id` en español del slug en inglés, igual que rocas→asteroids, tetro→tetris, ladrillos→arkanoid y vibora→snake.                                         |
| Categoría (`cat`)                    | `ACCIÓN` (nueva)                                            | Aunque el turno la acerca al puzzle, el verbo y la lectura visual siguen siendo cruzar carriles con peligros en movimiento; `PUZZLE` ya es de tetro y meterla ahí la escondería entre juegos de piezas. Se mantiene la misma `cat` que las variantes A y B para que la ficha de catálogo del juego sea la misma sea cual sea la variante elegida.                  |
| Color (`color`)                      | `cyan`                                                      | Los cuatro colores están empatados a un juego cada uno; se elige por tema (chispa eléctrica sobre circuito) y porque `.cover-rana` ya pinta sus carriles en cian. `.btn` sin modificador ya es cian: no hace falta CSS nuevo de botón, a diferencia de `.btn.green` en Snake.                                                                                      |
| Dificultad                           | `2`                                                         | Sin presión de reflejos y con información perfecta (fantasmas + turnos), la barrera de entrada es baja: el reto es de planificación, no de ejecución. Queda al nivel de ladrillos (2), por debajo de las variantes A (4) y B (3).                                                                                                                                  |
| Cover (`cover`)                      | Reuso de `.cover-rana` huérfano                             | Sobra del catálogo mock eliminado y dibuja exactamente la identidad del juego: bandas horizontales de carriles cian con una figura brillante cruzándolos. Cero CSS nuevo, igual que Arkanoid con `.cover-bricks` y Snake con `.cover-snake`. El nombre de la clase es un string arbitrario en `games.cover`, no tiene que coincidir con el título.                 |
| Si hubiera que retocar `.cover-rana` | Solo con `radial-gradient`/`linear-gradient` autocontenidos | Trampa documentada en la spec 09: `linear-gradient(...) X% Y% / WxH no-repeat` dentro de `background-image` es inválido (ese sufijo solo existe en el shorthand `background`) y Lightning CSS lo recompila descartando posiciones y tamaños. Cada capa debe llevar posición y tamaño embebidos en la propia función de gradiente.                                  |
| Mecánica núcleo                      | Turnos con previsualización y presupuesto de pasos          | Frente a la variante A (ascenso infinito por scroll forzado) y la B (entregas contrarreloj con power-ups), esta convierte el cruce de carriles en un problema de ruta con información perfecta. Es la única de las tres accesible sin reflejos, la que más se diferencia del resto del catálogo y la más barata de depurar (el estado es discreto y reproducible). |
| Generación de placas                 | PRNG sembrado por número de placa (`seed = 1000 + level`)   | Con `Math.random()` cada jugador resolvería un tablero distinto y el leaderboard mediría suerte. Sembrando por nivel, la placa N es la misma para todos y el score refleja habilidad; además hace los bugs reproducibles a partir del número de placa.                                                                                                             |
| Muerte de un solo toque              | Sin vidas                                                   | Con información perfecta (fantasmas) y turnos, un choque es siempre un error del jugador, no una injusticia del sistema: las vidas solo alargarían la partida. Las 3 vidas se quedan en las variantes A y B, donde el fallo puede venir de un error de lectura en tiempo real.                                                                                     |
| Deshacer turnos                      | Descartado                                                  | Rebobinar convierte cualquier placa en resoluble por fuerza bruta y hace que el score dependa de la paciencia; el presupuesto de pasos ya es la penalización de un plan malo.                                                                                                                                                                                      |
| Regla de swap                        | Cuenta como colisión                                        | Sin ella, entrar de frente en un pulso que viene hacia ti sería seguro (se cruzarían sin solaparse en ninguna celda al final del tick), un agujero clásico de los juegos por turnos en grilla que rompería toda la tensión de los carriles frontales.                                                                                                              |
| Assets binarios                      | Ninguno: 100% procedural                                    | Game jam sin fuente vanilla ni sprites de origen; todo se dibuja con primitivas de canvas como Asteroids y Tetris. No se crea `public/games/spark/` ni un `sprites.ts` hermano, y `createGame()` no necesita arranque asíncrono.                                                                                                                                   |
| Restart                              | Solo vía botón "JUGAR DE NUEVO" (no por teclado)            | Misma decisión ya cerrada en Snake: si el motor escuchara Enter/Espacio reiniciaría el canvas detrás del modal de React sin que este se entere — y aquí es peor todavía, porque `Space` es la tecla de esperar turno. `restart()` se expone únicamente en `EngineHandle`.                                                                                          |
| Input y loop                         | `e.code` + clamp de `dt` a 50 ms (solo para animación)      | `e.code` da independencia del layout de teclado y distingue `Space` sin ambigüedad; el clamp evita saltos de interpolación al volver de una pestaña en segundo plano. El estado de juego no depende de `dt`, así que un cambio de pestaña nunca puede matar al jugador.                                                                                            |
| Migración de `route`                 | No aplica                                                   | La columna existe desde la spec 07 (Tetris); CHISPA solo inserta su fila con `route` directo, y por eso `dependencies` es `[04, 06]` y no incluye `02`.                                                                                                                                                                                                            |

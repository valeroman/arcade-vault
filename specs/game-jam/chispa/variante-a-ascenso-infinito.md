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

**Variante A — Ascenso infinito con scroll forzado:** la placa de circuito se desplaza
hacia abajo sin parar y la chispa tiene que subir para no ser barrida por el borde
inferior de la cámara. No hay meta ni niveles discretos: es una carrera de supervivencia
por altura con carriles generados procedimentalmente que se vuelven más rápidos y más
densos cada 10 filas, con 3 vidas y un multiplicador de combo que premia subir sin
retroceder.

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
- Mundo de scroll vertical infinito: `cameraY` avanza a `scrollSpeed` px/s y las filas
  se generan por delante y se reciclan por detrás, sin array creciente sin límite.
- Tres tipos de fila: `copper` (pista segura), `pulse` (carril de pulsos de datos que
  matan al contacto) y `bus` (canal de vacío con buses móviles que arrastran a la
  chispa; pisar el vacío mata).
- Salto discreto de una celda con interpolación de 90 ms (`hopT`), input normalizado a
  `e.code` (`ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`, `KeyP` para pausa) con el
  guard obligatorio `if (e.target instanceof HTMLInputElement) return;`.
- Sistema de 3 vidas con respawn en la pista de cobre segura más cercana e
  invulnerabilidad parpadeante de 1.5 s.
- Scoring por altura máxima nueva (+10/fila), bonus de sector (+100 cada 10 filas) y
  multiplicador de combo x1→x5 por subir 5 filas seguidas sin retroceder.
- HUD dibujado on-canvas (franja superior): score, vidas, altura en filas, sector y
  multiplicador activo — sin callback `onHud` ni HUD en DOM.
- Clamp de `dt` a 50 ms en el loop, igual que Asteroids/Arkanoid/Snake.
- Guardado real de puntaje: `submitScore("chispa", nombre, score)` al perder la última
  vida, visible en `/games/chispa` (detalle/leaderboard vía `[id]`) y `/hall-of-fame`.

### No incluido

- Controles táctiles / mobile.
- Fullscreen API.
- Tests.
- Assets binarios (sprites, audio): el juego se dibuja 100% por código con primitivas
  de canvas (rectángulos, gradientes, `arc`), igual que Asteroids y Tetris.
- Zócalos/metas al estilo Frogger clásico (las 5 casas) — se descartan aquí porque
  el ascenso es infinito; están en la variante B.
- Modo por turnos / previsualización de obstáculos — es la propuesta de la variante C.
- Power-ups y objetos recolectables: esta variante mantiene un único eje de reto
  (subir sin morir) y deja los ítems para la variante B.
- Niveles discretos, pantalla de "placa completada" y timer de partida.

## Data model

Sin nuevas estructuras compartidas — la columna `route` ya existe desde la spec 07.
Todo el estado vive dentro del closure de `createGame()` en `components/games/spark/engine.ts`,
nunca en scope global ni en variables de módulo compartidas entre montajes:
`player` (`{ col, rowFrom, rowTo, colFrom, colTo, hopT, ridingBusId }`), `lanes[]`
(anillo de filas recicladas, cada una `{ row, kind, dir, speed, gap, offset, entities[] }`),
`cameraY`, `scrollSpeed`, `maxRow` (altura máxima alcanzada, base del score), `score`,
`lives`, `combo`, `comboStreak`, `invulnTimer`, `sector`, `spawnCursor` (fila más alta
ya generada), `gameState` (`'playing' | 'paused' | 'gameover'`), `rafId` y `lastTime`.

Fila a insertar en `games`:

```sql
insert into games (id, title, short, long, cat, cover, color, difficulty, route) values
('chispa', 'CHISPA',
 'Sube por la placa viva antes de que la corriente te barra.',
 'Eres una chispa cruzando una placa de circuito que se desplaza sin parar. Salta de
  pista en pista esquivando pulsos de datos y móntate en los buses que flotan sobre el
  vacío. Cuanto más alto llegas, más rápido corre la corriente — y solo tienes tres
  chispas.',
 'ACCIÓN', 'cover-rana', 'cyan', 4, '/games/spark');
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
   - Constantes de grilla: `COLS = 15`, `CELL = 40`, `HUD_H = 40`, canvas `600×640` fijo (15 columnas visibles × 15 filas + franja de HUD).
   - `makeLane(row)` — generador procedural de filas: elige `kind` (`'copper' | 'pulse' | 'bus'`) según la tabla de pesos del sector actual, con la regla dura de que nunca haya más de 3 filas peligrosas consecutivas ni dos `bus` seguidas al arrancar el sector.
   - `recycleLanes()` — mantiene el anillo de filas: genera por encima de `spawnCursor` y descarta las que quedan bajo `cameraY - CELL`, de forma que `lanes.length` se mantiene acotado.
   - `updateEntities(dt)` — desplaza pulsos y buses por su carril con `dir`/`speed`, envolviendo por los bordes; los buses arrastran a la chispa (`ridingBusId`) sumando su velocidad a la posición del jugador.
   - `hop(dCol, dRow)` — inicia un salto discreto: fija `colFrom/colTo`, `rowFrom/rowTo` y `hopT = 0`; se ignoran las entradas mientras `hopT < 1` (un salto a la vez) y se bloquea salir de `[0, COLS-1]`.
   - `checkCollisions()` — muerte por (a) solaparse con un pulso, (b) terminar el salto sobre una fila `bus` sin bus debajo, (c) que `player.row` caiga por debajo del borde inferior de la cámara. Respeta `invulnTimer`.
   - `addHeightScore()` — cuando `player.rowTo > maxRow`: `score += 10 * combo`, actualiza `maxRow`, incrementa `comboStreak`; a las 5 filas seguidas sin retroceder sube `combo` (máx. x5); retroceder o morir lo resetea a x1.
   - `advanceSector()` — cada 10 filas de `maxRow`: `sector++`, `score += 100`, sube `scrollSpeed` y la velocidad base de los carriles un 8 % acumulativo (con techo).
   - `loseLife()` — `lives--`, reset de combo, respawn en la fila `copper` más cercana bajo la cámara con `invulnTimer = 1.5`; con `lives === 0` pasa a `'gameover'` y llama `callbacks.onGameOver(score)` una sola vez.
   - `draw()` — dibuja placa, carriles, entidades, la chispa (con parpadeo si es invulnerable) y el HUD on-canvas, todo con primitivas: cero imágenes, cero audio.
   - Loop con `dt = Math.min((ts - lastTime) / 1000, 0.05)`; input en `window` con `e.code` y el guard de `HTMLInputElement`; `restart()` reinicia todo el estado del closure; `destroy()` cancela el `requestAnimationFrame` pendiente y quita los listeners.
     _Verificación:_ el motor compila sin referencias a `document`/`window` fuera de los listeners registrados y removidos explícitamente, y sin ninguna variable de estado a nivel de módulo.

4. **`components/games/SparkGame.tsx`** — wrapper `"use client"` siguiendo el patrón de `SnakeGame.tsx`: `canvasRef`/`restartRef`, estados `finalScore/name/saving/saved/saveError`, `useEffect` mount-once que monta `createGame(canvasRef.current, { onGameOver })` y desmonta con `handle.destroy()`, guard de teclado para inputs, modal reutilizando `.modal-bd`/`.modal`/`.final`/`.input-row`/`.actions`/`.toast-saved`, `submitScore("chispa", …)`, enlace "VER RANKING" a `/games/chispa` y botón "JUGAR DE NUEVO" llamando `restartRef.current?.()`.
   _Verificación:_ jugar, morir 3 veces, ver el modal con el score final, pulsar "JUGAR DE NUEVO" y confirmar que la partida reinicia sin recargar la página.

5. **`app/games/spark/page.tsx`** — server component copiando `app/games/asteroids/page.tsx` (flex centrado, fondo negro, padding `24px 0`).
   _Verificación:_ `/games/spark` carga con Nav visible y el canvas centrado.

6. **Prueba de extremo a extremo** — jugar una partida, superar al menos el sector 2, morir por pulso y (en otra corrida) por caída al vacío y por quedar barrido por el borde inferior, guardar el puntaje y verlo reflejado en `/hall-of-fame` y en `/games/chispa`.

7. **Tuning de dificultad** — ajustar `scrollSpeed` inicial (arranque ~18 px/s), el incremento del 8 % por sector y los pesos de `kind` por sector hasta que una partida media de un jugador nuevo dure entre 45 y 90 segundos, y que el sector 5 sea claramente hostil pero no imposible. Documentar los valores finales como constantes nombradas al inicio del engine.
   _Verificación:_ tres partidas seguidas caen dentro de la ventana de duración objetivo.

8. **Repaso de fugas y pausa** — navegar varias veces a `/games/spark` y salir; confirmar con un contador temporal en consola que solo hay un `requestAnimationFrame` activo y un único par de listeners; comprobar que `KeyP` pausa/reanuda sin acumular `dt` (el clamp de 50 ms cubre el regreso de pestaña).

Ningún paso toca `GameCard.tsx`, `LibraryClient.tsx`, `app/games/page.tsx` ni `app/hall-of-fame/page.tsx` — ya son data-driven y muestran cualquier fila nueva de `games` automáticamente.

## Acceptance criteria

- [ ] `/games/spark` carga sin errores en el browser.
- [ ] El canvas aparece centrado sobre fondo negro dentro del layout de Arcade Vault (Nav visible).
- [ ] El juego arranca automáticamente al entrar a la página, sin esperar ninguna carga de assets.
- [ ] La chispa responde a ← ↑ → ↓ con saltos discretos de una celda; no se admite un segundo salto hasta terminar el anterior ni salir del tablero por los laterales.
- [ ] Los carriles de pulsos y los buses se desplazan a velocidades distintas y envuelven por los bordes sin parpadeos.
- [ ] Montarse en un bus arrastra a la chispa con él; quedar sobre el vacío de un carril `bus` mata.
- [ ] El HUD on-canvas muestra score, vidas, altura en filas, sector y multiplicador correctos en todo momento.
- [ ] Alcanzar una fila nueva suma +10 × multiplicador y cada 10 filas otorga el bonus de sector (+100) subiendo la velocidad.
- [ ] Perder una vida respawnea con invulnerabilidad parpadeante y resetea el combo; perder la tercera abre el modal con la puntuación final.
- [ ] "JUGAR DE NUEVO" reinicia la partida desde cero (score, vidas, sector, cámara) sin recargar la página.
- [ ] Guardar el puntaje inserta una fila real en `scores` con `game_id = 'chispa'`.
- [ ] Escribir un espacio en el input de nombre no mueve la chispa ni reinicia el juego.
- [ ] El puntaje guardado aparece en `/hall-of-fame` (tab correspondiente) y en `/games/chispa`.
- [ ] `/games/chispa` (vía `/games/[id]`) muestra "JUGAR AHORA" apuntando a `/games/spark`, sin ser tapada por la ruta estática jugable.
- [ ] `npm run build` no tiene errores de TypeScript ni imports rotos, y `public/games/spark/` no existe (juego 100% procedural).
- [ ] No hay regresiones en `/`, `/games`, `/games/rocas`, `/games/tetro`, `/games/ladrillos`, `/games/vibora`, `/hall-of-fame`, `/about`, `/auth`.

## Decisions taken and discarded

| Decisión                             | Elegido                                                     | Por qué                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id` de Supabase vs. slug de `route` | `id='chispa'`, `route='/games/spark'`                       | En Next.js una ruta estática (`app/games/spark/page.tsx`) siempre gana sobre la dinámica `[id]` para la misma URL: si `id` fuera `spark`, la ficha de detalle/leaderboard sería inalcanzable. Se separa el `id` en español del slug en inglés, igual que rocas→asteroids, tetro→tetris, ladrillos→arkanoid y vibora→snake.                                                                        |
| Categoría (`cat`)                    | `ACCIÓN` (nueva)                                            | No es `SHOOTER` (no se dispara), no es `PUZZLE` (no hay razonamiento, es reflejo puro) y `ARCADE` ya carga dos juegos (ladrillos, vibora). Una categoría nueva aporta un chip de filtro útil en `/games` sin duplicar géneros.                                                                                                                                                                    |
| Color (`color`)                      | `cyan`                                                      | Los cuatro colores están empatados a un juego cada uno; se elige por tema (chispa eléctrica sobre circuito) y porque `.cover-rana` ya pinta sus carriles en cian, así que tarjeta y cover quedan coherentes. `.btn` sin modificador ya es cian: no hace falta CSS nuevo de botón (a diferencia de `.btn.green` en Snake).                                                                         |
| Dificultad                           | `4`                                                         | Es el juego más exigente del catálogo hasta ahora: presión de tiempo permanente (scroll forzado), tres fuentes de muerte simultáneas y aceleración sin techo práctico. Por encima de rocas/tetro (3) y muy por encima de vibora (1).                                                                                                                                                              |
| Cover (`cover`)                      | Reuso de `.cover-rana` huérfano                             | Sobra del catálogo mock eliminado y dibuja exactamente la identidad del juego: bandas horizontales de carriles cian con una figura brillante cruzándolos. Cero CSS nuevo, igual que hicieron Arkanoid con `.cover-bricks` y Snake con `.cover-snake`. El nombre de la clase es un string arbitrario en `games.cover`, no tiene que coincidir con el título.                                       |
| Si hubiera que retocar `.cover-rana` | Solo con `radial-gradient`/`linear-gradient` autocontenidos | Trampa documentada en la spec 09: escribir `linear-gradient(...) X% Y% / WxH no-repeat` dentro de `background-image` es inválido (ese sufijo solo existe en el shorthand `background`), y Lightning CSS recompila el shorthand a `background-image` descartando posiciones y tamaños. Si se ajusta el cover, cada capa debe llevar posición y tamaño embebidos en la propia función de gradiente. |
| Mecánica núcleo                      | Ascenso infinito con scroll forzado                         | Frente a la variante B (entregas contrarreloj con zócalos y power-ups) y la variante C (puzzle por turnos con previsualización), esta es la lectura más pura del verbo "cruzar carriles" y la más barata de implementar: un solo objetivo, sin inventario, sin timer, sin generador determinista. Es también la que mejor produce un leaderboard con cola larga (score no acotado).               |
| Meta al estilo "5 casas" de Frogger  | Descartada en esta variante                                 | Meter zócalos que hay que llenar convierte el juego en rondas con final; rompe el bucle de "una sola subida cada vez más rápida" y duplicaría la mecánica de la variante B. Aquí el techo lo pone la velocidad, no un objetivo.                                                                                                                                                                   |
| Vidas vs. muerte instantánea         | 3 vidas con respawn e invulnerabilidad                      | Con scroll forzado, la muerte instantánea castiga demasiado los errores de lectura de carril en los primeros segundos y acorta las partidas por debajo del minuto. Tres vidas mantienen la tensión sin frustrar; la muerte de un toque queda para el puzzle determinista de la variante C, donde el jugador tiene toda la información.                                                            |
| Multiplicador de combo               | x1→x5 por 5 filas seguidas sin retroceder                   | Da una razón para arriesgar hacia arriba en vez de refugiarse en una pista de cobre esperando huecos, que es la estrategia degenerada obvia de un juego de carriles. El scroll forzado ya la castiga, pero el combo la hace además poco rentable.                                                                                                                                                 |
| Assets binarios                      | Ninguno: 100% procedural                                    | Es una game jam sin fuente vanilla ni sprites de origen; todo se dibuja con primitivas de canvas como Asteroids y Tetris. No se crea `public/games/spark/` ni un `sprites.ts` hermano, y `createGame()` no necesita arranque asíncrono: puede pintar el primer frame de inmediato.                                                                                                                |
| Restart                              | Solo vía botón "JUGAR DE NUEVO" (no por teclado)            | Misma decisión ya cerrada en Snake: si el motor escuchara Enter/Espacio, reiniciaría el canvas detrás del modal de React sin que este se entere, dejando el modal abierto sobre una partida ya en curso. `restart()` se expone únicamente en `EngineHandle`.                                                                                                                                      |
| Input y loop                         | `e.code` + clamp de `dt` a 50 ms                            | Convención hand-replicada en los cuatro motores del repo: `e.code` para independencia del layout de teclado y clamp para evitar el "spiral of death" al volver de una pestaña en segundo plano (crítico aquí, porque el scroll acumulado mataría al jugador al regresar).                                                                                                                         |
| Migración de `route`                 | No aplica                                                   | La columna existe desde la spec 07 (Tetris); CHISPA solo inserta su fila con `route` directo, y por eso `dependencies` es `[04, 06]` y no incluye `02`.                                                                                                                                                                                                                                           |

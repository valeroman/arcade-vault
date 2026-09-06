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

**Variante B — Entregas contrarreloj con capacitores y power-ups:** el tablero es fijo
(sin scroll) y la partida se estructura en placas: hay que llevar cinco cargas, una por
una, desde la barra de tierra inferior hasta los cinco capacitores vacíos del borde
superior antes de que la batería se descargue. Cada entrega recarga el reloj, hay células
de energía que dan segundos y puntos, y dos power-ups (EMP y SOBRECARGA) que cambian el
ritmo de la placa. La presión es de reloj y de ruta, no de scroll.

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
- Tablero fijo de 15×15 celdas de 40 px (canvas 600×640 con franja de HUD): fila de
  tierra abajo, 5 carriles de pulsos, una pista de cobre intermedia, 4 canales de buses
  de datos y la fila de 5 capacitores arriba.
- Bucle de entrega: la chispa nace en la tierra con una carga, cruza, deposita en un
  capacitor libre y vuelve a nacer abajo con la siguiente carga. Depositar en un
  capacitor ya ocupado cuesta una vida.
- Batería como timer de entrega: barra que se agota en `BATTERY_MS = 14000` y se
  recarga al completar cada entrega; llegar a 0 cuesta una vida.
- Células de energía: aparecen sobre un bus aleatorio cada ~8 s, dan +4 s de batería y
  +200 puntos al recogerlas.
- Dos power-ups temporales con icono y cuenta atrás en el HUD: `EMP` (congela todos los
  pulsos 3 s) y `SOBRECARGA` (x2 puntos durante 10 s).
- Progresión por placas: completar los 5 capacitores da +1000, sube un nivel, acelera
  los carriles un 10 % y añade un carril con dirección invertida.
- Sistema de 3 vidas con respawn en la tierra e invulnerabilidad de 1.5 s.
- Salto discreto de una celda con interpolación de 90 ms, input normalizado a `e.code`
  (`ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`, `KeyP` para pausa) con el guard
  obligatorio `if (e.target instanceof HTMLInputElement) return;`.
- HUD dibujado on-canvas: score, nivel de placa, vidas, barra de batería, los 5
  capacitores (ocupados/libres) y el power-up activo con su cuenta atrás.
- Clamp de `dt` a 50 ms en el loop, igual que Asteroids/Arkanoid/Snake.
- Guardado real de puntaje: `submitScore("chispa", nombre, score)` al perder la última
  vida, visible en `/games/chispa` (detalle/leaderboard vía `[id]`) y `/hall-of-fame`.

### No incluido

- Controles táctiles / mobile.
- Fullscreen API.
- Tests.
- Assets binarios (sprites, audio): el juego se dibuja 100% por código con primitivas
  de canvas (rectángulos, gradientes, `arc`), igual que Asteroids y Tetris.
- Scroll vertical infinito y score por altura — es la propuesta de la variante A.
- Modo por turnos con previsualización determinista de obstáculos — variante C.
- Más de dos power-ups, inventario o power-ups acumulables: solo puede haber uno activo
  y uno en el tablero a la vez, para no convertir el HUD en un panel de inventario.
- Enemigos que persigan a la chispa (tipo cocodrilo/serpiente del Frogger original): los
  carriles se mantienen deterministas por carril, sin IA de persecución.

## Data model

Sin nuevas estructuras compartidas — la columna `route` ya existe desde la spec 07.
Todo el estado vive dentro del closure de `createGame()` en `components/games/spark/engine.ts`,
nunca en scope global ni en variables de módulo compartidas entre montajes:
`player` (`{ col, row, colFrom, colTo, rowFrom, rowTo, hopT, ridingBusId }`), `lanes[]`
(las 15 filas fijas del tablero, cada una `{ row, kind, dir, speed, gap, offset, entities[] }`),
`capacitors[]` (5 booleanos + su columna), `battery` (ms restantes), `level`, `score`,
`lives`, `deliveries`, `pickup` (célula activa o `null`), `powerUp`
(`{ kind: 'emp' | 'overload', remaining } | null`), `frozenTimer`, `invulnTimer`,
`rowsVisited` (Set para no pagar dos veces la misma fila en una entrega),
`gameState` (`'playing' | 'paused' | 'levelclear' | 'gameover'`), `rafId` y `lastTime`.

Fila a insertar en `games`:

```sql
insert into games (id, title, short, long, cat, cover, color, difficulty, route) values
('chispa', 'CHISPA',
 'Reparte carga entre capacitores antes de que se agote la batería.',
 'Eres una chispa mensajera en una placa de circuito. Cruza los carriles de pulsos y los
  buses de datos para llenar los cinco capacitores de cada placa antes de que tu batería
  se descargue. Recoge células de energía y dispara EMP o SOBRECARGA para ganar segundos
  y multiplicar puntos.',
 'ACCIÓN', 'cover-rana', 'cyan', 3, '/games/spark');
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
   - Constantes de tablero: `COLS = 15`, `ROWS = 15`, `CELL = 40`, `HUD_H = 40`, canvas `600×640`; `BOARD_LAYOUT` describe el tipo de cada fila (`ground`, `pulse`, `copper`, `bus`, `sockets`) como un array literal de 15 entradas.
   - `buildLevel(level)` — arma `lanes[]` desde `BOARD_LAYOUT` aplicando la velocidad base × `1.1 ** (level - 1)`, y a partir del nivel 2 invierte `dir` en un carril adicional por nivel.
   - `updateEntities(dt)` — mueve pulsos y buses por su carril con envolvimiento; si `frozenTimer > 0` (EMP activo) los pulsos no avanzan pero los buses sí, para que el EMP no bloquee la ruta.
   - `hop(dCol, dRow)` — salto discreto de una celda con `hopT` de 90 ms; se ignora el input durante el salto y en los límites del tablero.
   - `checkCollisions()` — muerte por pulso, por caer al canal (fila `bus` sin bus debajo) y por depositar en un capacitor ocupado; respeta `invulnTimer`.
   - `deliver(socketIndex)` — marca el capacitor, suma `50 + Math.round(battery / 1000) * 20` (bonus de batería restante) × multiplicador de SOBRECARGA, resetea `battery` y `rowsVisited`, respawnea en la tierra; si los 5 están llenos, `score += 1000`, `level++` y `buildLevel(level)`.
   - `spawnPickup()` / `spawnPowerUp()` — temporizadores independientes (~8 s y ~15 s) que colocan como máximo una célula y un power-up simultáneos sobre buses o pistas de cobre; recoger célula: `+200` y `battery += 4000`.
   - `applyPowerUp(kind)` — `'emp'` fija `frozenTimer = 3`; `'overload'` fija `powerUp = { kind:'overload', remaining: 10 }` y duplica todo lo que sume score mientras dure.
   - `drainBattery(dt)` — descuenta `dt` de `battery`; a 0 llama `loseLife()` con el motivo "batería agotada".
   - `loseLife()` — `lives--`, respawn en tierra con `invulnTimer = 1.5` y `battery` al máximo; con `lives === 0` pasa a `'gameover'` y llama `callbacks.onGameOver(score)` una sola vez.
   - `draw()` — placa, carriles, entidades, células, power-ups, capacitores (vacío/lleno), la chispa con su carga y el HUD on-canvas, todo con primitivas: cero imágenes, cero audio.
   - Loop con `dt = Math.min((ts - lastTime) / 1000, 0.05)`; input en `window` con `e.code` y el guard de `HTMLInputElement`; `restart()` reinicia nivel, score, vidas, batería y capacitores; `destroy()` cancela el `requestAnimationFrame` pendiente y quita los listeners.
     _Verificación:_ el motor compila sin referencias a `document`/`window` fuera de los listeners registrados y removidos explícitamente, y sin ninguna variable de estado a nivel de módulo.

4. **`components/games/SparkGame.tsx`** — wrapper `"use client"` siguiendo el patrón de `SnakeGame.tsx`: `canvasRef`/`restartRef`, estados `finalScore/name/saving/saved/saveError`, `useEffect` mount-once que monta `createGame(canvasRef.current, { onGameOver })` y desmonta con `handle.destroy()`, guard de teclado para inputs, modal reutilizando `.modal-bd`/`.modal`/`.final`/`.input-row`/`.actions`/`.toast-saved`, `submitScore("chispa", …)`, enlace "VER RANKING" a `/games/chispa` y botón "JUGAR DE NUEVO" llamando `restartRef.current?.()`.
   _Verificación:_ jugar, agotar las 3 vidas, ver el modal con el score final, pulsar "JUGAR DE NUEVO" y confirmar que la partida reinicia en la placa 1 sin recargar la página.

5. **`app/games/spark/page.tsx`** — server component copiando `app/games/asteroids/page.tsx` (flex centrado, fondo negro, padding `24px 0`).
   _Verificación:_ `/games/spark` carga con Nav visible y el canvas centrado.

6. **Prueba de extremo a extremo** — completar una placa entera (5 entregas), pasar al nivel 2 y ver el carril invertido, perder una vida por batería agotada y otra por pulso, guardar el puntaje y verlo reflejado en `/hall-of-fame` y en `/games/chispa`.

7. **Ajuste de células y power-ups** — verificar que nunca hay más de una célula y un power-up en el tablero, que EMP no deja la ruta bloqueada (los buses siguen moviéndose) y que SOBRECARGA duplica también el bonus de batería y el de placa completa; ajustar cadencias de aparición hasta que en una placa media aparezcan ~3 células y ~1 power-up.
   _Verificación:_ dos placas seguidas respetan esos rangos y el HUD refleja siempre el power-up activo con su cuenta atrás.

8. **Tuning de la curva de placas** — calibrar `BATTERY_MS` (arranque en 14 s) y el factor 1.1 por nivel para que un jugador nuevo complete la placa 1 sin agobio y falle habitualmente entre las placas 4 y 6. Documentar los valores finales como constantes nombradas al inicio del engine.

Ningún paso toca `GameCard.tsx`, `LibraryClient.tsx`, `app/games/page.tsx` ni `app/hall-of-fame/page.tsx` — ya son data-driven y muestran cualquier fila nueva de `games` automáticamente.

## Acceptance criteria

- [ ] `/games/spark` carga sin errores en el browser.
- [ ] El canvas aparece centrado sobre fondo negro dentro del layout de Arcade Vault (Nav visible).
- [ ] El juego arranca automáticamente al entrar a la página, sin esperar ninguna carga de assets.
- [ ] La chispa responde a ← ↑ → ↓ con saltos discretos de una celda; no se admite un segundo salto hasta terminar el anterior ni salir del tablero por los laterales.
- [ ] Los carriles de pulsos y los buses se desplazan a velocidades distintas y envuelven por los bordes sin parpadeos; montarse en un bus arrastra a la chispa.
- [ ] Depositar una carga en un capacitor libre lo marca como lleno, suma el bonus de batería restante y respawnea a la chispa en la tierra con el reloj recargado.
- [ ] Depositar en un capacitor ya ocupado, caer al canal, tocar un pulso o agotar la batería cuestan una vida cada uno.
- [ ] Llenar los 5 capacitores da +1000, avanza de placa, acelera los carriles e invierte un carril adicional.
- [ ] El HUD on-canvas muestra score, placa, vidas, barra de batería, los 5 capacitores y el power-up activo con su cuenta atrás.
- [ ] Las células dan +200 y +4 s de batería; EMP congela los pulsos 3 s sin congelar los buses; SOBRECARGA duplica los puntos 10 s.
- [ ] Perder la tercera vida abre el modal con la puntuación final y "JUGAR DE NUEVO" reinicia desde la placa 1 sin recargar la página.
- [ ] Guardar el puntaje inserta una fila real en `scores` con `game_id = 'chispa'`.
- [ ] Escribir un espacio en el input de nombre no mueve la chispa ni reinicia el juego.
- [ ] El puntaje guardado aparece en `/hall-of-fame` (tab correspondiente) y en `/games/chispa`; `/games/chispa` (vía `/games/[id]`) muestra "JUGAR AHORA" apuntando a `/games/spark`.
- [ ] `npm run build` no tiene errores de TypeScript ni imports rotos, y `public/games/spark/` no existe (juego 100% procedural).
- [ ] No hay regresiones en `/`, `/games`, `/games/rocas`, `/games/tetro`, `/games/ladrillos`, `/games/vibora`, `/hall-of-fame`, `/about`, `/auth`.

## Decisions taken and discarded

| Decisión                             | Elegido                                                     | Por qué                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id` de Supabase vs. slug de `route` | `id='chispa'`, `route='/games/spark'`                       | En Next.js una ruta estática (`app/games/spark/page.tsx`) siempre gana sobre la dinámica `[id]` para la misma URL: si `id` fuera `spark`, la ficha de detalle/leaderboard sería inalcanzable. Se separa el `id` en español del slug en inglés, igual que rocas→asteroids, tetro→tetris, ladrillos→arkanoid y vibora→snake.                         |
| Categoría (`cat`)                    | `ACCIÓN` (nueva)                                            | No es `SHOOTER` ni `PUZZLE`, y `ARCADE` ya carga dos juegos (ladrillos, vibora). Una categoría nueva aporta un chip de filtro útil en `/games` sin duplicar géneros.                                                                                                                                                                               |
| Color (`color`)                      | `cyan`                                                      | Los cuatro colores están empatados a un juego cada uno; se elige por tema (chispa eléctrica sobre circuito) y porque `.cover-rana` ya pinta sus carriles en cian. `.btn` sin modificador ya es cian: no hace falta CSS nuevo de botón, a diferencia de `.btn.green` en Snake.                                                                      |
| Dificultad                           | `3`                                                         | Más exigente que ladrillos (2) por la doble presión de ruta y reloj, pero más domable que la variante A (4): el tablero es fijo y memorizable, y los power-ups dan válvulas de escape.                                                                                                                                                             |
| Cover (`cover`)                      | Reuso de `.cover-rana` huérfano                             | Sobra del catálogo mock eliminado y dibuja exactamente la identidad del juego: bandas horizontales de carriles cian con una figura brillante cruzándolos. Cero CSS nuevo, igual que Arkanoid con `.cover-bricks` y Snake con `.cover-snake`. El nombre de la clase es un string arbitrario en `games.cover`, no tiene que coincidir con el título. |
| Si hubiera que retocar `.cover-rana` | Solo con `radial-gradient`/`linear-gradient` autocontenidos | Trampa documentada en la spec 09: `linear-gradient(...) X% Y% / WxH no-repeat` dentro de `background-image` es inválido (ese sufijo solo existe en el shorthand `background`) y Lightning CSS lo recompila descartando posiciones y tamaños. Cada capa debe llevar posición y tamaño embebidos en la propia función de gradiente.                  |
| Mecánica núcleo                      | Entregas contrarreloj con capacitores                       | Frente a la variante A (ascenso infinito por scroll forzado) y la variante C (puzzle determinista por turnos), esta es la que da estructura de rondas, objetivos parciales visibles y un HUD rico; también es la única que produce momentos de decisión ("¿desvío por la célula o entrego ya?") en vez de puro reflejo.                            |
| Timer de batería vs. scroll forzado  | Batería por entrega                                         | Un scroll forzado (variante A) impide un tablero fijo y memorizable, que es justo lo que hace legible la ruta y da sentido a los power-ups. La batería aporta la misma urgencia sin mover la cámara y permite premiar la eficiencia con el bonus de batería restante.                                                                              |
| Power-ups                            | Solo dos (EMP y SOBRECARGA), uno activo a la vez            | Tres o más obligaban a un panel de inventario en el HUD y a reglas de apilado; con dos, el HUD cabe en la franja de 40 px junto a batería y capacitores. Se descartó un tercer power-up de "puente" sobre el canal porque anulaba el subsistema de buses entero.                                                                                   |
| Capacitor ya ocupado                 | Cuesta una vida                                             | Es la penalización del Frogger original por repetir casa; sin ella, la ruta óptima sería siempre la misma columna central y las 5 metas dejarían de importar. Se descartó el rebote sin castigo por ser invisible en el HUD y no enseñar nada al jugador.                                                                                          |
| Assets binarios                      | Ninguno: 100% procedural                                    | Game jam sin fuente vanilla ni sprites de origen; todo se dibuja con primitivas de canvas como Asteroids y Tetris. No se crea `public/games/spark/` ni un `sprites.ts` hermano, y `createGame()` no necesita arranque asíncrono.                                                                                                                   |
| Restart                              | Solo vía botón "JUGAR DE NUEVO" (no por teclado)            | Misma decisión ya cerrada en Snake: si el motor escuchara Enter/Espacio reiniciaría el canvas detrás del modal de React sin que este se entere, dejando el modal abierto sobre una partida ya en curso. `restart()` se expone únicamente en `EngineHandle`.                                                                                        |
| Input y loop                         | `e.code` + clamp de `dt` a 50 ms                            | Convención hand-replicada en los cuatro motores del repo: `e.code` para independencia del layout de teclado y clamp para evitar el "spiral of death" al volver de una pestaña en segundo plano — aquí además evita que la batería se vacíe de golpe tras un cambio de pestaña.                                                                     |
| Migración de `route`                 | No aplica                                                   | La columna existe desde la spec 07 (Tetris); CHISPA solo inserta su fila con `route` directo, y por eso `dependencies` es `[04, 06]` y no incluye `02`.                                                                                                                                                                                            |

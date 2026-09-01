---
id: 08
title: ARKANOID — Arcade Vault
state: Aprobado
date: 2026-09-01
dependencies: [04, 06]
---

**Objetivo:** Portar Arkanoid (vanilla JS + canvas) a `/games/arkanoid`, integrarlo en el
catálogo de Supabase con su fila en `games`, y conectar el guardado real de puntajes
a `scores` siguiendo el patrón de Asteroids/Tetris.

## Scope

### Incluido

- Fila de Arkanoid en la tabla `games` de Supabase (id `arkanoid`, `route = '/games/arkanoid'`;
  la columna `route` ya existe desde la spec 07, no requiere migración).
- Ruta `/games/arkanoid` — página Next.js con el canvas centrado sobre fondo negro.
- Motor portado en `components/games/arkanoid/engine.ts`.
- Componente `components/games/ArkanoidGame.tsx` — wrapper client que monta el
  canvas, conecta el motor y muestra el modal de fin de partida.
- Assets originales copiados a `public/games/arkanoid/`: `spritesheet-breakout.png`,
  `sounds/ball-bounce.mp3`, `sounds/break-sound.mp3`, con sus 3 rutas relativas
  reescritas a absolutas (`/games/arkanoid/...`).
- Reuso del bloque `.cover-bricks` huérfano ya existente en `app/globals.css` como
  `cover` del juego (sin CSS nuevo de cover art).
- Restart añadido (tecla + botón "JUGAR DE NUEVO" en el modal) — el original no
  tenía ninguno; se añade por consistencia con Asteroids/Tetris.
- Normalización de input a `e.code` (el original usa `e.key`) para consistencia
  con el resto del repo, con el guard obligatorio de `HTMLInputElement`.
- Arranque asíncrono respetado: `createGame()` espera `loadSpritesheet()` antes del
  primer frame; `destroy()` es seguro aunque se llame antes de que la imagen cargue.
- Clamp de `dt` a 50ms en el loop (el original no lo tiene) para evitar "spiral of
  death" al cambiar de pestaña.
- Guardado real de puntaje: `submitScore("arkanoid", nombre, score)` al perder o
  al ganar (completar los 5 niveles), visible en `/games/arkanoid` y `/hall-of-fame`.

### No incluido

- Control de paddle por mouse (el original lo tenía; se descarta en favor de solo
  teclado, consistente con Asteroids/Tetris — decisión confirmada en Fase 3).
- Controles táctiles / mobile.
- Fullscreen API.
- Tests.
- Selector de nivel en el overlay de pausa vía click en canvas (el original lo
  tenía con 5 botones dibujados; al no portar mouse, se descarta junto con él —
  ver Decisiones).

## Data model

Sin nuevas estructuras compartidas — la columna `route` ya existe desde la spec 07.
El estado del juego (`score`, `lives`, `currentLevel`, `gameState`, `paddle`, `ball`,
`blocks[]`, `explosions[]`, detectados en el dossier de `game.js` original) vive
dentro del closure de `createGame()` en `engine.ts` — nunca en scope global ni en
variables de módulo compartidas entre montajes.

Fila a insertar en `games`:

```sql
insert into games (id, title, short, long, cat, cover, color, difficulty, route) values
('arkanoid', 'ARKANOID',
 'Destruye bloques a golpe de rebote antes de que caiga la pelota.',
 'El clásico rompe-bloques. Controla la paleta para hacer rebotar la pelota y destruir
  los bloques de 5 niveles, cada uno más rápido que el anterior. Pierdes una vida si
  la pelota cae — tienes 3 para completar el juego.',
 'ARCADE', 'cover-bricks', 'magenta', 2, '/games/arkanoid');
```

## Implementation plan

1. **Fila en Supabase** — añadir el `insert` (bloque de arriba) a `supabase/schema.sql` y aplicarlo con el MCP `supabase`.
   _Verificación:_ `select * from games where id = 'arkanoid'` devuelve la fila.

2. **Assets** — copiar `assets/spritesheet-breakout.png`, `assets/sounds/ball-bounce.mp3` y `assets/sounds/break-sound.mp3` a `public/games/arkanoid/` conservando la subcarpeta `sounds/`. Reescribir las 3 rutas relativas del original a absolutas: `/games/arkanoid/spritesheet-breakout.png`, `/games/arkanoid/sounds/ball-bounce.mp3`, `/games/arkanoid/sounds/break-sound.mp3`.

3. **Cover** — confirmar que `.cover-bricks` en `app/globals.css` no está referenciado por ninguna fila existente de `games` antes de reusarlo (ya verificado: solo `cover-rocas` y `cover-tetro` están en uso). No se añade CSS nuevo.

4. **`components/games/arkanoid/engine.ts`** — portar `game.js` + `levels.js` + `assets/spritesheet.js` a `createGame(canvas, callbacks): EngineHandle`, con todo el estado en el closure:
   - `LEVELS` (de `levels.js`) y las constantes de sprites/explosiones (de `spritesheet.js`) se internalizan en el mismo módulo o en un archivo hermano `sprites.ts` sin JSX.
   - `loadSpritesheet(cb)` se envuelve en una promesa/callback interno; `createGame()` no llama `requestAnimationFrame` hasta que la imagen cargó. Si `destroy()` se invoca antes de que cargue, debe cancelar el callback pendiente sin lanzar.
   - Input: reemplazar los listeners de `document` por `window`, cambiar `e.key` → `e.code` (`ArrowLeft`/`ArrowRight`), con el guard `if (e.target instanceof HTMLInputElement) return;`. Se elimina el listener de `mousemove` sobre el paddle y el de `click` para selección de nivel en pausa (no se porta el control por mouse ni el selector de nivel).
   - Loop: aplicar el mismo clamp de 50ms que Asteroids: `Math.min((ts - lastTime) / 1000, 0.05)`.
   - `gameState` FSM (`'playing'|'paused'|'gameover'|'win'`) e `isPaused` se preservan igual que el original; al entrar a `'gameover'` o `'win'`, llamar `callbacks.onGameOver(score)`.
   - HUD: ya es on-canvas (dibujado en `draw()`), se preserva tal cual — no requiere `onHud` callback ni JSX de HUD.
   - `restart()` reexpone `loadLevel(1)` + reset de `score`/`lives`/`gameState` — nuevo, no existía en el original.
   - `destroy()` cancela el `requestAnimationFrame` pendiente y quita los listeners de teclado.
     _Verificación:_ el motor compila sin referencias a `document`/`window` fuera de los listeners registrados y removidos explícitamente.

5. **`components/games/ArkanoidGame.tsx`** — wrapper siguiendo el patrón de `AsteroidsGame.tsx`: estados `finalScore/name/saving/saved/saveError`, `useEffect` que monta `createGame(canvasRef.current, { onGameOver })` y desmonta con `destroy()`, guard de teclado para inputs, modal reutilizando `.modal-bd`/`.modal`/`.final`/`.input-row`/`.actions`/`.toast-saved`, `submitScore("arkanoid", …)`, enlace "VER RANKING" a `/games/arkanoid`, botón "JUGAR DE NUEVO" llamando `restartRef.current?.()`.
   _Verificación:_ jugar, perder (o completar los 5 niveles), ver el modal, pulsar "JUGAR DE NUEVO" y confirmar que el juego reinicia sin recargar la página.

6. **`app/games/arkanoid/page.tsx`** — server component copiando `app/games/asteroids/page.tsx` (flex centrado, fondo negro).
   _Verificación:_ `/games/arkanoid` carga con Nav visible.

7. **Prueba de extremo a extremo** — jugar una partida completa (perder con las 3 vidas y también completar los 5 niveles en otra corrida), guardar el puntaje, verlo reflejado en `/hall-of-fame` y en `/games/arkanoid`.

Ningún paso toca `GameCard.tsx`, `LibraryClient.tsx`, `app/games/page.tsx` ni `app/hall-of-fame/page.tsx` — ya son data-driven y muestran la fila nueva de `games` automáticamente.

## Acceptance criteria

- [ ] `/games/arkanoid` carga sin errores en el browser.
- [ ] El canvas aparece centrado sobre fondo negro dentro del layout de Arcade Vault (Nav visible).
- [ ] El juego arranca automáticamente al entrar a la página, incluso con la carga asíncrona del spritesheet.
- [ ] El paddle responde a ← → con la misma velocidad que el original; no hay control por mouse.
- [ ] El HUD muestra score, nivel actual y vidas (como iconos de pelota), igual que el original.
- [ ] La pelota rebota correctamente en paredes, paddle y bloques; cada bloque roto anima su explosión y suena `break-sound`; cada rebote suena `ball-bounce`.
- [ ] Al perder la última vida o completar los 5 niveles aparece el modal con la puntuación final.
- [ ] "JUGAR DE NUEVO" reinicia el juego desde el nivel 1 sin recargar la página.
- [ ] Guardar el puntaje inserta una fila real en `scores` con `game_id = 'arkanoid'`.
- [ ] Escribir un espacio en el input de nombre no reinicia el juego.
- [ ] El puntaje guardado aparece en `/hall-of-fame` (tab correspondiente) y en `/games/arkanoid`.
- [ ] `/games/arkanoid` (vía `/games/[id]`) muestra "JUGAR AHORA" apuntando a la ruta correcta.
- [ ] Al navegar fuera de `/games/arkanoid` y volver, el juego no acumula listeners ni loops huérfanos (verificar que no suenan dobles efectos de sonido tras varias visitas).
- [ ] La tarjeta de Arkanoid aparece en `/games` con título, descripción y enlace funcional, usando `.cover-bricks`.
- [ ] `npm run build` no tiene errores de TypeScript ni imports rotos.
- [ ] No hay regresiones en `/`, `/games`, `/games/rocas`, `/games/tetris`, `/hall-of-fame`, `/about`, `/auth`.

## Decisions taken and discarded

| Decisión                   | Elegido                                   | Por qué                                                                                                                                                                                                         |
| -------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Categoría (`cat`)          | `ARCADE` (nueva)                          | No calzaba en `SHOOTER` (rocas) ni `PUZZLE` (tetro); rompe-bloques es su propio género dentro del catálogo.                                                                                                     |
| Color (`color`)            | `magenta`                                 | Libre — evita repetir `yellow` (rocas) o `cyan` (tetro); no requiere resolver el problema de `.btn.green` sin variante.                                                                                         |
| Dificultad                 | `2`                                       | Controles simples (un solo eje de movimiento) y curva de dificultad suave entre niveles, más accesible que rocas/tetro (3).                                                                                     |
| Cover (`cover`)            | Reuso de `.cover-bricks` huérfano         | Ya existía en `globals.css` de un catálogo mock eliminado; temáticamente es literalmente filas de ladrillos de colores. Cero CSS nuevo.                                                                         |
| Control de paddle          | Solo teclado (← →)                        | El original soporta mouse + teclado; se descarta el mouse por consistencia con Asteroids/Tetris (ambos solo teclado) y para no tener que mapear coordenadas de mouse a canvas escalado en React.                |
| Selector de nivel en pausa | Descartado                                | Dependía del `click` sobre el canvas para elegir nivel manualmente; al no portar mouse, se elimina junto con él. La pausa (`P`/`Escape`) se conserva sin ese overlay de botones.                                |
| Restart                    | Añadido                                   | El original no tenía ninguno (`gameover`/`win` eran terminales, solo `location.reload()`). Se añade "JUGAR DE NUEVO" para consistencia con Asteroids/Tetris — recomendado explícitamente en `porting-guide.md`. |
| Input (`e.key` → `e.code`) | Normalizado a `e.code`                    | El original usa `e.key`; se alinea con el patrón de teclado ya establecido en `AsteroidsGame.tsx`.                                                                                                              |
| Arranque asíncrono         | Preservado, encapsulado en `createGame()` | El original carga el spritesheet antes del primer frame (`loadSpritesheet(cb)`); el motor portado debe esperar esa carga y ser seguro si `destroy()` llega antes de que termine.                                |
| Clamp de `dt`              | Añadido (50ms)                            | El original no clampea `dt`, lo que puede producir "spiral of death" al cambiar de pestaña; se aplica el mismo clamp que ya usa Asteroids.                                                                      |
| Migración de `route`       | No aplica                                 | Ya se hizo en la spec 07 (Tetris); Arkanoid solo inserta su fila con `route` directo.                                                                                                                           |

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Juego de Snake en HTML, CSS y JavaScript puro — sin dependencias, cero frameworks. Se abre directamente en el navegador (`open index.html`).

## Desarrollo

No hay paso de build ni servidor requerido. Para probar cambios: `open index.html`.

## Arquitectura

### Archivos principales

| Archivo             | Rol                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `index.html`        | Punto de entrada; carga scripts y el `<canvas id="game">` de 600×600 px                    |
| `game.js`           | Toda la lógica del juego (estado, loop, grilla, colisiones, render, HUD, overlays)         |
| `assets/sprites.js` | Define `SPRITE_ATLAS` y expone `loadSpritesheet(cb)` / `drawSprite(ctx, name, x, y, w, h)` |

### Assets

- **`assets/fruits.png`** — spritesheet único con las 22 frutas (fondo transparente, fila usada y=136–295)

### Modelo de grilla

Tablero de `COLS=20 × ROWS=20` celdas de `CELL=30` px (canvas 600×600). Todas las posiciones (serpiente, fruta) están en coordenadas de grilla, no en píxeles; el render multiplica por `CELL`.

### Estado del juego (en `game.js`)

```js
gameState        // 'playing' | 'paused' | 'gameover'
score            // number, +10 por fruta comida
snake[]          // [{ x, y }] en coords de grilla; snake[0] es la cabeza
direction        // { x, y } vector unitario aplicado en el último tick
pendingDirection // { x, y } próxima dirección en cola (se aplica en moveSnake)
fruit            // { x, y, type } — type es una key de SPRITE_ATLAS.fruits
```

- **Init/reset:** `initGame()` — reinicia serpiente, score y spawnea la primera fruta.
- **Tick de movimiento:** `update(dt)` acumula `dt` en `tickAccumulator` y llama `moveSnake()` cada `STEP_MS` (120 ms) — la serpiente se mueve a velocidad fija, independiente del framerate.
- **Colisión:** pared o cuerpo propio → `gameState = 'gameover'`.
- **Teclado:** `e.key` (no `e.code`). Flechas encolan `pendingDirection` (bloqueando el giro de 180°); no hay mapa de teclas mantenidas — es un giro discreto por tecla, no movimiento continuo. `P` pausa/reanuda. `Enter`/`Espacio` reinicia solo si `gameState === 'gameover'`.
- **HUD:** dibujado on-canvas en `draw()` (no hay elementos DOM para score/overlays).
- **Restart:** sí existe (`initGame()` re-invocado desde el listener de teclado).
- **Persistencia local:** no usa `localStorage`.

## Notas de assets

Las frutas del atlas tienen anchos distintos (110–170 px) pero se dibujan siempre escaladas a `CELL×CELL` (30×30) — hay una distorsión leve de aspecto aceptada a este tamaño de ícono.

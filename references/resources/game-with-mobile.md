# Juegos con soporte táctil móvil

Registro del agente `mobile-porter`. Una fila por juego del catálogo.
`✅` = implementado y verificado en viewport táctil · `—` = pendiente.

| Juego     | `games.id`  | Ruta               | TouchControls | Bisel CRT | Barra inferior | Canvas escalado | Fecha      | Notas                                                                                           |
| --------- | ----------- | ------------------ | ------------- | --------- | -------------- | --------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| ASTEROIDS | `rocas`     | `/games/asteroids` | ✅            | ✅        | ✅ (sin pausa) | ✅              | 2026-09-05 | Sin botón de pausa: el original no tiene esa mecánica. Motor inline en `AsteroidsGame.tsx`.     |
| TETRIS    | `tetro`     | `/games/tetris`    | ✅            | ✅        | ✅             | ✅              | 2026-09-05 | `hold` con auto-repeat simulado (mover/soft-drop); `fitBoard()` apila preview+stats en angosto. |
| ARKANOID  | `ladrillos` | `/games/arkanoid`  | ✅            | ✅        | ✅             | ✅              | 2026-09-05 | Solo ◀ ▶ en `.touch-dpad-row` (sin dpad-up/down); paddle por polling de `keys{}`.               |
| SNAKE     | `vibora`    | `/games/snake`     | ✅            | ✅        | ✅             | ✅              | 2026-09-05 | D-pad de 4 direcciones en modo `tap`, cruz completa `.touch-dpad`.                              |

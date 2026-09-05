# Juegos con skins

Registro del agente `skin-designer`. Una fila por juego del catálogo.
`✅` = skin implementada y verificada · `—` = pendiente.

| Juego     | `games.id`  | Ruta               | Motor                         | clasico | neon | retro | Fecha      | Notas                                                                                                                                                                                                     |
| --------- | ----------- | ------------------ | ----------------------------- | ------- | ---- | ----- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ASTEROIDS | `rocas`     | `/games/asteroids` | inline en `AsteroidsGame.tsx` | ✅      | ✅   | ✅    | 2026-09-05 | Motor inline: paleta en ref mutable leída por `draw()`, sin remontar. Asteroides coloreados por tamaño vía `entities[size-1]`. `overlay` transparente en clásico (el original no oscurecía el game over). |
| TETRIS    | `tetro`     | `/games/tetris`    | `tetris/engine.ts`            | —       | —    | —     |            |                                                                                                                                                                                                           |
| ARKANOID  | `ladrillos` | `/games/arkanoid`  | `arkanoid/engine.ts`          | —       | —    | —     |            |                                                                                                                                                                                                           |
| SNAKE     | `vibora`    | `/games/snake`     | `snake/engine.ts`             | —       | —    | —     |            |                                                                                                                                                                                                           |

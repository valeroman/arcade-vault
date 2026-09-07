# Juegos con soporte táctil móvil

Registro del agente `mobile-porter`. Una fila por juego del catálogo.
`✅` = implementado y verificado en viewport táctil · `—` = pendiente.

| Juego     | `games.id`  | Ruta               | TouchControls | Bisel CRT | Barra inferior | Canvas escalado | Gamepad MK-II | Fecha      | Notas                                                                                           |
| --------- | ----------- | ------------------ | ------------- | --------- | -------------- | --------------- | ------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| ASTEROIDS | `rocas`     | `/games/asteroids` | ✅            | ✅        | ✅ (sin pausa) | ✅              | ✅            | 2026-09-05 | Sin botón de pausa: el original no tiene esa mecánica. Motor inline en `AsteroidsGame.tsx`.     |
| TETRIS    | `tetro`     | `/games/tetris`    | ✅            | ✅        | ✅             | ✅              | ✅            | 2026-09-05 | `hold` con auto-repeat simulado (mover/soft-drop); `fitBoard()` apila preview+stats en angosto. |
| ARKANOID  | `ladrillos` | `/games/arkanoid`  | ✅            | ✅        | ✅             | ✅              | ✅            | 2026-09-05 | Solo ◀ ▶ en `.touch-dpad-row` (sin dpad-up/down); paddle por polling de `keys{}`.               |
| SNAKE     | `vibora`    | `/games/snake`     | ✅            | ✅        | ✅             | ✅              | ✅            | 2026-09-05 | D-pad de 4 direcciones en modo `tap`, cruz completa `.touch-dpad`.                              |

**Gamepad MK-II** (spec 11, 2026-09-06): los 4 juegos de arriba ya tienen el
rediseño visual del `TouchControls` compartido — panel envolvente con
gradiente/glow, hub romboidal pulsante en el d-pad y flechas en SVG con
glow, botones de acción con chrome esférico + anillo al presionar. Cambio
puramente visual en `components/games/TouchControls.tsx` + `app/globals.css`,
sin tocar `TouchButton[]` de ningún wrapper, mecánica, ni el bisel CRT/barra
inferior ya registrados en las columnas de arriba.

# Snake

Juego de Snake en HTML, CSS y JavaScript puro — sin dependencias, cero frameworks.

## Jugar

Abre `index.html` directamente en el navegador. No requiere servidor ni build.

## Controles

| Acción                     | Tecla / Input   |
| -------------------------- | --------------- |
| Mover                      | ← ↑ → ↓         |
| Pausar / reanudar          | P               |
| Reiniciar (tras game over) | Enter o Espacio |

## Características

- Canvas 600×600 px, tablero de grilla 20×20 celdas (30 px por celda)
- Serpiente que crece al comer fruta; velocidad de movimiento fija (independiente del framerate)
- 22 frutas distintas (spritesheet), elegidas al azar en cada spawn
- Score acumulado (+10 por fruta)
- Game over al chocar contra la pared o contra el propio cuerpo
- Overlay de pausa y de Game Over, con reinicio inmediato
- HUD on-canvas con el score

## Estructura del proyecto

```
index.html          # punto de entrada
game.js             # lógica del juego (estado, loop, grilla, colisiones, render)
assets/
  fruits.png         # spritesheet con las 22 frutas
  sprites.js         # SPRITE_ATLAS + loadSpritesheet / drawSprite
```

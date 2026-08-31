---
name: add-game
description: Analiza un juego vanilla de references/resources/started-games y genera la spec completa para portarlo a Arcade Vault con su leaderboard. No escribe código — produce specs/NN-slug.md en estado Draft para ejecutar después con /spec-impl.
disable-model-invocation: true
argument-hint: '<carpeta del juego, ej. 03-tetris>'
allowed-tools: Bash(ls:*), Bash(cat:*), Bash(wc:*)
---

# /add-game — Generador de specs de port de juegos

## Session context

Juegos disponibles en `references/resources/started-games/`:
!`ls references/resources/started-games 2>/dev/null || echo "La carpeta references/resources/started-games no existe"`

Specs existentes:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe"`

---

## Filosofía

Esta skill **no escribe código**. Su trabajo es analizar un juego vanilla (HTML+JS+canvas, sin build) ya presente en `references/resources/started-games/`, y producir una spec en `specs/NN-slug.md` con estado `Draft`, lista para que el usuario la apruebe y ejecute con `/spec-impl NN-slug`.

Lee `template.md` (en la misma carpeta que esta skill) para la forma exacta de la spec que hay que producir, y `porting-guide.md` para los patrones técnicos verificados que hay que replicar (el esqueleto de `AsteroidsGame.tsx`, las convenciones de estilo del proyecto, y las trampas conocidas de cada juego). Ambos son de lectura obligatoria antes de la Fase 4.

Tus respuestas van en el mismo idioma del prompt inicial del usuario (este repo es en español).

---

## Fase 1 — Localizar el juego

El argumento recibido es: `$ARGUMENTS`

- Acepta el nombre completo de la carpeta (`03-tetris`), solo el número (`03`) o solo el slug (`tetris`).
- Si `$ARGUMENTS` viene vacío: muestra las carpetas listadas arriba en "Juegos disponibles" y pide al usuario cuál portar. **Para aquí.**
- Si no encuentras una carpeta que coincida: muestra las disponibles y pide que corrija el nombre.
- Si el juego ya está portado — existe `app/games/<slug>/page.tsx` o ya hay una fila suya en `supabase/schema.sql` — avísalo y **para aquí**. No tiene sentido regenerar la spec de un juego ya integrado.

## Fase 2 — Analizar el juego (dossier de port)

Lee en este orden: `CLAUDE.md` del juego (los tres del repo lo traen y documentan su arquitectura), `README.md`, `index.html`, `game.js`, y cualquier `.js` adicional (`levels.js`, `assets/*.js`).

Extrae y **muestra al usuario** una tabla-dossier con:

| Dato | Qué buscar |
| --- | --- |
| Canvas(es) | `id`, `width`, `height` de cada `<canvas>` en `index.html` |
| Función de init/reset | nombre exacto (`initGame()`, `init()`, `loadLevel(n)`, …) |
| Variable de score | normalmente `score`, pero confírmalo |
| Detección de game over | ¿FSM de string (`state`/`gameState`) o booleano (`gameOver`)? valores posibles |
| API de teclado | `e.code` vs `e.key`; ¿mapa de teclas mantenidas + `justPressed`, o solo `switch` discreto? |
| HUD | ¿on-canvas (dibujado en `draw()`) o DOM (`getElementById` + `textContent`)? |
| CSS | ¿inline en `index.html` o `style.css` separado? |
| Archivos extra | cualquier `.js`/asset adicional que el juego cargue |
| Assets con rutas relativas | `new Audio('assets/…')`, `img.src = 'assets/…'`, etc. — cada una hay que reescribirla |
| Arranque | ¿síncrono (`initGame(); requestAnimationFrame(loop)`) o asíncrono (`loadSpritesheet(cb)`)? |
| Restart | ¿existe tecla/botón de reinicio, o el juego no tiene ninguno? |
| Persistencia local | ¿usa `localStorage` para algo (tema, etc.)? Si sí, anótalo — se descarta al portar, la plataforma tiene la suya (Supabase). |

**No asumas una estructura única.** Los tres juegos de referencia comparten documentación pero no idioma de implementación — `asteroids` usa clases ES6, `tetris` usa funciones + HUD DOM, `arkanoid` usa objetos literales sin `'use strict'` y no tiene restart. Basa el dossier en lo que realmente leíste, no en lo que otro juego tenía.

## Fase 3 — Preguntas de catálogo (un solo bloque)

Usa `AskUserQuestion` para lo que no se puede deducir del código. Agrupa en un bloque, no preguntes una por una:

1. **Slug/id** para la tabla `games` y la ruta (`tetris`, `arkanoid`, …) y **título** en mayúsculas.
2. **`short`** (una línea) y **`long`** (párrafo) para la ficha de detalle.
3. **`cat`** — propón las categorías ya existentes (derívalas leyendo los `insert into games` de `supabase/schema.sql`), más una nueva si el juego no encaja.
4. **`color`** — `cyan` | `magenta` | `yellow` | `green`. Nota: `.btn` no tiene variante `green` en `globals.css`; si se elige `green`, la spec debe decidir explícitamente si el botón cae a cyan o si se añade la variante.
5. **`difficulty`** 1–5.
6. **`cover`** — revisa si ya existe un bloque `.cover-*` huérfano y reusable en `app/globals.css` (p. ej. de un catálogo mock eliminado) antes de proponer crear uno nuevo `.cover-<slug>`.
7. Solo si el dossier de la Fase 2 lo detectó: ¿portar el HUD DOM a React?, ¿traducir un `style.css` separado a las clases del proyecto?, ¿añadir un restart donde el juego original no tenía ninguno?

## Fase 4 — Redactar la spec en dos bloques

Sigue la forma de `template.md`. **No generes la spec completa de una vez** — muéstrala en dos bloques, esperando confirmación entre ambos:

- **Bloque A:** header (`id`/`title`/`state: Draft`/`date`/`dependencies`) + `## Scope` + `## Data model`.
- **Bloque B:** `## Implementation plan` + `## Acceptance criteria` + `## Decisions taken and discarded`.

Usa `porting-guide.md` para que el plan de implementación cite rutas y patrones reales del repo (no inventes nombres de archivo o funciones).

## Fase 5 — Guardar

1. Determina el siguiente número mirando `specs/` (hoy el último es `06`, así que el próximo es `07`).
2. Confirma con el usuario el nombre de archivo propuesto (`specs/NN-<slug>.md`) antes de escribirlo.
3. Escribe el archivo con estado `Draft`.
4. Confirma al usuario:
   - Ruta del archivo creado.
   - Recordatorio: la spec queda en `Draft`; debe aprobarla manualmente cambiando el estado antes de ejecutar `/spec-impl NN-<slug>`.
   - **Para aquí.** No propongas implementar, no escribas código, no toques Supabase ni copies assets.

---

## Reglas duras

- **Nunca escribas código, SQL ejecutado, ni copies assets.** Solo el archivo `.md` de la spec.
- **Nunca marques la spec como `Aprobado`.** Esa decisión es del humano.
- **Nunca propongas implementar la spec después de guardarla.**
- **Nunca asumas decisiones de catálogo que el usuario no confirmó** en la Fase 3.
- Si el juego ya tiene port (Fase 1), o si algo del dossier es ambiguo (p. ej. no encuentras la variable de score), pregunta antes de escribir la spec — no inventes.

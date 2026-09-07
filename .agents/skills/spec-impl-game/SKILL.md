---
name: spec-impl-game
description: Implementa una spec aprobada de juego siguiendo /spec-impl y, al terminar, encadena skin-designer y después mobile-porter sobre ese juego. Secuencial, nunca en paralelo.
disable-model-invocation: true
argument-hint: "<NN-nombre-spec>"
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — Implementador de specs de juego + cadena de agentes

## Session context

Estado actual del repositorio:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles en esta carpeta:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe"`

Catálogo de juegos ya implementados:
!`cat references/resources/implemented-games.md 2>/dev/null | head -30`

---

## Filosofía

Esta skill **no reimplementa `/spec-impl`**: ese skill está vendorizado y hasheado en `skills-lock.json` (fuente `Klerith/fernando-skills`) y trae `disable-model-invocation: true`, así que no se puede invocar con la tool Skill ni se debe editar a mano. En su lugar, esta skill **delega por lectura**: lee `.claude/skills/spec-impl/SKILL.md` (lectura obligatoria antes de la Fase A) y ejecuta sus cuatro fases tal como están escritas, usando el mismo `$ARGUMENTS`.

Lo que esta skill añade es lo que viene **después**: verificar los criterios de aceptación y encadenar `skin-designer` y luego `mobile-porter` sobre el juego de esa spec — en ese orden, **uno después del otro, jamás en paralelo** (`mobile-porter` necesita que el selector de skin ya exista para montar la `.game-bottom-bar`).

Tus respuestas van en español.

---

## Fase A — Implementar la spec (delegada a /spec-impl)

1. Lee `.claude/skills/spec-impl/SKILL.md` con la tool Read.
2. Ejecuta sus **Fases 1, 2, 3 y 4 tal como están escritas**, tomando el argumento recibido por esta skill (`$ARGUMENTS`) como el `$ARGUMENTS` de esas fases. No reinterpretes ni relajes nada:
   - El bloqueo de su Fase 2 es intencional: si el estado de la spec no significa "Aprobado" (en cualquier idioma), muestra su bloque de error `❌` literal y **para aquí**. No se crea rama, no se toca código, no se lanza ningún agente.
   - Las inyecciones de shell del fichero leído (las líneas que empiezan por el signo de exclamación seguido de un bloque entre backticks) no se re-ejecutan solas al leerlo con Read; para ese mismo contenido usa el `## Session context` de esta skill, o ejecuta tú los mismos `git`/`ls`.
   - Respeta sus pausas: pide confirmación explícita antes del Paso 1, y entre cada paso del plan de implementación con `Paso N completado…`.
3. Al terminar su último paso, **no cierres el turno con su bloque `✅ All steps…`**: continúa directamente a la Fase B de esta skill.

## Fase B — Verificar criterios y resolver el juego

1. Recorre los **criterios de aceptación** de la spec uno por uno y muestra el resultado de cada uno. Si alguno falla, dilo y **para aquí** — no se lanza ningún agente.
2. Actualiza el estado de la spec a `Implementado` (es el recordatorio que la propia `/spec-impl` deja al final de su Fase 4).
3. **Resuelve el juego** de esta spec, en este orden: el `games.id` de su fila `insert into games` → su `title` → el slug de su ruta bajo `app/games/<slug>/`. Contrasta el resultado con `references/resources/implemented-games.md`.
4. Muestra lo resuelto y pide confirmación antes de seguir:

   ```
   Spec implementada: specs/NN-slug.md
   Juego detectado:   TITULO  (games.id: <id>, ruta: /games/<slug>)

   Siguiente en la cadena: skin-designer <slug>, y después mobile-porter <slug>.
   ¿Lanzo skin-designer?
   ```

5. Si la spec **no es de un juego** (no agrega fila a `games` ni ruta bajo `app/games/` — p. ej. una spec transversal como `10-mobile-touch-controls` u `11-gamepad-visual`), dilo explícitamente y **para aquí**: la cadena de agentes no aplica.

## Fase C — skin-designer

1. Con la confirmación del usuario, lanza **un solo** subagente `skin-designer` con el prompt `skin-designer <slug>` (el identificador resuelto en la Fase B — nunca vacío, ninguno de los dos agentes lo tolera).
2. Espera a que **termine** antes de seguir. Resume qué tocó: `components/games/skins.ts`, el `engine.ts` del juego, su wrapper, y la fila nueva en `references/resources/game-with-themes.md`.
3. Si el agente se detiene preguntando algo, traslada la pregunta al usuario tal cual y espera su respuesta. No respondas en su nombre ni lo relances a ciegas.

## Fase D — mobile-porter

1. Solo cuando `skin-designer` haya **terminado con éxito**, pide confirmación y lanza `mobile-porter <slug>` con el mismo identificador.
2. Espera a que termine. Resume qué tocó: `TouchControls` + `TouchButton[]` en el wrapper, bisel `.game-crt`, `.game-bottom-bar`, escalado del canvas, y la fila nueva en `references/resources/game-with-mobile.md`.
3. Cierra con el resumen de los tres tramos:

   ```
   ✅ Cadena completa para <TITULO>.

   Spec:          specs/NN-slug.md  → Implementado
   Rama:          spec-NN-slug (activa)
   skin-designer: clasico / neon / retro aplicadas
   mobile-porter: táctil + bisel CRT + barra inferior

   Pendiente humano: revisar el diff completo y abrir el PR de la rama.
   ```

---

## Reglas duras

- **Nunca en paralelo.** `mobile-porter` solo arranca cuando `skin-designer` terminó.
- **Nunca más de un juego por invocación.** Es el límite duro de ambos agentes.
- **Nunca detonar agentes** si la Fase 2 de `/spec-impl` bloqueó, si algún criterio de aceptación falló, o si la spec no es de un juego.
- **Nunca editar `.claude/skills/spec-impl/SKILL.md` ni `skills-lock.json`** — están vendorizadas y hasheadas.
- **Nunca commitear ni abrir PR.** Igual que `/spec-impl`, esta skill deja la rama lista y el humano decide.
- Los agentes escriben código: **no dupliques su trabajo** ni retoques a mano lo que ya aplicaron.

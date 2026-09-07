---
id: 11
title: Rediseño visual del gamepad táctil — Arcade Vault
state: Implementado
date: 2026-09-06
dependencies: [10]
---

**Objetivo:** Rediseñar visualmente el componente compartido `TouchControls` (d-pad + botones de
acción de los 4 juegos ya portados: Asteroids, Tetris, Arkanoid, Snake) para que adopte la
apariencia de gamepad de `references/resources/gamepad-assets` — panel envolvente, hub central
pulsante y flechas de d-pad en SVG con glow — reusando los tokens de color ya existentes en
`app/globals.css` (`--cyan`, `--magenta`, `--bg-2`, `--line`, etc., que ya coinciden casi 1:1 con
los de la referencia), sin tocar tamaños de botones, lógica de input, mecánica, ni ningún otro
elemento ya construido en la spec 10 (bisel CRT, barra inferior, pastilla de pausa).

## Scope

### Incluido

- **Panel envolvente** (`.touch-controls`): pasa de fila suelta (`display:flex` sin fondo) a un
  panel oscuro tipo "cuerpo de gamepad" — gradiente de fondo, borde, `border-radius`, sombra
  exterior con glow y textura sutil de puntos (`background-image: radial-gradient(...)`), igual
  que `.gp`/`.gp::before`/`.gp::after` de la referencia. Reusa tokens existentes (`--bg-2`,
  `--line`, `--cyan`), sin variables nuevas.
- **Hub central pulsante**: rombo (`clip-path: polygon(...)`) con glow cian y animación de pulso
  (`@keyframes`, igual patrón que `.dp-hub-gem`/`pulse-led` de la referencia), puramente
  decorativo (sin `data-key`/lógica), centrado en el d-pad. Se muestra en cualquier layout de
  d-pad: la cruz completa (Snake), la cruz incompleta (Asteroids, sin abajo; Tetris, sin arriba) y
  la fila simple (Arkanoid, solo izq/der) — en la fila simple el hub no tiene "brazos"
  arriba/abajo que lo rodeen, pero se muestra igual como elemento decorativo entre los dos
  botones.
- **Flechas del d-pad en SVG**: las 4 direcciones (▲▼◀▶) pasan de texto/emoji a un `<svg>` de
  triángulo inline (path igual al de la referencia, un triángulo por rotación), con
  `filter: drop-shadow(...)` para el glow al presionar/hover — mismo efecto que
  `.dp-arrow`/`.dp.on .dp-arrow` de la referencia. `TouchButtonView` decide el SVG a partir del
  `slot` (`dpad-up/down/left/right`), no del `label` — el `label` de cada botón se conserva
  intacto como `aria-label` (accesibilidad) aunque ya no se renderice como texto visible en esos
  4 casos.
- **Botones de acción restyleados**: `⟳`/`⤓`/`🔥` (Tetris/Asteroids) se mantienen como están —
  mismo label de texto/emoji renderizado, nunca letras genéricas "A"/"B" (decisión ya tomada en
  spec 10) — pero con el "chrome" esférico de la referencia: `radial-gradient` de esfera + anillo
  punteado que aparece al presionar (`.ab-ring` → nueva clase equivalente), en vez del círculo
  plano actual. Cian por defecto (`action-1`), magenta para `action-2` (Tetris), igual mapeo de
  color que ya existe hoy.
- Tamaños de panel/botones: se mantienen los actuales, tanto el breakpoint de escritorio/tablet
  como el de `@media (max-width: 480px)` — el rediseño es solo de "chrome" visual (fondo, bordes,
  gradientes, glow, SVG), no de dimensiones.
- Aplica a los 4 juegos ya portados automáticamente, al ser un único componente compartido
  (`TouchControls.tsx` + CSS en `globals.css`) — ningún wrapper (`AsteroidsGame.tsx`/
  `TetrisGame.tsx`/`ArkanoidGame.tsx`/`SnakeGame.tsx`) cambia su arreglo de `TouchButton[]`.
- Registrar el cambio en `references/resources/game-with-mobile.md` (columna nueva o nota) para
  que quede documentado que los 4 juegos ya tienen el look "gamepad MK-II".

### No incluido

- Bisel CRT (`.game-crt`/`.game-crt-screen`/`.game-crt-bottom`), barra inferior
  (pausa/skin-select/salir) y `.pause-pill` — ya construidos en spec 10, sin cambios de ningún
  tipo acá.
- Cambios a `TouchButton`/`TouchControlsProps` (el contrato de datos en
  `components/games/TouchControls.tsx`) ni a los arreglos de botones de cada wrapper — mismo
  `code`/`label`/`mode`/`slot` que ya existen.
- Cambios a tamaños, breakpoints, o la lógica de escalado del canvas.
- Cambios a `engine.ts`/el engine inline de Asteroids, mecánica, balance o puntaje.
- Nuevas variables CSS — se reusan las ya existentes en `:root` (`--bg-2`, `--line`, `--cyan`,
  `--magenta`, `--ink-dim`, etc.).
- Feature detection táctil (`useTouchSupport()`), landscape-block, y ocultamiento de Nav/Footer —
  sin cambios, ya funcionan.
- Skins (`clasico`/`neon`/`retro` vía `skins.ts`) — el gamepad táctil no tiene selector de skin
  propio ni varía con el skin del juego (fuera de alcance; el look es siempre el mismo, como ya
  pasa hoy con `.touch-btn`).
- Tests.

## Data model

Se omite esta sección: la feature no introduce ninguna estructura de datos nueva.

- Sin cambios en Supabase (ninguna tabla/columna/vista).
- Sin cambios en el tipo `TouchButton`/`TouchControlsProps` de
  `components/games/TouchControls.tsx` — mismos campos `code`/`label`/`mode`/`slot` que ya
  existen y que cada wrapper ya define.
- El único elemento "nuevo" es puramente de render interno en `TouchButtonView`: una función que
  mapea `slot` (`"dpad-up" | "dpad-down" | "dpad-left" | "dpad-right"`) a un path SVG de
  triángulo con la rotación correspondiente, sin agregar campos al tipo ni tocar los arreglos de
  botones de los 4 wrappers.

## Implementation plan

1. **`components/games/TouchControls.tsx`** — agrega el render del hub y las flechas SVG, sin
   tocar el contrato de datos:
   - Nueva función interna `dpadArrowPath(slot)` (o similar) que devuelve el `<svg>` de triángulo
     correspondiente a `dpad-up`/`dpad-down`/`dpad-left`/`dpad-right` (mismo `viewBox`/`path` que
     la referencia, rotado por dirección), usada dentro de `TouchButtonView` solo cuando
     `button.slot` empieza con `"dpad-"` — el `label` de texto/emoji se sigue usando como
     `aria-label` siempre, y como contenido visible en los botones que no son d-pad
     (acción/pausa).
   - `TouchControls` agrega un `<div className="gp-hub" aria-hidden="true"><span
className="gp-hub-gem" /></div>` dentro del contenedor del d-pad (tanto `.touch-dpad` como
     `.touch-dpad-row`), decorativo, sin `data-key` ni listeners.
     _Verificación:_ el componente compila (`npm run build` sin errores de tipos); sin estilos
     nuevos todavía, visualmente no cambia nada aún (los `<svg>`/hub no tienen CSS que los
     posicione).

2. **CSS en `app/globals.css`** — todo el "chrome" nuevo, reusando tokens existentes (`--bg-2`,
   `--line`, `--cyan`, `--magenta`, `--ink-dim`, `--ink-faint`):
   - `.touch-controls` gana fondo en gradiente, borde, `border-radius`, sombra exterior con glow
     y la textura de puntos sutil (pseudo-elemento), igual patrón que `.gp`/`.gp::before`/
     `.gp::after` de la referencia — mismo padding/gap que hoy, sin cambiar el tamaño total del
     bloque.
   - `.touch-dpad`/`.touch-dpad-row` ganan posición relativa para alojar `.gp-hub` centrado (grid
     area central en la cruz; centrado entre los dos botones en la fila simple).
   - Nuevas clases `.gp-hub`/`.gp-hub-gem` con el rombo
     (`clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%)`) + `@keyframes gp-pulse` (glow cian
     pulsante), tamaño proporcional al `.touch-btn` ya existente (no fijo en px de la referencia,
     para no desalinear el layout ya afinado).
   - `.touch-btn` (d-pad) gana el `<svg>` con `filter: drop-shadow(...)` en reposo y más intenso
     en `:active`/`.on`, en vez del `color`/`text-shadow` de texto que usaba antes.
   - `.touch-actions .touch-btn` gana el fondo esférico (`radial-gradient` con highlight superior
     - color medio/profundo por `action-1`/`action-2`, mismas variables `--cyan`/`--magenta` que
       ya diferencian ambos hoy) y un anillo punteado (`::after` o span extra) que aparece en
       `:active` — sin cambiar el tamaño (68px/56px en el breakpoint angosto, ya definidos).
       _Verificación:_ `npm run build` sin errores; en desktop no cambia nada (el componente sigue
       sin renderizar sin soporte táctil).

3. **Prueba visual en los 4 juegos** — en un viewport/emulador táctil, para Asteroids, Tetris,
   Arkanoid y Snake: confirmar que el panel, el hub y las flechas SVG se ven correctamente en
   cada layout de d-pad (cruz completa, cruz incompleta, fila simple), que los botones de acción
   se ven esféricos con su color correspondiente, y que **la funcionalidad no cambió**: cada
   botón sigue disparando el mismo `KeyboardEvent` de siempre (mover, rotar, disparar, pausar
   según el juego) y una partida completa sigue siendo jugable de principio a fin solo con
   controles táctiles.
   _Verificación:_ visual (panel/hub/SVG/esferas visibles y correctos) + funcional (cada botón
   dispara su `code` de siempre) en los 4 juegos; sin regresión en desktop/teclado.

4. **Actualizar `references/resources/game-with-mobile.md`** — agrega una nota (o columna)
   indicando que los 4 juegos ya tienen el look "gamepad MK-II" aplicado, con la fecha de esta
   spec.
   _Verificación:_ el archivo refleja el estado nuevo, consistente con su formato actual (una
   fila por juego).

Ningún paso toca `engine.ts`/el engine inline de Asteroids, los arreglos `TouchButton[]` de cada
wrapper, el bisel CRT, la barra inferior, `skins.ts`, SQL, ni ninguna otra ruta fuera de los 4
juegos.

## Acceptance criteria

- [ ] En un viewport/emulador táctil, `.touch-controls` de los 4 juegos (Asteroids, Tetris,
      Arkanoid, Snake) se ve como un panel oscuro redondeado con borde/gradiente/glow (no una
      fila suelta sin fondo).
- [ ] El d-pad muestra un hub romboidal pulsante en el centro, en los tres layouts existentes:
      cruz completa (Snake), cruz incompleta (Asteroids sin abajo, Tetris sin arriba) y fila
      simple (Arkanoid, solo izquierda/derecha).
- [ ] Las 4 flechas de dirección (arriba/abajo/izquierda/derecha, donde correspondan según el
      juego) se renderizan como SVG con glow, no como texto/emoji.
- [ ] Los botones de acción (`⟳` rotar y `⤓` hard-drop en Tetris, `🔥` disparo en Asteroids)
      conservan su ícono de siempre — nunca letras genéricas "A"/"B" — con un fondo esférico con
      gradiente y un anillo que aparece al presionar.
- [ ] El botón `action-2` (hard-drop, Tetris) se distingue en magenta del `action-1` (rotar) en
      cian, igual que hoy.
- [ ] Ningún tamaño de botón/panel cambió respecto a antes de esta spec, en ninguno de los dos
      breakpoints (`> 480px` y `≤ 480px`).
- [ ] Cada botón sigue disparando el mismo `KeyboardEvent`/`code` de siempre: se puede jugar una
      partida completa de cada uno de los 4 juegos solo con controles táctiles, hasta game over,
      sin regresión funcional.
- [ ] En un dispositivo/emulación de escritorio (sin soporte táctil), `TouchControls` no
      renderiza nada — cero cambios visuales, igual que antes de esta spec.
- [ ] El bisel CRT (`.game-crt`), la barra inferior (pausa/skin-select/salir) y `.pause-pill` se
      ven exactamente igual que antes de esta spec — sin cambios de ningún tipo.
- [ ] `references/resources/game-with-mobile.md` refleja que los 4 juegos ya tienen el nuevo look
      "gamepad MK-II" aplicado.
- [ ] `npm run build` no tiene errores de TypeScript ni imports rotos.
- [ ] No hay regresiones en `/games/asteroids`, `/games/tetris`, `/games/arkanoid`,
      `/games/snake` fuera del área de controles táctiles (HUD, canvas, guardado de puntaje,
      hall-of-fame).

## Decisions taken and discarded

| Decisión                              | Elegido                                                                                                                                                      | Por qué                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alcance                               | Los 4 juegos en una sola spec                                                                                                                                | `TouchControls.tsx`/CSS es un único componente compartido — restylearlo una vez alcanza a los 4 automáticamente, sin tocar wrappers. Validar en uno solo primero hubiera agregado una ida y vuelta sin necesidad real (mismo patrón que la spec 10).                                                                                    |
| Iconografía del d-pad                 | Flechas SVG con glow (`drop-shadow`), reemplazando el texto/emoji actual                                                                                     | Coincide con la referencia (`.dp-arrow`) y da un glow más nítido que `text-shadow` sobre un carácter Unicode. El `label` de cada botón se conserva como `aria-label` — no se pierde accesibilidad.                                                                                                                                      |
| Iconografía de los botones de acción  | Se mantienen `⟳`/`⤓`/`🔥` tal cual, solo con nuevo "chrome" esférico alrededor                                                                               | La referencia usa letras genéricas "A"/"B", pero eso rompería el mapeo 1:1 a la tecla real — la misma decisión ya tomada en la spec 10 ("Estilo de controles" / "Diseño bisel CRT"), no se reabre acá.                                                                                                                                  |
| Hub central                           | Se agrega en los 3 layouts de d-pad existentes, incluida la fila simple de Arkanoid y la cruz incompleta de Asteroids/Tetris                                 | Es puramente decorativo (sin `data-key`), y omitirlo en algunos juegos rompería la consistencia visual entre los 4 — el objetivo es que los 4 se vean como el mismo gamepad.                                                                                                                                                            |
| Variables de color                    | Se reusan los tokens ya existentes en `:root` (`--cyan`, `--magenta`, `--bg-2`, `--line`, `--ink-dim`, `--ink-faint`) en vez de copiar los de `gamepad.html` | Los valores de la referencia (`--bg: #0a0a0f`, `--ink-dim: #8a8fb5`, `--cyan: #00f5ff`, `--magenta: #ff006e`, `--line: rgba(0,245,255,.18)`) coinciden casi exactamente con los que ya existen en `app/globals.css` — duplicarlos como variables nuevas violaría la convención del proyecto de un único sistema de diseño hand-written. |
| Tamaños de botones/panel              | Se mantienen los actuales (58/68px desktop, 48/56px bajo 480px) en vez de adoptar los de la referencia (50/74px, panel de hasta 760px)                       | Los tamaños actuales ya fueron afinados y probados en dispositivo real durante la spec 10 (incluyendo el `fitBoard()` de Tetris, que mide este bloque); cambiarlos arriesga romper ese ajuste para un cambio que es puramente de "chrome" visual, no de layout.                                                                         |
| Selector de skin en el gamepad táctil | Fuera de alcance — el look no varía según `clasico`/`neon`/`retro`                                                                                           | La spec no pide integración con `skins.ts`; el gamepad táctil ya es un elemento de UI fijo (no de juego) desde la spec 10, y así se mantiene.                                                                                                                                                                                           |
| Registro del cambio                   | Nota en `references/resources/game-with-mobile.md` (memoria del agente `mobile-porter`)                                                                      | Es el archivo que ya documenta el estado táctil de cada juego; agregar el estado del "look" ahí evita crear un archivo de registro nuevo para un cambio puramente visual.                                                                                                                                                               |

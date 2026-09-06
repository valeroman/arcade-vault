---
id: 10
title: Controles táctiles y soporte móvil — Arcade Vault
state: Aprobado
date: 2026-09-05
dependencies: [05, 07, 08, 09]
---

**Objetivo:** Permitir jugar de principio a fin, solo con controles táctiles, los 4 juegos
ya portados (Asteroids, Tetris, Arkanoid, Snake) en un dispositivo móvil, mediante un
componente compartido de botones virtuales que sintetiza los mismos `KeyboardEvent` que
cada engine ya escucha, más el escalado CSS del canvas y un aviso de rotación en portrait.

## Scope

### Incluido

- Componente compartido `components/games/TouchControls.tsx` — recibe un layout por props
  (lista de botones, cada uno con `code` de tecla, `label`, y modo `"hold"` o `"tap"`),
  se dibuja en HTML/CSS (no en el canvas) y sintetiza `window.dispatchEvent(new
KeyboardEvent("keydown"/"keyup", { code }))` sobre el mismo `code` que cada engine
  ya escucha. Cero cambios en la lógica de los 4 `engine.ts` / engine inline de Asteroids.
- Feature detection (`"ontouchstart" in window` o equivalente) al montar cada wrapper:
  `TouchControls` solo se renderiza en dispositivos con soporte táctil real.
- Layout de botones por juego, con soporte para tocar varios botones a la vez
  (p. ej. empuje + disparo en Asteroids):
  - **Asteroids**: d-pad con `ArrowLeft`/`ArrowRight` (rotar, hold) + `ArrowUp` (empuje, hold) + botón de disparo `Space` (hold, el cooldown ya limita la cadencia). Sin pausa (el original no tiene).
  - **Tetris**: d-pad con `ArrowLeft`/`ArrowRight`/`ArrowDown` (mover/soft-drop, hold-con-repetición simulada) + botón rotar `ArrowUp`/`KeyX` (tap) + botón hard-drop `Space` (tap) + botón pausa `KeyP` (tap).
  - **Arkanoid**: solo `ArrowLeft`/`ArrowRight` (hold) + botón pausa `KeyP` (tap).
  - **Snake**: d-pad de 4 direcciones (tap, cada toque fija la dirección pendiente igual que el teclado) + botón pausa `KeyP` (tap).
  - Modo `"hold"` simula el auto-repeat de teclado para los botones que lo necesitan (Tetris mover/soft-drop): mientras el dedo está sobre el botón, se despachan `keydown` repetidos a intervalos (delay inicial + repetición), igual que un teclado físico.
- Escalado responsive del canvas: CSS (`max-width: 100%`, `height: auto`) en los 4 wrappers, sin tocar la resolución interna (`width`/`height` del elemento) ni las constantes de grilla de cada engine.
- Layout de Tetris: en viewports angostos, el preview "siguiente pieza" + stats pasan debajo del canvas principal (`flex-direction: column` vía media query), sin tocar el layout desktop.
- Aviso de rotación en portrait: overlay con mensaje pidiendo rotar el dispositivo, mostrado vía media query (`orientation: portrait`) combinada con la feature detection táctil — no bloquea con Screen Orientation API (requiere fullscreen, fuera de scope).
- `touch-action: none` (o `manipulation` según el elemento) en el contenedor de canvas + controles, para evitar que el navegador interprete pull-to-refresh/pinch-zoom/scroll/doble-tap-zoom como gestos durante la partida.
- Aplicado a los 4 juegos ya portados: Asteroids, Tetris, Arkanoid, Snake.

### No incluido

- Fullscreen API.
- Bloqueo de orientación vía Screen Orientation API.
- Gestos táctiles (swipe/tap sobre el canvas) — se descartó en favor de botones virtuales.
- Vibración háptica (Vibration API).
- Cualquier trabajo de PWA / "agregar a inicio".
- Cambios a mecánica, balance o puntaje de los 4 juegos.
- Pausa táctil en Asteroids (el original no tiene mecánica de pausa; agregarla sería una mecánica nueva, no un control táctil).
- Tests.
- Rediseño del contenido del HUD — solo su ubicación/layout cambia lo necesario para que el canvas quepa; el HUD on-canvas de cada juego se preserva tal cual.

## Data model

Sin cambios en Supabase — ninguna tabla, columna ni vista se toca (esta feature es 100%
cliente: UI + eventos de teclado sintéticos).

Nueva estructura, colocada en `components/games/TouchControls.tsx` (mismo patrón que
`components/games/skins.ts` — compartida bajo `components/games/`, no en `lib/`):

```ts
export type TouchButtonMode = "hold" | "tap";

export type TouchButton = {
  code: string; // el mismo e.code que el engine ya escucha, p. ej. "ArrowLeft"
  label: string; // texto/ícono del botón, p. ej. "◀", "⟳", "⤓"
  mode: TouchButtonMode;
  // posición dentro del layout: agrupa los botones de dirección en un d-pad
  // y el resto como botones de acción sueltos
  slot:
    | "dpad-up"
    | "dpad-down"
    | "dpad-left"
    | "dpad-right"
    | "action-1"
    | "action-2"
    | "pause";
};

export type TouchControlsProps = {
  buttons: TouchButton[];
};
```

Cada wrapper (`AsteroidsGame.tsx`, `TetrisGame.tsx`, `ArkanoidGame.tsx`, `SnakeGame.tsx`)
define su propio arreglo de `TouchButton[]` inline (4 juegos, 4 layouts distintos — no
hay una tabla compartida de mapeos, cada wrapper es dueño del suyo, igual que `games.id`
está hardcodeado en cada wrapper hoy vía `submitScore`).

No se extiende `EngineCallbacks`/`EngineHandle` de ningún engine — los botones táctiles
hablan con cada engine exclusivamente vía `window.dispatchEvent(new KeyboardEvent(...))`,
el mismo canal que ya usa el teclado físico.

## Implementation plan

1. **`components/games/TouchControls.tsx`** — componente compartido:
   - Hook interno `useTouchSupport()`: detecta `"ontouchstart" in window || navigator.maxTouchPoints > 0` una vez al montar; si es `false`, el componente no renderiza nada.
   - Recibe `buttons: TouchButton[]` (ver Data model) y arma el d-pad (slots `dpad-*`) + botones de acción sueltos (`action-1`/`action-2`/`pause`).
   - Por botón: `onTouchStart` → `e.preventDefault()` + `window.dispatchEvent(new KeyboardEvent("keydown", { code }))`; `onTouchEnd`/`onTouchCancel` → `dispatchEvent(new KeyboardEvent("keyup", { code }))`. Si `mode === "hold"`, además arranca un `setInterval` (delay inicial ~250ms, repetición ~50ms) en `onTouchStart` que re-despacha `keydown` mientras el dedo sigue apoyado, limpiado en `onTouchEnd`/`onTouchCancel`/unmount.
   - Cada botón admite su propio touch de forma independiente (multi-touch nativo del navegador: cada `touchstart` sobre un botón distinto dispara su propio ciclo), cubriendo el caso de mantener dos botones a la vez (p. ej. empuje + disparo).
   - Overlay de rotación: dentro del mismo componente, un bloque con clase `.rotate-hint` (mostrado solo vía CSS `@media (orientation: portrait)` combinada con la detección táctil) pidiendo girar el dispositivo.
     _Verificación:_ el componente compila y no rompe el build; sin consumidores todavía, no cambia ningún juego.

2. **CSS en `app/globals.css`** — nuevo bloque `.touch-controls`/`.touch-dpad`/`.touch-btn`/`.rotate-hint`, más:
   - Regla de escalado responsive para los contenedores de canvas de los 4 juegos: el wrapper pasa de `width: <px fijo>` a `max-width: <px fijo>; width: 100%`, y el `<canvas>` gana `max-width: 100%; height: auto` (mantiene su `width`/`height` de atributo HTML, o sea su resolución interna, intacta).
   - `touch-action: none` en `.touch-controls` y en el contenedor del canvas durante el juego, para bloquear pull-to-refresh/pinch-zoom/scroll/doble-tap-zoom.
   - Media query de Tetris: por debajo de cierto ancho, el `flex` que hoy pone canvas + preview + stats lado a lado pasa a `flex-direction: column`.
     _Verificación:_ `npm run build` sin errores; en desktop no cambia nada visualmente (los estilos nuevos solo activan bajo touch/viewport angosto).

3. **`ArkanoidGame.tsx`** (más simple: 2 botones + pausa) — agrega `<TouchControls buttons={[...]} />` debajo del canvas con `ArrowLeft`/`ArrowRight` (hold) + `KeyP` (tap, pausa).
   _Verificación:_ en un emulador móvil (Chrome DevTools, viewport táctil), mover el paddle y pausar solo con los botones en pantalla, sin teclado.

4. **`SnakeGame.tsx`** — d-pad de 4 direcciones (tap) + `KeyP` (tap, pausa).
   _Verificación:_ jugar una partida completa (comer fruta, chocar) solo con el d-pad táctil.

5. **`TetrisGame.tsx`** — d-pad con `ArrowLeft`/`ArrowRight`/`ArrowDown` (hold) + botones `ArrowUp` (rotar, tap) + `Space` (hard drop, tap) + `KeyP` (tap, pausa); layout apilado en viewport angosto (canvas → preview/stats → controles).
   _Verificación:_ mover, rotar y hacer hard-drop de una pieza, despejar una línea y pausar, todo táctil.

6. **`AsteroidsGame.tsx`** (el más complejo: mantener rotar + empuje + disparo a la vez) — d-pad con `ArrowLeft`/`ArrowRight` (rotar, hold) + `ArrowUp` (empuje, hold) + botón de disparo `Space` (hold). Sin botón de pausa (no existe la mecánica).
   _Verificación:_ rotar, empujar y disparar simultáneamente (dos dedos) sin que un botón cancele al otro; destruir un asteroide y perder para ver el modal.

7. **Prueba de extremo a extremo** — en un viewport móvil real o emulado, para cada uno de los 4 juegos: jugar una partida completa solo con controles táctiles hasta game over, guardar el puntaje, confirmar que aparece en `/hall-of-fame` y en la vista de detalle del juego. Confirmar además que en un viewport de escritorio (sin touch) los controles no aparecen y el teclado sigue funcionando exactamente igual que antes (cero regresión).

Ningún paso toca `engine.ts`/el engine inline de Asteroids, `SnakeGame`/`ArkanoidGame`/`TetrisGame` en su lógica de guardado, `skins.ts`, `GameCard.tsx`, `LibraryClient.tsx`, `app/games/page.tsx`, `hall-of-fame` ni el esquema de Supabase.

## Acceptance criteria

- [ ] `components/games/TouchControls.tsx` no renderiza nada en un navegador sin soporte táctil (verificado en desktop: cero cambios visuales ni de comportamiento en los 4 juegos).
- [ ] En un viewport táctil (real o emulado), `TouchControls` se renderiza en los 4 juegos con el layout correspondiente a cada uno.
- [ ] Arkanoid: el paddle se mueve con los botones ← → táctiles, y `KeyP` táctil pausa/reanuda.
- [ ] Snake: la serpiente gira en las 4 direcciones con el d-pad táctil, come frutas y puede pausarse, igual que con teclado.
- [ ] Tetris: una pieza se mueve, rota, hace soft-drop y hard-drop, y el juego se pausa, todo con los botones táctiles; en viewport angosto, el preview "siguiente pieza" y las stats se ven apilados debajo del canvas principal, sin superponerse a los controles.
- [ ] Asteroids: la nave rota, acelera y dispara con los botones táctiles; mantener empuje + disparo a la vez (dos dedos) funciona sin que un botón cancele al otro.
- [ ] En los 4 juegos, cada partida jugada solo con controles táctiles llega a game over, permite guardar el puntaje, y el puntaje aparece en `/hall-of-fame` y en la vista de detalle (`/games/[id]`) del juego.
- [ ] El canvas de los 4 juegos se ve completo (sin recortar ni desbordar el viewport) en un ancho de pantalla móvil típico (~360–430px), escalado vía CSS sin perder nitidez evidente ni distorsionar la proporción.
- [ ] En portrait, aparece el aviso pidiendo rotar el dispositivo; al rotar a landscape, el aviso desaparece y el juego es jugable.
- [ ] Durante el juego, tocar y arrastrar dentro del área de canvas/controles no dispara scroll, pull-to-refresh, zoom por pellizco ni zoom por doble-tap del navegador.
- [ ] En un dispositivo/emulación de escritorio con teclado, los 4 juegos se juegan exactamente igual que antes de esta spec (sin regresión).
- [ ] `npm run build` no tiene errores de TypeScript ni imports rotos.
- [ ] No hay regresiones en `/`, `/games`, `/games/rocas`, `/games/tetris`, `/games/arkanoid`, `/games/snake`, `/hall-of-fame`, `/about`, `/auth`.

## Decisions taken and discarded

| Decisión                                              | Elegido                                                                    | Por qué                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alcance                                               | Una sola spec, los 4 juegos                                                | Es el mismo patrón (un componente compartido + escalado CSS) aplicado 4 veces; separarlo en 4 specs hubiera repetido Header/Data model/Decisiones sin aportar nada, y el plan ya deja cada paso funcional por sí solo.                                                                                                                                         |
| Estilo de controles                                   | Botones virtuales on-screen                                                | Más descubrible que gestos (el jugador ve qué puede tocar) y mapea 1:1 a las teclas que cada engine ya escucha, sin inventar un esquema de gestos por juego.                                                                                                                                                                                                   |
| Detección de dispositivo                              | Feature detection (`ontouchstart`/`maxTouchPoints`)                        | Refleja soporte táctil real, no el ancho de viewport — una laptop con pantalla táctil los vería, una ventana de desktop angosta no los mostraría por error.                                                                                                                                                                                                    |
| Escalado del canvas                                   | CSS (`max-width`/`height: auto`), resolución interna intacta               | Cero cambios en la lógica de dibujo de los 4 engines; el único costo es una posible pérdida de nitidez a tamaños muy chicos, aceptable frente a tocar las 4 constantes de grilla.                                                                                                                                                                              |
| Puente de input                                       | `KeyboardEvent` sintético sobre `window`                                   | Los 4 engines ya escuchan exactamente ese evento con ese `code` — no se toca ni un `engine.ts`, ni el engine inline de Asteroids. La alternativa (nueva API `pressLeft()/releaseLeft()` en cada `EngineHandle`) hubiera tocado los 4 archivos de lógica de juego para un problema que es puramente de UI.                                                      |
| Componente táctil                                     | Compartido (`TouchControls.tsx`) parametrizado por props                   | Mismo patrón que `skins.ts`: una sola pieza de UI/CSS reusada por los 4 wrappers, en vez de 4 bloques de JSX+CSS de d-pad casi idénticos.                                                                                                                                                                                                                      |
| Modo "hold" para Tetris                               | Simula auto-repeat de teclado (delay inicial + intervalo)                  | Detectado durante el análisis de código: a diferencia de Asteroids/Arkanoid (que hacen polling de `keys{}` cada frame), Tetris reacciona a un solo `keydown` por movimiento y depende hoy del auto-repeat del teclado del sistema operativo para mover/soft-drop sostenido. Sin simular ese repeat, un botón táctil "sostenido" solo movería la pieza una vez. |
| Pausa táctil                                          | Se agrega para Tetris/Arkanoid/Snake; no para Asteroids                    | Los primeros tres ya tienen `KeyP` por teclado — sin equivalente táctil, pausar sería imposible en móvil (no hay teclado físico). Asteroids no tiene mecánica de pausa; agregarla sería una mecánica nueva, fuera del scope de "controles táctiles".                                                                                                           |
| Orientación                                           | Aviso de rotar en portrait, jugable en landscape                           | Ningún juego del catálogo fue diseñado para un canvas angosto y alto; pedir rotar es más simple que rediseñar el layout de 4 juegos para portrait, y no requiere Fullscreen API (fuera de scope).                                                                                                                                                              |
| Layout de Tetris en móvil                             | Preview + stats se apilan debajo del canvas en viewports angostos          | El flex lado-a-lado actual (`display:flex, gap:24`) no entra junto al d-pad táctil en un ancho de ~375px; apilar preserva toda la información (vs. ocultar el preview) sin tocar el layout de desktop.                                                                                                                                                         |
| Gestos del navegador durante el juego                 | Bloqueados con `touch-action: none`/`manipulation`                         | Evita que pull-to-refresh, pinch-zoom o scroll interrumpan una partida — es una propiedad CSS estándar, sin JS adicional ni listeners de `touchmove` con `preventDefault`.                                                                                                                                                                                     |
| Orden de aplicación en el plan                        | Arkanoid → Snake → Tetris → Asteroids (de menos a más botones/complejidad) | Permite validar el componente compartido con el caso más simple (2 botones) antes de enfrentar el caso más exigente (multi-touch sostenido + cooldown de disparo).                                                                                                                                                                                             |
| Fullscreen / bloqueo de orientación / vibración / PWA | Fuera de scope                                                             | Cada uno es una feature independiente con su propio contrato (permisos del navegador, service worker, etc.); agregarlos aquí infla una spec que ya toca 4 archivos de juego.                                                                                                                                                                                   |

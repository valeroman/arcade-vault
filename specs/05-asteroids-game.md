---
id: 05
title: Asteroids — Arcade Vault
state: Aprobado
date: 2026-06-22
dependencies: [01, 02, 04]
---

**Objetivo:** Portar el juego Asteroids (vanilla JS + canvas) a una página Next.js en `/games/asteroids`,
envuelta en el layout de Arcade Vault, y agregar su tarjeta de acceso en `/games`.

---

## Scope

### Incluido

- **Ruta `/games/asteroids`** — página Next.js con el canvas del juego centrado sobre fondo negro.
- **Componente `AsteroidsGame`** — client component (`"use client"`) que monta el canvas,
  inicializa el game loop y limpia listeners/animationFrame al desmontar.
- **Lógica del juego** — `game.js` portado íntegramente a un módulo TS/JS interno;
  sin cambios de gameplay.
- **Tarjeta en `/games`** — agregar la tarjeta de Asteroids con título, descripción breve,
  controles (flechas + espacio) y enlace → `/games/asteroids`.
- **Estilos** — fondo negro en la página; canvas centrado con `display:flex`.
  Sin estilos nuevos en `globals.css` salvo lo necesario para el layout de la página.

### No incluido

- Persistencia de puntuaciones (Supabase / base de datos).
- Controles táctiles / mobile.
- Fullscreen API.
- Sonido.
- Tests.

---

## Data model

Sin nuevas estructuras persistentes ni tipos compartidos.

El estado del juego (`ship`, `bullets`, `asteroids`, `particles`, `powerUps`, `score`,
`lives`, `level`, `state`) vive en variables de módulo locales dentro del componente,
encapsuladas en el scope del `useEffect` que monta el juego.

---

## Implementation plan

1. **Crear `app/games/asteroids/page.tsx`** — server component mínimo que renderiza
   `<AsteroidsGame />` centrado en pantalla con fondo negro.

2. **Crear `components/games/AsteroidsGame.tsx`** — client component (`"use client"`):
   - Ref al `<canvas width={800} height={600}>`.
   - `useEffect` que:
     1. Obtiene el contexto 2D.
     2. Copia la lógica completa de `game.js` (clases + estado + `update` + `draw` + `loop`)
        adaptada para usar el `canvas` y `ctx` locales en lugar de globales.
     3. Registra los listeners de teclado (`keydown` / `keyup`) en `window`.
     4. Arranca el loop con `requestAnimationFrame`.
     5. En el cleanup: cancela el `requestAnimationFrame` pendiente y elimina los listeners.
   - Retorna el `<canvas>` envuelto en un `<div>` con `display:flex` y fondo negro.

3. **Actualizar `/games`** — agregar tarjeta de Asteroids en la página existente:
   - Título: `ASTEROIDS`
   - Descripción breve: destruye asteroides, esquiva colisiones, sube de nivel.
   - Controles: flechas para mover, espacio para disparar.
   - Enlace → `/games/asteroids`.
   - Seguir el patrón visual de tarjetas existentes en la página.

---

## Acceptance criteria

- [ ] `/games/asteroids` carga sin errores en el browser.
- [ ] El canvas (800×600) aparece centrado sobre fondo negro dentro del layout de Arcade Vault (Nav visible).
- [ ] El juego arranca automáticamente al entrar a la página.
- [ ] Los controles responden: flechas rotan/aceleran la nave, espacio dispara.
- [ ] El HUD muestra score, nivel y vidas correctamente.
- [ ] Los asteroides se dividen al ser destruidos (tamaño 3→2→1).
- [ ] El powerup 3x aparece, puede recogerse y expira.
- [ ] Al perder la última vida aparece "GAME OVER" y espacio reinicia.
- [ ] Al navegar fuera de `/games/asteroids` y volver, el juego no acumula listeners ni loops huérfanos.
- [ ] La tarjeta de Asteroids aparece en `/games` con título, descripción, controles y enlace funcional.
- [ ] No hay regresiones en páginas existentes (`/`, `/games`, `/about`, `/hall-of-fame`, `/auth`).

---

## Decisions taken and discarded

| Decisión                 | Elegida                                      | Descartada                | Razón                                           |
| ------------------------ | -------------------------------------------- | ------------------------- | ----------------------------------------------- |
| Ruta                     | `/games/asteroids`                           | `/play/asteroids`         | Coherente con la sección `/games` existente     |
| Persistencia de puntajes | Excluida                                     | Guardar en Supabase       | Mantiene el scope mínimo; spec futuro dedicado  |
| Controles táctiles       | Excluidos                                    | Botones on-screen         | Solo desktop en este spec; scope reducido       |
| Layout                   | Arcade Vault completo (Nav visible)          | Fullscreen sin Nav        | Consistencia visual con la plataforma           |
| Tarjeta en `/games`      | Incluida en este spec                        | Spec separado de catálogo | Cierra el flujo completo sin añadir complejidad |
| Encapsulación del juego  | Lógica dentro del `useEffect` del componente | Módulo `.ts` separado     | Evita estado global; cleanup más directo        |

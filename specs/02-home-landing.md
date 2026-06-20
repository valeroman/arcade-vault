---
id: 02
title: Home / Landing — Arcade Vault
state: Implementado
date: 2026-06-20
dependencies: [01]
---

**Objetivo:** Portar la landing page (`home.jsx`) del template a Next.js 16 como nueva raíz `/`, moviendo la Library actual de `/` a `/games`, implementando únicamente la capa visual.

> **Nota de contexto (por qué este cambio):** Hoy `/` es la biblioteca de juegos (spec 01). El template define una landing de marketing separada (`home.jsx`) como entrada principal. Este spec la incorpora como nueva home, reubica la biblioteca en `/games` y reconecta la navegación. **No** se implementa `about.jsx` (excluido por el usuario).

---

## Scope

### Incluido

- **Home** (`/`) — landing con las 7 secciones de `home.jsx`:
  1. **Hero** — eyebrow con blink, título a 3 líneas, subtítulo, CTAs (EXPLORAR JUEGOS → `/games`, CREAR CUENTA → `/auth`), `FloatingSilhouettes` decorativas, indicador "DESLIZA".
  2. **¿Por qué Arcade Vault?** — grid de 4 `feature-card` con `FeatureIcon` (GAMEPAD/FREE/TROPHY/ROCKET).
  3. **Preview de juegos** — `mini-rail` con 6 `MiniCard` (`GAMES.slice(0,6)`), cada una navega a `/games/[id]`; botón "VER TODOS" → `/games`.
  4. **Stats** — 3 bloques (12+ juegos, MILES de partidas, GLOBAL ranking).
  5. **Actividad en vivo** — ticker de últimas puntuaciones + top jugadores (botón "VER SALÓN" → `/hall-of-fame`).
  6. **Precios + FAQ** — `price-card` plan único gratis + 3 ítems FAQ.
  7. **CTA final** — "INSERTAR MONEDA" → `/games`.
- **Mover Library** — el contenido actual de `app/page.tsx` pasa a `app/games/page.tsx` (ruta `/games`). El detalle `/games/[id]` y `/games/[id]/play` ya existen y conviven sin cambios de ruta.
- **Nav** — agregar enlace "Inicio" (→ `/`); reapuntar "Biblioteca" a `/games`; actualizar `isActive` (home cuando `pathname === "/"`, biblioteca cuando `pathname.startsWith("/games")`). Aplica a desktop y panel mobile.
- **Reapuntar enlaces internos a la biblioteca** — todos los `/` que significan "volver al vault" pasan a `/games`.
- **Estilos** — portar las clases de la home desde el `styles.css` de referencia a `app/globals.css`.
- **Efectos** — reveal-on-scroll (IntersectionObserver en `useEffect`), siluetas flotantes, iconos pixel, blink/pulse. Datos de actividad/top/precios **hardcoded inline** (consistente con MVP visual).

### No incluido

- `about.jsx` / página "Acerca de" (excluido explícitamente por el usuario).
- Nuevos archivos en `app/data/` (la home reusa `GAMES`; el resto es inline).
- Lógica real de juego, backend, auth real, persistencia en servidor.
- Tests.
- Rediseño responsive más allá del que ya trae el CSS del template.

---

## Data model

**Sin nuevas estructuras.** La home reusa `GAMES` de `app/data/games.ts` (ya existe, spec 01). El ticker de actividad, top jugadores y precios/FAQ son datos inline en el componente, igual que el template.

---

## Implementation plan

1. **Portar estilos** — copiar de `references/resources/templates/home-about/styles.css` a `app/globals.css` todas las clases de la home: `home-hero`, `home-silos`/`silo`, `home-title`/`line-*`, `hero-eyebrow`, `home-sub`, `home-ctas`, `btn xl/lg/magenta/pulse`, `hero-scroll`, `home-section`, `section-head`/`kicker`/`section-title`/`section-rule`, `feature-grid`/`feature-card`/`ft-icon`/`ft-title`/`ft-desc`, `mini-rail`/`mini-card`/`mini-cover`/`mini-meta`/`mini-title`/`mini-cat`, `home-stats`/`stats-inner`/`stat-*`, `activity-grid`/`activity-card`/`ac-*`/`ticker`/`tick-row`/`tk-*`/`top-list`/`top-row`/`tp-*`, `pricing-grid`/`price-card`/`pc-*`/`pricing-faq`/`faq-*`, `home-final`/`final-*`, y `reveal`/`.in`. Reusar variables y `.pixel`/`.neon-*`/`.blink` ya existentes (no duplicar).

2. **Mover Library** — crear `app/games/page.tsx` con el contenido actual de `app/page.tsx` (componente `LibraryPage`, sin cambios de lógica). Dejar `app/page.tsx` libre para la home.

3. **Crear Home** — escribir la nueva `app/page.tsx` como **client component** (`"use client"`):
   - Sub-componentes inline `FloatingSilhouettes`, `FeatureIcon({kind})`, `MiniCard({game})` (portados del template; `className` en vez de `class`, `strokeWidth` ya en camelCase).
   - `useReveal()` → `useEffect` con `IntersectionObserver` añadiendo clase `in` a `.reveal` (cleanup con `io.disconnect()`).
   - Navegación con `next/link` / `useRouter`: CTAs y mini-cards a `/games`, `/games/[id]`, `/auth`, `/hall-of-fame`.

4. **Actualizar `components/Nav.tsx`** — añadir enlace "Inicio" (→ `/`) antes de "Biblioteca" en desktop y panel mobile; "Biblioteca" → `/games`; ampliar `isActive` con `"home"` y ajustar la lógica (`home`: `pathname === "/"`; `biblioteca`: `pathname.startsWith("/games")`). El logo ya apunta a `/` (correcto).

5. **Reapuntar enlaces a la biblioteca** (`/` → `/games`):
   - `app/games/[id]/page.tsx:60` — "VOLVER AL VAULT".
   - `app/games/[id]/play/page.tsx:156` — "VOLVER AL VAULT".
   - `app/hall-of-fame/page.tsx:116` — botón de volver.
   - `app/auth/page.tsx:17,21` — `router.push("/")` tras login y guest → `/games`.

---

## Acceptance criteria

- [ ] `/` muestra la home/landing con las 7 secciones en orden (hero, features, preview, stats, actividad, precios, CTA final).
- [ ] El hero muestra eyebrow con blink, título a 3 líneas, subtítulo y las siluetas flotantes; los CTAs navegan a `/games` (EXPLORAR) y `/auth` (CREAR CUENTA).
- [ ] El grid de features muestra 4 tarjetas con sus iconos pixel y colores (cyan/yellow/magenta/green).
- [ ] El `mini-rail` muestra 6 juegos de `GAMES`; clicar una mini-card navega a `/games/[id]`; "VER TODOS" navega a `/games`.
- [ ] La sección de stats muestra 3 bloques; la de actividad muestra ticker + top jugadores con "VER SALÓN" → `/hall-of-fame`.
- [ ] La sección de precios muestra el plan gratis + 3 FAQ; el CTA final navega a `/games`.
- [ ] Al hacer scroll, las secciones con `.reveal` aparecen con la animación (clase `in`).
- [ ] `/games` muestra la Library completa (hero, buscador, filtros, grid) tal como funcionaba antes en `/`.
- [ ] El Nav muestra "Inicio · Biblioteca · Salón de la Fama"; "Inicio" activo en `/`, "Biblioteca" activo en `/games` y `/games/[id]`.
- [ ] El logo del Nav navega a la home `/`.
- [ ] "VOLVER AL VAULT" (detalle y player) y el botón de volver del salón navegan a `/games`.
- [ ] Tras enviar el formulario de auth o "JUGAR COMO INVITADO", se navega a `/games`.
- [ ] No existe página "Acerca de" ni enlace a ella.
- [ ] Todos los colores, fuentes y efectos neón de la home están presentes (sin regresiones en páginas existentes).

---

## Decisions taken and discarded

| Decisión                       | Elegida                                            | Descartada                                    | Razón                                                                                                |
| ------------------------------ | -------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Ubicación de la home           | Home en `/`, Library movida a `/games`             | Home en `/games` o `/home` con Library en `/` | La landing es la entrada natural; `/games` agrupa la biblioteca con `/games/[id]` de forma coherente |
| Secciones de la home           | Las 7 del template                                 | Subconjunto                                   | Máxima fidelidad al diseño de referencia                                                             |
| Datos de actividad/top/precios | Hardcoded inline en la home                        | Mover a `app/data/`                           | MVP visual; consistente con spec 01; evita estructuras prematuras                                    |
| Nav                            | Agregar "Inicio"                                   | Dejar Nav sin cambios                         | Da acceso explícito a la nueva home además del logo                                                  |
| Componente Home                | Client component (reveal con IntersectionObserver) | Server component                              | El reveal-on-scroll requiere APIs de navegador en `useEffect`                                        |
| `about.jsx`                    | Excluido                                           | Implementarlo                                 | Excluido explícitamente por el usuario                                                               |

---

## Identified risks

- **Enlaces huérfanos a `/`.** Si se omite reapuntar algún "VOLVER AL VAULT" o el push post-auth, el usuario aterriza en la home en vez de la biblioteca. Mitigación: la lista del paso 5 cubre todos los `/` auditados que significan "biblioteca".
- **Colisión de rutas `/games`.** `app/games/page.tsx` (índice) debe convivir con `app/games/[id]/page.tsx`; en App Router conviven sin conflicto.
- **IntersectionObserver en SSR.** Mitigar con `"use client"` + `useEffect`.
- **Tamaño de `globals.css`.** Portar solo las clases ausentes; reusar `.pixel`, `.btn`, `.neon-*` ya existentes.

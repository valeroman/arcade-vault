---
id: 01
title: MVP Visual — Arcade Vault
state: Aprobado
date: 2026-06-15
dependencies: []
---

**Objetivo:** Portar todas las pantallas del template HTML/React vanilla de Arcade Vault a Next.js 16 con App Router, implementando únicamente la capa visual y de navegación, sin lógica de juego real.

---

## Scope

### Incluido

- **Nav** — logo, links (Biblioteca, Salón de la Fama), coin counter, botón auth, hamburger + panel mobile
- **Library** (`/`) — hero con flicker, buscador, filtros por categoría, grid de GameCards con efecto tilt
- **GameDetail** (`/games/[id]`) — cover, info, stats, mini-leaderboard, botones acción
- **GamePlayer** (`/games/[id]/play`) — HUD (score simulado, vidas, nivel), pantalla CRT visual, estado pausa, modal game-over con guardado de score en localStorage
- **Auth** (`/auth`) — tabs login/registro, campos de formulario, botones sociales mock, guest login
- **HallOfFame** (`/hall-of-fame`) — tabs por juego, podio top 3, tabla completa, fila de usuario autenticado
- **Footer** — texto estático
- **Estilos** — `styles.css` del template portado a `app/globals.css`, complementado con Tailwind v4
- **Data** — constantes y helpers en `app/data/` (GAMES, CATS, PLAYERS, seededScores)
- **Mock auth** — estado de usuario vía `localStorage`, sin backend

### No incluido

- Lógica real de juego (canvas, game loop, colisiones)
- Base de datos o API real
- Autenticación real (Clerk, NextAuth, etc.)
- Persistencia de scores en servidor
- Tests
- Multiplayer o funcionalidades sociales reales

---

## Data model

### `app/data/games.ts`

```ts
export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string; // clase CSS para el cover-bg
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;
};

export const GAMES: Game[] = [
  /* 8 juegos del template */
];
export const CATS: string[] = [
  "TODOS",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
  "VERSUS",
];
```

### `app/data/players.ts`

```ts
export type ScoreRow = {
  rank: number;
  name: string;
  score: number;
  date: string;
};

export const PLAYERS: string[] = [
  /* 18 jugadores del template */
];
export function seededScores(seed: number, count?: number): ScoreRow[];
```

### `app/data/user.ts` _(helpers de mock auth)_

```ts
export type AppUser = { name: string };

export function getStoredUser(): AppUser | null;
export function saveUser(u: AppUser): void;
export function removeUser(): void;
```

### `app/data/scores.ts` _(scores locales)_

```ts
export type LocalScore = {
  game: string;
  score: number;
  name: string;
  at: number;
};

export function saveScore(entry: Omit<LocalScore, "at">): void;
export function getScores(): LocalScore[];
```

---

## Implementation plan

1. **Portar estilos** — copiar `styles.css` del template a `app/globals.css` (fusionar con el contenido existente de Tailwind v4)

2. **Crear data layer** — escribir los 4 archivos en `app/data/`:
   - `games.ts` (GAMES, CATS, tipo Game)
   - `players.ts` (PLAYERS, seededScores, tipo ScoreRow)
   - `user.ts` (getStoredUser, saveUser, removeUser, tipo AppUser)
   - `scores.ts` (saveScore, getScores, tipo LocalScore)

3. **Nav** — `components/Nav.tsx` (client component: estado mobile panel, lógica isActive)

4. **Footer** — `components/Footer.tsx` (server component, estático)

5. **Root layout** — actualizar `app/layout.tsx` para incluir Nav + Footer + fuentes pixel/mono

6. **Library** (`app/page.tsx`) — hero, buscador, chips de categoría, grid con GameCard y efecto tilt

7. **GameDetail** (`app/games/[id]/page.tsx`) — cover, tags, stats, leaderboard, botones de navegación

8. **GamePlayer** (`app/games/[id]/play/page.tsx`) — HUD, CRT visual, simulación de score con `setInterval`, pause, game-over modal con guardado en localStorage

9. **Auth** (`app/auth/page.tsx`) — tabs login/registro, formulario, guest login, botones sociales mock; persiste user en localStorage

10. **HallOfFame** (`app/hall-of-fame/page.tsx`) — tabs por juego, podio, tabla, fila de usuario autenticado leída de localStorage

---

## Acceptance criteria

- [ ] Navegando a `/` se muestra la Library con hero, buscador, filtros y grid de 8 juegos
- [ ] El buscador filtra juegos en tiempo real por nombre; los filtros de categoría funcionan combinados con la búsqueda
- [ ] Cada GameCard tiene efecto tilt al mover el mouse
- [ ] Hacer clic en una card o en "JUGAR" navega a `/games/[id]`
- [ ] `/games/[id]` muestra cover, tags, stats del juego y leaderboard con 10 filas generadas por `seededScores`
- [ ] "JUGAR AHORA" navega a `/games/[id]/play`; "VOLVER AL VAULT" navega a `/`
- [ ] `/games/[id]/play` muestra HUD con score que sube automáticamente, vidas y nivel
- [ ] El botón PAUSA detiene el score y muestra overlay; REANUDAR lo retoma
- [ ] FIN abre el modal de game-over con score final e input de nombre
- [ ] "GUARDAR PUNTUACIÓN" persiste en localStorage y muestra confirmación; "JUGAR DE NUEVO" reinicia el HUD
- [ ] `/auth` muestra tabs login/registro; cambiar tab muestra/oculta el campo email
- [ ] Enviar el formulario (cualquier tab) guarda el usuario en localStorage y navega a `/`
- [ ] "JUGAR COMO INVITADO" navega a `/` sin guardar usuario
- [ ] Con usuario autenticado el Nav muestra el nombre con opción de cerrar sesión; sin usuario muestra "Iniciar Sesión"
- [ ] `/hall-of-fame` muestra tabs por juego, podio top 3 y tabla de 12 filas
- [ ] Con usuario autenticado se muestra la fila "TU MEJOR MARCA" al final de la tabla
- [ ] El Nav es responsive: en mobile aparece hamburger que abre el panel lateral
- [ ] Todos los colores, fuentes y efectos neón del template están presentes en la app Next.js

---

## Decisions taken and discarded

| Decisión                     | Elegida                                                                                                                   | Descartada                           | Razón                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Routing                      | File-based App Router (`/`, `/games/[id]`, etc.)                                                                          | Hash routing SPA del template        | Idiomático en Next.js 16; mejor SEO y DX                                                              |
| Estilos                      | CSS custom portado a `globals.css` + Tailwind v4                                                                          | Reescribir todo en Tailwind v4       | El diseño neón depende de clases CSS específicas; reescribirlo sería costoso y arriesgado para el MVP |
| GamePlayer                   | Mantener simulación visual (score con `setInterval`)                                                                      | Pantalla CRT estática                | La simulación es puramente visual; aporta fidelidad al template sin requerir lógica de juego          |
| Auth                         | Mock con localStorage                                                                                                     | Clerk / NextAuth                     | MVP visual; la autenticación real es scope futuro                                                     |
| Data                         | `app/data/*.ts` con constantes TypeScript                                                                                 | `public/games.json` fetch en runtime | Tipado estático, sin latencia, fácil de reemplazar por API calls en el futuro                         |
| Componentes client vs server | Client components solo donde hay interactividad (Nav, Library, GamePlayer, Auth, HallOfFame); GameDetail puede ser server | —                                    | Mínimo surface de JS en cliente                                                                       |

---

## Identified risks

- **Fuentes pixel/mono.** `Press Start 2P` y `JetBrains Mono` deben cargarse via `next/font` o CDN. Si no se cargan antes del primer render, los efectos neón y el layout se rompen visualmente. Mitigación: cargar en `app/layout.tsx` con `next/font/google` y aplicar como variable CSS.

- **`setInterval` en GamePlayer en SSR.** Next.js puede intentar renderizar el componente en servidor; el interval fallará. Mitigación: marcar la página como `"use client"` y proteger con `useEffect`.

- **localStorage en SSR.** `getStoredUser()` y `getScores()` se llaman en componentes client; si se ejecutan fuera de `useEffect` en el primer render rompen el hidration. Mitigación: acceder a localStorage solo dentro de `useEffect` o con guard `typeof window !== "undefined"`.

- **Efecto tilt en mobile.** El tilt usa `onMouseMove`; en touch no se dispara. No es un bloqueante pero las cards en mobile no tendrán el efecto 3D.

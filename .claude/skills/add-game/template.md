# Forma de la spec que produce /add-game

Este archivo es la referencia que consulta la skill `/add-game` al redactar la spec de port de un juego. Sigue el mismo formato que `.claude/skills/spec/template.md` y las specs ya existentes en `specs/`. **No es texto para copiar literal** — es la forma que la spec generada debe respetar, adaptada a los datos reales del juego analizado.

---

## Header

```markdown
---
id: NN
title: <TÍTULO> — Arcade Vault
state: Draft
date: YYYY-MM-DD
dependencies: [02, 04, 06]
---

**Objetivo:** Portar <juego> (vanilla JS + canvas) a `/games/<slug>`, integrarlo en el
catálogo de Supabase con su fila en `games`, y conectar el guardado real de puntajes
a `scores` siguiendo el patrón de Asteroids.
```

`dependencies` siempre incluye `06` (leaderboard-games-table), origen del patrón que se replica, además de `02`/`04` si aplican.

---

## Scope

Dos sub-bloques, ambos obligatorios:

```markdown
## Scope

### Incluido

- Fila de <juego> en la tabla `games` de Supabase (id `<slug>`).
- (Solo en la primera spec de juego del repo) columna `route` en `games` y su
  consumo en `app/games/[id]/page.tsx`.
- Ruta `/games/<slug>` — página Next.js con el canvas centrado sobre fondo negro.
- Motor portado en `components/games/<slug>/engine.ts`.
- Componente `components/games/<Nombre>Game.tsx` — wrapper client que monta el
  canvas, conecta el motor y muestra el modal de fin de partida.
- Assets (si el juego los trae) copiados a `public/games/<slug>/`.
- Bloque de estilos `.cover-<slug>` en `app/globals.css` (o reutilización de uno huérfano).
- Guardado real de puntaje: `submitScore("<slug>", nombre, score)` al perder,
  visible en `/games/<slug>` y `/hall-of-fame`.

### No incluido

- Controles táctiles / mobile.
- Fullscreen API.
- Tests.
- <cualquier cosa que salió en la conversación de la Fase 3 pero se descartó — anotarla explícitamente>
```

---

## Data model

Sin nuevas estructuras compartidas salvo la migración `route` (si aplica esta spec). El estado del juego (nombrar las variables reales detectadas en el dossier: `score`, `lives`, `level`, el flag de game over, etc.) vive dentro del closure de `createGame()` en `engine.ts` — nunca en scope global ni en variables de módulo compartidas entre montajes.

Si esta spec introduce la columna `route`:

```sql
alter table games add column route text;
update games set route = '/games/asteroids' where id = 'rocas';
alter table games alter column route set not null;
```

```ts
// app/data/games.ts — Game gana un campo:
route: string;
```

Fila a insertar en `games` (con los valores confirmados en la Fase 3):

```sql
insert into games (id, title, short, long, cat, cover, color, difficulty, route) values
('<slug>', '<TÍTULO>', '<short>', '<long>', '<CAT>', 'cover-<slug>', '<color>', <difficulty>, '/games/<slug>');
```

---

## Implementation plan

Pasos numerados, cada uno dejando el sistema funcional. Usa como referencia real `porting-guide.md` (rutas, funciones, patrones exactos de `AsteroidsGame.tsx`). Orden fijo:

1. **(Solo si `games` aún no tiene `route`)** Migración: `alter table games add column route text`, backfill de `rocas`, `not null`; añadir `route: string` al tipo `Game` en `app/data/games.ts`; cambiar `app/games/[id]/page.tsx` de `href="/games/asteroids"` a `href={game.route}`.
2. **Fila en Supabase** — añadir el `insert` a `supabase/schema.sql` y aplicarlo con el MCP `supabase`.
   _Verificación:_ `select * from games where id = '<slug>'` devuelve la fila.
3. **Assets** (si el juego los trae) — copiar a `public/games/<slug>/` conservando estructura, reescribiendo cada ruta relativa a absoluta.
4. **Cover** — añadir `.cover-<slug>` a `app/globals.css` (o confirmar reutilización de uno existente).
5. **`components/games/<slug>/engine.ts`** — portar la lógica del `game.js` original a `createGame(canvas, callbacks): EngineHandle`, con todo el estado en el closure, `restart()` y `destroy()` (cancela rAF, quita listeners).
6. **`components/games/<Nombre>Game.tsx`** — wrapper siguiendo el patrón de `AsteroidsGame.tsx`: estados `finalScore/name/saving/saved/saveError`, `useEffect` que monta/desmonta el motor, guard de teclado para inputs (`if (e.target instanceof HTMLInputElement) return;`), modal reutilizando `.modal-bd`/`.modal`/`.final`/`.input-row`/`.actions`/`.toast-saved`, `submitScore("<slug>", …)`, enlace "VER RANKING" a `/games/<slug>`.
   _Verificación:_ jugar, perder, ver el modal.
7. **`app/games/<slug>/page.tsx`** — server component copiando `app/games/asteroids/page.tsx` (flex centrado, fondo negro).
   _Verificación:_ `/games/<slug>` carga con Nav visible.
8. **Prueba de extremo a extremo** — jugar una partida, perder, guardar el puntaje, verlo reflejado en `/hall-of-fame` y en `/games/<slug>`.

Ningún paso toca `GameCard.tsx`, `LibraryClient.tsx`, `app/games/page.tsx` ni `app/hall-of-fame/page.tsx` — ya son data-driven y muestran cualquier fila nueva de `games` automáticamente.

---

## Acceptance criteria

Checklist booleano, siempre incluye (adaptado al slug real):

```markdown
- [ ] `/games/<slug>` carga sin errores en el browser.
- [ ] El canvas aparece centrado sobre fondo negro dentro del layout de Arcade Vault (Nav visible).
- [ ] El juego arranca automáticamente al entrar a la página.
- [ ] Los controles responden igual que en la versión original.
- [ ] El HUD muestra los valores correctos (score y los que aplique: nivel, vidas, líneas).
- [ ] Al terminar la partida aparece el modal con la puntuación final.
- [ ] Guardar el puntaje inserta una fila real en `scores` con `game_id = '<slug>'`.
- [ ] Escribir un espacio en el input de nombre no reinicia el juego.
- [ ] El puntaje guardado aparece en `/hall-of-fame` (tab correspondiente) y en `/games/<slug>`.
- [ ] `/games/<slug>` (vía `/games/[id]`) muestra "JUGAR AHORA" apuntando a la ruta correcta.
- [ ] Al navegar fuera de `/games/<slug>` y volver, el juego no acumula listeners ni loops huérfanos.
- [ ] La tarjeta de <juego> aparece en `/games` con título, descripción y enlace funcional.
- [ ] `npm run build` no tiene errores de TypeScript ni imports rotos.
- [ ] No hay regresiones en `/`, `/games`, `/games/rocas`, `/hall-of-fame`, `/about`, `/auth`.
```

---

## Decisions taken and discarded

Tabla con lo decidido en la Fase 3 (color, cover, categoría, y cualquier trampa técnica del dossier — HUD DOM, `e.key` vs `e.code`, ausencia de restart, arranque async, etc. — y cómo se resolvió cada una).

---
id: 06
title: Leaderboard & Tabla de Juegos — Arcade Vault
state: Implementado
date: 2026-08-14
dependencies: [02, 04, 05]
---

**Objetivo:** Crear las tablas `games` y `scores` en Supabase como fuente real de datos para el catálogo y el leaderboard, migrando el catálogo estático de juegos, conectando su lectura en `/games`, `/games/[id]` y `/hall-of-fame`, y guardando puntajes reales al terminar una partida de Asteroids.

---

## Scope

### Incluido

- **Tabla `games` en Supabase** (`supabase/schema.sql`) — columnas `id`, `title`, `short`, `long`, `cat`, `cover`, `color`, `difficulty`, poblada solo con `rocas` (el único juego con gameplay real).
- **Tabla `scores` en Supabase** (mismo `schema.sql`) — `id`, `game_id` (FK a `games`), `player_name`, `score`, `created_at`. RLS: `SELECT` público en ambas tablas; `INSERT` público solo en `scores`, con constraints (`score >= 0`, `player_name` entre 1 y 20 caracteres).
- **Vista `games_with_stats`** — calcula `best` (`max(score)`) y `plays` (`count(*)`) en vivo desde `scores`, en vez de columnas fijas en `games`.
- **`app/data/games.ts`** — pasa de exportar el array estático `GAMES` a funciones `getGames()` / `getGame(id)` que consultan la vista `games_with_stats`. `CATS` se deriva de los juegos obtenidos en vez de estar hardcodeado. Helpers `formatPlays()` y `difficultyStars()` para mostrar `plays`/`difficulty`.
- **`app/data/scores.ts`** — reemplaza el localStorage actual por `getTopScores(gameId, limit)` y `submitScore(gameId, playerName, score)` contra Supabase.
- **`/games`** — pasa a Server Component que hace `getGames()` y delega el buscador/filtros a un nuevo `components/LibraryClient.tsx` (misma UX actual).
- **`/games/[id]`** — reemplaza el lookup estático y `seededScores()` por `getGame(id)` + `getTopScores(id, 10)` reales; estado vacío si el juego no tiene puntajes.
- **`/hall-of-fame`** — reemplaza `GAMES` estático y `seededScores()` por juegos y top 12 de puntajes reales según el tab seleccionado; estado vacío (sin podio) si el juego no tiene puntajes.
- **Se elimina la fila "TU MEJOR MARCA"** — dependía de datos falsos y de un usuario ficticio en localStorage sin relación con puntajes reales.
- **`components/games/AsteroidsGame.tsx`** — al perder la última vida, overlay HTML sobre el canvas con input de nombre + botón "GUARDAR" que inserta el score directo desde el cliente browser de Supabase. Tras guardar (o sin guardar), botones explícitos "JUGAR DE NUEVO", "VER RANKING" y "CERRAR" — el modal ya no depende de la tecla ESPACIO para cerrarse.
- El listener de teclado ignora eventos originados en el input de nombre (evita que escribir un espacio dispare el reinicio del juego).
- **Fusión `rocas` = Asteroids** — la fila `rocas` de la tabla `games` representa el juego real y es el único juego del catálogo. El botón "JUGAR AHORA" en `/games/rocas` apunta a `/games/asteroids`.
- **Catálogo mock eliminado** — se quitan los 7 juegos sin gameplay real y la ruta demo `app/games/[id]/play/page.tsx`; el catálogo (`/games`) muestra solo `rocas`.

### No incluido

- Autenticación real de Supabase — `/auth` sigue siendo solo UI local; el nombre del jugador es texto libre sin relación con ningún usuario autenticado.
- Migraciones versionadas con Supabase CLI (no está configurado en el proyecto); el schema se aplica con un único script SQL manual vía el SQL Editor de Supabase.
- Edición/borrado de puntajes, moderación o anti-cheat.
- Seed de puntajes de ejemplo — `scores` nace vacía.
- Tests.

---

## Data model

### Tabla `games` (Supabase / Postgres)

```sql
create table games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  cat text not null,
  cover text not null,
  color text not null check (color in ('cyan','magenta','yellow','green')),
  difficulty smallint not null default 3 check (difficulty between 1 and 5),
  created_at timestamptz not null default now()
);

-- best (max score) y plays (count) se calculan en vivo vía la vista games_with_stats
create view games_with_stats with (security_invoker = on) as
select g.*,
       coalesce(max(s.score), 0)::int as best,
       count(s.id)::int as plays
from games g
left join scores s on s.game_id = g.id
group by g.id;
```

### Tabla `scores` (Supabase / Postgres)

```sql
create table scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references games(id) on delete cascade,
  player_name text not null check (char_length(player_name) between 1 and 20),
  score integer not null check (score >= 0),
  created_at timestamptz not null default now()
);
```

### Tipos TypeScript (`app/data/games.ts` / `app/data/scores.ts`)

```ts
export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string;
  color: "cyan" | "magenta" | "yellow" | "green";
  difficulty: number;
  best: number;
  plays: number;
};

export type ScoreRow = {
  id: string;
  game_id: string;
  player_name: string;
  score: number;
  created_at: string;
};
```

Convenciones:

- `id` de `games` sigue siendo el slug usado en las rutas (`bloque-buster`, `rocas`, `duelo-pixel`, etc.) — sin cambios respecto al array estático actual.
- Los puntajes se ordenan siempre `score desc, created_at asc` (empate → gana el más antiguo).
- RLS: `select` público en `games` y `scores`; `insert` público solo en `scores`. Sin políticas de `update`/`delete` para el rol anónimo (solo `service_role` vía SQL Editor).

---

## Implementation plan

1. **Schema SQL** (`supabase/schema.sql`) — crear tablas `games` y `scores`, políticas RLS (`select` público en ambas, `insert` público solo en `scores`) y el insert de los 8 juegos (`rocas` ya representa el Asteroids real). Ejecutar manualmente en el SQL Editor de Supabase.
   _Verificación:_ `select * from games` devuelve 8 filas en Supabase Studio.

2. **Migrar catálogo de lectura a Supabase**:
   - Reescribir `app/data/games.ts` (`getGames()`, `getGame(id)`, `deriveCats(games)`, tipo `Game`).
   - `app/games/page.tsx` → Server Component con `getGames()`; nuevo `components/LibraryClient.tsx` recibe `games` como prop y mantiene el buscador/filtros actuales. Se quita la tarjeta hardcodeada de Asteroids (ya la cubre la fila `rocas`).
   - `app/games/[id]/page.tsx` → usa `getGame(id)`. El botón "JUGAR AHORA" apunta a `/games/asteroids` cuando `id === "rocas"`; para el resto sigue yendo a `/games/${id}/play`.
   - `app/games/[id]/play/page.tsx` → usa `getGame(id)` en vez de `GAMES.find`; se quita la llamada a `saveScore()`.
     _Verificación:_ `/games`, `/games/rocas` y `/games/bloque-buster/play` cargan sin errores de build, con datos reales de Supabase.

3. **Migrar leaderboard de lectura a Supabase**:
   - Reescribir `app/data/scores.ts` (`getTopScores(gameId, limit)`, `submitScore(gameId, playerName, score)`), quitando el localStorage.
   - `app/games/[id]/page.tsx` → el aside de leaderboard usa `getTopScores(id, 10)`; estado vacío ("SIN PUNTUACIONES TODAVÍA") si no hay filas.
   - `app/hall-of-fame/page.tsx` → tabs desde `getGames()` (fetch con el cliente browser), top 12 desde `getTopScores`; estado vacío sin podio si no hay filas; se elimina el bloque "TU MEJOR MARCA".
     _Verificación:_ `/hall-of-fame` y `/games/rocas` muestran el estado vacío (todavía no hay filas en `scores`).

4. **Conectar guardado real de puntaje en Asteroids**:
   - `components/games/AsteroidsGame.tsx`: estado React `finalScore`, actualizado desde `killShip()` (game over) y reseteado desde `initGame()` (reinicio); overlay HTML sobre el canvas con input (máx. 20 caracteres) + botón "GUARDAR" que llama `submitScore("rocas", name, score)`.
   - El listener de `keydown` ignora eventos cuyo `e.target` sea el input de nombre, para no disparar el reinicio con espacio mientras se escribe.
     _Verificación:_ jugar una partida, perder, guardar el puntaje y verlo reflejado en `/hall-of-fame` (tab ROCAS) y en `/games/rocas`.

---

## Acceptance criteria

- [ ] La tabla `games` existe en Supabase con 8 filas (incluida `rocas`), y la tabla `scores` existe vacía, ambas con RLS activado.
- [ ] `select` anónimo funciona en `games` y `scores`; `insert` anónimo funciona en `scores`.
- [ ] `/games` carga la grilla de juegos desde Supabase (sin `app/data/games.ts` estático) y el buscador/filtros siguen funcionando igual que antes.
- [ ] La tarjeta duplicada de Asteroids ya no aparece en `/games` — solo existe la tarjeta `ROCAS`, cuyo link lleva al detalle.
- [ ] `/games/rocas` muestra el botón "JUGAR AHORA" apuntando a `/games/asteroids`.
- [ ] `/games/[id]` (para los otros 7 juegos) sigue llevando a `/games/[id]/play`, y esa pantalla carga sin el paso de guardar puntaje.
- [ ] `/games/[id]` muestra "SIN PUNTUACIONES TODAVÍA" en el leaderboard lateral cuando el juego no tiene filas en `scores`.
- [ ] `/hall-of-fame` carga las tabs de juegos desde Supabase y muestra "SIN PUNTUACIONES TODAVÍA" (sin podio) para juegos sin filas.
- [ ] El bloque "TU MEJOR MARCA" ya no aparece en `/hall-of-fame`.
- [ ] Jugar una partida de Asteroids y perder muestra un input de nombre + botón "GUARDAR" sobre el canvas.
- [ ] Guardar el puntaje inserta una fila real en `scores` con `game_id = 'rocas'`.
- [ ] Escribir un espacio en el input de nombre no reinicia el juego.
- [ ] Después de guardar, el puntaje aparece en `/hall-of-fame` (tab ROCAS) y en `/games/rocas`, ordenado de mayor a menor.
- [ ] `npm run build` no tiene errores de TypeScript ni imports rotos a `GAMES`/`saveScore`.
- [ ] No hay regresiones visuales ni funcionales en `/`, `/about`, `/auth`.

---

## Decisions taken and discarded

| Decisión                           | Elegida                                                                  | Descartada                               | Razón                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------- | --------------------------------------------------------------------- |
| Alcance del spec                   | Un solo spec (games + scores)                                            | Dos specs separados                      | Están acoplados por FK; evita dependencias cruzadas entre documentos  |
| Fuente de verdad de `games`        | Tabla Supabase, reemplaza `app/data/games.ts`                            | Mantener array estático                  | El usuario quería la referencia de juegos ya en tabla, no solo schema |
| Identidad del jugador              | Nombre libre (texto), sin FK a `auth.users`                              | Conectar Supabase Auth en este spec      | Mantiene el scope acotado; `/auth` real queda para spec futuro        |
| Juegos en el catálogo              | Solo Asteroids (`rocas`)                                                 | Los 8 juegos (7 mock + rocas)            | Los 7 mock no tienen gameplay real ni podían enviar score real        |
| Mecanismo de insert                | Cliente browser directo + RLS pública                                    | API Route intermedia                     | Menos capas; suficiente sin auth ni validación de servidor            |
| UX de nombre al perder             | Overlay HTML con input + botones "JUGAR DE NUEVO"/"VER RANKING"/"CERRAR" | Overlay que solo se cierra con ESPACIO   | Sin botón, el modal quedaba bloqueado (p. ej. si el guardado fallaba) |
| Stats "Mejor global" / "Partidas"  | Calculadas en vivo desde `scores` vía vista `games_with_stats`           | Columnas fijas en `games`                | Columnas fijas nunca se actualizaban y contradecían el leaderboard    |
| Datos iniciales                    | `games` con solo `rocas`, `scores` vacía                                 | Seed de puntajes de ejemplo              | Estado honesto: sin partidas reales todavía no hay puntajes           |
| Duplicación `rocas` / `asteroids`  | Fusionar: `rocas` = juego real, apunta a `/games/asteroids`              | Fila nueva `asteroids` separada          | Evita dos entradas de temática asteroides en el catálogo              |
| `/games/[id]/play` (demo simulada) | Eliminada                                                                | Mantenerla sin guardado                  | Ya no queda ningún juego mock que la use                              |
| Migraciones                        | Script SQL único, manual (SQL Editor)                                    | Supabase CLI con migraciones versionadas | El proyecto no tiene CLI de Supabase configurado                      |
| Fila "TU MEJOR MARCA"              | Eliminada                                                                | Mantenerla                               | Dependía de datos falsos y de un usuario ficticio sin relación real   |

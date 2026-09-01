-- Arcade Vault — schema para catálogo de juegos y leaderboard (spec 06)
-- Ejecutar manualmente en el SQL Editor de Supabase.

-- ============================================================
-- Tabla: games
-- ============================================================
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

alter table games enable row level security;

create policy "games_select_public"
  on games for select
  to anon
  using (true);

-- ============================================================
-- Tabla: scores
-- ============================================================
create table scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references games(id) on delete cascade,
  player_name text not null check (char_length(player_name) between 1 and 20),
  score integer not null check (score >= 0),
  created_at timestamptz not null default now()
);

alter table scores enable row level security;

create policy "scores_select_public"
  on scores for select
  to anon
  using (true);

create policy "scores_insert_public"
  on scores for insert
  to anon
  with check (true);

-- ============================================================
-- Vista: games_with_stats
-- "Mejor global" y "Partidas" se calculan en vivo desde scores,
-- en vez de vivir como columnas fijas en games.
-- ============================================================
create view games_with_stats
  with (security_invoker = on) as
select
  g.*,
  coalesce(max(s.score), 0)::int as best,
  count(s.id)::int as plays
from games g
left join scores s on s.game_id = g.id
group by g.id;

grant select on games_with_stats to anon;

-- ============================================================
-- Datos iniciales: un solo juego real (Asteroids)
-- "rocas" es el juego real de Asteroids; el resto del catálogo
-- mock (7 juegos) se elimina — no tienen gameplay real.
-- ============================================================
insert into games (id, title, short, long, cat, cover, color, difficulty) values
(
  'rocas',
  'ROCAS',
  'Pulveriza asteroides en gravedad cero.',
  'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Cuidado con los OVNIs en el horizonte.',
  'SHOOTER',
  'cover-rocas',
  'yellow',
  3
);

-- ============================================================
-- Migración (spec 07): columna `route` en games
-- Asteroids estaba hardcodeado a /games/asteroids; esta columna
-- permite enrutamiento multi-juego real (p. ej. Tetris).
--
-- IMPORTANTE: `games_with_stats` fue creada con `g.*`, que en Postgres
-- congela la lista de columnas de la vista al momento del CREATE VIEW.
-- Agregar una columna a `games` no la propaga a la vista, y no se puede
-- insertar una columna "en medio" del orden con CREATE OR REPLACE VIEW
-- (solo se permite agregar al final) — hay que hacer DROP + CREATE.
-- ============================================================
alter table games add column route text;
update games set route = '/games/asteroids' where id = 'rocas';
alter table games alter column route set not null;

drop view if exists games_with_stats;

create view games_with_stats
  with (security_invoker = on) as
select
  g.*,
  coalesce(max(s.score), 0)::int as best,
  count(s.id)::int as plays
from games g
left join scores s on s.game_id = g.id
group by g.id;

grant select on games_with_stats to anon;

-- ============================================================
-- Datos (spec 07): fila de Tetris
-- id = 'tetro' (no 'tetris'): route ya usa el slug '/games/tetris' para la
-- ruta estática jugable (Paso 6), y en Next.js una ruta estática siempre
-- gana sobre la dinámica `[id]` para la misma URL — si id también fuera
-- 'tetris', la página de detalle/leaderboard vía /games/[id] sería
-- inalcanzable. Mismo patrón que rocas/asteroids (id ≠ slug de route).
-- ============================================================
insert into games (id, title, short, long, cat, cover, color, difficulty, route) values
('tetro', 'TETRIS', 'Encaja piezas y despeja líneas antes de que se acumulen.',
 'El clásico juego de bloques. Rota y posiciona las 7 piezas estándar (más una pieza extra) para completar líneas horizontales. La velocidad aumenta con cada nivel — usa la pieza fantasma para planear tu caída.',
 'PUZZLE', 'cover-tetro', 'cyan', 3, '/games/tetris');

-- ============================================================
-- Datos (spec 08): fila de Arkanoid
-- id = 'ladrillos' (no 'arkanoid'): route ya usa el slug '/games/arkanoid'
-- para la ruta estática jugable, y una ruta estática siempre gana sobre la
-- dinámica `[id]` para la misma URL — si id también fuera 'arkanoid', la
-- página de detalle/leaderboard vía /games/[id] sería inalcanzable. Mismo
-- patrón que rocas/asteroids y tetro/tetris (id ≠ slug de route).
-- Reusa el bloque .cover-bricks huérfano de globals.css (catálogo mock
-- eliminado) en vez de crear un cover-arkanoid nuevo.
-- ============================================================
insert into games (id, title, short, long, cat, cover, color, difficulty, route) values
('ladrillos', 'ARKANOID', 'Destruye bloques a golpe de rebote antes de que caiga la pelota.',
 'El clásico rompe-bloques. Controla la paleta para hacer rebotar la pelota y destruir los bloques de 5 niveles, cada uno más rápido que el anterior. Pierdes una vida si la pelota cae — tienes 3 para completar el juego.',
 'ARCADE', 'cover-bricks', 'magenta', 2, '/games/arkanoid');

-- ============================================================
-- Datos (spec 09): fila de Snake
-- id = 'vibora' (no 'snake'): route ya usa el slug '/games/snake' para la
-- ruta estática jugable, y una ruta estática siempre gana sobre la
-- dinámica `[id]` para la misma URL — si id también fuera 'snake', la
-- página de detalle/leaderboard vía /games/[id] sería inalcanzable. Mismo
-- patrón que rocas/asteroids, tetro/tetris y ladrillos/arkanoid.
-- Reusa el bloque .cover-snake huérfano de globals.css (catálogo mock
-- eliminado) en vez de crear un cover-vibora nuevo.
-- ============================================================
insert into games (id, title, short, long, cat, cover, color, difficulty, route) values
('vibora', 'SNAKE', 'Come frutas, crece y evita chocar contra ti mismo.',
 'El clásico juego de la víbora. Guía a la serpiente por un tablero de 20×20 casillas, come las 22 frutas del huerto para crecer y sumar puntos — pero cuidado: chocar contra la pared o contra tu propio cuerpo termina la partida al instante.',
 'ARCADE', 'cover-snake', 'green', 1, '/games/snake');

-- ============================================================
-- Migración para una base de datos que ya ejecutó el schema
-- anterior (con columnas games.best / games.plays y 8 juegos).
-- Ejecutar este bloque en vez del anterior si `games` ya existe.
-- ============================================================
-- delete from scores where game_id <> 'rocas';
-- delete from games  where id      <> 'rocas';
-- alter table games drop column best, drop column plays;
-- alter table games add column difficulty smallint not null default 3
--   check (difficulty between 1 and 5);
-- create view games_with_stats
--   with (security_invoker = on) as
-- select
--   g.*,
--   coalesce(max(s.score), 0)::int as best,
--   count(s.id)::int as plays
-- from games g
-- left join scores s on s.game_id = g.id
-- group by g.id;
-- grant select on games_with_stats to anon;

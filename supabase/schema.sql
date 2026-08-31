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
-- ============================================================
alter table games add column route text;
update games set route = '/games/asteroids' where id = 'rocas';
alter table games alter column route set not null;

-- ============================================================
-- Datos (spec 07): fila de Tetris
-- ============================================================
insert into games (id, title, short, long, cat, cover, color, difficulty, route) values
('tetris', 'TETRIS', 'Encaja piezas y despeja líneas antes de que se acumulen.',
 'El clásico juego de bloques. Rota y posiciona las 7 piezas estándar (más una pieza extra) para completar líneas horizontales. La velocidad aumenta con cada nivel — usa la pieza fantasma para planear tu caída.',
 'PUZZLE', 'cover-tetro', 'cyan', 3, '/games/tetris');

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

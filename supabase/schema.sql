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
  best integer not null default 0,
  plays text not null default '0',
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
-- Datos iniciales: catálogo de 8 juegos (migrado de app/data/games.ts)
-- "rocas" representa el juego real de Asteroids.
-- ============================================================
insert into games (id, title, short, long, cat, cover, color, best, plays) values
(
  'bloque-buster',
  'BLOQUE BUSTER',
  'Rebota la pelota y destruye muros de neón.',
  'Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles. ¿Hasta dónde llegará tu racha?',
  'ARCADE',
  'cover-bricks',
  'cyan',
  28450,
  '12.4K'
),
(
  'caida',
  'CAÍDA',
  'Encaja las piezas antes de que el techo te aplaste.',
  'Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.',
  'PUZZLE',
  'cover-tetro',
  'magenta',
  184220,
  '31.8K'
),
(
  'serpentina',
  'SERPENTINA',
  'Crece sin morder tu propia cola.',
  'Una serpiente de luz recorre la grilla buscando núcleos magenta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso y se devora a sí misma.',
  'ARCADE',
  'cover-snake',
  'green',
  7820,
  '9.1K'
),
(
  'gloton',
  'GLOTÓN',
  'Devora puntos y escapa de los fantasmas.',
  'Un círculo glotón patrulla un laberinto coleccionando puntos luminosos. Cuatro espectros lo persiguen, pero cada cierto tiempo aparece una píldora que invierte los papeles.',
  'ARCADE',
  'cover-glot',
  'yellow',
  96400,
  '27.2K'
),
(
  'invasores',
  'INVASORES',
  'Defiende el planeta de filas alienígenas.',
  'Olas de pixeles hostiles descienden formación tras formación. Mueve tu cañón en horizontal y abre fuego con precisión, antes de que toquen la superficie.',
  'SHOOTER',
  'cover-invaders',
  'green',
  54190,
  '18.0K'
),
(
  'rocas',
  'ROCAS',
  'Pulveriza asteroides en gravedad cero.',
  'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Cuidado con los OVNIs en el horizonte.',
  'SHOOTER',
  'cover-rocas',
  'yellow',
  41200,
  '15.6K'
),
(
  'ranaria',
  'RANARIA',
  'Cruza la autopista de pixeles.',
  'Salta entre carriles de coches a toda velocidad y troncos a la deriva en el río. Llega a los nenúfares antes de que se acabe el tiempo.',
  'ARCADE',
  'cover-rana',
  'green',
  18900,
  '6.4K'
),
(
  'duelo-pixel',
  'DUELO PIXEL',
  'Dos paletas. Una pelota. Reflejos máximos.',
  'El duelo más puro: dos paletas verticales se enfrentan por rebotar una pelota luminosa. Modo solitario contra la CPU o partida local a dos jugadores.',
  'VERSUS',
  'cover-duelo',
  'cyan',
  24,
  '4.2K'
);

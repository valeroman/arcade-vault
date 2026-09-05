# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault — online gaming platform where players compete for points. Uses **Spec Driven Design** via `/spec` and `/spec-impl` skills from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills). Backed by Supabase for the catalog and leaderboards, plus a Resend-powered contact form. Current game roster (grows over time): see [`references/resources/implemented-games.md`](references/resources/implemented-games.md).

Install skills:

```bash
npx skills@latest add Klerith/fernando-skills
```

## Stack

- **Next.js 16.2.6** / **React 19.2.4** (pinned exact versions — breaking changes vs. prior versions, always read `node_modules/next/dist/docs/` before writing code)
- **Tailwind CSS v4** is installed (`@import "tailwindcss"` in `app/globals.css`) but effectively vestigial — there is no `@theme`, `@layer`, or `@apply` anywhere in the codebase. All UI styling is hand-written CSS using semantic classes (`.btn`, `.card`, `.chip`, `.cover-*`, …), not Tailwind utilities. Don't reach for `@theme inline` or utility classes; follow the existing semantic-class convention instead.
- **Supabase** (`@supabase/ssr`, `@supabase/supabase-js`) — catalog + leaderboard data, no real auth
- **Resend** — transactional email for the contact form
- **TypeScript** with `strict: true`, path alias `@/*` → root
- No test runner, no `.prettierrc` (Prettier runs on defaults), no `lib/`, `hooks/`, or `types/` directory — types live colocated in the module that owns them (e.g. `Game` in `app/data/games.ts`)

## Environment

`.env.template` lists the required vars (real values go in gitignored `.env.local`):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `RESEND_API_KEY`
- `SUPABASE_DB_PASSWORD`

## Architecture

App Router only (`app/` directory). No `pages/` directory.

- `app/layout.tsx` — root layout, `<html lang="es">`. Loads `Press_Start_2P` (`--font-pixel`) and `JetBrains_Mono` (`--font-mono`) via `next/font/google`; body renders `.av-bg` / `.av-noise` background layers, then `.av-root` wrapping `Nav` / `main.av-main` / `Footer`.
- `app/globals.css` — the entire design system, ~2800 lines of hand-written CSS (see **Design system** below).

TypeScript alias `@/` resolves to repo root, so imports like `@/components/...` work without relative paths.

### Routes

- `app/page.tsx` — home/landing (client component, mock hero/stats sections + a real game rail via `getGames()`)
- `app/about/page.tsx` — about + contact form, posts to `app/api/contact/route.ts`
- `app/auth/page.tsx` — fake sign-in/sign-up (see Data layer)
- `app/games/page.tsx` — catalog, server component → `LibraryClient`
- `app/games/[id]/page.tsx` — game detail + top-10 leaderboard, `force-dynamic`
- `app/games/{asteroids,tetris,arkanoid,snake}/page.tsx` — thin static wrappers around each game component
- `app/hall-of-fame/page.tsx` — global leaderboard, per-game tabs + podium
- `app/api/contact/route.ts` — the **only** API route (Resend). No server actions in the repo.

### Data layer

- `app/data/games.ts` — `Game` type, `getGames()` / `getGame(id)` against the `games_with_stats` view, plus reusable helpers `deriveCats()`, `formatPlays()`, `difficultyStars()` — reuse these, don't reimplement.
- `app/data/scores.ts` — `ScoreRow` type, `getTopScores(gameId, limit)` (score desc, `created_at` asc tiebreak), `submitScore(gameId, playerName, score)`.
- `app/data/user.ts` — fake "session" stored only in `localStorage` (key `av_user`), read by `Nav.tsx`.
- `utils/supabase/client.ts` (`createBrowserClient`) and `utils/supabase/server.ts` (`createServerClient`, `await cookies()`).
- **No real auth.** `middleware.ts` calls `supabase.auth.getUser()` only to refresh cookies; nothing consumes a session, and every RLS policy is `to anon`. No state management library either — plain `useState`/`useEffect`/`useMemo` and refs.

### Design system

`app/globals.css` is dark-only (no light theme). Reuse these primitives instead of inventing new ones:

- `.btn` with modifiers `.magenta .yellow .green .ghost .lg .xl .pulse .press` (`.green` was added for Snake)
- `.card` (3D tilt, paired with mouse tracking in `GameCard.tsx`), `.chip`, `.crt`/`.crt-screen`, `.leaderboard`/`.lb-row`, `.stat-strip`, `.modal-bd`/`.modal`/`.final`, `.pixel`/`.mono`, `.neon-{cyan,magenta,yellow,green}`, `.reveal`/`.reveal.in`
- **Cover art is CSS, not images:** `games.cover` stores a class name, rendered as `<div className={"cover-bg " + game.cover} />`. Orphaned reusable blocks from the deleted mock catalog: `.cover-glot`, `.cover-invaders`, `.cover-rana`, `.cover-duelo` — reuse one before writing a new `.cover-*` (Arkanoid did this with `.cover-bricks`)
- Original visual design source lives in `references/resources/templates/` (`styles.css`, the `.jsx` files)

### Game ports

Every game follows the same convention (Asteroids is the one exception — see Known deviations):

- `app/games/<english-slug>/page.tsx` — 17-line server page, centers the component on black
- `components/games/<Pascal>Game.tsx` — `"use client"` wrapper: `canvasRef`/`restartRef`, five state vars (`finalScore`, `name`, `saving`, `saved`, `saveError`), `handleSave`/`handleRestart`/`handleClose`, mount-once `useEffect` with `handle.destroy()` cleanup, and the game-over modal. `games.id` is hardcoded in the `submitScore` call.
- `components/games/<slug>/engine.ts` — framework-agnostic logic (lives under `components/`, not `lib/`). Contract: `createGame(canvas, { onGameOver })` → `EngineHandle { restart, destroy }`. Tetris deviates: `createGame(canvas, nextCanvas, cb)` plus `onHud` (its original HUD was DOM-based); Snake and Arkanoid draw their HUD on-canvas.
- `sprites.ts` next to the engine when the game loads images (`arkanoid`, `snake`). The spritesheet is cached at **module** level on purpose (it's a cached asset, not game state); game state lives strictly in the `createGame` closure. Loading is async — `createGame` awaits the sheet before frame 1, and `destroy()` must be safe if called first.
- Loop discipline hand-replicated in every engine: `dt` clamped to 50ms (avoids the spiral-of-death after a tab switch), input normalized to `e.code`, and a mandatory `if (e.target instanceof HTMLInputElement) return;` guard in keydown so typing a name in the score modal doesn't drive the game.
- Assets in `public/games/<slug>/` with absolute paths (`spritesheet-breakout.png`, `sounds/*.mp3`, `fruits.png`). Asteroids and Tetris are 100% procedural — no assets.
- `LibraryClient`, `GameCard`, `app/games/page.tsx` and `hall-of-fame` are data-driven: adding a game needs no changes there. It does need a cover CSS block and a row in `schema.sql`.

## Supabase

Schema is hand-versioned in `supabase/schema.sql`, applied manually in the SQL Editor — no `supabase/migrations/`, no CLI setup.

- `games` (`id` pk, `title`, `short`, `long`, `cat`, `cover`, `color` with a check constraint, `difficulty` 1–5, `route`) and `scores` (`game_id` FK cascade, `player_name` 1–20 chars, `score >= 0`)
- View `games_with_stats` (`security_invoker = on`): `g.*` + `max(score) as best` + `count(id) as plays`, computed live rather than stored
- **Critical convention: `games.id` is never equal to the `route` slug.** See [`references/resources/implemented-games.md`](references/resources/implemented-games.md) for the current id/title/category table. Reason: a static route always beats `games/[id]` for the same URL, so if they matched, the detail page would become unreachable.
- Documented trap: `g.*` freezes the view's column list at `CREATE VIEW` time — adding a column to `games` needs `DROP VIEW` + `CREATE VIEW`, not `CREATE OR REPLACE`.
- MCP server `supabase` declared in `.mcp.json` (project ref `bzmgivyltbkzkmjphdbd`), enabled via `.claude/settings.local.json`.

## Spec workflow

- `specs/NN-slug.md`, frontmatter `id`/`title`/`state`/`date`/`dependencies`. `state` is the gate: `Draft` → `Aprobado` (human decision) → `Implementado`.
- `/spec-impl` validates the state, creates a branch named after the spec, and implements step by step with pauses to review diffs. Real cadence: one spec = one branch = one PR.
- Current specs: `01`–`03` MVP/home/about (`Implementado`), `04` Supabase integration (`Aprobado`), `05` Asteroids (`Aprobado`), `06` leaderboard/games table (`Implementado`), `07` Tetris (`Implementado`), `08` Arkanoid (`Aprobado`), `09` Snake (`Implementado`).
- The four games under `references/resources/started-games/` (`02-asteroids`, `03-tetris`, `04-arkanoid`, `05-snake`) are already ported — the next `/add-game` run needs a new folder there.

## Skills

Usa siempre `/frontend-design` para diseñar la interfaz de usuario.

- `/add-game <carpeta>` (p. ej. `/add-game 03-tetris`) — local skill (not tracked in `skills-lock.json`), lives in `.claude/skills/add-game/` with `template.md` and `porting-guide.md`. Analyzes a vanilla game and generates `specs/NN-slug.md` in state `Draft`, ready to approve and run with `/spec-impl`. Never writes code, SQL, or copies assets, and never marks a spec `Aprobado`.
- `/spec` and `/spec-impl` — vendored copies from `Klerith/fernando-skills`, hashes tracked in `skills-lock.json`. **Editing them by hand breaks the lock** — reinstall with `npx skills@latest add Klerith/fernando-skills`.
- `.agents/skills/` is a byte-for-byte mirror of `.claude/skills/`, and `.agents/agents/` mirrors `.claude/agents/` the same way — keep both in sync when touching a skill or agent.

## Agents

- `game-planner` (`.claude/agents/game-planner.md`, mirrored in `.agents/agents/`) — decides which game to add next to the catalog. Reads the catalog, `specs/`, and `started-games/`, detects gaps (category, color, difficulty, mechanic) and proposes viable candidates to port. Its memory is [`references/resources/game-suggestions-todo.md`](references/resources/game-suggestions-todo.md), the only file it writes: it reads that file to avoid repeating itself and updates it with every suggestion. Runs **before** `/add-game` in the chain; never writes code, SQL, or specs.
- `game-jam` (`.claude/agents/game-jam.md`, mirrored in `.agents/agents/`) — takes a theme and invents an original, fully procedural game (no vanilla source, unlike `/add-game`). Writes 2–3 complete, alternative specs (differing mechanic/scoring/HUD) for the same game into `specs/game-jam/<game-id>/`, each in state `Draft` and formatted like `specs/07-tetris.md`/`08-arkanoid.md`/`09-snake.md`. Never writes code, applies SQL, or marks a spec `Aprobado` — a human picks a variant and moves it to `specs/NN-slug.md` before `/spec-impl`.
- `skin-designer` (`.claude/agents/skin-designer.md`, mirrored in `.agents/agents/`) — the one agent that does write code. Given the name of a single game (never the whole catalog on its own), applies the platform's 3 mandatory skins (`clasico`/`neon`/`retro`) to it: extracts hardcoded colors into a shared `components/games/skins.ts`, threads a `skin` param through `createGame()`/`EngineHandle.setSkin()`, and adds a persisted `.chip` selector to that game's wrapper. Its memory is [`references/resources/game-with-themes.md`](references/resources/game-with-themes.md), the only file it writes besides the game's own code. Never touches mechanics/balance/scoring, SQL, or binary assets, and never processes more than one game per invocation.

## Conventions

- `PostToolUse` hook in `.claude/settings.json` runs `.claude/hooks/format.mjs` after every `Write`/`Edit`: `prettier --write --ignore-unknown` always, `eslint --fix` on `.js/.jsx/.ts/.tsx`; swallows errors so it never breaks the turn. In practice: no need to format by hand or run Prettier after editing.
- Specs, commit messages, UI copy, and comments are in Spanish; identifiers and code are in English. Numbers/dates use `.toLocaleString("es-ES")`.
- Still no test runner configured.

## Known deviations

- `components/games/AsteroidsGame.tsx` (684 lines) has its engine **inline** — it was the first port. The three later games separate `engine.ts`; follow that pattern, not Asteroids'.
- `EngineHandle`/`EngineCallbacks` are redeclared independently in each engine instead of shared.
- The game-over modal and leaderboard-row markup are duplicated (per-game wrappers; `games/[id]` vs `hall-of-fame`), as is the `useReveal()` hook (`app/page.tsx` and `app/about/page.tsx`).
- `.claude/skills/add-game/porting-guide.md` is stale — it still says Asteroids is the only ported game.
- `utils/supabase/server.ts` exists but nothing imports it — the data layer uses the browser client even from server components. Query results are asserted with `as Game[]`/`as ScoreRow[]`; there are no generated Supabase types, so a schema drift fails at runtime, not at compile time.
- Specs `04`, `05`, `08` are still `Aprobado` even though their code is merged (real lag, not something to "fix" as a side effect).
- `demos/Demo.tsx` is a stray unimported scratch component.

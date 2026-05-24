# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault — online gaming platform where players compete for points. Uses **Spec Driven Design** via `/spec` and `/spec-impl` skills from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills).

Install skills:
```bash
npx skills@latest add Klerith/fernando-skills
```

## Stack

- **Next.js 16** (breaking changes vs. prior versions — always read `node_modules/next/dist/docs/` before writing code)
- **React 19**
- **Tailwind CSS v4** — uses `@import "tailwindcss"` and `@theme inline {}` syntax, NOT `tailwind.config.js`
- **TypeScript** with `strict: true`, path alias `@/*` → root

## Commands

```bash
npm run dev      # dev server
npm run build    # production build
npm run start    # production server
npm run lint     # eslint
```

No test runner is configured yet.

## Architecture

App Router only (`app/` directory). No `pages/` directory.

- `app/layout.tsx` — root layout with Geist fonts, `min-h-full flex flex-col` body
- `app/globals.css` — Tailwind v4 entry point and CSS variables for `--background`/`--foreground`

TypeScript alias `@/` resolves to repo root, so imports like `@/components/...` work without relative paths.

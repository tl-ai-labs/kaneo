# Kaneo — SDLC project fingerprint

Maintained by the `mmo` plugin. Updated at the close of each run.

## Fingerprint

- **Repo:** kaneo — pnpm 10.32.1 + Turborepo monorepo, TypeScript/ESM, Node ≥20.19
- **Packages:** `@kaneo/api` (Hono, Better Auth, Drizzle + pg, Valibot), `@kaneo/web` (React 19,
  Vite 8, TanStack Router + Query 5, Zustand, Tailwind 4, Radix/Base UI, dnd-kit, i18next,
  Vitest), `@kaneo/site` (Next.js), plus `libs`, `permissions`, `email`, `mcp`, `planka-import`,
  `typescript-config`. `apps/docs` is content-only; `tests/api` and `tests/api-integration` are
  source dirs, not workspace packages.
- **Default policy:** `opus-only-v5` (single premium tier `claude-opus-5` via `claude-cli`,
  hard cap $50/run)
- **Test commands:** `pnpm --filter @kaneo/web test` · `pnpm --filter @kaneo/api test` ·
  repo-wide `pnpm test` (turbo)
- **i18n source of truth:** repo-root `i18n/en-US.json` (NOT `apps/web/src/i18n/`)
- **Baseline:** `.sdlc/baseline/current.json` · stack profile at
  `.sdlc/baseline/stack-profile.md` (Tier 2b — React 19 + Vite + TanStack has no pre-authored
  adapter)

## Standing cautions

- `.husky/pre-commit` runs `biome ci .` then a full Turborepo build; hard-fails on one formatting
  deviation. `commit-msg` enforces conventional commits.
- Root/package `lint` is `biome check --write .` and can reformat unrelated files. Prefer
  targeted, non-writing checks.
- `.gitignore` does **not** cover `.sdlc/` — deliberate, per the user's Gate 0 decision on
  2026-08-27. Run artifacts are tracked and pushed by design, so `git add -A` sweeps them in.
- `.env` / `.env.local` hold plaintext local secrets (gitignored). Never read or echo them.
- Competing AI configs are off-limits by default: `.claude/`, `CLAUDE.md`, `AGENTS.md`,
  `.cursor/rules/`, `.agents/skills/`, `skills/`, `skills-lock.json`, `.coderabbit.yaml`,
  `.devcontainer/`.

## Runs

See [ledger.md](./ledger.md) (human) and [ledger.json](./ledger.json) (machine).

Latest: `20260827-043436-feature-extend-board-filter-chips` — board filter chips with
URL-persisted state. Accepted at Gate 4, left uncommitted. 10 files, 36/112 → 39/200 tests,
0 regressions, ~$5.25 estimated.

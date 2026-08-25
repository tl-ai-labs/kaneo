# Brownfield discovery — kaneo

- **run_id:** `20260824-095555-feature-extend-wip-limits`
- **mode:** first-time (full scan)
- **intent hint:** feature-extend
- **built_at:** 2026-08-24T09:58:43Z
- **plugin_version:** 0.6.0
- **scan scope:** Tier 1 read groups 1-9 + Tier 2b adaptive stack profile (triggered)

## Group 1 — git state

| Field | Value |
|---|---|
| HEAD | `5d1fc9104337786c3ef295ec0dc31656df371d8d` |
| branch | `feature-extend-1/opus-flash` |
| dirty | **yes** (untracked only) |
| remote | `origin` → `https://github.com/tl-ai-labs/kaneo.git` |
| gitignore_covers_sdlc | **false** |

Untracked entries: `.claude/settings.local.json`, `.hook-logs/`, `.sdlc/`. No modified or staged tracked files — the tracked worktree is clean, so a rollback anchor at HEAD is reliable.

> Note: the branch at scan time is `feature-extend-1/opus-flash` at commit `5d1fc910` ("docs: update contributors and sponsors"). If you expected a different branch, confirm before Gate 0 — the rollback anchor is taken from this SHA.

## Group 2 — directory topology

```
apps/{api,web,site,docs}   packages/{libs,permissions,mcp,email,planka-import,typescript-config}
tests/{api,api-integration}   i18n/   charts/kaneo   deploy/   scripts/   sentry/   plans/
.agents/skills   .claude/skills   .cursor/rules   .husky   .devcontainer   .vscode
```

1578 tracked files — well under the large-repo sampling threshold, so no sampling was applied.

Entry points: `apps/api/src/index.ts`, `apps/web/src/main.tsx`.

## Group 3 — detected stacks

Single-language repo (TypeScript/Node) across a pnpm + Turborepo workspace.

| Package | Stack | Frameworks |
|---|---|---|
| root | node-typescript | turborepo, pnpm workspace, biome, husky, commitlint |
| `@kaneo/api` (apps/api) | node-typescript | **Hono**, hono-openapi, Valibot, Better Auth, Drizzle ORM + Postgres, ioredis, MCP SDK, Vitest |
| `@kaneo/web` (apps/web) | node-typescript-react | **React + Vite**, TanStack Router/Query, dnd-kit, Radix + base-ui, Tailwind, Tiptap, react-i18next, zustand, Vitest |
| `@kaneo/site` (apps/site) | node-typescript-react | Next.js |
| `@kaneo/libs` | node-typescript | typed Hono client |
| `@kaneo/permissions` | node-typescript | better-auth access control |
| `@kaneo/mcp` | node-typescript | MCP SDK (stdio), zod |
| `@kaneo/email` | node-typescript-react | react-email, nodemailer |
| `@kaneo/planka-import` | node-typescript | CLI |

`apps/docs` is content-only (mdx, no package.json).

Node engine `>=20.19.0`, package manager pinned `pnpm@10.32.1`, TypeScript `7.0.2`.

## Group 4 — test / build commands

**Proposed test command: `pnpm test`** (source: `package.json#scripts.test` → `turbo test`).

Scoped alternatives, useful because the intent touches two packages:

- API unit: `pnpm --filter @kaneo/api test` → `vitest run --config vitest.config.ts`, includes `tests/api/**/*.test.ts`
- API integration: `pnpm --filter @kaneo/api test:integration` → `vitest.integration.config.ts`, **requires a PostgreSQL instance**
- Web unit: `pnpm --filter @kaneo/web test` → `vitest run`, jsdom, includes `apps/web/src/**/*.test.{ts,tsx}`
- Typecheck: `pnpm typecheck`

**Observed baseline (run during discovery, read-only):**

- API unit: **58 files / 374 tests passed** (~5s)
- Web unit: **36 files / 112 tests passed** (~17s)
- API integration: not run (needs Postgres; out of Tier 1 scope)

So the pre-change suite is green — a later red test is attributable to the run.

> Gate 0 should confirm whether the run's verification command is the full `pnpm test` or the two scoped filters. Note `pnpm lint` runs Biome with `--write` and can rewrite unrelated files; prefer `biome check` on changed paths.

## Group 5 — docs present

`README.md`, `CLAUDE.md`, `AGENTS.md` (canonical guidance, `CLAUDE.md` just imports it), `CONTRIBUTING.md`, `SECURITY.md`, `ENVIRONMENT_SETUP.md`, `apps/docs/` (product + API docs, mdx), `plans/` (7 numbered plan docs + README). No ADR directory.

`AGENTS.md` is an unusually load-bearing operating guide — it defines authorization boundaries, i18n rules, migration rules, and a "follow a change through" surface checklist. Downstream phases should treat it as authoritative repo policy.

## Group 6 — detected AI/agent setup

| Path | Type |
|---|---|
| `.claude/` | Claude Code project config |
| `.claude/settings.local.json` | local settings (untracked) |
| `.claude/skills/` | 11 skill dirs |
| `CLAUDE.md` | Claude instructions |
| `AGENTS.md` | agent instructions |
| `.agents/skills/` | 10 skill dirs |
| `skills/` | 10 skill dirs (mirror) |
| `.cursor/rules/` | 7 `.mdc` rule files |

Absent: `.mcp.json`, `.cursorrules`, Aider config, `.continue/`, `.roo/`, `.github/copilot-instructions.md`, repo-local `routing-policy.yaml`, gemini config files.

## Group 7 — env keys (names only, no values read)

Files: `.env.sample`, `apps/api/.env.test.example`, `apps/web/.env.development`, `apps/web/.env.production`. No `.env` or `.env.local` present at scan time.

Declared key names (28 unique) include `AUTH_SECRET`, `DATABASE_URL`, `POSTGRES_*`, `SMTP_*`, `GITHUB_*`, `KANEO_*`, `VITE_API_URL`, `VITE_CLIENT_URL`, `VITE_SENTRY_DSN`, `VITE_TURNSTILE_SITE_KEY`.

Referenced in code (89 unique names) — broader than the samples, notably `REDIS_*`, `S3_*`, `SENTRY_*`, `CREEM_*`, `CUSTOM_OAUTH_*`, `DISCORD_*`, `GOOGLE_*`, `TURNSTILE_SECRET_KEY`, `NOTIFICATION_SECRET_ENCRYPTION_KEY`. Full list in `baseline.json`. **No values were read or recorded.**

## Group 8 — monorepo, submodules, LFS, infra

- **Monorepo:** pnpm workspace (`packages/**`, `apps/**`) driven by Turborepo. 10 packages.
- **Submodules:** none (`.gitmodules` absent).
- **Git LFS:** not in use. `.gitattributes` exists but only enforces `LF` on `.husky/*`.
- **Infra:** no root `Dockerfile` or `docker-compose*.yml` at repo root (containers live under `deploy/`); Helm chart at `charts/kaneo`; 13 GitHub Actions workflows including `ci.yml` and `nightly.yml`; devcontainer present.
- **Hooks:** Husky + commitlint with conventional-commit config — any commit during the run must use a conventional subject or the hook rejects it.

## Group 9 — regulated-repo signals

One weak signal: `SECURITY.md` at repo root (a standard OSS vulnerability-reporting policy, not a compliance artifact). No `HIPAA/`, `PCI/`, `SOC2/`, `GDPR`, `compliance/`, `PRIVACY.md`, or CODEOWNERS security/compliance entries found (no CODEOWNERS file at all).

`regulated_repo_warning_required: false`. No Gate 0 regulated warning needed.

## Coexistence risks

- **Cursor rules detected at `.cursor/rules` (7 `.mdc` files).** The plugin will never touch them, but if you have Cursor's auto-lint running on save, changes we make may trigger it.
- **Claude Code project config detected (`.claude/`, `.claude/settings.local.json`, `.claude/skills/`) plus `CLAUDE.md` / `AGENTS.md`.** All off-limits by default. `.claude/settings.local.json` is currently untracked.
- **Two parallel skill trees (`.agents/skills/`, `skills/`).** Off-limits by default; they are design/animation skill docs, not build inputs.
- **No custom `.mcp.json`.** Nothing to coexist with; the plugin uses its own bundled dispatch server.
- **No repo-local `routing-policy.yaml`.** Shipped policy applies; pass `--policy <name>` to change it.
- **`.sdlc/` is not gitignored.** Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (append) to this run's allowlist so the plugin can add the entry as part of the run.
- **Husky + commitlint active.** Conventional commit subjects are mandatory for any commit made during the run.
- **`pnpm lint` uses Biome `--write`.** It can rewrite unrelated files; prefer targeted `biome check` on changed paths so the diff stays attributable.

## Proposed off-limits

```
.git/**                     .sdlc/**                    .hook-logs/**
.claude/**                  .cursor/**                  .agents/**        skills/**
CLAUDE.md                   AGENTS.md
.env  .env.*  .env.sample   apps/api/.env.test.example
apps/web/.env.development   apps/web/.env.production
node_modules/**  **/node_modules/**  dist/**  **/dist/**  build/**  .next/**
.turbo/**  **/.turbo/**     pnpm-lock.yaml               .husky/**
apps/web/src/routeTree.gen.ts        apps/api/drizzle/meta/**
```

Generated-file notes (not strictly off-limits, but must be regenerated rather than hand-edited):

- `apps/web/src/routeTree.gen.ts` — TanStack Router generated
- `apps/api/drizzle/*.sql` — produced by `pnpm --filter @kaneo/api db:generate` (42 migrations exist; `0042_previous_the_executioner.sql` is latest)
- `i18n/schema.json` — produced by `pnpm i18n:schema`

## Intent orientation (recorded, not scope)

The hinted job (per-lane WIP limit with an over-cap indicator in the lane header) maps onto the existing **column** vertical. Relevant existing files were noted in `baseline.json#intent_topology_notes` — API `columnTable` schema at `apps/api/src/database/schema.ts:342`, the Hono route chain in `apps/api/src/column/index.ts`, controllers under `apps/api/src/column/controllers/`, web fetchers/hooks under `apps/web/src/{fetchers,hooks}/column/`, and the lane header at `apps/web/src/components/kanban-board/column/column-header.tsx` (which already renders a `column.tasks.length` badge). Recording only; scoping is Gate 0's job.

## Tier 2b — adaptive stack profile

Triggered: the primary stacks are **Hono** (API) and **React/Vite** (web), and the shipped adapters are only `generic.md`, `nest.md`, `python.md`. Learned profile written to `.sdlc/baseline/stack-profile.md`; it is authoritative over any pre-authored adapter fragment.

## Scan notes

Tier 1 groups completed comfortably inside the timebox. The two unit test suites were additionally executed to establish a green baseline; that is the only part of discovery that took more than a few seconds (~25s combined) and it was read-only.

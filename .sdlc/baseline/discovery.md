# Brownfield discovery — kaneo

- **Run:** `20260825-084051-feature-extend-estimated-hours`
- **Mode:** first-time (no prior `.sdlc/baseline/`)
- **Intent hint:** feature-extend
- **Scope:** Tier 1 local reads + Tier 2b adaptive stack profile
- **Timebox:** completed inside the 30s budget; no sampling fallback needed (1578 tracked files)

## Git state

| Field | Value |
| --- | --- |
| HEAD | `5d1fc9104337786c3ef295ec0dc31656df371d8d` |
| Branch | `feature-extend-2/opus-only` |
| Remote | `origin` → `https://github.com/tl-ai-labs/kaneo.git` |
| Tracked modifications | none |
| Untracked | `.claude/settings.local.json`, `.hook-logs/`, `.sdlc/` |
| `gitignore_covers_sdlc` | **false** |

The branch sits exactly on `main`'s tip and carries no feature work. Working-tree dirt is untracked only, so a rollback anchor at `5d1fc910` is clean.

## Directory topology

Top level: `apps/` (api, web, site, docs), `packages/` (libs, permissions, mcp, email, planka-import, typescript-config), `tests/` (api, api-integration), `i18n/`, `charts/kaneo`, `deploy/`, `scripts/`, `sentry/`, `plans/`, `skills/`, plus tool dirs `.agents/`, `.claude/`, `.cursor/`, `.devcontainer/`, `.github/`, `.husky/`, `.vscode/`.

Entry points: `apps/api/src/index.ts`, `apps/web/src/main.tsx`.

## Detected stacks

Single-language repo (TypeScript, ESM, Node >= 20.19), organized as a **pnpm workspace + Turborepo** monorepo on `pnpm@10.32.1`.

| Package | Root | Frameworks |
| --- | --- | --- |
| `@kaneo/api` | `apps/api` | Hono, hono-openapi, Better Auth, Drizzle ORM (postgres), Valibot, Vitest, MCP SDK, ioredis, pg |
| `@kaneo/web` | `apps/web` | React, Vite, TanStack Router + Query, Tailwind, dnd-kit, Zustand, react-i18next, TipTap, Vitest + Testing Library |
| `@kaneo/site` | `apps/site` | Next.js |
| `@kaneo/libs` | `packages/libs` | typed Hono client |
| `@kaneo/permissions` | `packages/permissions` | Better Auth permission vocabulary |
| `@kaneo/mcp` | `packages/mcp` | published stdio MCP server |
| `@kaneo/email`, `planka-import`, `@kaneo/typescript-config` | `packages/*` | — |

`tests/` is not a workspace package; `tests/api` and `tests/api-integration` run under the `@kaneo/api` vitest configs.

## Test / build commands

- **Proposed test command:** `pnpm test` (source: root `package.json#scripts.test` → `turbo test`)
- API unit: `pnpm --filter @kaneo/api test` (vitest)
- API integration (needs Postgres): `pnpm --filter @kaneo/api test:integration`
- Web unit: `pnpm --filter @kaneo/web test`
- Typecheck: `pnpm typecheck`
- Lint (read-only, CI parity): `pnpm exec biome ci .` — note that `pnpm lint` / `biome check --write .` **writes** and is marked `persistent` in turbo.
- i18n gate: `pnpm i18n:check`

CI (`.github/workflows/ci.yml`) gates on exactly three commands: `pnpm exec biome ci .`, `pnpm typecheck`, `pnpm test`.

## Docs present

`README.md`, `CLAUDE.md`, `AGENTS.md` (canonical agent guide, imported by CLAUDE.md), `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `ENVIRONMENT_SETUP.md`, `CHANGELOG.md`, `apps/docs/` (product + API docs), `plans/`, `tests/api-integration/README.md`. No ADR directory.

## Detected AI / agent setup

| Path | Type |
| --- | --- |
| `.claude/` (+ `settings.local.json`, `skills/`) | Claude Code project config |
| `.agents/skills/`, `skills/`, `skills-lock.json` | vendored agent skills |
| `.cursor/rules/` | Cursor rules |
| `CLAUDE.md`, `AGENTS.md` | agent instructions |
| `.coderabbit.yaml` | AI code review on PRs |
| `.sdlc/project.json` | this plugin's project config (`default_policy: opus-only-v5`) |

Absent: `.mcp.json`, `.cursorrules`, aider/continue/copilot configs, `.roo/`, repo-local `routing-policy.yaml`, `CLAUDE.local.md`.

## Env keys (names only — no values read)

- `.env`: `KANEO_CLIENT_URL`, `KANEO_API_URL`, `AUTH_SECRET`, `DATABASE_URL`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`
- `.env.local`: the five `POSTGRES_*` keys
- `.env.sample`: the above plus `GITHUB_*` app/OAuth keys and `SMTP_*` keys

`.env` and `.env.local` are gitignored. Code references ~100 distinct env names (Sentry, S3/AWS, Redis, Creem billing, Turnstile, custom OAuth, feature flags); the full list is in `baseline.json#env_keys_referenced_in_code`.

## Infra

`Dockerfile.kaneo`, `compose.yml` + `compose.local.yml`, Helm chart at `charts/kaneo`, 13 GitHub Actions workflows, devcontainer, husky hooks with commitlint (conventional commits enforced). No Terraform, GitLab CI, CircleCI or Jenkins.

## Database

Drizzle ORM on PostgreSQL. Schema `apps/api/src/database/schema.ts` (`taskTable` at line 401), relations in `relations.ts`, migrations in `apps/api/drizzle/` with `meta/_journal.json`. Journal has 43 entries ending at idx 42 (`0042_previous_the_executioner`), so the next generated migration on this branch is `0043_*`.

## Regulated-repo signals

Only `SECURITY.md` (a standard OSS vulnerability-disclosure policy). No `PRIVACY.md`, `COMPLIANCE.md`, HIPAA/PCI/SOC2/GDPR docs, no `CODEOWNERS`, no compliance-named directories. `regulated_repo_warning_required: false` — no Gate 0 regulated warning needed.

## Coexistence risks

- **Cursor rules detected.** You have Cursor rules at `.cursor/rules/`. The plugin will never touch them, but if Cursor auto-lint runs on save, changes we make may trigger it.
- **Claude Code config detected.** `.claude/` including untracked `settings.local.json`. Untouched by default; already excluded from Biome.
- **Vendored agent skills.** `.agents/skills/`, `skills/`, `.claude/skills/` with `skills-lock.json`. Treat as vendored; do not hand-edit.
- **`.coderabbit.yaml` detected.** AI code review runs on pull requests and will comment on anything this run opens.
- **No custom `.mcp.json`.** Nothing to reconcile with the bundled dispatch server.
- **No repo-local `routing-policy.yaml`.** Routing comes from `.sdlc/project.json` (`default_policy: opus-only-v5`) or `--policy`.
- **`.sdlc/` not gitignored.** Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 should offer to add `.gitignore` to this run's allowlist so the plugin can add the entry as part of the run.
- **`.sdlc/` not excluded from Biome.** `biome.json` `files.includes` has no `!**/.sdlc` entry and `vcs.useIgnoreFile` is `false`, so `pnpm exec biome ci .` scans `.sdlc/` — see the red-CI risk below.

## Repo-state risks

1. **`pnpm exec biome ci .` is already red (high).** Exit 1, `Found 2 errors`. Both errors are formatting-only, in `.sdlc/pre-check-status.json` and `.sdlc/project.json` — untracked leftovers, not this branch's source. There are also 78 pre-existing warnings (66 `lint/suspicious/noUndeclaredEnvVars`, 8 `useOptionalChain`, 2 `noImgElement`, plus one unused import and one unused param) across `apps/` and `tests/`. Baseline verification must compare against this red starting point rather than assume green, and any new artifact written into `.sdlc/` as space-indented JSON will add more errors. Two fixes are available and both touch user source, so both need explicit Gate 0 allowlisting: add `.sdlc/` to `.gitignore`, and/or add `"!**/.sdlc"` to `biome.json#files.includes`.
2. **Live dev DB is one migration ahead of this branch (high).** `docker exec kaneo-postgres-1` reports 44 rows in `drizzle.__drizzle_migrations` and `task.estimated_minutes` already exists, applied by a sibling branch's `0043`. This branch's journal stops at idx 42 and no source file mentions `estimated` anywhere. A migration generated here will also be numbered `0043` and collide: `drizzle-kit migrate` will hit a journal/hash mismatch or a duplicate-column error, and `db:generate` will diff the schema against the file-based snapshots (which do not know about `estimated_minutes`) rather than against the live DB. Plan for a clean dev database, or drop the sibling column, before running migrations.
3. **Dev processes are live (medium).** API pid 559540 on `:1337`, web pid 547818 on `:5173`, Postgres 16 on `:5432`. Do not kill by name pattern. A schema change requires a deliberate API restart to take effect.
4. **Separate integration DB (low).** `kaneo-mmo-itest` (postgres:16) on host port 55432 backs `test:integration`.
5. **`.sdlc/` leftovers from other branches (low).** `.sdlc/runs/` holds `20260820-…-lane-wip-limit` and `20260824-…-estimated-hours` plus `.sdlc/delegation`, `.sdlc/local`, `.sdlc/pre-check`. Ignored — not prior runs for this branch.
6. **Conventional commits enforced (info).** husky + commitlint reject non-conventional messages; `.gitattributes` pins `.husky/*` to LF.

## Proposed off-limits

`.git/**`, `.env`, `.env.*`, `.env.local`, `.env.sample`, `.claude/**`, `.cursor/**`, `.agents/**`, `skills/**`, `skills-lock.json`, `.coderabbit.yaml`, `.sdlc/**`, `.hook-logs/**`, `node_modules/**`, `**/node_modules/**`, `dist/**`, `**/dist/**`, `build/**`, `.next/**`, `**/.next/**`, `.turbo/**`, `**/.turbo/**`, `out/**`, `coverage/**`, `**/coverage/**`, `.source/**`, `apps/web/src/routeTree.gen.ts` (generated by TanStack Router), `apps/web/.tanstack/**`, `pnpm-lock.yaml`, `apps/api/drizzle/meta/**` (drizzle-managed snapshots), `CHANGELOG.md`, `CONTRIBUTORS.svg`, `.husky/**`, `.vscode/**`, `.devcontainer/**`.

Gate 0 candidates to move *into* scope if the user wants them: `.gitignore` (to add `.sdlc/`) and `biome.json` (to exclude `.sdlc`).

## Topology relevant to the intent hint

Recorded for orientation only; scope is decided at Gate 0.

- API: `apps/api/src/database/schema.ts` (`taskTable`), `apps/api/src/task/index.ts` (routes + Valibot + OpenAPI), `apps/api/src/task/controllers/*.ts`, `apps/api/src/task/validate-task-fields.ts`, `apps/api/src/schemas.ts`, read path in `task/controllers/get-tasks.ts` and `column/controllers/get-columns.ts`.
- Client contract: `packages/libs` typed Hono client.
- Web: `apps/web/src/fetchers/task/*.ts`, `apps/web/src/hooks/mutations/task/*.ts`, `apps/web/src/components/kanban-board/task-card.tsx`, `.../column/column-header.tsx`, `.../column/index.tsx`, `apps/web/src/components/public-project/task-card.tsx`, `apps/web/src/types/{task,project}.ts`.
- i18n: `i18n/en-US.json`, `tasks` namespace; 11+ locales; `pnpm i18n:check`.
- Tests: `tests/api/**`, `tests/api-integration/**`, colocated `apps/web/**/*.test.tsx`.

## Tier 2b

Triggered — Hono and React/TanStack have no shipped adapter (only `generic.md`, `nest.md`, `python.md`). Learned profile written to `.sdlc/baseline/stack-profile.md`; it is authoritative over any pre-authored adapter fragment.

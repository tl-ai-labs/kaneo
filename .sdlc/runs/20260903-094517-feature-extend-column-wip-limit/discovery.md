# Brownfield discovery — Kaneo

- Run: `20260903-094517-feature-extend-column-wip-limit`
- Mode: `first-time` (no prior baseline)
- Scanned: 2026-09-03T09:47:17Z
- Plugin: mmo 0.6.0
- Scope: Tier 1 local reads, plus Tier 2b adaptive stack profile (triggered)

## Git state

| Field | Value |
| --- | --- |
| HEAD | `5d1fc9104337786c3ef295ec0dc31656df371d8d` |
| Branch | `feature-extend-1/opus-flash-sdk` |
| Remote | `origin` → `https://github.com/tl-ai-labs/kaneo.git` |
| Dirty | Yes — untracked only |
| Untracked | `.claude/settings.local.json`, `.hook-logs/`, `.sdlc/` |
| `.gitignore` covers `.sdlc/` | **No** |
| Submodules | None |
| Git-LFS | None (`.gitattributes` only forces LF on `.husky/*`) |

No tracked source file is modified, so `5d1fc910` is a clean rollback anchor. Note the branch is **not** `main`.

## Topology

Top-level: `.agents`, `.claude`, `.cursor`, `.devcontainer`, `.github`, `.husky`, `.vscode`, `apps`, `charts`, `deploy`, `i18n`, `packages`, `plans`, `scripts`, `sentry`, `skills`, `tests`.

Entry points: `apps/api/src/index.ts`, `apps/web/src/main.tsx`, `apps/site/app/page.tsx`. 1578 tracked files.

## Detected stacks

pnpm workspaces (`packages/**`, `apps/**`) driven by Turborepo. pnpm 10.32.1, Node >= 20.19, TypeScript 7.0.2, Biome 2.5.7 for lint/format.

| Package | Root | Stack | Key frameworks |
| --- | --- | --- | --- |
| `@kaneo/api` | `apps/api` | node-typescript | Hono, hono-openapi, Valibot, Better Auth, Drizzle ORM + PostgreSQL, ioredis, MCP SDK, Sentry, Vitest |
| `@kaneo/web` | `apps/web` | node-typescript-react | React, Vite, TanStack Router + Query, dnd-kit, Radix, Tailwind, i18next, Zustand, Vitest + Testing Library (jsdom) |
| `@kaneo/site` | `apps/site` | node-typescript-react | Next.js (marketing site) |
| `@kaneo/libs` | `packages/libs` | node-typescript | Typed Hono client re-exported to web |
| `@kaneo/permissions` | `packages/permissions` | node-typescript | Permission vocabulary + built-in roles |
| `@kaneo/mcp` | `packages/mcp` | node-typescript | Published stdio MCP package |
| `@kaneo/email` | `packages/email` | node-typescript-react | react-email, nodemailer |
| `@kaneo/planka-import` | `packages/planka-import` | node-typescript | Import CLI |
| `@kaneo/typescript-config` | `packages/typescript-config` | node-typescript | Shared tsconfig, no scripts |

`apps/docs`, `tests/api`, and `tests/api-integration` are directories, not workspace packages. API unit tests live in `tests/api/**` but run through `apps/api`'s Vitest config.

Database: PostgreSQL via Drizzle. Schema at `apps/api/src/database/schema.ts`, relations at `apps/api/src/database/relations.ts`, migrations in `apps/api/drizzle/` (latest `0042_previous_the_executioner.sql`), generated with `pnpm --filter @kaneo/api db:generate`.

## Proposed test command

**Proposed:** `pnpm --filter @kaneo/api test && pnpm --filter @kaneo/web test`

Scoped deliberately: root `pnpm test` goes through `turbo test` with `dependsOn: ["^build"]`, which rebuilds every package. Gate 0 confirms.

Baseline health observed during discovery (both green, so any later failure is attributable to this run):

- `pnpm --filter @kaneo/api test` → exit 0, 58 files / 374 tests, 7.95s
- `pnpm --filter @kaneo/web test` → exit 0, 36 files / 112 tests, 25.97s
- `pnpm --filter @kaneo/api test:integration` → **not run**; needs a live PostgreSQL instance

Other useful commands: `pnpm --filter @kaneo/api typecheck`, `pnpm --filter @kaneo/web typecheck`, `pnpm exec biome ci .` (read-only; the `lint` scripts run `biome check --write` and will rewrite unrelated files).

## Docs present

`README.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `ENVIRONMENT_SETUP.md`, `CHANGELOG.md`, `apps/docs/`, `tests/api-integration/README.md`. No ADR directory.

## Detected AI/agent setup

| Path | Type |
| --- | --- |
| `AGENTS.md` | Canonical agent operating guide — architecture, boundaries, conventions, verification policy |
| `CLAUDE.md` | Thin pointer that `@`-imports `AGENTS.md` |
| `.claude/settings.local.json` | Local Claude Code settings (untracked) |
| `.claude/skills/verify/SKILL.md` | Claude skill |
| `.cursor/rules/*.mdc` | 7 Cursor rule files: project-overview, backend-api, frontend-web, database-schema, development-conventions, deployment-devops, cursor-rules |
| `.agents/skills/` | 13 skill bundles (design / animation / UI) |
| `skills/` + `skills-lock.json` | Top-level mirror of the same skill names |
| `.coderabbit.yaml` | CodeRabbit AI PR review, auto-review + auto-reply enabled |
| `.github/workflows/auto-merge.yml` | CI automation that can merge PRs |
| `.devcontainer/devcontainer.json` | Devcontainer |

Absent: `.mcp.json`, `.cursorrules`, `.aider.conf.*`, `.continue/`, `.github/copilot-instructions.md`, `.roo/`, `CLAUDE.local.md`, repo-local `routing-policy.yaml`, any `gemini*.{yaml,json}`.

## Env keys (names only — no values were read or recorded)

- `.env` — `KANEO_CLIENT_URL`, `KANEO_API_URL`, `AUTH_SECRET`, `DATABASE_URL`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`
- `.env.local` — `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`
- `.env.sample` — tracked; Kaneo URLs, Postgres, `AUTH_SECRET`, GitHub OAuth/App, SMTP

Code references ~80 distinct env vars (Sentry, Redis, S3, Creem billing, custom OAuth, Discord/Google/GitHub). `.env` and `.env.local` are gitignored; only `.env.sample` is tracked. No encrypted-secret tooling (SOPS, git-crypt, age, `ENC[...]`) detected.

## Regulated-repo signals

Only `SECURITY.md`, which is a conventional open-source policy file. No HIPAA/PCI/SOC2/GDPR/compliance directories and no CODEOWNERS. `regulated_repo_warning_required: false`. That said, `.env` on disk holds a real `AUTH_SECRET` and Postgres credentials, so keep it off-limits regardless.

## Coexistence risks

- **Cursor rules detected** — You have Cursor rules at `.cursor/rules/`. The plugin will never touch them, but if you have Cursor's auto-lint running on save, changes we make may trigger it. Their content (backend-api, frontend-web, database-schema) overlaps this job's surface, so a Cursor session running in parallel could edit the same files.
- **Two competing instruction sets** — `AGENTS.md` is canonical and `CLAUDE.md` imports it. Both are read-only inputs; downstream phases must honor them (Valibot validation, `requireWorkspacePermission`, `publishEvent()`, generated Drizzle migrations, static i18n keys) rather than edit them.
- **Duplicate skill trees** — `.agents/skills/` and top-level `skills/` mirror each other with a `skills-lock.json`. Untouched by default.
- **CodeRabbit auto-review** — `.coderabbit.yaml` has `auto_review.enabled: true` and `chat.auto_reply: true`. Any branch pushed during this run attracts bot review comments.
- **Auto-merge workflow** — `.github/workflows/auto-merge.yml` exists. Confirm no automated merge can fire on a branch this run creates.
- **No custom `.mcp.json`** — no competing MCP servers registered at project scope.
- **No repo-local `routing-policy.yaml`** — the shipped/CLI-selected policy applies.
- **`.sdlc/` not gitignored** — Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (append) to this run's allowlist so the plugin can add the entry as part of the run. `.hook-logs/` and `.claude/settings.local.json` are in the same position.
- **Not on `main`** — HEAD is `feature-extend-1/opus-flash-sdk`. Anchor rollback to this branch's HEAD.

## Proposed off-limits

`.git/**`, `.env`, `.env.local`, `.env.*`, `.claude/**`, `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `.cursor/**`, `.agents/**`, `skills/**`, `skills-lock.json`, `.coderabbit.yaml`, `.devcontainer/**`, `.github/workflows/**`, `.husky/**`, `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.turbo/**`, `out/**`, `coverage/**`, `pnpm-lock.yaml`, `apps/web/src/routeTree.gen.ts`, `apps/web/.tanstack/**`, `.hook-logs/**`, `.sdlc/**`.

`pnpm-lock.yaml` should only change as a side effect of an approved dependency change. `apps/web/src/routeTree.gen.ts` is generated by the TanStack router plugin.

## Likely in-scope surface for the upcoming job

Discovery's best guess only — Gate 0 confirms the allowlist. For a per-column WIP limit (schema + migration + API) with an over-cap indicator in the authenticated kanban board column header:

- API: `apps/api/src/database/schema.ts` (`columnTable` at line 342), `apps/api/src/database/relations.ts`, a generated migration under `apps/api/drizzle/`, `apps/api/src/column/index.ts` (Valibot validators + OpenAPI metadata), `apps/api/src/column/controllers/{create,update,get}-column.ts`
- Web: `apps/web/src/fetchers/column/*.ts`, `apps/web/src/hooks/{mutations,queries}/column/*`, `apps/web/src/components/kanban-board/column/{index,column-header}.tsx`, `apps/web/src/types/project.ts`
- i18n: `i18n/en-US.json` (source of truth; namespaces include `common`, `tasks`, `workspace`)
- Tests: `tests/api/column/`, `apps/web/src/components/kanban-board/*.test.tsx`

Out of scope per the brief: public read-only board surfaces, `apps/site`, `packages/mcp`, `charts/kaneo`, `apps/docs`.

Note `apps/web/src/components/board/` exists as a **second, separate board implementation** alongside `apps/web/src/components/kanban-board/`. Confirm at Gate 0 which one is the authenticated board in play.

## Scan notes

Tier 1 completed within budget; no sampling fallback needed. Tier 2b adaptive stack profile was triggered (Hono + React/Vite match none of the shipped `generic`/`nest`/`python` adapters) and written to `.sdlc/baseline/stack-profile.md`.

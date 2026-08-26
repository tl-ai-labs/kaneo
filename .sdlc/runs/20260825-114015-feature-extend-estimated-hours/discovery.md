# Brownfield discovery — Kaneo

- **Run id:** `20260825-114015-feature-extend-estimated-hours`
- **Mode:** first-time (full scan)
- **Built at:** 2026-08-25T11:54:52Z
- **Plugin version:** 0.6.0
- **Scan duration:** within Tier 1 timebox; no sampling fallback needed (1578 tracked files)

Kaneo is a self-hosted project-management platform. A Hono API owns domain behavior and authorization, a React/Vite app consumes a typed Hono RPC client, PostgreSQL (Drizzle ORM) stores state, and events + WebSockets (optional Redis fan-out) keep clients current.

## Git state

| Field | Value |
| --- | --- |
| HEAD | `5d1fc9104337786c3ef295ec0dc31656df371d8d` |
| Branch | `feature-extend-2/opus-sonnet` |
| Dirty | yes — untracked only |
| Untracked | `.claude/settings.local.json`, `.hook-logs/`, `.sdlc/` |
| Tracked modifications | none |
| Remote | `origin` → `https://github.com/tl-ai-labs/kaneo.git` |
| `.gitignore` covers `.sdlc/` | **no** |

The worktree has **no modified tracked files**, so a rollback anchor at HEAD is clean. Three untracked paths exist; per AGENTS.md ("preserve unrelated work in a dirty worktree") they must be left alone.

## Directory topology

Top-level: `apps/`, `packages/`, `charts/`, `deploy/`, `i18n/`, `plans/`, `scripts/`, `sentry/`, `skills/`, `tests/`, plus dotdirs `.agents/`, `.claude/`, `.cursor/`, `.devcontainer/`, `.github/`, `.husky/`, `.vscode/`.

Entry points: `apps/api/src/index.ts`, `apps/web/src/main.tsx`, `packages/libs/src/index.ts`, `packages/mcp/src/index.ts`.

## Detected stacks

Single language family (TypeScript, ESM, Node >= 20.19, pnpm 10.32.1, TypeScript 7.0.2), several runtime profiles:

| Package | Root | Frameworks |
| --- | --- | --- |
| `@kaneo/api` | `apps/api` | Hono, hono-openapi, Drizzle ORM + pg, Better Auth, Valibot, ioredis, MCP SDK, Sentry, Vitest |
| `@kaneo/web` | `apps/web` | React, Vite, TanStack Router + Query, Radix/Base UI, dnd-kit, TipTap, Tailwind, react-i18next, Zustand, Immer, Vitest |
| `@kaneo/site` | `apps/site` | Next.js marketing site |
| `@kaneo/libs` | `packages/libs` | Hono RPC client (`hc<AppType>`), Vitest |
| `@kaneo/permissions` | `packages/permissions` | Better Auth permission vocabulary, Vitest |
| `@kaneo/mcp` | `packages/mcp` | Published stdio MCP package |
| `@kaneo/email`, `@kaneo/planka-import`, `@kaneo/typescript-config` | `packages/*` | support packages |
| docs content | `apps/docs` | Mintlify-style MDX, no package.json |

Build orchestration: **Turborepo** over a **pnpm workspace** (`packages/**`, `apps/**`). Lint/format: **Biome** 2.5.7.

## Test / build commands

- **Proposed test command: `pnpm test`** (root `package.json#scripts.test` → `turbo test`; pnpm-workspace.yaml present).
- Narrower, preferred while iterating:
  - `pnpm --filter @kaneo/api test` (Vitest unit, `tests/api`)
  - `pnpm --filter @kaneo/api test:integration` (Vitest, **requires PostgreSQL**, `tests/api-integration`)
  - `pnpm --filter @kaneo/web test` (Vitest + component tests colocated as `*.test.tsx`)
  - `pnpm --filter @kaneo/libs test`
  - `pnpm typecheck` (turbo typecheck across packages)
- Runner is **Vitest** everywhere. Test dirs: `tests/api/`, `tests/api-integration/`, plus colocated `apps/web/src/**/*.test.tsx`.
- Gate 0 should confirm whether integration tests (Postgres-backed) are in scope for this run — AGENTS.md requires them for database changes, and this run adds a column.

## Docs present

`README.md`, `CLAUDE.md`, `AGENTS.md` (canonical agent guide, `@`-included by CLAUDE.md), `CONTRIBUTING.md`, `SECURITY.md`, `ENVIRONMENT_SETUP.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, `apps/docs/**` (product + API reference, `apps/docs/openapi.json` is generated). No ADR directory.

**AGENTS.md is load-bearing.** It states hard boundaries downstream phases must respect: API is the authorization authority; Valibot validation and OpenAPI metadata must stay accurate; migrations must be generated via `pnpm --filter @kaneo/api db:generate` and the SQL inspected and committed with the schema change; user-facing copy must use static i18n keys with `i18n/en-US.json` as source of truth; mutations affecting realtime state must consider event publication, WebSocket delivery, and client cache invalidation.

## Detected AI/agent setup

| Path | Type |
| --- | --- |
| `.claude/` + `.claude/settings.local.json` + `.claude/skills/` | Claude Code project config (settings file untracked) |
| `CLAUDE.md`, `AGENTS.md` | instruction files |
| `.agents/skills/`, `skills/`, `skills-lock.json` | vendored agent skills, mirrored in three locations |
| `.cursor/rules/*.mdc` (7 files) | Cursor rules |
| `.coderabbit.yaml` | CodeRabbit AI PR review |

Absent: `.mcp.json`, `.cursorrules`, `.aider.conf.*`, `.continue/`, `.roo/`, `.github/copilot-instructions.md`, `CLAUDE.local.md`, repo-local `routing-policy.yaml`.

## Coexistence risks

- **Cursor rules detected at `.cursor/rules/`.** The plugin will never touch them, but if you have Cursor's auto-lint running on save, changes we make may trigger it. The rule files (`backend-api.mdc`, `database-schema.mdc`, `frontend-web.mdc`, `development-conventions.mdc`) encode conventions that overlap with what codegen will produce — if they disagree with AGENTS.md, AGENTS.md is the canonical guide per `CLAUDE.md`.
- **`.sdlc/` is not gitignored.** Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (append an entry) to this run's allowlist so the plugin can add the entry as part of the run. Note `.sdlc/backups/<file>` echoes source content of touched files.
- **CodeRabbit is configured (`.coderabbit.yaml`).** Any pushed branch gets reviewed by a third-party AI reviewer. Nothing to change, but be aware generated diffs leave the repo boundary on push.
- **Husky + commitlint are installed** (`prepare: husky`, `commitlint.config.js`, conventional config). If the run commits, the message must satisfy conventional-commit rules and pre-commit hooks will fire.
- **Biome `lint` scripts use `--write`.** AGENTS.md explicitly warns that `pnpm lint` can modify unrelated files. Prefer `biome check` on touched paths only during verification.
- **No competing MCP server config, no Aider, no auto-commit tooling.** Git history should stay untangled.

## Monorepo / submodules / LFS

- **Monorepo:** yes — pnpm workspace + Turborepo, 9 published/private packages plus a content-only `apps/docs`.
- **Submodules:** none (`.gitmodules` absent).
- **Git-LFS:** not in use (`.gitattributes` present but no `filter=lfs` entries).

## Infra

`Dockerfile.kaneo`, `compose.yml`, `compose.local.yml`, Helm chart at `charts/kaneo`, `deploy/`, `.devcontainer/`, and 10 GitHub Actions workflows (`ci.yml`, `docker.yml`, `helm-chart.yml`, `nightly.yml`, publish workflows, etc.). No Terraform, GitLab CI, CircleCI, or Jenkins.

## Environment keys (names only — values never read)

- `.env` — 9 keys (Postgres connection set, `DATABASE_URL`, `AUTH_SECRET`, `KANEO_API_URL`, `KANEO_CLIENT_URL`)
- `.env.local` — 5 Postgres keys
- `.env.sample` — 20 keys (GitHub App/OAuth, SMTP, Postgres, `AUTH_SECRET`, `KANEO_CLIENT_URL`)
- Referenced in code: 84 distinct names spanning auth, OAuth providers, S3, Sentry, Creem billing, SMTP, MCP, feature flags.

The estimated-hours feature needs **no new environment variables**; existing keys suffice.

## Regulated-repo signals

Only `SECURITY.md` (a standard OSS vulnerability-disclosure policy). No HIPAA/PCI/SOC2/GDPR/compliance markers, no CODEOWNERS with security/compliance/legal teams. `regulated_repo_warning_required: false` — no Gate 0 regulated warning needed. Note separately that the product handles workspace-scoped user data, so AGENTS.md's data-boundary rules still apply.

## Proposed off-limits

```
.git/**                        .turbo/**
.env  .env.*                   .vscode/**  .devcontainer/**
.claude/**                     node_modules/**  dist/**  build/**  .next/**  coverage/**
.cursor/**                     pnpm-lock.yaml
.agents/**  skills/**          apps/web/src/routeTree.gen.ts
skills-lock.json               apps/api/drizzle/meta/**
.coderabbit.yaml               i18n/schema.json
.husky/**  .hook-logs/**       CONTRIBUTORS.svg  CHANGELOG.md
                               apps/site/**  packages/planka-import/**  sentry/**
```

Gate 0 notes:
- `.env.sample` is included above by the blanket env rule. This run needs no new env keys, so leaving it off-limits is safe.
- `apps/api/drizzle/*.sql` (43 migrations) is **not** off-limits — a new migration file belongs there — but it must be produced by `pnpm --filter @kaneo/api db:generate`, never hand-written. `apps/api/drizzle/meta/**` is tool-owned snapshot state and is off-limits to hand edits (drizzle-kit updates it as part of generation).
- `apps/web/src/routeTree.gen.ts` is generated by the TanStack Router plugin.

## Surfaces relevant to the upcoming feature-extend (estimated hours + per-column rollup)

Recorded for scoping only; no changes made.

**Database / schema**
- `apps/api/src/database/schema.ts` — `taskTable` at line 401 (`pgTable("task", ...)`), currently `position`, `number`, `userId`, `title`, `description`, `status`, `columnId`, `priority`, `startDate`, `dueDate`, `createdAt`, `updatedAt`, with indexes on projectId/dueDate/assigneeId/columnId and a `task_project_number_unique` constraint.
- `apps/api/src/database/relations.ts` — relations live separately.
- `apps/api/drizzle/` — 43 existing migrations, latest `0042_previous_the_executioner.sql`; `meta/` snapshots are tool-managed.

**API**
- `apps/api/src/task/index.ts` (903 lines) — Hono route chain with `describeRoute` OpenAPI metadata, Valibot `validator(...)`, `workspaceAccess` / `requireWorkspacePermission` middleware.
- `apps/api/src/task/controllers/` — one file per operation (`update-task.ts`, `update-task-due-date.ts`, `create-task.ts`, `get-tasks.ts`, `bulk-update-tasks.ts`, `move-task.ts`, `import-tasks.ts`, `export-tasks.ts`, ...). `update-task-due-date.ts` is the closest single-field precedent.
- `apps/api/src/schemas.ts` — shared `taskSchema` Valibot object (line 25) used for OpenAPI resolvers.
- `apps/api/src/task/validate-task-fields.ts` — field validation helpers (e.g. `VALID_PRIORITIES`).
- `apps/api/src/events/` + `publishEvent()` — activity/notification/realtime fan-out; existing precedent `task.due_date_changed`.
- `apps/api/src/time-entry/` — an **existing hours-tracking domain** (create/get/update time entries). Worth reading before adding an estimate field; the rollup may want to relate to it.

**Typed client**
- `packages/libs/src/hono.ts` — `hc<AppType>` client; types flow automatically from the API's exported `AppType`, so no manual client edit is normally needed.

**Web fetchers / hooks**
- `apps/web/src/fetchers/task/` — one fetcher per operation (`update-task.ts`, `update-task-due-date.ts`, ...), each calling `client.task[...]`.
- `apps/web/src/hooks/mutations/task/` — `use-update-task.ts`, `use-update-task-due-date.ts`, etc., each a `useMutation` with explicit `queryClient.invalidateQueries` fan-out.
- `apps/web/src/hooks/queries/task/use-get-tasks.ts`, `use-get-task.ts`.
- `apps/web/src/types/task/` — web-side task types.

**Kanban column header (rollup target)**
- `apps/web/src/components/kanban-board/column/column-header.tsx` (105 lines) — renders column icon, name, and a task-count badge (`column.tasks.length`); this is where an hours rollup badge would sit.
- `apps/web/src/components/kanban-board/column/index.tsx`, `column-dropzone.tsx`, `apps/web/src/components/kanban-board/task-card.tsx`, `apps/web/src/components/kanban-board/index.tsx`.
- `apps/web/src/components/public-project/kanban-view.tsx` — a second kanban surface that may need the same treatment.
- Column data shape comes from `ProjectWithTasks["columns"][number]` in `apps/web/src/types/project`.

**i18n**
- `i18n/en-US.json` is the source of truth; 10+ locale files exist. Any new label needs a static key. `pnpm i18n:check` validates.

**MCP / integrations**
- `packages/mcp/` and `apps/api/src/plugins/{github,gitea}/events/*` mirror task field changes outward; adding a field may imply MCP tool schema and integration event updates. Decide deliberately per AGENTS.md rather than expanding scope automatically.

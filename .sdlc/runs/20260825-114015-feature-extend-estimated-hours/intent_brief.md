# Intent Brief — feature-extend — Estimated hours on tasks with per-column rollup

## Context
Kaneo tasks (`taskTable`, `apps/api/src/database/schema.ts:401`) carry title, description,
status, priority, assignee, start/due dates — but no effort estimate. The kanban column header
(`apps/web/src/components/kanban-board/column/column-header.tsx`) already renders a per-column
aggregate badge (`column.tasks.length`), so a second aggregate has an established home.

The user's seed used generic kanban vocabulary ("Card", "LaneHeader"); confirmed mapping for this
repo is **task** and **column**.

An existing `apps/api/src/time-entry/` domain tracks *actual* logged hours. This run adds an
independent *estimate* field; relating the two (estimate vs. actual) is explicitly a non-goal,
but the design phase must confirm naming does not collide with time-entry vocabulary.

## Goal
Add a nullable `estimatedHours` field to the task entity, editable from the web task UI, and show
the sum of estimated hours for a column's tasks in that column's header — full stack: Drizzle
schema + generated migration, Valibot validation + OpenAPI metadata, typed client, web fetcher and
mutation hook with cache invalidation, task editor input, and the column-header rollup.

## Files in scope
API
- `apps/api/src/database/schema.ts` — add the column to `taskTable`
- `apps/api/drizzle/**` — generated migration via `pnpm --filter @kaneo/api db:generate` (never hand-written)
- `apps/api/src/schemas.ts` — shared `taskSchema` (line ~25)
- `apps/api/src/task/index.ts` — route validators + OpenAPI descriptions
- `apps/api/src/task/controllers/**` — create/update/get/bulk-update/import/export task controllers,
  plus a single-field controller if the design follows the `update-task-due-date.ts` precedent
- `apps/api/src/task/validate-task-fields.ts`
- `apps/api/src/project/controllers/get-projects.ts` — board payload feeding `ProjectWithTasks`

Web
- `apps/web/src/types/task/index.ts`, `apps/web/src/types/project/**`
- `apps/web/src/fetchers/task/**`
- `apps/web/src/hooks/mutations/task/**`, `apps/web/src/hooks/queries/task/**`
- `apps/web/src/components/task/task-properties-sidebar.tsx` + new estimated-hours control
- `apps/web/src/components/shared/modals/create-task-modal.tsx`
- `apps/web/src/components/kanban-board/column/column-header.tsx` — the rollup badge
- `apps/web/src/components/kanban-board/task-card.tsx` — optional per-task display
- `apps/web/src/lib/**` — formatting helper if one is warranted

Copy and tests
- `i18n/en-US.json` — source of truth for new static keys
- `tests/api/**`, `tests/api-integration/task.test.ts`
- colocated `apps/web/src/**/*.test.ts(x)`

Confirmed at Gate 0
- `.gitignore` — one-line `.sdlc/` append (approved)

## Files off-limits
Project defaults (`.env*`, `.mcp.json`, `node_modules/**`, `dist/**`, `build/**`, `.next/**`,
`.sdlc/**`, `.git/**`, `.cursor/rules/**`, `.claude/settings.local.json`) plus every detected AI
config (`.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.agents/skills/**`, `skills/**`,
`skills-lock.json`, `.coderabbit.yaml`), plus:
- `apps/site/**`, `apps/docs/**`, `packages/planka-import/**`, `packages/mcp/**`, `sentry/**`
- `apps/api/src/mcp/tools.ts` — no new MCP tool parameters this run
- `i18n/*.json` except `en-US.json`; `i18n/schema.json`
- `apps/web/src/routeTree.gen.ts`, `pnpm-lock.yaml`, `CHANGELOG.md`, `CONTRIBUTORS.svg`
- `charts/**`, `Dockerfile.kaneo`, `compose*.yml`, `deploy/**`
- `.husky/**`, `.hook-logs/**`, `.turbo/**`

## Acceptance criteria
- `taskTable` gains a nullable estimated-hours column; the generated migration applies cleanly to a
  populated database and leaves existing rows null.
- The API accepts and returns the field on task create, single-task update, and task reads, with
  Valibot validation rejecting negative values and retaining accurate OpenAPI metadata.
- Omitting the field on any existing request keeps prior behavior byte-for-byte; existing callers,
  the public-project surfaces, and MCP task reads continue to work unchanged.
- The web task UI can set, change, and clear an estimate; the change persists and the board reflects
  it without a manual reload.
- The kanban column header shows the sum of its tasks' estimated hours alongside the task count.
  Tasks with no estimate contribute 0.
- All new user-facing copy uses static i18n keys defined in `i18n/en-US.json`.
- Focused API tests plus the PostgreSQL-backed `tests/api-integration/task.test.ts` pass, and the
  affected web component tests pass.

## Non-goals
- Relating estimates to `apps/api/src/time-entry/` actuals, burndown, or capacity planning.
- New MCP tool parameters, webhook payload fields, or notification/reminder behavior.
- Translating the new copy into locales other than `en-US`.
- Rollups anywhere other than the kanban column header (no backlog, list, or gantt aggregates).
- Any change to `apps/site`, Helm charts, or Docker deployment surfaces.

## Gate 0 decisions (frozen 2026-08-25)
- **Approved.** Write contract frozen to `.sdlc/local/write-contract.json` (19 allowlist globs,
  56 off-limits entries).
- **Auth mode:** `estimated` — Claude Code subscription auth via the `claude-cli` adapter. Reported
  costs are token-derived estimates, not vendor invoices.
- **Policy:** `opus-plus-sonnet-max`. Both tiers verified reachable (dispatch smoke + preflight).
- **Test command:** `pnpm --filter @kaneo/api test`, `pnpm --filter @kaneo/api test:integration`
  (requires a running PostgreSQL), `pnpm --filter @kaneo/web test`. Root `pnpm test` not used.
- **Rollback anchor:** `5d1fc910` on branch `feature-extend-2/opus-sonnet`. Worktree dirt at Gate 0
  was untracked-only (`.claude/settings.local.json`, `.hook-logs/`, `.sdlc/`).
- **Lint:** use targeted checks; root/package `lint` runs `biome check --write` and can modify
  unrelated files.

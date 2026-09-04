# Intent Brief — feature-extend — Task estimated hours with per-column rollup

## Context
`taskTable` (`apps/api/src/database/schema.ts:401`) has no estimation field; `estimatedHours`
appears nowhere in the repo. The kanban column header renders `column.tasks.length`, and
`column.tasks` is already the FILTERED set (`use-task-filters-with-labels-support.ts:196`
rebuilds columns as `tasks: filterTasks(column.tasks)`), so a rollup computed in `ColumnHeader`
sums exactly the visible cards with no plumbing changes.

The user's phrasing was "Card" and "per-lane … LaneHeader". This repo has no "lane" vocabulary;
the terms are task card (`kanban-board/task-card.tsx`) and column header
(`kanban-board/column/column-header.tsx`). The brief uses the repo's vocabulary.

Task reads are explicit whitelists, not row spreads: `get-tasks.ts:123` `taskSelection` and
`get-task.ts:9-23` each enumerate columns. A new field reaches no client until both are extended.

## Goal
Add a nullable estimate to tasks, editable in the task detail view, displayed on the task card,
and summed per column in the kanban column header over the filtered task set.

**Storage decision (Gate 0): integer MINUTES, not decimal hours.** The schema has no
`numeric`/`decimal`/`real` column anywhere, Drizzle returns `numeric` as a JavaScript string,
and float summing produces rendering artifacts in a rollup. Integer minutes give exact
arithmetic and match the existing `timeEntryTable.duration: integer("duration")` precedent.
The column stores minutes; the UI displays and accepts hours (90 -> "1.5h"). Conversion belongs
at the UI boundary, not in the API.

## Files in scope
API
- `apps/api/src/database/schema.ts` — nullable estimate column on `taskTable`
- `apps/api/drizzle/` — generated migration (next after `0042_previous_the_executioner.sql`)
- `apps/api/src/task/controllers/get-tasks.ts` — extend `taskSelection`
- `apps/api/src/task/controllers/get-task.ts` — extend the inline whitelist
- `apps/api/src/task/controllers/create-task.ts`, `update-task.ts`
- `apps/api/src/task/index.ts` — Valibot validators + OpenAPI for POST and PUT
- `apps/api/src/schemas.ts` — `taskSchema` response shape

Web
- `apps/web/src/types/task/index.ts`
- `apps/web/src/fetchers/task/`, `apps/web/src/hooks/mutations/task/`
- `apps/web/src/components/task/task-properties-sidebar.tsx` + a new estimate popover
- `apps/web/src/components/kanban-board/task-card.tsx`
- `apps/web/src/components/kanban-board/column/column-header.tsx` — rollup
- `i18n/en-US.json`

Tests
- `tests/api/task/**` (directory does not exist yet)
- `apps/web/src/**/*.test.tsx`

## Files off-limits
- All AI configs: `AGENTS.md`, `CLAUDE.md`, `.claude/`, `.cursor/`, `.agents/`, `skills/`,
  `skills-lock.json`, `.coderabbit.yaml`, `.github/`, `.devcontainer/`
- `.env`, `.env.local`, any credential material
- `.gitignore`, `biome.json`, `.husky/`
- `apps/site/`, `apps/docs/`, `charts/`
- `apps/api/drizzle/` migrations 0000–0042 — new migration only
- The 17 non-English locales under `i18n/`

## Acceptance criteria
1. The field is nullable; existing tasks migrate with NULL and behave exactly as today.
2. The API validates the estimate as a positive integer within PostgreSQL int4 range and
   rejects out-of-range values with 400, not 500.
3. `get-tasks` and `get-task` both return it; the typed client and web types carry it through.
4. The task card shows an estimate only when set; no visual change when null.
5. The column header shows a rollup summing the filtered tasks, matching the visible cards.
   Tasks with a null estimate contribute nothing and do not make the sum null. The sum is
   computed in integer minutes and formatted once for display, so no float artifact can appear.
6. Editing is permission-gated exactly as the existing priority/due-date popovers are.
7. All copy uses static i18n keys in `i18n/en-US.json`.
8. `pnpm --filter @kaneo/api test && pnpm --filter @kaneo/web test` stays green
   (baseline: 374 API, 112 web).

## Non-goals
- MCP tool exposure, bulk PATCH, task import, task export.
- Actuals, time tracking, or any comparison of estimate against `timeEntryTable`.
- Any change to the public read-only board.
- Backfilling the 17 non-English locales.

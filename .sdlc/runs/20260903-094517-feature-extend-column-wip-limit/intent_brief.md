# Intent Brief — feature-extend — Per-column WIP limit with over-cap indicator

## Context
Kaneo's authenticated kanban board renders columns from `columnTable`
(`apps/api/src/database/schema.ts:342`). A column today carries name, slug, position,
icon, color, isFinal. There is no notion of a work-in-progress cap.

The user's phrasing was "per-lane WIP limit … indicator in LaneHeader". This repo has no
"lane" vocabulary — zero occurrences in source. The domain term is **column**, and the
header component is `apps/web/src/components/kanban-board/column/column-header.tsx`.
The brief is written in the repo's vocabulary.

Two board surfaces render columns and are deliberately not shared:
`components/kanban-board/` (authenticated, interactive) and
`components/public-project/kanban-view.tsx` (public, read-only). Only the former is in scope.

## Goal
Add a nullable per-column WIP limit, persisted on the column and shared across the
workspace, and show an over-cap indicator in the authenticated board's column header when
the column's task count exceeds the limit.

Exceeding the limit is **indicate-only**: no API rejection, no drag-and-drop blocking. A
column already over its cap is a valid state, including immediately after a limit is set.

## Files in scope
API
- `apps/api/src/database/schema.ts` — nullable `wipLimit` integer on `columnTable`
- `apps/api/drizzle/` — generated migration (next after `0042_previous_the_executioner.sql`)
- `apps/api/src/column/controllers/create-column.ts`, `update-column.ts`, `get-columns.ts`
- `apps/api/src/column/index.ts` — Valibot validators + OpenAPI metadata

Web
- `apps/web/src/fetchers/column/{create-column,update-column,get-columns}.ts`
- `apps/web/src/hooks/mutations/column/`, `apps/web/src/hooks/queries/column/`
- `apps/web/src/components/kanban-board/column/{index,column-header}.tsx`
- `apps/web/src/components/project/column-editor.tsx` — set/clear the limit

i18n
- `i18n/en-US.json` — source of truth; static keys only

Tests
- `tests/api/**` — validator + controller behavior
- `apps/web/src/**/*.test.tsx` — over-cap indicator rendering

## Files off-limits
- All AI configs: `AGENTS.md`, `CLAUDE.md`, `.claude/`, `.cursor/rules/`, `.agents/`,
  `skills/`, `skills-lock.json`, `.coderabbit.yaml`, `.github/`, `.devcontainer/`
- `.env` and any credential material
- `apps/web/src/components/public-project/**` — public board explicitly out of scope
- `apps/site/`, `apps/docs/`, `charts/`, `packages/mcp/`
- The 17 non-English locale files under `i18n/` — English only this run
- `apps/api/drizzle/` migrations 0000–0042 — new migration only, never edit existing

## Acceptance criteria
1. `wipLimit` is nullable; existing columns migrate with NULL and behave exactly as today.
2. The API validates `wipLimit` as a positive integer or null, with accurate Valibot +
   OpenAPI metadata, and enforces the existing workspace permission checks unchanged.
3. `get-columns` returns `wipLimit`; the typed client and web fetchers carry it through.
4. The column header shows an over-cap indicator only when `wipLimit` is set and the
   column's task count exceeds it. No indicator when the limit is null.
5. Setting or clearing a limit invalidates the board query so open clients update.
6. All user-facing copy uses static i18n keys added to `i18n/en-US.json`.
7. `pnpm --filter @kaneo/api test && pnpm --filter @kaneo/web test` stays green
   (baseline at HEAD: 374 API tests, 112 web tests, both passing).

## Non-goals
- Blocking or rejecting moves into a full column.
- Any change to the public read-only board.
- Per-user or client-only limits.
- Backfilling the 17 non-English locales.
- Integration tests requiring live PostgreSQL (unverified at baseline).

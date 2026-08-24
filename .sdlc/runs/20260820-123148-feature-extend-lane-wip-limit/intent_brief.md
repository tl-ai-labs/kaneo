# Intent Brief — feature-extend — Per-lane WIP limit on Board

## Context
Kanban lanes are backed by a real `columnTable` in
`apps/api/src/database/schema.ts` (id, projectId, name, slug, position, icon,
color, isFinal, timestamps) — not a bare status enum. The board UI is
`apps/web/src/components/kanban-board/index.tsx` (`KanbanBoard`), which maps
`project.columns` to `Column` components
(`apps/web/src/components/kanban-board/column/index.tsx`). Each column
renders its header via `ColumnHeader`
(`apps/web/src/components/kanban-board/column/column-header.tsx`) — this is
the "LaneHeader" referred to in the request. `ColumnHeader` currently shows
icon, name, and a task-count badge (`column.tasks.length`); no WIP-limit or
capacity field exists anywhere in the schema or UI today (confirmed by grep
for `wip`/`limit`/`cap`). Columns already have a dedicated settings surface —
`apps/web/src/components/project/column-editor.tsx` — used for
create/update column properties via
`apps/api/src/column/controllers/{create-column,update-column}.ts` and
`apps/web/src/fetchers/column/{create-column,update-column}.ts` +
`apps/web/src/hooks/mutations/column/use-update-column.ts`.

## Goal
Add an optional, per-lane WIP (work-in-progress) limit to columns, and show
an over-cap indicator in the lane header when a column's current task count
exceeds its configured limit.

- **Where configured:** inline in `ColumnHeader` (a small editable control,
  e.g. click the task-count badge to set/clear a numeric limit) — not a
  separate settings page.
- **Persistence:** a nullable `wipLimit` (integer) column added to
  `columnTable` via a generated migration, exposed through the existing
  create/update column API contract and typed client.
- **Enforcement:** indicator only. No limit set = unlimited, current
  behavior unchanged. When a limit is set and `tasks.length > wipLimit`, show
  a visual over-cap indicator (e.g. badge color change / warning icon) in
  `ColumnHeader`. Do not block drag-and-drop, task creation, or any other
  action — this is purely informational.

## Task type
(none — feature-extend has no task_types)

## Files in scope
- `apps/api/src/database/schema.ts` — add `wipLimit` to `columnTable`.
- Migration SQL under `apps/api/drizzle/**`, produced only via
  `pnpm --filter @kaneo/api db:generate` after the schema edit (never
  hand-written — this path is otherwise off-limits per AGENTS.md), safe for
  existing installations (nullable, no backfill required).
- `apps/api/src/column/controllers/create-column.ts` and
  `update-column.ts` — accept/validate/persist `wipLimit` (Valibot).
- `apps/api/src/column/controllers/get-columns.ts` — ensure `wipLimit` is
  returned.
- Column route/OpenAPI schema wherever create/update column request/response
  shapes are declared (same directory as the controllers above).
- `packages/libs` typed client — only if column request/response types are
  hand-declared there rather than inferred; confirm during design.
- `apps/web/src/fetchers/column/create-column.ts`,
  `update-column.ts`, `get-columns.ts` — thread `wipLimit` through.
- `apps/web/src/hooks/mutations/column/use-update-column.ts` (and
  `use-create-column.ts` if creation also sets a limit) — cache
  invalidation for the changed field.
- `apps/web/src/components/kanban-board/column/column-header.tsx` — inline
  WIP-limit editor control + over-cap visual indicator.
- `apps/web/src/components/kanban-board/column/index.tsx` — pass `wipLimit`
  through if `ColumnHeader` needs it via props rather than reading off
  `column` directly (confirm current prop shape during design).
- `i18n/en-US.json` — new static keys for the WIP-limit control and over-cap
  indicator copy (source of truth per AGENTS.md; `i18n/schema.json` is
  generated and off-limits).

## Files off-limits
- Everything outside the column/board vertical slice above: auth, workspace
  permissions, other entity schemas (task, project, workflow rules),
  integrations (`apps/api/src/plugins/**`), MCP, webhooks, Helm/Docker,
  and any file under the project-wide off-limits default
  (`.env*`, `.mcp.json`, `node_modules/**`, `dist/**`, `build/**`,
  `.next/**`, `.sdlc/**`, `.git/**`, `.cursor/rules/**`,
  `.claude/settings.local.json`).
- `apps/api/src/database/relations.ts` — no new relation is expected (a
  scalar column, not a new table); touch only if design finds it necessary
  and calls it out explicitly.

## Acceptance criteria
- `columnTable` has a nullable `wipLimit` integer column; migration applies
  cleanly to an existing (non-empty) database.
- Creating or updating a column can set, change, or clear `wipLimit` through
  the existing API contract, with Valibot validation (e.g. positive integer
  or null) and accurate OpenAPI description.
- `ColumnHeader` lets a user set/edit/clear the WIP limit for that lane
  inline.
- When `wipLimit` is null (default/unset), `ColumnHeader` and all board
  behavior are visually and functionally identical to today.
- When `wipLimit` is set and the lane's task count exceeds it, `ColumnHeader`
  shows a clear over-cap visual indicator; no action is blocked anywhere
  (drag-drop, task creation, archiving) as a result of being over cap.
- All new user-facing copy is added as static keys in the i18n source file,
  not hardcoded strings.
- Realtime: WIP-limit changes and task-count changes that cross the
  threshold reach other connected clients viewing the same board through the
  existing column-update / task-move event and WebSocket path (no new event
  type expected — reuse column-update and existing task-count-driven
  re-renders).

## Non-goals
- No enforcement/blocking of task creation or drag-and-drop into an
  over-cap lane.
- No workspace- or project-level default WIP limit; this is a per-lane
  (per-column) setting only.
- No new permission/role for who can set a WIP limit; reuse whatever
  permission already gates column editing today.
- No changes to the `status` text field on `taskTable` or to how
  `status`/`columnId` are kept in sync.

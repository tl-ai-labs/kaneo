# Intent Brief — feature-extend — Advisory per-lane WIP limit with over-cap indicator

## Context

Kaneo's kanban board renders a project's tasks in columns (lanes). Columns today
carry no notion of capacity: a lane can accumulate any number of tasks with no
signal that it has become a bottleneck. WIP limits are a standard kanban practice
for surfacing exactly that.

This run is one arm of a controlled policy benchmark. The identical ticket has
already been executed twice on this repository under different model policies,
each on its own branch off the same base commit (`5d1fc910`):

| branch | policy | commit |
|---|---|---|
| `feature-extend-1/opus-flash-v37` | opus-plus-flash-v37 | `a91f124c` |
| `feature-extend-1/gemini-only` | flash-agsdk-only | `a3552177` |
| `feature-extend-1/opus-only` ← this run | opus-only (claude-cli / Max) | — |

The working tree is clean at `5d1fc910` and contains no `wipLimit` source code,
so this arm starts from the same baseline as the other two. One contamination
risk was identified and is handled in "Files off-limits" below.

## Gate 0 decisions

- **Auth mode:** `vendor` — every phase dispatches through the `claude-cli` adapter so real
  per-dispatch `total_cost_usd` is recorded. Required for this arm to be numerically comparable
  to the other two.
- **Test gate:** targeted suites + typecheck — `pnpm --filter @kaneo/api test`,
  `pnpm --filter @kaneo/web test`, `pnpm typecheck`, plus
  `pnpm --filter @kaneo/api test:integration` against a live PostgreSQL. Avoids the known
  intermittent turbo-parallel timeout in `tests/api/mcp-internal-api-url.test.ts`.
- **Configuration UI:** the limit is set in `apps/web/src/components/project/column-editor.tsx`,
  the existing per-column settings surface. `column-header.tsx` stays **display-only**.
  This deliberately diverges from the prior flash arm, which put the input in the header.

## Goal

Give each board column an optional, advisory work-in-progress limit, and show an
over-cap indicator in the column header when the column's task count exceeds it.

The limit is **advisory only**. Nothing blocks creating, moving, or assigning a
task into a column that is at or over its limit — the feature surfaces the
condition, it does not enforce it.

## Files in scope

Proposed from the prior run's recorded `files_touched`, pending confirmation
against this run's discovery output.

**API**
- `apps/api/src/database/schema.ts` — nullable `wipLimit: integer("wip_limit")` on `columnTable` (line 342), matching the existing `integer(...)` idiom used by `position`
- `apps/api/src/column/index.ts` — create validator (L56-64) and update validator (L132-140).
  Use `v.optional(v.nullable(v.number()))`, mirroring how `icon`/`color` model clearable
  fields. `isFinal` is a plain optional boolean and is the wrong template here.
- `apps/api/src/column/controllers/create-column.ts`
- `apps/api/src/column/controllers/update-column.ts` — the `data.x !== undefined && { x: data.x }`
  spread at L25-30 is the local idiom and correctly lets an explicit `null` through as a clear
- `apps/api/src/task/controllers/get-tasks.ts` — **load-bearing.** L224-237 hand-whitelists column
  fields instead of spreading the row, so `wipLimit` will not reach the board UI unless added
  here explicitly. (`color` is already silently dropped by this same projection — proof the
  omission is easy to make.)

**Web**
- `apps/web/src/fetchers/column/create-column.ts`
- `apps/web/src/fetchers/column/update-column.ts`
- `apps/web/src/hooks/mutations/column/use-create-column.ts`
- `apps/web/src/hooks/mutations/column/use-update-column.ts` — already invalidates both
  `["columns", projectId]` and `["tasks", projectId]`, which is exactly what a WIP-limit change
  needs since the count lives on the tasks query
- `apps/web/src/components/kanban-board/column/column-header.tsx` — over-cap indicator. The count
  badge at L62-64 is currently `{column.tasks.length}` in a `bg-muted` pill; render `{count} /
  {wipLimit}` and restyle when `wipLimit != null && count > wipLimit`.
- `apps/web/src/components/project/column-editor.tsx` — where the limit is **configured**. This is
  the existing per-column settings surface and already calls `useUpdateColumn()` for rename,
  final-toggle, and icon via a `handleX` → `updateColumn` → toast pattern.

**Generated — expected output, never hand-authored**
- `apps/api/drizzle/**` — the migration and meta snapshot/journal are produced by
  `pnpm --filter @kaneo/api db:generate`, then inspected and kept with the schema change.
  Per `AGENTS.md` these are never hand-edited, so the directory stays off-limits to direct
  authoring while the generated files are a required deliverable.

**i18n**
- `i18n/en-US.json` — static keys for all new user-facing copy

**Tests**
- `tests/api/column/create-column.test.ts`
- `tests/api/column/update-column.test.ts`
- `tests/api-integration/column-wip-limit.test.ts`
- `apps/web/src/components/kanban-board/column/column-header.test.tsx`

## Files off-limits

Project defaults from `.sdlc/project.json` (`.env`, `.env.*`, `.mcp.json`,
`.cursor/rules/**`, `.claude/settings.local.json`, `node_modules/**`, `dist/**`,
`build/**`, `.next/**`, `.sdlc/**`, `.git/**`), plus:

- **`apps/api/dist/**` — must not be read, not merely not written.**
  `apps/api/dist/index.js` is a stale build artifact from one of the sibling
  benchmark branches and still contains a *complete* implementation of this exact
  feature (schema field, i18n keys, controller logic). Reading it would let this
  arm copy a finished answer and would invalidate the three-way policy
  comparison. Discovery was explicitly instructed to treat it as opaque.
- `i18n/schema.json` — carried over as off-limits from the prior run.
- All other locale files under `i18n/` except `en-US.json`.

## Acceptance criteria

1. A column can be created or updated with an optional `wipLimit`; omitting it
   leaves the column with no limit.
2. `wipLimit` is nullable and optional end to end. Existing columns, existing API
   callers, and populated databases keep working with no change. The generated
   migration is safe against non-empty data.
3. Invalid values are rejected at the API with a 400 — the limit must be a whole
   number of 1 or greater, or null/absent to clear it.
4. The board projection returns each column's `wipLimit` so the client can render
   without an extra request.
5. The column header displays the current limit and shows a distinct over-cap
   indicator when the column's task count exceeds it.
6. Every new user-facing string is a static key in `i18n/en-US.json`.
7. Authorization is unchanged and enforced by the API: setting a WIP limit is a
   workspace-scoped column mutation and goes through the existing
   `requireWorkspacePermission` path. No new permission vocabulary.
8. Covered by API unit tests, a web component test, and a PostgreSQL-backed
   integration test.

## Non-goals

- Enforcing the limit. No rejection of task create/move on a full column.
- Per-user, per-project, or per-workspace default limits.
- Analytics, history, or notifications on limit breaches.
- Translating the new keys into locales other than `en-US`.
- Any change to the drag-and-drop implementation.
- Committing or pushing this branch. The run stops at the working tree.

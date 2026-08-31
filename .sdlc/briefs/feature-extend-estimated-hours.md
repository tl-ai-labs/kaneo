# Intent Brief — feature-extend — Estimated hours on tasks with per-lane rollup

## Context
Kaneo's kanban board renders one lane per project column. Tasks are rows in `taskTable`
(`apps/api/src/database/schema.ts`) carrying `title`, `description`, `status`, `priority`,
`startDate`, `dueDate` and an assignee. Task properties are edited through popovers registered in
`apps/web/src/components/task/task-properties-sidebar.tsx` — `task-due-date-popover.tsx`,
`task-priority-popover.tsx`, `task-start-date-popover.tsx` and siblings. The board lives in
`apps/web/src/components/kanban-board/`, with the card at `task-card.tsx` and the lane header at
`column/column-header.tsx`.

A separate `timeEntryTable` already records **tracked** time via `duration`. Estimated hours is a
distinct concept and this run does not connect the two.

User's request, verbatim:
> add estimated-hours field to Card with per-lane hours rollup shown in LaneHeader

## Goal
Let a task carry an optional estimate, show it on the card, and show the per-lane total in the
board's column header.

Confirmed in the interview:
- **Storage** — nullable `estimatedMinutes` integer on `taskTable`, with a generated migration.
  The UI accepts hours (`2.5`) and stores minutes (`150`), matching the existing
  `timeEntry.duration` integer convention and keeping lane rollups exact rather than floating.
- **Edit surface** — a new popover in `task-properties-sidebar.tsx`, following the existing
  due-date / priority / start-date pattern. Not settable from the create-task modal this run.
- **Card** — a small badge on `task-card.tsx`, rendered only when an estimate is set.
- **Lane rollup** — the column header shows the summed estimate for the lane, and renders
  nothing at all when no task in that lane has an estimate.

Assumptions, to be confirmed at Gate 0 rather than asked separately:
- **Permissions** — reuse the existing task-update permission that already gates editing task
  properties. No new permission vocabulary.
- **Compatibility** — `estimatedMinutes` is nullable; NULL means no estimate. Existing tasks,
  cards, and lane headers render exactly as they do today.

## Files in scope
Proposed; Gate 0 confirms and freezes into `.sdlc/local/write-contract.json`.
- `apps/api/src/database/schema.ts` — nullable `estimatedMinutes` on `taskTable`.
- `apps/api/drizzle/*.sql` and `apps/api/drizzle/meta/{_journal.json,*_snapshot.json}` —
  generated migration, snapshot and journal entry (drizzle-kit writes all three).
- `apps/api/src/task/**` — validators, create/update controllers, both read projections, and
  OpenAPI metadata.
- `apps/api/src/schemas.ts` — `taskSchema`, the Valibot OpenAPI response every task route declares.
- `apps/web/src/components/kanban-board/**` — card badge and lane rollup.
- `apps/web/src/components/task/**` — the estimate popover and its sidebar registration.
- `apps/web/src/fetchers/**`, `apps/web/src/hooks/**`, `apps/web/src/types/**` — payload plumbing.
- `i18n/*.json` — static keys; `en-US.json` is the source of truth. The locale root is `./i18n/`,
  **not** `apps/web/src/i18n/`.
- `tests/api/**` and web component tests beside their components.

## Files off-limits
Project defaults plus AI configs detected by discovery (`.claude/**`, `CLAUDE.md`, `AGENTS.md`,
`.agents/skills/**`, `skills/**`, `.cursor/rules/**`), plus `pnpm-lock.yaml`, `.turbo/**`,
`.husky/**`, `apps/web/src/routeTree.gen.ts`, `apps/site/**`, `apps/docs/**`, `charts/**`,
`.env*`, and `.sdlc/**`.

## Acceptance criteria
1. `taskTable` has a nullable `estimatedMinutes` integer with a generated, inspected migration
   that is safe on an existing populated database.
2. The task API accepts and returns the estimate, validated with Valibot (integer within a sane
   range, or null), with accurate OpenAPI metadata, rejecting invalid values with a 4xx rather
   than a 500.
3. Setting an estimate requires the same workspace permission that already gates task updates,
   enforced in the API — not only hidden in the UI.
4. The task properties sidebar can set, change, and clear an estimate, and it persists across
   reload.
5. The card shows the estimate when set, formatted in hours, and is visually unchanged when unset.
6. The lane header shows the summed estimate for its tasks, and renders nothing when the lane has
   no estimates.
7. All new user-facing copy uses static i18n keys across all locales.
8. Existing tasks, cards, and lane headers render exactly as today.
9. Focused API tests cover validation and persistence; focused web tests cover the card badge and
   the rollup at zero, one, and several estimates. Affected packages typecheck.

## Non-goals
- No link to the existing `timeEntry` tracked-time data; no estimate-vs-actual comparison.
- No estimate field in the create-task modal this run.
- No project- or workspace-level estimate totals outside the lane header.
- No estimate history, activity events, or notifications.
- No changes to `timeEntryTable`, gitea/github sync, or MCP tools.

## Benchmark note
This is an arm of a policy comparison: the same feature has been built on sibling branches under
different policies. **Nothing may be read from or copied out of those branches.** Every line is to
be written fresh against this branch at `5d1fc910`. An independently weaker implementation is a
valid result; a borrowed one is not.

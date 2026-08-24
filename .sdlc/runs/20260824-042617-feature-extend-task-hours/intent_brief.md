# Intent Brief — feature-extend — Estimated hours on tasks, with a per-column rollup

## Context

Kaneo's kanban board renders a project's tasks in columns. Tasks carry no notion of
effort or size, so a column gives no signal of how much work it actually holds — only
how many items. The ticket asks for an optional per-task estimate in hours, and a
per-column total of those estimates surfaced in the column header.

Vocabulary note: the ticket says "Card" and "LaneHeader". In this product those are
the **task** entity and the kanban **column header** respectively.

This run is the first of a second benchmark series, on branch
`feature-extend-2/opus-flash`, base commit `5d1fc910`, policy `opus-plus-flash-v37`
(Opus 5 for judgment via Claude Max, Gemini 3.7 Flash for mechanical via Vertex ADC).

## Goal

1. A task can carry an optional estimate of effort in hours.
2. The kanban column header shows the total estimated hours of the tasks in that
   column.

## Fixed constraint

Exactly one constraint is fixed by the requester:

- **Optional and nullable end to end.** A task without an estimate is the normal case
  and must keep working. Existing tasks, existing API callers, and populated
  databases are unaffected. The migration must be safe against non-empty data — no
  backfill, no rewrite.

## Deliberately open — decide these on evidence, and record the reasoning

The requester has left the following genuinely open. Do not treat any of them as
pre-decided, and do not look for how anything else in this repository solved an
adjacent problem.

- **Where the rollup is computed.** Either sum client-side from the tasks already
  present in the board payload, or return a server-side aggregate per column.
  Discovery reports what the board payload already contains; choose from that
  evidence. State the failure mode of the option you reject (for example, whether the
  board response is complete or paginated).
- **Whether fractional hours are allowed.** Permitting `0.5` or `1.5` implies a
  decimal column rather than an integer, and carries rounding and summation
  consequences for the rollup. Integers are simpler but coarser. Decide and justify.
- **Bounds.** Whether the value needs a maximum, and if so what it is, follows from
  the column type chosen. Whatever is chosen, an out-of-range value must not reach the
  database as an error — the API is the place to reject it.
- **How the rollup is presented**, including its accessible name and whether zero,
  absent, and partial-estimate states are distinguishable.
- **Which task-editing surfaces get the field.** Discovery lists the candidates;
  decide which are in scope and say why the others are not.

## Non-negotiable project conventions

These come from `AGENTS.md` and are not open to redesign:

- The API is the authority for authorization. Reuse the existing permission
  vocabulary and middleware; do not invent new permission actions.
- Validate API inputs with Valibot; keep OpenAPI metadata accurate.
- Database schema changes go in the schema file; migrations are **generated**, never
  hand-authored.
- User-facing copy uses static i18n keys in `i18n/en-US.json` only. Other locale files
  are translated separately and must not be hand-filled.
- Keep web requests in the fetchers layer and server state in TanStack Query hooks.

## Files in scope

From this run's discovery, read from the working tree at `5d1fc910`. A new `taskTable`
column is **invisible unless added in all thirteen** of these — this ticket's surface
is materially wider than a single-field change usually is.

| # | File | Lines | Gates |
|---|---|---|---|
| 1 | `apps/api/src/database/schema.ts` | 401-442 | the column itself |
| 2 | `apps/api/drizzle/` | new | generated migration |
| 3 | `apps/api/src/task/controllers/get-tasks.ts` | 123-139 | **board payload — blocks any client-side rollup** |
| 4 | `apps/api/src/task/controllers/get-tasks.ts` | 224-237 | column shape — where a server-side aggregate would go |
| 5 | `apps/api/src/task/controllers/get-task.ts` | 8-23 | single-task read |
| 6 | `apps/api/src/schemas.ts` | 25-44 | `taskSchema` / OpenAPI |
| 7 | `apps/api/src/task/controllers/create-task.ts` | 73-87 | create |
| 8 | `apps/api/src/task/controllers/update-task.ts` | 9-21, 54-69 | update |
| 9 | `apps/api/src/task/index.ts` | 190-201, 333-346 | create + update validators |
| 10 | `apps/web/src/types/task/index.ts` | 21-40 | hand-written web `Task` type |
| 11 | `apps/web/src/fetchers/task/update-task.ts` | 9-27 | fixed PUT body |
| 12 | `apps/web/src/fetchers/task/create-task.ts` | 8-13 | positional create args |
| 13 | `i18n/en-US.json` | `tasks.kanban`, `tasks.properties` | copy |

Plus the column header component, the task-editing surfaces chosen in scope, and the
test files.

## Two findings that must shape the design

**1. A time-tracking feature already ships — reconcile, do not duplicate.**
`timeEntryTable` (`schema.ts:508-538`) records **actual** logged time: a start/stop
timer with a materialised `duration: integer("duration").default(0)`, one-to-many per
task, indexed on `taskId` and `userId`. It has a full API (`apps/api/src/time-entry/`),
fetchers, mutation hooks and a web type. It reuses the **task** permission vocabulary
(`requireWorkspacePermission({ task: ["update"] })`) rather than defining its own.

Estimated hours is **planned** time — a distinct concept, but the obvious counterpart
to actual. The design must say explicitly how the two relate, and `duration` is the
existing precedent for how this codebase stores a quantity of time.

`dueDate` (`schema.ts:428`, indexed, dedicated `PUT /due-date/:id` endpoint, dedicated
controller and popover, own i18n namespace) is the **closest structural template** for
adding an optional task field end to end.

Not present: story points, velocity, or any existing `estimate` field. The one
`estimate` string in the repo is a synthetic fixture in
`tests/api/utils/openapi-spec.test.ts:306` — a naive grep will surface it and mislead.

**2. The full-PUT null-coercion trap — the highest-risk detail in this ticket.**
`apps/api/src/task/controllers/update-task.ts:60-61` **coerces `startDate`/`dueDate` to
`null` when the client omits them**. If the new field copies the `dueDate` shape
verbatim, every full-PUT caller that does not send it **erases it**. That includes:

- the web `updateTask` fetcher — which is how **drag-and-drop** and **archive-all**
  save a task, so moving a card between columns would wipe its estimate;
- the MCP read-modify-write at `apps/api/src/mcp/tools.ts:119-186`, which re-sends a
  full body containing only `title`, `priority`, `position`, and optionally
  `startDate`/`dueDate`.

`apps/web/src/fetchers/task/update-task.ts` already carries an in-code comment about a
prior bug of exactly this shape. The design must state which guarantee it chooses —
preserve-on-omit, or explicit-null-to-clear — and a test must pin it, including a
drag-and-drop-shaped update that omits the field.

**3. The codebase has no fractional-number precedent.**
The schema uses `integer()` at **all 17 numeric sites** and never `real`, `numeric`, or
`decimal`. Allowing fractional hours would introduce a new column type to this
codebase. That is not a prohibition — it is a cost to weigh explicitly against the
coarseness of whole hours, and the design must state which it chose and why.

**4. Evidence for the rollup-placement decision.**
The board fetcher sends **no pagination params**, so all tasks are returned — a
client-side sum would be complete. But `ColumnHeader` receives a **filter-narrowed**
`column.tasks` (via `board.tsx:163-177` → `sortedProject`). So:

- a **client-side** sum is filter-sensitive, and therefore consistent with the task
  count badge already rendered beside it;
- a **server-side** aggregate is filter-insensitive, and could visibly disagree with
  that adjacent count when a filter is active.

Choose on this evidence and state the failure mode of the option rejected.

## Other surfaces to decide about deliberately

- **Events/realtime.** `update-task.ts:95-101` always publishes `task.updated`;
  `create-task.ts:98` publishes `task.created`. Existing invalidation on
  `["tasks", projectId]` should carry a rollup change without new plumbing — confirm
  rather than assume.
- **Authorization asymmetry.** The board payload route
  (`GET /tasks/:projectId`) is guarded by `workspaceAccess.fromProject` **only**, with
  no `requireWorkspacePermission`, while create and update require
  `task: ["create"]` / `task: ["update"]`. Whatever the rollup exposes inherits the
  weaker read guard.
- **`packages/mcp`** is a published stdio package; consider whether it needs the field.

## Files off-limits

Project defaults from `.sdlc/project.json`, plus:

- **All build output is unreadable, not merely unwritable** — `apps/api/dist/**`,
  `apps/web/dist/**`, `apps/site/.next/**`. Stale artifacts there contain a completed
  implementation of a *different* but structurally adjacent feature.
- **Prior runs' artifacts are unreadable**: any `.sdlc/runs/**` directory other than
  this run's, plus `.sdlc/ledger.md` and `.sdlc/CLAUDE-SDLC.md`. These summarise four
  prior implementations of an adjacent ticket.
- **Sibling branches are off-limits**: no `git show`, `git diff`, or `git log -p`
  against `a91f124c`, `a3552177`, `b2d31805`, `86a1cdbb`, `066733dc`, or any
  `feature-extend-1/*` branch.
- `i18n/schema.json` and every locale file except `en-US.json`.
- Generated files: `apps/web/src/routeTree.gen.ts`, `pnpm-lock.yaml`.
- Competing agent config: `.claude/**`, `.cursor/**`, `.agents/**`, `skills/**`,
  `CLAUDE.md`, `AGENTS.md` — read-only inputs.

## Acceptance criteria

1. A task can be created or updated with an optional estimate; omitting it leaves the
   task with no estimate, and that is a normal, fully supported state.
2. The field is nullable and optional end to end. Existing rows read back as no
   estimate; the generated migration is safe on populated tables.
3. Invalid values are rejected by the API with a 400 rather than reaching the database
   as an error. The exact accepted range follows from the column type chosen, and the
   validator must state it.
4. The board payload carries whatever the column header needs, so the rollup renders
   without an extra request per column.
5. The column header shows the total estimated hours for its tasks, and the display
   distinguishes a genuine zero from "nothing estimated".
6. Every new user-facing string is a static key in `i18n/en-US.json`, following the
   conventions already present in that file.
7. Authorization is unchanged and enforced by the API, reusing existing permission
   vocabulary.
8. Covered by API unit tests, a web component test, and a PostgreSQL-backed
   integration test. The rollup's arithmetic is tested directly, including the
   mixed case where some tasks in a column have an estimate and others do not.

## Non-goals

- Time tracking, logged/actual hours, or any burn-down against the estimate.
- Per-user or per-project default estimates.
- Any change to drag-and-drop behaviour.
- Blocking or warning behaviour based on the total — this is display only.
- Translating new keys into locales other than `en-US`.
- Committing, pushing, or opening a pull request. The run stops at the working tree.

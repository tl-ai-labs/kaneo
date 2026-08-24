# Intent Brief — feature-extend — Advisory per-lane WIP limit with over-cap indicator

## Context

Kaneo's kanban board renders a project's tasks in columns (lanes). Columns carry no
notion of capacity today: a lane can accumulate any number of tasks with no signal
that it has become a bottleneck. WIP limits are a standard kanban practice for
surfacing exactly that.

This run is arm 4 of a controlled model-policy benchmark. The identical ticket has
been executed three times on this repository, each on its own branch off the same
base commit `5d1fc910`:

| branch | policy | commit |
|---|---|---|
| `feature-extend-1/opus-flash-v37` | opus-plus-flash-v37 | `a91f124c` |
| `feature-extend-1/gemini-only` | flash-agsdk-only | `a3552177` |
| `feature-extend-1/opus-only` | opus-only-v5 | `b2d31805` |
| `feature-extend-1/opus-sonnet` ← this run | opus-plus-sonnet-max | — |

The working tree is clean at `5d1fc910` and contains no `wipLimit` source code, so
this arm starts from the same baseline as the others.

**Deliberately left open.** This brief states the goal and the constraints. It does
**not** prescribe where the limit is configured in the UI, how the over-cap state is
presented, or how the component tree is arranged. Those are design decisions this run
should make on its own — the benchmark is measuring judgment, not transcription. Do
not go looking for how a previous arm solved it.

## Goal

Give each board column an optional, advisory work-in-progress limit, and show an
over-cap indicator in the column header when the column's task count exceeds it.

The limit is **advisory only**. Nothing blocks creating, moving, or assigning a task
into a column at or over its limit — the feature surfaces the condition, it does not
enforce it.

## Constraints

1. **Optional and nullable end to end.** Absent means no limit. Existing columns,
   existing API callers, and populated databases must keep working unchanged. The
   migration must be safe against non-empty data — no backfill, no rewrite.
2. **Bounded on both ends.** The stored value is a whole number. The lower bound is 1
   (clearing a limit is expressed as null, never 0). The upper bound is 2147483647,
   the PostgreSQL int4 ceiling — the API must reject anything above it with a 400
   rather than letting the database raise. Note that a validator built on a plain
   number type will accept floats, so the integer constraint has to be explicit.
3. **The API is the authority.** Any client-side bound is a convenience for the user,
   never the enforcement point.
4. **Authorization unchanged.** Setting a WIP limit is an ordinary workspace-scoped
   column mutation and must go through the existing permission middleware. Do not
   introduce new permission vocabulary.
5. **i18n via static keys** in `i18n/en-US.json` only. Follow whatever conventions
   that file already establishes. Do not hand-fill the other locale files.
6. **Test coverage** across API unit tests, a web component test, and a
   PostgreSQL-backed integration test.

## Files in scope

From this run's discovery, read from the working tree at `5d1fc910` only. These are
the surfaces the change touches; how the UI is arranged across them is still this
run's decision.

**Data**
- `apps/api/src/database/schema.ts:342-367` — `columnTable`. Sibling per-column
  settings live at `:356-359` (`position`, `icon`, `color`, `isFinal`).
- `apps/api/drizzle/` — generated migration (latest is `0042`). Generate via
  `pnpm --filter @kaneo/api db:generate`; never hand-write.
- `apps/api/src/database/relations.ts` — unchanged; a scalar column adds no relations.

**API**
- `apps/api/src/column/index.ts` — create validator `:56-64`, update validator
  `:132-140`. Both already guarded by `workspaceAccess` +
  `requireWorkspacePermission({ project: ["update"] })`.
- `apps/api/src/column/controllers/create-column.ts:18-78`
- `apps/api/src/column/controllers/update-column.ts:6-32` — the
  `data.X !== undefined &&` conditional-set block. Clearing needs nullable, matching
  how `icon`/`color` are handled.
- `apps/api/src/column/controllers/get-columns.ts` — `select()` star, carries a new
  field for free.

**Board projection — highest-risk spot**
- `apps/api/src/task/controllers/get-tasks.ts:218-237`. The projection re-maps columns
  to `{ id: column.slug, slug, name, icon, isFinal, tasks }`, dropping `color`,
  `position`, and the real `column.id`. **A new field is silently invisible to the
  board unless added at `:224-229`.**

**Web data layer**
- `apps/web/src/types/project/index.ts:10-28` — `ProjectWithTasks` is inferred from
  the `get-tasks` response, so it follows automatically once the projection carries
  the field.
- `apps/web/src/fetchers/column/update-column.ts:3-11`, `create-column.ts` —
  hand-written `data` shapes duplicating the Valibot schema.
- `apps/web/src/hooks/mutations/column/use-update-column.ts:8-20` — the same shape a
  third time. `:21-31` already invalidates both `["columns", projectId]` and
  `["tasks", projectId]`.

**UI**
- `apps/web/src/components/kanban-board/column/column-header.tsx:62-64` — the existing
  `{column.tasks.length}` count badge.
- `apps/web/src/components/kanban-board/column/index.tsx:14-24` — column shell.
- `apps/web/src/components/kanban-board/column/column-dropzone.tsx` — dnd-kit
  droppable. Advisory means it must **not** block the drop.
- `apps/web/src/components/project/column-editor.tsx` — the only place per-column
  settings are edited today (`handleToggleFinal`/`handleUpdateIcon` at `:86-116`, row
  layout at `:299-341`). Note it keys mutations on `col.id` (real id) while
  `getColumnIcon` uses `col.slug`.

**i18n**
- `i18n/en-US.json` — `settings:columnEditor.*` from `:883`, `tasks:kanban.*` from
  `:1884`.

**Tests**
- `tests/api/column/` — only `to-slug.test.ts` exists today.
- `tests/api-integration/` — has `project.test.ts`, `task.test.ts`,
  `project-reorder.test.ts`; no column/board integration test yet, so one is net-new.

## Files off-limits

Project defaults from `.sdlc/project.json` (`.env`, `.env.*`, `.mcp.json`,
`.cursor/rules/**`, `.claude/settings.local.json`, `node_modules/**`, `dist/**`,
`build/**`, `.next/**`, `.sdlc/**`, `.git/**`), plus:

- **All build output is unreadable, not merely unwritable.** `dist/`, `build/`,
  `.next/` have previously contained a complete implementation of this feature.
- **Prior runs' `.sdlc/runs/**` artifacts are unreadable.** They contain finished
  requirements, plans, reviews and file backups for this exact ticket.
- **The other three branches are off-limits.** No `git show`, `git diff`, or `git
  log -p` against `a91f124c`, `a3552177`, or `b2d31805`. The working tree at
  `5d1fc910` is the only source of truth.
- `i18n/schema.json` and all locale files except `en-US.json` — generated or
  separately translated.
- Generated files: `apps/web/src/routeTree.gen.ts`, `pnpm-lock.yaml`.
- Competing agent config: `.claude/**`, `.cursor/**`, `.agents/**`, `skills/**`,
  `CLAUDE.md`, `AGENTS.md` — read-only.

## Acceptance criteria

1. A column can be created or updated with an optional WIP limit; omitting it leaves
   the column with no limit.
2. The field is nullable and optional end to end; existing rows read back as no
   limit; the generated migration is safe on populated tables.
3. Invalid values are rejected by the API with a 400: the value must be a whole
   number in the inclusive range 1..2147483647, or null/absent to clear it. Floats,
   zero, negatives, and values above the int4 ceiling are all rejected.
4. The board's column data carries the limit, so the client renders without an extra
   request.
5. The column header shows the current limit and a distinct over-cap indicator when
   the task count exceeds it.
6. Every new user-facing string is a static key in `i18n/en-US.json`, following the
   conventions already present in that file.
7. Authorization is unchanged and enforced by the API; no new permission vocabulary.
8. Covered by API unit tests, a web component test, and a PostgreSQL-backed
   integration test.

## Non-goals

- Enforcing the limit. No rejection of task create/move on a full column.
- Per-user, per-project, or per-workspace default limits.
- Analytics, history, or notifications on limit breaches.
- Translating new keys into locales other than `en-US`.
- Any change to the drag-and-drop implementation.
- Committing, pushing, or opening a pull request. The run stops at the working tree.

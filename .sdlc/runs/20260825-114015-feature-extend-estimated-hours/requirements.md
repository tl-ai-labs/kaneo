# Delta Requirements — Estimated hours on tasks with per-column rollup

- **Run:** `20260825-114015-feature-extend-estimated-hours`
- **Mode / intent:** brownfield · `feature-extend`
- **Baseline:** `5d1fc910` on `feature-extend-2/opus-sonnet`
- **Source brief:** `.sdlc/runs/20260825-114015-feature-extend-estimated-hours/intent_brief.md`
- **Form:** *delta* requirements — this document describes only what changes relative to the
  existing Kaneo behavior. Everything not listed here must behave exactly as it does at the
  baseline commit.

---

## 0. What exists today (the delta's anchor)

Kaneo's `taskTable` (`apps/api/src/database/schema.ts:401`) carries `title`, `description`,
`status`, `priority`, `userId` (assignee), `startDate`, `dueDate`, `position`, `number`. There is
no effort/estimate field anywhere in the stack.

The closest complete precedent for a single scalar task field is **`dueDate`**, which exists as:

| Layer | File |
|---|---|
| Column | `apps/api/src/database/schema.ts` → `taskTable.dueDate` |
| Response schema | `apps/api/src/schemas.ts` → `taskSchema.dueDate` |
| Whole-task create | `apps/api/src/task/index.ts` `POST /:projectId` → `createTask` |
| Whole-task update | `apps/api/src/task/index.ts` `PUT /:id` → `updateTask` |
| Single-field update | `apps/api/src/task/index.ts` `PUT /due-date/:id` → `updateTaskDueDate` |
| Reads | `get-task.ts`, `get-tasks.ts` (explicit `taskSelection`), `export-tasks.ts` |
| Bulk | `bulk-update-tasks.ts` (`set-due-date` operation) |
| Import | `import-tasks.ts` (`ImportTask.dueDate`) |
| Web type | `apps/web/src/types/task/index.ts` |
| Fetcher / hook | `fetchers/task/update-task-due-date.ts`, `hooks/mutations/task/use-update-task-due-date.ts` |
| UI | `components/task/task-due-date-popover.tsx`, wired from `task-properties-sidebar.tsx` |

The kanban column header (`apps/web/src/components/kanban-board/column/column-header.tsx`)
already renders one per-column aggregate — `{column.tasks.length}` in a muted rounded badge. That
badge is the established home for a second aggregate.

Two facts constrain the design and were verified in-repo during this phase:

1. **`get-tasks.ts` builds an explicit `taskSelection` object** (not `select()` of the whole
   table). A new column is invisible to the board payload — and therefore to the rollup — unless
   it is added there explicitly. Same for `get-task.ts` and `export-tasks.ts`.
2. **`apps/api/src/project/controllers/get-projects.ts` is *not* the board payload.** It computes
   workspace project statistics (`totalTasks`, `completionPercentage`, `min(dueDate)`). It is in
   the write allowlist, but nothing in this change requires touching it — see OOS-6.

---

## 1. In scope

1. A nullable estimated-effort-in-hours column on `taskTable`, added via a **generated** Drizzle
   migration that applies cleanly to a populated database and leaves every existing row NULL.
2. Read exposure of the field on every task-read surface inside the write allowlist:
   `get-task.ts`, `get-tasks.ts` (board payload), `export-tasks.ts`.
3. Write exposure on task create (`POST /task/:projectId`) and whole-task update
   (`PUT /task/:id`), both with Valibot validation and accurate `describeRoute` metadata.
4. A dedicated single-field update route following the `PUT /due-date/:id` precedent, so the UI
   can set/change/clear an estimate without round-tripping every other task field.
5. Valibot validation rejecting negative values, non-finite values, and values above a documented
   ceiling; explicit `null` clears the estimate.
6. Web type, fetcher, and TanStack Query mutation hook with the same cache-invalidation fan-out
   the due-date hook uses.
7. A task-UI control to set, change and clear the estimate, reachable from the task properties
   sidebar, following the popover pattern of the sibling single-field controls.
8. An optional estimate field on the create-task modal.
9. **The per-column rollup:** the kanban column header shows the sum of its tasks' estimated
   hours alongside the existing task count. Tasks with no estimate contribute 0.
10. New user-facing copy as static i18n keys in `i18n/en-US.json` only.
11. Focused API unit tests, an addition to the PostgreSQL-backed
    `tests/api-integration/task.test.ts`, and colocated web component tests for the rollup and
    the new control.

## 2. Out of scope

1. **OOS-1 — Any relationship to `apps/api/src/time-entry/` actuals.** No estimate-vs-actual
   comparison, no variance, no burndown, no capacity planning. The two domains stay independent,
   and naming must not imply otherwise (see NFR-4).
2. **OOS-2 — A new activity type.** `estimated_hours_changed` would require edits to
   `apps/api/src/activity/`, `apps/api/src/ws/`, `apps/api/src/search/controllers/global-search.ts`
   and `apps/web/src/components/activity/` — none of which are in the write allowlist. The field
   change rides the existing `task.updated` event instead (FR-A6).
3. **OOS-3 — MCP tool parameters.** `apps/api/src/mcp/tools.ts` is off-limits this run. MCP task
   reads must continue to work unchanged; MCP callers simply will not see or set the field.
4. **OOS-4 — Webhook payload fields, notifications, reminders, scheduler behavior.**
5. **OOS-5 — Rollups anywhere other than the kanban column header.** No backlog, list-view,
   gantt, or project-level aggregate.
6. **OOS-6 — Project-level estimate statistics** in `get-projects.ts`. The file is allowlisted but
   deliberately untouched; adding a `sum(estimatedHours)` there would change the workspace
   project-list payload for no requirement in this brief.
7. **OOS-7 — Bulk operations.** No `set-estimated-hours` bulk operation in
   `bulk-update-tasks.ts`; the bulk toolbars are unchanged.
8. **OOS-8 — Import/export round-trip of the field**, unless the design shows it is free. Export
   is a read surface (FR-A5); import adding the field is optional and must not change the shape of
   existing export files consumed by existing installations. Any decision here must be explicit in
   `change_plan.md`.
9. **OOS-9 — Sorting or filtering by estimate**, in `get-tasks.ts` `sortBy`, `use-board-sort.ts`,
   or the task filters.
10. **OOS-10 — Locales other than `en-US`.** All other `i18n/*.json` are off-limits; the run must
    not leave them inconsistent in a way that breaks `pnpm i18n:check` (see NFR-6).
11. **OOS-11 — Public-project surfaces.** `apps/web/src/components/public-project/kanban-view.tsx`
    is not in the allowlist. The public board does not get the rollup and must keep working.
12. **OOS-12 — Per-task estimate display on the kanban card** is *optional*, at the design's
    discretion; if it complicates the card's dense layout, skip it. The rollup is the requirement.

---

## 3. Functional requirements

### 3.1 Data layer (`api/database`)

- **FR-D1** `taskTable` gains a single nullable numeric column for estimated hours. Column name
  follows the table's snake_case-in-DB / camelCase-in-TS convention.
- **FR-D2** The column's SQL type must represent fractional hours (half-hour and quarter-hour
  estimates are the common case) and must sum without visible floating-point artifacts in the UI.
  *Design decision required (see §7 D-1) — the choice between `real`/`double precision`,
  `numeric(p,s)` (which Drizzle surfaces as `string`), and integer-minutes changes the type that
  flows all the way to the column-header sum.*
- **FR-D3** The migration is produced by `pnpm --filter @kaneo/api db:generate` and committed
  verbatim together with the regenerated `apps/api/drizzle/meta/` snapshot. Hand-writing or
  editing the SQL is prohibited.
- **FR-D4** The migration must be a pure additive `ALTER TABLE ... ADD COLUMN` with no `NOT NULL`
  and no default backfill, so it applies to a populated production database without a rewrite and
  leaves existing rows NULL.
- **FR-D5** No new index. There is no query in scope that filters or sorts on the column.
- **FR-D6** `apps/api/src/database/relations.ts` is unchanged (scalar column, no relation).

### 3.2 API (`api/task`)

- **FR-A1** `taskSchema` in `apps/api/src/schemas.ts` gains the field as nullable/optional, so
  every `resolver(taskSchema)` response description stays accurate.
- **FR-A2** `POST /task/:projectId` accepts the field as **optional** in its `validator("json")`
  object. Omitting it produces byte-for-byte the same task row as today (NULL estimate).
- **FR-A3** `PUT /task/:id` accepts the field as **optional**, and passes it through to
  `updateTask`. *Design decision required (§7 D-2): `updateTask` currently takes eleven positional
  arguments, which is the one place in `apps/api/src/task/controllers/` that departs from the
  house named-object convention.*
- **FR-A4** A new single-field route mirroring `PUT /due-date/:id` exactly in shape:
  `describeRoute` with a unique `operationId` and a `resolver(taskSchema)` 200 response →
  `validator("param", v.object({ id: v.string() }))` → `validator("json", ...)` →
  `workspaceAccess.fromTask()` → `requireWorkspacePermission({ task: ["update"] })` →
  `requireEntitlement` → a thin handler that unwraps and delegates to one controller.
- **FR-A5** The field is included in `get-task.ts`'s and `get-tasks.ts`'s explicit column
  selections. `get-tasks.ts` is the board payload and is what makes the rollup possible at all.
- **FR-A6** The single-field controller follows the `update-task-due-date.ts` house pattern:
  read-before-write for old/new values, `HTTPException(404)` when the task is missing,
  `HTTPException(500)` when the update returns no row, `publishEvent(...)` on success, and
  `export default`. It publishes **`task.updated`** — already in `ws/index.ts`'s
  `taskUpdateEvents` broadcast list and with no activity-row subscriber — so the board refreshes
  in realtime without introducing a new activity type (OOS-2).
- **FR-A7** Validation rejects negative values with a 400 and a message consistent with the
  repo's existing validation errors. Explicit `null` is a legal value and clears the estimate.
  A finite upper bound is required so a typo cannot store an absurd value; the bound and its
  rationale belong in `change_plan.md`.
- **FR-A8** Authorization is exactly `requireWorkspacePermission({ task: ["update"] })` for
  writes — the same permission the other single-field task routes use. No new permission verb, no
  hand-rolled role check, no reliance on the UI hiding the control.

### 3.3 Web (`apps/web`)

- **FR-W1** `Task` in `apps/web/src/types/task/index.ts` gains the field as nullable/optional,
  matching the type the API actually returns over JSON.
- **FR-W2** A fetcher in `apps/web/src/fetchers/task/` calling the new route through the typed
  `client` from `@kaneo/libs`. No manual client edit — `AppType` propagates the route
  automatically. `export default`, re-throws `new Error(await response.text())` on `!response.ok`.
- **FR-W3** A `use<Verb>...` mutation hook in `apps/web/src/hooks/mutations/task/` using
  `useMutation` plus an `invalidateQueries` fan-out covering at minimum `["task", id]` and
  `["tasks", projectId]` — the same fan-out `use-update-task-due-date.ts` performs.
- **FR-W4** A control in `apps/web/src/components/task/` that can **set, change, and clear** the
  estimate, gated on `useWorkspacePermission().canUpdateTasks()` for display only (the API remains
  the authority), with success/error toasts using i18n keys, wired into
  `task-properties-sidebar.tsx` beside the existing date/priority/assignee controls.
- **FR-W5** `create-task-modal.tsx` may set an initial estimate. The field is optional; leaving it
  empty must send no estimate (not `0`).
- **FR-W6** **The rollup.** `column-header.tsx` renders the sum of `column.tasks`' estimates
  beside the existing count badge. Semantics confirmed with the user: **plain sum; a task with no
  estimate contributes 0.** When the sum is zero (no task in the column has an estimate) the
  rollup badge is hidden rather than showing `0h`, so unestimated boards look exactly as they do
  today.
- **FR-W7** The rollup value updates without a manual reload after an estimate changes, via the
  existing invalidate → refetch → WebSocket path (FR-A6 + FR-W3).
- **FR-W8** Formatting of the hours value is a single shared helper (a small pure function, in
  `apps/web/src/lib/`) used by both the rollup and any per-task display, so the two never drift.
- **FR-W9** Every new visible string is `t("namespace:key")` against a key added to
  `i18n/en-US.json`. No hardcoded English in JSX. Keys nest under the existing `tasks` namespace
  next to the comparable `tasks.properties` / `tasks.popover` entries.

---

## 4. Non-functional requirements

- **NFR-1 — Backward compatibility is the headline constraint.** Omitting the field on any
  existing request must preserve prior behavior exactly: same status, same response body shape
  plus one new nullable key, same events. Existing clients (web at older versions, MCP, API-key
  callers, webhooks) must be unaffected.
- **NFR-2 — Migration safety on populated installations.** Additive nullable column only; no
  table rewrite, no backfill, no destructive statement. Verified by inspecting the generated SQL
  and by the PostgreSQL-backed integration suite.
- **NFR-3 — House patterns over invention.** Every new file mirrors its `dueDate` counterpart in
  shape, naming (kebab-case file, verb-first, one unit per file, `export default` for
  controllers/fetchers, named export for hooks/components) and layering (thin handler → controller).
- **NFR-4 — No vocabulary collision with `time-entry`.** The chosen field and i18n names must
  read unambiguously as a *planned estimate*, distinct from the `duration` / `startTime` /
  `endTime` vocabulary of the existing actual-time-tracking domain.
- **NFR-5 — Types are inferred, not restated.** `type` over `interface`; let Drizzle and Valibot
  inference and `InferResponseType` carry the shape.
- **NFR-6 — i18n consistency.** Only `en-US.json` may be written. The run must record whether
  `pnpm i18n:check` treats missing keys in other locales as a failure; if it does, that is a
  reportable finding for the final report, not a licence to edit off-limits locale files.
- **NFR-7 — Rollup cost.** The sum is computed client-side over already-loaded
  `column.tasks`; no new API request, no new query, no added board render cost beyond an O(n) sum
  per column.
- **NFR-8 — Formatter discipline.** Only `biome check` on changed paths. The repo's `lint`
  scripts run `--write` and can modify unrelated files.
- **NFR-9 — Write contract.** Every file this run touches must be inside
  `.sdlc/local/write-contract.json`'s allowlist and outside its off-limits list. A requirement
  that cannot be met inside those bounds is a finding, not a reason to widen the contract.

---

## 5. PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| Estimated hours (new) | **None.** Non-personal planning metadata attached to a task. | Inherits the task's existing workspace-scoped authorization: `workspaceAccess.fromTask()` + `requireWorkspacePermission`. |
| Existing task fields | Unchanged | Unchanged |

The change introduces **no new personal data**, no new secret, no new log line containing user
content, and no new field on any webhook, event or MCP payload beyond the `task.updated`
notification that already fires. The one privacy-adjacent consideration is the public-project
surface: the field must not become visible on public boards as a side effect (OOS-11) — the
security review should confirm this by inspection of what `public-project/**` reads.

---

## 6. Role matrix

Roles come from `@kaneo/permissions`; this change adds no new permission vocabulary.

| Role capability | Resource | Action | Behavior |
|---|---|---|---|
| `task: ["create"]` | task | set estimate at creation | Allowed via `POST /task/:projectId` |
| `task: ["update"]` | task | set / change / clear estimate | Allowed via the new single-field route and `PUT /task/:id` |
| `task: ["read"]` (implied by board access) | task | see estimate + column rollup | Allowed wherever the task is already readable |
| No workspace access | task | any | Rejected by `workspaceAccess.fromTask()` before the handler runs |
| Any role | new permission verb | — | **None introduced** |

UI gating via `useWorkspacePermission()` is presentational only; the API remains the authority.

---

## 7. Decisions the design phase must make (carried into `change_plan.md`)

- **D-1 — Storage type for fractional hours.** `real`/`double precision` gives a JS `number`
  straight through to the column-header sum but carries float rounding; `numeric(p,s)` is exact
  but Drizzle surfaces it as `string`, which changes the web `Task` type and forces parsing before
  summing; integer minutes is exact and simple but makes every API caller convert. Pick one and
  state the consequence for FR-W6's sum and FR-W8's formatter.
- **D-2 — `updateTask`'s eleven positional parameters.** Appending a twelfth is the smallest
  diff and the highest ongoing cost; converting the signature to the house named-object shape is
  the cleaner result but touches the one call site plus any test that calls it directly. AGENTS.md
  says not to preserve accidental complexity, and also says not to mix requested work with broad
  refactors. Decide explicitly and justify.
- **D-3 — Single-field route path and `operationId`.** Must not collide with any existing task
  route segment (`due-date`, `title`, `status`, `priority`, `assignee`, `description`, `move`) nor
  with `time-entry` vocabulary (NFR-4).
- **D-4 — Import/export participation** (OOS-8): in, out, or export-only. State it.
- **D-5 — Zero-value semantics.** Is an explicit `0` a meaningful estimate ("this is free") that
  the UI must display, or is it indistinguishable from unset? FR-W6 hides the badge when the
  *column sum* is zero; D-5 decides whether a *task* with `0` shows a chip.
- **D-6 — Where the estimate control lives in the sidebar** and whether it is a popover (like
  due-date) or an inline numeric input, given that hours are typed rather than picked.
- **D-7 — Whether the kanban task card shows a per-task estimate** (OOS-12, optional).

---

## 8. Acceptance criteria

1. **AC-1** `taskTable` has a nullable estimated-hours column; `pnpm --filter @kaneo/api
   db:generate` produced the migration, its SQL is a single additive nullable `ADD COLUMN`, and
   `apps/api/drizzle/meta/` was regenerated alongside it. No migration file was hand-edited.
2. **AC-2** Creating a task **without** the field yields exactly the same response as at baseline,
   plus the new key with a null value; the task row's other columns are identical.
3. **AC-3** Creating a task **with** a valid estimate persists it and returns it.
4. **AC-4** The single-field route sets an estimate, changes it, and clears it with an explicit
   `null`, returning the updated task each time.
5. **AC-5** A negative estimate is rejected with HTTP 400 and a descriptive message; the task row
   is unchanged.
6. **AC-6** A request from a user without `task: ["update"]` in the workspace is rejected by the
   middleware chain regardless of payload — proving the API, not the UI, is the authority.
7. **AC-7** `GET /task/:id` and the board payload `GET /task/tasks/:projectId` both return the
   field for every task.
8. **AC-8** OpenAPI metadata for every touched route remains accurate: unique `operationId`,
   correct `tags`, a description naming the field, and `resolver(taskSchema)` on the 200 response.
9. **AC-9** In the web UI an estimate can be set, changed, and cleared from the task properties
   sidebar; the value persists across a reload.
10. **AC-10** The kanban column header shows the sum of its tasks' estimates beside the count.
    Tasks with no estimate contribute 0. A column where no task has an estimate shows no rollup
    badge, i.e. it renders identically to today.
11. **AC-11** After changing one task's estimate, the containing column's rollup updates without
    a manual page reload.
12. **AC-12** Every new string in the diff resolves through `t()` to a key present in
    `i18n/en-US.json`; `grep` over the diff finds no hardcoded user-facing English in JSX.
13. **AC-13** `pnpm --filter @kaneo/api test` passes, including at least one new focused test for
    the validation boundary (negative rejected, null clears).
14. **AC-14** `pnpm --filter @kaneo/api test:integration` passes against a running PostgreSQL,
    including a new case in `tests/api-integration/task.test.ts` covering create-without-field
    (null), set, and clear. **If no PostgreSQL is reachable in this environment, the run reports
    that plainly and marks AC-14 unverified — it is never silently skipped.**
15. **AC-15** `pnpm --filter @kaneo/web test` passes, including a colocated component test
    asserting the rollup's sum, its zero-estimate behavior, and its no-estimate hidden state.
16. **AC-16** `pnpm typecheck` passes across the affected packages, proving the typed-client
    contract still holds end-to-end.
17. **AC-17** `git status` shows no modification to any off-limits path; every changed path is in
    the allowlist. `provenance.json` records every write.
18. **AC-18** The public-project board and MCP task reads are untouched and still function.

---

## 9. Open questions for HITL

- **Q-1 (answers D-1)** Should estimates support fractional hours like `0.5` / `2.25`, or are
  whole hours enough? *Recommendation: support fractions* — half-hour estimates are the common
  case in task-level planning, and it is far cheaper to allow them now than to migrate later.
  This is the single decision with the widest blast radius (storage type → API type → web type →
  the rollup sum → the formatter).
- **Q-2 (answers D-5)** Is an explicit `0` meaningful ("estimated at zero effort"), or should the
  UI treat `0` and unset identically? *Recommendation: treat `0` as a real value the API stores
  and returns, and let the UI render it, while keeping a column whose total is 0 badge-free.*
- **Q-3 (answers D-4)** Should task **export** include the estimate, and should **import** accept
  it? *Recommendation: export yes* (it is a read surface and losing planning data on export is
  surprising), *import yes if it costs one optional field* — but flagged because it changes the
  export file's shape for existing consumers.
- **Q-4 (answers D-7)** Should the kanban **task card** show a per-task estimate chip, or is the
  column-header rollup plus the sidebar control enough? *Recommendation: rollup + sidebar only* —
  the card is already dense, and the brief lists the per-task display as optional.
- **Q-5** Is a running PostgreSQL available in this environment for
  `pnpm --filter @kaneo/api test:integration`? AGENTS.md requires integration tests for database
  changes, and this change is a database change. If not, AC-14 will be reported unverified.

*Silence on Q-1…Q-4 is taken as acceptance of the stated recommendations; the architect will
carry them into `change_plan.md` and every one will be visible again at Gate 2.*

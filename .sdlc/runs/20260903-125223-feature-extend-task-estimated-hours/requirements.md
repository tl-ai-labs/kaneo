# Delta Requirements — Task estimate with per-column rollup

Run: `20260903-125223-feature-extend-task-estimated-hours` · Intent: `feature-extend` · Mode: brownfield

These are **delta** requirements: they describe only what changes relative to the current
`main` behavior. Anything not listed here must behave exactly as it does today.

---

## 1. In scope

1. A new nullable estimate column on `taskTable`, stored as **integer minutes**, with a
   generated Drizzle migration (next after `0042_previous_the_executioner.sql`).
2. API accepts the estimate on `POST /task/:projectId` (create) and `PUT /task/:id` (update),
   validated with Valibot and described in the OpenAPI route metadata.
3. API returns the estimate from `GET /task/tasks/:projectId` (list) and `GET /task/:id`
   (single) by extending **both** explicit column whitelists.
4. `taskSchema` in `apps/api/src/schemas.ts` (the `resolver()` response schema) carries the field.
5. Web `Task` type, fetcher, and mutation hook carry the field end-to-end via `@kaneo/libs`.
6. A new estimate popover in the task detail properties sidebar, following the established
   per-field popover pattern, permission-gated by `useWorkspacePermission()`.
7. Task card displays the estimate when set, and renders identically to today when null.
8. Kanban column header displays a rollup summing the estimates of the tasks in
   `column.tasks` (already the filtered set).
9. All new user-facing copy added as static keys to `i18n/en-US.json`.
10. New API unit tests under `tests/api/task/` and web component tests alongside the changed
    components.

## 2. Out of scope

1. MCP tool exposure (`apps/api/src/mcp/**`, `packages/mcp/**`).
2. Bulk task PATCH (`bulk-update-tasks.ts`), task import (`import-tasks.ts`), task export
   (`export-tasks.ts`).
3. The public read-only board (`apps/web/src/components/public-project/**`).
4. Actuals / time tracking; any comparison of estimate against `timeEntryTable`.
5. Backfilling the 17 non-English locales.
6. List view, backlog view, gantt view, and calendar view rendering of the estimate.
7. Any dedicated single-field endpoint (e.g. `PATCH /task/:id/estimate`). The estimate rides
   the existing full `PUT`, matching `TaskStartDatePopover`'s use of `useUpdateTask`.
8. Sorting, filtering, or grouping tasks by estimate.

---

## 3. Functional requirements

### FR-A — Data model (api/database)

- **FR-A1** — `taskTable` gains `estimatedMinutes: integer("estimated_minutes")`, nullable, no
  default. Naming mirrors the storage unit so no reader can mistake it for hours. Precedent:
  `timeEntryTable.duration: integer("duration")` (`schema.ts:508+`).
- **FR-A2** — The migration is **generated** with `pnpm --filter @kaneo/api db:generate` and its
  SQL inspected. Migrations `0000`–`0042` are immutable. The generated statement must be a bare
  `ALTER TABLE "task" ADD COLUMN "estimated_minutes" integer;` — no `NOT NULL`, no `DEFAULT`,
  no backfill, so it is safe on a populated production table.
- **FR-A3** — No new index. The field is neither filtered nor sorted on in this change; the
  rollup is computed client-side over an already-fetched set.

### FR-B — API write path

- **FR-B1** — `POST /task/:projectId` json validator gains
  `estimatedMinutes: v.optional(v.nullable(<positive-int schema>))`.
- **FR-B2** — `PUT /task/:id` json validator gains the same member.
- **FR-B3** — The shared validation schema is: integer, minimum `1`, maximum `2147483647`
  (PostgreSQL `int4` upper bound). A value outside this range, or a non-integer, is rejected by
  Valibot and surfaces as **HTTP 400**, never a 500 from the driver. `null` explicitly clears
  the estimate; omitting the key on `PUT` is treated the same as `null` (the `PUT` is a
  full-document replace today — every other optional field behaves this way).
- **FR-B4** — `createTask()` accepts `estimatedMinutes?: number | null` on its **object**
  parameter and inserts `estimatedMinutes ?? null`.
- **FR-B5** — `updateTask()` has an **11-parameter positional** signature
  (`update-task.ts:9`). The new parameter is appended **at the end**, after `currentUserId`,
  as `estimatedMinutes?: number | null`, and `.set({ ... })` writes `estimatedMinutes ?? null`.
  Every call site must be updated. Verified call sites of the *API controller* (as opposed to
  the identically named web fetcher): exactly one — `apps/api/src/task/index.ts:378`.
  The web `updateTask(taskId, task)` is a separate object-shaped fetcher and changes via the
  `Task` type, not by position.
- **FR-B6** — No new `publishEvent()` topic. The estimate is a task property like priority;
  the existing `task.updated` publication already fires on every `PUT` and drives the realtime
  refresh. No activity-feed entry is added (matching `startDate`, which also has none).
- **FR-B7** — Authorization is unchanged: the estimate is written only through routes already
  guarded by `workspaceAccess` + `requireWorkspacePermission({ task: [...] })` +
  `requireTaskAssigneePermission` + `requireEntitlement`. No new permission verb.

### FR-C — API read path

- **FR-C1** — `get-tasks.ts` `taskSelection` (line ~123) gains
  `estimatedMinutes: taskTable.estimatedMinutes`. The three `...task` spreads at ~233/242/250
  then propagate it without further edits.
- **FR-C2** — `get-task.ts` inline whitelist (lines 9–23) gains the same entry.
- **FR-C3** — `taskSchema` (`apps/api/src/schemas.ts:25`) gains
  `estimatedMinutes: v.nullable(v.number())`, keeping the OpenAPI response contract accurate.

### FR-D — Web type + data layer

- **FR-D1** — `apps/web/src/types/task/index.ts` `Task` gains
  `estimatedMinutes: number | null`.
- **FR-D2** — `apps/web/src/fetchers/task/update-task.ts` sends
  `estimatedMinutes: task.estimatedMinutes ?? null` in the `json` body. Omitting it would
  silently clear the estimate on every drag-reorder, archive, and inline title edit, since
  those all round-trip the whole task through this one fetcher.
- **FR-D3** — `useUpdateTask()` needs no change; its existing invalidations
  (`["task", id]`, `["tasks", projectId]`, `["projects"]`) already refresh every surface that
  shows the estimate.

### FR-E — Hours↔minutes conversion (web only)

- **FR-E1** — A single conversion/formatting utility owns both directions. The API never sees
  hours. Location: a small module under the web app's `lib/`, or colocated with the popover if
  the write contract's allowlist forbids `lib/` (see §6 Risks).
- **FR-E2** — Parse: accept a decimal-hours string (`"1.5"`, `"2"`, `"0.25"`), convert to
  minutes with `Math.round(hours * 60)`, reject `NaN`, `<= 0`, and `> 2147483647`.
- **FR-E3** — Format: minutes → a compact display string. `90 → "1.5h"`, `120 → "2h"`,
  `30 → "0.5h"`. Trailing `.0` is trimmed. Formatting is applied **once, at render**, never
  to an intermediate value that is summed.
- **FR-E4** — The rollup sums **integers** and formats the total once, so no float artifact
  (`0.30000000000000004`) can reach the DOM.

### FR-F — Task detail editing

- **FR-F1** — A new `TaskEstimatePopover` component in `apps/web/src/components/task/`,
  structured exactly like `task-start-date-popover.tsx`: `useUpdateTask()`,
  `useWorkspacePermission()`, `const canEdit = canUpdateTasks()`, and
  `if (!canEdit) return <>{children}</>;` before the `Popover` is rendered.
- **FR-F2** — It offers a numeric hours input plus a clear action when a value is set. On
  submit it calls `updateTask({ ...task, estimatedMinutes })`; on clear,
  `estimatedMinutes: null`.
- **FR-F3** — Success and error toasts use `toast.success` / `toast.error` with static i18n
  keys, matching the sibling popovers.
- **FR-F4** — It is mounted in `task-properties-sidebar.tsx` alongside the start-date and
  due-date triggers, inside the same `{task && (...)}` guard and using the same
  `Button variant="ghost" size="sm"` trigger shape.

### FR-G — Task card

- **FR-G1** — `kanban-board/task-card.tsx` renders the estimate in the existing metadata row
  (beside priority / due-date), styled to match (`text-[10px] px-2 py-1 rounded`).
- **FR-G2** — The element is rendered **only** when `task.estimatedMinutes` is a positive
  number. When null, the card's DOM is byte-identical to today's.

### FR-H — Column header rollup

- **FR-H1** — `kanban-board/column/column-header.tsx` computes
  `sum = column.tasks.reduce((acc, t) => acc + (t.estimatedMinutes ?? 0), 0)`.
- **FR-H2** — `column.tasks` is already the filtered set — `use-task-filters-with-labels-support.ts:196`
  rebuilds each column as `tasks: filterTasks(column.tasks)`. **No new query, no new prop, no
  new store read.**
- **FR-H3** — A task with a null estimate contributes `0` and must not make the sum `null`,
  `NaN`, or `undefined`.
- **FR-H4** — The rollup badge is rendered only when `sum > 0`, so a board with no estimates
  looks exactly like today. It sits next to the existing `column.tasks.length` badge.
- **FR-H5** — The rollup is derived per render from props already in hand; it must not
  introduce a `useEffect`, a store write, or a network call.

### FR-I — i18n

- **FR-I1** — Every new string is a static key in `i18n/en-US.json` under the existing `tasks`
  namespace: `tasks:properties.*` for the sidebar trigger, `tasks:popover.estimate.*` for the
  popover, `tasks:kanban.*` for the rollup label if one is needed.
- **FR-I2** — No template-built or dynamically-indexed key. No new namespace.
- **FR-I3** — The 17 non-English locale files are untouched (off-limits). i18next falls back
  to `en-US` for the new keys, which is the repo's existing behavior for new copy.

### FR-J — Tests

- **FR-J1** — New directory `tests/api/task/` with unit tests covering: the estimate validation
  schema accepting `1` and `2147483647`; rejecting `0`, `-5`, `1.5`, `2147483648`; and `null`
  being an accepted clear. These are pure-function tests over the exported Valibot schema — no
  database, matching how `tests/api/column/to-slug.test.ts` and `tests/api/utils/**` are written.
- **FR-J2** — Web tests for the minutes↔hours utility (parse and format, including the
  `90 → "1.5h"` and integer-sum cases).
- **FR-J3** — A web component test for the column-header rollup: mixed set of tasks where some
  have null estimates, asserting the rendered total and that no badge renders when all are null.
- **FR-J4** — Tests live at paths already in the write-contract allowlist
  (`tests/api/task/**`, `apps/web/src/**/*.test.tsx`, `apps/web/src/**/*.test.ts`).

---

## 4. Non-functional requirements

- **NFR-1 (correctness of arithmetic)** — Storage and all summation are integer minutes.
  No `numeric`, `decimal`, or `real` column is introduced; Drizzle returns `numeric` as a JS
  string, which would silently break `+`.
- **NFR-2 (backward compatibility)** — Existing rows get `NULL` and behave exactly as before.
  The migration runs on a populated database without a table rewrite or a lock beyond
  `ALTER TABLE ... ADD COLUMN` of a nullable column (a catalog-only operation on PG 11+).
- **NFR-3 (performance)** — Zero new queries, zero new round trips. The rollup is O(n) over a
  list already in memory and rendered every frame today.
- **NFR-4 (no regression)** — `pnpm --filter @kaneo/api test && pnpm --filter @kaneo/web test`
  stays green. Baseline: **374 API, 112 web**.
- **NFR-5 (style)** — `pnpm exec biome ci .` clean on changed files. The `lint` scripts
  (`biome check --write`) are **not** to be run — they rewrite unrelated files.
- **NFR-6 (thin handlers)** — Route handlers stay thin; validation lives in the Valibot schema,
  persistence in the controller. Per `AGENTS.md`.
- **NFR-7 (typed client only)** — The web app reaches the API only through `@kaneo/libs`'s
  typed client. No parallel untyped request layer.

---

## 5. PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| `task.estimated_minutes` | **None.** An integer count of minutes of planned work on a task. | Inherits task-level authorization: readable only via routes behind `workspaceAccess` + `requireWorkspacePermission`. Not a credential, not personal data, not derivable to one. |

No new PII is introduced, no new field is logged, and the value is not emitted to any log,
event payload, webhook, or MCP tool by this change.

---

## 6. Role matrix (delta)

| Role capability | Resource | Action | Enforcement | Change? |
|---|---|---|---|---|
| `task: ["create"]` | task estimate | set at creation | `requireWorkspacePermission` on `POST /task/:projectId` | **none — reused** |
| `task: ["update"]` | task estimate | set / change / clear | `requireWorkspacePermission` + `requireTaskAssigneePermission` on `PUT /task/:id` | **none — reused** |
| workspace read access | task estimate | read (list, detail, card, rollup) | `workspaceAccess` on the two GET routes | **none — reused** |
| (UI) `canUpdateTasks()` | estimate popover | render as editable | `useWorkspacePermission()` early-return | **new call site, existing hook** |

No new permission verb is added to `@kaneo/permissions`. The UI check is a convenience only;
the API remains the authority (`AGENTS.md`: "Hiding an action in the UI is not an
authorization check").

---

## 7. Risks and open items

- **R-1 — the 11-arg positional `updateTask`.** The single most error-prone edit. Mitigation:
  append at the end, and re-verify by grep (`grep -rn "updateTask(" apps/api`) after the edit
  rather than trusting the plan. One API call site: `apps/api/src/task/index.ts:378`.
- **R-2 — the write-contract allowlist does not include `apps/web/src/lib/**`.** FR-E1's
  utility therefore cannot live at `apps/web/src/lib/estimate.ts` under `strict: true`. The
  design phase must place it inside an allowlisted path — the natural home is
  `apps/web/src/components/task/` (allowlisted via `components/task/**`). This is a real
  constraint on the design, not a hypothetical; the hook will refuse the write otherwise.
- **R-3 — the rollup component is `column-header.tsx`, but the utility it needs lives under
  `components/task/`.** An import across those two directories is fine (the repo does this
  freely), but the design must state the direction explicitly so the codegen packets agree.
- **R-4 — `.gitignore` is off-limits and `.husky/pre-commit` runs
  `pnpm exec biome ci . && pnpm run build`.** Committing `.sdlc/` artifacts on this branch will
  fail that hook. Flagged for the final report; **not** fixed by this run.
- **R-5 — field naming.** `estimatedMinutes` (not `estimatedHours`) is chosen deliberately so
  the unit is unambiguous at every read site. The intent brief's title says "hours" because
  that is the *display* unit. If the reviewer prefers the column be named `estimate` with the
  unit only in a comment, say so at Gate 1 — it is cheap now and expensive after the migration.

---

## 8. Acceptance criteria

1. **AC-1** — `apps/api/drizzle/` contains exactly one new generated migration whose SQL adds a
   nullable `estimated_minutes integer` to `task`, and files `0000`–`0042` are unmodified
   (`git status` shows no change to them).
2. **AC-2** — `POST /task/:projectId` and `PUT /task/:id` accept an integer estimate, and
   reject `0`, `-1`, `1.5`, and `2147483648` with **400**.
3. **AC-3** — `GET /task/tasks/:projectId` and `GET /task/:id` both include the field in their
   response, and `taskSchema` declares it.
4. **AC-4** — The web `Task` type carries the field, and `update-task.ts` round-trips it, so a
   drag-reorder does not clear an existing estimate.
5. **AC-5** — The task card shows the estimate when set. With every task's estimate null, the
   card renders no additional element.
6. **AC-6** — The column header shows a total over the **filtered** task set that equals the
   sum of the visible cards' estimates. Null estimates contribute nothing and never make the
   total null or `NaN`. With all-null estimates, no rollup badge renders.
7. **AC-7** — With `canUpdateTasks()` false, the estimate popover renders its children plain
   and opens nothing — identical to `TaskDueDatePopover`'s read-only behavior.
8. **AC-8** — Every new string resolves from `i18n/en-US.json`; no literal user-facing copy is
   embedded in a component.
9. **AC-9** — `pnpm --filter @kaneo/api test` and `pnpm --filter @kaneo/web test` both pass,
   with counts **≥ 374** and **≥ 112** respectively (new tests add to these).
10. **AC-10** — `pnpm exec biome ci .` reports no error on the changed files.
11. **AC-11** — No file outside the write-contract allowlist is modified. `git status` at the
    end of the run contains no off-limits path.

---

## 9. Open questions for HITL

- **Q-1** — Column name: `estimated_minutes` (proposed, unit-explicit) vs `estimate`
  (unit-implicit). Migrations are one-way; this is the moment to choose. **Default if you say
  nothing: `estimated_minutes`.**
- **Q-2** — Should the rollup badge also appear when the total is `0` but some tasks exist
  (i.e. always show `0h`)? **Default: hide it**, so boards that never use estimates are
  visually unchanged.
- **Q-3** — Display granularity: is `"1.5h"` right, or do you want `"1h 30m"`?
  **Default: `"1.5h"`**, per the intent brief's worked example (`90 -> "1.5h"`).

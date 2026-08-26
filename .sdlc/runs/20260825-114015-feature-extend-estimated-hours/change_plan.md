# Change Plan — Estimated hours on tasks with per-column rollup

- **Run:** `20260825-114015-feature-extend-estimated-hours`
- **Mode / intent:** brownfield · `feature-extend`
- **Baseline:** `5d1fc910` on `feature-extend-2/opus-sonnet`
- **Inputs:** `requirements.md` (FR/NFR/AC ids referenced throughout), `intent_brief.md`,
  `.sdlc/baseline/stack-profile.md` (authoritative for shape), `.sdlc/local/write-contract.json`
- **Form:** delta. Everything not named here is unchanged.

## Frozen names (single source of truth for codegen)

| Concern | Value |
|---|---|
| DB column (snake_case) | `estimated_hours` |
| DB type | `numeric(7, 2)` |
| Drizzle property (camelCase) | `estimatedHours` |
| Drizzle declaration | `numeric("estimated_hours", { precision: 7, scale: 2, mode: "number" })` |
| TS type end-to-end | `number \| null` (web `Task` field is **optional**: `estimatedHours?: number \| null`) |
| Route | `PUT /task/estimated-hours/:id` |
| `operationId` | `updateTaskEstimatedHours` |
| API controller | `apps/api/src/task/controllers/update-task-estimated-hours.ts` (`export default`) |
| Web fetcher | `apps/web/src/fetchers/task/update-task-estimated-hours.ts` (`export default`) |
| Web hook | `useUpdateTaskEstimatedHours` (named export) |
| Web control | `TaskEstimatedHoursPopover` (`export default`, mirrors `TaskDueDatePopover`) |
| Rollup component | `ColumnEstimatedHoursBadge` (named export) |
| Upper bound | `MAX_ESTIMATED_HOURS = 10_000` |
| Event published | `task.updated` (existing vocabulary, no new activity type) |

**Export-style note.** The stack profile says "named export for components", but the local
`apps/web/src/components/task/` folder is uniformly `export default` (`task-due-date-popover.tsx`,
`task-priority-popover.tsx`, `task-assignee-popover.tsx`, imported as default by
`task-properties-sidebar.tsx`). NFR-3 says mirror the `dueDate` counterpart. The counterpart wins:
`components/task/*` → `export default`; `components/kanban-board/*` → named export (matches
`ColumnHeader`, `TaskLabels`).

---

## 1. Files added

All paths confirmed inside `.sdlc/local/write-contract.json`'s allowlist.

| # | Path | Purpose | Allowlist glob |
|---|---|---|---|
| 1 | `apps/api/src/task/controllers/update-task-estimated-hours.ts` | Single-field controller: read-before-write, 404/500 `HTTPException`, `publishEvent("task.updated")`, `export default`. Mirrors `update-task-due-date.ts`. | `apps/api/src/task/**` |
| 2 | `apps/api/drizzle/0043_<generated>.sql` | **Generated only** by `pnpm --filter @kaneo/api db:generate`. Expected content is exactly one statement: `ALTER TABLE "task" ADD COLUMN "estimated_hours" numeric(7, 2);` | `apps/api/drizzle/**` |
| 3 | `apps/api/drizzle/meta/0043_snapshot.json` + regenerated `apps/api/drizzle/meta/_journal.json` | Tool output. **Never hand-edited.** | `apps/api/drizzle/**` |
| 4 | `apps/web/src/fetchers/task/update-task-estimated-hours.ts` | Typed-client call to the new route, `export default`, re-throws `new Error(await response.text())`. | `apps/web/src/fetchers/task/**` |
| 5 | `apps/web/src/hooks/mutations/task/use-update-task-estimated-hours.ts` | `useMutation` + invalidate `["task", id]` and `["tasks", projectId]`. Named export. | `apps/web/src/hooks/mutations/task/**` |
| 6 | `apps/web/src/lib/estimated-hours.ts` | The FR-W8 shared pure helpers: `MAX_ESTIMATED_HOURS`, `sumEstimatedHours`, `parseEstimatedHoursInput`. No React, no i18n, no side effects. | `apps/web/src/lib/**` |
| 7 | `apps/web/src/lib/estimated-hours.test.ts` | Colocated unit tests for the sum and the input parser. | `apps/web/src/lib/**` |
| 8 | `apps/web/src/components/task/task-estimated-hours-popover.tsx` | Set / change / clear control, `export default`. | `apps/web/src/components/task/**` |
| 9 | `apps/web/src/components/kanban-board/column/column-estimated-hours-badge.tsx` | The rollup badge, extracted so it is renderable in isolation. Named export. | `apps/web/src/components/kanban-board/**` |
| 10 | `apps/web/src/components/kanban-board/column/column-estimated-hours-badge.test.tsx` | AC-15: sum, zero behavior, hidden state. | `apps/web/src/components/kanban-board/**` |
| 11 | `tests/api/task-estimated-hours-validation.test.ts` | AC-13: pure Valibot boundary test, no DB, no mocks. | `tests/api/**` |

### THE UNMISSABLE ITEM

> **Three read controllers build explicit column-selection objects.** `estimatedHours` is invisible
> to every consumer — including the board payload and therefore the entire rollup — unless it is
> added to **all three** by name. This is edit items 2.4, 2.5 and 2.6 below and is the single
> highest-risk omission in this change. If the integration assertion in §8 case 7
> (`GET /task/tasks/:projectId` returns the field) fails, this is why.

---

## 2. Files edited

### 2.1 `apps/api/src/database/schema.ts` — `patch_apply`
Add one property to `taskTable` (currently line ~428), immediately after `dueDate`:

```ts
    estimatedHours: numeric("estimated_hours", {
      precision: 7,
      scale: 2,
      mode: "number",
    }),
```

Add `numeric` to the existing `drizzle-orm/pg-core` import list. **No index** (FR-D5). **No**
`.notNull()`, **no** `.default()` (FR-D4). `relations.ts` is untouched (FR-D6).

### 2.2 `apps/api/src/schemas.ts` — `patch_apply`
In `taskSchema` (line ~25), after `dueDate: v.optional(v.date()),`:

```ts
  estimatedHours: v.nullable(v.number()),
```

`v.nullable`, not `v.optional`: the read controllers always select the column, so the key is
always present on the wire (FR-A1, AC-8).

**Do not touch `activitySchema`.** Its `type` picklist must not gain a member — OOS-2, and the
activity module is outside the allowlist.

### 2.3 `apps/api/src/task/validate-task-fields.ts` — `patch_apply`
Add `import * as v from "valibot";` at the top and append these exports verbatim:

```ts
export const MAX_ESTIMATED_HOURS = 10_000;

export const estimatedHoursSchema = v.pipe(
  v.number("Estimated hours must be a number"),
  v.finite("Estimated hours must be a finite number"),
  v.minValue(0, "Estimated hours cannot be negative"),
  v.maxValue(
    MAX_ESTIMATED_HOURS,
    `Estimated hours cannot exceed ${MAX_ESTIMATED_HOURS}`,
  ),
  v.transform((value) => Math.round(value * 100) / 100),
);

export const nullableEstimatedHoursSchema = v.nullable(estimatedHoursSchema);

export const optionalEstimatedHoursSchema = v.optional(
  nullableEstimatedHoursSchema,
);
```

Why here: this file is already the home for task field validation (`VALID_PRIORITIES`,
`assertValidPriority`), it is inside the allowlist, and it makes the boundary unit-testable from
`tests/api/**` without a database (AC-13).

Why `10_000`: ~5 person-years at 2 000 h/yr. No single task can legitimately exceed it, and it
catches the realistic typo (`800` → `80000`). It sits an order of magnitude inside `numeric(7,2)`'s
`99999.99` capacity, so a rejection is always a clean Valibot **400**, never a Postgres numeric
overflow surfacing as a 500 (FR-A7, AC-5).

Why the `v.transform` rounding: `scale: 2` means Postgres would silently round `2.005` to `2.01`
on write, so a caller could read back a value it never sent. Rounding at the boundary makes
"what you sent is what is stored is what is returned" true.

### 2.4 `apps/api/src/task/controllers/get-tasks.ts` — `patch_apply` — **BOARD PAYLOAD**
Add to the `taskSelection` object (line ~123), after `dueDate: taskTable.dueDate,`:

```ts
    estimatedHours: taskTable.estimatedHours,
```

This one line is what makes FR-W6 possible at all.

### 2.5 `apps/api/src/task/controllers/get-task.ts` — `patch_apply`
Add `estimatedHours: taskTable.estimatedHours,` to the `.select({...})` object after `dueDate`.

### 2.6 `apps/api/src/task/controllers/export-tasks.ts` — `patch_apply`
Two edits: add `estimatedHours: taskTable.estimatedHours,` to the `.select({...})`, **and** add
`estimatedHours: task.estimatedHours ?? null,` to the returned `tasks.map(...)` object after
`startDate`. (D-4 — see §5.)

### 2.7 `apps/api/src/task/controllers/create-task.ts` — `patch_apply`
Named-object param already. Add `estimatedHours` to the destructure and to the type as
`estimatedHours?: number | null;`, then add to the `tx.insert(taskTable).values({...})`:

```ts
        estimatedHours: estimatedHours ?? null,
```

Omitting the field on `POST` produces `NULL` — byte-identical to baseline behavior plus one new
null key (NFR-1, AC-2).

### 2.8 `apps/api/src/task/controllers/update-task.ts` — `existing_file_edit` — **signature change**
Convert the eleven positional parameters to the house named-object shape and add the twelfth
field. New signature:

```ts
async function updateTask({
  id,
  title,
  status,
  startDate,
  dueDate,
  projectId,
  description,
  priority,
  position,
  userId,
  currentUserId,
  estimatedHours,
}: {
  id: string;
  title: string;
  status: string;
  startDate: Date | undefined;
  dueDate: Date | undefined;
  projectId: string;
  description: string;
  priority: string;
  position: number;
  userId?: string;
  currentUserId?: string;
  estimatedHours?: number | null;
})
```

Body is otherwise unchanged except the `.set({...})` gains **a conditional spread, not a plain
assignment**:

```ts
      ...(estimatedHours !== undefined ? { estimatedHours } : {}),
```

**This conditional is load-bearing for NFR-1.** `PUT /task/:id` is a whole-task replace: kanban
drag-and-drop, the archive-all action in `column-header.tsx`, and the create-task modal's draft
save all route through it. An unconditional `estimatedHours: estimatedHours ?? null` would silently
wipe every estimate on the next drag. Only set it when the caller explicitly sent it.

Rationale for the refactor (**D-2**, see §5 ADR-2): the only production call site is the
`PUT /:id` handler in `apps/api/src/task/index.ts`.

**Codegen precondition:** before writing, grep `tests/` for `controllers/update-task` and for
`updateTask(` direct invocations. Any direct caller found in `tests/api/**` or
`tests/api-integration/**` is inside the allowlist and must be converted in the same packet.
`pnpm typecheck` is the gate — a missed caller is a compile error, never a silent bug.

### 2.9 `apps/api/src/task/controllers/import-tasks.ts` — `patch_apply`
Add `estimatedHours?: number | null;` to the exported `ImportTask` type and
`estimatedHours: taskData.estimatedHours ?? null,` to the `tx.insert(...).values({...})`.

### 2.10 `apps/api/src/task/index.ts` — `existing_file_edit` — see §6 for the paired packet

### 2.11 `apps/web/src/types/task/index.ts` — `patch_apply`
Add to `Task`, after `dueDate: string | null;`:

```ts
  estimatedHours?: number | null;
```

**Optional, deliberately.** The API always returns the key, so `number | null` would be more
"accurate" — but `Task` object literals are constructed in files outside the allowlist
(list/backlog/gantt surfaces). A required key would break `pnpm typecheck` in files this run may
not touch, and the fix would sit outside the write contract (NFR-9). The existing `updatedAt?` and
`assigneeImage?` fields set this precedent. `sumEstimatedHours` accepts
`number | null | undefined`, so nothing downstream cares.

`apps/web/src/types/project/index.ts` is **not edited**: `ProjectWithTasks` already overrides
`columns[].tasks` to `Task[]`, so it inherits the new field for free.

### 2.12 `apps/web/src/lib/format.ts` — `patch_apply`
Append one locale-aware formatter next to the date formatters, reusing the file's private
`getLocale`:

```ts
export function formatEstimatedHours(value: number, locale?: string) {
  return new Intl.NumberFormat(getLocale(locale), {
    maximumFractionDigits: 2,
  }).format(value);
}
```

`maximumFractionDigits: 2` is what absorbs float artifacts: `0.30000000000000004` renders as
`0.3`, `2.5` as `2.5`, `4` as `4`. This is the **only** formatter for the value (FR-W8) — the
rollup badge, the sidebar trigger and the modal chip all call it. It imports nothing new.

### 2.13 `apps/web/src/fetchers/task/create-task.ts` — `existing_file_edit`
Convert the eight positional parameters to a single named object typed as the existing exported
`CreateTaskRequest` (which gains `estimatedHours` automatically from the route validator via
`InferRequestType`). New shape:

```ts
async function createTask({
  title,
  description,
  projectId,
  userId,
  status,
  startDate,
  dueDate,
  priority,
  estimatedHours,
}: CreateTaskRequest) {
```

`startDate` / `dueDate` are passed straight through as the ISO strings they already are — the
current `string → new Date() → .toISOString()` round-trip through the hook is a no-op and is
removed. Only call site is `use-create-task.ts` (2.14). Same reasoning as ADR-2: this file must be
touched regardless, and appending a ninth positional argument makes the defect worse.

### 2.14 `apps/web/src/hooks/mutations/task/use-create-task.ts` — `patch_apply`
`mutationFn` collapses to `(request: CreateTaskRequest) => createTask(request)`. Invalidation
fan-out unchanged.

### 2.15 `apps/web/src/fetchers/task/update-task.ts` — `patch_apply`
Add to the `json` object:

```ts
      estimatedHours: task.estimatedHours ?? undefined,
```

`?? undefined` (not `?? null`) pairs with the conditional `.set()` in 2.8: a task with no estimate
sends nothing and is left alone; a task with an estimate re-affirms it. Clearing is never done
through this route — that is what the dedicated single-field route is for.

### 2.16 `apps/web/src/components/task/task-properties-sidebar.tsx` — `existing_file_edit`
Add `import TaskEstimatedHoursPopover from "./task-estimated-hours-popover";`, add `Hourglass` to
the `lucide-react` import, add `formatEstimatedHours` to the `@/lib/format` import.

Insert the same block **in all three layout branches**, immediately after each existing
`TaskDueDatePopover` block (compact ~line 326, mobile `lg:hidden` ~line 517, desktop `lg:block`
~line 710). Desktop variant adds `w-full` to the button className, matching its siblings:

```tsx
              {task && (
                <TaskEstimatedHoursPopover task={task}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start h-7 px-1.5 gap-1.5"
                  >
                    <Hourglass className="w-3.5 h-3.5 text-muted-foreground" />
                    <span
                      className={`text-xs font-semibold ${task.estimatedHours != null ? "" : "text-muted-foreground"}`}
                    >
                      {task.estimatedHours != null
                        ? t("tasks:properties.estimatedHoursValue", {
                            hours: formatEstimatedHours(task.estimatedHours),
                          })
                        : t("tasks:properties.noEstimate")}
                    </span>
                  </Button>
                </TaskEstimatedHoursPopover>
              )}
```

`task.estimatedHours != null` (loose) so an explicit `0` renders as `0h`, not as "No estimate"
(**D-5**).

`Hourglass`, not `Clock`/`Timer` — the latter two are the `time-entry` actual-tracking iconography
and reusing them would collide with the vocabulary NFR-4 forbids.

### 2.17 `apps/web/src/components/kanban-board/column/column-header.tsx` — `patch_apply`
Add `import { ColumnEstimatedHoursBadge } from "./column-estimated-hours-badge";` and render it
immediately after the existing count badge, inside the same
`<div className="flex min-w-0 items-center gap-2">`:

```tsx
        <ColumnEstimatedHoursBadge tasks={column.tasks} />
```

Nothing else in this file changes. The component returns `null` when the total is 0, so an
unestimated board renders byte-identically to today (AC-10).

### 2.18 `apps/web/src/components/shared/modals/create-task-modal.tsx` — `existing_file_edit`
- Add state: `const [estimatedHours, setEstimatedHours] = useState("");`
- Reset it in `handleClose` and in the `createMore` reset branch, alongside `setDueDate(undefined)`.
- Add a chip-styled `Popover` in the `flex flex-wrap items-center gap-2 py-2` row, immediately
  after the due-date `Popover` (~line 926), containing a single
  `<Input type="number" min={0} max={10000} step={0.25} />` bound to `estimatedHours`, plus a
  clear `Button` shown when the field is non-empty. Trigger label:
  `parsed != null ? t("tasks:properties.estimatedHoursValue", { hours: formatEstimatedHours(parsed) }) : t("tasks:properties.estimatedHours")`.
  Icon `Hourglass`.
- Pass it to **both** `createTask(...)` calls (`ensureDraftTask` and `handleSubmit`) and to the
  `updateTask(...)` draft-save call as:
  ```ts
  estimatedHours: parseEstimatedHoursInput(estimatedHours).value ?? undefined,
  ```
  Empty input therefore sends **nothing**, never `0` (FR-W5). Add `estimatedHours` to
  `ensureDraftTask`'s `useCallback` dependency array.
- `normalizeTask` is **not** changed: `Task.estimatedHours` is optional and the created task is
  spread, so the value survives.
- Reuses `tasks:` keys rather than minting `common:modals.createTask.*` siblings — see §7 note.

### 2.19 `tests/api-integration/task.test.ts` — `existing_file_edit`
New `describe` block. See §8.

### 2.20 `.gitignore` — conditional, `patch_apply`
Gate 0 approved a one-line `.sdlc/` append. `git status` at baseline already shows `.sdlc/`
suppressed, so this is expected to be a **no-op**. Only if a packet-time `git status` shows
`.sdlc/` as untracked does codegen append the single line. Do not reformat the file.

### Explicitly NOT edited (allowlisted but deliberately untouched)

- **`apps/api/src/project/controllers/get-projects.ts`** — this file computes *workspace project
  statistics* (`totalTasks`, `completionPercentage`, `min(dueDate)`), **not** the board payload.
  OOS-6. **No packet may target it.** Adding a `sum(estimatedHours)` there would change the
  workspace project-list payload for no requirement in this brief.
- `apps/api/src/database/relations.ts` — scalar column, no relation (FR-D6).
- `apps/api/src/task/controllers/bulk-update-tasks.ts` — OOS-7, no `set-estimated-hours` operation.
- `apps/api/src/task/controllers/move-task.ts`, `delete-task.ts`, the other
  `update-task-<field>.ts` controllers — untouched.
- `apps/web/src/components/kanban-board/task-card.tsx` — **OOS-12 resolved to skip** (D-7).
- `apps/web/src/types/project/index.ts` — inherits from `Task`.
- `apps/web/src/hooks/queries/task/**` — `useGetTask` / `useGetTasks` return `InferResponseType`;
  the field appears with zero edits once §2.4/2.5 land.
- `packages/libs/**` — **not in the allowlist and requires no change**: `AppType` propagates the
  new route to `hc<AppType>` automatically.

---

## 3. Files removed

**None.**

---

## 4. Data-layer changes

**Schema.** One nullable column on `taskTable`:
`estimatedHours: numeric("estimated_hours", { precision: 7, scale: 2, mode: "number" })`.

**Migration.** Produced by `pnpm --filter @kaneo/api db:generate` only (FR-D3). Drizzle emits the
next numbered file (baseline is through `0042_previous_the_executioner.sql`, so expect `0043_*`)
plus `meta/0043_snapshot.json` and an updated `meta/_journal.json`.

**Mandatory SQL inspection gate (NFR-2, AC-1).** After generating, read the emitted `.sql` and
confirm it is exactly:

```sql
ALTER TABLE "task" ADD COLUMN "estimated_hours" numeric(7, 2);
```

Reject and investigate if it contains `NOT NULL`, `DEFAULT`, `USING`, a table rewrite, or any
statement touching a second table. Never hand-edit the SQL. Never edit `apps/api/drizzle/meta/`.

**Existing data.** Every existing row gets `NULL`. No backfill. No lock beyond the brief
`ACCESS EXCLUSIVE` of a catalog-only `ADD COLUMN` (PostgreSQL 11+ does not rewrite for a nullable
column with no default), so this applies safely to a populated production database.

**No index** (FR-D5) — nothing in scope filters or sorts on the column, and the board rollup is
computed client-side over already-loaded rows (NFR-7).

**Relations.** `apps/api/src/database/relations.ts` unchanged.

---

## 5. API contract changes

### New route

```
PUT /task/estimated-hours/:id
```

Two path segments, so it cannot shadow or be shadowed by the one-segment `PUT /task/:id`, the same
way `/due-date/:id`, `/status/:id` and `/title/:id` already coexist with it. Register it
immediately after the `/due-date/:id` block in the chained builder.

**Request**

```json
{ "estimatedHours": 2.5 }
```

`estimatedHours` is a **required key** whose value may be `number` or `null`. Explicit `null`
clears the estimate (AC-4).

**Responses**

| Status | Body | When |
|---|---|---|
| 200 | the full updated task row (`resolver(taskSchema)`) | success |
| 400 | validation message | negative, non-finite, `> 10000`, or non-numeric |
| 403 | `"You don't have access to this workspace"` / permission denial | `workspaceAccess.fromTask()` or `requireWorkspacePermission` rejects |
| 404 | `"Task not found"` | controller read-before-write finds nothing |
| 500 | `"Failed to update task estimated hours"` | update returned no row |

**Authorization** is exactly `workspaceAccess.fromTask()` → `requireWorkspacePermission({ task:
["update"] })` → `requireEntitlement`. No new permission verb, no hand-rolled role check (FR-A8,
§6 role matrix).

### Changed request shapes (all strictly additive and optional)

| Route | Change |
|---|---|
| `POST /task/:projectId` | `json` gains `estimatedHours: optionalEstimatedHoursSchema` |
| `PUT /task/:id` | `json` gains `estimatedHours: optionalEstimatedHoursSchema`; handler passes it into the named-object `updateTask({...})` |
| `POST /task/import/:projectId` | each item in `tasks[]` gains `estimatedHours: optionalEstimatedHoursSchema` |

### Changed response shapes

| Route | Change |
|---|---|
| `GET /task/:id` | +`estimatedHours: number \| null` |
| `GET /task/tasks/:projectId` | +`estimatedHours` on every task in `columns[].tasks`, `archivedTasks`, `plannedTasks` |
| `GET /task/export/:projectId` | +`estimatedHours: number \| null` on each exported task |
| `PUT /task/:id`, `POST /task/:projectId`, every `PUT /task/<field>/:id` | +`estimatedHours` (they all `.returning()` the full row) |

### Deprecated routes

**None.**

### Backward compatibility (NFR-1)

Omitting `estimatedHours` on any existing request produces the same status, the same events and
the same row as at baseline, with one additional `null`-valued key in the response. Older web
builds, MCP callers, API-key callers and webhooks are unaffected — JSON consumers ignore unknown
keys, and the whole-task `PUT` cannot wipe the field because of the conditional `.set()` in §2.8.

### Design decisions D-1 … D-7 (ADR form)

#### ADR-1 (D-1) — Storage type for fractional hours

**Context.** Q-1 confirmed fractional hours are required (`0.5`, `2.25`). `schema.ts` uses only
`integer` today; the nearest time precedent is `timeEntryTable.duration = integer` in **seconds**.
Three candidates: `real`/`doublePrecision` (float artifacts, would be the repo's first float
column), `integer` minutes (exact, matches `duration`, but every layer converts and the field name
stops meaning "hours"), and `numeric(p, s)`.

**Decision.** `numeric("estimated_hours", { precision: 7, scale: 2, mode: "number" })`. drizzle-orm
0.45.2 supports the `mode` config (verified in the installed
`pg-core/columns/numeric.d.ts`); with `mode: "number"` Postgres stores exact decimal and Drizzle
surfaces a plain JS `number`.

**Consequences.**
- Storage is exact to 0.01 h — `0.5`, `0.25`, `2.25` are all representable, no float drift on write
  or read.
- The web `Task` field is a plain `number | null`. **No parsing layer anywhere** — this is what
  disqualified the default `mode: "string"` form of `numeric`.
- FR-W6's sum is a plain client-side `reduce` over already-loaded `column.tasks`; JS float addition
  can still produce `0.30000000000000004`, so `sumEstimatedHours` rounds to 2 dp and
  `formatEstimatedHours` uses `maximumFractionDigits: 2`. Two independent guards, one formatter
  (FR-W8).
- `scale: 2` means Postgres would round `2.005` silently; the Valibot `v.transform` rounds at the
  boundary first, so stored == returned == sent.
- The column name reads as planned effort in hours and shares no token with `duration` /
  `startTime` / `endTime` (NFR-4).

#### ADR-2 (D-2) — `updateTask`'s eleven positional parameters

**Context.** `apps/api/src/task/controllers/update-task.ts` takes
`(id, title, status, startDate, dueDate, projectId, description, priority, position, userId?,
currentUserId?)` — the one file in `apps/api/src/task/controllers/` that departs from the house
named-object convention. AGENTS.md says both "do not preserve accidental complexity merely because
it exists" and "do not mix requested work with broad refactors."

**Decision.** Convert to the house named-object shape in the same packet as the field addition.

**Consequences.**
- Blast radius of the chosen path: **one production call site** (the `PUT /:id` handler in
  `apps/api/src/task/index.ts`), plus any direct test caller — both inside the allowlist. The
  change is mechanical and **fully caught by the compiler**: a missed caller is a `pnpm typecheck`
  failure, not a runtime bug.
- Blast radius of the rejected path (append a twelfth positional): the call becomes
  `updateTask(id, title, status, startDate, dueDate, projectId, description, priority, position,
  userId, currentUserId, estimatedHours)` — twelve positional arguments where `position: number`
  and `estimatedHours: number | null` are both numeric and only two slots apart. A future
  transposition there is type-compatible and therefore **silent**. That is not "preserving"
  accidental complexity, it is compounding it.
- This is not a broad refactor: it is one function, one signature, one call site, in the file the
  change already has to open. No other controller is touched. AGENTS.md's anti-refactor line is
  about *unrelated* cleanup; this is the minimum safe way to add the parameter.
- The same reasoning, and only the same reasoning, is applied to
  `apps/web/src/fetchers/task/create-task.ts` (§2.13), which has one call site and must be touched
  anyway. No other signature in the repo is normalized by this run.

#### ADR-3 (D-3) — Route path and `operationId`

**Context.** Existing task route segments: `tasks`, `bulk`, `move`, `export`, `import`, `status`,
`priority`, `assignee`, `due-date`, `title`, `description`, `image-upload`. `time-entry` owns
`duration`, `start-time`, `end-time`.

**Decision.** Path `PUT /task/estimated-hours/:id`, `operationId: "updateTaskEstimatedHours"`,
`tags: ["Tasks"]`, description `"Update only the estimated hours of a task"`, 200 described as
`"Task estimated hours updated successfully"` with `resolver(taskSchema)`.

**Consequences.** No collision with any existing segment or `operationId` (AC-8). Kebab-case
matches `due-date` / `image-upload`. The typed client path is
`client.task["estimated-hours"][":id"].$put` — segment-for-segment, no manual client edit.
"estimated" makes the planned-vs-actual distinction unambiguous (NFR-4).

#### ADR-4 (D-4) — Import/export participation

**Context.** OOS-8 left this open and required an explicit decision. Q-3 confirmed **both**.

**Decision.** Export **includes** the field; import **accepts** it as optional.

**Consequences.**
- Export costs two lines (one select entry, one map entry) and prevents planning data from
  vanishing on a round trip.
- The export file gains one key. Existing consumers that read `title`/`status`/`priority` are
  unaffected; JSON consumers ignore unknown keys. This is the one shape change to an existing
  artifact in this run and is called out here on purpose.
- Import's field is `optionalEstimatedHoursSchema`, so **every export file produced before this
  change still imports byte-identically**, with `NULL` estimates. Round-trip is now lossless in
  both directions.
- Import shares the exact same validator as create, so an import file cannot smuggle a negative or
  absurd value past the bound.

#### ADR-5 (D-5) — Zero-value semantics

**Context.** Q-2 confirmed explicit `0` is meaningful.

**Decision.** The API stores and returns `0` distinctly from `NULL`. A **task** with `0` renders
`0h` in the sidebar. A **column** whose *total* is `0` renders **no** badge.

**Consequences.**
- All null-checks in web code use `!= null` / `!== null`, never falsy checks — `0` must not
  collapse into "unset". This is an explicit review item.
- The corner case is accepted deliberately: a column in which every task is estimated at exactly
  `0` shows no rollup badge. FR-W6 defines the badge by the *total*, and this keeps unestimated
  boards pixel-identical to today (AC-10), which is the more valuable property.
- `parseEstimatedHoursInput("")` returns `{ ok: true, value: null }` and
  `parseEstimatedHoursInput("0")` returns `{ ok: true, value: 0 }` — empty is not zero.

#### ADR-6 (D-6) — Where and what the sidebar control is

**Context.** Hours are typed, not picked, so the calendar-popover shape does not transfer directly.

**Decision.** A popover (`TaskEstimatedHoursPopover`, `export default`) containing a numeric
`Input` plus a Save button and a Clear button, triggered by a ghost `Button` with an `Hourglass`
icon, placed **immediately after** `TaskDueDatePopover` in all three sidebar layout branches.

**Consequences.**
- Structurally identical to `TaskDueDatePopover`: `{ task, children }` props, `useTranslation`
  first, `useState` for `open`, the mutation hook, `useWorkspacePermission().canUpdateTasks()`,
  `if (!canEdit) return <>{children}</>;`, `toast.success` / `toast.error` with i18n keys. NFR-3
  satisfied without inventing a new interaction idiom.
- A popover rather than an always-inline input keeps the dense sidebar row unchanged in width and
  keeps `Enter`-to-commit natural.
- The Clear button renders only when `task.estimatedHours != null`, mirroring the due-date popover's
  conditional clear row, and sends explicit `null` (AC-4, AC-9).
- Permission gating is presentational only; the API remains the authority (FR-A8, AC-6).

#### ADR-7 (D-7) — Per-task estimate on the kanban card

**Context.** OOS-12 made this optional. Q-4 confirmed skip.

**Decision.** **No.** `apps/web/src/components/kanban-board/task-card.tsx` is not edited.

**Consequences.** The card's dense layout is untouched; the rollup badge plus the sidebar control
carry the whole feature. `formatEstimatedHours` still exists as the single formatter (FR-W8), so
adding a card chip later is a one-line change with no drift risk.

---

## 6. Framework-owned wiring

The framework-owned surface here is the chained `new Hono<...>()` builder in
`apps/api/src/task/index.ts`. Per §7.9, these edits ship as **one paired packet** — the controller
import, the new route link, and the two existing-route validator changes must land together or the
file does not compile.

**Packet P4 — `apps/api/src/task/index.ts` (`existing_file_edit`), four coupled edits:**

**6.1 — Imports (top of file).** Add, in the existing alphabetically-sorted controller import
block, between `updateTaskDescription` and `updateTaskDueDate`... (alphabetical: `...Description`,
`...DueDate`, `...EstimatedHours`, `...Priority`):

```ts
import updateTaskEstimatedHours from "./controllers/update-task-estimated-hours";
```

and extend the existing `./validate-task-fields` import:

```ts
import {
  nullableEstimatedHoursSchema,
  optionalEstimatedHoursSchema,
  VALID_PRIORITIES,
} from "./validate-task-fields";
```

**6.2 — `POST /:projectId` (~line 175).** Add `estimatedHours: optionalEstimatedHoursSchema,` to
the `validator("json", v.object({...}))`, add `estimatedHours` to the handler destructure, and pass
`estimatedHours,` into the `createTask({...})` call. Update the `describeRoute` description to
`"Create a new task in a project, optionally with an estimate in hours"` (AC-8).

**6.3 — `PUT /:id` (~line 317).** Add `estimatedHours: optionalEstimatedHoursSchema,` to the
`validator("json", ...)`, add `estimatedHours` to the handler destructure, and replace the
positional `updateTask(...)` call with the named-object form from §2.8:

```ts
      const task = await updateTask({
        id,
        title,
        status,
        startDate: parsedStartDate,
        dueDate: parsedDueDate,
        projectId,
        description,
        priority,
        position,
        userId,
        currentUserId,
        estimatedHours,
      });
```

Update the description to `"Update all fields of a task, including its estimated hours"`.

**6.4 — New `PUT /estimated-hours/:id`.** Insert as a new `.put(...)` link **immediately after the
`/due-date/:id` block** (which ends at ~line 615) and before `/title/:id`:

```ts
  .put(
    "/estimated-hours/:id",
    describeRoute({
      operationId: "updateTaskEstimatedHours",
      tags: ["Tasks"],
      description: "Update only the estimated hours of a task",
      responses: {
        200: {
          description: "Task estimated hours updated successfully",
          content: {
            "application/json": { schema: resolver(taskSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({ estimatedHours: nullableEstimatedHoursSchema }),
    ),
    workspaceAccess.fromTask(),
    requireWorkspacePermission({ task: ["update"] }),
    requireEntitlement,
    async (c) => {
      const { id } = c.req.valid("param");
      const { estimatedHours } = c.req.valid("json");
      const currentUserId = c.get("userId");

      const task = await updateTaskEstimatedHours({
        id,
        estimatedHours,
        currentUserId,
      });

      return c.json(task);
    },
  )
```

**6.5 — `POST /import/:projectId` (~line 420).** Add
`estimatedHours: optionalEstimatedHoursSchema,` to the per-task object inside the
`tasks: v.array(v.object({...}))` validator.

### Wiring that requires no packet

- **Typed client / `@kaneo/libs`.** `AppType` propagates the new route automatically.
  `packages/libs/**` is **not in the allowlist** and **no packet may target it**. If codegen finds
  itself wanting to edit `packages/libs/src/hono.ts`, something upstream is wrong.
- **Domain router mount.** `task` is already mounted in `apps/api/src/index.ts`. No change.
- **WebSocket delivery.** `task.updated` is already a member of `ws/index.ts`'s `taskUpdateEvents`
  broadcast array and has **no** activity-row subscriber (its only publisher today is
  `update-task.ts`). Publishing it from the new controller gives the board a realtime refresh with
  **zero new event vocabulary** and **zero writes** to `apps/api/src/ws/**` (all outside the
  allowlist). This is what makes OOS-2 free rather than blocking.
- **TanStack Router.** No new web route. `routeTree.gen.ts` untouched (off-limits).
- **i18n registration.** `i18n/resources.ts` already registers `en-US.json`; it is **not** in the
  allowlist and needs no change.

---

## 7. Config schema — env variables added

**None.** This change reads no new environment variable, adds no feature flag, and introduces no
third-party dependency. `apps/api` reads config straight from `process.env` at module scope with no
central validator, and this run does not alter that (stack profile §Config — do not introduce an
envalid/zod-env layer).

### i18n keys added (the analogous "config contract" for this run)

`i18n/en-US.json` only. Tab-indented, inserted **inside the existing objects**, preserving
surrounding key order. Every locale file other than `en-US.json` is off-limits (OOS-10).

Under `tasks.properties` (next to `noDate`, `startDate`, `title`):

| Key path | English string |
|---|---|
| `tasks.properties.estimatedHours` | `Estimate` |
| `tasks.properties.noEstimate` | `No estimate` |
| `tasks.properties.estimatedHoursValue` | `{{hours}}h` |

New object `tasks.popover.estimatedHours`, inserted **immediately after** `tasks.popover.dueDate`:

| Key path | English string |
|---|---|
| `tasks.popover.estimatedHours.title` | `Estimated hours` |
| `tasks.popover.estimatedHours.placeholder` | `e.g. 2.5` |
| `tasks.popover.estimatedHours.save` | `Save estimate` |
| `tasks.popover.estimatedHours.clear` | `Clear estimate` |
| `tasks.popover.estimatedHours.invalid` | `Enter a number of hours between 0 and 10000.` |
| `tasks.popover.estimatedHours.updateSuccess` | `Estimate updated` |
| `tasks.popover.estimatedHours.updateError` | `Couldn't update the estimate` |

Under `tasks.kanban` (next to `addTask`):

| Key path | English string |
|---|---|
| `tasks.kanban.estimatedHoursBadge` | `{{hours}}h` |
| `tasks.kanban.estimatedHoursTooltip` | `Total estimated hours in this column` |

**Total: 12 new keys. No other key is added, renamed or removed.**

**Namespace note.** `create-task-modal.tsx`'s sibling chips use `common:modals.createTask.*`, but
the new modal chip **reuses `tasks:properties.estimatedHours`,
`tasks:properties.estimatedHoursValue` and `tasks:popover.estimatedHours.placeholder`** rather than
minting duplicates under `common`. `t("tasks:...")` resolves from any component because the
namespace is explicit, and keeping all estimate copy in one place is what prevents the sidebar and
the modal from drifting apart. This is the sole intentional deviation from the surrounding file's
namespace habit.

The `h` suffix lives inside the locale value (`{{hours}}h`), not in JSX, so a future translator can
move or replace it (FR-W9, AC-12).

---

## 8. Testing surface

Test commands are fixed by Gate 0 — `pnpm --filter @kaneo/api test`,
`pnpm --filter @kaneo/api test:integration`, `pnpm --filter @kaneo/web test`, `pnpm typecheck`.
Root `pnpm test` is not used. **No `lint` script** — those run `biome check --write` and modify
unrelated files (NFR-8); use `biome check <changed path>` only.

### 8.1 The strongest available proof — the integration suite executes the real migration

`tests/api-integration/helpers/database.ts` calls `migrate()` from
`drizzle-orm/node-postgres/migrator` against the **`apps/api/drizzle` folder**, creating the target
database if absent and `TRUNCATE`-ing between tests. `tests/api-integration/setup.ts` derives its
own URL: it reads `DATABASE_URL` (env → root `.env` → default), `deriveTestDatabaseUrl()` appends
`_test` to the database name, and `assertTestDatabaseUrl()` **hard-fails** unless the name ends in
`_test`. The repo `.env` points at `kaneo_opus_only` on `:5432`, so the suite targets
**`kaneo_opus_only_test`** and the primary database cannot be touched. It also mocks `dotenv-mono`
so the real `.env` is never loaded into the app under test.

**Consequence: `pnpm --filter @kaneo/api test:integration` runs the newly generated migration for
real, against PostgreSQL, on every run.** That is the verification for AC-1 and NFR-2, and it is a
stronger proof than reading the SQL. Q-5 confirmed PostgreSQL is reachable, so AC-14 **will** be
verified rather than reported unverified. Config: `vitest.integration.config.ts`, `setupFiles:
tests/api-integration/setup.ts`, `fileParallelism: false`, `maxWorkers: 1`.

### 8.2 Existing tests affected

| Test | Effect |
|---|---|
| `tests/api-integration/task.test.ts` (7 existing cases) | Unchanged behavior expected. The existing `toMatchObject` assertions are subset matches, so a new response key does not break them. **This is the AC-2 regression proof: if any existing case fails, NFR-1 is violated.** |
| Any `tests/api/**` file that calls `updateTask` positionally | Must be converted to the named-object call in packet P3. Grep before writing; `pnpm typecheck` is the gate. |
| Any `tests/**` that calls the `createTask` web fetcher positionally | Same. Expected: none. |
| `apps/web/src/components/kanban-board/task-labels.test.tsx` | Untouched; the new badge test mirrors its shape. |

### 8.3 New tests

**`tests/api/task-estimated-hours-validation.test.ts`** (AC-13) — pure Valibot, no DB, no `vi.mock`,
no `vi.stubEnv`. Imports `nullableEstimatedHoursSchema`, `optionalEstimatedHoursSchema` and
`MAX_ESTIMATED_HOURS` from `../../apps/api/src/task/validate-task-fields` and asserts via
`v.safeParse`:

| Input | Expectation |
|---|---|
| `2.5`, `0.25`, `0.5` | `success === true`, value preserved exactly |
| `0` | `success === true`, `output === 0` (D-5: zero is legal, not "unset") |
| `null` | `success === true`, `output === null` (AC-4 clear path) |
| `-1`, `-0.5` | `success === false`, issue message `"Estimated hours cannot be negative"` |
| `Number.POSITIVE_INFINITY`, `Number.NaN` | `success === false` |
| `10001` | `success === false` |
| `10000` | `success === true` (boundary is inclusive) |
| `2.005` | `success === true`, `output === 2.01` (boundary rounding matches `scale: 2`) |
| `undefined` against `optionalEstimatedHoursSchema` | `success === true` |
| `undefined` against `nullableEstimatedHoursSchema` | `success === false` (the single-field route requires the key) |

**`tests/api-integration/task.test.ts`** — one new `describe("API integration: task estimated
hours")` block with its own `beforeEach(resetTestDatabase)`, following the existing file's shape
(`createWorkspaceMember`, `createProjectFixture`, `mockAuthenticatedSession`, `createApp()`,
`app.request("/api/task/...")`):

1. **AC-2** — `POST /api/task/:projectId` **without** `estimatedHours` → `200`, response
   `estimatedHours` is `null`, and the persisted row's `estimatedHours` is `null`.
2. **AC-3** — `POST` with `estimatedHours: 2.5` → `200`, response `2.5`, persisted `2.5` and
   `typeof === "number"` (this is the `mode: "number"` assertion — a regression to
   `mode: "string"` fails here).
3. **AC-4** — `PUT /api/task/estimated-hours/:id` with `{ estimatedHours: 0.5 }` → `200`/`0.5`;
   then `{ estimatedHours: 3.25 }` → `200`/`3.25`; then `{ estimatedHours: null }` → `200`/`null`.
   Set, change, clear, in one case.
4. **AC-5** — `PUT /api/task/estimated-hours/:id` with `{ estimatedHours: -1 }` → `400`, and the
   persisted row is byte-for-byte unchanged (re-read and compare `estimatedHours` to its prior
   value).
5. **D-5** — `PUT /api/task/estimated-hours/:id` with `{ estimatedHours: 0 }` → `200`, persisted
   `0`, **not** `null`. Guards against a falsy-check regression.
6. **AC-6** — a user outside the workspace (the existing outsider pattern in this file, which
   asserts `403` + `"You don't have access to this workspace"`) → rejected, row unchanged.
   *Additionally*, if `@kaneo/permissions` ships a built-in read-only workspace role, add a second
   case with `createWorkspaceMember({ role: <that role> })` asserting the
   `requireWorkspacePermission({ task: ["update"] })` rejection. If no such built-in exists, the
   outsider case alone satisfies AC-6 and the run **reports that plainly** rather than inventing a
   role.
7. **AC-7 / the §1 unmissable item** — `GET /api/task/tasks/:projectId` after setting an estimate:
   locate the task inside `data.columns[].tasks` and assert `estimatedHours` is present with the
   set value. **This is the assertion that catches a missing `taskSelection` entry**, and without
   it the whole rollup silently reads `undefined`.
8. **NFR-1 / whole-task PUT** — set an estimate via the single-field route, then send a
   `PUT /api/task/:id` **without** `estimatedHours` (simulating a kanban drag), and assert the
   estimate **survives**. This is the regression test for the conditional `.set()` in §2.8 and is
   the single most likely silent bug in this change.

**`apps/web/src/lib/estimated-hours.test.ts`** — pure, no render:
- `sumEstimatedHours([])` → `0`
- `sumEstimatedHours([{estimatedHours: 2.5}, {estimatedHours: null}, {}, {estimatedHours: 0.25}])`
  → `2.75` (missing and null contribute 0 — FR-W6)
- `sumEstimatedHours([{estimatedHours: 0.1}, {estimatedHours: 0.2}])` → **exactly** `0.3`
  (the float-artifact guard)
- `sumEstimatedHours([{estimatedHours: 0}, {estimatedHours: 0}])` → `0`
- `parseEstimatedHoursInput("")` / `("   ")` → `{ ok: true, value: null }`
- `parseEstimatedHoursInput("0")` → `{ ok: true, value: 0 }`
- `parseEstimatedHoursInput("2.5")` → `{ ok: true, value: 2.5 }`
- `parseEstimatedHoursInput("-1")` / `("abc")` / `("10001")` → `{ ok: false }`

**`apps/web/src/components/kanban-board/column/column-estimated-hours-badge.test.tsx`** (AC-15) —
mirrors `task-labels.test.tsx` exactly (`@testing-library/react`, explicit `vitest` imports,
`afterEach(cleanup)`), with **one addition**: `import "@/lib/i18n";` at the top, because
`apps/web/src/test/setup.ts` only loads `@testing-library/jest-dom/vitest` and is **outside the
allowlist** so it cannot be extended. Importing `@/lib/i18n` initializes the real i18next instance
with the real `en-US` resources via the `@i18n` alias already configured in
`apps/web/vitest.config.ts`.

| Case | Assertion |
|---|---|
| sum | `tasks=[{estimatedHours:2.5},{estimatedHours:1.5}]` → `screen.getByText("4h")` |
| mixed / no-estimate contributes 0 | `[{estimatedHours:2.5},{estimatedHours:null},{}]` → `"2.5h"` |
| zero total, tasks present | `[{estimatedHours:0},{estimatedHours:0}]` → `queryByText(/h$/)` is `null` (AC-10) |
| no estimates at all | `[{},{}]` → component renders `null`; container is empty — the column header is identical to today |
| fractional sum | `[{estimatedHours:0.1},{estimatedHours:0.2}]` → `"0.3h"`, never `"0.30000000000000004h"` |

### 8.4 What is *not* newly tested, and why

- The sidebar popover and the create-task modal chip are verified by the AC-9 manual/browser pass,
  not by a new component test. Both pull in TanStack Query, Zustand stores and workspace-permission
  hooks whose test harness does not exist in this repo, and building one is outside this delta.
  The mutation path they drive is covered end-to-end by integration case 3.
- `ColumnHeader` itself is not rendered in a test — it drags in `useProjectStore`, `useUpdateTask`
  and `CreateTaskModal`. Extracting `ColumnEstimatedHoursBadge` is precisely what makes AC-15
  achievable without that harness.

### 8.5 Verification order

`pnpm --filter @kaneo/api test` → `pnpm --filter @kaneo/api test:integration` →
`pnpm --filter @kaneo/web test` → `pnpm typecheck` → `biome check` on the changed paths only.

---

## 9. Off-limits reminders

The intent brushes against several off-limits paths. None of them needs a write, but each is close
enough to name:

1. **`apps/api/src/mcp/tools.ts`** — off-limits (OOS-3). If MCP task tools reuse `getTask` /
   `getTasks`, their responses will gain the `estimatedHours` key additively. That is expected and
   requires **no edit**; MCP callers simply cannot *set* the field. AC-18 verifies MCP reads still
   function. **No packet may target this file.**
2. **`apps/api/src/schemas.ts` → `activitySchema`.** The `type` picklist must **not** gain
   `estimated_hours_changed` or any other member. Adding one would require
   `apps/api/src/activity/**`, `apps/api/src/ws/**`,
   `apps/api/src/search/controllers/global-search.ts` and `apps/web/src/components/activity/**` —
   none allowlisted. The change rides `task.updated` instead (OOS-2, §6). The file *is*
   allowlisted, so this is a discipline reminder, not a mechanical guard.
3. **`apps/api/src/project/controllers/get-projects.ts`** — allowlisted but deliberately untouched
   (OOS-6). Re-stated in §2 because its allowlisted status makes it the most likely accidental
   target.
4. **`apps/web/src/components/public-project/kanban-view.tsx`** — off-limits (OOS-11). **Verified
   safe by inspection:** `PublicKanbanView` renders its own inline column header (its own
   `getColumnIcon` + `column.tasks.length` span) and does **not** import `ColumnHeader`. Editing
   `ColumnHeader` therefore cannot leak the rollup onto public boards. The public board's task
   payload will still gain the `estimatedHours` key, which the PII inventory classifies as
   non-personal planning metadata inheriting the project's existing public/private decision —
   flag it for the security review, do not fix it here.
5. **`apps/web/src/components/kanban-board/task-card.tsx`** — allowlisted, but OOS-12/D-7 resolved
   to skip. Not edited.
6. **`packages/libs/**`** — not in the allowlist. Types propagate via `AppType`. No packet.
7. **`apps/web/src/routeTree.gen.ts`**, **`apps/api/drizzle/meta/**` hand-edits**,
   **`pnpm-lock.yaml`** — never written by hand. `drizzle/meta/` is written only as a side effect
   of `db:generate`.
8. **`apps/web/src/test/setup.ts`** — not in the allowlist; the badge test compensates with a local
   `import "@/lib/i18n";` (§8.3).
9. **`i18n/*.json` other than `en-US.json`, and `i18n/schema.json`** — off-limits (OOS-10). Adding
   12 keys to `en-US.json` alone **may make `pnpm i18n:check` report the 16 other locales as
   missing those keys**. Per NFR-6 that is a **reportable finding for the final report — never a
   licence to edit an off-limits locale file, and never a reason to widen the write contract.**
   The run must state explicitly whether `i18n:check` treats it as a hard failure or a warning.
10. **`.env` / `.env.*`** — off-limits, and untouched: the integration harness derives its own
    `_test` database URL and mocks `dotenv-mono` (§8.1). No env change is needed or permitted.
11. **`AGENTS.md` / `CLAUDE.md` / `.claude/**`** — off-limits. This change surfaces no recurring
    failure mode that would justify updating the agent guide.

---

## 10. Cross-cutting sequencing

Strict packet order. Each dependency is a hard one — running out of order produces a failing
typecheck, a failing migration, or a silently empty rollup.

| # | Packet | Contents | Must run after | Why |
|---|---|---|---|---|
| **P1** | Data + shared validation | `schema.ts` (2.1), `schemas.ts` (2.2), `validate-task-fields.ts` (2.3), then run `pnpm --filter @kaneo/api db:generate` and inspect the SQL (§4) | — | **Nothing else can exist first.** The column must be in the Drizzle schema before any controller can reference `taskTable.estimatedHours`, and the Valibot schemas must exist before any route imports them. The migration must exist before the integration suite can pass, because `helpers/database.ts` runs `migrate()` against `apps/api/drizzle` on every run (§8.1). |
| **P2** | API read surfaces | `get-tasks.ts` (2.4), `get-task.ts` (2.5), `export-tasks.ts` (2.6) | P1 | Needs `taskTable.estimatedHours`. **Must precede all web work** — the board payload has to carry the field before the rollup can sum anything. |
| **P3** | API write controllers | new `update-task-estimated-hours.ts`, `create-task.ts` (2.7), `update-task.ts` (2.8 signature conversion), `import-tasks.ts` (2.9) + any `tests/**` direct callers of `updateTask` | P1 | Needs the column and `publishEvent`. The `updateTask` signature change and its call-site fix are split across P3/P4 and are only compilable together — run them back to back and typecheck once at the end of P4. |
| **P4** | **Route wiring (framework-owned, paired)** | `apps/api/src/task/index.ts` — all five edits of §6 in a single write | P3 | The controller import, the new route link, the `POST`/`PUT` validator changes and the named-object `updateTask({...})` call must land together. Splitting them leaves the file uncompilable. **Gate: `pnpm typecheck` must pass here before any web packet starts** — this is what proves the `AppType` contract that P7's fetcher depends on. |
| **P5** | API tests | `tests/api/task-estimated-hours-validation.test.ts`, `tests/api-integration/task.test.ts` (2.19) | P4 | The integration cases exercise the live route; the unit test needs P1's exported schemas. **Gate: `pnpm --filter @kaneo/api test` and `test:integration` must both pass here.** This is where AC-1, AC-2, AC-14 and NFR-2 are actually proven, and it is the last point at which a migration or contract problem is cheap to fix. |
| **P6** | Web types + shared helpers | `types/task/index.ts` (2.11), `lib/format.ts` (2.12), new `lib/estimated-hours.ts`, `lib/estimated-hours.test.ts` | P4 | Needs the API contract frozen. Everything in P7–P9 imports from here, so it goes first among web packets. |
| **P7** | Web data layer | new `fetchers/task/update-task-estimated-hours.ts`, `fetchers/task/create-task.ts` (2.13), `fetchers/task/update-task.ts` (2.15), new `hooks/mutations/task/use-update-task-estimated-hours.ts`, `hooks/mutations/task/use-create-task.ts` (2.14) | P4, P6 | `client.task["estimated-hours"][":id"].$put` only typechecks once P4's route exists and `AppType` has propagated. `CreateTaskRequest` only gains `estimatedHours` from P4's validator. |
| **P8** | i18n | `i18n/en-US.json` (§7, 12 keys) | — (independent) | Has no code dependency, but **must precede P9**: every string P9 renders resolves through these keys, and a missing key surfaces as the raw key text in P10's assertions. |
| **P9** | Web UI | new `components/task/task-estimated-hours-popover.tsx`, `task-properties-sidebar.tsx` (2.16), new `kanban-board/column/column-estimated-hours-badge.tsx`, `column-header.tsx` (2.17), `shared/modals/create-task-modal.tsx` (2.18) | P6, P7, P8 | Needs the type, the helpers, the formatter, the hook and the keys. `column-header.tsx` must come after the badge component exists in the same packet. |
| **P10** | Web tests | `column-estimated-hours-badge.test.tsx` | P8, P9 | The i18n assertions (`"4h"`, `"2.5h"`) only pass with P8's keys present. **Gate: `pnpm --filter @kaneo/web test` and a final repo-wide `pnpm typecheck`.** |

### The three hard sequencing facts, restated

1. **P1 before everything.** The generated migration must exist before P5's integration suite runs,
   because that suite applies `apps/api/drizzle/**` for real on every invocation.
2. **P2 before P6–P10.** The API must *return* the field before the web can *sum* it. A web packet
   that lands first produces a rollup that silently reads `undefined` on every task, sums to `0`,
   and hides the badge — a green test suite with a dead feature.
3. **P4 before P7.** The typed client is generated from `AppType`. The web fetcher cannot typecheck
   against a route that does not yet exist, and there is no manual client file to edit as a
   workaround.

### Rollback

Anchor `5d1fc910` on `feature-extend-2/opus-sonnet`. Every packet is additive or a contained
signature change; `git checkout` of the listed paths plus deletion of the generated
`0043_*` migration and its `meta/` snapshot returns the tree to baseline. The migration has not been
applied to any non-`_test` database at any point.

# Change Plan — Task `estimatedHours` + per-column rollup

- **Run:** `20260824-042617-feature-extend-task-hours`
- **Mode / intent:** brownfield / feature-extend
- **Base commit:** `5d1fc910`  ·  **Branch:** `feature-extend-2/opus-flash`
- **Policy:** `opus-plus-flash-v37`  ·  **Phase:** `change_plan` (the brownfield analog of `architecture_design`)

## How this document was produced

The first attempt at this phase (`tp_design_001`, one dispatch, ceiling 14,000) died on the
`claude-cli` adapter's hard 300 s timeout with zero output and zero cost. That adapter passes no
max-tokens flag, so `budget.maxOutputTokens` is inert and the ceiling-doubling retry cannot fire —
a retry of the same packet would have failed the same way. The phase was therefore re-run as three
sequential, surface-partitioned dispatches (`tp_design_001a/b/c`), each of which completed well
inside the timeout. Parts 1-3 below are those three outputs, assembled in order; later parts
consume earlier parts' decisions verbatim.

## Decision summary

| ID | Question | Decision |
|---|---|---|
| DR-1 | Rollup computed where? | **Client-side** — header sums the filter-narrowed `column.tasks`; no server aggregate |
| DR-2 | Column type | **`integer`**, whole hours, nullable, no default |
| DR-3 | Accepted range | **0..1000 inclusive, integers**, enforced by Valibot → HTTP 400 |
| DR-4 | Editing surfaces | create-task modal + task-properties sidebar (both layout branches) + new shared input & popover under `components/task/` |
| DR-5 | Update semantics | **Preserve-on-omit**; explicit `null` clears; never `\|\|` on this field |
| DR-6 | Rollup presentation | Second pill beside the count pill; `role="img"` + `aria-label`; three states via text + `data-estimate-state` + accessible name, never colour alone |

---

## Part 1 — Cross-cutting decisions, database, API contract

Scope of this part: the decision register, the `taskTable` column and its migration, and the API contract (Valibot validators, OpenAPI `taskSchema`, the four task controllers, and the MCP full-body builder). Web types, fetchers, hooks, editing surfaces, column-header rendering, i18n, and the test plan are owned by Parts 2 and 3 and are deliberately absent here.

The field is named `estimatedHours` in TypeScript and `estimated_hours` in PostgreSQL throughout.

---

### 1. Decision register (binding; Parts 2 and 3 consume these verbatim)

#### DR-1 — Rollup placement: **CLIENT-SIDE**

**Decision.** The per-column total is computed in the web layer by summing `estimatedHours` over `column.tasks` at render time. No aggregate field is added to the get-tasks column shape; `apps/api/src/task/controllers/get-tasks.ts` lines 224-237 are **not** modified. The API's only obligation is that every task object it returns carries `estimatedHours`.

**Reasoning.** The board fetcher sends no pagination params, so `paginatedTasks` is the complete task set for the project and a client-side sum is complete, not a sample. `ColumnHeader` already renders `{column.tasks.length}` — the *filtered* count — from the same filter-narrowed array. Summing that same array makes the total and the count pill two projections of one list, so they cannot disagree. It also satisfies the "no extra request per column" constraint trivially: zero new requests, zero new query cost, no new aggregate SQL.

**Failure mode of the rejected option (server-side aggregate).** A server-computed sum is filter-insensitive. With a filter or search active, `useTaskFiltersWithLabelsSupport` narrows `column.tasks` to, say, 2 of 9 tasks; the count pill reads `2` while the adjacent server total still reflects all 9. Two numbers sourced from different populations sit inches apart in the same header and contradict each other, with no affordance telling the user which one is scoped. That is a permanent, unfixable-without-rework correctness bug in the UI. Secondary: the board read route `GET /api/task/tasks/:projectId` is guarded by `workspaceAccess.fromProject` only, with no `requireWorkspacePermission`, so a server aggregate would inherit that weaker read guard as a new first-class exposed field. Client-side keeps the exposure identical to the per-task data already crossing that boundary.

#### DR-2 — Column type: **`integer` (whole hours)**

**Decision.** `integer("estimated_hours")`, nullable, no default. Whole hours only. No fractional input, no rounding rules needed, because no rounding ever occurs: an integer sum of integers is exact.

**Reasoning.** The Drizzle schema uses `integer()` at all 17 numeric sites and has never introduced `numeric`/`real`/`decimal`. The closest existing analogue — `timeEntryTable.duration` — stores a quantity of time as an `integer`. Matching that keeps one numeric idiom across the schema and keeps the estimate coarse, which suits a planning number that is a guess to begin with.

**Failure mode of the rejected option (`numeric`/`real`).** `real` is binary floating point: summing `0.1`-style estimates across a column produces drift (`2.9000000000000004`), which then has to be masked by display rounding, and a rounded total that does not equal the visible per-card values invites bug reports. `numeric` avoids the drift but arrives over JSON as a **string** in `pg`, silently changing the shape of `taskSchema`, the typed client, and every consumer — including the client-side sum, where `+` would concatenate rather than add. Either choice sets a first-of-its-kind precedent that every future numeric column has to relitigate. Accepted cost: a user who wants 90 minutes must record `1` or `2`. That is a real limitation and is stated as such in the field's help text (Part 2).

#### DR-3 — Range: **integer, `0 <= estimatedHours <= 1000`, enforced by Valibot**

**Decision.** Minimum 0, maximum 1000, integers only, rejected at the validator with HTTP 400 before any controller or database work.

**Reasoning.** The hard ceiling from DR-2 is `int4`'s 2,147,483,647; the soft ceiling is product judgement. 1000 hours is roughly six months of full-time work on a single task — far beyond any legitimate estimate for one card, while leaving generous headroom for coarse epic-sized entries. 0 is permitted so "estimated, and it is nothing" is expressible and distinct from `null` ("not estimated"). Negative values are meaningless and rejected. Because Hono's `validator("json", ...)` runs before the route handler, an out-of-range value never reaches `db.insert`/`db.update`.

**Failure mode of the rejected option (no bound / bound only at the DB).** With no Valibot bound, `2147483648` reaches PostgreSQL and raises `integer out of range` — a 500 with a driver-shaped message, not a 400 with a field-scoped one, violating the convention that expected HTTP failures use `HTTPException` and are surfaced as validation errors. A bound of only `int4`'s ceiling would still let `999999` through and silently poison every column total on the board.

#### DR-5 — Update semantics: **PRESERVE-ON-OMIT; explicit `null` clears** (highest-risk item)

**Decision.** On `PUT /:id`, `estimatedHours` is `v.optional(v.nullable(...))`:

- **omitted (`undefined`)** — the field is **not included in the `.set()` object at all**; the stored value is untouched.
- **explicit `null`** — the estimate is cleared.
- **number in range** — the estimate is set.

This is implemented by building the update values object first and conditionally assigning the key, **not** by the `x || null` pattern on lines 60-61 of `update-task.ts`. Those two lines are left exactly as they are — changing date semantics is out of scope for this run.

**Reasoning.** Three named callers issue a full PUT without knowledge of this field:

1. `apps/web/src/fetchers/task/update-task.ts` — a fixed body used by `useUpdateTask`, reached from drag-and-drop (**every card move**) and from column-header archive-all.
2. `apps/api/src/mcp/tools.ts` `buildFullTaskUpdateBody` — reconstructs a full body from a hand-picked field list.
3. `create-task-modal.tsx` draft promotion — spreads the draft into `updateTask({...draftTask})` and re-enters the same fetcher.

Preserve-on-omit makes all three non-destructive by construction, independent of whether they are ever taught about the field. Part 2 still adds `estimatedHours` to the web fetcher body so the UI can set and clear it, and §5 below patches `buildFullTaskUpdateBody` — but neither is load-bearing for data safety. Correctness does not depend on every caller being found.

**Failure mode of the rejected option (`estimatedHours || null`, copying lines 60-61).** Dragging a card between columns issues a full PUT whose body has no `estimatedHours`; the coercion writes `null`; the estimate is silently destroyed by an unrelated gesture, with no error and no undo. Every MCP update and every draft promotion does the same. `update-task.ts` already carries an in-code comment about a prior bug of exactly this shape (the priority empty-string incident) — this is that bug's second draft, and it is rejected. Note also that `||` is wrong for `0` even in the set path: `0 || null` is `null`, so a legitimate zero estimate would erase itself. All coercions for this field use `??`, never `||`.

#### Planned vs. actual — reconciliation (no new subsystem)

`estimatedHours` is **planned** time: a single user-entered scalar on the task, nullable, changed only by an explicit edit. `timeEntryTable.duration` is **actual** logged time: materialised from start/stop timers, one-to-many per task, defaulting to `0`. They are deliberately independent — no foreign key, no derivation, no trigger, no automatic comparison, and no "remaining" field in either direction. `estimatedHours` is never computed from time entries and never written by the time-entry code paths. `apps/api/src/time-entry/` is not modified by this run. `duration` is cited only as the existing precedent that this codebase stores a quantity of time as an `integer` (DR-2). Any future estimate-vs-actual variance surface is out of scope and, if wanted, is a separate feature over both fields.

#### Authorization — unchanged

No new permission action. Create continues to use `requireWorkspacePermission({ task: ["create"] })`; update continues to use `requireWorkspacePermission({ task: ["update"] })` plus `requireTaskAssigneePermission` and `requireEntitlement`. `estimatedHours` is task data and inherits exactly the guards already on the task it lives on. Because DR-1 chose client-side, the weakly-guarded board read route gains no new aggregate field; it returns `estimatedHours` per task alongside the title, priority, and dates it already returns to the same audience.

---

### 2. Database

#### 2.1 Schema column

**File:** `apps/api/src/database/schema.ts` — `taskTable` column block.

**Anchor:** the line `dueDate: timestamp("due_date", { mode: "date" }),` inside `taskTable` (immediately before `createdAt`).

**Replacement:**

```ts
    dueDate: timestamp("due_date", { mode: "date" }),
    estimatedHours: integer("estimated_hours"),
```

`integer` is already imported in this file. The column is **nullable** and has **no default**: `null` means "not estimated" and is distinct from `0` ("estimated at nothing"), which DR-3 permits. A `.default(0)` would destroy that distinction and would make every pre-existing task claim an estimate it never received.

**No new index.** DR-1 does the rollup client-side, so the column is never a `WHERE` or `ORDER BY` target; an index would be pure write cost. The table's five existing indexes and the `task_project_number_unique` constraint are untouched.

#### 2.2 Migration

The migration is **generated**, never hand-authored:

```
pnpm --filter @kaneo/api db:generate
```

Inspect the emitted SQL and commit it with the schema change. It must contain exactly one additive statement and nothing else:

```sql
ALTER TABLE "task" ADD COLUMN "estimated_hours" integer;
```

Required properties, to be confirmed by reading the generated file before committing:

- **Additive only.** No `DROP`, no `ALTER COLUMN` on any existing column, no index or constraint changes. If `db:generate` emits anything beyond the single `ADD COLUMN`, the schema edit drifted from the checked-in snapshot and must be reconciled before the migration is accepted.
- **Nullable, no default, no `NOT NULL`.** Combined, these make the statement a metadata-only operation in PostgreSQL: it takes a brief `ACCESS EXCLUSIVE` lock and returns without rewriting the table, so it is safe on a populated production `task` table regardless of row count.
- **No backfill.** Existing rows get `NULL`, which is the correct semantic ("not estimated") — not a data gap to be filled. A backfill `UPDATE` would be both wrong and a full-table rewrite.
- **Forward-compatible with running instances.** An older API pod that does not know the column continues to work: its `INSERT`s name their columns explicitly, so the new nullable column simply takes `NULL`.

> **Repo-specific follow-up (from `.sdlc/CLAUDE-SDLC.md`):** `db:generate` writes `apps/api/drizzle/meta/_journal.json` and `meta/<n>_snapshot.json` with 2-space indentation while `biome.json` sets `indentStyle: "tab"` for JSON, and `apps/api/drizzle/**` is not excluded from Biome discovery. After generating, run
> `npx biome format --write apps/api/drizzle/meta/_journal.json apps/api/drizzle/meta/<n>_snapshot.json`
> or `npx biome ci .` — the first CI job — goes red. Do not attempt to fix it by re-running `db:generate`.

---

### 3. API contract — OpenAPI response schema

**File:** `apps/api/src/schemas.ts`

**Anchor:** in `taskSchema`, the line `dueDate: v.optional(v.date()),`.

**Replacement:**

```ts
  dueDate: v.optional(v.date()),
  estimatedHours: v.nullable(v.number()),
```

`v.nullable(v.number())`, not `v.optional(...)`: the field is always present in create/get/update responses and is `null` when unset, so the advertised shape must say so. This deliberately does not compound the existing drift in which `taskSchema` omits `assigneeName`, `assigneeImage`, and `updatedAt` from the real payload — the new field is documented accurately from day one. That pre-existing drift is left alone; correcting it is not part of this change.

> **Repo-specific constraint (from `.sdlc/CLAUDE-SDLC.md`):** do **not** regenerate `apps/docs/openapi.json`. That file is roughly 11 route-groups stale and regenerating it currently produces ~1,481 insertions / 166 deletions of unrelated churn. The contract gap is documented and deferred; a spec-freshness check is its own ticket.

---

### 4. API contract — routes and controllers

#### 4.1 Shared validator constant

**File:** `apps/api/src/task/index.ts`

**Anchor:** immediately after the `VALID_PRIORITIES` declaration at module scope.

**Insert:**

```ts
const ESTIMATED_HOURS_MAX = 1000;

// DR-3: bounded here so an out-of-range value is a 400 from the validator,
// never an "integer out of range" error from PostgreSQL.
// DR-5: optional means "omitted"; nullable means "explicitly cleared".
const estimatedHoursValidator = v.optional(
  v.nullable(
    v.pipe(
      v.number(),
      v.integer("estimatedHours must be a whole number of hours"),
      v.minValue(0, "estimatedHours must be 0 or greater"),
      v.maxValue(
        ESTIMATED_HOURS_MAX,
        `estimatedHours must be ${ESTIMATED_HOURS_MAX} or less`,
      ),
    ),
  ),
);
```

One constant, used by both bodies, so create and update can never diverge on the accepted range.

#### 4.2 Create route — `POST /:projectId`

**Anchor:** the `validator("json", ...)` object on the create route, line `userId: v.optional(v.string()),`.

**Replacement:**

```ts
      userId: v.optional(v.string()),
      estimatedHours: estimatedHoursValidator,
```

**Anchor:** the handler's destructure and `createTask` call.

**Replacement:**

```ts
      const {
        title,
        description,
        startDate,
        dueDate,
        priority,
        status,
        userId,
        estimatedHours,
      } = c.req.valid("json");
```

and

```ts
      const task = await createTask({
        projectId,
        currentUserId: c.get("userId"),
        userId,
        title,
        description,
        startDate: parsedStartDate,
        dueDate: parsedDueDate,
        priority,
        status,
        estimatedHours,
      });
```

The middleware chain (`workspaceAccess.fromProject`, `requireWorkspacePermission({ task: ["create"] })`, `requireEntitlement`) and the `describeRoute` block are unchanged; the response schema already picks up the new field via `taskSchema`.

#### 4.3 Update route — `PUT /:id`

**Anchor:** the `validator("json", ...)` object on the update route, line `userId: v.optional(v.string()),`.

**Replacement:**

```ts
      userId: v.optional(v.string()),
      estimatedHours: estimatedHoursValidator,
```

**Anchor:** the handler's destructure and `updateTask` call.

**Replacement:**

```ts
      const {
        title,
        description,
        startDate,
        dueDate,
        priority,
        status,
        projectId,
        position,
        userId,
        estimatedHours,
      } = c.req.valid("json");
```

and

```ts
      const task = await updateTask(
        id,
        title,
        status,
        parsedStartDate,
        parsedDueDate,
        projectId,
        description,
        priority,
        position,
        userId,
        currentUserId,
        estimatedHours,
      );
```

Because the validator is `v.optional(...)`, a body that omits `estimatedHours` yields `undefined` here, which §4.5 turns into "do not touch the column". The handler stays thin: it validates and forwards, and does not decide preserve-vs-clear itself.

#### 4.4 `create-task.ts` controller

**File:** `apps/api/src/task/controllers/create-task.ts`

**Anchor:** the function signature and its inline parameter type.

**Replacement:**

```ts
async function createTask({
  projectId,
  currentUserId,
  userId,
  title,
  status,
  startDate,
  dueDate,
  description,
  priority,
  estimatedHours,
}: {
  projectId: string;
  currentUserId: string;
  userId?: string;
  title: string;
  status: string;
  startDate?: Date;
  dueDate?: Date;
  description?: string;
  priority?: string;
  estimatedHours?: number | null;
}) {
```

**Anchor:** inside `tx.insert(taskTable).values({ ... })`, the line `dueDate: dueDate || null,`.

**Replacement:**

```ts
      dueDate: dueDate || null,
      estimatedHours: estimatedHours ?? null,
```

`??`, not `||`: `0 || null` is `null`, which would silently discard a legitimate zero-hour estimate. The `returning()` row therefore carries `estimatedHours`, so the `task.created` event payload (`{ ...createdTask, ... }`) and the HTTP response both include it with no further change.

#### 4.5 `update-task.ts` controller — the DR-5 implementation

**File:** `apps/api/src/task/controllers/update-task.ts`

**Anchor:** the end of the positional parameter list.

**Replacement:**

```ts
  userId?: string,
  currentUserId?: string,
  estimatedHours?: number | null,
) {
```

Appended last so no existing call site breaks. `undefined` = omitted (preserve), `null` = clear, number = set.

**Anchor:** the entire `const [updatedTask] = await db.update(taskTable).set({ ... })` statement.

**Replacement:**

```ts
  const updateValues: Partial<typeof taskTable.$inferInsert> = {
    title,
    status,
    columnId: column?.id ?? null,
    startDate: startDate || null,
    dueDate: dueDate || null,
    projectId,
    description,
    priority,
    position,
    userId: userId || null,
  };

  // DR-5: preserve-on-omit. Full-PUT callers that never mention estimatedHours
  // (drag-and-drop, archive-all, MCP, draft promotion) must not erase it, so the
  // key is only written when the caller sent one. Do NOT copy the `x || null`
  // shape used by startDate/dueDate above -- that is the priority-empty-string
  // bug in a new field, and `0 || null` would also destroy a valid zero estimate.
  if (estimatedHours !== undefined) {
    updateValues.estimatedHours = estimatedHours;
  }

  const [updatedTask] = await db
    .update(taskTable)
    .set(updateValues)
    .where(eq(taskTable.id, id))
    .returning();
```

Everything after this point in the function — the 404/500 guards, the `task.status_changed` / `task-relation.refresh` / `task.updated` events, and `deleteOrphanedAssets` — is unchanged. `estimatedHours` drives no event: it is not a status transition and needs no activity entry in this run. The returned row carries the field for the HTTP response either way.

#### 4.6 `get-task.ts` — single task read

**File:** `apps/api/src/task/controllers/get-task.ts`

**Anchor:** in the `db.select({ ... })` object, the line `startDate: taskTable.startDate, dueDate: taskTable.dueDate, position: taskTable.position,`.

**Replacement:**

```ts
      startDate: taskTable.startDate,
      dueDate: taskTable.dueDate,
      estimatedHours: taskTable.estimatedHours,
      position: taskTable.position,
```

Without this the task-detail surface reads `undefined` and an edit round-trip would submit a cleared value.

#### 4.7 `get-tasks.ts` — board payload

**File:** `apps/api/src/task/controllers/get-tasks.ts`

**Anchor:** in the `taskSelection` object, the line `startDate: taskTable.startDate, dueDate: taskTable.dueDate, position: taskTable.position,`.

**Replacement:**

```ts
    startDate: taskTable.startDate,
    dueDate: taskTable.dueDate,
    estimatedHours: taskTable.estimatedHours,
    position: taskTable.position,
```

This is the single line the whole feature rests on: DR-1's client-side rollup sums exactly what this selection returns. **The column shape at lines 224-237 is not modified** — no aggregate field is added, per DR-1.

**Trap, called out for the Part 3 test plan:** `ProjectWithTasks` overrides `columns[].tasks` with the hand-written web `Task` type, so omitting `estimatedHours` from `taskSelection` will **not** fail typecheck anywhere. The board would compile cleanly and every column total would render as `0` or `NaN` at runtime. Only a runtime or integration assertion against the real `body.data.columns[].tasks[]` payload catches it, and Part 3 must include one.

---

### 5. MCP — `buildFullTaskUpdateBody`

**File:** `apps/api/src/mcp/tools.ts`

This function performs a read-modify-write: it reconstructs a full PUT body from an existing task plus a patch. DR-5 already makes omission non-destructive at the controller, so this change is about capability (MCP can set and clear the estimate) rather than data safety.

**Anchor:** the function's return type annotation.

**Replacement:**

```ts
function buildFullTaskUpdateBody(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, string | number | null | undefined> {
```

`null` is added to the value union so an explicit clear is representable.

**Anchor:** the two `formatOptionalIso` lines for `startDate` / `dueDate`.

**Insert immediately after them:**

```ts
  const estimatedHoursRaw =
    patch.estimatedHours !== undefined
      ? patch.estimatedHours
      : existing.estimatedHours;
  const estimatedHours =
    estimatedHoursRaw === null
      ? null
      : typeof estimatedHoursRaw === "number"
        ? estimatedHoursRaw
        : undefined;
```

**Anchor:** the `const body: Record<string, string | number | undefined> = {...}` declaration and the trailing conditional assignments.

**Replacement:**

```ts
  const body: Record<string, string | number | null | undefined> = {
    title,
    description,
    status,
    priority: priorityRaw,
    projectId,
    position,
  };
  if (startDate !== undefined) body.startDate = startDate;
  if (dueDate !== undefined) body.dueDate = dueDate;
  if (userId !== undefined) body.userId = userId;
  if (estimatedHours !== undefined) body.estimatedHours = estimatedHours;
  return body;
```

Behaviour: a patch that omits `estimatedHours` forwards the existing value, so an MCP update of an unrelated field preserves the estimate; `patch.estimatedHours === null` sends `null` and clears it; a number in range sets it, and one out of range is rejected as a 400 by §4.1's validator rather than being coerced here. The non-numeric, non-null fallback to `undefined` means a malformed `existing` degrades to omission — which DR-5 makes a no-op — rather than to an erase.

**Follow-up, not done this run:** `packages/mcp` (the published stdio package) is off-limits here. If its tool schemas expose task fields explicitly, it needs `estimatedHours` added to accept and return the field; record it as a follow-up item rather than editing it.

---

## Part 2 — Web delta layer

This part covers the web data layer and the task-editing surfaces only. Column-header rollup rendering, i18n string definitions, and the test plan are Part 3.

### 4.0 Correction to requirements.md §7 (R-7)

R-7 recorded two write-contract gaps. Both are factually wrong against `.sdlc/local/write-contract.json` and are corrected here; the design proceeds on the corrected facts, and no operator action is required for either.

- **G-1 is FALSE.** The contract does not hold a `create-task-modal/**` directory pattern. It lists the literal file `apps/web/src/components/shared/modals/create-task-modal.tsx` (and its `.test.tsx` sibling). The modal **is** writable.
- **G-2 is FALSE.** `apps/web/src/fetchers/task/**` **is** allowlisted as a whole-directory glob, so new fetcher files are permitted. The dedicated single-field fetcher on the `update-task-due-date` pattern is therefore *available*; §4.1 rejects it on the merits, not on contract grounds.

### 4.1 DR-4 — which editing surfaces expose `estimatedHours`

| # | Candidate | Decision | Reason |
|---|---|---|---|
| 1 | `components/shared/modals/create-task-modal.tsx` | **IN** | The only create path, and the draft-promotion path is the only way a pasted-image task reaches its final field values. A field absent here can never be set at creation. Writable (literal file). |
| 2 | `components/task/task-properties-sidebar.tsx` | **IN** (both layout branches) | The task-detail properties rail is the canonical edit-after-create surface for every other optional field. Writable under `components/task/**`. |
| 3 | New `components/task/task-estimated-hours-popover.tsx` | **IN** (new file) | Follows the `task-due-date-popover` structural idiom: popover + permission gate + toast. Writable under `components/task/**`, new files permitted. |
| 3b | New dedicated fetcher + hook + `PUT /estimated-hours/:id` | **OUT** | Requirements §2 item 8 puts a new dedicated endpoint out of scope, and Part 1 added the field to the existing full-PUT route only. A dedicated fetcher with no dedicated endpoint would be a wrapper around the same full PUT — cost without benefit. The popover therefore calls the existing `useUpdateTask`. |
| 4 | Kanban card (`components/kanban-board/...`) | **OUT** | Display-only surface, not an editing surface. `column-dropzone.tsx` is explicitly off-limits; nothing in this part touches drop behaviour. |
| 5 | List / table view | **OUT** | Not in the allowlist, and inline-editing a numeric cell is a separate interaction problem. Values set elsewhere still render there once the field is on the query response. |

**Cost of routing the sidebar edit through the full PUT.** `update-task.ts` sends a fixed body (`userId`, `title`, `description`, `status`, `priority`, `startDate`, `dueDate`, `position`, `projectId`). Editing one number therefore re-sends eight other fields, re-applies the `priority || "no-priority"` coercion, and publishes `task.updated` with a full-update payload. Accepted: it is the same body drag-and-drop already sends on every card move, so the blast radius is not new. The mitigation is that the popover spreads the whole cached `Task` (`{ ...task, estimatedHours: value }`) so no field is silently narrowed.

**Permission gating.** Sidebar/popover gate on `canUpdateTasks()`; the modal gates on `canCreateTasks()`. Both come from `useWorkspacePermission`. No new permission action, no change to `@kaneo/permissions`.

**i18n keys relied on** (strings defined in Part 3): `common:modals.createTask.estimatedHours`, `tasks:properties.estimatedHours`, `tasks:properties.noEstimate`, `tasks:popover.estimatedHours.placeholder`, `tasks:popover.estimatedHours.clear`, `tasks:popover.estimatedHours.updateSuccess`, `tasks:popover.estimatedHours.updateError`.

### 4.2 Web `Task` type

**File:** `apps/web/src/types/task/index.ts` — **anchor:** the `dueDate` line inside `type Task`.

```ts
  startDate: string | null;
  dueDate: string | null;
  // Whole hours, 0..1000. null = not estimated; 0 = estimated at nothing.
  // Optional because cached/partial tasks predate the field: `undefined`
  // means "unknown, do not write" (DR-5), never "clear".
  estimatedHours?: number | null;
  position: number | null;
```

`?: number | null` is deliberate and load-bearing. `ProjectWithTasks` overrides `columns[].tasks` with this hand-written type, so typecheck cannot prove the server actually selects the column — the field being present in the type is *not* evidence the board query returns it. Part 3's rollup test is the real proof.

### 4.3 Fetchers

#### 4.3a `apps/web/src/fetchers/task/create-task.ts`

**Anchor:** the `priority` parameter and the `json` object.

```ts
async function createTask(
  title: string,
  description: string,
  projectId: string,
  userId: string | undefined,
  status: string,
  startDate: Date | undefined,
  dueDate: Date | undefined,
  priority: CreateTaskRequest["priority"],
  estimatedHours?: number | null,
) {
  if (!projectId) throw new Error("No project selected for task creation");
  const response = await client.task[":projectId"].$post({
    json: {
      title,
      description,
      ...(userId ? { userId } : {}),
      status,
      startDate: startDate?.toISOString() || undefined,
      dueDate: dueDate?.toISOString() || undefined,
      priority,
      // DR-5 tri-state: omit when undefined so the server default applies.
      // `0` must survive, so this is an === check, never `||`.
      ...(estimatedHours === undefined ? {} : { estimatedHours }),
    },
    param: { projectId },
  });
```

Appended as a trailing optional 9th positional arg rather than converting to an options object: `use-create-task` is the only caller, and an object refactor would widen the diff past the ticket. `CreateTaskRequest` is inferred from the Hono client, so it already carries Part 1's validator field with no edit.

#### 4.3b `apps/web/src/fetchers/task/update-task.ts`

**Anchor:** the `dueDate` / `position` lines in the `json` body.

```ts
      startDate: task.startDate?.toString(),
      dueDate: task.dueDate?.toString(),
      // DR-5: `undefined` (task from a cache entry that predates the field,
      // e.g. a drag-and-drop payload) omits the key so the stored value is
      // preserved; explicit `null` clears; a number sets. `?? null` would be
      // wrong here — it would silently clear on every drag.
      ...(task.estimatedHours === undefined
        ? {}
        : { estimatedHours: task.estimatedHours }),
      position: task.position ?? 0,
```

This is the single most failure-prone hunk in Part 2. `update-task.ts` is the body used by drag-and-drop and by column-header archive-all, both of which hand it a `Task` read straight out of the board cache. If that cache was populated before the field existed, or by any code path that constructs a partial task, `estimatedHours` is `undefined` — and the omit branch is what stops a card move from wiping an estimate.

### 4.4 Mutation hooks and cache invalidation

#### 4.4a `apps/web/src/hooks/mutations/task/use-create-task.ts`

**Anchor:** the whole `mutationFn`. The existing hook destructures a fixed field list out of `CreateTaskRequest` and re-passes positionally, so a new inferred field is dropped on the floor unless added in **both** places.

```ts
    mutationFn: ({
      title,
      description,
      userId,
      projectId,
      status,
      startDate,
      dueDate,
      priority,
      estimatedHours,
    }: CreateTaskRequest) =>
      createTask(
        title,
        description,
        projectId,
        userId,
        status,
        startDate ? new Date(startDate) : undefined,
        dueDate ? new Date(dueDate) : undefined,
        priority,
        estimatedHours,
      ),
```

#### 4.4b `apps/web/src/hooks/mutations/task/use-update-task.ts`

**No change.** It takes a whole `Task` and forwards it to `updateTask`, so the field rides along through §4.3b.

#### 4.4c Invalidation — confirmed, not assumed

The rollup is client-side (DR-1): the header sums `column.tasks[].estimatedHours` off the board query, whose key is `["tasks", projectId]`.

- `useCreateTask.onSuccess` already invalidates `["tasks", variables.projectId]`. A created task with an estimate refreshes the board, so the new task enters the sum. OK
- `useUpdateTask.onSuccess` already invalidates `["task", variables.id]` **and** `["tasks", variables.projectId]`. The sidebar popover and the draft-promotion path both go through this hook, so an edited estimate refreshes both the detail view and the board sum. OK
- Draft promotion passes `projectId: resolvedProjectId` in the update body, so `variables.projectId` is populated and the invalidation is not a no-op. OK

No new query key and no new invalidation call is needed. Realtime is likewise unchanged: `create-task` publishes `task.created` and `update-task` publishes `task.updated`, and the WebSocket handler invalidates the same board key, so a peer's estimate change re-sums the header without extra wiring.

### 4.5 Shared input + sidebar popover (new files)

**New file:** `apps/web/src/components/task/estimated-hours-input.tsx` — one place for the DR-2/DR-3 parse so the modal and the popover cannot drift.

```tsx
// Returns null for an empty field (not estimated) and undefined for input
// that is not a whole number in 0..1000 — callers must not write undefined.
export function parseEstimatedHours(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return Number.isInteger(value) && value >= 0 && value <= 1000
    ? value
    : undefined;
}

export function EstimatedHoursInput({
  value,
  onCommit,
}: {
  value: number | null;
  onCommit: (next: number | null) => void;
}) {
  const { t } = useTranslation();
  const [raw, setRaw] = useState(value === null ? "" : String(value));
  const parsed = parseEstimatedHours(raw);
  return (
    <div className="p-2 space-y-2">
      <Input
        type="number"
        min={0}
        max={1000}
        step={1}
        inputMode="numeric"
        value={raw}
        placeholder={t("tasks:popover.estimatedHours.placeholder")}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={() => parsed !== undefined && onCommit(parsed)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && parsed !== undefined) {
            e.preventDefault();
            onCommit(parsed);
          }
        }}
      />
      {value !== null && (
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground" onClick={() => onCommit(null)}>
          <X className="h-4 w-4" />
          {t("tasks:popover.estimatedHours.clear")}
        </Button>
      )}
    </div>
  );
}
```

Client parsing is a convenience, not the authority: DR-3 is enforced by Valibot and the API answers 400. An out-of-range value simply does not commit.

**New file:** `apps/web/src/components/task/task-estimated-hours-popover.tsx` — mirrors `task-due-date-popover.tsx` exactly, including the bare-children escape when `!canEdit`.

```tsx
export default function TaskEstimatedHoursPopover({ task, children }: { task: Task; children: React.ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { mutateAsync: updateTask } = useUpdateTask();
  const { canUpdateTasks } = useWorkspacePermission();

  const handleCommit = async (next: number | null) => {
    try {
      // Spread the whole task: the full PUT body reads other fields off it.
      await updateTask({ ...task, estimatedHours: next });
      toast.success(t("tasks:popover.estimatedHours.updateSuccess"));
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("tasks:popover.estimatedHours.updateError"));
    }
  };

  if (!canUpdateTasks()) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="p-0 w-56" align="start">
        <EstimatedHoursInput value={task.estimatedHours ?? null} onCommit={handleCommit} />
      </PopoverContent>
    </Popover>
  );
}
```

**File:** `apps/web/src/components/task/task-properties-sidebar.tsx` — **anchor:** immediately after the `<TaskDueDatePopover>` block. Insert this in **both** render paths (the wide branch around lines 146-330 *and* the narrow branch around 337-460); a field added to one branch is invisible in the other.

```tsx
<TaskEstimatedHoursPopover task={task}>
  <button type="button" className={/* copy the sibling due-date trigger's className */ ""}>
    <Clock className="w-3.5 h-3.5" />
    <span>
      {task.estimatedHours === null || task.estimatedHours === undefined
        ? t("tasks:properties.noEstimate")
        : t("tasks:properties.estimatedHours", { count: task.estimatedHours })}
    </span>
  </button>
</TaskEstimatedHoursPopover>
```

The label check is an explicit null/undefined comparison because `0` is a real estimate and must render as "0h", not as "no estimate".

### 4.6 `create-task-modal.tsx`

Six hunks in one file.

**(1) Local state — anchor: after the `dueDate` state, ~line 190.**

```ts
  const [estimatedHours, setEstimatedHours] = useState<number | null>(null);
```

**(2) Reset paths — anchor: the `setPriority("no-priority")` line in the close reset (~line 249) *and* the post-submit reset (~line 441).** Both need it; `createMore` keeps the modal mounted, so a missed reset leaks the previous task's estimate into the next one.

```ts
  setEstimatedHours(null);
```

**(3) `normalizeTask` — anchor: the `dueDate` line, ~line 93.**

```ts
    dueDate: task.dueDate ?? null,
    estimatedHours: task.estimatedHours ?? null,
```

`?? null` is correct *here* (unlike §4.3b): `normalizeTask` produces a complete client-side `Task`, and "the server told us nothing" collapses to "not estimated" for display. `0` survives `??`.

**(4) Draft creation — anchor: the `status: draftStatus,` line, ~line 351.**

```ts
      status: draftStatus,
      ...(estimatedHours === null ? {} : { estimatedHours }),
```

On create there is no stored value to preserve, so omitting on `null` and sending the number otherwise is sufficient and does not depend on whether Part 1's create validator accepts an explicit `null`.

**(5) `handleSubmit` — anchor: both branches, ~lines 390-415.**

Draft-promotion branch, after `projectId: resolvedProjectId,`:

```ts
            projectId: resolvedProjectId,
            // Explicit value, including null: the user may have cleared an
            // estimate that the draft create already persisted.
            estimatedHours,
```

Plain-create branch, after `status: taskStatus,`:

```ts
            status: taskStatus,
            ...(estimatedHours === null ? {} : { estimatedHours }),
```

The asymmetry is DR-5, not an oversight: promotion is an update over an already-persisted draft, so `null` must be sent to clear; creation has nothing to clear, so `null` omits.

**(6) Trigger button — anchor: after the due-date `<Popover>` block, ~line 905.** Same trigger idiom as `dueDate`, gated on create permission.

```tsx
              {canCreateTasks() && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className={cn("flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors border border-border hover:bg-accent/50", estimatedHours !== null ? "bg-accent/30 text-foreground" : "text-muted-foreground")}>
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {estimatedHours !== null
                          ? t("tasks:properties.estimatedHours", { count: estimatedHours })
                          : t("common:modals.createTask.estimatedHours")}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-56" align="start">
                    <EstimatedHoursInput value={estimatedHours} onCommit={setEstimatedHours} />
                  </PopoverContent>
                </Popover>
              )}
```

### 4.7 Residual risks carried into Part 3

1. **Typecheck blind spot.** `ProjectWithTasks` overrides `columns[].tasks` with the hand-written `Task`, so adding the field to the type does not prove the board response carries it. Part 3's rollup test must assert against a real board payload.
2. **`undefined` vs `null` at the fetcher boundary.** The one hunk that must not regress is §4.3b's omit branch; a future "simplification" to `task.estimatedHours ?? null` silently clears estimates on drag-and-drop and archive-all.
3. **Two sidebar render paths.** The narrow-layout insertion is easy to miss and produces a field that exists only above a breakpoint.

---

## Part 3 — Column rollup, i18n, tests, verification

### 10. DR-6 — Column-header estimate rollup (DECIDED)

**Visual form.** A second pill immediately to the right of the existing count pill, same pill geometry, containing a `Clock` glyph plus terse text. It is display-only: it lives in the header's left `div`, never inside `column-dropzone.tsx`, and does not participate in drag/drop.

**Rollup arithmetic.** Sum over `column.tasks` (already filter-narrowed, DR-1) of `estimatedHours` where `typeof task.estimatedHours === "number"`. `0` is a real estimate and counts toward *estimated task count* while adding nothing to the sum; `null`/`undefined` is *not estimated*. **Never** `task.estimatedHours || 0` inside the filter predicate — that would silently reclassify `0` as unestimated (DR-2, DR-5).

**Three states, distinguished without colour.** State is carried three redundant ways — visible text, a `data-estimate-state` attribute, and the accessible name. No colour, no icon-only difference.

| state | condition | visible text | `data-estimate-state` | accessible name |
|---|---|---|---|---|
| none | 0 tasks estimated | `—` | `none` | "No hours estimated" |
| partial | 0 < n < total | `12h · 2/5` | `partial` | "12h estimated across 2 of 5 tasks" |
| all | n === total | `12h` | `all` | "12h estimated across all 5 tasks" |

**Programmatic accessible name.** The pill is `role="img"` with `aria-label={estimateLabel}`, so the terse visible text is presentational to AT and the full sentence is the computed name. `aria-label` on a bare generic span is not reliably exposed; `role="img"` makes it so, and keeps `getByLabelText` working in the component test. `title` mirrors the label for sighted hover.

The pill renders only when `column.tasks.length > 0` (an empty column has nothing to roll up and the count pill already reads `0`).

#### 10.1 `apps/web/src/components/kanban-board/column/column-header.tsx`

Hunk A — import (anchor: line 2, existing lucide import):

```diff
-import { Archive, Plus } from "lucide-react";
+import { Archive, Clock, Plus } from "lucide-react";
```

Hunk B — derived values, inserted after `handleConfirmArchive` and before `return (`:

```tsx
  const estimatedTasks = column.tasks.filter(
    (task) => typeof task.estimatedHours === "number",
  );
  const estimatedTotal = estimatedTasks.reduce(
    (sum, task) => sum + (task.estimatedHours as number),
    0,
  );
  const estimateState =
    estimatedTasks.length === 0
      ? "none"
      : estimatedTasks.length === column.tasks.length
        ? "all"
        : "partial";
  const estimateArgs = {
    hours: estimatedTotal,
    done: estimatedTasks.length,
    total: column.tasks.length,
  };
  const estimateLabel =
    estimateState === "none"
      ? t("tasks:kanban.estimate.none")
      : t(`tasks:kanban.estimate.${estimateState}`, estimateArgs);
  const estimateText =
    estimateState === "none"
      ? t("tasks:kanban.estimate.noneShort")
      : t(`tasks:kanban.estimate.${estimateState}Short`, estimateArgs);
```

Hunk C — full modified render block. The count pill is byte-identical to HEAD; the archive and add buttons, both modals, and the wrapper classes are unchanged.

```tsx
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-muted-foreground">
          {getColumnIcon(column.id, column.isFinal, column.icon)}
        </span>
        <span className="truncate text-sm font-medium text-foreground/95">
          {column.name}
        </span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          {column.tasks.length}
        </span>
        {column.tasks.length > 0 && (
          <span
            role="img"
            aria-label={estimateLabel}
            title={estimateLabel}
            data-estimate-state={estimateState}
            className="flex shrink-0 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
          >
            <Clock className="h-3 w-3" />
            {estimateText}
          </span>
        )}
      </div>

      <div className="flex items-center">
        {canTask && column.isFinal && column.tasks.length > 0 && (
          <button type="button" onClick={() => setIsArchiveModalOpen(true)} className="flex items-center rounded-md px-2 py-1 text-left text-muted-foreground transition-colors hover:bg-accent/50" title={t("tasks:listView.archiveAllTooltip")}>
            <Archive className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
        {canCreate && (
          <button type="button" onClick={() => setIsTaskModalOpen(true)} className="flex items-center rounded-md px-2 py-1 text-left text-muted-foreground transition-colors hover:bg-accent/50" title={t("tasks:kanban.addTask")}>
            <Plus className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      <CreateTaskModal open={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} projectId={project?.id} status={column.id} />
      <ArchiveTasksModal open={isArchiveModalOpen} onClose={() => setIsArchiveModalOpen(false)} onConfirm={handleConfirmArchive} taskCount={column.tasks.length} />
    </div>
  );
```

`handleConfirmArchive` is **not** modified: `updateTask({ ...task, status: "archived" })` spreads the whole task, so `estimatedHours` rides through the full-PUT fetcher patched in Part 2 §4.3b and is preserved. This is asserted, not assumed (T-6b).

### 11. i18n — `i18n/en-US.json` only

Only `i18n/en-US.json` is edited. `i18n/schema.json` is generated and off-limits; the other 16 locales are translated separately and are **not** hand-filled.

Add to `common.modals.createTask`:
```json
"estimatedHours": "Estimated hours"
```

Add to `tasks.properties`:
```json
"estimatedHoursLabel": "Estimated hours",
"estimatedHours_one": "{{count}} hour",
"estimatedHours_other": "{{count}} hours",
"noEstimate": "No estimate"
```

Add `tasks.popover.estimatedHours` (new sibling of `dueDate`):
```json
"estimatedHours": {
  "placeholder": "Hours (0–1000)",
  "clear": "Clear estimate",
  "updateSuccess": "Task estimate updated successfully",
  "updateError": "Failed to update task estimate"
}
```

Add `tasks.kanban.estimate` (DR-6):
```json
"estimate": {
  "none": "No hours estimated",
  "noneShort": "—",
  "partial": "{{hours}}h estimated across {{done}} of {{total}} tasks",
  "partialShort": "{{hours}}h · {{done}}/{{total}}",
  "all": "{{hours}}h estimated across all {{total}} tasks",
  "allShort": "{{hours}}h"
}
```

Conventions honoured: `estimatedHours_one`/`_other` follow the repo's no-base-key plural form (`permissionCount_one`, `pr.count_one`). Every two-number rollup string interpolates `{{hours}}`/`{{done}}`/`{{total}}` — **`{{count}}` is never used outside plural selection**, because i18next reserves it and a `count` present on the rollup label would hijack plural resolution.

### 12. Test plan → AC map

Every entry is inside the write contract.

**`tests/api-integration/task-estimated-hours.test.ts`** (the one permitted new integration file)
- **T-1 (AC-1)** `"persists estimatedHours on create and defaults to null when omitted"` — POST `/api/task/tasks/:projectId` with `estimatedHours: 8` → 200, body echoes `8`, DB row is `8`; second POST omitting the field → row is `null`.
- **T-2 (AC-2)** `"a full PUT that omits estimatedHours preserves the stored value"` — PUT sets `12`, then a second PUT with the complete task body minus `estimatedHours` → row still `12`, not `null`. Also asserts explicit `null` clears (DR-5).
- **T-3 (AC-3)** `"rejects out-of-range and wrongly-typed estimates with 400"` — `-1`, `1001`, `2.5`, `"8"` on both create and update → 400; the seeded row's value is re-read and unchanged, proving no DB write occurred.
- **T-4 (AC-4, AC-8)** `"board payload exposes estimatedHours on every task"` — GET `/api/task/tasks/:projectId` (wrapped `{ data, pagination }`, columns at `body.data.columns`); asserts the exact sorted `Object.keys()` of a returned task contains `estimatedHours`. This is what catches a missing entry in `get-tasks.ts` `taskSelection`, which `pnpm typecheck` cannot.
- **T-5 (AC-5)** `"single-task read returns estimatedHours"` — GET the single-task route with the workspace context the existing integration helpers supply (calling `/api/task/:projectId` bare 400s with "Workspace ID could not be determined" — that is the *board* path mistake, not a bug).
- **T-6 (AC-7)** `"board payload supports a correct client-side rollup"` — seed one column with `[8, null, 0, 4]`; assert sum-of-non-null `=== 12` and estimated-count `=== 3` (the `0` counts as estimated).
- **T-7 (AC-10)** `"pre-existing task rows read back as null"` — rows inserted without the field are `null` after migration; paired with manual migration SQL inspection (§13 step 2).
- **T-8 (AC-12)** `"a non-member cannot create or read a task estimate"` — existing `requireWorkspacePermission` middleware returns 403 with no new guard; `packages/permissions` is untouched.

**`tests/api/task/estimated-hours-validation.test.ts`** (new; `tests/api/task/` is currently empty)
- **T-9 (AC-3)** table-driven Valibot unit test over the create and update schemas: accepts `0`, `1`, `1000`, `undefined`, `null`; rejects `-1`, `1001`, `0.5`, `"8"`, `NaN`, `Infinity`.

**`tests/api/task/build-full-task-update-body.test.ts`** (new)
- **T-10 (AC-9)** `"an MCP patch omitting estimatedHours preserves the existing value"` — `buildFullTaskUpdateBody(existingTask, patchWithoutEstimatedHours)` emits a body whose `estimatedHours` equals the existing value; a patch with explicit `null` emits `null`; a patch with `0` emits `0` (guards against an `||` regression).

**`apps/web/src/components/kanban-board/column/column-header.test.tsx`** (new)
- **T-11 (AC-6)** three fixtures — none estimated, mixed, all estimated. Each asserts the rollup exists via `getByLabelText`, that its `data-estimate-state` is `none`/`partial`/`all` respectively, and that the visible text differs. A fourth assertion checks the count pill still renders `column.tasks.length` unchanged, and a fifth checks a `[0, null]` column reports state `partial` with total `0h`.
- **T-6b (AC-2, web side)** `"archive-all preserves estimatedHours"` — mock `useUpdateTask`, click archive, confirm, assert every `updateTask` call argument carries the task's original `estimatedHours`.

**`apps/web/src/components/shared/modals/create-task-modal.test.tsx`** (existing)
- **T-12 (AC-1, AC-11)** asserts the estimated-hours field renders and that omitting it submits without an `estimatedHours` key.

**`apps/web/src/components/task/estimated-hours-input.test.tsx`** (new)
- **T-13** `parseEstimatedHours`: `""` → `null`, `"0"` → `0`, `"8"` → `8`, `"8.5"`/`"-1"`/`"1001"`/`"abc"` → invalid.

**`apps/web/src/components/task/estimated-hours-i18n.test.ts`** (new)
- **T-14 (AC-11, plural proof)** — **component tests in this repo mock `react-i18next` so `t` merely echoes the key; `t("x", { count: 2 })` returns the literal `"x"`, which makes plural bugs invisible.** So plural selection is proved here instead, against a **real** i18next instance initialised from `i18n/en-US.json`: `estimatedHours` with `count: 1` → `"1 hour"`, `count: 2` → `"2 hours"`, `count: 0` → `"0 hours"`; and the rollup labels resolve with `{{hours}}/{{done}}/{{total}}` substituted and no stray `{{`.

**AC-11 / AC-12 as gates, not tests:** `git diff --name-only` must show `i18n/en-US.json` and no other locale, no `i18n/schema.json`, and nothing under `packages/permissions/`.

### 13. Verification gate — ordered commands

1. `pnpm --filter @kaneo/api db:generate`
2. Inspect the emitted SQL: it must be a single `ALTER TABLE "task" ADD COLUMN "estimated_hours" integer;` — **nullable, no `DEFAULT`, no `NOT NULL`, no backfill `UPDATE`** (AC-10).
3. **Immediately after every `db:generate`:**
   `npx biome format --write apps/api/drizzle/meta/_journal.json apps/api/drizzle/meta/<n>_snapshot.json`
   drizzle-kit writes those files with 2-space indent while `biome.json` sets `indentStyle: "tab"` for JSON and `apps/api/drizzle/**` is not excluded from Biome discovery; `_journal.json` gets rewritten wholesale (~313 insertions / 306 deletions for a 7-line append). `npx biome ci .` is the first CI job, so this reddens CI. Do **not** try to fix it by re-running `db:generate` — that is what produces the spaces. Corollary: lint the files a *generator* wrote, not only the files you edited.
4. `npx biome check apps/api/src apps/web/src tests i18n/en-US.json apps/api/drizzle` — targeted while iterating. Avoid `pnpm lint`; it runs Biome with `--write` and can modify unrelated files.
5. `pnpm typecheck`
6. `pnpm test` (or `pnpm --filter @kaneo/web test` / `--filter @kaneo/api test` while iterating).
7. Integration DB state — the container `kaneo-mmo-itest` on port **55432** is **shared**, and a previous benchmark arm of a different ticket used it. Two arms generate different migrations with the same number, and the second then fails en masse with `column ... already exists` because Drizzle sees its own migration as unapplied and re-runs the `ADD COLUMN`. **Verify migration state instead of assuming a clean DB**; dropping `kaneo_test` is safe because `ensureTestDatabaseExists` recreates and migrates it from zero.
8. `DATABASE_URL=postgresql://postgres:postgres@localhost:55432/kaneo_test pnpm test:integration` — `DATABASE_URL` must be exported **per shell**. There is no committed `apps/api/.env.test`, only `.env.test.example`, which points at the wrong default port.
9. AC-10 second half: apply the migration against a database that already holds task rows (seed rows, then migrate) and confirm it succeeds and leaves every existing row `NULL`.
10. `pnpm i18n:check` — **already red at HEAD** (`common:error.*` missing from `de-DE` and others). Never read a failure here as damage from this run; diff the failing set against the pre-existing set first. Adding `en-US` keys legitimately **widens** the per-locale missing list — expected and correct. **Never run `pnpm i18n:check:fix`**: it copies English strings into all 16 locale files, an explicit non-goal.
11. **Do not regenerate `apps/docs/openapi.json`.** It is ~11 route-groups stale; regenerating produces ~1,481 insertions / 166 deletions of unrelated churn. Document the contract gap (the new `estimatedHours` field is described in the route's OpenAPI metadata in code but not reflected in the checked-in artifact) and defer.
12. `git diff --name-only` — confirm only `i18n/en-US.json` among locales, no `i18n/schema.json`, nothing under `packages/permissions/` (AC-11, AC-12).

**This run stops at the working tree. No commit, no push, no pull request.**

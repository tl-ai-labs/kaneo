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

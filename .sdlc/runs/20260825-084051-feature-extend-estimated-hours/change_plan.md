# Change plan — feature-extend — Estimated hours on tasks with per-lane rollup

Run: `20260825-084051-feature-extend-estimated-hours` · Intent: `feature-extend` · Mode: brownfield delta
Base: `feature-extend-2/opus-only` @ `5d1fc910` · Input: `requirements.md` (32 FR / 7 NFR / 16 AC / §8 Gate-1 resolutions)
Write contract: `.sdlc/local/write-contract.json` (frozen, strict)

This is a delta. Every line below names an existing file at `5d1fc910` and the exact change to it, or a
new file and the exact path. Nothing outside the allowlist appears anywhere in this plan.

---

## 1. Summary

Tasks gain one nullable `integer` column, `task.estimated_minutes`. Minutes are the storage unit; hours
are the interaction unit — the user types `2.5`, the API stores `150`, every surface renders `2.5h`.
The write path is a dedicated `PUT /task/estimate/:id` cloned line-for-line from `PUT /task/due-date/:id`
minus its `publishEvent` call (Gate 1 OQ-5). The read path is two added lines in the existing `getTask` /
`getTasks` projections plus one field on `taskSchema`. On the web side a single dependency-free helper
module owns hours↔minutes conversion, display formatting and the lane sum; a new `TaskEstimatePopover`
is registered in all three responsive variants of `task-properties-sidebar.tsx`; two tiny presentational
components (`TaskEstimateBadge`, `ColumnEstimateTotal`) carry the board display so both are directly
unit-testable without mounting `TaskCard` or `ColumnHeader`. `null` — never `0` — is the "no estimate"
signal end to end, which is what makes an untouched card and an untouched lane header render byte-identical
to today. Import/export round-trips the value (Gate 1 OQ-1).

The shape is chosen for the smallest reachable diff: one column, one endpoint, one popover, one badge, one
rollup, no new permission, no new event type, no new query key, no new index.

---

## 2. Change inventory

Ordering is a valid build order. Packet boundaries `P1..P9` are suggested in §14.

| # | Path | Kind | Change | FRs | ~LoC |
|---|---|---|---|---|---|
| 1 | `apps/api/src/database/schema.ts` | `patch_apply` | Add `estimatedMinutes: integer("estimated_minutes"),` to `taskTable` between `dueDate` (L428) and `createdAt` (L429). No index block change. | FR-1, FR-3 | +1 |
| 2 | `apps/api/drizzle/0043_<tag>.sql` | new (generated) | drizzle-kit output: one `ALTER TABLE "task" ADD COLUMN "estimated_minutes" integer;` | FR-2 | +1 |
| 3 | `apps/api/drizzle/meta/0043_snapshot.json` | new (generated) | Full snapshot including the new column. Biome-formatted after generation. | FR-2, NFR-5 | generated |
| 4 | `apps/api/drizzle/meta/_journal.json` | `patch_apply` (generated) | One new entry `idx: 43`. Biome-formatted after generation. | FR-2, NFR-5 | +7 |
| 5 | `apps/api/src/task/estimated-minutes.ts` | new | DB-free module: `MAX_ESTIMATED_MINUTES`, `normalizeEstimatedMinutes`, `coerceEstimatedMinutes`. | FR-4, FR-5, FR-6, FR-31 | +55 |
| 6 | `tests/api/task/estimated-minutes.test.ts` | new | Vitest (node). Accept/reject table for `normalizeEstimatedMinutes`. | FR-5, AC-3 | +75 |
| 7 | `apps/api/src/schemas.ts` | `patch_apply` | `taskSchema` gains `estimatedMinutes: v.nullish(v.number()),` after `dueDate` (L42). | FR-13, AC-5 | +1 |
| 8 | `apps/api/src/task/controllers/update-task-estimate.ts` | new | Load-404-update-500-return. **No `publishEvent`.** | FR-10, FR-11 | +40 |
| 9 | `apps/api/src/task/index.ts` | `patch_apply` | Two imports + one `.put("/estimate/:id", ...)` chain link inserted after the `/due-date/:id` link (after L615). | FR-7, FR-8, FR-9, FR-14, FR-15 | +42 |
| 10 | `apps/api/src/task/controllers/get-task.ts` | `patch_apply` | `estimatedMinutes: taskTable.estimatedMinutes,` after `dueDate` (L16). | FR-12, AC-5 | +1 |
| 11 | `apps/api/src/task/controllers/get-tasks.ts` | `patch_apply` | Same line in the `taskSelection` literal after `dueDate` (L131). | FR-12, AC-5 | +1 |
| 12 | `apps/api/src/task/controllers/export-tasks.ts` | `patch_apply` | Add to the `db.select({...})` projection (after L31) and to the emitted per-task object (after L87). | FR-30 | +2 |
| 13 | `apps/api/src/task/controllers/import-tasks.ts` | `patch_apply` | `ImportTask` gains `estimatedMinutes?: number \| null`; call `coerceEstimatedMinutes`; add its warning to `warnings`; write the value in `.values({...})`. | FR-31 | +8 |
| 14 | `tests/api/task/estimate-import-export.test.ts` | new | Round-trip over the coercion boundary for `[150, null, 90]` + invalid inputs. | FR-32, AC-14 | +55 |
| 15 | `apps/web/src/types/task/index.ts` | `patch_apply` | `Task` gains `estimatedMinutes?: number \| null;` after `dueDate` (L26). **See §6.1 — deviation from FR-16.** | FR-16 | +1 |
| 16 | `apps/web/src/fetchers/task/update-task-estimate.ts` | new | `client.task.estimate[":id"].$put`. | FR-17 | +22 |
| 17 | `apps/web/src/hooks/mutations/task/use-update-task-estimate.ts` | new | `useMutation` + 4 `invalidateQueries`. | FR-18 | +30 |
| 18 | `apps/web/src/components/task/estimate.ts` | new | The shared helper module: bounds, format, input-format, parse, sum. | FR-19, FR-20, NFR-7 | +75 |
| 19 | `apps/web/src/components/task/estimate.test.ts` | new | Vitest (jsdom, no DOM used). Full format/parse/sum contract from §7 and §8. | FR-19, FR-20, AC-10 | +110 |
| 20 | `i18n/en-US.json` | `patch_apply` | 10 new keys in 3 existing objects. | FR-27 | +14 |
| 21 | `i18n/<17 locales>.json` | `patch_apply` (tooling) | English placeholders backfilled by guarded `pnpm i18n:check:fix`. | FR-28, AC-9, AC-16 | +14 each |
| 22 | `apps/web/src/components/task/task-estimate-popover.tsx` | new | The edit surface. | FR-21, FR-22 | +110 |
| 23 | `apps/web/src/components/task/task-properties-sidebar.tsx` | `patch_apply` ×5 | 3 imports + 3 trigger blocks (compact after L326, mobile after L517, desktop after L710). | FR-23, AC-6 | +60 |
| 24 | `apps/web/src/components/kanban-board/task-estimate-badge.tsx` | new | Presentational badge; returns `null` when unset. | FR-24 | +25 |
| 25 | `apps/web/src/components/kanban-board/task-estimate-badge.test.tsx` | new | Present when set / absent when null. | FR-24, AC-7 | +35 |
| 26 | `apps/web/src/components/kanban-board/task-card.tsx` | `patch_apply` | 1 import + `<TaskEstimateBadge minutes={task.estimatedMinutes} />` inside the badge row, after the due-date block (after L280). | FR-24, AC-7 | +2 |
| 27 | `apps/web/src/components/kanban-board/column/column-estimate-total.tsx` | new | Presentational rollup chip; returns `null` when the sum is `null`. | FR-25, FR-26 | +30 |
| 28 | `apps/web/src/components/kanban-board/column/column-estimate-total.test.tsx` | new | Zero / all-null / one / several. | FR-20, FR-25, AC-8 | +55 |
| 29 | `apps/web/src/components/kanban-board/column/column-header.tsx` | `patch_apply` | 1 import + `<ColumnEstimateTotal tasks={column.tasks} />` after the count chip (after L64). | FR-25 | +2 |

Every path is inside the allowlist: `apps/api/src/database/schema.ts`, `apps/api/src/schemas.ts`,
`apps/api/drizzle/*.sql`, `apps/api/drizzle/meta/*`, `apps/api/src/task/**`, `tests/api/**`,
`apps/web/src/{components/task,components/kanban-board,fetchers,hooks,types}/**`, `i18n/*.json`.
No file is removed.

**Files removed:** none.

---

## 3. Data-layer changes

### 3.1 Column definition and placement

In `apps/api/src/database/schema.ts`, inside the `taskTable` column literal, insert one line between
`dueDate` (L428) and `createdAt` (L429):

```ts
    dueDate: timestamp("due_date", { mode: "date" }),
    estimatedMinutes: integer("estimated_minutes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
```

`integer` is already imported in this file (used by `position` L413 and `number` L414) — no import edit.
Placement groups the estimate with the other planning fields and keeps `createdAt` / `updatedAt` trailing,
matching the convention across every other table in the file. Column order in the drizzle literal has no
effect on the emitted DDL; PostgreSQL always appends physically.

Nullable, no `.default()`, no `.notNull()`. **NULL is the only representation of "no estimate"** (FR-1);
`0` is rejected at the API boundary and can never be stored.

### 3.2 No index (FR-3)

The `(table) => [...]` block at L435-441 is untouched. Justification: no query filters, orders, joins or
aggregates on `estimated_minutes`. The lane rollup is computed in the browser over `column.tasks`, an array
already materialised by the existing board query. `get-tasks.ts`'s `sortBy` union is explicitly out of scope
(§2.7). An index here would be pure write-amplification on a hot table.

### 3.3 Migration

Generated, never hand-written:

```
pnpm --filter @kaneo/api db:generate
```

Journal at `5d1fc910` ends at `idx: 42` (`0042_previous_the_executioner`), so the next artifacts are:

| Artifact | Expected content |
|---|---|
| `apps/api/drizzle/0043_<generated_tag>.sql` | exactly `ALTER TABLE "task" ADD COLUMN "estimated_minutes" integer;` |
| `apps/api/drizzle/meta/0043_snapshot.json` | full snapshot with `estimated_minutes` on `public.task`, `notNull: false`, no `default` |
| `apps/api/drizzle/meta/_journal.json` | one appended entry `{ "idx": 43, "version": "7", "when": <epoch-ms>, "tag": "0043_<generated_tag>", "breakpoints": true }` |

The `<generated_tag>` word pair is chosen by drizzle-kit; the packet records the actual filename it produced
rather than asserting one in advance. **The packet must reject the generation and stop if the `.sql`
contains anything besides that single `ALTER TABLE ... ADD COLUMN` statement** — a `DROP`, a re-created
constraint, or edits to any other table means the local schema had drifted and the generation is unsafe.

Then, per NFR-5, format the generated JSON (drizzle-kit emits 2-space JSON; the committed snapshots are
tab-indented):

```
pnpm exec biome format --write apps/api/drizzle/meta/_journal.json apps/api/drizzle/meta/0043_<tag>_snapshot.json
```

This is the approved sequence and is not a hand edit of generated SQL.

Apply with `pnpm --filter @kaneo/api db:migrate` against **`kaneo_opus_only`** only (§10 standing
constraint). Never `kaneo`, which is one migration ahead from a sibling branch.

### 3.4 Why this is safe on a populated `task` table

`ADD COLUMN <name> integer` with no `NOT NULL` and no `DEFAULT` is a **catalog-only change** in PostgreSQL:
the planner records the new attribute in `pg_attribute` and existing heap tuples are left untouched, with
missing attributes read back as NULL. There is no table rewrite, no per-row I/O, and the `ACCESS EXCLUSIVE`
lock is held only for the catalog update — duration independent of table size. (The rewrite hazard applies
to `ADD COLUMN ... NOT NULL DEFAULT ...` on PostgreSQL < 11, and to `NOT NULL` without a default at any
version, since it would have to be validated. Neither applies here.) Every pre-existing row therefore reads
back `estimated_minutes = NULL`, which is NFR-1's compatibility guarantee expressed at the storage layer.

**Reverse path:** drizzle-kit does not emit down-migrations. Rollback is manual and is stated in §12.

---

## 4. API contract changes

### 4.1 New route

| Property | Value |
|---|---|
| Method / path | `PUT /task/estimate/:id` |
| `operationId` | `updateTaskEstimate` |
| `tags` | `["Tasks"]` |
| `description` | `"Update only the estimated effort of a task"` |
| Param | `v.object({ id: v.string() })` |
| Body | `v.object({ estimatedMinutes: v.optional(v.nullable(v.number())) })` |
| 200 | `resolver(taskSchema)` — the full updated task row |
| 400 | wrong body **type** (Valibot, framework-generated) or invalid **value** (`HTTPException` from the normalizer, human-readable message) |
| 401/403 | existing auth middleware / `requireWorkspacePermission` |
| 404 | task id not found (from the controller) |
| 500 | update returned no row (should be unreachable) |

Middleware chain, **in this exact order** (AC-4 is verified by reading this back):

```
describeRoute({...})
validator("param", v.object({ id: v.string() }))
validator("json", v.object({ estimatedMinutes: v.optional(v.nullable(v.number())) }))
workspaceAccess.fromTask()
requireWorkspacePermission({ task: ["update"] })
requireEntitlement
async (c) => { ... }
```

Handler body (thin — parse, normalize, delegate, return):

```ts
    async (c) => {
      const { id } = c.req.valid("param");
      const { estimatedMinutes = null } = c.req.valid("json");

      const task = await updateTaskEstimate({
        id,
        estimatedMinutes: normalizeEstimatedMinutes(estimatedMinutes),
      });

      return c.json(task);
    },
```

Insertion point: a new `.put(...)` link in the single chained `new Hono()...` in
`apps/api/src/task/index.ts`, immediately after the `/due-date/:id` link closes (after L615, before the
blank line preceding `/title/:id`). Two new imports, both landing in biome's sorted order:
`updateTaskEstimate from "./controllers/update-task-estimate"` (alphabetically after
`update-task-due-date`, L44) and `{ normalizeEstimatedMinutes } from "./estimated-minutes"` (grouped with
the other `./` local imports).

Deliberate deviation from the due-date sibling: the handler does **not** read `c.get("userId")`, because the
controller has no `currentUserId` parameter — it publishes nothing. See §11 ADR-3.

### 4.2 Controller

`apps/api/src/task/controllers/update-task-estimate.ts`, shaped on `update-task-due-date.ts`:

```ts
async function updateTaskEstimate({
  id,
  estimatedMinutes,
}: {
  id: string;
  estimatedMinutes: number | null;
}) {
  const existingTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, id),
  });

  if (!existingTask) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  const [updatedTask] = await db
    .update(taskTable)
    .set({ estimatedMinutes })
    .where(eq(taskTable.id, id))
    .returning();

  if (!updatedTask) {
    throw new HTTPException(500, { message: "Failed to update task estimate" });
  }

  return updatedTask;
}

export default updateTaskEstimate;
```

Differences from `update-task-due-date.ts`, both intentional: no `taskReminderSentTable` delete (estimates
drive no reminders) and **no `publishEvent`** (Gate 1 OQ-5, FR-11, ADR-3).

### 4.3 Response schema

`apps/api/src/schemas.ts`, `taskSchema` (L25-44) gains one line after `dueDate` (L42):

```ts
  estimatedMinutes: v.nullish(v.number()),
```

`v.nullish` (accepts `null`, `undefined`, or a number) matches how a nullable integer column surfaces both
in a full row and in a partial projection. `taskSchema` is consumed only through `resolver()` for OpenAPI
metadata, so this is a documentation-contract change with no runtime response validation effect — but it is
required for "Public API behavior must retain accurate Valibot validation and OpenAPI metadata" (AGENTS.md).

### 4.4 Read projections

Both read paths list columns explicitly and would otherwise silently drop the field:

- `apps/api/src/task/controllers/get-task.ts` — add `estimatedMinutes: taskTable.estimatedMinutes,` after
  `dueDate` (L16).
- `apps/api/src/task/controllers/get-tasks.ts` — same line in the `taskSelection` object after `dueDate`
  (L131). This is the board payload, so it feeds both the card badge and the lane rollup.

No other read path is touched. Search/MCP/webhook payloads are unchanged (§2.4, §2.5).

### 4.5 Export payload delta

`apps/api/src/task/controllers/export-tasks.ts`:

- select projection (after L31): `estimatedMinutes: taskTable.estimatedMinutes,`
- emitted object (after L87, alongside `startDate`): `estimatedMinutes: task.estimatedMinutes ?? null,`

The stored integer passes through unchanged; `null` stays `null`. No formatting, no hours conversion — the
export is a data interchange format, and minutes are the storage unit.

### 4.6 Import payload delta

`apps/api/src/task/controllers/import-tasks.ts`:

1. `ImportTask` (L13-21) gains `estimatedMinutes?: number | null;` after `dueDate`.
2. Inside the per-task loop, next to the existing coercions (after L50):
   ```ts
   const { estimatedMinutes, warning: estimateWarning } =
     coerceEstimatedMinutes(taskData.estimatedMinutes);
   ```
3. L51 becomes:
   ```ts
   const warnings = [statusWarning, priorityWarning, estimateWarning].filter(Boolean);
   ```
4. `.values({...})` gains `estimatedMinutes,` after `dueDate` (L72).
5. Import `{ coerceEstimatedMinutes } from "../estimated-minutes";`.

`coerceEstimatedMinutes` **never throws**. An invalid estimate becomes `null` plus a warning surfaced
through the importer's existing per-task `warnings` channel; one bad estimate never aborts the import and
never produces a 500 (FR-31). This is the importer's established posture, matching `coerceStatus` /
`coercePriority` exactly in both signature and warning wording.

### 4.7 Deprecated / unchanged routes

Nothing deprecated. **`PUT /task/:id` is deliberately untouched** (Gate 1 OQ-2, §2.8, AC-15). Its `.set()`
does not mention `estimatedMinutes`, so a full update *preserves* the stored estimate. This includes the
column-header "archive all" path, which fires `useUpdateTask` once per task: archiving a lane does not wipe
its estimates. A later reader must not "fix" this — preserve-by-omission is the chosen behaviour.

---

## 5. Validation design

### 5.1 The module

Path: **`apps/api/src/task/estimated-minutes.ts`** — a new file, not an addition to
`validate-task-fields.ts`, because that file imports `../database` (L3) and is therefore unimportable from
the DB-free `tests/api` suite. The new module imports only `hono/http-exception`.

Exports:

```ts
export const MAX_ESTIMATED_MINUTES = 60 * 24 * 365; // 525_600 — one year
export function normalizeEstimatedMinutes(value: unknown): number | null
export function coerceEstimatedMinutes(value: unknown): {
  estimatedMinutes: number | null;
  warning?: string;
}
```

`MAX_ESTIMATED_MINUTES` sizing (FR-6): 525,600 × 4,084 tasks in a single lane would be needed to overflow
PostgreSQL `integer` (2,147,483,647), which is not reachable on a rendered board, and is nine orders of
magnitude below `Number.MAX_SAFE_INTEGER` for the client-side sum.

### 5.2 Two layers, two failure modes

| Layer | Catches | Produces |
|---|---|---|
| `validator("json", v.object({ estimatedMinutes: v.optional(v.nullable(v.number())) }))` | wrong **type** — string, boolean, object, array | framework 400 before the handler runs |
| `normalizeEstimatedMinutes` | wrong **value** — `0`, negative, non-integer, `NaN`, `Infinity`, over bound | `HTTPException(400, { message })` with a readable message |

The normalizer also re-checks the type (`typeof value !== "number"`) so that it is safe to call from any
caller, including the tests, without relying on the route validator having run. Neither layer can produce a
500 (AC-3).

Note that `v.number()` in Valibot accepts `NaN` and `Infinity` — both are `typeof "number"` — which is
precisely why the value rules cannot live in the route schema.

### 5.3 `normalizeEstimatedMinutes` accept/reject table

Messages, verbatim:

- `TYPE_MESSAGE` = `"estimatedMinutes must be a number or null"`
- `RANGE_MESSAGE` = ``` `estimatedMinutes must be a whole number of minutes between 1 and ${MAX_ESTIMATED_MINUTES}` ``` → `"estimatedMinutes must be a whole number of minutes between 1 and 525600"`

| Input | Result | Produced by |
|---|---|---|
| `150` | `150` | — |
| `1` | `1` | — |
| `525600` | `525600` | — |
| `null` | `null` (clear) | — |
| `undefined` | `null` (clear) | — |
| `0` | `HTTPException(400, RANGE_MESSAGE)` | normalizer |
| `-5` | `HTTPException(400, RANGE_MESSAGE)` | normalizer |
| `90.5` | `HTTPException(400, RANGE_MESSAGE)` | normalizer |
| `NaN` | `HTTPException(400, RANGE_MESSAGE)` | normalizer |
| `Infinity` | `HTTPException(400, RANGE_MESSAGE)` | normalizer |
| `525601` | `HTTPException(400, RANGE_MESSAGE)` | normalizer |
| `999999999` | `HTTPException(400, RANGE_MESSAGE)` | normalizer |
| `"abc"` | 400 at the route (Valibot); `HTTPException(400, TYPE_MESSAGE)` if called directly | validator / normalizer |
| `"150"` | 400 at the route (Valibot); `HTTPException(400, TYPE_MESSAGE)` if called directly | validator / normalizer |
| `true` | 400 at the route (Valibot); `HTTPException(400, TYPE_MESSAGE)` if called directly | validator / normalizer |

Implementation order inside the function: `null`/`undefined` → `null`; `typeof !== "number"` → TYPE_MESSAGE;
`!Number.isInteger(value)` (which is false for `NaN`, `Infinity` and `90.5` alike) or
`value < 1` or `value > MAX_ESTIMATED_MINUTES` → RANGE_MESSAGE; else the value.

`undefined → null` matches the route's `const { estimatedMinutes = null } = ...` destructuring default,
which is the same posture the due-date route takes at L604.

### 5.4 `coerceEstimatedMinutes` (import path)

Never throws. Same accept set as the normalizer; every reject becomes:

```ts
{ estimatedMinutes: null, warning: `Invalid estimatedMinutes ${JSON.stringify(value)} imported as no estimate` }
```

`null` and `undefined` return `{ estimatedMinutes: null }` with **no** warning — an absent estimate is
normal input, not a data problem. The wording mirrors `coerceStatus`'s
`` `Unknown status "${status}" mapped to "planned"` ``.

---

## 6. Web module boundaries

### 6.1 `apps/web/src/types/task/index.ts` (edit) — deviation flagged

```ts
  dueDate: string | null;
  estimatedMinutes?: number | null;
```

**FR-16 specifies `estimatedMinutes: number | null` (required). This plan makes it optional.** Reason:
`Task` is constructed as an object literal in an unknown number of places across the app, including files
*outside* the allowlist (optimistic-update sites, view-model builders) and at least one file inside it
(`apps/web/src/components/task/task-status-popover.test.tsx` L34-49 declares `const task: Task = {...}`).
A required property would fail `pnpm typecheck` at every one of those literals, and the ones outside the
allowlist could not legally be fixed by this run. The optional form matches the two existing optional
members of the same type (`updatedAt?: string`, `assigneeImage?: string | null`), costs nothing — every
consumer in this plan already accepts `number | null | undefined` — and keeps the write contract intact.
**Gate 2 reviewers should confirm this substitution.**

### 6.2 Helper placement — decided, not open

`apps/web/src/lib/**` is **not** in the allowlist (NFR-7). The helpers are needed by both
`components/task/**` (popover trigger labels, popover parse) and `components/kanban-board/**` (card badge,
lane rollup).

**Decision: one module at `apps/web/src/components/task/estimate.ts`, imported by kanban-board via
`@/components/task/estimate`.**

Rejected alternatives:
- `apps/web/src/lib/estimate.ts` — outside the write contract. Not reachable.
- Duplicating format/parse in both component trees — two sources of truth for a rounding rule that must
  agree between the card badge and the lane sum. Rejected outright.
- `apps/web/src/hooks/**` (allowlisted) — these are pure functions, not hooks; parking them there to satisfy
  a path constraint would be worse than an honest cross-directory import.
- Splitting `sumEstimatedMinutes` into `components/kanban-board/column/` — adds a file and separates the
  rounding rule from the sum that depends on it, for no benefit.

**Is `kanban-board/**` → `components/task/**` acceptable?** Yes. Cross-feature-directory imports inside
`components/` are already the local pattern: `column/column-header.tsx` L12 imports
`../../shared/modals/archive-tasks-modal`, and `task-card.tsx` L45-46 imports `../ui/*`. The dependency
direction is board → task-domain, which is the natural direction (a board renders tasks). No cycle is
created: `estimate.ts` imports nothing from the app.

This placement is contract-driven and is recorded here as such (NFR-7, requirements §9.4).

### 6.3 `apps/web/src/components/task/estimate.ts` (new)

Dependency-free. No React, no i18n, no DOM.

```ts
export const MAX_ESTIMATE_MINUTES = 525_600;
export const MAX_ESTIMATE_HOURS = 8_760;
export function formatEstimateHours(minutes: number | null | undefined): string | null;
export function toEstimateHoursInput(minutes: number | null | undefined): string;
export function parseEstimateHours(input: string): number | null | "invalid";
export function sumEstimatedMinutes(
  tasks: ReadonlyArray<{ estimatedMinutes?: number | null }>,
): number | null;
```

`formatEstimateHours` and `toEstimateHoursInput` are both thin wrappers over one private
`hoursString(minutes): string | null` so they can never disagree:

```ts
function hoursString(minutes: number | null | undefined): string | null {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) return null;
  return String(Math.round((minutes / 60) * 100) / 100);
}
```

`formatEstimateHours = (m) => { const h = hoursString(m); return h === null ? null : `${h}h`; }`
`toEstimateHoursInput = (m) => hoursString(m) ?? ""`

`MAX_ESTIMATE_MINUTES` is restated here rather than imported from the API package: the web app has no
build-time dependency on `apps/api` source, and `@kaneo/libs` exports the client, not constants. The two
constants are kept honest by a test assertion (§10) rather than by a shared import.

### 6.4 `apps/web/src/fetchers/task/update-task-estimate.ts` (new)

```ts
import { client } from "@kaneo/libs";

async function updateTaskEstimate(taskId: string, estimatedMinutes: number | null) {
  const response = await client.task.estimate[":id"].$put({
    param: { id: taskId },
    json: { estimatedMinutes },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

export default updateTaskEstimate;
```

Deviation from `update-task-due-date.ts`, which takes `(taskId, task: Task)` and re-derives one field:
this fetcher takes only the two values it sends. Passing a whole `Task` into a single-field endpoint invites
the reader to believe the rest of the object is transmitted. The property accessor is
`client.task.estimate[":id"]` (no bracket needed on `estimate`, unlike `["due-date"]`).

### 6.5 `apps/web/src/hooks/mutations/task/use-update-task-estimate.ts` (new)

```ts
type UpdateTaskEstimateVariables = {
  taskId: string;
  projectId: string;
  estimatedMinutes: number | null;
};
```

`mutationFn: (v) => updateTaskEstimate(v.taskId, v.estimatedMinutes)`.
`onSuccess` invalidates, per FR-18: `["task", taskId]`, `["tasks", projectId]`, `["projects"]`,
`["activities", taskId]`.

`["notifications"]` — present in `use-update-task-due-date.ts` L17-19 — is **omitted**: no event is
published, so no notification can have been produced, and invalidating it would cause a pointless refetch
on every estimate edit. Deviation recorded here.

`["tasks", projectId]` is the key that refreshes the board, which is what makes both the card badge and the
lane rollup correct for the editing client immediately (see ADR-3 for other clients).

### 6.6 `apps/web/src/components/task/task-estimate-popover.tsx` (new)

Props: `{ task: Task; children: React.ReactNode }` — identical to `TaskDueDatePopover`.

Imports: `X`, `useId`/`useState` from react, `useTranslation`, `Button` from `@/components/ui/button`,
`Input` from `@/components/ui/input`, `Popover / PopoverContent / PopoverTrigger` from
`@/components/ui/popover`, `useUpdateTaskEstimate`, `useWorkspacePermission`, `toast` from `@/lib/toast`,
`parseEstimateHours` / `toEstimateHoursInput` from `./estimate`, `type Task` from `@/types/task`.

State: `open: boolean`, `value: string`, `invalid: boolean`.

Contract points that must be preserved verbatim from the due-date sibling:

- `const { canUpdateTasks } = useWorkspacePermission(); const canEdit = canUpdateTasks();`
- **`if (!canEdit) return <>{children}</>;` placed before the `Popover`** — a user without
  `task: ["update"]` gets the trigger rendered inert with zero popover machinery attached.
- `<PopoverTrigger asChild>{children}</PopoverTrigger>`
- `toast.success(t("tasks:popover.estimate.updateSuccess"))` / `toast.error(... ?? t("tasks:popover.estimate.updateError"))`
- `setOpen(false)` on success.

Behaviour:

- `onOpenChange`: when opening, reset `value = toEstimateHoursInput(task.estimatedMinutes)` and
  `invalid = false`. This makes the popover always reflect server state on open, never a stale local edit.
- Submit (form `onSubmit`, so Enter works): `const parsed = parseEstimateHours(value)`. If
  `parsed === "invalid"` → `setInvalid(true)` and **return without dispatching the mutation** (FR-22).
  Otherwise dispatch `{ taskId: task.id, projectId: task.projectId, estimatedMinutes: parsed }`.
  `parsed === null` (empty input) is a legal clear.
- Clear button: rendered only when `task.estimatedMinutes != null`; dispatches `estimatedMinutes: null`.
- The input is `<Input nativeInput type="text" inputMode="decimal" ... />`. `nativeInput` is required:
  `@/components/ui/input` wraps a `@base-ui/react/input` primitive by default, and the `nativeInput` escape
  hatch (L48-54 of that file) is what makes plain `value` / `onChange` React semantics apply.
- Label is bound with `useId()` so the input is reachable by its accessible name in tests and by
  screen readers.

### 6.7 `apps/web/src/components/task/task-properties-sidebar.tsx` (edit ×5)

Three import edits:
1. Add `Clock` to the lucide-react import (L1-9), sorted after `CalendarX`, before `Copy`.
2. Add `import { formatEstimateHours } from "./estimate";` — sorts before `./task-assignee-popover` (L42).
3. Add `import TaskEstimatePopover from "./task-estimate-popover";` — sorts between
   `./task-due-date-popover` (L43) and `./task-labels-popover` (L44).

Three registration edits, one per responsive variant, each appended as the **last** property in its row —
after the `TaskDueDatePopover` block — so the existing property order is unchanged:

| Variant | Marker | Insert after | Trigger className |
|---|---|---|---|
| compact | `{/* Compact mode */}` L141 | L326 | `justify-start h-7 px-1.5 gap-1.5` |
| mobile | `{/* Mobile: Compact-style layout */}` L333 | L517 | `justify-start h-7 px-1.5 gap-1.5` |
| desktop | `{/* Desktop: Title + stacked properties */}` L521 | L710 | `justify-start h-7 px-1.5 gap-1.5 w-full` |

Block (compact/mobile form; desktop adds ` w-full`):

```tsx
{task && (
  <TaskEstimatePopover task={task}>
    <Button
      variant="ghost"
      size="sm"
      className="justify-start h-7 px-1.5 gap-1.5"
    >
      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
      <span
        className={`text-xs font-semibold ${task.estimatedMinutes != null ? "" : "text-muted-foreground"}`}
      >
        {formatEstimateHours(task.estimatedMinutes) ??
          t("tasks:properties.noEstimate")}
      </span>
    </Button>
  </TaskEstimatePopover>
)}
```

This mirrors the start-date trigger (L266-282 / L455-473 / L649-666) exactly, including the
`text-muted-foreground`-when-unset conditional on the `<span>`.

### 6.8 `apps/web/src/components/kanban-board/task-estimate-badge.tsx` (new)

```tsx
type TaskEstimateBadgeProps = { minutes?: number | null };

export function TaskEstimateBadge({ minutes }: TaskEstimateBadgeProps) {
  const { t } = useTranslation();
  const label = formatEstimateHours(minutes);
  if (label === null) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded border border-border/70 bg-muted/55 px-2 py-1 text-[10px] font-medium text-muted-foreground"
      title={t("tasks:properties.estimate")}
    >
      <Clock className="w-3 h-3" />
      <span>{label}</span>
    </span>
  );
}
```

Class list is copied verbatim from the sibling priority badge (`task-card.tsx` L261) so the row stays
visually homogeneous. `w-3 h-3` icon matches the due-date badge icons (L271-277).

**Why a separate component rather than inlining the JSX in `task-card.tsx`:** `TaskCard` pulls
`useSortable` (needs a DnD context), `useNavigate` (needs a router), three zustand stores and two query
hooks. Mounting it in a unit test costs six mocks and tests nothing about the estimate. A presentational
component makes AC-7 a two-line executed assertion. Precedent: `task-labels.tsx` / `task-labels.test.tsx`
in the same directory.

### 6.9 `apps/web/src/components/kanban-board/task-card.tsx` (edit)

One import (`import { TaskEstimateBadge } from "./task-estimate-badge";`, sorted next to `./task-labels`
L48) and one JSX line inside the existing badge row (`<div className="flex items-center gap-1.5">`, L259),
placed after the due-date block closes (after L280) and before the pull-request block (L282):

```tsx
              <TaskEstimateBadge minutes={task.estimatedMinutes} />
```

No user-preference gate. `showPriority` / `showDueDates` / `showLabels` exist because those fields are
always populated and therefore always noisy; an estimate is opt-in per task and renders nothing when unset,
so a preference toggle would be dead weight. Adding one to `useUserPreferencesStore` would also reach
outside the allowlist. When `estimatedMinutes` is `null` or absent the component returns `null` and the
card's DOM is exactly what it is today (FR-24, NFR-1).

### 6.10 `apps/web/src/components/kanban-board/column/column-estimate-total.tsx` (new)

```tsx
type ColumnEstimateTotalProps = {
  tasks: ReadonlyArray<{ estimatedMinutes?: number | null }>;
};

export function ColumnEstimateTotal({ tasks }: ColumnEstimateTotalProps) {
  const { t } = useTranslation();
  const label = formatEstimateHours(sumEstimatedMinutes(tasks));
  if (label === null) return null;
  return (
    <span
      className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
      title={t("tasks:kanban.laneEstimate", { value: label })}
    >
      {label}
    </span>
  );
}
```

Class list is copied verbatim from the existing task-count chip (`column-header.tsx` L62) so the two chips
read as a pair. The structural prop type (not `Task[]`) keeps the component testable with two-field fixtures
and is satisfied by `ProjectWithTasks["columns"][number]["tasks"]`.

### 6.11 `apps/web/src/components/kanban-board/column/column-header.tsx` (edit)

One import (`import { ColumnEstimateTotal } from "./column-estimate-total";`) and one line inside the
existing `<div className="flex min-w-0 items-center gap-2">`, immediately after the count chip (after L64):

```tsx
          <ColumnEstimateTotal tasks={column.tasks} />
```

No new hook, no `useMemo`, no effect, no query key (FR-26, NFR-2). The sum runs inside the header's existing
render pass over an array the component already holds. `ColumnHeader` re-renders exactly when it does today.

---

## 7. Formatting contract

These become test assertions verbatim.

### `formatEstimateHours(minutes: number | null | undefined): string | null`

| Input | Output | Note |
|---|---|---|
| `null` | `null` | |
| `undefined` | `null` | |
| `0` | `null` | defensive: never renders `"0h"`. `0` is unstorable, but a stale client must not paint a zero chip. |
| `-30` | `null` | defensive |
| `NaN` | `null` | defensive |
| `Infinity` | `null` | defensive |
| `20` | `"0.33h"` | 2 dp |
| `90` | `"1.5h"` | trailing zeros stripped by `String(Number)` |
| `120` | `"2h"` | no `.0` |
| `150` | `"2.5h"` | |
| `525600` | `"8760h"` | the bound |
| `1` | `"0.02h"` | smallest storable value still renders non-zero |

Rule: `String(Math.round((minutes / 60) * 100) / 100) + "h"`, guarded by
`typeof === "number" && Number.isFinite && > 0`.

### `toEstimateHoursInput(minutes): string`

Same rule, no `"h"` suffix, `""` instead of `null`: `null → ""`, `0 → ""`, `150 → "2.5"`, `120 → "2"`,
`20 → "0.33"`, `525600 → "8760"`.

### `parseEstimateHours(input: string): number | null | "invalid"`

| Input | Output | Note |
|---|---|---|
| `""` | `null` | clear |
| `" "` | `null` | trims first |
| `"2"` | `120` | |
| `"2.5"` | `150` | |
| `"  2.5  "` | `150` | |
| `"0.25"` | `15` | |
| `"0.1"` | `6` | `Math.round` of `6` exactly (FR-19) |
| `"8760"` | `525600` | the bound, accepted |
| `"0"` | `"invalid"` | |
| `"-1"` | `"invalid"` | |
| `"abc"` | `"invalid"` | `Number("abc")` is `NaN` |
| `"2abc"` | `"invalid"` | `Number` (not `parseFloat`) — no partial parse |
| `"1e9"` | `"invalid"` | numeric and finite, but `6e10` min exceeds the bound |
| `"Infinity"` | `"invalid"` | not finite |
| `"0.001"` | `"invalid"` | rounds to `0` minutes; a positive input that stores nothing is a rejection, not a clear |
| `"8760.5"` | `"invalid"` | over the bound after conversion |

Rule: trim → `""` returns `null` → `Number(trimmed)`; reject `!Number.isFinite` or `<= 0`; convert
`Math.round(hours * 60)`; reject `< 1` or `> MAX_ESTIMATE_MINUTES`; else the integer.

### Round-trip guarantee (asserted in tests)

For every integer `m` in `1..525600`,
`parseEstimateHours(toEstimateHoursInput(m)) === m`. This holds exactly, not approximately: display is
`k = round(5m/3)` hundredths of an hour, so `|3k/5 − m| ≤ 0.3 < 0.5` and `round(k·3/5) = m`. The test
asserts it over a fixed sample (`1, 4, 7, 13, 20, 53, 59, 90, 120, 150, 525600`) rather than a loop.

---

## 8. Rollup contract

```ts
sumEstimatedMinutes(tasks: ReadonlyArray<{ estimatedMinutes?: number | null }>): number | null
```

Rule: accumulate only members whose `estimatedMinutes` is a finite number `> 0`. If none qualified, return
`null`; otherwise return the integer sum. **`null`, not `0`, is the empty signal** (FR-20, requirements §9.3)
— it is what makes `ColumnEstimateTotal` return `null` and render no element.

| Lane | `sumEstimatedMinutes` | `formatEstimateHours` | Header renders |
|---|---|---|---|
| `[]` (empty lane) | `null` | `null` | nothing — no element, no empty span, no `0h` |
| `[{null}, {null}]` | `null` | `null` | nothing |
| `[{}, {}]` (field absent) | `null` | `null` | nothing |
| `[{150}]` | `150` | `"2.5h"` | one chip, `2.5h` |
| `[{150}, {null}, {90}]` | `240` | `"4h"` | one chip, `4h` (AC-8) |
| `[{20}, {20}, {20}]` | `60` | `"1h"` | one chip, `1h` — note the sum is over *minutes*, so three `0.33h` tasks correctly total `1h`, not `0.99h` |

The last row is the reason the sum operates on minutes and formats once at the end: summing formatted hours
would compound the 2-dp rounding error per task. ADR-1.

An all-`null` lane is deliberately indistinguishable from an empty lane for rollup purposes (FR-20).

---

## 9. i18n key plan

Source of truth: **`/home/sangeetha/projects/kaneo/i18n/en-US.json`** (repo-root `i18n/`, *not*
`apps/web/src/i18n/`). Tab-indented. 18 files total, 17 non-default.

### 9.1 New keys — exact values and exact positions

**`tasks.properties`** (object at L1728-1736) — append after `"noDate"` (L1735):

```json
			"estimate": "Estimate",
			"noEstimate": "No estimate"
```

**`tasks.popover`** (object at L1748-1791) — insert a new `estimate` object after the `startDate` block
(closes L1768), before `"labels"` (L1769). Position mirrors the sidebar's property order:

```json
			"estimate": {
				"title": "Estimate (hours)",
				"placeholder": "e.g. 2.5",
				"save": "Save",
				"clear": "Clear estimate",
				"invalid": "Enter hours greater than 0 and up to 8760.",
				"updateSuccess": "Task estimate updated successfully",
				"updateError": "Failed to update task estimate"
			},
```

**`tasks.kanban`** (object at L1884-1886) — append after `"addTask"` (L1885):

```json
			"laneEstimate": "Estimated: {{value}}"
```

Ten keys total. `i18n:check` compares flattened key *sets*, so position does not affect the check; position
is chosen for review readability and to keep siblings adjacent.

No new namespace. No new top-level key. `tasks.popover.estimate.updateSuccess` / `updateError` deliberately
mirror the wording of `tasks.popover.dueDate.*` (L1760-1761).

The `"h"` suffix emitted by `formatEstimateHours` is treated as a formatting symbol, not copy (FR-29). If
Gate 2 disagrees it becomes an eleventh key, `tasks.properties.hoursSuffix`, consumed inside `estimate.ts`
via an injected argument — flagged, not assumed.

### 9.2 Guarded propagation to the other 17 locales (AC-16, binding)

`pnpm i18n:check:fix` backfills missing keys **with the English value**, which is exactly what Gate 1 OQ-3
asked for — and it will also backfill *unrelated* pre-existing gaps, which AC-16 forbids. Procedure, in
order, no step skippable:

1. **Before any i18n edit**, confirm `i18n/` is clean (`git status --short i18n/` empty) and capture the
   pre-run baseline: run `pnpm i18n:check` and save its full output to the run directory. This output is
   the evidence for AC-16 — every key it reports as missing/extra *before* the run is a pre-existing gap
   that must not appear in the final diff.
2. Edit **only** `i18n/en-US.json` with the 10 keys above.
3. Run `pnpm i18n:check:fix`.
4. `git diff --stat i18n/` — expect 18 files changed (en-US plus 17).
5. `git diff i18n/` and read every hunk. Each non-default locale must show **exactly** the 10 added keys
   with English values and nothing else. Revert any other added or removed line, by hand, hunk by hunk.
   Cross-check the reverted set against the step-1 baseline.
6. If the fix reformatted the files (indentation drift — drizzle-style 2-space vs the repo's tabs), run
   `pnpm exec biome format --write i18n/` and re-read the diff. Scoped to `i18n/` only; never repo-wide,
   never `pnpm lint`.
7. Re-run `pnpm i18n:check` → OK for all 17 (AC-9).

No translation is authored by the model into any non-English locale (Gate 1 OQ-3): nobody in this session
can review `zh-CN` or `el-GR`, so machine-authored strings would ship unverified.

---

## 10. Test plan

Two runners, both already configured; no config file is touched.

- API: `apps/api/vitest.config.ts` — `environment: node`, `include: ["../../tests/api/**/*.test.ts"]`.
  Tests import source directly with a repo-root-relative path (e.g.
  `import { ... } from "../../../apps/api/src/task/estimated-minutes";` from `tests/api/task/`).
  **This suite has no database**, which is why §5.1 puts the validator in its own module.
- Web: `apps/web/vitest.config.ts` — `environment: jsdom`, `setupFiles: ["./src/test/setup.ts"]`
  (jest-dom matchers only), `include: ["src/**/*.test.{ts,tsx}"]`, aliases `@ → ./src`, `@i18n → ../../i18n`.
  Component tests mock `react-i18next` with `useTranslation: () => ({ t: (key: string) => key })`, per
  `task-status-popover.test.tsx` L30-32, and `cleanup()` in `afterEach`.

### 10.1 Executed tests

| # | File | Framework | Asserts | AC |
|---|---|---|---|---|
| T1 | `tests/api/task/estimated-minutes.test.ts` | vitest/node | `normalizeEstimatedMinutes` returns `150/1/525600` unchanged; `null`/`undefined` → `null`; throws `HTTPException` with `status === 400` for `0, -5, 90.5, NaN, Infinity, 525601, 999999999, "abc", "150", true`; the thrown message matches the two verbatim strings in §5.3; `MAX_ESTIMATED_MINUTES === 525600` | AC-3, AC-10 |
| T2 | `tests/api/task/estimate-import-export.test.ts` | vitest/node | `coerceEstimatedMinutes` never throws; `[150, null, 90]` map to `[150, null, 90]` with no warnings; `0 / -5 / 90.5 / "abc" / 525601` each map to `null` **with** a warning; a simulated export→import cycle over the three values is lossless | AC-14 |
| T3 | `apps/web/src/components/task/estimate.test.ts` | vitest/jsdom | Every row of the `formatEstimateHours`, `toEstimateHoursInput` and `parseEstimateHours` tables in §7, verbatim; the round-trip sample; `MAX_ESTIMATE_MINUTES === 525_600` (keeps the web bound pinned to the API bound); every row of the `sumEstimatedMinutes` table in §8 | AC-10 |
| T4 | `apps/web/src/components/kanban-board/task-estimate-badge.test.tsx` | vitest/jsdom + RTL | `<TaskEstimateBadge minutes={150} />` renders visible text `2.5h`; `minutes={null}` and `minutes={undefined}` render **nothing** (`container.firstChild` is `null`) | AC-7 |
| T5 | `apps/web/src/components/kanban-board/column/column-estimate-total.test.tsx` | vitest/jsdom + RTL | `tasks={[]}` → no element; `[{null},{null}]` → no element; `[{150}]` → `2.5h`; `[{150},{null},{90}]` → `4h` | AC-8 |

Commands: `pnpm --filter @kaneo/api test`, `pnpm --filter @kaneo/web test` (AC-10);
`pnpm typecheck` for `@kaneo/api` and `@kaneo/web` (AC-11);
`pnpm exec biome check <changed paths>` — scoped, never `biome ci .`, which is pre-existing red on this
branch for unrelated reasons (NFR-6, AC-12).

### 10.2 Affected existing tests

- `apps/web/src/components/task/task-status-popover.test.tsx` — declares `const task: Task = {...}`
  (L34-49). With `estimatedMinutes` **optional** (§6.1) this file needs **no change** and continues to pass.
  If Gate 2 overrules §6.1 and makes the field required, this file must gain `estimatedMinutes: null` and a
  repo-wide search for other `Task` literals becomes a prerequisite — several of which may sit outside the
  allowlist. This is the concrete cost of the required-vs-optional call.
- No other existing test touches `taskTable`, the task routes, the card, or the column header.

### 10.3 Verified by inspection, not executed — stated plainly

- **AC-4 / OQ-4: no executed test covers the middleware chain on `PUT /task/estimate/:id`.**
  `tests/api-integration/**` is outside the write contract and the allowlist is frozen (Gate 1 OQ-4:
  "do not widen the allowlist"). Authorization is verified by reading `apps/api/src/task/index.ts` and
  confirming `workspaceAccess.fromTask()` precedes `requireWorkspacePermission({ task: ["update"] })`.
  **A regression that deleted `requireWorkspacePermission` from that route would pass every check this run
  performs** — typecheck, scoped biome, API unit tests and web tests alike. This is a deliberate choice with
  a stated cost, not an environmental limitation: this branch has a fresh empty `kaneo_opus_only` database
  and a real integration test could have run here; benchmark consistency was chosen over the opportunity.
  The final report must repeat this.
- **AC-1** — migration content and journal index: read the generated `.sql` and `_journal.json`, then run
  `pnpm --filter @kaneo/api db:migrate` against `kaneo_opus_only`.
- **AC-2** — persistence of `150` / `null` end to end: covered structurally (route → normalizer → controller
  `.set()`), each link unit-tested or read; no executed HTTP test exists for the same reason as AC-4.
- **AC-6** — the three sidebar variants: verified by reading the three inserted blocks; a full sidebar render
  test would need `useGetTask`, `useGetProject`, `useGetColumns`, `useGetLabelsByTask`, two integration
  hooks, `useGetProjects` and `useGetActiveWorkspaceUsers` mocked, which tests the mocks, not the feature.
- **AC-14 full-stack** — T2 covers the shaping/coercion boundary, which is the part that can drop data. The
  DB-backed export→import cycle itself is inspected (export projection line, import `.values()` line).
- **AC-15** — read `PUT /task/:id`'s `.set()` and confirm `estimatedMinutes` does not appear.
- **AC-13 / AC-16** — `git status` and `git diff` review at the end of the run.

---

## 11. ADRs

### ADR-1 — Store minutes, interact in hours

**Context.** Users think in hours and half-hours; `2.5` must be typeable. Storage must be exact and summable.
A `numeric`/`real` hours column would make `[0.1, 0.1, 0.1]` sum to `0.30000000000000004` and would force a
decimal type decision into the schema.
**Decision.** `integer` minutes in the database and in every payload (API, export, import, WebSocket-adjacent
code). Hours exist only at the UI boundary: `parseEstimateHours` on input, `formatEstimateHours` on output.
Sums are always over minutes, formatted once at the end.
**Consequences.** Exact arithmetic; a lane of three `0.33h` tasks correctly shows `1h`, not `0.99h`.
Display is 2-dp lossy in the hours direction, but minutes→display→minutes round-trips exactly for all
`1..525600` (§7). Anyone reading the API payload sees `150`, not `2.5`, and must know the unit — mitigated by
the field name `estimatedMinutes` carrying the unit.
**Rejected.** `numeric(6,2)` hours (float summation, decimal-type sprawl); an ISO-8601 duration string
(unsummable without a parser, unindexable, over-engineered for one integer).

### ADR-2 — Dedicated `PUT /task/estimate/:id`, not a wider full-update body

**Context.** `PUT /task/:id` already accepts most task fields. Adding `estimatedMinutes` there would be one
line of route change instead of ~90 lines of new route + controller.
**Decision.** A dedicated endpoint modelled on `PUT /task/due-date/:id`, and `PUT /task/:id` left completely
alone (Gate 1 OQ-2).
**Consequences.** The API surface grows by one route, matching the five single-field siblings already there
(`due-date`, `title`, `description`, `priority`, `assignee`) — this *is* the local pattern, not a deviation.
Because the full-update `.set()` never mentions `estimatedMinutes`, a full update **preserves** the estimate;
in particular the column-header "archive all" path (`useUpdateTask` per task) does not wipe a lane's
estimates. That preserve-by-omission behaviour is intentional and is pinned by AC-15 so a later reader does
not "fix" it. The cost is a second code path to keep in sync if the field ever grows rules.
**Rejected.** Widening the full-update body — a larger blast radius on the busiest write path in the app,
and it would have made "clear the estimate" ambiguous with "field omitted".

### ADR-3 — Omit `publishEvent`; accept a non-realtime lane rollup

**Context.** Every sibling single-field controller (`due-date`, `priority`, `title`, `assignee`) ends with a
`publishEvent(...)` that drives activity, notifications, integrations and WebSocket fan-out. `activitySchema`'s
`type` is a **closed picklist** (`comment, task, status_changed, priority_changed, unassigned,
assignee_changed, due_date_changed, title_changed, description_changed, create`) with no estimate-shaped
member.
**Decision.** No `publishEvent` in `update-task-estimate.ts` (Gate 1 OQ-5, FR-11). No activity type, no
notification, no webhook payload change.
**Consequences.** Two costs, both of record and both to be restated in the final report:
(1) **The lane rollup is not realtime for other viewers** — a teammate with the board open sees the previous
lane total until their next refetch. The editing client is immediately correct because its mutation hook
invalidates `["tasks", projectId]` (FR-18).
(2) **This is the one single-field update controller in the codebase that publishes nothing**, and a reader
comparing it to `update-task-due-date.ts` will notice the missing call. A comment in the controller stating
the constraint (not narrating the code) is warranted.
**Rejected.** Adding an `estimate_changed` member to the picklist — widening a closed schema means touching
`activitySchema`, the activity renderer, 18 locale files and the notification mapper, which is well outside
the brief. Publishing an existing type such as `task` — dishonest event data that would render as a wrong
activity line.

### ADR-4 — Helpers colocated in `components/task/`, forced by the write contract

**Context.** `formatEstimateHours` / `parseEstimateHours` / `sumEstimatedMinutes` are pure functions with no
React dependency. Their natural home in this repo is `apps/web/src/lib/`, next to `lib/format.ts`,
`lib/due-date-status.ts` and `lib/priority.ts`. `apps/web/src/lib/**` is **not** in the frozen allowlist.
**Decision.** One module at `apps/web/src/components/task/estimate.ts`, imported by the kanban-board tree via
`@/components/task/estimate`. Decided, not left open (§6.2).
**Consequences.** A pure-logic module lives in a component directory, which is inconsistent with the four
existing `lib/` helpers — a real, visible wart. It creates a `kanban-board → components/task` import edge,
which is acceptable: cross-feature imports inside `components/` are already the local pattern
(`column-header.tsx` L12 → `../../shared/modals/…`) and the direction board→task-domain is the natural one.
No cycle: `estimate.ts` imports nothing. If the contract is ever widened, the move to `lib/` is a rename plus
three import updates.
**Rejected.** Duplicating the helpers in both trees (two sources of truth for a rounding rule that the badge
and the lane sum must agree on); parking them under the allowlisted `apps/web/src/hooks/**` (they are not
hooks — mislabelling code to satisfy a path constraint is worse than an honest import).

### ADR-5 — `null`, not `0`, as the rollup's empty signal

**Context.** `sumEstimatedMinutes` could return `0` for a lane with no estimates and let the header test
`> 0`. That conflates "nobody estimated anything" with "the estimates sum to zero" and puts the
render decision in the caller.
**Decision.** `sumEstimatedMinutes` returns `null` when no task in the lane carries a non-null estimate.
`formatEstimateHours(null)` returns `null`. `ColumnEstimateTotal` returns `null`. The header renders no
element at all — not an empty span, not a `0h` chip (FR-20, FR-25, requirements §9.3).
**Consequences.** The "render nothing" decision is made once, in a pure function, and is directly testable
(T5). An all-`null` lane is indistinguishable from an empty lane for rollup purposes, which is the required
behaviour. Every existing board — where all lanes are all-`null` after the migration — renders byte-identical
to today (NFR-1). The `number | null` return type forces every caller to handle the empty case explicitly.
**Rejected.** Returning `0` and testing `> 0` at each call site (two call sites today, N tomorrow, each free
to get it wrong); returning `0` and rendering `0h` (visual noise on every lane of every existing board — the
single most likely way this feature regresses a quiet UI).

### ADR-6 — `estimatedMinutes` optional on the web `Task` type

**Context.** FR-16 specifies `estimatedMinutes: number | null`. `Task` is instantiated as an object literal
across the web app, including in files outside the allowlist and in at least one existing test inside it.
**Decision.** Declare `estimatedMinutes?: number | null`, matching the two existing optional members of the
same type (`updatedAt?`, `assigneeImage?`).
**Consequences.** `pnpm typecheck` (AC-11) stays green without editing files the write contract forbids.
Every consumer in this plan already accepts `number | null | undefined`, so no behaviour changes. The cost is
one bit of type precision: a `Task` built by hand can silently omit the field, and TypeScript will not
complain — acceptable, because `undefined` and `null` are treated identically everywhere downstream.
**Rejected.** The required form — correct in isolation, but it would either fail typecheck at literals this
run may not legally touch, or force the run to reach outside the allowlist. Correctness of the contract loses
to correctness of the contract *boundary*.

---

## 12. Risks and rollback

| Risk | Likelihood | Mitigation |
|---|---|---|
| **Existing boards change appearance.** A `0h` chip on every lane, or an empty span shifting the flex gap. | Low | ADR-5: `null` propagates all the way to a `return null`. T4 and T5 assert absence, not just presence. |
| **Migration generated against a drifted local schema**, emitting statements for unrelated tables. | Medium | §3.3: the packet reads the generated `.sql` before accepting it and stops on anything beyond the single `ALTER TABLE ... ADD COLUMN`. |
| **Migration run against the wrong database.** `kaneo` is one migration ahead from a sibling branch. | Medium | `kaneo_opus_only` only, stated in §3.3 and in the run's standing constraints. |
| **`i18n:check:fix` backfills unrelated pre-existing gaps** into 17 locales. | High | §9.2 steps 1/5: pre-run baseline captured, post-run diff read hunk by hunk, unrelated backfill reverted. AC-16. |
| **`i18n:check:fix` reformats all 18 locale files** (indentation drift), producing an unreviewable diff. | Medium | §9.2 step 6: scoped `biome format --write i18n/`, then re-read the diff. |
| **Typecheck breakage from a required `Task` field.** | Medium | ADR-6: field is optional. |
| **`Input` primitive ignores plain `value`/`onChange`.** `@/components/ui/input` wraps `@base-ui/react/input` unless `nativeInput` is set. | Medium | §6.6 mandates `nativeInput`. |
| **Popover shows a stale local value** after an external update. | Low | §6.6: `value` is reset from `task.estimatedMinutes` on every open. |
| **Task-heavy boards regress.** | Low | NFR-2: the rollup is one `O(tasks in lane)` pass over an in-memory array inside the header's existing render. No new query key, no new effect, no memo needed, no new network call. Watch the board's interaction latency on a lane of 500+ tasks — the added work is one array reduce, orders of magnitude below the existing card render cost. |
| **Other viewers see a stale lane total** after someone edits an estimate. | Certain (by design) | ADR-3. Accepted and reported, not mitigated. |
| **Authorization regression on the new route goes undetected.** | Certain (by design) | §10.3 / Gate 1 OQ-4. Accepted and reported, not mitigated. |

**Rollback.** Drizzle-kit emits no down-migrations. Reversing this change on a deployed instance is:
1. Deploy the previous application build (the API stops reading and writing the column; the web bundle stops
   rendering it).
2. `ALTER TABLE "task" DROP COLUMN "estimated_minutes";` — also catalog-only, and the only step that loses
   data. Take it only if the column must go; a nullable unread integer column is otherwise harmless to leave
   in place.
3. In the repo, delete `apps/api/drizzle/0043_<tag>.sql` and `meta/0043_snapshot.json`, and remove the
   `idx: 43` entry from `_journal.json`.

Step 2 is destructive and irreversible; steps 1 and 3 are not. Prefer reverting the code and leaving the
column.

---

## 13. Off-limits reminders

The intent touches nothing under `off_limits`, but three adjacencies are worth naming:

- **`biome.json` and `.gitignore` are off-limits** and `pnpm exec biome ci .` is **pre-existing red** on this
  branch. Verification is `pnpm exec biome check <changed paths>` only. Do not fix the pre-existing red and
  do not attribute it to this run (NFR-6).
- **Never `pnpm lint`** (root or package): it runs Biome with `--write` across the repo and rewrites
  unrelated files. The only `--write` invocations sanctioned here are the two scoped ones in §3.3 and §9.2
  step 6.
- **`apps/docs/**`, `apps/site/**`, `charts/**` are off-limits.** This feature ships without user
  documentation as a consequence; if Gate 2 wants docs, the write contract must be widened first.
- `pnpm-lock.yaml` must not change — this plan adds **zero** dependencies. `.env` must not change — this plan
  adds **zero** environment variables.

---

## 14. Cross-cutting sequencing

Packet order. Each packet must be independently green on typecheck before the next starts.

| Packet | Contents (inventory #) | Blocks / blocked by |
|---|---|---|
| **P1** schema + migration | 1, 2, 3, 4 | Nothing depends on runtime here, but every API packet's typecheck needs `taskTable.estimatedMinutes` to exist. **First.** |
| **P2** validation module + API test | 5, 6 | Needs nothing. Can run in parallel with P1. Blocks P3 (route imports the normalizer) and P4 (import uses the coercer). |
| **P3** schema/route/controller/read projections | 7, 8, 9, 10, 11 | Needs P1 (column) + P2 (normalizer). Blocks P5 — the typed `@kaneo/libs` client cannot resolve `client.task.estimate` until this route exists. |
| **P4** import/export + round-trip test | 12, 13, 14 | Needs P1 + P2. Independent of P3; can run in parallel. |
| **P5** web data plumbing | 15, 16, 17 | Needs P3. Blocks P8. |
| **P6** web helper module + test | 18, 19 | Needs nothing. Can run any time after P1. Blocks P8 and P9. |
| **P7** i18n | 20, 21 | Needs nothing. Must land **before** P8/P9 for correct runtime copy; component tests mock `useTranslation` and so do not depend on it. Its guarded procedure (§9.2) makes it a poor parallel neighbour — run it alone. |
| **P8** popover + sidebar registration | 22, 23 | Needs P5 (hook) + P6 (helpers) + P7 (keys). |
| **P9** board display | 24, 25, 26, 27, 28, 29 | Needs P6 (helpers) + P7 (keys) + P5 (the `Task` type field). Independent of P8. |

Hard ordering constraints, restated as one line each:

- **P1 before every API packet** — nothing else typechecks without the column.
- **P2 before P3 and P4** — both import from `estimated-minutes.ts`.
- **P3 before P5** — the typed client is generated from the API's route type; the fetcher will not compile
  until `PUT /task/estimate/:id` is on the Hono chain.
- **P6 before P8 and P9** — both trees import `./estimate` / `@/components/task/estimate`.
- **P7 before P8 and P9** at runtime; not a test-time dependency.
- **P8 and P9 are independent of each other** and can be planned in either order.

---

## 15. Explicit non-goals

Restated verbatim so packet planning cannot drift (requirements §2):

1. No link to `timeEntryTable` tracked time. No estimate-vs-actual comparison anywhere.
2. No estimate field in the create-task modal.
3. No project-, workspace- or board-level totals outside the lane header.
4. No estimate history, no activity type, no notification, no webhook payload change.
5. No changes to gitea/github sync, MCP tools, or the published `packages/mcp` surface.
6. No sorting or filtering of tasks by estimate; `get-tasks.ts`'s `sortBy` union is untouched.
7. **No `estimatedMinutes` on the full-task `PUT /task/:id` body.** Deliberate, confirmed at Gate 1 (OQ-2),
   pinned by AC-15. Preserve-by-omission is the chosen behaviour.
8. No index on `estimated_minutes`.
9. No new permission string, no change to `@kaneo/permissions`, no built-in role change.
10. No new dependency, no new environment variable, no config change.
11. No user documentation (`apps/docs/**` and `apps/site/**` are off-limits), no Helm or Docker change.
12. No widening of the write contract, and no unrunnable test staged anywhere (Gate 1 OQ-4).

---

## 16. Orchestrator corrections to this plan (post-architect, pre-Gate-2)

Three defects found while verifying the plan against the repo. The architect could not have caught
the second and third: the evidence for them was measured *after* it was dispatched
(`baseline-notes.md`). §9 is superseded by this section where the two conflict.

### C-1 — The locale count is **16 non-default, not 17**

`i18n/` holds 18 `.json` files, but one of them is `schema.json`, which
`scripts/i18n/shared.mjs:getLocaleFiles()` explicitly excludes (`entry.name !==
path.basename(schemaPath)`). So: **17 locale files, 16 of them non-default.**

- §9 heading "the other 17 locales" → **16**.
- §9.2 step 4 "expect 18 files changed" → **17** (`en-US` + 16).
- §9.2 step 7 "OK for all 17" → see C-3; the count is 16 and the criterion is wrong anyway.
- Inventory row 21 "`i18n/<17 locales>.json`" → **16**.

Consistent with the measured `pnpm i18n:check` output, which enumerates exactly 16 locales.

### C-2 — `i18n/schema.json` must be regenerated; the plan omits it entirely

`i18n/schema.json` (170 KB) is **generated** by `pnpm i18n:schema`
(`node ./scripts/i18n/schema.mjs && biome format --write i18n/schema.json`), which derives it from
`en-US` and emits `"additionalProperties": false` plus an explicit `required: [...]` at **every**
level of the tree.

Consequence of omitting it: after adding 10 keys to `en-US.json` and the 16 locales, **every locale
file becomes invalid against the schema the repo generates for it** — the new keys are exactly the
`additionalProperties` the schema forbids, and they are absent from every `required` list. Editors
and any consumer validating against `$id: https://kaneo.app/i18n/schema.json` would flag them.

**Add to the inventory as row 20b**, immediately after the `en-US.json` edit and before the
propagation step:

| # | Path | Kind | Change | FRs | ~LoC |
|---|---|---|---|---|---|
| 20b | `i18n/schema.json` | `patch_apply` (generated) | Regenerate via `pnpm i18n:schema` after `en-US.json` gains the 10 keys. Never hand-edited. | FR-27, FR-28 | generated |

`i18n/schema.json` is inside the allowlist (`i18n/*.json`), so no contract change is needed. The
command's `biome format --write` is scoped to that single file — it is not `pnpm lint` and does not
touch anything else.

### C-3 — §9.2's procedure is unsafe here, and its exit criterion is unachievable

§9.2 assumes `pnpm i18n:check` is green at `5d1fc910`. **It is not.** Measured baseline
(`i18n-baseline-before.txt`, `i18n-baseline-md5.txt`): **324 missing keys across all 16 non-default
locales. Zero locales report OK.** Two pre-existing clusters:

1. `common:error.*` — 15 keys absent from `vi-VN` and `zh-CN`.
2. i18next **plural-suffix** keys (`_one` / `_few` / `_many` / `_other`) across `tasks:bulk.*`,
   `tasks:archive.*`, `notifications:*`, `settings:*`, `workspace:search.*`. `check.mjs` compares
   flattened key sets literally and has no notion of per-locale CLDR plural categories, so it
   demands `_few` / `_many` from locales whose plural set does not contain them.

Two things follow.

**(a) §9.2 steps 3–5 are rejected.** `pnpm i18n:check:fix` would backfill all 324 pre-existing keys
into 16 locales — roughly **5,000 added lines**, ~30× the feature itself — writing English prose
into `zh-CN`, `ko-KR`, `ru-RU` and the rest, *and* inventing grammatically wrong plural forms that
the checker only believes are missing. Step 5's "revert any other added line, by hand, hunk by hunk"
is not a credible control over a diff that size, and the failure mode is silent.

**Replacement procedure — additive, not subtractive:**

1. Capture the pre-run baseline. **Already done**: `i18n-baseline-before.txt` (full `i18n:check`
   output) and `i18n-baseline-md5.txt` (per-file checksums of all 17 locale files). This is the
   evidence AC-16 is checked against.
2. Edit **only** `i18n/en-US.json`, adding the 10 keys of §9.1.
3. Run `pnpm i18n:schema` (C-2).
4. Propagate with a **run-local guarded script** under
   `.sdlc/runs/<run-id>/` that imports the repo's own `scripts/i18n/shared.mjs` and calls
   `loadLocales` / `setValueAtKey` / `writeJson` for **exactly the 10 new key paths and nothing
   else**. Output is byte-identical to what `--fix` would have written *for those keys* — same
   helpers, same English source values, same tab-indented `writeJson` — while being structurally
   incapable of touching the other 324. The script is run bookkeeping, not user source, so it needs
   no allowlist entry and ships as an auditable artifact of the run.
5. Verify: `git diff --stat i18n/` shows **17** files (16 locales + `en-US`) plus `schema.json`, and
   `git diff i18n/` shows **only** the 10 keys per locale. Then re-run `pnpm i18n:check` and diff
   its output against `i18n-baseline-before.txt` — the two must be **identical**.

Step 5's final comparison is the real control, and it is exact: it does not ask anyone to eyeball
5,000 lines, it asserts that the checker's complaint is *unchanged*.

**(b) AC-9 as written is unachievable and is corrected.** "`pnpm i18n:check` reports OK for all
locales" cannot be reached without fixing 324 unrelated keys — outside this ticket, and against
AGENTS.md's "stay focused" and "do not mix requested work with unrelated cleanup". §9.2 step 7 is
struck. The corrected criterion, already recorded in `requirements.md` and `baseline-notes.md`:

> **AC-9 (corrected):** `pnpm i18n:check` output after the run is **byte-identical** to
> `i18n-baseline-before.txt`. The 324 pre-existing gaps are neither fixed nor widened, and this run
> introduces no new missing or extra key in any locale.

This is strictly stronger than "OK for all locales" would have been as a *regression* check, and it
is honest about a red the run neither caused nor is licensed to fix — the same posture already taken
for `pnpm exec biome ci .` (NFR-6).

### Items explicitly NOT changed

The architect's three flagged deviations stand, and I verified each:

- **`Task.estimatedMinutes` optional (§6.1, ADR-6).** Verified: `Task` object literals exist at
  `apps/web/src/components/task/task-status-popover.test.tsx` (allowlisted) **and**
  `apps/web/src/components/list-view/task-row.test.tsx` (**not** allowlisted). A required field
  would fail `pnpm typecheck` at a file this run cannot legally edit. The deviation from FR-16 is
  forced by the write contract, not chosen. Accepted.
- **Two extracted presentational components (§6.8, §6.10).** Turns AC-7 and AC-8 into executed
  assertions; precedent is `task-labels.tsx` + `task-labels.test.tsx`, whose test renders the leaf
  with no providers at all. Accepted.
- **`["notifications"]` dropped from the mutation hook's invalidations.** Correct: no event is
  published (ADR-3), so no notification can exist to invalidate. Accepted.

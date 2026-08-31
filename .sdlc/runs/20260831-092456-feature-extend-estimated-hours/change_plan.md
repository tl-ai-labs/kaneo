# Architecture Design & Delta Change Plan — Estimated Hours on Tasks with Per-Lane Rollup

**Module:** `estimated-hours`  
**Run ID:** `20260831-092456-feature-extend-estimated-hours`  
**Target File:** `.sdlc/runs/20260831-092456-feature-extend-estimated-hours/change_plan.md`  

---

## 1. Decisions and Rationale (ADR-style)

### ADR-1: Storage Unit — Integer Minutes (`estimated_minutes`)
- **Decision:** Store task estimates in the database as a nullable integer representing total minutes (`estimatedMinutes` / `estimated_minutes`).
- **Rationale:** Storing durations in minutes as integers avoids floating-point rounding errors and precision issues during lane rollup summations. It aligns with standard time arithmetic while keeping the schema simple. Null indicates that no estimate has been set.
- **FR-3 Defect Correction:** The original requirements specification in FR-3 was defective: it defined the read-path response schema as `v.optional(v.nullable(v.number()))`, which inadvertently admitted non-integer/fractional values (e.g. `2.5`) on read while FR-4 strictly constrained the write path to integer minutes (`0 <= minutes <= 525600`). This change plan explicitly tightens `taskSchema.estimatedMinutes` to an integer schema (`v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(525600))))`), guaranteeing consistency between write validation and read projections.

### ADR-2: Dedicated Single-Field Endpoint Shape (`PUT /estimated-minutes/:id`)
- **Decision:** Expose a dedicated endpoint `PUT /estimated-minutes/:id` on `apps/api/src/task/index.ts` rather than modifying `updateTask` in `apps/api/src/task/controllers/update-task.ts`.
- **Rationale:** Kaneo's established architecture strictly follows single-property discrete mutation routes (e.g., `PUT /status/:id`, `PUT /priority/:id`, `PUT /due-date/:id`, `PUT /assignee/:id`, `PUT /title/:id`). The general `updateTask` function already has 11 positional arguments, and extending it violates clean separation. The field-first route convention produces `PUT /estimated-minutes/:id` with client RPC `client.task['estimated-minutes'][':id'].$put`. In accordance with non-goals, the controller does not invoke `publishEvent`.

### ADR-3: Validation Placement — Pure Helper Extraction
- **Decision:** Extract input validation logic into a pure, exported validation helper `assertValidEstimatedMinutes` in `apps/api/src/task/validate-task-fields.ts` alongside `assertValidPriority`.
- **Rationale:** The API test suite (`tests/api/`) operates in a pure Node environment without an HTTP server or database harness. Placing validation logic in a pure exported helper enables thorough unit test coverage under `tests/api/task/validate-task-fields.test.ts` without out-of-scope integration harnesses.

### ADR-4: Badge & UI Format — Decimal Hours (e.g., `150m -> '2.5h'`, `120m -> '2h'`)
- **Decision:** Display task card badges and column header rollups in decimal hours, stripping redundant `.0` suffixes (e.g., `150` minutes renders as `2.5h`, `120` minutes renders as `2h`).
- **Rationale:** Concise decimal representation is faster to scan on kanban cards than compound formats (`2h 30m`). Task card badges render unconditionally whenever `task.estimatedMinutes` is set and positive, without introducing an extra user preferences store toggle.

### ADR-5: Column Header Rollup Placement — Client-Side In-Memory Aggregation
- **Decision:** Compute lane totals by summing `task.estimatedMinutes` directly across `column.tasks` in `ColumnHeader`.
- **Rationale:** `ColumnHeader` already receives `column.tasks` in scope to display `{column.tasks.length}`. Calculating the sum on the client takes $O(N)$ time with no additional database queries or network roundtrips. When the lane sum is 0 or all tasks lack estimates, the rollup is omitted from the UI.

### ADR-6: Internationalization (i18n) Key Layout
- **Decision:** Place all UI copy under structured namespaced keys in `i18n/en-US.json` and synchronize to all 17 locale JSON files.
- **Rationale:** Conforms to Kaneo's translation structure: `tasks:properties.estimatedHours` for property labels, `tasks:popover.estimatedHours.*` for popover interaction strings and toast notifications, and `tasks:kanban.estimatedHoursRollup` for rollup accessibility/labels. `i18n/schema.json` and `i18n/resources.ts` remain strictly untouched.

---

## 2. Data Model Delta

### Drizzle Schema Modification
In `apps/api/src/database/schema.ts`, add the `estimatedMinutes` column to `taskTable`:

```typescript
export const taskTable = pgTable(
  "task",
  {
    // ... existing columns
    priority: text("priority").default("low").notNull(),
    estimatedMinutes: integer("estimated_minutes"),
    startDate: timestamp("start_date", { mode: "date" }),
    // ...
  },
  // ... indexes
);
```

### Exact Migration Command
Generate the SQL migration and metadata journal update:
```bash
pnpm --filter @kaneo/api db:generate
```

Generated SQL statement:
```sql
ALTER TABLE "task" ADD COLUMN "estimated_minutes" integer;
```

---

## 3. API Contract

### Route Definition
- **Method & Path:** `PUT /estimated-minutes/:id`
- **Client RPC Call:** `client.task['estimated-minutes'][':id'].$put({ param: { id }, json: { estimatedMinutes } })`

### Valibot Validators
- **Param Validator:**
  ```typescript
  validator("param", v.object({ id: v.string() }))
  ```
- **JSON Body Validator:**
  ```typescript
  validator(
    "json",
    v.object({
      estimatedMinutes: v.nullable(
        v.pipe(
          v.number(),
          v.integer(),
          v.minValue(0),
          v.maxValue(525600)
        )
      ),
    })
  )
  ```

### Middleware Chain (In Strict Execution Order)
1. `describeRoute({ operationId: "updateTaskEstimatedMinutes", tags: ["Tasks"], description: "Update estimated minutes of a task", responses: { 200: { description: "Task estimated minutes updated successfully", content: { "application/json": { schema: resolver(taskSchema) } } } } })`
2. `validator("param", v.object({ id: v.string() }))`
3. `validator("json", v.object({ estimatedMinutes: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(525600))) }))`
4. `workspaceAccess.fromTask()`
5. `requireWorkspacePermission({ task: ["update"] })`
6. `requireEntitlement`
7. Route Handler:
   ```typescript
   async (c) => {
     const { id } = c.req.valid("param");
     const { estimatedMinutes } = c.req.valid("json");
     const currentUserId = c.get("userId");
     const task = await updateTaskEstimatedMinutes({ id, estimatedMinutes, currentUserId });
     return c.json(task);
   }
   ```

### Request & Response Payload Shapes
- **Request Body:**
  ```json
  {
    "estimatedMinutes": 150
  }
  ```
  *(or `{"estimatedMinutes": null}` to clear)*
- **Response Body (200 OK):**
  Full serialized `Task` object matching `taskSchema` containing `estimatedMinutes: 150` (or `null`).
- **HTTP Status Codes:**
  - `200 OK`: Updated task returned successfully.
  - `400 Bad Request`: Payload validation failed (float, negative number, exceeding 525,600, or invalid type).
  - `401 Unauthorized`: Missing or invalid authentication session.
  - `403 Forbidden`: User lacks `task: ["update"]` permission on workspace.
  - `404 Not Found`: Task with specified `id` does not exist.
  - `500 Internal Server Error`: Database update error.

---

## 4. Module-by-Module File Plan

| File Path | New or Edit | What Changes | Depends On |
| :--- | :--- | :--- | :--- |
| `apps/api/src/database/schema.ts` | Edit | Add `estimatedMinutes: integer("estimated_minutes")` to `taskTable` definition. | None |
| `apps/api/drizzle/` | New | Generate migration SQL (`ALTER TABLE "task" ADD COLUMN "estimated_minutes" integer;`) and update `meta/_journal.json` snapshot via `pnpm --filter @kaneo/api db:generate`. | `apps/api/src/database/schema.ts` |
| `apps/api/src/schemas.ts` | Edit | Extend `taskSchema` with `estimatedMinutes: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(525600))))`. | `apps/api/src/database/schema.ts` |
| `apps/api/src/task/validate-task-fields.ts` | Edit | Add and export pure validation function `assertValidEstimatedMinutes(val: unknown): void` validating integer range [0, 525600] or null/undefined. | None |
| `apps/api/src/task/controllers/get-task.ts` | Edit | Add `estimatedMinutes: taskTable.estimatedMinutes` to `.select({...})` query projection. | `apps/api/src/database/schema.ts` |
| `apps/api/src/task/controllers/get-tasks.ts` | Edit | Add `estimatedMinutes: taskTable.estimatedMinutes` to `taskSelection` object for column/archived/planned task lists. | `apps/api/src/database/schema.ts` |
| `apps/api/src/task/controllers/update-task-estimated-minutes.ts` | New | Implement controller updating `estimatedMinutes` on `taskTable` using named-object args `{ id, estimatedMinutes, currentUserId }`. Does NOT call `publishEvent`. | `apps/api/src/database/schema.ts` |
| `apps/api/src/task/index.ts` | Edit | Register `PUT /estimated-minutes/:id` with complete middleware chain, validators, and route handler. | `apps/api/src/task/controllers/update-task-estimated-minutes.ts`, `apps/api/src/task/validate-task-fields.ts`, `apps/api/src/schemas.ts` |
| `tests/api/task/validate-task-fields.test.ts` | New | Pure unit tests for `assertValidEstimatedMinutes` (testing integer inputs, bounds [0, 525600], float rejection, null handling). | `apps/api/src/task/validate-task-fields.ts` |
| `apps/web/src/types/task/index.ts` | Edit | Extend `Task` interface with `estimatedMinutes?: number | null`. | None |
| `apps/web/src/lib/format-estimated-hours.ts` | New | Pure formatting helper `formatEstimatedHours(minutes: number | null | undefined): string | null` converting minutes to decimal hours string (e.g. `150 -> "2.5h"`, `120 -> "2h"`). | None |
| `apps/web/src/lib/format-estimated-hours.test.ts` | New | Unit tests for `formatEstimatedHours` helper testing decimals, whole hours, zeros, negatives, and nulls. | `apps/web/src/lib/format-estimated-hours.ts` |
| `apps/web/src/fetchers/task/update-task-estimated-minutes.ts` | New | Implement fetcher calling `client.task["estimated-minutes"][":id"].$put({ param: { id: taskId }, json: { estimatedMinutes } })`. | `apps/web/src/types/task/index.ts` |
| `apps/web/src/hooks/mutations/task/use-update-task-estimated-minutes.ts` | New | Implement React Query mutation hook `useUpdateTaskEstimatedMinutes` invalidating `["task", id]`, `["tasks", projectId]`, and `["projects"]`. | `apps/web/src/fetchers/task/update-task-estimated-minutes.ts` |
| `i18n/en-US.json` | Edit | Add translation keys under `tasks:properties.estimatedHours`, `tasks:popover.estimatedHours.*`, and `tasks:kanban.estimatedHoursRollup`. | None |
| `i18n/*.json` (all 16 other locale files) | Edit | Synchronize all new estimated hours translation keys across all 16 locale JSON files. | `i18n/en-US.json` |
| `apps/web/src/components/task/task-estimated-hours-popover.tsx` | New | Implement popover component for viewing/editing decimal hours, parsing to integer minutes, clearing, and checking `useWorkspacePermission`. | `apps/web/src/hooks/mutations/task/use-update-task-estimated-minutes.ts`, `apps/web/src/lib/format-estimated-hours.ts`, `i18n/en-US.json` |
| `apps/web/src/components/task/task-properties-sidebar.tsx` | Edit | Register `TaskEstimatedHoursPopover` in both compact header view and desktop properties sidebar list. | `apps/web/src/components/task/task-estimated-hours-popover.tsx` |
| `apps/web/src/components/kanban-board/task-card.tsx` | Edit | Render estimate badge using `formatEstimatedHours(task.estimatedMinutes)` alongside existing card property badges. | `apps/web/src/lib/format-estimated-hours.ts` |
| `apps/web/src/components/kanban-board/task-card.test.tsx` | New | Render tests verifying task card badge presence for positive estimates and absence for null/zero. | `apps/web/src/components/kanban-board/task-card.tsx` |
| `apps/web/src/components/kanban-board/column/column-header.tsx` | Edit | Calculate sum of `estimatedMinutes` across `column.tasks` and render rollup badge formatted via `formatEstimatedHours`. | `apps/web/src/lib/format-estimated-hours.ts` |
| `apps/web/src/components/kanban-board/column/column-header.test.tsx` | New | Render tests verifying column header rollup sums, empty display when no estimates present, and matching styling. | `apps/web/src/components/kanban-board/column/column-header.tsx` |

---

## 5. Formatting Helper

### Location
`apps/web/src/lib/format-estimated-hours.ts`

### Pure Function Specification
```typescript
/**
 * Formats a duration in minutes into a human-readable decimal hour string.
 * Returns null if minutes is null, undefined, 0, or negative (indicating no badge should render).
 *
 * @param minutes - Total duration in integer minutes
 * @returns Formatted hour string (e.g. "2.5h", "2h") or null
 */
export function formatEstimatedHours(minutes: number | null | undefined): string | null {
  if (minutes === null || minutes === undefined || typeof minutes !== "number" || minutes <= 0) {
    return null;
  }

  const hours = minutes / 60;
  // Format up to 2 decimal places, stripping trailing zeros via Number()
  const formatted = Number(hours.toFixed(2));
  return `${formatted}h`;
}
```

### Exact Behaviour Examples
- `150` -> `'2.5h'`
- `120` -> `'2h'` (no trailing `.0`)
- `90` -> `'1.5h'`
- `45` -> `'0.75h'`
- `0` -> `null` (no badge rendered)
- `-10` -> `null` (no badge rendered)
- `null` -> `null` (no badge rendered)
- `undefined` -> `null` (no badge rendered)

---

## 6. Test Plan

### API Pure Unit Test Suite
**File:** `tests/api/task/validate-task-fields.test.ts`
- **Context:** Operates under Vitest node environment without database or HTTP server.
- **Cases:**
  1. *Valid integer minutes*: Accepts `0`, `60`, `150`, `525600`.
  2. *Valid null/undefined*: Accepts `null` and `undefined` (used when clearing estimates).
  3. *Rejects negative integers*: Throws 400 `HTTPException` for `-1`, `-60`.
  4. *Rejects values above maximum bound*: Throws 400 `HTTPException` for `525601`.
  5. *Rejects fractional/float values*: Throws 400 `HTTPException` for `2.5`, `0.5`, `120.75`.
  6. *Rejects non-numeric types*: Throws 400 `HTTPException` for string `"120"`, objects, and arrays.

### Web Unit & Component Test Suites

#### 1. Helper Unit Tests
**File:** `apps/web/src/lib/format-estimated-hours.test.ts`
- **Cases:**
  - Formats whole hours without decimals (`120` -> `"2h"`, `60` -> `"1h"`).
  - Formats fractional hours with clean decimals (`150` -> `"2.5h"`, `45` -> `"0.75h"`).
  - Returns `null` for `0`, negative numbers, `null`, and `undefined`.

#### 2. Task Card Component Tests
**File:** `apps/web/src/components/kanban-board/task-card.test.tsx`
- **Cases:**
  - Renders badge `"2.5h"` when `task.estimatedMinutes = 150`.
  - Does NOT render any estimate badge when `task.estimatedMinutes = null`.
  - Does NOT render any estimate badge when `task.estimatedMinutes = 0` or omitted.
  - Matches snapshot/layout of existing cards when `estimatedMinutes` is unset.

#### 3. Column Header Component Tests
**File:** `apps/web/src/components/kanban-board/column/column-header.test.tsx`
- **Cases:**
  - Renders rollup badge `"6h"` when column contains tasks with `[120, 240]` minutes.
  - Renders rollup badge `"2.5h"` when column contains one task with `150` minutes and two with `null`.
  - Renders NO rollup badge when all tasks in column have `null` or `0` minutes.
  - Renders NO rollup badge when column has 0 tasks.
  - Verifies count badge (`column.tasks.length`) remains intact alongside rollup badge.

#### 4. Internationalization Consistency Test
- Execute `pnpm i18n:check` to verify that all 17 locale files contain the new `estimatedHours` keys.

---

## 7. Risks and Rollback

### Risks
1. **Migration on Populated Tables:** Adding a non-null column could fail or lock tables.
   - *Mitigation:* The column is strictly nullable without a default value (`integer("estimated_minutes")`), making migration instantaneous and zero-downtime on PostgreSQL.
2. **Client-Side Float Inputs:** Users input estimates in hours (e.g. `2.5`), which must be converted to integer minutes (`150`) before sending over API.
   - *Mitigation:* Popover parses decimal inputs using `Math.round(parseFloat(value) * 60)` and client-side validator blocks invalid values before API submission.
3. **i18n Drift:** Missing keys in non-English locale files failing CI checks.
   - *Mitigation:* `pnpm i18n:check:fix` will be used during implementation to propagate all keys from `en-US.json` across all 17 locale files.

### Rollback Strategy
1. **API Rollback:** Revert router registration and schema definitions.
2. **Database Rollback:** If migration rollback is required, execute `ALTER TABLE "task" DROP COLUMN "estimated_minutes";` via a downstream migration.
3. **Web Rollback:** Revert UI components; since `estimatedMinutes` is optional in web types, older web bundles remain compatible with or without the column present in responses.

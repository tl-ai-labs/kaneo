# Requirements Document — DELTA: Estimated Hours on Tasks with Per-Lane Rollup

**Module:** `estimated-hours`  
**Run ID:** `20260831-092456-feature-extend-estimated-hours`  
**Target File:** `.sdlc/runs/20260831-092456-feature-extend-estimated-hours/requirements.md`  

---

## 1. In Scope

1. **Database Schema & Migration**: Add a nullable `estimatedMinutes` integer column to `taskTable` in [`apps/api/src/database/schema.ts`](file:///home/sangeetha/projects/kaneo/apps/api/src/database/schema.ts#L401-L442) with a generated Drizzle migration safe for populated production databases.
2. **OpenAPI & Response Schema**: Update `taskSchema` in [`apps/api/src/schemas.ts`](file:///home/sangeetha/projects/kaneo/apps/api/src/schemas.ts#L25-L44) to include nullable `estimatedMinutes` with accurate OpenAPI documentation.
3. **API Read Projections**: Add `estimatedMinutes` to both the single-task projection in [`apps/api/src/task/controllers/get-task.ts`](file:///home/sangeetha/projects/kaneo/apps/api/src/task/controllers/get-task.ts#L8-L23) and the board column `taskSelection` projection in [`apps/api/src/task/controllers/get-tasks.ts`](file:///home/sangeetha/projects/kaneo/apps/api/src/task/controllers/get-tasks.ts#L123-L139).
4. **API Mutation Endpoint**: Provide a dedicated single-field update endpoint (`PUT /estimated-minutes/:id` on the task router in [`apps/api/src/task/index.ts`](file:///home/sangeetha/projects/kaneo/apps/api/src/task/index.ts)) with Valibot validation, returning 4xx on invalid inputs, enforced by workspace permission `task: ["update"]`.
5. **Web Client Types & Data Layer**: Extend the TypeScript `Task` interface in [`apps/web/src/types/task/index.ts`](file:///home/sangeetha/projects/kaneo/apps/web/src/types/task/index.ts#L18-L38) and provide mutation hooks for updating estimated minutes.
6. **Task Properties Sidebar UI**: Implement a task estimate popover component and register it in [`apps/web/src/components/task/task-properties-sidebar.tsx`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/task/task-properties-sidebar.tsx) (both compact and desktop views) to allow setting, changing, and clearing hours.
7. **Task Card Badge**: Render an estimate badge on [`apps/web/src/components/kanban-board/task-card.tsx`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/kanban-board/task-card.tsx) formatted in hours when an estimate is present, remaining visually unchanged when unset.
8. **Column Header Rollup**: Display the summed estimated hours in [`apps/web/src/components/kanban-board/column/column-header.tsx`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/kanban-board/column/column-header.tsx) across all tasks in that column, rendering nothing when no task in the lane has an estimate.
9. **Internationalization (i18n)**: Provide static translation keys in [`i18n/en-US.json`](file:///home/sangeetha/projects/kaneo/i18n/en-US.json) and synchronize across all 17 locale JSON files in the `i18n/` directory.
10. **Test Coverage**: Provide automated unit and integration tests covering API schema validation, permissions, read projections, card badge rendering, and column header rollup calculations.

---

## 2. Out of Scope

1. **No Link to Tracked Time**: No connection, calculation, or comparison with `timeEntryTable` or existing tracked time records (`timeEntry.duration`).
2. **No Create-Task Modal Field**: No estimate input field in the task creation dialog (`CreateTaskModal`) in this run.
3. **No Workspace/Project-Level Rollups**: No aggregate rollup totals at project or workspace levels outside the kanban column header.
4. **No Estimate History / Activity Logs**: No dedicated audit logs, activity timeline events, or notification triggers for estimate modifications.
5. **No Sync or MCP Tool Changes**: No modifications to GitHub/Gitea synchronization or MCP tool schemas.

---

## 3. Functional Requirements per Module

### 3.1. API Schema (`api-schema`)

- **FR-1**: `apps/api/src/database/schema.ts` — The `taskTable` definition must include a nullable integer column `estimatedMinutes: integer("estimated_minutes")`.
- **FR-2**: `apps/api/drizzle/` — A Drizzle migration must be generated (`drizzle-kit generate`) containing `ALTER TABLE "task" ADD COLUMN "estimated_minutes" integer;`, along with corresponding metadata updates in `apps/api/drizzle/meta/_journal.json` and snapshot files.
- **FR-3**: `apps/api/src/schemas.ts` — The `taskSchema` Valibot definition must include `estimatedMinutes: v.optional(v.nullable(v.number()))` with accurate OpenAPI documentation for consumers.

### 3.2. API Validation (`api-validation`)

- **FR-4**: `apps/api/src/task/index.ts` — Input payloads for setting an estimate must validate that `estimatedMinutes` is either `null`, `undefined` (for clearing), or a non-negative integer within a valid range (`0 <= estimatedMinutes <= 525600`).
- **FR-5**: `apps/api/src/task/index.ts` — Requests with invalid types (e.g., fractional numbers, negative integers, non-numeric strings) must be rejected with HTTP 400 Bad Request via `HTTPException` rather than uncaught 500 server errors.

### 3.3. API Read Projections (`api-read-projections`)

- **FR-6**: `apps/api/src/task/controllers/get-task.ts` — The single-task projection query allowlist must explicitly select `estimatedMinutes: taskTable.estimatedMinutes`.
- **FR-7**: `apps/api/src/task/controllers/get-tasks.ts` — The `taskSelection` object must explicitly include `estimatedMinutes: taskTable.estimatedMinutes` so that `columns[].tasks[]`, `archivedTasks[]`, and `plannedTasks[]` receive the field. *(Binding repo fact: get-task.ts and get-tasks.ts use explicit column allowlists, not `select(*)`; without this, estimatedMinutes is omitted from responses).*

### 3.4. API Controller & Mutation Endpoint (`api-endpoints`)

- **FR-8**: `apps/api/src/task/controllers/update-task-estimated-minutes.ts` & `apps/api/src/task/index.ts` — Implement a dedicated endpoint `PUT /estimated-minutes/:id` on the task router handled by `updateTaskEstimatedMinutes`.  
  *Justification*: Following Kaneo's established architecture for discrete task properties (`PUT /status/:id`, `PUT /priority/:id`, `PUT /due-date/:id`, `PUT /assignee/:id`, `PUT /title/:id`), dedicated endpoints prevent positional argument bloat in `updateTask` ([`apps/api/src/task/controllers/update-task.ts`](file:///home/sangeetha/projects/kaneo/apps/api/src/task/controllers/update-task.ts#L9-L21) currently takes 11 positional arguments) and provide clean, single-purpose RBAC verification and event handling.
- **FR-9**: `apps/api/src/task/index.ts` — The `PUT /estimated-minutes/:id` route must be protected by middleware `workspaceAccess.fromTask()`, `requireWorkspacePermission({ task: ["update"] })`, and `requireEntitlement`.

### 3.5. Web Data Layer (`web-data`)

- **FR-10**: `apps/web/src/types/task/index.ts` — Extend the `Task` type with `estimatedMinutes?: number | null`.
- **FR-11**: `apps/web/src/hooks/mutations/task/use-update-task-estimated-minutes.ts` — Create a React Query mutation hook `useUpdateTaskEstimatedMinutes` that sends `PUT /api/tasks/estimated-minutes/:id` and invalidates query keys `["tasks", projectId]` and `["task", taskId]`.

### 3.6. Web UI (`web-ui`)

- **FR-12**: `apps/web/src/components/task/task-estimated-hours-popover.tsx` — Create a popover component that accepts decimal hour inputs from the user (e.g. `2.5`), converts hours to integer minutes (`150`) upon submission, permits clearing the estimate (`null`), and disables interaction if the user lacks `canUpdateTasks()`.
- **FR-13**: `apps/web/src/components/task/task-properties-sidebar.tsx` — Integrate `TaskEstimatedHoursPopover` into both the compact header row and desktop properties list.
- **FR-14**: `apps/web/src/components/kanban-board/task-card.tsx` — Display an estimate badge on the task card when `task.estimatedMinutes` is a positive number, formatted as hours (e.g. `2.5h`). If `estimatedMinutes` is `null` or `0`, render no badge and leave card layout visually unaffected.
- **FR-15**: `apps/web/src/components/kanban-board/column/column-header.tsx` — Calculate the sum of `estimatedMinutes` across all tasks in `column.tasks`. If the total is greater than 0, display the formatted total hours in the header; if 0 or all null, render nothing.

### 3.7. Internationalization (`i18n`)

- **FR-16**: `i18n/en-US.json` — Add static keys under `tasks:properties.estimatedHours`, `tasks:popover.estimatedHours.*`, and `tasks:kanban.estimatedHoursRollup`.
- **FR-17**: `i18n/*.json` — Replicate all new translation keys across all 17 locale files (`de-DE.json`, `el-GR.json`, `en-US.json`, `es-ES.json`, `fr-FR.json`, `hi-IN.json`, `id-ID.json`, `it-IT.json`, `ko-KR.json`, `mk-MK.json`, `nl-NL.json`, `pt-BR.json`, `ru-RU.json`, `tr-TR.json`, `uk-UA.json`, `vi-VN.json`, `zh-CN.json`). `i18n/schema.json` must remain unmodified.

---

## 4. Non-Functional Requirements

- **NFR-1 (Data Integrity)**: Storage in integer minutes (`estimatedMinutes`) guarantees exact lane sums without floating-point arithmetic errors.
- **NFR-2 (Performance)**: Lane rollups must compute in O(N) client-side time over existing `column.tasks` array without additional network roundtrips.
- **NFR-3 (Backward Compatibility)**: Nullable database column ensures all existing tasks remain fully valid without data migration backfills.
- **NFR-4 (Security & RBAC)**: Estimate mutation permissions are strictly verified at the API layer via `requireWorkspacePermission({ task: ["update"] })`.
- **NFR-5 (Type Safety & Linting)**: All changes across `apps/api` and `apps/web` must typecheck cleanly via `pnpm typecheck` and pass `pnpm biome check`.

---

## 5. PII Inventory

| Field Name | Entity | Data Classification | Justification |
| :--- | :--- | :--- | :--- |
| `estimatedMinutes` | `taskTable` (`task`) | **Not PII** | An optional integer representing estimated duration/effort in minutes is operational project metadata. It does not contain personal identity, contact, financial, or biometric information. |

---

## 6. Role Matrix

Permissions utilize the existing `@kaneo/permissions` vocabulary (`packages/permissions/src/index.ts`):

| Role | Resource | Allowed Actions | Can View Estimate (`task:read`) | Can Edit/Clear Estimate (`task:update`) |
| :--- | :--- | :--- | :---: | :---: |
| **Viewer** | `task` | `["read"]` | Yes | No |
| **Member** | `task` | `["create", "read", "update"]` | Yes | Yes |
| **Admin** | `task` | `["create", "read", "update", "delete", "assign"]` | Yes | Yes |
| **Owner** | `task` | `["create", "read", "update", "delete", "assign"]` | Yes | Yes |

---

## 7. Acceptance Criteria & Concrete Proofs

| AC # | Criterion Description | Concrete Proof / Executable Verification |
| :--- | :--- | :--- |
| **AC-1** | `taskTable` has a nullable `estimatedMinutes` integer with a generated, inspected migration that is safe on an existing populated database. | Run `pnpm --filter @kaneo/api db:generate` (or verify migration files in `apps/api/drizzle/`); verify SQL contains `ALTER TABLE "task" ADD COLUMN "estimated_minutes" integer;` without `NOT NULL`. |
| **AC-2** | The task API accepts and returns the estimate, validated with Valibot (integer within a sane range, or null), with accurate OpenAPI metadata, rejecting invalid values with a 4xx rather than a 500. | Execute `pnpm --filter @kaneo/api test tests/api/task-estimated-minutes.test.ts`; verify `PUT /estimated-minutes/:id` returns 200 for valid minutes/null and 400 for floats, negative numbers, or invalid strings. |
| **AC-3** | Setting an estimate requires the same workspace permission that already gates task updates, enforced in the API — not only hidden in the UI. | Execute API test with a user bearing the `viewer` role attempting `PUT /estimated-minutes/:id`; verify response is HTTP 403 Forbidden. |
| **AC-4** | The task properties sidebar can set, change, and clear an estimate, and it persists across reload. | Run web test for `TaskPropertiesSidebar` verifying mutation call on estimate submit/clear; verify reload query `useGetTask` displays updated value. |
| **AC-5** | The card shows the estimate when set, formatted in hours, and is visually unchanged when unset. | Run `pnpm --filter @kaneo/web test src/components/kanban-board/task-card.test.tsx`; assert badge renders "2.5h" for 150 minutes, and no badge element exists when `estimatedMinutes` is null. |
| **AC-6** | The lane header shows the summed estimate for its tasks, and renders nothing when the lane has no estimates. | Run `pnpm --filter @kaneo/web test src/components/kanban-board/column/column-header.test.tsx`; assert rollup renders "6h" when tasks have [120m, 240m], and renders empty container when tasks have [null, null]. |
| **AC-7** | All new user-facing copy uses static i18n keys across all locales. | Run `pnpm i18n:check` from repo root; command exits with code 0 confirming all 17 locale JSON files contain matching keys. |
| **AC-8** | Existing tasks, cards, and lane headers render exactly as today. | Snapshot tests for `TaskCard` and `ColumnHeader` with legacy mock data (where `estimatedMinutes` is omitted/null) produce identical DOM structure. |
| **AC-9** | Focused API tests cover validation and persistence; focused web tests cover the card badge and the rollup at zero, one, and several estimates. Affected packages typecheck. | Run `pnpm --filter @kaneo/api typecheck && pnpm --filter @kaneo/web typecheck` and run targeted vitest suites for api and web. |

---

## 8. Open Questions for HITL

1. **Badge Display Formatting**: Should fractional hours always show up to 1 decimal place (e.g. `2.5h`, `0.5h`, `3h` vs `3.0h`) or convert to compound hour/minute units (e.g. `2h 30m`)? *(Default assumption: formatted decimal hours e.g. `2.5h` / `2h`).*
2. **User Preferences Visibility Toggle**: Should the task card estimate badge have a toggle in `useUserPreferencesStore` (similar to `showDueDates`, `showPriority`), or is static rendering whenever non-null preferred for this initial release? *(Default assumption: render statically whenever set).*
3. **Upper Bound Limit**: Should the maximum allowed estimate be capped at 99,999 minutes (~1,666 hours) or 525,600 minutes (1 calendar year)? *(Default assumption: capped at 525,600 minutes).*

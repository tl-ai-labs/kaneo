# Security Review: Estimated Hours (`estimated-hours`)

## Scope and Method

### Scope
This security review covers the changeset for the `estimated-hours` feature extension (`20260831-092456-feature-extend-estimated-hours`). The review assesses all changed backend and frontend files:
- **Database & Schemas**:
  - `apps/api/src/database/schema.ts` (`taskTable.estimatedMinutes`)
  - `apps/api/drizzle/0043_odd_random.sql` (migration script)
  - `apps/api/src/schemas.ts` (`taskSchema`)
  - `apps/api/src/task/validate-task-fields.ts` (`estimatedMinutesSchema`, `ESTIMATED_MINUTES_MAX`)
- **API Controllers & Routes**:
  - `apps/api/src/task/controllers/get-task.ts`
  - `apps/api/src/task/controllers/get-tasks.ts`
  - `apps/api/src/task/controllers/update-task-estimated-minutes.ts`
  - `apps/api/src/task/index.ts` (`PUT /estimated-minutes/:id`)
- **Web Frontend & Shared**:
  - `apps/web/src/components/task/task-estimated-hours-popover.tsx`
  - `apps/web/src/fetchers/task/update-task-estimated-minutes.ts`
  - `apps/web/src/components/kanban-board/task-card.tsx`
  - `apps/web/src/components/kanban-board/column/column-header.tsx`
  - `i18n/en-US.json`
- **Authorization Context & Sibling Routes**:
  - `apps/api/src/utils/require-workspace-permission.ts`
  - `apps/api/src/utils/workspace-access-middleware.ts`
  - `apps/api/src/task/index.ts` (`PUT /priority/:id`)

### Method
The review was conducted via static code analysis, threat modeling, authorization verification, input boundary and type analysis, data exposure and privacy assessment, migration safety evaluation, and dependency risk verification.

---

## Threat Model for this Change

An attacker attempting to exploit this feature could attempt the following attack vectors:
1. **IDOR & Cross-Tenant Modification**: An attacker attempts to modify task estimates on a task belonging to a different workspace or project by submitting arbitrary task IDs to `PUT /task/estimated-minutes/:id`.
2. **Privilege Escalation & Unauthorized Write**: A user without `task:update` permissions (e.g., guest, viewer, or restricted custom role) attempts to set or clear estimated minutes on tasks.
3. **UI Bypass**: An attacker bypasses frontend popover controls and permission guards (`canUpdateTasks`) by dispatching direct HTTP requests to the API.
4. **Input Validation Exploitation & Data Corruption**:
   - Sending negative values (e.g., `-100`) to manipulate rollups or corrupt metrics.
   - Sending floating-point/fractional values (e.g., `2.5`) to trigger database type confusion or unhandled parsing exceptions.
   - Submitting extreme numbers or integer overflow payloads (e.g., `2^31`, `1e12`, `MAX_SAFE_INTEGER`).
   - Submitting non-numeric types (strings, arrays, objects, booleans) or malformed JSON payloads.
5. **Denial of Service / Resource Exhaustion**: Submitting huge payloads or triggering computationally expensive aggregate calculations on columns.
6. **Data Leakage & Cross-Workspace Read**: Unauthorized users attempting to read task estimates or column rollups across workspace boundaries.

---

## Findings Table

| Severity | File | Issue | Impact | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **Informational** | `apps/api/src/task/controllers/update-task-estimated-minutes.ts` | Activity events are not emitted on estimate updates | Changes to task estimates are not recorded in the workspace activity audit log (`activityTable`), unlike title/status/due date changes. This is an intentional design choice for this iteration. | If audit trail fidelity for task estimation is required in the future, consider integrating `publishEvent` in `updateTaskEstimatedMinutes`. |

*(No critical, high, medium, or low severity vulnerabilities were identified in the changeset.)*

---

## Authorization Analysis

### Server-Side Enforcement
Authorization is strictly enforced server-side on the mutation endpoint `PUT /estimated-minutes/:id` in `apps/api/src/task/index.ts`. The route applies the following middleware chain:
1. `workspaceAccess.fromTask()`: Looks up the task in `taskTable`, joins `projectTable` to resolve the associated `workspaceId`, and invokes `validateWorkspaceAccess(userId, workspaceId, apiKeyId)` to verify valid workspace membership. If the task does not exist or the user is not a member of the workspace, access is blocked (returning 404/401/403).
2. `requireWorkspacePermission({ task: ["update"] })`: Queries the member's assigned role against `workspaceRoleTable` (or fallback `builtInRoles`) and confirms that the caller holds the `task:update` permission.
3. `requireEntitlement`: Enforces billing and subscription plan limits before executing the controller.

### Sibling Route Comparison
The authorization chain on `PUT /estimated-minutes/:id` is identical in structure and enforcement to existing single-property task mutation routes:
- **`PUT /priority/:id`**:
  ```ts
  workspaceAccess.fromTask(),
  requireWorkspacePermission({ task: ["update"] }),
  requireEntitlement,
  ```
- **`PUT /estimated-minutes/:id`**:
  ```ts
  workspaceAccess.fromTask(),
  requireWorkspacePermission({ task: ["update"] }),
  requireEntitlement,
  ```
Both routes gate operations behind the exact same permission (`task:update`) and use identical workspace resolution mechanics.

### UI Bypass Resistance
The frontend popover in `task-estimated-hours-popover.tsx` performs an initial check using `useWorkspacePermission().canUpdateTasks()`. If a user bypasses the UI and interacts directly with the API endpoint, the server independently validates workspace membership and permissions. An unauthorized API request will result in an HTTP `401 Unauthorized` or `403 Forbidden` response.

---

## Input Validation Analysis

The input validation for `PUT /estimated-minutes/:id` is defined centrally in `apps/api/src/task/validate-task-fields.ts` and shared across the route validator and unit tests:
- **Schema**:
  ```ts
  export const ESTIMATED_MINUTES_MAX = 525_600; // 1 year in minutes

  export const estimatedMinutesSchema = v.nullable(
    v.pipe(
      v.number(),
      v.integer(),
      v.minValue(0),
      v.maxValue(ESTIMATED_MINUTES_MAX),
    ),
  );
  ```
- **Bounds**: Values must fall within `0` to `525,600` inclusive (capped at one year in minutes).
- **Type Confusion**: `v.number()` strictly rejects strings, booleans, arrays, and objects.
- **Negative & Fractional Values**: `v.minValue(0)` rejects negative inputs; `v.integer()` rejects floating-point/fractional values.
- **Null Handling**: `v.nullable(...)` explicitly allows `null`, enabling users to clear an existing estimate cleanly.
- **Integer Overflow**: Because the maximum value is `525,600`, values easily fit within PostgreSQL's standard 4-byte signed `integer` (up to 2,147,483,647) and JavaScript `Number.MAX_SAFE_INTEGER`, preventing arithmetic overflow.
- **Malformed Body**: If the request body omits the field, provides invalid JSON, or supplies out-of-range values, Valibot immediately returns an HTTP `400 Bad Request`.

---

## Data Exposure Analysis

- **Personally Identifiable Information (PII)**: The `estimatedMinutes` field represents a numerical task duration and contains no personal or sensitive user data.
- **Cross-Workspace Boundaries**: Task reads via `GET /tasks/:projectId` and `GET /task/:id` remain strictly scoped by `workspaceAccess.fromProject` and `workspaceAccess.fromTask`. Data cannot leak across workspace boundaries.
- **Unauthorized Readers**: Read access requires authenticated workspace membership.
- **Logging & Events**: The field is not written to external log aggregators or console logs. Because activity event publishing is omitted by design, no unintended event broadcasts occur.

---

## Migration Safety

- **Migration File**: `apps/api/drizzle/0043_odd_random.sql`
  ```sql
  ALTER TABLE "task" ADD COLUMN "estimated_minutes" integer;
  ```
- **Safety**: Adding a nullable column without a `DEFAULT` clause in PostgreSQL is an O(1) metadata-only operation. It executes instantaneously without acquiring exclusive table-rewrite locks or causing read/write downtime.

---

## Dependency Risk

No new external dependencies, libraries, or packages were introduced in this changeset.

---

## Verdict

### Verdict: **PASS**

### Justification
The `estimated-hours` feature extension is well-designed and cleanly implemented. Server-side authorization is fully enforced using the existing workspace permission model (`task:update`), input validation is robust with single-source-of-truth Valibot schema constraints, database migration is safe and non-blocking, and no security regressions, data exposure vulnerabilities, or dependency risks were introduced.

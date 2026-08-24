# Delta Requirements: Column WIP Limit (Indicator Only)

## In scope
1. Addition of an optional, nullable integer `wipLimit` field to the column database schema and entity models.
2. API contract updates in column creation and update endpoints to accept, validate, persist, and return `wipLimit`.
3. Client-side data fetching and mutation hook updates to support `wipLimit` on column operations.
4. Kanban board column header visual indicator displaying current task count against `wipLimit` when configured.
5. Visual over-capacity styling on the column header task count badge when current task count exceeds `wipLimit`.
6. Inline column WIP limit configuration mechanism in the Kanban column header accessible to users with project update permissions.
7. Static localization keys for WIP limit badge labels, tooltips, and configuration controls in `i18n/en-US.json`.

## Out of scope
1. Enforcement or blocking logic that prevents adding, creating, or moving tasks into a column exceeding its WIP limit.
2. Global, swimlane-level, or multi-column aggregate WIP limits.
3. WIP limit history tracking, auditing, or time-series analytics.
4. Creation of new database tables or new realtime WebSocket event types.
5. Modifying generated schema files, including `i18n/schema.json`.
6. Altering task archive workflows, status drag-and-drop validation, or virtual status handling.

## Current behavior (delta baseline)
1. `apps/api/src/database/schema.ts`: `columnTable` defines columns `id`, `projectId`, `name`, `slug`, `position`, `icon`, `color`, `isFinal`, `createdAt`, and `updatedAt`. It has no `wipLimit` column.
2. `apps/api/src/column/index.ts`: The `POST /:projectId` route validates `name`, `icon`, `color`, and `isFinal` via Valibot and invokes `createColumn`. The `PUT /:id` route validates `name`, `icon`, `color`, and `isFinal` and invokes `updateColumn`. Both routes enforce `requireWorkspacePermission({ project: ["update"] })`. The `GET /:projectId` route returns results from `getColumns`. All column route responses declare `resolver(v.any())`.
3. `apps/api/src/column/controllers/create-column.ts`: `createColumn` takes `{ projectId, name, icon, color, isFinal }`, derives `slug` and `position`, and inserts into `columnTable` setting `icon` and `color` or `null`, and `isFinal` defaulting to `false`.
4. `apps/api/src/column/controllers/update-column.ts`: `updateColumn` applies partial updates for `name`, `icon`, `color`, and `isFinal` using `data.field !== undefined` checks and updates `columnTable` by `id`.
5. `apps/api/src/column/controllers/get-columns.ts`: `getColumns` executes `db.select().from(columnTable)` filtered by `projectId` and ordered by `position` ascending, returning all table columns.
6. `apps/api/src/task/controllers/get-tasks.ts`: Projects columns for the Kanban board as `{ id: column.slug, slug: column.slug, name: column.name, icon: column.icon, isFinal: column.isFinal, tasks }`. It assigns `column.slug` to `id`, drops `color`, and does not include `columnTable.id` or any column limit field.
7. `apps/web/src/types/project/index.ts`: Inactive type inference derives `ProjectWithTasks` from the response of `client.task.tasks[":projectId"].$get`, tying board column types to `get-tasks.ts`.
8. `apps/web/src/fetchers/column/update-column.ts`: `updateColumn` sends `PUT /column/:id` with `{ name, icon, color, isFinal }`. `create-column.ts` and `get-columns.ts` similarly only handle those fields.
9. `apps/web/src/hooks/mutations/column/use-update-column.ts`: `useUpdateColumn` accepts `{ id, projectId, data }` where `data` contains `{ name, icon, color, isFinal }` and invalidates `["columns", projectId]` and `["tasks", projectId]`. `use-create-column.ts` mirrors this behavior.
10. `apps/web/src/components/kanban-board/column/column-header.tsx`: Renders icon via `getColumnIcon(column.id, column.isFinal, column.icon)`, title `column.name`, task count badge with `column.tasks.length`, and action buttons for archive and task creation based on `useWorkspacePermission()`.
11. `apps/web/src/components/kanban-board/column/index.tsx`: Passes `column` directly into `ColumnHeader` and `ColumnDropzone`.
12. `i18n/en-US.json`: Contains translation namespaces `tasks.kanban` and `tasks.listView` without any WIP limit keys.

## Functional requirements

### api-schema
- FR-1: `apps/api/src/database/schema.ts` — Add a nullable integer column `wipLimit` (`integer("wip_limit")`) to `columnTable`.

### api-contract
- FR-2: `apps/api/src/column/index.ts` — Update the `POST /:projectId` request validator to accept an optional positive integer or null `wipLimit`.
- FR-3: `apps/api/src/column/index.ts` — Update the `PUT /:id` request validator to accept an optional nullable integer `wipLimit`.
- FR-4: `apps/api/src/column/controllers/create-column.ts` — Include `wipLimit` in the typed parameters and insert values when creating a column.
- FR-5: `apps/api/src/column/controllers/update-column.ts` — Include `wipLimit` in the partial update logic so that passing an integer updates the value and passing explicit `null` clears it in `columnTable`.
- FR-6: `apps/api/src/column/controllers/get-columns.ts` — Ensure `wipLimit` is returned in the column list output for a project.

### web-data
- FR-7: `apps/web/src/fetchers/column/create-column.ts` & `apps/web/src/fetchers/column/update-column.ts` — Extend the request payload interfaces to include optional and nullable `wipLimit`.
- FR-8: `apps/web/src/hooks/mutations/column/use-create-column.ts` & `apps/web/src/hooks/mutations/column/use-update-column.ts` — Update mutation parameter types to support `wipLimit` while preserving query invalidations for `["columns", projectId]` and `["tasks", projectId]`.

### web-ui
- FR-9: `apps/web/src/components/kanban-board/column/column-header.tsx` — Display the WIP limit in the column header count badge (e.g., `<current_count>/<wip_limit>`) when `wipLimit` is a positive integer.
- FR-10: `apps/web/src/components/kanban-board/column/column-header.tsx` — Apply visual warning/exceeded styling to the column header count badge when `column.tasks.length > column.wipLimit`.
- FR-11: `apps/web/src/components/kanban-board/column/column-header.tsx` — Provide an inline input/popover control allowing authorized users to set, update, or clear the column's `wipLimit`.
- FR-12: `apps/web/src/components/kanban-board/column/column-header.tsx` — Restrict the WIP limit configuration control to users with `project:update` permission via `useWorkspacePermission()`.

### i18n
- FR-13: `i18n/en-US.json` — Add static localization keys under `tasks.kanban` for WIP limit display tooltips, edit trigger labels, placeholder text, and limit exceeded status descriptions.

## Non-functional requirements
- NFR-1 (Migration Safety): Database migration adding `wip_limit` to `column` must be nullable with no default value and no backfill operations, ensuring non-blocking application on existing non-empty databases.
- NFR-2 (Backward Compatibility): When `wipLimit` is null or unset, column header rendering and system behavior must remain identical to the existing baseline with no UI regressions.
- NFR-3 (Static Localization): All UI text associated with WIP limits must reference static keys in `i18n/en-US.json` without dynamic runtime key generation.
- NFR-4 (Authorization): No new permission scopes shall be created; editing `wipLimit` must reuse the existing `requireWorkspacePermission({ project: ["update"] })` authorization gate.
- NFR-5 (Indicator-Only Operation): WIP limit is strictly an informational indicator. Task creation, status updates, and drag-and-drop movements must never be blocked or rejected when a column exceeds its limit.
- NFR-6 (Realtime Consistency): No new realtime event types or WebSocket topics shall be introduced. Cache invalidation on mutation must rely on existing query keys.
- NFR-7 (Type Safety): End-to-end type safety must be preserved across the API routes, Hono client, and web components without untyped layers or loose type assertions.

## PII inventory
| Field Name | Sensitivity Level | Protection Mechanism |
| :--- | :--- | :--- |
| `wipLimit` | None (Non-personal integer) | Standard workspace authorization (`project:update`) |

`wipLimit` represents a numeric threshold for workflow visualization and contains no personal, identifiable, or sensitive information. No new PII is introduced by this feature.

## Role matrix
| Workspace Role | Resource | Action | Authorized | Enforcement Point |
| :--- | :--- | :--- | :--- | :--- |
| Owner | Column WIP Limit | Read | Yes | Project access check |
| Owner | Column WIP Limit | Update / Clear | Yes | `requireWorkspacePermission({ project: ["update"] })` |
| Admin | Column WIP Limit | Read | Yes | Project access check |
| Admin | Column WIP Limit | Update / Clear | Yes | `requireWorkspacePermission({ project: ["update"] })` |
| Member (with `project:update`) | Column WIP Limit | Read | Yes | Project access check |
| Member (with `project:update`) | Column WIP Limit | Update / Clear | Yes | `requireWorkspacePermission({ project: ["update"] })` |
| Member (without `project:update`) | Column WIP Limit | Read | Yes | Project access check |
| Member (without `project:update`) | Column WIP Limit | Update / Clear | No | `requireWorkspacePermission({ project: ["update"] })` & `useWorkspacePermission()` |
| Viewer / Guest | Column WIP Limit | Read | Yes | Project access check |
| Viewer / Guest | Column WIP Limit | Update / Clear | No | `requireWorkspacePermission({ project: ["update"] })` & `useWorkspacePermission()` |

## Acceptance criteria
1. Database schema migration executes cleanly on non-empty databases and adds nullable `wip_limit` to `columnTable`.
   Verification: `pnpm --filter @kaneo/api test`
2. `POST /column/:projectId` persists a valid integer `wipLimit` and returns the created column entity.
   Verification: `pnpm --filter @kaneo/api test`
3. `PUT /column/:id` updates `wipLimit` when passed an integer, clears `wipLimit` to null when passed `null`, and leaves `wipLimit` unchanged when omitted.
   Verification: `pnpm --filter @kaneo/api test`
4. `PUT /column/:id` rejects unauthorized requests lacking `project:update` permission with HTTP 403.
   Verification: `pnpm --filter @kaneo/api test`
5. Web fetchers and mutation hooks pass full type checking with `wipLimit` included in payloads.
   Verification: `pnpm typecheck`
6. When `wipLimit` is null, column header badge renders only the current task count as it does currently.
   Verification: `pnpm --filter @kaneo/web test` and manual UI check
7. When `wipLimit` is set (e.g., 5) and task count is within limit (e.g., 3), column header renders formatted limit indicator (`3/5`) without warning styles.
   Verification: `pnpm --filter @kaneo/web test` and manual UI check
8. When `wipLimit` is set (e.g., 5) and task count exceeds limit (e.g., 6), column header renders formatted limit indicator (`6/5`) with visual over-capacity styling.
   Verification: `pnpm --filter @kaneo/web test` and manual UI check
9. Moving or adding a task to an over-capacity column succeeds normally without being blocked or prompting an error.
   Verification: Manual UI check
10. Users with `project:update` can open the inline editor from `ColumnHeader`, submit a new WIP limit, and see the header update immediately.
    Verification: Manual UI check
11. Users without `project:update` do not see or cannot activate the WIP limit configuration control.
    Verification: Manual UI check

## Open questions for HITL
1. **BLOCKER 1: Board Payload Missing WIP Limit (`apps/api/src/task/controllers/get-tasks.ts` outside allowlist)**
   - *Problem*: The Kanban board renders from `GET /task/tasks/:projectId` whose controller (`apps/api/src/task/controllers/get-tasks.ts`) explicitly projects only `{ id, slug, name, icon, isFinal, tasks }`. Adding `wipLimit` to `columnTable` and the `/column` endpoints does not deliver `wipLimit` to `ColumnHeader`. `apps/api/src/task/controllers/get-tasks.ts` is outside this run's frozen write allowlist.
   - *Option A*: Extend the write allowlist to include `apps/api/src/task/controllers/get-tasks.ts`, adding `wipLimit` (and `columnId`) to the column projection object.
     - *Scope Consequence*: Minimal code addition to an existing endpoint; keeps single-request board loading with optimal performance and clean type inference.
   - *Option B*: Retain the frozen allowlist and have `ColumnHeader` (or board container) fetch columns separately via `GET /column/:projectId` using TanStack Query.
     - *Scope Consequence*: Leaves `get-tasks.ts` untouched, but introduces an extra network request per board load and requires client-side joining of task counts and column settings.
   - *Option C*: Descope the over-capacity indicator from the main board to another view that already consumes `getColumns`.
     - *Scope Consequence*: Fails the core requirement of showing lane WIP limits on the Kanban board.

2. **BLOCKER 2: Inline Editor Lacks Database Column ID (`column.id` is the slug on board payload)**
   - *Problem*: `PUT /column/:id` requires `columnTable.id` (UUID), but in the board response payload `column.id` is assigned `column.slug` (`get-tasks.ts` line 225: `id: column.slug`). `ColumnHeader` has no access to the underlying primary key `columnTable.id`. Re-purposing `column.id` would break existing usages such as `getColumnIcon(column.id, ...)` and `CreateTaskModal status={column.id}`.
   - *Option A*: Add a distinct `columnId: column.id` field to the `get-tasks.ts` column projection alongside `wipLimit` (requires extending the allowlist as in Blocker 1).
     - *Scope Consequence*: Additive, backwards-compatible, allows direct `PUT /column/:id` calls from `ColumnHeader`.
   - *Option B*: Query the columns list client-side and match `column.slug` to find the corresponding `columnTable.id`.
     - *Scope Consequence*: Requires separate column query data on the client to map slugs to UUIDs before issuing update mutations.
   - *Option C*: Introduce a new slug-addressed API update endpoint (e.g., `PUT /column/project/:projectId/slug/:slug`).
     - *Scope Consequence*: Expands API surface area with redundant update routes.

*Additional Ambiguities*: Beyond Blocker 1 and Blocker 2, there are no further open questions or ambiguities.

## HITL Gate 1 resolution (2026-08-20, user-approved)

**Status: APPROVED — Blocker 1 → Option A, Blocker 2 → Option A.**

Both blockers resolve into a single additive change to one newly-allowlisted file,
`apps/api/src/task/controllers/get-tasks.ts`:

- **R-1 (resolves Blocker 1)**: Extend the board column projection in `get-tasks.ts` to include
  `wipLimit: column.wipLimit`. The board keeps its single-request load; no second `GET /column/:projectId`
  query is introduced.
- **R-2 (resolves Blocker 2)**: Extend the same projection with a **distinct** `columnId: column.id`
  field carrying the `columnTable.id` UUID, so `ColumnHeader` can issue `PUT /column/:id` directly.
- **R-3 (invariant, load-bearing)**: The existing `id: column.slug` assignment in that projection is
  **left untouched**. It is depended on by `getColumnIcon(column.id, ...)` and by
  `CreateTaskModal status={column.id}`. Any change that re-points `id` at the UUID is a regression and
  must be rejected at senior review. `columnId` is strictly additive alongside it.

**Write-contract amendment**: the frozen allowlist at `.sdlc/local/write-contract.json` was extended by
the user to add `apps/api/src/task/controllers/get-tasks.ts` (inserted after
`apps/api/src/column/controllers/get-columns.ts`). No other allowlist or off-limits entry changed.

**Consequent requirement additions:**
- FR-14: `apps/api/src/task/controllers/get-tasks.ts` — add `wipLimit` to the board column projection.
- FR-15: `apps/api/src/task/controllers/get-tasks.ts` — add `columnId: column.id` to the board column
  projection, preserving `id: column.slug` unchanged.
- FR-16: `apps/web/src/components/kanban-board/column/column-header.tsx` — the inline WIP editor issues
  its update against `column.columnId`, never `column.id`.
- AC-12: `GET /task/tasks/:projectId` returns each column with `id` still equal to the slug, plus a
  distinct `columnId` UUID and a `wipLimit` field (null when unset).
  Verification: `pnpm --filter @kaneo/api test`
- AC-13: Column icon resolution and task-creation status prefill continue to work unchanged after the
  projection is extended (no regression from R-3).
  Verification: `pnpm --filter @kaneo/web test` and manual UI check

# Delta Change Plan: Per-Column WIP Limit (Indicator Only)

## Summary
Lands a nullable per-column WIP limit (`wipLimit`) on `columnTable`, exposed via POST/PUT column routes and displayed in Kanban column headers with over-capacity styling and permission-gated inline editing.
No task movement, creation, or status transition is ever blocked or rejected.
Extending the `get-tasks` projection avoids a second column query on board load while providing `wipLimit` and the underlying UUID `columnId` required for updates.

## Change inventory

| File | Change type | What changes | Requirement IDs |
|---|---|---|---|
| `apps/api/src/database/schema.ts` | edit | Add nullable `wipLimit: integer("wip_limit")` to `columnTable` definition | FR-1, NFR-1 |
| `apps/api/drizzle/xxxx_add_column_wip_limit.sql` | new | Generated Drizzle migration adding nullable `wip_limit` column | FR-1, NFR-1 |
| `apps/api/src/column/index.ts` | edit | Add `wipLimit` to POST and PUT JSON validators and forward to controllers | FR-2, FR-3 |
| `apps/api/src/column/controllers/create-column.ts` | edit | Accept `wipLimit` in typed parameters and persist in `.values()` insert | FR-4 |
| `apps/api/src/column/controllers/update-column.ts` | edit | Accept `wipLimit` in typed parameters and handle partial update in `.set()` | FR-5 |
| `apps/api/src/task/controllers/get-tasks.ts` | edit | Project `columnId: column.id` and `wipLimit: column.wipLimit` in board column mapping | FR-14, FR-15 |
| `apps/web/src/fetchers/column/create-column.ts` | edit | Add `wipLimit?: number | null` to `createColumn` data payload parameter type | FR-7 |
| `apps/web/src/fetchers/column/update-column.ts` | edit | Add `wipLimit?: number | null` to `updateColumn` data payload parameter type | FR-7 |
| `apps/web/src/hooks/mutations/column/use-create-column.ts` | edit | Add `wipLimit?: number | null` to `useCreateColumn` data parameter type | FR-8 |
| `apps/web/src/hooks/mutations/column/use-update-column.ts` | edit | Add `wipLimit?: number | null` to `useUpdateColumn` data parameter type | FR-8 |
| `apps/web/src/components/kanban-board/column/column-header.tsx` | edit | Add `<count>/<limit>` badge, over-capacity styling, and permission-gated popover editor using `column.columnId` | FR-9, FR-10, FR-11, FR-12, FR-16 |
| `i18n/en-US.json` | edit | Add static translation keys under `tasks.kanban` for WIP limit UI strings | FR-13, NFR-3 |

## Data model

### Schema Definition
In `apps/api/src/database/schema.ts`, add the column definition inside `columnTable`:
```typescript
wipLimit: integer("wip_limit"),
```

### Generated Migration SQL
Generated via `pnpm --filter @kaneo/api db:generate`:
```sql
ALTER TABLE "column" ADD COLUMN "wip_limit" integer;
```

### Safety on Populated Databases
Adding a nullable column without a default or constraints is metadata-only in PostgreSQL. It does not require a table rewrite, requires no backfill, does not acquire an exclusive lock that blocks reads/writes on existing rows, and defaults existing records safely to `NULL`.

## API contract

### POST `/column/:projectId`
Valibot JSON validator fragment in `apps/api/src/column/index.ts`:
```typescript
validator(
  "json",
  v.object({
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    isFinal: v.optional(v.boolean()),
    wipLimit: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1)))),
  }),
)
```
Handler invocation:
```typescript
const { name, icon, color, isFinal, wipLimit } = c.req.valid("json");
const result = await createColumn({ projectId, name, icon, color, isFinal, wipLimit });
```
Controller signature & insert delta in `apps/api/src/column/controllers/create-column.ts`:
```typescript
async function createColumn({ projectId, name, icon, color, isFinal, wipLimit }: {
  projectId: string;
  name: string;
  icon?: string;
  color?: string;
  isFinal?: boolean;
  wipLimit?: number | null;
}) {
  // ...
  const [created] = await db.insert(columnTable).values({
    projectId, name, slug, position,
    icon: icon || null,
    color: color || null,
    isFinal: isFinal ?? false,
    wipLimit: wipLimit ?? null,
  }).returning();
  // ...
}
```

### PUT `/column/:id`
Valibot JSON validator fragment in `apps/api/src/column/index.ts`:
```typescript
validator(
  "json",
  v.object({
    name: v.optional(v.string()),
    icon: v.optional(v.nullable(v.string())),
    color: v.optional(v.nullable(v.string())),
    isFinal: v.optional(v.boolean()),
    wipLimit: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1)))),
  }),
)
```
Controller signature & `.set()` delta in `apps/api/src/column/controllers/update-column.ts`:
```typescript
async function updateColumn(
  id: string,
  data: {
    name?: string;
    icon?: string | null;
    color?: string | null;
    isFinal?: boolean;
    wipLimit?: number | null;
  },
) {
  const existing = await db.query.columnTable.findFirst({ where: eq(columnTable.id, id) });
  if (!existing) throw new HTTPException(404, { message: "Column not found" });

  const [updated] = await db.update(columnTable).set({
    ...(data.name !== undefined && { name: data.name }),
    ...(data.icon !== undefined && { icon: data.icon }),
    ...(data.color !== undefined && { color: data.color }),
    ...(data.isFinal !== undefined && { isFinal: data.isFinal }),
    ...(data.wipLimit !== undefined && { wipLimit: data.wipLimit }),
  }).where(eq(columnTable.id, id)).returning();

  if (!updated) throw new HTTPException(500, { message: "Failed to update column" });
  return updated;
}
```

### Clear vs Omit Semantics
The update query builds `.set()` properties conditionally using `data.field !== undefined`:
- **Explicit `null` (`{ wipLimit: null }`)**: `data.wipLimit !== undefined` evaluates to `true`. The resulting object is `{ wipLimit: null }`, which updates the database column to `NULL` (clearing the limit).
- **Omitted (`{}`)**: `data.wipLimit` is `undefined`. `data.wipLimit !== undefined` evaluates to `false`, omitting `wipLimit` from `.set()`, leaving the database value unchanged.
- **Positive Integer (`{ wipLimit: 5 }`)**: `data.wipLimit !== undefined` evaluates to `true`, updating the column to `5`.

## Board payload projection

In `apps/api/src/task/controllers/get-tasks.ts`, the `projectColumns.map(...)` projection is updated to add `columnId: column.id` and `wipLimit: column.wipLimit`.

**The `id: column.slug` assignment is UNCHANGED and load-bearing across client icon lookup (`getColumnIcon(column.id, ...)`) and modal status prefilling (`CreateTaskModal status={column.id}`).**

Resulting object literal in full:
```typescript
const columns = projectColumns.map((column) => ({
  id: column.slug,
  columnId: column.id,
  slug: column.slug,
  name: column.name,
  icon: column.icon,
  isFinal: column.isFinal,
  wipLimit: column.wipLimit,
  tasks: paginatedTasks
    .filter((task) => task.status === column.slug)
    .map((task) => ({
      ...task,
      labels: taskLabelsMap.get(task.id) || [],
      externalLinks: taskExternalLinksMap.get(task.id) || [],
    })),
}));
```

## Web data layer

### Fetcher Type Deltas
- `apps/web/src/fetchers/column/create-column.ts`:
```typescript
export async function createColumn(
  projectId: string,
  data: {
    name: string;
    icon?: string;
    color?: string;
    isFinal?: boolean;
    wipLimit?: number | null;
  },
) { ... }
```
- `apps/web/src/fetchers/column/update-column.ts`:
```typescript
export async function updateColumn(
  id: string,
  data: {
    name?: string;
    icon?: string | null;
    color?: string | null;
    isFinal?: boolean;
    wipLimit?: number | null;
  },
) { ... }
```
- `apps/web/src/fetchers/column/get-columns.ts`: No edit needed. It takes only `projectId` and returns `response.json()`.

### Mutation Hook Type Deltas
- `apps/web/src/hooks/mutations/column/use-create-column.ts`:
```typescript
mutationFn: ({ projectId, data }: {
  projectId: string;
  data: { name: string; icon?: string; color?: string; isFinal?: boolean; wipLimit?: number | null };
}) => createColumn(projectId, data)
```
- `apps/web/src/hooks/mutations/column/use-update-column.ts`:
```typescript
mutationFn: ({ id, data }: {
  id: string;
  projectId: string;
  data: { name?: string; icon?: string | null; color?: string | null; isFinal?: boolean; wipLimit?: number | null };
}) => updateColumn(id, data)
```
Preserves invalidation of `["columns", variables.projectId]` and `["tasks", variables.projectId]`.

### `packages/libs` Status
`packages/libs` requires **NO edits**. `packages/libs/src/hono.ts` initializes `client = hc<AppType>(...)` purely from `AppType` exported by `@kaneo/api`. `packages/libs` exports only `{ resolveApiBaseUrl, client, windowId }` without defining per-route response types. TypeScript infers all updated routes directly from `@kaneo/api`.

## UI design

### Badge Rendering Rule
In `apps/web/src/components/kanban-board/column/column-header.tsx`:
- `wipLimit === null` or `wipLimit === undefined` (unset): renders `{column.tasks.length}` with standard styling (`bg-muted text-muted-foreground`).
- `wipLimit !== null` and `tasks.length <= wipLimit` (within limit): renders `{column.tasks.length}/{column.wipLimit}` with standard styling (`bg-muted text-muted-foreground`).
- `wipLimit !== null` and `tasks.length > wipLimit` (exceeded): renders `{column.tasks.length}/{column.wipLimit}` with warning over-capacity styling (`bg-destructive/15 text-destructive font-semibold`).

### Permission Gating
Gated by `canUpdateProjects()` from `useWorkspacePermission()` (which maps to `{ project: ["update"] }`). Non-permitted users cannot see or trigger the WIP limit editor.

### Control Pattern & Local State
- Control trigger: An edit button / clickable badge or trigger icon in the column header visible only when `canUpdateProjects()` is true.
- Popover content:
  - Numeric input for positive integer limit.
  - Save button: Parses positive integer and submits `{ wipLimit: parsedValue }`.
  - Clear / Remove Limit button: Submits `{ wipLimit: null }`.
- Local state:
  - `isOpen: boolean` for popover open state.
  - `limitValue: string` for input string state (prefilled from `column.wipLimit?.toString() ?? ""`).
- Mutation call:
  - Calls `updateColumnMutation.mutate({ id: column.columnId, projectId: project.id, data: { wipLimit: ... } })`.
  - Target ID is `column.columnId` (the database UUID), never `column.id` (slug).
- Empty/Clear semantics:
  - Submitting an empty string or clicking Clear sends `wipLimit: null`.

### i18n Keys & English Strings
In `i18n/en-US.json` under `tasks.kanban`:
- `"wipLimitTooltip"`: `"WIP limit"`
- `"setWipLimit"`: `"Set WIP limit"`
- `"wipLimitPlaceholder"`: `"Limit (optional)"`
- `"wipLimitExceeded"`: `"Column is over WIP limit"`
- `"clearWipLimit"`: `"Clear limit"`
- `"saveWipLimit"`: `"Save"`

## Type flow

1. **`columnTable` (`apps/api/src/database/schema.ts`)**: Defines `wipLimit: integer("wip_limit")` (inferred type: `number | null`).
2. **`getTasks` (`apps/api/src/task/controllers/get-tasks.ts`)**: Injects `columnId: column.id` (`string`) and `wipLimit: column.wipLimit` (`number | null`) into `projectColumns.map(...)`.
3. **`AppType` (`apps/api/src/index.ts`)**: Hono application type reflects the route response types of `GET /task/tasks/:projectId` and column routes.
4. **`client` (`packages/libs/src/hono.ts`)**: `hc<AppType>` infers the updated return structure of `$get` on `/task/tasks/:projectId`.
5. **`ProjectWithTasks` (`apps/web/src/types/project/index.ts`)**: Derived via `InferResponseType<typeof client.task.tasks[":projectId"]["$get"], 200>`. Because it is directly inferred, `ProjectWithTasks["columns"][number]` automatically contains `columnId: string` and `wipLimit: number | null` without touching `project/index.ts`.
6. **`ColumnHeader` (`apps/web/src/components/kanban-board/column/column-header.tsx`)**: Receives `column: ProjectWithTasks["columns"][number]` with fully typed `columnId` and `wipLimit`.

## ADRs

**ADR-1: Additive `columnId` vs re-pointing `id`**
- **Context**: The board projection historically assigned `id: column.slug`. Column mutations require the database UUID `column.id`.
- **Decision**: Add `columnId: column.id` (the UUID) to the projection while preserving `id: column.slug`.
- **Consequence**: Avoids breaking downstream consumers such as `getColumnIcon(column.id, ...)` and `CreateTaskModal status={column.id}` while giving column mutations access to the primary key.
- **Alternative rejected**: Re-pointing `id` to `column.id` (UUID), which breaks icon lookup and task creation status mapping across the frontend.

**ADR-2: Extending `get-tasks` projection vs second column query**
- **Context**: The Kanban board loads data via `GET /task/tasks/:projectId`. `wipLimit` was not present in the board column projection.
- **Decision**: Add `wipLimit` directly to the `get-tasks.ts` column mapping.
- **Consequence**: Single roundtrip on board load; zero extra network latency or database overhead.
- **Alternative rejected**: Having the web client issue a secondary `GET /column/:projectId` call on board mount.

**ADR-3: Nullable integer without default vs default 0**
- **Context**: Columns can have no WIP limit.
- **Decision**: Use `integer("wip_limit")` with `null` indicating no limit.
- **Consequence**: Migration is a simple non-blocking `ADD COLUMN`, existing columns default naturally to `NULL`, and 0 is not conflated with "no limit".
- **Alternative rejected**: `integer("wip_limit").default(0).notNull()`, which requires table rewrite/backfill and creates ambiguity between 0-limit and unlimited.

## Invariants for review

- **`id: column.slug` invariant**: In `apps/api/src/task/controllers/get-tasks.ts`, `id` in the column projection must remain strictly `column.slug`. It must NEVER be changed to `column.id`.
- **Column mutation identifier invariant**: In `ColumnHeader`, mutations must target `column.columnId`, never `column.id`.
- **Indicator-only invariant**: No blocking, validation errors, or rejections on task creation, task update, drag-and-drop movement, or column reordering when a column exceeds its WIP limit.
- **Permission invariant**: The WIP limit edit control must be protected by `canUpdateProjects()` (`{ project: ["update"] }`).
- **Unset representation invariant**: Unset WIP limits must be represented as `null` in the database and API responses; rendering for `null` must remain identical to existing count badge behavior.

## Test plan

| Surface | Test description | Verification command |
|---|---|---|
| Database Migration | Verify schema generation and clean migration execution on existing database | `pnpm --filter @kaneo/api db:generate` |
| API Column Endpoints | Test POST (creation with positive int / null) and PUT (set, clear with null, omit) | `pnpm --filter @kaneo/api test` |
| API Board Endpoint | Verify `GET /task/tasks/:projectId` returns `id === slug`, `columnId`, and `wipLimit` | `pnpm --filter @kaneo/api test` |
| End-to-end Typecheck | Verify TypeScript inference across API, libs, fetchers, hooks, and UI components | `pnpm typecheck` |
| Web UI Component | Unit/Integration tests for `ColumnHeader` count rendering, over-capacity styling, and editor visibility | `pnpm --filter @kaneo/web test` |

## Contract conflicts

None.

# Stack profile — learned from repo scan

Built 2026-08-25T11:54:52Z from `5d1fc910`. **Authoritative** where it conflicts with any pre-authored adapter fragment (the shipped adapters are `generic`, `nest`, `python`; none match this repo).

## Language & runtime

TypeScript 7.0.2 across the whole monorepo, pure ESM (`"type": "module"` at root). Node >= 20.19, pnpm 10.32.1, Turborepo task graph, Biome 2.5.7 for lint+format (2-space indent, double quotes, trailing commas, semicolons). Shared tsconfigs live in `packages/typescript-config`. `interface` is discouraged — AGENTS.md asks for inferred types and `type` aliases unless extension or declaration merging is required.

## Framework

- **API:** Hono, with `hono-openapi` (`describeRoute` / `resolver` / `validator`) for OpenAPI metadata, **Valibot** (`import * as v from "valibot"`) for input validation, **Drizzle ORM** on PostgreSQL (`pg`), Better Auth for sessions/API keys, an internal event bus with WebSocket delivery and optional Redis fan-out.
- **Web:** React + Vite, TanStack Router (file-generated `routeTree.gen.ts`) and TanStack Query for server state, Radix/Base UI + Tailwind for primitives, dnd-kit for the kanban board, Zustand for client stores, Immer for immutable updates, react-i18next for all user-facing copy.
- **Typed client:** `hc<AppType>` Hono RPC exported from `@kaneo/libs`; API route types flow to the web app automatically.

## Conventions detected

### File naming

Everything is **kebab-case files, one exported unit per file, `export default` for the unit**. No `.controller.ts` / `.service.ts` suffixes — the *folder* carries the role.

- Domain folder: `apps/api/src/task/index.ts` (routes) + `apps/api/src/task/controllers/update-task-due-date.ts` (behavior)
- Web fetcher: `apps/web/src/fetchers/task/update-task-due-date.ts`
- Web hook: `apps/web/src/hooks/mutations/task/use-update-task-due-date.ts`, `apps/web/src/hooks/queries/task/use-get-tasks.ts`
- Component: `apps/web/src/components/kanban-board/column/column-header.tsx` (named export `ColumnHeader`)
- Test: colocated `task-labels.test.tsx` on web; centralized `tests/api/**/*.test.ts` for API.

Verb-first controller names mirror the operation (`create-task`, `update-task-due-date`, `bulk-update-tasks`, `move-task`).

### Handler / route shape

Routes are a single chained `new Hono<...>()` builder in `<domain>/index.ts`. Each route stacks: `describeRoute` (OpenAPI) → `validator("param"|"json"|"query", <valibot schema>)` → workspace-access middleware → permission middleware → entitlement middleware → a thin async handler that only unwraps `c.req.valid(...)` and delegates to a controller.

```ts
  .put(
    "/due-date/:id",
    describeRoute({
      operationId: "updateTaskDueDate",
      tags: ["Tasks"],
      description: "Update only the due date of a task",
      responses: {
        200: {
          description: "Task due date updated successfully",
          content: { "application/json": { schema: resolver(taskSchema) } },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator("json", v.object({ dueDate: v.optional(v.string()) })),
    workspaceAccess.fromTask(),
    requireWorkspacePermission({ task: ["update"] }),
    requireEntitlement,
    async (c) => {
      const { id } = c.req.valid("param");
      const { dueDate = null } = c.req.valid("json");
      const currentUserId = c.get("userId");

      const task = await updateTaskDueDate({ id, dueDate: ..., currentUserId });

      return c.json(task);
    },
  )
```

Handlers never contain domain logic and never re-check roles by hand — `requireWorkspacePermission({ task: ["update"] })` is the only authorization idiom.

### Controller shape

One `async function <verb><Noun>({ ...named args })` per file, ending in `export default`. Named-object parameters, not positional. `HTTPException` for expected failures. Drizzle query builder inline. `publishEvent()` after a successful mutation.

```ts
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function updateTaskDueDate({ id, dueDate, currentUserId }: {
  id: string; dueDate: Date | null; currentUserId: string;
}) {
  const existingTask = await db.query.taskTable.findFirst({ where: eq(taskTable.id, id) });
  if (!existingTask) throw new HTTPException(404, { message: "Task not found" });

  const [updatedTask] = await db
    .update(taskTable)
    .set({ dueDate: dueDate || null })
    .where(eq(taskTable.id, id))
    .returning();

  if (!updatedTask) throw new HTTPException(500, { message: "Failed to update task due date" });

  await publishEvent("task.due_date_changed", {
    taskId: updatedTask.id, projectId: updatedTask.projectId, userId: currentUserId,
    oldDueDate: existingTask.dueDate, newDueDate: dueDate,
    title: updatedTask.title, type: "due_date_changed",
  });

  return updatedTask;
}

export default updateTaskDueDate;
```

Note the read-before-write to produce old/new values for the event payload — that is the house pattern for any field change that shows up in activity.

### Web fetcher shape

Thin wrapper over the typed client, `export default`, `@/`-aliased imports for app-local modules, `@kaneo/libs` for the client. Errors are re-thrown as `Error(await response.text())`.

```ts
import { client } from "@kaneo/libs";
import type Task from "@/types/task";

async function updateTaskDueDate(taskId: string, task: Task) {
  const response = await client.task["due-date"][":id"].$put({
    param: { id: taskId },
    json: { dueDate: task.dueDate || "" },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

export default updateTaskDueDate;
```

The client path mirrors the route path segment-by-segment (`client.task["due-date"][":id"].$put`).

### Hook shape

Named export `use<Verb><Noun>`, `useMutation` + explicit `invalidateQueries` fan-out listing every cache key the mutation can affect. Queries use `use-get-*` under `hooks/queries/<domain>/`.

```ts
export function useUpdateTaskDueDate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (task: Task) => updateTaskDueDate(task.id, task),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["task", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["activities", variables.id] });
    },
  });
}
```

Query keys are tuples of `[entity, id]` / `[entityPlural, parentId]`.

### Component shape

Named function export, `type <Name>Props = { ... }` above it, hooks first (translation, store, mutation, permissions), then local state, then handlers, then a single JSX return. Tailwind utility classes inline; `lucide-react` icons; permission gating via `useWorkspacePermission()`; **all copy through `t("namespace:key")`**.

```tsx
type ColumnHeaderProps = { column: ProjectWithTasks["columns"][number] };

export function ColumnHeader({ column }: ColumnHeaderProps) {
  const { t } = useTranslation();
  const { project, setProject } = useProjectStore();
  const { canUpdateTasks, canCreateTasks } = useWorkspacePermission();
  ...
  <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
    {column.tasks.length}
  </span>
```

That count badge is the established pattern for a per-column aggregate.

### Test shape

Vitest everywhere, `describe` / `it`, explicit imports from `vitest` (no globals). API tests hoist mocks with `vi.hoisted` + `vi.mock` on the module path and use `vi.stubEnv` for config. Web component tests use `@testing-library/react` with an `afterEach(cleanup)`.

```ts
const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({ user: { id: "test-user" } })),
}));
vi.mock("../../apps/api/src/auth", () => ({ auth: { api: { getSession: authMocks.getSession } } }));
```

```tsx
afterEach(() => { cleanup(); });

describe("TaskLabels", () => {
  it("renders labels supplied by the task", () => {
    render(<TaskLabels labels={[{ id: "label-1", name: "Bug", color: "red" }]} />);
    expect(screen.getByText("Bug")).toBeVisible();
  });
});
```

API unit tests live in `tests/api/**` (import source via relative `../../apps/api/src/...`); Postgres-backed tests live in `tests/api-integration/**` behind `test:integration`.

### Config

Server config is read straight from `process.env` at module scope in the API (no central validator library); the root `.env` is loaded via `dotenv-mono`. Web-only overrides use `apps/web/.env.local` and `import.meta.env.VITE_*`. See `ENVIRONMENT_SETUP.md`. There is no envalid/zod-env layer — do not introduce one.

### Data layer

Drizzle ORM, PostgreSQL. Schema in `apps/api/src/database/schema.ts` using `pgTable` with snake_case column names mapped to camelCase properties; relations separately in `apps/api/src/database/relations.ts`; indexes and constraints in the table's third argument.

```ts
export const taskTable = pgTable(
  "task",
  {
    id: text("id").$defaultFn(() => createId()).primaryKey(),
    projectId: text("project_id").notNull().references(() => projectTable.id, {
      onDelete: "cascade", onUpdate: "cascade",
    }),
    position: integer("position").default(0),
    priority: text("priority").default("low").notNull(),
    dueDate: timestamp("due_date", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("task_projectId_idx").on(table.projectId),
    unique("task_project_number_unique").on(table.projectId, table.number),
  ],
);
```

Reads use `db.query.<table>.findFirst/findMany({ where: eq(...) })`; writes use `db.update(...).set(...).where(...).returning()` and destructure `const [row] = ...`.

**Migrations are generated, never hand-written:** `pnpm --filter @kaneo/api db:generate` emits the next numbered file into `apps/api/drizzle/` (currently through `0042_previous_the_executioner.sql`) and updates `apps/api/drizzle/meta/`. Inspect the SQL and commit it with the schema change. New columns must be nullable or defaulted so existing installations migrate cleanly.

### Framework-owned wiring

- **New API route:** add a `.get/.post/.put/.patch/.delete` link to the existing chained `Hono` builder in `apps/api/src/<domain>/index.ts`, and import the controller at the top. The domain router is then mounted in `apps/api/src/index.ts`. The exported `AppType` propagates the new route's types to `@kaneo/libs` automatically — no manual client edit.
- **New web route:** file-based via TanStack Router; `routeTree.gen.ts` is regenerated by the Vite plugin, never edited by hand.
- **New user-facing string:** add the key to `i18n/en-US.json` (source of truth) and reference it as `t("namespace:key")`; `pnpm i18n:check` validates coverage.
- **New realtime-visible mutation:** call `publishEvent("<entity>.<change>", {...})` in the controller, then make sure the corresponding TanStack Query keys are invalidated in the web hook.

## Sample files inspected

- `apps/api/src/task/index.ts` (kind: routes/OpenAPI — 903 lines, read in slices)
- `apps/api/src/task/controllers/update-task-due-date.ts` (kind: controller)
- `apps/api/src/database/schema.ts` (kind: ORM schema — `taskTable` block)
- `apps/api/src/schemas.ts` (kind: shared Valibot response schemas)
- `packages/libs/src/hono.ts` (kind: typed client)
- `apps/web/src/fetchers/task/update-task-due-date.ts` (kind: fetcher)
- `apps/web/src/hooks/mutations/task/use-update-task-due-date.ts` (kind: mutation hook)
- `apps/web/src/components/kanban-board/column/column-header.tsx` (kind: component)
- `apps/web/src/components/kanban-board/task-labels.test.tsx` (kind: web test)
- `tests/api/mcp-internal-api-url.test.ts` (kind: api test)

## Notes for downstream codegen

- Mirror the **due-date field** end-to-end as the template for any new scalar task field: schema column → generated migration → `taskSchema` entry in `apps/api/src/schemas.ts` → controller with read-before-write + `publishEvent` → route link with `describeRoute` + Valibot validators + `workspaceAccess.fromTask()` + `requireWorkspacePermission({ task: ["update"] })` → fetcher → mutation hook with invalidations → UI.
- `export default` for controllers and fetchers; **named** exports for hooks and components.
- Never add a parallel untyped request layer — always go through `client` from `@kaneo/libs`.
- Never hand-write a migration SQL file. Never edit `apps/api/drizzle/meta/` or `apps/web/src/routeTree.gen.ts`.
- Never hardcode user-facing English in JSX; add an `i18n/en-US.json` key.
- Keep handlers thin; put behavior in `controllers/`.
- Prefer `type` over `interface`; let Drizzle/Valibot inference supply types rather than restating shapes.
- Comments only where a constraint is surprising — the codebase does not narrate code.
- Verify with the smallest proof: focused `pnpm --filter @kaneo/api test` / `pnpm --filter @kaneo/web test`, and add `pnpm --filter @kaneo/api test:integration` when Postgres behavior or a migration is involved.

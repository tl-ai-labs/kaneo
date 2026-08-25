# Stack profile — learned from repo scan

Built `2026-08-25` for run `20260825-084051-feature-extend-estimated-hours` at git HEAD `5d1fc910`.
Authoritative over any pre-authored adapter fragment (no shipped adapter matches Hono + React/TanStack).

## Language & runtime

TypeScript 7.0.2, ESM throughout (`"type": "module"` at root), Node >= 20.19, pnpm 10.32.1. Turborepo drives `build`/`dev`/`lint`/`test`/`typecheck`/`test:integration` across a pnpm workspace (`packages/**`, `apps/**`). Formatting and linting are Biome 2.5.7 from a single root `biome.json`: **tab indentation for most files, but two-space indentation for JS/TS** (`javascript.formatter.indentStyle: "space"`), double quotes, `organizeImports` assist on. Types are inferred and `type` aliases are preferred over `interface`.

## Frameworks

- API (`apps/api`): **Hono** with `hono-openapi` (`describeRoute` / `resolver` / `validator`), **Valibot** for input validation, **Drizzle ORM** on PostgreSQL, Better Auth, an in-process event bus, WebSockets, optional Redis fan-out, MCP HTTP routes.
- Web (`apps/web`): **React + Vite**, TanStack Router (file-based, generated `routeTree.gen.ts`), TanStack Query for server state, Zustand + immer for local stores, Tailwind v4, dnd-kit for the board, react-i18next for all copy.
- Marketing site (`apps/site`): Next.js. Separate concern from the product.

## Conventions detected

### File naming

Kebab-case files everywhere, one exported unit per file, folder-per-domain.

- API: `apps/api/src/task/index.ts` (routes), `apps/api/src/task/controllers/update-task.ts`, `apps/api/src/task/validate-task-fields.ts`
- Web: `apps/web/src/fetchers/task/update-task.ts`, `apps/web/src/hooks/mutations/task/use-update-task.ts`, `apps/web/src/components/kanban-board/column/column-header.tsx`
- Tests mirror the source path: `tests/api/column/create-column.test.ts`, or colocate as `apps/web/src/components/kanban-board/task-labels.test.tsx`

No `PascalCase.ts` files; React components are PascalCase *identifiers* inside kebab-case files.

### Route / handler shape

Handlers are thin. One chained `Hono` instance per domain in `<domain>/index.ts`; each route pairs `describeRoute` metadata with `validator(...)` and delegates to a controller.

```ts
// apps/api/src/task/index.ts
const task = new Hono<{
  Variables: {
    userId: string;
  };
}>()
  .get(
    "/tasks/:projectId",
    describeRoute({
      operationId: "listTasks",
      tags: ["Tasks"],
      description: "Get all tasks for a specific project",
      responses: {
        200: {
          description: "Project with tasks organized by columns",
          content: {
            "application/json": { schema: resolver(v.any()) },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
```

Imports are sorted by Biome: external packages first, then relative `../` then `./`. Middleware in use: `workspaceAccess`, `requireWorkspacePermission`, `requireEntitlement`, plus domain-specific guards in `controllers/require-task-permission.ts`.

### Controller shape

One `async function` per file, default-exported at the bottom. Positional parameters (not an options object) for the task controllers. Expected failures throw `HTTPException`. Drizzle is used directly — no repository layer.

```ts
// apps/api/src/task/controllers/update-task.ts
async function updateTask(
  id: string,
  title: string,
  status: string,
  startDate: Date | undefined,
  dueDate: Date | undefined,
  projectId: string,
  description: string,
  priority: string,
  position: number,
  userId?: string,
  currentUserId?: string,
) {
  const [existingTask] = await db
    .select({ id: taskTable.id, status: taskTable.status })
    .from(taskTable)
    .where(eq(taskTable.id, id))
    .limit(1);

  if (!existingTask) {
    throw new HTTPException(404, { message: "Task not found" });
  }
  ...
}
export default updateTask;
```

Mutations that drive activity, notifications, integrations or realtime call `publishEvent()` from `../../events` before returning.

### Web fetcher shape

Every request goes through the typed `@kaneo/libs` Hono client. Never `fetch` directly. Request types are inferred with `InferRequestType`.

```ts
// apps/web/src/fetchers/task/update-task.ts
import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import type Task from "@/types/task";

async function updateTask(taskId: string, task: Task) {
  const response = await client.task[":id"].$put({
    param: { id: taskId },
    json: { title: task.title, status: task.status, /* ... */ },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

export default updateTask;
```

### Web hook shape

Named export `useXxx`, wraps the fetcher in TanStack Query, invalidates every affected query key explicitly.

```ts
// apps/web/src/hooks/mutations/task/use-update-task.ts
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (task: Task) => updateTask(task.id, task),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["task", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["activities", variables.id] });
    },
  });
}
```

### Component shape

Local `type XxxProps = { ... }` above the function, `@/`-aliased imports, Tailwind utility strings inline (template literals for conditional variants), `useTranslation()` for every user-visible string, permission checks via `useWorkspacePermission()`. Small components are named exports; page-level/default component per folder uses `export default`.

```tsx
// apps/web/src/components/kanban-board/column/column-header.tsx
type ColumnHeaderProps = {
  column: ProjectWithTasks["columns"][number];
};

export function ColumnHeader({ column }: ColumnHeaderProps) {
  const { t } = useTranslation();
  const { canUpdateTasks, canCreateTasks } = useWorkspacePermission();
  ...
  toast.success(t("tasks:archive.success", { count: column.tasks.length }));
```

Note the derived-from-column-data pattern: `column.tasks.length` is read straight off `ProjectWithTasks["columns"][number]`, which is where any per-lane rollup would naturally live.

### Test shape

Vitest with `describe`/`it`/`expect` imported explicitly (no globals). Unit tests import the real function from the source path and exercise it directly; integration tests under `tests/api-integration` hit a live PostgreSQL via helpers in `tests/api-integration/helpers/`.

```ts
// tests/api/column/create-column.test.ts
import { describe, expect, it } from "vitest";
import { toSlug } from "../../../apps/api/src/column/controllers/create-column";

describe("toSlug", () => {
  it("slugifies Latin names", () => {
    expect(toSlug("To Do")).toBe("to-do");
  });
});
```

Web component tests are colocated (`task-labels.test.tsx`) and use Testing Library + jsdom.

### Config

Env-driven, loaded through `dotenv-mono` from the root `.env`; Vite-only overrides in `apps/web/.env.local`. Access is plain `process.env.X` with local defaulting — no central schema validator. Biome's `noUndeclaredEnvVars` rule warns on names not present in the env files (66 such warnings already exist), so **a new server env var should be added to `.env.sample` or it adds a fresh warning**.

### Data layer

Drizzle ORM, PostgreSQL dialect. Schema is a single file, `apps/api/src/database/schema.ts` (`taskTable` starts at line 401), relations in `relations.ts`. Column naming is snake_case in SQL, camelCase in TS:

```ts
export const taskTable = pgTable(
  "task",
  {
    id: text("id").$defaultFn(() => createId()).primaryKey(),
    projectId: text("project_id").notNull().references(() => projectTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    position: integer("position").default(0),
    title: text("title").notNull(),
    description: text("description"),
```

Queries mix the builder (`db.select().from().where()`) and the relational API (`db.query.columnTable.findFirst`), with raw `sql` templates for things like the priority ordering CASE expression in `get-tasks.ts`.

Migrations are generated, never hand-written: `pnpm --filter @kaneo/api db:generate` writes `apps/api/drizzle/00NN_<name>.sql` plus a `meta/` snapshot and journal entry. The SQL must be inspected and committed with the schema change.

### API contract surface

`apps/api/src/schemas.ts` holds shared Valibot object schemas used by OpenAPI resolvers:

```ts
export const taskSchema = v.object({
  id: v.string(),
  projectId: v.string(),
  position: v.nullable(v.number()),
  number: v.nullable(v.number()),
  userId: v.nullable(v.string()),
  title: v.string(),
  description: v.nullable(v.string()),
  status: v.string(),
  priority: v.picklist(["no-priority", "low", "medium", "high", "urgent"] as const),
  startDate: v.optional(v.date()),
  dueDate: v.optional(v.date()),
  createdAt: v.date(),
});
```

### Framework-owned wiring

- **API route registration:** create `apps/api/src/<domain>/index.ts` exporting a chained `Hono` instance, then mount it in `apps/api/src/index.ts`. Extending an existing domain means adding a link to the existing chain — the chained builder is what gives `@kaneo/libs` its inferred client types, so breaking the chain breaks the web client.
- **Typed client:** regenerated implicitly by type inference from `@kaneo/api`; `packages/libs` re-exports it. A new field on a request body becomes available to `apps/web` only after the API types compile.
- **Web routes:** TanStack Router file-based under `apps/web/src/routes/`; `routeTree.gen.ts` is generated — never edit.
- **i18n:** add the key to `i18n/en-US.json` (source of truth, 11 namespaces) and run `pnpm i18n:check`; other locale files are reconciled by the same script.

## Sample files inspected

- `apps/api/src/task/index.ts` (kind: routes)
- `apps/api/src/task/controllers/update-task.ts` (kind: controller)
- `apps/api/src/task/controllers/get-tasks.ts` (kind: controller / read path)
- `apps/api/src/database/schema.ts` (kind: schema)
- `apps/api/src/schemas.ts` (kind: validator / OpenAPI contract)
- `apps/api/drizzle.config.ts` (kind: config)
- `tests/api/column/create-column.test.ts` (kind: test)
- `apps/web/src/fetchers/task/update-task.ts` (kind: fetcher)
- `apps/web/src/hooks/mutations/task/use-update-task.ts` (kind: hook)
- `apps/web/src/components/kanban-board/column/index.tsx` (kind: component)
- `apps/web/src/components/kanban-board/column/column-header.tsx` (kind: component)
- `biome.json`, `turbo.json`, `pnpm-workspace.yaml`, `.github/workflows/ci.yml` (kind: tooling)

## Notes for downstream codegen

- Two-space indent and double quotes for `.ts`/`.tsx`; tabs for JSON/YAML. Biome will flag either way round, and `biome ci` is a CI gate.
- Keep route handlers thin: validation in the `validator(...)` slot, behavior in `controllers/<verb>-<noun>.ts` with a default export.
- Every new API field needs the full chain: Drizzle column → generated migration → `schemas.ts` Valibot shape → route validator + `describeRoute` metadata → controller read/write → web type → fetcher payload → hook invalidation → component render.
- Authorization belongs in `requireWorkspacePermission` / the domain guard, never in the UI.
- Never hand-edit `apps/api/drizzle/meta/**` or `apps/web/src/routeTree.gen.ts`.
- All user-facing copy goes through static i18n keys in `i18n/en-US.json`; no inline English strings in components.
- If a mutation changes realtime state, call `publishEvent()` and check the WebSocket + TanStack Query invalidation path.
- Commit messages must be conventional (commitlint via husky).

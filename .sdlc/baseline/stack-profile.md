# Stack profile — learned from repo scan

Built 2026-08-31 from `5d1fc910`. Authoritative over any pre-authored adapter fragment on conflict.

Trigger: primary stacks are **Hono** (API) and **React + Vite** (web). Shipped adapters are `generic.md`, `nest.md`, `python.md`; none match. `nest.md` is superficially close (TypeScript, decorator-ish DI, controllers) but is actively misleading here — this repo has **no NestJS, no decorators, no DI container, no modules**. Do not pattern-match on Nest.

## Language & runtime

TypeScript 7.0.2, Node ≥ 20.19, pure ESM (`"type": "module"` at root). pnpm 10.32.1 workspace + Turborepo. Formatter/linter is **Biome 2.5.7** (not ESLint/Prettier): 2-space indent, double quotes, trailing commas, semicolons, sorted imports. `pnpm exec biome ci .` is the read-only check; `biome check --write .` rewrites.

Type style per `AGENTS.md` and observed everywhere: **`type` aliases, never `interface`**, unless extension/declaration-merging is required. Inferred types are preferred over explicit annotations.

## Framework

- **API**: Hono 4 + `hono-openapi` (`describeRoute`, `resolver`, `validator`) + **Valibot** (`import * as v from "valibot"`) + Drizzle ORM on PostgreSQL + Better Auth. Errors are `HTTPException` from `hono/http-exception`.
- **Web**: React + Vite, TanStack Router (file/route tree) + TanStack Query for server state, Zustand + nanostores for client state, dnd-kit for drag/drop, Tailwind v4, Radix/Base UI primitives under `@/components/ui/`, i18next.
- **Contract**: `packages/libs` exports a typed Hono `hc` client. Web never hand-rolls fetch.

## Conventions detected

### File naming

**kebab-case files, PascalCase component/type names.** No `.controller.ts` / `.service.ts` suffixes anywhere.

- API routes: `src/<domain>/index.ts` (e.g. `src/task/index.ts`, `src/column/index.ts`)
- API business logic: `src/<domain>/controllers/<verb-noun>.ts` — `create-task.ts`, `update-task-due-date.ts`, `get-tasks.ts`, `bulk-update-tasks.ts`
- API shared helpers: `src/<domain>/validate-task-fields.ts`, `src/utils/validate-dates.ts`
- Web components: `apps/web/src/components/<area>/<thing>.tsx` — `task-card.tsx`, `column/column-header.tsx`, `task-due-date-popover.tsx`
- Web data layer: `apps/web/src/fetchers/<domain>/<verb-noun>.ts`, `apps/web/src/hooks/mutations/<domain>/use-<verb-noun>.ts`, `apps/web/src/hooks/queries/<domain>/use-<verb-noun>.ts`
- Web types: `apps/web/src/types/<domain>/index.ts`

### Handler / route shape (Hono)

One `new Hono<{ Variables: { userId: string } }>()` per domain, then a **single chained builder** of `.get()/.post()/.put()/.delete()` — chaining is load-bearing for the typed client, so never break the chain. Each route is: path, `describeRoute({operationId, tags, description, responses})`, `validator("param"|"json"|"query", v.object({…}))`, then middleware, then the handler.

```ts
const task = new Hono<{ Variables: { userId: string } }>()
  .post(
    "/:projectId",
    describeRoute({
      operationId: "createTask",
      tags: ["Tasks"],
      description: "Create a new task in a project",
      responses: {
        200: {
          description: "Task created successfully",
          content: { "application/json": { schema: resolver(taskSchema) } },
        },
      },
    }),
    validator(
      "json",
      v.object({
        title: v.string(),
        description: v.string(),
        startDate: v.optional(v.string()),
        dueDate: v.optional(v.string()),
        priority: v.picklist(VALID_PRIORITIES),
        status: v.string(),
        userId: v.optional(v.string()),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ task: ["create"] }),
    requireEntitlement,
    async (c) => {
      const { projectId } = c.req.param();
      const { title, description, priority, status, userId } = c.req.valid("json");
      const task = await createTask({ projectId, currentUserId: c.get("userId"), ... });
      return c.json(task);
    },
  )
```

Middleware order is consistent: `workspaceAccess.fromProject(param)` or `workspaceAccess.fromTask()` → `requireWorkspacePermission({ resource: ["action"] })` → any resource-specific guard → `requireEntitlement`. The current user always comes from `c.get("userId")`, never from the body.

Dates cross the wire as **strings** and are parsed by `validateAndParseDate(value, "fieldName")` / `validateDateRange(start, end)` from `src/utils/validate-dates`.

Wiring: `apps/api/src/index.ts` does `const taskApi = api.route("/task", task);` alongside every other domain, and finally `app.route("/api", api)`. A new route registers by being added to the existing chain in the domain's `index.ts` — no new file registration needed.

### Controller shape

Default-exported async function per file. Two argument styles coexist; **prefer the named-object style for anything new**.

Named-object (newer, e.g. `create-task.ts`):

```ts
async function createTask({
  projectId, currentUserId, userId, title, status, startDate, dueDate, description, priority,
}: {
  projectId: string; currentUserId: string; userId?: string; title: string; status: string;
  startDate?: Date; dueDate?: Date; description?: string; priority?: string;
}) {
  await assertValidTaskStatus(resolvedStatus, projectId);
  const createdTask = await db.transaction(async (tx) => {
    const taskNumber = await claimTaskNumber(projectId, tx);
    const [task] = await tx.insert(taskTable).values({ ... }).returning();
    return task;
  });
  if (!createdTask) throw new HTTPException(500, { message: "Failed to create task" });
  await publishEvent("task.created", { ...createdTask, taskId: createdTask.id, ... });
  return { ...createdTask, assigneeName: assignee?.name };
}
export default createTask;
```

Positional (older, e.g. `update-task.ts` with 11 parameters). Do not extend positional signatures; convert or add a dedicated single-field endpoint instead.

Invariants visible in every controller: destructure the first element of Drizzle's array result (`const [task] = await ...returning()`), throw `HTTPException` with a plain `message` on the failure branch, and call `publishEvent(...)` after a state change that drives activity/notifications/realtime.

### Validation shape

Two layers. Valibot at the route edge for shape; hand-written assert helpers for domain rules:

```ts
export const VALID_PRIORITIES = ["no-priority","low","medium","high","urgent"] as const;

export function assertValidPriority(priority: string): void {
  if (!(VALID_PRIORITIES as readonly string[]).includes(priority)) {
    throw new HTTPException(400, {
      message: `Invalid priority "${priority}". Valid values: ${VALID_PRIORITIES.join(", ")}`,
    });
  }
}
```

Import-path coercers live beside them (`coerceStatus`, `coercePriority`) and return `{ value, warning? }` rather than throwing.

### Data layer

Drizzle ORM, schema in `apps/api/src/database/schema.ts`, relations in `relations.ts`. Every table: `pgTable(name, columns, (table) => [ …indexes… ])`, snake_case DB names mapped to camelCase TS names, cuid2 IDs.

```ts
export const taskTable = pgTable(
  "task",
  {
    id: text("id").$defaultFn(() => createId()).primaryKey(),
    projectId: text("project_id").notNull()
      .references(() => projectTable.id, { onDelete: "cascade", onUpdate: "cascade" }),
    priority: text("priority").default("low").notNull(),
    dueDate: timestamp("due_date", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index("task_projectId_idx").on(table.projectId),
    unique("task_project_number_unique").on(table.projectId, table.number),
  ],
);
```

**Reads use explicit column allowlists**, never bare `select()` on task:

```ts
const taskSelection = {
  id: taskTable.id, title: taskTable.title, number: taskTable.number,
  description: taskTable.description, status: taskTable.status,
  priority: taskTable.priority, startDate: taskTable.startDate,
  dueDate: taskTable.dueDate, position: taskTable.position,
  createdAt: taskTable.createdAt, userId: taskTable.userId,
  assigneeName: userTable.name, assigneeId: userTable.id,
  assigneeImage: userTable.image, projectId: taskTable.projectId,
};
```

A new column is invisible to clients until it is added to each such projection.

Migrations: `pnpm --filter @kaneo/api db:generate` → `apps/api/drizzle/00NN_<name>.sql` + `drizzle/meta/00NN_snapshot.json` + a `drizzle/meta/_journal.json` entry. Statements are separated by `--> statement-breakpoint`. Migrations touching existing data backfill before tightening:

```sql
UPDATE "task" SET "priority" = 'low' WHERE "priority" IS NULL;--> statement-breakpoint
ALTER TABLE "task" ALTER COLUMN "priority" SET NOT NULL;
```

### Web component shape

Function declarations (not arrow consts) with a local `type <Name>Props = {…}`, `export default` for page-ish/leaf components and named `export function` for sub-components. Class strings are template literals with `cn()`/`clsx` where conditional. Icons from `lucide-react`.

```tsx
type ColumnHeaderProps = {
  column: ProjectWithTasks["columns"][number];
};

export function ColumnHeader({ column }: ColumnHeaderProps) {
  const { t } = useTranslation();
  const { project, setProject } = useProjectStore();
  const { canUpdateTasks, canCreateTasks } = useWorkspacePermission();
  ...
}
```

Popover pattern (`children` as trigger, permission short-circuit, toast on both branches):

```tsx
type TaskDueDatePopoverProps = { task: Task; children: React.ReactNode };

export default function TaskDueDatePopover({ task, children }: TaskDueDatePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { mutateAsync: updateTaskDueDate } = useUpdateTaskDueDate();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();

  const handleDateChange = async (date: Date | undefined) => {
    try {
      await updateTaskDueDate({ ...task, dueDate: date?.toISOString() || null });
      toast.success(t("tasks:popover.dueDate.updateSuccess"));
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("tasks:popover.dueDate.updateError"));
    }
  };

  if (!canEdit) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="p-0" align="start">…</PopoverContent>
    </Popover>
  );
}
```

Mutation hook pattern:

```ts
export function useUpdateTaskDueDate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (task: Task) => updateTaskDueDate(task.id, task),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["task", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["activities", variables.id] });
    },
  });
}
```

Query keys are arrays: `["task", id]`, `["tasks", projectId]`, `["projects"]`, `["activities", id]`.

Imports use the `@/` alias for anything under `apps/web/src`, relative paths only for close siblings (`./task-labels`, `../ui/button`).

### Config

Server env comes from the root `.env` via `dotenv-mono`; there is no central validated config object — modules read `process.env.X` at point of use with inline defaults. Web uses `import.meta.env.VITE_*`, with `apps/web/.env.local` for Vite-only local overrides. See `ENVIRONMENT_SETUP.md`.

### i18n

Static keys only, namespaced with a colon: `t("tasks:popover.dueDate.updateSuccess")`, `t("tasks:kanban.addTask")`, `t("tasks:archive.success", { count })`. Source of truth is `i18n/en-US.json` at the repo root; 17 locale files sit flat beside it. Never build a key by string concatenation. After adding a key, run `pnpm i18n:check:fix` or the other 16 locales fail `pnpm i18n:check`.

### Test shape

Vitest everywhere. API unit tests live at `tests/api/**` (outside the package) and import source with deep relative paths; they cover pure functions, no DB:

```ts
import { describe, expect, it } from "vitest";
import { toSlug } from "../../../apps/api/src/column/controllers/create-column";

describe("toSlug", () => {
  it("slugifies Latin names", () => {
    expect(toSlug("To Do")).toBe("to-do");
  });
});
```

Web tests are co-located, small, and behavioural:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TaskLabels } from "./task-labels";

afterEach(() => { cleanup(); });

describe("TaskLabels", () => {
  it("renders labels supplied by the task", () => {
    render(<TaskLabels labels={[{ id: "label-1", name: "Bug", color: "red" }]} />);
    expect(screen.getByText("Bug")).toBeVisible();
  });
});
```

API integration tests (`tests/api-integration/**`) hit a real PostgreSQL, run serially, use `setup.ts` + `helpers/` + a mocked `@kaneo/email`, and are the only place schema/migration/authorization behavior is genuinely proved.

## Sample files inspected

- `apps/api/src/task/index.ts` (kind: routes)
- `apps/api/src/index.ts` (kind: app wiring)
- `apps/api/src/task/controllers/create-task.ts` (kind: controller)
- `apps/api/src/task/controllers/update-task.ts` (kind: controller)
- `apps/api/src/task/controllers/get-task.ts`, `get-tasks.ts` (kind: read projection)
- `apps/api/src/task/validate-task-fields.ts` (kind: domain validator)
- `apps/api/src/schemas.ts` (kind: Valibot/OpenAPI schema)
- `apps/api/src/database/schema.ts` (kind: ORM schema)
- `apps/api/drizzle/0042_previous_the_executioner.sql`, `0029_fk_supporting_indexes.sql` (kind: migration)
- `apps/api/drizzle.config.ts`, `vitest.config.ts`, `vitest.integration.config.ts` (kind: config)
- `apps/web/src/components/kanban-board/column/column-header.tsx`, `column/index.tsx`, `task-card.tsx` (kind: component)
- `apps/web/src/components/task/task-due-date-popover.tsx`, `task-properties-sidebar.tsx` (kind: component)
- `apps/web/src/hooks/mutations/task/use-update-task-due-date.ts` (kind: mutation hook)
- `apps/web/src/types/task/index.ts` (kind: type)
- `tests/api/column/*.test.ts`, `apps/web/src/components/kanban-board/task-labels.test.tsx` (kind: test)
- `i18n/en-US.json`, `scripts/i18n/shared.mjs`, `scripts/i18n/check.mjs` (kind: i18n)

## Notes for downstream codegen

- Say **Column**, never Lane — in identifiers, i18n keys, comments and prose. There is not a single word-boundary occurrence of "lane" in the codebase.
- Never emit NestJS shapes: no `@Injectable`, no `@Controller`, no modules, no DI.
- Zod exists in `apps/api`'s dependency list but API validation is **Valibot**. Zod is only for MCP tool schemas (`packages/mcp`). Do not introduce Zod into a Hono route.
- Keep the `.get().post().put()` chain in a domain `index.ts` unbroken — the typed client's inference depends on it.
- A task field is only visible to clients once added to **all** of: `schema.ts`, the migration, `schemas.ts#taskSchema`, the route validators, the write controllers, **and** the explicit select projections in `get-task.ts` and `get-tasks.ts`.
- For a new single-field edit, follow the existing dedicated-endpoint precedent (`PUT /:id/priority`, `/due-date`, …) rather than widening the 11-argument positional `updateTask`.
- Web: `type` not `interface`; function declarations not arrow consts; `@/` alias imports; `lucide-react` icons; permission gating via `useWorkspacePermission()` with the `if (!canEdit) return <>{children}</>` short-circuit in popovers.
- Every mutation that changes shared state needs `publishEvent()` on the API side and `queryClient.invalidateQueries` on the web side — invalidate `["task", id]` and `["tasks", projectId]` at minimum.
- Emit Biome-compatible formatting: 2 spaces, double quotes, semicolons, trailing commas, sorted imports. Verify with `pnpm exec biome ci .`, never `pnpm lint` (it rewrites).

# Stack profile — learned from repo scan

Built for run `20260831-060942-docs-board-features` at HEAD `5d1fc910`.
**Authoritative** — where this disagrees with a pre-authored adapter fragment, this wins.

Trigger: dominant stack is Hono + React/TanStack + Drizzle on pnpm/Turborepo. Shipped adapters are `generic.md`, `nest.md`, `python.md` — none match. `nest.md` in particular would be actively misleading here: there are no Nest modules, no DI container, no `@Injectable`.

## Language & runtime

TypeScript 7.0.2, pure ESM (`"type": "module"` at root), Node `>=20.19.0`, pnpm 10.32.1. Turborepo orchestrates `build`/`dev`/`lint`/`typecheck`/`test`/`test:integration` across nine workspace packages. Biome 2.5.7 is the single formatter and linter (no ESLint, no Prettier). Formatting is **tab-indented** in JSON config files (`turbo.json`, `apps/docs/docs.json`) and 2-space in TS/TSX. Shared tsconfig via `@kaneo/typescript-config`.

## Framework

- **API** (`apps/api`): Hono, with `hono-openapi` for spec generation and **Valibot** (`import * as v from "valibot"`) for validation. Not Zod. Not Nest.
- **Data**: Drizzle ORM against PostgreSQL. Schema in `apps/api/src/database/schema.ts`, relations in `relations.ts`, generated migrations committed alongside.
- **Auth**: Better Auth.
- **Web** (`apps/web`): React + Vite + TanStack Router (file-based routes) + TanStack Query, `react-i18next`, `react-use-websocket`.
- **Site** (`apps/site`): Next.js — separate marketing/docs host.
- **Docs** (`apps/docs`): **Mintlify**. `.mdx` content, navigation declared in `docs.json`. No package.json, no build script in the workspace graph.
- **Tests**: Vitest everywhere; `@testing-library/react` for hooks/components.

## Conventions detected

### File naming

Kebab-case files throughout, with the role in the filename rather than in the class name.

- API modules: `apps/api/src/task/index.ts` (routes) + `apps/api/src/task/controllers/get-tasks.ts`, `create-task.ts`, `move-task.ts` — one exported function per file, default export.
- Web hooks: `apps/web/src/hooks/use-task-filters.ts`, `use-task-filters-with-labels-support.ts`.
- Web components: `apps/web/src/components/board/board-toolbar.tsx`.
- Tests sit **next to the source**: `use-task-filters-with-labels-support.test.tsx`. API-level tests live in the separate `tests/api/` and `tests/api-integration/` trees.
- Docs pages: `apps/docs/core/functional/plan-and-execute-tasks.mdx` — kebab-case, verb-led.

### Handler / route shape

Routes are a single chained `new Hono()` builder. Each verb takes, in strict order: path, `describeRoute({...})` OpenAPI metadata, one `validator(...)` per input location, permission/access middleware, then a thin async handler that delegates to a controller.

```ts
const task = new Hono<{ Variables: { userId: string } }>()
  .get(
    "/tasks/:projectId",
    describeRoute({
      operationId: "listTasks",
      tags: ["Tasks"],
      description: "Get all tasks for a specific project",
      responses: {
        200: {
          description: "Project with tasks organized by columns",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    validator("query", v.optional(v.object({
      status: v.optional(v.string()),
      page: v.optional(v.pipe(v.string(), v.transform(Number))),
      sortOrder: v.optional(v.picklist(["asc", "desc"])),
    }))),
    workspaceAccess.fromProject("projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const filters = c.req.valid("query") || {};
      const tasks = await getTasks(projectId, filters);
      return c.json(tasks);
    },
  )
```

Handlers stay thin — destructure validated input, call a controller, `c.json(...)`. No business logic inline.

### Controller shape

Controllers are plain async functions with an inline `type ...Options = {...}` for their argument object, default-exported. They own the Drizzle queries and throw `HTTPException` for expected failures.

```ts
import { and, asc, desc, eq, gte, inArray, lte, type SQL, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable, taskTable, userTable } from "../../database/schema";

type GetTasksOptions = {
  assigneeId?: string;
  dueAfter?: string;
  limit?: number;
  sortBy?: "createdAt" | "priority" | "dueDate" | "position" | "title";
};
```

No classes, no DI, no `Service`/`Repository` suffixes anywhere. The "service layer" is just controller functions plus `apps/api/src/utils/` helpers.

### Web state / hook shape

Server state via TanStack Query hooks; requests confined to `apps/web/src/fetchers/`, always through the typed `@kaneo/libs` client. Local UI state via custom hooks that export a typed state object plus mutators, often persisted to `localStorage` under a namespaced key.

```ts
export type BoardFilters = { /* status, priority, assignee, dueDate, labels */ };
export const DUE_DATE_FILTER_VALUES = { /* ... */ };
export function useTaskFilters(/* ... */) {
  const storageKey = projectId ? `kaneo:board-filters:${projectId}` : null;
  const filterTasks = (tasks: Task[]): Task[] => { /* ... */ };
}
```

Imports use the `@/` alias for intra-app paths (`@/types/project`) and relative paths for siblings.

### Test shape

Vitest with `describe`/`it`, explicit named imports from `vitest` (no globals), `@testing-library/react` `renderHook`/`waitFor` for hooks.

```ts
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useTaskFiltersWithLabelsSupport } from "./use-task-filters-with-labels-support";

describe("useTaskFiltersWithLabelsSupport", () => {
  const storageKey = "kaneo:board-filters:project-1";
  beforeEach(() => { window.localStorage.clear(); });
  it("restores persisted label filters from storage and matches tasks from project data", async () => {
```

Test names are full behavioral sentences. Fixtures are inline literal objects, not factories.

### Config

Server config comes from the root `.env` via `dotenv-mono`, read as `process.env.X` at point of use. Client config is `import.meta.env.VITE_*` (Vite). There is no central config module and no envalid/zod-env validator — validation is per-feature. `ENVIRONMENT_SETUP.md` documents the surface.

### Data layer

Drizzle ORM, PostgreSQL. Tables are declared with `pgTable` in `apps/api/src/database/schema.ts`, using `text("snake_case_column")` with camelCase TS keys, `createId()` for `$defaultFn` primary keys, and explicit `onDelete`/`onUpdate` on every reference.

```ts
export const timeEntryTable = pgTable("time_entry", {
  id: text("id").$defaultFn(() => createId()).primaryKey(),
  taskId: text("task_id").notNull().references(() => taskTable.id, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
  userId: text("user_id").references(() => userTable.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
});
```

Migrations are generated with `pnpm --filter @kaneo/api db:generate`, inspected, and committed with the schema change.

### Framework-owned wiring

- **New API route**: add a controller under `<domain>/controllers/`, import it in `<domain>/index.ts`, chain a new verb onto the `new Hono()` builder with `describeRoute` + `validator` + permission middleware. The domain router is then mounted in `apps/api/src/index.ts`.
- **New web route**: file-based under `apps/web/src/routes/_layout/_authenticated/dashboard/...` — TanStack Router generates the tree; no manual registration.
- **New docs page**: create the `.mdx` under `apps/docs/core/...` **and** register its path (extension-less) in the appropriate `pages` array in `apps/docs/docs.json`. A page not listed there does not appear in navigation.

```json
{
  "group": "Functional Guides",
  "pages": [
    "core/functional/index",
    "core/functional/create-workspace-and-project",
    "core/functional/plan-and-execute-tasks"
  ]
}
```

### Docs content conventions (relevant to this run's intent)

`.mdx` pages open with YAML frontmatter carrying `title` and `description`, then a one-line orienting sentence, then numbered `##` task-oriented sections, closing with a `## Next` section of relative cross-links.

```mdx
---
title: Plan and Execute Tasks in Board and List
description: Create tasks, set metadata, and execute work using Board and List views
---

Use this workflow to move from planning to execution with minimal overhead.

## 1. Create tasks quickly

In a project:

1. Open **Board** or **List** view.
2. Click **Create task**.

## Next

- [Plan work in Backlog](/core/functional/backlog-planning)
```

UI affordances are bolded (`**Create task**`), instructions are second-person imperative, cross-links are root-relative without file extensions.

## Sample files inspected

- `apps/api/src/task/index.ts` (kind: routes / framework wiring)
- `apps/api/src/task/controllers/get-tasks.ts` (kind: controller)
- `apps/api/src/database/schema.ts` (kind: ORM schema)
- `apps/api/src/time-entry/` + controllers (kind: domain module)
- `apps/web/src/hooks/use-task-filters.ts` (kind: state hook)
- `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` (kind: test)
- `apps/web/src/components/board/board-toolbar.tsx` (kind: component)
- `apps/docs/core/functional/plan-and-execute-tasks.mdx` (kind: docs page)
- `apps/docs/docs.json` (kind: docs navigation config)
- `package.json`, `pnpm-workspace.yaml`, `turbo.json` (kind: workspace config)

## Notes for downstream codegen

- **Valibot, not Zod.** `import * as v from "valibot"`; `v.object`, `v.optional`, `v.picklist`, `v.pipe(v.string(), v.transform(Number))`.
- **No classes in the API.** Plain default-exported async functions. Emitting a `TaskService` class would be wrong for this repo.
- **Every API route needs four things** or it is incomplete: `describeRoute` OpenAPI metadata, Valibot validators, a permission/access middleware (`requireWorkspacePermission` / `workspaceAccess.fromProject`), and a thin handler.
- **Never duplicate role checks** — use `requireWorkspacePermission` and the `@kaneo/permissions` vocabulary.
- **Mutations affecting realtime state** must call `publishEvent()` and consider WebSocket delivery plus TanStack Query cache invalidation.
- **User-facing web copy must use static i18n keys**; `i18n/en-US.json` is source of truth. This does *not* apply to `apps/docs` `.mdx` content, which is English-only Mintlify prose.
- **Docs changes are two-file operations** when adding a page: the `.mdx` plus a `docs.json` nav entry. Editing an existing page's body is a single-file change and needs no nav edit.
- **Feature documentation belongs in `apps/docs/`, not `README.md`.** The README carries no feature sections — it is deployment, development, and community only. Adding a feature section there would break the established split.
- **Biome formatting**: tabs in JSON config files, 2-space in TS/TSX, double quotes, trailing commas. Do not run root `pnpm lint` (it is `--write` and touches unrelated files); prefer `biome check` on specific paths.

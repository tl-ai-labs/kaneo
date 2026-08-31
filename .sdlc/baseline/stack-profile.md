# Stack profile — learned from repo scan

Built 2026-08-31 at HEAD `5d1fc910`. Triggered because the repo's primary stacks (Hono API,
React/Vite web, Next.js site) have no matching pre-authored adapter — the plugin ships only
`generic.md`, `nest.md`, `python.md`. **This profile is authoritative over `generic.md` on conflict.**

## Language & runtime

TypeScript 7.0.2 across every workspace package, ESM throughout (`"type": "module"` at root). Node
>= 20.19.0, pnpm 10.32.1 pinned via `packageManager`. Turborepo 2.10.8 orchestrates `build`, `dev`,
`lint`, `test`, `test:integration`, `typecheck`. Biome 2.5.7 is the formatter and linter (no
ESLint/Prettier). Husky + commitlint enforce conventional commits. Shared tsconfigs live in
`packages/typescript-config`. Types are inferred wherever possible and `type` is preferred over
`interface`.

## Framework

- **API (`apps/api`):** Hono, with `hono-openapi` for route description and OpenAPI generation,
  Valibot for validation, Better Auth for auth, Drizzle ORM over PostgreSQL, ioredis for optional
  realtime fan-out, `@hono/node-ws` for WebSockets, MCP SDK for HTTP MCP routes.
- **Web (`apps/web`):** React + Vite, TanStack Router (file-based, generated `routeTree.gen.ts`),
  TanStack Query for server state, Zustand for client stores, Tailwind, Radix/base-ui primitives.
- **Site (`apps/site`):** Next.js app router.
- **Docs (`apps/docs`):** Mintlify, configured by `docs.json`, content in `.mdx`.

## Conventions detected

### File naming

Kebab-case filenames, one exported symbol per file, default-exported.

- API domain modules: `apps/api/src/<domain>/index.ts` (routes) + `apps/api/src/<domain>/controllers/<verb>-<noun>.ts`.
  Examples: `apps/api/src/label/controllers/create-label.ts`, `get-labels-by-task-id.ts`,
  `assign-label-to-task.ts`, `apps/api/src/time-entry/controllers/get-time-entries.ts`.
- Web fetchers: `apps/web/src/fetchers/<domain>/<verb>-<noun>.ts` — `create-column.ts`,
  `reorder-columns.ts`.
- Web hooks: `apps/web/src/hooks/use-<thing>.ts`, e.g. `use-task-filters.ts`,
  `use-task-filters-with-labels-support.ts`. Mutation helpers under `hooks/mutations/`.
- Components: `apps/web/src/components/<area>/<name>.tsx`, e.g. `components/board/board-toolbar.tsx`.
- Tests: co-located `.test.tsx`/`.test.ts` for web hooks; API tests live outside the package in
  `tests/api/<domain>/<behavior>.test.ts` and `tests/api-integration/`.

There is **no** `.controller.ts`/`.service.ts` suffix convention and no PascalCase filenames.

### Route / handler shape

Routes are a single chained `new Hono()` builder per domain in `<domain>/index.ts`. Each method
takes `describeRoute({...})` for OpenAPI, then `validator(...)` for Valibot input, then auth/scope
middleware, then a thin async handler that delegates to a controller. From `apps/api/src/label/index.ts`:

```ts
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { labelSchema } from "../schemas";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import getLabelsByTaskId from "./controllers/get-labels-by-task-id";

const label = new Hono<{ Variables: { userId: string } }>()
  .get(
    "/task/:taskId",
    describeRoute({
      operationId: "getTaskLabels",
      tags: ["Labels"],
      description: "Get all labels assigned to a specific task",
      responses: {
        200: {
          description: "List of labels for the task",
          content: { "application/json": { schema: resolver(v.array(labelSchema)) } },
        },
      },
    }),
    validator("param", v.object({ taskId: v.string() })),
    workspaceAccess.fromTaskId(),
    async (c) => {
      const { taskId } = c.req.valid("param");
      const labels = await getLabelsByTaskId(taskId);
      return c.json(labels);
    },
  );

export default label;
```

Handlers are deliberately thin. `operationId`, `tags`, `description`, and a `resolver(...)` response
schema are mandatory on every public route — the repo's `apps/docs/openapi.json` is generated from
them.

### Controller shape

Controllers are plain default-exported async functions taking positional primitives (not a Hono
context), doing Drizzle queries directly, throwing `HTTPException` for expected failures, and calling
`publishEvent()` when the mutation drives realtime/activity. From
`apps/api/src/label/controllers/create-label.ts`:

```ts
import { and, eq, isNull, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { labelTable, projectTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function createLabel(
  name: string,
  color: string,
  taskId: string | undefined,
  workspaceId: string,
  userId: string,
) {
  const [task] = await db
    .select({ id: taskTable.id, workspaceId: projectTable.workspaceId })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!task) {
    throw new HTTPException(404, { message: "Task not found" });
  }
  // ...
}

export default createLabel;
```

Note the authorization pattern: cross-workspace access is masked as `404 Task not found`, not `403`.

### Web fetcher shape

Every request goes through the shared typed client from `@kaneo/libs`. There is no parallel untyped
request layer. From `apps/web/src/fetchers/column/create-column.ts`:

```ts
import { client } from "@kaneo/libs";

async function createColumn(
  projectId: string,
  data: { name: string; icon?: string; color?: string; isFinal?: boolean },
) {
  const response = await client.column[":projectId"].$post({
    param: { projectId },
    json: data,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default createColumn;
```

The `!response.ok` → `throw new Error(await response.text())` guard is uniform across fetchers.
Server state is then wrapped in TanStack Query hooks; cache invalidation helpers live in
`apps/web/src/hooks/mutations/` (e.g. `invalidate-user-profile-queries.ts` exporting a keyed array
plus a `Promise.all` of `queryClient.invalidateQueries`).

### Hook shape

Board/backlog filter hooks keep filter state in `useState`, persist it to `localStorage` under a
project-scoped key, and expose `{ filters, setFilters, updateFilter, filteredProject,
hasActiveFilters, clearFilters }`. Filtering is a `useCallback` predicate applied per column:

```ts
const filteredProject = useMemo(() => {
  if (!project) return null;
  return {
    ...project,
    columns: project.columns?.map((column) => ({
      ...column,
      tasks: filterTasks(column.tasks),
    })) ?? [],
  };
}, [project, filterTasks]);
```

Import alias is `@/` for `apps/web/src`. Relative imports are used only within a directory
(`./use-task-filters`).

### Test shape

Vitest everywhere, `describe`/`it`/`expect` with `vi.fn()` module mocks. API unit tests build mock
Drizzle transaction contexts rather than touching a database:

```ts
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";

const mockFindFirst = vi.fn();
const mockInsert = vi.fn();
const mockPublishEvent = vi.fn();

function createMockTxContext() {
  return {
    insert: (...args: unknown[]) => mockInsert(...args),
    query: { labelTable: { findFirst: (...args: unknown[]) => mockFindFirst(...args) } },
  };
}
```

API unit tests: `tests/api/<domain>/<behavior>.test.ts`, run by
`pnpm --filter @kaneo/api test`. PostgreSQL-backed integration tests: `tests/api-integration/`,
run by `pnpm test:integration` with a separate `vitest.integration.config.ts`. Web hook/component
tests are co-located next to the source (`use-task-filters-with-labels-support.test.tsx`) and use
`renderHook`.

### Config

Server config is env-driven and read directly via `process.env` at point of use, funnelled through
`apps/api/src/utils/get-settings.ts` for the client-visible subset, which is served by the tiny
`apps/api/src/config/index.ts` route. There is no Zod/Valibot env schema — Valibot is used for
request validation, not environment validation. Root `.env` supplies server variables (loaded via
`dotenv-mono`); Vite-only overrides go in `apps/web/.env.local` and are read as `import.meta.env.VITE_*`.

### Data layer

Drizzle ORM against PostgreSQL. Schema is centralized in `apps/api/src/database/schema.ts` with
`pgTable`, relations in `apps/api/src/database/relations.ts`. IDs are cuid2 via
`text("id").$defaultFn(() => createId()).primaryKey()`. Timestamps use
`timestamp("...", { mode: "date" })` with `.defaultNow()` and `.$onUpdate(() => new Date())`.
Indexes and unique constraints are declared in the third `pgTable` argument:

```ts
export const taskTable = pgTable(
  "task",
  {
    id: text("id").$defaultFn(() => createId()).primaryKey(),
    projectId: text("project_id").notNull().references(() => projectTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    title: text("title").notNull(),
    status: text("status").notNull().default("to-do"),
    columnId: text("column_id").references(() => columnTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("task_projectId_idx").on(table.projectId),
    unique("task_project_number_unique").on(table.projectId, table.number),
  ],
);
```

Migrations are **generated**, never hand-written: `pnpm --filter @kaneo/api db:generate`, inspect the
SQL, and commit it alongside the schema change. Column names are snake_case in SQL, camelCase in TS.

### Framework-owned wiring

- **New API route:** create `apps/api/src/<domain>/index.ts` exporting a `Hono` instance, then
  register it in `apps/api/src/index.ts` with `api.route("/<domain>", <domain>)` (see lines 603-642).
  Response schemas go in `apps/api/src/schemas.ts`. Regenerate `apps/docs/openapi.json` via
  `pnpm --filter @kaneo/api openapi:export`.
- **New web route:** add a file under
  `apps/web/src/routes/_layout/_authenticated/dashboard/...`; TanStack Router's Vite plugin
  regenerates `routeTree.gen.ts`. Never hand-edit that file.
- **Authorization:** use `requireWorkspacePermission` and the `workspaceAccess` middleware family
  (`workspaceAccess.fromParam()`, `.fromTaskId()`) with the `@kaneo/permissions` vocabulary. Do not
  re-implement role checks.
- **Realtime:** mutations that change shared state call `publishEvent()`; delivery flows through
  `apps/api/src/events` → `apps/api/src/ws` → optional Redis fan-out → TanStack Query invalidation
  on the client.
- **User-facing copy:** static i18n keys only, sourced from `i18n/en-US.json`. Verify with
  `pnpm i18n:check`.
- **Docs:** user-facing feature documentation is `.mdx` under `apps/docs/core/functional/`, with nav
  registered in `apps/docs/docs.json`. The root `README.md` is deployment/onboarding only.

## Sample files inspected

- `apps/api/src/index.ts` (kind: entry point / app wiring)
- `apps/api/src/label/index.ts` (kind: route module)
- `apps/api/src/label/controllers/create-label.ts` (kind: controller)
- `apps/api/src/config/index.ts` (kind: config route)
- `apps/api/src/database/schema.ts` (kind: ORM schema)
- `tests/api/label/assign-and-unassign-label.test.ts` (kind: API unit test)
- `apps/web/src/fetchers/column/create-column.ts` (kind: fetcher)
- `apps/web/src/fetchers/column/reorder-columns.ts` (kind: fetcher)
- `apps/web/src/fetchers/get-api-url.ts` (kind: url helper)
- `apps/web/src/hooks/use-task-filters-with-labels-support.ts` (kind: hook)
- `apps/web/src/hooks/use-task-filters.ts` (kind: hook / types module)
- `apps/web/src/hooks/mutations/invalidate-user-profile-queries.ts` (kind: cache invalidation)
- `apps/web/src/components/board/board-toolbar.tsx` (kind: component)
- `apps/docs/docs.json`, `apps/docs/core/functional/plan-and-execute-tasks.mdx` (kind: docs)

## Notes for downstream codegen

- Default-export a single function per file; kebab-case the filename after the function.
- API handlers stay thin. Put domain logic in a `controllers/<verb>-<noun>.ts` that takes plain
  arguments, not a Hono context.
- Every new public route needs `describeRoute` with `operationId`, `tags`, `description`, and a
  `resolver(...)`-wrapped response schema, plus a Valibot `validator(...)` for each input location.
- Throw `HTTPException` for expected failures. Mask cross-workspace access as 404, not 403.
- Never write SQL migrations by hand — emit the schema change and instruct the caller to run
  `pnpm --filter @kaneo/api db:generate`.
- On the web side, never construct a raw `fetch`; go through `client` from `@kaneo/libs` and keep the
  request in `apps/web/src/fetchers/`.
- All user-visible strings are i18n keys resolved from `i18n/en-US.json`. Never inline English.
- Do not touch `apps/web/src/routeTree.gen.ts` or `apps/docs/openapi.json` — both are generated.
- Prefer `type` over `interface`; let TypeScript infer where it can.
- Comments explain constraints or surprises, not what the code plainly does.
- Verification is filtered, not repo-wide: `pnpm --filter @kaneo/<pkg> test` and
  `pnpm --filter @kaneo/<pkg> typecheck`. Use `biome ci` (read-only), never root `pnpm lint`
  (rewrites files).

# Stack profile — learned from repo scan

Built 2026-08-26 from `feature-extend-3/opus-flash` @ `5d1fc910`.
**Tier 2b triggered**: the shipped adapters are `generic.md`, `nest.md`, `python.md`; this
repo's dominant stacks are React+Vite+TanStack (web) and Hono+Drizzle+Valibot (api), neither
of which has a pre-authored adapter. **This profile is authoritative over any adapter
fragment where they disagree.**

## Language & runtime

TypeScript 7.0.2 throughout, pure ESM (`"type": "module"` at root). Node ≥ 20.19,
pnpm 10.32.1, pnpm workspaces (`apps/**`, `packages/**`) driven by Turborepo. Formatting and
linting are **Biome 2.5.7** (not ESLint/Prettier): 2-space indent, double-quoted strings,
trailing commas, semicolons. `biome.json` at root. Husky + commitlint enforce Conventional
Commits.

Two runtimes in play: the API is Node (`@hono/node-server`, built with esbuild to ESM); the
web app is a Vite SPA (React 19-era, Rolldown/Babel plugin) — **not** Next.js. `apps/site`
*is* Next.js but is the marketing site and out of scope for product work.

## Framework

- **API** — Hono, with `hono-openapi` for OpenAPI metadata, **Valibot** for validation
  (not Zod — `zod` is present only for the MCP package), Better Auth for identity,
  **Drizzle ORM** over Postgres, `ioredis` for optional realtime fan-out.
- **Web** — React + Vite, **TanStack Router** (file-based routes, generated
  `routeTree.gen.ts`) + **TanStack Query** for all server state, Tailwind + Radix + a local
  shadcn-style `components/ui/` layer, `react-i18next` for every user-facing string,
  `zustand` for a few local stores.

## Conventions detected

### File naming

Consistently **kebab-case files, one concern per file, default export named after the
file.** No `.controller.ts` / `.service.ts` suffixes — the *directory* carries the role.

```
apps/api/src/label/index.ts                              <- Hono router for the domain
apps/api/src/label/controllers/get-labels-by-workspace-id.ts
apps/web/src/fetchers/label/get-label-by-workspace.ts
apps/web/src/hooks/queries/label/use-get-labels-by-workspace.ts
apps/web/src/hooks/mutations/label/use-create-label.ts
apps/web/src/components/board/board-toolbar.tsx
apps/web/src/hooks/use-task-filters-with-labels-support.ts
```

Components are `PascalCase` identifiers in kebab-case files. Hooks are `useThing` in
`use-thing.ts`. Tests sit **next to the source** in web (`use-x.test.tsx`,
`task-labels.test.tsx`) but in a **separate top-level tree** for API (`tests/api/**`,
`tests/api-integration/**`).

### Handler / route shape

No decorators anywhere. A domain is a chained Hono builder in `<domain>/index.ts`; each
route is `describeRoute(...)` → `validator(...)` → access middleware → permission middleware
→ thin async handler that delegates to a controller.

```ts
// apps/api/src/label/index.ts
  .post(
    "/",
    describeRoute({
      operationId: "createLabel",
      tags: ["Labels"],
      description: "Create a new label in a workspace",
      responses: {
        200: {
          description: "Label created successfully",
          content: { "application/json": { schema: resolver(labelSchema) } },
        },
      },
    }),
    validator(
      "json",
      v.object({
        name: v.string(),
        color: v.string(),
        workspaceId: v.string(),
        taskId: v.optional(v.string()),
      }),
    ),
    workspaceAccess.fromBody(),
    requireWorkspacePermission({ label: ["create"] }),
    async (c) => {
      const { name, color, workspaceId, taskId } = c.req.valid("json");
      const userId = c.get("userId");
      const label = await createLabel(name, color, taskId, workspaceId, userId);
      return c.json(label);
    },
  )
```

Note the ordering discipline: `workspaceAccess.from{Param,Body,Task,Label}()` establishes
the workspace, then `requireWorkspacePermission({ resource: ["action"] })` authorizes.
Never hand-roll a role check. Expected failures use `HTTPException`.

### Controller / domain shape

Plain functions, one per file, `export default`. No classes, no DI container.

```ts
// apps/api/src/label/controllers/get-labels-by-workspace-id.ts
import { eq } from "drizzle-orm";
import db from "../../database";
import { labelTable } from "../../database/schema";

function getLabelsByWorkspaceId(workspaceId: string) {
  return db
    .select()
    .from(labelTable)
    .where(eq(labelTable.workspaceId, workspaceId));
}

export default getLabelsByWorkspaceId;
```

### Web data layer — fetcher + hook, always in that pair

A **fetcher** in `apps/web/src/fetchers/<domain>/` uses the shared typed Hono client and
`InferRequestType`. Never `fetch()` directly, never a parallel untyped request layer.

```ts
// apps/web/src/fetchers/label/get-label-by-workspace.ts
import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type GetLabelsByTaskRequest = InferRequestType<
  (typeof client)["label"]["workspace"][":workspaceId"]["$get"]
>["param"];

async function getLabelsByTask({ workspaceId }: GetLabelsByTaskRequest) {
  const response = await client.label.workspace[":workspaceId"].$get({
    param: { workspaceId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

export default getLabelsByTask;
```

A **query hook** in `hooks/queries/<domain>/` wraps it. Query keys are flat tuples like
`["labels", workspaceId]`.

```ts
// apps/web/src/hooks/queries/label/use-get-labels-by-workspace.ts
import { useQuery } from "@tanstack/react-query";
import getLabelsByWorkspace from "@/fetchers/label/get-label-by-workspace";

function useGetLabelsByWorkspace(workspaceId: string) {
  return useQuery({
    enabled: Boolean(workspaceId),
    queryKey: ["labels", workspaceId],
    queryFn: () => getLabelsByWorkspace({ workspaceId }),
  });
}

export default useGetLabelsByWorkspace;
```

**Mutation hooks** in `hooks/mutations/<domain>/` do optimistic `setQueryData` first, then
`void queryClient.invalidateQueries(...)` — see `use-create-label.ts`, which patches both
`["labels", workspaceId]` and `["labels", taskId]` and calls a shared
`addLabelToTaskInTasksCache` helper before invalidating.

### Routing & search params (web)

File-based TanStack Router under `apps/web/src/routes/`, with `_layout` / `_authenticated`
pathless layout segments and `$param` directories. `routeTree.gen.ts` is **generated** —
never hand-edit.

The house style for search params is a hand-written `validateSearch` with inline
`typeof` narrowing, no schema library:

```ts
type BoardSearchParams = {
  taskId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): BoardSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});
```

Read with `Route.useSearch()`, written with `useNavigate()`. **Watch out**: existing call
sites pass an object literal (`navigate({ to: ".", search: { taskId } })`), which replaces
the entire search object. The functional form `search: (prev) => ({ ...prev, ... })` is not
yet used anywhere in this repo — introducing it is correct but is a new local pattern.

Local UI state that must survive reloads currently uses `localStorage` behind a hook, with
a `normalizeSort` / `normalizeFilters` guard on read. `use-board-sort.ts` is the cleanest
example of the shape: a `DEFAULT_*` constant, `is*` type guards built from a
`Record<Union, true>` map, a `normalize*(value: unknown)` function, then
`useState` + load-`useEffect` + write-back-`useEffect`.

### Config

Server env comes from the root `.env` via `dotenv-mono`, read with bare
`process.env.NAME` at point of use — there is no central env schema or validator module.
Client env is Vite `import.meta.env.VITE_*`. Vite-only local overrides go in
`apps/web/.env.local`. `ENVIRONMENT_SETUP.md` is the reference.

### Data layer

Drizzle ORM. Schema in `apps/api/src/database/schema.ts`, relations in
`apps/api/src/database/relations.ts`. Migrations are **generated, never written by hand**:
`pnpm --filter @kaneo/api db:generate`, then inspect the emitted SQL and commit it with the
schema change. Queries are the Drizzle builder (`db.select().from(x).where(eq(...))`) with
`db.transaction(cb)` where atomicity matters.

### Test shape

Vitest everywhere. `describe` / `it`, explicit `expect`.

Web — jsdom + Testing Library, `setupFiles: ["./src/test/setup.ts"]`,
`include: ["src/**/*.test.{ts,tsx}"]`, alias `@` → `src` and `@i18n` → `../../i18n`:

```tsx
// apps/web/src/components/kanban-board/task-labels.test.tsx
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

Hooks are tested with `renderHook` + `waitFor`, seeding `window.localStorage` in
`beforeEach` and clearing in `afterEach` (see
`apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx`).

API unit tests live in `tests/api/<domain>/` and mock Drizzle aggressively — hoisted
`const mockX = vi.fn()` at module top, a hand-built `createMockTxContext()`, and
`vi.mock` of the database module. PostgreSQL-backed tests go in `tests/api-integration/`
and are run only by `pnpm test:integration`.

### Framework-owned wiring

- **New API route** — add the controller file under `<domain>/controllers/`, chain the route
  onto the domain's `index.ts` builder, then mount once in `apps/api/src/index.ts` with
  `api.route("/<domain>", <domain>)` (label is at line 612). The typed client in
  `@kaneo/libs` derives from the API's exported type, so route changes propagate to web
  automatically.
- **New web route** — create the file under `apps/web/src/routes/...`; the
  `@tanstack/router-plugin` regenerates `routeTree.gen.ts`.
- **New user-facing string** — add a static key to `i18n/en-US.json`, use it via
  `useTranslation()` / `t("ns:key")`. `pnpm i18n:check` validates.
- **Mutation with realtime impact** — call `publishEvent()` in the controller, then confirm
  the WebSocket delivery and the client-side cache invalidation.

## Sample files inspected

- `apps/api/src/label/index.ts` (kind: route/router)
- `apps/api/src/label/controllers/get-labels-by-workspace-id.ts` (kind: controller)
- `apps/api/src/index.ts` (kind: entry point / wiring)
- `apps/web/src/fetchers/label/get-label-by-workspace.ts` (kind: fetcher)
- `apps/web/src/hooks/queries/label/use-get-labels-by-workspace.ts` (kind: query hook)
- `apps/web/src/hooks/mutations/label/use-create-label.ts` (kind: mutation hook)
- `apps/web/src/hooks/use-task-filters.ts` (kind: domain hook)
- `apps/web/src/hooks/use-task-filters-with-labels-support.ts` (kind: domain hook)
- `apps/web/src/hooks/use-board-sort.ts` (kind: persisted-state hook)
- `apps/web/src/routes/.../project/$projectId/board.tsx` (kind: route)
- `apps/web/src/routes/.../project/$projectId/backlog.tsx` (kind: route)
- `apps/web/src/routes/.../project/$projectId/gantt.tsx` (kind: route)
- `apps/web/src/components/board/board-toolbar.tsx` (kind: component)
- `apps/web/src/types/task/index.ts` (kind: type)
- `apps/web/src/components/kanban-board/task-labels.test.tsx` (kind: component test)
- `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` (kind: hook test)
- `tests/api/label/delete-label.test.ts` (kind: api test)
- `apps/web/vitest.config.ts` (kind: test config)

## Notes for downstream codegen

- **`type`, never `interface`** — AGENTS.md mandates it unless extension/merging is needed.
  Prefer inferred types.
- **Default exports for single-concern modules** (fetchers, controllers, hooks in
  `queries/`/`mutations/`); **named exports** for multi-export utility modules
  (`use-task-filters.ts` exports `BoardFilters`, `DUE_DATE_FILTER_VALUES`, `useTaskFilters`).
- **Imports**: `@/` alias inside `apps/web/src`; relative (`../../database`) inside
  `apps/api/src`. Biome sorts imports — write them roughly alphabetical by source to avoid
  churn.
- **Validation is Valibot (`import * as v from "valibot"`)**, not Zod, on the API. On the
  web, hand-written `typeof` narrowing is the norm for search params.
- **Every user-facing string goes through i18n.** Hardcoded English in a component is a
  defect here.
- **Never hand-edit** `apps/web/src/routeTree.gen.ts` or anything in `apps/api/drizzle/`.
- **Never run `pnpm lint`** during a run — it is `biome check --write .` and rewrites
  unrelated files. Use `biome check <specific paths>`.
- **Comments explain constraints, not code.** The codebase is near-comment-free; a
  narrating comment will read as noise.
- **Keep handlers thin.** Domain behavior belongs in a controller or a focused utility.
- **Authorization lives in the API.** Hiding a control in the UI is not a check.

# Stack profile — learned from repo scan

Repo: Kaneo. Built 2026-08-28 from commit `5d1fc910`.
**Authoritative over any pre-authored stack adapter where they conflict.**

## Language & runtime

TypeScript 7.0.2, ESM throughout (`"type": "module"` at root). Node ≥ 20.19,
pnpm 10.32.1. Turborepo drives `build`/`dev`/`lint`/`typecheck`/`test`/
`test:integration`. Biome 2.5.7 is the single formatter+linter — no ESLint, no
Prettier. Biome style observed in every file sampled: double quotes, semicolons,
trailing commas, 2-space indent, sorted imports (node builtins → external →
aliased `@/` → relative).

## Frameworks

- **API** (`apps/api`): Hono, with `hono-openapi` for route documentation,
  Valibot for validation, Drizzle ORM over PostgreSQL, Better Auth.
- **Web** (`apps/web`): React + Vite, TanStack Router (file-based, generated
  route tree) and TanStack Query for server state, Tailwind, Radix/Base UI
  primitives, zustand for local stores, react-i18next for all copy.
- **Site** (`apps/site`): Next.js — separate marketing/docs surface, not part
  of the product app.

## Conventions detected

### File naming

Strictly **kebab-case** filenames everywhere, including React components. The
component inside is PascalCase; the file is not.

- `apps/web/src/components/kanban-board/column/column-header.tsx` → exports `ColumnHeader`
- `apps/web/src/hooks/mutations/column/use-update-column.ts` → exports `useUpdateColumn`
- `apps/web/src/fetchers/column/update-column.ts` → default-exports `updateColumn`
- `apps/api/src/task/controllers/update-task.ts` → default-exports `updateTask`

No `.controller.ts` / `.service.ts` suffixes. Role is encoded by **directory**
(`controllers/`, `fetchers/`, `hooks/mutations/`, `hooks/queries/`), not by
filename suffix. Tests sit beside their subject: `use-board-sort.ts` +
`use-board-sort.test.tsx`.

### API route shape

Routes are a single chained Hono builder per domain, in `<domain>/index.ts`.
Each method call stacks: `describeRoute(...)` → `validator(...)` per input
location → authorization middleware → thin async handler that delegates to a
controller.

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

Note: Valibot is imported as `import * as v from "valibot"` and always used as
`v.*`. `operationId` and `tags` are mandatory in practice — OpenAPI metadata is
a stated boundary in AGENTS.md.

### Controller shape

One exported function per file under `<domain>/controllers/`, default-exported,
plain async function taking positional args (not an options object). Throws
`HTTPException` for expected failures. Talks to Drizzle directly. Publishes
events for realtime-relevant mutations.

```ts
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function updateTask(id: string, title: string, status: string /* … */) {
  const [existingTask] = await db
    .select({ id: taskTable.id, projectId: taskTable.projectId })
    .from(taskTable)
    .where(eq(taskTable.id, id))
    .limit(1);

  if (!existingTask) {
    throw new HTTPException(404, { message: "Task not found" });
  }
  // …
}
export default updateTask;
```

Both query styles appear and are acceptable: the builder (`db.select().from()
.where().limit()`) and the relational API (`db.query.columnTable.findFirst({
where: and(...) })`).

### Web data-access shape — three layers, kept separate

**1. Fetcher** (`src/fetchers/<domain>/<verb>-<noun>.ts`) — uses the shared
typed client only. Never `fetch` directly.

```ts
import { client } from "@kaneo/libs";

async function updateColumn(id: string, data: { name?: string; isFinal?: boolean }) {
  const response = await client.column[":id"].$put({ param: { id }, json: data });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }
  return response.json();
}
export default updateColumn;
```

**2. Mutation hook** (`src/hooks/mutations/<domain>/use-<verb>-<noun>.ts`) —
named export, wraps the fetcher, owns cache invalidation.

```ts
export function useUpdateColumn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; projectId: string; data: {...} }) =>
      updateColumn(id, data),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["columns", variables.projectId], refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId], refetchType: "all" }),
      ]);
    },
  });
}
```

Query keys are flat arrays: `["columns", projectId]`, `["tasks", projectId]`.
Note the pattern where a mutation variable (`projectId`) exists purely to build
the invalidation key.

**3. Component** — consumes hooks; contains no request logic.

### Component shape

Named export (not default), `type ...Props` alias declared immediately above
the component, destructured props, hooks first, handlers next, JSX last.
Permission checks come from `useWorkspacePermission()` and gate UI only —
never treated as authorization. All copy goes through `t()`.

```tsx
import { useTranslation } from "react-i18next";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";

type ColumnHeaderProps = {
  column: ProjectWithTasks["columns"][number];
};

export function ColumnHeader({ column }: ColumnHeaderProps) {
  const { t } = useTranslation();
  const { project, setProject } = useProjectStore();
  const { canUpdateTasks, canCreateTasks } = useWorkspacePermission();
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  // handlers…
  return <div className="flex items-center justify-between gap-2">{/* … */}</div>;
}
```

Observed idioms worth matching:
- Prop types are **derived from existing types by indexing**
  (`ProjectWithTasks["columns"][number]`) rather than redeclared.
- `immer`'s `produce` is used for store updates.
- Toasts via `@/lib/toast`; i18n keys are namespaced and static,
  e.g. `t("tasks:archive.success", { count: column.tasks.length })`.
- Tailwind utility classes inline; no CSS modules.
- Imports use the `@/` alias for anything outside the current folder;
  `../` only for close siblings.

### Test shape

Vitest everywhere. `describe` / `it` (not `test`), with `expect`, and explicit
named imports from `vitest` — nothing relies on globals.

Web (`environment: "jsdom"`, `include: src/**/*.test.{ts,tsx}`, setup at
`src/test/setup.ts`), colocated with source, `@testing-library/react`:

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useBoardSort } from "./use-board-sort";

describe("useBoardSort", () => {
  beforeEach(() => { window.localStorage.clear(); });

  it("restores persisted sort from storage", async () => {
    const { result } = renderHook(() => useBoardSort("project-1"));
    await waitFor(() => {
      expect(result.current.sort).toEqual({ field: "priority", direction: "desc" });
    });
  });
});
```

API unit tests live **outside** the package, in `tests/api/**/*.test.ts`, pulled
in by `apps/api/vitest.config.ts` (`environment: "node"`). They mock modules by
relative path from the test file into the app, using `vi.hoisted` for mock
handles:

```ts
const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({ user: { id: "test-user" } })),
}));
vi.mock("../../apps/api/src/auth", () => ({
  auth: { api: { getSession: authMocks.getSession } },
}));
```

PostgreSQL-backed tests live in `tests/api-integration/` and run only under
`test:integration`. Test names are full sentences describing behavior
("restores persisted sort from storage", "falls back to the default sort when
stored JSON is invalid").

### Config

Server config is env-driven via `process.env` (root `.env`, loaded with
`dotenv-mono`); there is an `apps/api/src/config/` module. Web config uses
Vite's `import.meta.env` with `VITE_`-prefixed vars only, from
`apps/web/.env.*`. No Joi/Zod-style env schema validator was found — validation
is per-use.

### Data layer

Drizzle ORM on `pg`. Schema in `apps/api/src/database/schema.ts`, relations in
`relations.ts`. Tables are `pgTable("snake_case_name", {...})` with camelCase TS
keys mapped to snake_case columns, cuid2 ids, and `createdAt`/`updatedAt`
timestamps.

```ts
export const userTable = pgTable("user", {
  id: text("id").$defaultFn(() => createId()).primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").$defaultFn(() => false).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
```

Exported symbols are suffixed `Table` (`userTable`, `taskTable`, `columnTable`).
Migrations are **generated**, never hand-written:
`pnpm --filter @kaneo/api db:generate` produces
`apps/api/src/database/migrations/NNNN_name.sql`, which is inspected and
committed with the schema change.

### Framework-owned wiring

- **New API domain:** create `apps/api/src/<domain>/index.ts` exporting a Hono
  instance, then mount it in `apps/api/src/index.ts` —
  `const columnApi = api.route("/column", column);`. The assigned consts feed
  the exported app type that `@kaneo/libs` consumes, so the typed client
  updates automatically.
- **New web route:** file-based under `apps/web/src/routes/...`;
  `routeTree.gen.ts` is regenerated by the TanStack Router plugin — never edit
  it.
- **New copy:** add the key to `i18n/en-US.json` (source of truth) and consume
  via `t("namespace:key")`.

## Sample files inspected

- `apps/api/src/task/index.ts` (kind: route module / OpenAPI + validation)
- `apps/api/src/task/controllers/update-task.ts` (kind: controller)
- `apps/api/src/index.ts` (kind: app wiring)
- `apps/api/src/database/schema.ts` (kind: ORM schema)
- `apps/web/src/components/kanban-board/column/column-header.tsx` (kind: component)
- `apps/web/src/fetchers/column/update-column.ts` (kind: fetcher)
- `apps/web/src/hooks/mutations/column/use-update-column.ts` (kind: mutation hook)
- `apps/web/src/hooks/use-board-sort.test.tsx` (kind: web test)
- `tests/api/mcp-internal-api-url.test.ts` (kind: api test)
- `apps/web/vitest.config.ts`, `apps/api/vitest.config.ts` (kind: test config)
- `package.json`, `turbo.json`, `pnpm-workspace.yaml` (kind: build config)

## Notes for downstream codegen

- Filenames kebab-case; exported React components and hooks PascalCase/camelCase.
  Do not introduce `PascalCase.tsx` files.
- Components use **named** exports; fetchers and API controllers use **default**
  exports. Match the layer.
- Never call `fetch` in web code — go through `client` from `@kaneo/libs`, and
  put the call in `src/fetchers/`, not in a component or hook body.
- Every mutation hook must invalidate the query keys its change affects; look at
  a sibling hook in the same domain folder for the exact key shape.
- All user-facing strings must be `t("ns:key")` with a **static** key, and the
  key must be added to `i18n/en-US.json`. Do not build keys by interpolation.
- Derive prop types by indexing existing types where one exists, instead of
  writing a new shape.
- API handlers stay thin: validate, authorize, delegate to a controller, return
  `c.json(...)`. Domain logic belongs in `controllers/`.
- Use `requireWorkspacePermission` / `workspaceAccess.*` middleware rather than
  inline role checks; UI-side `useWorkspacePermission()` is presentation only
  and never a substitute.
- Throw `HTTPException(status, { message })` for expected HTTP failures.
- Call `publishEvent()` when a mutation should drive activity, notifications,
  integrations, or realtime updates.
- Add `describeRoute({ operationId, tags, description, responses })` to every
  new route — OpenAPI accuracy is a stated project boundary.
- Never hand-write a migration; never edit `apps/web/src/routeTree.gen.ts`.
- Prefer `type` over `interface`, and inferred types over explicit annotations.
- Formatting is Biome's; run `biome check` scoped to changed paths — the
  package `lint` scripts use `--write` and will reformat unrelated files.

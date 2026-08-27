# Stack profile — learned from repo scan

Built: 2026-08-27 · repo: kaneo · trigger: primary stacks are Hono (API) and React/TanStack (web); shipped adapters are only `generic.md`, `nest.md`, `python.md`.
**This profile is authoritative over any pre-authored adapter fragment where the two disagree.**

## Language & runtime

TypeScript throughout, ESM (`"type": "module"` at root), Node `>=20.19.0`, pnpm `10.32.1`, TypeScript `7.0.2`. Turborepo drives `build`/`dev`/`lint`/`test`/`typecheck` across 9 workspace members. Formatting and linting is **Biome 2.5.7** (`biome.json`) — 2-space indent, double quotes, trailing commas, and Biome's import sorting (side-effect-free imports sorted by module specifier, `@/` aliases after bare specifiers). Never hand-order imports against Biome; `.husky/pre-commit` runs `biome ci .` and fails the commit on drift.

## Framework

- **API (`apps/api`):** Hono + `hono-openapi` (`describeRoute`, `resolver`, `validator`), Valibot for validation, Better Auth for sessions, Drizzle ORM on PostgreSQL, optional ioredis for realtime fan-out.
- **Web (`apps/web`):** React 19-era + Vite, TanStack Router (file-based, `routeTree.gen.ts` is generated), TanStack Query for all server state, Tailwind, `react-i18next`, zustand-style stores under `src/store`, `immer` for local state updates.
- **Site (`apps/site`):** Next.js — separate marketing surface, does not share the web app's conventions.

## Conventions detected

### File naming

Uniform **kebab-case files**, one exported unit per file, folder-per-domain.

- API domain folder: `apps/api/src/column/index.ts` (routes) + `apps/api/src/column/controllers/{create,update,delete,get,reorder}-column.ts`
- Web fetcher: `apps/web/src/fetchers/column/update-column.ts`
- Web hooks: `apps/web/src/hooks/mutations/column/use-update-column.ts`, `apps/web/src/hooks/queries/column/use-get-columns.ts`
- Web components: `apps/web/src/components/kanban-board/column/column-header.tsx`, `.../column/index.tsx`
- Tests: co-located `*.test.ts(x)` for web/packages (`use-board-sort.test.tsx`); API unit tests live **outside** the app in `tests/api/<domain>/<name>.test.ts`.

Note the split: components/hooks export **named** symbols (`export function ColumnHeader`), controllers/fetchers export **default** (`export default updateColumn`).

### Handler / route shape (API)

Routes are a single chained Hono builder per domain in `<domain>/index.ts`. Every route carries OpenAPI metadata, Valibot validators, then workspace-access and permission middleware, then a thin handler that delegates to a controller.

```ts
const column = new Hono<{ Variables: { userId: string } }>()
  .post(
    "/:projectId",
    describeRoute({
      operationId: "createColumn",
      tags: ["Columns"],
      description: "Create a new column in a project",
      responses: {
        200: {
          description: "Column created successfully",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    validator("json", v.object({
      name: v.string(),
      icon: v.optional(v.string()),
      color: v.optional(v.string()),
      isFinal: v.optional(v.boolean()),
    })),
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["update"] }),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const { name, icon, color, isFinal } = c.req.valid("json");
      const result = await createColumn({ /* … */ });
      return c.json(result);
    },
  );
```

Middleware order is load-bearing: validators → `workspaceAccess.*` → `requireWorkspacePermission` → handler. Never inline a role check; always use `requireWorkspacePermission`.

### Controller shape (API)

Plain async functions, default-exported, no classes, no DI container. They own domain behavior, throw `HTTPException` for expected failures, and talk to Drizzle directly.

```ts
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable } from "../../database/schema";

async function updateColumn(id: string, data: { name?: string; /* … */ }) {
  const existing = await db.query.columnTable.findFirst({
    where: eq(columnTable.id, id),
  });
  if (!existing) throw new HTTPException(404, { message: "Column not found" });

  const [updated] = await db.update(columnTable)
    .set({ ...(data.name !== undefined && { name: data.name }) })
    .where(eq(columnTable.id, id))
    .returning();

  if (!updated) throw new HTTPException(500, { message: "Failed to update column" });
  return updated;
}

export default updateColumn;
```

The `...(x !== undefined && { x })` spread is the house idiom for partial updates — match it rather than building an object imperatively.

### Web data layer — fetcher → hook → component

Three strictly separated layers. **Never** call `fetch` from a component.

```ts
// apps/web/src/fetchers/column/update-column.ts
import { client } from "@kaneo/libs";

async function updateColumn(id: string, data: { name?: string }) {
  const response = await client.column[":id"].$put({ param: { id }, json: data });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
export default updateColumn;
```

```ts
// apps/web/src/hooks/mutations/column/use-update-column.ts
export function useUpdateColumn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; projectId: string; data: {/*…*/} }) =>
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

Query keys are flat tuples of `[resource, ...scopeIds]` (`["columns", projectId]`). Mutations invalidate every key the change can touch, with `refetchType: "all"`.

### Component shape (web)

Function components, `type XProps = { … }` above the component (never `interface`), Tailwind classes inline via template literals for conditional styling, `@/` path alias for all intra-app imports, `useTranslation()` for every user-visible string.

```tsx
type ColumnHeaderProps = {
  column: ProjectWithTasks["columns"][number];
};

export function ColumnHeader({ column }: ColumnHeaderProps) {
  const { t } = useTranslation();
  const { project, setProject } = useProjectStore();
  const { mutate: updateTask } = useUpdateTask();
  const { canUpdateTasks, canCreateTasks } = useWorkspacePermission();
  // … local state, then handlers, then JSX
}
```

Derived prop types come from existing inferred types (`ProjectWithTasks["columns"][number]`) rather than fresh hand-written shapes. Local immutable updates use `immer`'s `produce`. Capability gating in the UI uses `useWorkspacePermission()` — it is UX only; the API remains the authority.

### Test shape

Vitest everywhere, `describe`/`it`/`expect` imported explicitly from `vitest` (no globals).

```ts
import { describe, expect, it } from "vitest";
import { toSlug } from "../../../apps/api/src/column/controllers/create-column";

describe("toSlug", () => {
  it("slugifies Latin names", () => {
    expect(toSlug("To Do")).toBe("to-do");
  });
});
```

Web hooks/components use `@testing-library/react` (`renderHook`, `act`, `waitFor`) in co-located `*.test.tsx`, with `beforeEach`/`afterEach` cleanup of `window.localStorage` and similar globals. API unit tests import across the repo boundary via relative paths from `tests/api/`. PostgreSQL-backed cases go in `tests/api-integration` and run only under `pnpm test:integration`.

### Config

Server config is `process.env` read through `apps/api/src/utils/get-settings` and surfaced by a `config` Hono route with an OpenAPI-resolved `configSchema` from `apps/api/src/schemas.ts`. There is no envalid/zod-env layer — Valibot schemas describe the *response*, not the environment. Root `.env` feeds the server (loaded via `dotenv-mono`); `apps/web/.env.local` holds Vite-only overrides. See `ENVIRONMENT_SETUP.md`.

### Data layer

Drizzle ORM against PostgreSQL. Schema in `apps/api/src/database/schema.ts` using `pgTable`, cuid2 ids via `$defaultFn(() => createId())`; relations live separately in `apps/api/src/database/relations.ts`. Reads use either the relational API (`db.query.columnTable.findFirst({ where: eq(...) })`) or the builder (`db.update(...).set(...).where(...).returning()`).

```ts
export const userTable = pgTable("user", {
  id: text("id").$defaultFn(() => createId()).primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  // …
});
```

Migrations are generated, not hand-written: `pnpm --filter @kaneo/api db:generate`, then inspect the SQL in `apps/api/drizzle/` and ship it with the schema change. Migrations must work on existing installations.

### Framework-owned wiring

- **New API domain:** create `apps/api/src/<domain>/index.ts` exporting a chained `Hono` instance, add controllers under `<domain>/controllers/`, then register in `apps/api/src/index.ts` with `const xApi = api.route("/<domain>", x);` — the returned handle feeds the exported RPC type consumed by `@kaneo/libs`, so the assignment matters, not just the call.
- **New web route:** file-based under `apps/web/src/routes/` (`_layout/_authenticated/...`); `routeTree.gen.ts` is regenerated by the TanStack Router Vite plugin — never edit it.
- **New client call:** it flows automatically from the Hono RPC type through `@kaneo/libs`' `client`; no manual client registration.
- **New permission:** add to `packages/permissions` vocabulary, enforce via `requireWorkspacePermission`, then gate UI with `useWorkspacePermission`.
- **New user-visible string:** add a static key to `i18n/en-US.json` (source of truth) and use `t("key")`; `pnpm i18n:check` validates.
- **Realtime-affecting mutation:** call `publishEvent()` in the controller, then consider the project/user WebSocket path and client cache invalidation.

## Sample files inspected

- `apps/api/src/column/index.ts` (kind: routes)
- `apps/api/src/column/controllers/update-column.ts` (kind: controller)
- `apps/api/src/config/index.ts` (kind: routes/config)
- `apps/api/src/database/schema.ts` (kind: orm-schema)
- `apps/api/src/index.ts` (kind: entry point / wiring)
- `apps/web/src/fetchers/column/update-column.ts` (kind: fetcher)
- `apps/web/src/hooks/mutations/column/use-update-column.ts` (kind: mutation hook)
- `apps/web/src/hooks/queries/column/use-get-columns.ts` (kind: query hook)
- `apps/web/src/components/kanban-board/column/index.tsx` (kind: component)
- `apps/web/src/components/kanban-board/column/column-header.tsx` (kind: component)
- `tests/api/column/to-slug.test.ts` (kind: api unit test)
- `apps/web/src/hooks/use-board-sort.test.tsx` (kind: web hook test)

## Notes for downstream codegen

- Match the layer split exactly: route file → controller → Drizzle. A handler that queries the database inline is off-pattern.
- Use `type`, not `interface`; prefer inferred/derived types over new hand-written shapes.
- `export default` for controllers and fetchers; named exports for hooks and components.
- Every new API route needs `describeRoute` metadata plus Valibot `validator(...)` — OpenAPI accuracy is a stated boundary in `AGENTS.md`.
- Never bypass `client` from `@kaneo/libs` with a raw `fetch`.
- Every user-visible string is an `i18n/en-US.json` key; no inline English in components.
- Output must be Biome-clean (2-space, double quotes, sorted imports) or the pre-commit hook rejects the commit.
- Schema edits require a generated migration in the same change.
- Do not touch `apps/web/src/routeTree.gen.ts`, `i18n/schema.json`, or `pnpm-lock.yaml` — all generated.

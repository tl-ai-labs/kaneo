# Stack profile — learned from repo scan

Built 2026-09-03 for run `20260903-094517-feature-extend-column-wip-limit`.
Authoritative over any pre-authored adapter fragment. Triggered because the primary stacks (Hono API, React+Vite web) match none of the shipped `generic` / `nest` / `python` adapters.

## Language & runtime

TypeScript 7.0.2, ESM throughout (`"type": "module"` at root). Node >= 20.19, pnpm 10.32.1, Turborepo task graph. Formatting and linting are Biome 2.5.7 (`biome.json`) — two-space indent, double quotes, trailing commas, sorted imports. `biome ci .` is the read-only check; the packages' `lint` scripts are `biome check --write .` and will rewrite files.

## Framework

- **API (`apps/api`)**: Hono, with `hono-openapi` (`describeRoute`, `resolver`, `validator`) and **Valibot** (`import * as v from "valibot"`) for validation. Better Auth for auth, Drizzle ORM on PostgreSQL, `HTTPException` from `hono/http-exception` for expected failures.
- **Web (`apps/web`)**: React + Vite, TanStack Router (file/route tree generated into `src/routeTree.gen.ts`), TanStack Query for server state, Zustand stores, dnd-kit for board drag/drop, Radix + Tailwind, i18next for all user-facing copy.
- **Shared**: `@kaneo/libs` exports the typed Hono RPC `client`; `@kaneo/permissions` holds the permission vocabulary.

## Conventions detected

### File naming

- API: kebab-case files, one exported function per file, `export default`. Route module is `<domain>/index.ts`; behavior lives in `<domain>/controllers/<verb>-<noun>.ts`. Real examples: `apps/api/src/column/index.ts`, `apps/api/src/column/controllers/update-column.ts`, `create-column.ts`, `get-columns.ts`, `reorder-columns.ts`, `delete-column.ts`.
- Web: kebab-case files everywhere. Fetchers `apps/web/src/fetchers/column/update-column.ts`. Hooks `apps/web/src/hooks/mutations/column/use-update-column.ts`, `apps/web/src/hooks/queries/column/use-get-columns.ts`. Components `apps/web/src/components/kanban-board/column/column-header.tsx` exporting a PascalCase named component.
- Tests: `*.test.ts` / `*.test.tsx`. API tests live outside the package, in `tests/api/<domain>/<subject>.test.ts`.

### Handler / controller shape

Route file composes middleware in a fixed order — `describeRoute` (OpenAPI) → `validator("param", ...)` → `validator("json", ...)` → `workspaceAccess.*` → `requireWorkspacePermission` → thin handler that calls a controller. From `apps/api/src/column/index.ts`:

```ts
  .put(
    "/:id",
    describeRoute({
      operationId: "updateColumn",
      tags: ["Columns"],
      description: "Update a column",
      responses: {
        200: {
          description: "Column updated successfully",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({
        name: v.optional(v.string()),
        icon: v.optional(v.nullable(v.string())),
        color: v.optional(v.nullable(v.string())),
        isFinal: v.optional(v.boolean()),
      }),
    ),
    workspaceAccess.fromColumn("id"),
    requireWorkspacePermission({ project: ["update"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      const data = c.req.valid("json");
      const result = await updateColumn(id, data);
      return c.json(result);
    },
  )
```

Handlers never contain domain logic and never re-check roles by hand.

### Service / controller shape

Controllers are plain async functions with an explicit inline param type, default-exported. Partial updates use conditional spreads so `undefined` never overwrites. From `apps/api/src/column/controllers/update-column.ts`:

```ts
async function updateColumn(
  id: string,
  data: { name?: string; icon?: string | null; color?: string | null; isFinal?: boolean },
) {
  const existing = await db.query.columnTable.findFirst({ where: eq(columnTable.id, id) });
  if (!existing) throw new HTTPException(404, { message: "Column not found" });

  const [updated] = await db
    .update(columnTable)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.isFinal !== undefined && { isFinal: data.isFinal }),
    })
    .where(eq(columnTable.id, id))
    .returning();

  if (!updated) throw new HTTPException(500, { message: "Failed to update column" });
  return updated;
}

export default updateColumn;
```

### Test shape

Vitest with `describe` / `it` / `expect`. API unit tests import the real implementation by relative path from `tests/api/**` — `apps/api/vitest.config.ts` sets `include: ["../../tests/api/**/*.test.ts"]`, `environment: "node"`. From `tests/api/column/to-slug.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toSlug } from "../../../apps/api/src/column/controllers/create-column";

describe("toSlug", () => {
  it("slugifies Latin names", () => {
    expect(toSlug("To Do")).toBe("to-do");
  });
});
```

Web component tests use Testing Library in jsdom with an explicit `cleanup()`. From `apps/web/src/components/kanban-board/task-labels.test.tsx`:

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

Integration tests are separate: `tests/api-integration/*.test.ts` via `vitest.integration.config.ts`, requiring live PostgreSQL.

### Config

Server env comes from the root `.env` loaded by `dotenv-mono`; Vite-only overrides go in `apps/web/.env.local`. Access is direct `process.env.X` reads, generally centralized under `apps/api/src/config/`. Database URL is resolved through `apps/api/src/database/resolve-database-url.ts` (shared by runtime and `drizzle.config.ts`), which composes `DATABASE_URL` or the discrete `POSTGRES_*` vars.

### Data layer

Drizzle ORM, `pgTable` schema in `apps/api/src/database/schema.ts`, relations in `relations.ts`. Ids are `text` with `$defaultFn(() => createId())` (cuid2). Both query styles appear: `db.query.<table>.findFirst({ where: eq(...) })` and the builder `db.select().from(...).where(...).orderBy(asc(...))`. Existing `columnTable`:

```ts
export const columnTable = pgTable(
  "column",
  {
    id: text("id").$defaultFn(() => createId()).primaryKey(),
    projectId: text("project_id").notNull().references(() => projectTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    position: integer("position").notNull().default(0),
    icon: text("icon"),
    color: text("color"),
    isFinal: boolean("is_final").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow()...
```

Column names are snake_case in SQL, camelCase in TS. Migrations are **generated, never hand-written**: `pnpm --filter @kaneo/api db:generate` writes a numbered file into `apps/api/drizzle/` (latest `0042_previous_the_executioner.sql`) plus a `meta/` journal entry; inspect the SQL and commit it with the schema change. Nullable-with-default is the safe shape for adding a column to existing installs.

### Framework-owned wiring

- API: a domain exports a `Hono` instance from `<domain>/index.ts`; `apps/api/src/index.ts` mounts it (`const columnApi = api.route("/column", column);`) and the resulting type is folded into the exported app-type union that `@kaneo/libs` consumes. Adding a field to an existing route needs no new wiring; adding a route does.
- Web: components call fetchers via the typed client, never raw `fetch`. Fetcher:

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

Hooks own cache invalidation:

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

Components use `@/`-aliased imports, `useTranslation()` for every user-visible string, `useWorkspacePermission()` for capability gating, and `immer`'s `produce` for store updates. See `apps/web/src/components/kanban-board/column/column-header.tsx`.

## Sample files inspected

- `apps/api/src/column/index.ts` (kind: route module)
- `apps/api/src/column/controllers/update-column.ts` (kind: controller)
- `apps/api/src/column/controllers/get-columns.ts` (kind: controller)
- `apps/api/src/database/schema.ts` (kind: ORM schema)
- `apps/api/drizzle.config.ts` (kind: migration config)
- `apps/api/vitest.config.ts`, `apps/web/vitest.config.ts` (kind: test config)
- `tests/api/column/to-slug.test.ts` (kind: api unit test)
- `apps/web/src/components/kanban-board/task-labels.test.tsx` (kind: web component test)
- `apps/web/src/fetchers/column/{create,update,reorder}-column.ts` (kind: fetcher)
- `apps/web/src/hooks/mutations/column/use-update-column.ts` (kind: query hook)
- `apps/web/src/components/kanban-board/column/column-header.tsx` (kind: component)

## Notes for downstream codegen

- Mirror the existing `isFinal` column end-to-end when adding a persisted column field; it is the closest precedent for a WIP limit and touches exactly the same files.
- New DB columns must be nullable or carry a default — existing installations run these migrations. Generate the migration, do not write SQL by hand.
- Every new request field needs a Valibot validator entry **and** accurate `describeRoute` OpenAPI metadata; validation is the API contract.
- Never add a role check inline; use `requireWorkspacePermission` with the `@kaneo/permissions` vocabulary, and pair it with the right `workspaceAccess.from*` resolver.
- Controllers throw `HTTPException` for expected failures; handlers stay thin.
- If a mutation should drive activity/notifications/realtime, call `publishEvent()` and follow through to WebSocket delivery and TanStack Query invalidation.
- All user-facing web copy must be a static i18n key added to `i18n/en-US.json` (source of truth) — no inline English strings.
- Two board implementations exist (`components/board/` and `components/kanban-board/`) and are deliberately not shared; confirm which one is in scope before editing.
- Prefer inferred types and `type` over `interface`. Files use `export default` for API controllers/fetchers, named exports for React components and hooks.
- Verify with scoped commands (`pnpm --filter @kaneo/api test`, `pnpm --filter @kaneo/web test`, matching `typecheck`), and `biome ci .` for read-only lint — never the root `lint` script, which rewrites files.

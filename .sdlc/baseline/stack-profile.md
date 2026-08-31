# Stack profile — learned from repo scan

Built `2026-08-28` at commit `5d1fc910`. **Authoritative** over any pre-authored adapter fragment where the two disagree. Trigger: dominant stacks are Hono + React/Vite; shipped adapters cover only generic/nest/python.

## Language & runtime

TypeScript throughout, ESM (`"type": "module"` at root), Node ≥ 20.19, pnpm 10.32.1, Turborepo task graph. TypeScript 7.0.2. Formatting and linting by **Biome 2.5.7** (not ESLint/Prettier) — note the root `lint` script runs `--write` and mutates files. Types are inferred wherever possible; `type` is preferred over `interface` unless extension or declaration merging is needed.

## Framework

- **API (`apps/api`):** Hono, with `hono-openapi` for route documentation, **Valibot** for validation (not Zod — Zod is present only for the MCP surface), Better Auth for identity, **Drizzle ORM** against PostgreSQL, ioredis for optional realtime fan-out.
- **Web (`apps/web`):** React + Vite, TanStack Router (file-based, generated `routeTree.gen.ts`) and TanStack Query for all server state, Tailwind + Radix/base-ui for presentation, `dnd-kit` for board drag-and-drop, `react-i18next` for copy, zustand for client stores, immer for immutable updates.
- **Site (`apps/site`):** Next.js — separate marketing surface, rarely in scope with product work.

## Conventions detected

### File naming

Strict **kebab-case filenames** everywhere, including React components. Directory-per-feature with an `index.ts`/`index.tsx` barrel that owns wiring.

- API: `apps/api/src/column/index.ts` (routes) + `apps/api/src/column/controllers/create-column.ts` (one exported function per file, verb-first name matching the file).
- Web: `apps/web/src/components/kanban-board/column/column-header.tsx`, `apps/web/src/fetchers/column/update-column.ts`, `apps/web/src/hooks/mutations/column/use-update-column.ts`.
- Tests sit **next to the unit** on the web side (`task-labels.test.tsx` beside `task-labels.tsx`) but in a **separate top-level tree** on the API side (`tests/api/column/to-slug.test.ts`).

No `PascalCase.tsx`. No `.controller.ts` / `.service.ts` suffixes. No decorators anywhere — this is emphatically *not* a Nest-shaped codebase.

### Handler / route shape

Routes are a single chained `new Hono()` builder in the feature's `index.ts`. Each method call stacks, in this fixed order: `describeRoute(...)` → `validator("param"|"json"|"query", ...)` → access middleware → permission middleware → thin async handler that delegates to a controller.

```ts
const column = new Hono<{
  Variables: {
    userId: string;
  };
}>()
  .post(
    "/:projectId",
    describeRoute({
      operationId: "createColumn",
      tags: ["Columns"],
      description: "Create a new column in a project",
      responses: {
        200: {
          description: "Column created successfully",
          content: {
            "application/json": { schema: resolver(v.any()) },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    validator(
      "json",
      v.object({
        name: v.string(),
        icon: v.optional(v.string()),
        color: v.optional(v.string()),
        isFinal: v.optional(v.boolean()),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["update"] }),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const { name, icon, color, isFinal } = c.req.valid("json");
      const result = await createColumn({ projectId, name, icon, color, isFinal });
      return c.json(result);
    },
  );

export default column;
```

Handlers stay thin: destructure validated input, call the controller, `c.json(...)`. Authorization is **always** middleware (`workspaceAccess.fromX(...)` + `requireWorkspacePermission({...})`), never an inline role check.

### Controller / domain shape

One default-exported async function per file, taking a single destructured object parameter with an inline type. Throws `HTTPException` for expected failures. Talks to Drizzle directly — there is no repository layer.

```ts
async function createColumn({
  projectId, name, icon, color, isFinal,
}: {
  projectId: string; name: string; icon?: string; color?: string; isFinal?: boolean;
}) {
  const slug = toSlug(name);
  if (!slug) {
    throw new HTTPException(400, {
      message: "Column name must contain at least one alphanumeric character",
    });
  }

  const [created] = await db.insert(columnTable).values({ projectId, name, slug, position, ... }).returning();
  if (!created) throw new HTTPException(500, { message: "Failed to create column" });
  return created;
}

export default createColumn;
```

Pure helpers used by the controller are **named exports from the same file** (`export function toSlug(...)`), which is how tests reach them.

### Web component shape

Function components with a named export, a local `type XProps = {...}` immediately above, hooks in a stable order (i18n → stores → mutations → permissions → local state), then handlers, then JSX. Copy always via `t("namespace:key")` — never inline strings. Permission gating via `useWorkspacePermission()`.

```tsx
type ColumnHeaderProps = {
  column: ProjectWithTasks["columns"][number];
};

export function ColumnHeader({ column }: ColumnHeaderProps) {
  const { t } = useTranslation();
  const { project, setProject } = useProjectStore();
  const { mutate: updateTask } = useUpdateTask();
  const { canUpdateTasks, canCreateTasks } = useWorkspacePermission();
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);

  const handleConfirmArchive = () => {
    const updatedProject = produce(project, (draft) => { /* ... */ });
    setProject(updatedProject);
    toast.success(t("tasks:archive.success", { count: column.tasks.length }));
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="truncate text-sm font-medium text-foreground/95">{column.name}</span>
    </div>
  );
}
```

Types are derived from existing shapes (`ProjectWithTasks["columns"][number]`) rather than re-declared. Immutable updates use `immer`'s `produce`. Tailwind classes are written inline; no CSS modules.

### Fetcher shape

Every web request goes through the typed `@kaneo/libs` client — never bare `fetch`. Default-exported function, explicit `response.ok` check that throws the response text.

```ts
import { client } from "@kaneo/libs";

async function updateColumn(id: string, data: { name?: string; icon?: string | null }) {
  const response = await client.column[":id"].$put({ param: { id }, json: data });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }
  return response.json();
}

export default updateColumn;
```

### Query / mutation hook shape

Named-export `useX` wrapping TanStack Query. Mutations take a single object arg (often carrying `projectId` purely for invalidation), and invalidate **all affected keys in parallel** with `refetchType: "all"`.

```ts
export function useUpdateColumn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; projectId: string; data: {...} }) => updateColumn(id, data),
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

### Test shape

**Vitest everywhere**, `describe`/`it`, explicit imports of `describe, expect, it` from `vitest`.

API unit tests live in `tests/api/<feature>/` and import across the tree by relative path:

```ts
import { describe, expect, it } from "vitest";
import { toSlug } from "../../../apps/api/src/column/controllers/create-column";

describe("toSlug", () => {
  it("slugifies Latin names", () => {
    expect(toSlug("To Do")).toBe("to-do");
  });
});
```

Web component tests are colocated, Testing Library, with explicit `cleanup()`:

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

Test names are full sentences describing observable behavior. Assertions favor `toBeVisible()` over `toBeInTheDocument()`. Integration tests (`tests/api-integration/`, `vitest.integration.config.ts`) run against real PostgreSQL.

### Config

Env-driven via `process.env` read through helper modules (`apps/api/src/utils/get-settings`), surfaced to clients by a Hono `/config` route whose response is described by a shared Valibot `configSchema` in `apps/api/src/schemas.ts`. Root `.env` is loaded via `dotenv-mono` across the workspace; Vite-only overrides belong in `apps/web/.env.local` and use the `VITE_` prefix via `import.meta.env`.

### Data layer

Drizzle ORM, PostgreSQL. Schema in `apps/api/src/database/schema.ts`, relations in `apps/api/src/database/relations.ts`. CUID2 ids, explicit snake_case column names, cascade rules stated inline, indexes declared in the table's third argument.

```ts
export const columnTable = pgTable(
  "column",
  {
    id: text("id").$defaultFn(() => createId()).primaryKey(),
    projectId: text("project_id").notNull()
      .references(() => projectTable.id, { onDelete: "cascade", onUpdate: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    position: integer("position").notNull().default(0),
    isFinal: boolean("is_final").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [index("column_projectId_idx").on(table.projectId)],
);
```

Queries are built with `db.select()/insert()/update()` plus `eq`, `sql` template literals for computed expressions, and `.returning()` on writes. Migrations are **generated**, never hand-written: `pnpm --filter @kaneo/api db:generate`, then inspect the SQL and commit it with the schema change.

### Framework-owned wiring

New API surfaces register in `apps/api/src/index.ts` by mounting the feature router, then the whole `api` app mounts under `/api`:

```ts
const columnApi = api.route("/column", column);
// ...
app.route("/api", api);
```

The per-route `const xApi = api.route(...)` assignments feed the exported type that `@kaneo/libs` consumes — that is how `client.column[":id"].$put` becomes type-safe on the web side. **Adding an API route therefore has a cross-package contract effect**: `@kaneo/libs` and every consumer must typecheck.

Web routes are file-based under `apps/web/src/routes/` with `routeTree.gen.ts` regenerated by the TanStack Router plugin — treat that file as generated output.

## Sample files inspected

- `apps/api/src/column/index.ts` (kind: routes / wiring)
- `apps/api/src/column/controllers/create-column.ts` (kind: controller)
- `apps/api/src/config/index.ts` (kind: routes, config surface)
- `apps/api/src/index.ts` (kind: entry point / wiring, 968 lines — read selectively)
- `apps/api/src/database/schema.ts` (kind: ORM schema, 1173 lines — read selectively)
- `apps/web/src/components/kanban-board/column/column-header.tsx` (kind: component)
- `apps/web/src/fetchers/column/update-column.ts` (kind: fetcher)
- `apps/web/src/hooks/mutations/column/use-update-column.ts` (kind: mutation hook)
- `tests/api/column/to-slug.test.ts` (kind: API unit test)
- `apps/web/src/components/kanban-board/task-labels.test.tsx` (kind: web component test)
- `turbo.json`, `pnpm-workspace.yaml`, `package.json` (kind: build/workspace config)

## Notes for downstream codegen

- **kebab-case filenames, always** — including React components. `column-header.tsx`, not `ColumnHeader.tsx`.
- **No decorators, no DI container.** Do not emit Nest-shaped code. Hono chaining + plain functions.
- **Valibot (`import * as v from "valibot"`), not Zod**, for API validation. Zod appears only in `packages/mcp`.
- **Every API route needs `describeRoute` OpenAPI metadata** with `operationId`, `tags`, `description`, and a `responses` entry. Omitting it breaks the public API contract requirement in `AGENTS.md`.
- **Authorization is middleware.** Use `workspaceAccess.fromProject(...)` / `.fromX(...)` plus `requireWorkspacePermission({ resource: ["action"] })` from `@kaneo/permissions`. Never inline a role comparison, and never treat UI hiding as an authorization check.
- **Controllers throw `HTTPException`**, they do not return error envelopes.
- **Web copy must be a static i18n key.** Add to `i18n/en-US.json` (source of truth) and reference `t("ns:key")`. Never inline user-facing English in a component. Run `pnpm i18n:check` when touching copy.
- **All web requests go through `client` from `@kaneo/libs`.** Never introduce a parallel `fetch` layer.
- **Mutations must invalidate the right query keys** — and if the mutation affects realtime state, consider `publishEvent()`, WebSocket delivery, and Redis fan-out on the API side.
- **Schema changes require a generated migration** committed alongside, and must work on existing installations, not just empty dev databases.
- Prefer inferred types and index-access types over fresh declarations; prefer `type` over `interface`.
- Comments explain constraints or surprising decisions only — do not narrate code.
- Adding or changing an API route ripples into `@kaneo/libs` and its consumers; typecheck those packages, not just the one you edited.

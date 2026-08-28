# Stack profile — learned from repo scan

Built: 2026-08-27 · run `20260827-124738-refactor-lane-header` · repo `kaneo`

**Authoritative.** This profile was learned by sampling real files in this repo. Where it conflicts with a pre-authored adapter fragment (`generic.md` / `nest.md` / `python.md`), this profile wins. No adapter matched this stack, so there is no fragment to reconcile with.

## Language & runtime

TypeScript 7.0.2, ESM throughout (`"type": "module"` at the workspace root). Node >= 20.19. Package manager is pnpm 10.32.1 with a Turborepo task graph on top. `strict: true` everywhere, plus `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `isolatedModules`, `moduleResolution: "bundler"`, `jsx: "react-jsx"` on the web side. Formatting and linting are Biome 2.5.7 (`biome.json` at root) with **tab indentation** for config/JSON and organize-imports enabled as an assist action; TS/TSX source in practice is formatted by Biome defaults (2-space) — do not hand-reformat, let Biome decide.

Shared tsconfig presets live in `packages/typescript-config`. Path alias on web is `@/* → ./src/*` plus `@i18n/* → ../../i18n/*`; the API uses relative imports only.

## Framework

Multi-framework monorepo, all TypeScript:

- **`apps/api`** — Hono 4.x, with `hono-openapi` (`describeRoute` / `validator` / `resolver`) for OpenAPI metadata, Valibot for validation, Better Auth for sessions, Drizzle ORM on PostgreSQL, `@hono/node-ws` for WebSockets, optional ioredis fan-out, and an MCP HTTP surface.
- **`apps/web`** — React 19-era + Vite, TanStack Router (file/route-tree generated) + TanStack Query for server state, react-i18next for copy, Tailwind-style utility classes with a shadcn-ish `components/ui` layer.
- **`apps/site`** — Next.js app-router marketing site (separate concern; rarely in refactor scope).
- **`packages/libs`** — the shared **typed Hono RPC client** (`client`) that the web app must use for every request.

## Conventions detected

### File naming

Uniformly **kebab-case** files, one concern per file, `default export` of a single function/component.

- API route module: `apps/api/src/<domain>/index.ts`
- API controller: `apps/api/src/<domain>/controllers/<verb>-<noun>.ts` — e.g. `update-column.ts`, `reorder-columns.ts`, `bulk-update-tasks.ts`
- Web component: `apps/web/src/components/<feature>/<thing>.tsx` — e.g. `kanban-board/column/column-header.tsx`
- Web fetcher: `apps/web/src/fetchers/<domain>/<verb>-<noun>.ts` — mirrors the controller name exactly
- Web mutation hook: `apps/web/src/hooks/mutations/<domain>/use-<verb>-<noun>.ts`
- Web query hook: `apps/web/src/hooks/queries/…`
- Test: co-located `*.test.ts(x)` next to the unit on web; centralized under `tests/api/` and `tests/api-integration/` for the API

No `.controller.ts` / `.service.ts` suffixes, no PascalCase filenames, no barrel `index.ts` re-export files except as the route-module entry (API) or component-folder entry (web).

### Handler / controller shape

A domain is **one Hono chain** in `<domain>/index.ts`. Each method is `describeRoute(...)` → `validator(...)` → access middleware → permission middleware → thin handler that delegates to a controller. The chain is a single fluent expression with `export default`.

```ts
// apps/api/src/column/index.ts
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import updateColumn from "./controllers/update-column";

const column = new Hono<{ Variables: { userId: string } }>()
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
  );

export default column;
```

Non-negotiables visible in the pattern: every route carries `operationId`, `tags`, `description`; every input is Valibot-validated and read back via `c.req.valid(...)`; authorization is `workspaceAccess.from*(...)` + `requireWorkspacePermission({...})`, never an inline role check; the handler body is 3-5 lines.

Note the ordering quirk: `validator` calls come **before** the access/permission middleware in the chain.

### Controller (domain logic) shape

Plain `async function`, `export default`, no classes, no DI container. Direct Drizzle access. Expected failures are `HTTPException`.

```ts
// apps/api/src/column/controllers/update-column.ts
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable } from "../../database/schema";

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
      ...(data.icon !== undefined && { icon: data.icon }),
    })
    .where(eq(columnTable.id, id))
    .returning();

  if (!updated) throw new HTTPException(500, { message: "Failed to update column" });
  return updated;
}

export default updateColumn;
```

Partial updates use the `...(x !== undefined && { x })` spread idiom rather than building an object imperatively. Existence is checked before mutation and again on the `.returning()` result.

Mutations that drive activity, notifications, integrations, or realtime updates additionally call `publishEvent("<domain>.<event>", {...})` — e.g. `publishEvent("task.status_changed", {...})`, `publishEvent("workspace.created", {...})`. Event names are dot-namespaced snake-ish strings.

### Web data flow — three files per operation

Every web mutation is a strict three-layer chain. Never call `fetch` directly; never skip a layer.

**1. Fetcher** — uses the typed `client` from `@kaneo/libs`, indexes the RPC path, throws on `!response.ok`.

```ts
// apps/web/src/fetchers/column/update-column.ts
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

**2. Mutation hook** — `useMutation` + explicit `queryClient.invalidateQueries` in `onSuccess`, batched with `Promise.all`, `refetchType: "all"`. Note it is a **named** export (`export function useX`), unlike fetchers/components which default-export.

```ts
// apps/web/src/hooks/mutations/column/use-update-column.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateColumn from "@/fetchers/column/update-column";

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

Query keys are tuple arrays: `["columns", projectId]`, `["tasks", projectId]`. Extra fields (`projectId`) are carried in the mutation variables purely so `onSuccess` can invalidate — keep that habit.

**3. Component** — consumes the hook.

### Component shape

Function declaration (not arrow), local `type <Name>Props = {...}` immediately above, destructured props with inline defaults, `export default` at the bottom. Types come from inferred shapes (`ProjectWithTasks["columns"][number]`) rather than hand-written DTOs.

```tsx
// apps/web/src/components/kanban-board/column/index.tsx
import { useState } from "react";
import type { ProjectWithTasks } from "@/types/project";
import { ColumnDropzone } from "./column-dropzone";
import { ColumnHeader } from "./column-header";

type ColumnProps = {
  column: ProjectWithTasks["columns"][number];
  disableDragDrop?: boolean;
};

function Column({ column, disableDragDrop = false }: ColumnProps) {
  const [isDropzoneOver, setIsDropzoneOver] = useState(false);
  return (
    <div
      className={`group relative flex h-full min-h-0 w-full flex-col rounded-xl border transition-colors duration-150 ${
        isDropzoneOver
          ? "border-ring/40 bg-accent/60 shadow-md ring-2 ring-ring/30"
          : "border-border/70 bg-muted/40 shadow-xs/5 hover:border-border/90 dark:bg-card/90"
      }`}
    >
      <div className="shrink-0 border-b border-border/60 px-3 py-2">
        <ColumnHeader column={column} />
      </div>
    </div>
  );
}

export default Column;
```

Styling is Tailwind utilities against **semantic design tokens** — `border-border`, `bg-muted`, `bg-accent`, `ring-ring`, `bg-card`, with `/NN` opacity suffixes and `dark:` variants. Never hardcode hex or raw palette colors (`bg-slate-200`); always use the token. Conditional classes are template literals here, though `cn()` from `@/lib` is also used elsewhere.

Sub-components inside a component folder use **named** exports (`ColumnHeader`, `ColumnDropzone`); the folder's `index.tsx` default-exports the main one.

### i18n

All user-facing copy goes through `react-i18next` with **static** keys. Namespaced as `namespace:dotted.path`.

```tsx
import { useTranslation } from "react-i18next";
const { t } = useTranslation();

toast.success(t("tasks:archive.success", { count: column.tasks.length }));
<button title={t("tasks:listView.archiveAllTooltip")} />
```

`i18n/en-US.json` is the source of truth; sibling locale files (`de-DE`, `fr-FR`, `hi-IN`, …) are reconciled by `pnpm i18n:check` / `pnpm i18n:report`. Never build a key by string concatenation — the checker needs them statically analyzable.

### Test shape

Vitest everywhere. `describe` / `it` / `expect`, imported explicitly from `vitest` (no globals).

**Web** — `@testing-library/react`, `renderHook` / `render`, `waitFor`, co-located `*.test.tsx`:

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useBoardSort } from "./use-board-sort";

describe("useBoardSort", () => {
  beforeEach(() => { window.localStorage.clear(); });

  it("restores persisted sort from storage", async () => {
    window.localStorage.setItem(storageKey, JSON.stringify({ field: "priority", direction: "desc" }));
    const { result } = renderHook(() => useBoardSort("project-1"));
    await waitFor(() => {
      expect(result.current.sort).toEqual({ field: "priority", direction: "desc" });
    });
  });
});
```

Test names are full behavioral sentences ("restores persisted sort from storage", "falls back to the default sort when stored JSON is invalid").

**API integration** — boots the real app and uses `app.request(...)`; no HTTP server, no supertest:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../apps/api/src/index";

describe("API integration: config", () => {
  it("returns the public config shape", async () => {
    const { app } = createApp();
    const response = await app.request("/api/config");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ disableRegistration: false });
  });
});
```

**API unit** — mocks via `vi.hoisted` + `vi.mock` with relative paths from `tests/api/` into `apps/api/src/`:

```ts
const authMocks = vi.hoisted(() => ({ getSession: vi.fn(async () => ({ user: { id: "test-user" } })) }));
vi.mock("../../apps/api/src/auth", () => ({ auth: { api: { getSession: authMocks.getSession } } }));
```

Assertions favor `toMatchObject` / `toEqual` / `toSatisfy` over long chains of individual property checks.

### Config

Server config is env-driven, read through `process.env` inside `apps/api/src/utils/get-settings` and surfaced to clients by a dedicated read-only Hono route (`apps/api/src/config/index.ts`) whose response is described by `configSchema` in `apps/api/src/schemas.ts`. Client config is Vite `import.meta.env.VITE_*`. Root `.env` is loaded via `dotenv-mono`; web-only overrides belong in `apps/web/.env.local`.

The public config route deliberately exposes only booleans (`hasSmtp`, `hasGithubSignIn`, …) — never the credential itself. Follow that shape when adding a new toggle.

### Data layer

Drizzle ORM against PostgreSQL. Tables in `apps/api/src/database/schema.ts`, relations in `relations.ts`.

```ts
export const columnTable = pgTable("column", {
  id: text("id").$defaultFn(() => createId()).primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projectTable.id, { onDelete: "cascade", onUpdate: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  position: integer("position").notNull().default(0),
  icon: text("icon"),
  color: text("color"),
  isFinal: boolean("is_final").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().$onUpdate(() => new Date()).notNull(),
});
```

Conventions: exported const named `<entity>Table`; snake_case SQL column names mapped to camelCase TS fields; `text` cuid2 ids via `$defaultFn(() => createId())`; FKs always declare `onDelete`/`onUpdate` cascade; `createdAt`/`updatedAt` timestamp pair with `$onUpdate`.

Reads use `db.query.<table>.findFirst/findMany({ where: eq(...) })`; writes use the builder (`db.update(...).set(...).where(...).returning()`).

**Migrations are generated, never hand-written:** `pnpm --filter @kaneo/api db:generate`, then inspect the emitted SQL in `apps/api/drizzle/` and commit it with the schema change. ~43 migrations exist; they must work against existing installations, not just an empty dev DB.

### Framework-owned wiring

- **New API domain:** create `apps/api/src/<domain>/index.ts` exporting a Hono chain, then mount it in `apps/api/src/index.ts` (`createApp()`), which is also the function the integration tests import.
- **New web route:** TanStack Router. Add a file under `apps/web/src/routes/`; `routeTree.gen.ts` is regenerated by `@tanstack/router-plugin` — **never edit it by hand** (it carries `@ts-nocheck`).
- **New permission:** extend `@kaneo/permissions` vocabulary, enforce in the API via `requireWorkspacePermission`, and gate the UI with `use-workspace-permission`. UI hiding alone is not authorization.
- **New realtime effect:** `publishEvent()` in the controller → WebSocket delivery (`apps/api/src/ws/`, optional Redis fan-out) → client cache invalidation in the mutation hook.

## Sample files inspected

- `apps/api/src/column/index.ts` (kind: route module / controller chain)
- `apps/api/src/column/controllers/update-column.ts` (kind: controller / domain logic)
- `apps/api/src/config/index.ts` (kind: route module, minimal)
- `apps/api/src/database/schema.ts` (kind: ORM schema)
- `apps/web/src/fetchers/column/update-column.ts` (kind: fetcher)
- `apps/web/src/hooks/mutations/column/use-update-column.ts` (kind: mutation hook)
- `apps/web/src/components/kanban-board/column/index.tsx` (kind: component)
- `apps/web/src/components/kanban-board/column/column-header.tsx` (kind: component / i18n usage)
- `apps/web/src/hooks/use-board-sort.test.tsx` (kind: web test)
- `tests/api-integration/config.test.ts` (kind: API integration test)
- `tests/api/mcp-stateless.test.ts` (kind: API unit test)
- `apps/web/tsconfig.app.json`, `apps/web/vitest.config.ts`, `biome.json`, `turbo.json` (kind: config)

## Notes for downstream codegen

1. **Three-file rule on web.** A new mutation is always fetcher → mutation hook → component consumer. Generating a component that calls `fetch` or `client` directly is wrong.
2. **Never bypass `@kaneo/libs`.** The typed Hono RPC client is the only request layer. `client.column[":id"].$put({ param, json })` — path segments are indexed by their literal route string including the colon.
3. **Default vs named exports matter.** Fetchers, controllers, route modules, and folder-`index` components use `export default`. Hooks and sub-components use named exports.
4. **Every API route needs `describeRoute` with `operationId`, `tags`, `description`, plus Valibot `validator` for each input.** Omitting OpenAPI metadata breaks `apps/docs/openapi.json` and the `openapi.test.ts` integration test.
5. **Authorization is middleware, not code.** Use `workspaceAccess.from{Project,Column,Task}(...)` and `requireWorkspacePermission({ resource: ["action"] })`. Never write an inline role comparison.
6. **Copy is i18n keys only.** Add the key to `i18n/en-US.json` and reference `t("namespace:dotted.key")`. Literal English strings in JSX will fail review.
7. **Colors are semantic tokens.** `border-border/70`, `bg-muted/40`, `bg-accent/60`, `ring-ring/30`, `dark:bg-card/90`. Never emit `bg-gray-100` style raw palette classes.
8. **Do not touch generated files:** `apps/web/src/routeTree.gen.ts`, `apps/api/drizzle/**`, `apps/docs/openapi.json`, `i18n/schema.json`.
9. **Schema changes require a generated migration** in the same change, produced by `db:generate` and inspected — and it must be safe for existing installations.
10. **Formatting is Biome's job.** Emit reasonable code; do not fight the formatter or hand-align. Verify with a targeted `biome check` (no `--write`) rather than `pnpm lint`, which rewrites files repo-wide.
11. **Prefer inferred types and `type` over `interface`.** Derive from existing shapes (`ProjectWithTasks["columns"][number]`) instead of declaring parallel DTOs.
12. **Realtime-affecting mutations need `publishEvent()` plus matching client-side `invalidateQueries`.** Changing one without the other leaves boards stale.

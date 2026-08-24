# Stack profile — learned from repo scan

- **Repo:** kaneo (`/home/sangeetha/projects/kaneo`)
- **Built:** 2026-08-20T12:20:44+00:00 at HEAD `5d1fc91`
- **Trigger:** primary stack (Hono + Drizzle + Valibot + TanStack React) has no pre-authored adapter (`generic.md`, `nest.md`, `python.md` only).
- **Authority:** this profile wins over any pre-authored adapter fragment on conflict.

## Language & runtime

TypeScript 7.0.2 on Node ≥ 20.19, pure ESM (`"type": "module"` at root). `strict: true` inherited from `packages/typescript-config/base.json` (`target: ES2022`, `module: NodeNext`). `apps/api` overrides to `module: ESNext` + `moduleResolution: Bundler`. Package manager is pnpm 10.32.1 with a Turborepo task graph. Formatting and linting are Biome 2.5.7 — **tab-indented** in config/JSON files, 2-space in `.ts`/`.tsx` sources, double quotes, trailing commas, semicolons.

## Framework

- **API (`apps/api`):** Hono, with `hono-openapi` for OpenAPI metadata and Valibot (`valibot` as `* as v`) for validation. Better Auth for auth, Drizzle ORM over `node-postgres`, ioredis optional for realtime fan-out, native WebSockets via `@hono/node-ws`.
- **Web (`apps/web`):** React + Vite, TanStack Router (file-based, generated `routeTree.gen.ts`) and TanStack Query for all server state. Radix/base-ui primitives + Tailwind.
- **Site (`apps/site`):** Next.js — separate marketing/docs surface, distinct conventions from `apps/web`.
- **Cross-package contract:** `packages/libs` exports a typed Hono RPC `client`; the web app never hand-rolls fetches.

## Conventions detected

### File naming

Everything is **kebab-case, one exported unit per file**, with the export as a `default`.

- Domain modules: `apps/api/src/label/index.ts`, `apps/api/src/task/index.ts` — one directory per domain noun.
- Controllers: `apps/api/src/label/controllers/create-label.ts`, `get-labels-by-workspace-id.ts`, `assign-label-to-task.ts` — file name is the verb-phrase of the operation.
- Web fetchers: `apps/web/src/fetchers/label/attach-label-to-task.ts`.
- Web hooks: `apps/web/src/hooks/mutations/label/use-create-label.ts`, `apps/web/src/hooks/use-board-sort.ts` — `use-` prefix.
- Tests: `tests/api/label/assign-and-unassign-label.test.ts`, `apps/web/src/hooks/use-board-sort.test.tsx` — `.test.ts(x)` suffix.

No `PascalCase.thing.ts`, no `*.service.ts`, no `*.controller.ts` suffixes. The directory (`controllers/`, `fetchers/`, `hooks/mutations/`) carries the role; the filename carries the operation.

### Handler / route shape (API)

A domain's `index.ts` builds one `new Hono<{ Variables: ... }>()` and **chains** `.get()/.post()/.put()/.delete()`. Each route is `describeRoute(...)` → `validator(...)` → permission middleware → thin async handler that delegates to a controller. From `apps/api/src/label/index.ts`:

```ts
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { labelSchema } from "../schemas";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import getLabelsByWorkspaceId from "./controllers/get-labels-by-workspace-id";

const label = new Hono<{ Variables: { userId: string } }>()
  .get(
    "/workspace/:workspaceId",
    describeRoute({
      operationId: "getWorkspaceLabels",
      tags: ["Labels"],
      description: "Get all labels for a specific workspace",
      responses: {
        200: {
          description: "List of labels in the workspace",
          content: {
            "application/json": { schema: resolver(v.array(labelSchema)) },
          },
        },
      },
    }),
    validator("param", v.object({ workspaceId: v.string() })),
    workspaceAccess.fromParam(),
    async (c) => {
      const { workspaceId } = c.req.valid("param");
      const labels = await getLabelsByWorkspaceId(workspaceId);
      return c.json(labels);
    },
  );
```

Every route carries a unique `operationId`, a `tags` array, a `description`, and a `resolver(...)`-wrapped response schema — the OpenAPI spec is generated from these, so omitting them is a real defect, not a style nit. Handler bodies read `c.req.valid("param" | "json" | "query")` and return `c.json(...)`. Nothing else.

Authorization is middleware, never inline role math: `workspaceAccess.fromParam()`, `workspaceAccess.fromTaskId()`, `requireWorkspacePermission(...)` from `../utils/`.

### Controller shape (API domain logic)

Plain `async function`, arguments as positional primitives (not a DTO object), `export default` at the bottom. Drizzle queries are inline — there is no repository layer. Expected failures use `HTTPException`. Realtime/activity side effects use `publishEvent(...)`. External syncs are fired without awaiting and `.catch()`-logged so they cannot fail the request.

```ts
import { and, eq, isNull, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { labelTable, projectTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { syncLabelToGitHub } from "../../plugins/github/utils/sync-label-to-github";

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

  const [inserted] = await db
    .insert(labelTable)
    .values({ name, color, taskId, workspaceId: task.workspaceId })
    .onConflictDoNothing({ target: [labelTable.taskId, labelTable.name] })
    .returning();

  if (inserted) {
    syncLabelToGitHub(taskId, name, color).catch((error) => {
      console.error("Failed to sync label to GitHub:", error);
    });
    await publishEvent("task.label_created", {
      projectId: task.projectId,
      taskId: task.id,
      userId,
      type: "label_created",
    });
  }

  return inserted;
}

export default createLabel;
```

Trivial reads skip `async` entirely and return the Drizzle builder — it is thenable:

```ts
function getLabelsByWorkspaceId(workspaceId: string) {
  return db.select().from(labelTable).where(eq(labelTable.workspaceId, workspaceId));
}
export default getLabelsByWorkspaceId;
```

Note the authorization idiom: a cross-workspace mismatch throws **404 "Task not found"**, not 403 — existence is not leaked across workspace boundaries. Preserve that.

### Web fetcher shape

One function per endpoint, calling the typed client. Request type is exported alongside. Non-OK responses throw with the response text.

```ts
import { client } from "@kaneo/libs";

export type AttachLabelToTaskRequest = { labelId: string; taskId: string };

async function attachLabelToTask({ labelId, taskId }: AttachLabelToTaskRequest) {
  const response = await client.label[":id"].task.$put({
    param: { id: labelId },
    json: { taskId },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default attachLabelToTask;
```

The `client.<route>[":param"].<segment>.$put(...)` shape is derived from the API's chained Hono type — adding a route on the API side makes it appear here automatically.

### Web mutation hook shape

TanStack Query `useMutation` wrapping the fetcher, with **optimistic `setQueryData` first, then `invalidateQueries`**. Imports use the `@/` alias.

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateLabelRequest } from "@/fetchers/label/create-label";
import createLabel from "@/fetchers/label/create-label";
import { addLabelToTaskInTasksCache } from "./sync-task-labels-cache";

function useCreateLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createLabel,
    onSuccess: (createdLabel, variables: CreateLabelRequest) => {
      queryClient.setQueryData(
        ["labels", variables.workspaceId],
        (existing: Array<typeof createdLabel> | undefined) =>
          existing ? [...existing, createdLabel] : [createdLabel],
      );

      void queryClient.invalidateQueries({
        queryKey: ["labels", variables.workspaceId],
      });
    },
  });
}

export default useCreateLabel;
```

Query keys are flat tuples of literals and ids: `["labels", workspaceId]`, `["labels", taskId]`. `invalidateQueries` calls are prefixed with `void`.

### Test shape

Vitest everywhere, `describe` / `it` / `expect`. API unit tests live **outside** the package, at `tests/api/<domain>/<behavior>.test.ts`, and mock the module graph by path with `vi.mock` before importing the subject. `db` is replaced with a hand-built mock exposing `query.<table>.findFirst`, `select`, `insert`, `delete`, `transaction`.

```ts
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";

const mockFindFirst = vi.fn();
const mockInsert = vi.fn();
const mockPublishEvent = vi.fn();

const mockTransaction = vi.fn(async (cb: (tx: unknown) => unknown) =>
  cb({
    insert: (...args: unknown[]) => mockInsert(...args),
    query: { labelTable: { findFirst: (...a: unknown[]) => mockFindFirst(...a) } },
  }),
);

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    query: { labelTable: { findFirst: (...a: unknown[]) => mockFindFirst(...a) } },
    insert: (...a: unknown[]) => mockInsert(...a),
    transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));

vi.mock("../../../apps/api/src/events", () => ({
  publishEvent: (...a: unknown[]) => mockPublishEvent(...a),
}));
```

Web tests sit **next to** the unit under test (`use-board-sort.test.tsx`, `sync-task-labels-cache.test.ts`) and are pure-function tests over fully-literal fixture objects — every field of the fixture is spelled out, including nulls. Test names are behavioral sentences: `"adds a label to the matching task without changing other tasks"`.

Integration tests are separate: `tests/api-integration/` under `vitest.integration.config.ts`, requiring real PostgreSQL.

### Config

No config module or schema validator. Env is read directly as `process.env.X` at the point of use, with inline defaults and coercion. 97 distinct names are referenced; only 20 are documented in `.env.sample`. Server env loads from the **root** `.env` (via `dotenv-mono`); Vite-only overrides live in `apps/web/.env.local`. When adding a variable, document it in `.env.sample` and `ENVIRONMENT_SETUP.md`, and check whether `charts/kaneo` and the Dockerfiles need to pass it through.

### Data layer

Drizzle ORM, PostgreSQL. Schema is centralized in `apps/api/src/database/schema.ts`; relations in `apps/api/src/database/relations.ts`. Tables are named `<noun>Table` and map to a singular snake_case SQL name. Ids are `text` with a cuid2 `$defaultFn`. Timestamps use `defaultNow()` plus `$onUpdate`. Foreign keys always declare `onDelete`/`onUpdate` cascade behavior. Indexes and unique constraints are declared in the third `pgTable` argument as an array.

```ts
export const labelTable = pgTable(
  "label",
  {
    id: text("id").$defaultFn(() => createId()).primaryKey(),
    name: text("name").notNull(),
    color: text("color").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    taskId: text("task_id").references(() => taskTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    workspaceId: text("workspace_id").references(() => workspaceTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  },
  (table) => [
    index("label_task_id_idx").on(table.taskId),
    index("label_workspace_id_idx").on(table.workspaceId),
    unique("label_task_name_unique").on(table.taskId, table.name),
  ],
);
```

Migrations are **generated, never written**: edit `schema.ts`, run `pnpm --filter @kaneo/api db:generate`, inspect the emitted SQL, commit it with the schema change. 43 migrations exist (`apps/api/drizzle/0000_*.sql` … `0042_*.sql`). Migrations run at boot via `drizzle-orm/node-postgres/migrator`, so they must be safe against existing installations.

### Framework-owned wiring

New API surface registers in `apps/api/src/index.ts` in three steps:

1. `import label from "./label";`
2. `const labelApi = api.route("/label", label);`  — the returned const is captured because the chained type feeds the RPC client type.
3. The whole `api` app mounts once: `app.route("/api", api);`

So the public path is `/api/<domain>/<route>`. Existing mounts include `/project`, `/task`, `/column`, `/label`, `/comment`, `/activity`, `/time-entry`, `/notification`, `/search`, `/workspace`, `/user`, `/invitation`, `/workflow-rule`, `/task-relation`, `/external-link`, `/billing`, `/oauth`, `/config`, and the integration routers.

Web routes are file-based under `apps/web/src/routes/`; `routeTree.gen.ts` is regenerated by the Vite plugin and must not be hand-edited.

## Sample files inspected

- `apps/api/src/index.ts` (kind: entry point / wiring)
- `apps/api/src/label/index.ts` (kind: route module)
- `apps/api/src/label/controllers/create-label.ts` (kind: controller — write path)
- `apps/api/src/label/controllers/get-labels-by-workspace-id.ts` (kind: controller — read path)
- `apps/api/src/database/schema.ts` (kind: ORM schema)
- `apps/api/drizzle/*.sql` (kind: migrations — 43 files, listing only)
- `apps/api/package.json`, `turbo.json`, `pnpm-workspace.yaml` (kind: build/task config)
- `tests/api/label/assign-and-unassign-label.test.ts` (kind: API unit test)
- `apps/web/src/fetchers/label/attach-label-to-task.ts` (kind: web fetcher)
- `apps/web/src/hooks/mutations/label/use-create-label.ts` (kind: web mutation hook)
- `apps/web/src/hooks/mutations/label/sync-task-labels-cache.test.ts` (kind: web unit test)
- `packages/libs/src/index.ts` (kind: shared client barrel)
- `packages/typescript-config/base.json` (kind: tsconfig base)

## Notes for downstream codegen

- **Mirror the directory, not the filename.** New API operation → `apps/api/src/<domain>/controllers/<verb-phrase>.ts` with a `default` export, wired from `<domain>/index.ts`.
- **Never skip OpenAPI metadata.** `operationId`, `tags`, `description`, and a `resolver()`-wrapped response schema on every route. `AGENTS.md` treats accurate Valibot validation and OpenAPI metadata as a public-API contract.
- **Validation is Valibot** (`import * as v from "valibot"`), not Zod — even though `zod` appears in `apps/api` deps for the MCP SDK. Do not introduce Zod into API routes.
- **Authorization is middleware.** Use `requireWorkspacePermission` / `workspaceAccess.*` from `apps/api/src/utils/`; never re-implement role checks in a controller. Cross-workspace access returns 404, not 403.
- **Expected HTTP failures are `HTTPException`** from `hono/http-exception`. Reserve bare `Error` for genuine invariant violations.
- **Mutations that change realtime state need `publishEvent(...)`** plus a matching WebSocket/cache path. `AGENTS.md`'s "follow a change through" list is the checklist: route → client → fetcher → hook → cache invalidation → events → WS → permissions → schema → i18n → docs → Helm/Docker.
- **Schema changes are two artifacts.** `schema.ts` (+ `relations.ts`) edit *and* a generated migration from `pnpm --filter @kaneo/api db:generate`. Never hand-author SQL in `apps/api/drizzle/`.
- **Web data access goes through `@kaneo/libs`' `client`.** Do not add `fetch`/axios calls. Fetcher in `apps/web/src/fetchers/`, server state in a TanStack Query hook.
- **User-facing copy uses static i18n keys.** `i18n/en-US.json` is the source of truth; `i18n/schema.json` is generated. Verify with `pnpm i18n:check`.
- **Prefer inferred types and `type` over `interface`** unless declaration merging is genuinely needed.
- **Comments explain constraints, not code.** The existing codebase is almost comment-free; matching that is correct.
- **Verification:** `pnpm --filter @kaneo/api test` for API logic, `pnpm --filter @kaneo/web test` for web units, `pnpm typecheck` for cross-package contracts, `test:integration` only when routing/auth/PostgreSQL behavior is at stake. **Avoid `pnpm lint`** — it runs Biome with `--write` and rewrites unrelated files.

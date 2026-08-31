# Stack profile — learned from repo scan

Built 2026-08-31 from commit `5d1fc910`. Tier 2b triggered: primary stacks are **Hono** (API) and
**React/TanStack + Next.js** (web/site); shipped adapters are `generic.md`, `nest.md`, `python.md` — no
match. **This profile is authoritative over any pre-authored adapter fragment.**

## Language & runtime

TypeScript throughout (`typescript` 7.0.2 pinned at root). Node `>=20.19.0`, pnpm `10.32.1`, ESM
(`"type": "module"` at root). Turborepo orchestrates `build`/`dev`/`lint`/`test`/`typecheck` across a
pnpm workspace (`packages/**`, `apps/**`). Biome 2.5.7 is the single formatter/linter — note it runs
with `--write` in the `lint` scripts. Husky + commitlint (conventional commits) guard commits.

Style signals from real files: tab indentation in JSON config (`docs.json`, `i18n/en-US.json`),
two-space in `.ts`/`.tsx`, double-quoted strings, trailing commas, `type` preferred over `interface`
(explicit in `AGENTS.md`).

## Framework

- **API** — Hono, with `hono-openapi` for route description, Valibot for validation, Better Auth for
  auth, Drizzle ORM over PostgreSQL (`pg`), optional Redis (`ioredis`) for realtime fan-out, WebSockets
  via `@hono/node-ws`, Sentry.
- **Web** — React + Vite, TanStack Router (route tree generated), TanStack Query for server state,
  Radix UI + Tailwind, dnd-kit for the board, TipTap for rich text.
- **Site** — Next.js (separate public marketing/docs host).
- **Docs** — Mintlify (`apps/docs/docs.json` + `.mdx`), no package manifest.

## Conventions detected

### File naming

`kebab-case.ts` everywhere. No PascalCase filenames, even for React components.

- `apps/api/src/time-entry/controllers/create-time-entry.ts`
- `apps/api/src/database/schema.ts`, `relations.ts`
- `apps/web/src/components/board/board-toolbar.tsx`
- `apps/web/src/fetchers/column/create-column.ts`
- `apps/web/src/hooks/use-board-sort.ts` (+ colocated `use-board-sort.test.tsx`)

API domain modules are a folder per domain under `apps/api/src/<domain>/` with `index.ts` (routes) and
`controllers/<verb>-<noun>.ts`. Tables are `<name>Table` exports mapping to `snake_case` SQL names.

### Handler / route shape

`apps/api/src/<domain>/index.ts` builds a chained `new Hono<{ Variables: { userId: string } }>()`, with
`describeRoute` (OpenAPI) then `validator` (Valibot) then auth/permission middleware then a thin async
handler that delegates to a controller. From `apps/api/src/time-entry/index.ts`:

```ts
const timeEntry = new Hono<{
  Variables: {
    userId: string;
  };
}>()
  .get(
    "/task/:taskId",
    describeRoute({
      operationId: "getTaskTimeEntries",
      tags: ["Time Entries"],
      description: "Get all time entries for a specific task",
      responses: {
        200: {
          description: "List of time entries for the task",
          content: {
            "application/json": { schema: resolver(v.array(timeEntrySchema)) },
          },
        },
      },
    }),
    validator("param", v.object({ taskId: v.string() })),
    workspaceAccess.fromTaskId(),
    async (c) => {
      const { taskId } = c.req.valid("param");
      const timeEntries = await getTimeEntriesByTaskId(taskId);
      return c.json(timeEntries);
    },
  )
```

Handlers stay thin: destructure `c.req.valid(...)`, call one controller, `c.json(...)`. Authorization is
always middleware (`workspaceAccess.*`, `requireWorkspacePermission`) — never inline role checks.

### Controller / domain shape

`apps/api/src/<domain>/controllers/<verb>-<noun>.ts` — one default-exported async function per file,
destructured object parameter with an inline object type, direct Drizzle calls, `HTTPException` for
expected failures, `publishEvent()` when the mutation drives activity/realtime. From
`create-time-entry.ts`:

```ts
async function createTimeEntry({
  taskId, userId, description, startTime, endTime, duration,
}: {
  taskId: string; userId: string; description?: string;
  startTime: Date; endTime?: Date; duration?: number;
}) {
  const [createdTimeEntry] = await db
    .insert(timeEntryTable)
    .values({ id: createId(), taskId, userId, description: description || "", startTime, endTime: endTime || null, duration: duration || 0 })
    .returning();

  if (!createdTimeEntry) {
    throw new HTTPException(500, { message: "Failed to create time entry" });
  }
```

IDs come from `createId()` (`@paralleldrive/cuid2`), generated in the controller on insert paths.

### Web fetcher shape

`apps/web/src/fetchers/<domain>/<verb>-<noun>.ts` — one default-exported async function using the shared
typed Hono client. No parallel untyped request layer. From `create-column.ts`:

```ts
import { client } from "@kaneo/libs";

async function createColumn(
  projectId: string,
  data: { name: string; icon?: string; color?: string; isFinal?: boolean },
) {
  const response = await client.column[":projectId"].$post({ param: { projectId }, json: data });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default createColumn;
```

Server state lives in TanStack Query hooks under `apps/web/src/hooks/queries/` and
`apps/web/src/hooks/mutations/`, which wrap these fetchers.

### Test shape

Vitest with `describe`/`it`/`expect`, `vi.hoisted()` + `vi.mock()` for module mocks. Two locations:

- `tests/api/**` — API unit tests, importing across the repo boundary with relative paths
  (`vi.mock("../../apps/api/src/auth", ...)`).
- `tests/api-integration/**` — PostgreSQL-backed integration tests.
- Web tests are colocated (`apps/web/src/hooks/use-board-sort.test.tsx`).

From `tests/api/mcp-internal-api-url.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({ user: { id: "test-user" } })),
}));

vi.mock("../../apps/api/src/auth", () => ({
  auth: { api: { getSession: authMocks.getSession } },
}));
```

Tests build real `Request` objects and drive the Hono app rather than mocking the framework.

### Config

Env-driven from the root `.env` via `dotenv-mono` (server) and `apps/web/.env.local` (Vite-only
overrides); see `ENVIRONMENT_SETUP.md`. `apps/api/src/config/` holds config modules. `process.env.X`
reads are direct — there is no central Zod/Valibot env schema; Valibot is used for request validation,
not config.

### Data layer

Drizzle ORM over PostgreSQL. Schema in `apps/api/src/database/schema.ts`, relations in
`relations.ts` — both explicitly mandated by `AGENTS.md`. `pgTable` with a third array argument for
indexes:

```ts
export const timeEntryTable = pgTable(
  "time_entry",
  {
    id: text("id").$defaultFn(() => createId()).primaryKey(),
    taskId: text("task_id").notNull().references(() => taskTable.id, { onDelete: "cascade", onUpdate: "cascade" }),
    userId: text("user_id").references(() => userTable.id, { onDelete: "set null", onUpdate: "cascade" }),
    duration: integer("duration").default(0),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index("time_entry_taskId_idx").on(table.taskId),
    index("time_entry_userId_idx").on(table.userId),
  ],
);
```

Conventions: `text` PKs from cuid2, `snake_case` SQL names / `camelCase` TS names, explicit
`onDelete`/`onUpdate`, explicit indexes named `<table>_<col>_idx`, `mode: "date"` timestamps.

Migrations are **generated**, never hand-written: `pnpm --filter @kaneo/api db:generate`, inspect the
SQL, commit it with the schema change. `apps/api/src/migrations/` is generated output.

### Framework-owned wiring

- **API route registration** — a new domain module exports a `Hono` instance from
  `apps/api/src/<domain>/index.ts`; `apps/api/src/index.ts` mounts it. Adding a route without mounting
  it is a no-op.
- **Web routing** — TanStack Router; `apps/web/src/routeTree.gen.ts` is generated, never edited.
- **Realtime** — mutations call `publishEvent()`; events fan out through `apps/api/src/events/`,
  `apps/api/src/ws/`, and optional Redis, then land as TanStack Query cache invalidations on the client.
- **Permissions** — vocabulary and built-in roles live in `packages/permissions`; the API enforces via
  `requireWorkspacePermission`; the UI reads capability checks. All three must move together.
- **i18n** — user-facing web copy uses static keys; `i18n/en-US.json` is the source of truth, checked by
  `pnpm i18n:check`.
- **Docs** — `apps/docs` is Mintlify. A new page must be added to the `navigation` array in
  `apps/docs/docs.json` or it will not appear. Feature documentation belongs here, **not** in `README.md`
  (which is install/deploy/community only).

## Sample files inspected

- `apps/api/src/time-entry/index.ts` (kind: routes)
- `apps/api/src/time-entry/controllers/create-time-entry.ts` (kind: controller)
- `apps/api/src/database/schema.ts` (kind: ORM schema)
- `apps/web/src/fetchers/column/create-column.ts`, `delete-column.ts` (kind: fetcher)
- `apps/web/src/components/board/board-toolbar.tsx` (kind: component)
- `tests/api/mcp-internal-api-url.test.ts` (kind: test)
- `apps/docs/docs.json`, `apps/docs/core/functional/plan-and-execute-tasks.mdx` (kind: docs)
- `package.json`, `pnpm-workspace.yaml` (kind: manifest)

## Notes for downstream codegen

- `AGENTS.md` is the binding contract. Read it before generating; it overrides generic instincts.
- Filenames are kebab-case, always. One default-exported function per controller/fetcher file.
- Never inline an authorization check — use `requireWorkspacePermission` / `workspaceAccess.*` middleware.
- Every public API route needs `describeRoute` OpenAPI metadata *and* a Valibot `validator`. Omitting
  either breaks a stated boundary.
- Use `HTTPException` for expected HTTP failures, not bare `throw new Error`.
- Never hand-write a migration; generate it and include the SQL with the schema change.
- Never edit `apps/web/src/routeTree.gen.ts`, `apps/docs/openapi.json`, or `apps/api/src/migrations/**`.
- New user-facing strings go through `i18n/en-US.json` static keys, never inline literals.
- A mutation that changes board/task state almost certainly needs `publishEvent()` plus a client cache
  invalidation — check the full path before declaring done.
- Documentation changes go to `apps/docs/**/*.mdx` and, for new pages, `apps/docs/docs.json` navigation.
- Prefer targeted verification (`pnpm --filter <pkg> test`, `typecheck`) over repo-wide `pnpm lint`,
  which runs Biome `--write` and can touch unrelated files.

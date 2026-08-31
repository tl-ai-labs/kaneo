# Stack profile — learned from repo scan

Built 2026-08-31 at commit `5d1fc910`. Authoritative over pre-authored adapter fragments on conflict.

## Language & runtime

TypeScript 7.0.2, Node >= 20.19.0, ESM throughout (`"type": "module"` at root). pnpm 10.32.1 workspace orchestrated by Turborepo. Biome 2.5.7 is the formatter/linter (tab indentation in JSON config files, double quotes in TS). Husky + commitlint enforce conventional commits.

## Framework

Four surfaces, one language family:

- **`apps/api`** — Hono + `hono-openapi`, Valibot validation, Drizzle ORM on PostgreSQL, Better Auth, an internal event bus, WebSockets, optional Redis fan-out.
- **`apps/web`** — React + Vite, TanStack Router (file-based routes under `src/routes/`) and TanStack Query, Zustand stores, react-i18next.
- **`apps/site`** — Next.js public site.
- **`apps/docs`** — Mintlify (`docs.json`, `.mdx` pages).

## Conventions detected

### File naming

Kebab-case files everywhere, including React components. One exported unit per file.

- API controllers: `apps/api/src/label/controllers/create-label.ts`, `get-labels-by-task-id.ts` — verb-first, one controller per file, **default export** of a plain async function.
- API route module: `apps/api/src/label/index.ts` — one per domain folder.
- Web components: `apps/web/src/components/board/board-toolbar.tsx`.
- Web hooks: `apps/web/src/hooks/use-task-filters.ts` (`use-` prefix).
- Tests sit beside the unit: `use-task-filters-with-labels-support.test.tsx`.

Domain folders under `apps/api/src/` are singular nouns (`task`, `label`, `column`, `time-entry`, `workspace`), each with `index.ts` + `controllers/`.

### Handler / route shape

Routes are a chained Hono builder in the domain's `index.ts`. Every route carries `describeRoute` OpenAPI metadata, a Valibot `validator`, an authorization middleware, and a thin handler that delegates to a controller.

```ts
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
          content: {
            "application/json": { schema: resolver(v.array(labelSchema)) },
          },
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
  )
```

Handlers never contain domain logic. Authorization comes from `requireWorkspacePermission` or `workspaceAccess.*` middleware — never inline role checks.

### Controller shape

Default-exported async function, positional primitive args (not an options object), Drizzle queries inline, `HTTPException` for expected failures, `publishEvent()` for anything that drives activity/realtime/integrations.

```ts
async function createLabel(
  name: string,
  color: string,
  taskId: string | undefined,
  workspaceId: string,
  userId: string,
) {
  const [task] = await db
    .select({ id: taskTable.id, projectId: taskTable.projectId })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!task) {
    throw new HTTPException(404, { message: "Task not found" });
  }
  // ...
}
```

### Web shape

Hooks export a `type` (never `interface`) for their state shape, with module-level `const` tables for defaults and key lists.

```ts
export type BoardFilters = {
  status: string[] | null;
  priority: string[] | null;
  assignee: string[] | null;
  dueDate: string[] | null;
  labels: string[] | null;
};

export const DUE_DATE_FILTER_VALUES = {
  dueNextWeek: "dueNextWeek",
  dueThisWeek: "dueThisWeek",
  noDueDate: "noDueDate",
} as const;
```

Imports use the `@/` alias for intra-app paths and `@kaneo/*` for workspace packages. Type-only imports use `import type`.

### Test shape

Vitest across every package (`vitest run --config vitest.config.ts`). Tests are colocated with the unit under test as `*.test.ts` / `*.test.tsx`. API unit tests live in `tests/api`; PostgreSQL-backed integration tests in `tests/api-integration` behind `pnpm test:integration`.

### Config

Server env comes from the root `.env` via `dotenv-mono`; Vite-only overrides live in `apps/web/.env.local`. `VITE_`-prefixed vars are the browser surface. `apps/api/src/config/` holds the API's config module. `ENVIRONMENT_SETUP.md` is the reference.

### Data layer

Drizzle ORM against PostgreSQL. Schema in `apps/api/src/database/schema.ts`, relations in `apps/api/src/database/relations.ts`. Tables are `pgTable("snake_case_name", {...}, (table) => [indexes])` with camelCase TS keys mapped to snake_case columns, `createId()` cuid primary keys, and explicit `onDelete`/`onUpdate` cascades.

```ts
export const timeEntryTable = pgTable(
  "time_entry",
  {
    id: text("id").$defaultFn(() => createId()).primaryKey(),
    taskId: text("task_id").notNull().references(() => taskTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    duration: integer("duration").default(0),
  },
  (table) => [index("time_entry_taskId_idx").on(table.taskId)],
);
```

Migrations are generated with `pnpm --filter @kaneo/api db:generate`, the SQL is inspected, and it ships with the schema change.

### Framework-owned wiring

- **API route registration:** create `apps/api/src/<domain>/index.ts` exporting a chained Hono instance, then mount it on the root app. Controllers are imported individually into that file.
- **Web routes:** TanStack Router file-based under `apps/web/src/routes/_layout/_authenticated/...`.
- **Web data access:** request functions live in `apps/web/src/fetchers/<domain>/`, always using the typed client from `@kaneo/libs`. Server state is wrapped in TanStack Query hooks under `apps/web/src/hooks/`. No parallel untyped request layer.
- **Docs pages (Mintlify):** add an `.mdx` file under `apps/docs/core/...` **and** register its path in `apps/docs/docs.json` under `navigation.tabs[].groups[].pages`. An unregistered page does not render.

### Docs (.mdx) conventions

YAML frontmatter with `title` and `description`, then a one-line orienting sentence, then `##` sections. Sentence-case headings, occasionally numbered (`## 1. Create tasks quickly`). Internal links are absolute site paths (`/core/functional/backlog-planning`), not relative file paths. Pages close with a `## Next` list of related links. Bold is used for UI labels (`**Backlog**`, `**Open in full page**`). No `#` H1 — the title comes from frontmatter.

```mdx
---
title: Plan Work in Backlog
description: Use the backlog to prepare work before it enters active execution
---

Backlog view is your planning layer. Use it to prepare tasks before moving them into active columns.

## When to use Backlog

- Break down upcoming scope
- Prioritize before execution

## Next

- [Plan and execute tasks in Board/List](/core/functional/plan-and-execute-tasks)
```

## Sample files inspected

- `apps/api/src/label/index.ts` (kind: route module)
- `apps/api/src/label/controllers/create-label.ts` (kind: controller)
- `apps/api/src/database/schema.ts` (kind: data layer)
- `apps/api/src/time-entry/` (kind: domain folder)
- `apps/web/src/hooks/use-task-filters.ts` (kind: hook / state)
- `apps/web/src/components/board/board-toolbar.tsx` (kind: component)
- `apps/docs/docs.json` (kind: docs navigation config)
- `apps/docs/core/functional/index.mdx` (kind: docs index)
- `apps/docs/core/functional/backlog-planning.mdx` (kind: docs page)
- `apps/docs/core/functional/plan-and-execute-tasks.mdx` (kind: docs page)

## Notes for downstream codegen

- Prefer `type` over `interface`; prefer inferred types. This is an explicit `AGENTS.md` rule.
- Never add an authorization check only in the UI — the API is the authority. Use `requireWorkspacePermission` with `@kaneo/permissions` vocabulary.
- Any mutation that affects realtime state needs `publishEvent()`, WebSocket delivery, and client cache invalidation considered together.
- Every public API route needs Valibot validation plus accurate `describeRoute` OpenAPI metadata; `apps/docs/openapi.json` is generated from it, so do not hand-edit that file.
- User-facing **web** copy must use static i18n keys with `i18n/en-US.json` as source of truth. Mintlify docs content is exempt — it is English-only prose.
- Root and package `lint` scripts run Biome with `--write` and can reformat unrelated files. Prefer targeted checks while iterating.
- For docs-only work the meaningful proof is nav integrity (`docs.json` pages match files on disk) and link validity, not `pnpm test`.

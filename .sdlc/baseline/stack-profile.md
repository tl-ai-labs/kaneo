# Stack profile — learned from repo scan

Built 2026-08-26 from HEAD `5d1fc910`. **Authoritative over any pre-authored adapter fragment.**
Triggered because the dominant stacks (React/Vite/TanStack Router; Hono/Drizzle) have no shipped adapter (`generic.md`, `nest.md`, `python.md` only).

## Language & runtime

TypeScript 7.0.2 across the whole monorepo, ESM (`"type": "module"` at root). Node `>=20.19.0`, pnpm 10.32.1, Turborepo task graph. Formatting/linting via Biome 2.5.7 — `biome.json` sets `indentStyle: "tab"` at the root, but `apps/web` and `apps/api` source in practice is 2-space; match the surrounding file rather than the root config. `organizeImports` assist is on, so import order is alphabetized by module specifier with `node:` builtins first, then external, then `@/` aliases.

Path aliases: `@/` → `apps/web/src`, `@i18n` → `i18n/` (defined in both `vite.config.ts` and `vitest.config.ts`).

## Framework

Two distinct halves:

- **`apps/api`** — Hono + `hono-openapi` + Valibot + Drizzle ORM (PostgreSQL) + Better Auth. WebSockets via `@hono/node-ws`, optional Redis fan-out via ioredis.
- **`apps/web`** — React + Vite + TanStack Router (file-based, generated route tree) + TanStack Query + Zustand. Tailwind v4, Radix/Base UI primitives, `react-i18next` for all user-facing copy.
- `apps/site` — Next.js (public marketing/docs host). `packages/libs` exports the typed Hono RPC client consumed by web.

## Conventions detected

### File naming

Strict `kebab-case.ts` / `kebab-case.tsx` everywhere. Examples: `use-task-filters-with-labels-support.ts`, `board-toolbar.tsx`, `create-comment.ts`, `use-get-labels-by-workspace.ts`. Tests sit **next to** the file they test as `<same-name>.test.ts(x)` — e.g. `use-task-filters-with-labels-support.test.tsx`, `task-row.test.tsx`. No `__tests__/` directories in `apps/web`.

TanStack Router route files live under `apps/web/src/routes/` and their path *is* the URL, including `_layout`/`_authenticated` pathless layout segments and `$param` directories:
`routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx`.

### API route shape (Hono, chained, with OpenAPI + Valibot)

`apps/api/src/comment/index.ts`:

```ts
const comment = new Hono<{ Variables: { userId: string } }>()
  .get(
    "/:taskId",
    describeRoute({
      operationId: "getTaskComments",
      tags: ["Comments"],
      description: "Get all comments for a specific task",
      responses: {
        200: {
          description: "List of comments for the task",
          content: { "application/json": { schema: resolver(v.array(commentSchema)) } },
        },
      },
    }),
    validator("param", v.object({ taskId: v.string() })),
    workspaceAccess.fromTaskId(),
    async (c) => {
      const { taskId } = c.req.valid("param");
      const comments = await getComments(taskId);
      return c.json(comments);
    },
  )
```

Handlers are one-liners that delegate. Every route carries `describeRoute` metadata, a `validator(...)` per input location, and an authorization middleware (`workspaceAccess.*` or `requireWorkspacePermission`).

### Controller shape

One controller per file under `<domain>/controllers/<verb-noun>.ts`, default-exported, plain async function — no classes, no DI. Re-exported by the domain's `index.ts` router. Cross-domain reuse is a bare re-export: `apps/api/src/comment/controllers/create-comment.ts` is literally
`export { default } from "../../activity/controllers/create-comment";`

### Web data-fetching shape

Three layers, never collapsed:

1. **Fetcher** — `apps/web/src/fetchers/<domain>/<verb-noun>.ts`, uses the typed RPC client and `InferRequestType`:

```ts
import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type CreateTaskRequest = InferRequestType<
  (typeof client)["task"][":projectId"]["$post"]
>["json"] & ...;

const response = await client.task[":projectId"].$post({ json: {...}, param: { projectId } });
if (!response.ok) throw new Error(await response.text());
```

2. **Query hook** — `apps/web/src/hooks/queries/<domain>/use-get-*.ts`, default export, thin:

```ts
function useGetLabelsByWorkspace(workspaceId: string) {
  return useQuery({
    enabled: Boolean(workspaceId),
    queryKey: ["labels", workspaceId],
    queryFn: () => getLabelsByWorkspace({ workspaceId }),
  });
}
export default useGetLabelsByWorkspace;
```

3. **Component** consumes the hook. Mutations live under `hooks/mutations/` and handle cache invalidation there.

### Local/UI state shape

Zustand with `persist` + `createJSONStorage` for user preferences (`apps/web/src/store/user-preferences.ts`), plain `useState` + hand-rolled `localStorage` effects for per-project view state (the board filter hooks). Store types are `type` aliases combining state and actions in one object. Const tuples with `as const` plus a type guard is the established pattern for enumerated values:

```ts
export const WEEK_START_DAYS = [0, 1, 6] as const;
export type WeekStartDay = (typeof WEEK_START_DAYS)[number];
export function isWeekStartDay(value: number): value is WeekStartDay {
  return WEEK_START_DAYS.some((day) => day === value);
}
```

The board filters use the object-map variant: `DUE_DATE_FILTER_VALUES = { dueNextWeek: "dueNextWeek", ... } as const`.

### Test shape

Vitest + Testing Library + jsdom. `apps/web/vitest.config.ts`:

```ts
test: {
  environment: "jsdom",
  setupFiles: ["./src/test/setup.ts"],
  include: ["src/**/*.test.{ts,tsx}"],
  coverage: { enabled: false },
}
```

Explicit named imports from `vitest` (no globals):

```ts
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("useTaskFiltersWithLabelsSupport", () => {
  const storageKey = "kaneo:board-filters:project-1";
  beforeEach(() => { window.localStorage.clear(); });
  afterEach(() => { window.localStorage.clear(); });

  it("restores persisted label filters from storage and matches tasks from project data", async () => {
```

Hook tests use `renderHook` + `waitFor`, seed `window.localStorage` directly, and build fully-typed inline fixture objects (no factory helpers, no `as any`). Test names are full sentences describing behavior.

### Config

Server config comes from the root `.env` via `dotenv-mono`; Vite-only overrides in `apps/web/.env.local`. Web reads `import.meta.env.VITE_*` with an explicit cast (`as string | undefined`). There is no envalid/zod env validator — `apps/web/src/env.test.ts` guards expectations instead. See `ENVIRONMENT_SETUP.md`.

### Search-param validation

Two coexisting idioms in `validateSearch`:

- **zod schema object** (newer, preferred): `apps/web/src/routes/auth/sign-in.tsx`, `device/index.tsx`, `device/approve.tsx`, `mcp.authorize.tsx`
  ```ts
  import { z } from "zod/v4";
  const deviceSearchSchema = z.object({ user_code: z.string().optional() });
  export const Route = createFileRoute("/device/")({ component: DevicePage, validateSearch: deviceSearchSchema });
  ```
- **hand-rolled narrowing function** (older): `board.tsx`, `backlog.tsx`, `gantt.tsx`, `auth/verify-otp.tsx`
  ```ts
  validateSearch: (search: Record<string, unknown>): BoardSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
  ```

Note the import specifier is `zod/v4`, not `zod`.

### Data layer

Drizzle ORM. Schema in `apps/api/src/database/schema.ts`, relations in `apps/api/src/database/relations.ts`. Migrations are **generated**, never hand-written: `pnpm --filter @kaneo/api db:generate`, then inspect the emitted SQL under `apps/api/drizzle/` and commit it with the schema change. Migrations run at API startup via `drizzle-orm/node-postgres/migrator`.

### Framework-owned wiring

- **Web routes:** file-based. Creating `routes/**/foo.tsx` with `createFileRoute(...)` is the registration; `@tanstack/router-plugin` regenerates `apps/web/src/routeTree.gen.ts`. Never hand-edit that file — it carries a "do NOT make any changes" header and Biome ignores it.
- **API routes:** each domain folder exports a `Hono` instance from `index.ts`; `apps/api/src/index.ts` imports it and mounts it. Adding a domain means adding an import + a mount line there.
- **i18n:** every user-facing string is `t("<namespace>:<dot.path>")` with keys added to `i18n/en-US.json` (source of truth). `pnpm i18n:check` validates.

## Sample files inspected

- `apps/api/src/index.ts` (kind: entry point)
- `apps/api/src/comment/index.ts` (kind: router)
- `apps/api/src/comment/controllers/create-comment.ts` (kind: controller)
- `apps/web/src/main.tsx`, `apps/web/src/routeTree.gen.ts` (kind: entry point / generated)
- `apps/web/src/routes/.../project/$projectId/board.tsx` (kind: route)
- `apps/web/src/routes/auth/sign-in.tsx`, `apps/web/src/routes/device/index.tsx` (kind: route + search schema)
- `apps/web/src/components/board/board-toolbar.tsx` (kind: component)
- `apps/web/src/hooks/use-task-filters.ts`, `use-task-filters-with-labels-support.ts` (kind: hook)
- `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` (kind: test)
- `apps/web/src/hooks/queries/label/use-get-labels-by-workspace.ts` (kind: query hook)
- `apps/web/src/fetchers/task/create-task.ts` (kind: fetcher)
- `apps/web/src/store/user-preferences.ts` (kind: store)
- `apps/web/vitest.config.ts`, `biome.json`, `turbo.json`, `pnpm-workspace.yaml` (kind: config)

## Notes for downstream codegen

- Prefer `type` over `interface`; infer types rather than declaring them. `AGENTS.md` states this explicitly.
- Never hand-edit `apps/web/src/routeTree.gen.ts` or anything under `apps/api/drizzle/`.
- Never run `pnpm lint` / `biome check --write .` as verification — it rewrites unrelated files.
- All user-facing web copy must be a static `t("ns:key")` with the key added to `i18n/en-US.json`. Dynamic key construction is a policy violation; the existing `board-toolbar.tsx` due-date chip does build a template-literal key (`` t(`tasks:backlog.filters.${...}`) ``) — that is a pre-existing exception, not a pattern to copy.
- Colocate new tests as `<file>.test.tsx` beside the source; import `describe/it/expect` explicitly from `vitest`.
- When adding search params to a TanStack Router route, remember that every existing `navigate({ to: ".", search: {...} })` in this repo passes a **literal** object and will drop unrelated keys. Use `search: (prev) => ({ ...prev, ... })`.
- Authorization belongs in the API (`requireWorkspacePermission`, `workspaceAccess.*`), never in the UI. Hiding a button is not a check.
- Mutations with realtime impact must consider `publishEvent()`, WebSocket delivery, and TanStack Query cache invalidation together.

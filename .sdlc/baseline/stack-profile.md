# Stack profile — learned from repo scan

Built: 2026-08-26 · repo: Kaneo · HEAD `5d1fc910` · trigger: primary stack is React/Vite + Hono,
no pre-authored adapter (shipped: `generic`, `nest`, `python`).

**This profile is authoritative.** Where it disagrees with a pre-authored adapter fragment, follow
this document — it reflects the repository as it actually is.

## Language & runtime

TypeScript 7.0.2, Node ≥ 20.19, pnpm 10.32.1, ESM throughout (`"type": "module"` at the root and in
`apps/web`). pnpm workspaces (`apps/**`, `packages/**`) driven by Turborepo. Formatting and linting
are Biome 2.5.7 (`biome.json`), **not** ESLint/Prettier. Note the formatting split: `apps/web` sources
are **tab-indented in `package.json`/config but 2-space in `.ts`/`.tsx` sources** — match the
surrounding file, and never run `pnpm lint` (it is `biome check --write` and will reformat unrelated
files).

## Framework

- **Frontend (`apps/web`)** — React 19 + Vite 8, TanStack Router (file-based, generated route tree)
  + TanStack Query for server state, zustand for client state, Tailwind CSS 4, Radix UI / base-ui
  primitives, i18next, vitest + jsdom + Testing Library.
- **Backend (`apps/api`)** — Hono with `hono-openapi`, Valibot validators, Drizzle + PostgreSQL,
  Better Auth, an internal event bus, WebSockets, optional Redis fan-out.
- **Contract between them** — `@kaneo/libs` exports a typed Hono RPC client; the web app never
  hand-writes URLs.

## Conventions detected

### File naming

Strict **kebab-case** for every source file, including React components. The default export is
PascalCase; the filename is not.

- `apps/web/src/components/board/board-toolbar.tsx` → `export default function BoardToolbar`
- `apps/web/src/hooks/use-task-filters-with-labels-support.ts`
- `apps/web/src/hooks/queries/task/use-get-tasks.ts`
- `apps/web/src/fetchers/task/create-task.ts`
- `apps/api/src/label/controllers/get-labels-by-task-id.ts`

Tests sit **beside** the unit under test as `<same-name>.test.ts` / `.test.tsx` — there is no
`__tests__/` directory in `apps/web`.

Route files mirror the URL under `apps/web/src/routes/`, with `_layout` / `_authenticated` pathless
layout segments and `$param` dynamic segments:
`routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx`.

### Import shapes

ESM only. Web sources use the `@/` alias for everything under `apps/web/src` (configured in
`vitest.config.ts` and tsconfig), plus `@i18n` for the repo-root `i18n/` directory. Imports are
Biome-sorted: node builtins, then external packages, then `@/` aliases, then relative. Type-only
imports use `import type`.

```ts
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import BoardToolbar from "@/components/board/board-toolbar";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import type { ProjectWithTasks } from "@/types/project";
```

### Route shape (TanStack Router, file-based)

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

function RouteComponent() {
  const { projectId, workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  ...
}
```

Two `validateSearch` styles coexist. The project sub-routes (board, backlog, gantt) hand-roll a
narrowing predicate as above. The auth / device / mcp routes use a zod v4 schema:

```ts
import { z } from "zod/v4";

const deviceSearchSchema = z.object({ /* ... */ });

export const Route = createFileRoute("/device/")({
  validateSearch: deviceSearchSchema,
  component: RouteComponent,
});
```

Both are legitimate here. Prefer the zod form for anything with arrays, enums, or coercion.

### Component shape

Function components with a colocated `type XProps = { ... }` immediately above. Props are destructured
in the signature. Default export for page-level and feature components; named export for primitives.
Small presentational helpers (`CheckSlot`, `ActiveFilterChip`, `StackedIcons` in `board-toolbar.tsx`)
live in the same file above the main component rather than being extracted prematurely.

```tsx
type BoardToolbarProps = {
  project?: ProjectWithTasks | null;
  filters: BoardFilters;
  updateFilter: (
    key: keyof BoardFilters,
    value: BoardFilters[keyof BoardFilters],
  ) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  viewMode: "board" | "list";
  setViewMode: (mode: "board" | "list") => void;
};

export default function BoardToolbar({
  project,
  filters,
  updateFilter,
  clearFilters,
  hasActiveFilters,
  viewMode,
  setViewMode,
}: BoardToolbarProps) {
  const { t } = useTranslation();
  ...
}
```

Feature components are **fully controlled** — they receive state and setters and hold none of their
own. Styling is inline Tailwind class strings, frequently composed with template literals for
conditional variants (`cn()` from `@/lib/cn` exists and is used where the expression gets long).

### Hook shape

Three distinct hook families, each in its own directory:

1. **Fetchers** — `apps/web/src/fetchers/<domain>/<verb-noun>.ts`, plain async functions over the
   typed client, with request types inferred from the Hono route:

```ts
import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type CreateTaskRequest = InferRequestType<
  (typeof client)["task"][":projectId"]["$post"]
>["json"] &
  InferRequestType<(typeof client)["task"][":projectId"]["$post"]>["param"];

async function createTask(title: string, description: string, projectId: string /* ... */) {
  const response = await client.task[":projectId"].$post({ json: { title, description /* ... */ } });
  ...
}
```

2. **Query/mutation hooks** — `apps/web/src/hooks/queries/<domain>/use-get-x.ts` and
   `hooks/mutations/<domain>/use-x.ts`, thin wrappers that own only the query key:

```ts
import { useQuery } from "@tanstack/react-query";
import getTasks from "@/fetchers/task/get-tasks";

export function useGetTasks(projectId: string) {
  return useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => getTasks(projectId),
    refetchInterval: 30000,
    enabled: !!projectId,
  });
}
```

3. **Local-state hooks** — `apps/web/src/hooks/use-*.ts`, returning a named object of state plus
   action functions. The house pattern for persisted board view state is a `useState` seeded from
   `localStorage` in an effect, written back in a second effect, with a module-level
   `normalizeX(raw: unknown)` guard and a `DEFAULT_X` constant:

```ts
export function useBoardSort(projectId: string | undefined) {
  const storageKey = projectId ? `kaneo:board-sort:${projectId}` : null;
  const [sort, setSort] = useState<SortConfig>(DEFAULT_SORT);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) { setSort(DEFAULT_SORT); return; }
      setSort(normalizeSort(JSON.parse(stored) as unknown));
    } catch {
      setSort(DEFAULT_SORT);
    }
  }, [storageKey]);
  ...
}
```

Storage keys are namespaced `kaneo:<concern>:<projectId>`. Existing keys: `kaneo:board-filters:*`,
`kaneo:board-sort:*`.

### Test shape

vitest with `describe` / `it`, jsdom environment, `@testing-library/react`'s `renderHook` and
`render`, `waitFor` for async assertions. Setup file `apps/web/src/test/setup.ts`. Tests are
colocated and named after the unit.

```tsx
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useTaskFiltersWithLabelsSupport } from "./use-task-filters-with-labels-support";

describe("useTaskFiltersWithLabelsSupport", () => {
  const storageKey = "kaneo:board-filters:project-1";

  beforeEach(() => { window.localStorage.clear(); });
  afterEach(() => { window.localStorage.clear(); });

  it("restores persisted label filters from storage and matches tasks from project data", async () => {
    window.localStorage.setItem(storageKey, JSON.stringify({ labels: ["label-bug"] }));
    const project = { /* full literal fixture built inline, no factory helpers */ };
    ...
  });
});
```

Fixtures are built inline as complete object literals — there is no shared factory or fixture
directory in `apps/web`. Test names are full sentences describing observable behavior.

Command: `pnpm --filter @kaneo/web test`. API tests live separately under `tests/api` (unit) and
`tests/api-integration` (PostgreSQL-backed).

### Config

Server config comes from the root `.env` via `dotenv-mono`. The web app uses Vite `import.meta.env`
with `VITE_`-prefixed keys, validated in `apps/web/src/env.ts` (which has its own `env.test.ts`).
Local Vite-only overrides go in `apps/web/.env.local`; see `ENVIRONMENT_SETUP.md`.

### Data layer

The web app has **no direct data layer** — everything goes through `@kaneo/libs`' typed Hono RPC
client. Server-side, Drizzle ORM over PostgreSQL with schema in `apps/api/src/database/schema.ts`,
relations in `relations.ts`, and migrations generated by `pnpm --filter @kaneo/api db:generate`
(never hand-written).

### API handler shape (for reference — not this ticket's surface)

Thin Hono handlers that validate with Valibot, describe themselves with `hono-openapi`, enforce
permission via middleware, and delegate to a one-function-per-file controller:

```ts
const label = new Hono<{ Variables: { userId: string } }>()
  .get(
    "/task/:taskId",
    describeRoute({
      operationId: "getTaskLabels",
      tags: ["Labels"],
      description: "Get all labels assigned to a specific task",
      responses: { 200: { /* resolver(v.array(labelSchema)) */ } },
    }),
    validator("param", v.object({ taskId: v.string() })),
    workspaceAccess.fromTaskId(),
    async (c) => {
      const { taskId } = c.req.valid("param");
      const labels = await getLabelsByTaskId(taskId);
      ...
    },
  );
```

### Framework-owned wiring

- **Web routes register by file location.** `@tanstack/router-plugin` regenerates
  `apps/web/src/routeTree.gen.ts` on build/dev. That file carries `/* eslint-disable */` and
  `// @ts-nocheck` — **never hand-edit it**, and do not include it in a diff.
- **API routes register explicitly** — each domain module exports a `Hono` instance which is mounted
  in `apps/api/src/index.ts`.
- **i18n keys register in `i18n/en-US.json`** (source of truth, 20+ sibling locales).
  `pnpm i18n:check` validates; user-facing copy must use static keys, never interpolated key names.

## Sample files inspected

- `apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx` (kind: route)
- `apps/web/src/routes/device/index.tsx` (kind: route, zod search schema)
- `apps/web/src/components/board/board-toolbar.tsx` (kind: component)
- `apps/web/src/hooks/use-task-filters.ts` (kind: local-state hook)
- `apps/web/src/hooks/use-task-filters-with-labels-support.ts` (kind: local-state hook)
- `apps/web/src/hooks/use-board-sort.ts` (kind: local-state hook, persistence pattern)
- `apps/web/src/hooks/queries/task/use-get-tasks.ts` (kind: query hook)
- `apps/web/src/fetchers/task/create-task.ts` (kind: fetcher)
- `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` (kind: test)
- `apps/web/vitest.config.ts` (kind: test config)
- `apps/api/src/label/index.ts` (kind: API route module)

## Notes for downstream codegen

- Filenames are kebab-case even for components. Do not emit `BoardToolbar.tsx`.
- Use the `@/` alias for intra-`apps/web` imports; never deep relative paths like `../../hooks/...`.
- Prefer `type` over `interface`, and prefer inferred types — AGENTS.md states this explicitly.
- Two-space indentation in `.ts`/`.tsx` sources. Double-quoted strings. Trailing commas. Semicolons.
- Never hand-edit `apps/web/src/routeTree.gen.ts`.
- Never run `pnpm lint` as verification — it is `biome check --write` and rewrites unrelated files.
  Use `pnpm --filter @kaneo/web test` and `pnpm --filter @kaneo/web typecheck`.
- Any user-visible string needs a static i18n key in `i18n/en-US.json`.
- Feature components should stay controlled; put state and persistence in a hook under
  `apps/web/src/hooks/`.
- When adding persisted board state, follow the `normalizeX(raw: unknown)` + `DEFAULT_X` +
  `typeof window === "undefined"` guard + `try`/`catch` shape already used by `useBoardSort` and the
  filter hooks.
- Colocate new tests as `<name>.test.tsx` next to the unit, build fixtures inline as full literals,
  and name tests as full behavioral sentences.

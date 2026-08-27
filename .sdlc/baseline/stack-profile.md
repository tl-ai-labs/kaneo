# Stack profile — learned from repo scan

Built: run `20260827-043436-feature-extend-board-filter-chips`. Sampled from live files in `apps/web`, with supporting reads in `apps/api` and `packages/libs`.
**Authoritative over `stacks/generic.md` wherever they disagree.**

## Language & runtime

TypeScript throughout, ESM only (`"type": "module"` at root and in every package). TypeScript `7.0.2` pinned at the root and `~7.0.2` in `apps/web`. Node `>=20.19.0`, pnpm `10.32.1`. Build orchestration is Turborepo (`turbo.json`); the web app builds with Vite 8 and the React compiler Babel plugin (`babel-plugin-react-compiler`) is enabled.

Formatting and linting are Biome 2.5.7, not ESLint/Prettier. Root `biome.json` sets `formatter.indentStyle: "tab"` globally but overrides `javascript.formatter` to `indentStyle: "space"` with `quoteStyle: "double"` — so **`.ts`/`.tsx` are 2-space, double-quoted**, while JSON-ish files are tabbed. `assist.actions.source.organizeImports` is on, so import order is tool-enforced. `routeTree.gen.ts`, `dist`, `coverage`, `.claude` and `package.json` are excluded from Biome.

## Framework

`apps/web` — React 19 + Vite 8 + **TanStack Router (file-based, code-generated)** + TanStack Query 5. State is split: server state in TanStack Query, client/UI state in Zustand stores (plus some nanostores). UI is Radix primitives and `@base-ui/react` wrapped in local `@/components/ui/*`, styled with Tailwind 4 via `@tailwindcss/vite`, animated with `framer-motion`, drag-and-drop via `@dnd-kit`.

`apps/api` — Hono + `hono-openapi`, Better Auth, Drizzle ORM over PostgreSQL, Valibot validation. `apps/site` — Next.js. `packages/libs` exports the typed Hono RPC client consumed by the web app.

## Conventions detected

### File naming

Strict **kebab-case** for every file and directory under `apps/web/src`, including components that export a `PascalCase` symbol. There is no `.component.tsx` / `.controller.ts` suffix convention — the folder carries the meaning.

- `apps/web/src/components/board/board-toolbar.tsx` → exports `BoardToolbar`
- `apps/web/src/hooks/use-task-filters.ts` → exports `useTaskFilters`
- `apps/web/src/hooks/queries/task/use-get-tasks.ts`
- `apps/web/src/fetchers/task/get-tasks.ts`
- `apps/web/src/store/user-preferences.ts`

Tests sit **beside** the file they test: `use-board-sort.ts` / `use-board-sort.test.tsx`.

Routes are the one exception — they follow TanStack Router's file-based grammar with `$param` and `_layout` segments:
`apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx`

### Import shape

ESM, double-quoted, `@/` alias for `apps/web/src` and `@i18n` for the repo-root `i18n/` directory (aliased in both `vitest.config.ts` and the Vite config). Workspace packages import by name (`@kaneo/libs`, `@kaneo/permissions`). Type-only imports use `import type`. Biome sorts imports: external packages first, then aliased internals alphabetically.

```ts
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import BoardToolbar from "@/components/board/board-toolbar";
import { useTaskFiltersWithLabelsSupport } from "@/hooks/use-task-filters-with-labels-support";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
```

Export style is mixed and follows local precedent: components and simple hooks often `export default`, while hooks with companion types tend to use named exports (`export function useUpdateTask()`, `export function useTaskFilters()`). Match whatever the sibling files in the target directory do.

### Route shape (framework-owned wiring)

Routes register **by file location**. `@tanstack/router-plugin` regenerates `apps/web/src/routeTree.gen.ts` — that file is generated (`@ts-nocheck`), Biome-ignored, and must never be hand-edited. Adding a route means adding a file; adding a search param means extending `validateSearch`.

From `.../project/$projectId/board.tsx` — note that today the board only validates `taskId`, which is precisely the extension point for URL-persisted filters:

```tsx
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
  // ...
}
```

`validateSearch` is **hand-written narrowing, not a zod schema** — even though `zod` is a dependency, the routes parse `Record<string, unknown>` manually. Navigation updates search state via `navigate({ to: ".", search: {…}, replace: true })`.

### Data-fetch shape — three layers, never collapsed

**1. Fetcher** (`apps/web/src/fetchers/<domain>/<verb>-<noun>.ts`) — the only place a network call happens, always through the typed `@kaneo/libs` client. Default export, throws `Error(await response.text())` on non-ok.

```ts
import { client } from "@kaneo/libs";

async function getTasks(projectId: string) {
  const response = await client.task.tasks[":projectId"].$get({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const json = await response.json();

  return json.data;
}

export default getTasks;
```

**2. Query hook** (`apps/web/src/hooks/queries/<domain>/use-get-<noun>.ts`) — thin `useQuery` wrapper. Query keys are plain string-tuples: `["task", taskId]`, `["tasks", projectId]`.

```ts
import { useQuery } from "@tanstack/react-query";
import getTask from "@/fetchers/task/get-task";

function useGetTask(taskId: string) {
  return useQuery({
    queryKey: ["task", taskId],
    queryFn: () => getTask(taskId),
    enabled: Boolean(taskId),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export default useGetTask;
```

**3. Mutation hook** (`apps/web/src/hooks/mutations/<domain>/use-<verb>-<noun>.ts`) — explicit, exhaustive `invalidateQueries` in `onSuccess`. There is no optimistic-update convention; invalidation is the pattern.

```ts
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (task: Task) => updateTask(task.id, task),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["task", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      // …one call per affected key
    },
  });
}
```

Per `AGENTS.md`: never create a parallel untyped request layer; all requests go in `fetchers/` and all server state through TanStack Query.

### Client-state / feature-hook shape

Domain logic lives in a `use-*.ts` hook that owns a plain `type` (not `interface`), a `DEFAULT_*` constant, a `normalizeFilters`-style defensive parser for untrusted persisted input, and derived values via `useMemo`. From `use-task-filters.ts`:

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

const DEFAULT_FILTERS: BoardFilters = { status: null, priority: null, /* … */ };

function normalizeFilters(raw: unknown): BoardFilters {
  if (!raw || typeof raw !== "object") return DEFAULT_FILTERS;
  const candidate = raw as Partial<Record<keyof BoardFilters, unknown>>;
  const normalized = { ...DEFAULT_FILTERS };
  for (const key of FILTER_KEYS) {
    const value = candidate[key];
    if (Array.isArray(value)) {
      const values = value.filter((v): v is string => typeof v === "string");
      normalized[key] = values.length > 0 ? values : null;
    }
  }
  return normalized;
}
```

Two idioms to preserve: **empty means `null`, not `[]`**, and unknown input is narrowed with a type-predicate filter rather than a schema.

Cross-component client state is Zustand (`apps/web/src/store/*.ts`), consumed with a selector — `useUserPreferencesStore((state) => state.weekStartsOn)` — or destructured whole when the component needs several fields.

### Component shape

Function components, props typed as a local `type` (the repo prefers `type` over `interface` per `AGENTS.md`), Tailwind utility classes inline with `cn`/`clsx` + `tailwind-merge` for conditionals. Local sub-types are declared at the top of the file rather than pulled into `types/`:

```tsx
type WorkspaceLabel = {
  id: string;
  name: string;
  color: string;
};
```

All user-facing copy goes through `react-i18next`: `const { t } = useTranslation();` then `t("tasks:boardSearchPlaceholder")` — namespaced keys, `i18n/en-US.json` is the source of truth and other locales are siblings in `i18n/`. Never inline a literal string into JSX that a user will read.

### Test shape

Vitest 4, jsdom, `@testing-library/react`, setup file at `apps/web/src/test/setup.ts`, include glob `src/**/*.test.{ts,tsx}`. Explicit imports from `vitest` (no globals). `describe` / `it`, `renderHook` + `waitFor` + `act` for hooks, behaviour-named test titles, and real `window.localStorage` manipulation rather than mocks.

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useBoardSort } from "./use-board-sort";

describe("useBoardSort", () => {
  const storageKey = "kaneo:board-sort:project-1";

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("falls back to the default sort when stored JSON is invalid", async () => {
    window.localStorage.setItem(storageKey, "not-json{");
    const { result } = renderHook(() => useBoardSort("project-1"));
    await waitFor(() => {
      expect(result.current.sort).toEqual({ field: "position", direction: "asc" });
    });
  });
});
```

Note the malformed-input test: this repo consistently tests the corrupt-persisted-state path alongside the happy path. New persistence code is expected to carry that test.

Run with `pnpm --filter @kaneo/web test`. API tests live in the repo-root `tests/api` (unit) and `tests/api-integration` (PostgreSQL-backed), wired by `apps/api/vitest.config.ts` and `vitest.integration.config.ts`.

### Config

Web config is Vite env vars only, accessed as `import.meta.env.VITE_*` (`VITE_API_URL`, `VITE_CLIENT_URL`, `VITE_SENTRY_DSN`, `VITE_TURNSTILE_SITE_KEY`), with `.env.development` / `.env.production` committed and containing only public values. There is a small `apps/web/src/env.test.ts`, so env resolution is itself tested. Server env comes from the root `.env` via `dotenv-mono`; see `ENVIRONMENT_SETUP.md`.

### Data layer (API side)

Drizzle ORM against PostgreSQL. Schema in `apps/api/src/database/schema.ts`, relations in `apps/api/src/database/relations.ts`. Migrations are **generated**, never hand-written: `pnpm --filter @kaneo/api db:generate`, then inspect the emitted SQL under `apps/api/drizzle/` and commit it with the schema change. API input validation is Valibot (not zod) with `HTTPException` for expected failures, and every public route carries OpenAPI metadata.

## Sample files inspected

- `apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx` (route / target surface, 268 lines)
- `apps/web/src/components/board/board-toolbar.tsx` (component, 676 lines — header only)
- `apps/web/src/hooks/use-task-filters.ts` (feature hook, 212 lines)
- `apps/web/src/hooks/queries/task/use-get-task.ts` (query hook)
- `apps/web/src/hooks/mutations/task/use-update-task.ts` (mutation hook)
- `apps/web/src/fetchers/task/get-tasks.ts` (fetcher)
- `apps/web/src/hooks/use-board-sort.test.tsx` (test)
- `apps/web/vitest.config.ts`, `biome.json`, `turbo.json`, `pnpm-workspace.yaml` (config)
- `apps/api/package.json`, `packages/libs/package.json` (stack confirmation)

Files over 500 lines were read header-only; no fixtures, snapshots or generated files were sampled.

## Notes for downstream codegen

- **kebab-case filenames, always.** `board-filter-chips.tsx`, not `BoardFilterChips.tsx`.
- **2-space indent, double quotes, in `.ts`/`.tsx`.** Biome will reformat anything else and the pre-commit hook runs `biome ci .`, which fails rather than fixes.
- **Never touch `apps/web/src/routeTree.gen.ts`** — regenerate by running the dev server or build.
- **`validateSearch` is hand-rolled narrowing.** Follow the existing `typeof search.x === "string" ? … : undefined` idiom rather than introducing a zod schema into the route, unless you're deliberately changing the convention.
- **Empty filter = `null`, not `[]`.** `BoardFilters` already encodes `assignee: string[] | null` and `labels: string[] | null`.
- **Board filter state currently lives in a Zustand store, not the URL.** URL persistence work means widening `BoardSearchParams` and reconciling with `useTaskFilters` / `useTaskFiltersWithLabelsSupport` and `useUserPreferencesStore` — decide explicitly which is the source of truth rather than letting both write.
- **All user-visible strings go through `t("namespace:key")`** with the key added to `i18n/en-US.json`.
- **New hooks get a sibling `*.test.tsx`**, including a malformed/corrupt-input case if the hook parses persisted state.
- **Prefer `type` over `interface`** and prefer inferred types (an `AGENTS.md` rule).
- **Don't add a fetch call outside `apps/web/src/fetchers/`**, and don't bypass `@kaneo/libs`.
- **Scope discipline:** `AGENTS.md` forbids mixing requested work with speculative refactors, and forbids committing/pushing/opening a PR unless explicitly asked.

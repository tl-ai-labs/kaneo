# Stack profile — learned from repo scan

Built 2026-09-04 from `5d1fc910`. Scope emphasis: `apps/web` (the surface for the current run).
**This profile is authoritative** where it conflicts with a pre-authored adapter fragment.

## Language & runtime

TypeScript 7.0.2, ESM throughout (`"type": "module"` at root). Node ≥ 20.19, pnpm 10.32.1,
Turborepo task graph. Formatter/linter is Biome 2.5.7 (2-space indent, double quotes,
trailing commas, semicolons, import sorting enforced). `apps/web` splits typecheck across
`tsconfig.app.json` and `tsconfig.node.json` — both must pass.

## Framework

- `apps/web` — React 19 + Vite + **TanStack Router (file-based routes, generated `routeTree.gen.ts`)** +
  TanStack Query for all server state. Zustand for client stores, react-i18next for copy,
  Tailwind + Radix/Base UI primitives.
- `apps/api` — Hono + Better Auth + Drizzle ORM + Valibot.
- `apps/site` — Next.js (marketing/docs host, separate concern).

No pre-authored adapter matches this; treat the snippets below as the pattern source.

## Conventions detected

### File naming

Strictly **kebab-case** files, one concern per file, `index.tsx` as the folder barrel.

- `src/components/board/board-toolbar.tsx`
- `src/hooks/use-task-filters-with-labels-support.ts`
- `src/hooks/queries/label/use-get-labels-by-workspace.ts`
- `src/fetchers/column/update-column.ts`
- `src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx`

Hooks are `use-<thing>.ts(x)`; tests sit **beside** the file as `<name>.test.ts(x)` (no `__tests__/`).
Route files mirror the URL path literally, with `$param` segments and `_layout` / `_authenticated`
pathless layout prefixes.

### Route shape (TanStack Router)

Search params are hand-validated with plain `typeof` guards — **no zod/valibot in web route schemas**:

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

Params/search are read off `Route.useParams()` / `Route.useSearch()`, not the global hooks.
Navigation to clear a param uses relative `to: "."`:

```tsx
navigate({ to: ".", search: {}, replace: true });
```

Note this idiom **replaces the whole search object** — extending search state requires
spreading the previous search rather than passing `{}`.

### Component shape

Function components, `export default` for the main component, named local helpers above it.
Props are a `type` alias named `<Component>Props` (never `interface` — AGENTS.md prefers `type`).
Styling is inline Tailwind class strings with template-literal conditionals; `cn()` exists in
`src/lib/cn.ts` but toolbars in this area use plain template literals.

```tsx
type ActiveFilterChipProps = {
  subject: string;
  operator: string;
  value: ReactNode;
  onClear: () => void;
};

function ActiveFilterChip({ subject, operator, value, onClear }: ActiveFilterChipProps) {
  return (
    <div className="inline-flex h-7 items-center rounded-md border border-border bg-background text-xs shadow-xs">
      <span className="px-2 font-medium text-foreground">{subject}</span>
      <span className="h-full w-px bg-border" />
      <span className="px-2 text-foreground/80">{operator}</span>
      {/* ... */}
      <button
        className="inline-flex h-full w-7 items-center justify-center rounded-r-md text-foreground/70 hover:bg-accent/70"
        onClick={onClear}
        type="button"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function BoardToolbar({ project, filters, updateFilter, /* ... */ }: BoardToolbarProps) { }
```

Every `<button>` carries an explicit `type="button"`. Icons come from `lucide-react`.

### Data layer — fetchers + query/mutation hooks

Three strict layers, never collapsed: `fetchers/` (typed `@kaneo/libs` client calls) →
`hooks/queries/` and `hooks/mutations/` (TanStack Query) → components.

Query hooks are `function` declarations with a trailing `export default`:

```ts
import { useQuery } from "@tanstack/react-query";
import getLabelsByWorkspace from "@/fetchers/label/get-label-by-workspace";

function useGetLabelsByWorkspace(workspaceId: string) {
  return useQuery({
    enabled: Boolean(workspaceId),
    queryKey: ["labels", workspaceId],
    queryFn: () => getLabelsByWorkspace({ workspaceId }),
  });
}

export default useGetLabelsByWorkspace;
```

Mutation hooks are **named** exports and always invalidate explicitly:

```ts
export function useUpdateColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; projectId: string; data: { name?: string } }) =>
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

Query keys are flat tuples: `["labels", workspaceId]`, `["tasks", projectId]`, `["columns", projectId]`.

### Local/persisted state hooks

The house pattern for persisted view state: `useState` + a load `useEffect` + a write `useEffect`,
with a defensive `normalize*` function and explicit type guards. Copy this shape.

```ts
function isSortField(value: unknown): value is SortField {
  return SORT_FIELDS.includes(value as SortField);
}

function normalizeSort(value: unknown): SortConfig {
  if (!value || typeof value !== "object") return DEFAULT_SORT;
  const candidate = value as Partial<Record<keyof SortConfig, unknown>>;
  if (!isSortField(candidate.field) || !isSortDirection(candidate.direction)) return DEFAULT_SORT;
  return { field: candidate.field, direction: candidate.direction };
}

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

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(sort));
    } catch {
      // persistence is best-effort; private mode or quota can block writes
    }
  }, [sort, storageKey]);

  return { sort, setSort };
}
```

Storage keys are namespaced `kaneo:<feature>:<scopeId>`. Filter state uses
`kaneo:board-filters:${projectId}`; sort uses `kaneo:board-sort:${projectId}`.

Filter hooks return a fixed object surface — `{ filters, setFilters, updateFilter,
updateLabelFilter, filteredProject, hasActiveFilters, clearFilters }`. Preserve that shape when
changing the persistence backend, or every consumer breaks.

### Test shape

Vitest + Testing Library, jsdom, `describe`/`it`, explicit imports from `vitest` (no globals).
Setup file is one line: `import "@testing-library/jest-dom/vitest";`. Hook tests use
`renderHook` + `act` + `waitFor`, and deliberately cover the corrupt-input path.

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useBoardSort } from "./use-board-sort";

describe("useBoardSort", () => {
  const storageKey = "kaneo:board-sort:project-1";

  beforeEach(() => { window.localStorage.clear(); });
  afterEach(() => { window.localStorage.clear(); });

  it("falls back to the default sort when stored JSON is invalid", async () => {
    window.localStorage.setItem(storageKey, "not-json{");
    const { result } = renderHook(() => useBoardSort("project-1"));
    await waitFor(() => {
      expect(result.current.sort).toEqual({ field: "position", direction: "asc" });
    });
  });
});
```

Run with `pnpm --filter @kaneo/web test`. Include glob is `src/**/*.test.{ts,tsx}`.

### Config & i18n

All user-facing copy goes through `react-i18next` with **static** namespaced keys —
`t("tasks:boardFilters.subjects.assignee")`, `t("common:actions.filter")`. Never build a key
by interpolation at the top level, and never inline English strings in JSX.

`i18n/en-US.json` is the reference locale across 11 namespaces
(`common, auth, settings, navigation, notifications, activity, tasks, invitations, workspace, team, publicProject`),
registered in `i18n/resources.ts` for 17 locales. `i18n/schema.json` is **generated** with
`additionalProperties: false`, so a new key invalidates it until you run `pnpm i18n:schema`.
Never run `pnpm i18n:check:fix`.

### Framework-owned wiring

- **Routes register by file placement.** Adding `src/routes/.../foo.tsx` with a `createFileRoute`
  export is the whole registration step; `@tanstack/router-plugin` regenerates
  `src/routeTree.gen.ts` at dev/build time. **Never hand-edit `routeTree.gen.ts`** — it carries
  `@ts-nocheck` and an explicit do-not-edit header.
- Path aliases: `@/` → `apps/web/src`, `@i18n` → repo-root `i18n/` (declared in both
  `vite.config.ts` and `vitest.config.ts`).
- API calls must go through the typed client from `@kaneo/libs`; do not create a parallel
  untyped request layer.

## Sample files inspected

- `apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx` (route)
- `apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/backlog.tsx` (route)
- `apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/gantt.tsx` (route)
- `apps/web/src/components/board/board-toolbar.tsx` (component)
- `apps/web/src/hooks/use-task-filters.ts` (hook)
- `apps/web/src/hooks/use-task-filters-with-labels-support.ts` (hook)
- `apps/web/src/hooks/use-board-sort.ts` (hook)
- `apps/web/src/hooks/queries/label/use-get-labels-by-workspace.ts` (query hook)
- `apps/web/src/hooks/mutations/column/use-update-column.ts` (mutation hook)
- `apps/web/src/hooks/use-board-sort.test.tsx` (test)
- `apps/web/src/test/setup.ts` (test config)
- `apps/web/vitest.config.ts` (test config)
- `i18n/en-US.json`, `i18n/resources.ts`, `scripts/i18n/schema.mjs` (i18n)
- `apps/web/src/routeTree.gen.ts` (generated — inspected header only)

## Notes for downstream codegen

- Emit kebab-case filenames; colocate tests as `<name>.test.tsx` next to the source.
- Use `type` aliases, never `interface`. Prefer inferred types.
- Default-export the primary component; named-export helpers and mutation hooks; default-export query hooks.
- Every `<button>` needs `type="button"`. Icons from `lucide-react` at `h-3.5 w-3.5` / `h-4 w-4` in toolbars.
- For search-param work: hand-rolled `typeof` guards in `validateSearch`, mirroring the
  `normalizeSort` defensive style. Do not add zod/valibot to `apps/web` routes.
- Watch `navigate({ to: ".", search: {} })` call sites — they clobber all search state.
- Never touch `src/routeTree.gen.ts`, `i18n/schema.json`, or non-`en-US` locale files.
- Any new `en-US.json` key must be followed by `pnpm i18n:schema`.
- Verify with `pnpm --filter @kaneo/web test` and `pnpm --filter @kaneo/web typecheck`.
  Lint with `biome ci`, never the `lint` script (it is `biome check --write` and rewrites files).
- AGENTS.md forbids mixing requested work with speculative refactors — resist tidying the
  duplicate `use-task-filters.ts` / `use-task-filters-with-labels-support.ts` pair unless asked.

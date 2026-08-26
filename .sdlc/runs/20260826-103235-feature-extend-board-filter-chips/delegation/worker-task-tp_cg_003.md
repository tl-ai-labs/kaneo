## Task tp_cg_003 — codegen / existing_file_edit
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Wire the board route to URL-persisted filters. Open the file first; only the parts below change.

File: apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx

1. Import from `@/lib/board-filter-params`: `validateBoardSearch`, `filtersToSearchParams`, and the type `BoardSearchParams`. Import the type `BoardFilters` from `@/hooks/use-task-filters`.

2. DELETE the local `type BoardSearchParams = { taskId?: string }` declaration (the imported one replaces it) and change the route's `validateSearch` to:
```ts
validateSearch: (search: Record<string, unknown>): BoardSearchParams => validateBoardSearch(search),
```

3. In `RouteComponent`, replace `const { taskId } = Route.useSearch();` with:
```ts
const search = Route.useSearch();
const { taskId } = search;
```

4. Add, near the other useCallbacks:
```ts
const handleFiltersChange = useCallback(
  (next: BoardFilters) => {
    navigate({
      to: ".",
      search: (prev) => ({ ...prev, ...filtersToSearchParams(next) }),
      replace: true,
    });
  },
  [navigate],
);
```
This is the ONLY place `replace: true` is used for a filter change.

5. Change the hook call to pass the two new arguments:
```ts
} = useTaskFiltersWithLabelsSupport(project, projectId, boardSearchQuery, search, handleFiltersChange);
```

6. Change `handleCloseTaskSheet` from `search: {}` to a functional updater that drops ONLY taskId and preserves every other param:
```ts
navigate({
  to: ".",
  search: (prev) => { const { taskId: _omit, ...rest } = prev; return rest; },
  replace: true,
});
```
Keep `replace: true` here — it is pre-existing behaviour.

7. Change NOTHING else. The BoardToolbar props stay exactly as they are. The two `navigate({ to: "/dashboard/workspace/$workspaceId/project/$projectId/gantt" })` and `.../backlog` shortcut navigations are out of scope — leave them.

If TypeScript complains about the `prev` parameter of a functional search updater, type it explicitly rather than deleting the updater.

SCOPE — you may modify EXACTLY ONE file: the board.tsx named above. Do not touch the hook, the lib file, any component, or any test. Do not run the test suite. Do not run biome, prettier, eslint or `pnpm lint`.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/lib/board-filter-params.ts
_Included because: Helper signatures created earlier in this run._

```
export type BoardSearchParams = { taskId?: string; status?: string[]; priority?: string[]; assignee?: string[]; dueDate?: string[]; labels?: string[] };
export function validateBoardSearch(search: Record<string, unknown>): BoardSearchParams;
export function filtersToSearchParams(filters: BoardFilters): Partial<BoardSearchParams>;
```

#### apps/web/src/hooks/use-task-filters-with-labels-support.ts
_Included because: The hook's new signature, already updated by the previous packet. Note the two new trailing parameters._

```
export function useTaskFiltersWithLabelsSupport(
  project: ProjectWithTasks | null | undefined,
  projectId?: string,
  textQuery?: string,
  searchFilters?: BoardSearchParams,
  onFiltersChange?: (next: BoardFilters) => void,
)
```

#### apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx
_Included because: The four regions that change. Open the real file for the rest._

```
type BoardSearchParams = { taskId?: string };   // DELETE, import instead

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): BoardSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

// in RouteComponent:
const { taskId } = Route.useSearch();

const handleCloseTaskSheet = useCallback(() => {
  navigate({ to: ".", search: {}, replace: true });
}, [navigate]);

const {
  filters, updateFilter, updateLabelFilter, filteredProject, hasActiveFilters, clearFilters,
} = useTaskFiltersWithLabelsSupport(project, projectId, boardSearchQuery);
```
### Acceptance criteria
- The local BoardSearchParams type is gone and the type is imported from @/lib/board-filter-params
- validateSearch delegates to validateBoardSearch
- handleFiltersChange navigates with a functional search updater and replace: true
- The hook is called with (project, projectId, boardSearchQuery, search, handleFiltersChange)
- handleCloseTaskSheet drops only taskId and preserves all other search params
- BoardToolbar's props are byte-identical to before
- files_written contains exactly one path
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "artifact_path": {
      "type": "string"
    },
    "validate_search_now": {
      "type": "string"
    },
    "hook_call_now": {
      "type": "string"
    },
    "close_sheet_now": {
      "type": "string"
    },
    "boardtoolbar_props_unchanged": {
      "type": "boolean"
    },
    "files_written": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "artifact_path",
    "validate_search_now",
    "hook_call_now",
    "close_sheet_now",
    "boardtoolbar_props_unchanged",
    "files_written"
  ]
}
```
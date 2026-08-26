## Task tp_cg_002 — codegen / existing_file_edit
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Rework apps/web/src/hooks/use-task-filters-with-labels-support.ts so the URL is the SOLE SOURCE OF TRUTH for filter state. Open the file first; most of it is unchanged.

1. SIGNATURE — append two optional params, keep the existing three exactly where they are:
```ts
export function useTaskFiltersWithLabelsSupport(
  project: ProjectWithTasks | null | undefined,
  projectId?: string,
  textQuery?: string,
  searchFilters?: BoardSearchParams,
  onFiltersChange?: (next: BoardFilters) => void,
)
```
Import `BoardSearchParams`, `searchParamsToFilters`, `hasActiveFilterParams` from `@/lib/board-filter-params`.

2. DELETE the `useState<BoardFilters>` and BOTH existing useEffects. Derive instead:
```ts
const filters = useMemo(() => searchParamsToFilters(searchFilters ?? null), [searchFilters]);
```
There must be no React state owning filters and no isInitializedRef.

3. SEED effect — runs ONLY when `hasActiveFilterParams(searchFilters)` is FALSE. One-shot per storageKey via `const seededStorageKeyRef = useRef<string | null>(null)`. Return early if `!storageKey` or `seededStorageKeyRef.current === storageKey`. Otherwise set `seededStorageKeyRef.current = storageKey`, read `window.localStorage.getItem(storageKey)`, JSON.parse it inside try/catch, normalize with the existing `normalizeFilters`, and if the result has any non-empty array call `onFiltersChange?.(stored)`. Never call navigate.

4. SYNC-BACK effect — runs ONLY when `hasActiveFilterParams(searchFilters)` is TRUE: `window.localStorage.setItem(storageKey, JSON.stringify(filters))`. Because 3 and 4 test opposite branches of the same predicate they can never both fire.

5. There must be NO effect keyed on `filters` that writes localStorage. Delete it. Instead `updateFilter`, `updateLabelFilter` and `clearFilters` each compute `next`, call `window.localStorage.setItem(storageKey, JSON.stringify(next))` when storageKey is set, then call `onFiltersChange?.(next)`. `setFilters` stays in the returned object for API compatibility but is now a no-op-ish shim that computes the next value from `filters` and routes it through the same persist-and-notify path.

6. Guard every localStorage access with `typeof window === "undefined"` as today. The hook must NOT import or call useNavigate or any router hook.

7. `filterTasks`, `filteredProject`, `hasActiveFilters`, and the whole due-date/label matching body are UNCHANGED. Keep `DEFAULT_FILTERS`, `FILTER_KEYS` and `normalizeFilters` in this file exactly as they are — do NOT deduplicate them against use-task-filters.ts.

SCOPE — you may modify EXACTLY ONE file: apps/web/src/hooks/use-task-filters-with-labels-support.ts. Do not touch use-task-filters.ts, board.tsx, the test files, or anything else. Do not run the test suite. Do not run biome, prettier, eslint or `pnpm lint`.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/lib/board-filter-params.ts
_Included because: Created by the previous packet. These are the exact helper signatures to import._

```
export type BoardSearchParams = { taskId?: string; status?: string[]; priority?: string[]; assignee?: string[]; dueDate?: string[]; labels?: string[] };
export function validateBoardSearch(search: Record<string, unknown>): BoardSearchParams;
export function filtersToSearchParams(filters: BoardFilters): Partial<BoardSearchParams>;
export function searchParamsToFilters(params: BoardSearchParams | undefined | null): BoardFilters;
export function hasActiveFilterParams(params: Partial<BoardSearchParams> | undefined | null): boolean;
```

#### apps/web/src/hooks/use-task-filters-with-labels-support.ts
_Included because: The two effects to delete and the useState to remove. Everything below filterTasks stays as it is — open the real file for the full body._

```
const storageKey = projectId ? `kaneo:board-filters:${projectId}` : null;
const [filters, setFilters] = useState<BoardFilters>(DEFAULT_FILTERS);   // DELETE

useEffect(() => {   // DELETE — restore-from-localStorage
  if (!storageKey || typeof window === "undefined") return;
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) { setFilters(DEFAULT_FILTERS); return; }
    setFilters(normalizeFilters(JSON.parse(stored) as unknown));
  } catch { setFilters(DEFAULT_FILTERS); }
}, [storageKey]);

useEffect(() => {   // DELETE — unconditional mirror, this is the clobber
  if (!storageKey || typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(filters));
}, [filters, storageKey]);

const clearFilters = () => { setFilters(DEFAULT_FILTERS); };
const updateFilter = (key: keyof BoardFilters, value: BoardFilters[keyof BoardFilters]) => {
  setFilters((prev) => ({ ...prev, [key]: value }));
};
const updateLabelFilter = (labelId: string) => {
  setFilters((prev) => {
    const currentLabels = prev.labels || [];
    const isSelected = currentLabels.includes(labelId);
    let newLabels: string[] | null;
    if (isSelected) { newLabels = currentLabels.filter((id) => id !== labelId); if (newLabels.length === 0) newLabels = null; }
    else { newLabels = [...currentLabels, labelId]; }
    return { ...prev, labels: newLabels };
  });
};

return { filters, setFilters, updateFilter, updateLabelFilter, filteredProject, hasActiveFilters, clearFilters };
```
### Acceptance criteria
- The hook signature is (project, projectId?, textQuery?, searchFilters?, onFiltersChange?) in that order
- No useState holds filter state and there is no isInitializedRef
- filters is derived via useMemo from searchFilters
- The seed effect runs only when hasActiveFilterParams(searchFilters) is false and is one-shot per storageKey
- The sync-back effect runs only when hasActiveFilterParams(searchFilters) is true
- No effect keyed on filters writes to localStorage
- updateFilter, updateLabelFilter and clearFilters each persist to localStorage and call onFiltersChange
- The hook imports no router hook and never calls navigate
- DEFAULT_FILTERS, FILTER_KEYS and normalizeFilters remain declared in this file, undeduplicated
- filterTasks, filteredProject and hasActiveFilters are behaviourally unchanged
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
    "signature": {
      "type": "string"
    },
    "usestate_removed": {
      "type": "boolean"
    },
    "effects_now": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "one entry per useEffect remaining in the hook, describing its condition"
    },
    "calls_router": {
      "type": "boolean",
      "description": "must be false"
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
    "signature",
    "usestate_removed",
    "effects_now",
    "calls_router",
    "files_written"
  ]
}
```
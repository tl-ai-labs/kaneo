## Task tp_dbg_003 — debug / existing_file_edit
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
FIX A BLOCKER REGRESSION found in senior review.

THE BUG. Before this run, the hook's mutators used functional state updates:
```ts
setFilters((prev) => ({ ...prev, [key]: value }));
```
so N calls made in ONE event handler composed — each saw the previous one's result. The rework replaced that with values computed from the render-scoped `filters` memo:
```ts
const next: BoardFilters = { ...filters, [key]: value };   // `filters` is fixed for this render
```
Now N calls in one handler ALL compute from the SAME base, so only the last survives.

THIS IS NOT THEORETICAL. apps/web/src/components/board/board-toolbar.tsx calls the mutators in loops:
```ts
const clearLabelFilters = () => {
  if (!filters.labels || filters.labels.length === 0) return;
  for (const labelId of filters.labels) updateLabelFilter(labelId);   // line ~251
};
```
and `toggleLabelGroup` (line ~239) likewise calls `updateLabelFilter(l.id)` once per matching label. With three labels selected, "clear label filters" today removes only ONE. That regresses shipped behaviour.

THE FIX — in apps/web/src/hooks/use-task-filters-with-labels-support.ts, make consecutive mutations compose without reintroducing filter-owning state:
1. Add `const pendingFiltersRef = useRef<BoardFilters | null>(null);`
2. Add an effect that clears it whenever the derived filters change (the URL has settled):
   `useEffect(() => { pendingFiltersRef.current = null; }, [filters]);`
3. Add `const currentFilters = () => pendingFiltersRef.current ?? filters;`
4. In `persistAndNotify(next)`, set `pendingFiltersRef.current = next;` BEFORE writing localStorage and calling `onFiltersChange?.(next)`.
5. Change `updateFilter`, `updateLabelFilter` and `setFilters` to read `currentFilters()` instead of `filters` when computing `next`. `clearFilters` still uses DEFAULT_FILTERS.
Do NOT reintroduce useState for filters. `filters` must still be derived by useMemo from searchFilters — the ref is a within-tick accumulator only, never the source of truth.

THEN ADD A REGRESSION TEST to apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx:
- mount with `searchFilters={{ labels: ["a", "b", "c"] }}` and an onFiltersChange spy;
- inside a single `act(...)`, call `updateLabelFilter("a")`, then `updateLabelFilter("b")`, then `updateLabelFilter("c")` — exactly what clearLabelFilters does;
- assert the LAST onFiltersChange call received `labels: null` (all three removed), NOT `["a","b"]` or similar.
- add a second case: two successive `updateFilter` calls on DIFFERENT keys in one act() both survive in the final call.
Name them so it is obvious they guard the toolbar's loop handlers.

AFTER EDITING run BOTH and confirm both succeed:
  `pnpm --filter @kaneo/web test`        (all test files pass)
  `pnpm --filter @kaneo/web typecheck`   (exit 0)

SCOPE — you may modify EXACTLY these two files:
  apps/web/src/hooks/use-task-filters-with-labels-support.ts
  apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx
Do NOT modify board-toolbar.tsx — its props and behaviour must stay exactly as they are; the hook is what adapts. Do not touch any other file. Do NOT run biome, prettier, eslint, `pnpm lint` or `pnpm i18n:check:fix`.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/hooks/use-task-filters-with-labels-support.ts
_Included because: The mutators to change. Note they all read the render-scoped `filters`, which is the bug._

```
  const persistAndNotify = (next: BoardFilters) => {
    if (storageKey && typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    }
    onFiltersChange?.(next);
  };

  const setFilters = (nextOrUpdater: BoardFilters | ((prev: BoardFilters) => BoardFilters)) => {
    const next = typeof nextOrUpdater === "function" ? nextOrUpdater(filters) : nextOrUpdater;
    persistAndNotify(next);
  };

  const clearFilters = () => { persistAndNotify(DEFAULT_FILTERS); };

  const updateFilter = (key: keyof BoardFilters, value: BoardFilters[keyof BoardFilters]) => {
    const next: BoardFilters = { ...filters, [key]: value };   // BUG: render-scoped `filters`
    persistAndNotify(next);
  };

  const updateLabelFilter = (labelId: string) => {
    const currentLabels = filters.labels || [];              // BUG: render-scoped `filters`
    const isSelected = currentLabels.includes(labelId);
    let newLabels: string[] | null;
    if (isSelected) {
      newLabels = currentLabels.filter((id) => id !== labelId);
      if (newLabels.length === 0) newLabels = null;
    } else {
      newLabels = [...currentLabels, labelId];
    }
    persistAndNotify({ ...filters, labels: newLabels });     // BUG: render-scoped `filters`
  };
```

#### apps/web/src/components/board/board-toolbar.tsx
_Included because: The two loop handlers that break. READ ONLY — you must not modify this file._

```
  const toggleLabelGroup = (...) => {
    const anySelected = matching.some((l) => filters.labels?.includes(l.id));
    for (const l of matching) {
      if ((anySelected && filters.labels?.includes(l.id)) ||
          (!anySelected && !filters.labels?.includes(l.id))) {
        updateLabelFilter(l.id);        // called N times in ONE handler
      }
    }
  };

  const clearLabelFilters = () => {
    if (!filters.labels || filters.labels.length === 0) return;
    for (const labelId of filters.labels) updateLabelFilter(labelId);   // N times in ONE handler
  };
```
### Acceptance criteria
- Three successive updateLabelFilter calls in one act() remove all three labels, ending with labels null
- Two successive updateFilter calls on different keys in one act() both survive
- filters is still derived via useMemo from searchFilters; no useState owns filter state
- board-toolbar.tsx is NOT modified
- pnpm --filter @kaneo/web typecheck exits 0
- The whole suite passes
- files_written lists only the hook and its test file
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "typecheck_exit_code": {
      "type": "integer"
    },
    "test_files_passing": {
      "type": "integer"
    },
    "tests_passing": {
      "type": "integer"
    },
    "regression_tests_added": {
      "type": "integer"
    },
    "usestate_reintroduced": {
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
    "typecheck_exit_code",
    "test_files_passing",
    "tests_passing",
    "regression_tests_added",
    "usestate_reintroduced",
    "files_written"
  ]
}
```
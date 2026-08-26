## Task tp_cg_009 — tests / test_backfill
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Rework apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx for the URL-as-source-of-truth hook. READ the hook at apps/web/src/hooks/use-task-filters-with-labels-support.ts FIRST — its signature is now:
`useTaskFiltersWithLabelsSupport(project, projectId?, textQuery?, searchFilters?, onFiltersChange?)`.
The hook calls NO router hook, so `renderHook` needs NO router provider. Keep it that way.

THE TWO EXISTING TESTS ARE NOT EQUALLY PORTABLE:
(a) The `it.each(["#123", "proj-123", "proj-"])` issue-identifier test passes only (project, "project-1", textQuery) and touches no localStorage. KEEP IT EXACTLY AS IT IS. It must still pass byte-identical.
(b) The `"restores persisted label filters from storage and matches tasks from project data"` test currently seeds localStorage, mounts with (project, "project-1"), and asserts `result.current.filters.labels` equals `["label-bug"]`. It CURRENTLY FAILS and cannot pass as written — under the new design filters come from `searchFilters`, and localStorage is published to the URL through `onFiltersChange` instead of into hook state. REWRITE it as two tests:
  - seed localStorage with `{ labels: ["label-bug"] }`, mount with an `onFiltersChange` vi.fn() and no searchFilters, and assert the spy was called with an object whose `labels` is `["label-bug"]`.
  - mount with `searchFilters={{ labels: ["label-bug"] }}` and assert `result.current.filters.labels` is `["label-bug"]` AND `filteredProject.columns[0].tasks` has length 1 and is `task-1`. Reuse the existing project fixture.

THEN ADD:
1. Filters derive SYNCHRONOUSLY from searchFilters — assert on the first render result with no `waitFor`.
2. URL PRECEDENCE (must fail against the old hook): localStorage holds `{status:["todo"]}`, mount with `searchFilters={{status:["in_progress"]}}`; assert `result.current.filters.status` is `["in_progress"]` AND that localStorage for `kaneo:board-filters:project-1` now parses to a `status` of `["in_progress"]`.
3. SEED IS ONE-SHOT: localStorage populated, no active searchFilters, mount; assert `onFiltersChange` was called exactly once. Rerender with the same props and assert it is STILL exactly once.
4. EMPTY PARAM: mount with `searchFilters={{ status: [] }}` (the normalized form of `?status=`) and localStorage populated; assert the seed still fired, i.e. an empty array does not count as "the URL carries filters".
5. MUTATIONS PERSIST AND NOTIFY: for `updateFilter("status", ["todo"])`, `updateLabelFilter("label-bug")` and `clearFilters()`, assert each writes localStorage AND calls `onFiltersChange` with the next filters. Wrap state-changing calls in `act(...)`.

Use `vi.fn()` from vitest. Clear localStorage in beforeEach/afterEach as the file already does. NEVER assert `expect.any(Function)`.

AFTER WRITING, run `pnpm --filter @kaneo/web test src/hooks/use-task-filters-with-labels-support.test.tsx` and iterate until ALL tests in this file pass. Report final counts.

SCOPE — you may modify EXACTLY ONE file: apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx. Do NOT modify the hook itself — if you think it has a bug, leave it and describe it in `implementation_bugs_found`. Do not touch any other file. The only non-read-only command you may run is the scoped vitest command above. Do NOT run biome, prettier, eslint, `pnpm lint` or `pnpm i18n:check:fix`.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/hooks/use-task-filters-with-labels-support.ts
_Included because: The reworked hook these tests target. Note the seed fires only when the URL has no active filters, and the sync-back only when it does._

```
export function useTaskFiltersWithLabelsSupport(
  project: ProjectWithTasks | null | undefined,
  projectId?: string,
  textQuery?: string,
  searchFilters?: BoardSearchParams,
  onFiltersChange?: (next: BoardFilters) => void,
) {
  const storageKey = projectId ? `kaneo:board-filters:${projectId}` : null;
  const seededStorageKeyRef = useRef<string | null>(null);
  const filters = useMemo(() => searchParamsToFilters(searchFilters ?? null), [searchFilters]);

  useEffect(() => {   // SEED — only when the URL carries NO active filters, once per storageKey
    if (hasActiveFilterParams(searchFilters)) return;
    if (!storageKey || typeof window === "undefined") return;
    if (seededStorageKeyRef.current === storageKey) return;
    seededStorageKeyRef.current = storageKey;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return;
      const normalized = normalizeFilters(JSON.parse(stored) as unknown);
      const hasActive = Object.values(normalized).some((v) => Array.isArray(v) && v.length > 0);
      if (hasActive) onFiltersChange?.(normalized);
    } catch {}
  }, [searchFilters, storageKey, onFiltersChange]);

  useEffect(() => {   // SYNC-BACK — only when the URL DOES carry active filters
    if (!hasActiveFilterParams(searchFilters)) return;
    if (!storageKey || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(filters));
  }, [searchFilters, storageKey, filters]);

  const persistAndNotify = (next: BoardFilters) => {
    if (storageKey && typeof window !== "undefined") window.localStorage.setItem(storageKey, JSON.stringify(next));
    onFiltersChange?.(next);
  };
  // setFilters / clearFilters / updateFilter / updateLabelFilter all route through persistAndNotify
  return { filters, setFilters, updateFilter, updateLabelFilter, filteredProject, hasActiveFilters, clearFilters };
}
```

#### apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx
_Included because: The current file. Test (b) is the one that fails today and must be rewritten; the it.each test stays verbatim. Reuse the project fixture already in the file._

```
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useTaskFiltersWithLabelsSupport } from "./use-task-filters-with-labels-support";

describe("useTaskFiltersWithLabelsSupport", () => {
  const storageKey = "kaneo:board-filters:project-1";
  beforeEach(() => { window.localStorage.clear(); });
  afterEach(() => { window.localStorage.clear(); });

  it("restores persisted label filters from storage and matches tasks from project data", async () => {
    window.localStorage.setItem(storageKey, JSON.stringify({ labels: ["label-bug"] }));
    const project = { id: "project-1", slug: "PROJ", /* ...columns[0].tasks = task-1 (labels:[label-bug]), task-2 (labels:[]) */ };
    const { result } = renderHook(() => useTaskFiltersWithLabelsSupport(project, "project-1"));
    await waitFor(() => { expect(result.current.filters.labels).toEqual(["label-bug"]); });
    expect(result.current.filteredProject?.columns[0]?.tasks).toHaveLength(1);
    expect(result.current.filteredProject?.columns[0]?.tasks[0]?.id).toBe("task-1");
  });

  it.each(["#123", "proj-123", "proj-"])(
    "matches a task by its issue identifier when searching for %s",
    (textQuery) => {
      const project = { /* task-123 number:123, task-without-number number:null */ };
      const { result } = renderHook(() => useTaskFiltersWithLabelsSupport(project, "project-1", textQuery));
      expect(result.current.filteredProject?.columns[0]?.tasks).toEqual([expect.objectContaining({ id: "task-123" })]);
    },
  );
});
```
### Acceptance criteria
- Every test in the file passes
- The it.each issue-identifier test is byte-identical to before
- A test proves URL searchFilters win over localStorage and are written back to localStorage
- A test proves the localStorage seed fires exactly once across a rerender
- A test proves searchFilters={{status: []}} still allows the seed to fire
- Tests prove updateFilter, updateLabelFilter and clearFilters each persist and notify
- No assertion uses expect.any(Function)
- The hook source file was NOT modified
- files_written contains exactly one path, the test file
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
    "tests_passing": {
      "type": "integer"
    },
    "tests_failing": {
      "type": "integer"
    },
    "iteach_test_unchanged": {
      "type": "boolean"
    },
    "implementation_bugs_found": {
      "type": "array",
      "items": {
        "type": "string"
      }
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
    "tests_passing",
    "tests_failing",
    "iteach_test_unchanged",
    "implementation_bugs_found",
    "files_written"
  ]
}
```
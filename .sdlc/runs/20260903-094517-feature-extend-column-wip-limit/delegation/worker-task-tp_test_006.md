## Task tp_test_006 — tests / test_unit
Module: web-board
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
ColumnHeader was just changed (finding N-1): the over-cap DECISION now uses the store's UNFILTERED task count while the DISPLAYED number stays the filtered count from the `column` prop. Extend apps/web/src/components/kanban-board/column/column-header.test.tsx to cover it.

First make the project-store mock configurable, mirroring how useGetColumns is already mocked:
  const useProjectStore = vi.fn();
  vi.mock("@/store/project", () => ({ default: () => useProjectStore() }));
Give it a default in a beforeEach of { project: { id: "project-1" }, setProject: vi.fn() } so the seven existing tests keep passing unchanged — with no `columns` on the store project, totalCount falls back to displayCount and behaviour is exactly as before. DO NOT edit the seven existing test bodies.

Add a helper that builds a store project with a given unfiltered task count for slug "in-progress".

Append FOUR new cases:
1. THE POINT OF THE FIX — store has 8 tasks, filtered prop column has 3, wipLimit 5: visible text is "3/5" (the filtered count, NOT 8/5) AND the over-cap key "tasks:kanban.wipLimitOverCapFiltered" is present. A filter must not clear a true breach.
2. store 3, filtered 1, wipLimit 5: visible "1/5", and NEITHER "tasks:kanban.wipLimitOverCap" NOR "tasks:kanban.wipLimitOverCapFiltered" is present.
3. store 8, filtered 8 (no filter active), wipLimit 5: visible "8/5" and the UNfiltered key "tasks:kanban.wipLimitOverCap" is present, not the filtered one.
4. NO FALSE ALARM — store project has no column matching slug "in-progress", filtered column has 3 tasks, wipLimit 5: falls back to the filtered count, visible "3/5", and no over-cap key at all.

Remember the i18n stub returns the raw key, so assert on literal strings like "tasks:kanban.wipLimitOverCapFiltered".

Verify with ONLY this command:
  pnpm --filter @kaneo/web exec vitest run column-header
Do NOT run the full web suite or the API suite — the 9-minute worker timeout killed an earlier packet that did. Expect 11 tests passing. Do not modify any source file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/components/kanban-board/column/column-header.test.tsx
_Included because: file to extend_

```
Seven existing tests. The store is currently mocked statically as vi.mock("@/store/project", () => ({ default: () => ({ project: { id: "project-1" }, setProject: vi.fn() }) })). makeColumn(taskCount) builds the filtered column fixture with slug "in-progress".
```

#### apps/web/src/components/kanban-board/column/column-header.tsx
_Included because: system under test_

```
totalCount = project?.columns?.find(entry => entry.slug === column.slug)?.tasks.length ?? displayCount; isOverCap = wipLimit !== null && totalCount > wipLimit; isFiltered = totalCount !== displayCount; badge text is `${displayCount}/${wipLimit}`.
```
### Acceptance criteria
- The project-store mock is configurable via a vi.fn() with a beforeEach default, and the seven original test bodies are unchanged
- A test proves a filtered view still shows the over-cap indicator when the unfiltered count exceeds the limit, while displaying the filtered count
- A test proves the store-miss fallback produces no over-cap indicator (no false alarm)
- A test distinguishes the filtered key from the unfiltered key
- pnpm --filter @kaneo/web exec vitest run column-header passes with 11 tests
- No source file was modified
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "files_changed": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "tests_added": {
      "type": "number"
    },
    "test_run_output": {
      "type": "string"
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "files_changed",
    "summary"
  ]
}
```
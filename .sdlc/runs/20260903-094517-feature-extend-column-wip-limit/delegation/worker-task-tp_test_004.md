## Task tp_test_004 — tests / test_unit
Module: web-board
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create apps/web/src/components/kanban-board/column/column-header.test.tsx covering the over-cap indicator's render states.

Copy the `const useGetColumns = vi.fn()` + vi.mock pattern and the `t: (key) => key` i18n stub from apps/web/src/components/task/task-status-popover.test.tsx, and the render / screen / afterEach(cleanup) shape from apps/web/src/components/kanban-board/task-labels.test.tsx.

.sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md section 11.4 lists the six extra vi.mock blocks needed (@/store/project, @/hooks/mutations/task/use-update-task, @/hooks/use-workspace-permission, both modals, react-i18next) and the makeColumn(taskCount) fixture helper. Mocking the modals and the permission hook keeps the DOM to the header row, so no QueryClientProvider is needed.

Seven cases, ALL required:
1. wipLimit null, 3 tasks -> getByText("3"); no "3/"; no over-cap key
2. wipLimit 5, 3 tasks -> getByText("3/5"); no over-cap key
3. wipLimit 5, 5 tasks -> getByText("5/5"); over-cap key ABSENT (strict boundary)
4. wipLimit 5, 6 tasks -> getByText("6/5"); over-cap key PRESENT
5. useGetColumns returns { data: undefined } -> getByText("3"); no indicator
6. slug mismatch (data has slug "done") -> getByText("3"); no indicator
7. expect(useGetColumns).toHaveBeenCalledWith("project-1")

Cases 3 and 5 are the ones a naive implementation fails; neither may be dropped.

Note the i18n stub makes t() return the raw key, so the over-cap assertion looks for the literal string "tasks:kanban.wipLimitOverCap".

IMPORTANT — verification budget: verify with ONLY this fast filtered command:
  pnpm --filter @kaneo/web exec vitest run column-header
Do NOT run the full web suite and do NOT run the API suite — a previous packet was killed by the 9-minute worker timeout doing that. Do not modify any existing test file or any source file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md
_Included because: authoritative spec fragment_

```
Section 11.4 gives the six vi.mock blocks, the makeColumn fixture, and the seven-case assertion table with AC mapping.
```

#### apps/web/src/components/task/task-status-popover.test.tsx
_Included because: pattern to copy_

```
Reference for mocking useGetColumns and stubbing react-i18next in this repo.
```

#### apps/web/src/components/kanban-board/column/column-header.tsx
_Included because: system under test_

```
System under test. Derives wipLimit via columnsData?.find(entry => entry.slug === column.slug)?.wipLimit ?? null, isOverCap via strict >, and renders a bare-count span when wipLimit is null.
```
### Acceptance criteria
- All seven cases are present, including the strict-boundary case (count === limit is NOT over cap) and the loading case
- useGetColumns and react-i18next are mocked; no QueryClientProvider is required
- The filtered vitest command passes
- No existing test file and no source file was modified
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
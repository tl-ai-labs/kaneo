## Task tp_test_004 — tests / test_add
Module: tests
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

Create ONLY apps/web/src/components/kanban-board/column/column-header.test.tsx, a vitest + @testing-library/react suite for the per-column estimate rollup.

Follow the vi.mock-per-dependency style of apps/web/src/components/list-view/task-row.test.tsx — read it first for the idiom. Read apps/web/src/components/kanban-board/column/column-header.tsx to see exactly what to mock: it imports CreateTaskModal, ArchiveTasksModal, useUpdateTask, useWorkspacePermission, useProjectStore, getColumnIcon and react-i18next. Mock the two modals as null-returning components. Mock useWorkspacePermission so canUpdateTasks and canCreateTasks return true.

This is AC-6's proof. Cover exactly these cases, building a column object shaped { id, slug, name, icon, isFinal, tasks }:
1. Several estimates — tasks with estimatedMinutes 120 and 240 render "6h".
2. One estimate — tasks with 150, null, null render "2.5h".
3. Zero estimates — tasks with null, null render NO rollup badge.
4. Empty column — tasks [] renders no rollup badge.

In every case also assert the existing task-count badge still renders its count, proving the rollup did not displace it. Use cleanup() in afterEach. Create no other file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/components/kanban-board/column/column-header.tsx (the rollup under test, already on disk)
_Included because: What the assertions target, and the count badge that must survive._

```
const estimateLabel = formatEstimatedHours(sumEstimatedMinutes(column.tasks));
// ...
<span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
  {column.tasks.length}
</span>
{estimateLabel && (
  <span
    className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
    title={t("tasks:kanban.estimatedHoursRollup")}
  >
    {estimateLabel}
  </span>
)}
```

#### apps/web/src/components/list-view/task-row.test.tsx (idiom to follow, head)
_Included because: The established component-test pattern in this repo._

```
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

vi.mock("@/hooks/mutations/task/use-delete-task", () => ({ useDeleteTask: () => ({ mutateAsync: vi.fn() }) }));
vi.mock("../kanban-board/task-card-context-menu/task-card-context-menu-content", () => ({ default: () => null }));
```
### Acceptance criteria
- Rollup asserted at several (6h), one (2.5h), zero and empty
- The task-count badge is asserted present in every case
- All ColumnHeader dependencies are mocked so it renders in isolation
- No other file is created
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "created": {
      "type": "boolean"
    },
    "tests_pass": {
      "type": "boolean"
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "created",
    "tests_pass",
    "summary"
  ]
}
```
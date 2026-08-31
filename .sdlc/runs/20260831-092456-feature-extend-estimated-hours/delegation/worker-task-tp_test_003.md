## Task tp_test_003 — tests / test_add
Module: tests
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

Create ONLY apps/web/src/components/kanban-board/task-card.test.tsx, a vitest + @testing-library/react suite for the estimate badge.

Follow the vi.mock-per-dependency style of apps/web/src/components/list-view/task-row.test.tsx exactly — read that file first for the idiom. TaskCard has many dependencies (router, stores, query hooks, context menus); mock every one it imports so the component renders in isolation. Read apps/web/src/components/kanban-board/task-card.tsx to see precisely what to mock, and note it reads showPriority/showDueDates/showLabels from the user-preferences store.

Assert exactly three things:
1. When task.estimatedMinutes is 150, the text "2.5h" is in the document.
2. When task.estimatedMinutes is null, no estimate badge renders — assert queryByText(/h$/) style matching finds no estimate text, or better, assert the Clock-badge text "2.5h"/any hours string is absent.
3. When task.estimatedMinutes is omitted entirely, likewise nothing renders.

Use cleanup() in afterEach and vi.clearAllMocks(). Keep it focused on the badge — do not assert on unrelated card behaviour. If a dependency proves impractical to mock, prefer mocking it as a null-returning component over weakening the assertions. Create no other file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/components/list-view/task-row.test.tsx (idiom to follow, head)
_Included because: The established component-test pattern in this repo: one vi.mock per dependency, cleanup in afterEach._

```
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type Task from "@/types/task";
import TaskRow from "./task-row";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/hooks/queries/external-link/use-external-links", () => ({ default: () => ({ data: [] }) }));
vi.mock("@/hooks/mutations/task/use-delete-task", () => ({ useDeleteTask: () => ({ mutateAsync: vi.fn() }) }));
vi.mock("../kanban-board/task-card-context-menu/task-card-context-menu-content", () => ({ default: () => null }));
```

#### the badge under test (already on disk in task-card.tsx)
_Included because: What the assertions target._

```
const estimatedHours = formatEstimatedHours(task.estimatedMinutes);
// ...
{estimatedHours && (
  <span className="inline-flex items-center gap-1 rounded border border-border/70 bg-muted/55 px-2 py-1 text-[10px] font-medium text-muted-foreground">
    <Clock className="w-3 h-3" />
    {estimatedHours}
  </span>
)}
```
### Acceptance criteria
- The suite renders TaskCard with all dependencies mocked
- Asserts "2.5h" present at estimatedMinutes 150
- Asserts no estimate badge at null and when omitted
- cleanup() runs in afterEach and no other file is created
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
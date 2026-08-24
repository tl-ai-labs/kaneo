## Task tp_pkt_015 — tests / test_add
Module: web-ui
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
IMPORTANT: do NOT explore the repository and do NOT read any file. Everything you need is in `inputs` below. Make exactly ONE file write, to the artifact path named below, and ZERO file reads. Do not create, modify or delete any other file.

Create apps/web/src/components/kanban-board/column/column-header.test.tsx — a vitest + @testing-library/react component test for the named export `ColumnHeader` (import it as `import { ColumnHeader } from "./column-header";`), proving acceptance criteria AC-6, AC-7 and AC-8.

Follow the house pattern in the reference test in inputs EXACTLY: vi.mock every hook/store/child the component imports, and `cleanup()` in afterEach. The component's import list is in inputs — you must mock ALL of: "react-i18next" (useTranslation so `t` returns the key it is given), "@/hooks/mutations/task/use-update-task" (useUpdateTask -> ({ mutate: vi.fn() })), "@/hooks/mutations/column/use-update-column" (useUpdateColumn -> ({ mutateAsync: vi.fn(), isPending: false })  — NOTE it is mutateAsync, not mutate), "@/hooks/use-workspace-permission" (useWorkspacePermission -> canUpdateTasks/canCreateTasks/canUpdateProjects all () => true), "@/store/project" (default -> ({ project: { id: "project-1" }, setProject: vi.fn() })), "@/lib/column" (getColumnIcon -> () => null), "@/lib/toast" (toast -> ({ success: vi.fn(), error: vi.fn() })), and the two children "@/components/shared/modals/create-task-modal" (default -> () => null) and "../../shared/modals/archive-tasks-modal" (named export ArchiveTasksModal -> () => null).

Build a small helper returning a column fixture: `{ id: "in-progress", columnId: "col-uuid-1", slug: "in-progress", name: "In Progress", icon: null, isFinal: false, wipLimit: <param>, tasks: <n items> }` where each task is a minimal object; cast the whole fixture with `as unknown as ProjectWithTasks["columns"][number]` (import type { ProjectWithTasks } from "@/types/project").

Three tests, no more:
1. AC-6 — wipLimit null, 3 tasks: the badge text is exactly "3" and does NOT contain "/".
2. AC-7 — wipLimit 5, 3 tasks: the badge text is "3/5" and its className does NOT include "text-destructive".
3. AC-8 — wipLimit 5, 6 tasks: the badge text is "6/5" AND its className DOES include "text-destructive".

Assert styling by reading the rendered element's className, not by snapshot. Write only this one file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/components/list-view/task-row.test.tsx
_Included because: undefined_

```
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type Task from "@/types/task";
import TaskRow from "./task-row";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/hooks/mutations/task/use-delete-task", () => ({
  useDeleteTask: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock(
  "../kanban-board/task-card-context-menu/task-card-context-menu-content",
  () => ({ default: () => null }),
);

vi.mock("@/store/project", () => ({
  default: () => ({ project: { id: "project-1", slug: "kan" } }),
}));

```

#### apps/web/src/components/kanban-board/column/column-header.tsx
_Included because: undefined_

```
// CURRENT content (post-refinement). Import list and the badge markup you must test:
import { produce } from "immer";
import { Archive, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUpdateColumn } from "@/hooks/mutations/column/use-update-column";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { getColumnIcon } from "@/lib/column";
import { toast } from "@/lib/toast";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import { ArchiveTasksModal } from "../../shared/modals/archive-tasks-modal";

type ColumnHeaderProps = { column: ProjectWithTasks["columns"][number] };

export function ColumnHeader({ column }: ColumnHeaderProps) {
  const { t } = useTranslation();
  const { project, setProject } = useProjectStore();
  const { mutate: updateTask } = useUpdateTask();
  const { mutateAsync: updateColumn, isPending } = useUpdateColumn();
  const { canUpdateTasks, canCreateTasks, canUpdateProjects } = useWorkspacePermission();
  // ...

  const wipLimit = column.wipLimit;
  const hasLimit = wipLimit !== null;
  const isOverLimit = wipLimit !== null && column.tasks.length > wipLimit;

  const badgeContent = hasLimit
    ? `${column.tasks.length}/${wipLimit}`
    : column.tasks.length;

  const badgeClasses = isOverLimit
    ? "rounded-md bg-destructive/15 px-1.5 py-0.5 text-xs font-semibold text-destructive"
    : "rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground";

  const badge = (
    <span
      className={badgeClasses}
      title={isOverLimit ? t("tasks:kanban.wipLimitExceeded") : hasLimit ? t("tasks:kanban.wipLimitTooltip") : undefined}
    >
      {badgeContent}
    </span>
  );

  // When canUpdateProjects() is true the badge is wrapped in <PopoverTrigger>; otherwise the bare badge renders.
  // The badge <span> is the only element rendering the task count, so screen.getByText("3") / ("3/5") / ("6/5") finds it.
}

```
### Acceptance criteria
- File apps/web/src/components/kanban-board/column/column-header.test.tsx exists with exactly three it() blocks.
- useUpdateColumn is mocked returning mutateAsync and isPending (not mutate).
- AC-6 asserts badge text "3" with no "/"; AC-7 asserts "3/5" without text-destructive; AC-8 asserts "6/5" with text-destructive.
- Styling asserted via className, not snapshot.
- vitest runs the file green.
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
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "artifact_path",
    "summary"
  ]
}
```
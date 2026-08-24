## Task tp_pkt_011 — codegen / existing_file_edit
Module: web-ui
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
IMPORTANT: do NOT explore the repository. Everything you need is in `inputs`. Make exactly ONE file write, to the artifact path named below. Do not create, modify or delete any other file.

Edit apps/web/src/components/kanban-board/column/column-header.tsx to add the WIP-limit indicator and its inline editor.

1. BADGE. The existing count span renders `{column.tasks.length}` with classes `rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground`. Replace its content with a rule on `column.wipLimit`:
   - null/undefined -> render `{column.tasks.length}` with today's classes, unchanged.
   - set and `column.tasks.length <= column.wipLimit` -> render `{column.tasks.length}/{column.wipLimit}` with today's classes.
   - set and `column.tasks.length > column.wipLimit` -> render `{column.tasks.length}/{column.wipLimit}` and swap `bg-muted text-muted-foreground` for `bg-destructive/15 text-destructive font-semibold`, plus `title={t("tasks:kanban.wipLimitExceeded")}`.

2. EDITOR. Get `canUpdateProjects` from the existing `useWorkspacePermission()` call. When `canUpdateProjects()` is true, wrap the badge in a Popover (import Popover, PopoverTrigger, PopoverContent from "@/components/ui/popover"; see the reference usage in inputs) whose content holds: an `<Input type="number" min={1}>` (from "@/components/ui/input") bound to local state `limitValue`, initialised from `column.wipLimit?.toString() ?? ""`, with `placeholder={t("tasks:kanban.wipLimitPlaceholder")}`; a Save button labelled `t("tasks:kanban.saveWipLimit")`; and a Clear button labelled `t("tasks:kanban.clearWipLimit")`. Put `title={t("tasks:kanban.setWipLimit")}` on the trigger. When `canUpdateProjects()` is false, render the bare badge with NO trigger, NO popover and no edit affordance at all.

3. MUTATION. Import `useUpdateColumn` from "@/hooks/mutations/column/use-update-column". Save parses `limitValue` with parseInt; if it is a positive integer call `mutate({ id: column.columnId, projectId: project.id, data: { wipLimit: parsed } })`, otherwise (empty, blank or non-positive) send `{ wipLimit: null }`. Clear always sends `{ wipLimit: null }`. Close the popover after either. Guard on `project` being defined, as the existing code does.

HARD CONSTRAINTS:
- The mutation id MUST be `column.columnId` (the database UUID). `column.id` is the SLUG on this payload — using it will 404.
- Do NOT change `getColumnIcon(column.id, column.isFinal, column.icon)` or `status={column.id}` on CreateTaskModal. Both must keep using `column.id`.
- Every user-facing string must come from a static `t("tasks:kanban.<key>")` key listed above. No literal English in JSX, no template-built key names.
- Add NO blocking behaviour: nothing here may prevent creating, moving or updating a task. This is an indicator only.
- Leave the archive button, the add-task button, CreateTaskModal, ArchiveTasksModal and handleConfirmArchive exactly as they are.

Implements FR-9, FR-10, FR-11, FR-12, FR-16.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/components/kanban-board/column/column-header.tsx
_Included because: Full current content of the file you must edit._

```
import { produce } from "immer";
import { Archive, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { getColumnIcon } from "@/lib/column";
import { toast } from "@/lib/toast";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import { ArchiveTasksModal } from "../../shared/modals/archive-tasks-modal";

type ColumnHeaderProps = {
  column: ProjectWithTasks["columns"][number];
};

export function ColumnHeader({ column }: ColumnHeaderProps) {
  const { t } = useTranslation();
  const { project, setProject } = useProjectStore();
  const { mutate: updateTask } = useUpdateTask();
  const { canUpdateTasks, canCreateTasks } = useWorkspacePermission();
  const canTask = canUpdateTasks();
  const canCreate = canCreateTasks();

  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const handleConfirmArchive = () => {
    if (!column.isFinal || !project) return;

    const updatedProject = produce(project, (draft) => {
      const archivedColumn = draft?.columns?.find(
        (col) => col.id === column.id,
      );
      if (!archivedColumn) return;

      for (const task of archivedColumn.tasks) {
        updateTask({
          ...task,
          status: "archived",
        });
      }

      archivedColumn.tasks = [];
    });

    setProject(updatedProject);
    toast.success(t("tasks:archive.success", { count: column.tasks.length }));
    setIsArchiveModalOpen(false);
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-muted-foreground">
          {getColumnIcon(column.id, column.isFinal, column.icon)}
        </span>
        <span className="truncate text-sm font-medium text-foreground/95">
          {column.name}
        </span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          {column.tasks.length}
        </span>
      </div>

      <div className="flex items-center">
        {canTask && column.isFinal && column.tasks.length > 0 && (
          <button
            type="button"
            onClick={() => setIsArchiveModalOpen(true)}
            className="flex items-center rounded-md px-2 py-1 text-left text-muted-foreground transition-colors hover:bg-accent/50"
            title={t("tasks:listView.archiveAllTooltip")}
          >
            <Archive className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
        {canCreate && (
          <button
            type="button"
            onClick={() => setIsTaskModalOpen(true)}
            className="flex items-center rounded-md px-2 py-1 text-left text-muted-foreground transition-colors hover:bg-accent/50"
            title={t("tasks:kanban.addTask")}
          >
            <Plus className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      <CreateTaskModal
        open={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        projectId={project?.id}
        status={column.id}
      />

      <ArchiveTasksModal
        open={isArchiveModalOpen}
        onClose={() => setIsArchiveModalOpen(false)}
        onConfirm={handleConfirmArchive}
        taskCount={column.tasks.length}
      />
    </div>
  );
}
```

#### apps/web/src/components/task/task-priority-popover.tsx
_Included because: READ-ONLY reference: the house Popover import + open-state usage pattern. Do not edit this file._

```
import { Check } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export default function TaskPriorityPopover({ task, children }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();
  // <Popover open={open} onOpenChange={setOpen}>
  //   <PopoverTrigger ...>{children}</PopoverTrigger>
  //   <PopoverContent ...>...</PopoverContent>
  // </Popover>
}
```

#### apps/web/src/hooks/mutations/column/use-update-column.ts
_Included because: READ-ONLY reference: the mutation you must call and its exact argument shape. wipLimit has already been added to `data` by an earlier packet in this run. Do not edit this file._

```
export function useUpdateColumn() {
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      projectId: string;
      data: {
        name?: string;
        icon?: string | null;
        color?: string | null;
        isFinal?: boolean;
        wipLimit?: number | null;
      };
    }) => updateColumn(id, data),
    // onSuccess invalidates ["columns", projectId] and ["tasks", projectId]
  });
}
```

#### apps/api/src/task/controllers/get-tasks.ts
_Included because: READ-ONLY reference: the board payload each column now carries. Note id is the SLUG and columnId is the UUID. Do not edit this file._

```
const columns = projectColumns.map((column) => ({
  id: column.slug,        // SLUG - used by getColumnIcon and CreateTaskModal status
  columnId: column.id,    // UUID - use THIS for the update mutation
  slug: column.slug,
  name: column.name,
  icon: column.icon,
  isFinal: column.isFinal,
  wipLimit: column.wipLimit,  // number | null
  tasks: [...],
}));
```

#### i18n/en-US.json
_Included because: READ-ONLY reference: the tasks.kanban keys now available to t(). Do not edit this file._

```
"kanban": {
  "addTask": "Add task",
  "wipLimitTooltip": "WIP limit",
  "setWipLimit": "Set WIP limit",
  "wipLimitPlaceholder": "Limit (optional)",
  "wipLimitExceeded": "Column is over WIP limit",
  "clearWipLimit": "Clear limit",
  "saveWipLimit": "Save"
}
```
### Acceptance criteria
- Badge renders count only when wipLimit is null, and count/limit when it is set
- Over-capacity styling (bg-destructive/15 text-destructive font-semibold) applies only when tasks.length > wipLimit
- The editor is rendered only when canUpdateProjects() is true
- The update mutation is called with id: column.columnId, never column.id
- getColumnIcon(column.id, ...) and CreateTaskModal status={column.id} still use column.id
- All strings come from static tasks:kanban.* i18n keys
- No code path blocks or rejects a task create/move
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
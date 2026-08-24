## Task tp_ref_002 — codegen / existing_file_edit
Module: web-ui
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Edit ONE file only: apps/web/src/components/kanban-board/column/column-header.tsx. Its full current content is in inputs — do not go exploring the repo. Fix two defects a senior review found.

FAILURE MODE 1 (zero semantics). handleSaveWipLimit (line 68) parses the input and sends { wipLimit: null } for ANY value that is NaN or <= 0, so typing 0 or -3 silently CLEARS an existing limit. The API rejects 0 with a 400 (Valibot minValue(1)). Rewrite the handler to branch THREE ways: (a) trimmed-empty input -> send { wipLimit: null } (clear); (b) an integer >= 1 -> send { wipLimit: parsed }; (c) anything else (0, negative, non-integer, NaN) -> do NOT mutate, keep the popover open, and show t("tasks:kanban.wipLimitInvalid") as an inline error under the Input via a new useState error string. Clear that error on each onChange and whenever the popover opens.

FAILURE MODE 2 (swallowed errors). Both handlers use fire-and-forget mutate() and close the popover unconditionally, so a 400/403/500 gives no feedback. Change line 30 to `const { mutateAsync: updateColumn, isPending } = useUpdateColumn();`, make both handlers async, await inside try/catch. On success: toast.success(t("tasks:kanban.wipLimitUpdated")) and close the popover. On failure: toast.error(error instanceof Error && error.message ? error.message : t("tasks:kanban.wipLimitUpdateError")) and LEAVE the popover open. `toast` is already imported from "@/lib/toast". Mirror the try/catch+toast shape from column-editor.tsx in inputs.

ALSO: disable both the Save and Clear buttons while isPending; add aria-label={t("tasks:kanban.setWipLimit")} to the Input; make the badge title read title={isOverLimit ? t("tasks:kanban.wipLimitExceeded") : hasLimit ? t("tasks:kanban.wipLimitTooltip") : undefined}; and collapse the duplicated `column.wipLimit !== null && column.wipLimit !== undefined` guards (lines 98-106) into one `const hasLimit = column.wipLimit !== null;` — the field is typed number | null.

DO NOT CHANGE: keep mutating against column.columnId (NEVER column.id); keep getColumnIcon(column.id, column.isFinal, column.icon) and status={column.id} byte-identical; keep the canEditProjects gate around the Popover and the plain badge in the else branch; leave the archive/create-task markup and handleConfirmArchive untouched; all user-facing copy stays in static i18n keys — introduce no hardcoded strings.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/components/kanban-board/column/column-header.tsx
_Included because: undefined_

```
import { produce } from "immer";
import { Archive, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateColumn } from "@/hooks/mutations/column/use-update-column";
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
  const { mutate: updateColumn } = useUpdateColumn();
  const { canUpdateTasks, canCreateTasks, canUpdateProjects } =
    useWorkspacePermission();
  const canTask = canUpdateTasks();
  const canCreate = canCreateTasks();
  const canEditProjects = canUpdateProjects();

  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isWipPopoverOpen, setIsWipPopoverOpen] = useState(false);
  const [limitValue, setLimitValue] = useState(
    column.wipLimit?.toString() ?? "",
  );

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

  const handleSaveWipLimit = () => {
    if (!project) return;
    const parsed = Number.parseInt(limitValue, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      updateColumn({
        id: column.columnId,
        projectId: project.id,
        data: { wipLimit: parsed },
      });
    } else {
      updateColumn({
        id: column.columnId,
        projectId: project.id,
        data: { wipLimit: null },
      });
    }
    setIsWipPopoverOpen(false);
  };

  const handleClearWipLimit = () => {
    if (!project) return;
    updateColumn({
      id: column.columnId,
      projectId: project.id,
      data: { wipLimit: null },
    });
    setLimitValue("");
    setIsWipPopoverOpen(false);
  };

  const isOverLimit =
    column.wipLimit !== null &&
    column.wipLimit !== undefined &&
    column.tasks.length > column.wipLimit;

  const badgeContent =
    column.wipLimit !== null && column.wipLimit !== undefined
      ? `${column.tasks.length}/${column.wipLimit}`
      : column.tasks.length;

  const badgeClasses = isOverLimit
    ? "rounded-md bg-destructive/15 px-1.5 py-0.5 text-xs font-semibold text-destructive"
    : "rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground";

  const badge = (
    <span
      className={badgeClasses}
      title={isOverLimit ? t("tasks:kanban.wipLimitExceeded") : undefined}
    >
      {badgeContent}
    </span>
  );

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-muted-foreground">
          {getColumnIcon(column.id, column.isFinal, column.icon)}
        </span>
        <span className="truncate text-sm font-medium text-foreground/95">
          {column.name}
        </span>
        {canEditProjects ? (
          <Popover
            open={isWipPopoverOpen}
            onOpenChange={(open) => {
              setIsWipPopoverOpen(open);
              if (open) {
                setLimitValue(column.wipLimit?.toString() ?? "");
              }
            }}
          >
            <PopoverTrigger title={t("tasks:kanban.setWipLimit")}>
              {badge}
            </PopoverTrigger>
            <PopoverContent className="w-60 p-3" align="start">
              <div className="space-y-3">
                <Input
                  type="number"
                  min={1}
                  value={limitValue}
                  onChange={(e) => setLimitValue(e.target.value)}
                  placeholder={t("tasks:kanban.wipLimitPlaceholder")}
                />
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClearWipLimit}
                  >
                    {t("tasks:kanban.clearWipLimit")}
                  </Button>
                  <Button type="button" size="sm" onClick={handleSaveWipLimit}>
                    {t("tasks:kanban.saveWipLimit")}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          badge
        )}
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

#### apps/web/src/components/project/column-editor.tsx
_Included because: undefined_

```
(reference slice, lines 72-83 — the established mutateAsync + try/catch + toast pattern for this same mutation)

  const handleRename = async (id: string, name: string) => {
    try {
      await updateColumn({ id, projectId, data: { name } });
      toast.success(t("settings:columnEditor.toastRenamed"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:columnEditor.toastRenameError"),
      );
    }
  };

```

#### apps/web/src/hooks/mutations/column/use-update-column.ts
_Included because: undefined_

```
export function useUpdateColumn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; projectId: string; data: { name?: string; icon?: string | null; color?: string | null; isFinal?: boolean; wipLimit?: number | null; } }) => updateColumn(id, data),
    onSuccess: async (_, variables) => { /* invalidates ["columns", projectId] and ["tasks", projectId] */ },
  });
}
// NOTE: only onSuccess is defined — there is no onError, which is why the caller must try/catch around mutateAsync.
```

#### i18n/en-US.json
_Included because: undefined_

```
tasks.kanban now contains these keys (all already added, use them as-is): addTask, wipLimitTooltip, setWipLimit, wipLimitPlaceholder, wipLimitExceeded, clearWipLimit, saveWipLimit, wipLimitInvalid, wipLimitUpdated, wipLimitUpdateError
```
### Acceptance criteria
- Entering 0, a negative number or a non-integer and pressing Save issues NO updateColumn call, keeps the popover open, and shows t("tasks:kanban.wipLimitInvalid").
- Entering an empty/whitespace value and pressing Save sends { wipLimit: null }; entering an integer >= 1 sends { wipLimit: <that integer> }.
- Both handlers await mutateAsync in try/catch; a rejection triggers toast.error and leaves the popover open, a success triggers toast.success and closes it.
- Save and Clear are disabled while isPending is true.
- The mutation target is column.columnId in every call site; getColumnIcon(column.id, ...) and status={column.id} are byte-identical to before.
- The Popover still renders only when canEditProjects is true; the read-only branch still renders the plain badge span.
- t("tasks:kanban.wipLimitTooltip") is now referenced; no hardcoded user-facing string is introduced.
- pnpm typecheck passes with no new errors.
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
      "type": "string",
      "description": "one sentence, what changed"
    }
  },
  "required": [
    "artifact_path",
    "summary"
  ]
}
```
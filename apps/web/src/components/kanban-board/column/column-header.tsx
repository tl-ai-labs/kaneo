import { produce } from "immer";
import { Archive, Clock, Plus } from "lucide-react";
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

  // `0` is a real estimate: it counts toward `done` while adding nothing to the
  // sum. A `task.estimatedHours || 0` predicate would misclassify it as absent.
  const estimatedTasks = column.tasks.filter(
    (task) => typeof task.estimatedHours === "number",
  );
  const estimatedTotal = estimatedTasks.reduce(
    (sum, task) => sum + (task.estimatedHours ?? 0),
    0,
  );
  const estimateState =
    estimatedTasks.length === 0
      ? "none"
      : estimatedTasks.length === column.tasks.length
        ? "all"
        : "partial";
  const estimateArgs = {
    hours: estimatedTotal,
    done: estimatedTasks.length,
    total: column.tasks.length,
  };
  const estimateLabel =
    estimateState === "none"
      ? t("tasks:kanban.estimate.none")
      : estimateState === "partial"
        ? t("tasks:kanban.estimate.partial", estimateArgs)
        : t("tasks:kanban.estimate.all", estimateArgs);
  const estimateText =
    estimateState === "none"
      ? t("tasks:kanban.estimate.noneShort")
      : estimateState === "partial"
        ? t("tasks:kanban.estimate.partialShort", estimateArgs)
        : t("tasks:kanban.estimate.allShort", estimateArgs);

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
        {column.tasks.length > 0 && (
          <span
            role="img"
            aria-label={estimateLabel}
            title={estimateLabel}
            data-estimate-state={estimateState}
            className="flex shrink-0 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
          >
            <Clock className="h-3 w-3" />
            {estimateText}
          </span>
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

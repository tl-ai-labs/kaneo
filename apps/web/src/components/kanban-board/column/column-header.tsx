import { produce } from "immer";
import { Archive, Plus, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { getColumnIcon } from "@/lib/column";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
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

  const { data: columnsData } = useGetColumns(project?.id ?? "");
  const wipLimit =
    columnsData?.find((entry) => entry.slug === column.slug)?.wipLimit ?? null;
  const displayCount = column.tasks.length;
  // `column` is the filtered project's column; the store holds the unfiltered
  // one. Filters must never clear a breach that is genuinely true.
  const totalCount =
    project?.columns?.find((entry) => entry.slug === column.slug)?.tasks
      .length ?? displayCount;
  const isOverCap = wipLimit !== null && totalCount > wipLimit;
  const isFiltered = totalCount !== displayCount;

  const badgeMessage = isOverCap
    ? isFiltered
      ? t("tasks:kanban.wipLimitOverCapFiltered", {
          taskCount: displayCount,
          total: totalCount,
          limit: wipLimit,
        })
      : t("tasks:kanban.wipLimitOverCap", {
          taskCount: displayCount,
          limit: wipLimit,
        })
    : isFiltered
      ? t("tasks:kanban.wipLimitFiltered", {
          taskCount: displayCount,
          total: totalCount,
          limit: wipLimit,
        })
      : t("tasks:kanban.wipLimitTitle", {
          taskCount: displayCount,
          limit: wipLimit,
        });

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
        {wipLimit === null ? (
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            {displayCount}
          </span>
        ) : (
          <span
            className={cn(
              "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
              isOverCap
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground",
            )}
            title={badgeMessage}
          >
            {isOverCap && (
              <TriangleAlert className="h-3 w-3" aria-hidden="true" />
            )}
            {`${displayCount}/${wipLimit}`}
            {isOverCap && <span className="sr-only">{badgeMessage}</span>}
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

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
  const { mutateAsync: updateColumn, isPending } = useUpdateColumn();
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
  const [error, setError] = useState("");

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

  const handleSaveWipLimit = async () => {
    if (!project) return;
    const trimmed = limitValue.trim();

    if (trimmed === "") {
      try {
        await updateColumn({
          id: column.columnId,
          projectId: project.id,
          data: { wipLimit: null },
        });
        toast.success(t("tasks:kanban.wipLimitUpdated"));
        setIsWipPopoverOpen(false);
      } catch (err) {
        toast.error(
          err instanceof Error && err.message
            ? err.message
            : t("tasks:kanban.wipLimitUpdateError"),
        );
      }
      return;
    }

    const parsed = Number(trimmed);
    if (Number.isInteger(parsed) && parsed >= 1) {
      try {
        await updateColumn({
          id: column.columnId,
          projectId: project.id,
          data: { wipLimit: parsed },
        });
        toast.success(t("tasks:kanban.wipLimitUpdated"));
        setIsWipPopoverOpen(false);
      } catch (err) {
        toast.error(
          err instanceof Error && err.message
            ? err.message
            : t("tasks:kanban.wipLimitUpdateError"),
        );
      }
    } else {
      setError(t("tasks:kanban.wipLimitInvalid"));
    }
  };

  const handleClearWipLimit = async () => {
    if (!project) return;
    try {
      await updateColumn({
        id: column.columnId,
        projectId: project.id,
        data: { wipLimit: null },
      });
      setLimitValue("");
      setError("");
      toast.success(t("tasks:kanban.wipLimitUpdated"));
      setIsWipPopoverOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : t("tasks:kanban.wipLimitUpdateError"),
      );
    }
  };

  const hasLimit = column.wipLimit !== null;

  const isOverLimit = hasLimit && column.tasks.length > column.wipLimit!;

  const badgeContent = hasLimit
    ? `${column.tasks.length}/${column.wipLimit}`
    : column.tasks.length;

  const badgeClasses = isOverLimit
    ? "rounded-md bg-destructive/15 px-1.5 py-0.5 text-xs font-semibold text-destructive"
    : "rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground";

  const badge = (
    <span
      className={badgeClasses}
      title={
        isOverLimit
          ? t("tasks:kanban.wipLimitExceeded")
          : hasLimit
            ? t("tasks:kanban.wipLimitTooltip")
            : undefined
      }
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
              setError("");
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
                <div>
                  <Input
                    type="number"
                    min={1}
                    value={limitValue}
                    onChange={(e) => {
                      setLimitValue(e.target.value);
                      setError("");
                    }}
                    placeholder={t("tasks:kanban.wipLimitPlaceholder")}
                    aria-label={t("tasks:kanban.setWipLimit")}
                  />
                  {error ? (
                    <p className="mt-1 text-xs text-destructive">{error}</p>
                  ) : null}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={handleClearWipLimit}
                  >
                    {t("tasks:kanban.clearWipLimit")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending}
                    onClick={handleSaveWipLimit}
                  >
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

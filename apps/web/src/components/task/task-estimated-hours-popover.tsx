import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTaskEstimatedMinutes } from "@/hooks/mutations/task/use-update-task-estimated-minutes";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { MAX_ESTIMATED_MINUTES } from "@/lib/format-estimated-hours";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskEstimatedHoursPopoverProps = {
  task: Task;
  children: React.ReactNode;
};

export default function TaskEstimatedHoursPopover({
  task,
  children,
}: TaskEstimatedHoursPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(
    task.estimatedMinutes !== null && task.estimatedMinutes !== undefined
      ? String(task.estimatedMinutes / 60)
      : "",
  );
  const { mutateAsync: updateTaskEstimatedMinutes } =
    useUpdateTaskEstimatedMinutes();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setValue(
        task.estimatedMinutes !== null && task.estimatedMinutes !== undefined
          ? String(task.estimatedMinutes / 60)
          : "",
      );
    }
    setOpen(nextOpen);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (value.trim() === "") {
      toast.error(t("tasks:popover.estimatedHours.updateError"));
      return;
    }
    const hours = Number(value);
    if (
      Number.isNaN(hours) ||
      hours < 0 ||
      Math.round(hours * 60) > MAX_ESTIMATED_MINUTES
    ) {
      toast.error(t("tasks:popover.estimatedHours.updateError"));
      return;
    }

    try {
      await updateTaskEstimatedMinutes({
        task,
        estimatedMinutes: Math.round(hours * 60),
      });
      toast.success(t("tasks:popover.estimatedHours.updateSuccess"));
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.estimatedHours.updateError"),
      );
    }
  };

  const handleClear = async () => {
    try {
      await updateTaskEstimatedMinutes({
        task,
        estimatedMinutes: null,
      });
      toast.success(t("tasks:popover.estimatedHours.updateSuccess"));
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.estimatedHours.updateError"),
      );
    }
  };

  if (!canEdit) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-60 p-2" align="start">
        <form onSubmit={handleSubmit} className="space-y-2">
          <Input
            autoFocus
            type="text"
            placeholder={t("tasks:popover.estimatedHours.placeholder")}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </form>
        {task.estimatedMinutes !== null &&
          task.estimatedMinutes !== undefined && (
            <div className="pt-2 mt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                onClick={handleClear}
              >
                <X className="h-4 w-4" />
                {t("tasks:popover.estimatedHours.clear")}
              </Button>
            </div>
          )}
      </PopoverContent>
    </Popover>
  );
}

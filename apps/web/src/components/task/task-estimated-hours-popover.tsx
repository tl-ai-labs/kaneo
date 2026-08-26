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
import { useUpdateTaskEstimatedHours } from "@/hooks/mutations/task/use-update-task-estimated-hours";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import {
  MAX_ESTIMATED_HOURS,
  parseEstimatedHoursInput,
} from "@/lib/estimated-hours";
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
    task.estimatedHours != null ? String(task.estimatedHours) : "",
  );
  const { mutateAsync: updateTaskEstimatedHours } =
    useUpdateTaskEstimatedHours();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();

  async function commit(next: number | null) {
    try {
      await updateTaskEstimatedHours({
        id: task.id,
        projectId: task.projectId,
        estimatedHours: next,
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
  }

  async function handleSave() {
    const parsed = parseEstimatedHoursInput(value);
    if (!parsed.ok) {
      toast.error(t("tasks:popover.estimatedHours.invalid"));
      return;
    }
    await commit(parsed.value);
  }

  async function handleClear() {
    setValue("");
    await commit(null);
  }

  // Seed on open rather than in useState: this component is rendered per task,
  // so a reused instance would otherwise keep the previous task's value.
  function handleOpenChange(next: boolean) {
    if (next) {
      setValue(task.estimatedHours != null ? String(task.estimatedHours) : "");
    }
    setOpen(next);
  }

  if (!canEdit) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-56 p-3 space-y-2" align="start">
        <div className="text-sm font-medium">
          {t("tasks:popover.estimatedHours.title")}
        </div>
        <Input
          type="number"
          min={0}
          max={MAX_ESTIMATED_HOURS}
          step={0.25}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleSave();
            }
          }}
          placeholder={t("tasks:popover.estimatedHours.placeholder")}
        />
        <Button size="sm" className="w-full" onClick={() => void handleSave()}>
          {t("tasks:popover.estimatedHours.save")}
        </Button>
        {task.estimatedHours != null && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => void handleClear()}
          >
            <X className="h-4 w-4" />
            {t("tasks:popover.estimatedHours.clear")}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

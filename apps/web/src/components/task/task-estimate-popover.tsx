import { X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import {
  estimateMinutesToHoursInput,
  parseEstimateHours,
} from "@/lib/estimate";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskEstimatePopoverProps = {
  task: Task;
  children: React.ReactNode;
};

export default function TaskEstimatePopover({
  task,
  children,
}: TaskEstimatePopoverProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(() =>
    estimateMinutesToHoursInput(task.estimatedMinutes),
  );
  const { mutateAsync: updateTask } = useUpdateTask();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();

  // Re-seed the field from the task whenever the popover is opened, so a
  // discarded edit does not persist into the next open.
  useEffect(() => {
    if (open) setValue(estimateMinutesToHoursInput(task.estimatedMinutes));
  }, [open, task.estimatedMinutes]);

  const parsed = parseEstimateHours(value);
  const showError = value.trim() !== "" && parsed === null;

  const commit = async (estimatedMinutes: number | null) => {
    try {
      await updateTask({ ...task, estimatedMinutes });
      toast.success(t("tasks:popover.estimate.updateSuccess"));
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.estimate.updateError"),
      );
    }
  };

  if (!canEdit) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <form
          className="flex flex-col gap-2 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (parsed === null) return;
            commit(parsed);
          }}
        >
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor={inputId}
          >
            {t("tasks:popover.estimate.label")}
          </label>
          <Input
            nativeInput
            id={inputId}
            inputMode="decimal"
            autoComplete="off"
            placeholder={t("tasks:popover.estimate.placeholder")}
            value={value}
            aria-invalid={showError || undefined}
            onChange={(event) => setValue(event.target.value)}
          />
          {showError && (
            <p className="text-xs text-destructive">
              {t("tasks:popover.estimate.invalid")}
            </p>
          )}
          <Button type="submit" size="sm" disabled={parsed === null}>
            {t("tasks:popover.estimate.save")}
          </Button>
        </form>
        {task.estimatedMinutes !== null && (
          <div className="pt-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => commit(null)}
            >
              <X className="h-4 w-4" />
              {t("tasks:popover.estimate.clear")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

import { X } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MAX_ESTIMATED_MINUTES,
  parseEstimateHours,
  toEstimateHoursInput,
} from "@/components/task/estimate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTaskEstimate } from "@/hooks/mutations/task/use-update-task-estimate";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
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
  const errorId = `${inputId}-error`;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(() =>
    toEstimateHoursInput(task.estimatedMinutes),
  );
  const [invalid, setInvalid] = useState(false);
  const { mutateAsync: updateTaskEstimate } = useUpdateTaskEstimate();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();

  const submitEstimate = async (estimatedMinutes: number | null) => {
    try {
      await updateTaskEstimate({
        taskId: task.id,
        projectId: task.projectId,
        estimatedMinutes,
      });
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

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = parseEstimateHours(value);

    // A rejected entry stays local: dispatching it would clear the stored
    // estimate instead of refusing the input. Empty input is a legal clear.
    if (parsed === "invalid") {
      setInvalid(true);
      return;
    }

    setInvalid(false);
    void submitEstimate(parsed);
  };

  // Opening re-reads server state so an abandoned edit is never re-submitted.
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setValue(toEstimateHoursInput(task.estimatedMinutes));
      setInvalid(false);
    }

    setOpen(nextOpen);
  };

  if (!canEdit) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <Label htmlFor={inputId}>{t("tasks:popover.estimate.title")}</Label>
          {/* nativeInput: the default base-ui InputPrimitive does not take a
              controlled value/onChange pair with plain React semantics. */}
          <Input
            nativeInput
            id={inputId}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setInvalid(false);
            }}
            placeholder={t("tasks:popover.estimate.placeholder")}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId : undefined}
            inputMode="decimal"
          />
          {invalid && (
            <p id={errorId} className="text-destructive text-sm">
              {t("tasks:popover.estimate.invalid", {
                min: "0.02",
                max: String(MAX_ESTIMATED_MINUTES / 60),
              })}
            </p>
          )}
          <Button type="submit" size="sm" className="w-full">
            {t("tasks:popover.estimate.save")}
          </Button>
        </form>
        {task.estimatedMinutes != null && (
          <div className="mt-2 border-border border-t pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => submitEstimate(null)}
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

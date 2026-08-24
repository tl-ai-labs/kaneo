import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";
import { EstimatedHoursInput } from "./estimated-hours-input";

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
  const { mutateAsync: updateTask } = useUpdateTask();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();

  const handleCommit = async (next: number | null) => {
    // Opening and dismissing the popover without changing anything must not
    // issue a full PUT or show a success toast.
    if (next === (task.estimatedHours ?? null)) {
      setOpen(false);
      return;
    }

    try {
      // Spread the whole task: the full PUT body reads other fields off it.
      await updateTask({ ...task, estimatedHours: next });
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="p-0 w-56" align="start">
        <EstimatedHoursInput
          value={task.estimatedHours ?? null}
          onCommit={handleCommit}
        />
      </PopoverContent>
    </Popover>
  );
}

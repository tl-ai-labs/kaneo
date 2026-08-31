## Task tp_cg_015 — codegen / new_file_add
Module: web-ui
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

Create ONLY apps/web/src/components/task/task-estimated-hours-popover.tsx, following the task-due-date-popover.tsx shape in the input exactly.

Props { task, children }. Default export TaskEstimatedHoursPopover. Use useTranslation, useState for open, useState for the input string, useUpdateTaskEstimatedMinutes() from "@/hooks/mutations/task/use-update-task-estimated-minutes", and useWorkspacePermission() with the short-circuit `if (!canEdit) return <>{children}</>;`.

The input accepts DECIMAL HOURS. On submit parse with Number(value); reject when it is NaN, negative, or when Math.round(hours * 60) exceeds 525600 — in those cases show toast.error with t("tasks:popover.estimatedHours.updateError") and do NOT call the API. Otherwise call mutateAsync({ task, estimatedMinutes: Math.round(hours * 60) }).

Provide a clear action, shown only when task.estimatedMinutes is set, that sends estimatedMinutes: null and is labelled t("tasks:popover.estimatedHours.clear").

Wrap every call in try/catch: on success toast.success(t("tasks:popover.estimatedHours.updateSuccess")) then setOpen(false); on failure toast.error with the Error message or t("tasks:popover.estimatedHours.updateError").

Seed the input from task.estimatedMinutes / 60 when the popover opens. Use the placeholder t("tasks:popover.estimatedHours.placeholder"). Import Button from "@/components/ui/button", Input from "@/components/ui/input", Popover/PopoverContent/PopoverTrigger from "@/components/ui/popover", toast from "@/lib/toast", and type Task from "@/types/task". Create no other file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/components/task/task-due-date-popover.tsx
_Included because: The exact sibling pattern to follow: props shape, permission short-circuit, toast keys, try/catch, close-on-success._

```
import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUpdateTaskDueDate } from "@/hooks/mutations/task/use-update-task-due-date";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskDueDatePopoverProps = {
  task: Task;
  children: React.ReactNode;
};

export default function TaskDueDatePopover({ task, children }: TaskDueDatePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { mutateAsync: updateTaskDueDate } = useUpdateTaskDueDate();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();

  const handleDateChange = async (date: Date | undefined) => {
    try {
      await updateTaskDueDate({ ...task, dueDate: date?.toISOString() || null });
      toast.success(t("tasks:popover.dueDate.updateSuccess"));
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("tasks:popover.dueDate.updateError"));
    }
  };

  if (!canEdit) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        {/* body */}
        {task.dueDate && (
          <div className="pt-2 border-t border-border">
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground" onClick={() => handleDateChange(undefined)}>
              <X className="h-4 w-4" />
              {t("tasks:popover.dueDate.clear")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

#### hook contract (already on disk)
_Included because: The mutation hook takes an object, not a whole task._

```
export function useUpdateTaskEstimatedMinutes(): UseMutationResult;
// mutateAsync({ task, estimatedMinutes }: { task: Task; estimatedMinutes: number | null })
```

#### i18n keys (already on disk in all 17 locales)
_Included because: The exact keys to use._

```
tasks:popover.estimatedHours.label          -> "Estimate"
tasks:popover.estimatedHours.placeholder    -> "Hours, e.g. 2.5"
tasks:popover.estimatedHours.clear          -> "Clear estimate"
tasks:popover.estimatedHours.updateSuccess  -> "Task estimate updated successfully"
tasks:popover.estimatedHours.updateError    -> "Failed to update task estimate"
```
### Acceptance criteria
- Props are { task, children } and the component is the default export
- The !canEdit short-circuit returns children unchanged
- Hours are converted with Math.round(hours * 60) and values above 525600 are rejected client-side without an API call
- Clearing sends estimatedMinutes: null and only appears when an estimate is set
- All user-facing strings come from the tasks:popover.estimatedHours.* keys
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "created": {
      "type": "boolean"
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "created",
    "summary"
  ]
}
```
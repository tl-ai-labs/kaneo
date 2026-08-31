## Task tp_cg_016 — codegen / existing_file_edit
Module: web-ui
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

Edit ONLY apps/web/src/components/task/task-properties-sidebar.tsx to register the estimate popover.

Add `import TaskEstimatedHoursPopover from "./task-estimated-hours-popover";` alongside the existing popover imports, and add Clock to the existing lucide-react import (do not add a second lucide import).

TaskDueDatePopover is registered in THREE places in this file — at roughly lines 284, 475 and 668, corresponding to the compact and desktop layouts. Add a TaskEstimatedHoursPopover block immediately AFTER each of the three closing </TaskDueDatePopover> tags, matching the surrounding indentation of that specific block.

Each block is:

<TaskEstimatedHoursPopover task={task}>
  <Button variant="ghost" size="sm" className="justify-start h-7 px-1.5 gap-1.5">
    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
    <span className="text-xs font-semibold text-muted-foreground">
      {formatEstimatedHours(task.estimatedMinutes) ?? t("tasks:popover.estimatedHours.label")}
    </span>
  </Button>
</TaskEstimatedHoursPopover>

Also add `import { formatEstimatedHours } from "@/lib/format-estimated-hours";`. When an estimate is set the button shows the formatted hours; when unset it shows the label. Preserve any conditional wrapper each due-date block sits inside — if a block is inside a `{condition && (...)}`, your new block goes after the whole conditional, at the same level as the due-date block's own sibling elements. Change nothing else.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/components/task/task-properties-sidebar.tsx (one of the three due-date registrations, exact)
_Included because: The exact shape and Button styling to match, and the closing tag your block follows._

```
                <TaskDueDatePopover task={task}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start h-7 px-1.5 gap-1.5"
                  >
                    {task.dueDate ? (
                      <>
                        {/* icon variants */}
                        <span className="text-xs font-semibold">
                          {formatDateShort(task.dueDate)}
                        </span>
                      </>
                    ) : (
                      <>
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground">
                          {t("tasks:properties.noDate")}
                        </span>
                      </>
                    )}
                  </Button>
                </TaskDueDatePopover>
              )}
```

#### existing imports (lines 43-47)
_Included because: Where the new popover import belongs._

```
import TaskDueDatePopover from "./task-due-date-popover";
import TaskPriorityPopover from "./task-priority-popover";
import TaskStartDatePopover from "./task-start-date-popover";
```
### Acceptance criteria
- TaskEstimatedHoursPopover is registered in all three locations where TaskDueDatePopover appears
- Clock is added to the existing lucide-react import and formatEstimatedHours is imported
- The trigger shows formatted hours when set and the label when unset
- The file still parses and no other component was changed
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "edited": {
      "type": "boolean"
    },
    "registration_count": {
      "type": "integer"
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "edited",
    "registration_count",
    "summary"
  ]
}
```
## Task tp_cg_017 — codegen / existing_file_edit
Module: web-ui
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

Edit ONLY apps/web/src/components/kanban-board/task-card.tsx. Add an estimate badge to the existing badge row shown in the input.

Import { formatEstimatedHours } from "@/lib/format-estimated-hours" and the Clock icon from "lucide-react" (add Clock to the existing lucide-react import; do not create a second one).

Insert the badge immediately AFTER the showDueDates due-date block and BEFORE the pullRequests block. Render it only when formatEstimatedHours(task.estimatedMinutes) returns a non-null value — compute it once into a local const above the return, or inline with a guard. When null, render nothing at all, so a task without an estimate produces byte-identical markup to today. There is deliberately NO user-preference toggle for this badge: unlike showPriority and showDueDates it always renders when a value is set.

Style it exactly like the priority badge: <span className="inline-flex items-center gap-1 rounded border border-border/70 bg-muted/55 px-2 py-1 text-[10px] font-medium text-muted-foreground"> containing <Clock className="w-3 h-3" /> and the formatted string. Change nothing else in the file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/components/kanban-board/task-card.tsx (the badge row, exact current text)
_Included because: The exact insertion point and the badge styling to match. Your badge goes between the due-date block and the pullRequests block._

```
            <div className="flex items-center gap-1.5">
              {showPriority && (
                <span className="inline-flex items-center gap-1 rounded border border-border/70 bg-muted/55 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                  {getPriorityIcon(task.priority ?? "")}
                </span>
              )}

              {showDueDates && task.dueDate && (
                <div
                  className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded ${dueDateStatusColors[getDueDateStatus(task.dueDate, taskIsCompleted)]}`}
                >
                  {/* icons */}
                  <span>{format(new Date(task.dueDate), "MMM d")}</span>
                </div>
              )}

              {pullRequests.length === 1 && (
                <HoverCard openDelay={200} closeDelay={100}>
```

#### apps/web/src/lib/format-estimated-hours.ts (contract, being written in parallel)
_Included because: Code against this signature; the module lands alongside your edit._

```
export function formatEstimatedHours(minutes: number | null | undefined): string | null;
// 150 -> "2.5h", 120 -> "2h", null for 0/negative/null/undefined
```
### Acceptance criteria
- The badge renders only when formatEstimatedHours returns non-null
- Nothing at all is rendered when the estimate is unset, keeping existing cards unchanged
- Clock is added to the existing lucide-react import rather than a new import statement
- No user-preference toggle gates the badge and no other part of the file changed
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
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "edited",
    "summary"
  ]
}
```
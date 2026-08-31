## Task tp_cg_012 — codegen / new_file_add
Module: web-data
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

Create ONLY apps/web/src/hooks/mutations/task/use-update-task-estimated-minutes.ts, following the use-update-task-due-date.ts pattern in the input.

Named-export function useUpdateTaskEstimatedMinutes(). It returns useMutation whose mutationFn takes ({ task, estimatedMinutes }: { task: Task; estimatedMinutes: number | null }) and calls updateTaskEstimatedMinutes(task.id, estimatedMinutes) from "@/fetchers/task/update-task-estimated-minutes".

onSuccess receives (_, variables) and invalidates exactly these query keys: ["task", variables.task.id], ["tasks", variables.task.projectId], and ["projects"]. Import type Task from "@/types/task" and useMutation, useQueryClient from "@tanstack/react-query". Create no other file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/hooks/mutations/task/use-update-task-due-date.ts
_Included because: The exact sibling pattern. Note yours takes an object argument, so variables.task.id replaces variables.id._

```
import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskDueDate from "@/fetchers/task/update-task-due-date";
import type Task from "@/types/task";

export function useUpdateTaskDueDate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (task: Task) => updateTaskDueDate(task.id, task),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["task", variables.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["projects"],
      });
    },
  });
}
```
### Acceptance criteria
- Named-exports useUpdateTaskEstimatedMinutes
- mutationFn takes { task, estimatedMinutes } and calls the fetcher with task.id
- Invalidates ["task", task.id], ["tasks", task.projectId] and ["projects"]
- No other file is created
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
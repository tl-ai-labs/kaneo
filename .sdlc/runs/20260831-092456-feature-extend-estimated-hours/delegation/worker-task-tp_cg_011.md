## Task tp_cg_011 — codegen / new_file_add
Module: web-data
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

Create ONLY apps/web/src/fetchers/task/update-task-estimated-minutes.ts, following the update-task-due-date.ts pattern in the input exactly.

Default-export an async function updateTaskEstimatedMinutes(taskId: string, estimatedMinutes: number | null). Call:

  client.task["estimated-minutes"][":id"].$put({ param: { id: taskId }, json: { estimatedMinutes } })

Note the route segment is "estimated-minutes" with a hyphen, so it must be accessed with bracket notation exactly as shown. If !response.ok, read await response.text() and throw new Error(that text). Otherwise return await response.json(). Import { client } from "@kaneo/libs". Do not import the Task type — this fetcher takes the raw value, not a whole task. Create no other file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/fetchers/task/update-task-due-date.ts
_Included because: The exact sibling pattern, including the bracket-notation access for a hyphenated route segment._

```
import { client } from "@kaneo/libs";
import type Task from "@/types/task";

async function updateTaskDueDate(taskId: string, task: Task) {
  const response = await client.task["due-date"][":id"].$put({
    param: { id: taskId },
    json: {
      dueDate: task.dueDate || "",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default updateTaskDueDate;
```
### Acceptance criteria
- Default-exports updateTaskEstimatedMinutes(taskId, estimatedMinutes)
- Uses client.task["estimated-minutes"][":id"].$put with param and json
- Throws with the response text when !response.ok
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
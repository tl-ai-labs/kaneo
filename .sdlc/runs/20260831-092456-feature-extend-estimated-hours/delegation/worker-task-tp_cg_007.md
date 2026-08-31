## Task tp_cg_007 — codegen / new_file_add
Module: api-write
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

Create ONLY the new file apps/api/src/task/controllers/update-task-estimated-minutes.ts, following the update-task-priority.ts pattern in the input exactly.

Default-export an async function updateTaskEstimatedMinutes taking a single named-argument object { id, estimatedMinutes, currentUserId } typed { id: string; estimatedMinutes: number | null; currentUserId: string }. Look up the task with db.query.taskTable.findFirst; if absent throw HTTPException 404 with message 'Task not found'. Update taskTable setting { estimatedMinutes } where the id matches, with .returning(). If nothing is returned throw HTTPException 500 with message 'Failed to update task estimated minutes'. Return the updated task.

CRITICAL: do NOT import or call publishEvent. Estimate history, activity events and notifications are explicit non-goals of this change, and activitySchema uses a closed picklist that a new event type would violate. The `currentUserId` argument is accepted for signature symmetry with the sibling controllers even though no event is published.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/api/src/task/controllers/update-task-priority.ts
_Included because: The exact sibling pattern to follow. Note this one DOES publishEvent; yours must NOT._

```
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function updateTaskPriority({
  id,
  priority,
  currentUserId,
}: {
  id: string;
  priority: string;
  currentUserId: string;
}) {
  const existingTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, id),
  });

  if (!existingTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  const [updatedTask] = await db
    .update(taskTable)
    .set({ priority })
    .where(eq(taskTable.id, id))
    .returning();

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to update task priority",
    });
  }

  await publishEvent("task.priority_changed", { /* ... */ });

  return updatedTask;
}

export default updateTaskPriority;
```
### Acceptance criteria
- The file default-exports updateTaskEstimatedMinutes with named-object args
- 404 on missing task and 500 on failed update, matching the sibling's messages
- publishEvent is neither imported nor called
- No other file is created or modified
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
    "publishes_event": {
      "type": "boolean"
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "created",
    "publishes_event",
    "summary"
  ]
}
```
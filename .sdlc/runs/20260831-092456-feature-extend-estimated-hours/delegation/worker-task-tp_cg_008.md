## Task tp_cg_008 — codegen / existing_file_edit
Module: api-write
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

Edit ONLY apps/api/src/task/index.ts. Register a new route PUT /estimated-minutes/:id immediately AFTER the existing .put("/priority/:id", ...) chain link, mirroring its structure exactly (see the input).

The new link must be, in this exact order: describeRoute with operationId "updateTaskEstimatedMinutes", tags ["Tasks"], description "Update only the estimated minutes of a task", and a 200 response described as "Task estimated minutes updated successfully" with schema resolver(taskSchema); then validator("param", v.object({ id: v.string() })); then validator("json", v.object({ estimatedMinutes: estimatedMinutesSchema })); then workspaceAccess.fromTask(); then requireWorkspacePermission({ task: ["update"] }); then requireEntitlement; then an async handler that reads id from c.req.valid("param"), estimatedMinutes from c.req.valid("json"), currentUserId from c.get("userId"), calls updateTaskEstimatedMinutes({ id, estimatedMinutes, currentUserId }) and returns c.json(task).

Also add two imports: the default import updateTaskEstimatedMinutes from "./controllers/update-task-estimated-minutes", and add estimatedMinutesSchema to the EXISTING named import from "./validate-task-fields" (which currently imports VALID_PRIORITIES). Keep import ordering consistent with the file. Change nothing else — do not touch any other route.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/api/src/task/index.ts (the /priority/:id link, exact current text)
_Included because: The exact structure to mirror and the exact insertion point — your new link goes directly after this one._

```
  .put(
    "/priority/:id",
    describeRoute({
      operationId: "updateTaskPriority",
      tags: ["Tasks"],
      description: "Update only the priority of a task",
      responses: {
        200: {
          description: "Task priority updated successfully",
          content: {
            "application/json": { schema: resolver(taskSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator("json", v.object({ priority: v.picklist(VALID_PRIORITIES) })),
    workspaceAccess.fromTask(),
    requireWorkspacePermission({ task: ["update"] }),
    requireEntitlement,
    async (c) => {
      const { id } = c.req.valid("param");
      const { priority } = c.req.valid("json");
      const currentUserId = c.get("userId");

      const task = await updateTaskPriority({ id, priority, currentUserId });

      return c.json(task);
    },
  )
  .put(
    "/assignee/:id",
```

#### apps/api/src/task/index.ts (existing imports, relevant lines)
_Included because: Shows the existing import of updateTaskPriority and the existing named import from ./validate-task-fields that you must extend._

```
import updateTaskPriority from "./controllers/update-task-priority";
import updateTaskStatus from "./controllers/update-task-status";
import updateTaskTitle from "./controllers/update-task-title";
import { VALID_PRIORITIES } from "./validate-task-fields";
```
### Acceptance criteria
- PUT /estimated-minutes/:id is registered directly after /priority/:id
- The middleware order is describeRoute, param validator, json validator, workspaceAccess.fromTask, requireWorkspacePermission({ task: ["update"] }), requireEntitlement, handler
- The json validator uses the imported estimatedMinutesSchema rather than an inline duplicate
- Both imports are added and no other route is modified
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
    "route_path": {
      "type": "string"
    },
    "imports_added": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "edited",
    "route_path",
    "imports_added",
    "summary"
  ]
}
```
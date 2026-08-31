## Task tp_cg_006 — codegen / existing_file_edit
Module: api-read
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

Edit ONLY apps/api/src/task/controllers/get-tasks.ts. In the `taskSelection` object, add this entry immediately after the priority entry:

    estimatedMinutes: taskTable.estimatedMinutes,

taskSelection is an explicit column allowlist and it is what populates columns[].tasks[], archivedTasks[] and plannedTasks[] — the exact arrays the board column-header rollup sums over. Omitting it makes the rollup sum a field that is always undefined. Change nothing else: do not touch the filters, the ordering, the label or external-link queries, or the pagination.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/api/src/task/controllers/get-tasks.ts (exact current taskSelection)
_Included because: The explicit allowlist to extend, and the exact insertion point._

```
  const taskSelection = {
    id: taskTable.id,
    title: taskTable.title,
    number: taskTable.number,
    description: taskTable.description,
    status: taskTable.status,
    priority: taskTable.priority,
    startDate: taskTable.startDate,
    dueDate: taskTable.dueDate,
    position: taskTable.position,
    createdAt: taskTable.createdAt,
    userId: taskTable.userId,
    assigneeName: userTable.name,
    assigneeId: userTable.id,
    assigneeImage: userTable.image,
    projectId: taskTable.projectId,
  };
```
### Acceptance criteria
- taskSelection includes estimatedMinutes: taskTable.estimatedMinutes
- It is placed directly after priority
- Filters, ordering, pagination and the label/external-link queries are unchanged
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
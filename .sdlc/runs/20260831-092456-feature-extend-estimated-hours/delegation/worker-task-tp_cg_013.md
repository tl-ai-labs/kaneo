## Task tp_cg_013 — codegen / existing_file_edit
Module: i18n
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

Edit ONLY i18n/en-US.json. Add static keys, matching the surrounding style of the existing dueDate and startDate popover entries exactly.

Under tasks.popover, add an "estimatedHours" object with these five keys:
  label            -> "Estimate"
  placeholder      -> "Hours, e.g. 2.5"
  clear            -> "Clear estimate"
  updateSuccess    -> "Task estimate updated successfully"
  updateError      -> "Failed to update task estimate"

Under tasks.kanban (which currently holds only "addTask"), add:
  estimatedHoursRollup -> "Total estimate"

Do NOT touch i18n/schema.json. Do NOT edit any other locale file — a later step propagates these keys. Preserve the file's existing key ordering and indentation, and keep it valid JSON. Change nothing else.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### i18n/en-US.json (tasks.popover, current, abridged)
_Included because: The style and nesting to match. Note dueDate/startDate each carry updateSuccess, updateError and clear._

```
"popover": {
  "assignee": { "unassigned": "Unassigned", "updateError": "Failed to update task assignee" },
  "status": { "updateError": "Failed to update task status" },
  "priority": { "updateError": "Failed to update task priority" },
  "dueDate": {
    "updateSuccess": "Task due date updated successfully",
    "updateError": "Failed to update task due date",
    "clear": "Clear date"
  },
  "startDate": {
    "updateSuccess": "Task start date updated successfully",
    "updateError": "Failed to update task start date",
    "clear": "Clear start date"
  },
  "labels": { "...": "..." }
}
```

#### i18n/en-US.json (tasks.kanban, current, complete)
_Included because: The whole current kanban object — add one key to it._

```
"kanban": {
  "addTask": "Add task"
}
```
### Acceptance criteria
- tasks.popover.estimatedHours exists with all five keys
- tasks.kanban.estimatedHoursRollup exists
- The file is still valid JSON with existing keys and ordering preserved
- No other locale file and not schema.json were touched
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
    "keys_added": {
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
    "keys_added",
    "summary"
  ]
}
```
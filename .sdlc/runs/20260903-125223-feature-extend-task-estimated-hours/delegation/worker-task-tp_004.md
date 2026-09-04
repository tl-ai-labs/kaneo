## Task tp_004 — codegen / service_method
Module: api-task
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Edit apps/api/src/task/controllers/create-task.ts ONLY. Read .sdlc/runs/20260903-125223-feature-extend-task-estimated-hours/change_plan.md section 4.4 and apply exactly that change: createTask takes an OBJECT parameter, so add `estimatedMinutes?: number | null` to both the destructured params and the inline type, and insert `estimatedMinutes: estimatedMinutes ?? null` in the .values({...}) object. Do not reorder existing properties. Do not touch any other file. Do not run tests.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- estimatedMinutes?: number | null added to the object param type
- values() inserts estimatedMinutes: estimatedMinutes ?? null
- No existing property reordered or renamed
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "artifact_path": {
      "type": "string"
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "artifact_path",
    "summary"
  ]
}
```
## Task tp_006 — codegen / service_method
Module: api-task
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Edit apps/api/src/task/controllers/get-tasks.ts ONLY. Read .sdlc/runs/20260903-125223-feature-extend-task-estimated-hours/change_plan.md section 4.6 and apply exactly that change: add `estimatedMinutes: taskTable.estimatedMinutes,` to the `taskSelection` object (an explicit column whitelist), positioned as 4.6 specifies. The three `...task` spreads later in the file then propagate it automatically — do not modify them. Do not touch any other file. Do not run tests.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- taskSelection includes estimatedMinutes: taskTable.estimatedMinutes
- The ...task spread sites are unmodified
- No other file modified
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
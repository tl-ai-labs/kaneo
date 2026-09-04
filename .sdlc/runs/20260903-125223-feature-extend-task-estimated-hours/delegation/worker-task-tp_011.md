## Task tp_011 — codegen / api_client
Module: web-data
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Edit apps/web/src/fetchers/task/update-task.ts ONLY. Read .sdlc/runs/20260903-125223-feature-extend-task-estimated-hours/change_plan.md section 4.11 and apply exactly that change: add `estimatedMinutes: task.estimatedMinutes ?? null,` to the json body of the PUT. This is required because every drag-reorder, archive and inline edit round-trips the whole task through this one fetcher, so omitting the field would silently clear the estimate. Keep using the typed @kaneo/libs client. Do not touch any other file. Do not run tests.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- The PUT json body includes estimatedMinutes: task.estimatedMinutes ?? null
- The typed client from @kaneo/libs is still used
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
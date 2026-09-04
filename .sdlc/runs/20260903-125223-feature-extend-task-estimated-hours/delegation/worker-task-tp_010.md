## Task tp_010 — codegen / dto
Module: web-data
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Edit apps/web/src/types/task/index.ts ONLY. Read .sdlc/runs/20260903-125223-feature-extend-task-estimated-hours/change_plan.md section 4.10 and apply exactly that change: add `estimatedMinutes: number | null;` to the `Task` type as a REQUIRED property (deliberately not optional, so the compiler enumerates every construction site), positioned as 4.10 specifies. Do not make it optional. Do not touch TaskLabel or TaskExternalLink. Do not run tests.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- Task has estimatedMinutes: number | null as a required (non-optional) property
- No other type modified
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
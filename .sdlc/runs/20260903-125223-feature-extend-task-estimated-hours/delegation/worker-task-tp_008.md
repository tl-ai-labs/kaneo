## Task tp_008 — codegen / dto
Module: api-task
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Edit apps/api/src/schemas.ts ONLY. Read .sdlc/runs/20260903-125223-feature-extend-task-estimated-hours/change_plan.md section 4.8 and apply exactly that change: add `estimatedMinutes: v.nullable(v.number()),` to `taskSchema` (the object at line 25 used by resolver() for OpenAPI responses), positioned as 4.8 specifies. Do not modify activitySchema or any other exported schema. Do not run tests.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- taskSchema includes estimatedMinutes: v.nullable(v.number())
- No other exported schema modified
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
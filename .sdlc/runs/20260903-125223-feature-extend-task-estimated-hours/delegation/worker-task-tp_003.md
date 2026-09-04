## Task tp_003 — codegen / dto
Module: api-task
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create the NEW file apps/api/src/task/estimate-schema.ts. Read .sdlc/runs/20260903-125223-feature-extend-task-estimated-hours/change_plan.md sections 4.3 and 5 and implement exactly what they specify. This module must import ONLY from 'valibot' — it must NOT import the database, any schema table, or anything from ../database, because a unit test imports it in a process with no database. Export the bounds constants and the Valibot estimate schema described in 4.3. Do not modify any other file. Do not run tests.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- File imports only from valibot
- No import of ../database or any drizzle table
- Exports the estimate Valibot schema and min/max bound constants per change_plan 4.3
- Schema accepts integers 1..2147483647 and rejects 0, negatives, non-integers, and 2147483648
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
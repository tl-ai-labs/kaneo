## Task tp_001 — codegen / entity
Module: db
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Edit apps/api/src/database/schema.ts ONLY. Read .sdlc/runs/20260903-125223-feature-extend-task-estimated-hours/change_plan.md section 4.1 and apply exactly that change: add a nullable integer column `estimatedMinutes: integer("estimated_minutes")` to `taskTable`, placed exactly where 4.1 says. Do not add a default, do not add NOT NULL, do not add an index, do not touch any other table or file. `integer` is already imported. Do not run any tests or build.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- taskTable contains estimatedMinutes: integer("estimated_minutes") with no default and no notNull
- No other table in schema.ts is modified
- No index added for the new column
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
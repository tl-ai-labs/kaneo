## Task tp_002 — codegen / migration
Module: db
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Generate the Drizzle migration for the new task.estimated_minutes column. Read .sdlc/runs/20260903-125223-feature-extend-task-estimated-hours/change_plan.md section 6 first and follow it exactly. Run: pnpm --filter @kaneo/api db:generate (non-interactive; it must not prompt because the change is purely additive). Then print the generated SQL file. The generated statement must be exactly one ALTER TABLE "task" ADD COLUMN "estimated_minutes" integer; with no NOT NULL, no DEFAULT, no backfill. Then run `git status --short apps/api/drizzle` and confirm migrations 0000 through 0042 show NO diff. If any pre-existing migration was modified, revert it and report failure. Do not run tests.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- Exactly one new .sql migration file is created, numbered 0043
- Its content is a single additive ALTER TABLE ... ADD COLUMN "estimated_minutes" integer statement
- Migrations 0000-0042 show no git diff
- drizzle/meta/_journal.json gains exactly one entry
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
    "sql": {
      "type": "string"
    },
    "untouched_prior_migrations": {
      "type": "boolean"
    }
  },
  "required": [
    "artifact_path",
    "sql",
    "untouched_prior_migrations"
  ]
}
```
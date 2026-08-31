## Task tp_cg_002 — codegen / migration
Module: api-schema
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

Generate the Drizzle migration for the estimatedMinutes column that was just added to taskTable.

Run exactly this from the repo root:

  pnpm --filter @kaneo/api db:generate

The tool writes three things together: apps/api/drizzle/00NN_<tag>.sql, apps/api/drizzle/meta/00NN_snapshot.json, and a new entry in apps/api/drizzle/meta/_journal.json. NEVER hand-write or hand-edit any of those three — if the command fails, report the failure rather than writing the files yourself.

There are currently 43 .sql files, so expect 0043_<tag>.sql to appear. After it runs, read the generated .sql and confirm it contains exactly one statement:

  ALTER TABLE "task" ADD COLUMN "estimated_minutes" integer;

It must NOT contain NOT NULL, a DEFAULT, a DROP, or any statement touching another table. Report the migration tag and the exact SQL text you found. If the SQL contains anything beyond that single ALTER, report it and do not attempt to fix it.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- The migration was produced by pnpm --filter @kaneo/api db:generate, not hand-written
- A new .sql, a new meta snapshot and a new _journal.json entry all exist
- The SQL adds estimated_minutes as a nullable integer with no default
- No other table is touched
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "command_succeeded": {
      "type": "boolean"
    },
    "migration_tag": {
      "type": "string"
    },
    "sql_text": {
      "type": "string"
    },
    "extra_statements": {
      "type": "boolean"
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "command_succeeded",
    "migration_tag",
    "sql_text",
    "extra_statements",
    "summary"
  ]
}
```
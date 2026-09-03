## Task tp_cg_002 — codegen / migration
Module: api-database
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Generate the Drizzle migration for the `wipLimit` column that was just added to `columnTable` in apps/api/src/database/schema.ts. Migrations are NEVER hand-written in this repo.

Run exactly: `pnpm --filter @kaneo/api db:generate`

Then INSPECT the emitted .sql file and report its full contents in the migration_sql field. It must contain exactly one statement: ALTER TABLE "column" ADD COLUMN "wip_limit" integer;

If the emitted SQL contains NOT NULL, DEFAULT, DROP, ALTER COLUMN, CREATE TABLE, or touches any table other than "column", STOP and report success=false in your summary — do not fix it by hand and do not delete it.

Drizzle chooses the filename suffix; do not invent or rename it. Migrations 0000-0042 are immutable: do not read, edit, rename or reorder them. Do not edit schema.ts. Spec: .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md section 3.2.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md
_Included because: authoritative spec fragment_

```
Section 3.2 Migration defines the expected artifacts (0043_*.sql, meta/0043_snapshot.json, appended _journal.json entry) and the inspection gate.
```

#### apps/api/drizzle/meta/_journal.json
_Included because: journal gains one appended entry_

```
Last entry is idx 42, tag 0042_previous_the_executioner. The new entry must be idx 43.
```
### Acceptance criteria
- A new apps/api/drizzle/0043_*.sql exists and was produced by drizzle-kit, not hand-written
- The .sql contains exactly one ALTER TABLE "column" ADD COLUMN "wip_limit" integer statement
- The .sql contains no NOT NULL, DEFAULT, DROP, ALTER COLUMN or CREATE TABLE
- apps/api/drizzle/meta/0043_snapshot.json was created and _journal.json gained one idx:43 entry
- No migration 0000-0042 was modified
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "files_changed": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "migration_sql": {
      "type": "string"
    },
    "summary": {
      "type": "string"
    },
    "verified": {
      "type": "string"
    }
  },
  "required": [
    "files_changed",
    "migration_sql",
    "summary"
  ]
}
```
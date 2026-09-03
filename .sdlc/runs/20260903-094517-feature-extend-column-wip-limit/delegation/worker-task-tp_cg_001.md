## Task tp_cg_001 — codegen / entity
Module: api-database
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Edit apps/api/src/database/schema.ts. In the `columnTable` pgTable definition, insert exactly one new line between the `isFinal:` line and the `createdAt:` line:

    wipLimit: integer("wip_limit"),

Nullable: no .notNull(), no .default(). `integer` is already imported (it backs `position`) so do NOT add an import. Do NOT touch the table's index tuple `index("column_projectId_idx").on(table.projectId)`. Do NOT modify any other table in this file. Do NOT edit relations.ts. Change exactly one line in exactly one file. Spec: .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md section 3.1.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md
_Included because: authoritative spec fragment_

```
Section 3.1 Drizzle column definition (lines 94-110) gives the exact three-line context block to match.
```

#### apps/api/src/database/schema.ts
_Included because: file to edit_

```
columnTable is defined around line 342; isFinal is at ~line 358 and createdAt at ~line 360.
```
### Acceptance criteria
- apps/api/src/database/schema.ts contains the line `wipLimit: integer("wip_limit"),` inside columnTable
- The new field has no .notNull() and no .default()
- No import statement was added or changed
- No file other than apps/api/src/database/schema.ts was modified
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
    "summary": {
      "type": "string"
    },
    "verified": {
      "type": "string"
    }
  },
  "required": [
    "files_changed",
    "summary"
  ]
}
```
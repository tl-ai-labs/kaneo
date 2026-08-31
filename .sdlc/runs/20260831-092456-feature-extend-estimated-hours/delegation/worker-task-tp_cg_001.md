## Task tp_cg_001 — codegen / existing_file_edit
Module: api-schema
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

Edit ONLY apps/api/src/database/schema.ts. In the taskTable definition, add a nullable integer column immediately after the priority line:

    estimatedMinutes: integer("estimated_minutes"),

It must be nullable: no .notNull(), no .default(). The `integer` helper is ALREADY imported from drizzle-orm/pg-core, so do not touch the import block. Do not touch the index list, any other table, or any other file. Make no other change of any kind.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/api/src/database/schema.ts (taskTable columns, exact current text)
_Included because: The precise insertion point. Add the new line directly after `priority`._

```
    priority: text("priority").default("low").notNull(),
    startDate: timestamp("start_date", { mode: "date" }),
    dueDate: timestamp("due_date", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("task_projectId_idx").on(table.projectId),
    index("task_dueDate_idx").on(table.dueDate),
    index("task_assigneeId_idx").on(table.userId),
    index("task_columnId_idx").on(table.columnId),
    unique("task_project_number_unique").on(table.projectId, table.number),
  ],
);
```
### Acceptance criteria
- taskTable contains estimatedMinutes: integer("estimated_minutes") with no notNull and no default
- The line sits immediately after the priority column
- The drizzle-orm/pg-core import block is unchanged
- No other file is modified
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "edited": {
      "type": "boolean"
    },
    "line_added": {
      "type": "string"
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "edited",
    "line_added",
    "summary"
  ]
}
```
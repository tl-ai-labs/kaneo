## Task tp_pkt_001 — codegen / existing_file_edit
Module: api-schema
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
IMPORTANT: do NOT explore the repository and do NOT read any file. Everything you need is in `inputs` below (an earlier attempt in this run burned its whole budget wandering the file tree and was killed). Make exactly ONE file write, to the artifact path named below, and ZERO file reads. Do not create, modify or delete any other file.

Edit apps/api/src/database/schema.ts. Inside the `columnTable` pgTable definition ONLY, add one nullable integer column immediately after the existing `isFinal` line and before `createdAt`:

    wipLimit: integer("wip_limit"),

Rules: `integer` is already imported from "drizzle-orm/pg-core" — do NOT add or reorder imports. No .default(), no .notNull(), no index, no constraint. Change nothing else anywhere in the file. Implements FR-1 and NFR-1.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/api/src/database/schema.ts
_Included because: The columnTable definition (lines 342-366) — the only region of this 1173-line file you may touch._

```
export const columnTable = pgTable(
  "column",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    position: integer("position").notNull().default(0),
    icon: text("icon"),
    color: text("color"),
    isFinal: boolean("is_final").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("column_projectId_idx").on(table.projectId)],
);
```

#### apps/api/src/database/schema.ts
_Included because: Existing import block — proves `integer` is already imported, so no import edit is needed._

```
import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  customType,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
```
### Acceptance criteria
- columnTable contains exactly one new line: wipLimit: integer("wip_limit"),
- The new column is nullable: no .notNull(), no .default(), no constraint
- The import block at the top of the file is byte-identical to before
- No other table, column or line in schema.ts is modified
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
      "type": "string",
      "description": "one sentence, what changed"
    }
  },
  "required": [
    "artifact_path",
    "summary"
  ]
}
```
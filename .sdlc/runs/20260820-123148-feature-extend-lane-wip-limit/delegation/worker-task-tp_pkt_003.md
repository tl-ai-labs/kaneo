## Task tp_pkt_003 — codegen / existing_file_edit
Module: api-column
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
IMPORTANT: do NOT explore the repository and do NOT read any file. Everything you need is in `inputs` below. Make exactly ONE file write, to the artifact path named below, and ZERO file reads. Do not create, modify or delete any other file.

Edit apps/api/src/column/controllers/update-column.ts (full current content in inputs). Two changes, nothing else:

1. Add `wipLimit?: number | null;` to the `data` parameter type, after `isFinal?: boolean;`.
2. In the `.set({...})` object add, after the existing isFinal spread, exactly:

    ...(data.wipLimit !== undefined && { wipLimit: data.wipLimit }),

This is load-bearing: it must use the same `!== undefined` guard as the sibling fields so that an explicit `null` CLEARS the limit while an omitted key leaves the stored value untouched. Do not "simplify" it to a truthiness check. Implements FR-5.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/api/src/column/controllers/update-column.ts
_Included because: Full current content of the file you must edit._

```
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable } from "../../database/schema";

async function updateColumn(
  id: string,
  data: {
    name?: string;
    icon?: string | null;
    color?: string | null;
    isFinal?: boolean;
  },
) {
  const existing = await db.query.columnTable.findFirst({
    where: eq(columnTable.id, id),
  });

  if (!existing) {
    throw new HTTPException(404, { message: "Column not found" });
  }

  const [updated] = await db
    .update(columnTable)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.icon !== undefined && { icon: data.icon }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.isFinal !== undefined && { isFinal: data.isFinal }),
    })
    .where(eq(columnTable.id, id))
    .returning();

  if (!updated) {
    throw new HTTPException(500, { message: "Failed to update column" });
  }

  return updated;
}

export default updateColumn;
```
### Acceptance criteria
- data type includes wipLimit?: number | null
- The .set() object contains ...(data.wipLimit !== undefined && { wipLimit: data.wipLimit }),
- The guard is !== undefined, not a truthiness or != null check
- The 404 not-found and 500 failed-update branches are unchanged
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
## Task tp_pkt_002 — codegen / existing_file_edit
Module: api-column
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
IMPORTANT: do NOT explore the repository and do NOT read any file. Everything you need is in `inputs` below. Make exactly ONE file write, to the artifact path named below, and ZERO file reads. Do not create, modify or delete any other file.

Edit apps/api/src/column/controllers/create-column.ts (full current content in inputs). Two changes, nothing else:

1. Add `wipLimit` to the destructured parameter object and to its inline type as `wipLimit?: number | null;` (alongside the existing `isFinal?: boolean;`).
2. In the `db.insert(columnTable).values({...})` call, add `wipLimit: wipLimit ?? null,` after the existing `isFinal: isFinal ?? false,` line.

Do NOT change toSlug, the reserved-slug check, the duplicate-slug check, the position computation, or any error. Implements FR-4.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/api/src/column/controllers/create-column.ts
_Included because: Full current content of the file you must edit._

```
import { eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable } from "../../database/schema";
import { VIRTUAL_STATUSES } from "../../task/validate-task-fields";

export function toSlug(name: string): string {
  const slug = name
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return /[\p{L}\p{N}]/u.test(slug) ? slug : "";
}

async function createColumn({
  projectId,
  name,
  icon,
  color,
  isFinal,
}: {
  projectId: string;
  name: string;
  icon?: string;
  color?: string;
  isFinal?: boolean;
}) {
  const slug = toSlug(name);

  if (!slug) {
    throw new HTTPException(400, {
      message: "Column name must contain at least one alphanumeric character",
    });
  }

  if ((VIRTUAL_STATUSES as readonly string[]).includes(slug)) {
    throw new HTTPException(409, {
      message: `Column slug "${slug}" is reserved for virtual task statuses`,
    });
  }

  const existing = await db
    .select({ id: columnTable.id })
    .from(columnTable)
    .where(
      sql`${columnTable.projectId} = ${projectId} AND ${columnTable.slug} = ${slug}`,
    );

  if (existing.length > 0) {
    throw new HTTPException(409, {
      message: `Column with slug "${slug}" already exists in this project`,
    });
  }

  const [maxPos] = await db
    .select({
      maxPosition: sql<number>`COALESCE(MAX(${columnTable.position}), -1)`,
    })
    .from(columnTable)
    .where(eq(columnTable.projectId, projectId));

  const position = (maxPos?.maxPosition ?? -1) + 1;

  const [created] = await db
    .insert(columnTable)
    .values({
      projectId,
      name,
      slug,
      position,
      icon: icon || null,
      color: color || null,
      isFinal: isFinal ?? false,
    })
    .returning();

  if (!created) {
    throw new HTTPException(500, { message: "Failed to create column" });
  }

  return created;
}

export default createColumn;
```
### Acceptance criteria
- createColumn's parameter type includes wipLimit?: number | null
- The insert .values() object includes wipLimit: wipLimit ?? null
- toSlug, the VIRTUAL_STATUSES check, the duplicate-slug check and the position query are unchanged
- No new import is added
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
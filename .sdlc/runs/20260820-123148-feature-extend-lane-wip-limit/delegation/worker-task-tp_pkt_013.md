## Task tp_pkt_013 — tests / test_add
Module: api-column
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
IMPORTANT: do NOT explore the repository and do NOT read any file. Everything you need is in `inputs` below (an earlier attempt in this run burned its whole budget wandering the file tree and was killed). Make exactly ONE file write, to the artifact path named below, and ZERO file reads. Do not create, modify or delete any other file.

Create tests/api/column/create-column.test.ts — a vitest unit test for the createColumn controller, proving the persistence half of acceptance criterion AC-2.

Follow the house db-mocking pattern in the reference test in inputs EXACTLY. As the controller source in inputs shows, createColumn calls `db.select()` TWICE (first a duplicate-slug lookup that must resolve to [], then a MAX(position) lookup that must resolve to [{ maxPosition: -1 }]) and then `db.insert(...).values(...).returning()`. Mock all three; use mockSelect.mockReturnValueOnce(...) twice so the two select calls resolve differently. Assert on the argument passed to `.values()`.

Two tests, no more:
1. `createColumn({ projectId: "p1", name: "In Progress", wipLimit: 3 })` -> values called with an object whose wipLimit is 3.
2. `createColumn({ projectId: "p1", name: "In Progress" })` (wipLimit omitted) -> values called with an object whose wipLimit is null, proving the `wipLimit ?? null` default.

Import from "vitest" only. Relative import depth is three levels up (tests/api/column/ -> repo root). Write only this one file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### tests/api/time-entry/update-time-entry.test.ts
_Included because: undefined_

```
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

const mockSelect = vi.fn();
const mockUpdate = vi.fn();

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

import updateTimeEntry from "../../../apps/api/src/time-entry/controllers/update-time-entry";

function makeSelectMock(rows: unknown[]) {
  const chain: Record<string, Mock> = {
    from: vi.fn(() => chain),
    where: vi.fn(() => Promise.resolve(rows)),
  };
  return chain;
}

function makeUpdateMock(updatedRow: unknown) {
  const returning = vi.fn(() => Promise.resolve([updatedRow]));
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  return { set, where, returning };
}

describe("updateTimeEntry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
```

#### apps/api/src/column/controllers/create-column.ts
_Included because: undefined_

```
import { eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable } from "../../database/schema";
import { VIRTUAL_STATUSES } from "../../task/validate-task-fields";

export function toSlug(name: string): string { /* slugifies; "In Progress" -> "in-progress" */ }

async function createColumn({
  projectId, name, icon, color, isFinal, wipLimit,
}: {
  projectId: string; name: string; icon?: string; color?: string; isFinal?: boolean; wipLimit?: number | null;
}) {
  const slug = toSlug(name);
  if (!slug) { throw new HTTPException(400, { message: "Column name must contain at least one alphanumeric character" }); }
  if ((VIRTUAL_STATUSES as readonly string[]).includes(slug)) { throw new HTTPException(409, { ... }); }

  // FIRST db.select() call - duplicate slug lookup, must resolve to []
  const existing = await db
    .select({ id: columnTable.id })
    .from(columnTable)
    .where(sql`...`);
  if (existing.length > 0) { throw new HTTPException(409, { ... }); }

  // SECOND db.select() call - max position lookup, must resolve to [{ maxPosition: -1 }]
  const [maxPos] = await db
    .select({ maxPosition: sql<number>`COALESCE(MAX(${columnTable.position}), -1)` })
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
      wipLimit: wipLimit ?? null,
    })
    .returning();

  if (!created) { throw new HTTPException(500, { message: "Failed to create column" }); }
  return created;
}

export default createColumn;

```
### Acceptance criteria
- File tests/api/column/create-column.test.ts exists and contains exactly two it() blocks.
- The database module is mocked before the controller import, exposing select and insert.
- The two db.select() calls are mocked independently: duplicate-slug lookup resolves [], max-position lookup resolves [{ maxPosition: -1 }].
- Test 2 asserts the values() argument has wipLimit === null when wipLimit is omitted.
- vitest runs the file green.
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
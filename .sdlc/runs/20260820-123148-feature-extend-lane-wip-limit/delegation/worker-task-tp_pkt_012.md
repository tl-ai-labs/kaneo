## Task tp_pkt_012 — tests / test_add
Module: api-column
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
IMPORTANT: do NOT explore the repository and do NOT read any file. Everything you need is in `inputs` below (an earlier attempt in this run burned its whole budget wandering the file tree and was killed). Make exactly ONE file write, to the artifact path named below, and ZERO file reads. Do not create, modify or delete any other file.

Create tests/api/column/update-column.test.ts — a vitest unit test for the updateColumn controller, proving acceptance criterion AC-3.

Follow the house db-mocking pattern shown in the reference test in inputs EXACTLY: declare vi.fn()s at module top, `vi.mock("../../../apps/api/src/database", () => ({ default: { ... } }))` BEFORE the import of the controller, then import the controller. Note updateColumn uses `db.query.columnTable.findFirst` for its existence check and `db.update(...).set(...).where(...).returning()` for the write, so your mock's default export needs BOTH a `query.columnTable.findFirst` AND an `update`. Make findFirst resolve to a truthy existing column row so the 404 branch is not taken.

Assert on what `.set()` was called with. Three tests, no more:
1. `updateColumn("col-1", { wipLimit: 5 })` -> set called with an object whose wipLimit is 5.
2. `updateColumn("col-1", { wipLimit: null })` -> set called with an object whose wipLimit is null (explicit clear).
3. `updateColumn("col-1", { name: "Renamed" })` -> set called with an object that does NOT have the key wipLimit at all (use `expect(arg).not.toHaveProperty("wipLimit")`), proving an omitted field leaves the stored limit untouched.

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

#### apps/api/src/column/controllers/update-column.ts
_Included because: undefined_

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
    wipLimit?: number | null;
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
      ...(data.wipLimit !== undefined && { wipLimit: data.wipLimit }),
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
- File tests/api/column/update-column.test.ts exists and contains exactly three it() blocks.
- The database module is mocked before the controller import, exposing query.columnTable.findFirst and update.
- Test 3 asserts the set() argument has no wipLimit property.
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
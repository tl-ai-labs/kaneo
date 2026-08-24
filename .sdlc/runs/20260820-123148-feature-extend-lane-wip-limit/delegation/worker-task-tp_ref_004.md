## Task tp_ref_004 — debug / lint_fix
Module: api-column
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Lint cleanup in ONE file: tests/api-integration/column-wip-limit.test.ts. Do not touch any other file. Do not explore the repo.

FAILURE MODE: `npx biome check` reports three lint/suspicious/noExplicitAny errors at lines 205, 215 and 221, plus a formatting violation. Current lines 199-225 are in inputs.

FIX 1 — replace the three `any` usages with a real local type. Near the top of the file (after the imports) declare:

type BoardColumn = {
  id: string;
  columnId: string;
  slug: string;
  name: string;
  icon: string | null;
  isFinal: boolean;
  wipLimit: number | null;
  tasks: unknown[];
};

type Board = { columns: BoardColumn[] };

Then change line 205 to `const board = (await tasksResponse.json()) as Board;` and line 206 to `const columns = board.columns;` — DELETE the defensive `Array.isArray(board) ? board : (board.columns ?? [])` fallback entirely; the endpoint always returns an object with a columns array, and the fallback would silently pass on a wrong shape. Change the two `.find((c: any) => ...)` callbacks to `.find((c: BoardColumn) => ...)`.

Because `.find()` can return undefined, TypeScript will complain about the subsequent `matchedColumn.id` / `defaultColumn.id` accesses. After each `expect(<x>).toBeDefined();` add a narrowing guard line `if (!<x>) throw new Error("<x> not found");` so the following property accesses typecheck without a non-null assertion. Do NOT use the `!` non-null operator anywhere — biome forbids it.

FIX 2 — emit the whole file Biome-formatted: 2-space indent, double quotes, trailing commas, and no line over 80 characters (the long `as typeof schema.columnTable.$inferSelect` casts must wrap).

Keep all four it() blocks and every existing assertion intact — this is a lint fix, not a behaviour change. Afterwards `npx biome check tests/api-integration/column-wip-limit.test.ts` must report zero errors and zero warnings.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### tests/api-integration/column-wip-limit.test.ts
_Included because: undefined_

```
(current lines 199-227)
    const createdColumn = (await createResponse.json()) as typeof schema.columnTable.$inferSelect;

    const tasksResponse = await app.request(`/api/task/tasks/${project.id}`, {
      method: "GET",
    });
    expect(tasksResponse.status).toBe(200);
    const board = (await tasksResponse.json()) as any;
    const columns = Array.isArray(board) ? board : (board.columns ?? []);

    expect(columns.length).toBeGreaterThan(0);

    for (const col of columns) {
      expect(col.id).toBe(col.slug);
      expect(col.id).not.toBe(col.columnId);
    }

    const matchedColumn = columns.find((c: any) => c.columnId === createdColumn.id);
    expect(matchedColumn).toBeDefined();
    expect(matchedColumn.id).toBe(matchedColumn.slug);
    expect(matchedColumn.id !== matchedColumn.columnId).toBe(true);
    expect(matchedColumn.wipLimit).toBe(4);

    const defaultColumn = columns.find((c: any) => c.columnId !== createdColumn.id);
    expect(defaultColumn).toBeDefined();
    expect(defaultColumn.id).toBe(defaultColumn.slug);
    expect(defaultColumn.id !== defaultColumn.columnId).toBe(true);
    expect(defaultColumn.wipLimit).toBeNull();
  });
});
```
### Acceptance criteria
- No `any` and no `!` non-null assertion remains in the file.
- The Array.isArray defensive fallback is gone; board.columns is read directly via a BoardColumn/Board type.
- npx biome check on the file reports zero errors and zero warnings.
- pnpm typecheck passes.
- All four it() blocks and their assertions are preserved.
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
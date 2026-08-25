## Task tp_ref_007 — debug / test_fix
Module: api-column
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Fix a response-shape bug in the LAST test ("projects column slug as id, uuid as columnId, and wipLimit on tasks endpoint (AC-12)") in tests/api-integration/column-wip-limit.test.ts. Edit ONLY that file.

PROBLEM: GET /api/task/tasks/:projectId returns { data: { id, name, slug, icon, description, isPublic, workspaceId, columns, archivedTasks, plannedTasks }, pagination: {...} }. The test declares `type Board = { columns: BoardColumn[] }` and reads `board.columns`, which is undefined, so `columns.length` throws TypeError. The API shape is CORRECT - the test is wrong.

FIX (two edits):
1. Change the Board type to match the real envelope, e.g.:
   type Board = { data: { columns: BoardColumn[] } };
2. Change `const columns = board.columns;` to `const columns = board.data.columns;`

Leave the BoardColumn type and EVERY existing assertion exactly as they are - the assertions (col.id === col.slug, col.id !== col.columnId, matched wipLimit === 4, defaultColumn wipLimit === null) are correct and must keep passing. Do not touch the other 3 tests. Do not modify any production code under apps/api.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### tests/api-integration/column-wip-limit.test.ts
_Included because: undefined_

```
undefined
```
### Acceptance criteria
- Board type reflects the { data: { columns } } envelope
- columns is read from board.data.columns
- All existing AC-12 assertions are unchanged
- The other 3 tests are untouched
- No production code under apps/api is modified
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "files_modified": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "files_modified",
    "summary"
  ]
}
```
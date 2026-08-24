## Task tp_ref_006 — debug / test_fix
Module: api-column
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Fix a slug-collision bug in tests/api-integration/column-wip-limit.test.ts. Edit ONLY that file.

PROBLEM: all 4 tests first create a project via POST /api/project. createProject seeds DEFAULT_PROJECT_COLUMNS with slugs to-do, in-progress, in-review, done. Each test then POSTs a new column named "In Progress", which slugifies to "in-progress" and collides with the seeded default, so createColumn correctly throws HTTPException 409 ("Column with slug already exists in this project"). The 409 is CORRECT product behavior - the test names are wrong.

FIX: in every place where the test creates its OWN column via POST /api/column/:projectId, change the column name from "In Progress" to "Staging" (slug "staging"). "staging" collides with no default column slug and is not in VIRTUAL_STATUSES (["planned","archived"]). Do NOT rename the seeded default columns and do NOT touch any assertion about default columns.

IMPORTANT for the AC-12 test: it asserts on both the created column and a `defaultColumn` found via `c.columnId !== createdColumn.id` - that logic still works and must be left alone. Only the created column's `name` changes.

Do NOT weaken or remove the 409 duplicate-slug check in apps/api. Do NOT change expected status codes to accept 409. Change nothing else.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### tests/api-integration/column-wip-limit.test.ts
_Included because: undefined_

```
undefined
```
### Acceptance criteria
- Every POST /api/column/:projectId body in the file uses name "Staging" instead of "In Progress"
- No assertion expecting status 200 was changed to expect 409
- The { role: "owner" } fixture args are preserved
- No file other than tests/api-integration/column-wip-limit.test.ts is modified
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
    "occurrences_changed": {
      "type": "number"
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
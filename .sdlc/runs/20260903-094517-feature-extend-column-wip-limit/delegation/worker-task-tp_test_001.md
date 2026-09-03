## Task tp_test_001 — tests / test_unit
Module: api-column
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create tests/api/column/create-column-wip-limit.test.ts — a new Vitest unit test for createColumn's wipLimit handling. No live database.

Copy the mocking pattern from tests/api/label/delete-label.test.ts: top-level `const mockX = vi.fn()`, `vi.mock("../../../apps/api/src/database", () => ({ default: { ... } }))`, hand-built chain objects, beforeEach(vi.clearAllMocks).

.sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md section 11.1 gives the makeSelectMock / makeInsertMock helpers verbatim. NOTE: createColumn calls db.select TWICE — first the duplicate-slug probe, then the MAX(position) probe — so use mockReturnValueOnce twice per test (first []; then [{ maxPosition: -1 }]).

Three assertions:
1. createColumn({ projectId, name: "Doing", wipLimit: 5 }) -> the insert chain's .values() receives an object containing wipLimit: 5
2. createColumn({ projectId, name: "Doing" }) -> .values() receives wipLimit: null
3. createColumn({ projectId, name: "Doing", wipLimit: 1 }) -> .values() receives 1, not null (regression guard for the `||` vs `??` trap)

Run `pnpm --filter @kaneo/api test` and confirm it is green before reporting success. Do not modify any existing test file. Do not modify any source file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md
_Included because: authoritative spec fragment_

```
Section 11.1 gives the chain-mock helpers and the three assertions with their AC mapping.
```

#### tests/api/label/delete-label.test.ts
_Included because: pattern to copy_

```
Reference for vi.mock hoisting order and db chain mocking in this repo.
```

#### apps/api/src/column/controllers/create-column.ts
_Included because: system under test_

```
The system under test; now takes wipLimit?: number and inserts wipLimit: wipLimit ?? null.
```
### Acceptance criteria
- tests/api/column/create-column-wip-limit.test.ts exists and covers all three assertions
- No live PostgreSQL connection is opened; db is mocked
- pnpm --filter @kaneo/api test passes with a higher test count than the 374 baseline
- No existing test file and no source file was modified
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
    "tests_added": {
      "type": "number"
    },
    "test_run_output": {
      "type": "string"
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "files_changed",
    "summary"
  ]
}
```
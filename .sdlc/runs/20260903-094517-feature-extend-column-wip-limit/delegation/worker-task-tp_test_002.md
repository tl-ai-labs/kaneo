## Task tp_test_002 — tests / test_unit
Module: api-column
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create tests/api/column/update-column-wip-limit.test.ts — a Vitest unit test for updateColumn's wipLimit handling. No live database.

The sibling file tests/api/column/create-column-wip-limit.test.ts was just written in this same style — read it first and mirror its structure exactly (top-level vi.fn() mocks, vi.mock of ../../../apps/api/src/database declared before the import of the controller, hand-built chain helpers, beforeEach(vi.clearAllMocks)).

Mock db.query.columnTable.findFirst (resolves an existing column) and db.update. change_plan.md section 11.2 gives makeUpdateMock verbatim.

Three assertions:
1. updateColumn("col-1", { wipLimit: 5 }) -> .set() receives { wipLimit: 5 }
2. updateColumn("col-1", { wipLimit: null }) -> .set() receives { wipLimit: null }  (clear)
3. updateColumn("col-1", { name: "Doing" }) -> expect("wipLimit" in setArg).toBe(false)  (omission leaves it untouched)

Assertion 3 proves the `!== undefined` spread is correct; do NOT weaken it to a toBeUndefined check.

IMPORTANT — verification budget: verify with ONLY this fast filtered command, which takes ~2 seconds:
  pnpm --filter @kaneo/api exec vitest run --config vitest.config.ts update-column-wip-limit
Do NOT run the full `pnpm --filter @kaneo/api test` suite and do NOT run any web test — a previous packet was killed by the 9-minute worker timeout doing exactly that. Do not modify any existing test file or any source file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md
_Included because: authoritative spec fragment_

```
Section 11.2 gives makeUpdateMock and the three assertions.
```

#### tests/api/column/create-column-wip-limit.test.ts
_Included because: pattern to mirror_

```
Sibling file written moments ago in the exact target style — mirror its mock hoisting, chain helpers and describe/it shape.
```

#### apps/api/src/column/controllers/update-column.ts
_Included because: system under test_

```
System under test; .set() now includes ...(data.wipLimit !== undefined && { wipLimit: data.wipLimit }).
```
### Acceptance criteria
- tests/api/column/update-column-wip-limit.test.ts exists and covers set, clear, and omission
- The omission test asserts the property is absent from the .set() argument, not merely undefined
- The filtered vitest command passes
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
## Task tp_test_001 — tests / test_add
Module: tests
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

Create ONLY the new file tests/api/task/validate-task-fields.test.ts (create the tests/api/task directory).

This suite runs under apps/api/vitest.config.ts with environment 'node' and include ['../../tests/api/**/*.test.ts']. There is NO HTTP server and NO database available — test the exported Valibot schema directly with v.safeParse, the way the other pure tests under tests/api do.

Import { estimatedMinutesSchema, ESTIMATED_MINUTES_MAX } from '../../../apps/api/src/task/validate-task-fields' and * as v from 'valibot'.

Assert result.success is true for: 0, 60, 150, 525600, and null.
Assert result.success is false for: -1, 525601, 2.5, 0.5, the string '120', and undefined.
Also assert ESTIMATED_MINUTES_MAX === 525600.

Use describe/it/expect imported from vitest. Keep it to one describe block.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### tests/api/column/to-slug.test.ts (style reference)
_Included because: Shows the pure-unit-test idiom used throughout tests/api: direct import of the source module, no harness, no mocks._

```
import { describe, expect, it } from "vitest";
import { toSlug } from "../../../apps/api/src/column/to-slug";

describe("toSlug", () => {
  it("lowercases and hyphenates", () => {
    expect(toSlug("In Progress")).toBe("in-progress");
  });
});
```

#### apps/api/src/task/validate-task-fields.ts (the exports under test)
_Included because: The exact bindings this suite imports._

```
export const ESTIMATED_MINUTES_MAX = 525_600;

export const estimatedMinutesSchema = v.nullable(
  v.pipe(
    v.number(),
    v.integer(),
    v.minValue(0),
    v.maxValue(ESTIMATED_MINUTES_MAX),
  ),
);
```
### Acceptance criteria
- The file uses v.safeParse against estimatedMinutesSchema, with no server and no database
- All eleven listed accept/reject cases are covered
- The import path resolves to apps/api/src/task/validate-task-fields
- No other file is created or modified
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "created": {
      "type": "boolean"
    },
    "case_count": {
      "type": "integer"
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "created",
    "case_count",
    "summary"
  ]
}
```
## Task tp_test_002 — tests / test_add
Module: tests
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

Create ONLY apps/web/src/lib/format-estimated-hours.test.ts, a pure vitest suite for the module described below. It is being written in parallel, so code strictly against this contract:

  export function formatEstimatedHours(minutes: number | null | undefined): string | null
  export function sumEstimatedMinutes(tasks: ReadonlyArray<{ estimatedMinutes?: number | null }>): number

Import both from "./format-estimated-hours". Import describe, it, expect from "vitest".

formatEstimatedHours cases: 120 -> "2h"; 60 -> "1h"; 150 -> "2.5h"; 45 -> "0.75h"; and null for each of 0, -10, null, undefined.

sumEstimatedMinutes cases: [] -> 0; tasks with [120, 240] -> 360; a mix of [150, null, undefined] -> 150; all-null [null, null] -> 0.

This covers AC-6's rollup at zero, one and several estimates at the pure level. Use two describe blocks, one per function. Create no other file.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- Both functions are imported from ./format-estimated-hours and covered
- All eight formatEstimatedHours cases and all four sumEstimatedMinutes cases are present
- The rollup is asserted at zero, one and several estimates
- No other file is created
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
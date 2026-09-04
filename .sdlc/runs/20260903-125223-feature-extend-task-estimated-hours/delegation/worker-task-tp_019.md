## Task tp_019 — tests / test_unit
Module: web-ui
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create the NEW test file apps/web/src/lib/estimate.test.ts. Read .sdlc/runs/20260903-125223-feature-extend-task-estimated-hours/change_plan.md sections 2.2, 2.4 and 8.2 and write exactly those cases against ./estimate. Assert the full formatting table from 2.2 (1 -> '0.02h', 30 -> '0.5h', 90 -> '1.5h', 100 -> '1.67h', 120 -> '2h', 300 -> '5h', 6000 -> '100h', 2147483647 -> '35791394.12h', and null for 0, -5, 1.5, null, undefined). Assert parseEstimateHours('1.5') === 90 and that it rejects empty, malformed, negative, zero and out-of-range input. Assert the section 2.4 round-trip property. Assert sumEstimateMinutes over a mixed list containing nulls returns the integer total and never NaN. VERIFY WITH EXACTLY THIS COMMAND AND NOTHING BROADER: pnpm --filter @kaneo/web test -- src/lib/estimate.test.ts . Do NOT run the full web suite — running it will exceed your time budget and the run will be recorded as a failure.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- Asserts every row of the change_plan section 2.2 formatting table
- Asserts the parse round-trip property from section 2.4
- Asserts sumEstimateMinutes handles mixed nulls and never returns NaN
- The filtered command passes
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
    "tests_passed": {
      "type": "number"
    },
    "command_output_tail": {
      "type": "string"
    }
  },
  "required": [
    "artifact_path",
    "tests_passed"
  ]
}
```
## Task tp_018 — tests / test_unit
Module: api-task
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create the NEW test file tests/api/task/estimate-schema.test.ts (the tests/api/task/ directory does not exist yet — create it). Read .sdlc/runs/20260903-125223-feature-extend-task-estimated-hours/change_plan.md section 8.1 and write exactly those cases. Import estimatedMinutesSchema / estimatedMinutesFieldSchema from apps/api/src/task/estimate-schema.ts (use the correct relative path from tests/api/task/) and exercise them with valibot's safeParse. Cover the boundaries: accept 1 and 2147483647, and null via the field schema; reject 0, -5, 1.5, 2147483648. Follow the pure-function unit-test style of tests/api/column/to-slug.test.ts — no database, no HTTP, no db mocks. VERIFY WITH EXACTLY THIS COMMAND AND NOTHING BROADER: pnpm --filter @kaneo/api test -- tests/api/task/estimate-schema.test.ts . Do NOT run the full API suite — running it will exceed your time budget and the run will be recorded as a failure.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- File exists at tests/api/task/estimate-schema.test.ts
- Covers accept 1, 2147483647, null and reject 0, -5, 1.5, 2147483648
- No database import and no network access
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
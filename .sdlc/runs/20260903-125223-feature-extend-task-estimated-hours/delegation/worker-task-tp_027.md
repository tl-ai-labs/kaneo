## Task tp_027 — tests / test_unit
Module: api-mcp
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create the NEW test file tests/api/task/mcp-update-task-body.test.ts. This is a REGRESSION test for a real bug: the MCP update_task tool builds a full-document PUT via buildFullTaskUpdateBody, which previously omitted estimatedMinutes, so every MCP task edit silently NULLed the stored estimate (update-task.ts writes `estimatedMinutes ?? null`, so an omitted key becomes NULL).
Import { buildFullTaskUpdateBody } from the source at apps/api/src/mcp/tools.ts (use the correct relative path from tests/api/task/; it is now exported). The module imports only zod, so no database is involved.
Assert:
(1) THE REGRESSION GUARD — given an existing task with estimatedMinutes: 90 and a patch that does NOT mention estimatedMinutes, the returned body HAS estimatedMinutes === 90. Add a comment saying that if this key were absent the API would coerce the omission to NULL and destroy the estimate.
(2) an explicit patch value overrides existing: existing 90, patch 120 -> body 120.
(3) a cleared estimate stays cleared: existing estimatedMinutes: null, no patch key -> body.estimatedMinutes === null (NOT undefined/absent).
(4) patch explicitly clearing: existing 90, patch estimatedMinutes: null -> body 90 is NOT preserved, body is null.
(5) the other preserved fields still round-trip (spot-check title and dueDate) so this test also guards the builder's general contract.
Build a realistic `existing` object with the fields the builder requires (id, title, description, status, priority, projectId, position, startDate, dueDate, userId) or the builder will throw. Follow the pure-function style of tests/api/column/to-slug.test.ts. VERIFY WITH EXACTLY THIS COMMAND, note there is NO double-dash before the path (the double-dash form silently runs the entire suite): pnpm --filter @kaneo/api test tests/api/task/mcp-update-task-body.test.ts . Do NOT run the full API suite.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- Test imports the exported buildFullTaskUpdateBody and uses no database
- Asserts existing 90 + patch without the key -> body.estimatedMinutes === 90 (the regression guard)
- Asserts explicit patch override, cleared-stays-cleared, and explicit clear
- The filtered single-file command passes
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
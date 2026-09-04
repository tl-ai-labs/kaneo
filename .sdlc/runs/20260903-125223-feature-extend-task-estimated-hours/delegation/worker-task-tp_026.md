## Task tp_026 — debug / bug_fix_apply
Module: api-mcp
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Edit apps/api/src/mcp/tools.ts ONLY. Every other file under apps/api/src/mcp/ and all of packages/mcp/ remain OFF-LIMITS. Bug: `buildFullTaskUpdateBody` (line ~115) does read-merge-full-PUT for the MCP update_task tool. It carries title, description, status, priority, projectId, position, startDate, dueDate, userId from the existing task, but NOT estimatedMinutes. The PUT therefore omits the key, and update-task.ts writes `estimatedMinutes ?? null`, so every MCP task edit silently NULLs the stored estimate. Make exactly these three minimal changes:
(1) Carry the field: take it from `patch.estimatedMinutes` when defined, else `existing.estimatedMinutes`, and set it on the returned `body` — structurally matching the existing `if (dueDate !== undefined) body.dueDate = dueDate;` line. Preserve an explicit null (a cleared estimate must stay cleared).
(2) The body's type is `Record<string, string | number | undefined>` which cannot express null. Widen it ONLY as far as this one field needs (add `| null`). Do NOT restructure the builder or refactor any other field.
(3) Add the `export` keyword to `function buildFullTaskUpdateBody` so a unit test can import it. Change nothing else.
Do NOT add estimatedMinutes as a new MCP tool INPUT parameter — exposing it as a new MCP capability is an explicit non-goal. This fix only preserves existing data. Verify with EXACTLY: pnpm --filter @kaneo/api typecheck . Do NOT run any test suite.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- body carries estimatedMinutes from patch then existing, preserving explicit null
- Return type widened only by | null
- buildFullTaskUpdateBody is exported
- No new MCP tool input parameter added
- No other file under apps/api/src/mcp or packages/mcp modified
- pnpm --filter @kaneo/api typecheck passes
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
    },
    "exported": {
      "type": "boolean"
    }
  },
  "required": [
    "artifact_path",
    "summary",
    "exported"
  ]
}
```
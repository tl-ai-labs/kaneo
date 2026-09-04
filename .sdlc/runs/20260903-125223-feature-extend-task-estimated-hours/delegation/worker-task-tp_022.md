## Task tp_022 — tests / test_fixture_update
Module: web-ui
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Task.estimatedMinutes is now a REQUIRED property of the Task type, so every existing Task object literal must supply it. Add `estimatedMinutes: null,` to the Task fixtures in BOTH of these files and nothing else: apps/web/src/components/task/task-status-popover.test.tsx and apps/web/src/components/list-view/task-row.test.tsx. Both are allowlisted test files. Change nothing else in them — no assertions, no mocks, no imports. Read change_plan section 8.5 for context. Then run `grep -rn ": Task = {\|: Task\[\] = \[" apps/web/src` and if you find a Task literal in any file OTHER than those two, STOP and report its path in other_task_literals_found instead of editing it. VERIFY WITH EXACTLY THIS COMMAND AND NOTHING BROADER: pnpm --filter @kaneo/web test -- src/components/task/task-status-popover.test.tsx src/components/list-view/task-row.test.tsx . Do NOT run the full web suite — running it will exceed your time budget and the run will be recorded as a failure.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- estimatedMinutes: null added to the Task fixtures in both named test files
- No assertion, mock or import changed in either file
- Any Task literal found outside the allowlist is reported, not edited
- The filtered command for these two files passes
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
    "files_updated": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "other_task_literals_found": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "artifact_path",
    "files_updated",
    "other_task_literals_found"
  ]
}
```
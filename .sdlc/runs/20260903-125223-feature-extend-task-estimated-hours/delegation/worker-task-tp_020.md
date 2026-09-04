## Task tp_020 — tests / test_component
Module: web-ui
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create the NEW test file apps/web/src/components/kanban-board/column/column-header.test.tsx for the ColumnHeader named export in ./column-header. Read .sdlc/runs/20260903-125223-feature-extend-task-estimated-hours/change_plan.md section 8.3 and write exactly those cases. Follow the mocking style of apps/web/src/components/task/task-status-popover.test.tsx (vi.mock the hooks it uses — use-update-task, use-workspace-permission, the project store, and react-i18next so t returns the key). Cover: (1) a column whose tasks have MIXED null and non-null estimates renders the correct formatted total; (2) a column where every estimate is null renders NO rollup badge; (3) the total is never NaN. Task object literals MUST include estimatedMinutes because the field is now required. IMPORTANT: run ONLY this exact command to verify, never a broader one: pnpm --filter @kaneo/web test -- src/components/kanban-board/column/column-header.test.tsx . Running the full web suite will blow your time budget and cause this packet to be recorded as failed even if your file is correct.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- Covers the mixed null/non-null rollup total
- Asserts no badge renders when all estimates are null
- Task fixtures include the required estimatedMinutes property
- Only the single-file filtered command was run and it passes
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
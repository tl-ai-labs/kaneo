## Task tp_021 — tests / test_component
Module: web-ui
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create the NEW test file apps/web/src/components/task/task-estimate-popover.test.tsx for the default export in ./task-estimate-popover. Read .sdlc/runs/20260903-125223-feature-extend-task-estimated-hours/change_plan.md section 8.4 and write exactly those cases. Follow the mocking style of the sibling apps/web/src/components/task/task-status-popover.test.tsx (vi.mock use-update-task, use-workspace-permission, and react-i18next so t returns the key). Cover: (1) entering hours saves the correct MINUTE value via the mocked mutation — e.g. typing '1.5' submits estimatedMinutes: 90; (2) the clear action submits estimatedMinutes: null; (3) when canUpdateTasks() returns false the component renders its children plain and opens no popover. The input is rendered via <Input nativeInput /> so it is a real <input> reachable with getByLabelText + fireEvent.change. Task literals MUST include the required estimatedMinutes property. IMPORTANT: run ONLY this exact command to verify, never a broader one: pnpm --filter @kaneo/web test -- src/components/task/task-estimate-popover.test.tsx . Running the full web suite will blow your time budget and cause this packet to be recorded as failed even if your file is correct.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- Asserts hours input is converted to minutes before submission (1.5 -> 90)
- Asserts the clear action submits estimatedMinutes: null
- Asserts read-only mode renders children plain and opens no popover
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
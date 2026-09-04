## Task tp_023 — debug / typecheck_fix
Module: web-ui
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Fix 3 TypeScript errors caused by Task.estimatedMinutes now being a REQUIRED property. Do NOT widen the Task type to optional — that is forbidden. Edit exactly these three files and nothing else:
(1) apps/web/src/components/shared/modals/create-task-modal.tsx line ~92: the normalizeTask() helper returns Task from a Partial<Task>. Add the single line `estimatedMinutes: task.estimatedMinutes ?? null,` to the returned object, matching the shape of the sibling lines already there (`priority: task.priority ?? null,` `dueDate: task.dueDate ?? null,`). Do NOT restructure the helper or change anything else in this file.
(2) apps/web/src/components/task/task-relations.tsx line ~241 (error TS2741): the Task object literal is missing estimatedMinutes. Add `estimatedMinutes: null,` unless real data is available on the source object, in which case pass it through.
(3) apps/web/src/components/task/task-subtasks.tsx line ~120 (error TS2741): same fix.
Verify with EXACTLY: pnpm --filter @kaneo/web exec tsc --noEmit -p tsconfig.app.json  — and confirm these three files no longer appear in the output. Do NOT run any test suite.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- create-task-modal.tsx normalizeTask returns estimatedMinutes: task.estimatedMinutes ?? null
- task-relations.tsx and task-subtasks.tsx Task literals include estimatedMinutes
- The Task type was NOT widened to optional
- These three files no longer appear in tsc output
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
    "files_fixed": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "remaining_errors": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "artifact_path",
    "files_fixed",
    "remaining_errors"
  ]
}
```
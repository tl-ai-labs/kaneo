## Task tp_024 — debug / typecheck_fix
Module: web-ui
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Fix 4 TypeScript errors caused by Task.estimatedMinutes now being a REQUIRED property. Do NOT widen the Task type to optional — that is forbidden. Edit exactly these two TEST files and nothing else:
(1) apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx — errors at lines ~94 and ~176 (TS2345). These build ProjectWithTasks fixtures whose nested `columns[].tasks[]` objects are Task-shaped but lack estimatedMinutes. Add `estimatedMinutes: null,` to EVERY task object literal in the fixtures in this file.
(2) apps/web/src/hooks/mutations/label/sync-task-labels-cache.test.ts — errors at lines ~72 and ~165 (TS2345). Same fix: add `estimatedMinutes: null,` to every task object literal in the fixtures.
Change nothing else — no assertions, no mocks, no imports, no restructuring. Verify with EXACTLY: pnpm --filter @kaneo/web exec tsc --noEmit -p tsconfig.app.json — and confirm these two files no longer appear in the output. Do NOT run any test suite.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- Every Task-shaped fixture literal in both files has estimatedMinutes
- No assertion, mock or import changed
- The Task type was NOT widened to optional
- These two files no longer appear in tsc output
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
## Task tp_005 — codegen / service_method
Module: api-task
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Edit apps/api/src/task/controllers/update-task.ts ONLY. This is the highest-risk edit in the change. Read .sdlc/runs/20260903-125223-feature-extend-task-estimated-hours/change_plan.md section 4.5 and follow it EXACTLY. updateTask has a POSITIONAL 11-parameter signature. Append `estimatedMinutes?: number | null` as the 12th and LAST parameter, after currentUserId. Do NOT reorder, rename, or retype any existing parameter. In the .set({...}) object add `estimatedMinutes: estimatedMinutes ?? null` immediately after `userId: userId || null,`. Do not change the call site in task/index.ts — a separate packet does that. Do not run tests.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- estimatedMinutes?: number | null is the 12th and last parameter, after currentUserId
- All 11 pre-existing parameters keep their exact order, names and types
- set() includes estimatedMinutes: estimatedMinutes ?? null after the userId entry
- No other file modified
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
    "new_signature": {
      "type": "string"
    }
  },
  "required": [
    "artifact_path",
    "summary",
    "new_signature"
  ]
}
```
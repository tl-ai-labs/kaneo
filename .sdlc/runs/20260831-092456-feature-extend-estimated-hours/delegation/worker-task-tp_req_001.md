## Task tp_req_001 — requirements_analysis / delta_requirements
Module: estimated-hours
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Write a DELTA requirements document for adding an optional estimated-hours field to Kaneo tasks with a per-column rollup in the board column header.

First read these files in the repo: .sdlc/runs/20260831-092456-feature-extend-estimated-hours/intent_brief.md (the confirmed brief; its acceptance criteria AC-1..AC-9 are FROZEN and must be carried through verbatim in meaning), apps/api/src/database/schema.ts (taskTable), apps/api/src/schemas.ts (taskSchema), apps/api/src/task/index.ts, apps/api/src/task/controllers/update-task-priority.ts, apps/web/src/components/task/task-due-date-popover.tsx, apps/web/src/components/task/task-properties-sidebar.tsx, apps/web/src/components/kanban-board/task-card.tsx, apps/web/src/components/kanban-board/column/column-header.tsx.

Write the result to .sdlc/runs/20260831-092456-feature-extend-estimated-hours/requirements.md. Do NOT modify any other file anywhere in the repo. Do not run git commands. Do not read any git branch other than the checked-out one.

Sections required: In scope (numbered, testable) / Out of scope (numbered, from the brief's Non-goals) / Functional requirements per module (FR-n, grouped: api-schema, api-validation, api-read-projections, web-data, web-ui, i18n) / Non-functional requirements (NFR-n) / PII inventory (table; state plainly if the new field is not PII) / Role matrix (role x resource x action, using the repo's existing @kaneo/permissions vocabulary as found in the code) / Acceptance criteria (restate the brief's AC-1..AC-9, each made executable: name the exact command or observable that proves it) / Open questions for HITL.

Binding repo facts you must encode as requirements, already verified - do not re-derive them, but do cite the file:
1. get-task.ts and get-tasks.ts select explicit column allowlists, not select(*). get-tasks.ts's taskSelection object is what populates columns[].tasks[]. A requirement MUST state that estimatedMinutes is added to BOTH projections, or the field is invisible to the client.
2. updateTask in update-task.ts takes 11 POSITIONAL parameters and is called positionally. The repo already has dedicated single-field endpoints (PUT /:id/priority, /due-date, /assignee, /status, /title). A requirement must state which approach is chosen and why.
3. i18n lives at repo-root i18n/ with 17 locale JSON files; pnpm i18n:check is a hard gate that fails if a key exists in en-US.json but not the other 16. i18n/schema.json is off-limits.

Storage is a nullable integer estimatedMinutes on taskTable; the UI accepts hours and stores minutes.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- requirements.md exists at the stated path with all nine required sections
- AC-1..AC-9 from the intent brief are all present and each names a concrete proof
- A functional requirement explicitly covers adding the field to BOTH get-task.ts and get-tasks.ts taskSelection
- A functional requirement states and justifies the chosen update endpoint shape
- A functional requirement covers all 17 i18n locale files
- No file outside the run directory was created or modified
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "written_path": {
      "type": "string"
    },
    "fr_count": {
      "type": "integer"
    },
    "open_questions": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "written_path",
    "fr_count",
    "open_questions",
    "summary"
  ]
}
```
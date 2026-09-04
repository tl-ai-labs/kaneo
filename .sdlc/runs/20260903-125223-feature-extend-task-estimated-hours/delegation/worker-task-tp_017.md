## Task tp_017 — codegen / react_component
Module: web-ui
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Edit apps/web/src/components/kanban-board/column/column-header.tsx ONLY. Read .sdlc/runs/20260903-125223-feature-extend-task-estimated-hours/change_plan.md sections 2.3 and 4.17 and apply exactly that change: compute the rollup with sumEstimateMinutes(column.tasks) from @/lib/estimate — summing RAW INTEGER MINUTES — then call formatEstimateMinutes ONCE on the total. Never sum already-formatted per-task hour strings. Render the badge next to the existing column.tasks.length badge, and ONLY when the total is greater than 0. column.tasks is ALREADY the filtered set, so add no query, no prop, no store read, no useEffect. Use tasks:kanban.estimateTotal as the badge title. Do not run tests.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- Uses sumEstimateMinutes over column.tasks and formats the total exactly once
- Badge renders only when the total is > 0
- Null estimates contribute 0 and the total is never null or NaN
- No new query, prop, store read or useEffect introduced
- Badge title uses the tasks:kanban.estimateTotal key
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
    }
  },
  "required": [
    "artifact_path",
    "summary"
  ]
}
```
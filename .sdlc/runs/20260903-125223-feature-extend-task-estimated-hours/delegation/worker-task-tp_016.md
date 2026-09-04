## Task tp_016 — codegen / react_component
Module: web-ui
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Edit apps/web/src/components/kanban-board/task-card.tsx ONLY. Read .sdlc/runs/20260903-125223-feature-extend-task-estimated-hours/change_plan.md section 4.16 and apply exactly that change: render an estimate badge in the existing metadata row (beside priority / due date), styled to match its neighbours. Render it ONLY when formatEstimateMinutes(task.estimatedMinutes) is non-null, so that when the estimate is null the card's DOM is unchanged from today. Import formatEstimateMinutes from @/lib/estimate. Do not add a user-preference toggle. Do not modify task-labels.tsx or any other kanban file. Do not run tests.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- Badge renders only when the formatted estimate is non-null
- With a null estimate the rendered output is unchanged from before
- Styling matches the adjacent priority/due-date badges
- No other kanban file modified and no preference toggle added
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
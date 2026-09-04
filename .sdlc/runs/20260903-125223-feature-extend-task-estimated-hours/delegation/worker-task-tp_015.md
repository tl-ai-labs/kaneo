## Task tp_015 — codegen / react_component
Module: web-ui
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Edit apps/web/src/components/task/task-properties-sidebar.tsx ONLY. Read .sdlc/runs/20260903-125223-feature-extend-task-estimated-hours/change_plan.md section 4.15 and apply exactly that change. CRITICAL: there are THREE mount sites, not one — the compact layout, the mobile non-compact layout, and the desktop non-compact layout. Find them by locating every existing <TaskStartDatePopover / <TaskDueDatePopover pair (there are three pairs, near lines 266, 457 and 650). Add a TaskEstimatePopover trigger at ALL THREE, each inside the same {task && (...)} guard and matching its siblings' Button styling; the desktop one also takes the extra w-full class its siblings have, per 4.15. The component already exists at ./task-estimate-popover with a default export. Import formatEstimateMinutes from @/lib/estimate. Show formatEstimateMinutes(task.estimatedMinutes) when set, else the t("tasks:properties.estimate") label. Do not run tests.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- TaskEstimatePopover is mounted at all THREE sites (compact, mobile, desktop)
- Each trigger matches the sibling start/due-date Button styling; the desktop one keeps w-full
- Displays formatEstimateMinutes(task.estimatedMinutes) when set, else the tasks:properties.estimate label
- No other component modified
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
    "mount_sites": {
      "type": "number"
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "artifact_path",
    "mount_sites",
    "summary"
  ]
}
```
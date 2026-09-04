## Task tp_014 — codegen / react_component
Module: web-ui
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create the NEW file apps/web/src/components/task/task-estimate-popover.tsx. Read .sdlc/runs/20260903-125223-feature-extend-task-estimated-hours/change_plan.md section 4.14 and implement exactly that component. Follow the existing task-start-date-popover.tsx pattern: useUpdateTask() for a whole-task PUT, useWorkspacePermission() with `const canEdit = canUpdateTasks()` and an early `if (!canEdit) return <>{children}</>;` BEFORE rendering the Popover, toast.success/toast.error, and static i18n keys only (tasks:popover.estimate.*). Use the hours input and clear action described in 4.14, and pass the `nativeInput` prop to <Input /> so it renders a real <input> element. Convert with parseEstimateHours / estimateMinutesToHoursInput from @/lib/estimate — never send hours to the API. Do not run tests.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- Early-returns plain children when canUpdateTasks() is false, before any Popover renders
- Uses useUpdateTask() and submits estimatedMinutes in minutes, never hours
- Uses parseEstimateHours and estimateMinutesToHoursInput from @/lib/estimate
- Clear action submits estimatedMinutes: null
- All user-facing copy uses static tasks:popover.estimate.* i18n keys
- Input is rendered with the nativeInput prop
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
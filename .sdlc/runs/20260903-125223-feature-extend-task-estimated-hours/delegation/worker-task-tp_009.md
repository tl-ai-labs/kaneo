## Task tp_009 — codegen / controller_handler
Module: api-task
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Edit apps/api/src/task/index.ts ONLY. Read .sdlc/runs/20260903-125223-feature-extend-task-estimated-hours/change_plan.md sections 4.9 and 5 and apply exactly those changes. The file apps/api/src/task/estimate-schema.ts already exists and exports `estimatedMinutesSchema` and `estimatedMinutesFieldSchema` — import `estimatedMinutesFieldSchema` from ./estimate-schema and use it as the validator member. (a) add the estimatedMinutes member to the POST /:projectId json validator, destructure it, and pass it into the createTask({...}) object call; (b) add the same member to the PUT /:id json validator, destructure it, and pass it as the 12th and LAST positional argument to updateTask(...), after currentUserId. Keep handlers thin. Do not add a new route. Do not touch any other file or any other route's validator. Do not run tests.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- POST and PUT json validators both accept the estimate via estimatedMinutesFieldSchema
- createTask receives estimatedMinutes as an object property
- updateTask receives estimatedMinutes as the 12th positional argument, after currentUserId
- No new route added and no other route's validator changed
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
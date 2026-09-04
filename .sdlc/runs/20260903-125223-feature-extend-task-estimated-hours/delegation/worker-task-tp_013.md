## Task tp_013 — codegen / frontend_config
Module: i18n
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Edit i18n/en-US.json ONLY. Read .sdlc/runs/20260903-125223-feature-extend-task-estimated-hours/change_plan.md section 7 and add exactly the 9 keys it lists, at exactly the three locations it names: tasks.properties.estimate; the new tasks.popover.estimate object with its 7 keys; and tasks.kanban.estimateTotal. THE FILE IS TAB-INDENTED — match the surrounding indentation exactly and keep the JSON valid (mind the commas the section calls out). Do not reformat the file, do not reorder keys, do not touch any other locale file — the other 17 locales are off-limits and fall back to English. Do not run tests.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- All 9 keys from change_plan section 7 exist with the exact English strings given
- File remains valid JSON and stays TAB-indented
- No key reordered or reformatted elsewhere in the file
- No other locale file modified
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
    "keys_added": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "artifact_path",
    "keys_added"
  ]
}
```
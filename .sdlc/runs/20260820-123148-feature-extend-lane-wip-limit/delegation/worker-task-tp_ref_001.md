## Task tp_ref_001 — codegen / existing_file_edit
Module: i18n
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Edit ONE file only: i18n/en-US.json. Make exactly one targeted edit and no other change anywhere in the repo.

Inside the existing "tasks" -> "kanban" object (it currently holds addTask, wipLimitTooltip, setWipLimit, wipLimitPlaceholder, wipLimitExceeded, clearWipLimit, saveWipLimit — see the slice in inputs, around line 1884), ADD these three keys after the existing "saveWipLimit" entry:

"wipLimitInvalid": "Enter a whole number of 1 or more, or leave empty for no limit",
"wipLimitUpdated": "WIP limit updated",
"wipLimitUpdateError": "Failed to update WIP limit"

HARD CONSTRAINTS: do NOT remove or alter wipLimitTooltip or any other existing key. Do NOT reorder or reformat any existing key. Do NOT touch any other namespace. Do NOT edit any other locale file under i18n/ and do NOT touch i18n/schema.json. The file uses TAB indentation — the new keys sit at three tabs of indent, matching their siblings. The result must be valid JSON and `git diff` must show only added lines.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### i18n/en-US.json
_Included because: undefined_

```
(slice, lines 1884-1892, TAB-indented)
		"kanban": {
			"addTask": "Add task",
			"wipLimitTooltip": "WIP limit",
			"setWipLimit": "Set WIP limit",
			"wipLimitPlaceholder": "Limit (optional)",
			"wipLimitExceeded": "Column is over WIP limit",
			"clearWipLimit": "Clear limit",
			"saveWipLimit": "Save"
		},
```
### Acceptance criteria
- tasks.kanban.wipLimitInvalid, tasks.kanban.wipLimitUpdated and tasks.kanban.wipLimitUpdateError exist with the exact string values given.
- tasks.kanban.wipLimitTooltip, setWipLimit, wipLimitPlaceholder, wipLimitExceeded, clearWipLimit and saveWipLimit are still present and unchanged.
- The file is valid JSON; git diff on i18n/en-US.json shows only added lines inside tasks.kanban.
- No other file under i18n/ is modified.
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
      "type": "string",
      "description": "one sentence, what changed"
    }
  },
  "required": [
    "artifact_path",
    "summary"
  ]
}
```
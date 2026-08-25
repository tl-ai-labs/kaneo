## Task tp_pkt_010 — codegen / existing_file_edit
Module: i18n
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
IMPORTANT: do NOT explore the repository. You may read ONLY i18n/en-US.json itself if you need to locate the exact block. Make exactly ONE file write, to that same path. Do not create, modify or delete any other file — in particular do NOT touch i18n/schema.json.

In i18n/en-US.json the ONLY edit is the `"kanban"` object nested under `"tasks"` (around line 1884; it currently holds a single key, "addTask"). See the excerpt in inputs, which is shown with tabs made visible as ^I. Replace that object's body so it reads (real TAB characters, three tabs of indent for the keys, two for the braces):

		"kanban": {
			"addTask": "Add task",
			"wipLimitTooltip": "WIP limit",
			"setWipLimit": "Set WIP limit",
			"wipLimitPlaceholder": "Limit (optional)",
			"wipLimitExceeded": "Column is over WIP limit",
			"clearWipLimit": "Clear limit",
			"saveWipLimit": "Save"
		},

The file is TAB-indented — match it exactly, do not convert to spaces. Keep "addTask" first and its value unchanged. There is a sibling "listView" object that also has an "addTask" key — do NOT edit that one; the target is "kanban". Do not touch any other key anywhere in this 2148-line file and do not reorder anything. The result must be valid JSON. Implements FR-13 and NFR-3.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### i18n/en-US.json
_Included because: Lines 1876-1892 with tabs rendered as ^I so you can match the indentation exactly. Note the sibling listView.addTask which must NOT be touched._

```
^I^I"archive": {
^I^I^I"success": "Archived {{count}} tasks"
^I^I},
^I^I"listView": {
^I^I^I"addTask": "Add task",
^I^I^I"archiveAllTooltip": "Archive all completed tasks",
^I^I^I"noTasks": "No tasks"
^I^I},
^I^I"kanban": {
^I^I^I"addTask": "Add task"
^I^I},
^I^I"pr": {
^I^I^I"merged": "Merged",
^I^I^I"draft": "Draft",
^I^I^I"open": "Open",
```
### Acceptance criteria
- tasks.kanban gains exactly six new keys: wipLimitTooltip, setWipLimit, wipLimitPlaceholder, wipLimitExceeded, clearWipLimit, saveWipLimit
- tasks.kanban.addTask is unchanged and still first
- tasks.listView is completely untouched
- The file remains valid JSON and stays tab-indented
- No other namespace is modified
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
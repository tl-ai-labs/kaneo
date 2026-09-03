## Task tp_cg_006 — codegen / frontend_config
Module: i18n
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Edit i18n/en-US.json ONLY. Add exactly 8 static keys.

Under settings.columnEditor, after the existing "add" key:
  "wipLimit": "WIP limit",
  "wipLimitPlaceholder": "None",
  "wipLimitTooltip": "Advisory limit on tasks in this column. Leave empty for no limit.",
  "wipLimitAria": "WIP limit for {{name}}",
  "toastWipLimitUpdated": "WIP limit updated",
  "toastWipLimitCleared": "WIP limit cleared"

Under tasks.kanban, after the existing "addTask" key:
  "wipLimitTitle": "WIP limit: {{taskCount}} of {{limit}}",
  "wipLimitOverCap": "Over WIP limit: {{taskCount}} of {{limit}}"

Preserve the file's existing tab indentation and key ordering. Change no existing key or value. Verify the file is still valid JSON.

STRICTLY FORBIDDEN: do not touch i18n/schema.json (it is a generated artifact and is out of scope for this run), do not touch any other locale file (de-DE, el-GR, es-ES, fr-FR, hi-IN, id-ID, it-IT, ko-KR, mk-MK, nl-NL, pt-BR, ru-RU, tr-TR, uk-UA, vi-VN, zh-CN), and do not run any pnpm i18n script (i18n:check, i18n:check:fix, i18n:schema, i18n:report). Spec: .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md section 10.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md
_Included because: authoritative spec fragment_

```
Section 10 gives the exact JSON fragments for both namespaces and the 8-key inventory table with English values.
```

#### i18n/en-US.json
_Included because: file to edit_

```
settings.columnEditor.add is near line 903; tasks.kanban.addTask is near line 1885. File uses tab indentation.
```
### Acceptance criteria
- All 6 settings.columnEditor keys (wipLimit, wipLimitPlaceholder, wipLimitTooltip, wipLimitAria, toastWipLimitUpdated, toastWipLimitCleared) exist with the exact English values given
- Both tasks.kanban.wipLimitTitle and tasks.kanban.wipLimitOverCap exist with the exact English values given
- i18n/en-US.json is valid JSON, tab-indented, and no pre-existing key or value changed
- i18n/schema.json was NOT modified and no non-English locale file was modified
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "files_changed": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "keys_added": {
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
    "files_changed",
    "keys_added",
    "summary"
  ]
}
```
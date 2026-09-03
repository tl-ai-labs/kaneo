## Task tp_cg_012 — codegen / frontend_config
Module: i18n
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Edit i18n/en-US.json ONLY. Add exactly 2 new static keys under tasks.kanban, after the existing "wipLimitOverCap" key. These support a follow-up change where the over-cap DECISION uses the column's true unfiltered task count while the DISPLAYED number stays the filtered count, so the badge needs to disclose the true total when a filter is hiding tasks.

  "wipLimitFiltered": "WIP limit: {{total}} of {{limit}} total · {{taskCount}} shown by current filter",
  "wipLimitOverCapFiltered": "Over WIP limit: {{total}} of {{limit}} total · {{taskCount}} shown by current filter"

After the edit, tasks.kanban must contain exactly these five keys in this order: addTask, wipLimitTitle, wipLimitOverCap, wipLimitFiltered, wipLimitOverCapFiltered.

Preserve the file's existing tab indentation. Change no existing key or value. Verify the file is still valid JSON.

STRICTLY FORBIDDEN: do not touch i18n/schema.json (generated artifact, out of scope for this run), do not touch any other locale file (de-DE, el-GR, es-ES, fr-FR, hi-IN, id-ID, it-IT, ko-KR, mk-MK, nl-NL, pt-BR, ru-RU, tr-TR, uk-UA, vi-VN, zh-CN), and do not run any pnpm i18n script.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### i18n/en-US.json
_Included because: file to edit_

```
tasks.kanban currently holds addTask, wipLimitTitle and wipLimitOverCap, near line 1888. File uses tab indentation.
```
### Acceptance criteria
- tasks.kanban.wipLimitFiltered and tasks.kanban.wipLimitOverCapFiltered exist with the exact English values given
- tasks.kanban holds exactly five keys in the stated order
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
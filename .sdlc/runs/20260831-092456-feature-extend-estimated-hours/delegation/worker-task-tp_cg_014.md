## Task tp_cg_014 — codegen / existing_file_edit
Module: i18n
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

The keys tasks.popover.estimatedHours.{label,placeholder,clear,updateSuccess,updateError} and tasks.kanban.estimatedHoursRollup were just added to i18n/en-US.json, which is the source of truth. The other 16 locale files do not have them yet, so the repo currently fails its own i18n gate.

Run exactly this from the repo root to propagate them:

  pnpm i18n:check:fix

Then run:

  pnpm i18n:check

and confirm it exits 0.

Do NOT hand-edit any locale file — the script owns that propagation. Do NOT modify i18n/schema.json or i18n/resources.ts under any circumstances. If i18n:check still fails after the fix, report the exact failure output and stop; do not attempt a manual repair.

Report which locale files the script changed and the final exit status of i18n:check.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- pnpm i18n:check:fix was run rather than any locale file being hand-edited
- pnpm i18n:check exits 0 afterwards
- i18n/schema.json and i18n/resources.ts are unmodified
- All 16 non-English locales gained the six new keys
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "fix_command_succeeded": {
      "type": "boolean"
    },
    "check_passes": {
      "type": "boolean"
    },
    "locales_changed": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "check_output": {
      "type": "string"
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "fix_command_succeeded",
    "check_passes",
    "locales_changed",
    "check_output",
    "summary"
  ]
}
```
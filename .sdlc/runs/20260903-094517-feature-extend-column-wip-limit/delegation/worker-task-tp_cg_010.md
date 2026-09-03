## Task tp_cg_010 — codegen / react_component
Module: web-settings
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Add the WIP-limit input to apps/web/src/components/project/column-editor.tsx.

Read .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md sections 9.1 and 9.2 and apply the handler and the JSX block VERBATIM — they are final code.

1. Add `handleUpdateWipLimit` next to the existing `handleToggleFinal`, same try/toast/catch shape.
2. Insert the new input group inside the existing right-hand cluster `<div className="flex items-center gap-1.5 shrink-0">`, immediately BEFORE the "Done column" group.

Traps:
- Do NOT await before touching the DOM. Capture and write input.value synchronously inside onBlur; call handleUpdateWipLimit WITHOUT await. Awaiting first makes e.currentTarget null.
- The empty-string check must come before Number(), because Number("") is 0.
- Uncontrolled input: defaultValue, no useState, no key — matching the existing rename input.
- Do NOT extend the "add new column" block near the bottom of the file. Creation takes no limit.

All copy via the static i18n keys already added to i18n/en-US.json (settings:columnEditor.wipLimit, wipLimitPlaceholder, wipLimitTooltip, wipLimitAria, toastWipLimitUpdated, toastWipLimitCleared, and the existing toastUpdateError for failures). Then run: pnpm --filter @kaneo/web typecheck
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md
_Included because: authoritative spec fragment_

```
Section 9.1 gives handleUpdateWipLimit verbatim. Section 9.2 gives the exact JSX group to insert. Section 9.3 enumerates the semantics: canEdit gate, blur+Enter commit, empty->null, invalid->revert-without-sending, no-op->no request, and the await/DOM trap.
```

#### apps/web/src/components/project/column-editor.tsx
_Included because: file to edit_

```
handleToggleFinal at lines 86-101. The right-hand cluster div is at line 299; the Done-column group starts at line 300. The add-new-column block is lines 346-428 and must not change.
```
### Acceptance criteria
- handleUpdateWipLimit calls updateColumn({ id, projectId, data: { wipLimit } }) and toasts success/failure via static i18n keys
- The numeric Input is uncontrolled (defaultValue), disabled when !canEdit, and commits on blur and on Enter
- Empty input sends null; a non-integer or <1 value reverts the field and sends nothing; an unchanged value sends nothing
- input.value is read and written synchronously before any async call
- The add-new-column block is unchanged and takes no wipLimit
- pnpm --filter @kaneo/web typecheck passes
- No file other than column-editor.tsx was modified
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
    "summary": {
      "type": "string"
    },
    "verified": {
      "type": "string"
    }
  },
  "required": [
    "files_changed",
    "summary"
  ]
}
```
## Task tp_cg_008 — codegen / frontend_util
Module: web-data
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Widen two TanStack mutation-hook type literals. Edit exactly these two files:

1. apps/web/src/hooks/mutations/column/use-create-column.ts — add `wipLimit?: number;` to the mutationFn's `data` type.
2. apps/web/src/hooks/mutations/column/use-update-column.ts — add `wipLimit?: number | null;` to the mutationFn's `data` type (after `isFinal?: boolean;`).

CRITICAL: the `onSuccess` block in use-update-column.ts must be preserved VERBATIM. It already invalidates ["columns", variables.projectId] and ["tasks", variables.projectId] with refetchType: "all", which is exactly what this feature needs — that existing behaviour IS the acceptance criterion. Do not rewrite it, do not add keys to it, do not reorder it, do not reformat it. The same applies to use-create-column.ts's blanket invalidateQueries.

Do not edit use-delete-column.ts, use-reorder-columns.ts, or hooks/queries/column/use-get-columns.ts (its return type is inferred and needs no change). Spec: .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md sections 6.3 and 6.4.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md
_Included because: authoritative spec fragment_

```
Sections 6.3 and 6.4 give the exact widened mutationFn data types and quote the onSuccess block that must survive byte-identical.
```

#### apps/web/src/hooks/mutations/column/use-update-column.ts
_Included because: file to edit_

```
data type at lines 14-19; onSuccess at lines 21-32 — preserve exactly.
```
### Acceptance criteria
- use-create-column.ts mutationFn data type includes wipLimit?: number
- use-update-column.ts mutationFn data type includes wipLimit?: number | null
- The onSuccess block in use-update-column.ts is byte-identical to before the edit
- No file outside apps/web/src/hooks/mutations/column/ was modified
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
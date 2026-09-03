## Task tp_cg_003 — codegen / service_method
Module: api-column
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Edit apps/api/src/column/controllers/create-column.ts. Two changes only:

1. Add `wipLimit` to the destructured params and `wipLimit?: number;` to the inline param type (after `isFinal?: boolean;`).
2. Add one line to the `.values({...})` object: `wipLimit: wipLimit ?? null,` placed after `isFinal: isFinal ?? false,`.

CRITICAL TRAP: the neighbouring lines use `icon: icon || null` / `color: color || null`. Do NOT copy that idiom. Use `??`, NOT `||`. The distinction this controller must preserve is absent-vs-set, not empty-vs-non-empty.

Do not change `toSlug` or its export (an existing test imports it). Do not change the reserved-slug 409, the duplicate-slug 409, the MAX(position) query, or the 500 fallback. Do not touch any other file. Spec: .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md section 5.1.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md
_Included because: authoritative spec fragment_

```
Section 5.1 gives the exact signature block, the exact .values() block, and the ?? vs || trap in full.
```

#### apps/api/src/column/controllers/create-column.ts
_Included because: file to edit_

```
createColumn destructures projectId,name,icon,color,isFinal; .values() is at ~line 69.
```
### Acceptance criteria
- createColumn accepts wipLimit?: number in its param type and destructuring
- The .values() object contains `wipLimit: wipLimit ?? null` using ?? and not ||
- toSlug is unchanged and still exported
- No file other than apps/api/src/column/controllers/create-column.ts was modified
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
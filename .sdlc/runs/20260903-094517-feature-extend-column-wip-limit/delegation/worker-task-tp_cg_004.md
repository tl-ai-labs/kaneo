## Task tp_cg_004 — codegen / service_method
Module: api-column
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Edit apps/api/src/column/controllers/update-column.ts. Two changes only:

1. Add `wipLimit?: number | null;` to the `data` param type, after `isFinal?: boolean;`.
2. Add one line to the `.set({...})` object using the file's existing spread idiom verbatim: `...(data.wipLimit !== undefined && { wipLimit: data.wipLimit }),` placed after the isFinal spread.

`!== undefined` is load-bearing: `null` is a legitimate value that must reach .set() (it clears the limit), while `undefined` must be absent from the object (leaves the stored value untouched). Do NOT use a truthiness check and do NOT use `!= null`.

Do not change the 404-if-missing guard or the 500 fallback. Do not add a publishEvent() call. Do not touch any other file. Spec: .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md section 5.2.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md
_Included because: authoritative spec fragment_

```
Section 5.2 gives the exact data type block and the exact .set() block, and explains why !== undefined is load-bearing.
```

#### apps/api/src/column/controllers/update-column.ts
_Included because: file to edit_

```
data type is at ~line 8; .set() is at ~line 25 with four existing spread lines for name, icon, color, isFinal.
```
### Acceptance criteria
- The data param type includes wipLimit?: number | null
- The .set() object contains `...(data.wipLimit !== undefined && { wipLimit: data.wipLimit })`
- No publishEvent call was added
- No file other than apps/api/src/column/controllers/update-column.ts was modified
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
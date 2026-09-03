## Task tp_cg_011 — codegen / controller_handler
Module: api-column
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Security review finding F-1: `wipLimit` is validated with minValue(1) but has NO upper bound, while the PostgreSQL column is a 4-byte `integer`. Values above 2147483647 (and 1e308, and Number.MAX_SAFE_INTEGER — Number.isInteger(1e308) is true) currently pass validation and fail at the database, producing a 500 instead of a 400.

Edit apps/api/src/column/index.ts. Add `v.maxValue(2147483647)` as the last step of the pipe in BOTH places:

POST /:projectId json validator:
  wipLimit: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2147483647)),
  ),

PUT /:id json validator:
  wipLimit: v.optional(
    v.nullable(
      v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2147483647)),
    ),
  ),

2147483647 is PostgreSQL's int4 maximum, so the validator boundary now matches the storage boundary exactly.

Do NOT move, reorder or alter any workspaceAccess or requireWorkspacePermission line. Do NOT change any describeRoute block. Do NOT touch the GET, reorder or DELETE routes. Do not change any other file.

Then run BOTH of these (each ~2s):
  pnpm --filter @kaneo/api exec vitest run --config vitest.config.ts wip-limit-validation
  pnpm exec biome ci apps/api/src/column/index.ts
Do NOT run the full test suite — the 9-minute worker timeout killed an earlier packet that did.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/api/src/column/index.ts
_Included because: file to edit_

```
POST validator wipLimit is at ~line 63; PUT validator wipLimit is at ~lines 141-143. Middleware guard lines sit immediately after each validator block and must not move.
```

#### .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/security_review.md
_Included because: the finding being remediated_

```
Finding F-1 documents the accepted out-of-range values and the resulting 500 via app.onError.
```
### Acceptance criteria
- Both the POST and PUT wipLimit validators end with v.maxValue(2147483647)
- Every workspaceAccess and requireWorkspacePermission line is byte-identical to before
- The existing 8 wip-limit-validation tests still pass
- biome ci on the file exits 0
- No file other than apps/api/src/column/index.ts was modified
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
    "test_run_output": {
      "type": "string"
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "files_changed",
    "summary"
  ]
}
```
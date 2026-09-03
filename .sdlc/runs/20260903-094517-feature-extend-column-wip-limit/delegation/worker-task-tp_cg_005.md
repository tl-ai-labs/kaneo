## Task tp_cg_005 — codegen / controller_handler
Module: api-column
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Edit apps/api/src/column/index.ts — the Hono route definitions. Three changes only:

1. POST /:projectId json validator — add as the last property of the v.object:
   wipLimit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
2. POST /:projectId handler — destructure `wipLimit` from c.req.valid("json") and pass it in the createColumn({...}) call.
3. PUT /:id json validator — add as the last property:
   wipLimit: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1)))),

No handler edit on PUT — it already forwards the whole validated object via `const data = c.req.valid("json")`.

Do NOT move, reorder, remove or alter any `workspaceAccess.*` or `requireWorkspacePermission(...)` line. Do NOT change any describeRoute block or its description strings. Do NOT touch the GET route, the PUT /reorder/:projectId route, or the DELETE route. Spec: .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md sections 4.1, 4.2 and 4.4.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md
_Included because: authoritative spec fragment_

```
Sections 4.1 and 4.2 give the exact Valibot validator blocks and the exact handler destructure/pass-through. Section 4.4 lists the middleware lines that must stay byte-identical.
```

#### apps/api/src/column/index.ts
_Included because: file to edit_

```
POST /:projectId validator at lines 56-64, handler at 67-78. PUT /:id validator at lines 132-140. Middleware lines at 65-66 and 141-142.
```
### Acceptance criteria
- POST validator has wipLimit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)))
- PUT validator has wipLimit: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))))
- The POST handler destructures wipLimit and forwards it to createColumn
- Every workspaceAccess and requireWorkspacePermission line is byte-identical to before
- No describeRoute block changed
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
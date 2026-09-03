## Task tp_cg_007 — codegen / api_client
Module: web-data
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Widen two fetcher type literals so wipLimit reaches the typed @kaneo/libs client. Edit exactly these two files:

1. apps/web/src/fetchers/column/create-column.ts — add `wipLimit?: number;` to the inline `data` param type (after `isFinal?: boolean`).
2. apps/web/src/fetchers/column/update-column.ts — add `wipLimit?: number | null;` to the inline `data` param type (after `isFinal?: boolean;`).

Both function bodies are unchanged: `json: data` already forwards everything to the typed client.

Do NOT edit apps/web/src/fetchers/column/get-columns.ts, delete-column.ts or reorder-columns.ts — get-columns' return type is inferred from the client and needs no change. Do not create a parallel untyped request layer. Do not add a cast. Spec: .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md sections 6.1 and 6.2.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md
_Included because: authoritative spec fragment_

```
Sections 6.1 and 6.2 give the exact widened signatures for both fetchers.
```

#### apps/web/src/fetchers/column/create-column.ts
_Included because: file to edit_

```
data param type is a one-line inline object literal on line 5.
```

#### apps/web/src/fetchers/column/update-column.ts
_Included because: file to edit_

```
data param type is a multi-line inline object literal on lines 5-10.
```
### Acceptance criteria
- create-column.ts data type includes wipLimit?: number
- update-column.ts data type includes wipLimit?: number | null
- Both function bodies are unchanged
- No file outside apps/web/src/fetchers/column/ was modified, and get-columns.ts was not modified
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
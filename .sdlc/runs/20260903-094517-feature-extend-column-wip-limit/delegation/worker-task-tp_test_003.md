## Task tp_test_003 — tests / test_integration
Module: api-column
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create tests/api/column/wip-limit-validation.test.ts — route-level Valibot validation tests using Hono's app.request(). No live database, no supertest, no HTTP server.

.sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md section 11.3 gives all four vi.mock blocks verbatim (workspace-access-middleware, require-workspace-permission, create-column controller, update-column controller). They MUST be declared before the `import column from "../../../apps/api/src/column"` line. delete-column, get-columns and reorder-columns need no mock because apps/api/src/database exports db as a lazy Proxy, so importing them opens no connection.

Requests use column.request(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify({...}) }).

Eight assertions, STATUS CODES ONLY — never assert response-body shape:
1. POST /proj-1 { name: "Doing", wipLimit: 5 } -> 200, createColumn called with wipLimit 5
2. POST /proj-1 { name: "Doing" } -> 200, createColumn called with wipLimit undefined
3. POST wipLimit 0 -> 400
4. POST wipLimit -1 -> 400
5. POST wipLimit 2.5 -> 400
6. POST wipLimit "5" -> 400
7. PUT /col-1 { wipLimit: null } -> 200, updateColumn called with { wipLimit: null }
8. PUT /col-1 { wipLimit: 0 } -> 400

PUT /reorder/:projectId is registered BEFORE PUT /:id, so /col-1 routes to the update handler correctly.

IMPORTANT — verification budget: verify with ONLY this fast filtered command (~2 seconds):
  pnpm --filter @kaneo/api exec vitest run --config vitest.config.ts wip-limit-validation
Do NOT run the full test suite — a previous packet was killed by the 9-minute worker timeout doing that. Do not modify any existing test file or any source file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md
_Included because: authoritative spec fragment_

```
Section 11.3 gives the four vi.mock blocks verbatim, the request shape, and all eight assertions with AC mapping.
```

#### tests/api/column/update-column-wip-limit.test.ts
_Included because: pattern to mirror_

```
Sibling file just written — mirror its mock-hoisting convention (mocks above the controller import).
```

#### apps/api/src/column/index.ts
_Included because: system under test_

```
The Hono app exported as default. Route order: GET /:projectId, POST /:projectId, PUT /reorder/:projectId, PUT /:id, DELETE /:id.
```
### Acceptance criteria
- All eight assertions are present and assert status codes rather than response-body shape
- The four vi.mock blocks precede the column route import
- No live PostgreSQL connection is opened
- The filtered vitest command passes
- No existing test file and no source file was modified
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
    "tests_added": {
      "type": "number"
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
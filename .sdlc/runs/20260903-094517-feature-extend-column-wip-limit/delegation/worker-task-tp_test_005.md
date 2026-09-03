## Task tp_test_005 — tests / test_integration
Module: api-column
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Security finding F-1 was just remediated: both wipLimit validators in apps/api/src/column/index.ts now end with v.maxValue(2147483647), PostgreSQL's int4 maximum. Add regression coverage to tests/api/column/wip-limit-validation.test.ts.

Append FOUR new cases to the existing describe block, in the same style as the eight already there (Hono column.request(), status-code assertions only, never response-body shape):

1. POST /proj-1 { name: "Doing", wipLimit: 2147483648 } -> 400  (one past int4 max)
2. POST /proj-1 { name: "Doing", wipLimit: 1e308 } -> 400  (Number.isInteger(1e308) is true, so only maxValue rejects it)
3. POST /proj-1 { name: "Doing", wipLimit: 2147483647 } -> 200  (the boundary itself is still ACCEPTED — this is the guard against someone "fixing" it with an off-by-one)
4. PUT /col-1 { wipLimit: 2147483648 } -> 400

Case 3 matters as much as the rejections: it proves the bound is inclusive and that the fix did not narrow the valid range.

Add a brief comment noting these assert 400 rather than the 500 that the unbounded validator previously produced via app.onError.

Do NOT modify the existing eight tests. Do NOT modify any source file.

Verify with ONLY this fast command (~2s):
  pnpm --filter @kaneo/api exec vitest run --config vitest.config.ts wip-limit-validation
Do NOT run the full suite — the 9-minute worker timeout killed an earlier packet that did. Expect 12 tests passing when done.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### tests/api/column/wip-limit-validation.test.ts
_Included because: file to extend_

```
Existing file with 8 tests: 2 accept cases and 6 reject cases, using column.request() and expect(res.status).toBe(...). Mocks for workspace-access-middleware, require-workspace-permission and both controllers are hoisted above the route import.
```

#### apps/api/src/column/index.ts
_Included because: system under test_

```
Both wipLimit validators now read v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2147483647)).
```
### Acceptance criteria
- Four new cases exist covering 2147483648 -> 400, 1e308 -> 400, 2147483647 -> 200, and PUT 2147483648 -> 400
- The inclusive-boundary case (2147483647 accepted) is present
- The original eight tests are unchanged
- The filtered vitest command passes with 12 tests
- No source file was modified
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
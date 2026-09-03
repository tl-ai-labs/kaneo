## Task tp_test_001r — tests / test_unit
Module: api-column
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Senior review finding N-3: the third test in tests/api/column/create-column-wip-limit.test.ts is named as a regression guard for the `||` vs `??` trap, but it uses wipLimit: 1 — and `1 || null` and `1 ?? null` both evaluate to 1. The test discriminates nothing while claiming to. Fix the test so it actually guards.

Replace that third test with one that passes a FALSY number the two operators disagree on:
  createColumn({ projectId: "proj-1", name: "Doing", wipLimit: 0 })
then assert the insert chain's .values() received wipLimit: 0 (what `??` produces), NOT null (what `||` would produce). Assert with a strict identity check on the captured argument, e.g.
  const [callArg] = insertChain.values.mock.calls[0];
  expect(callArg.wipLimit).toBe(0);

Add a short comment explaining WHY 0 is used: the route-level Valibot validator rejects 0, so this value cannot arrive through the HTTP path today — the test locks the controller's absent-vs-set semantics so that relaxing minValue(1) later cannot silently reintroduce the bug. That constraint is the kind of thing AGENTS.md says a comment should explain.

Keep the first two tests exactly as they are. Change nothing else in the file. Do NOT modify create-column.ts or any other source file.

Verify with ONLY this fast command (~2s):
  pnpm --filter @kaneo/api exec vitest run --config vitest.config.ts create-column-wip-limit
Do NOT run the full suite — the 9-minute worker timeout killed an earlier packet that did.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### tests/api/column/create-column-wip-limit.test.ts
_Included because: file to fix_

```
The third test is titled 'sets wipLimit to 1 when wipLimit is 1 (regression guard for || vs ??)' and asserts wipLimit is 1 and not null — which is true under both operators.
```

#### apps/api/src/column/controllers/create-column.ts
_Included because: the behaviour under guard_

```
Line 79 is `wipLimit: wipLimit ?? null,`. With `||` it would be `wipLimit: wipLimit || null` and 0 would become null.
```
### Acceptance criteria
- The third test passes wipLimit: 0 and asserts the inserted value is exactly 0, not null
- The test would fail if create-column.ts used || instead of ??
- A comment explains why 0 is used despite the route validator rejecting it
- The first two tests are unchanged
- The filtered vitest command passes with 3 tests
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
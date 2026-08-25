## Task tp_ref_005 — debug / test_fix
Module: api-column
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Fix two defects in tests/api-integration/column-wip-limit.test.ts. Edit ONLY that file.

DEFECT 1 (blocking, 4 occurrences): every test calls `await createWorkspaceMember()`, which seeds role "member". The @kaneo/permissions `member` role grants project: ["create","read"] only, but ALL column mutation routes in apps/api/src/column/index.ts use requireWorkspacePermission({ project: ["update"] }). So every POST/PUT /api/column/... in this file gets 403 and the tests fail. Fix: change each of the 4 calls to `await createWorkspaceMember({ role: "owner" })`. This is the established house pattern - see tests/api-integration/billing-seat-reconciliation.test.ts and billing-trial-per-user.test.ts. Do NOT change the fixture helper itself, and do NOT weaken any permission check in apps/api.

DEFECT 2 (junk code, lines ~183-185): the AC-4 test contains a nonsense ternary that probes a misspelled matcher name `toBeGreaterThanOrEndEqual` for truthiness and then runs the SAME assertion in both branches. Replace the entire ternary expression with the single plain assertion: expect(response.status).toBeGreaterThanOrEqual(400);

Change nothing else. Preserve all existing test names, AC references and assertions.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### tests/api-integration/column-wip-limit.test.ts
_Included because: undefined_

```
undefined
```
### Acceptance criteria
- All 4 createWorkspaceMember() calls pass { role: "owner" }
- The toBeGreaterThanOrEndEqual ternary is replaced by a single expect(response.status).toBeGreaterThanOrEqual(400);
- No file other than tests/api-integration/column-wip-limit.test.ts is modified
- No permission check or fixture helper is weakened
- All 4 test cases and their AC-N titles remain intact
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "files_modified": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "files_modified",
    "summary"
  ]
}
```
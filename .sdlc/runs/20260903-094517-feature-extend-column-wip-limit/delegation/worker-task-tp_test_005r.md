## Task tp_test_005r — tests / test_integration
Module: api-column
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
The four cases just appended to tests/api/column/wip-limit-validation.test.ts are not Biome-formatted. `pnpm exec biome ci tests/api/column/wip-limit-validation.test.ts` fails with "File content differs from formatting output". This is whitespace only.

Run exactly this one command:

pnpm exec biome format --write tests/api/column/wip-limit-validation.test.ts

Then confirm both of these pass:
  pnpm exec biome ci tests/api/column/wip-limit-validation.test.ts
  pnpm --filter @kaneo/api exec vitest run --config vitest.config.ts wip-limit-validation

STRICTLY FORBIDDEN: do NOT run `pnpm lint`, `pnpm -r lint`, `biome check --write`, or biome with a directory or `.` argument — those rewrite unrelated files across the repo. Pass only the one explicit file path. Do NOT run the full test suite.

Change no assertion and no test name. All 12 tests must still pass afterwards. This is a reflow, not a rewrite.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### biome.json
_Included because: why the reflow is required_

```
formatter.indentStyle tab; javascript.formatter.indentStyle space, quoteStyle double; default lineWidth 80.
```

#### tests/api/column/wip-limit-validation.test.ts
_Included because: file to reformat_

```
12 tests; the last four (int4 upper-bound cases) were appended and are over-width.
```
### Acceptance criteria
- biome ci on the file exits 0
- The filtered vitest run still reports 12 passing tests
- No assertion or test name changed
- No file other than tests/api/column/wip-limit-validation.test.ts was modified
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
    "biome_ci_output": {
      "type": "string"
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
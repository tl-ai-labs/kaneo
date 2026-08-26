## Task tp_dbg_002 — debug / existing_file_edit
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
FIX A TYPECHECK FAILURE. The tests all PASS under vitest, but `pnpm --filter @kaneo/web typecheck` fails with 13 errors, all inside apps/web/src/lib/board-filter-params.test.ts:

```
src/lib/board-filter-params.test.ts(55,7): error TS2769: No overload matches this call.
... (lines 55-69)
src/lib/board-filter-params.test.ts(69,46): error TS2345: Argument of type '(input: any) => void' is not assignable to parameter of type '(...args: any[] | [any]) => Awaitable<void>'.
  Type 'any[] | [any]' is not assignable to type '[input: any]'.
    Type 'any[]' is not assignable to type '[input: any]'.
      Target requires 1 element(s) but source may have fewer.
```

CAUSE: `it.each` treats each element of its array as a TUPLE OF ARGUMENTS to spread into the test callback. The hostile-input list mixes scalars with real arrays (`[]` and `[1, 2]`), so TypeScript cannot resolve the overload — it cannot tell a one-argument case from a spread.

FIX: wrap EVERY case in a single-element tuple so each is unambiguously one argument. That is, change
```ts
it.each([
  null,
  undefined,
  ...
  [],
  [1, 2],
  ...
])("never throws for hostile input: %j", (input) => {
```
into
```ts
it.each([
  [null],
  [undefined],
  ...
  [[]],
  [[1, 2]],
  ...
])("never throws for hostile input: %j", (input) => {
```
Note `[]` becomes `[[]]` and `[1, 2]` becomes `[[1, 2]]`. Keep ALL fourteen cases and keep the assertion body exactly as it is. If TypeScript still complains, add an explicit type parameter such as `it.each<[unknown]>([...])` rather than deleting any case.

AFTER EDITING run BOTH of these and confirm both succeed:
  `pnpm --filter @kaneo/web test src/lib/board-filter-params.test.ts`   (all tests still pass)
  `pnpm --filter @kaneo/web typecheck`                                  (exit 0, no errors)
Report both results.

SCOPE — you may modify EXACTLY ONE file: apps/web/src/lib/board-filter-params.test.ts. Do NOT modify board-filter-params.ts or any other file. Do not weaken or delete any test case to make the type error go away. The only non-read-only commands you may run are the two above. Do NOT run biome, prettier, eslint, `pnpm lint`, any package `lint` script, or `pnpm i18n:check:fix`.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/lib/board-filter-params.test.ts
_Included because: The exact block that fails to typecheck, lines 54-70._

```
    it.each([
      null,
      undefined,
      0,
      42,
      "",
      "junk",
      true,
      [],
      [1, 2],
      { status: 123 },
      { status: {} },
      { status: [1, null, {}] },
      { status: null },
      { toString: null },
    ])("never throws for hostile input: %j", (input) => {
      expect(() => validateBoardSearch(input as never)).not.toThrow();
    });
```
### Acceptance criteria
- pnpm --filter @kaneo/web typecheck exits 0
- All tests in board-filter-params.test.ts still pass
- All fourteen hostile-input cases are retained
- No test case was deleted or weakened
- board-filter-params.ts was NOT modified
- files_written contains exactly one path
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "artifact_path": {
      "type": "string"
    },
    "typecheck_exit_code": {
      "type": "integer"
    },
    "tests_passing": {
      "type": "integer"
    },
    "cases_kept": {
      "type": "integer"
    },
    "files_written": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "artifact_path",
    "typecheck_exit_code",
    "tests_passing",
    "cases_kept",
    "files_written"
  ]
}
```
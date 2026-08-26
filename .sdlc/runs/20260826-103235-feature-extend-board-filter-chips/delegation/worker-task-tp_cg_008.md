## Task tp_cg_008 — tests / test_add
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create apps/web/src/lib/board-filter-params.test.ts — vitest unit tests for the helpers in apps/web/src/lib/board-filter-params.ts. READ that file first; test what it actually does.

Use `import { describe, expect, it } from "vitest";` and import the helpers by relative path (`./board-filter-params`). No React, no router, no jsdom-specific APIs.

Cover:
1. ROUND-TRIP: `filtersToSearchParams` then `searchParamsToFilters` returns a deep-equal BoardFilters for all five dimensions populated. Include a value CONTAINING A COMMA (e.g. assignee `["u,1"]`) and assert it survives intact — that is the regression guard against comma-splitting.
2. BARE STRING: `validateBoardSearch({ status: "todo" })` → `{ status: ["todo"] }`. This is the shape the router actually delivers for `?status=todo`, so an Array.isArray-only parser would silently drop it.
3. REPEATED KEYS / JSON ARRAY: `validateBoardSearch({ status: ["todo","review"] })` → `{ status: ["todo","review"] }`.
4. NO COMMA SPLITTING: `validateBoardSearch({ status: "todo,review" })` → `{ status: ["todo,review"] }` — ONE element.
5. NEVER THROWS: an `it.each` over `null`, `undefined`, `0`, `42`, `""`, `"junk"`, `true`, `[]`, `[1,2]`, `{ status: 123 }`, `{ status: {} }`, `{ status: [1, null, {}] }`, `{ status: null }`, `{ toString: null }` — each asserted with `expect(() => validateBoardSearch(input as never)).not.toThrow()`. Also assert a deeply nested object does not throw.
6. CAP: an input array of 120 non-empty strings yields exactly 50.
7. EMPTY-PARAM PREDICATE: `hasActiveFilterParams` is FALSE for `undefined`, `null`, `{}`, `{status: []}`, `{status: ""}`, `{status: [""]}`, `{status: ["   "]}`, and TRUE for `{status: ["todo"]}` and `{labels: ["l1"]}`. Also assert `hasActiveFilterParams(validateBoardSearch({ status: "" }))` is false and `hasActiveFilterParams(validateBoardSearch({ status: " " }))` is false — these are `?status=` and `?status=%20`.
8. CLEAN URL: `filtersToSearchParams` on an all-null BoardFilters sets every filter key to `undefined` (assert with `toBeUndefined()`), never to `[]`. Emitting `[]` would put empty keys in the URL.

AFTER WRITING, run exactly: `pnpm --filter @kaneo/web test src/lib/board-filter-params.test.ts` and iterate until every test in THIS FILE passes. Report the final counts.

SCOPE — you may create or modify EXACTLY ONE file: apps/web/src/lib/board-filter-params.test.ts. Do NOT modify board-filter-params.ts — if you believe it has a bug, leave it and describe the bug in `implementation_bugs_found`. Do not touch any other file. The only non-read-only command you may run is the scoped vitest command above. Do NOT run biome, prettier, eslint, `pnpm lint` or `pnpm i18n:check:fix`.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260826-103235-feature-extend-board-filter-chips/verified-encoding.md
_Included because: Measured router behaviour — these are the exact input shapes the tests must reproduce, and the reason the bare-string and empty-string cases matter._

```
?status=todo               -> validateSearch receives { status: "todo" }   A BARE STRING
?status=todo&status=review -> { status: ["todo","review"] }
?status=["todo","review"]  -> { status: ["todo","review"] }
?status=                   -> { status: "" }     the key IS present
?status=%20                -> { status: " " }
?status=todo,review        -> { status: "todo,review" }   ONE opaque string

On the way out: { status: undefined } -> key dropped, {} -> "" (clean URL).
Emitting [] instead of undefined would produce ?status= in the URL.
```
### Acceptance criteria
- The file exists and every test in it passes
- A round-trip test includes a comma-containing value and asserts it is not split
- A bare single string is asserted to normalize to a one-element array
- A never-throws it.each covers at least twelve hostile inputs
- hasActiveFilterParams is asserted false for the normalized forms of ?status= and ?status=%20
- An all-null BoardFilters is asserted to produce undefined, not [], for every filter key
- files_written contains exactly one path, the test file
- board-filter-params.ts was NOT modified
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
    "tests_passing": {
      "type": "integer"
    },
    "tests_failing": {
      "type": "integer"
    },
    "implementation_bugs_found": {
      "type": "array",
      "items": {
        "type": "string"
      }
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
    "tests_passing",
    "tests_failing",
    "implementation_bugs_found",
    "files_written"
  ]
}
```
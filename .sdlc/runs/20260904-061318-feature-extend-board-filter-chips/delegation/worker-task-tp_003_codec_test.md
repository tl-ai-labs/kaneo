## Task tp_003_codec_test — tests / unit_test
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create apps/web/src/lib/board-filter-search-params.test.ts per section 7.1 of .sdlc/runs/20260904-061318-feature-extend-board-filter-chips/design.md, testing apps/web/src/lib/board-filter-search-params.ts.

Cover each of the 8 numbered tolerance rules in design section 2.3 as its own case, plus these TWO REQUIRED tests with these EXACT names from design section 2.4:
  - 'a value containing a comma splits into segments that match nothing rather than inventing a filter'
  - 'encodeFilterValue drops a value containing a comma rather than emitting an ambiguous parameter'

Also cover: round-trip encode->decode for all five keys; absent params decode to all-null with no injected keys; hostile input (arrays, plain objects, numbers, booleans, null, undefined, a 10000-char string) never throws.

Plain vitest - no router, no React, no jsdom-specific APIs. Write only this one file. Format the file so that 'pnpm exec biome ci apps/web/src/lib/board-filter-search-params.test.ts' is clean (80-col line width, 2-space indent, double quotes, trailing commas).

Verify with EXACTLY this command (note: NO '--' before the path, which would silently run the whole suite):
pnpm --filter @kaneo/web test src/lib/board-filter-search-params.test.ts
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260904-061318-feature-extend-board-filter-chips/design.md
_Included because: sections 2.3, 2.4, 7.1_

```
undefined
```

#### apps/web/src/lib/board-filter-search-params.ts
_Included because: unit under test_

```
undefined
```
### Acceptance criteria
- both named comma-invariant tests exist with the exact names given
- all 8 tolerance rules have a dedicated case
- hostile-input cases assert no throw
- pnpm --filter @kaneo/web test src/lib/board-filter-search-params.test.ts passes
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string"
    },
    "test_count": {
      "type": "number"
    },
    "passed": {
      "type": "boolean"
    }
  },
  "required": [
    "path",
    "test_count",
    "passed"
  ]
}
```
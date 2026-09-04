## Task tp_002_codec — codegen / frontend_util
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create apps/web/src/lib/board-filter-search-params.ts EXACTLY as specified in sections 2.1 and 2.2 of .sdlc/runs/20260904-061318-feature-extend-board-filter-chips/design.md. That design writes out the full implementation - transcribe it faithfully, do not redesign it.

Hard rules:
- Import BoardFilters as a TYPE-ONLY import from '@/hooks/use-task-filters'. That file is READ ONLY - do not edit it.
- No zod, no valibot, no new dependency, no import other than the type import.
- Implement all 8 numbered tolerance rules from design section 2.3.
- Implement the comma invariant from design section 2.4 on BOTH sides: the decoder splits comma-carrying values into segments that match nothing, and encodeFilterValue DROPS a value containing a comma rather than emitting it.
- The decoder deliberately REJECTS arrays. Do not add an array branch.
- Decoder never returns an empty array - empty results become null.
- Never throw.

Write only this one file. Then verify with exactly: pnpm --filter @kaneo/web typecheck
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260904-061318-feature-extend-board-filter-chips/design.md
_Included because: sections 2.1-2.4 contain the full implementation and the tolerance rules_

```
undefined
```

#### apps/web/src/hooks/use-task-filters.ts
_Included because: READ ONLY - source of the BoardFilters type_

```
undefined
```
### Acceptance criteria
- exports BOARD_FILTER_SEARCH_KEYS, BoardFilterSearchKey, BoardFilterSearchParams, readRawFilterParam, decodeFilterValue, decodeBoardFilters, encodeFilterValue, encodeBoardFilters, EMPTY_BOARD_FILTERS
- BoardFilters imported via 'import type' from @/hooks/use-task-filters
- decoder returns null never [] for empty results; duplicates dropped keeping first-occurrence order
- encodeFilterValue returns undefined for null/empty and drops comma-carrying values
- no zod, no valibot, no other imports
- pnpm --filter @kaneo/web typecheck passes
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
    "exports": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "typecheck_passed": {
      "type": "boolean"
    }
  },
  "required": [
    "path",
    "exports",
    "typecheck_passed"
  ]
}
```
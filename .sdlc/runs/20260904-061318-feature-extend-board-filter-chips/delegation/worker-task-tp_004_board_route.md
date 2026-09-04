## Task tp_004_board_route — codegen / react_page
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Make exactly TWO edits to apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx, per sections 3 and 5.1 of .sdlc/runs/20260904-061318-feature-extend-board-filter-chips/design.md. Both are in this one file.

EDIT 1 (design section 3): extend the BoardSearchParams type and validateSearch with the five filter keys (status, priority, assignee, dueDate, labels), preserving taskId exactly as today. Use readRawFilterParam and the BoardFilterSearchParams type from '@/lib/board-filter-search-params'. Absent params must yield undefined so NO key is injected into the URL - do not default to empty strings.

EDIT 2 (design section 5.1): rewrite handleCloseTaskSheet (currently lines 96-102) from 'search: {}' to a functional spread updater that clears ONLY taskId and preserves every other search key. KEEP replace: true - that is existing behaviour at this site.

Do NOT introduce zod or valibot. Do NOT change anything else in the file. Format so 'pnpm exec biome ci' would be clean (80-col width, 2-space indent, double quotes).

Verify with: pnpm --filter @kaneo/web typecheck
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260904-061318-feature-extend-board-filter-chips/design.md
_Included because: sections 3 and 5.1 give the exact code_

```
undefined
```

#### apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx
_Included because: edit target_

```
undefined
```

#### apps/web/src/lib/board-filter-search-params.ts
_Included because: readRawFilterParam and BoardFilterSearchParams_

```
undefined
```
### Acceptance criteria
- validateSearch returns taskId plus the five filter keys, each string | undefined
- absent filter params yield undefined, never an empty string or injected key
- handleCloseTaskSheet uses a functional updater clearing only taskId, with replace: true retained
- no zod or valibot import added
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
    "edits": {
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
    "edits",
    "typecheck_passed"
  ]
}
```
## Task tp_014_nit_unused_prop — debug / review_fix
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Senior review nit. In apps/web/src/components/board/board-toolbar.tsx line 137, the destructured prop currently reads:

  updateLabelFilter: _updateLabelFilter,

The underscore-alias was introduced only to satisfy TypeScript's noUnusedLocals after the two label loop call sites were replaced by batched updateFilter calls. The minimal correct fix is to DELETE that destructure line entirely - the component no longer uses the prop at all, so it should simply not destructure it.

DELETE line 137. Change nothing else.

DO NOT remove updateLabelFilter from the BoardToolbarProps type - the prop stays part of the component's public contract. DO NOT change board.tsx, which still passes it. DO NOT touch the hook. Removing the prop from the type or from the call site exceeds what was authorised.

Verify ALL THREE are clean:
  pnpm --filter @kaneo/web typecheck
  pnpm exec biome ci apps/web/src/components/board/board-toolbar.tsx
  pnpm --filter @kaneo/web test src/components/board/board-toolbar.test.tsx
(NO '--' before the test path. Never run any lint script.)
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/components/board/board-toolbar.tsx
_Included because: delete the unused destructure at line 137_

```
undefined
```
### Acceptance criteria
- the destructure line for updateLabelFilter is gone from the component
- updateLabelFilter is STILL declared in BoardToolbarProps
- board.tsx unchanged
- typecheck, biome ci and the board-toolbar test all pass
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
    "line_deleted": {
      "type": "boolean"
    },
    "typecheck_passed": {
      "type": "boolean"
    },
    "biome_clean": {
      "type": "boolean"
    },
    "tests_pass": {
      "type": "boolean"
    }
  },
  "required": [
    "path",
    "line_deleted",
    "typecheck_passed",
    "biome_clean",
    "tests_pass"
  ]
}
```
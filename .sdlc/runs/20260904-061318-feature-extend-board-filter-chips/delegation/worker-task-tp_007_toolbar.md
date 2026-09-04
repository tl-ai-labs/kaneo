## Task tp_007_toolbar — codegen / react_component
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Replace EXACTLY TWO functions in apps/web/src/components/board/board-toolbar.tsx with the batched versions written out in sections 6.1 and 6.2 of .sdlc/runs/20260904-061318-feature-extend-board-filter-chips/design.md:
  - toggleLabelGroup (currently lines 233-247)
  - clearLabelFilters (currently lines 249-252)
Each must compute the FULL next label array and make exactly ONE updateFilter('labels', next) call. Semantics must be preserved precisely: if ANY label in the colour group is currently selected, remove the whole group; otherwise add the whole group. Empty result becomes null.

*** READ THIS BEFORE YOU SIMPLIFY ANYTHING ***
The hook's setFilters uses a FUNCTIONAL navigate search updater that decodes prev. That shape LOOKS like it would make N synchronous updateLabelFilter calls compose correctly. IT DOES NOT. Each synchronous navigate() call resolves against the SAME committed router location, so the last write wins and a colour-group toggle would apply only ONE label. The batching in this file IS the fix. Do NOT remove it. Do NOT revert either function to a for-loop. Do NOT conclude it is redundant. Do NOT 'simplify' by calling updateLabelFilter in a loop.

Nothing else in this 676-line file changes. updateLabelFilter STAYS declared in BoardToolbarProps and STAYS destructured from props even though these two sites no longer call it (design section 6.3). If Biome flags it as unused, leave it - it is part of the component's public prop contract.

Format so 'pnpm exec biome ci' would be clean. Verify with: pnpm --filter @kaneo/web typecheck
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260904-061318-feature-extend-board-filter-chips/design.md
_Included because: sections 6.1, 6.2, 6.3 give the exact code and the do-not-simplify warning_

```
undefined
```

#### apps/web/src/components/board/board-toolbar.tsx
_Included because: edit target_

```
undefined
```
### Acceptance criteria
- toggleLabelGroup contains no for-loop and makes exactly one updateFilter('labels', ...) call
- clearLabelFilters makes exactly one updateFilter('labels', null) call and no for-loop
- group toggle semantics preserved: any-selected => remove whole group; none-selected => add whole group
- updateLabelFilter remains declared in BoardToolbarProps and destructured
- no other line of the file changed
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
    "functions_replaced": {
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
    "functions_replaced",
    "typecheck_passed"
  ]
}
```
## Task tp_008_toolbar_test — tests / component_test
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create apps/web/src/components/board/board-toolbar.test.tsx - the R1 regression test - per section 7.3 of .sdlc/runs/20260904-061318-feature-extend-board-filter-chips/design.md, which spells out the mechanism in full. Follow it.

CORE TEST: a colour-group toggle that selects N>1 labels in ONE tick must end with ALL N labels present in the resulting search params. Build it exactly as the design says: a vi.hoisted stateful navigate mock that APPLIES the functional updater to a held search object; a bumpHarness re-render so the hook re-reads; a harness component wiring the REAL useTaskFiltersWithLabelsSupport hook to the REAL BoardToolbar; and a passthrough mock of '@/components/ui/menu' (jsdom does not open Radix submenus reliably and opening them is not what this test is about).

*** THE ASSERTION IS NON-NEGOTIABLE ***
Assert on the RESULTING SEARCH PARAMS - e.g. expect(searchRef.current.labels).toBe('l1,l2,l3'). It must NEVER be expect(updateFilter).toHaveBeenCalledWith(...) or any other spy/mock-call assertion. A spy assertion PASSES against the old buggy for-loop implementation and would ship the regression undetected. If you cannot make the search-param assertion work, FAIL the packet and report why - do not substitute a spy.

ALSO COVER: clearLabelFilters removes all labels in one tick (search param key becomes absent/undefined, not an empty string).

Format so 'pnpm exec biome ci' would be clean. Verify with EXACTLY (NO '--' before the path):
pnpm --filter @kaneo/web test src/components/board/board-toolbar.test.tsx
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260904-061318-feature-extend-board-filter-chips/design.md
_Included because: section 7.3 gives the full mechanism; 7.6 the shared helper_

```
undefined
```

#### apps/web/src/components/board/board-toolbar.tsx
_Included because: component under test_

```
undefined
```

#### apps/web/src/hooks/use-task-filters-with-labels-support.ts
_Included because: the real hook wired into the harness_

```
undefined
```

#### apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx
_Included because: working router-mock pattern already proven in this run_

```
undefined
```
### Acceptance criteria
- a colour-group toggle selecting N>1 labels in one tick results in ALL N present in the search params
- the R1 assertion reads the resulting search params, NOT a spy on updateFilter
- no toHaveBeenCalledWith stands in for the R1 assertion
- a clear-labels case removes all labels in one tick
- the real useTaskFiltersWithLabelsSupport hook and the real BoardToolbar are used, not stubs
- pnpm --filter @kaneo/web test src/components/board/board-toolbar.test.tsx passes
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
    },
    "r1_assertion_source": {
      "type": "string"
    }
  },
  "required": [
    "path",
    "test_count",
    "passed",
    "r1_assertion_source"
  ]
}
```
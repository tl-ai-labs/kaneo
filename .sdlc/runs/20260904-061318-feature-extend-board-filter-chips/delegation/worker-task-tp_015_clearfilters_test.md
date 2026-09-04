## Task tp_015_clearfilters_test — tests / component_test
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Senior review should-fix S1: clearFilters - the toolbar's 'Clear all' action - has ZERO test coverage. Nothing in the 149-test suite would catch a regression in it. Add coverage to the EXISTING apps/web/src/components/board/board-toolbar.test.tsx.

KEEP ALL 5 EXISTING TESTS EXACTLY AS THEY ARE. In particular do not weaken the R1 colour-group regression test or its navigate mock - that mock deliberately applies each updater against a committed snapshot re-synced in the Harness render body, which is what makes it able to detect the last-write-wins bug. Do not 'simplify' it.

ADD a test: starting from a search state with SEVERAL different filter types active, e.g. { status: 'to-do', priority: 'high', assignee: 'u1', labels: 'l1,l2', taskId: 'task-9' }, invoke the toolbar's clear-all action (hasActiveFilters is true so the clear control renders) and assert on the RESULTING SEARCH PARAMS that:
  - all five filter keys are cleared to undefined (not empty strings)
  - taskId is PRESERVED as 'task-9' - clearing filters must not close an open task sheet
  - it happens in ONE navigate call

Assert on searchRef.current, never on a spy standing in for the result.

Format so 'pnpm exec biome ci' is clean. Verify with EXACTLY (NO '--' before the path):
pnpm --filter @kaneo/web test src/components/board/board-toolbar.test.tsx
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/components/board/board-toolbar.test.tsx
_Included because: extend; the 5 existing tests and the committed-snapshot navigate mock must be preserved_

```
undefined
```

#### apps/web/src/components/board/board-toolbar.tsx
_Included because: component under test; clearFilters wiring_

```
undefined
```

#### apps/web/src/hooks/use-task-filters-with-labels-support.ts
_Included because: clearFilters delegates to setFilters(EMPTY_BOARD_FILTERS)_

```
undefined
```
### Acceptance criteria
- all 5 pre-existing tests still present and passing, R1 mock unchanged
- new test clears all five filter keys to undefined
- new test asserts taskId is preserved
- assertion is on searchRef.current, not a spy
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
    "existing_tests_preserved": {
      "type": "boolean"
    }
  },
  "required": [
    "path",
    "test_count",
    "passed",
    "existing_tests_preserved"
  ]
}
```
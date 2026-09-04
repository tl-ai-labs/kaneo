## Task tp_012_task_row_test — tests / component_test
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
EXTEND the existing apps/web/src/components/list-view/task-row.test.tsx per section 7.5 of .sdlc/runs/20260904-061318-feature-extend-board-filter-chips/design.md. Read apps/web/src/components/kanban-board/task-card.test.tsx first - the equivalent tests were just written there and this is the sibling site; mirror that approach.

KEEP THE EXISTING TEST INTACT. It currently passes ('renders' style test) and must continue to pass unchanged in intent.

PROBLEM TO FIX FIRST: the file currently mocks the router as vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() })), which creates a NEW spy on every call and discards it, so the navigate payload cannot be inspected. Change it to a vi.hoisted shared spy. Do not change what the existing test asserts.

ADD TWO SEPARATE TESTS - not one combined test:
  TEST 1 - OPEN a task while filters are active: the navigate payload sets taskId AND preserves every filter param.
  TEST 2 - CLOSE a task while filters are active (window.location.search already contains taskId equal to this row's task id): the navigate payload clears taskId AND preserves every filter param.

HOW TO ASSERT: capture the navigate argument, INVOKE the search function with a realistic previous-search object such as { taskId: 'task-1', status: 'to-do', labels: 'l1,l2' }, and assert on the RESOLVED OBJECT. Do not merely assert navigate was called - that would pass against the old 'search: {}' code.

MUTATION PROOF: after the tests pass, temporarily revert task-row.tsx's two branches to 'search: {}' / 'search: { taskId: task.id }', confirm BOTH new tests FAIL, then RESTORE task-row.tsx byte-identical. Report in mutant_kills_tests and source_restored.

Format so 'pnpm exec biome ci' is clean. Verify with EXACTLY (NO '--' before the path):
pnpm --filter @kaneo/web test src/components/list-view/task-row.test.tsx
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260904-061318-feature-extend-board-filter-chips/design.md
_Included because: section 7.5_

```
undefined
```

#### apps/web/src/components/list-view/task-row.test.tsx
_Included because: extend, do not replace; existing test must survive_

```
undefined
```

#### apps/web/src/components/list-view/task-row.tsx
_Included because: component under test; must end byte-identical after the mutation check_

```
undefined
```

#### apps/web/src/components/kanban-board/task-card.test.tsx
_Included because: the equivalent tests just written for the sibling site_

```
undefined
```
### Acceptance criteria
- the pre-existing test still exists and still passes
- the router mock exposes a shared hoisted navigate spy
- open-with-filters-active and close-with-filters-active are two separate tests asserting on the resolved search object
- reverting task-row.tsx to search: {} makes both new tests fail
- task-row.tsx left byte-identical to its pre-packet state
- pnpm --filter @kaneo/web test src/components/list-view/task-row.test.tsx passes
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
    "existing_test_preserved": {
      "type": "boolean"
    },
    "mutant_kills_tests": {
      "type": "boolean"
    },
    "source_restored": {
      "type": "boolean"
    }
  },
  "required": [
    "path",
    "test_count",
    "passed",
    "existing_test_preserved",
    "mutant_kills_tests",
    "source_restored"
  ]
}
```
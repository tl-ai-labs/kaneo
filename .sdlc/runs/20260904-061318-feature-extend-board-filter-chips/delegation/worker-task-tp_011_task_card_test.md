## Task tp_011_task_card_test — tests / component_test
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create apps/web/src/components/kanban-board/task-card.test.tsx per section 7.4 of .sdlc/runs/20260904-061318-feature-extend-board-filter-chips/design.md. This file does not exist yet. Use apps/web/src/components/list-view/task-row.test.tsx as the mocking template - it already mocks @tanstack/react-router, the query/mutation hooks, the stores, react-i18next and the context menu for this repo.

TWO SEPARATE ASSERTIONS - not one combined 'navigation preserves filters' test:
  TEST 1 - OPEN a task while filters are active. window.location.search has filters but no matching taskId. Click the card. The navigate payload must set taskId AND still carry every filter param.
  TEST 2 - CLOSE a task while filters are active. window.location.search already contains taskId equal to this card's task id (that is how the close branch is reached). Click the card. The navigate payload must clear taskId AND still carry every filter param.

CRITICAL - HOW TO ASSERT. The component passes a FUNCTION to search. Capture the navigate argument, INVOKE that function with a realistic previous-search object such as { taskId: 'task-1', status: 'to-do', labels: 'l1,l2' }, and assert on the RESOLVED OBJECT. Do NOT assert merely that navigate was called, and do NOT assert on the function reference. A test that only checks navigate was called would pass against the old 'search: {}' code and would be worthless.

MUTATION PROOF - you must perform this. After the tests pass, temporarily change task-card.tsx's two branches back to 'search: {}' and 'search: { taskId: task.id }', re-run, and CONFIRM both new tests FAIL. Then RESTORE task-card.tsx byte-identical to how you found it. Report the result in mutant_kills_tests and toolbar_restored.

Format so 'pnpm exec biome ci' is clean. Verify with EXACTLY (NO '--' before the path):
pnpm --filter @kaneo/web test src/components/kanban-board/task-card.test.tsx
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260904-061318-feature-extend-board-filter-chips/design.md
_Included because: section 7.4_

```
undefined
```

#### apps/web/src/components/kanban-board/task-card.tsx
_Included because: component under test; must end byte-identical after the mutation check_

```
undefined
```

#### apps/web/src/components/list-view/task-row.test.tsx
_Included because: mocking template proven in this repo_

```
undefined
```
### Acceptance criteria
- open-with-filters-active and close-with-filters-active are two separate tests
- each invokes the captured search updater and asserts on the resolved object
- reverting task-card.tsx to search: {} makes both tests fail
- task-card.tsx left byte-identical to its pre-packet state
- pnpm --filter @kaneo/web test src/components/kanban-board/task-card.test.tsx passes
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
    "mutant_kills_tests": {
      "type": "boolean"
    },
    "toolbar_restored": {
      "type": "boolean"
    }
  },
  "required": [
    "path",
    "test_count",
    "passed",
    "mutant_kills_tests",
    "toolbar_restored"
  ]
}
```
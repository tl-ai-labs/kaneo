## Task tp_006_hook_test — tests / unit_test
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
REWRITE apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx per section 7.2 of .sdlc/runs/20260904-061318-feature-extend-board-filter-chips/design.md. The hook now reads filters from router search params instead of localStorage, so the existing test fails. NEVER delete coverage - re-express it.

PRESERVE these two existing behaviours:
  1. Label filtering matches tasks from project data. Was: localStorage seeded with {labels:['label-bug']}. Now: search params { labels: 'label-bug' }. Keep the same project fixture and the same assertions on filteredProject.
  2. The it.each identifier-search test for '#123', 'proj-123', 'proj-'. This does not involve filters - keep it working as-is.

ADD:
  - no filter params => hasActiveFilters === false and every task is visible
  - calling updateFilter navigates with replace: true and a comma-joined value (e.g. selecting two labels yields 'a,b')
  - malformed/hostile params (arrays, objects, numbers, empty strings) degrade to unfiltered WITHOUT throwing

MOCKING: mock '@tanstack/react-router' with the vi.mock precedent used in apps/web/src/components/list-view/task-row.test.tsx. Export useSearch (returning a held search object) and useNavigate (a spy that applies a functional updater to that held object) as plain named exports. Do NOT add a router provider. Remove all localStorage seeding.

Format so 'pnpm exec biome ci' would be clean. Verify with EXACTLY (NO '--' before the path):
pnpm --filter @kaneo/web test src/hooks/use-task-filters-with-labels-support.test.tsx
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260904-061318-feature-extend-board-filter-chips/design.md
_Included because: sections 7.2 and 7.6_

```
undefined
```

#### apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx
_Included because: existing test to rewrite - preserve its two behaviours_

```
undefined
```

#### apps/web/src/components/list-view/task-row.test.tsx
_Included because: vi.mock('@tanstack/react-router') precedent for this repo_

```
undefined
```

#### apps/web/src/hooks/use-task-filters-with-labels-support.ts
_Included because: unit under test_

```
undefined
```
### Acceptance criteria
- the label-matching behaviour and the it.each identifier-search behaviour both still exist
- no localStorage seeding remains anywhere in the file
- a no-params case asserts hasActiveFilters === false and all tasks visible
- a malformed-params case asserts no throw and unfiltered output
- pnpm --filter @kaneo/web test src/hooks/use-task-filters-with-labels-support.test.tsx passes
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
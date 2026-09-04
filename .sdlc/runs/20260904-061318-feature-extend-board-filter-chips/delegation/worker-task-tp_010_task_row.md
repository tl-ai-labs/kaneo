## Task tp_010_task_row — codegen / react_component
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
In apps/web/src/components/list-view/task-row.tsx, replace BOTH navigate branches inside handleClick (currently lines 143-156) per section 5.3 of .sdlc/runs/20260904-061318-feature-extend-board-filter-chips/design.md. The shape is identical to what was just applied to apps/web/src/components/kanban-board/task-card.tsx - read that file for the exact pattern.

BOTH BRANCHES CHANGE:
  - close branch: search: {} -> search: (prev: Record<string, unknown>) => ({ ...prev, taskId: undefined })
  - open branch:  search: { taskId: task.id } -> search: (prev: Record<string, unknown>) => ({ ...prev, taskId: task.id })

Do NOT add replace: true - this site has no replace today and its history behaviour must not change. Change nothing else in the file.

Format so 'pnpm exec biome ci' would be clean. Verify with: pnpm --filter @kaneo/web typecheck
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260904-061318-feature-extend-board-filter-chips/design.md
_Included because: section 5.3_

```
undefined
```

#### apps/web/src/components/list-view/task-row.tsx
_Included because: edit target_

```
undefined
```

#### apps/web/src/components/kanban-board/task-card.tsx
_Included because: the exact pattern already applied at the sibling site_

```
undefined
```
### Acceptance criteria
- both branches of handleClick use a functional spread updater
- the open branch sets taskId while preserving all other keys
- the close branch clears only taskId while preserving all other keys
- no replace option added at this site
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
    "branches_changed": {
      "type": "number"
    },
    "typecheck_passed": {
      "type": "boolean"
    }
  },
  "required": [
    "path",
    "branches_changed",
    "typecheck_passed"
  ]
}
```
## Task tp_009_task_card — codegen / react_component
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
In apps/web/src/components/kanban-board/task-card.tsx, replace BOTH navigate branches inside handleTaskCardClick (currently lines 144-157) per section 5.2 of .sdlc/runs/20260904-061318-feature-extend-board-filter-chips/design.md.

BOTH BRANCHES CHANGE - this is the whole point, do not fix only one:
  - the close branch currently does search: {} -> becomes search: (prev) => ({ ...prev, taskId: undefined })
  - the OPEN branch currently does search: { taskId: task.id } -> becomes search: (prev) => ({ ...prev, taskId: task.id })
Both wipe every other search key today. The open branch is the MORE commonly hit path: clicking a card is ordinary use, and with filters now living in search params it would silently drop them all.

Do NOT add replace: true at this site - it has no replace today and its history behaviour must not change. Only the shape of search changes. Change nothing else in the file.

If tsc rejects an explicit 'prev: Record<string, unknown>' annotation here, drop the annotation and let it infer. Do NOT introduce 'any' and do NOT add a 'from:' option.

Format so 'pnpm exec biome ci' would be clean. Verify with: pnpm --filter @kaneo/web typecheck
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260904-061318-feature-extend-board-filter-chips/design.md
_Included because: section 5.2 gives the exact code_

```
undefined
```

#### apps/web/src/components/kanban-board/task-card.tsx
_Included because: edit target_

```
undefined
```
### Acceptance criteria
- both branches of handleTaskCardClick use a functional spread updater
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
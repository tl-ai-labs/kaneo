## Task tp_016_kanban_keynav — codegen / react_component
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Senior review BLOCKING finding B1. In apps/web/src/components/kanban-board/index.tsx the j and k keyboard-navigation handlers wipe every Board filter from the URL.

Lines 67 and 74 both read:
  navigate({ to: ".", search: { taskId: state.focusedTaskId } });

In TanStack Router v1 an OBJECT passed to search REPLACES the whole search object. Now that the Board's five filters live in search params, one 'j' keystroke drops all of them.

FIX BOTH LINES to the functional spread already used at four other sites in this change:

  navigate({
    to: ".",
    search: (prev: Record<string, unknown>) => ({
      ...prev,
      taskId: state.focusedTaskId,
    }),
  });

CRITICAL - USE OBJECT SPREAD, NOT Object.assign. Object.assign(prev, ...) would mutate the router's object and create a prototype-pollution sink.

Do NOT add replace: true. Do NOT touch the 'Enter' handler. Change nothing else.

Verify: pnpm --filter @kaneo/web typecheck
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/components/kanban-board/index.tsx
_Included because: edit target, lines 67 and 74_

```
undefined
```

#### apps/web/src/components/kanban-board/task-card.tsx
_Included because: the exact spread pattern already applied_

```
undefined
```
### Acceptance criteria
- both j and k handlers use a functional spread updater
- object spread used, NOT Object.assign
- the Enter handler is unchanged
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
    "sites_fixed": {
      "type": "number"
    },
    "used_object_spread": {
      "type": "boolean"
    },
    "typecheck_passed": {
      "type": "boolean"
    }
  },
  "required": [
    "path",
    "sites_fixed",
    "used_object_spread",
    "typecheck_passed"
  ]
}
```
## Task tp_cg_004 — codegen / existing_file_edit
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
In apps/web/src/components/kanban-board/task-card.tsx there are exactly TWO `navigate()` calls that replace the whole search object and therefore drop any filter params in the URL. Around line 148 and 153. Change both to functional search updaters so all other search params survive.

The deselect call currently reads:
```ts
navigate({
  to: ".",
  search: {},
});
```
Change it to drop ONLY taskId:
```ts
navigate({
  to: ".",
  search: (prev) => { const { taskId: _omit, ...rest } = prev; return rest; },
});
```

The select call currently reads:
```ts
navigate({
  to: ".",
  search: { taskId: task.id },
});
```
Change it to merge:
```ts
navigate({
  to: ".",
  search: (prev) => ({ ...prev, taskId: task.id }),
});
```

Do NOT add `replace: true` to either — these are push navigations today and that is deliberate. Change nothing else in the file: no other logic, no imports beyond what is already there, no formatting sweep of unrelated lines. If TypeScript complains about the `prev` parameter, give it an explicit type rather than reverting to an object literal.

SCOPE — you may modify EXACTLY ONE file: apps/web/src/components/kanban-board/task-card.tsx. Do not touch kanban-board/index.tsx, the list-view files, the hook, or any test. Do not run the test suite. Do not run biome, prettier, eslint or `pnpm lint`.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/components/kanban-board/task-card.tsx
_Included because: The two call sites, in context. Find them by shape, not by line number._

```
// around line 145-157
    if (isSelected) {
      navigate({
        to: ".",
        search: {},
      });
    } else {
      navigate({
        to: ".",
        search: { taskId: task.id },
      });
    }
```
### Acceptance criteria
- Exactly two navigate call sites changed to functional search updaters
- The deselect updater removes only taskId and spreads the rest
- The select updater spreads prev and sets taskId
- No replace: true was added
- No other line in the file changed
- files_written contains exactly one path
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "artifact_path": {
      "type": "string"
    },
    "sites_changed": {
      "type": "integer"
    },
    "replace_added": {
      "type": "boolean",
      "description": "must be false"
    },
    "files_written": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "artifact_path",
    "sites_changed",
    "replace_added",
    "files_written"
  ]
}
```
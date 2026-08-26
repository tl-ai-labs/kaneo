## Task tp_dbg_001 — debug / existing_file_edit
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
FIX A TYPECHECK FAILURE. `pnpm --filter @kaneo/web typecheck` currently fails with TEN errors, all the same one:

```
src/components/kanban-board/index.tsx(67,40): error TS7006: Parameter 'prev' implicitly has an 'any' type.
src/components/kanban-board/index.tsx(74,40): error TS7006: Parameter 'prev' implicitly has an 'any' type.
src/components/kanban-board/task-card.tsx(150,18): error TS7006: Parameter 'prev' implicitly has an 'any' type.
src/components/kanban-board/task-card.tsx(155,18): error TS7006: Parameter 'prev' implicitly has an 'any' type.
src/components/list-view/index.tsx(97,40): error TS7006: Parameter 'prev' implicitly has an 'any' type.
src/components/list-view/index.tsx(104,40): error TS7006: Parameter 'prev' implicitly has an 'any' type.
src/components/list-view/task-row.tsx(149,18): error TS7006: Parameter 'prev' implicitly has an 'any' type.
src/components/list-view/task-row.tsx(157,18): error TS7006: Parameter 'prev' implicitly has an 'any' type.
src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx(100,16): error TS7006: Parameter 'prev' implicitly has an 'any' type.
src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx(112,18): error TS7006: Parameter 'prev' implicitly has an 'any' type.
```

CAUSE: these components call `useNavigate()` without a `from`, so TanStack Router cannot infer the search shape and `prev` in each functional search updater is implicitly `any` under `noImplicitAny`.

FIX: annotate every one of those ten `prev` parameters as `Record<string, unknown>`. Change ONLY the parameter annotation. Do not change the updater bodies, do not revert any updater to an object literal, do not add `replace: true` anywhere, do not touch any other line.

Examples of the exact edit:
```ts
search: (prev: Record<string, unknown>) => ({ ...prev, taskId: state.focusedTaskId })
```
```ts
search: (prev: Record<string, unknown>) => { const { taskId: _omit, ...rest } = prev; return rest; }
```

AFTER EDITING, run `pnpm --filter @kaneo/web typecheck` and confirm it exits 0. If a site still errors — for instance because the updater's return type is now rejected — fix that site too, staying within the five files listed below, and report what you had to do in `notes`.

SCOPE — you may modify EXACTLY these five files and no others:
  apps/web/src/components/kanban-board/index.tsx
  apps/web/src/components/kanban-board/task-card.tsx
  apps/web/src/components/list-view/index.tsx
  apps/web/src/components/list-view/task-row.tsx
  apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx
Do not touch the hook, the lib file, or any test file. `pnpm --filter @kaneo/web typecheck` is the ONLY command you may run that is not read-only. Do NOT run biome, prettier, eslint, `pnpm lint`, any package `lint` script, or `pnpm i18n:check:fix` — they rewrite unrelated files.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- All ten prev parameters carry an explicit type annotation
- pnpm --filter @kaneo/web typecheck exits 0
- No updater body was reverted to an object literal
- No replace: true was added or removed anywhere
- files_written lists only files from the five allowed paths
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "typecheck_exit_code": {
      "type": "integer"
    },
    "sites_annotated": {
      "type": "integer"
    },
    "notes": {
      "type": "string"
    },
    "files_written": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "typecheck_exit_code",
    "sites_annotated",
    "notes",
    "files_written"
  ]
}
```
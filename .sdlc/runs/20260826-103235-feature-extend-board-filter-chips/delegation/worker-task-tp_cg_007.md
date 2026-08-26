## Task tp_cg_007 — codegen / existing_file_edit
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
In apps/web/src/components/list-view/index.tsx there are exactly TWO `navigate()` calls, around lines 97 and 104, that replace the whole search object and therefore drop any filter params in the URL. Both currently read:
```ts
navigate({ to: ".", search: { taskId: state.focusedTaskId } });
```
Change BOTH to a functional search updater so all other search params survive:
```ts
navigate({ to: ".", search: (prev) => ({ ...prev, taskId: state.focusedTaskId }) });
```

CRITICAL — there is a THIRD navigate in this file, around line 109, that goes to a DIFFERENT route:
```ts
navigate({
  to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
  params: { ... },
});
```
That one is OUT OF SCOPE. Do not touch it.

Do NOT add `replace: true`. Change nothing else in the file. If TypeScript complains about the `prev` parameter, give it an explicit type rather than reverting to an object literal.

SCOPE — you may modify EXACTLY ONE file: apps/web/src/components/list-view/index.tsx. Do not touch task-row.tsx, the kanban-board files, the hook, or any test. Do not run the test suite. Do not run biome, prettier, eslint or `pnpm lint`.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/components/list-view/index.tsx
_Included because: The two in-scope sites and the out-of-scope third one, so you can tell them apart._

```
// ~line 97   IN SCOPE
          navigate({ to: ".", search: { taskId: state.focusedTaskId } });
// ~line 104  IN SCOPE
          navigate({ to: ".", search: { taskId: state.focusedTaskId } });
// ~line 109  OUT OF SCOPE — different route, leave exactly as is
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
            params: {
              ...
            },
          });
```
### Acceptance criteria
- Exactly two navigate call sites changed to functional search updaters
- The navigate to /task/$taskId is byte-identical to before
- No replace: true was added
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
    "task_route_nav_untouched": {
      "type": "boolean"
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
    "task_route_nav_untouched",
    "files_written"
  ]
}
```
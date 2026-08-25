## Task tp_ref_003 — debug / lint_fix
Module: web-ui
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Single-line lint fix in apps/web/src/components/kanban-board/column/column-header.tsx. Do NOT explore the repo, do NOT read other files, make exactly ONE edit to this one file.

FAILURE MODE: `npx biome check` reports lint/style/noNonNullAssertion at line 137 — 'Forbidden non-null assertion.' The current lines 135-141 are:

  const hasLimit = column.wipLimit !== null;

  const isOverLimit = hasLimit && column.tasks.length > column.wipLimit!;

  const badgeContent = hasLimit
    ? `${column.tasks.length}/${column.wipLimit}`
    : column.tasks.length;

FIX: remove the `!` non-null assertion by narrowing on the field itself so TypeScript infers non-null without an assertion. Replace those lines with:

  const wipLimit = column.wipLimit;
  const hasLimit = wipLimit !== null;

  const isOverLimit = wipLimit !== null && column.tasks.length > wipLimit;

  const badgeContent = hasLimit
    ? `${column.tasks.length}/${wipLimit}`
    : column.tasks.length;

CHANGE NOTHING ELSE in the file. Do not touch the handlers, the JSX, the imports, or any other line. After the edit the file must still contain hasLimit, isOverLimit and badgeContent with identical runtime behaviour, and `npx biome check` on this file must report zero warnings.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/components/kanban-board/column/column-header.tsx
_Included because: undefined_

```
(relevant slice, lines 135-141)
  const hasLimit = column.wipLimit !== null;

  const isOverLimit = hasLimit && column.tasks.length > column.wipLimit!;

  const badgeContent = hasLimit
    ? `${column.tasks.length}/${column.wipLimit}`
    : column.tasks.length;

// column.wipLimit is typed `number | null`.
```
### Acceptance criteria
- No `!` non-null assertion remains anywhere in the file.
- npx biome check on this file reports zero warnings.
- pnpm typecheck still passes.
- Runtime behaviour of hasLimit, isOverLimit and badgeContent is unchanged; no other line in the file is modified.
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
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "artifact_path",
    "summary"
  ]
}
```
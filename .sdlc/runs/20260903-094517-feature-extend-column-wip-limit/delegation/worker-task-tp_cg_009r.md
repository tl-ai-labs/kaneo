## Task tp_cg_009r — codegen / react_component
Module: web-board
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
The JSX added to apps/web/src/components/kanban-board/column/column-header.tsx was copied verbatim from the change plan, whose code fragment exceeds Biome's 80-column line width. `pnpm exec biome ci apps/web/src/components/kanban-board/column/column-header.tsx` currently fails with "File content differs from formatting output". This is a whitespace-only problem.

Run exactly this one command:

pnpm exec biome format --write apps/web/src/components/kanban-board/column/column-header.tsx

Then confirm with:

pnpm exec biome ci apps/web/src/components/kanban-board/column/column-header.tsx

STRICTLY FORBIDDEN: do NOT run `pnpm lint`, `pnpm -r lint`, `biome check --write`, or biome with a directory or `.` argument — those rewrite unrelated files across the repo. Pass only the one explicit file path.

Do not change any logic. In particular the slug match (entry.slug === column.slug), the strict `>` comparison, the `?? null` collapse, and the absence of any isLoading/isError branch must all survive exactly. This is a reflow, not a rewrite.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### biome.json
_Included because: why the reflow is required_

```
formatter.indentStyle is tab; javascript.formatter.indentStyle is space, quoteStyle double. Default lineWidth 80 applies.
```

#### apps/web/src/components/kanban-board/column/column-header.tsx
_Included because: file to reformat_

```
The over-long lines are the two t("tasks:kanban.wipLimit...", { taskCount, limit: wipLimit }) calls in the title prop and the TriangleAlert line.
```
### Acceptance criteria
- pnpm exec biome ci apps/web/src/components/kanban-board/column/column-header.tsx exits 0
- entry.slug === column.slug is still the match expression
- taskCount > wipLimit is still strict >
- No isLoading or isError branch was introduced
- No file other than column-header.tsx was modified
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "files_changed": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "biome_ci_output": {
      "type": "string"
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "files_changed",
    "summary"
  ]
}
```
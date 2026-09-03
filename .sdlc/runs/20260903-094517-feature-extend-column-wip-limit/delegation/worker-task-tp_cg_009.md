## Task tp_cg_009 — codegen / react_component
Module: web-board
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Add the over-cap indicator to apps/web/src/components/kanban-board/column/column-header.tsx.

Read .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md sections 7.2 and 7.3 and apply the derivation block and the JSX block VERBATIM — they are written as final code, not as a sketch.

Three traps, each of which silently produces a broken component:
1. Match on `slug`, NOT on `id`. The board object's `id` IS the slug; the useGetColumns row's `id` is a cuid. Matching those never succeeds.
2. Use `>` not `>=`. taskCount === wipLimit is AT the cap, not over it.
3. `?? null` must collapse loading, error and slug-miss into one no-limit branch. Do NOT destructure isLoading or isError and do NOT add a loading branch.

Replace ONLY the existing count badge span (currently lines 62-64). Leave the icon span, name span, archive button, add button, CreateTaskModal, ArchiveTasksModal and handleConfirmArchive untouched. Add imports for useGetColumns (@/hooks/queries/column/use-get-columns), cn (@/lib/utils) and TriangleAlert (add to the existing lucide-react import). Use only existing Tailwind theme tokens — no hard-coded colour. Do not edit column/index.tsx. Then run: pnpm --filter @kaneo/web typecheck
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md
_Included because: authoritative spec fragment_

```
Section 7.2 gives the exact derivation (useGetColumns call with project?.id ?? "", find-by-slug, ?? null, strict >). Section 7.3 gives the exact replacement JSX and the three-state table. Section 7.4 covers accessibility: aria-hidden icon, sr-only span, no role, no aria-live. Section 7.5 restricts styling to existing tokens.
```

#### apps/web/src/components/kanban-board/column/column-header.tsx
_Included because: file to edit_

```
project comes from useProjectStore() already present at line 20. The count badge to replace is at lines 62-64. lucide-react is already imported for Archive and Plus.
```

#### apps/web/src/components/kanban-board/task-card-context-menu/task-card-context-menu-content.tsx
_Included because: existing pattern to follow_

```
Line ~52 shows the established local pattern: const { data: columnsData = [] } = useGetColumns(projectId), then matching on col.slug.
```
### Acceptance criteria
- wipLimit is derived via columnsData?.find((entry) => entry.slug === column.slug)?.wipLimit ?? null
- isOverCap uses strict > against column.tasks.length
- When wipLimit is null the rendered badge is byte-identical to the previous bare-count span
- The over-cap branch renders bg-destructive/10 text-destructive, an aria-hidden TriangleAlert, a title and an sr-only accessible name, all from static i18n keys
- No isLoading or isError branch was added and no hard-coded colour was used
- pnpm --filter @kaneo/web typecheck passes
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
    "summary": {
      "type": "string"
    },
    "verified": {
      "type": "string"
    }
  },
  "required": [
    "files_changed",
    "summary"
  ]
}
```
## Task tp_cg_018 — codegen / existing_file_edit
Module: web-ui
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

Edit ONLY apps/web/src/components/kanban-board/column/column-header.tsx to add the per-column estimate rollup.

Import { formatEstimatedHours, sumEstimatedMinutes } from "@/lib/format-estimated-hours".

Inside the component compute:
  const estimateLabel = formatEstimatedHours(sumEstimatedMinutes(column.tasks));

column.tasks is ALREADY in scope — it is what the existing {column.tasks.length} count badge uses — so no new query, hook or prop is needed.

Render the rollup immediately after the existing count-badge span, only when estimateLabel is non-null. When it is null render nothing at all, so a column whose tasks have no estimates looks exactly as it does today. Style it to match the count badge but distinguish it as an estimate: className "inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground" with a title of t("tasks:kanban.estimatedHoursRollup"). useTranslation and t are already present in this component. Change nothing else.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/components/kanban-board/column/column-header.tsx (exact current header block)
_Included because: The insertion point: directly after the count badge. Note column.tasks and t are already in scope._

```
export function ColumnHeader({ column }: ColumnHeaderProps) {
  const { t } = useTranslation();
  const { project, setProject } = useProjectStore();
  // ...
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-muted-foreground">
          {getColumnIcon(column.id, column.isFinal, column.icon)}
        </span>
        <span className="truncate text-sm font-medium text-foreground/95">
          {column.name}
        </span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          {column.tasks.length}
        </span>
      </div>

      <div className="flex items-center">
```

#### apps/web/src/lib/format-estimated-hours.ts (contract, being written in parallel)
_Included because: Code against these signatures; the module lands alongside your edit._

```
export function formatEstimatedHours(minutes: number | null | undefined): string | null;
export function sumEstimatedMinutes(tasks: ReadonlyArray<{ estimatedMinutes?: number | null }>): number;
// sum of [120,240] is 360; formatEstimatedHours(360) is "6h"; formatEstimatedHours(0) is null
```
### Acceptance criteria
- The rollup uses sumEstimatedMinutes over column.tasks with no new query or prop
- It renders nothing when the column has no estimates
- It renders directly after the existing task-count badge, which still renders
- No other part of the component changed
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "edited": {
      "type": "boolean"
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "edited",
    "summary"
  ]
}
```
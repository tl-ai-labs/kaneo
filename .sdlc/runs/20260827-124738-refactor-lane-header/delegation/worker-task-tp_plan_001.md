## Task tp_plan_001 — change_plan / delta_refactor_plan
Module: public-project
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Write a DELTA REFACTOR PLAN (change_plan.md) for the approved requirements. This is a pure structural extraction — no behavior change.

THE EXTRACTION BOUNDARY IS ALREADY DECIDED AND IS NOT YOURS TO REOPEN: the new component owns the outer `<div className="p-2 shrink-0">` and everything inside it (all three nested divs). `kanban-view.tsx` renders a bare `<PublicColumnHeader column={column} />` with NO surrounding wrapper div. This matches INV-1. Do not propose an alternative boundary; do not discuss the tradeoff.

Emit markdown with exactly these sections:
## Change summary (3-5 lines)
## Target file 1 — public-column-header.tsx (new)
Give the EXACT full intended file content in a fenced tsx block: imports, the `type PublicColumnHeaderProps = { column: ProjectWithTasks["columns"][number] }`, and the exported function component. Use a named export `export function PublicColumnHeader`. Import `getColumnIcon` from `@/lib/column` and `type { ProjectWithTasks }` from `@/types/project`.
## Target file 2 — kanban-view.tsx (edit)
State precisely which lines are removed and what replaces them, and confirm whether the `getColumnIcon` import must STAY (check the empty-state block — it calls getColumnIcon too).
## DOM invariant proof
An ordered list of every element from outermost to innermost with its exact className string, shown side by side before/after, proving they match.
## Whitespace/reflow note
JSX collapses whitespace around expression children. Note any place where Biome will reformat the moved markup (e.g. an element that fits on one line once de-indented) and confirm it is DOM-neutral.
## Test plan
One short paragraph: is a unit test worth adding beyond typecheck, and if so what exactly does it assert.
## Risks and rollback

Repo conventions: `type` not `interface`; inferred types preferred; comments explain constraints, never narrate code — the component needs no comments at all. Return ONLY markdown in change_plan_markdown.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260827-124738-refactor-lane-header/requirements.md
_Included because: Gate-1 approved requirements, incl. INV-1..4_

```
## In scope
1. Create `apps/web/src/components/public-project/public-column-header.tsx` exporting `PublicColumnHeader`.
2. Extract the inline column header JSX and styling from `kanban-view.tsx` into `PublicColumnHeader`.
3. Replace the inline header block in `kanban-view.tsx` with `<PublicColumnHeader column={column} />`.
4. (Optional) Add a component unit test `public-column-header.test.tsx` if it adds proof beyond typecheck.

## Out of scope
1. Renaming `Column*` to `Lane*`.
2. Sharing one header component between the private and public boards.
3. Extracting the public column container component as well.
4. Splitting backlog-list-view or list-view.

## Invariants
- INV-1: DOM Structure byte-identical: outer `<div className="p-2 shrink-0">` wrapping `<div className="flex items-center justify-between">`, wrapping `<div className="flex items-center gap-2">`, containing the getColumnIcon element, an `<h3>` for the name, a `<span>` for the count.
- INV-2: Tailwind classes unchanged: `p-2 shrink-0`, `flex items-center justify-between`, `flex items-center gap-2`, `font-medium text-foreground`, `text-sm text-muted-foreground`.
- INV-3: `getColumnIcon(column.id, column.isFinal, column.icon)` invoked with identical arguments; `{column.name}` and `{column.tasks.length}` rendered identically.
- INV-4: No private-board concerns (permissions, mutations, modals, i18n) introduced into the public header.

## Functional
- FR-1: single prop `column` typed `ProjectWithTasks["columns"][number]`, no ad-hoc type.
- FR-2: kanban-view.tsx imports and renders `<PublicColumnHeader column={column} />`.

## Acceptance
1. kanban-view.tsx no longer contains the inline header JSX.
2. DOM + Tailwind byte-identical.
3. Single required prop, indexed access type.
4. `pnpm --filter @kaneo/web typecheck` passes.
5. `pnpm --filter @kaneo/web test` passes, no new failures.
6. `pnpm exec biome ci` passes on changed paths.

```

#### apps/web/src/components/public-project/kanban-view.tsx
_Included because: Current full source — the file to edit_

```
import { getColumnIcon } from "@/lib/column";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { PublicTaskCard } from "./task-card";

type PublicKanbanViewProps = {
  project: ProjectWithTasks;
  onTaskClick: (task: Task) => void;
};

export function PublicKanbanView({
  project,
  onTaskClick,
}: PublicKanbanViewProps) {
  const columns = project.columns ?? [];

  return (
    <div className="flex-1 min-h-0 overflow-x-auto [-webkit-overflow-scrolling:touch]">
      <div className="flex gap-3 p-3 h-full min-w-max">
        {columns.map((column) => {
          return (
            <div
              key={column.id}
              className="h-full flex-1 min-w-80 max-w-96 flex-shrink-0"
            >
              <div className="flex flex-col h-full w-full min-h-0 backdrop-blur-xs rounded-lg bg-sidebar border border-border/50 transition-[background-color,box-shadow] duration-150 ease hover:bg-accent/20 hover:shadow-sm">
                <div className="p-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getColumnIcon(column.id, column.isFinal, column.icon)}
                      <h3 className="font-medium text-foreground">
                        {column.name}
                      </h3>
                      <span className="text-sm text-muted-foreground">
                        {column.tasks.length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-2 overflow-y-auto overflow-x-hidden flex-1 min-h-0 [-webkit-overflow-scrolling:touch]">
                  <div className="flex flex-col gap-1.5">
                    {column.tasks.map((task) => (
                      <PublicTaskCard
                        key={task.id}
                        task={task}
                        projectSlug={project.slug}
                        isCompleted={column.isFinal}
                        onTaskClick={onTaskClick}
                      />
                    ))}
                  </div>

                  {column.tasks.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-12 px-4">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                        {getColumnIcon(column.id, column.isFinal, column.icon)}
                      </div>
                      No tasks in {column.name.toLowerCase()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

```

#### apps/web/src/components/kanban-board/column/column-header.tsx
_Included because: The private board's already-extracted header — reference for local house style ONLY. Do not reuse, share or import it; the public board must stay free of auth/mutation imports._

```
// EXCERPT (style reference only, ~105 lines in full):
// import { getColumnIcon } from "@/lib/column";
// type ColumnHeaderProps = { ... };
// export default function ColumnHeader({ ... }: ColumnHeaderProps) { ... }
// Note: this file imports permission hooks, mutation hooks, modals and i18n — none of which
// belong in the public read-only header.
```
### Acceptance criteria
- change_plan_markdown contains all seven required section headings
- The new-file content is given in full and uses `type` not `interface`
- The extraction boundary is the outer p-2 shrink-0 div, with no alternative proposed
- The DOM invariant proof lists every element with its exact className before and after
- getcolumnicon_import_stays is true, because the empty-state block still calls getColumnIcon
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "change_plan_markdown": {
      "type": "string"
    },
    "getcolumnicon_import_stays": {
      "type": "boolean"
    },
    "unit_test_recommended": {
      "type": "boolean"
    }
  },
  "required": [
    "change_plan_markdown",
    "getcolumnicon_import_stays",
    "unit_test_recommended"
  ]
}
```
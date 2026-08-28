## Task tp_req_001 — requirements_analysis / delta_requirements
Module: public-project
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Produce a DELTA requirements document for a pure structural refactor. This is a refactor intent: the central question is WHAT MUST BE PRESERVED, not what new behavior to add. Read the intent brief and the current source file supplied in inputs.

Emit markdown with exactly these sections:
## In scope (numbered, testable)
## Out of scope (numbered — restate the brief's Non-goals verbatim in substance)
## Invariants to preserve (INV-1..) — the DOM/class/behavior contract that must not change
## Functional requirements (FR-1..)
## Non-functional requirements (NFR-1..)
## Acceptance criteria (numbered, each executable or mechanically checkable)
## Open questions for HITL (or 'None')

Rules: the brief is FROZEN and authoritative — do not redesign the job, do not propose renames, do not propose sharing a component with the private board, do not widen scope. There is no PII and no role matrix relevant to this change; state that in one line under NFR rather than inventing tables. Repo conventions: prefer inferred types and `type` over `interface`; comments explain constraints, not narrate code. Return ONLY the markdown in the requirements_markdown field.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260827-124738-refactor-lane-header/intent_brief.md
_Included because: The frozen, authoritative brief for this run_

```
# Intent Brief — refactor — Extract PublicColumnHeader from the public kanban column

## Context
The user's request was "extract LaneHeader component from Lane". This repo has no `Lane`
concept — the board's vertical containers are `Column` everywhere (`Column`, `ColumnHeader`,
`ColumnDropzone`, `getColumnIcon`, `ProjectWithTasks["columns"]`, and the API/DB `columns`
relation). `grep -ri lane` over `apps/web/src` and `apps/api/src` returns zero hits.

On the private board the extraction already exists:
`apps/web/src/components/kanban-board/column/index.tsx` is 36 lines of pure composition and
delegates to `column-header.tsx` (105 lines) and `column-dropzone.tsx`.

The public read-only board is the one that never got the treatment.
`apps/web/src/components/public-project/kanban-view.tsx` (70 lines) renders the whole column
inline inside a `.map()`, including an inline header block — the `getColumnIcon` /
`column.name` / `column.tasks.length` trio wrapped in two flex divs.

That inline header is the real, not-yet-done target matching the request.

## Goal
Extract the inline column-header markup in `public-project/kanban-view.tsx` into its own
component, `PublicColumnHeader`, in a new file
`apps/web/src/components/public-project/public-column-header.tsx`, and render it from
`kanban-view.tsx`. Pure structural extraction — identical DOM and classes.

## Files in scope
- `apps/web/src/components/public-project/public-column-header.tsx` (new)
- `apps/web/src/components/public-project/kanban-view.tsx` (edit — replace inline header
  with `<PublicColumnHeader column={column} />`)
- `apps/web/src/components/public-project/public-column-header.test.tsx` (new, optional —
  only if it adds real proof beyond typecheck)

## Files off-limits
Project defaults, plus:
- `apps/web/src/routeTree.gen.ts`, `i18n/schema.json`, `pnpm-lock.yaml`, `apps/api/drizzle/**`
- `.gitignore`, `.claude/**`, `.cursor/rules/**`, `AGENTS.md`, `CLAUDE.md`, `.coderabbit.yaml`
- `apps/web/src/components/kanban-board/**` (the private board is already correct; do not
  touch it, and do not attempt to share a component between the two boards)

## Acceptance criteria
1. `kanban-view.tsx` no longer contains the inline header JSX; it renders `<PublicColumnHeader>`.
2. Rendered DOM and Tailwind classes are byte-identical to before the change.
3. `PublicColumnHeader` takes the column as its only required prop, typed from
   `ProjectWithTasks["columns"][number]` — no new ad-hoc type.
4. `pnpm --filter @kaneo/web typecheck` passes.
5. `pnpm --filter @kaneo/web test` passes with no new failures.
6. `pnpm exec biome ci` passes on the changed paths only.

## Non-goals
- Renaming `Column*` → `Lane*`.
- Sharing one header component between the private and public boards.
- Extracting the public column *container* as well. The request is the header.
- Splitting `backlog-list-view/index.tsx` (485 lines) or `list-view/index.tsx` (466 lines).

```

#### apps/web/src/components/public-project/kanban-view.tsx
_Included because: The file to be refactored — the inline header block is lines 26-40_

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
### Acceptance criteria
- requirements_markdown contains all seven required section headings
- Invariants section names the DOM structure and Tailwind classes as unchangeable
- No requirement proposes a Column->Lane rename or a shared component with the private board
- Acceptance criteria include typecheck, test and biome ci commands
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "requirements_markdown": {
      "type": "string"
    },
    "open_questions_count": {
      "type": "integer"
    }
  },
  "required": [
    "requirements_markdown",
    "open_questions_count"
  ]
}
```
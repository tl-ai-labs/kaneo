# Requirements — refactor — Extract `PublicColumnHeader`

- **Run:** `20260827-124738-refactor-lane-header` · **Mode:** brownfield · **Intent:** `refactor`
- **Policy:** `flash-agsdk-only` · Produced by `gemini-3.7-flash` (packet `tp_req_001`)
- **Source brief:** `.sdlc/runs/20260827-124738-refactor-lane-header/intent_brief.md` (frozen)

## In scope
1. Create a new component file `apps/web/src/components/public-project/public-column-header.tsx` exporting `PublicColumnHeader`.
2. Extract the inline column header JSX and styling from `apps/web/src/components/public-project/kanban-view.tsx` into `PublicColumnHeader`.
3. Replace the inline header block in `apps/web/src/components/public-project/kanban-view.tsx` with `<PublicColumnHeader column={column} />`.
4. (Optional) Add a component unit test in `apps/web/src/components/public-project/public-column-header.test.tsx` if needed beyond typecheck.

## Out of scope
1. Renaming `Column*` to `Lane*`.
2. Sharing one header component between the private and public boards.
3. Extracting the public column container component as well.
4. Splitting `backlog-list-view/index.tsx` (485 lines) or `list-view/index.tsx` (466 lines).

## Invariants to preserve (INV-1..)
- INV-1: DOM Structure — The rendered HTML elements and nesting hierarchy must remain byte-identical: an outer `<div className="p-2 shrink-0">` wrapping `<div className="flex items-center justify-between">`, wrapping `<div className="flex items-center gap-2">`, containing the icon element from `getColumnIcon`, an `<h3>` element for the column name, and a `<span>` element for the task count.
- INV-2: Tailwind CSS Classes — All Tailwind class names on each element (`p-2 shrink-0`, `flex items-center justify-between`, `flex items-center gap-2`, `font-medium text-foreground`, `text-sm text-muted-foreground`) must remain exactly unchanged.
- INV-3: Icon and Metadata Contract — `getColumnIcon(column.id, column.isFinal, column.icon)` must be invoked with identical arguments, rendering `{column.name}` and `{column.tasks.length}` with the same text presentation.
- INV-4: Public Board Isolation — No drag-and-drop, task creation, or mutable actions from the private board header shall be introduced into the public header component.

## Functional requirements (FR-1..)
- FR-1: `PublicColumnHeader` must accept a single prop `column` typed as `ProjectWithTasks["columns"][number]` without introducing ad-hoc types or interfaces.
- FR-2: `PublicKanbanView` in `apps/web/src/components/public-project/kanban-view.tsx` must import `PublicColumnHeader` and render `<PublicColumnHeader column={column} />` within the column iterator.

## Non-functional requirements (NFR-1..)
- NFR-1: TypeScript & Code Conventions — Use `type` over `interface` for prop types, prefer indexed type access (`ProjectWithTasks["columns"][number]`), and keep comments constraint-focused rather than narrating code.
- NFR-2: Security and Data Handling — There is no PII and no role matrix relevant to this change; the component only renders public read-only project column data.
- NFR-3: Performance & Zero Regressions — The refactored component must introduce zero additional DOM wrappers, layout shift, or re-render performance penalties.

## Acceptance criteria
1. `apps/web/src/components/public-project/kanban-view.tsx` no longer contains the inline header JSX; it renders `<PublicColumnHeader column={column} />`.
2. Rendered DOM structure and Tailwind classes of `PublicColumnHeader` are byte-identical to the original inline header markup.
3. `PublicColumnHeader` takes `column` as its only required prop, typed from `ProjectWithTasks["columns"][number]` with no new ad-hoc type.
4. `pnpm --filter @kaneo/web typecheck` passes with zero errors.
5. `pnpm --filter @kaneo/web test` passes with no new failures.
6. `pnpm exec biome ci` passes on the changed and newly created files.

## Open questions for HITL
None

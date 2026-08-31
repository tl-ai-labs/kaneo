# Requirements - Extract `PublicColumnHeader` from the public kanban column

**Run:** `20260828-081120-refactor-lane-header`
**Module:** `public-project`
**Job type:** brownfield REFACTOR (delta)
**Nature of change:** pure structural extraction. No behavior, no styling, no data-flow change.

**Data handling / PII / roles:** Not applicable — `PublicColumnHeader` is a read-only presentational component that renders props already fetched and rendered by `kanban-view.tsx`; it performs no data access, no persistence, no authorization decision, and introduces no new field to any response, so a PII inventory and a role matrix would both be empty.

---

## In scope

1. Create `apps/web/src/components/public-project/public-column-header.tsx` exporting a named component `PublicColumnHeader`.
2. `PublicColumnHeader` owns the extraction boundary **the outer `<div className="p-2 shrink-0">`** together with all three nested divs currently inside it (the `flex items-center justify-between` div, the `flex items-center gap-2` div, and the `<h3>` / `<span>` contents), moved verbatim.
3. Move the `getColumnIcon(column.id, column.isFinal, column.icon)` call that lives inside the header block into `public-column-header.tsx`, adding the `@/lib/column` import there.
4. Edit `apps/web/src/components/public-project/kanban-view.tsx` to delete that inline header JSX and render the extracted component **called bare as `<PublicColumnHeader column={column} />`** at exactly the position the removed `<div className="p-2 shrink-0">` occupied.
5. Keep `getColumnIcon` imported in `kanban-view.tsx`, because the empty-state block still calls it. After the edit, `grep -c getColumnIcon apps/web/src/components/public-project/kanban-view.tsx` must return `2` (one import, one call site in the empty state).
6. Type the component's single required prop from the existing `ProjectWithTasks["columns"][number]` in `@/types/project` — no new ad-hoc column type, no re-declared field list.
7. Add a unit test `apps/web/src/components/public-project/public-column-header.test.tsx` using vitest + `@testing-library/react`, with a fixture whose `id` is `"in-progress"`, `@/lib/column` **not** mocked, the icon asserted via `container.querySelector("svg")`, the column name and task count asserted via `screen` queries with `toBeVisible()`, the fixture cast as `ProjectWithTasks["columns"][number]`, and **explicitly no assertions on Tailwind class strings**.

## Out of scope

1. Renaming `Column*` to `Lane*` anywhere in the repository.
2. Sharing one header component between the private board (`apps/web/src/components/kanban-board/**`) and the public board. The two stay separate implementations.
3. Extracting the public column *container* (the `min-w-80 max-w-96` wrapper or the `flex flex-col h-full` card). Only the header is extracted.
4. Splitting `backlog-list-view/index.tsx` or `list-view/index.tsx`.
5. Any edit under `apps/web/src/components/kanban-board/**`, generated files, AI configs, `.env*`, or lockfiles.

---

## Functional requirements

- **FR-1** — A new module `apps/web/src/components/public-project/public-column-header.tsx` exists and exports `PublicColumnHeader` as a named export.
- **FR-2** — `PublicColumnHeader` accepts exactly one required prop, `column`, typed as `ProjectWithTasks["columns"][number]` imported (as a `type` import) from `@/types/project`. It accepts no other required prop.
- **FR-3** — `PublicColumnHeader` renders, as its root element, `<div className="p-2 shrink-0">`; inside it `<div className="flex items-center justify-between">`; inside that `<div className="flex items-center gap-2">`; and inside that, in order: the result of `getColumnIcon(column.id, column.isFinal, column.icon)`, `<h3 className="font-medium text-foreground">{column.name}</h3>`, and `<span className="text-sm text-muted-foreground">{column.tasks.length}</span>`.
- **FR-4** — `PublicColumnHeader` imports `getColumnIcon` from `@/lib/column` and calls it with the argument order `(column.id, column.isFinal, column.icon)`.
- **FR-5** — `kanban-view.tsx` contains no inline column-header JSX; the removed block is replaced by the single bare call `<PublicColumnHeader column={column} />`, with no spread props, no `key`, and no wrapper element around it.
- **FR-6** — `kanban-view.tsx` imports `PublicColumnHeader` from `./public-column-header` using the same relative sibling-import style already used for `./task-card`.
- **FR-7** — `kanban-view.tsx` still imports `getColumnIcon` from `@/lib/column` and still calls it inside the empty-state block (`column.tasks.length === 0`) with the same arguments as before.
- **FR-8** — `apps/web/src/components/public-project/public-column-header.test.tsx` exists and renders `PublicColumnHeader` with a single fixture column whose `id` is `"in-progress"`, the fixture expression cast as `ProjectWithTasks["columns"][number]`.
- **FR-9** — The test asserts the icon is present via `container.querySelector("svg")` (not via a mock, not via a test id), with `@/lib/column` left unmocked so the real `getColumnIcon` runs.
- **FR-10** — The test asserts the column name and the task count are rendered using `screen` queries terminating in `toBeVisible()`.
- **FR-11** — The test contains no assertion on any Tailwind or `className` string.

## Non-functional requirements

- **NFR-1** — Zero visual change. A user comparing the public board before and after the change sees an identical rendering at every viewport.
- **NFR-2** — Zero runtime-behavior change. No new state, no `useEffect`, no memoization, no event handler, no conditional rendering introduced.
- **NFR-3** — No new runtime dependency, and no new package added to `apps/web`.
- **NFR-4** — The new component is a plain synchronous function component, consistent with the surrounding `public-project` files; it is not wrapped in `React.memo`, `forwardRef`, or any HOC.
- **NFR-5** — Follows repo conventions: `type` over `interface` for the props type, inferred types where possible, `import type` for type-only imports, no comment that merely narrates the code.
- **NFR-6** — Formatting and lint conform to Biome as configured in this repo; the change introduces no Biome diagnostic on the changed paths.
- **NFR-7** — The change is confined to the three files named in scope. No other file in the worktree is modified.
- **NFR-8** — The test is deterministic and hermetic: no network, no timers, no snapshot file, no shared mutable fixture between cases.

---

## Invariants to preserve

This is a refactor. The following must be identical before and after; any difference is a defect, not an improvement.

### DOM tree shape

- **INV-1** — The rendered DOM of the public kanban board is byte-identical to the pre-change output for every input. Element count, element order, nesting depth, and tag names are unchanged.
- **INV-2** — The header subtree remains exactly four levels: `div.p-2.shrink-0` › `div.flex.items-center.justify-between` › `div.flex.items-center.gap-2` › (`svg` icon, `h3`, `span`). No div is collapsed, merged, or added, even though the `justify-between` div has a single child.
- **INV-3** — Extraction introduces no wrapper element and no React `Fragment` that would alter the DOM; `PublicColumnHeader` returns the `div.p-2.shrink-0` directly.
- **INV-4** — The header remains a sibling immediately preceding the scroll body `div.p-2.overflow-y-auto…`, inside the same `div.flex.flex-col.h-full…` card.

### Class strings

- **INV-5** — Every `className` moved into the new file is copied verbatim, character for character, including token order and whitespace: `"p-2 shrink-0"`, `"flex items-center justify-between"`, `"flex items-center gap-2"`, `"font-medium text-foreground"`, `"text-sm text-muted-foreground"`.
- **INV-6** — No class is normalized, deduplicated, reordered, merged via `cn()`/`clsx`, or made conditional.
- **INV-7** — Classes on elements left behind in `kanban-view.tsx` (outer column wrapper, card, scroll body, task list, empty state) are untouched.

### Prop flow

- **INV-8** — The header's data source stays the same `column` object from `columns.map((column) => …)`; it is passed whole, by reference, not destructured into scalars at the call site and not reshaped.
- **INV-9** — The three values read remain exactly `column.id`, `column.isFinal`, `column.icon` (for the icon), `column.name` (heading), and `column.tasks.length` (count). No default value, no fallback, no `??`, no formatting of the count.
- **INV-10** — `PublicKanbanView`'s own props (`project`, `onTaskClick`) and its `const columns = project.columns ?? []` guard are unchanged. Neither is threaded into the new component.
- **INV-11** — `key={column.id}` remains on the outer column wrapper div in `kanban-view.tsx` and is not moved onto `PublicColumnHeader`.

### Import graph

- **INV-12** — `kanban-view.tsx` keeps its existing imports: `getColumnIcon` from `@/lib/column` (still used by the empty state), `type ProjectWithTasks` from `@/types/project`, `type Task` from `@/types/task`, and `PublicTaskCard` from `./task-card`. The only import added is `PublicColumnHeader`.
- **INV-13** — `grep -c getColumnIcon apps/web/src/components/public-project/kanban-view.tsx` returns `2`. Removing the now-"unused-looking" import is a regression, not a cleanup.
- **INV-14** — Dependency direction stays one-way: `kanban-view.tsx` → `public-column-header.tsx`. The new module imports nothing from `kanban-view.tsx`; no cycle is created.
- **INV-15** — `@/lib/column` is not modified, and `getColumnIcon` keeps its current signature and return value.
- **INV-16** — Nothing under `apps/web/src/components/kanban-board/**` is imported, re-exported, or edited. The public and private boards remain independent.
- **INV-17** — No barrel/index re-export is added for `public-column-header`; it is imported by path, matching `./task-card`.

---

## Acceptance criteria

1. `test -f apps/web/src/components/public-project/public-column-header.tsx` succeeds, and the file exports `PublicColumnHeader`.
2. `grep -n "<PublicColumnHeader column={column} />" apps/web/src/components/public-project/kanban-view.tsx` returns exactly one match.
3. `grep -c "p-2 shrink-0" apps/web/src/components/public-project/kanban-view.tsx` returns `0`, and `grep -c "p-2 shrink-0" apps/web/src/components/public-project/public-column-header.tsx` returns `1`.
4. `grep -c getColumnIcon apps/web/src/components/public-project/kanban-view.tsx` returns `2`.
5. `grep -c "font-medium text-foreground" apps/web/src/components/public-project/public-column-header.tsx` returns `1` and `grep -c "text-sm text-muted-foreground" apps/web/src/components/public-project/public-column-header.tsx` returns `1`, with both strings absent from the removed region of `kanban-view.tsx`.
6. `git diff --name-only` lists exactly `apps/web/src/components/public-project/kanban-view.tsx`, `apps/web/src/components/public-project/public-column-header.tsx`, and `apps/web/src/components/public-project/public-column-header.test.tsx` — no file under `apps/web/src/components/kanban-board/`, no lockfile, no `.env*`, no generated file.
7. `pnpm --filter @kaneo/web typecheck` passes with no new error, confirming the `ProjectWithTasks["columns"][number]` prop type resolves without an ad-hoc type.
8. `pnpm --filter @kaneo/web test` passes with no new failure, including the new `public-column-header.test.tsx`.
9. The new test file renders the component with a fixture whose `id` is `"in-progress"`, asserts `container.querySelector("svg")` is present, and asserts the name and count with `screen` queries ending in `toBeVisible()`.
10. The test makes no Tailwind class-string assertion (no `toHaveClass`, no `className` matcher).
11. `@/lib/column` is not mocked in the test file.
12. `pnpm exec biome ci` passes on the three changed paths.
13. Diff review confirms the moved JSX is verbatim: the header block deleted from `kanban-view.tsx` and the block added in `public-column-header.tsx` differ only in the substitution of `column` for the map variable and in indentation.

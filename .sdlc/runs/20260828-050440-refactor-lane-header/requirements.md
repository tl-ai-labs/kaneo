# Requirements — Extract `PublicColumnHeader` (refactor / delta)

> **Omitted sections:** no PII inventory and no role matrix are included — this is a read-only public presentational component with no data model, no auth surface, and no new data flow.

## In scope

1. Create `apps/web/src/components/public-project/public-column-header.tsx` exporting a named component `PublicColumnHeader`.
2. `PublicColumnHeader` accepts exactly one required prop, `column`, typed as `ProjectWithTasks["columns"][number]` (imported from `@/types/project`); no new ad-hoc column type is declared.
3. Move the inline column-header JSX out of `apps/web/src/components/public-project/kanban-view.tsx` into the new component. The extraction boundary is the OUTER `<div className="p-2 shrink-0">`: the new component owns that div and all three nested divs (`flex items-center justify-between`, `flex items-center gap-2`, and the icon/`h3`/`span` trio inside it).
4. In `kanban-view.tsx`, the removed block is replaced by a bare `<PublicColumnHeader column={column} />` call with no wrapper element around it, in the same position within the column container.
5. `getColumnIcon` MUST remain imported in `kanban-view.tsx` because the empty-state block still calls it.
6. Add a colocated vitest unit test at `apps/web/src/components/public-project/public-column-header.test.tsx` covering the rendered DOM shape, class strings, element order, and task-count rendering.

## Out of scope

1. Renaming `Column*` → `Lane*` anywhere in the web app; the API and DB call these columns.
2. Sharing one header component between the private (`kanban-board/column/column-header.tsx`) and public boards, or otherwise modifying `apps/web/src/components/kanban-board/**`.
3. Extracting the public column *container* (the `min-w-80 max-w-96` div or the `bg-sidebar` card div).
4. Splitting or otherwise refactoring `backlog-list-view/index.tsx` or `list-view/index.tsx`.
5. Any behavioural change: no new props, no i18n keys, no styling tweaks, no accessibility additions, no memoization, no changes to `getColumnIcon` or to `apps/web/src/lib/column.tsx`.

## Invariants to preserve

All invariants are measured against `kanban-view.tsx` at HEAD `5d1fc910`.

- **INV-1 — DOM shape.** For a given `column`, the DOM produced by `<PublicColumnHeader column={column} />` is byte-identical to the DOM previously produced by the inline block: four nested elements in the order `div > div > div > (svg, h3, span)`.
- **INV-2 — Outer div.** The outermost element is a `div` with the exact class string `p-2 shrink-0`.
- **INV-3 — Row div.** Its only child is a `div` with the exact class string `flex items-center justify-between`.
- **INV-4 — Group div.** Its only child is a `div` with the exact class string `flex items-center gap-2`.
- **INV-5 — Element order inside the group div.** Exactly three children, in this order: (1) the element returned by `getColumnIcon(...)`, (2) an `h3`, (3) a `span`. No wrapper, fragment, or whitespace-bearing element is introduced between them.
- **INV-6 — Heading.** The `h3` has the exact class string `font-medium text-foreground` and its text content is `column.name`, unmodified (no casing, trimming, or truncation).
- **INV-7 — Count.** The `span` has the exact class string `text-sm text-muted-foreground` and its text content is `column.tasks.length` rendered as a number.
- **INV-8 — Icon call signature.** The icon is produced by the call `getColumnIcon(column.id, column.isFinal, column.icon)` — same function, same three positional arguments, same order. No defaulting, coercion, or additional arguments.
- **INV-9 — Empty-state block unchanged.** The empty-state block in `kanban-view.tsx` (`No tasks in {column.name.toLowerCase()}`, the `w-8 h-8 rounded-full bg-muted ...` div, and its own `getColumnIcon(column.id, column.isFinal, column.icon)` call) is untouched.
- **INV-10 — `getColumnIcon` import retained.** `kanban-view.tsx` keeps `import { getColumnIcon } from "@/lib/column";`. `grep -c getColumnIcon apps/web/src/components/public-project/kanban-view.tsx` returns `2` after the edit (the import line and the empty-state call).
- **INV-11 — Surrounding structure.** The public column container, the `.map()` over `columns`, the `key={column.id}`, the scroll container, and all `PublicTaskCard` props in `kanban-view.tsx` are unchanged.
- **INV-12 — Public exports.** `PublicKanbanView` keeps its name, export style, and `PublicKanbanViewProps` shape; no other module's imports change.

## Functional requirements

- **FR-1.** `public-column-header.tsx` exports `PublicColumnHeader` as a named export.
- **FR-2.** The component's props type is declared with `type` (not `interface`) and derives `column` from `ProjectWithTasks["columns"][number]`.
- **FR-3.** The component renders the markup described by INV-2 through INV-8 for any `column` value, and renders nothing else.
- **FR-4.** The component is pure and presentational: no hooks, no state, no data fetching, no mutations, no event handlers, no i18n calls, no permission checks.
- **FR-5.** `kanban-view.tsx` imports `PublicColumnHeader` from `./public-column-header` and renders it bare at the former position of the inline header.
- **FR-6.** A count of `0` renders as the literal text `0` (not blank, not hidden).
- **FR-7.** *(Amended — **Operator override at Gate 1**; supersedes the dispatched wording, which additionally required asserting the four class strings of INV-2/3/4/6/7 and the three-child order of INV-5.)* `public-column-header.test.tsx` renders the component with a fixture column and asserts: the `column.name` text, the task-count text, and that an icon element is present. It **must not assert any Tailwind class string**. Shape is fixed: vitest + `@testing-library/react` under jsdom with the `@` alias; fixture `id: "in-progress"`; `@/lib/column` left unmocked; icon asserted via `container.querySelector("svg")`; name and count via `screen` queries; `toBeVisible()` rather than `toBeTruthy()`; the fixture cast as `ProjectWithTasks["columns"][number]` rather than `as unknown as`.

## Non-functional requirements

- **NFR-1.** Zero behavioural or visual change; the diff is structural only.
- **NFR-2.** No new runtime dependency, no new file outside the three listed in scope, and no edits to off-limits or generated files (`routeTree.gen.ts`, `i18n/schema.json`, `pnpm-lock.yaml`, `apps/api/drizzle/**`, AI config files, `kanban-board/**`).
- **NFR-3.** No auth-only or permission-related import is introduced into the public bundle; the public board stays unauthenticated and read-only.
- **NFR-4.** Code matches surrounding style: inferred types where possible, Biome-clean formatting, comments only where a constraint is non-obvious.
- **NFR-5.** No net increase in rendered element count or render work per column.
- **NFR-6.** No commit, push, or pull request is created.

## Acceptance criteria

1. `apps/web/src/components/public-project/public-column-header.tsx` exists and exports `PublicColumnHeader`.
2. `grep -c 'p-2 shrink-0' apps/web/src/components/public-project/kanban-view.tsx` returns `0`; the same grep against `public-column-header.tsx` returns `1`.
3. `grep -c getColumnIcon apps/web/src/components/public-project/kanban-view.tsx` returns `2`.
4. `grep -c '<PublicColumnHeader column={column} />' apps/web/src/components/public-project/kanban-view.tsx` returns `1`, and the matched line has no wrapping element on it.
5. `grep -c 'ProjectWithTasks\["columns"\]\[number\]' apps/web/src/components/public-project/public-column-header.tsx` returns at least `1`.
6. `apps/web/src/components/public-project/public-column-header.test.tsx` exists and passes.
7. `pnpm --filter @kaneo/web test` passes with no new failures.
8. `pnpm --filter @kaneo/web typecheck` passes.
9. `pnpm exec biome ci` passes on the three changed paths.
10. `git status --porcelain` lists only the three in-scope files as modified/added.
11. `git diff` on `kanban-view.tsx` shows only the header block removed, the `PublicColumnHeader` import added, and the one-line render added — no other hunks.
12. *(Amended — **Operator override at Gate 1**; the dispatched wording required the unit test to assert those five exact class strings and the icon → `h3` → `span` child order.)* The unit test asserts **no** Tailwind class string. The byte-identical-DOM invariant (INV-1 through INV-8) is verified by the diff and by the senior reviewer's tokenized `(tag, className)` comparison — not at runtime.

### Operator override at Gate 1 — rationale (recorded)

Applies to **FR-7** and **AC-12** above. Authorized by the operator at Gate 1; disclosed here rather than applied silently.

1. **Class assertions test the wrong thing at the wrong layer.** The byte-identical-DOM invariant is already verified by the diff and by the senior reviewer's tokenized `(tag, className)` comparison. A runtime assertion on `p-2 shrink-0` adds no verification the reviewer does not already provide, and once this refactor lands it degrades into a styling change-detector: it fails on any future intentional Tailwind edit while catching no behavioural regression. That is maintenance cost returning noise.
2. **Comparability.** Runs 1 and 2 both shipped run-1-shaped tests. A class-asserting test in run 3 would diverge the artifact set on the one file that already differs between runs, and would do so because of a requirements phase's preference rather than anything about the policy under test.
3. **Downstream consequence.** Leaving AC-12 as dispatched guarantees the senior reviewer flags the run-1-shaped test as failing an acceptance criterion — a false finding that would then need explaining away in the final report.

**Observation for the final report (not a defect):** `opus-only-v5`'s requirements phase independently proposed class-level assertions where run 1's `opus-plus-flash-v37` did not. Recorded as an observed behavioural difference between the same model owning every phase versus being one tier of a mixed policy.

## Open questions

None.

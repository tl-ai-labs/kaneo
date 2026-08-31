# change_plan.md — Extract `PublicColumnHeader` from the public kanban view

Run: `20260828-081120-refactor-lane-header` · Module: `public-project` · Packet: `tp_plan_001`

## 1. Change summary

This is a pure, behavior-preserving extraction confined to three files under `apps/web/src/components/public-project/`. The public kanban board currently renders each column's header inline inside `PublicKanbanView`'s `columns.map()` body: a `div.p-2.shrink-0` wrapping `div.flex.items-center.justify-between` wrapping `div.flex.items-center.gap-2`, which holds the `getColumnIcon(...)` result, an `<h3>` with the column name, and a `<span>` with the task count. That four-level subtree moves verbatim into a new file `public-column-header.tsx` exporting a plain synchronous function component `PublicColumnHeader`, taking exactly one required prop `column` typed as `ProjectWithTasks["columns"][number]`. The `getColumnIcon` call moves with the JSX, so the new file imports it from `@/lib/column`; `kanban-view.tsx` keeps its own `getColumnIcon` import because the empty-state block still calls it independently. At the call site the removed subtree is replaced, in place, by a bare `<PublicColumnHeader column={column} />` — no wrapper, no spread, no `key`. Nothing else changes: no memoization, no barrel file, no sharing with the private `kanban-board/**` implementation, no class or DOM edits, no new dependency. The rendered DOM must be byte-identical before and after.

## 2. File-by-file plan

### 2.1 `apps/web/src/components/public-project/public-column-header.tsx` — new file

The file has three imports: the value import `getColumnIcon` from `@/lib/column`, and the type-only import `ProjectWithTasks` from `@/types/project` (via `import type`, per repo convention). It declares a local `type PublicColumnHeaderProps` — `type`, not `interface`, because the repo prefers `type` and this shape is never extended or declaration-merged — with a single required property `column` whose type is derived by indexed access from the canonical project type rather than being restated. The component is a named export, a plain synchronous function declaration matching the `export function PublicKanbanView(...)` / `PublicTaskCard` style already in this directory. It holds no state, no effects, no handlers, no conditionals; it returns the `div.p-2.shrink-0` element directly with no Fragment or extra wrapper. Every `className` string is copied character-for-character, token order included. No comments are added — there is no constraint here that the code does not already state.

```tsx
import { getColumnIcon } from "@/lib/column";
import type { ProjectWithTasks } from "@/types/project";

type PublicColumnHeaderProps = {
  column: ProjectWithTasks["columns"][number];
};

export function PublicColumnHeader({ column }: PublicColumnHeaderProps) {
  return (
    <div className="p-2 shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getColumnIcon(column.id, column.isFinal, column.icon)}
          <h3 className="font-medium text-foreground">{column.name}</h3>
          <span className="text-sm text-muted-foreground">
            {column.tasks.length}
          </span>
        </div>
      </div>
    </div>
  );
}
```

Note on the `<h3>`: in `kanban-view.tsx` its child sits on its own line purely because of the deeper indentation there. At this indentation Biome fits it on one line. That is a formatter-driven whitespace difference in the source, not a DOM difference — JSX collapses the surrounding whitespace-only lines identically in both forms, so INV-1 (byte-identical DOM) holds. The `<span>` keeps its child on a separate line because Biome still wraps it at this indentation; if `biome ci` disagrees with either of these, take the formatter's output — formatting is not a DOM change.

### 2.2 `apps/web/src/components/public-project/kanban-view.tsx` — edit

Two changes, nothing else:

1. Add one import, `import { PublicColumnHeader } from "./public-column-header";`, alongside the existing `import { PublicTaskCard } from "./task-card";` — same relative-path style, no barrel or `index.ts`. Biome's import sorting will place it; do not hand-order it against the formatter.
2. Replace the header subtree with `<PublicColumnHeader column={column} />` at exactly the position the removed `div` occupied.

Everything else is untouched: the `PublicKanbanViewProps` type, the `const columns = project.columns ?? []` guard, the `key={column.id}` on the outer wrapper `div` (it stays there and does **not** move onto `PublicColumnHeader`), all existing `className` strings, the scroll body, the task list, and the empty state. The existing `import { getColumnIcon } from "@/lib/column";` stays — the empty-state block still calls it.

Resulting map body, abbreviated to the changed region:

```tsx
<div className="flex flex-col h-full w-full min-h-0 backdrop-blur-xs rounded-lg bg-sidebar border border-border/50 transition-[background-color,box-shadow] duration-150 ease hover:bg-accent/20 hover:shadow-sm">
  <PublicColumnHeader column={column} />

  <div className="p-2 overflow-y-auto overflow-x-hidden flex-1 min-h-0 [-webkit-overflow-scrolling:touch]">
    {/* unchanged */}
  </div>
</div>
```

### 2.3 `apps/web/src/components/public-project/public-column-header.test.tsx` — new file

A focused component test following the existing convention in `apps/web/src/components/kanban-board/task-labels.test.tsx`: `cleanup` in `afterEach`, `render` + `screen` queries asserted with `toBeVisible()`. Shape detailed in section 5.

## 3. Extraction mechanics

The span removed from `kanban-view.tsx` is contiguous and self-contained. Its first line is:

```tsx
                <div className="p-2 shrink-0">
```

and its last line is:

```tsx
                </div>
```

That is: the opening tag of the outer `div.p-2.shrink-0` through its matching closing tag at the same 16-space indentation — nine source lines in total, comprising all three nested `div`s, the `getColumnIcon(...)` expression, the `<h3>`, and the `<span>`. The blank line that currently follows the closing `</div>` (separating the header from the scroll body) is preserved as the separator between the new call site and the scroll body.

The call site goes at exactly that position: as the first child of the column card `div` (the one with the `flex flex-col h-full w-full min-h-0 backdrop-blur-xs ...` classes), immediately preceding the sibling `div.p-2.overflow-y-auto...` scroll body. This keeps INV-4 (header is the sibling immediately preceding the scroll body inside the same card) trivially true. The `column` object is passed whole by reference — `column={column}` — not destructured, spread, or reconstructed at the call site.

Dependency direction is one-way: `kanban-view.tsx` → `public-column-header.tsx`. The new file imports nothing from `kanban-view.tsx`, so no cycle is possible. Nothing under `apps/web/src/components/kanban-board/**` is imported or edited, and `@/lib/column` is not modified.

## 4. Type strategy

The prop type is derived, not declared. `ProjectWithTasks` in `apps/web/src/types/project/index.ts` defines `columns` as:

```ts
columns: Array<
  Omit<ProjectWithTasksRaw["columns"][number], "tasks"> & { tasks: Task[] }
>;
```

Indexing that array type with `[number]` — `ProjectWithTasks["columns"][number]` — yields exactly the element type `PublicKanbanView` already passes, including the narrowed `tasks: Task[]`. This is the same value flowing through the same type, so `column.id`, `column.isFinal`, `column.icon`, `column.name`, and `column.tasks.length` all resolve identically inside the new component and at the call site. Writing an ad-hoc `type Column = { id: string; name: string; ... }` is forbidden by FR-2: it would restate the shape, drift silently when `ProjectWithTasksRaw` changes, and could accept or reject values the real board never produces. The indexed access has no such drift — a schema change to columns propagates into this component at typecheck time.

The props container is a `type` alias rather than an `interface` per the repo convention stated in `AGENTS.md` ("prefer inferred TypeScript types and `type` over `interface` unless extension or declaration merging is required"); neither applies here. The return type is left inferred for the same reason — no explicit `JSX.Element` / `React.FC` annotation, and no `React.memo`, `forwardRef`, or HOC wrapper (NFR-4).

## 5. Test plan

File: `apps/web/src/components/public-project/public-column-header.test.tsx`. One `describe` block, deterministic and hermetic, no snapshot, no fake timers, no network.

- **Imports:** `{ cleanup, render, screen }` from `@testing-library/react`; `{ afterEach, describe, expect, it }` from `vitest`; `import type { ProjectWithTasks } from "@/types/project"`; `{ PublicColumnHeader }` from `"./public-column-header"`.
- **Teardown:** `afterEach(() => { cleanup(); })`, matching `task-labels.test.tsx`.
- **Fixture:** a single column object with `id: "in-progress"` (a real column id, so the un-mocked `getColumnIcon` takes its known-id branch and returns an icon element), a `name`, `isFinal: false`, `icon: null`, and a `tasks` array of two minimal task objects — cast to `ProjectWithTasks["columns"][number]`. `@/lib/column` is **not** mocked (FR-9): mocking it would make the test pass even if the argument order regressed, which is precisely the failure this test exists to catch.
- **Assertions:** three, from one `render`.
  - Icon: `container.querySelector("svg")` from the `render` return is expected `toBeVisible()` — the icon is decorative and carries no accessible name, so there is no role or text query for it.
  - Name: `screen.getByText("In Progress")` → `toBeVisible()`.
  - Count: `screen.getByText("2")` → `toBeVisible()`.
- **Explicitly excluded:** no `toHaveClass`, no `className` matcher, no assertion on any Tailwind class string (FR-11 / NFR-8). Class strings are guarded by diff review and by the `p-2 shrink-0` grep counts, not by the test — asserting on them would make every future styling change a test failure without catching any real defect.

If the direct `as ProjectWithTasks["columns"][number]` cast fails typecheck because `ProjectWithTasksRaw["columns"][number]` carries required fields the fixture omits, widen the cast to `as unknown as ProjectWithTasks["columns"][number]` rather than inventing a local type or filling in fields the component never reads. Do not weaken the component's prop type to accommodate the fixture.

## 6. Risk register

A pure extraction has a narrow but real failure surface: everything that could break here breaks *silently*, because the component still compiles and still renders something.

| # | Risk | How it fails silently | Invariant / detection |
|---|---|---|---|
| R1 | **`getColumnIcon` import deleted from `kanban-view.tsx`** as apparent dead-code cleanup after the header JSX moves out. | The empty-state block still calls `getColumnIcon`; removing the import is a build break at best and, if an editor auto-fixes it to something else, a wrong icon in the empty state. This is a **regression, not a cleanup** (INV-13). | `grep -c getColumnIcon apps/web/src/components/public-project/kanban-view.tsx` must return **2** (one import, one empty-state call). Also caught by `pnpm --filter @kaneo/web typecheck`. |
| R2 | **A `div` collapsed during the move** — most likely the `div.flex.items-center.justify-between`, which looks redundant because it has a single child. | Layout shifts subtly on wide columns; no test fails. | INV-2: the subtree stays exactly four levels, `div.p-2.shrink-0 > div.flex.items-center.justify-between > div.flex.items-center.gap-2 > (svg, h3, span)`. Caught by diff review against the quoted span in section 3. |
| R3 | **A `className` normalized, reordered, merged via `cn()`/`clsx`, or made conditional.** | Tailwind class order can change specificity resolution; the diff looks like a tidy-up. | INV-6/INV-7: every class copied verbatim, token order included. Detection: `grep -c "p-2 shrink-0"` → 0 in `kanban-view.tsx`, 1 in `public-column-header.tsx`; plus diff review. |
| R4 | **`getColumnIcon` argument order changed** to `(column.id, column.icon, column.isFinal)` while moving. | Wrong or missing icon for final columns; TypeScript may not catch it if the parameter types overlap. | FR-8 fixes the order as `(column.id, column.isFinal, column.icon)`. Caught by the test's un-mocked icon assertion (R4 is the reason `@/lib/column` must not be mocked) and by diff review. |
| R5 | **`key={column.id}` moved onto `<PublicColumnHeader />`.** | React loses the reconciliation key on the outer wrapper `div`; column reordering produces stale DOM and lost scroll position. | INV-11: the key stays on the outer wrapper and does not move. Diff review. |
| R6 | **Call site wrapped or the column destructured** — e.g. `<div><PublicColumnHeader ... /></div>` or `<PublicColumnHeader {...column} />`. | Extra DOM node changes the card's flex child count; a spread breaks the single-prop contract. | INV-3 (no wrapper/Fragment), INV-10 (column passed whole by reference). Detection: exactly one match for the literal `<PublicColumnHeader column={column} />`. |
| R7 | **Values reformatted** — e.g. `column.tasks?.length ?? 0`, or a `column.name` fallback. | Renders `0` where the old code would have thrown, masking a real upstream data bug. | INV-8: values read remain exactly `column.id`, `column.isFinal`, `column.icon`, `column.name`, `column.tasks.length`, with no fallback or formatting. |
| R8 | **Scope creep** — renaming `Column*` to `Lane*`, sharing the header with `kanban-board/**`, adding a barrel `index.ts`, or adding `React.memo`. | All explicitly out of scope; each expands the blast radius past what was reviewed. | `git diff --name-only` must list exactly the three in-scope files, none under `kanban-board/**`. |
| R9 | **Header no longer the immediate sibling of the scroll body**, e.g. inserted after it or outside the card. | Header renders below the task list; only visible in a browser. | INV-4. Diff review of the call-site position (section 3). |

Note on R2/R3/R9: no automated check in this plan proves visual equivalence. The diff review step in section 7 is the primary control for those, and the quoted first/last line in section 3 is what the review compares against.

## 7. Verification steps

Run in this order, from the repo root. Stop at the first failure.

1. **Scope — only the three in-scope files changed.**
   ```bash
   git diff --name-only && git status --porcelain apps/web/src/components/public-project
   ```
   Expect exactly `apps/web/src/components/public-project/kanban-view.tsx` modified, plus the two new files `public-column-header.tsx` and `public-column-header.test.tsx`. Nothing under `apps/web/src/components/kanban-board/**`, no generated files, no `.env*`, no lockfiles. (Pre-existing untracked entries such as `.sdlc/` and `.hook-logs/` are unrelated worktree state and stay untouched.)

2. **Export and call site present exactly once.**
   ```bash
   grep -n "export function PublicColumnHeader" apps/web/src/components/public-project/public-column-header.tsx
   grep -c "<PublicColumnHeader column={column} />" apps/web/src/components/public-project/kanban-view.tsx
   ```
   Expect one match for the export; the count must be `1`.

3. **Header JSX fully moved, not duplicated.**
   ```bash
   grep -c "p-2 shrink-0" apps/web/src/components/public-project/kanban-view.tsx
   grep -c "p-2 shrink-0" apps/web/src/components/public-project/public-column-header.tsx
   ```
   Expect `0` and `1` respectively.

4. **`getColumnIcon` retained for the empty state (R1).**
   ```bash
   grep -c getColumnIcon apps/web/src/components/public-project/kanban-view.tsx
   ```
   Must return `2`.

5. **Typecheck.**
   ```bash
   pnpm --filter @kaneo/web typecheck
   ```

6. **Focused test, then the package suite.**
   ```bash
   pnpm --filter @kaneo/web test src/components/public-project/public-column-header.test.tsx
   pnpm --filter @kaneo/web test
   ```

7. **Lint/format on the changed paths only** (do not run the root `lint` script — it runs Biome with `--write` and can rewrite unrelated files).
   ```bash
   pnpm exec biome ci \
     apps/web/src/components/public-project/kanban-view.tsx \
     apps/web/src/components/public-project/public-column-header.tsx \
     apps/web/src/components/public-project/public-column-header.test.tsx
   ```

8. **Diff review — the manual control for R2, R3, R5, R6, R7, R9.**
   ```bash
   git diff apps/web/src/components/public-project/kanban-view.tsx
   ```
   Read the removed span against section 3 and the new file against section 2.1: confirm four nesting levels intact, every `className` character-identical, `getColumnIcon(column.id, column.isFinal, column.icon)` argument order unchanged, `key={column.id}` still on the outer wrapper `div`, the call site bare and positioned immediately before `div.p-2.overflow-y-auto...`, and the only added import being `PublicColumnHeader`.

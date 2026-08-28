# Change plan — extract `PublicColumnHeader`

## Summary

The column header markup inside `PublicKanbanView`'s `columns.map()` body is lifted, unchanged, into a new presentational component `PublicColumnHeader` in the same directory. `kanban-view.tsx` imports it and renders `<PublicColumnHeader column={column} />` in the exact position the extracted block occupied. A colocated vitest component test covers the new component; no other file, behavior, or rendered DOM changes.

## Change set

| path | new/edit | what changes | why |
| --- | --- | --- | --- |
| `apps/web/src/components/public-project/public-column-header.tsx` | new | Named export `PublicColumnHeader`, `PublicColumnHeaderProps` type, the header JSX lifted verbatim | The extraction target |
| `apps/web/src/components/public-project/kanban-view.tsx` | edit | One import added; lines 27–39 replaced by a bare `<PublicColumnHeader column={column} />` | Call site moves to the extracted component |
| `apps/web/src/components/public-project/public-column-header.test.tsx` | new | Single render test: name, task count, icon presence | Locks the extracted component's rendered output |

No other file is touched. `task-card.tsx`, `list-view.tsx`, and every non-public board component are unaffected.

## New file: public-column-header.tsx

Path: `apps/web/src/components/public-project/public-column-header.tsx`

### Imports

Exactly two import statements, in this order. Biome's organize-imports groups node builtins → packages → `@/` aliases → relative; there are no builtins, no package imports, and no relative imports here, so both lines fall in the `@/` alias group and sort alphabetically by specifier (`@/lib/column` before `@/types/project`):

```tsx
import { getColumnIcon } from "@/lib/column";
import type { ProjectWithTasks } from "@/types/project";
```

`ProjectWithTasks` must be a **type-only** import (`import type`), matching how `kanban-view.tsx` imports it. Do not import React, do not import `Task`, do not import anything from `@/constants/column-icons` — the icon comes only through `getColumnIcon`.

### Props type

Declared with `type`, not `interface` (repo convention; also enforced by requirements FR-2). Single required prop, typed by indexed access so the component tracks the project type automatically:

```tsx
type PublicColumnHeaderProps = {
  column: ProjectWithTasks["columns"][number];
};
```

The props type is module-local — do **not** export it. `ProjectWithTasks["columns"][number]` must appear literally in this file (AC-5); do not introduce an intermediate alias such as `type Column = ...`.

### Export form and body

Named function export, destructured prop, no default export, no `React.FC`:

```tsx
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

The JSX above is the header block **lifted verbatim** from `kanban-view.tsx` lines 27–39, with every `column.` reference unchanged. No class strings are reordered, renamed, merged, or rewritten. No wrapper element and no fragment is added — the outer `<div className="p-2 shrink-0">` is the component's single root. No hooks, no state, no event handlers, no i18n keys, no permission checks: the component is purely presentational and derives everything from `column`.

The only permitted difference from the source lines is **whitespace produced by Biome at the new, shallower nesting depth**. Concretely: at depth 5 in `kanban-view.tsx` the `<h3>` exceeded the print width and Biome broke `{column.name}` onto its own line; at depth 3 here the same element fits on one line, so Biome collapses it. That is a formatter outcome, not an authored change — it alters zero bytes of rendered DOM. The `<span>` still exceeds the print width and stays broken across three lines, as written above. Emit the file exactly as shown and confirm with `pnpm exec biome ci apps/web/src/components/public-project` that the formatter agrees; if Biome rewrites anything other than that `<h3>` line, the emitted JSX diverged from the source and must be re-lifted.

No comment header is needed — the component is self-evident, and the repo does not comment components that need no constraint explained.

## Edit: kanban-view.tsx

Path: `apps/web/src/components/public-project/kanban-view.tsx`. Three hunks, nothing else in the file changes.

### Hunk 1 — add the import

The file's import block currently ends with a single relative import:

```tsx
import { getColumnIcon } from "@/lib/column";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { PublicTaskCard } from "./task-card";
```

Biome sorts the relative-import group alphabetically, and `"./public-column-header"` sorts before `"./task-card"` (`p` < `t`). The new line therefore goes **immediately after the `@/types/task` line and immediately before the `./task-card` line** — first in the relative group, not appended at the end of the block:

```tsx
import { getColumnIcon } from "@/lib/column";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { PublicColumnHeader } from "./public-column-header";
import { PublicTaskCard } from "./task-card";
```

No blank line is introduced between the alias group and the relative group — the existing block has none, and Biome does not add one.

**The `getColumnIcon` import stays.** It is still used by the empty-state block (~line 57, inside the `column.tasks.length === 0 &&` branch), which renders the same icon inside the muted circle. Removing the import would break the build; removing or refactoring the empty-state block is out of scope. After the edit `getColumnIcon` must appear exactly twice in the file: the import line and the empty-state call (AC-3).

### Hunk 2 — delete lines 27–39

Delete the outer `<div className="p-2 shrink-0">` and everything nested inside it, through and including its closing `</div>`:

```tsx
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
```

Delete only those thirteen lines. The `<div className="flex flex-col h-full w-full min-h-0 backdrop-blur-xs ...">` above and the blank line below are **not** part of the deletion.

### Hunk 3 — insert the call site

At that exact position, insert a single self-closing element, bare — no wrapping `<div>`, no fragment, no `key` (the `key` lives on the outer column `<div>` and stays there):

```tsx
                <PublicColumnHeader column={column} />
```

Indentation is the same 16 spaces the deleted `<div className="p-2 shrink-0">` had. **Preserve the blank line** that separates the header block from the task-list `<div className="p-2 overflow-y-auto ...">`: exactly one blank line before that div, as today. The resulting region reads:

```tsx
              <div className="flex flex-col h-full w-full min-h-0 backdrop-blur-xs rounded-lg bg-sidebar border border-border/50 transition-[background-color,box-shadow] duration-150 ease hover:bg-accent/20 hover:shadow-sm">
                <PublicColumnHeader column={column} />

                <div className="p-2 overflow-y-auto overflow-x-hidden flex-1 min-h-0 [-webkit-overflow-scrolling:touch]">
```

Everything else — `PublicKanbanViewProps`, the `PublicKanbanView` signature and named export, `const columns = project.columns ?? []`, the two scroll containers, the `columns.map` callback shape, the `PublicTaskCard` render, and the empty-state block — is byte-for-byte unchanged.

## New file: public-column-header.test.tsx

Path: `apps/web/src/components/public-project/public-column-header.test.tsx` (colocated; `vitest.config.ts` includes `src/**/*.test.{ts,tsx}`).

The shape below is fixed by the operator decision recorded in requirements.md FR-7 at Gate 1. It is **not open to redesign** — do not add class assertions, snapshot assertions, extra fixtures, or mocks beyond what is listed.

- Runner: vitest under the existing `jsdom` environment, `@testing-library/react` for rendering, `@` alias resolved by `vitest.config.ts`.
- One fixture column with `id: "in-progress"`. That id maps to `"CircleDot"` via `DEFAULT_COLUMN_ICON_NAMES`, so the **unmocked** `getColumnIcon` resolves an `Icon` and takes its primary branch, returning a real lucide `<svg>`.
- `@/lib/column` is **NOT** mocked. Nothing is mocked; there are no `vi.mock` blocks and no `vi.clearAllMocks()`.
- Icon asserted via `container.querySelector("svg")` from `render`'s return value.
- Column name and task count asserted via `screen` queries (`screen.getByText`).
- Assertions use `toBeVisible()` in preference to `toBeTruthy()`. `@testing-library/jest-dom/vitest` is already loaded by `src/test/setup.ts`, so the matcher is available without any per-file import.
- The fixture is cast `as ProjectWithTasks["columns"][number]`, **not** `as unknown as ...`.
- **No assertion mentions any Tailwind class string** — not `p-2 shrink-0`, not `font-medium text-foreground`, not `text-sm text-muted-foreground`, not the icon's `w-4 h-4`.

### Explicit `cleanup()`: required

The repo's existing component tests (e.g. `apps/web/src/components/list-view/task-row.test.tsx`) call `cleanup()` in an `afterEach`, and that is what this plan requires here. It is not merely stylistic: `vitest.config.ts` does **not** set `test.globals`, and `src/test/setup.ts` contains only `import "@testing-library/jest-dom/vitest";` — it registers no global `afterEach`. Testing Library's automatic cleanup only activates when a global `afterEach` exists, so without an explicit call the jsdom document would leak between tests. Include the explicit `afterEach(() => { cleanup(); })`. Omit `vi.clearAllMocks()`, which `task-row.test.tsx` needs only because it mocks hooks.

### File shape

Import order follows Biome: packages (`@testing-library/react`, then `vitest`), then the `@/` alias, then the relative import — the same ordering `task-row.test.tsx` already has.

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ProjectWithTasks } from "@/types/project";
import { PublicColumnHeader } from "./public-column-header";

afterEach(() => {
  cleanup();
});

const column = {
  id: "in-progress",
  name: "In Progress",
  isFinal: false,
  icon: null,
  tasks: [{ id: "task-1" }, { id: "task-2" }],
} as ProjectWithTasks["columns"][number];

describe("PublicColumnHeader", () => {
  it("renders the column name, task count, and icon", () => {
    const { container } = render(<PublicColumnHeader column={column} />);

    expect(screen.getByText("In Progress")).toBeVisible();
    expect(screen.getByText("2")).toBeVisible();
    expect(container.querySelector("svg")).toBeVisible();
  });
});
```

The fixture's `tasks` entries only need to exist for `.length`; keep them minimal. If the `column` type requires additional non-optional fields, add the minimum literal values needed to satisfy `tsc` — the direct `as` cast tolerates missing optional fields but not a shape with no overlap, so add fields rather than widening to `as unknown as`. Verify with `pnpm --filter @kaneo/web typecheck`.

A count of `0` must render as a literal `0` (FR-6); that follows from `{column.tasks.length}` being lifted unchanged and needs no extra test case under the fixed shape above.

## Invariant verification

Mechanical checks, all run from the repo root after the edit:

```bash
# AC-2 — the header block moved, it did not get duplicated
grep -c 'p-2 shrink-0' apps/web/src/components/public-project/kanban-view.tsx           # 0
grep -c 'p-2 shrink-0' apps/web/src/components/public-project/public-column-header.tsx  # 1

# AC-3 — getColumnIcon import retained + still used by the empty state
grep -c getColumnIcon apps/web/src/components/public-project/kanban-view.tsx            # 2

# AC-4 — exactly one bare call site
grep -c '<PublicColumnHeader column={column} />' apps/web/src/components/public-project/kanban-view.tsx  # 1

# AC-5 — indexed-access prop type present
grep -c 'ProjectWithTasks\["columns"\]\[number\]' apps/web/src/components/public-project/public-column-header.tsx  # >= 1
```

Byte-identical DOM is proven by a **tokenized `(tag, className)` comparison** of the before/after header subtree, in document order. Both sides must yield exactly this sequence, with no element added, removed, or reordered and no class string altered:

1. `div` — `p-2 shrink-0`
2. `div` — `flex items-center justify-between`
3. `div` — `flex items-center gap-2`
4. `{getColumnIcon(column.id, column.isFinal, column.icon)}` — same three positional arguments, same order
5. `h3` — `font-medium text-foreground`, text `{column.name}` unmodified (no `.toLowerCase()`, no trim, no template)
6. `span` — `text-sm text-muted-foreground`, text `{column.tasks.length}` unmodified

The comparison is performed on the diff by the reviewer, not asserted at runtime — per the Gate 1 amendment to AC-12, the unit test asserts no Tailwind class string.

Remaining proof:

```bash
pnpm --filter @kaneo/web test
pnpm --filter @kaneo/web typecheck
pnpm exec biome ci apps/web/src/components/public-project
```

Do not run the root `lint` or root `test` scripts: root `lint` runs Biome with `--write` and can rewrite unrelated files, and root `test` rebuilds every package.

## Risks

- **Biome import-order churn.** Appending `./public-column-header` after `./task-card` (the natural "add at the end" instinct) is wrong and Biome will move it, producing a diff line the plan did not authorize. Place it before `./task-card` from the start, then confirm with `biome ci`.
- **react-compiler babel preset.** `vite.config.ts` runs `@rolldown/plugin-babel` with `reactCompilerPreset()`, but vitest does not — so a construct that passes `pnpm --filter @kaneo/web test` can still fail or memoize differently in the build. The new component is a plain named function with no hooks and no conditional logic, which the compiler handles trivially, but run `pnpm --filter @kaneo/web build` before calling the change done rather than relying on the test run alone.
- **Stray blank line after the deletion.** The deleted block is followed by a blank line separating it from the task-list div. Deleting one line too many collapses that separator; deleting one too few leaves a double blank line that Biome will reformat, dirtying the diff. Delete exactly lines 27–39 and re-verify the region matches the snippet in Hunk 3.
- **Formatter collapse of the `<h3>`.** At the new nesting depth Biome joins `{column.name}` onto the `<h3>` line. This is expected and DOM-neutral; do not "fix" it back to the three-line form, which Biome would then rewrite.
- **Over-tightening the props type.** Narrowing `column` to a hand-written shape instead of `ProjectWithTasks["columns"][number]` would pass locally and silently decouple the component from the project type. AC-5's grep guards this.

## Out of scope

Everything not listed in the Change set above; see `.sdlc/runs/20260828-050440-refactor-lane-header/requirements.md` for the authoritative scope boundary and invariants INV-1 through INV-12.

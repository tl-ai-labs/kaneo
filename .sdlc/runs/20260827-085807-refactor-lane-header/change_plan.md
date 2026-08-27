# Change Plan — refactor — Extract `PublicColumnHeader`

Run: `20260827-085807-refactor-lane-header` · Intent: `refactor` · Mode: brownfield
Authoritative inputs: `requirements.md` (Gate 1 approved), `intent_brief.md`
Stack: React 19 + Vite + TypeScript, Tailwind utility classes inline, Vitest + Testing Library,
Biome for lint/format. No NestJS/Prisma/Django vocabulary applies here.

---

## 1. Scope of change

| # | Path | Kind | Purpose |
|---|---|---|---|
| 1 | `apps/web/src/components/public-project/public-column-header.tsx` | **new** | Holds the extracted public column-header markup as `PublicColumnHeader`. |
| 2 | `apps/web/src/components/public-project/kanban-view.tsx` | **edit** (`patch_apply`) | Replace inline header JSX with `<PublicColumnHeader column={column} />`; add sibling import. |
| 3 | `apps/web/src/components/public-project/public-column-header.test.tsx` | **new** | Render test proving the extracted DOM still emits icon + name + count. |

No files removed. No other path is written. `apps/web/src/components/kanban-board/**`,
`@/lib/column`, `@/types/project` and the task-card subtree are read-only for this run.

---

## 2. Target file contents — `public-column-header.tsx`

This section is the codegen contract. Implement it literally.

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

Constraints on the above:

- **Exactly two imports.** No `react` import (the repo uses the automatic JSX runtime — see
  `kanban-view.tsx`, which imports no React). No `cn`, no `clsx`, no icon import.
- **Named export only.** No `export default`. Matches `PublicTaskCard` in the same directory.
- **Four `className` strings, byte-identical to source:** `"p-2 shrink-0"`,
  `"flex items-center justify-between"`, `"flex items-center gap-2"`,
  `"font-medium text-foreground"`, `"text-sm text-muted-foreground"`.
- **No wrapping fragment.** The outer `div.p-2.shrink-0` is the single root.
- **No comments.** Nothing here is non-obvious.
- The `{column.tasks.length}` expression sits on its own line only because the single-line form
  exceeds Biome's 80-column width. JSX strips whitespace-only lines adjacent to an expression
  child, so the rendered DOM is identical to the current one-line form. Do not fight the
  formatter to keep it on one line.

---

## 3. The `kanban-view.tsx` edit

Pre-change file is 70 lines. Apply exactly two hunks.

**Hunk A — import.** Insert one line so the sibling imports stay alphabetically sorted (Biome
organize-imports order):

```tsx
import { getColumnIcon } from "@/lib/column";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { PublicColumnHeader } from "./public-column-header";   // <- added
import { PublicTaskCard } from "./task-card";
```

**Hunk B — body.** Delete lines **27–39 inclusive** (the `<div className="p-2 shrink-0">` block
through its closing `</div>`) and replace them with the single line, indented 16 spaces to match
the removed block's opening line:

```tsx
                <PublicColumnHeader column={column} />
```

Line 40 is a blank separator line before the task-list `div` — **keep it**.

**`getColumnIcon` stays imported.** The empty-state block (pre-change line 57) still calls
`getColumnIcon(column.id, column.isFinal, column.icon)` inside the "No tasks in …" placeholder.
That call is not part of the header and is explicitly out of scope. A patch that removes the
`@/lib/column` import from `kanban-view.tsx` is wrong and will fail typecheck. Same for the
`ProjectWithTasks` type import — still used by `PublicKanbanViewProps`.

Post-change verification greps:

- `grep -n 'font-medium text-foreground' .../kanban-view.tsx` → no output.
- `grep -c 'PublicColumnHeader column={column}' .../kanban-view.tsx` → `1`.
- `grep -c 'getColumnIcon' .../kanban-view.tsx` → `2` (import + empty-state call).

---

## 4. Prop typing decision

`column: ProjectWithTasks["columns"][number]`, with `ProjectWithTasks` imported **type-only**
from `@/types/project`. Props container is a local `type PublicColumnHeaderProps`, never an
`interface` (AGENTS.md: prefer inferred types and `type` over `interface`).

Deriving beats hand-writing because `ProjectWithTasks["columns"][number]` is itself derived from
the Hono client's `InferResponseType`, so any API-side column-shape change surfaces here as a
typecheck failure instead of silently drifting from a hand-copied field list. This also mirrors
`ColumnHeaderProps` on the private board — the same derivation, independently declared, with no
shared module between the two boards.

---

## 5. Test plan — `public-column-header.test.tsx`

Shape follows `task-labels.test.tsx` (simple render + assert) with a fixture block borrowed in
style from `task-row.test.tsx`. Do not introduce a new test shape, a custom render helper, or a
provider wrapper — `PublicColumnHeader` has no context, router, i18n or query dependency.

**Binding constraints:**

1. `vitest` + `@testing-library/react`. Imports: `{ cleanup, render, screen }` from
   `@testing-library/react`; `{ afterEach, describe, expect, it }` from `vitest`. `afterEach(() =>
   { cleanup(); })` exactly as in `task-labels.test.tsx`. No `vi` import — nothing is mocked.
2. **`@/lib/column` is left UNMOCKED.** The real `getColumnIcon` must run and render a real
   lucide `<svg>`. A stubbed icon would make the test pass against a broken extraction, which
   defeats the only reason the file exists.
3. **Exactly three assertions**, no more:
   - icon rendered — `expect(container.querySelector("svg")).not.toBeNull();` using the
     `container` returned by `render(...)`. Query by element, not by class.
   - name — `expect(screen.getByText("In Progress")).toBeVisible();`
   - count — `expect(screen.getByText("3")).toBeVisible();`
4. **No assertion on any Tailwind class string**, no `toMatchSnapshot`, no `container.innerHTML`
   comparison. Class byte-identity is verified by reading the diff at senior review, not here.
   Class assertions couple the test to styling and fail on unrelated design work while catching
   nothing real.
5. Single `describe("PublicColumnHeader", ...)` with a single `it`.

**Fixture.** The prop type is derived from the API response type and carries more fields than the
component reads. Build a minimal literal covering only what the component touches, and widen it
with **one** `as` assertion:

```tsx
const column = {
  id: "in-progress",
  name: "In Progress",
  isFinal: false,
  icon: null,
  tasks: [{ id: "task-1" }, { id: "task-2" }, { id: "task-3" }],
} as ProjectWithTasks["columns"][number];
```

A single `as` is the least-bad option: TypeScript permits asserting an object literal to a
supertype with additional required properties, so no `as unknown as` double cast is needed. Do
not reach for `as unknown as` unless the single assertion actually errors, and do not hand-write
a fake column type — that is exactly the ad-hoc shape FR-2 forbids. `id: "in-progress"` is chosen
because it resolves through `DEFAULT_COLUMN_ICON_NAMES` to a real lucide icon, so the icon
assertion exercises the primary branch of `getColumnIcon` rather than the `isFinal` fallback.
`ProjectWithTasks` is imported type-only in the test file too.

---

## 6. Invariants to preserve

Checkable at review:

1. Rendered DOM for any `project` input is identical pre/post — same tags, same nesting depth,
   same element order (`icon`, `h3`, `span`).
2. All five `className` strings unchanged, character for character.
3. No wrapper element added or removed; no fragment introduced; the header root remains
   `div.p-2.shrink-0`.
4. `kanban-view.tsx` renders `PublicColumnHeader` in the exact position the removed block held —
   first child of the column shell `div`, before the task-list `div`.
5. No new runtime dependency; `package.json` and `pnpm-lock.yaml` untouched.
6. Nothing auth-only enters the public bundle: `public-column-header.tsx` imports no hook, store,
   modal, mutation, `react-i18next` or permission helper. Its import graph is `@/lib/column` +
   `@/types/project` (type-only, erased at build) and nothing else.
7. `getColumnIcon` itself is unmodified.
8. `git status --short` lists only the three planned paths.

---

## 7. Explicit non-goals

Carried verbatim from the brief; none of these may appear in any packet:

- No `Column*` → `Lane*` rename anywhere. API, Drizzle schema and typed client all say `columns`.
- No edit under `apps/web/src/components/kanban-board/**`.
- No component shared or merged between the private and public boards.
- No extraction of the public column *container* (the two wrapper `div`s and the task list).
- No split of `list-view/index.tsx` or `backlog-list-view/index.tsx`.
- No change to `@/lib/column`, `@/types/project`, the task-card subtree, or any i18n file.

---

## 8. Risk register

| Risk | Mitigation |
|---|---|
| Whitespace/JSX reflow after de-indentation makes Biome reformat the block, so the diff looks larger than the semantic change. | Author the new file already at Biome's output formatting (§2 is pre-formatted); run `pnpm exec biome ci` on the three paths only, never root `pnpm lint --write`. Review the block by comparing tag+class sequence, not raw lines. |
| The still-needed `getColumnIcon` import is removed from `kanban-view.tsx` along with the header. | §3 states it explicitly; the post-edit gate is `grep -c 'getColumnIcon' kanban-view.tsx` → `2`, run before the packet is accepted. |
| The test fixture drifts from the derived column type (new required field added upstream) and the `as` assertion silently absorbs it. | Keep the fixture to the five fields the component reads; typecheck still catches a *removed* or *retyped* field. If the single `as` ever stops compiling, fix the fixture — do not escalate to `as unknown as` without noting why. |

---

## 9. Packet decomposition recommendation

Three packets, mechanical tier.

- **P1 — create `public-column-header.tsx`** (`file_create`). Content is fully specified in §2.
  Gate: `pnpm --filter @kaneo/web typecheck` exits 0 (the new file compiles standalone, unused).
- **P2 — edit `kanban-view.tsx`** (`patch_apply`, two hunks from §3). Gate: the three greps in
  §3, then `pnpm --filter @kaneo/web typecheck` exits 0.
- **P3 — create `public-column-header.test.tsx`** (`file_create`). Content constrained by §5.
  Gate: `pnpm --filter @kaneo/web test` exits 0 with no new failures vs. the pre-run baseline.

**Ordering.** P1 must land first — both P2 and P3 import from it, and either would fail typecheck
against a missing module. P2 and P3 are independent of each other (different files, no shared
symbols) and are **safe to run in parallel** after P1. If the orchestrator prefers a single
serial lane, run P1 → P2 → P3 so the typecheck gate is meaningful at every step.

**Final gate (after all three):** `pnpm --filter @kaneo/web typecheck`,
`pnpm --filter @kaneo/web test`, and
`pnpm exec biome ci apps/web/src/components/public-project/kanban-view.tsx apps/web/src/components/public-project/public-column-header.tsx apps/web/src/components/public-project/public-column-header.test.tsx`,
then senior review of the old-vs-new markup diff for acceptance criterion 4.

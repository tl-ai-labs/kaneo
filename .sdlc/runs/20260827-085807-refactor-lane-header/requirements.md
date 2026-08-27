# Requirements — refactor — Extract `PublicColumnHeader`

Run: `20260827-085807-refactor-lane-header` · Intent: `refactor` · Mode: brownfield
Source brief: `.sdlc/runs/20260827-085807-refactor-lane-header/intent_brief.md`

This is a **delta requirements** document (refactor intent). A refactor changes structure and
not behavior, so the substance below is *what must be preserved*, not what must be added.

---

## In scope

1. Create `apps/web/src/components/public-project/public-column-header.tsx` exporting a named
   component `PublicColumnHeader`.
2. Move the inline column-header JSX currently at `kanban-view.tsx` lines 27–39 into that
   component verbatim.
3. Edit `apps/web/src/components/public-project/kanban-view.tsx` to render
   `<PublicColumnHeader column={column} />` in place of the removed block.
4. Optionally add `apps/web/src/components/public-project/public-column-header.test.tsx` — only
   if it proves something typecheck does not (see NFR-4 / decision gate in §Open questions).

## Out of scope

1. Renaming `Column*` → `Lane*` anywhere. The API, the Drizzle schema and the typed client all
   say `columns`; renaming the web layer alone would fork the vocabulary.
2. Any edit under `apps/web/src/components/kanban-board/**` (the private board).
3. Sharing a single header component between the private and public boards.
4. Extracting the public column *container* (the two wrapper `div`s and the task list).
5. Splitting `backlog-list-view/index.tsx` or `list-view/index.tsx`.
6. Any change to `getColumnIcon`, `@/lib/column`, `@/types/project`, or the task-card subtree.
7. Any i18n change. The extracted block contains no user-facing string literals — `column.name`
   is data, and the only literal copy in `kanban-view.tsx` (`No tasks in …`) lives in the task
   list, not the header, and is deliberately left where it is.

---

## Functional requirements

### FR-1 — `PublicColumnHeader` renders the current header markup exactly

The component must render, as its complete output:

```
<div className="p-2 shrink-0">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      {getColumnIcon(column.id, column.isFinal, column.icon)}
      <h3 className="font-medium text-foreground">{column.name}</h3>
      <span className="text-sm text-muted-foreground">{column.tasks.length}</span>
    </div>
  </div>
</div>
```

Element order, nesting depth, tag names and every `className` string are byte-identical to the
pre-change source. No wrapper element is added, none removed, no fragment introduced.

### FR-2 — Props

`PublicColumnHeader` takes exactly one required prop, `column`. Its type is derived from the
existing project type — `ProjectWithTasks["columns"][number]` — imported as a `type`. No new
`type` alias describing a column's fields, no `interface`, no ad-hoc shape. The props type
itself is a local `type PublicColumnHeaderProps = { column: ... }` (repo convention: `type`
over `interface`).

### FR-3 — `kanban-view.tsx` after the edit

1. Contains no inline header JSX.
2. Imports `PublicColumnHeader` from `"./public-column-header"` (relative sibling import,
   matching the existing `import { PublicTaskCard } from "./task-card";`).
3. Renders `<PublicColumnHeader column={column} />` as the first child of the column shell
   `div`, in the same position the removed block occupied.
4. Retains its remaining `getColumnIcon` usage — the empty-state icon at the old line 57 is
   *not* part of the header and still needs the import. The `getColumnIcon` import therefore
   stays in `kanban-view.tsx`; it is not removed.

### FR-4 — Import hygiene

`public-column-header.tsx` imports `getColumnIcon` from `@/lib/column` (path alias, as
`kanban-view.tsx` does today) and `ProjectWithTasks` from `@/types/project` as a type-only
import. No unused imports in either file after the change.

---

## Non-functional requirements

- **NFR-1 — Zero behavior delta.** Rendered DOM for any input `project` is identical before and
  after. This is the single invariant the whole run is judged on.
- **NFR-2 — Typecheck.** `pnpm --filter @kaneo/web typecheck` passes.
- **NFR-3 — Tests.** `pnpm --filter @kaneo/web test` passes with no new failures relative to the
  pre-run baseline.
- **NFR-4 — Lint/format.** `pnpm exec biome ci` passes on the changed paths only. Root
  `pnpm lint` is never run (it invokes Biome with `--write` and rewrites unrelated files).
- **NFR-5 — Conventions.** `type` over `interface`; inferred/derived types over hand-written
  ones; comments only where a constraint is non-obvious.
- **NFR-6 — Bundle.** No new dependency, no new auth-only or mutation-hook import pulled into
  the public (unauthenticated) bundle.

---

## PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| `column.name` | None — workspace-authored column label, already public on this route | Unchanged; rendered as text, React-escaped |
| `column.id` | None — used only to resolve an icon | Unchanged; not rendered |
| `column.tasks.length` | None — a count already visible on the public board | Unchanged |

No new field is read, exposed, logged or transmitted. The public project route is already
unauthenticated by design; this refactor moves markup between files inside that existing
boundary and does not widen it.

## Role matrix

| Role | Resource | Action | Change |
|---|---|---|---|
| Anonymous visitor | Public project board | Read column header | Unchanged — already permitted on this route |
| Any authenticated role | Public project board | Read column header | Unchanged |

No authorization decision is made in the extracted code, and none is added. The private board's
permission-gated header (`kanban-board/column/column-header.tsx`) is untouched and remains
separate — that separation is an explicit non-goal to preserve, not an accident to fix.

---

## Acceptance criteria

1. `apps/web/src/components/public-project/public-column-header.tsx` exists and exports
   `PublicColumnHeader`.
2. `grep -n 'font-medium text-foreground' apps/web/src/components/public-project/kanban-view.tsx`
   returns nothing — the header JSX is gone from the view.
3. `kanban-view.tsx` contains exactly one occurrence of `<PublicColumnHeader column={column} />`.
4. A diff of the two header markup blocks (old inline vs. new component body) shows no change to
   any tag or `className` — verified by direct comparison at senior review.
5. `pnpm --filter @kaneo/web typecheck` exits 0.
6. `pnpm --filter @kaneo/web test` exits 0 with no new failures.
7. `pnpm exec biome ci apps/web/src/components/public-project/kanban-view.tsx apps/web/src/components/public-project/public-column-header.tsx [public-column-header.test.tsx]` exits 0.
8. Files touched are a subset of the frozen write-contract allowlist. `git status --short`
   shows no other modified path.

---

## Open questions for HITL

1. **Test file — add it or not?** The brief marks
   `public-column-header.test.tsx` optional, "only if it adds real proof beyond typecheck".
   Recommendation: **add it.** Typecheck proves the prop type; it does not prove the DOM is
   unchanged, and NFR-1 is the run's only real invariant. A ~40-line render test asserting the
   icon, the `<h3>` name and the count — with `@/lib/column` left unmocked so the real icon
   renders — is the only executable evidence for acceptance criterion 4. It costs one extra
   mechanical-tier packet. Say `revise: no test file` at this gate to drop it.
2. **No other open questions.** The brief is precise and the target block is unambiguous.

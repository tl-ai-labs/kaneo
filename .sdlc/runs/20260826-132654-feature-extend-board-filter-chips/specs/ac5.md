### 8.2 AC-5 — construction and mutation check

> **REVISED after the Gate 2 allowlist amendment.** The original §8.2 described a two-of-nine
> behavioral limit forced by the write contract. At Gate 2 the user widened the allowlist to 15 globs,
> adding **`apps/web/src/components/kanban-board/index.test.tsx`** and
> **`apps/web/src/components/list-view/index.test.tsx`** (test files only — no new source surface).
> Coverage below is rewritten to the widened contract. The shared `withTaskId` helper and its unit
> tests are **kept**; the behavioral tests are in addition, not instead.

AC-5 is the criterion the user flagged at Gate 0 as most likely to regress. A previous comparison arm
shipped this gap as a source-text assertion (grep-shaped: "does the file contain `withTaskId`"). That
is explicitly rejected here: a source-text assertion passes against code that imports the helper and
then ignores it. **Every AC-5 test below asserts the value actually handed to `navigate()`.**

**Two layers, both behavioral at the bottom:**

**Layer 1 — the shared seam (A4, `lib/search-params.test.ts`).** All nine sites call `withTaskId`.
Three unit tests prove it preserves arbitrary `prev` keys, clears `taskId` without dropping them, and
does not mutate `prev`.

**Layer 2 — each site actually passes an updater, and that updater preserves filters.** For each
site: capture `navigateSpy.mock.calls[n][0]`, assert `typeof call.search === "function"`, then invoke
`call.search({ status: ["todo"], taskId: <seed> })` and deep-equal the result. The
`typeof === "function"` assertion is what makes every one of these RED against today's object
literals.

| Site | File:line (today) | Proved in | New/edited |
|---|---|---|---|
| 1 | `board.tsx:97-101` `search: {}` (close sheet) | `components/board/board-route-search-preservation.test.tsx` | **new** |
| 2 | `kanban-board/task-card.tsx:149-152` `search: {}` | `components/board/task-card-search-preservation.test.tsx` | **new** |
| 3 | `kanban-board/task-card.tsx:153-157` `search: { taskId }` | same file | **new** |
| 4 | `kanban-board/index.tsx:67` (`j`) | `components/kanban-board/index.test.tsx` | **new (Gate 2)** |
| 5 | `kanban-board/index.tsx:74` (`k`) | same file | **new (Gate 2)** |
| 6 | `list-view/task-row.tsx:148-151` `search: {}` | `components/list-view/task-row.test.tsx` | edited |
| 7 | `list-view/task-row.tsx:152-156` `search: { taskId }` | same file | edited |
| 8 | `list-view/index.tsx:97` (`j`) | `components/list-view/index.test.tsx` | **new (Gate 2)** |
| 9 | `list-view/index.tsx:104` (`k`) | same file | **new (Gate 2)** |

**Placement note for sites 1-3.** `kanban-board/task-card.test.tsx` and a board-route test file are
*not* in the amended allowlist; `apps/web/src/components/board/**` is. Sites 1-3 are therefore proved
from test files under `components/board/`, importing the component under test across the directory
boundary. Same reasoning as A5's placement, and it must be reported as a deviation from the
colocated-test convention, not silently absorbed.

**How each site's spy is driven:**
- Sites 2-3, 6-7 (`task-card`, `task-row`): render the component, click the row/card. For the
  *clearing* branch, seed `window.history.replaceState({}, "", "?taskId=<id>")` first so
  `new URLSearchParams(window.location.search).get("taskId")` matches and `handleClick` takes the
  clear path.
- Sites 4-5, 8-9 (`kanban-board/index`, `list-view/index`): the `j`/`k` handlers come from
  `useRegisterShortcuts`. Mock `@/hooks/use-keyboard-shortcuts` so `useRegisterShortcuts` captures
  the handler map, mock `@/store/bulk-selection`'s `getState()` to return a `focusedTaskId`, then
  invoke the captured `j` / `k` handler directly. This tests the real handler body, not a
  reimplementation of it.
- Site 1 (`board.tsx`): `RouteComponent` is not exported, so mock `@tanstack/react-router`'s
  `createFileRoute` to return the options object with stub `useParams` / `useSearch`, import `Route`,
  and render `Route.component`. Mock `TaskDetailsSheet` with a stub that renders a button calling
  `onClose` — clicking it invokes `handleCloseTaskSheet` for real. **This is the highest-risk test in
  the run** (the board route has a wide import graph needing ~12 module mocks). If it cannot be made
  to pass reliably, it is **dropped and reported as dropped** — site 1 falls back to helper +
  typecheck + review, and the final report says "8 of 9 behaviorally proved", never "9 of 9".

**Why every Layer-2 test is RED before the fix.** Today all nine sites pass object literals
(`{}` or `{ taskId }`). `typeof call.search === "function"` is `false` for both, so every test fails
at its first assertion. None is a tautology over the new code.

**Mutation check — run it, record the observed output, do not assert it from memory.**
1. Revert `list-view/task-row.tsx` L147-156 to the two object literals →
   `pnpm --filter @kaneo/web test src/components/list-view/task-row.test.tsx` → the new AC-5 tests
   RED, the pre-existing render test GREEN. Restore, re-run, all GREEN.
2. Revert `kanban-board/index.tsx` L67 only (leave L74) → run `src/components/kanban-board/index.test.tsx`
   → the `j` test RED, the `k` test GREEN. This one-sided mutation proves the two tests are
   independent and neither is passing by accident. Restore.
3. Seam mutation: change `withTaskId` to `() => ({ taskId })` (drop `...prev`) →
   `pnpm --filter @kaneo/web test src/lib/search-params.test.ts` → two of three RED. Restore.

Every mutation's real terminal output is captured to
`.sdlc/runs/<run-id>/mutation-check.txt` and quoted in the final report.
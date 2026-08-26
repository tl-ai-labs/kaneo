# Verified repo facts (from Gate 0 discovery — already confirmed, do not re-derive)

Scope: `apps/web` only. Everything else in the monorepo is off-limits for this run.

## 1. The board route
`apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx`
- line 24: `type BoardSearchParams = { taskId?: string }`
- line 32: hand-rolled `validateSearch` — `taskId: typeof search.taskId === "string" ? search.taskId : undefined`
- line 166: calls `useTaskFiltersWithLabelsSupport(project, projectId, boardSearchQuery)`
- line 220-233: renders `<BoardToolbar filters updateFilter updateLabelFilter clearFilters hasActiveFilters .../>`
- renders `<KanbanBoard>` or `<ListView>` depending on `viewMode` from the user-preferences store.
  BOTH are live code paths.

## 2. Nine navigate() call sites that REPLACE the whole search object
Each of these passes `search: {...}` (an object literal), which TanStack Router treats as the
complete next search state. Any filter params in the URL are dropped by every one of them.
- `board.tsx:97`            — `navigate({ to: ".", search: {}, replace: true })` (close task sheet)
- `kanban-board/task-card.tsx:148` — `search: {}`
- `kanban-board/task-card.tsx:153` — `search: { taskId: task.id }`
- `kanban-board/index.tsx:67`      — `search: { taskId: state.focusedTaskId }`
- `kanban-board/index.tsx:74`      — `search: { taskId: state.focusedTaskId }`
- `list-view/task-row.tsx:147`     — `search: {}`
- `list-view/task-row.tsx:152`     — `search: { taskId: task.id }`
- `list-view/index.tsx:97`         — `search: { taskId: state.focusedTaskId }`
- `list-view/index.tsx:104`        — `search: { taskId: state.focusedTaskId }`
The two `navigate({ to: ".../task/$taskId" })` sites (kanban-board/index.tsx:79,
list-view/index.tsx:109) leave the board route entirely and are NOT in scope.
Backlog-route equivalents are OUT OF SCOPE.

## 3. The hooks
- `use-task-filters-with-labels-support.ts` is the SOLE production hook (used by board.tsx:166).
- `use-task-filters.ts` exports the `BoardFilters` type and `DUE_DATE_FILTER_VALUES`, which the
  other hook imports. `useTaskFilters()` ITSELF is dead code — zero call sites. Leave it alone;
  note it, do not delete or refactor it.
- Both hooks re-declare `DEFAULT_FILTERS`, `FILTER_KEYS` and `normalizeFilters` VERBATIM.
  Deduplicating them is explicitly out of scope. Do not refactor that.
- `BoardFilters = { status, priority, assignee, dueDate, labels }`, each `string[] | null`.
- `DUE_DATE_FILTER_VALUES = { dueNextWeek, dueThisWeek, noDueDate }`.
- `assignee` filters on `task.userId` (NOT `assigneeId`). Do not change which field it matches.

## 4. Persistence today
- localStorage key: `kaneo:board-filters:${projectId}`.
- Restore effect keyed on `storageKey` (line 52-67) — runs on mount, sets DEFAULT_FILTERS when
  storage is empty or unparseable.
- Save effect (line 69-72) writes `JSON.stringify(filters)` UNCONDITIONALLY on every filter
  change — INCLUDING the all-null default on first mount, BEFORE the restore effect's value has
  necessarily settled. That unconditional write is the clobber risk against any URL-derived
  state. The precedence between URL, localStorage and this write must be designed deliberately.

## 5. Tests
- `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` has NO router harness. It
  calls `renderHook(() => useTaskFiltersWithLabelsSupport(project, "project-1"))` and asserts
  against `window.localStorage` directly. If the hook starts requiring router context, this file
  needs rework — that is expected and in scope.
- `apps/web/src/components/list-view/task-row.test.tsx` exists and is in scope.
- Runner: vitest, jsdom, setup `apps/web/src/test/setup.ts`, include `src/**/*.test.{ts,tsx}`.
- Alias `@` -> `apps/web/src`, `@i18n` -> repo `i18n/`.
- GREEN BASELINE captured before any change: 36 test files, 112 tests, all passing;
  `pnpm --filter @kaneo/web typecheck` exits 0.

## 6. The validator convention fork (a real decision this run must make and justify)
`zod@^4.4.3` IS a dependency of apps/web and IS imported as `import { z } from "zod/v4"`.
Ten web routes define `validateSearch`. Five use zod; five use hand-rolled `typeof` predicates
(board.tsx is one of the hand-rolled five). Neither is "the" convention. Pick one, justify it.
HARD CONSTRAINT either way: `validateSearch` must NEVER throw — on malformed, hostile, or null
input it must degrade to the default (empty) filter set. A throwing validateSearch takes the
route down.

## 7. Commands
- Tests:     `pnpm --filter @kaneo/web test`
- Typecheck: `pnpm --filter @kaneo/web typecheck`
- NEVER run `pnpm lint`, any root/package `lint` script, or `pnpm i18n:check:fix` — they run
  biome with `--write` and rewrite unrelated files.

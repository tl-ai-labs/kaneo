# Intent Brief — feature-extend — URL-persisted board filter state

## Context
The seed request asked for "assignee and label filter chips at the top of Board with URL-persisted
state". Investigation before Gate 0 established that **the chips already exist**:

- `apps/web/src/components/board/board-toolbar.tsx` (676 lines) renders five `ActiveFilterChip`
  instances — status, priority, assignee, dueDate, labels — with multi-select, per-chip removal,
  clear-all, and existing i18n keys under `tasks:boardFilters.*`.
- `apps/web/src/hooks/use-task-filters.ts` owns `BoardFilters` (all five keys), `filterTasks`,
  `normalizeFilters`, and persists state to **localStorage** under the per-project key
  `kaneo:board-filters:${projectId}` via two `useEffect`s.
- `apps/web/src/routes/.../project/$projectId/board.tsx` declares `validateSearch` but
  `BoardSearchParams` carries only `taskId`.

The genuinely missing capability is therefore **URL persistence**, which is what makes a filtered
board shareable, bookmarkable, and reproducible for another viewer. Rebuilding the chips is
explicitly not wanted.

## Goal
Persist all five board filters in the TanStack Router search params for the board route, so that a
filtered board can be shared as a link and restored from it. On load, URL params take precedence
over stored localStorage state and are then written back to localStorage, so an opened link becomes
the viewer's current filter state for that project. Existing chip UI and filtering behavior stay
as they are.

## Files in scope
- `apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx`
  — extend `BoardSearchParams` and `validateSearch`; wire search params to the filter hook
- `apps/web/src/hooks/use-task-filters.ts` — accept URL-provided initial state and publish changes
- `apps/web/src/hooks/use-task-filters-with-labels-support.ts` and its test
- `apps/web/src/lib/` — new serializer/parser for filter ⇄ search-param encoding, with tests
- `apps/web/src/components/board/board-toolbar.tsx` — only if wiring requires it; no redesign
- **Search-preservation fixes (mandatory, discovered pre-Gate-0).** `board.tsx` renders both
  `KanbanBoard` and `ListView` plus `TaskDetailsSheet`, and every task-open/close path below
  replaces the whole search object, which would wipe filters the moment a user clicks a task.
  All must move to the functional form `search: (prev) => ({ ...prev, taskId })` — a form used
  nowhere in this repo today:
  - `apps/web/src/components/kanban-board/index.tsx` (2 sites)
  - `apps/web/src/components/kanban-board/task-card.tsx` (2 sites)
  - `apps/web/src/components/list-view/index.tsx` (2 sites)
  - `apps/web/src/components/list-view/task-row.tsx` (2 sites)
  - `board.tsx` itself (`search: {}` on close, line 96)

  Verified NOT a hazard, deliberately excluded: `task/task-details-sheet.tsx:55` navigates to the
  task full-page route rather than replacing search on the board route, and the
  `backlog-list-view/` sites belong to the backlog route, which is out of scope.
- colocated `*.test.ts(x)` for the above
- `i18n/en-US.json` — only if genuinely new user-facing copy appears (not expected)

## Files off-limits
Project defaults plus every detected AI config, plus:
- `apps/api/**` — this run is web-only; no API, schema, migration, or route change
- `apps/site/**`, `apps/docs/**`, `packages/**`, `sentry/**`, `charts/**`, `deploy/**`
- `i18n/*.json` except `en-US.json`; `i18n/schema.json`
- `apps/web/src/routeTree.gen.ts`, `pnpm-lock.yaml`, `CHANGELOG.md`, `CONTRIBUTORS.svg`
- `apps/web/src/store/user-preferences.ts` — the localStorage layer stays as-is
- `.husky/**`, `.hook-logs/**`, `.turbo/**`

## Acceptance criteria
- All five filters (status, priority, assignee, dueDate, labels) round-trip through the URL.
- Opening a board URL containing filter params applies exactly those filters, regardless of what
  localStorage held, and then writes them to localStorage for that project.
- Opening the board with no filter params restores the localStorage state, preserving today's
  behavior for users who never share a link.
- Changing a filter updates the URL without adding a history entry per keystroke-level change.
- Malformed, unknown, or hostile search params degrade to the default filter set rather than
  throwing — `validateSearch` must not crash the route.
- A board with no active filters produces a clean URL with no empty filter params.
- Opening a task, closing a task, and switching between board and list view all preserve active
  filters in the URL. This is the acceptance criterion most likely to regress and must have a
  test that fails without the functional-search fix.
- Existing chip UI, `filterTasks` semantics, and all current tests continue to pass unchanged.

## Non-goals
- Redesigning or rebuilding the filter chips or the toolbar.
- Adding new filter types or changing what any existing filter matches.
- Extending URL persistence to backlog, list, or gantt views.
- Any API, database, or server-side change.
- Server-side or cross-device persistence of filter state.

## Gate 0 decisions (frozen 2026-08-26)
- **Approved.** Write contract frozen to `.sdlc/local/write-contract.json` (13 allowlist globs,
  60 off-limits entries).
- **Auth mode:** `estimated` — Opus runs in-session via `claude-cli`; only Flash packets dispatch
  through the MCP server. Same as the previous run, so the two are cost-comparable.
- **Policy:** `opus-plus-flash-v37`, mechanical slot `gemini-flash` → `flash-completion`
  (`flash-agsdk-worker` deliberately not selected). Both legs preflighted ok.
- **Test command:** `pnpm --filter @kaneo/web test` and `pnpm --filter @kaneo/web typecheck`.
  No PostgreSQL needed — nothing in `apps/api/**` is in scope. Do NOT run `pnpm lint`.
- **Search-preservation fixes: IN SCOPE**, confirmed explicitly. All six `navigate()` sites move to
  `search: (prev) => ({ ...prev, taskId })`.
- **Filter precedence:** URL wins on load, then syncs back to the per-project localStorage key.
- **URL coverage:** all five filters (status, priority, assignee, dueDate, labels).
- **`.gitignore`:** left untouched on this branch by explicit choice.
- **Rollback anchor:** `5d1fc910` on `feature-extend-3/opus-flash`. Gate 0 worktree dirt was
  untracked-only (`.claude/settings.local.json`, `.hook-logs/`, `.sdlc/`).
- **Deliberately left alone:** the duplicated `normalizeFilters`/`DEFAULT_FILTERS` block across the
  two filter hooks, and assignee matching on `task.userId`. Note them; do not refactor.

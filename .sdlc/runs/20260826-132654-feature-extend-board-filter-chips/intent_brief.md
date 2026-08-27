# Intent Brief — feature-extend — URL-persisted board filter state

## Context
This run is the **third arm of a controlled policy comparison**. The identical ticket has been
completed twice on other branches under different model policies. The user's Gate 0 decisions and
the file scope are reused verbatim so that any difference in cost, quality, or defect rate is
attributable to the model policy rather than to scope drift.

The seed request asked for "assignee and label filter chips at the top of Board with URL-persisted
state". The chips already exist: `apps/web/src/components/board/board-toolbar.tsx` renders
`ActiveFilterChip` instances for status, priority, assignee, dueDate and labels, with existing i18n
keys under `tasks:boardFilters.*`. Filter state lives in the `use-task-filters*` hooks and is
already persisted, but to a per-project localStorage key rather than the URL. Rebuilding or
redesigning the chips is explicitly not wanted.

## Goal
Persist the board's filter state in the route's TanStack Router search params, so a filtered board
can be shared as a link, bookmarked, and restored from it. Existing chip UI and filtering behavior
stay as they are.

## User decisions (reused across all arms, unchanged)
- **Scope:** URL persistence only. Keep the existing chips and filter logic.
- **Precedence:** URL wins on load, then syncs back to the per-project localStorage key. Opening a
  shared link adopts its filters for that project, overwriting the viewer's stored ones. Intentional
  and confirmed.
- **Coverage:** all five filters — status, priority, assignee, dueDate, labels.
- **`.gitignore`:** leave untouched.

## Files in scope
- the board route file (`.../project/$projectId/board.tsx`)
- `apps/web/src/hooks/use-task-filters.ts`, `use-task-filters-with-labels-support.ts` and its test
- `apps/web/src/lib/**` — serializer/parser for filter ⇄ search-param encoding, with tests
- `apps/web/src/components/board/**`
- `apps/web/src/components/kanban-board/index.tsx`, `kanban-board/task-card.tsx`
- `apps/web/src/components/list-view/index.tsx`, `list-view/task-row.tsx`, `list-view/task-row.test.tsx`
- `apps/web/src/types/**`
- `i18n/en-US.json` — only if genuinely new user-facing copy appears
- colocated `*.test.ts(x)` for the above

## Files off-limits
Project defaults plus every detected AI config, plus:
- `apps/api/**` — web-only run; no API, schema, or migration change
- `apps/site/**`, `apps/docs/**`, `packages/**`, `sentry/**`, `charts/**`, `deploy/**`, `plans/**`
- `apps/web/src/routeTree.gen.ts` — generated
- `apps/web/src/store/user-preferences.ts` — the localStorage layer stays as-is
- `apps/web/src/main.tsx` — router construction is app-wide, far outside this ticket
- `apps/web/src/components/common/project-layout.tsx`
- `apps/web/src/components/backlog-list-view/**` — the backlog route is out of scope
- `i18n/*.json` except `en-US.json`; `i18n/schema.json`
- `pnpm-lock.yaml`, `CHANGELOG.md`, `CONTRIBUTORS.svg`, `.husky/**`, `.hook-logs/**`, `.github/**`

## Acceptance criteria
- All five filters round-trip through the URL.
- Opening a board URL carrying filter params applies exactly those filters regardless of stored
  state, then writes them to localStorage for that project.
- Opening the board with no filter params restores the localStorage state, preserving today's
  behavior for users who never share a link.
- An empty param (e.g. `?status=`) must not count as "the URL carries filters" — treating it as
  truthy would suppress the localStorage restore and silently blank a returning user's board.
- **Filters survive every in-app navigation on the board route** — opening a task, closing a task,
  and switching between the board and list views. This is the criterion most likely to regress.
- Browser Back behaves coherently with respect to filter state.
- `validateSearch` degrades malformed, hostile, or null input to the default filter set rather than
  throwing; a throwing validator takes the route down.
- A board with no active filters produces a clean URL with no empty filter params.
- Filter changes do not push a history entry per interaction.
- Existing chip UI, filtering semantics, and all current tests continue to pass unchanged.

## Non-goals
- Redesigning or rebuilding the filter chips or the toolbar.
- Adding new filter types or changing what any existing filter matches.
- Extending URL persistence to backlog, list, or gantt routes.
- Any API, database, or server-side change.
- Changing router construction or search encoding app-wide.
- Refactoring duplicated helpers shared by the two filter hooks, or changing which task field
  assignee filtering matches on. Note them if found; leave them.

## Gate 0 decisions (frozen 2026-08-26)
- **Approved.** Write contract frozen (13 allowlist globs) — deliberately identical to both other arms.
- **Auth mode:** `estimated`. This policy's Opus tier uses `claude-cli`, so under estimated it runs
  in-session; its Opus cost is a token-derived floor, not a vendor measurement.
- **Policy:** `opus-plus-sonnet-max`. Both tiers smoked (Opus $0.135, Sonnet $0.068).
- **Test command:** `pnpm --filter @kaneo/web test` and `pnpm --filter @kaneo/web typecheck` — the
  scoped command both other arms used, chosen over discovery's root `pnpm test` for comparability.
  Do NOT run `pnpm lint`.
- **`.gitignore`:** left untouched.
- **Validator choice (zod vs hand-rolled) NOT pre-decided** — left to the pipeline, as in both other arms.
- **Deliberately withheld:** the analytical findings the other arms produced. Only the user's Gate 0
  decisions and the file scope were reused.
- **Rollback anchor:** `5d1fc910` on `feature-extend-3/opus-sonnet`.

## Gate 2 amendment (2026-08-26)
The user expanded the allowlist by two test files so that AC-5 — filters surviving every
board-reachable navigation — gets behavioral coverage at all nine `navigate()` sites rather than
two of nine plus a shared-helper argument:
- `apps/web/src/components/kanban-board/index.test.tsx`
- `apps/web/src/components/list-view/index.test.tsx`
This is the only scope change since Gate 0, and it adds test files only — no new source surface.

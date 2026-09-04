# Intent Brief — feature-extend — URL-persist the Board's assignee and label filters

## Context

The request as typed was "add assignee and label filter chips at the top of Board with
URL-persisted state". Discovery plus direct re-verification found that **the chips already
exist and are fully implemented**:

- `apps/web/src/components/board/board-toolbar.tsx` defines `ActiveFilterChip` (line 85) and
  renders five chips (lines 534, 560, 585, 610, 635) for status, priority, assignee, due date
  and labels — with stacked avatars and a `{{count}} selected` fallback.
- The dropdown has working assignee (line 367) and label (line 472) submenus, including
  colour-grouped label toggling via `toggleLabelGroup`.
- i18n keys under `tasks:boardFilters.*` already exist.

The half that does **not** exist is URL persistence. `use-task-filters-with-labels-support.ts`
stores filter state in `localStorage` under `kaneo:board-filters:${projectId}` (lines 49–72),
and the board route's `validateSearch` accepts only `taskId`. So filters survive a reload on the
same machine but cannot be shared, linked, or restored in another browser.

This brief therefore scopes the job as the localStorage → URL-search-param migration, not as new
chip UI.

## Goal

Move the Board's five filters (`status`, `priority`, `assignee`, `dueDate`, `labels`) from
`localStorage` into TanStack Router search params, so a filtered board is a shareable URL, while
the existing chip UI, matching semantics and default (unfiltered) behaviour stay exactly as they
are today.

## Files in scope

- `apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx`
  — extend `validateSearch` (line 32) beyond `taskId`; fix `handleCloseTaskSheet` (line 96).
- `apps/web/src/hooks/use-task-filters-with-labels-support.ts` — replace the two localStorage
  effects with search-param read/write; keep the hook's public API unchanged.
- `apps/web/src/components/board/board-toolbar.tsx` — only if the hook's API must change.
- `apps/web/src/components/kanban-board/task-card.tsx` (line 150) — `search: {}` wipe.
- `apps/web/src/components/list-view/task-row.tsx` (line 149) — `search: {}` wipe. In scope
  because the board route renders **both** `KanbanBoard` and `ListView` behind `viewMode`.
- `.gitignore` — add `.sdlc/` and `.hook-logs/`; neither is currently ignored, so run artifacts
  are exposed to `git add -A`.
- Web tests colocated with the above.

## Files off-limits

- `apps/api/**`, `packages/**`, `tests/api/**`, `tests/api-integration/**`, `charts/**` — this is
  a client-side-only change by explicit decision; no API, validator, OpenAPI or typed-client edits.
- `apps/web/src/hooks/use-task-filters.ts` — the near-duplicate hook. Read for its exported
  `BoardFilters` type and `DUE_DATE_FILTER_VALUES`; **do not edit, do not merge, do not delete**.
- `apps/web/src/components/public-project/**` — the public read-only board is out of scope.
- `backlog.tsx`, `gantt.tsx`, `backlog-list-view/backlog-task-row.tsx` — they carry the same
  `search: {}` pattern but are different views; leave them.
- All AI configuration, default off-limits: `CLAUDE.md`, `AGENTS.md`, `.cursor/**` (7 `.mdc`),
  `.claude/**`, `.agents/**`, `skills/**`, `skills-lock.json`, `.coderabbit.yaml`.
- `i18n/schema.json` — generated. If and only if new keys land in `i18n/en-US.json`, regenerate
  with `pnpm i18n:schema`; never hand-edit, never run `i18n:check:fix`.

## Acceptance criteria

1. All five filters round-trip through the URL: selecting chips updates search params, and
   pasting that URL into a fresh browser profile reproduces the same filtered board.
2. A board URL with **no** filter params renders exactly as today — no redirect, no injected
   params, no visual change.
3. Closing the task sheet preserves active filters. This is the main regression risk: today
   `handleCloseTaskSheet` calls `navigate({ to: ".", search: {}, replace: true })`, which once
   filters live in search params would silently drop all of them. The same wipe exists in
   `task-card.tsx` and `task-row.tsx`.
4. Matching semantics are AND across filter types, OR within a type; columns with no surviving
   tasks remain visible. Verify the current `filterTasks` already behaves this way and preserve
   it — if it does not, stop and raise it at Gate 1 rather than silently changing behaviour.
5. Malformed or hostile search params degrade to the unfiltered default without throwing,
   matching the tolerance of the existing `normalizeFilters`.
6. Search params follow the repo's own precedent — hand-rolled
   `typeof search.x === "string" ? … : undefined`, as in `backlog.tsx`, `gantt.tsx` and
   `auth/*`. **Do not introduce zod or valibot into `apps/web`**; there is no search schema
   library anywhere in the web app today.
7. `pnpm --filter @kaneo/web test` passes, `pnpm --filter @kaneo/web typecheck` passes, and
   `pnpm exec biome ci <changed paths>` is clean.

## Non-goals

- No new chip UI, no new filter types, no restyling of the existing toolbar.
- No deduplication of `use-task-filters.ts` and `use-task-filters-with-labels-support.ts`.
  AGENTS.md forbids bundling an unrelated refactor into requested work.
- No migration or read-through of existing `kaneo:board-filters:*` localStorage values unless
  Gate 1 explicitly asks for it; the default is a clean cutover.
- No server-side filtering.
- No change to the public board, backlog, or gantt views.

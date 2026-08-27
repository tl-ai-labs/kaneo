# Intent Brief — feature-extend — Board filter chips with URL-persisted state

## Context

Kaneo's project Board (`apps/web`, React 19 + Vite + TanStack Router/Query) already supports
filtering. `useTaskFiltersWithLabelsSupport` owns a `BoardFilters` object
(`status`, `priority`, `assignee`, `dueDate`, `labels`) and applies it client-side over the tasks
the board has already loaded. The board route mounts `BoardToolbar`, which exposes those filters
behind a single "Filter" dropdown menu.

Two gaps motivate this ticket:

1. **No chips.** Active filters are only visible by opening the dropdown. There is no persistent,
   at-a-glance row of active-filter chips at the top of the board, and no one-click way to add or
   remove an assignee/label filter without traversing a nested menu.
2. **State is not shareable.** Filter state is persisted to `localStorage` under
   `kaneo:board-filters:<projectId>` by an effect pair inside the hook. The board route's
   `validateSearch` recognizes only `taskId`:

   ```ts
   validateSearch: (search: Record<string, unknown>): BoardSearchParams => ({
     taskId: typeof search.taskId === "string" ? search.taskId : undefined,
   }),
   ```

   A filtered board therefore cannot be linked to a teammate, and browser back/forward does not
   move through filter changes.

The same hook shape is duplicated in `use-task-filters.ts` (the pre-labels version). Only
`use-task-filters-with-labels-support.ts` is consumed by the board route; `use-task-filters.ts`
still exports the shared `BoardFilters` type and `DUE_DATE_FILTER_VALUES`, which the toolbar and
the backlog route import.

## Goal

Add an assignee and label filter-chip row at the top of the Board, and make assignee/label filter
state live in the URL so a filtered board is linkable and survives reload and back/forward.

Filtering stays **client-side** over already-loaded tasks — no API, validator, OpenAPI, typed
client, or database change.

The design must state explicitly whether the URL or the existing `localStorage` store is the
source of truth for the filter keys it owns, and must not leave both writing the same key. The
expected resolution is: URL is authoritative for `assignee` and `labels`; the `localStorage`
entry is at most a fallback used when the URL carries no filter params, and it must not
clobber a URL that does.

## Files in scope

- `apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx`
  — extend `BoardSearchParams` + `validateSearch` with `assignee` / `labels`; wire URL state into
  the filter hook and navigate on change.
- `apps/web/src/hooks/use-task-filters-with-labels-support.ts` — accept externally controlled
  filter values so the URL can drive them; keep the existing filtering semantics intact.
- `apps/web/src/components/board/board-toolbar.tsx` — render/host the chip row alongside the
  existing Filter dropdown, keeping the two in sync.
- `apps/web/src/components/board/` — one new chip component (e.g. `board-filter-chips.tsx`).
- `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` — extend for controlled state.
- New colocated test(s) for the chip row and the URL round-trip.
- `i18n/en-US.json` — new static keys for chip labels, "clear", and the add-filter affordances.
- `apps/web/src/hooks/use-task-filters.ts` — **type/constant reads only.** Change it only if the
  shared `BoardFilters` type must move; do not fork behavior into it.

## Files off-limits

Project defaults from `.sdlc/project.json.off_limits_default` (`.env`, `.env.*`, `.mcp.json`,
`.cursor/rules/**`, `.claude/settings.local.json`, `node_modules/**`, `dist/**`, `build/**`,
`.next/**`, `.sdlc/**`, `.git/**`), plus every AI config discovery detected:

- `.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/**`, `.agents/skills/**`, `skills/**`,
  `skills-lock.json`, `.coderabbit.yaml`, `.devcontainer/**`

Plus, for this ticket:

- `apps/api/**`, `packages/**`, `tests/api/**`, `tests/api-integration/**` — no server-side change.
- `apps/site/**`, `apps/docs/**` — not a docs run.
- `apps/web/src/routes/**` other than the board route — the backlog and gantt routes keep their
  current search-param contracts.
- `.husky/**`, `biome.json`, `turbo.json`, `pnpm-lock.yaml`, `package.json` files — no new
  dependency and no tooling change; the chip row is built from existing Radix/Base UI + Tailwind 4
  primitives already in `apps/web/src/components/ui/`.
- `.gitignore` — **off-limits, confirmed at Gate 0.** The user keeps `.sdlc/` tracked and pushed
  deliberately, so no ignore entry is added. Note in the final report that `git add -A` will
  include run artifacts by design.

## Acceptance criteria

1. A chip row is visible at the top of the Board showing every active assignee and label filter,
   each chip individually removable, with a "clear all" affordance when any filter is active.
2. Selecting or removing an assignee/label filter — from a chip or from the existing Filter
   dropdown — updates the URL search params on the board route.
3. Loading a board URL carrying `assignee` and/or `labels` params applies exactly those filters on
   first render, with no flash of unfiltered board content and no `localStorage` overwrite of the
   URL-supplied values.
4. Browser back/forward moves through filter states; copying the URL reproduces the same filtered
   board for another user with access to the project.
5. Invalid or unknown values in the search params degrade safely — they are dropped by
   `validateSearch`, and the board renders rather than throwing.
6. The existing `taskId` search param continues to work, including opening the task details sheet
   while filters are active.
7. Realtime WebSocket-driven task updates and dnd-kit drag-and-drop reordering continue to work
   with filters active.
8. All new user-facing copy uses static i18n keys defined in `i18n/en-US.json`; no hardcoded
   strings.
9. `pnpm --filter @kaneo/web test` passes, including new tests covering the URL round-trip and the
   chip interactions.
10. No change under `apps/api`, `packages/`, or the database schema; no new runtime dependency.

## Non-goals

- Server-side filtering, new query params on the tasks endpoint, or any Valibot/OpenAPI work.
- Extending URL persistence to `status`, `priority`, or `dueDate` filters, or to the backlog and
  gantt routes.
- Deduplicating `use-task-filters.ts` against `use-task-filters-with-labels-support.ts`.
- Redesigning the Filter dropdown, the board toolbar layout beyond hosting the chip row, or the
  sort control.
- Saved/named filter views, per-user filter defaults, or sharing filters via anything other than
  the URL.

## Gate 0 outcome (frozen)

- Approved 2026-08-27.
- Intent: `feature-extend`. Policy: `opus-only-v5`. Auth mode: `estimated` (claude-cli / subscription).
- Test command: `pnpm --filter @kaneo/web test`. Pre-existing pass/fail baseline not yet captured.
- `.gitignore`: left off-limits by explicit user decision — `.sdlc/` stays tracked.
- Write contract frozen to `.sdlc/local/write-contract.json` (7 allowlist globs, 37 off-limits).

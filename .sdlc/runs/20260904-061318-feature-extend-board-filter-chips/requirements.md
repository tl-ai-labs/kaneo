# Requirements — feature-extend — Board filters in URL search params

Run: `20260904-061318-feature-extend-board-filter-chips`
Intent: `feature-extend` · Mode: brownfield · Policy: `opus-plus-flash-v37` · Auth: `estimated`

## 1. Restatement of scope

Migrate the five Board filters (`status`, `priority`, `assignee`, `dueDate`, `labels`) from
`localStorage` (`kaneo:board-filters:${projectId}`) into TanStack Router search params on the
board route, so a filtered board is a shareable URL. The chip UI, the dropdown submenus, the
matching semantics and the default unfiltered rendering must not change.

This is **not** new chip UI. `ActiveFilterChip` and all five chips already exist and work.

## 2. Verification of the brief's stated facts (all re-confirmed against source)

| Claim | Verified |
| --- | --- |
| `use-task-filters-with-labels-support.ts` persists to localStorage, lines 49–72 | Yes — `storageKey` L49, read effect L52–67, write effect L69–72 |
| `board.tsx` `validateSearch` accepts only `taskId` (L32–34) | Yes |
| `handleCloseTaskSheet` wipes search (L96–102, `search: {}` at L99) | Yes |
| `task-card.tsx` `search: {}` | Yes — L150, inside `handleTaskCardClick` |
| `task-row.tsx` `search: {}` | Yes — L149, inside `handleClick` |
| `use-task-filters.ts` is a near-duplicate, read-only | Yes — exports `BoardFilters` (L7–13) and `DUE_DATE_FILTER_VALUES` (L15–19) |
| No zod/valibot search schema in `apps/web` | Yes — none found |
| `use-task-filters-with-labels-support.test.tsx` already exists | Yes — 184 lines, 2 test blocks; **test 1 seeds localStorage and will break** |

### 2.1 Acceptance criterion 4 (matching semantics) — verified, no Gate 1 escalation needed

The brief instructs us to stop and raise if `filterTasks` does not already do AND-across-types /
OR-within-a-type with empty columns preserved. It does:

- Each filter key is an independent early-return `if` → **AND across filter types**.
- `Array.includes(...)` / `.some(...)` within each key → **OR within a type**.
- `filteredProject` maps over `project.columns` and only replaces `tasks`, never drops a column
  → **empty columns stay visible**.

No behaviour change required. This is a **preserve**, not a **fix**.

### 2.2 New finding not in the brief — blast radius is contained

`KanbanBoard` and `ListView` are imported by **exactly one** file, `board.tsx`. Therefore
`task-card.tsx` and `task-row.tsx` are only ever rendered under the board route, and changing
their `search: {}` to a preserving update cannot affect backlog, gantt or the public board.
(`task-card-context-menu-content` is shared with `subtask-row.tsx` and `backlog-task-row.tsx`,
but that file is not being touched.)

### 2.3 New finding not in the brief — the label-toggle loop is a real hazard

`board-toolbar.tsx` calls `updateLabelFilter(labelId)` **inside a `for` loop** in two places:

- `toggleLabelGroup` (L237–246) — toggles every label of a colour group.
- the "clear labels" path (L250–251) — `for (const labelId of filters.labels) updateLabelFilter(labelId)`.

Today this is safe because `updateLabelFilter` uses a functional `setFilters((prev) => …)` and
React batches the updates correctly. Once the source of truth is the URL, N synchronous
`navigate()` calls in one tick will each read the same pre-navigation search object and the last
write wins — a group toggle would apply only one label. **This must be designed for explicitly;
it is the single most likely way this migration silently regresses.**

Two candidate resolutions, to be settled at Gate 2:

- **(a) Batch in the toolbar.** Compute the whole next label array in `toggleLabelGroup` /
  clear-labels and make one `updateFilter("labels", next)` call. Requires editing
  `board-toolbar.tsx` (allowlisted, and the brief permits toolbar edits "only if the hook's API
  must change" — the public API would in fact stay identical, only two call sites change).
- **(b) Batch in the hook.** Keep `updateLabelFilter` as-is but have the hook coalesce
  within-tick calls before navigating. More code, more subtle, and it hides the batching from
  the reader.

Recommendation: **(a)**. It is smaller, it is explicit, and it leaves the hook's exported
surface untouched.

## 3. Functional requirements

**FR-1 — Search-param schema.** The board route's `validateSearch` accepts, in addition to
`taskId`: `status`, `priority`, `assignee`, `dueDate`, `labels`. Each decodes to
`string[] | undefined`. Encoding is a comma-joined single value per key
(`?status=to-do,in-progress&labels=<uuid>,<uuid>`), chosen because every value in these five
filters is a slug or a UUID and none can contain a comma, and because it keeps shared URLs
short and readable.

**FR-2 — Hand-rolled parsing, repo precedent only.** Parsing/serialising is plain TypeScript in
the style of `backlog.tsx` / `gantt.tsx` / `auth/*`. **No zod, no valibot, no new dependency.**

**FR-3 — Shared, unit-testable codec.** The parse/serialise pair lives in
`apps/web/src/lib/board-filter-search-params.ts` so the route and the hook agree by
construction and the tolerance rules are testable without a router.

**FR-4 — Hook public API unchanged.** `useTaskFiltersWithLabelsSupport` continues to return
`{ filters, setFilters, updateFilter, updateLabelFilter, filteredProject, hasActiveFilters,
clearFilters }` with the same types. `filters` is derived from search params instead of
`useState`; every mutator navigates instead of calling `setFilters`.

**FR-5 — Clean cutover.** Both localStorage effects are deleted. No read-through, no one-time
migration of existing `kaneo:board-filters:*` values. `use-task-filters.ts` keeps its own
localStorage behaviour and is not touched.

**FR-6 — Task-sheet close must preserve filters.** All three in-scope `search: {}` wipes
(`board.tsx` L99, `task-card.tsx` L150, `task-row.tsx` L149) become a spread that clears only
`taskId` and preserves everything else. The three out-of-scope sites (`backlog.tsx`,
`backlog-task-row.tsx`, `gantt.tsx`) are untouched.

**FR-7 — Absent params render as today.** With no filter params in the URL: no redirect, no
injected empty params, `hasActiveFilters === false`, all tasks visible. Clearing the last value
of a filter removes the key from the URL entirely rather than leaving `?status=`.

**FR-8 — Hostile input degrades silently.** Non-string values, empty strings, whitespace-only
entries, empty segments from `a,,b`, arrays, objects, absurdly long values — all degrade toward
the unfiltered default. Never throw, never blank the board. This matches the tolerance already
in `normalizeFilters`.

**FR-9 — `.gitignore`.** Add `.sdlc/` and `.hook-logs/`; neither is ignored today, so run
artifacts are currently exposed to `git add -A`.

## 4. Non-functional requirements

- **NFR-1** `pnpm --filter @kaneo/web typecheck` passes (mandatory separate gate; vitest does
  not typecheck and `vite build` runs no `tsc`).
- **NFR-2** `pnpm --filter @kaneo/web test` passes, including the updated
  `use-task-filters-with-labels-support.test.tsx` — updated, never deleted.
- **NFR-3** `pnpm exec biome ci <changed paths>` clean. The `lint` scripts are
  `biome check --write .` and are never run.
- **NFR-4** No new runtime dependency in `apps/web`. `package.json` is off-limits.
- **NFR-5** No new i18n keys expected (`tasks:boardFilters.*` and
  `tasks:backlog.filters.*` already exist). If any key is added, `pnpm i18n:schema` is
  mandatory and `i18n:check:fix` is forbidden.
- **NFR-6** No render-loop: deriving `filters` from search must be memoised so
  `filteredProject` does not recompute on every render with a fresh array identity.

## 5. Out of scope (restated, enforced by the write contract)

`apps/api/**`, `packages/**`, `tests/**`, `charts/**`, `apps/web/src/hooks/use-task-filters.ts`,
`apps/web/src/components/public-project/**`, `backlog.tsx`, `gantt.tsx`,
`backlog-list-view/**`, `i18n/schema.json`, and all AI-config files. No hook deduplication, no
server-side filtering, no new filter types, no toolbar restyle, no change to the board text
search (`boardSearchQuery` stays local component state — it is not one of the five filters).

## 6. Risks

| # | Risk | Mitigation |
| --- | --- | --- |
| R1 | Label-group toggle loses all but one label (§2.3) | Batch at the two toolbar call sites; add a regression test |
| R2 | Closing the task sheet drops filters (the brief's headline risk) | FR-6 across all three sites; explicit test per site |
| R3 | New array identity each render → infinite effect loop / churn | NFR-6, memoise the decode |
| R4 | Existing hook test seeds localStorage and will fail | Rewrite that test against search params, keep the label-matching and identifier-search assertions |
| R5 | `search: {}` semantics differ subtly between `navigate` shapes | Use a functional/spread updater consistently in all three sites |
| R6 | Users lose their currently-saved localStorage filters | Accepted — clean cutover is the brief's default. Gate 1 may override |

## 7. Open questions for Gate 1

1. **Encoding.** Comma-joined (`?labels=a,b`) as proposed in FR-1, or repeated keys
   (`?labels=a&labels=b`)? Comma-joined is recommended.
2. **Label-loop batching.** Approve resolution (a) — edit the two `board-toolbar.tsx` call
   sites — per §2.3?
3. **Clean cutover.** Confirm we do **not** read existing `kaneo:board-filters:*` values, and
   accept that saved filters are dropped on first load after this ships.
4. **History behaviour.** Should filter changes `replace: true` (no back-button entry per chip
   click, recommended) or push history entries?

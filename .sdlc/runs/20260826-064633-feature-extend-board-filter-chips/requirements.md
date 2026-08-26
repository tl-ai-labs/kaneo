# Delta Requirements — URL-persisted board filter state

Run: `20260826-064633-feature-extend-board-filter-chips`
Intent: `feature-extend` · Mode: brownfield · Policy: `opus-plus-flash-v37` · Auth: `estimated`
Baseline captured before any codegen: **36 test files / 112 tests passing** (`pnpm --filter @kaneo/web test`, exit 0).

This is a **delta** requirements document. It states only what changes relative to the code that
exists on `feature-extend-2/opus-sonnet` at `5d1fc910`. Everything not named here is unchanged and
must stay unchanged.

---

## 1. What already exists (verified, not to be rebuilt)

| Capability | Location | Status |
|---|---|---|
| Five filter chips (status, priority, assignee, dueDate, labels), multi-select, per-chip clear, clear-all | `apps/web/src/components/board/board-toolbar.tsx` (676 lines, 5 × `ActiveFilterChip`) | **Exists — do not redesign** |
| `BoardFilters` type, `DUE_DATE_FILTER_VALUES`, filter matching semantics | `apps/web/src/hooks/use-task-filters.ts` | **Exists — semantics frozen** |
| Label-aware variant used by the board route, incl. text-query matching | `apps/web/src/hooks/use-task-filters-with-labels-support.ts` | **Exists** |
| Per-project localStorage persistence under `kaneo:board-filters:${projectId}` (restore effect + write-back effect) | both hooks | **Exists — must keep working** |
| i18n keys `tasks:boardFilters.*` | `i18n/en-US.json` | **Exists — no new copy expected** |
| `validateSearch` on the board route | `board.tsx:32-34` | Exists, but carries only `taskId` |

The genuinely missing capability is **URL persistence**. Nothing above is in scope for redesign.

## 2. Verified defect that this run must fix (mandatory)

`board.tsx` renders `KanbanBoard`, `ListView` and `TaskDetailsSheet`. Nine `navigate()` call sites
across five files pass a **literal** `search` object, which replaces the entire search state and
would therefore erase every filter param the moment a user touches a task. Confirmed sites:

| File | Lines | Current | Effect once filters live in the URL |
|---|---|---|---|
| `components/kanban-board/index.tsx` | 67, 74 | `search: { taskId: state.focusedTaskId }` | wipes filters on `j`/`k` focus move |
| `components/kanban-board/task-card.tsx` | 148-151 (close), 153-156 (open) | `search: {}` / `search: { taskId }` | wipes filters on card click |
| `components/list-view/index.tsx` | 97, 104 | `search: { taskId: state.focusedTaskId }` | wipes filters on `j`/`k` focus move |
| `components/list-view/task-row.tsx` | 147-150 (close), 152-155 (open) | `search: {}` / `search: { taskId }` | wipes filters on row click |
| `board.tsx` | 96-102 | `search: {}` | wipes filters on sheet close |

The intent brief and the run parameters both say "six sites"; the true count enumerated across
those five files is **nine** (four open-with-focus, two open-on-click, two close-on-click, one
close-on-sheet). All nine are in scope. The count discrepancy is recorded here rather than silently
resolved.

**API verification (done before planning, not assumed).** `@tanstack/react-router@1.170.24` is
installed, resolving `@tanstack/router-core@1.171.20`. In
`router-core/dist/esm/link.d.ts` the search option is typed
`search?: true | (ParamsReducer<TRouter, 'SEARCH', TFrom, TTo> & {})` where
`ParamsReducer = <object> | (ParamsReducerFn & {})` and
`ParamsReducerFn = (current) => next`. The functional form
`search: (prev) => ({ ...prev, taskId })` is therefore **supported by the installed version**. It
is used nowhere in this repo today, so every generated site must be typechecked, not trusted.

Note on typing: `ParamsReducerFn`'s `current` parameter resolves from `TFrom`. These sites call
`useNavigate()` with `to: "."` and no `from`, so `prev` widens to the router-wide
`FullSearchSchema`. The implementation must not rely on `prev` being narrowly `BoardSearchParams`.

## 3. In scope (numbered, testable)

1. **IS-1** — Extend `BoardSearchParams` and `validateSearch` on the board route to carry all five
   filters in addition to `taskId`.
2. **IS-2** — A new pure module under `apps/web/src/lib/` that encodes `BoardFilters` → search-param
   object and decodes an unknown search-param object → `BoardFilters`, with colocated unit tests.
3. **IS-3** — Wire the board route so that URL filter params are the source of truth on load, and
   filter mutations from the toolbar publish back into the URL.
4. **IS-4** — Precedence and localStorage sync: URL wins on load; the applied filters are then
   written to the per-project localStorage key; when the URL carries no filter params the existing
   localStorage restore behavior is preserved exactly.
5. **IS-5** — Convert all nine `navigate()` sites in §2 to the functional
   `search: (prev) => ({ ...prev, ... })` form, including the two "close" sites which must clear
   only `taskId` (`taskId: undefined`) rather than the whole object.
6. **IS-6** — Tests that fail without IS-5, proving the search-preservation fix rather than
   asserting a green suite (mutation-checked: the guard test must be observed failing against the
   pre-fix source).
7. **IS-7** — Filter-driven URL updates use `replace: true` so a filter interaction does not push a
   history entry.

## 4. Out of scope (numbered)

1. **OS-1** — Any redesign, restructure or restyling of `board-toolbar.tsx` or the chips.
2. **OS-2** — New filter types, or any change to what an existing filter matches (`filterTasks`
   semantics are frozen; existing tests must pass unchanged).
3. **OS-3** — URL persistence for backlog, gantt, or the standalone task route.
4. **OS-4** — Any change under `apps/api/**`, database schema, migrations, or server-side state.
5. **OS-5** — `apps/web/src/components/backlog-list-view/**` and
   `apps/web/src/components/task/task-details-sheet.tsx:55` — verified non-hazards (different route),
   deliberately excluded.
6. **OS-6** — De-duplicating the `normalizeFilters` / `DEFAULT_FILTERS` block that is copy-pasted
   across `use-task-filters.ts` and `use-task-filters-with-labels-support.ts`. **Noted as known
   duplication; left alone by explicit Gate 0 decision.**
7. **OS-7** — "Fixing" assignee matching, which filters on `task.userId` rather than
   `task.assigneeId`. **Noted as a likely latent bug; left alone by explicit Gate 0 decision.**
8. **OS-8** — `apps/web/src/routeTree.gen.ts`. Generated and off-limits even though this run changes
   a route's search type. The route's search type is declared inside `board.tsx` via
   `validateSearch`, so the generated tree does not need regeneration for this change; if typecheck
   proves otherwise, that is a Gate-3 blocker to surface, not a file to edit.
9. **OS-9** — Any `pnpm lint` / `biome check --write` / `pnpm i18n:check:fix` invocation.

## 5. Functional requirements

### Module: `lib/board-filter-search-params` (new)

- **FR-1** — Exports a `BOARD_FILTER_SEARCH_KEYS` list covering exactly the five `BoardFilters`
  keys, so route validation and the encoder cannot drift apart.
- **FR-2** — `parseBoardFilterSearch(search: Record<string, unknown>): BoardFilters` accepts an
  arbitrary/hostile object and returns a fully-populated `BoardFilters`. It never throws.
- **FR-3** — FR-2 accepts, for each key: an array of strings; a bare string (TanStack Router
  collapses a single repeated param to a scalar) — coerced to a one-element array; anything else —
  ignored, key falls back to `null`.
- **FR-4** — FR-2 drops non-string array members, trims nothing, and collapses an empty resulting
  array to `null` (matching the existing `normalizeFilters` contract in the hooks).
- **FR-5** — FR-2 caps the number of accepted values per key and the length of each value, so a
  hostile URL cannot force unbounded work or unbounded localStorage growth.
- **FR-6** — `serializeBoardFilters(filters: BoardFilters): Partial<Record<key, string[]>>` emits a
  key **only** when that filter is a non-empty array. A cleared filter must be emitted as
  `undefined` so TanStack Router removes it from the URL entirely.
- **FR-7** — `hasAnyBoardFilterParam(search): boolean` reports whether the incoming search object
  carried at least one *recognized, non-empty* filter param. This is the precedence signal for
  FR-11 and must be false for `?status=` (present but empty) so an empty param does not suppress
  localStorage restore.
- **FR-8** — House style: hand-written `typeof` / `Array.isArray` narrowing. **No schema library**
  is to be added — the web app has none, and the run must not add a dependency.

### Module: board route (`board.tsx`)

- **FR-9** — `BoardSearchParams` gains `status?`, `priority?`, `assignee?`, `dueDate?`, `labels?`,
  each `string[] | undefined`.
- **FR-10** — `validateSearch` delegates the five filter keys to FR-2/FR-6 and preserves the
  existing `taskId` narrowing verbatim. It must not throw for any input.
- **FR-11** — On mount, when the URL carries at least one recognized filter param (FR-7), those
  filters are applied and localStorage for that project is overwritten with them. When it does not,
  the existing localStorage restore path runs unchanged.
- **FR-12** — Any filter mutation (`updateFilter`, `updateLabelFilter`, `clearFilters`) results in
  the URL being updated via `navigate({ to: ".", search: (prev) => ..., replace: true })`.
- **FR-13** — When no filter is active, the resulting URL contains **no** filter params at all —
  not `?status=`, not `?status=[]`.

### Module: filter hooks

- **FR-14** — `useTaskFiltersWithLabelsSupport` gains an opt-in way to (a) seed state from
  URL-supplied filters and (b) notify the caller when filters change, without changing its behavior
  for any existing caller that does not pass the new argument. Signature change must be
  backwards-compatible — the existing test file calls it with 2 and 3 positional args.
- **FR-15** — The localStorage restore effect must not clobber URL-seeded state. This is the
  single subtlest failure mode in the change: today the restore effect fires unconditionally on
  mount and would overwrite whatever the URL asked for.
- **FR-16** — `use-task-filters.ts` (the non-label variant) is only modified if IS-3 genuinely
  requires it. It is used by other callers; a gratuitous signature change there is a defect.

### Module: navigation call sites

- **FR-17** — Each of the nine sites in §2 becomes the functional form. "Open" sites set
  `taskId`; "close" sites set `taskId: undefined` and touch nothing else.
- **FR-18** — No behavioral change other than search preservation: `to`, `replace`, and the
  surrounding conditionals stay as they are.

## 6. Non-functional requirements

- **NFR-1** — `pnpm --filter @kaneo/web typecheck` passes (both `tsconfig.app.json` and
  `tsconfig.node.json`).
- **NFR-2** — `pnpm --filter @kaneo/web test` passes with **≥ 112 tests** and **0 regressions**
  against the captured baseline.
- **NFR-3** — No new runtime dependency. No change to `package.json` or `pnpm-lock.yaml`.
- **NFR-4** — No new i18n key unless genuinely user-facing copy appears (not expected; if one does,
  only `i18n/en-US.json` may change, and `pnpm i18n:check:fix` must not be run).
- **NFR-5** — Filter interactions must not grow the history stack (`replace: true`), so browser Back
  still leaves the board rather than unwinding chip clicks one by one.
- **NFR-6** — Formatting checked with targeted `biome check` on changed paths only; never
  `biome check --write .`.

## 7. PII inventory

| Field | Where it now appears | Sensitivity | Protection |
|---|---|---|---|
| `assignee` filter values (workspace member `userId`s) | **Newly placed in the URL and in browser history / referrer / server access logs** | Low–moderate — an opaque internal ID, not an email or name | Values are opaque IDs already exposed in the authenticated client; no new endpoint. Length/count caps (FR-5) bound what can be injected. Flagged for the Phase 8 security review as the one genuinely new exposure surface this change creates. |
| `labels` filter values (label IDs) | URL | Low — workspace-scoped opaque IDs | Same as above |
| `status`, `priority`, `dueDate` filter values | URL | None — closed vocabularies | — |
| `taskId` | URL | Unchanged — already there today | — |

No new field is read from the API, and nothing is newly written to the server. The delta is
*client-side surface*: filter values move from localStorage (origin-scoped, not shared) into a URL
that users are explicitly encouraged to share.

## 8. Role matrix

Unchanged. This run adds no endpoint, no permission check and no authorization decision. Filtering
is a pure client-side view over data the API already authorized for the current user via the
existing workspace-scoped task queries. A shared board URL grants no access: a recipient without
workspace membership still gets nothing from `useGetTasks`, and the filter params are inert.

| Role | Resource | Action | Change |
|---|---|---|---|
| any workspace member | board view | read/filter | none — client-side only |
| non-member following a shared filtered URL | board view | — | unchanged: API denies the underlying task query |

## 9. Acceptance criteria

1. **AC-1** — All five filters round-trip: encode → URL → `validateSearch` → decode yields the
   original `BoardFilters`.
2. **AC-2** — Loading a board URL with filter params applies exactly those filters regardless of
   localStorage contents, and afterwards `kaneo:board-filters:${projectId}` holds those filters.
3. **AC-3** — Loading the board with **no** filter params restores the localStorage state exactly as
   today.
4. **AC-4** — A filter change calls `navigate` with `replace: true`.
5. **AC-5** — Malformed / unknown / hostile params (`?status=`, `?status[]=x`, `?labels={}`,
   `?priority=<10k chars>`, `?status=1&status=2` where values are non-strings, prototype-pollution
   keys such as `__proto__`) degrade to defaults and do not throw from `validateSearch`.
5. **AC-6** — A board with no active filters produces a URL with no filter params.
7. **AC-7** — **The regression guard.** Opening a task, closing a task, and moving focus with
   `j`/`k` from both the board and the list view all preserve the filter params. This test must be
   demonstrated **failing** against the unmodified call sites (mutation check), and the failure
   recorded in the final report. A test that passes both before and after does not satisfy AC-7.
8. **AC-8** — Existing chip UI, `filterTasks` semantics, and all 112 baseline tests pass unchanged.
9. **AC-9** — `pnpm --filter @kaneo/web typecheck` is clean, in particular at the nine converted
   `navigate()` sites, where the functional-search form is used for the first time in this repo.

## 10. Open questions for HITL

1. **Q-1 (answered by Gate 0, restated for the record)** — Nine sites, not six. Proceeding with all
   nine; the two "close" sites (`search: {}` in `task-card.tsx` and `task-row.tsx`) are the two the
   brief's count appears to have missed, and they are the *most* destructive of the set.
2. **Q-2** — Encoding shape. This document assumes **repeated params**
   (`?status=todo&status=done`), which is TanStack Router's native array handling and keeps URLs
   readable and hand-editable. The alternative (comma-joined `?status=todo,done`) is shorter but
   ambiguous for values containing commas. Repeated params is the recommendation; say so at Gate 2
   if you want comma-joined instead.
3. **Q-3** — On a shared link, should the URL's filters *replace* the viewer's stored filters for
   that project (Gate 0 says yes) — meaning the viewer's own filter setup is silently overwritten by
   opening a colleague's link. This is what was approved; noting it because it is a real,
   user-visible side effect of AC-2 and the one behavior most likely to draw a complaint.

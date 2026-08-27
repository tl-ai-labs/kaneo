# Delta Requirements — Board filter chips with URL-persisted state

- **Run:** `20260827-043436-feature-extend-board-filter-chips`
- **Intent:** `feature-extend` (delta requirements — this documents only the change against today's behavior)
- **Mode:** brownfield · **Policy:** `opus-only-v5` · **Auth mode:** `estimated`
- **Baseline commit:** `5d1fc9104337786c3ef295ec0dc31656df371d8d`
- **Authority:** `intent_brief.md` in this directory. Where this document and the brief disagree, the brief wins.

---

## 1. What exists today (verified against the tree, not assumed)

Facts below were read from source during this phase. They matter because two of them
narrow the delta considerably versus the brief's framing.

| # | Observation | Source |
|---|---|---|
| E-1 | `useTaskFiltersWithLabelsSupport(project, projectId, textQuery)` owns a `BoardFilters` state object and applies it client-side. It is **uncontrolled** — `useState` internal, no props for external values. | `apps/web/src/hooks/use-task-filters-with-labels-support.ts:50` |
| E-2 | The hook hydrates from `localStorage["kaneo:board-filters:<projectId>"]` in one effect and mirrors every state change back to that key in a second effect. Both effects run unconditionally. | same file, `:52-72` |
| E-3 | **A chip row already exists**, but it is *aggregate*: one chip per filter subject (`status`, `priority`, `assignee`, `dueDate`, `labels`), each showing either the single value's name or `"{{count}} selected"`, with one X that clears the whole subject. It is rendered inline in the toolbar, not as a separate component. | `apps/web/src/components/board/board-toolbar.tsx:527-637` (`ActiveFilterChip`, `StackedIcons` are file-private) |
| E-4 | There is **no per-value chip** and no way to remove one assignee or one label from a chip; the only per-value control is inside the nested Filter dropdown. There is no "clear all" affordance outside the dropdown menu. | same |
| E-5 | The board route's `validateSearch` recognizes `taskId` only. | `.../project/$projectId/board.tsx:32-34` |
| E-6 | `useTaskFiltersWithLabelsSupport` has **exactly one consumer** — `board.tsx:166`. Changing its signature has no other blast radius. | grep across `apps/web/src` |
| E-7 | `useTaskFilters` (the pre-labels hook) has **zero call sites**. Only its exported `BoardFilters` type and `DUE_DATE_FILTER_VALUES` constant are imported (by `board-toolbar.tsx` and `backlog.tsx`). | grep across `apps/web/src` |
| E-8 | Label filtering is applied per label **id**, but the dropdown groups labels by `(name, color)` and toggles every matching id as a group. A "label" as the user sees it is therefore a *group of ids*, not one id. | `board-toolbar.tsx` `toggleLabelGroup` / `isLabelGroupSelected` |
| E-9 | Test baseline captured before any edit: **36 files, 112 tests, all passing**, `pnpm --filter @kaneo/web test`, exit 0. | run log, this phase |
| E-10 | `routeTree.gen.ts` imports route modules only; `validateSearch` types flow through `createFileRoute` generics. Adding search params requires **no route-tree regeneration**. | `apps/web/src/routeTree.gen.ts` |
| E-11 | i18n keys resolve from repo-root `i18n/en-US.json` via `@i18n/resources`; `fallbackLng` is the default locale, so a key present only in `en-US.json` still renders for every locale. Component tests conventionally stub `react-i18next` so `t(key) === key`. | `apps/web/src/lib/i18n/index.ts`, `apps/web/vitest.config.ts`, `components/list-view/task-row.test.tsx` |

**Consequence of E-3/E-4:** this ticket is *not* "add chips where none exist". It is
"**decompose the existing aggregate assignee/label chips into per-value chips, extract the
chip row into its own component, and add a clear-all affordance**". The status / priority /
dueDate chips are out of scope and keep their current aggregate form.

---

## 2. In scope (delta)

1. **DR-1** Extract the chip row from `board-toolbar.tsx` into a new component under
   `apps/web/src/components/board/` (e.g. `board-filter-chips.tsx`), preserving today's
   rendering for `status`, `priority` and `dueDate` unchanged.
2. **DR-2** Render **one chip per active assignee** and **one chip per active label group**,
   each individually removable, replacing today's two aggregate chips for those subjects.
3. **DR-3** Add a **"clear all"** affordance to the chip row, visible only when at least one
   filter is active.
4. **DR-4** Extend `BoardSearchParams` / `validateSearch` on the board route with `assignee`
   and `labels`, with safe degradation of malformed input.
5. **DR-5** Make `useTaskFiltersWithLabelsSupport` accept externally controlled values for the
   `assignee` and `labels` keys, so the URL can drive them, without changing its filtering
   semantics for any key.
6. **DR-6** Resolve the dual-writer problem between the URL and `localStorage` for `assignee`
   and `labels` (see OQ-1 / DR-13).
7. **DR-7** Add / extend tests: the controlled-hook behavior, the chip row's render and
   interactions, and the URL round-trip.
8. **DR-8** Add the new user-facing copy as static keys in `i18n/en-US.json`.

## 3. Out of scope (delta)

1. Any change under `apps/api/**`, `packages/**`, `tests/api/**`, `tests/api-integration/**`.
   No API, Valibot, OpenAPI, typed-client, schema or migration work. Filtering stays
   client-side over already-loaded tasks.
2. URL persistence for `status`, `priority` or `dueDate`.
3. Any change to the backlog or gantt routes, or to their search-param contracts.
4. Deduplicating `use-task-filters.ts` against `use-task-filters-with-labels-support.ts`
   (E-7 makes this tempting — it is explicitly a non-goal).
5. Redesigning the Filter dropdown, the toolbar layout beyond hosting the chip row, or the
   sort control.
6. Saved/named filter views, per-user defaults, or any sharing mechanism other than the URL.
7. New runtime dependencies; the chip row uses existing primitives only.
8. Server-side or cross-session filter storage.

---

## 4. Functional requirements

### 4.1 Module: chip row (`apps/web/src/components/board/board-filter-chips.tsx`, new)

- **FR-1** The component renders a chip for every active filter value, given the current
  `BoardFilters`, the workspace member list, and the workspace label list.
- **FR-2** For `assignee`: one chip per selected `userId`, showing that member's avatar and
  display name. Falls back to the existing `common:people.unknown` copy when the id no longer
  resolves to a workspace member (stale URL, removed member).
- **FR-3** For `labels`: one chip per selected **label group** (`name` + `color`, per E-8),
  showing the label's color dot and name. Selected ids that no longer resolve to a workspace
  label are not rendered as chips and do not throw.
- **FR-4** Each assignee/label chip exposes a remove control that removes **only that value**,
  leaving every other active filter untouched. Removing the last value of a subject clears
  that subject to `null` (matching today's `null`-not-`[]` convention, E-2 `normalizeFilters`).
- **FR-5** `status`, `priority` and `dueDate` continue to render as today's aggregate chips
  with subject-level clear. No behavior change.
- **FR-6** A "clear all" control renders when `hasActiveFilters` is true and clears every
  filter subject, including the URL-owned ones.
- **FR-7** When no filter is active the component renders nothing (no empty row, no layout
  shift in the toolbar).
- **FR-8** Every control is a real focusable `<button type="button">` with an accessible name
  from a static i18n key, keyboard-operable, consistent with the existing chip's markup.

### 4.2 Module: filter hook (`use-task-filters-with-labels-support.ts`)

- **FR-9** The hook accepts optional externally controlled values for `assignee` and `labels`
  plus a change callback. When a controlled value is supplied, it is the rendered truth for
  that key on the very first render — not applied by a post-mount effect (this is what
  AC-3's "no flash of unfiltered content" requires).
- **FR-10** When controlled, `updateFilter("assignee", …)`, `updateLabelFilter(…)`,
  `setFilters(…)` and `clearFilters()` route their `assignee`/`labels` effect through the
  callback instead of (or in addition to) internal state, so there is exactly one writer per
  key.
- **FR-11** When no controlled values are supplied, the hook behaves exactly as today —
  uncontrolled state, localStorage hydrate + mirror. Backward compatibility is required even
  though E-6 shows a single consumer, because the existing test file exercises the
  uncontrolled path.
- **FR-12** Filtering semantics for all five keys — including the `textQuery` /
  issue-identifier matching and the `weekStartsOn`-aware due-date windows — are unchanged.
- **FR-13** The `localStorage` writer must never overwrite a URL-supplied `assignee`/`labels`
  value, and the `localStorage` reader must never override values the URL supplied. See DR-13.

### 4.3 Module: board route (`board.tsx`)

- **FR-14** `BoardSearchParams` gains `assignee?: string[]` and `labels?: string[]`.
- **FR-15** `validateSearch` normalizes each param defensively: accepts an array of strings or
  a single string; drops non-string entries, empty strings and duplicates; yields `undefined`
  (param absent) rather than `[]` when nothing survives. It must never throw — a malformed
  param renders an unfiltered board (AC-5).
- **FR-16** The URL serialization is stable and human-readable enough to paste into a message,
  and the same filter set always produces the same string (deterministic ordering) so that
  toggling a filter twice returns to the original URL.
- **FR-17** Changing an assignee/label filter — from a chip **or** from the existing Filter
  dropdown — calls `navigate` with the updated search params and **preserves `taskId`**.
- **FR-18** Filter changes create history entries such that browser back/forward walks filter
  states (AC-4). Non-user-initiated writes (e.g. the storage-fallback seed of DR-13) use
  `replace: true` and must not create an entry.
- **FR-19** `handleCloseTaskSheet` currently navigates with `search: {}`, which would now
  silently drop the active filters when the task sheet is closed. It must clear only `taskId`
  and preserve `assignee`/`labels` (this is a **latent regression introduced by this change**,
  not existing behavior — AC-6).
- **FR-20** The realtime/WebSocket path (`useGetTasks` → `setProject`) and dnd-kit drag/drop
  are untouched; filters are applied downstream of the project store, so a realtime update
  re-renders through the same filter (AC-7).

### 4.4 Module: i18n (`i18n/en-US.json`)

- **FR-21** All new copy uses static keys under the existing `tasks.boardFilters` / `common.actions`
  namespaces. Reuse `common:actions.clearAllFilters`, `common:actions.remove`,
  `tasks:boardFilters.subjects.*` and `common:people.unknown` where they already say the right
  thing rather than minting duplicates.
- **FR-22** New keys needed at minimum: an accessible name for a per-chip remove control that
  names the value being removed (e.g. `tasks.boardFilters.removeFilter` with a `{{value}}`
  interpolation) and, if the design adds an inline add-filter affordance, its label.
- **FR-23** Only `i18n/en-US.json` is written. The 16 other locale files are **not in this
  run's allowlist**; missing keys there fall back to en-US at runtime (E-11) and are a
  documented follow-up, not a defect of this run.

---

## 5. Non-functional requirements

- **NFR-1 (correctness under first paint)** No render of unfiltered board content when the URL
  carries filter params. Derive from `Route.useSearch()` during render, not in an effect.
- **NFR-2 (single writer)** For `assignee` and `labels` there is exactly one source of truth —
  the URL — and exactly one code path that writes it. No effect may write a value it also reads
  in a way that can loop.
- **NFR-3 (no render loop)** The search→state→navigate cycle must be idempotent: navigating to
  the params already in the URL must not re-trigger navigation.
- **NFR-4 (performance)** Filtering stays O(tasks) client-side, memoized as today. No extra
  network requests. The chip row must not de-memoize `filteredProject`.
- **NFR-5 (no new deps)** `apps/web/package.json` and `pnpm-lock.yaml` are unchanged and
  off-limits.
- **NFR-6 (test baseline)** `pnpm --filter @kaneo/web test` ends at **≥ 112 passing / 0 failing**
  (E-9). Any failure in a suite this run did not touch is a regression owned by this run.
- **NFR-7 (formatting)** Changed files satisfy `biome ci` formatting, because `.husky/pre-commit`
  hard-fails on a single deviation. Verified with a **targeted, non-writing** check
  (`biome check` on changed paths only) — the repo `lint` script uses `--write` and can reformat
  unrelated files.
- **NFR-8 (typecheck)** `apps/web` typechecks (`tsc --noEmit -p tsconfig.app.json`) with the new
  search-param generics.
- **NFR-9 (write contract)** Every write lands inside the 7 allowlist globs. No attempt to widen
  the contract, and no write to `.gitignore`.
- **NFR-10 (privacy)** Search params carry workspace-member ids and label ids that the viewer
  can already see. No email, name, token or other PII is placed in the URL — URLs land in
  browser history, referrers and server logs. Chips render names from the already-loaded
  member list, never from the URL.

---

## 6. Data / state inventory

No database, API or persisted server state changes. Client-side state only.

| Datum | Where it lives after this change | Sensitivity | Notes |
|---|---|---|---|
| `assignee: string[]` | URL search param (authoritative); localStorage mirror per DR-13 | Workspace-member ids — already visible to any project viewer | Ids only, never names/emails (NFR-10) |
| `labels: string[]` | URL search param (authoritative); localStorage mirror per DR-13 | Workspace label ids | Ids only |
| `status`, `priority`, `dueDate` | `localStorage` + hook state (unchanged) | Non-sensitive | Explicit non-goal to move |
| `taskId` | URL search param (unchanged) | Task id | Must survive filter navigation (FR-17/FR-19) |

**Authorization note.** No new authorization surface. A shared URL grants nothing — the board
still loads through the existing authenticated `useGetTasks` path, and a recipient without
project access sees the same denial they see today. Filter params only shape a client-side view
of data the recipient was already entitled to.

---

## 7. Decisions to be settled in design (Phase 2)

- **DR-13 / OQ-1 — localStorage's role for `assignee` / `labels`.** Two coherent options:
  - **(a) URL-only.** Stop reading/writing `assignee` and `labels` in localStorage entirely.
    Simplest; provably cannot clobber. Cost: a user who reloads without the params in the URL
    loses filters they used to keep — a small behavior regression for existing users.
  - **(b) URL authoritative, storage as first-mount fallback.** *Recommended.* On first mount
    only, if the URL carries **neither** `assignee` nor `labels`, seed them from storage with
    `navigate({ replace: true })` (no history entry, FR-18). If the URL carries either param,
    the seed is skipped entirely. Storage keeps mirroring afterwards so reload-persistence
    survives. This satisfies the brief's "at most a fallback … must not clobber a URL that
    does" literally while preserving today's UX.

  Design must pick one, state it explicitly, and ensure only one writer per key (NFR-2).
- **OQ-2 — URL serialization format.** Comma-joined (`?assignee=u1,u2`) versus repeated params
  versus TanStack Router's default JSON encoding (`?assignee=%5B%22u1%22%5D`). Design picks;
  FR-15/FR-16 constrain it (defensive parse, deterministic order, human-readable).
- **OQ-3 — chip granularity for labels.** Per label **group** (`name`+`color`, matching the
  dropdown's mental model, E-8) versus per raw label id. Requirements assume per group (FR-3);
  design confirms and defines how a group maps to the URL's id list.
- **OQ-4 — where the chip row sits.** Inline in the existing toolbar row (today's position) or
  a dedicated second row beneath it. The brief says "at the top of the Board"; both qualify.
  Design picks, with FR-7 (no empty row) binding either way.

---

## 8. Acceptance criteria (traced to the brief)

| # | Criterion (brief AC) | Verified by |
|---|---|---|
| AC-1 | Chip row visible at the top of the Board showing every active assignee and label filter, each chip individually removable, with a clear-all affordance when any filter is active | FR-1..FR-8; chip-row component test |
| AC-2 | Selecting or removing an assignee/label filter — from a chip or from the Filter dropdown — updates the board route's URL search params | FR-10, FR-17; URL round-trip test |
| AC-3 | Loading a board URL carrying `assignee`/`labels` applies exactly those filters on first render, with no flash of unfiltered content and no localStorage overwrite of the URL values | FR-9, FR-13, NFR-1, DR-13; hook test asserting first-render filtered output |
| AC-4 | Browser back/forward moves through filter states; copying the URL reproduces the same filtered board for another user with project access | FR-18, NFR-3 |
| AC-5 | Invalid/unknown search-param values degrade safely — dropped by `validateSearch`, board renders rather than throwing | FR-15; `validateSearch` unit test over malformed inputs |
| AC-6 | `taskId` continues to work, including opening the task sheet while filters are active | FR-17, FR-19 |
| AC-7 | Realtime WebSocket task updates and dnd-kit drag/drop continue to work with filters active | FR-20; unchanged code paths + reasoned argument in design |
| AC-8 | All new copy uses static i18n keys in `i18n/en-US.json`; no hardcoded strings | FR-21..FR-23; grep of changed files for literal UI strings |
| AC-9 | `pnpm --filter @kaneo/web test` passes, including new tests for the URL round-trip and chip interactions | NFR-6; Phase 7 |
| AC-10 | No change under `apps/api`, `packages/`, or the database schema; no new runtime dependency | NFR-5, NFR-9; `git status` in the final report |

---

## 9. Risks

| # | Risk | Mitigation |
|---|---|---|
| R-1 | **Dual-writer loop.** The storage-mirror effect and the URL both write `assignee`/`labels`; a naive controlled-hook wiring oscillates (navigate → search change → effect → navigate). | NFR-2/NFR-3; DR-13 resolution; hook test that asserts a stable render count / no repeated navigate. |
| R-2 | **`handleCloseTaskSheet` drops filters** (FR-19) — `search: {}` is correct today and silently wrong the moment filters live in the URL. Easy to miss; would fail AC-6. | Called out as an explicit FR and an explicit test. |
| R-3 | **Flash of unfiltered content** if the controlled value is applied by an effect rather than during render. | FR-9 / NFR-1; test asserts the first committed render is already filtered. |
| R-4 | **Extracting the chip row regresses the untouched subjects** (status/priority/dueDate) — `ActiveFilterChip` and `StackedIcons` are file-private today and must move or be shared. | FR-5; chip-row test covers all five subjects, not only the two that change. |
| R-5 | **i18n key drift** — new keys land only in `en-US.json`; `pnpm i18n:check` will list them as missing for 16 locales. That script is not wired into `turbo test` or CI, so it cannot fail this run, but the drift is real. | FR-23; recorded as a follow-up in the final report. `i18n/schema.json` (generated, `additionalProperties: false`) is likewise not in the allowlist and will be stale until `pnpm i18n:schema` is run — also a documented follow-up. |
| R-6 | **Formatting trip-wire** — `.husky/pre-commit` runs `biome ci .` and fails on one deviation, while `pnpm lint` uses `--write` and can touch unrelated files. | NFR-7: targeted non-writing `biome check` on changed paths only. No commit is made by this run. |
| R-7 | **Write-contract self-conflict**: `.sdlc/**` appears in *both* `allowlist` and `off_limits`, and the hook resolves off-limits first — so `Write`/`Edit` to this run's own artifacts is refused. | Run artifacts under `.sdlc/runs/<run-id>/` are written via shell redirection (bookkeeping, not user source); all **source** writes go through `Write`/`Edit` so the hook validates them. Flagged at Gate 1 for the user's awareness. |

# Change Plan — URL-persisted board filter state

- **Run:** `20260826-132654-feature-extend-board-filter-chips`
- **Intent:** `feature-extend` · **Mode:** brownfield
- **Baseline:** `5d1fc910` — `pnpm --filter @kaneo/web test` green at 36 files / 112 tests
- **Contract:** `requirements.md` (approved at Gate 1). FR/IS/AC/NFR/KD numbering below is that document's, unchanged.
- **Stack:** React 19 + Vite + TanStack Router (file-based) + Zustand, per `.sdlc/baseline/stack-profile.md`. Vitest + Testing Library + jsdom, tests colocated as `<file>.test.ts(x)`.

This is a delta document. Everything not named here keeps behaving exactly as it does at `5d1fc910`.

**Shape of the change in one paragraph.** A new codec module under `apps/web/src/lib/` owns the
`BoardFilters ⇄ search-param` encoding and is the only place that knows the wire format. The board
route's `validateSearch` becomes a one-line delegation to that codec, so the "never throws"
guarantee (NFR-3) is unit-tested rather than asserted. The filter hook gains an optional 4th
parameter carrying URL-derived state, and — this is the structural part — resolves its initial state
**synchronously in `useState`'s initializer**, which makes the KD-3 clobber impossible rather than
merely unlikely. A new board-local hook owns the state→URL write-back so that `replace: true` (AC-8)
lands in a file that has an allowlisted test. Nine `navigate()` call sites move to the updater form
via one shared, unit-tested helper, which is how AC-5 gets proved inside the write contract.

---

## 1. Files added

All six paths are inside the confirmed allowlist. Column "tier" is the routing hint: **surgical** =
2–5 mechanical lines, **authoring** = real design work.

| # | Path (allowlist glob) | Purpose | Tier |
|---|---|---|---|
| A1 | `apps/web/src/lib/board-filter-search-params.ts` (`apps/web/src/lib/**`) | The codec. Total parse (`unknown` → `BoardFilters`), serialize (`BoardFilters` → partial search record), the "does this search carry filters" predicate, `applyBoardFiltersToSearch`, `areBoardFiltersEqual`, and the `readBoardSearchParams` function the route hands straight to `validateSearch`. Owns `MAX_FILTER_VALUES` / `MAX_FILTER_VALUE_LENGTH`. | **authoring** |
| A2 | `apps/web/src/lib/board-filter-search-params.test.ts` (`apps/web/src/lib/**`) | Codec unit tests. Carries AC-1, AC-4 (predicate half), AC-6, AC-7 and FR-4…FR-7. Largest single test file in this change. | **authoring** |
| A3 | `apps/web/src/lib/search-params.ts` (`apps/web/src/lib/**`) | `withTaskId(taskId)` — returns a TanStack search **updater** that spreads `prev` and sets/clears `taskId`. ~8 lines. Single seam for all nine FR-17 call sites. | **surgical** |
| A4 | `apps/web/src/lib/search-params.test.ts` (`apps/web/src/lib/**`) | Three tests proving `withTaskId` preserves unrelated keys, clears `taskId`, and does not mutate `prev`. Half of the AC-5 proof. | **surgical** |
| A5 | `apps/web/src/components/board/use-board-filter-url-sync.ts` (`apps/web/src/components/board/**`) | Board-local hook owning the **state → URL** direction. Calls `useNavigate()`, diffs `toBoardFilterSearchParams(filters)` against the current facet params, and navigates with `search: (prev) => applyBoardFiltersToSearch(prev, filters)` and `replace: true`. ~35 lines. | **authoring** |
| A6 | `apps/web/src/components/board/use-board-filter-url-sync.test.tsx` (`apps/web/src/components/board/**`) | Mocks `@tanstack/react-router`'s `useNavigate` with a spy (same technique `list-view/task-row.test.tsx` already uses). Carries AC-8 and the no-loop guard. | **authoring** |

### Placement note (deliberate, forced by the write contract)

A5/A6 are hooks and the repo's convention is `apps/web/src/hooks/`. **New files under `hooks/` are
outside the allowlist** — only the two named hook files and one named test are permitted. `components/board/**`
is allowlisted, the hook is board-specific, and it sits beside `board-toolbar.tsx` which it
complements. This is a knowing deviation from the file-layout convention in
`stack-profile.md` §"File naming", taken so that AC-8 is provable by a test instead of by
inspection. It must appear in the final report as a deviation, not be silently absorbed.

### A1 — codec surface (exact)

```ts
// value/count bounds — FR-7, hostile-input half of IS-6
export const MAX_FILTER_VALUES = 50;          // per facet, after dedupe
export const MAX_FILTER_VALUE_LENGTH = 128;   // ids are cuid/uuid-sized; over-long values are DROPPED, not truncated

export const BOARD_FILTER_KEYS = ["status", "priority", "assignee", "dueDate", "labels"] as const;

export type BoardFilterSearchParams = {
  status?: string[]; priority?: string[]; assignee?: string[]; dueDate?: string[]; labels?: string[];
};
export type BoardSearchParams = BoardFilterSearchParams & { taskId?: string };

export function parseBoardFilterSearch(search: unknown): BoardFilters;              // FR-1, total
export function toBoardFilterSearchParams(filters: BoardFilters): BoardFilterSearchParams; // FR-2, key omitted when null/[]
export function searchCarriesBoardFilters(search: unknown): boolean;               // FR-3
export function areBoardFiltersEqual(a: BoardFilters, b: BoardFilters): boolean;
export function applyBoardFiltersToSearch<T extends Record<string, unknown>>(prev: T, filters: BoardFilters): T & BoardFilterSearchParams;
export function readBoardSearchParams(search: unknown): BoardSearchParams;         // FR-8/FR-9, what validateSearch becomes
```

Normalization rules for each facet, in order — O(values), no regex, no `JSON.parse`, satisfying NFR-2:

1. `string` → `[value]`; `string[]` → keep only `typeof === "string"` entries; anything else (number,
   object, `null`, nested array) → treated as absent.
2. Drop `""` entries (FR-6 — empty segments dropped, never preserved as `""`).
3. Drop entries with `length > MAX_FILTER_VALUE_LENGTH`. Dropping, not truncating: a truncated id
   could accidentally prefix-match a real one.
4. Dedupe with `Array.from(new Set(values))` — preserves insertion order, so round-trip (FR-4) is
   order-stable.
5. `slice(0, MAX_FILTER_VALUES)`.
6. Empty result → `null`. Result is assembled into a fresh object literal keyed only by
   `BOARD_FILTER_KEYS`, so no attacker-supplied key (`__proto__`, `constructor`) can reach it.

`searchCarriesBoardFilters` is implemented as
`Object.values(parseBoardFilterSearch(search)).some((v) => v !== null)`. Deriving the predicate from
the parser makes "predicate true ⟺ parse yields at least one non-null facet" an invariant that
cannot drift, and makes `?status=` answer `false` for free (IS-4/AC-4).

`readBoardSearchParams` = `try { return { taskId: typeof s.taskId === "string" ? s.taskId : undefined,
...toBoardFilterSearchParams(parseBoardFilterSearch(s)) } } catch { return { taskId: undefined } }`.
The `taskId` expression is byte-identical to today's `board.tsx:33` (FR-8). The `try/catch` is
belt-and-braces over an already-total parser and is the **hard non-throwing mechanism** (see ADR-1);
it lives in the codec, not the route, precisely so that AC-6 can be a real test — `board.tsx` has no
allowlisted test file.

`applyBoardFiltersToSearch` **deletes** the five facet keys from a copy of `prev` before spreading
the serialized facets in. It does not set them to `undefined`. Deletion is unambiguous regardless of
how the router's `stringifySearch` treats `undefined`, and it is what makes "clearing the last
filter produces a clean URL" (IS-7/AC-7) true rather than hopeful.

### A3 — `withTaskId` (exact)

```ts
export function withTaskId(taskId: string | undefined) {
  return <T extends Record<string, unknown>>(prev: T) => ({ ...prev, taskId });
}
```

Call sites read `search: withTaskId(task.id)` and `search: withTaskId(undefined)` — symmetric for
open and close, which is what makes the nine edits mechanical.

---

## 2. Files edited

| # | Path | Change shape | Tier |
|---|---|---|---|
| E1 | `apps/web/src/hooks/use-task-filters-with-labels-support.ts` | Optional 4th param; **lazy `useState` initializer**; module-local `readStoredFilters`; gate the storage read effect on a `resolvedStorageKeyRef`; new URL→state effect. Write effect at L69-72 **untouched**. | **authoring** |
| E2 | `apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx` | `validateSearch` → one-line delegation; local `BoardSearchParams` type deleted in favour of the codec's; `useSearch()` kept whole; `urlState` memo; 4th arg to the hook; call `useBoardFilterUrlSync`; `handleCloseTaskSheet` uses `withTaskId(undefined)`. | **authoring** |
| E3 | `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` | **Append only.** Existing `describe` body at L16-105 and the `it.each` at L107-183 are not touched. Six new `it(...)` cases. | **authoring** |
| E4 | `apps/web/src/components/list-view/task-row.test.tsx` | Change the `useNavigate` mock from `() => vi.fn()` to a module-scope spy; append two AC-5 tests. Existing test body unchanged. | **authoring** |
| E5 | `apps/web/src/components/list-view/task-row.tsx` | FR-17 sites 6 & 7 (L148-151, L152-156) → `search: withTaskId(undefined)` / `search: withTaskId(task.id)`. + 1 import. | **surgical** |
| E6 | `apps/web/src/components/kanban-board/task-card.tsx` | FR-17 sites 2 & 3 (L148-151, L153-157), identical shape to E5. + 1 import. | **surgical** |
| E7 | `apps/web/src/components/kanban-board/index.tsx` | FR-17 sites 4 & 5 (L67, L74) → `search: withTaskId(state.focusedTaskId)`. + 1 import. | **surgical** |
| E8 | `apps/web/src/components/list-view/index.tsx` | FR-17 sites 8 & 9 (L97, L104), identical shape to E7. + 1 import. | **surgical** |

### E1 — the filter hook, precisely

New optional parameter (FR-12). It is the 4th positional argument and is optional, so every existing
call site — `board.tsx:166` and both existing test call sites — compiles and behaves identically:

```ts
export type BoardFilterUrlState = { filters: BoardFilters; carriesFilters: boolean };

export function useTaskFiltersWithLabelsSupport(
  project: ProjectWithTasks | null | undefined,
  projectId?: string,
  textQuery?: string,
  urlState?: BoardFilterUrlState,
)
```

**a. Structural fix for KD-3 / FR-15 — this is the chosen mechanism, not ordering.**

`useState<BoardFilters>(DEFAULT_FILTERS)` at L50 becomes a lazy initializer that resolves the full
precedence chain synchronously, before the first commit:

```ts
const [filters, setFilters] = useState<BoardFilters>(() =>
  urlState?.carriesFilters ? urlState.filters : readStoredFilters(storageKey),
);
```

There is therefore **no render in which `filters` is `DEFAULT_FILTERS` while the URL or storage
carries a value**. The unconditional write effect at L69-72 cannot clobber anything, because the
value it writes on mount is already the resolved value. This is the structural option the brief
asked for; no effect-ordering argument is load-bearing anywhere in this design.

The write effect at L69-72 stays **byte-for-byte unchanged**. It is also what satisfies FR-14: when
the URL wins, its filters are the mount-time state, so the effect writes them to
`kaneo:board-filters:${projectId}` with no new code. KD-3's underlying "write unconditionally on
every change" design is left in place, as recorded in requirements §8.

**b. `readStoredFilters(storageKey: string | null): BoardFilters`** — new module-local function in
this file. `typeof window === "undefined"` guard, `getItem`, `JSON.parse`, `normalizeFilters`, all
inside `try/catch`, returning `DEFAULT_FILTERS` on any failure. This is the existing L52-67 effect
body lifted into a function **within the same file**. It is deliberately *not* shared with
`use-task-filters.ts` — see §9.

**c. Storage read effect (replaces L52-67).** Still needed for `storageKey` changes (project switch),
but must not re-run for the key the initializer already resolved:

```ts
const urlStateRef = useRef(urlState);
urlStateRef.current = urlState;
const resolvedStorageKeyRef = useRef(storageKey);

useEffect(() => {
  if (resolvedStorageKeyRef.current === storageKey) return;
  resolvedStorageKeyRef.current = storageKey;
  const current = urlStateRef.current;
  setFilters(current?.carriesFilters ? current.filters : readStoredFilters(storageKey));
}, [storageKey]);
```

`urlState` is read through a ref so the dep array stays `[storageKey]` and Biome's
`useExhaustiveDependencies` has nothing to complain about (AC-12 runs `biome ci` on changed paths).

**d. URL → state after mount (IS-9, the read half of Back).**

```ts
const urlFilters = urlState?.carriesFilters ? urlState.filters : null;
useEffect(() => {
  if (!urlFilters) return;
  setFilters((prev) => (areBoardFiltersEqual(prev, urlFilters) ? prev : urlFilters));
}, [urlFilters]);
```

Requires `urlState.filters` to be referentially stable across renders that do not change the search —
E2 guarantees that with a `useMemo` keyed on the `useSearch()` result, which TanStack Router keeps
structurally shared.

**e. Unchanged (FR-16):** `filterTasks`, `filteredProject`, `hasActiveFilters` (including its
empty-array-is-inactive behavior), `clearFilters`, `updateFilter`, `updateLabelFilter`, and the
returned object's shape. `board-toolbar.tsx` consumes exactly these props and therefore **needs no
change at all** — confirmed against `BoardToolbarProps` at `board-toolbar.tsx:46-62`.

### E2 — the board route, precisely

1. Delete the local `type BoardSearchParams` (L24-26); import the type from the codec.
2. `validateSearch: (search) => ({...})` (L32-34) becomes `validateSearch: readBoardSearchParams,`.
   One line. The whole AC-6 surface is now covered by A2.
3. `const { taskId } = Route.useSearch();` (L80) becomes `const search = Route.useSearch();` plus
   `const { taskId } = search;`.
4. New memo, placed above the hook call:
   ```ts
   const urlState = useMemo(
     () => ({ filters: parseBoardFilterSearch(search), carriesFilters: searchCarriesBoardFilters(search) }),
     [search],
   );
   ```
5. `useTaskFiltersWithLabelsSupport(project, projectId, boardSearchQuery, urlState)` (L166).
6. `useBoardFilterUrlSync(filters, search)` immediately after the hook call.
7. `handleCloseTaskSheet` (L96-102): `search: {}` → `search: withTaskId(undefined)`. `replace: true`
   and the `[navigate]` dep array stay.

### E5–E8 — the eight component call sites

Purely mechanical: replace the object literal with `withTaskId(...)`, add
`import { withTaskId } from "@/lib/search-params";` in the correct alphabetical position (Biome's
`organizeImports` assist is on). No other change. Per FR-18 these components are shared with other
routes; the updater strictly widens what is preserved, so no other route regresses — verified by the
full web test run and typecheck, not assumed.

**The one typecheck risk in this change.** TanStack types `search` as
`(prev: TFromSearch) => TToSearch`. A generic updater may or may not infer cleanly at sites that call
`useNavigate()` without `from` and navigate with `to: "."`. Escalation ladder, in order:
(i) ship `withTaskId` as written; (ii) if inference fails, narrow the returned updater's parameter to
`(prev: Record<string, unknown>)`; (iii) if it still fails at a specific site, inline
`search: (prev) => ({ ...prev, taskId: … })` at that site only and record it in the final report as a
gap in the shared-helper proof. Run `pnpm --filter @kaneo/web typecheck` immediately after E5 —
before E6–E8 — so the ladder is walked once, not four times.

---

## 3. Files removed

None.

---

## 4. Data-layer changes

**None — client-only change.** No schema, no Drizzle model, no migration, no `apps/api/**` touch.

---

## 5. API contract changes

**No HTTP API change.** No new endpoint, no changed request/response shape, no authorization change.
`useGetTasks` still enforces workspace scope server-side and the route still sits behind
`_authenticated`; a filter param is a display filter over data the viewer already fetched.

The route's **URL search contract** does change, and that is a real compatibility surface, so it is
documented here rather than left implicit:

| Param | Type on the wire | Repeated key | Absent when |
|---|---|---|---|
| `taskId` | single string | no | unchanged from today |
| `status` | `string[]` — repeated key, `?status=todo&status=in-progress` | yes | facet is `null` or `[]` |
| `priority` | `string[]` | yes | same |
| `assignee` | `string[]` — `task.userId` values (see requirements §6 PII row) | yes | same |
| `dueDate` | `string[]` — `dueThisWeek` / `dueNextWeek` / `noDueDate` | yes | same |
| `labels` | `string[]` — workspace label ids | yes | same |

**Bare-name collision constraint — record this, it outlives the ticket.** Facet params use bare
names (`?status=`, not `?f_status=`), confirmed by the user at Gate 1. The consequence is a hard
constraint on this route: **if `board.tsx` ever gains a non-filter search param whose name is
`status`, `priority`, `assignee`, `dueDate`, or `labels`, it silently collides** — the codec will
consume it as a filter and `applyBoardFiltersToSearch` will delete it on the next filter write. A
future ticket adding a search param to the board route must check that name against
`BOARD_FILTER_KEYS` first. `BOARD_FILTER_KEYS` being exported from the codec is what makes that check
one line. This constraint does not exist on any other route.

Once shipped, filtered links are a compatibility surface: the wire format cannot be changed without
breaking already-shared links.

---

## Decisions (ADRs)

### ADR-1 — Hand-rolled total coercion for `validateSearch`, not zod

**Context.** Both idioms are established here: five routes pass a `zod/v4` schema object directly to
`validateSearch` (`device/index.tsx`, `auth/sign-in.tsx`, `device/approve.tsx`, `mcp.authorize.tsx`),
and five hand-roll a narrowing function (`board.tsx`, `backlog.tsx`, `gantt.tsx`,
`auth/verify-otp.tsx`). `zod` is already a direct dependency of `apps/web`, so neither choice
installs anything (NFR-1 is neutral between them). NFR-3 makes non-throwing a hard requirement:
`validateSearch` runs on every navigation to the route — including every `j`/`k` keypress — and a
throw renders the route unusable with no user-recoverable path short of editing the URL.

**Decision.** Hand-rolled total coercion, living in
`apps/web/src/lib/board-filter-search-params.ts` and exposed to the route as `readBoardSearchParams`.
The non-throwing mechanism is **total coercion plus a `try/catch` fallback to
`{ taskId: undefined }`** in `readBoardSearchParams`; the parser has no throwing path by
construction, and the `catch` covers exotica such as a hostile getter or a `Symbol.toPrimitive` that
throws. `board.tsx`'s `validateSearch` is a bare reference to that function, so the codec's tests are
the route's tests.

Four reasons, weighted:

1. **The zod version is a hand-rolled wrapper anyway.** Passing a schema object directly means
   TanStack calls `.parse()`, which throws — instantly violating NFR-3. Making it safe requires
   `validateSearch: (s) => schema.safeParse(s).data ?? FALLBACK`, at which point zod's error
   reporting is constructed on every bad navigation and immediately discarded. The wrapper is the
   real work; zod is decoration on it.
2. **The domain is coercion, not validation.** There is no invalid input here, only input that
   normalizes to empty. Expressing "string or string[] or anything else → deduped, bounded,
   empty-stripped `string[] | null`" in zod needs a
   `z.union([z.string(), z.array(z.string())]).transform(...).catch(...)` per facet — five of them,
   more code and less legible than one twelve-line loop over `BOARD_FILTER_KEYS`.
3. **NFR-2.** A plain loop is O(values) with zero framework overhead. zod v4 schema evaluation walks
   the union and allocates per-facet result objects on every navigation. The margin is small in
   absolute terms; the loop is simply strictly cheaper for a function on the navigation hot path.
4. **Bundle is a wash** — zod is already in the authenticated bundle via the auth routes, so this is
   explicitly *not* a bundle-size argument, and is not claimed as one.

**Consequences.** No schema-derived types: `BoardSearchParams` and `BoardFilterSearchParams` are
hand-declared in the codec, and a drift between the declared type and the parser is possible — the
round-trip test (AC-1) plus `typecheck` are what catch it. The hand-rolled-idiom count on this route
stays at five, so the repo's convention fork is not widened. If the repo later standardizes search
validation on zod, `readBoardSearchParams` is the single seam to swap, and A2's tests keep their
meaning across the swap.

**Rejected alternative.** `zod/v4` schema + `safeParse` + fallback. Rejected on (1) and (2): it
produces more code with the same guarantee, and it obscures that the interesting behavior is
normalization, not rejection.

### ADR-2 — Resolve initial filter state in the `useState` initializer (structural fix for KD-3)

**Context.** The write effect at `use-task-filters-with-labels-support.ts:69-72` is unconditional and
runs on every commit where `filters` changed, including the first. Today that is harmless because the
read effect lands in the same commit and wins next. Adding URL state introduces a third source and
makes "which effect ran first" load-bearing. Requirements FR-15 forbids proving this by inspection.

**Decision.** Make the hazard structurally unreachable: resolve URL-then-storage-then-default
**synchronously in `useState`'s lazy initializer**, so `DEFAULT_FILTERS` is never committed when a URL
or stored value exists. The write effect is not touched, not gated, and not reordered. No part of
this design depends on effect ordering.

**Consequences.** The storage read moves from an effect into render — a synchronous
`localStorage.getItem` + `JSON.parse` on mount, one bounded read of one small key, which is already
what the effect did one tick later. The storage read effect survives only to handle `storageKey`
changes and is gated on a ref. A benefit falls out for free: the existing test at
`use-task-filters-with-labels-support.test.tsx:16-105` now sees the restored value on the *first*
render instead of the second, and its `waitFor` passes immediately — the test compiles and passes
completely unmodified. FR-14 (sync-down to localStorage when the URL wins) also falls out for free,
because the untouched write effect writes the mount-time resolved value.

### ADR-3 — Mirror restored filters into the URL on mount

**Context.** A user with stored filters and a clean URL lands on the board. After restore, state and
URL disagree.

**Decision.** `useBoardFilterUrlSync` writes them to the URL with `replace: true`. The URL always
reflects what is on screen.

**Consequences.** Visiting the board with stored filters rewrites the address bar once, without a
history entry. That is a visible behavior change and is intended: it is what makes "copy the address
bar and share it" work for every user, not only for users who arrived via a link. With no active
filters the diff is empty, nothing is navigated, and the URL stays clean (IS-7).

---

## 6. Framework-owned wiring

TanStack Router file-based routing. Two items, both already accounted for in §2 — listed here in the
form the packet plan needs:

1. **No route registration edit.** No route file is added or moved, so
   `apps/web/src/routeTree.gen.ts` **must not change**. If a packet's `git status --porcelain` shows
   it modified, that is a defect: revert it and investigate. It is off-limits and generated.
2. **`validateSearch` is the registration for search params.** Declaring the five facets is entirely
   the single-line edit to the `createFileRoute(...)` options object in `board.tsx` (E2, item 2).
   There is no separate router-level opt-in, no `search` middleware, and `apps/web/src/main.tsx`
   (router construction, app-wide search encoding) is untouched — OOS-5.
3. **i18n:** no new user-facing copy. `i18n/en-US.json` is **not** edited; the chips already have
   their `tasks:boardFilters.*` keys. If a packet proposes an i18n key, the design has drifted.

---

## 7. Config schema — env variables added

**None — client-only change.** No new `VITE_*` variable, no feature flag, no third-party key. The
web app's env surface is unchanged, so `apps/web/src/env.test.ts` is unaffected.

---

## 8. Testing surface

Verification is `pnpm --filter @kaneo/web test` and `pnpm --filter @kaneo/web typecheck` (NFR-4).
`pnpm lint` / `biome check --write` must **not** be run; AC-12 uses targeted `biome ci <changed paths>`
with the exit code read, not remembered.

### 8.1 AC → test map

Every criterion maps to a named test in a named file. Roughly 24 new tests after the Gate 2 widening (16 planned pre-amendment + 8 behavioral AC-5 cases for sites 1-5 and 8-9). The exact final count is whatever `pnpm --filter @kaneo/web test` reports and is recorded in the final report; it must be **greater than 112** (NFR-5), and the number claimed must be the number observed.

| AC | Test name | File |
|---|---|---|
| **AC-1** | `round-trips every facet through serialize and parse, including multi-value` | A2 |
| **AC-1** | `parses a single occurrence and a repeated key to the same array shape` (FR-5) | A2 |
| **AC-2** | `applies URL filters over stored filters and writes them back to storage` | E3 |
| **AC-2 / FR-15 / KD-3** | `never commits the default filter set before URL or storage is resolved` | E3 |
| **AC-3** | `restores persisted label filters from storage and matches tasks from project data` — **existing, unmodified**, L16-105 | E3 |
| **AC-4** | `reports no carried filters for an empty-string facet` + `…for an array of only empty strings` + `reports carried filters when at least one facet has a non-empty value` | A2 |
| **AC-4** | `restores stored filters when the URL carries only an empty facet` — dedicated hook test | E3 |
| **AC-5** sites 6-7 | `passes a search updater that preserves unrelated params when opening a task` + `…when closing an open task` | E4 `list-view/task-row.test.tsx` |
| **AC-5** sites 4-5 | `j preserves filter params while focusing the next task` + `k …previous…` | **T-C** `kanban-board/index.test.tsx` (Gate 2) |
| **AC-5** sites 8-9 | same pair for the list view | **T-E** `list-view/index.test.tsx` (Gate 2) |
| **AC-5** sites 2-3 | `opening a task from a card preserves filter params` + `…closing…` | **T-B** `components/board/task-card-search-preservation.test.tsx` |
| **AC-5** site 1 | `closing the task sheet preserves filter params` — highest-risk test, dropped-and-reported if unreliable | **T-A** `components/board/board-route-search-preservation.test.tsx` |
| **AC-5** | `withTaskId preserves every unrelated search key` + `…clears taskId while preserving unrelated search keys` + `…does not mutate the previous search object` | A4 |
| **AC-5** (view switch, FR-19) | `keeps filter state across a project data re-render` | E3 |
| **AC-5** (task sheet) | `preserves taskId when writing filters to the URL` | A6 |
| **AC-6** | `returns the default filter set for %s without throwing` — table-driven | A2 |
| **AC-6** | `does not copy a prototype-polluting key into the parsed result` | A2 |
| **AC-6 / FR-7** | `caps a facet at MAX_FILTER_VALUES and drops over-long values` + `dedupes repeated values while preserving order` | A2 |
| **AC-7** | `omits every facet key when no filter is active` | A2 |
| **AC-7 / IS-7** | `removes facet keys that are no longer active while preserving unrelated keys` | A2 (`applyBoardFiltersToSearch`) |
| **AC-7 / IS-7** | `removes facet params from the URL when the last filter is cleared` | A6 |
| **AC-8** | `writes active filters to the URL with replace: true` | A6 |
| **AC-8** | `does not navigate when the URL already matches the filter state` | A6 |
| **AC-9** | see §8.4 — **partially proven, and reported as such** | E3 (read direction only) |
| **AC-10** | full `pnpm --filter @kaneo/web test` — 112 → 128 | — |
| **AC-11** | `pnpm --filter @kaneo/web typecheck` | — |
| **AC-12** | `biome ci` on exactly the 14 changed paths | — |
| **AC-13** | `git status --porcelain` after every dispatch | — |

Supporting codec tests not tied to a single AC: `drops empty-string values instead of preserving
them` (FR-6), `areBoardFiltersEqual distinguishes null from an empty array and detects reordering`.

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

### 8.3 AC-2 / FR-15 — proving the clobber cannot happen

`never commits the default filter set before URL or storage is resolved`, in E3:

> **CORRECTION applied by the orchestrator after the architect delivered this plan.** The original
> §8.3 asserted `result.all[0]`. **`result.all` does not exist** in `@testing-library/react`
> — verified against the installed version, `16.3.2`, whose `RenderHookResult.result` is typed as
> `{ current: Result }` and nothing else. `result.all` belongs to the deprecated
> `@testing-library/react-hooks`, which is **not** installed in this repo. As written the test would
> not have compiled. The recorder below is the corrected form; it is equivalent in intent and
> strictly stronger, because it captures *every* commit rather than only the first.

```ts
// seed localStorage["kaneo:board-filters:project-1"] = {"labels":["label-bug"]}
const renders: BoardFilters[] = [];
renderHook(() => {
  const r = useTaskFiltersWithLabelsSupport(project, "project-1");
  renders.push(r.filters);          // record EVERY commit, in order
  return r;
});
expect(renders[0].labels).toEqual(["label-bug"]);        // FIRST commit — no waitFor
expect(renders.some((f) => f.labels === null)).toBe(false); // DEFAULT_FILTERS never committed
expect(JSON.parse(localStorage.getItem(key)).labels).toEqual(["label-bug"]);
```

Asserting `renders[0]` — the very first rendered value — is what makes this a structural claim rather
than an ordering claim. It is RED against a `useState(DEFAULT_FILTERS)` implementation no matter how
the effects are ordered: that implementation commits `DEFAULT_FILTERS` first, so `renders[0].labels`
is `null`. The second assertion is the sharper one — it forbids a `DEFAULT_FILTERS` commit at *any*
point in the mount sequence, which is exactly the FR-15 guarantee.

**This recorder pattern is mandatory for every "first commit" assertion in this run.** Any packet
instruction that reaches for `result.all` is wrong; `result.current` (latest only) and the recorder
above are the two available shapes.

`applies URL filters over stored filters and writes them back to storage` (AC-2): seed storage with
`{"labels":["label-bug"]}`, render with
`urlState = { filters: parseBoardFilterSearch({ status: "todo" }), carriesFilters: true }`; assert
`renders[0]` (same recorder pattern) is `{ status: ["todo"], priority: null, assignee: null, dueDate: null, labels: null }`
— the URL wins *whole*, it does not merge with stored facets — and then `await waitFor` that
`localStorage` holds `{"status":["todo"],…}` (FR-14).

### 8.4 AC-9 — what is proven and what is only reasoned

**Proven by test:**
- the codec round-trips every facet, so any URL a Back navigation lands on decodes to the filter set
  it encodes (AC-1, A2);
- the hook adopts a *changed* `urlState` after mount rather than staying pinned to its initializer —
  `adopts new URL filters after mount when the search changes` in E3, which rerenders `renderHook`
  with a new `urlState` and asserts `result.current.filters` follows;
- filter changes use `replace: true`, so a run of chip clicks does not create history entries to walk
  back through (AC-8, A6).

**Not proven, and not claimed:** that the browser's real `popstate` and bfcache restoration drive
that path. jsdom does not implement bfcache, and a memory history does not exercise TanStack Router's
browser history integration; a test built on either would assert the same round-trip AC-1 already
covers, dressed up as a history test. **AC-9 is reasoned, not proven.** The final report must say
exactly that. A real browser pass is the only meaningful proof and is out of this run's scope.

### 8.5 Existing tests at risk

| Existing test | Risk | Mitigation |
|---|---|---|
| `use-task-filters-with-labels-support.test.tsx` L16-105 (storage restore) | Hook signature change | The new parameter is the **4th and optional**; the call `useTaskFiltersWithLabelsSupport(project, "project-1")` compiles unchanged. Lazy init makes the restored value available on the first render, so `waitFor` resolves on its first tick. Passes **unmodified**. |
| `use-task-filters-with-labels-support.test.tsx` L107-183 (`it.each` identifier search) | Same | Call is `(project, "project-1", textQuery)` — 4th arg omitted, `urlState` undefined, `readStoredFilters(null-or-empty)` returns `DEFAULT_FILTERS`. Passes **unmodified**. |
| `list-view/task-row.test.tsx` L103-110 | The `useNavigate` mock changes shape | The existing test asserts only rendered labels/PRs and that two query hooks were not called. Swapping `() => vi.fn()` for a shared spy does not touch it. Must still pass. |
| Any test importing `use-task-filters.ts` | — | None exist (the base twin is untested — KD-1). The file is not edited. |
| Any test rendering `board-toolbar.tsx` | Props contract | Hook return shape is unchanged, so `BoardToolbarProps` is satisfied identically. Before starting E1, grep for `board-toolbar` in `*.test.tsx`; if a test exists it must pass untouched. |
| Any test that renders the board route or asserts its search shape | `validateSearch` return shape | None known. The full 112-test run is the check. |

### 8.6 Ordering of verification

`typecheck` after E5 (the ladder in §2), full `test` + `typecheck` after E3 and again after E4, and
`git status --porcelain` after **every** packet (AC-13, NFR-6). Targeted `biome ci` on the 14 changed
paths once, at the end.

---

## 9. Off-limits reminders

The intent brushes against several off-limits paths. Each is called out with the specific way this
plan avoids it:

- **`apps/web/src/hooks/use-task-filters.ts` (KD-1, the base twin).** Not edited. The codec and the
  labels hook take a **type-only** import of `BoardFilters` / `DUE_DATE_FILTER_VALUES` from it — a
  read, not a write. `readStoredFilters` is duplicated *within* the labels hook file rather than
  extracted to a shared module, and `BOARD_FILTER_KEYS` in the codec is a **third** copy of the same
  five strings rather than a shared constant the twins both import. That duplication is deliberate:
  extracting it would drag `use-task-filters.ts` into the change, drift its untested
  `hasActiveFilters` divergence, and violate OOS-6. If a packet proposes touching
  `use-task-filters.ts`, reject it — the file appears in the allowlist but this plan writes nothing
  to it.
- **`apps/web/src/components/board/board-toolbar.tsx`.** Not edited, and there is no justification
  for editing it. Its props (`filters`, `updateFilter`, `updateLabelFilter`, `clearFilters`,
  `hasActiveFilters`) are unchanged by E1. `ActiveFilterChip` and the dropdowns are OOS-1. A diff on
  this file is a planning failure.
- **`apps/web/src/routeTree.gen.ts`.** Generated, off-limits, and must not change (§6.1).
- **`apps/web/src/main.tsx`, `apps/web/src/store/user-preferences.ts`,
  `apps/web/src/components/common/project-layout.tsx`.** Untouched. `viewMode` stays Zustand
  (FR-19) — no attempt to move it into the URL.
- **`backlog.tsx`, `gantt.tsx`, `apps/web/src/components/backlog-list-view/**` (KD-2).** The
  identical whole-search-object bug lives at `backlog.tsx:77`, `gantt.tsx:404`,
  `backlog-task-row.tsx:105`. It is tempting to fix them while adding `withTaskId`; **do not**. They
  are not board-reachable, they are OOS-7, and `backlog-list-view/**` and the backlog/gantt route
  files are off-limits. `withTaskId` is exported and available to them in a future ticket.
- **`package.json` / `pnpm-lock.yaml`.** No new dependency (NFR-1). ADR-1 chooses the option that
  installs nothing; so does the rejected one. Any lockfile diff is a defect.
- **`i18n/en-US.json`.** In the allowlist but not edited — no new user-facing copy (§6.3).
- **`apps/api/**`, `packages/**`, `apps/site/**`, `apps/docs/**`.** Zero contact. This is a
  web-only change.
- **New files under `apps/web/src/hooks/`.** Forbidden by the write contract — this is exactly why
  A5/A6 live under `components/board/`. Do not "correct" their location.

---

## 10. Cross-cutting sequencing

Eight packets. Dependencies are hard; anything listed as parallel is genuinely independent.

| Packet | Files | Depends on | Tier |
|---|---|---|---|
| **P1** | A1 `lib/board-filter-search-params.ts` + A2 its test | — | authoring |
| **P2** | A3 `lib/search-params.ts` + A4 its test | — | surgical |
| **P3** | E1 `hooks/use-task-filters-with-labels-support.ts` | P1 (`areBoardFiltersEqual`, `BoardFilterUrlState` consumes `BoardFilters`) | authoring |
| **P4** | E3 `hooks/use-task-filters-with-labels-support.test.tsx` | P3, P1 | authoring |
| **P5** | A5 `components/board/use-board-filter-url-sync.ts` + A6 its test | P1 (`applyBoardFiltersToSearch`, `toBoardFilterSearchParams`) | authoring |
| **P6** | E5–E8 — the four component nav-site edits | P2 | surgical ×4 |
| **P7** | E4 `components/list-view/task-row.test.tsx` | P6 (specifically E5) | authoring |
| **P8** | E2 `board.tsx` | P1, P2, P3, P5 | authoring |

**Order.** P1 and P2 first and they may run in parallel — nothing else compiles without them. P3 then
P4. P5 any time after P1. P6 any time after P2, with `pnpm --filter @kaneo/web typecheck` run
immediately after E5 to walk the `withTaskId` inference ladder once (§2). P7 after P6. **P8 last** —
`board.tsx` is the only file that imports from all of P1, P2, P3 and P5, so building it earlier
guarantees a red typecheck for no information gain.

**Green-at-each-step.** The suite stays green after every packet except the window between P6 and P7:
P6 changes the nine call sites while the AC-5 tests that describe the new shape do not yet exist —
which is fine, nothing is asserting the old shape. If a packet other than P6→P7 leaves the suite red,
stop and revert rather than pushing forward.

**Mutation check is its own step**, run after P7 and before P8 (§8.2). Record the observed red, then
restore.

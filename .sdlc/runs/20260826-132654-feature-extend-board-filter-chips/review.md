# Code review — URL-persisted board filter state

- **Run:** `20260826-132654-feature-extend-board-filter-chips`
- **Mode:** brownfield · **Intent:** feature-extend · scoped to the 18 files this run touched
- **Reviewed at worktree state:** 8 modified + 10 new, `git HEAD` = `5d1fc910`

---

## 1. Verdict

**Ship with follow-ups.**

Nothing here loses user data, takes the route down, or leaks anything that was not already in the
client's hands. Every defect I found is either a *convergent transient* (wrong value briefly written,
then corrected in the next commit), a *coverage gap*, or an *overstated claim in the paperwork*. The
codec is total and prototype-safe, all nine `navigate()` sites are genuinely fixed and genuinely
mutation-proven, and the verified state you handed me holds up under falsification.

But three of the run's own claims are broader than the evidence supports, and one requirement
(**FR-19**) is mapped to a test that cannot detect the regression it exists to guard. Ship, then fix
§4.1 and §4.2 before this pattern is copied to backlog/gantt (KD-2), because the copy will inherit
the project-switch hazard.

### Falsification results (I re-ran everything you claimed)

| Claim | Result |
|---|---|
| `pnpm --filter @kaneo/web test` → 43 files / 170 tests | **Confirmed.** 43 passed, 170 passed, 0 failed. |
| `pnpm --filter @kaneo/web typecheck` clean | **Confirmed.** Both `tsconfig.app.json` and `tsconfig.node.json`, no output. |
| `biome ci` on 18 paths → exit 0, one pre-existing warning | **Confirmed.** `EXIT=0`, 1 warning, `kanban-board/index.tsx:191` `lint/complexity/useOptionalChain`. |
| That warning is pre-existing and outside every hunk | **Confirmed.** `git show HEAD:...index.tsx` line 190 is byte-identical `if (!project \|\| !project?.columns) {`; it moved to 191 only because the diff adds one import line. |
| All 18 paths inside the 15-glob allowlist, zero violations | **Confirmed.** See §6. |
| The write effect is byte-for-byte unchanged vs HEAD | **Confirmed.** `git diff -U6` shows lines 100-103 as pure context; HEAD has the identical body and the identical dep array `[filters, storageKey]`. |
| `changes.diff` is a faithful record | **Confirmed.** Same 8 tracked files, same hunks as live `git diff`. |
| Out-of-scope files untouched (`board-toolbar.tsx`, `use-task-filters.ts`, `backlog*`, `gantt*`, `routeTree.gen.ts`, `main.tsx`, `package.json`, `i18n/*`) | **Confirmed.** `git status --porcelain` on each returns empty. |

---

## 2. Blockers

**None.**

I went looking for one and did not find it. The three candidates I chased all died:

- **The FR-15 clobber does not cause durable data loss.** Even in the one interleaving where a stale
  write does happen (§4.1), the *correct* value for the target key has already been read into memory
  before the bad write, and the corrective write lands in the very next commit. No path loses a
  stored filter set permanently.
- **The URL↔state sync terminates.** I was worried about an oscillation when `filters` holds a value
  the codec drops (>50 values, >128 chars). It bounds at one wasted `replace`, not a loop, because
  `router-core` applies `nullReplaceEqualDeep(previousMatch.search, preMatchSearch)`
  (`router.js:738`), so a deep-equal re-validation returns the *previous* `search` object identity and
  the effect deps `[filters, search, navigate]` stop changing. Verified in
  `node_modules/.pnpm/@tanstack+router-core@1.171.20/.../dist/esm/router.js`.
- **`validateSearch` cannot throw.** `readBoardSearchParams` wraps a property access that genuinely
  throws on `null`/`undefined` in a `try/catch`, and the inner codec is total. NFR-3 is met.

---

## 3. Non-blocking findings, ranked

### 3.1 — MAJOR · Project switch writes the previous project's filters into the new project's storage key and URL

**File:** `apps/web/src/hooks/use-task-filters-with-labels-support.ts:83-103` and
`apps/web/src/components/board/use-board-filter-url-sync.ts:20-32`

`RouteComponent` **does not remount** when `$projectId` changes. I verified this:
`Matches.js:40` renders `jsx(Match, { routeId })` — keyed by the *static* `routeId`, with no React
key — and `Match.js:76-94` only supplies a remount key when `remountDeps` /
`defaultRemountDeps` is configured. `board.tsx` sets neither, and `main.tsx:45-48` sets only
`defaultPreload` / `defaultPreloadStaleTime`. So switching from project A's board to project B's
board **re-renders the same mounted hook with a new `storageKey`**.

In the commit where `storageKey` flips, effects run in declaration order:

1. Read effect (L83-90): `resolvedStorageKeyRef.current !== storageKey` → sets the ref, queues
   `setFilters(readStoredFilters(B))`. The state update has **not** landed yet.
2. Write effect (L100-103, deps `[filters, storageKey]` — `storageKey` changed, so it runs) closes
   over *this render's* `filters`, which is still **project A's filter set**, and executes
   `localStorage.setItem("kaneo:board-filters:B", JSON.stringify(F_A))`.
3. `useBoardFilterUrlSync` (called after the filter hook in `board.tsx:179`) also sees `filters =
   F_A` against project B's clean `search`, and fires a `navigate({ replace: true })` that writes
   **project A's filters into project B's URL**.
4. The queued `setFilters` flushes → next commit corrects both storage and the URL with a second
   `replace`.

**Why it matters.** It converges, so no durable loss — but between commits there is a real
`localStorage` write of the wrong project's filters, a spurious history `replace`, and a window in
which `urlState` for project B carries project A's facets with `carriesFilters: true`, which the
L92-98 effect will happily adopt into state. The final value is correct, but the intermediate flash
is user-visible on a filtered project switch, and the whole sequence has **zero test coverage**
(§5, AC-2/AC-3 rows).

**Precise fix.** Bind `filters` to the key it was resolved *for*, so no consumer can act on filters
that belong to a different project. Replace the two `useState`/`useRef` declarations with a single
state atom:

```ts
const [state, setState] = useState<{ key: string | null; filters: BoardFilters }>(() => ({
  key: storageKey,
  filters: urlState?.carriesFilters ? urlState.filters : readStoredFilters(storageKey),
}));
const filters = state.key === storageKey ? state.filters : DEFAULT_FILTERS; // or: hold the previous render's value
```

…then have the write effect and `useBoardFilterUrlSync` both no-op while `state.key !== storageKey`.
The minimal variant, if you want to keep the shape: return `resolvedProjectId` from the hook and gate
both the write effect and `useBoardFilterUrlSync` on `resolvedProjectId === projectId`.

**Do not** try to fix this by turning the read effect into `useLayoutEffect`. React flushes pending
passive effects at the start of the next render, so the write effect would still run with stale
`filters`. I checked; it is not a one-word fix.

### 3.2 — MAJOR · Filter state and the URL codec use two different normalisation rules, so state can hold values the URL can never represent

**Files:** `apps/web/src/hooks/use-task-filters-with-labels-support.ts:25-42` (`normalizeFilters`,
unchanged) vs `apps/web/src/lib/board-filter-search-params.ts:25-46` (`normalizeFacetValues`, new).

`normalizeFacetValues` drops empty strings, dedupes, drops values `> MAX_FILTER_VALUE_LENGTH` (128),
and caps at `MAX_FILTER_VALUES` (50). `normalizeFilters` — the localStorage path — does **none** of
those. It only filters non-strings and maps `[]` to `null`.

Consequence: whenever in-memory `filters` holds something the codec drops,
`areBoardFiltersEqual(parseBoardFilterSearch(search), filters)` in `use-board-filter-url-sync.ts:22`
is **permanently false**, and the URL silently under-represents the applied filter. A user who
selects 51 labels sees 51 applied on their own board but shares a link that applies only 50. The
recipient sees a *different* board than the sender. That is the exact failure mode this ticket
exists to prevent.

Reachability is real but uncommon: `toggleLabelGroup` (`board-toolbar.tsx:232-247`) appends
workspace-scoped label ids one at a time with no cap, so a workspace with >50 labels in one
name+colour group gets there. Legacy or hand-edited `localStorage` containing `""` or duplicate
entries gets there immediately.

**Precise fix (cheap and total).** Make the sync guard idempotent under the codec so divergence is
structurally impossible — in `use-board-filter-url-sync.ts:21-24`:

```ts
const current = parseBoardFilterSearch(search);
const representable = parseBoardFilterSearch(toBoardFilterSearchParams(filters));
if (areBoardFiltersEqual(current, representable)) return;
```

That alone stops the wasted navigate and the permanent mismatch signal. To also stop the *silent*
under-representation, either raise `MAX_FILTER_VALUES` above any reachable UI count, or have the
filter hook route its own writes through `normalizeFacetValues` so state and URL agree by
construction.

### 3.3 — MAJOR · `?dueDate=` and `?priority=` accept arbitrary strings; the chip then lies

**File:** `apps/web/src/lib/board-filter-search-params.ts:25-46`

The codec validates *shape*, never *membership*. `dueDate` and `priority` are closed enums
(`DUE_DATE_FILTER_VALUES`; low/medium/high/urgent), but `?dueDate=garbage` parses cleanly into
`filters.dueDate = ["garbage"]`. `filterTasks` then hits the `default: return false` arm
(`use-task-filters-with-labels-support.ts:189-190`) and hides **every** task — including tasks with
no due date, since `noDueDate` was not matched. Meanwhile `board-toolbar.tsx:609-631` renders the
chip through a two-branch ternary whose fallback is `"noDueDate"`, so the UI states
**"Due date · is any of · No due date"** over an empty board. The value is also written straight into
`localStorage`, so it survives the URL being cleaned.

No injection risk — the chip renders an i18n key lookup, not the raw value, and React escapes
regardless. But IS-6 says malformed input "must degrade to the default (empty) filter set", and this
does not.

**Precise fix.** In `normalizeFacetValues`, accept an optional allowlist and pass one for `dueDate`
(`Object.values(DUE_DATE_FILTER_VALUES)`) and `priority`. Leave `status` / `assignee` / `labels`
open — those are project- and workspace-scoped ids that cannot be validated statically.

### 3.4 — MAJOR · New PII egress to Sentry is not in the §6 inventory

**File:** `apps/web/src/instrument.ts` (not touched by this run, and not in the allowlist)

Requirements §6 records the new exposure as "a URL that can be pasted into Slack, a ticket, or a
referrer header". It omits the largest and most *automatic* new sink. `instrument.ts` initialises
`Sentry.browserTracingIntegration()` and `Sentry.replayIntegration()`. Both capture the full URL
including the query string — in `request.url` on every error event, in navigation transaction names
and `http.url`, and in the session-replay timeline. `sendDefaultPii: false` does **not** strip query
parameters; it governs IP/cookie/header capture only.

Before this change `?assignee=<userId>&labels=<labelId>` did not exist. After it, those ids flow to a
third-party endpoint on every sampled transaction (`tracesSampleRate: 0.1`), every sampled replay
(`replaysSessionSampleRate: 0.1`, `replaysOnErrorSampleRate: 1.0`), and every error.

I am deliberately not calling this a blocker: the values are opaque Better Auth user ids
(`schema.ts:415` — `userId: text("assignee_id").references(() => userTable.id)`, not an email),
they are workspace-scoped data the reporting user already holds, and Sentry only initialises when a
DSN is configured, so self-hosters are unaffected by default. But the inventory is **incomplete on
the record**, and that is worth correcting now rather than discovering later.

**Precise fix.** (a) Amend requirements §6 to name the Sentry/replay egress explicitly. (b) Follow-up
packet (needs a write-contract amendment — `instrument.ts` is not allowlisted): add a `beforeSend` /
`beforeSendTransaction` that strips `assignee` and `labels` from `event.request.url` and from
navigation transaction names, plus a replay URL scrubber.

### 3.5 — MINOR · Unexplained `as Parameters<typeof navigate>[0]` cast

**File:** `apps/web/src/components/board/use-board-filter-url-sync.ts:26-31`

The other nine `navigate()` sites needed no cast; this one silences the router's option typing
entirely, so a wrong `to`, a misspelled option, or a misshaped search updater would all compile. The
file has a good `// WHY:`-style comment at the top about its location but none about the cast.

**Fix:** either narrow it (type the updater's `prev` as the route's search type via
`Route.useNavigate()` / `getRouteApi`) or add a comment stating exactly which inference limitation
forces it. An unexplained escape hatch in the one file that owns URL writes is the wrong place for
silence.

### 3.6 — MINOR · `applyBoardFiltersToSearch`'s return type is unsound

**File:** `apps/web/src/lib/board-filter-search-params.ts:111-123`

The function `delete`s the five facet keys from a copy of `prev`, then asserts the result is
`T & BoardFilterSearchParams`. For any `T` that declares a facet as required — e.g.
`{ status: string[] }` — clearing that facet returns an object missing `status` while the type claims
it is present. Harmless today because both callers instantiate `T` as `Record<string, unknown>`,
but it is a lie the compiler will honour for the next caller.

**Fix:** `Omit<T, keyof BoardFilterSearchParams> & BoardFilterSearchParams`.

### 3.7 — MINOR · Render-phase ref mutation

**File:** `apps/web/src/hooks/use-task-filters-with-labels-support.ts:79-80`

`urlStateRef.current = urlState;` executes during render. Under concurrent rendering an abandoned
render can leave the ref holding a value that was never committed. It happens to be safe here
(the ref is only read from an effect, and both are driven by the same router commit), but the
canonical form is to assign inside a `useEffect` with no deps, or to read `urlState` from the effect
closure and add it to the dep array. One line, worth doing while you are in the file for §3.1.

### 3.8 — MINOR · New DRY debt: a third copy of the facet key list

`BOARD_FILTER_KEYS` (`board-filter-search-params.ts:7-13`) is now the third literal copy of the same
five strings, alongside `FILTER_KEYS` in `use-task-filters-with-labels-support.ts:17-23` and the
identical list in the KD-1 twin `use-task-filters.ts`. `DEFAULT_FILTERS` is now re-declared a fourth
time in `board-filter-search-params.test.ts:14-20`. KD-1 covers the two hooks; **this run added the
third**, and did so in the module that is supposed to be the single owner of facet encoding (IS-10).
Whoever eventually reconciles KD-1 now has one more consumer to update.

Also worth noting for that future work: `lib/board-filter-search-params.ts:1` imports `BoardFilters`
from `@/hooks/use-task-filters` — the *untested* twin. It is a type-only import so there is no runtime
coupling, but the new lib module's public contract is now anchored to the file KD-1 declares
out of scope.

### 3.9 — MINOR · `provenance.json` does not record the two edited test files' post-state

`use-task-filters-with-labels-support.test.tsx` and `list-view/task-row.test.tsx` are both recorded
with `"sha_after": null, "written_at": null`, yet both are modified on disk (verified against
`git diff`). An audit or rollback driven from `provenance.json` alone would neither restore nor
verify them. Process defect, not a code defect — but it undercuts the artifact's value as evidence.

---

## 4. Claims I could not verify, or that I believe are overstated

This is the section you asked me to weight most heavily. Four items.

### 4.1 — "FR-15 / KD-3: the clobber is *structurally impossible*" — **OVERSTATED**

The narrow claim is true and I confirmed it: the write effect at L100-103 **is** byte-for-byte
unchanged versus HEAD (deps included), and the lazy `useState` initializer at L75-77 does make it
impossible for `DEFAULT_FILTERS` to be the *first committed value* when storage or the URL has
something. Mutation check **1b** is the right experiment and it lands: restoring the original
`useState(DEFAULT_FILTERS)` + original read effect leaves the `waitFor`-based legacy test green while
turning `never commits the default filter set...` red. That is a genuine structure-vs-ordering
discriminator and it is the strongest single piece of evidence in this run.

But "structurally impossible" is scoped to **constant `storageKey`**, and that scope is nowhere
stated. Every test in `use-task-filters-with-labels-support.test.tsx` passes `"project-1"` — I
grepped, there is no `"project-2"` anywhere in the file — so
`resolvedStorageKeyRef.current !== storageKey` is **never true in any test**, and lines 85-89 (the
entire body of the read effect) are dead in the suite. That effect's only reason to exist is the
case with zero coverage.

And in that uncovered case a stale write demonstrably does occur (§3.1). It is not `DEFAULT_FILTERS`
that leaks — it is the *previous project's* filter set, into the *new* project's key. The honest
formulation is:

> No `DEFAULT_FILTERS` commit can precede URL/storage resolution, for a fixed `projectId`. Across a
> `projectId` change the previous project's filters are transiently written to the new project's key
> and URL before being corrected on the next commit. Untested.

The one thing I will credit fully: I hunted for a *permanent* clobber via a `setFilters` identity
bail-out (where React skips the corrective re-render because `Object.is(filters, resolved)`) and
proved it cannot produce a wrong durable value. In both bail-out branches — `readStoredFilters`
returning the `DEFAULT_FILTERS` module constant, or the URL branch returning the same
`urlState.filters` object already in state — the value the write effect already wrote is the correct
one. So "no durable loss" is a claim I will sign; "structurally impossible" is not.

### 4.2 — "AC-5: 9 of 9 sites behaviorally proven" — **FAIR at the call-site level, but AC-5 is larger than nine sites**

**On the nine sites: the claim is fair, and I tried to break it.**

The pattern is `expect(typeof call.search).toBe("function")` followed by actually invoking
`call.search(prev)` and deep-equalling the result. You asked whether the `typeof` check is a shape
assertion that a wrong-but-function implementation would pass. It would — *on its own*. But it never
stands on its own: every one of the nine is followed by an invocation whose assertion binds the
behaviour. `search: () => ({ taskId })` — a function, wrong — fails
`expect(call.search({ status: ["todo"] })).toEqual({ status: ["todo"], taskId: "task-2" })`. Mutation
check 3 proves exactly this by deleting `...prev` from `withTaskId` and watching 4 tests go red while
the shape checks would still have passed. So: not tautological. The `typeof` line is the
pre-fix-detector; the invocation is the correctness assertion. Both are load-bearing.

Mutation check 4 (all nine reverted → exactly 9 red, 161 green, 5 files failed) is consistent with a
clean 1:1 site↔test mapping, and I mapped all nine by hand: board close-sheet, task-card open,
task-card close, kanban `j`, kanban `k`, task-row open, task-row close, list-view `j`, list-view `k`.
Nine distinct handlers, nine distinct tests, `vi.clearAllMocks()` in every `afterEach`, fresh renders.

Two honest caveats:

- **The promised one-sided mutation was not run.** `change_plan.md:576-579` specifies "Revert
  `kanban-board/index.tsx` L67 only (leave L74) → the `j` test RED, the `k` test GREEN. This
  one-sided mutation proves the two tests are independent and neither is passing by accident."
  `mutation-check.txt` contains checks 1, 1b, 2, 3, 4 — **not** that one. Reverting all nine at once
  and counting 9 red does not discriminate independence the way the planned experiment would have.
  I believe the tests *are* independent (I read them), but the run should say "argued", not "proven",
  or spend the 30 seconds to run the planned mutation.
- **`prev` is supplied by the test, never by the router.** Every one of the nine asserts what the
  updater does with a synthetic `prev`. That TanStack actually hands the current validated search to
  the updater is assumed, not tested. I verified it independently in `router-core`
  (`router.js:314`, `functionalUpdate(nextSearch, fromSearch)` then
  `nullReplaceEqualDeep(fromSearch, nextSearch)`), so the assumption is correct — but it is correct
  by my reading of `node_modules`, not by anything in the repo.

**Where the claim is genuinely overstated: AC-5 has a fifth clause and it is not covered.**

AC-5 reads "open-task, close-task, `j`/`k`, **and board↔list switch**." FR-19 is explicit about why
the last one needs a test: *"IS-5's view-switch clause must still be covered by a test, because the
reason it is safe is an implementation detail that a future refactor can invalidate."*

`change_plan.md:421` maps that clause to the test `keeps filter state across a project data
re-render`. That test rerenders the hook with a **new `project` object and the same `projectId`**,
then asserts `result.current.filters` still `toEqual` the previous value. That is not a view switch.
A view switch does not change *any* input to the hook — `viewMode` is Zustand state read by
`RouteComponent`, and the hook's `project` / `projectId` / `textQuery` / `urlState` are all
unchanged. The mapped test perturbs something the hook has no effect keyed on, so it can only fail if
someone adds a `project`-keyed reset — and it would still pass in the exact world FR-19 is guarding
against, where a refactor moves the filter hook down into `KanbanBoard` / `ListView` and the state
dies on unmount. I searched: `viewMode` appears in the changed tests only as a frozen
`"board"` literal in `board-route-search-preservation.test.tsx:118`, never toggled.

So the accurate statement is: **"9 of 9 navigation call sites behaviorally proven and
mutation-checked; AC-5's view-switch clause (FR-19) is unproven, and the test it is mapped to cannot
detect the regression it exists to catch."**

The fix is small: in `board-route-search-preservation.test.tsx`, make the
`useUserPreferencesStore` mock return a mutable `viewMode`, render, flip it to `"list"`, rerender,
and assert the `useTaskFiltersWithLabelsSupport` mock was not re-initialised (or better — drop that
mock for this one test and assert the real hook's filters survive the child swap).

### 4.3 — "AC-9 Back is reasoned, not proven" — **the honesty framing is right; the reasoning has a gap worth disclosing**

Reporting AC-9 as reasoned-not-proven is correct and I am not asking you to upgrade it. jsdom cannot
exercise popstate/bfcache and the run does not pretend otherwise.

But the *reasoning* rests on an unstated asymmetry that should be on the record. The hook's URL→state
effect (L92-98) treats `carriesFilters === false` as **"no information"**, not as **"no filters"** —
it early-returns and leaves state untouched. Meanwhile `useBoardFilterUrlSync` sees the mismatch and
immediately `replace`s the filters back into the address bar. Net effect: **once state holds filters,
a history entry that carries none cannot survive.** Back onto such an entry would appear to do
nothing.

Today that is unreachable, and for a good reason worth writing down: every filter-driven URL write is
`replace: true` (IS-8), and after this run every board-reachable *push* preserves filters (FR-17). So
no history entry with fewer filters than current state can be produced. The reasoning holds — but it
holds *because of* the nine fixes plus `replace`, not because the sync is symmetric. The moment
KD-2's backlog/gantt sites are fixed by copying this pattern, or anyone adds a push that clears
filters, AC-9 breaks silently and no test in this suite will notice.

Please add that to the AC-9 note. It is a one-sentence disclosure that turns a correct-but-fragile
claim into a correct-and-understood one.

I did also confirm the ADR-3 mount rewrite **terminates**, which was worth checking: mount with
stored filters and a clean URL → `urlSync` fires one `replace` → new `search` → hook's L92-98 effect
calls `setFilters(prev => equal ? prev : urlFilters)` → equal → React bails out, no re-render → the
`urlSync` effect re-runs once on the changed `search`, finds `areBoardFiltersEqual` true, returns.
Two effect passes, one navigation, fixed point. I traced your three sequences (clean URL + stored
filters; URL filters + different stored filters; clearing the last filter) and all three converge in
at most two navigations with no oscillation.

### 4.4 — `board-route-search-preservation.test.tsx`: what the mocking costs — **it is real, but it is narrower than it looks**

You flagged this as the riskiest file. **It is not hollowed out.** The mocked `createFileRoute`
returns `{ ...options, useParams, useSearch }`, so `Route.component` is the genuine, unexported
`RouteComponent`; the `TaskDetailsSheet` stub renders a real button wired to the real `onClose`; and
clicking it invokes the real `handleCloseTaskSheet` from `board.tsx:98-104`. The `as unknown as
{ component: ComponentType }` cast at line 132 is test-only, is explained by a comment, and does not
weaken the assertion. Site 1 is honestly proven.

What the mocks cost, plainly — **two route-level seams have zero coverage anywhere in the suite:**

1. **`urlState` is never checked.** `useTaskFiltersWithLabelsSupport` is mocked (L95-110), so the
   `useMemo` at `board.tsx:161-168` that builds
   `{ filters: parseBoardFilterSearch(search), carriesFilters: searchCarriesBoardFilters(search) }`
   is executed but never observed. The hook tests pass `urlState` in directly; the route test
   replaces the hook. **Delete the fourth argument at `board.tsx:176` and the whole feature stops
   working, and every one of the 170 tests still passes.** That is the single largest coverage hole
   in the run.
2. **`useBoardFilterUrlSync` is mocked to a no-op** (L32-34), so the call at `board.tsx:179` and its
   arguments are unverified. Same failure mode: delete the call, suite stays green.
3. Minor: `Route.validateSearch` is reachable on the mocked route object but never invoked, so the
   `validateSearch: readBoardSearchParams` wiring is verified only by typecheck. That one I am
   relaxed about — it is a single identifier.

**Fix for 1 and 2 (cheap, high value):** in the same file, replace the two `vi.mock` factories with
`vi.fn()` spies and assert on the arguments — that
`useTaskFiltersWithLabelsSupport` received a 4th argument equal to
`{ filters: { status: ["todo"], ... }, carriesFilters: true }` given the stubbed
`useSearch: () => ({ status: ["todo"], taskId: "task-1" })`, and that `useBoardFilterUrlSync` was
called with `(filters, search)`. Two assertions, no new file, and they close the only seam where the
feature can be silently deleted.

### 4.5 — Two smaller claims

- **`readBoardSearchParams`'s `try/catch` is not dead code**, but it is nearly so. It is genuinely
  reachable: `null` and `undefined` throw on the `source.taskId` property access at line 130, and the
  `HOSTILE_INPUTS` table exercises both. It is *unreachable from the router*, which always hands
  `validateSearch` a parsed object. So: belt-and-braces for the direct-call contract (FR-1's
  totality), load-bearing for the tests, never hit in production. Label it as such in a comment —
  and note the small risk that it would also silently swallow a genuine future defect inside
  `parseBoardFilterSearch`, dropping the user's `taskId` with no signal.
- **`applyBoardFiltersToSearch` does produce a clean URL.** The `delete`-then-spread is correct:
  all five facet keys are removed from the copy, then only non-empty facets are re-added, so
  `?status=&priority=` is unreachable (IS-7). `taskId: undefined` survives as an own key but
  TanStack's `stringifySearch` omits undefined. Also confirmed prototype-safe: `Object.hasOwn`
  gating at line 52 blocks inherited reads, object spread uses `CreateDataProperty` so a literal
  `__proto__` own key cannot re-parent the result, and the test at line 118 asserts
  `Object.prototype` stays clean. One line: fine.

---

## 5. Test quality per acceptance criterion

| AC | Mapped test | Verdict | Note |
|---|---|---|---|
| **AC-1** round-trip all 5 facets, multi-value | `board-filter-search-params.test.ts:41` | **Real proof** | serialize→parse over all five with a 3-value facet. |
| **AC-2** URL beats non-empty storage, then syncs down | `use-task-filters-with-labels-support.test.tsx` "applies URL filters over stored filters…" | **Real proof** | Recorder asserts the *first* commit, plus `waitFor` on `localStorage`. Mutation-checked twice (1 and 1b). Does not cover the `projectId`-change path (§3.1). |
| **AC-3** no URL params → restore storage, existing test unmodified | pre-existing L16-105 test | **Real proof** | Diff confirms additions only; no existing assertion touched. |
| **AC-4** `?status=` is not "carries filters" | codec predicate ×3 + hook "restores stored filters when the URL carries only an empty facet" | **Real proof** | Both layers. |
| **AC-5** open / close / `j` / `k` | 9 tests across 5 files | **Real proof** | Mutation checks 2, 3, 4. See §4.2 for the `prev`-is-synthetic caveat. |
| **AC-5** board↔list switch (FR-19) | `keeps filter state across a project data re-render` | **Absent** | Mapped test perturbs `project`, not the view. Cannot fail in the world FR-19 guards. See §4.2. |
| **AC-6** `validateSearch` never throws | `it.each(HOSTILE_INPUTS)` ×2 (9 inputs each) | **Real proof** | Covers null, undefined, number, string, array, `{}`, nested, numeric facet, `__proto__`. Over-long values covered separately at line 71. Tests the codec, not `Route.validateSearch` — acceptable, the wiring is one identifier. |
| **AC-7** no active filters ⇒ zero filter keys | `toBoardFilterSearchParams` zero-keys + `applyBoardFiltersToSearch` + urlSync `Object.keys(next)` | **Real proof** | Three angles including an exact-key-set assertion. |
| **AC-8** `replace: true` | `use-board-filter-url-sync.test.tsx:34`, `board-route-…:141` | **Weak proof** | Only the *add-a-filter* path asserts `replace`. The clear-last-filter test (L48-59) does not. One extra `expect(call.replace).toBe(true)` closes it. |
| **AC-9** Back across a task-open boundary | — | **Absent, and correctly declared absent** | Reasoned-not-proven is the right call. Reasoning gap disclosed in §4.3. |
| **AC-10** 112 pre-existing pass, count increases | full suite | **Real proof** | I re-ran: 43 files / 170 tests, 0 failures. |
| **AC-11** typecheck clean | `tsc --noEmit` ×2 | **Real proof** | I re-ran: clean. |
| **AC-12** `biome ci` on exactly the changed paths | targeted run | **Real proof** | I re-ran: exit 0, 1 pre-existing warning, confirmed identical at HEAD. |
| **AC-13** only allowlisted paths | `git status --porcelain` | **Real proof** | I re-ran: 18 paths, 0 violations. |
| **FR-13/FR-15** across a `projectId` change | — | **Absent** | No test varies `projectId`; hook lines 85-89 are dead in the suite. §3.1, §4.1. |
| **Route→hook `urlState` wiring** | — | **Absent** | Deleting `board.tsx:176`'s 4th argument leaves the suite green. §4.4. |
| **Route→`useBoardFilterUrlSync` wiring** | — | **Absent** | Deleting `board.tsx:179` leaves the suite green. §4.4. |

---

## 6. Scope audit

18 paths changed. Every one matches an allowlist glob. **Zero out-of-scope edits, zero unrequested
cleanup.** I read all eight tracked diffs end to end looking for opportunistic changes and found
none — the four component diffs are import-plus-one-line-per-site and nothing else, and the two
edited test files are pure appends.

| File | Change | Allowlist glob | Verdict |
|---|---|---|---|
| `apps/web/src/lib/board-filter-search-params.ts` | new | `apps/web/src/lib/**` | in-scope |
| `apps/web/src/lib/board-filter-search-params.test.ts` | new | `apps/web/src/lib/**` | in-scope |
| `apps/web/src/lib/search-params.ts` | new | `apps/web/src/lib/**` | in-scope |
| `apps/web/src/lib/search-params.test.ts` | new | `apps/web/src/lib/**` | in-scope |
| `apps/web/src/components/board/use-board-filter-url-sync.ts` | new | `components/board/**` | in-scope (disclosed deviation: a hook outside `hooks/`) |
| `apps/web/src/components/board/use-board-filter-url-sync.test.tsx` | new | `components/board/**` | in-scope |
| `apps/web/src/components/board/task-card-search-preservation.test.tsx` | new | `components/board/**` | in-scope (disclosed deviation: imports `../kanban-board/task-card`) |
| `apps/web/src/components/board/board-route-search-preservation.test.tsx` | new | `components/board/**` | in-scope (disclosed deviation: imports across `../../routes/…`) |
| `apps/web/src/components/kanban-board/index.test.tsx` | new | explicit (Gate 2 amendment) | in-scope |
| `apps/web/src/components/list-view/index.test.tsx` | new | explicit (Gate 2 amendment) | in-scope |
| `apps/web/src/components/kanban-board/index.tsx` | +1 import, 2 sites | explicit | in-scope, minimal |
| `apps/web/src/components/kanban-board/task-card.tsx` | +1 import, 2 sites | explicit | in-scope, minimal |
| `apps/web/src/components/list-view/index.tsx` | +1 import, 2 sites | explicit | in-scope, minimal |
| `apps/web/src/components/list-view/task-row.tsx` | +1 import, 2 sites | explicit | in-scope, minimal |
| `apps/web/src/components/list-view/task-row.test.tsx` | spy + 2 appended tests | explicit | in-scope, existing bodies untouched |
| `apps/web/src/hooks/use-task-filters-with-labels-support.ts` | read effect replaced, 2 effects added, write effect untouched | explicit | in-scope |
| `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` | fixture + 5 appended tests | explicit | in-scope, existing bodies untouched |
| `.../project/$projectId/board.tsx` | validator swap, `urlState` memo, sync call, 1 site | explicit | in-scope |

**Confirmed untouched** (`git status --porcelain` empty for each): `components/board/board-toolbar.tsx`
(chips — zero diff, OOS-1 held), `hooks/use-task-filters.ts` (KD-1 twin), `routes/.../backlog.tsx`,
`routes/.../gantt.tsx`, `components/backlog-list-view/backlog-task-row.tsx` (KD-2),
`apps/web/src/routeTree.gen.ts`, `apps/web/src/main.tsx`, `apps/web/package.json`, `i18n/**`.

Two observations, neither a finding against this run:

- `.claude/settings.local.json` and `.hook-logs/` are untracked in the worktree and both appear on
  the write contract's `off_limits` list. They are **not** in `provenance.json` and were present
  before this run's first file write, so they are pre-existing tooling artifacts, not violations.
- `i18n/en-US.json` was allowlisted but correctly never needed — the chips already existed and the
  run added no user-facing copy, exactly as requirements §1 predicted.

---

## 7. Recommended follow-up packets

Ordered by value per unit of risk.

1. **Close the two route-wiring seams** (§4.4). Two assertions in
   `board-route-search-preservation.test.tsx`. Highest value in the list: it is currently possible to
   delete the feature's two integration points and keep a green suite.
2. **Fix the project-switch reconciliation** (§3.1) and add the first test that varies `projectId`.
   Also retires the dead-in-suite read-effect body.
3. **Make the URL-sync guard idempotent under the codec** (§3.2). Three lines in
   `use-board-filter-url-sync.ts`.
4. **Cover AC-5's view-switch clause for real** (§4.2 / FR-19), and correct the AC↔test map in
   `change_plan.md:421`.
5. **Enum-validate `dueDate` and `priority` in the codec** (§3.3).
6. **Amend requirements §6 to name the Sentry egress**, and open a separate packet (needs a
   write-contract amendment for `apps/web/src/instrument.ts`) for the URL scrubber (§3.4).
7. **Amend the three overstated claims** in the final report: FR-15's scope (§4.1), AC-5's fifth
   clause (§4.2), AC-9's asymmetry (§4.3). Also either run the planned one-sided kanban mutation or
   downgrade "proven independent" to "argued independent".
8. Housekeeping: the `Parameters<typeof navigate>[0]` cast comment (§3.5), the
   `applyBoardFiltersToSearch` return type (§3.6), the render-phase ref write (§3.7), and the
   `provenance.json` gap (§3.9).

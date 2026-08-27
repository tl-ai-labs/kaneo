# Delta Requirements — URL-persisted board filter state

- **Run:** `20260826-132654-feature-extend-board-filter-chips`
- **Intent:** `feature-extend`
- **Mode:** brownfield · **Policy:** `opus-plus-sonnet-max` · **Auth mode:** `estimated`
- **Baseline (green, captured before any codegen):** `pnpm --filter @kaneo/web test` → 36 files / 112 tests passed. Typecheck captured in the same pass.
- **Rollback anchor:** `5d1fc910`

This is a *delta* requirements document. It states only what changes. Everything not named here
is required to keep behaving exactly as it does at `5d1fc910`.

---

## 1. What already exists (do not rebuild)

These are verified facts about the repo at the rollback anchor. They are stated here so that no
downstream phase re-derives them, and so that "already exists" is never mistaken for "missing".

| Capability | Where | Status |
|---|---|---|
| Filter chips for all five facets | `apps/web/src/components/board/board-toolbar.tsx` — `ActiveFilterChip` at L78-108, rendered at L534 (status), L560 (priority), L585 (assignee), L610 (dueDate), L635 (labels) | **Exists. Out of scope to change.** |
| i18n copy for the chips | `tasks:boardFilters.*` in `i18n/en-US.json` | **Exists. No new keys expected.** |
| Filter state + matching semantics | `apps/web/src/hooks/use-task-filters-with-labels-support.ts` (the hook the board uses) | **Exists. Semantics frozen.** |
| Per-project persistence | `localStorage`, key `` `kaneo:board-filters:${projectId}` `` — read effect at L52-67, write effect at L69-72 | **Exists. Must keep working.** |
| Route search state | `board.tsx:24-35` — `type BoardSearchParams = { taskId?: string }`, hand-rolled `validateSearch` | **Exists. This is what the delta extends.** |

The only missing capability is **URL persistence**. This ticket adds exactly that.

---

## 2. In scope (numbered, testable)

1. **IS-1** — The board route's search params carry all five filter facets: `status`, `priority`,
   `assignee`, `dueDate`, `labels`. Each is a multi-value facet (`string[] | null`) in the domain
   model and must survive a full round trip URL → state → URL.
2. **IS-2** — A shared/bookmarked board URL carrying filter params applies exactly those filters on
   load, regardless of what is in `localStorage` for that project, then writes them to that
   project's `localStorage` key.
3. **IS-3** — A board URL carrying **no** filter params restores from `localStorage`, exactly as
   today.
4. **IS-4** — An **empty** filter param (`?status=`, `?labels=`) is not "the URL carries filters".
   It must fall through to the `localStorage` restore path of IS-3.
5. **IS-5** — Filter state survives every in-app navigation reachable from the board route: opening
   a task, closing a task, `j`/`k` task focus in both views, and switching between board and list
   view.
6. **IS-6** — `validateSearch` never throws. Malformed, hostile, `null`, `undefined`, wrong-typed,
   or over-long input degrades to the default (empty) filter set.
7. **IS-7** — With no active filters the URL is clean: no empty filter params, no `?status=&priority=`
   noise.
8. **IS-8** — Changing a filter does not push a history entry (uses `replace`), so Back does not
   walk backwards one filter click at a time.
9. **IS-9** — Browser Back across a *navigational* boundary (opening a task, then Back) restores the
   filter state that URL carried.
10. **IS-10** — A serializer/parser module under `apps/web/src/lib/**` owns filter ⇄ search-param
    encoding, with its own unit tests. The route and the hook both consume it; neither re-implements
    encoding inline.

## 3. Out of scope (numbered)

1. **OOS-1** — Redesigning, restyling, or rebuilding `ActiveFilterChip`, the filter dropdown, or any
   part of `board-toolbar.tsx`'s UI.
2. **OOS-2** — New filter facets, or changing what any existing facet matches (notably: assignee
   filters on `task.userId`, not `assigneeId` — this is pre-existing and stays).
3. **OOS-3** — URL persistence on `backlog`, `gantt`, or any other route.
4. **OOS-4** — Any API, database, schema, migration, or server change. `apps/api/**` is off-limits.
5. **OOS-5** — Router construction (`main.tsx`) or app-wide search encoding.
6. **OOS-6** — **Reconciling the two near-duplicate hooks.** `use-task-filters.ts` and
   `use-task-filters-with-labels-support.ts` copy-paste `DEFAULT_FILTERS`, `FILTER_KEYS`,
   `normalizeFilters`, both storage effects, `clearFilters`, `updateFilter`, `updateLabelFilter`.
   They diverge in exactly one place — `hasActiveFilters` treats `[]` as inactive in the labels
   version and active in the base version. **Recorded here as a known defect; deliberately not
   fixed.** See §8 KD-1.
7. **OOS-7** — The identical whole-search-object-replacement bug class on `backlog.tsx:77`,
   `gantt.tsx:404`, `backlog-task-row.tsx:105`. Not board-reachable. See §8 KD-2.
8. **OOS-8** — Cross-tab sync of filter state, or migrating off `localStorage`.

---

## 4. Functional requirements

### Module: search-param codec (`apps/web/src/lib/**`) — new

- **FR-1** — Expose a parse function: `unknown` search record → `BoardFilters`. Total: never throws
  for any input, including `null`, `undefined`, arrays, nested objects, numbers, and strings
  containing delimiter characters.
- **FR-2** — Expose a serialize function: `BoardFilters` → a partial search record containing a key
  **only** for facets with at least one value. A facet that is `null` or `[]` contributes no key
  (satisfies IS-7).
- **FR-3** — Expose a predicate: does a given raw search record carry at least one *non-empty*
  filter facet? An empty-string value, an empty array, and an array of only empty strings all
  answer **false** (satisfies IS-4).
- **FR-4** — Encoding must round-trip: `parse(serialize(f))` deep-equals `normalize(f)` for every
  `BoardFilters` reachable from the UI, including facets with multiple values.
- **FR-5** — Parsing must accept both the shape TanStack Router hands a validator for a repeated
  key (`?a=1&a=2` → `string[]`) and a single occurrence (`?a=1` → `string`), normalising both to
  `string[]`.
- **FR-6** — Values must survive URL-encoding of characters that appear in real label ids, user
  ids, and status slugs. Empty segments are dropped, not preserved as `""`.
- **FR-7** — Parsing must be bounded: an absurd number of values for one facet, or an absurdly long
  single value, must not be propagated into filter state unbounded (hostile-input requirement of
  IS-6).

### Module: board route (`board.tsx`) — edit

- **FR-8** — `BoardSearchParams` gains the five filter facets alongside `taskId`. `validateSearch`
  delegates facet parsing to the FR-1 parser and keeps the existing `taskId` behavior byte-for-byte.
- **FR-9** — `validateSearch` is wrapped so that *no* input can make it throw (IS-6). Wrapping is
  required regardless of whether zod or a hand-rolled validator is chosen; a zod `.parse()` that
  throws takes the route down, so `safeParse`/`catch` semantics are mandatory.
- **FR-10** — `handleCloseTaskSheet` must preserve filter params while clearing `taskId`. It must
  not pass a literal `search: {}`.
- **FR-11** — The route feeds URL filters into the filter hook and writes hook changes back to the
  URL with `replace: true` (IS-8).

### Module: filter hook (`use-task-filters-with-labels-support.ts`) — edit

- **FR-12** — The hook accepts the URL-derived filter state and a way to publish changes back, in a
  manner that keeps its current call signature working for any other caller. (The hook is currently
  called from exactly one place — `board.tsx:166` — but its exported surface is public.)
- **FR-13** — **Precedence on load:** if the URL carries filters (FR-3 predicate true), those win;
  the hook must *not* let the `localStorage` read effect overwrite them.
- **FR-14** — **Sync-down:** when the URL wins, the resolved filters are written to that project's
  `localStorage` key.
- **FR-15** — **The unconditional write effect at L69-72 is the clobber risk.** It currently writes
  `JSON.stringify(filters)` on *every* render where `filters` changed, including the initial
  `DEFAULT_FILTERS` render that happens before any URL or storage resolution. Effect ordering must
  guarantee it can never write the default set over a URL-supplied or stored set. This must be
  proven by a test, not by inspection.
- **FR-16** — Filter matching semantics (`filterTasks`), `hasActiveFilters`, `clearFilters`,
  `updateFilter`, `updateLabelFilter` behavior are unchanged as observed by callers.

### Module: navigation call sites — edit

- **FR-17** — All nine board-reachable `navigate()` sites that today replace the whole search object
  must preserve unrelated search params. Each must use TanStack's updater form
  `search: (prev) => ({ ...prev, taskId })` (or an equivalent that provably preserves `prev`):

  | # | File | Line(s) | Today |
  |---|---|---|---|
  | 1 | `routes/.../board.tsx` | 97-101 | `search: {}`, `replace: true` |
  | 2 | `components/kanban-board/task-card.tsx` | 149-152 | `search: {}` |
  | 3 | `components/kanban-board/task-card.tsx` | 153-157 | `search: { taskId }` |
  | 4 | `components/kanban-board/index.tsx` | 67 | `search: { taskId }` (`j`) |
  | 5 | `components/kanban-board/index.tsx` | 74 | `search: { taskId }` (`k`) |
  | 6 | `components/list-view/task-row.tsx` | 148-151 | `search: {}` |
  | 7 | `components/list-view/task-row.tsx` | 152-156 | `search: { taskId }` |
  | 8 | `components/list-view/index.tsx` | 97 | `search: { taskId }` (`j`) |
  | 9 | `components/list-view/index.tsx` | 104 | `search: { taskId }` (`k`) |

- **FR-18** — Sites 2-9 live in components shared with other routes. The updater form must not break
  those routes' search params either; it strictly widens what is preserved, so this is a
  compatibility requirement to *verify*, not a behavior to add.

### Module: view switching

- **FR-19** — `viewMode` is Zustand state (`useUserPreferencesStore`), not routing state. Switching
  board↔list does not navigate, so filters cannot be dropped by a URL write — but the two child
  trees unmount/remount around a hook that stays mounted. IS-5's view-switch clause must still be
  covered by a test, because the *reason* it is safe is an implementation detail that a future
  refactor can invalidate.

---

## 5. Non-functional requirements

- **NFR-1** — No new runtime dependency. `zod` (as `zod/v4`) is already a direct dependency of
  `apps/web` and is already used as a `validateSearch` value on five routes; using it adds no
  install. A hand-rolled validator is also an established idiom on five routes including
  `board.tsx` itself. **The choice is genuinely open and must be justified in `change_plan.md`,
  not assumed.**
- **NFR-2** — `validateSearch` runs on every navigation to the route. Parsing must be O(values) and
  allocation-light; no regex backtracking, no JSON parsing of user-controlled strings.
- **NFR-3** — Availability: a throwing `validateSearch` renders the route unusable and is
  unrecoverable by the user without editing the URL. Treat non-throwing as a **hard** requirement,
  not a nicety.
- **NFR-4** — Verification is `pnpm --filter @kaneo/web test` and `pnpm --filter @kaneo/web typecheck`.
  `pnpm lint` / `biome check --write` must **not** be run — it rewrites unrelated files. Targeted
  `biome ci <changed paths>` only.
- **NFR-5** — All 112 existing tests keep passing. Net test count must go up.
- **NFR-6** — Changed files stay within the 13-glob allowlist. `git status --porcelain` is checked
  after every dispatch and anything out of scope is reverted and reported.

---

## 6. PII inventory

The board filter surface is client-side only and adds no new data flow. This ticket does, however,
move data that was previously local into a **shareable** URL. That is a real (if small) change in
exposure and is recorded honestly:

| Field | What it is | Sensitivity | New exposure introduced by this ticket | Protection |
|---|---|---|---|---|
| `assignee` values | `task.userId` — opaque user ids | Low–moderate: an internal identifier, not a name or email | **Yes.** Previously only in `localStorage`; now in a URL that can be pasted into Slack, a ticket, or a referrer header | Ids only, never names/emails/avatars. No change to what the API returns. Accepted by the user at Gate 0 as inherent to "shareable filtered board". |
| `labels` values | Workspace label ids | Low | Yes, same mechanism | Ids only. Label *names* are resolved client-side from workspace data the viewer is already authorized for. |
| `status`, `priority`, `dueDate` values | Enum-ish slugs (`todo`, `high`, `dueThisWeek`) | None | Yes, but they carry no user data | — |
| `taskId` | Already in the URL today | — | None (pre-existing) | — |
| Board text search (`boardSearchQuery`) | Free text the user typed | Would be moderate — free text can contain anything | **Not added to the URL.** Deliberately excluded; it is component state (`board.tsx:86`) and outside the five facets. | Left as-is. |

**Authorization is unaffected.** A filter param is a *display* filter over data the viewer already
fetched. Pasting a filtered URL to an unauthorized user grants them nothing: the route sits behind
`_authenticated`, and `useGetTasks` enforces workspace scope server-side. A recipient without access
sees the same 403/empty state they see today. This must be re-confirmed by the security review, not
taken on this document's word.

## 7. Role matrix

No role, permission, or authorization surface changes. `@kaneo/permissions` is untouched, no API
middleware changes, no new endpoint.

| Role | Resource | Action | Before | After |
|---|---|---|---|---|
| any workspace member | board filter params | read/write own URL | client-side only | client-side only, unchanged |
| non-member | a shared filtered board URL | open | blocked by `_authenticated` + API workspace scope | **unchanged** — filters do not bypass any check |

## 8. Known defects found and deliberately NOT fixed

Recorded per the brief's "note them if found; leave them" instruction. Each must also appear in the
final report.

- **KD-1** — `use-task-filters.ts` and `use-task-filters-with-labels-support.ts` are ~90%
  copy-paste duplicates that diverge in one behavior: `hasActiveFilters` treats an empty array as
  *inactive* in the labels version (`Array.isArray(f) ? f.length > 0 : f !== null`) and as *active*
  in the base version. The base twin is also untested. Whichever way this run touches the labels
  version, the base twin will drift further. **Not fixed** (OOS-6).
- **KD-2** — The whole-search-object-replacement bug class also exists at `backlog.tsx:77`,
  `gantt.tsx:404`, `backlog-task-row.tsx:105`. Those routes have no URL filter state today so
  nothing is lost yet, but they will be wrong the moment they gain any. **Not fixed** (OOS-7).
- **KD-3** — The `localStorage` write effect (labels hook L69-72) is unconditional and runs on the
  very first render with `DEFAULT_FILTERS`. Today that is harmless because the read effect runs in
  the same commit and wins on the next. Once URL state is added it becomes an ordering hazard. This
  one **is in scope** to make safe (FR-15) — listed here because the underlying "write on every
  change, unconditionally" design is left in place rather than replaced.

## 9. Acceptance criteria (executable)

Each maps to at least one test. AC-5 is the criterion the brief flags as most likely to regress and
is the one that must be **mutation-checked**: revert the fix, watch the test fail, restore it.

| # | Criterion | Proof |
|---|---|---|
| **AC-1** | Each of the five facets round-trips URL → filter state → URL, including multi-value | codec unit tests |
| **AC-2** | URL with filter params beats non-empty `localStorage`; resolved filters are then written to `localStorage` | hook test seeding both |
| **AC-3** | URL with no filter params restores `localStorage` (today's behavior) | hook test — the existing L16-105 test must still pass unmodified |
| **AC-4** | `?status=` (empty) does **not** count as "URL carries filters"; `localStorage` still restores | dedicated hook test + codec predicate test |
| **AC-5** | Filters survive open-task, close-task, `j`/`k`, and board↔list switch | test that **fails** against the pre-fix `search: {}` code and passes after |
| **AC-6** | `validateSearch` returns defaults for `null`, `undefined`, `{}`, arrays, numbers, nested objects, `__proto__`-style keys, and over-long values — never throws | table-driven route/codec test |
| **AC-7** | No active filters ⇒ serialized search record has no filter keys at all | codec unit test asserting exact key set |
| **AC-8** | Filter change uses `replace: true` — no history entry per interaction | assert the navigate options passed |
| **AC-9** | Back across a task-open boundary restores that URL's filters | covered by AC-5's preservation test plus AC-1 round-trip; a full history test is only meaningful in a browser and is **not** claimed as unit-tested |
| **AC-10** | All 112 pre-existing tests pass unchanged; total test count increases | `pnpm --filter @kaneo/web test` |
| **AC-11** | `pnpm --filter @kaneo/web typecheck` clean | typecheck |
| **AC-12** | `biome ci` clean on exactly the changed paths, verified by reading the exit code and output — not asserted from memory | targeted `biome ci` |
| **AC-13** | `git status --porcelain` shows only allowlisted paths | after every dispatch |

**Honesty note on AC-9.** jsdom + a memory history can simulate Back, but it does not exercise the
browser's real bfcache/popstate behavior. If the run cannot prove AC-9 with a test that would
actually catch a regression, the final report must say AC-9 is *reasoned, not proven*, rather than
claiming a green test that only re-asserts AC-1.

## 10. Open questions for HITL

1. **Validator idiom (zod vs hand-rolled) is left to the pipeline** per Gate 0, and will be decided
   and justified in `change_plan.md` at Gate 2. Flagging it here so the reviewer knows it is coming
   rather than being surprised by it.
2. **URL param naming.** The plan will use bare facet names (`?status=todo&priority=high`) rather
   than a namespaced form (`?f_status=`) or a single packed param (`?filters=...`). Bare names are
   the most shareable and most readable, and collide with nothing on this route (only `taskId`
   exists). Raise it at Gate 2 if a namespaced form is preferred — it is cheap to change now and
   expensive later, because shared links become a compatibility surface the moment the feature ships.
3. **`?assignee=` exposes user ids in shareable links** (§6). Confirmed acceptable at Gate 0 as
   inherent to the feature, but called out explicitly here so the decision is on the record and not
   buried.

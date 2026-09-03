# Code review — per-column WIP limit with over-cap indicator

- Run: `20260903-094517-feature-extend-column-wip-limit`
- Mode: brownfield · Intent: `feature-extend` · Scope: the 18 files in `provenance.json`
- Reviewer: senior code review pass (read-only; no source file was modified)
- Repo HEAD at review: `5d1fc9104337786c3ef295ec0dc31656df371d8d`, worktree dirty with the run's changes

---

## 1. Verdict

**`approve-with-nits`** — every acceptance criterion is implemented as designed, the migration is
additive and production-safe, authorization is byte-identical to HEAD, scope is contained, and both
targeted suites pass; the defects found are one false invariant in `change_plan.md` §8 (the
indicator *can* mislead, in both directions, in windows §8 never enumerated), one mis-named
regression test that does not actually guard the thing it names, and required post-run i18n
maintenance that CI will not catch.

No blocking defect. Six non-blocking findings, one of which (N-1, filtered task counts) is a
product decision a human should make before this ships.

---

## 2. Blocking defects

**None.**

I considered and rejected two candidates for blocking status:

- *Filtered/searched task counts feeding the cap comparison* (see N-1). Rejected as blocking
  because the implementation matches the approved `change_plan.md` exactly, the count semantics are
  unchanged from HEAD, and the feature is advisory-only by requirement (§2.1 of
  `requirements.md`). It is a design gap, not a coding error — so it belongs to the human who
  approved the plan, not to a refinement packet dispatched over the implementer's head.
- *Cross-client staleness of `wipLimit`* (see N-2). Rejected as blocking for the same reason, plus
  it self-heals on window focus.

---

## 3. Non-blocking nits

### N-1 (optional, **major** — read this one first). The over-cap comparison uses the *filtered* task count, so board filters and search silently suppress a true alarm and can display a falsely calm `n/limit`.

- `apps/web/src/components/kanban-board/column/column-header.tsx:34` — `const taskCount = column.tasks.length;`
- The `column` prop is not the server's column. Trace:
  `.../project/$projectId/board.tsx:166` builds `filteredProject` via
  `useTaskFiltersWithLabelsSupport(project, projectId, boardSearchQuery)`;
  `board.tsx:168-176` derives `sortedProject` from it; `board.tsx:238-239` passes `sortedProject`
  into `<KanbanBoard project={...}>`; `kanban-board/index.tsx:254-259` maps `project.columns` into
  `<Column>`; `kanban-board/column/index.tsx:23` passes that same object to `<ColumnHeader>`.
  `apps/web/src/hooks/use-task-filters-with-labels-support.ts:188` rebuilds `columns[].tasks` as a
  filtered subset — its own test at
  `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx:101` asserts
  `filteredProject?.columns[0]?.tasks` shrinks to length 1.
- Consequence: a column holding 8 tasks with `wipLimit: 5` renders `8/5` + alert with no filters,
  but renders a calm grey `3/5` the moment the user filters by assignee, priority, label, or types
  in board search (Cmd-F). The WIP limit is the one indicator whose whole purpose is to be
  impossible to miss, and a routine filter turns it off.
- Direction analysis: filters and search only ever *remove* tasks, so this can never manufacture a
  **false alarm** — only false reassurance. That asymmetry is why this is a nit and not a blocker.
- Note the badge is not internally dishonest — it shows the number of cards actually rendered — so
  "leave as-is and document" is a legitimate resolution. The choice is product, not engineering.

Refinement TaskPacket spec (dispatch only if the human wants the behavior changed):

```
task_type: code-change
instruction: |
  In apps/web/src/components/kanban-board/column/column-header.tsx, stop comparing a
  filter-narrowed task count against the WIP limit. Choose ONE of:
  (a) suppress the limit portion of the badge while board filters or search are active — render
      today's bare filtered count and no alert; or
  (b) source an unfiltered per-column count for the comparison.
  Option (a) is strongly preferred: it needs no new data source, no API change, and no write-
  contract amendment. It does require plumbing an `isFiltered` signal from the board route
  (hasActiveFilters || boardSearchQuery !== "") down through KanbanBoard -> Column ->
  ColumnHeader, or reading the unfiltered project from useProjectStore and comparing lengths.
  Prefer the latter: useProjectStore already holds the UNFILTERED project on this page
  (board.tsx:123-125 setProject(data) stores the raw query result), so
  `useProjectStore().project?.columns.find(c => c.slug === column.slug)?.tasks.length` is the
  true count and requires no prop drilling.
  Add a static i18n key only if new copy is introduced; do not touch i18n/schema.json.
inputs:
  - apps/web/src/components/kanban-board/column/column-header.tsx
  - apps/web/src/components/kanban-board/column/column-header.test.tsx
  - apps/web/src/hooks/use-task-filters-with-labels-support.ts (read-only reference)
  - apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx (read-only reference)
acceptance:
  - A column with 8 tasks, wipLimit 5, and a filter that hides 5 of them still renders the
    over-cap indicator (new test case in column-header.test.tsx).
  - The three existing indicator states (no limit / under cap / over cap) still pass unchanged.
  - The boundary case (count === limit is NOT over cap) still passes.
  - pnpm --filter @kaneo/web exec vitest run column-header passes.
  - pnpm --filter @kaneo/web typecheck passes.
  - No file outside the run's existing write-contract allowlist is modified.
```

### N-2 (optional, minor). `change_plan.md` §8.2 asserts an invariant the code does not hold: a false over-cap alarm *can* render, and can persist indefinitely.

- §8.2 concludes: *"The system never renders a false over-cap alarm and never renders a stale limit
  against a matched slug."* Every window W1–W7 it enumerates assumes the limit only ever changes
  through **this client's own mutation**, which invalidates `["columns", projectId]`.
- The code has no such guarantee. `apps/web/src/hooks/queries/task/use-get-tasks.ts:8` sets
  `refetchInterval: 30000` — the **count** self-refreshes every 30 seconds. `use-get-columns.ts:4-9`
  has **no** `refetchInterval` — the **limit** does not. There is no realtime path either:
  `grep -rn "publishEvent" apps/api/src/column/` returns nothing and there are no column events in
  `apps/api/src/ws/`, so another user's limit change never reaches an open board.
- Concrete false alarm: column has 6 tasks and `wipLimit: 5`. User A raises the limit to 10 in
  project settings. User B's board is open and focused. B's tasks query keeps polling; B's columns
  cache stays at 5. B sees a red `6/5` over-cap alarm for a column that is, in fact, under its cap —
  until B blurs and refocuses the tab (TanStack's default `refetchOnWindowFocus`) or remounts.
  The mirror case (A *lowers* the limit) suppresses a true alarm just as long.
- Practical severity is low: advisory-only feature, self-heals on focus, single-user self-hosted
  instances are unaffected. But the plan's stated invariant is the justification for the whole
  uncoordinated two-query design, and it is false as written. It should be corrected so the next
  reader does not build on it.

Refinement TaskPacket spec:

```
task_type: doc-change
instruction: |
  Amend .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md §8.2 to add the
  windows the enumeration missed, and soften the §8.2 closing invariant from "never renders a
  false over-cap alarm" to a scoped claim:
    W8 — the limit is changed by ANOTHER client. useGetTasks polls every 30s
         (use-get-tasks.ts:8); useGetColumns does not poll and there is no column event or
         WebSocket fan-out (no publishEvent in apps/api/src/column/). A limit raised elsewhere
         leaves this client showing a red false alarm until refetchOnWindowFocus or remount.
         Mirror case: a limit lowered elsewhere suppresses a true alarm for the same duration.
    W9 — the board's column.tasks is the FILTER- and SEARCH-narrowed list, not the column's true
         contents (see review N-1). Direction is one-way: it can only hide a true alarm, never
         create a false one.
    W10 — optimistic drag-and-drop mutates useProjectStore before the server confirms
         (kanban-board/index.tsx:186 setProject). A failed move shows a transient alarm until the
         ["tasks", projectId] refetch corrects it.
  Restate the invariant as: "within a single client, between that client's own mutations, the
  indicator is correct; across clients it is eventually consistent on window focus."
  Do not change any source file.
inputs:
  - .sdlc/runs/20260903-094517-feature-extend-column-wip-limit/change_plan.md
acceptance:
  - §8.2 lists W8, W9 and W10 with file:line evidence.
  - The unqualified "never renders a false over-cap alarm" sentence is gone.
  - No file outside .sdlc/runs/<run-id>/** is modified.
```

### N-3 (optional, minor). The `|| vs ??` regression test does not exercise the difference it is named for.

- `tests/api/column/create-column-wip-limit.test.ts:93` —
  `it("sets wipLimit to 1 when wipLimit is 1 (regression guard for || vs ??)")`.
- `1 || null === 1` and `1 ?? null === 1`. The test passes identically against the buggy idiom. The
  only inputs that discriminate are `0` and `NaN`; `0` is exactly the value the route rejects
  (`v.minValue(1)`), so the distinction is currently unobservable end-to-end.
- The `??` at `apps/api/src/column/controllers/create-column.ts:79` is still the right call — the
  controller is a directly-callable domain function (MCP, scripts, future callers do not have to
  come through the Valibot route), and `??` documents intent. The *test* is what is misleading: a
  future reader will trust a guard that is not there.
- Fix: either call the controller directly with `wipLimit: 0` and assert `values` receives `0` (a
  real discriminator, and legitimate at the controller boundary since the controller does not
  itself validate range), or rename the case to `"passes wipLimit 1 through unchanged"` and drop
  the `|| vs ??` claim.

```
task_type: test-change
instruction: |
  In tests/api/column/create-column-wip-limit.test.ts, make the "|| vs ??" case actually
  discriminate. Add a case that calls createColumn({ projectId, name, wipLimit: 0 }) directly and
  asserts insertChain.values received wipLimit === 0 (NOT null) — this fails under `wipLimit ||
  null` and passes under `wipLimit ?? null`. Add a one-line comment stating that 0 is unreachable
  through the route validator and is exercised here only to pin the controller's null-coalescing
  idiom. Rename the existing wipLimit:1 case to drop the inaccurate "|| vs ??" claim.
inputs:
  - tests/api/column/create-column-wip-limit.test.ts
  - apps/api/src/column/controllers/create-column.ts (read-only reference)
acceptance:
  - The new case fails if create-column.ts:79 is changed to `wipLimit || null`.
  - pnpm --filter @kaneo/api exec vitest run --config vitest.config.ts wip-limit passes.
  - No existing test case is deleted.
```

### N-4 (optional, minor). `i18n/schema.json` and the 16 non-English locales are now stale. CI will not catch it; a maintainer must run one command post-merge.

- `i18n/schema.json` is generated by `scripts/i18n/schema.mjs` from `en-US.json` with
  `additionalProperties: false` and `required: Object.keys(...)` at every level.
  `grep -c wipLimit i18n/schema.json` → `0`. The schema no longer describes the reference locale.
- `pnpm i18n:check` (`scripts/i18n/check.mjs`) diffs every locale against `en-US.json` and will now
  report 8 missing keys × 16 locales. This is the accepted OQ-3 outcome, not a defect.
- Neither `i18n:schema` nor `i18n:check` is wired into any workflow in `.github/workflows/`
  (`ci.yml:79` runs `pnpm test` only), so nothing breaks — which is precisely why it will be
  forgotten.
- **Required post-run step for a human (out of this run's allowlist, correctly not done here):**
  `pnpm i18n:schema`, then commit the regenerated `i18n/schema.json` alongside this change. The
  translation pass for the 16 locales is a separate, already-accepted follow-up.

### N-5 (optional, minor). `type="number"` turns "type garbage" into "clear the limit" instead of "revert".

- `apps/web/src/components/project/column-editor.tsx:97-114`. The revert branch
  (`input.value = current === null ? "" : String(current)`) is well written and correctly ordered,
  but browsers sanitize an unparseable value in an `<input type="number">` to `""` before
  `onBlur` reads it. So a user who types `abc` over an existing limit of `5` hits
  `trimmed === ""` → `next = null` → the limit is silently **cleared** and a "WIP limit cleared"
  toast fires, when the user's intent was neither.
- Low impact (a number input makes non-numeric entry awkward in the first place, and the outcome is
  reversible and announced by a toast), and the guard still correctly catches the values that *do*
  survive sanitization (`0`, `-1`, `2.5` → revert). Left as a nit deliberately: the alternative
  (tracking "was the raw entry empty" via `validity.badInput`) adds a branch for a rare case.
- If addressed: `if (input.validity.badInput) { revert; return; }` before the empty-string check
  is a one-line, well-supported fix.

### N-6 (optional, trivial). Duplicated `t()` call and a slightly overstated NFR-4 justification.

- `column-header.tsx:84-87` and `:100-103` construct the identical
  `t("tasks:kanban.wipLimitOverCap", { taskCount, limit: wipLimit })` twice (once for `title`, once
  for the `sr-only` span). Hoisting to a `const overCapLabel` above the JSX would be marginally
  DRYer. Not worth a packet on its own; fold into N-1 if that is dispatched.
- `requirements.md` NFR-4 claims `useGetColumns` is *"a cached TanStack query already resident in
  this page's tree."* On the board it is not: the other call sites
  (`task-status-popover.tsx:31`, `task-properties-sidebar.tsx:90`, `task-subtasks.tsx:70`,
  `subtask-status-popover.tsx:33`, `task-card-context-menu-content.tsx:52`, `column-editor.tsx:31`,
  `workflow-editor.tsx:28`) all mount inside a task sheet, a context menu, or project settings —
  none of which is mounted on a cold board load. So this change does add exactly **one** new
  `GET /column/:projectId` per board page load. That is one small cached request against a
  workspace-scoped, index-backed single-table select, shared by all N column headers via the
  `["columns", projectId]` key — genuinely negligible, and NFR-4's *substance* (no N+1, no
  per-render call, no per-column request) holds. Only the stated justification is inaccurate.

---

## 4. Risk audit

### Risk 1 — the two-query sourcing decision; is there a false-alarm or missed-flicker path?

**Checked:** the full data path for both inputs, and §8.2's W1–W7 against the code.
**Evidence:** count path `board.tsx:166 → :168 → :238 → kanban-board/index.tsx:254 →
column/index.tsx:23 → column-header.tsx:34`; limit path `column-header.tsx:31-33` →
`use-get-columns.ts:4-9`; polling asymmetry `use-get-tasks.ts:8` (`refetchInterval: 30000`) vs
`use-get-columns.ts` (none); no realtime path (`grep -rn publishEvent apps/api/src/column/` → none;
no column entries in `apps/api/src/ws/`).

**FAIL (advisory).** §8's argument is sound *for the windows it enumerates* — W1–W7 all check out
against the code, and W5's claim about TanStack keeping `data` populated through a background
refetch is correct, so there is genuinely no null→value→null oscillation. But the enumeration is
incomplete on its own terms, because it only reasons about limit changes that originate in the
rendering client:

- **A false over-cap alarm can render, and can persist indefinitely** (N-2 / W8): another user
  raises a limit; there is no event, no WebSocket, and no polling on `["columns", projectId]`, so
  this client pairs a 30-second-fresh count with an arbitrarily old limit. Self-heals only on
  window focus or remount.
- **A flicker path §8 missed** (W10): optimistic drag-and-drop writes the store before the server
  confirms (`kanban-board/index.tsx:186`), so a *failed* move shows a transient alarm until the
  `["tasks", projectId]` refetch corrects it. Harmless and short, but it is a real value→value
  transition the "single monotonic reveal" framing does not cover.
- **The count is not the column's count** (N-1 / W9): it is the filtered, searched, sorted count.

W4's layout shift is real but minor: on a cold columns cache the badge widens once from `3` to
`3/5`, plus icon if over cap. FR-27 says "no layout shift"; strictly that is not met, but it is a
single monotonic reveal on first paint, exactly as §8.2 W4 describes and accepts.

Slug matching, key alignment and null-safety in the join are all correct — see Risk 2.

### Risk 2 — slug vs id

**Checked:** both sides of the `find`.
**Evidence:** `apps/api/src/task/controllers/get-tasks.ts:224-229` builds the board's column as
`{ id: column.slug, slug: column.slug, name, icon, isFinal, tasks }` — `id` really is the slug.
`apps/api/src/column/controllers/get-columns.ts:6-10` is `db.select()` over the whole row, so
`useGetColumns` rows carry the cuid `id` **and** `slug`. `column-header.tsx:33` matches
`entry.slug === column.slug`.

**PASS.** Matching on `slug` is correct and the only correct choice. Two supporting details also
check out: (a) `update-column.ts:24-34` never recomputes `slug` on rename, so the join key is
stable across a rename — §8.2 W6's "slug changes" window cannot actually occur through the update
route, making the design safer than the plan assumed; (b) the query key is right —
`column-header.tsx:31` passes `project?.id`, and `get-tasks.ts:257` returns `id: project.id` (the
real project id, looked up by `eq(projectTable.id, projectId)` at `:73`), which is the same value
the board route passes to `useGetTasks` and the editor passes to `useUpdateColumn`. So the board's
`["columns", projectId]` cache entry is the *same* entry the editor's mutation invalidates. Had
this used `project.slug`, the invalidation in AC-5 would have silently missed.

The `?? null` at `column-header.tsx:33` correctly collapses all three miss cases (query loading,
slug absent, `wipLimit` null) to "no limit" — the fallback FR-27 asks for.

### Risk 3 — strict boundary (`count > limit`, not `>=`)

**Checked:** component and test.
**Evidence:** `column-header.tsx:35` — `const isOverCap = wipLimit !== null && taskCount > wipLimit;`
Test `column-header.test.tsx:94-103` — `"renders count and limit without over-cap indicator when
exactly at limit"`, 5 tasks / limit 5, asserts `getByText("5/5")` visible and
`queryByText("tasks:kanban.wipLimitOverCap")` is null. `:105-114` covers 6 / 5 as over cap.

**PASS.** Strict comparison in the code, and the boundary is pinned by a dedicated test on both
sides. Also correct that `wipLimit !== null` (not truthiness) guards the comparison — a `0` limit
is impossible via validation, but the null check is the honest one either way.

### Risk 4 — `??` vs `||` in `create-column.ts`

**Checked:** the line and the test that claims to guard it.
**Evidence:** `apps/api/src/column/controllers/create-column.ts:79` — `wipLimit: wipLimit ?? null`,
sitting directly beneath `icon: icon || null` (`:76`) and `color: color || null` (`:77`). The
distinct idiom is correct and deliberate.

**PASS on the code, FAIL on the test.** The test named as the guard
(`tests/api/column/create-column-wip-limit.test.ts:93`) uses `wipLimit: 1`, and `1 || null === 1`,
so it passes identically against the buggy idiom. It guards nothing. See N-3 for the fix. The
omission case (`:71-91`, asserts `wipLimit: null` when the argument is absent) is a genuine and
useful assertion; it just is not the `||`/`??` discriminator either (`undefined || null` and
`undefined ?? null` both yield `null`).

### Risk 5 — Valibot correctness

**Checked:** both schemas, all four rejection values, and the omitted-vs-null distinction.
**Evidence:** create `apps/api/src/column/index.ts:63` —
`v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)))`; update `:141-143` —
`v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))))`. Both match FR-5/FR-6 and
mirror the neighbouring `icon`/`color` optional-vs-optional-nullable convention exactly (`:60-62`
vs `:137-140`). Runtime proof: `pnpm --filter @kaneo/api exec vitest run --config vitest.config.ts
wip-limit` → **3 files / 14 tests passed** in 1.12s, covering POST `0` → 400 (`:62`), `-1` → 400
(`:73`), `2.5` → 400 (`:84`), `"5"` → 400 (`:95`), valid `5` → 200 + controller called (`:36`),
omitted → 200 (`:49`), PUT `null` → 200 with `{ wipLimit: null }` (`:106`), PUT `0` → 400 (`:119`).
Each rejection case also asserts the controller was **not** called, which is the assertion that
actually proves the validator ran before the handler.

**PASS.** On "does `v.optional(v.nullable(...))` really express omitted ≠ null here": yes, and the
guarantee does not even depend on Valibot's key-presence behavior for missing optionals. Vitest's
`toHaveBeenCalledWith` uses `toEqual` semantics, which ignore `undefined`-valued properties, so
`wip-limit-validation.test.ts:114` cannot by itself distinguish "key absent" from "key present and
undefined". The distinction is instead pinned where it matters — at the controller, by
`update-column.ts:31`'s `...(data.wipLimit !== undefined && { wipLimit: data.wipLimit })` spread,
proven by `update-column-wip-limit.test.ts:82-96`, which asserts `"wipLimit" in setArg === false`
after an omitted-field update. `in` on the spread result is exactly the right assertion: it is the
only one that fails if the spread guard is dropped. Belt and braces, correctly placed.

One weak assertion worth knowing about, not worth fixing:
`wip-limit-validation.test.ts:57-59` uses `expect.objectContaining({ wipLimit: undefined })`, which
is satisfied trivially because `index.ts:70-78` always writes the `wipLimit` key into the object
literal it passes to `createColumn`. It cannot fail. Harmless.

### Risk 6 — authorization unchanged

**Checked:** every middleware line on every touched route, and the untouched routes in the same file.
**Evidence:** `git diff apps/api/src/column/index.ts` → **6 insertions, 1 deletion**, in exactly
three hunks: the POST validator field (`:63`), the POST handler's destructure + call
(`:70`, `:77`), and the PUT validator field (`:141-143`). Every `workspaceAccess.*` and
`requireWorkspacePermission` line appears as unchanged **context** in the diff, in its original
position and order: POST = `validator("param") → validator("json") → workspaceAccess.fromProject
("projectId") → requireWorkspacePermission({ project: ["update"] }) → handler` (`:55-68`);
PUT = `validator("param") → validator("json") → workspaceAccess.fromColumn("id") →
requireWorkspacePermission({ project: ["update"] }) → handler` (`:133-148`). `GET /:projectId`
(`:32-33`), `PUT /reorder/:projectId` (`:97-110`) and `DELETE /:id` (`:170-172`) are untouched
entirely.

**PASS.** No middleware moved, was reordered, or was removed. No new permission verb; no change to
`@kaneo/permissions`. The ordering detail that matters is preserved: validators run before the
access middleware, so a malformed body still 400s before any workspace lookup — unchanged from
HEAD, and confirmed at runtime by the eight route tests, which mock the middleware to a pass-through
and still observe 400s from the validator alone.

Two supporting checks: `describeRoute` metadata is untouched and remains accurate (both routes
still declare a 200 with `resolver(v.any())`, so FR-9's "does not regress" holds); and no new
`HTTPException` site was introduced (FR-7) — `create-column.ts` and `update-column.ts` still throw
only their pre-existing 400/409/404/500.

### Risk 7 — `use-update-column.ts` `onSuccess` preserved verbatim

**Checked:** the diff and the resulting file.
**Evidence:** `git diff apps/web/src/hooks/mutations/column/use-update-column.ts` shows exactly one
added line — `wipLimit?: number | null;` at `:19`, inside the `data` type. The `onSuccess` body is
untouched context. Final file `:22-33`: `Promise.all([invalidateQueries({ queryKey: ["columns",
variables.projectId], refetchType: "all" }), invalidateQueries({ queryKey: ["tasks",
variables.projectId], refetchType: "all" })])`.

**PASS.** Both keys, both with `refetchType: "all"`, still awaited together. AC-5 is satisfied by
non-intervention exactly as FR-16 intended. Cross-checked that the invalidation actually reaches the
board: the editor passes `projectId` (the route param = real project id) into the mutation, and the
board's two consumers subscribe to `["tasks", projectId]` (`use-get-tasks.ts:6`) and — now —
`["columns", projectId]` (`column-header.tsx:31` via `project.id`, same value). So setting a limit
in settings does update an open board without a reload, within that client.

### Risk 8 — the column-editor `onBlur` handler

**Checked:** DOM-before-await ordering, the `Number("")` trap, the revert path, the no-op return,
and `defaultValue` staleness.
**Evidence:** `apps/web/src/components/project/column-editor.tsx:97-114`.

**PASS with one caveat (N-5).** Line by line:

- **DOM-before-await ordering — correct.** `const input = e.currentTarget` (`:98`) captures the
  element synchronously, and every read (`input.value`, `:100`) and write (`input.value = ...`,
  `:107`) happens before any `await`. `handleUpdateWipLimit` (`:113`) is called *last*, un-awaited,
  and touches no DOM afterwards. So the classic React `currentTarget`-is-null-after-await hazard
  cannot fire here. The floating promise is safe because `handleUpdateWipLimit` (`:103-118`) wraps
  its own `try/catch` and cannot reject — no unhandled rejection, no swallowed error (failure
  surfaces as `toast.error` with the server message). This also matches the established local
  pattern: the rename input at `:65-69` calls `handleRename` the same un-awaited way.
- **Empty-string-before-`Number()` — correct.** `:101` is
  `const next = trimmed === "" ? null : Number(trimmed);`. The `""` case is intercepted *before*
  `Number` is reached, so the `Number("") === 0` trap never fires. Had these been reversed, clearing
  the field would have attempted `wipLimit: 0` and eaten a 400.
- **Invalid → revert — correct.** `:103-109`: `next !== null && !(Number.isInteger(next) &&
  next >= 1)` catches `NaN` (`Number.isInteger(NaN)` is `false`), `0`, `-1`, `2.5`, and restores the
  persisted value into the uncontrolled DOM node before returning. `null` is explicitly excluded
  from the guard so a genuine clear passes through. No request is issued for invalid input, so the
  API never sees a value its validator would reject — the client and server rules agree exactly
  (`>= 1`, integer).
- **No-op early return — correct.** `:111` `if (next === current) return;` — both sides are
  normalized to `number | null` (`:99` `col.wipLimit ?? null`), so `===` is a sound comparison and
  blurring an untouched field issues no mutation and no toast.
- **Caveat:** browser sanitization of `type="number"` makes "type garbage" indistinguishable from
  "clear". See N-5.
- **Uncontrolled `defaultValue` after refetch — acceptable, and consistent with HEAD.** `:90`
  `defaultValue={col.wipLimit ?? ""}` is uncontrolled, so React will not push a changed
  `col.wipLimit` into the DOM node on re-render. After a *successful* mutation the DOM already
  holds the value the user typed, which is what the refetch returns — no divergence. After a
  *failed* mutation, the DOM keeps the rejected value while `col.wipLimit` still holds the old one;
  the only signal is the error toast. Same for a change made by another user. This is exactly the
  behavior of the pre-existing rename input (`:62` `defaultValue={col.name}`), so it is local
  convention rather than a regression, and the row is keyed by `key={col.id}` (`:229`) — which is
  the detail that actually matters here, since `ColumnEditor` supports drag reorder and an
  index-based key would have re-associated DOM state with the wrong column on every reorder. It is
  correct.

### Risk 9 — migration safety

**Checked:** the SQL, the snapshot, and the journal chain.
**Evidence:** `apps/api/drizzle/0043_gifted_lizard.sql` is a single statement, no trailing newline:
`ALTER TABLE "column" ADD COLUMN "wip_limit" integer;` — no `NOT NULL`, no `DEFAULT`, no backfill,
no `DROP`, no index, no constraint. `apps/api/drizzle/meta/0043_snapshot.json:926-931` records
`wip_limit` as `"type": "integer", "primaryKey": false, "notNull": false`. Chain integrity:
`0043_snapshot.json` `prevId` `9f67f0d6-…` === `0042_snapshot.json` `id` `9f67f0d6-…`.
`_journal.json` gains exactly one appended entry (`idx: 43`, `version: "7"`, tag
`0043_gifted_lizard`), leaving entries 0–42 untouched.

**PASS.** This is correct for a populated production database, not just an empty dev one. On
PostgreSQL 11+, `ADD COLUMN` that is nullable with no default is a metadata-only catalog update: no
table rewrite, no full-table scan, and only a brief `ACCESS EXCLUSIVE` lock — safe on a large
`column` table (which in practice holds a handful of rows per project anyway). Existing rows read
back `NULL` → `wipLimit: null` → `column-header.tsx:70` renders the bare-count branch, byte-identical
to HEAD's markup at `:71-73`. FR-3 and AC-1 hold. Also correct that `relations.ts` was not touched
(FR-4) — `wipLimit` is a scalar.

### Risk 10 — i18n

**Checked:** key count, staticness, namespace placement, interpolation-variable agreement, and the
`schema.json` consequence.
**Evidence:** exactly 8 new keys in `i18n/en-US.json`, 6 under `settings.columnEditor`
(`wipLimit`, `wipLimitPlaceholder`, `wipLimitTooltip`, `wipLimitAria`, `toastWipLimitUpdated`,
`toastWipLimitCleared`) and 2 under `tasks.kanban` (`wipLimitTitle`, `wipLimitOverCap`) — matching
FR-29's requirement to reuse the namespaces the two touched components already use. Every `t()` call
site uses a string literal: `column-header.tsx:85,89,101`, `column-editor.tsx:80,83,91,92,108,109`.
No template literal, no variable, no computed key path anywhere.

**PASS, with the post-run step in N-4.** Interpolation variables agree with call sites in all four
interpolated keys: `"WIP limit: {{taskCount}} of {{limit}}"` / `"Over WIP limit: {{taskCount}} of
{{limit}}"` are called with `{ taskCount, limit: wipLimit }` (`:84-91`, `:100-103`), and
`"WIP limit for {{name}}"` is called with `{ name: col.name }` (`:92-94`) — the same shape as the
adjacent pre-existing `markDoneAria`. Copy reads correctly for an advisory feature: the tooltip
`"Advisory limit on tasks in this column. Leave empty for no limit."` states both the
indicate-only semantics and how to clear, and `toastWipLimitCleared` vs `toastWipLimitUpdated` are
correctly selected by `wipLimit === null` (`:107-110`).

As flagged (not fixed) per instruction: `i18n/schema.json` is `additionalProperties: false` with
`required` at every level, generated by `pnpm i18n:schema` (`package.json:12` →
`scripts/i18n/schema.mjs:5-16`), and is deliberately outside the allowlist. It is now stale
(`grep -c wipLimit i18n/schema.json` → `0`). **Regenerating it with `pnpm i18n:schema` is a required
post-run step.** Nothing in `.github/workflows/` runs `i18n:schema` or `i18n:check`, so this will
not fail CI — it will just quietly drift. The 16 non-English locales missing the keys is the
accepted OQ-3 outcome; i18next falls back to English.

### Risk 11 — test quality, not test count

**Checked:** what each assertion would actually catch, and whether the `t` stub degrades the web
assertions.
**Evidence:** `pnpm --filter @kaneo/api exec vitest run --config vitest.config.ts wip-limit` →
3 files / 14 tests passed (1.12s). `pnpm --filter @kaneo/web exec vitest run column-header` →
1 file / 7 tests passed (1.58s).

**PASS, with N-3 as the one exception.**

*Does the API route test assert status codes rather than body shape?* **Yes — correctly.** Every
case in `wip-limit-validation.test.ts` asserts `res.status` (`:43, :56, :69, :80, :91, :102, :113,
:126`) and never inspects the response body. Each rejection case pairs the 400 with
`expect(mockCreateColumn).not.toHaveBeenCalled()` / `not.toHaveBeenCalled()` for update, which is
the assertion that proves the validator short-circuited rather than the controller happening to
throw. That is the right shape for a validator test: it survives any future change to the error
envelope, and it would fail immediately if the `minValue(1)`, `integer()` or `number()` pipe step
were dropped. The controller tests are correctly separated into their own files with their own `db`
mocks, and assert on the argument passed to `.values()` / `.set()` — implementation-coupled by
necessity (there is no other observable for a mocked DB), but coupled to the *contract* (what is
written) rather than to call ordering or chain internals.

*Does the `t: (key) => key` stub make the over-cap assertion meaningful?* **Yes, though narrowly.**
`column-header.test.tsx:41` stubs `t` to return the key. The over-cap assertion
(`:113` `getByText("tasks:kanban.wipLimitOverCap")`) is meaningful because the two branches use
**different keys** — over cap renders `wipLimitOverCap`, under cap renders `wipLimitTitle` (`:84`
vs `:88`) — so the assertion genuinely discriminates the branch and is not a tautology. It
specifically pins the `sr-only` element (`:98-105`), because `title` is an attribute and not
matched by `getByText`; that means the test is really asserting *"the indicator has an accessible
name from a static key"*, which is exactly FR-25/AC-4. What the stub cannot prove is that the
interpolation is wired up — `{{taskCount}}` / `{{limit}}` are never rendered, so a typo'd
interpolation variable would sail through. Low value to fix, and the `getByText("6/5")` assertion
already pins the numbers that users actually read.

Would these catch a regression? Concretely: flipping `>` to `>=` fails `:94-103`; dropping the
`slug` match in favor of `id` fails `:128-138` (the "slug not found" case, which is the one that
would silently pass under an `id`-based match given the fixture uses `id === slug`… and note the
fixture at `:46-47` sets both to `"in-progress"`, so an `id`-based match would *not* be caught —
a small blind spot, mitigated by the fact that the mocked `useGetColumns` rows at `:73, :85, :107`
supply only `slug` and `wipLimit`, so an `id`-based lookup would find `undefined` and fail every
limit test); removing the `?? null` fallback fails `:116-126` (loading) and `:128-138` (miss);
regressing the bare-count branch fails `:71-81`. The suite also pins the query argument
(`:140-148`, `toHaveBeenCalledWith("project-1")`), which is what would catch a future slip from
`project.id` to `project.slug` — the mistake that would silently break AC-5's invalidation. That is
a well-chosen assertion.

The seven web cases cover FR-32's three required states plus the boundary, the loading fallback, the
slug-miss fallback, and the query argument. No existing test was modified or deleted (FR-33) — the
four new files are all additions, confirmed against `provenance.json` (`existed_before` is
irrelevant for them; none appears in `git status` as ` M`).

### Risk 12 — scope containment

**Checked:** `provenance.json` against `git status --porcelain`, and each off-limits path.
**Evidence:** `provenance.json` lists **18** `files_touched` across packets `tp_cg_001`–`tp_cg_010`
and `tp_test_001`–`tp_test_004`. `git status --porcelain` shows 12 ` M` + 4 `??` source files =
the same 18 paths, exactly. Off-limits verification: no `AGENTS.md`, no `CLAUDE.md`, no `.cursor/**`,
no `.github/**`, no `.env*`, no `i18n/schema.json`, no non-English locale (only `i18n/en-US.json`
appears), no `apps/web/src/components/public-project/**`, no `apps/site/**`, no `charts/**`, no
`packages/mcp/**`, and no migration `0000`–`0042` (`_journal.json` gained one appended entry and
nothing else — the diff is a pure 7-line addition). `apps/web/src/components/board/**` (the second
board implementation) is untouched, per requirements §2.3.

**PASS.** AC-8 holds.

Two observations that are *not* scope violations but should not be swept into a commit:
`.claude/settings.local.json` and `.hook-logs/` appear as untracked in `git status` but are **absent
from `provenance.json`** — they are local harness artifacts, not products of this run. They were
already present in the worktree at review start. Whoever commits this must stage the 18 provenance
paths explicitly rather than `git add -A`, or those two plus `.sdlc/` will ride along.

---

## 5. AC traceability

| AC | Claim | Proven where | Verdict |
| --- | --- | --- | --- |
| **AC-1** | `wipLimit` nullable; migration adds `wip_limit integer` with no `NOT NULL` / `DEFAULT` / `DROP`; pre-existing columns read back `null` and render as before | `apps/api/src/database/schema.ts:360`; `apps/api/drizzle/0043_gifted_lizard.sql:1` (single statement); `apps/api/drizzle/meta/0043_snapshot.json:926-931` (`notNull: false`); `_journal.json` idx 43 appended; render fallback `column-header.tsx:70-73` + test `column-header.test.tsx:71-81` | **PASS** (read-back on a real populated DB not executed — see §6) |
| **AC-2** | POST `5` persists; `0`/`-1`/`2.5`/`"5"` → 400; PUT `null` clears; omitted leaves untouched; middleware byte-identical | `wip-limit-validation.test.ts:36-128` (8 cases, all status-code assertions, all passing); `update-column-wip-limit.test.ts:50-96` (`set` receives `5`, receives `null`, omits the key); `create-column.ts:79`; `git diff apps/api/src/column/index.ts` = 6 insertions/1 deletion, all middleware lines unchanged context | **PASS** |
| **AC-3** | `GET /column/:projectId` includes `wipLimit`; web typecheck passes reading it without a cast | `get-columns.ts:6-10` is `db.select()` over the whole row; type flows via `packages/libs/src/hono.ts:3` (`import type { AppType } from "@kaneo/api"`) → `types/project/index.ts:10-13`; read without a cast at `column-header.tsx:33` and `column-editor.tsx:90,99`; `pnpm --filter @kaneo/web typecheck` clean per run report | **PASS** (typecheck not re-run by me — see §6) |
| **AC-4** | null → bare count, DOM unchanged; `5`/3 → `3/5` no alert; `5`/6 → indicator with accessible name from a static key; 5/5 is **not** over cap | `column-header.tsx:35` (`>`), `:70-73` (bare), `:74-107` (limit branch), `:98-105` (`sr-only` accessible name); tests `column-header.test.tsx:71-81`, `:83-92`, `:94-103` (boundary), `:105-114`; 7/7 passing | **PASS** — but the count is the *filtered* count; see N-1 |
| **AC-5** | Set/clear invalidates `["columns", projectId]` and `["tasks", projectId]` with `refetchType: "all"`; verified by preservation, not rewrite | `use-update-column.ts:22-33` unchanged (diff = 1 added type line); key alignment confirmed: board reads `["columns", project.id]` (`column-header.tsx:31`) and `["tasks", projectId]` (`use-get-tasks.ts:6`), editor mutates with the same `projectId` | **PASS** (browser round-trip not executed — see §6) |
| **AC-6** | Every new string resolves through a static key present in `en-US.json`; no literal English copy in either component | 8 keys added to `i18n/en-US.json` (6 × `settings.columnEditor`, 2 × `tasks.kanban`); all 9 `t()` call sites use string literals — `column-header.tsx:85,89,101`, `column-editor.tsx:80,83,91,92,108,109`; no English literal in either diff | **PASS** (`i18n/schema.json` regeneration outstanding — N-4) |
| **AC-7** | API + web tests green at ≥ 374 / ≥ 112; both typechecks pass; `biome ci` passes | Run report: 59 files / 377 API tests (baseline 58/374), web typecheck clean, `biome ci` clean per changed file. My targeted re-runs: `vitest run --config vitest.config.ts wip-limit` → 3 files / 14 tests passed; `vitest run column-header` → 1 file / 7 tests passed | **PASS on the targeted subset**; full-suite and typecheck figures accepted from the run report, not re-verified — see §6 |
| **AC-8** | Changes confined to the allowlist; no public-project, site, charts, mcp, non-English locale, migration 0000–0042, or AI-config file | `provenance.json` 18 paths === `git status --porcelain` 18 source paths; every off-limits prefix checked and absent; `_journal.json` diff is a pure append | **PASS** (see the `.claude/settings.local.json` / `.hook-logs/` staging note in Risk 12) |

---

## 6. What I could not verify

Stated plainly, because several of these are the assertions a reader is most likely to assume I made.

1. **No live database.** I never executed `0043_gifted_lizard.sql`. That the `ALTER TABLE` applies
   cleanly to a populated `column` table, that Drizzle's journal/snapshot pair is accepted by
   `drizzle-kit migrate` at boot, and that pre-existing rows actually read back `wipLimit: null`
   are all inferred from reading the SQL, the snapshot (`notNull: false`) and the id chain
   (`prevId` === 0042's `id`). The SQL is about as low-risk as DDL gets, but AC-1's runtime half is
   unproven here. `tests/api-integration/` was out of scope for this run (requirements §2.7) and I
   did not run it.
2. **No browser.** Everything about how this actually looks and behaves is unverified: the
   `bg-destructive/10 text-destructive` badge's contrast in light and dark themes; whether the new
   label + 64px numeric input fits in the editor row's `shrink-0` flex container at narrow widths
   without overflowing or pushing the Done switch and delete button off-screen; whether the
   `title` tooltip is reachable; how a screen reader actually announces
   `"6/5 Over WIP limit: 6 of 5"`; and the N-5 `type="number"` sanitization behavior, which is a
   real-browser behavior that jsdom does not reproduce. The W4 first-paint badge widening
   (`3` → `3/5`) is likewise reasoned, not observed.
3. **Full suites accepted, not re-run.** Per instruction I ran only the two targeted commands
   (14 API tests, 7 web tests — both green). The 59-files/377-tests API figure, the ≥ 112 web
   figure, both `typecheck` runs, and `biome ci` on each changed file are taken from the run report.
   AC-3's real proof is the web typecheck, and I did not personally execute it — though I did
   confirm the type path is sound by inspection (`packages/libs/src/hono.ts:3` imports `AppType`
   from `@kaneo/api` source, so a `schema.ts` change propagates to `InferResponseType` without a
   build step, and `column-header.tsx:33` reads `.wipLimit` with no cast).
4. **Multi-client behavior is reasoned, not observed.** The N-2 false-alarm window is derived from
   reading `refetchInterval: 30000` on the tasks query, the absence of any `refetchInterval` on the
   columns query, and the absence of column events (`grep publishEvent apps/api/src/column/` →
   nothing; no column handling in `apps/api/src/ws/`). I did not stage two clients to watch a stale
   alarm persist. The exact duration therefore depends on TanStack defaults I did not confirm
   against the app's `QueryClient` configuration — if a global `staleTime` or
   `refetchOnWindowFocus: false` is set somewhere in the app's client setup, the window is longer
   than I described, not shorter.
5. **Concurrency on the write path.** Two users setting a limit on the same column simultaneously
   is last-write-wins (`update-column.ts:24-34` is an unconditional `UPDATE … SET`). That matches
   every other column field's existing behavior and is almost certainly right for this feature, but
   I did not test it.
6. **MCP surface — assessed by reading only.** `apps/api/src/mcp/tools.ts:797-805`
   (`list_project_columns`) proxies `/api/column/:projectId` and returns the raw JSON, so
   `wipLimit` now flows to MCP clients automatically with no code change and no new authorization
   surface (the underlying route still enforces `workspaceAccess.fromProject`). There is no MCP
   column-*create* or column-*update* tool, so nothing there needs widening. This is correct and
   needs no action — but I verified it by grep, not by exercising an MCP client.

### On the "Follow a change through" surfaces that were deliberately not touched

I checked each surface in AGENTS.md's list against this change and agree with every omission:

- **`publishEvent()` — correctly omitted.** `grep -rn "publishEvent" apps/api/src/column/` returns
  nothing: no column mutation at HEAD publishes an event, and there are no column WebSocket
  messages. Adding a `publishEvent` call for `wipLimit` would have been the *only* event in the
  column module, creating an asymmetry where changing a limit generates activity but renaming a
  column or toggling `isFinal` does not. AGENTS.md's rule is "use `publishEvent()` when a mutation
  drives activity, notifications, integrations, or realtime updates" — a WIP limit drives none of
  those four: it is not user-visible history worth a durable activity row, no integration consumes
  it, and the realtime need is already met by the existing `["columns", projectId]` /
  `["tasks", projectId]` invalidation for the acting client. Correctly omitted, and it would have
  been scope creep to add it. (The cost of that architectural decision is exactly N-2: other
  clients do not learn about the change. That is a pre-existing property of every column field, not
  a new debt this change introduces.)
- **Indexes / cascades — correctly omitted.** `wip_limit` is never a predicate, join key, or sort
  key; `getColumns` filters on `project_id` and orders by `position`, both already covered. No FK,
  so no cascade.
- **`relations.ts` — correctly untouched** (FR-4; scalar, not a relation).
- **Reverse states — covered.** Set/clear is symmetric (`null` clears, `:107-110` toasts the
  correct direction), and the current state is always visible in both the editor input and the
  board badge.
- **Docs / Helm / Docker — no change needed.** No new env var, no new service, no new endpoint; the
  API docs describe routes, and both route descriptions remain accurate.
- **Typed client / fetcher / hook / cache / UI states — all covered** (FR-14 through FR-17), which
  is what AC-3's typecheck proves end to end.

### AGENTS.md adherence

Good. Handlers stayed thin — `index.ts:68-80` destructures and delegates, all domain behavior is in
the controllers. Validation is Valibot, matching the file's existing idiom precisely rather than
inventing a new one. No parallel untyped request layer: the fetchers go through `client` from
`@kaneo/libs` (`create-column.ts:1`, `update-column.ts:1`) and server state stays in TanStack Query
hooks. `type` is used over `interface` throughout, and the new types are structural widenings of
existing inline shapes rather than new exported abstractions. No `any`, no non-null assertion, no
cast anywhere in the diff — the one place a lesser change would have reached for `as` is
`column-header.tsx:33`, and it correctly uses `?.` + `??` instead. Types are inferred rather than
declared where possible (`ProjectWithTasks["columns"][number]` for the prop, the client's inferred
row type for the columns query). Comments: there are none in the production diff, which is right —
nothing in it is surprising enough to need one. The only place a comment would have earned its
keep is `create-column.ts:79`, where `wipLimit ?? null` sits directly beneath two `|| null` lines
and looks like an inconsistency until you know it is deliberate; N-3's packet adds that note in the
test instead, which is a reasonable place for it. No dead code, no unused imports (`TriangleAlert`
and `cn` are both new and both used), no needless re-render (the `find` at `:33` is O(columns) on an
already-cached array; memoizing it would cost more than it saves).

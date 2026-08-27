# Code Review — Board filter chips with URL-persisted state

- **Run:** `20260827-043436-feature-extend-board-filter-chips`
- **Mode:** brownfield · **Intent:** `feature-extend` · **Baseline:** `5d1fc9104337786c3ef295ec0dc31656df371d8d`
- **Scope:** the 10 changed paths only. Pre-existing smells in untouched files (e.g. `backlog.tsx`'s
  duplicated filter state, `use-task-filters.ts` having zero call sites) are out of scope and not reported.
- **Verdict:** `needs_changes` — one **major** latent-fragility finding with a cheap fix. The shipped code
  is functionally correct as written; nothing here is a live user-facing defect.

---

## What I verified, not assumed

| Claim under review | Result |
|---|---|
| Writer graph is acyclic; no storage/hydrate effect can reach `navigate` (R-1, NFR-2/3) | **Confirmed.** The only `navigate` calls in `board.tsx` are `handleCloseTaskSheet`, the two view-shortcut route jumps, `handleControlledFiltersChange`, and the one-shot seed. `onControlledChange` is invoked only from `commit`; `commit` is invoked only from `setFilters`/`clearFilters`/`updateFilter`/`updateLabelFilter`, none of which is called from an effect. The mirror effect calls `localStorage.setItem` and nothing else; the hydrate effect calls `setInternalFilters` and nothing else, on `[projectId]`, a dep filters cannot change. |
| Every remaining `updateFilter`/`updateLabelFilter` call site is single-commit (R-9) | **Confirmed, no second violation.** All call sites checked: `board-toolbar.tsx:126,134,142,150,166,171,211,253,297,349` and `board-filter-chips.tsx:194,199,242,273,298`. Every one computes the whole next value and issues exactly one call. `updateLabelFilter` now has **zero** production call sites. |
| `handleCloseTaskSheet` round-trips `taskId` and preserves filters (FR-19/R-2) | **Confirmed** in code and pinned by `board-search-params.router.test.tsx:173`. |
| Seed guard ordering / StrictMode / dep array (§4.1) | Guard and deps are correct; the ref is set before every other check so React 19 StrictMode's mount→cleanup→mount yields exactly one seed. **But see M1** — the seed has a different, unstated ordering dependency. |
| `board-filter-chips.tsx` rules-of-hooks | **Fine, explicitly.** `useTranslation()` at :148 is the only hook and it precedes the `if (!hasActiveFilters) return null` at :150. No hook is called after the early return on any path, so hook order is invariant across renders. |
| Removing the last value of a subject yields `null`, not `[]` | Confirmed in both `removeAssignee` and `removeLabelGroup`. |
| Dead code: exactly 8 orphans removed, 12 retained | **Confirmed.** Symbol-count sweep of `board-toolbar.tsx`: `getStatusIcon`, `getPriorityDisplayName`, `getPriorityIcon`, `uniqueLabels`, `isLabelGroupSelected`, `CheckSlot`, `clearLabelFilters`, `toggleLabelGroup`, `Avatar*`, `getInitials`, `labelColors`, `DUE_DATE_FILTER_VALUES`, `getColumnIcon`, `getPriorityLabel` all still have a definition *and* a use. Nothing over-removed. The one runtime-dead leftover `tsc` cannot see is m3 below. |
| Tests pass | Re-ran the 4 changed test files only: **4 files / 85 tests passing** (`npx vitest run` in `apps/web`). Full-suite claim not re-verified, per instruction. |
| PII (NFR-10) | **Clean.** The URL carries workspace-member ids and label ids only. `getAssigneeDisplayName`/`getAssigneeAvatar` read names and images from the already-fetched `users.members` list, never from the URL. No email, name or token reaches `serializeFilterList`. |
| Authz | **No new surface.** Client-side filtering over data already loaded through the authenticated `useGetTasks`. No route, no API, no middleware touched. |
| Type safety | No `any` in the five source files. Single `router as any` in the synthetic-router test, with a `biome-ignore` and a stated reason. All `type`, no `interface`, per AGENTS.md. |
| Env-fixture rule | **Not applicable.** `apps/web` boots through Vite `import.meta.env` plus a shell-based runtime placeholder swap (`env.sh`); there is no Joi/Zod/envalid/class-validator config schema gating boot, and `vitest` runs green with no env fixture. This change introduces no env var. |

---

## Findings

### M1 — major — `apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx:201-221`

**The localStorage seed's correctness depends on an unstated, untested ordering invariant: the seed
`useEffect` must be registered before `useTaskFiltersWithLabelsSupport` is called.**

The hook's storage-mirror effect (`use-task-filters-with-labels-support.ts:124-127`) writes the
*effective* filters. On a bare URL the effective `assignee`/`labels` are `null`, so that effect
writes `{"status":null,"priority":null,"assignee":null,"dueDate":null,"labels":null}` to
`kaneo:board-filters:<projectId>` **on the very first commit**. The seed effect reads the same key on
that same commit. Which one wins is decided purely by the order the two `useEffect`s were registered
during render — i.e. by the fact that the seed block sits at line 201 and the hook call at line 223.

I confirmed both branches empirically with a throwaway probe (since deleted):

- As shipped (seed effect declared first): the seed reads `{"assignee":["u1"]}` and navigates. Correct.
- With the hook call moved above the seed block: the mirror effect wipes the key first, the seed reads
  `assignee: null`, hits `if (!assignee && !labels) return;`, and **silently no-ops — while the user's
  persisted filters have just been destroyed.**

Why it matters: the storage fallback (OQ-1 option b, DR-13) is the entire reason `localStorage` still
participates in `assignee`/`labels`. It fails silently and takes the user's saved filters with it, and
nothing in the repo would notice: `tsc` is happy, `biome` is happy, and there is no test that mounts
the seed at all. A future maintainer hoisting the hook call to the top of the component — an ordinary,
apparently-cosmetic refactor — breaks it.

The change plan's §4.3 argument for this is wrong on the facts: it says the seed "reads its input from
`localStorage` — a source that no other code path in this change writes *before the first commit*".
Both effects run *after* the first commit; "before the first commit" is not the criterion that decides
this. The right criterion is intra-commit effect registration order, which the plan never mentions and
the code never pins.

**Fix (removes the dependency rather than documenting it):** read storage during render, where no
effect can race it, and move the seed decision into the allowlisted, unit-testable
`board-search-params.ts`:

```ts
// board.tsx — render phase; immune to effect ordering. useState's lazy initializer runs once
// per mount, and the route remounts on a projectId change (match id includes params).
const [storedSeed] = useState(() => readStoredBoardFilters(projectId));
```

then have the effect call a new pure `buildStorageSeedSearch(previous, storedSeed)` that returns the
next search object or `null`. Test the pure helper for the four cases (URL carries assignee → null;
URL carries labels → null; storage empty → null; storage populated + bare URL → seeded object).

---

### m1 — minor — `apps/web/src/components/board/board-filter-chips.tsx:110-113`

The comment claims a U+0000 separator; the code uses a plain space:

```ts
 * The U+0000 separator cannot occur in a label name, so ("a b", "c") and ("a", "b c")
 * cannot collide.
 */
const groupKey = (name: string, color: string) => `${name} ${color}`;
```

The stated collision-safety property does not hold for the code as written — with a space separator,
`("a b", "c")` and `("a", "b c")` both produce `"a b c"`, which is the exact example the comment says
is impossible. In practice nothing collides, but only by luck: `color` is always one of the nine
`labelColors` values (`gray`, `dark-gray`, …), none of which contains a space. That is an accident the
comment is not documenting.

Per AGENTS.md ("comments should explain constraints"), a comment asserting a false invariant is worse
than none. **Fix:** either use a real U+0000 separator in the template literal and keep the comment, or
keep the space and rewrite the comment to state the real constraint (palette color values are
space-free).

---

### m2 — minor — `apps/web/src/components/board/board-search-params.router.test.tsx:27, 109`

Stale wording from the pre-`.`-separator draft of the plan. The module doc says the test proves the
stringifier "emits our comma-joined value raw", and the test is named
`"writes comma-joined search params, not JSON"` — while its body asserts `assignee=u1.u2` and asserts
the string does **not** contain `%2C`. The name says the opposite of what the test checks. A future
reader debugging a separator change will trust the name. **Fix:** s/comma-joined/dot-joined/ in both.

---

### m3 — minor — `apps/web/src/hooks/use-task-filters-with-labels-support.ts:304-317`

`updateLabelFilter` now has **zero production call sites** (`board-toolbar.tsx` stopped receiving it;
`board.tsx` stopped destructuring it; `backlog.tsx` has its own local copy). It survives only as a
hook export kept alive by its own tests. `noUnusedLocals` cannot see this.

It is also the one exported mutator that is *shaped* to be called in a loop — which is exactly what the
`commit` invariant forbids in controlled mode, and exactly the bug the plan removed from
`toggleLabelGroup`. Leaving it exported and untagged re-arms the trap. **Fix:** delete it (the two hook
tests that cover it become `updateFilter("labels", …)` tests), or keep it and add one line to its doc
comment: *uncontrolled callers only; in controlled mode it must not be looped over.*

---

### m4 — minor — `apps/web/src/hooks/use-task-filters-with-labels-support.ts:129-136` (invariant wording)

The documented invariant is *"at most one `commit` per event handler"*. The invariant the code actually
requires is stronger: **at most one `commit` per render**. `commit` closes over `filters`, which is only
refreshed when the router's search state lands back through `controlled`. `navigate` is not synchronous,
and TanStack Router commits location state inside a transition, so two chip-remove clicks landing in the
same pre-navigate window both read the same `filters` and the first removal is silently reverted.

Narrow (needs two clicks on *different* chips inside one transition), but real, silent, and a regression
versus the old functional-`setState` behavior. It is also unguarded and untested.

**Fix (cheapest, non-blocking):** correct the comment. **Fix (robust, ~6 lines):** keep a `pendingRef`
of the last committed controlled value in the hook and have `commit` use `pendingRef.current ?? filters`
as `previous`, clearing the ref once `controlled` catches up.

---

### m5 — minor — test coverage gaps

1. **The storage seed has no test at all.** It is the most intricate new logic in the change (one-shot
   ref, two skip conditions, `replace: true`) and it carries M1. The plan's test matrix omits it too —
   so the code matches the plan; the plan was the gap. Addressed by the M1 fix.
2. `board-filter-chips.test.tsx:173` pins `null`-not-`[]` for **assignee** only. The label path
   (`removeLabelGroup`, which has the extra group-expansion step) has no equivalent — removing the last
   label group and asserting `updateFilter("labels", null)` is one line.
3. `board-filter-chips.test.tsx:266` — `"renders only i18n keys, never literal English copy"` is
   tautological. `react-i18next` is mocked at :9 so `t(key) === key`; the component *cannot* render
   `"Clear all filters"` under this mock regardless of what the source says. The test can never fail and
   proves nothing about hardcoded copy. Either delete it or replace it with a source-level assertion.

Everything else in the new tests is substantive. The AC-3 no-flash probe is genuinely load-bearing —
storage is pre-seeded with a *different* assignee (`user-b`) than the controlled value (`user-a`), so
`renders[0] === 1` fails if the controlled value were applied by an effect, and
`renders.every(n => n === 1)` fails on any intermediate unfiltered frame. The router canary asserts the
literal `assignee=u1.u2` plus absence of `%5B`, `[`, `%2C` and `%2E`, which is the real proof that the
default stringifier does not JSON-encode. Neither is over-mocked.

---

### m6 — minor — `apps/web/src/hooks/use-task-filters-with-labels-support.ts:143-148`

In controlled mode `commit` always calls `setInternalFilters` with a fresh object, even when only
`assignee`/`labels` changed. React cannot bail out on a new reference, so every chip click costs an
extra render, an extra `filters` identity, an extra `filterTasks`/`filteredProject` pass over every task
on the board, and an extra `localStorage.setItem`. Adjacent to NFR-4 and to the AGENTS.md "protect
performance on task-heavy boards" principle. **Fix:** guard the call on the three uncontrolled keys
actually differing, or return `previous` unchanged from the updater when they are identical.

---

## Deliberately not raised

Per the invocation's accepted-decisions list, and confirmed as *not* contradicted by the code: the
`string` (dot-joined) search-param shape, the `.`-over-`,` separator with a both-tolerant reader, the
duplicated `WorkspaceLabel`/`ActiveUsers` aliases and `find()` helpers across the two board files, the
inert stale ids, and the untested dnd-kit half of AC-7. Also not raised: the dynamic
`tasks:backlog.filters.${dueDateLabelKey(...)}` key in `board-filter-chips.tsx:283` — it is
verbatim-moved pre-existing code over a closed three-value enum, not new drift.

---

```json
{
  "module": "apps/web board filter chips (URL-persisted assignee/label state)",
  "verdict": "needs_changes",
  "findings": [
    {
      "severity": "major",
      "file": "apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx:201-221",
      "issue": "The first-mount localStorage seed is correct only because its useEffect is registered before useTaskFiltersWithLabelsSupport is called. The hook's storage-mirror effect writes the EFFECTIVE filters, so on a bare URL it writes assignee:null/labels:null to kaneo:board-filters:<projectId> on the same first commit. Verified empirically: hoisting the hook call above the seed block makes the mirror wipe the key before the seed reads it, so the seed silently no-ops AND the user's persisted filters are destroyed. No comment, no test, and the change plan's section 4.3 justification ('localStorage is a source no other code path writes before the first commit') is wrong - both effects run after the first commit; intra-commit effect registration order is the real criterion.",
      "fix": "Read storage during render instead of in an effect: const [storedSeed] = useState(() => readStoredBoardFilters(projectId)). Move the seed decision into a pure buildStorageSeedSearch(previous, stored): BoardSearchParams | null in board-search-params.ts and unit-test its four branches (URL has assignee -> null; URL has labels -> null; storage empty -> null; bare URL + populated storage -> seeded object)."
    },
    {
      "severity": "minor",
      "file": "apps/web/src/components/board/board-filter-chips.tsx:110-113",
      "issue": "Comment claims a U+0000 separator and asserts ('a b','c') cannot collide with ('a','b c'); the code uses a plain space and those two inputs both produce 'a b c'. The invariant holds only by accident, because every labelColors value is space-free.",
      "fix": "Use a real U+0000 separator in the template literal and keep the comment, or keep the space and rewrite the comment to state the actual constraint (palette color values contain no spaces)."
    },
    {
      "severity": "minor",
      "file": "apps/web/src/components/board/board-search-params.router.test.tsx:27,109",
      "issue": "Module doc and test name say 'comma-joined' while the body asserts assignee=u1.u2 and asserts the absence of %2C. The name states the opposite of the assertion.",
      "fix": "Rename to 'writes dot-joined search params, not JSON' and fix the module doc line."
    },
    {
      "severity": "minor",
      "file": "apps/web/src/hooks/use-task-filters-with-labels-support.ts:304-317",
      "issue": "updateLabelFilter has zero production call sites after the toolbar prop removal; it is kept alive only by its own tests. It is also the one exported mutator shaped to be called in a loop, which is exactly what the commit invariant forbids in controlled mode. noUnusedLocals cannot detect this.",
      "fix": "Delete it and convert its two hook tests to updateFilter('labels', ...), or keep it and document it as uncontrolled-callers-only / never-loop-in-controlled-mode."
    },
    {
      "severity": "minor",
      "file": "apps/web/src/hooks/use-task-filters-with-labels-support.ts:129-136",
      "issue": "The documented invariant is 'at most one commit per event handler'; the code actually requires 'at most one commit per render'. commit closes over filters, refreshed only when the router's search state lands back through controlled, and TanStack commits location state inside a transition. Two chip removals inside one pre-navigate window both read the same filters and the first removal is silently reverted - a real regression versus the previous functional-setState behavior.",
      "fix": "At minimum correct the invariant comment. Robust option: hold a pendingRef of the last committed controlled value and have commit use pendingRef.current ?? filters as previous, clearing it once controlled catches up."
    },
    {
      "severity": "minor",
      "file": "apps/web/src/components/board/board-filter-chips.test.tsx:173,266",
      "issue": "(a) null-not-[] is pinned for assignee only; removeLabelGroup, which has an extra group-expansion step, has no equivalent assertion. (b) 'renders only i18n keys, never literal English copy' is tautological: react-i18next is mocked so t(key)===key, so the component cannot render English regardless of the source. The test can never fail.",
      "fix": "Add a test that removing the last label group calls updateFilter('labels', null). Delete the tautological i18n test or replace it with a source-text assertion that no JSX text node outside t(...) contains prose."
    },
    {
      "severity": "minor",
      "file": "apps/web/src/hooks/use-task-filters-with-labels-support.ts:143-148",
      "issue": "In controlled mode commit always calls setInternalFilters with a fresh object even when only assignee/labels changed. React cannot bail out on a new reference, so each chip click costs an extra render, an extra filterTasks/filteredProject pass over every task, and an extra localStorage write. Adjacent to NFR-4 and the AGENTS.md task-heavy-board performance principle.",
      "fix": "Guard the setInternalFilters call on the three uncontrolled keys actually differing, or return previous unchanged from the updater when they are identical."
    }
  ],
  "refinement_packets": [
    {
      "id": "RP-1",
      "task_type": "bugfix-hardening",
      "artifact_path": "apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx",
      "instruction": "Remove the effect-ordering dependency from the first-mount localStorage seed in board.tsx. 1) In apps/web/src/components/board/board-search-params.ts add a pure, exported buildStorageSeedSearch(previous: BoardSearchParams, stored: ControlledBoardFilterValues): BoardSearchParams | null that returns null when previous.assignee !== undefined || previous.labels !== undefined, null when neither stored list serializes to a value, and otherwise { ...previous, assignee, labels } using serializeFilterList. Document that the caller must have read storage during render. 2) In board.tsx replace the in-effect readStoredBoardFilters(projectId) with a render-phase lazy read - const [storedSeed] = useState(() => readStoredBoardFilters(projectId)) - and have the one-shot effect call buildStorageSeedSearch(previous, storedSeed) inside the search updater, keeping replace: true and the existing didSeedFromStorageRef guard. Add a code comment stating that the render-phase read is what makes the seed independent of effect order, since the hook's storage mirror writes the same key on the same commit. 3) Add table-driven tests for buildStorageSeedSearch to board-search-params.test.ts covering the four branches. Do not change the seed's observable behavior, do not touch the hook, and stay inside the 10 allowlisted paths.",
      "inputs": [
        "apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx",
        "apps/web/src/components/board/board-search-params.ts",
        "apps/web/src/components/board/board-search-params.test.ts",
        "apps/web/src/hooks/use-task-filters-with-labels-support.ts (read-only: the mirror effect at :124-127 is the racer)",
        ".sdlc/runs/20260827-043436-feature-extend-board-filter-chips/change_plan.md sections 4.1-4.3"
      ],
      "acceptance": [
        "board.tsx no longer calls readStoredBoardFilters inside an effect; the value is read via a useState lazy initializer during render.",
        "Moving the useTaskFiltersWithLabelsSupport call above the seed effect in board.tsx no longer changes seeding behavior.",
        "buildStorageSeedSearch is covered for: URL carries assignee -> null; URL carries labels -> null; storage empty -> null; bare URL + stored assignee and labels -> seeded object with sorted dot-joined values.",
        "The seed still uses replace: true and still fires at most once per mount.",
        "pnpm --filter @kaneo/web test passes with no fewer tests than before; tsc --noEmit -p tsconfig.app.json clean; non-writing biome check clean on changed paths."
      ]
    },
    {
      "id": "RP-2",
      "task_type": "comment-and-test-correction",
      "artifact_path": "apps/web/src/components/board/board-filter-chips.tsx",
      "instruction": "Three low-risk corrections, no behavior change. 1) board-filter-chips.tsx groupKey (~:105-113): make the comment true - either switch the separator to a real U+0000 and keep the existing wording, or keep the space and rewrite the comment to state the real constraint (every labelColors value is space-free, so name + space + color cannot collide across the palette). 2) board-search-params.router.test.tsx: replace 'comma-joined' with 'dot-joined' in the module doc (~:27) and in the test name (~:109); the body already asserts assignee=u1.u2 and the absence of %2C. 3) board-filter-chips.test.tsx: add a test that removing the last active label group calls updateFilter('labels', null) exactly once, and delete the tautological 'renders only i18n keys, never literal English copy' test (it cannot fail under the react-i18next mock) or replace it with an assertion over the component source text.",
      "inputs": [
        "apps/web/src/components/board/board-filter-chips.tsx",
        "apps/web/src/components/board/board-filter-chips.test.tsx",
        "apps/web/src/components/board/board-search-params.router.test.tsx"
      ],
      "acceptance": [
        "No comment in the changed files asserts a property the code does not have.",
        "The router test's name matches its assertions.",
        "A test pins updateFilter('labels', null) when the last label group's chip is removed.",
        "No tautological i18n test remains.",
        "Suite still green; biome check clean on changed paths."
      ]
    },
    {
      "id": "RP-3",
      "task_type": "invariant-hardening",
      "artifact_path": "apps/web/src/hooks/use-task-filters-with-labels-support.ts",
      "instruction": "Optional; cost-efficient policy is fine. In use-task-filters-with-labels-support.ts: (a) correct the commit invariant comment (~:129-136) from 'at most one commit per event handler' to 'at most one commit per render' and note that navigate is asynchronous and TanStack commits location state in a transition, so two commits inside one pre-navigate window both read the same filters. (b) Guard the setInternalFilters call in controlled mode so it only fires when status, priority or dueDate actually changed, avoiding a redundant render, filteredProject recompute and localStorage write per chip click. (c) Either delete updateLabelFilter (converting its two controlled-mode tests to updateFilter('labels', ...)) since it has zero production call sites, or add one doc line marking it uncontrolled-callers-only and never-to-be-looped. Do not add the pendingRef machinery unless the m4 robust option is explicitly requested - the comment correction is the required part.",
      "inputs": [
        "apps/web/src/hooks/use-task-filters-with-labels-support.ts",
        "apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx"
      ],
      "acceptance": [
        "The commit invariant comment states the per-render bound and names the asynchronous navigate as the reason.",
        "In controlled mode, a commit that changes only assignee/labels does not call setInternalFilters.",
        "The existing uncontrolled tests (restores persisted label filters; issue-identifier matching) are unmodified and still pass - FR-11.",
        "updateLabelFilter is either removed or documented as uncontrolled-only.",
        "Suite green; tsc clean; biome check clean on changed paths."
      ]
    }
  ]
}
```

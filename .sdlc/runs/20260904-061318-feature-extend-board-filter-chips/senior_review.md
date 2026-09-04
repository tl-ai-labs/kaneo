# Senior review — board filters in URL search params

Run: `20260904-061318-feature-extend-board-filter-chips` · Mode: brownfield · Intent: feature-extend
Reviewer scope: the 12 files this run wrote/edited, plus the blast radius the design itself declared.

## VERDICT

**REQUEST CHANGES** — the delivered 12 files are of genuinely high quality and match the design almost
exactly, but the migration is *incomplete*: four `search: { taskId }` sites in `kanban-board/index.tsx`
and `list-view/index.tsx` (the `j`/`k` keyboard shortcuts, board-route-only) still replace the whole
search object and therefore silently drop all five filter params on a filtered board. This is a design
omission, not a codegen error — the mechanical tier implemented the design faithfully.

Re-verified locally before writing this:

| Gate | Result |
| --- | --- |
| `pnpm --filter @kaneo/web test <5 changed test files>` | 5 files, 42 tests, all pass |
| `pnpm --filter @kaneo/web typecheck` | passes |
| `pnpm exec biome ci <11 paths>` | clean, no fixes applied |
| `git status --porcelain` | exactly the 12 declared files (+ pre-existing `.claude/settings.local.json`) |

---

## Findings

### Blocking

**B1 — `j`/`k` keyboard navigation wipes every filter param.**
`apps/web/src/components/kanban-board/index.tsx:67` and `:74`;
`apps/web/src/components/list-view/index.tsx:97` and `:104`:

```ts
navigate({ to: ".", search: { taskId: state.focusedTaskId } });
```

In TanStack Router v1 the `search` option is `true | ParamsReducer` (`router-core@1.171.20`
`dist/esm/link.d.ts:142`). `true` means "carry the previous search over"; **an object is a full
replacement, not a merge.** The repo already depends on this: the pre-change `handleCloseTaskSheet`
used `search: {}` to close the sheet, which only works because the object form replaces.

Consequence after this run: on `?labels=l1,l2&status=to-do`, pressing `j` or `k` navigates to a URL
with only `taskId` — every filter is dropped, the board silently re-renders unfiltered, and the
shareable-URL promise is broken by a single keystroke. Before this run the same code was harmless
because filters lived in localStorage.

These two files are inside the exact blast radius the design analysed (`design.md` §1: "`KanbanBoard`
and `ListView` are imported by exactly one file — `board.tsx`"), and the design's own rule in §5
covers them verbatim: *"`search: { taskId: task.id }` would otherwise wipe the filters when opening a
task sheet, which is the same bug in the other direction."* The design just did not enumerate these
four call sites, so they fell outside the write contract. I verified `KanbanBoard`/`ListView` are
imported by `board.tsx` only, so the fix cannot reach backlog, gantt or the public board.
`backlog-list-view/index.tsx:97,104` carries the same pattern and must **not** be touched — the
backlog has no URL filters and is an explicit non-goal.

Fix (four lines, mirroring the shape already landed in `task-card.tsx` / `task-row.tsx`):

```ts
navigate({
  to: ".",
  search: (prev) => ({ ...prev, taskId: state.focusedTaskId }),
});
```

### Should-fix

**S1 — `clearFilters` has zero test coverage.**
`apps/web/src/hooks/use-task-filters-with-labels-support.ts:57`. It is the "Clear all" affordance in
the toolbar and the only exported mutator with no assertion anywhere in the suite. `setFilters`,
`updateFilter` and the toolbar's batched label paths are all covered; `clearFilters` is not. If it
regressed to leaving `?status=` behind, or to clearing `taskId` along with the filters, nothing in
149 tests would fail. `design.md` §7.2 did not list it — that is the gap, not the implementer's.
A ~12-line test in the existing hook test file closes it.

### Nit

**N1 — `updateLabelFilter: _updateLabelFilter` should just not be destructured.**
`apps/web/src/components/board/board-toolbar.tsx:137`. See the explicit verdict on point 3 below.
The alias is *correct* but carries a misleading signal; simply removing the line is cleaner.
**Empirically verified:** I removed the destructure line, ran `pnpm --filter @kaneo/web typecheck`,
it passed, and restored the file byte-for-byte (`git diff --stat` back to 14 insertions / 12
deletions). `noUnusedLocals`/`noUnusedParameters` do not flag a property that is declared in
`BoardToolbarProps` but never destructured, so the underscore is unnecessary.

**N2 — `EMPTY_BOARD_FILTERS` is an exported mutable object.**
`apps/web/src/lib/board-filter-search-params.ts:21`. Nothing in the changed set mutates it, but it is
handed straight to `setFilters` by `clearFilters` and compared against in tests. `Object.freeze(...)`
or a `satisfies`-narrowed readonly type would make the constant tamper-proof at no cost. Optional.

**N3 — `BOARD_FILTER_SEARCH_KEYS` is production code used only by a test.**
`board-filter-search-params.ts:5`. It is specified by `design.md` §2.1 so it is not a deviation, but
it is also not compiler-linked to `BoardFilters`: if a sixth filter is ever added,
`decodeBoardFilters`/`encodeBoardFilters` will fail to compile (their return types are keyed on
`BoardFilters`) while this array will silently go stale. Consider
`ReadonlyArray<BoardFilterSearchKey>` derived from a `Record<BoardFilterSearchKey, true>` if it ever
grows a production consumer. Not worth a change today.

**N4 — `.gitignore` section has no separating blank line.**
`.gitignore:59`. Every other block in the file is blank-line separated; `# SDLC run artifacts`
butts directly against `.pi/`. Cosmetic.

**N5 — informational, no action:** `.gitignore` now blanket-ignores `.sdlc/`. I confirmed
`git ls-files .sdlc` is empty, `git diff --cached --name-only` is empty, and `.sdlc/policies/` does
not exist on disk, so nothing was untracked and the design's §11 correction was right — the
session-start snapshot showing `A .sdlc/policies/opus-flash-sdk.yaml` was stale. Be aware that a
future checked-in policy file under `.sdlc/policies/` will need `git add -f` or a negation rule.

**N6 — test typing.** `navigateSpy.mock.calls[0][0]` is implicitly `any` in
`task-card.test.tsx:104`, `task-row.test.tsx` and their siblings, so `navArg.search({...})` is
unchecked. Typecheck passes and this is the existing `task-row.test.tsx` precedent; noted only.

---

## Explicit statement on each of the 9 review points

**1. Behaviour preservation — PASS, proven mechanically.**
I extracted old `L74–203` (`git show HEAD:...`) and new `L88–217` and diffed them: **byte-identical,
zero output.** That block contains `filterTasks` in full (including the `useCallback` dep array
`[filters, project?.slug, textQuery, weekStartsOn]`, the `weekStartsOn` selector, the `date-fns`
imports' usage and both `// Label filtering` / `// Check if task has…` comments), `filteredProject`,
and the `hasActiveFilters` expression. AND-across-types (independent early-return `if`s),
OR-within-a-type (`.includes` / `.some`), and empty-columns-preserved (`columns.map` only replaces
`tasks`) are therefore unchanged by construction, and are additionally covered by the new test
`"empty columns are preserved when a filter matches nothing"`. `hasActiveFilters` semantics are
identical — same `Object.values(...).some(...)` expression, now fed by a codec that returns `null`
(never `[]`), which is exactly what that expression already expected.

**2. Hook public API — PASS, byte-identical.**
The return object is `{ filters, setFilters, updateFilter, updateLabelFilter, filteredProject,
hasActiveFilters, clearFilters }` in the same order with the same types.
`updateLabelFilter(labelId: string): void` is still exported with an unchanged signature and an
unchanged body (`useCallback`-wrapped, functional `prev`, `null` on empty). `setFilters` accepts both
a value and an updater (`typeof update === "function"` branch present, tested at
`use-task-filters-with-labels-support.test.tsx:279`). The only signature change is
`projectId` → `_projectId`, which is positional-compatible and exactly what `design.md` §4.5
mandated; the sole production caller `board.tsx:178` still passes three arguments.

**3. The `_updateLabelFilter` deviation — VERDICT: acceptable, but change it.**
It is *functionally* correct and it honours the design's real constraint (§6.3: keep the prop in
`BoardToolbarProps`, keep `board.tsx` passing it, do not touch the hook's public API). The design's
stated *reason* — "Biome will not flag an unused destructured prop" — was true but incomplete: the
actual gate is TypeScript's `noUnusedParameters`/`noUnusedLocals`, which do flag an unused binding in
a destructured parameter. So the tier hit a real wall and took a sanctioned escape hatch.

But the escape hatch was not the minimal one. **Just delete the destructure line.** I proved this
compiles: with `updateLabelFilter: _updateLabelFilter,` removed from the parameter pattern,
`pnpm --filter @kaneo/web typecheck` passes, because TypeScript does not require every declared prop
to be destructured. That keeps `BoardToolbarProps` intact, keeps `board.tsx`'s JSX intact, keeps the
hook's API intact, and removes a dead `_`-prefixed binding that reads like "this is temporarily
parked" when it is in fact permanently unused.

**Do not drop the prop from `BoardToolbarProps` or from the `board.tsx` call site.** That is a
different, larger change than the design authorised (ADR-3 deliberately keeps `updateLabelFilter`
exported so the hook's surface and the toolbar's contract stay stable). Worth flagging for a follow-up
ticket, though, since after this run `updateLabelFilter` is dead across the entire app: the hook
exports it, `board.tsx` forwards it, and the only recipient ignores it. That is a real (if benign)
API smell and it deserves a deliberate decision later — not a drive-by fix inside this run.

**4. Clean cutover — PASS.**
`grep` over the migrated hook, the codec and the toolbar returns **no** `localStorage` and no
`kaneo:board-filters` occurrence. Repo-wide, `kaneo:board-filters` survives at exactly one site:
`apps/web/src/hooks/use-task-filters.ts:61`, which is the deliberate near-duplicate. It is untouched
(`git status` confirms), it keeps its localStorage behaviour, and **I am making no recommendation to
deduplicate it** — that is an explicit non-goal. `DEFAULT_FILTERS`, `FILTER_KEYS` and
`normalizeFilters` were fully deleted with nothing left behind; `useState`/`useEffect` imports are
gone.

**5. Codec correctness — PASS on all 8 tolerance rules and on the comma invariant.**
Implementation matches `design.md` §2.2 essentially character-for-character. Rules 1–8 each have a
named test (`board-filter-search-params.test.ts:27–68`), including the 50 000-char no-throw case.
Both §2.4-mandated named tests exist verbatim, and the invariant is enforced on **both** sides:
decode splits (`decodeFilterValue`, matching nothing rather than inventing a filter) and encode drops
(`encodeFilterValue:73`, `trimmed.includes(",") → continue`), so the app can never emit a URL it
cannot read back. `Set`-based dedupe preserves first-occurrence order in one pass, and `[] → null`
(rule 7) is honoured everywhere, which is what keeps `hasActiveFilters` correct.

On `decodeBoardFilters` reading `search.status` directly instead of via `readRawFilterParam`:
**benign, and it matches the design's own code block** (§2.2 does exactly this). The two paths are
behaviourally identical — `readRawFilterParam` maps a non-string to `undefined`, and
`decodeFilterValue(undefined)` returns `null`; `decodeFilterValue(<non-string>)` also returns `null`
via its own `typeof raw !== "string"` guard. The division of labour is deliberate and legible:
`readRawFilterParam` exists for `validateSearch`, where the contract is *raw pass-through, no
normalisation* (so TanStack never rewrites the user's URL on load); `decodeFilterValue` owns
normalisation. Not a defect, not worth churning.

**6. No injected params — PASS.**
`validateSearch` (`board.tsx:36–42`) returns `readRawFilterParam(...)`, i.e. `undefined`, for every
absent key — never `""`. `encodeBoardFilters` always returns all five keys with `undefined` values
for empty filters (asserted at `board-filter-search-params.test.ts:141`), which is precisely what
makes `{ ...prev, ...encodeBoardFilters(next) }` *clear* an emptied key rather than leave `?status=`.
TanStack omits `undefined` during stringification. Covered end-to-end by
`"renders unfiltered and injects no search keys when there are no filter params"` (asserts
`hasActiveFilters === false`, `filters` deep-equals the all-null default, both tasks visible, and
`navigate` **never called** — no redirect, no injection) and by `"clearing labels removes the key
entirely"` (asserts `undefined`, explicitly not `""`).

**7. Memoisation (NFR-6) — PASS, no stale-closure or exhaustive-deps hazard.**
`filters` is memoised on the five extracted primitives (`hook:24–40`), not on the `search` object,
so router state churn does not produce a fresh `BoardFilters` identity. Directly asserted by
`"filters keep a stable identity across re-renders"`, which uses reference `toBe` on both `filters`
and `filteredProject` — a real assertion, not a shape check.

No stale closures: `setFilters` closes over `navigate` only and reads previous state from the
router's `prev` inside the updater, never from the `filters` in scope. `clearFilters`, `updateFilter`
and `updateLabelFilter` close over `setFilters` alone. Every dep array is complete and Biome's
`useExhaustiveDependencies` passes with **no suppression comment anywhere** in the changed files.
The one design caveat is respected: decoding `prev` inside the updater does not fix the N-navigations
-in-one-tick hazard (each resolves from the same committed location), and the fix correctly lives in
`board-toolbar.tsx` rather than being papered over in the hook.

**8. Scope discipline — PASS.**
`git status --porcelain` returns exactly the 12 declared files. Untouched and verified:
`apps/api/**`, `packages/**`, `tests/**`, `apps/web/src/hooks/use-task-filters.ts`,
`public-project/**`, `backlog.tsx`, `gantt.tsx`, `backlog-list-view/**`, `i18n/schema.json`,
`i18n/en-US.json`, `package.json`. No new runtime dependency. No `zod` and no `valibot` import in the
codec, the hook or the route — hand-rolled `typeof` guards throughout, matching the
`backlog.tsx`/`gantt.tsx`/`auth/*` precedent (ADR-6, FR-2). No new i18n keys, so no
`pnpm i18n:schema` obligation. (B1's remediation deliberately requires widening the write contract to
two files that were in the analysed blast radius but not in the contract — flagged as such below.)

**Env-fixture check: N/A.** This is a Vite/React front-end change with no validating `ConfigModule`,
no Joi/Zod/envalid config schema, and no new required environment variable. The `.env.example` /
`.env.test` blocker rule does not apply to this module.

**9. Test quality — PASS, and stronger than typical.**
The tests assert on **resolved search objects**, not on spies-as-proxies, which is the whole point:

- `board-toolbar.test.tsx:155` asserts `searchRef.current.labels === "l1,l2,l3"` after a single click.
  The harness reproduces real router semantics — `committed.current` is snapshotted per render, and
  the navigate mock applies the functional updater against `committed`, not against the running
  `searchRef` — so N synchronous navigates in one tick all resolve from the same committed location,
  exactly as TanStack behaves. That is what makes the reported mutation result (`expected 'l3' to be
  'l1,l2,l3'` when the for-loop is restored) meaningful rather than an artefact. It also asserts
  `navigateSpy` was called **exactly once**, which is the direct assertion on batching.
- `task-card.test.tsx` / `task-row.test.tsx` pull the real updater out of `navigateSpy.mock.calls`
  and *invoke* it, deep-equalling the result against `{ taskId: undefined, status: "to-do",
  labels: "l1,l2" }`. That is an end-state assertion on the produced search, and it is why reverting
  to `search: {}` fails all four. They also pin `replace === undefined`, correctly locking in the
  design's "do not change history behaviour at these two sites".
- Hook tests assert on `searchRef.current` (the applied search), never on the spy's argument shape
  alone, except for the `replace: true` checks — where the spy argument *is* the thing under test,
  and the test correctly loops every call rather than checking only the last.

Nothing tautological, nothing asserting on its own mock. One soft spot: the assertion
`expect(prev.status).toEqual(["a"])` *inside* the `setFilters` updater at
`use-task-filters-with-labels-support.test.tsx:291` would be silently skipped if the callback never
ran — but the immediately following `expect(searchRef.current.priority).toBe("high")` proves it ran,
so the case is not vacuous. The real coverage gap is S1 (`clearFilters`), not test quality.

---

## Remediation packets

```json
{
  "id": "B1-preserve-filters-on-keyboard-focus-navigation",
  "task_type": "bugfix",
  "artifact_path": [
    "apps/web/src/components/kanban-board/index.tsx",
    "apps/web/src/components/list-view/index.tsx"
  ],
  "scope_note": "REQUIRES WRITE-CONTRACT EXTENSION. These two files were not in the run's file list but are inside the blast radius design.md section 1 analysed (both are imported by board.tsx and by nothing else). Do NOT touch apps/web/src/components/backlog-list-view/index.tsx, which carries the identical pattern but belongs to the backlog view and is an explicit non-goal.",
  "instruction": "In apps/web/src/components/kanban-board/index.tsx at lines 67 and 74, and in apps/web/src/components/list-view/index.tsx at lines 97 and 104, replace the object-form search argument with a functional updater that preserves every other search key: change `navigate({ to: \".\", search: { taskId: state.focusedTaskId } })` to `navigate({ to: \".\", search: (prev) => ({ ...prev, taskId: state.focusedTaskId }) })`. Rationale: in TanStack Router v1 the `search` option is typed `true | ParamsReducer` — an object REPLACES the entire search rather than merging, so these four `j`/`k` keyboard-shortcut handlers currently drop all five filter params on a filtered board. Match the shape already landed in task-card.tsx (lines 149-162) and task-row.tsx (lines 148-161) exactly. If tsc rejects an explicit `prev: Record<string, unknown>` annotation, omit the annotation and let it infer — do NOT introduce `any` and do NOT add a `from:` option. Do NOT add `replace` (history behaviour at these sites is unchanged). Change nothing else in either file: the `Enter` shortcut, the `useEffect`s, the dnd-kit sensors and all JSX stay as they are.",
  "acceptance": [
    "grep -rn 'search: { taskId' apps/web/src/components/kanban-board apps/web/src/components/list-view returns no matches",
    "apps/web/src/components/backlog-list-view/index.tsx is unmodified (git status shows it untouched)",
    "The diff is exactly four navigate call sites across two files; no other line changes",
    "pnpm --filter @kaneo/web typecheck passes",
    "pnpm --filter @kaneo/web test passes (>=149 tests)",
    "pnpm exec biome ci apps/web/src/components/kanban-board/index.tsx apps/web/src/components/list-view/index.tsx is clean",
    "OPTIONAL BEST-EFFORT: a colocated test proving the j-shortcut updater preserves filter params. If the dnd-kit / bulk-selection / store mock surface makes this disproportionately expensive, ship the fix without it and record that decision — the grep guard plus typecheck is the accepted minimum for this packet."
  ]
}
```

```json
{
  "id": "S1-cover-clearFilters",
  "task_type": "test",
  "artifact_path": "apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx",
  "instruction": "Append one test to the existing describe block, reusing the file's existing vi.hoisted navigateSpy/searchRef mock and the existing beforeEach (do not add new mocks, do not modify any existing test). Name it \"clearFilters removes every filter key and preserves unrelated search params\". Seed `searchRef.current = { taskId: \"task-9\", status: \"to-do\", priority: \"high\", assignee: \"user-1\", dueDate: \"dueThisWeek\", labels: \"l1,l2\" }`, renderHook the hook, call `result.current.clearFilters()` inside `act`, then assert: all five of status/priority/assignee/dueDate/labels are `undefined` on `searchRef.current` (assert `toBeUndefined()`, explicitly NOT `\"\"` — this is the FR-7 no-empty-param guarantee); `searchRef.current.taskId` is still `\"task-9\"`; and `navigateSpy` was called exactly once with an object matching `expect.objectContaining({ replace: true })`. Assert on the resolved search object, never on the spy's search argument shape alone.",
  "acceptance": [
    "pnpm --filter @kaneo/web test src/hooks/use-task-filters-with-labels-support.test.tsx passes with exactly one more test than before",
    "The eight pre-existing tests in the file are unmodified",
    "Mutation check: temporarily changing clearFilters to a no-op makes the new test fail; restore afterwards",
    "pnpm exec biome ci apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx is clean"
  ]
}
```

Nits N1–N6 need no packet. If the orchestrator wants N1 folded into a dispatch, it is a single-line
deletion of `updateLabelFilter: _updateLabelFilter,` at `apps/web/src/components/board/board-toolbar.tsx:137`
(leaving `BoardToolbarProps` and the `board.tsx` call site untouched); I confirmed typecheck passes
with that line removed.

---

## Closing note on quality

Setting B1 aside — which is a gap in `design.md`'s enumeration, not in the execution — this is
unusually disciplined mechanical-tier output. `filterTasks` is verbatim to the byte, the codec matches
its spec line for line including both named comma-invariant tests, the memoisation strategy is
implemented exactly as designed and directly asserted with reference equality, and the toolbar
regression test genuinely reproduces router batching semantics instead of asserting on a spy. The one
deviation the tier introduced on its own initiative (`_updateLabelFilter`) was a correct response to a
real compiler constraint the design had mis-diagnosed, and it chose the conservative option.

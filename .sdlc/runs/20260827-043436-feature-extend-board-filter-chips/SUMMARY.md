# Final Report — Board filter chips with URL-persisted state

- **Run:** `20260827-043436-feature-extend-board-filter-chips`
- **Mode:** brownfield · **Intent:** `feature-extend` · **Policy:** `opus-only-v5` · **Auth mode:** `estimated`
- **Rollback anchor:** `5d1fc9104337786c3ef295ec0dc31656df371d8d` (unchanged — **nothing was committed, pushed, or opened as a PR**)
- **Outcome:** complete, all four gates approved, zero test regressions.

---

## 1. What shipped

An assignee/label filter-chip row on the project Board, with that filter state moved into the URL
so a filtered board is linkable and survives reload and back/forward. Filtering remains
**client-side** over already-loaded tasks: no API, Valibot, OpenAPI, typed-client, database or
dependency change.

A chip row already existed in *aggregate* form (one chip per subject, "N selected", one X). This
run decomposed the **assignee** and **label** subjects into per-value chips with per-value removal,
extracted the row into its own component, and added a clear-all control. `status`, `priority` and
`dueDate` keep their aggregate chips, unchanged.

### Verification

| Check | Baseline | After | Result |
|---|---|---|---|
| `pnpm --filter @kaneo/web test` | 36 files / 112 tests | **39 files / 200 tests** | 0 failures, 0 regressions, +88 tests |
| `tsc --noEmit -p tsconfig.app.json` | clean | clean | pass |
| `tsc --noEmit -p tsconfig.node.json` | clean | clean | pass |
| `biome check` (non-writing, 10 changed paths) | — | clean | pass |

The dnd-kit half of AC-7 is **not covered by any automated test** — see section 5.

---

## 2. Files touched — 10, all inside the 7 allowlist globs

**Modified (5)**

| Path | Change |
|---|---|
| `apps/web/src/components/board/board-toolbar.tsx` | chip block extracted; 8 orphaned symbols removed; `toggleLabelGroup`/`clearLabelFilters` rewritten to single-commit; `updateLabelFilter` prop dropped |
| `apps/web/src/hooks/use-task-filters-with-labels-support.ts` | optional controlled 4th arg; render-phase `filters` memo; single `commit` write path; storage mirror now persists the *effective* filters |
| `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` | appended a controlled-mode `describe`; the two pre-existing tests are untouched in body |
| `apps/web/src/routes/.../project/$projectId/board.tsx` | `validateSearch`; controlled wiring; first-mount storage seed; **`handleCloseTaskSheet` fix** |
| `i18n/en-US.json` | 3 new static keys |

**New (5)** — all under `apps/web/src/components/board/`:
`board-search-params.ts`, `board-search-params.test.ts`, `board-search-params.router.test.tsx`,
`board-filter-chips.tsx`, `board-filter-chips.test.tsx`

Net: **5 files changed, 508 insertions, 252 deletions**, plus 5 new files.

Nothing under `apps/api/**`, `packages/**`, `main.tsx`, any `package.json`, `pnpm-lock.yaml`,
`biome.json`, `.gitignore`, the 16 non-en-US locales, or `i18n/schema.json` was touched.

---

## 3. Divergences from approved requirements — both traceable

### 3.1 FR-14 to `assignee?: string` instead of `string[]` *(accepted at Gate 2)*

`requirements.md` FR-14 specified `BoardSearchParams.assignee?: string[]`. The implementation
stores a canonical joined **string**.

**Why it was forced.** `apps/web/src/main.tsx` calls `createRouter` with no `stringifySearch`
override, so TanStack Router's default applies. That stringifier JSON-encodes any value where
`typeof val === "object"`, so an array surfaces as `?assignee=%5B%22u1%22%5D` — precisely the
encoding OQ-2 rejected. The only place to change it is `main.tsx`, which was off-limits, and
overriding it would alter URL semantics for every route in the app. The `string[]` shape survives
one layer in: the route derives it during render via `parseFilterList` and it never reaches the URL
boundary.

### 3.2 OQ-2 separator comma to dot *(revised by the user at the P3 canary escalation)*

Gate 1 chose comma-separated `?assignee=u1,u2`. The implementation writes `?assignee=u1.u2`.

**Root cause.** The architect's static reading of `stringifySearch` was correct as far as it went —
`stringifyValue` passes a plain string through untouched, with no JSON encoding and no `%5B`. The
encoding happens one layer lower, in `qss.encode()`:

```js
const result = new URLSearchParams();
result.set(key, stringify(val));
return result.toString();   // form-urlencoding: comma becomes %2C
```

`URLSearchParams.toString()` percent-encodes the comma, yielding `?assignee=u1%2Cu2`. Functionally
exact (the matching `decode()` reverses it) but not the readable URL the feature exists to produce.
Of the characters that survive that encoding unescaped — `.`, `*`, `-`, `_` — ids are cuid2
(`[a-z0-9]{24}`), so all four were collision-free; `.` reads best.

**The reader accepts BOTH dot and comma**, so hand-typed and previously-shared comma links keep
working, and a legacy comma URL is canonicalized to the dot form on the next filter change.

**This is why P3 existed.** The canary was deliberately sequenced before any board wiring; it cost
one packet to catch and would otherwise have shipped as a wrong URL format discovered in review.

---

## 4. Review outcomes

**Security review — PASS WITH FOLLOW-UPS.** Both findings fixed in this run.

| Sev | Finding | Resolution |
|---|---|---|
| **Medium** | A literal U+0000 byte in `board-filter-chips.tsx` made git classify the file as **binary** (`--numstat` gave `-` `-`, all 353 lines invisible in a PR diff) and made `grep` skip it entirely — exempting the largest new file from secret scanning and grep-based CI lint | rewritten as an `\u0000` **escape**; `git` now reports 355 lines and `grep` matches. A comment records why it must stay escaped |
| **Low** | `parseFilterList` capped each entry's length but not the entry **count**; an array-shaped param (`?a=1&a=2` or a JSON-array link) walked all N. Measured 32 MB to 2.44 s main-thread block | `.slice(0, MAX_FILTER_VALUES)` before iterating; the stale doc claim corrected |

**Senior code review — 1 major + 6 minor; 6 fixed, 1 deferred.**

| ID | Finding | Resolution |
|---|---|---|
| **M1 (major)** | The storage seed read `localStorage` inside an effect, while the hook mirrors filters back to the same key in *its* effect. Correctness depended on `useEffect` registration order — hoisting the hook call above the seed block would have silently wiped the user's persisted filters | storage is now read **during render** via a lazy `useState` initializer, which no effect ordering can race; the decision was extracted to a pure `buildStorageSeedSearch` with 6 unit tests |
| m1 | claimed the `groupKey` comment was stale | **the senior reviewer was wrong** — see section 6 |
| m2 | canary test name said "comma-joined" while asserting dot | renamed |
| m4 | invariant documented per-*handler*, actually per-*render* | reworded to cover two user actions inside one pre-navigate window |
| m5 | the i18n test was tautological — with `t()` stubbed to identity the component *cannot* render English, so the assertion could never fail | replaced with a source-level assertion, verified to catch hardcoded JSX text and `aria-label`s without false-positiving on `t()` |
| m5b | null-not-empty-array was pinned for assignee only | added the label-group case |
| **m3** | `updateLabelFilter` is dead in the UI after the R-9 rewrite | **DEFERRED — see section 5** |

Both reviewers independently traced all remaining `updateFilter`/`updateLabelFilter` call sites and
confirmed no second violation of the one-commit-per-render invariant, and that the writer graph is
acyclic (NFR-2 / NFR-3).

### Bugs this run found in pre-existing code

- **R-9.** `toggleLabelGroup` and `clearLabelFilters` looped over a per-id mutator. Correct under a
  functional `setState`; under the controlled model each iteration would read the same pre-change
  value and fire its own `navigate`, half-toggling a multi-id label group and leaving N-1 junk
  history entries. Rewritten to single-commit form.
- **R-2 / FR-19.** `handleCloseTaskSheet` navigated with an empty search object — correct while
  `taskId` was the only search param, silently destructive the moment filters joined it. Closing the
  task sheet would have discarded every active filter. Now clears only `taskId`, pinned by two
  independent tests.

---

## 5. Open items — nothing here is silently omitted

1. **Manual browser pass still required (AC-7, dnd-kit half).** There is **no automated coverage**
   for drag-and-drop under active filters, and this report does not claim any. The realtime half
   *is* tested (a `project` prop change re-filters, which is exactly the
   useGetTasks to setProject to filteredProject contract). Please verify by hand:
   *filter by an assignee, drag a card between columns, confirm it stays visible and the URL is
   unchanged.* A dnd-kit test would require simulating pointer sensors against a full board render
   and would mostly exercise dnd-kit rather than this delta.

2. **Deferred: senior finding m3 — `updateLabelFilter` is dead in the UI.** After the R-9 rewrite no
   component calls it. It is retained deliberately: it remains part of the hook's public return,
   FR-11 requires that shape stay backward-compatible, and the controlled-mode tests exercise it.
   Removing it is a separate decision, not a defect. **Open.**

3. **i18n follow-ups — both out of allowlist by design.** Three keys were added to `i18n/en-US.json`
   only (`tasks.boardFilters.removeFilter`, `.operators.is`, `.operators.includes`). Neither command
   below is wired into `turbo test` or CI, so neither could fail this run; at runtime `fallbackLng`
   renders the English copy in every locale.

   ```bash
   pnpm i18n:check        # lists the 3 keys as missing for the 16 non-en-US locales
   pnpm i18n:check:fix    # copies the en-US values across as placeholders
   pnpm i18n:schema       # regenerates the stale i18n/schema.json (additionalProperties:false)
   ```

4. **`.gitignore` — `.sdlc/` is deliberately NOT ignored** (your Gate 0 decision; you keep run
   artifacts tracked and pushed). Consequence worth stating: **`git add -A` will sweep this run's
   `.sdlc/` artifacts into the commit.** That is by design, not an oversight. Stage selectively if
   you want the code change alone.

5. **Pre-existing dependency advisory — not from this run.** `pnpm audit --prod` reports 2 highs
   (`nanoid`, `deepmerge-ts`), both reached via `better-auth` in `apps/api`, neither in the web
   runtime. No dependency was added or changed here. (`npm audit --omit=dev` fails with `ENOLOCK` in
   this pnpm workspace; `pnpm audit --prod` is the equivalent.)

6. **Provenance record was partially reconstructed.** The `--before` provenance calls were missed
   for the P2 and P5 new files and backfilled afterward. `provenance.json` lists all 10 paths with
   correct hashes, but for those 4 the pre-write record was rebuilt rather than captured live. Since
   all 4 are *new* files this is inert (there is no prior content to restore), but the record is not
   a pure live capture.

---

## 6. Where the two reviewers disagreed, and how it was settled

The security reviewer reported a literal U+0000 in `board-filter-chips.tsx`. The senior reviewer
read the same line and reported the opposite — that the comment claimed U+0000 but the code used a
space.

Settled by execution rather than by reading:

```
git diff --numstat   ->  -   -     (binary)
grep  -c "style=" .  ->  exit 1    (no match)
grep -ac "style=" .  ->  exit 0, 1 match
perl -0777 -ne 'print if /\x00/'  ->  matches exactly this one file
```

The security reviewer was right. The senior reviewer's tooling rendered the NUL as a space — which
is precisely the hazard being reported, demonstrated live. Note also that the security reviewer's
own first secret-and-sink sweep returned *no hits* for this file: a "clean" result that was not a
result at all, because grep had skipped the file. It re-ran with `grep -a`.

**Lesson worth carrying:** a grep that returns nothing across a changed-file sweep should be
distrusted until the files are confirmed to be text.

---

## 7. Cost — `estimated` mode

Auth mode was `estimated`: every direct-tier call was measured with the ~3.8 chars/token heuristic
and priced from the `opus-only-v5` policy's `pricing` block (input $5/M, input_cached $0.50/M,
output $25/M). **These are estimates, not vendor-reported billing.** One event — the pre-check
smoke packet — carries real vendor tokens (`provenance: "vendor"`); the other 13 are `estimated`.

| Phase | Events | Input | Cached | Output | Cost (USD) |
|---|---:|---:|---:|---:|---:|
| requirements_analysis | 1 | 62,000 | 40,000 | 4,200 | 0.2350 |
| change_plan | 1 | 124,600 | 60,000 | 22,500 | 0.9155 |
| plan_task_packets | 1 | 150,000 | 95,000 | 4,500 | 0.4350 |
| codegen | 6 | 888,391 | 752,019 | 20,906 | 1.7237 |
| tests | 2 | 340,000 | 290,000 | 6,000 | 0.5550 |
| test_run | 1 | 202,000 | 178,000 | 1,800 | 0.2540 |
| senior_code_review | 1 | 112,000 | 58,000 | 17,000 | 0.7240 |
| security_review | 1 | 68,000 | 34,000 | 9,000 | 0.4120 |
| **TOTAL** | **14** | **1,946,991** | **1,507,019** | **85,906** | **~ $5.25** |

Single-tier run: every phase routed to `claude-opus-5` per `opus-only-v5`, so there is no
cheap-tier/premium-tier split to report. Hard cost cap was $50; the run used ~10.5% of it.

The `tests` row contains **two** P3 events — the canary's initial failure and its retry after the
separator change. The failure is retained in telemetry rather than overwritten, which is why
`success: false` appears once for `tp_P3_router_canary`.

---

## 8. How to undo this run

The rollback anchor is `5d1fc9104337786c3ef295ec0dc31656df371d8d` and **HEAD is still there** —
nothing was committed. The 5 modified files are tracked; the 5 new files are **untracked**, so
`git checkout` alone will not remove them:

```bash
# 1. revert the 5 modified tracked files
git checkout -- \
  apps/web/src/components/board/board-toolbar.tsx \
  apps/web/src/hooks/use-task-filters-with-labels-support.ts \
  apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx \
  'apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx' \
  i18n/en-US.json

# 2. delete the 5 new untracked files (git checkout does NOT touch these)
rm apps/web/src/components/board/board-search-params.ts \
   apps/web/src/components/board/board-search-params.test.ts \
   apps/web/src/components/board/board-search-params.router.test.tsx \
   apps/web/src/components/board/board-filter-chips.tsx \
   apps/web/src/components/board/board-filter-chips.test.tsx
```

Or `/mmo:revert 20260827-043436-feature-extend-board-filter-chips`, which reads
`provenance.json` (all 10 paths recorded — see section 5 item 6 for the one caveat).

Do **not** use `git clean -fd` unless you intend to delete `.sdlc/` too — it is untracked and not
ignored (section 5 item 4).

---

## 9. Artifacts

| File | Contents |
|---|---|
| `intent_brief.md` | goal, scope, 10 acceptance criteria, non-goals (Gate 0, frozen) |
| `discovery.md` / `baseline.json` | repo snapshot, stack detection, test baseline |
| `requirements.md` | delta requirements — 11 verified facts, DR-1..8, FR-1..23, NFR-1..10 |
| `change_plan.md` | delta design (1,075 lines) — URL contract, hook API, loop proof, test plan |
| `packets.json` | the 7-packet plan with dependencies and atomic groupings |
| `review.md` | senior code review |
| `security_review.md` | security review (changed files only, per the intent matrix) |
| `telemetry.jsonl` | 14 events |
| `manifest.json` | rollups |
| `provenance.json` | all 10 touched paths for `/mmo:revert` |
| `SUMMARY.md` | this report |

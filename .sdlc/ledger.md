# SDLC run ledger

One row per completed `/mmo:*` run in this repository.

**This file was created on branch `feature-extend-3/flash-only`.** Ledgers from earlier runs were
committed on other branches and are not reachable from here, so this starts fresh rather than
appending to nothing. Expect to reconcile branches when these are merged.

| Run ID | Date | Mode / intent | Policy | Cost | Dispatches (fail) | Tests before → after | Files | Outcome |
|---|---|---|---|---|---|---|---|---|
| `20260826-103235-feature-extend-board-filter-chips` | 2026-08-26 | brownfield · feature-extend | `flash-agsdk-only` (single-tier, gemini-3.7-flash via antigravity-worker, vertex-adc) | **$6.1841** | 21 (3) | 36 files/112 → 37 files/148, all passing; typecheck 0 both | 10 (2 added, 8 modified) | Accepted at Gate 4. Not committed. |

## Run notes — `20260826-103235-feature-extend-board-filter-chips`

**Ticket.** URL-persist the board's five filters (status, priority, assignee, dueDate, labels) in
TanStack Router search params. Chips already existed and were not rebuilt; `BoardToolbar`'s props
are byte-identical.

### Why this run exists — the policy comparison

This was the **controlled arm** of a comparison against `opus-plus-flash-v37`, which ran the
identical ticket from the identical Gate 0 decisions and file scope.

| | `flash-agsdk-only` (this run) | `opus-plus-flash-v37` |
|---|---|---|
| Cost | **$6.1841** | **$2.70** |
| Ratio | **2.29× more expensive** at roughly **1/6** the per-token price | — |

**Cause: agent-adapter shape, not the rate card.** This policy's only tier is an *agent*, not a
completion endpoint. Workers are handed a working directory and read the repository themselves —
listing, grepping, opening and re-opening files — instead of consuming the pre-sliced `inputs[]` a
completion-tier packet carries. Token shape: **6.9M billed input (2.49M fresh + 4.43M cached) against
199K output.** Output never drove cost. Two dispatches show it plainly: the first change-plan billed
357,812 fresh + 1,102,129 cached for a single document ($0.9622); the senior review billed
550,855 + 1,004,866 ($1.2328).

**Transferable lesson: do not rank policies by $/Mtok.** A cheap model that reads the repo itself can
cost more than an expensive model handed a slice.

### Quality outcome

- **Genuine find by the Flash senior review:** the `clearLabelFilters` / `toggleLabelGroup`
  composition regression at `board-toolbar.tsx:239-251`. Those handlers call `updateLabelFilter` N
  times in a single handler; the pre-run hook used `setFilters(prev => …)` so calls composed, and the
  reworked hook computed each `next` from the render-scoped memo, so only the last survived —
  clearing three labels would have removed one. Raised from the review's "major" to blocker and fixed
  with a within-tick accumulator (`pendingFiltersRef`); no `useState` reintroduced.
- **AC5 (board/list view switching) and AC6 (browser Back) ship UNPROVEN**, accepted knowingly by the
  user, recorded as the reviewer framed them — not reclassified as satisfied. AC5 has a sound
  by-construction argument (`viewMode` is Zustand, not routing, so toggling it cannot touch search
  params) but no test. AC6 has `replace: true` verified in code and test, but no history traversal
  test; the reviewer also flagged a push/replace asymmetry between task-card deselect and
  `handleCloseTaskSheet` that can make the first Back appear to do nothing. Future work: a
  view-toggle test for AC5, a popstate test for AC6. **This is the run's principal quality gap.**
- **Three fail-before-fix proofs**, each re-run against reverted source: (A) revert `task-row.tsx` →
  2 nav tests fail, pre-existing test still passes; (B) revert the hook → 9 of 12 fail incl.
  URL-precedence, the 3 unchanged `it.each` cases still pass; (C) revert the stale-closure fix → the
  2 composition regression tests fail.
- Security: 0 critical/high/medium. SEC-01 Low (oversized array walked before the 50-item cap) and
  SEC-02 Informational (opaque user IDs in shareable URLs; server-side authz unaffected), both
  accepted as risks rather than logged as defects.

### Attribution — both directions

**Flash produced:** requirements, both change-plan revisions, `packets.json`, all source and test
code, the senior review (including the blocker above), the security review.

**The orchestrator authored five design corrections** (`change_plan.md` §Addendum A), not Flash: a
hook signature that dropped `projectId` and `textQuery`; wrong `Project` types; a mirror effect that
would have reintroduced the exact clobber the Gate 2 overturn removed; a hook calling `navigate()`
against the injection decision; and a packet requiring a test to pass "verbatim" that the design made
structurally impossible. The Gate 2 defect list was likewise orchestrator-authored, against a plan
reporting `uncertainties: []` while containing two blocking self-contradictions.

**Flash was right where the orchestrator was wrong:** the orchestrator suspected the plan's
`expect.toSatisfy` asymmetric-matcher pattern was invalid, checked `@vitest/expect@4.1.10`, and found
it documented at `dist/index.d.ts:201`. Checking beat asserting in both directions.

### Reliability — a policy property

**3 hard failures in 21 dispatches**, ~9 minutes, **$0** (a dying worker writes no usage sidecar):
Vertex `auth: "internal_failure"`; a WSL DNS timeout on `oauth2.googleapis.com`; and one run that
looped, hit `max tokens` ×3, then invented a nonexistent `edit_file` tool.

**The DNS failure's consequence chain is the operational lesson.** That worker died *after* writing a
complete 140-line test artifact, during its own verification step. The orchestrator inspected it,
found it complete, ran the tests itself (24/24) and kept it rather than re-dispatching. **The save was
correct — but because the worker never reached verification, nobody ran `tsc` on it.** Thirteen
`TS2769` errors (an `it.each` array mixing scalars with `[]` and `[1,2]`, which vitest treats as
argument tuples) surfaced later at the full-suite gate and needed a debug packet. **Rescuing an
artifact from a failed dispatch also rescues its unfinished verification; re-run the full check
matrix, not just the part you happened to think of.**

**Structured output is unreliable on this adapter: 3 of 18 successes leaked prose ahead of their
JSON**, so `JSON.parse` fell back to `{ raw: … }` and fields needed hand-extraction. Worker
self-reports also need checking — one claimed `typecheck_exit_code: 0` having run `tsc --noEmit`
without the project flags.

### Containment — held with ZERO enforcement layers active

All three documented layers were inert:
- **Layer 2** (packet validator) is documentation-only in this build — `artifact_path` has no reader.
- **Layer 3** (PreToolUse hook) never fired. Verified at closeout: a `Write` to an off-limits path was
  **allowed**, while the same input piped to the script manually **denied with exit 1**. The script is
  correct; it is not being invoked.
- The worker path was never covered regardless, since agent workers edit files from a separate process.

**The orchestrator's `git status --porcelain` sweep after every one of the 21 dispatches was the only
containment that existed. Result: 0 out-of-scope writes, 0 reverts, exactly 10 files changed.** Clean:
`apps/api/**`, `main.tsx`, `routeTree.gen.ts`, `store/user-preferences.ts`, `project-layout.tsx`,
`backlog-list-view/**`, `i18n/**`, `packages/**`, `pnpm-lock.yaml`.

### State

HEAD `5d1fc910`, branch `feature-extend-3/flash-only`, **0 staged, nothing committed**. Rollback
recipe in `runs/20260826-103235-feature-extend-board-filter-chips/SUMMARY.md` §11.

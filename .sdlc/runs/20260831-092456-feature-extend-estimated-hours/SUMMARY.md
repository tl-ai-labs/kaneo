# Run summary — feature-extend: estimated hours with per-column rollup

**Run** `20260831-092456-feature-extend-estimated-hours` · **policy** `flash-agsdk-only`
(gemini-3.7-flash via **antigravity-worker**, vertex-adc, project `ai-studies-console`) ·
**auth_mode** `estimated` · **base** `5d1fc9104337786c3ef295ec0dc31656df371d8d`
· branch `feature-extend-2/flash-agsdk`

Fifth leg of a five-way policy comparison. Every line written fresh against this branch;
no sibling branch was read. See "Containment" below for the evidence.

## Result

**$8.0995** · 34 dispatches (2 failed, both $0) · 68.6 min in dispatch, ~105 min elapsed ·
39 files changed (28 modified, 11 new) · 2.49M+ input / 6.78M+ cached / 188k+ output tokens.

| Verification (frozen at Gate 0) | Result |
|---|---|
| `pnpm --filter @kaneo/api test:unit` | 59 files / 377 tests passed |
| `pnpm --filter @kaneo/web test` | 39 files / 131 tests passed |
| `pnpm --filter @kaneo/api typecheck` | pass |
| `pnpm --filter @kaneo/web typecheck` | pass |
| `pnpm exec biome ci` (changed paths) | 38 files, 0 errors |
| `pnpm i18n:check` (AC-7, added at Gate 2) | byte-identical to HEAD baseline; no new failure |

Integration tests deliberately excluded. PostgreSQL **was** available via Docker; AC-9 does not
require them and no sibling leg ran them, so including them would have given this leg stronger
verification than its comparators. A deliberate scope decision, not an unavailable resource.

Senior review **APPROVE WITH NITS** (0 blockers, 0 majors, 3 nits — 2 fixed, 1 accepted).
Security review **PASS** (0 findings at any severity; 1 informational).

## Adapter findings

1. **Cost scales with turns, not with work requested.** The pre-measured "$0.018 / 10.9k fixed
   overhead" describes only trivial packets. A real agentic packet billed 267k uncached + 1.005M
   cached for one document — 40x the smoke test. The worker is an agent loop, so every internal
   turn re-bills accumulated context.
2. **Turns are substitutable with orchestrator-supplied context — but only exploration turns.**
   Phase 1 ($0.726, 25 tool calls) vs Phase 2 ($0.256, 9 tool calls) — 65% cheaper for a longer,
   more detailed document, sole variable being nine front-loaded file excerpts. Confirmed by two
   independent measures (cost and tool-call count). **The boundary**: front-loading buys back
   exploration turns, never *reading* turns. Three measurements define it — tightly-specified
   packets held at $0.044–0.060; large-file packets blew out (`task-card.test.tsx` $0.576 at 224k
   uncached + 960k cached, popover $0.547, sidebar $0.421); and senior review, the single most
   expensive dispatch at $0.752 on 1.84M cached input, had to read 19 files end to end and no
   supplied context could have substituted.
3. **Parallelism works.** Waves of 2, 4 and 5 concurrent workers, no session-store collision, no
   cross-talk. Recovered ~35 min of the 68.6 min dispatch total. Partially offsets finding 1.
4. **Failure signalling is honest.** Both failures (a WSL DNS fault, and an output-cap exhaustion)
   billed $0 and reported `success:false` / `terminal_reason:"vendor_error"`. A useful counterweight
   to the 15.1-hour pathology from an earlier run. Longest dispatch here: 370s, inside the 540s timeout.
5. **The worker executes unrequested shell commands.** It spawned `pnpm typecheck` and `pnpm test`
   inside the working tree with no packet field requesting it. Read-only here. **Nothing in the
   packet contract bounds shell access**, and none of it appeared in structured results — visible
   only by parsing tool calls.

## Configured limits that do not bind — six instances

Same shape each time: the system **records** what happened and **constrains** nothing.

| # | Control | Failure to bind |
|---|---|---|
| 1 | Write contract PreToolUse hook | classifies correctly, cannot block (`deny()` exits 1; PreToolUse blocks only on exit 2) |
| 2 | `worker_timeout_sec: 540` | did not fire after 15.1 hours (earlier run) |
| 3 | `maxOutputTokens` | 8,144 emitted against a 5,000 ceiling (earlier run) |
| 4 | Output-cap auto-doubling | never fires: cap is hit inside an internal agent turn and surfaces as `vendor_error`, which the doubling logic doesn't recognise (`hit_output_cap:false`) |
| 5 | `outputSchema` conformance | 3 dispatches returned malformed output (injected `SYSTEM_MESSAGE` blocks, object duplicated 2–3x); adapter fell back to `{raw:...}` and reported `success:true` |
| 6 | Agent shell access | no packet field bounds it (finding 5 above) |

The files were correct only because every diff was read by hand.

**#6 is qualitatively worse than the other five and is listed last for that reason.** The first
five fail to *stop* something the system knows about — it recorded the overrun, the malformed
output, the refused-but-unblocked write. #6 means the system **does not know what ran**. The
worker executed `pnpm typecheck` and `pnpm test` against the working tree and nothing in the
packet contract, the telemetry event, or the structured result reflected it. It was recoverable
only by parsing the tool-call records out of the delegation sidecar. A control that fails to
constrain is a weak control; a surface that leaves no trace is not a control at all.

## Defects caught, and where they came from

- **STRUCTURAL — provenance cannot cover packets that generate their own filenames.** The
  `--before` record that `/mmo:revert` depends on must be written *before* a file is touched, which
  requires knowing the path in advance. Drizzle-kit assigns migration tags randomly, so packet
  `tp_cg_002` produced `0043_odd_random.sql` and `meta/0043_snapshot.json` under names that did not
  exist until after the tool ran. **The triggering shape is any packet whose output filenames are
  not knowable at dispatch time** — migrations, scaffolds, and codegen with hashed, timestamped or
  randomly-tagged outputs. Every prior run across both comparisons touched only files named in
  advance, which is why five runs never surfaced it. This is a design gap in the provenance
  contract, not an operator error, and it will recur on every migration-bearing run until the
  helper gains a post-hoc "capture what appeared" mode keyed to a directory rather than a path.
  *(By contrast, the fourth unrecorded file — `tests/api/task/validate-task-fields.test.ts` — was a
  plain omission from a `--before` loop and carries no such lesson.)*
- **Operator briefing error** — the run brief stated the route convention as `PUT /:id/priority`.
  Actual repo convention is field-first (`/priority/:id`). Caught at requirements by reading the
  route strings rather than trusting either the brief or the generated document. Corrected before
  it reached the API surface.
- **Requirements defect FR-3** — specified `v.optional(v.nullable(v.number()))`, admitting `2.5` on
  the read path while FR-4 correctly constrained the write path. Caught at Gate 2, fixed at design.
- **Design defect ADR-3** — planned a standalone `assertValidEstimatedMinutes` that production would
  never call, making its test meaningless. The cited precedent (`assertValidPriority`) earns its
  place via a real second caller at `bulk-update-tasks.ts:145`; this field has no such caller.
  Replaced with an exported Valibot schema consumed by the route and exercised via `v.safeParse`.
- **Gate 0 allowlist defect** — `apps/web/src/lib/**` was absent from the frozen allowlist, though it
  is unambiguously where this repo puts pure helpers (`due-date-status.ts` + its colocated test).
  Traced to the intent brief, which enumerated fetchers/hooks/types as "payload plumbing". Caught
  **pre-dispatch by the packet validator**, not by a refused write. Amended with two exact paths.
- **Operator-authored codegen defect** — the bound `525600` was triplicated because the packet
  instructions for `tp_cg_004` and `tp_cg_015` embedded the literal instead of instructing an import.
  Found by senior review, fixed at Gate 3. Recorded as operator-authored: attributing it to the
  policy under test would have flattered the operator and corrupted the comparison.
- **Self-caught orchestrator error** — the i18n de-scoping rewrite used 2-space indent against the
  repo's tabs, inflating the diff to 34k lines. Caught by reading the diff, re-indented, confirmed
  with `biome ci`.

## Scope decisions recorded

- **`i18n:check` added to the frozen verification set at Gate 2**, on operator authority, as AC-7's
  proof. The operator's stated justification ("adding a key to en-US alone leaves the repo failing
  its own CI gate") rested on a **false premise about the baseline** — measurement showed
  `i18n:check` already exits 1 at HEAD. Corrected at codegen: AC-7 is proven not by a passing exit
  code, which has never been true on this branch, but by all 17 locales carrying all six new keys
  with check output byte-identical to HEAD.
- **`pnpm i18n:check:fix` silently fixed 240 unrelated keys** (15 pre-existing `common:error.*`
  sub-keys x 16 locales). Reverted per AGENTS.md ("do not mix unrelated cleanup"); the final i18n
  diff is 153 insertions / 17 deletions — the six feature keys plus 17 commas. The pre-existing
  backlog remains and deserves its own run.

## Containment

`.sdlc/` is untracked and survives `git checkout`, and all four sibling branches are local with
complete implementations one commit below their tips. One dispatch (`tp_plan_001`) **attempted** to
read another run's `packets.json`; the read failed and nothing leaked. Notably, that was the one
packet whose instruction omitted the containment clause.

Response: the clause was reinstated verbatim on every subsequent packet, and a hard-abort auditor
was built over the per-dispatch `worker-delegation-*.json` tool-call records. It fired once, on
`tp_cg_010`/`tp_cg_018` reading the worker's own Antigravity session logs (297–480 bytes of
`pnpm typecheck` output). A recursive grep of the whole brain tree for sibling branch names,
`git show`, `git cat-file` and `git diff <sha>` returned nothing. **Rule narrowed on evidence after
it fired** — `~/.gemini/antigravity/brain/**` permitted, foreign `.sdlc/runs/**` and any git
invocation still hard-fail. Final audit: **CLEAN across 34 records / 352 tool calls.**

## Known gaps — provenance

**Four** of the 39 changed files have no provenance record (35 of 39 are recorded). `/mmo:revert`
will not handle these four. Manual steps:

```
rm apps/api/drizzle/0043_odd_random.sql                # new, tool-generated
rm apps/api/drizzle/meta/0043_snapshot.json            # new, tool-generated
git checkout -- apps/api/drizzle/meta/_journal.json    # TRACKED + modified: RESTORE, do not delete
rm tests/api/task/validate-task-fields.test.ts && rmdir tests/api/task
```

`_journal.json` is the one that bites: it is tracked and modified, so deleting it rather than
restoring it would break every migration in the repo.

Cause: the three drizzle artifacts are written by `pnpm --filter @kaneo/api db:generate` inside
packet `tp_cg_002`, and drizzle-kit assigns the migration tag randomly (`0043_odd_random`), so no
`--before` could be recorded for filenames not knowable in advance. **This is a structural gap in
the provenance design for tool-generating packets, not an oversight.** The test file, by contrast,
was a plain orchestrator omission from a `--before` loop.

Neither was back-filled: calling `--before` after the write records the written content as pristine,
converting a visible gap into a silent false record.

**Method note — why this correction exists at all.** Gate 3 reported *one* gap. The true count is
four. It was found by reconciling `provenance.json` against `git status --porcelain` as a set
difference, rather than by trusting the running commentary of which `--before` calls had been made.
Self-reported counts drift across a long run; a reconciliation against ground truth does not. Any
run using this provenance contract should close with that reconciliation rather than with a tally.

## Accounting caveat

Under `flash-agsdk-only` no phase routes to the orchestrator's own tier, so orchestration tokens are
not billed to this run and are absent from every total here. Directly comparable to the
`flash-vertex-only` leg; **not** comparable on this axis to legs with premium-tier phases.

# Run 4 of 4 — opus-plus-sonnet-max — PublicColumnHeader extraction

Run id `20260828-081120-refactor-lane-header` · brownfield · intent `refactor` ·
policy `opus-plus-sonnet-max` · auth `vendor` · branch `refactor/opus-sonnet` @ `5d1fc910`

## Headline: four policies, one byte-identical output

Identical **source output** across all four runs: `public-column-header.tsx` and
`kanban-view.tsx` are byte-identical across opus-plus-flash-v37, flash-agsdk-only, opus-only-v5 and
opus-plus-sonnet-max. Four policies spanning gemini-3.7-flash through claude-opus-5, three different
adapters, a 2.6x measured cost spread — and the source output does not vary at all.

**Scope, stated deliberately: this is one small, tightly-specified refactor.** That clause is not
hedging. It is what stops a reader generalising the result to work where the model's judgment
actually has room to vary. The result is strong precisely because it is bounded.

| Run | Policy | Auth | Cost (excl. pre-check) | Wall-clock |
|---|---|---|---|---|
| 1 | opus-plus-flash-v37 | estimated | $0.9731 | ~30m |
| 2 | flash-agsdk-only | estimated | $1.0323 | 15.43h |
| 3 | opus-only-v5 | vendor | $2.58435 | 26m44s |
| 4 | **opus-plus-sonnet-max** | **vendor** | **$2.037228** | **~35m** |

Run 4 is 21.2% cheaper than run 3. The saving comes **entirely** from three small codegen packets
moving from opus to sonnet ($0.229141 total). Every other phase is premium in both runs.

## Cost breakdown (vendor-reported by `claude -p`, excl. $0.0677152 pre-check smoke)

| Phase | Model | Rule | Packets | Cost | Latency |
|---|---|---|---|---|---|
| requirements_analysis | opus | 0 | 1 | $0.294686 | 59.6s |
| change_plan | opus | 6 | 1 | $0.350378 | 94.9s |
| plan_task_packets | opus | 2 | 1 | $0.276842 | 62.7s |
| codegen | **sonnet** | 7 | 3 | $0.229141 | 21.8s |
| senior_code_review | opus | 3 | 1 | $0.636680 | 121.2s |
| security_review | opus | 4 | 1 | $0.249502 | 457.0s |
| **Total** | | | **8** | **$2.037228** | 817.3s model time |

opus $1.808087 (88.8%) · sonnet $0.229141 (11.2%) · 0 retries · 0 output-cap doublings.

## Routing bend — REQUIRED, APPLIED, VERIFIED

The `opus-plus-sonnet-max` codegen rule (index 7) matches an explicit `task_type` allowlist
containing `react_component` but **none** of the brownfield primitives (`new_file_add`,
`existing_file_edit`). Without the bend all three codegen packets miss every rule, fall through to
`default: opus`, and silently run mechanical work at premium rates.

Applied as run 1 did: `task_type: "react_component"`, brownfield primitive in `subtype`.

**Verified from telemetry events, not from packet construction.** All three codegen events carry
`model_id: sonnet`, `model: claude-sonnet-5`, `rule_index: 7`. Codegen events routed to opus: **0**.

This is the confirmation run 1 never obtained. Run 1 applied the identical workaround against the
identical rule structure and never checked — its mechanical routing is **unverified, not wrong**.
Its $0.033 Flash share is consistent with the bend having worked but does not prove it, because a
fallthrough to opus would have shown up as premium cost that its character-heuristic estimates
would have blurred anyway.

Proper fix (not applied — comparability): add `new_file_add` / `existing_file_edit` to the codegen
rule's `task_type` list in the policy YAML.

## Finding: under `claude-cli`, a premium dispatch is a delegated agent, not a model call

Evidence from this run's `senior_code_review` event:

- **288,246 cached input tokens against 26,575 fresh.**
- The reviewer's own output describes running `git show HEAD:apps/web/src/components/public-project/kanban-view.tsx`
  and reading `constants/column-icons.ts` and `test/setup.ts` — **files never placed in the packet**.
- It reported that its sandbox **declined** the vitest, typecheck and `biome ci` invocations.

Three consequences:

1. **It explains the cost shape.** Senior review at $0.6367 was the single most expensive phase of
   the run — more than requirements and packet-planning combined — for reviewing a 22-line component.
2. **Run 3's all-opus $2.58435 was eight delegated agent sessions, not eight model calls.** That is
   not an error in run 3's figure, but it is a different thing from what "dispatch to opus" sounds
   like, and anyone comparing these numbers to raw API pricing will be wrong.
3. **It reframes the review-cost hypothesis from run 3.** The 43% review share there, and $0.886
   across both reviews here, is not premium-model pricing on a small diff — it is agent sessions
   doing their own repo exploration on a small diff. The lever is not "route review by diff size"
   alone but "premium review under claude-cli re-reads the repo regardless of diff size."

## Verification

| Check | Command | Result |
|---|---|---|
| typecheck | `pnpm --filter @kaneo/web typecheck` | exit 0 |
| test (full suite, per refactor intent) | `pnpm --filter @kaneo/web test` | exit 0 — 37 files / 113 tests passed, 29.60s |
| lint (changed paths only) | `pnpm exec biome ci <3 paths>` | exit 0 — 3 files checked, no fixes applied |

Mechanical invariants: `grep -c getColumnIcon kanban-view.tsx` = **2**; `p-2 shrink-0` = 0 in
kanban-view / 1 in the new file; call-site literal `<PublicColumnHeader column={column} />` = 1;
`git diff --stat` = 1 file changed, 2 insertions, 13 deletions, plus 2 untracked new files.

The `as unknown as` escape hatch the change plan authorised did **not** fire. Codegen emitted the
tight `as ProjectWithTasks["columns"][number]` on a five-field partial fixture and typecheck
passes with it — matching runs 1 and 3, not run 2.

## Reviews

**Senior code review (opus, rule 3): `approve`, zero refinement packets.** All nine checks passed.

Two things it did better than the orchestrator:

- **The h3 control.** It independently reached the same conclusion about the one-line `<h3>` being
  a Biome 80-column width effect rather than a hand edit, and added a control neither the
  orchestrator nor the coordinator had thought of: the *longer* adjacent `<span>` stays wrapped at
  the shallower indent, which is exactly what a width-driven reformat looks like and what a hand
  edit would not produce.
- **It refused to report the tests as green when its sandbox declined to run them**, and said so
  explicitly. A reviewer that reports unverified checks as passing is worse than one that cannot
  run them.

Its volunteered limitation — `container.querySelector("svg")` proves an icon rendered but not
*which* icon, so it would not alone catch a `getColumnIcon` argument-order swap — is the same
conclusion runs 1, 2 and 3 reached independently. Four for four.

**Security review (opus, rule 4): `pass`**, changed-files-only per the intent matrix. No invented
findings. Its one substantive item is `info`: the component takes the whole `column` object, so the
field list is not visible at review time, moving the opportunity to render a future field from two
review surfaces to one. It correctly located the real control in the API serializer, not this
component.

## Test file

Run 4's test differs from runs 1 and 3 only in the `it()` description, two fixture tasks instead of
three, and asserting `toBeVisible()` on all three expectations. That last point makes it the
strongest of the four — run 1 used `.not.toBeNull()` on the icon, run 2 used `toBeTruthy()`
throughout. **Not a policy result**: the coordinator specified the test shape.

## Methodology limitations of run 4

1. **The class-string-assertion observation was preempted, and that is a run-instruction error, not
   a neutral difference.** The run instruction told the orchestrator to surface class-string
   assertions if a phase proposed them, and in the same instruction forbade them in the packet.
   Those two directives cannot both be satisfied: the packet's constraint preempted the observation.
   Run 3's requirements phase proposing class-string assertions independently was a real signal
   about how this premium tier behaves when it owns requirements. **Run 4 cannot corroborate or
   contradict it. The n=1 observation from run 3 stays n=1.**

2. **The four-run set was supposed to vary policy alone, and packet prescriptiveness increased
   across the series.** Runs 3 and 4 received more prescriptive instructions than runs 1 and 2. This
   does not affect the byte-identity result — the source output is checkable against the brief
   regardless — but it does mean the cost figures are not measuring identically-specified work.
   A small concrete illustration: run 4's requirements phase cost $0.294686 against run 3's
   $0.23596 on the same model and adapter (1.25x), very likely because run 4's packet carried
   substantially more constraint text and input tokens are input tokens. Cutting the other way,
   run 4's change_plan cost $0.350378 against run 3's $0.43582 despite the heavier packet — worth
   a line, not a conclusion.

3. **Two acceptance criteria were rewritten by hand.** The requirements phase emitted AC-10 and
   AC-11 as literal `grep` invocations with nested quote escaping that would not run as printed.
   They were rewritten in prose preserving the same requirement (no `toHaveClass`/className matcher;
   `@/lib/column` not mocked). An acceptance criterion that cannot execute as printed is worse than
   no criterion, because it reads as verification that never ran. Rewriting the executable form
   while preserving the requirement is a repair, not a scope change.

4. **Invariant cross-references in `change_plan.md` were misnumbered and were fixed mechanically**
   (INV-14 → INV-13 for the `getColumnIcon` grep, INV-9 → INV-4 for header-precedes-scroll-body).
   The cause is the useful part: the change_plan packet was given a condensed prose digest of the
   invariants instead of the numbered list, so the model renumbered them itself. This is a
   packet-construction defect that recurs on any run whose plan phase cites requirements by number,
   and it is cheap to prevent by passing the numbered list.

## Finding F1 — configured limits in this plugin are descriptive, not enforcing

**One finding, three instances.** Individually each reads as a quirk; together they are a pattern
about configured limits in this plugin, and the pattern is the actionable form.

| Instance | What it does instead of binding | Observed in |
|---|---|---|
| **Write contract, layer 3** (PreToolUse hook) | `deny()` calls `process.exit(1)`; PreToolUse blocks only on exit 2, and the script emits no `hookSpecificOutput`/`permissionDecision` JSON. The gate classifies correctly, logs the denial, and permits the write — on every adapter. | all four runs |
| **Worker timeout (540s)** | Did not fire after 15.1 hours. | run 2 (flash-agsdk-only) |
| **`budget.maxOutputTokens`** | Advisory under the `claude-cli` adapter: change_plan 8,144 against a 5,000 ceiling; senior_code_review 8,928 against 5,000; plan_task_packets 5,717 against 4,000; security_review 3,072 against 3,000. All `stop_reason: end_turn`, zero doublings recorded. | run 4, across three phases |

**Implication: a named limit in this plugin should not be assumed to bind.** Each of the three
classifies or records correctly, and then permits the thing it names. This run relied on
orchestrator discipline plus the `artifact_path` allowlist check, not on layer 3.

## Proposals

**P1 — `orchestrator.md` rule 6: condition the credential requirement on the adapter set the policy resolves to, not on `auth_mode` globally.**

Rule 6 asserts globally that `vendor` mode requires `ANTHROPIC_API_KEY` and instructs the
orchestrator to abort without it. `ANTHROPIC_API_KEY` was **not set** for this run, and the run is
legitimately vendor-authoritative: both policy leaves resolve to the `claude-cli` adapter backed by
Max-subscription OAuth, which reports real `total_cost_usd` per dispatch. `builtin-anthropic` is the
adapter that needs the key, and this policy never constructs it. `preflight_dispatch` — which
actually builds the adapters — returned `ok: true` with zero warnings.

> **Proposal:** require `ANTHROPIC_API_KEY` only when the resolved adapter set for the run contains
> `builtin-anthropic`. Otherwise defer to `preflight_dispatch`, which is the only check that
> constructs the adapters and therefore the only one that can tell.

Small, correct, implementable. Recorded as a proposal so it is not lost as a passing observation.

**P2 — `opus-plus-sonnet-max.yaml`: add `new_file_add` and `existing_file_edit` to the codegen rule's
`task_type` allowlist (index 7)**, rather than bending `task_type` per-run. Not applied in this run,
deliberately, to keep the four-run comparison valid.

## Rollback

```
/mmo:revert 20260828-081120-refactor-lane-header
```

Nothing was committed. `git_head_before` == `git_head_after` == `5d1fc9104337786c3ef295ec0dc31656df371d8d`,
0 commits recorded. Provenance covers all three files; `kanban-view.tsx` was tracked and clean
before the run, so git restores it, and the two new files are untracked and are simply removed.

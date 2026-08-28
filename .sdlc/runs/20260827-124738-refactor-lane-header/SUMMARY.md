# Run Summary — refactor — Extract `PublicColumnHeader` (RUN 2 of 4)

- **Run:** `20260827-124738-refactor-lane-header`
- **Mode:** brownfield · **Intent:** `refactor`
- **Policy:** `flash-agsdk-only` (single-model floor) · **Auth mode:** `estimated`
- **Model:** `gemini-3.7-flash` via `antigravity-worker`, Vertex ADC, project `ai-studies-console`, region `global`
- **Base commit:** `5d1fc910` on `refactor/flash-only` · **0 commits made**
- **Outcome:** completed · Gates 1–3 approved · Gate 4 pending

## The headline: the two policies produced the same source code

`public-column-header.tsx` and `kanban-view.tsx` are **byte-identical to run 1's committed
versions** — not DOM-equivalent, byte-for-byte (sha256 verified against `97ea94ff`). Two policies,
one running judgment on Opus and one on a Flash floor, produced identical source output from the
same frozen brief.

| File | run 1 sha256[:16] | run 2 sha256[:16] | |
|---|---|---|---|
| `public-column-header.tsx` | `b2913c8a74beeaec` | `b2913c8a74beeaec` | identical |
| `kanban-view.tsx` | `36346b7765299120` | `36346b7765299120` | identical |
| `public-column-header.test.tsx` | `0f8566cd4e84d430` | `f16b82e0ed340602` | differs |

### The test count difference is NOT a coverage difference

Run 2 reports 112→115 tests against run 1's 112→113. **Coverage is identical.** Same three
assertions, same fixture `id: "in-progress"`, same unmocked `@/lib/column`, same
`querySelector("svg")`, no Tailwind assertions. Run 2 split them into three `it()` blocks where
run 1 used one. "+3 tests" vs "+1 test" is a packaging difference and must not be read as a
quality win.

Two real differences, both slightly favouring run 1, recorded and deliberately **not** fixed
(re-dispatching costs ~$0.25 at this adapter's overhead for no functional gain, and would override
the policy's own output a second time — which is the thing being measured):

- run 1 asserts `toBeVisible()`; run 2 asserts `toBeTruthy()`. `toBeVisible` is stronger — it
  would catch a header rendered but hidden.
- run 1 casts `as ProjectWithTasks["columns"][number]`; run 2 casts `as unknown as ...`, which
  discards more type checking on the fixture.

## Verification

| Check | Result |
|---|---|
| `pnpm --filter @kaneo/web typecheck` | exit 0 |
| `pnpm --filter @kaneo/web test` | **37 files / 115 tests passing** vs baseline 36 / 112 |
| `pnpm exec biome ci` (3 changed paths only) | exit 0, "No fixes applied" |
| Senior review | `approved_with_findings`, `dom_identical: true`, 1 nit |
| Security review | **pass**, 0 findings |

Root `pnpm lint` and root `pnpm test` were never run, per the frozen Gate 0 constraints.

The senior reviewer proved the DOM invariant mechanically — tokenizing both blocks into ordered
`(tag, className)` sequences and comparing element by element; both sequences are in `review.md`.
It answered the `h3` reflow explicitly: DOM-neutral, because `{column.name}` is an expression child
with no literal-text siblings, so both forms compile to the same
`_jsx("h3", {...children: column.name})`.

**Quality observation on the floor policy's review:** it flagged the test's `querySelector("svg")`
as weak — truthy on every `getColumnIcon` branch including both fallbacks, therefore proving *an*
icon renders rather than the *right* icon — reaching independently and unprompted the same
conclusion run 1's reviewers and the coordinator reached separately. Not actioned: the test spec is
frozen for comparability.

## Cost and wall-clock

| Phase | Packet | Cost | Wall | in | cached | out |
|---|---|---:|---:|---:|---:|---:|
| requirements_analysis | `tp_req_001` | $0.0710 | 28.2s | 27,587 | 0 | 3,291 |
| change_plan | `tp_plan_001` | $0.0810 | **15.1h** | 35,419 | 22,061 | 2,729 |
| plan_task_packets | `tp_decomp_001` | **$0.3373** | 7.9m | 157,291 | 261,194 | 6,913 |
| codegen (new file) | `tp_codegen_001` | $0.0518 | 17.6s | 23,872 | 0 | 1,778 |
| codegen (edit) | `tp_codegen_002` | $0.0985 | 30.0s | 46,283 | 21,957 | 2,863 |
| tests | `tp_tests_001` | **$0.2536** | 7.0m | 109,819 | 171,869 | 7,014 |
| senior_code_review | `tp_review_001` | $0.1037 | 2.3m | 41,515 | 0 | 4,607 |
| security_review | `tp_sec_001` | $0.0353 | 16.7s | 12,091 | 0 | 1,908 |
| **Pipeline total** | 8 packets | **$1.0323** | **15.43h** | 453,877 | 477,081 | 31,103 |
| — pre-check smoke (excluded, ran before pipeline) | | $0.0187 | | | | |
| telemetry.jsonl file total | | $1.0510 | | | | |

By model: `gemini-3.7-flash` **$1.0323 (100%)**. This policy has no premium tier.

---

# Findings

## 1. The write-contract hook is structurally blind to this adapter

Three real writes to user source landed via the Antigravity worker's **own process**, not through
Claude Code's `Write`/`Edit` tools. The PreToolUse hook matches on `Write|Edit` and therefore never
fired. `.hook-logs/hook.jsonl` holds **268 `mcp_tool_postuse` events and zero write-decision
entries**.

Run 1's hook was merely *unexercised* (every write happened to target an allowlisted path). Here it
was **bypassed**. Only enforcement layer 2 — `artifact_path` validation against the allowlist, which
was confirmed for all three paths before dispatch — actually constrained this run.

**On this adapter the refusal path cannot be proven, because the hook is not in the write path at
all.** That is a safety property the plugin advertises and does not deliver here.

## 2. A 9-minute timeout that did not fire after 15 hours

`tp_plan_001`: `worker_timeout_sec: 540` configured, actual `duration_ms: 54,415,269` (**15.1
hours**), `timed_out: false`, `success: true`, `error: null`, exit 0, 3 tool calls, normal cost and
token counts. **Nothing in telemetry marks the run as anomalous.**

The host almost certainly slept, but that does not excuse it: a configured nine-minute timeout must
either fire or be recorded as not-fired. The MCP client aborted at ~54,343s with an idle timeout, so
the response payload never reached the orchestrator. The result was recovered from
`delegation/worker-usage-tp_plan_001.json` (`text` field) rather than re-dispatched, so the $0.0810
was billed exactly once.

A policy that is cheaper per token but stalls unattended is not cheaper in practice — which is why
wall-clock is a first-class column above.

## 3. Cost inversion — caveat first, number second

**Caveat:** run 1's $0.9731 has six of eight phases as Opus **estimates**, three of them corrected
upward mid-run after the char heuristic undercounted per-turn context re-send. Run 2's $1.0323 is
**8 of 8 vendor-reported** — this policy has no premium tier, so no phase ran in-session and nothing
was char-estimated.

**Number:** run 1 $0.9731 → run 2 $1.0323, i.e. the all-Flash floor policy cost **1.06×** the mixed
Opus+Flash policy for byte-identical source output.

**This is a vendor-vs-estimate comparison, not vendor-vs-vendor. 1.06× is not settled.** The
direction is striking and survives the caveat comfortably — the floor policy did not come in
cheaper — but the precise multiple rests on the soft baseline. Run 2's absolute figure is the more
trustworthy of the two.

## 4. Where the cost actually went — the actionable engineering finding

Codegen was **$0.404** against run 1's $0.033. But the blowup is not in codegen:

| Phase | run 1 | run 2 | ratio |
|---|---:|---:|---:|
| `plan_task_packets` | $0.0673 | $0.3373 | **5.0×** |
| `tests` | $0.0122 | $0.2536 | **21×** |

Both are phases where the worker explored the repository **despite explicit "do NOT search the repo,
do NOT read outside the workspace" instructions in the packet**.

The specific evidence is `tp_decomp_001`'s token shape: **157,291 fresh input plus 261,194 cached**
on a single-turn packet whose entire input was inlined in the instruction. Cached input exceeding
fresh input on a packet that needed no file reads indicates **session context accumulating across
the worker's own turns**. `tp_tests_001` shows the same signature (109,819 + 171,869).

Per-packet floor overhead is ~10.9k input tokens of session scaffolding (measured at pre-check:
a trivial smoke packet cost $0.0187 here vs $0.0010 on run 1's completion adapter). The exploration
blowup sits on top of that floor.

## 5. Antigravity's own sandbox fired — at their layer, not ours

`tp_decomp_001` attempted to read `/home/sangeetha/.claude/plugins/cache` and was refused:

> Access to path "/home/sangeetha/.claude/plugins/cache" is denied. It is outside the allowed
> workspace directories: [/home/sangeetha/projects/kaneo /home/sangeetha/.gemini/antigravity]

Containment held — but at the vendor's layer rather than the plugin's, and **the refusal text leaked
into the response ahead of the JSON**, breaking schema validation and forcing that packet to be
salvaged from the sidecar. See finding 1: the plugin's own layer was not what stopped it.

## 6. Routing was clean without run 1's workaround

`opus-plus-flash-v37` required bending `task_type` to `react_component` (brownfield primitive in
`subtype`) to avoid a silent fallthrough to premium. **That bend was not applied here and was not
needed.** `flash-agsdk-only`'s codegen rule matches on `phase` alone:

- `new_file_add` → codegen rule index 7 ("Mechanical tier — all codegen task types")
- `existing_file_edit` → codegen rule index 7
- `test_add` → tests rule index 8

The brownfield primitives from `pipeline/SKILL.md` were used as specified, and this policy's
phase-only matching is genuinely immune to the run 1 gap.

## Scope honesty

- **`npm audit` was not run.** No dependency delta exists. The repo's dependency posture is
  **unassessed by this review**, not clean.
- **The test proves an icon renders, not which icon** (`querySelector("svg")` is truthy on every
  `getColumnIcon` branch). Accepted as proportionate; the test name does not overclaim.
- **The test was added by coordinator instruction, overriding this run's own plan.** `tp_plan_001`
  returned `unit_test_recommended: false`, reasoning that a pure presentational leaf with no state
  and no branches is already covered by typecheck. That reasoning is sound and arguably sounder than
  run 1's. It was overridden solely for artifact-matched comparability across the four-run set.
  **Run 2 did not choose to ship this test.** Full reasoning in `gate2-decision.md`.
- **Run 1's test exists because the coordinator approved it**, not because Opus autonomously chose
  it — run 1's orchestrator raised it as an open item and recommended it. So the divergence is not a
  clean "Opus vs Flash" judgment signal and is not presented as one.

## Rollback

```
/mmo:revert 20260827-124738-refactor-lane-header
```

Restores all three files. `kanban-view.tsx` was tracked and clean at write time, so it reverts from
git; the two new files are untracked and are deleted. No backup copies were needed. No commits were
made (`git_head_before == git_head_after`, 0 commits recorded).

Manual equivalent:

```
git checkout -- apps/web/src/components/public-project/kanban-view.tsx
rm apps/web/src/components/public-project/public-column-header.tsx \
   apps/web/src/components/public-project/public-column-header.test.tsx
```

## Artifacts

All under `.sdlc/runs/20260827-124738-refactor-lane-header/`:
`requirements.md` · `change_plan.md` · `gate2-decision.md` · `packets.json` · `review.json` ·
`review.md` · `security_review.md` · `manifest.json` · `telemetry.jsonl` · `provenance.json` ·
`test-baseline.json` · `SUMMARY.md`

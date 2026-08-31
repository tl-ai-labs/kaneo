# Four-run policy comparison — extract PublicColumnHeader

Identical task, identical frozen brief (`briefs/refactor-public-column-header.md`),
identical base commit `5d1fc910`. Only the policy varies. Each run lives on its own branch.

| | run 1 | run 2 | run 3 | run 4 |
|---|---|---|---|---|
| Branch | `refactor/opus-flash` | `refactor/flash-only` | `refactor/opus-only` | `refactor/opus-sonnet` |
| Policy | `opus-plus-flash-v37` | `flash-agsdk-only` | `opus-only-v5` | `opus-plus-sonnet-max` |
| Adapters | claude-cli + mcp:model-dispatch | antigravity-worker | claude-cli | claude-cli |
| Pipeline cost | $0.9731 | $1.0323 | **$2.5844** | **$2.0372** |
| Cost basis | 6 of 8 phases **estimated** | 8 of 8 **vendor-reported** | 8 of 8 **CLI-measured** | 8 of 8 **CLI-measured** |
| Wall-clock | ~30 min | 15.43 h | 26m44s | ~32 min |
| Files touched | 3 | 3 | 3 | 3 |
| Tests | 113/113 (+1) | 115/115 (+3) | 113/113 (+1) | 113/113 (+1) |
| Reviews | approved / pass | approved_with_findings / pass | approve / pass | approve / pass |

## The result that matters

`public-column-header.tsx` and `kanban-view.tsx` are **byte-identical across all four runs** —
a mixed Opus+Flash policy, an all-Flash agent floor, an all-Opus premium ceiling, and an
Opus+Sonnet split produced the same source from the same brief. Four policies, three adapters,
a 2.6x measured cost spread, zero variation in source output.

**Scope of that claim**: identical *source output*, on **one small, tightly-specified refactor**.
That bound is not hedging — it is what stops the result being generalised to work where the
model's judgment has room to vary. Runs 3 and 4 each derived their output independently; both were
explicitly barred from consulting the other branches.

The test files differ, but **not in coverage** — same three assertions, same fixture, same
unmocked `@/lib/column`, same `querySelector("svg")`. Run 2 split them across three `it()`
blocks. Two small differences favour run 1: `toBeVisible()` vs `toBeTruthy()`, and
`as T` vs `as unknown as T`.

Both runs' test files exist because the operator approved them, overriding run 2's own plan
(`unit_test_recommended: false`). The test divergence is **not** an Opus-vs-Flash signal.

## Comparability caveats

1. **$0.9731 vs $1.0323 is vendor-vs-estimate.** Run 1's premium phases ran in-session via
   claude-cli and were inferred; three were corrected upward mid-run. Run 2 has no premium tier,
   so every figure is vendor-reported. The direction survives; the 1.06× multiple does not.
2. **Pre-check smoke excluded from both totals** ($0.1362 run 1, $0.0187 run 2). Runs 2+ skip
   pre-check as cached, so folding it in would inflate run 1 only.
3. **Run 1 required a `task_type` bend**, run 2 did not — `flash-agsdk-only` matches on phase
   alone. Applying run 1's workaround where unneeded would itself distort the comparison.

## Cross-run findings

- **Write contract**: run 1 left the refusal path *unexercised*; run 2 proved it *unprovable* on
  `antigravity-worker` — the hook matches `Write|Edit` and the worker writes through its own
  process. 268 `mcp_tool_postuse` events, zero write decisions. Only `artifact_path` validation
  constrained run 2.
- **`worker_timeout_sec: 540` did not fire after 54,415,269 ms** on `tp_plan_001`, reporting
  `timed_out: false`, `success: true`. Nothing in telemetry marks it anomalous.
- **Agent-adapter overhead**: identical trivial smoke packet cost $0.0010 on `flash-completion`
  vs $0.0187 on `antigravity-worker` (~18×; 10.9k tokens of session scaffolding).
- **Where run 2's cost went**: not codegen. `plan_task_packets` 5.0× and `tests` 21× vs run 1,
  with cached input exceeding fresh input on single-turn packets whose input was fully inlined —
  session context accumulating across the worker's own turns.
- **`opus-plus-flash-v37` routing gap** (run 1 only): codegen rule matches an explicit
  `task_type` allowlist omitting every brownfield primitive, so packets silently fall through to
  `default: opus`. See `gate0-answers.json.known_policy_gap`.

## Run 3 additions

### The write contract has never blocked anything, on any adapter

`plugin/scripts/write-contract-check.mjs` `deny()` calls `process.exit(1)` (line 158). Claude Code's
PreToolUse protocol blocks on exit **2**; any other non-zero code is a *non-blocking* error and the
tool call proceeds. The script emits no `hookSpecificOutput`/`permissionDecision` JSON either
(grep count: 0). The gate runs, classifies correctly, logs `write.deny` at WARN — and lets the
write through. Proved live: a `Write` to an off-limits path under `kanban-board/` succeeded.

Three-run progression, each run seeing only part of it:

| run | verdict |
|---|---|
| 1 | refusal path **unproven** — never exercised |
| 2 | **unprovable on this adapter** — antigravity-worker writes outside Write/Edit |
| 3 | **non-functional on every adapter** — the gate cannot refuse |

**Fix order matters.** `exit(2)` alone converts a silent no-op into a run that cannot start: fed
`.sdlc/runs/<run-id>/security_review.md` the checker DENYs it, because `.sdlc/**` is off-limits with
no run-directory carve-out, contrary to the orchestrator contract. The carve-out must land first.

### Measured vs estimated — why run 1's total is the soft number

| Phase | run 1 (est) | run 3 (measured) | ratio |
|---|---:|---:|---:|
| `requirements_analysis` | $0.1354 | $0.23596 | 1.74× |
| `change_plan` | $0.2225 | $0.43582 | 1.96× |

Same model (`claude-opus-5`), same adapter (`claude-cli`). Mechanism: run 3's cached input (493,995)
is 3.6× its uncached input (136,550) — per-turn context re-send that a chars-on-visible-prompt
heuristic cannot see. This is the diagnosed cause of run 1's three mid-run upward corrections.

Totals are **not** comparable this way ($2.5844 vs $0.9731, 2.66×) — the runs differ in phase count
and packet shape, and run 1 sent three codegen packets to Flash. The per-phase ratios are the honest
comparison.

### Review cost dominates on small changes

Run 3's two review phases cost **$1.10838 — 43% of the run** — against $0.50874 for all three codegen
packets. Under an all-premium policy, judgment about a 22-line component outcosts producing it.
Hypothesis this set cannot confirm (n=1, one small refactor): route review by diff size rather than
by phase name.

## Run 4 additions

### The task_type bend, finally verified

Run 4 hit run 1's routing gap — `opus-plus-sonnet-max` carries the same explicit codegen
`task_type` allowlist omitting every brownfield primitive. The bend was applied and, unlike run 1,
**confirmed from telemetry**: all three codegen events show `model_id: sonnet`, `rule_index: 7`,
zero routed to opus.

Run 1's mechanical routing is therefore **unverified, not wrong**. Its $0.033 Flash share is
consistent with the bend having worked but cannot prove it — a fallthrough would have surfaced as
premium cost that its character-heuristic estimates would have blurred.

### Under `claude-cli`, a premium dispatch is a delegated agent, not a model call

Evidence from run 4's `senior_code_review` event: **288,246 cached input against 26,575 fresh**;
the reviewer describing `git show HEAD:...` and reads of `constants/column-icons.ts` and
`test/setup.ts` that were never in its packet; and its sandbox *declining* the vitest/typecheck/
biome invocations (it correctly refused to report the tests green).

- Senior review cost **$0.6367** — the run's most expensive phase, more than requirements and
  packet-planning combined, to review a 22-line component.
- **Run 3's $2.5844 was eight delegated agent sessions, not eight model calls.** Comparing these
  figures to raw API pricing will mislead.
- It sharpens run 3's review-cost hypothesis: the lever is not "route review by diff size" but
  **premium review under claude-cli re-reads the repo regardless of diff size**.

### Three configured limits that do not bind

One pattern, not three quirks — configured limits in this plugin are descriptive, not enforcing:

| limit | configured | actual |
|---|---|---|
| write contract (`deny()`) | blocks off-limits writes | exits 1; PreToolUse blocks only on 2 — classifies, logs, permits |
| `worker_timeout_sec` (run 2) | 540 s | did not fire after 54,415,269 ms; `timed_out: false` |
| `budget.maxOutputTokens` (run 4) | 5,000 / 5,000 / 4,000 | 8,144 / 8,928 / 5,717, all `stop_reason: end_turn` |

### Suggested fix: orchestrator rule 6

Rule 6 requires `ANTHROPIC_API_KEY` for vendor mode globally. Runs 3 and 4 were legitimately
vendor-authoritative without it — both leaves are `claude-cli` on Max OAuth returning real
`total_cost_usd`, and `builtin-anthropic` (the adapter that needs the key) was never constructed.
**Condition the requirement on the adapter set the policy resolves to**, not on vendor mode itself.

### Methodology limitations of the set

1. **Packet prescriptiveness increased across the series.** Runs 3-4 received more prescriptive
   instructions than runs 1-2. Byte-identity is unaffected (checkable against the brief), but the
   cost figures are not measuring identically-specified work. Illustration, cutting both ways:
   run 4's requirements cost 1.25x run 3's on the same model, while its change_plan cost less.
2. **Run 3's class-assertion observation stays n=1.** Run 3's requirements phase independently
   proposed Tailwind class-string assertions; run 4's packet forbade them up front, so run 4 can
   neither corroborate nor contradict it. Operator error, not a neutral difference.
3. **Test files differ across runs** in packaging and matcher strength, and each run's shape was
   partly operator-specified. Not a policy signal.

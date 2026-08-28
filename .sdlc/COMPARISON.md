# Four-run policy comparison — extract PublicColumnHeader

Identical task, identical frozen brief (`briefs/refactor-public-column-header.md`),
identical base commit `5d1fc910`. Only the policy varies. Each run lives on its own branch.

| | run 1 | run 2 | run 3 | run 4 |
|---|---|---|---|---|
| Branch | `refactor/opus-flash` | `refactor/flash-only` | `refactor/opus-only` | — |
| Policy | `opus-plus-flash-v37` | `flash-agsdk-only` | `opus-only-v5` | — |
| Adapters | claude-cli + mcp:model-dispatch | antigravity-worker | claude-cli | — |
| Pipeline cost | $0.9731 | $1.0323 | **$2.5844** | — |
| Cost basis | 6 of 8 phases **estimated** | 8 of 8 **vendor-reported** | 8 of 8 **CLI-measured** | — |
| Wall-clock | ~30 min | 15.43 h | 26m44s | — |
| Files touched | 3 | 3 | 3 | — |
| Tests | 113/113 (+1) | 115/115 (+3) | 113/113 (+1) | — |
| Reviews | approved / pass | approved_with_findings / pass | approve / pass | — |

## The result that matters

`public-column-header.tsx` and `kanban-view.tsx` are **byte-identical across all three runs** —
a mixed Opus+Flash policy, an all-Flash agent floor, and an all-Opus premium ceiling produced the
same source from the same brief. At n=3 this is a result, not a coincidence. Run 3 derived its
output independently; it was explicitly barred from consulting the other branches.

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

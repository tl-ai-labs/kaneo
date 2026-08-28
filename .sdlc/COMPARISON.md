# Four-run policy comparison — extract PublicColumnHeader

Identical task, identical frozen brief (`briefs/refactor-public-column-header.md`),
identical base commit `5d1fc910`. Only the policy varies. Each run lives on its own branch.

| | run 1 | run 2 | run 3 | run 4 |
|---|---|---|---|---|
| Branch | `refactor/opus-flash` | `refactor/flash-only` | — | — |
| Policy | `opus-plus-flash-v37` | `flash-agsdk-only` | — | — |
| Adapters | claude-cli + mcp:model-dispatch | antigravity-worker | — | — |
| Pipeline cost | $0.9731 | $1.0323 | — | — |
| Cost basis | 6 of 8 phases **estimated** | 8 of 8 **vendor-reported** | — | — |
| Wall-clock | ~30 min | 15.43 h | — | — |
| Files touched | 3 | 3 | — | — |
| Tests | 113/113 (+1) | 115/115 (+3) | — | — |
| Reviews | approved / pass | approved_with_findings / pass | — | — |

## The result that matters

`public-column-header.tsx` and `kanban-view.tsx` are **byte-identical** between runs 1 and 2.
An Opus-judgment policy and a Flash-floor policy produced the same source from the same brief.

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

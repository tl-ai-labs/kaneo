# SDLC Runs — Cost & Time Overview

**20 runs.** 5 tasks, each run 4 times — once per model policy. All branched from `5d1fc910`, none merged to main.

**Bottom line:** all 20 runs passed. Cost varied 5.4× across the set, but the spread is driven mostly by *task size* and *how the model is called*, not by which model was used. Only 6 runs have vendor-metered costs; the rest are estimates that are known to run low, so the policy ranking below is indicative, not conclusive.

---

## The four policies

| Policy | What it runs |
|---|---|
| `opus-plus-flash-v37` | Opus for judgment + Gemini 3.7 Flash for mechanical work (Vertex) |
| `opus-plus-sonnet-max` | Opus for judgment + Sonnet for mechanical work |
| `opus-only-v5` | Opus for everything |
| `flash-agsdk-only` | Gemini 3.7 Flash for everything, via the Antigravity agent adapter |

## The five tasks

| Task | What it does |
|---|---|
| docs | Add a docs section for board filter chips |
| refactor | Extract a shared `PublicColumnHeader` component |
| feature-extend-1 | Column WIP limits |
| feature-extend-2 | Estimated hours + per-column rollup (largest — 28–45 files) |
| feature-extend-3 | Board filter URL state |

---

## Cost by policy

| Policy | Total | Mean per run | Cheapest task | Priciest task |
|---|---:|---:|---:|---:|
| `opus-plus-flash-v37` | **$13.09** | $2.62 | $0.64 (docs) | $5.99 (fe-2) |
| `flash-agsdk-only` | **$19.83** | $3.97 | $1.03 (refactor) | $8.08 (fe-2) |
| `opus-plus-sonnet-max` | **$20.36** | $4.07 | $2.04 (refactor) | $8.08 (fe-2) |
| `opus-only-v5` | **$21.67** | $4.33 | $0.53 (docs) | $9.55 (fe-2) |
| **All** | **$74.96** | $3.75 | | |

Opus+Flash looks 40% cheaper than the field, but 4 of its 5 runs are estimated — and one run caught the estimator undercounting by 2–2.6× on exactly the phases that dominate these bills. Treat the gap as unproven.

## Cost by task

| Task | Opus+Flash | Opus-only | Flash-AGSDK | Opus+Sonnet | Task total | Spread |
|---|---:|---:|---:|---:|---:|---:|
| docs | $0.64 | $0.53 | $1.04 | $2.84 | $5.04 | 5.4× |
| refactor | $0.97 | $2.58 | $1.03 | $2.04 | $6.63 | 2.7× |
| feature-extend-1 | $2.79 | $3.88 | $3.50 | $2.71 | $12.88 | 1.4× |
| feature-extend-2 | $5.99 | $9.55 | $8.08 | $8.08 | $31.70 | 1.6× |
| feature-extend-3 | $2.70 | $5.12 | $6.18 | $4.70 | $18.71 | 2.3× |

The pattern that holds across every column: **task size beats policy choice.** Docs runs cost $0.53–2.84; feature extensions cost $2.70–9.55. Policy choice moves the bill less than picking a bigger task does.

---

## Time

Timing is only partly recorded — phases that ran in the orchestrator's own session log no duration. **7 of 20 runs have complete timing**; the rest are dispatch-only figures and understate the truth.

Comparing only where timing is complete:

| Task | Policy | Time |
|---|---|---:|
| refactor | `opus-only-v5` | 7.8 min |
| refactor | `opus-plus-sonnet-max` | 13.6 min |
| refactor | `flash-agsdk-only` | 18.9 min |
| feature-extend-1 | `opus-only-v5` | 12.1 min |
| feature-extend-2 | `opus-plus-flash-v37` | 37.8 min |
| feature-extend-2 | `flash-agsdk-only` | 68.5 min |
| feature-extend-3 | `flash-agsdk-only` | 45.4 min |

**Flash is the slowest, not the fastest.** On the same task it ran ~2× longer than the Opus arms (refactor: 18.9 vs 7.8 min; feature-extend-2: 68.5 vs 37.8 min). The cheap model does not buy back wall-clock here.

One outlier is excluded above: `refactor/flash-agsdk` stalled **906.9 minutes** in one phase against a configured 540-second timeout, and reported success throughout.

---

## Every run

| Task | Policy | Cost | Time | Tests added | Result |
|---|---|---:|---|---|---|
| docs | opus-only-v5 | $0.53 ⚠ | not recorded | n/a (no suite) | Accepted |
| docs | opus-plus-flash-v37 | $0.64 ⚠ | 0.3 min* | n/a | Accepted (1 fix cycle) |
| docs | flash-agsdk-only | $1.04 ⚠ | 7.8 min* | n/a | Accepted |
| docs | opus-plus-sonnet-max | $2.84 | 10.1 min* | n/a | Accepted (4 defects fixed) |
| refactor | opus-plus-flash-v37 | $0.97 ⚠ | 0.6 min* | +1 | Accepted |
| refactor | flash-agsdk-only | $1.03 ⚠ | 18.9 min | +3 | Accepted |
| refactor | opus-plus-sonnet-max | $2.04 | 13.6 min | +1 | Accepted |
| refactor | opus-only-v5 | $2.58 | 7.8 min | +1 | Accepted |
| feature-extend-1 | opus-plus-sonnet-max | $2.71 | 17.8 min* | not recorded | Accepted |
| feature-extend-1 | opus-plus-flash-v37 | $2.79 ⚠ | 9.6 min* | +25 API, +6 web | Accepted |
| feature-extend-1 | flash-agsdk-only | $3.50 ⚠ | 44.8 min* | not recorded | Accepted |
| feature-extend-1 | opus-only-v5 | $3.88 | 12.1 min | +14 web | Accepted |
| feature-extend-2 | opus-plus-flash-v37 | $5.99 | 37.8 min | 391 API green | Accepted |
| feature-extend-2 | opus-plus-sonnet-max | $8.08 ⚠ | 12.4 min* | not recorded | Accepted |
| feature-extend-2 | flash-agsdk-only | $8.08 ⚠ | 68.5 min | +19 web | Accepted (2 nits fixed) |
| feature-extend-2 | opus-only-v5 | $9.55 ⚠ | 9.2 min* | +10 API, +64 web | Accepted |
| feature-extend-3 | opus-plus-flash-v37 | $2.70 ⚠ | 3.9 min* | +43 | Accepted |
| feature-extend-3 | opus-plus-sonnet-max | $4.70 ⚠ | 13.9 min* | +60 | Accepted |
| feature-extend-3 | opus-only-v5 | $5.12 ⚠ | not recorded | +88 | Accepted |
| feature-extend-3 | flash-agsdk-only | $6.18 ⚠ | 45.4 min | +36 | Accepted |

⚠ = estimated cost, not vendor-metered (known to run low); metering read from each run manifest’s `auth_mode`. \* = dispatch time only; in-session phases not counted.

---

## What actually drove cost

1. **How the model is called matters more than which model.** The same Flash model costs 18× more per dispatch through the agent adapter than through the completion adapter, because the agent re-reads the repo on every call. A do-nothing test packet cost $0.018 / 10.9k tokens one way and $0.001 / 122 tokens the other.

2. **Review is the biggest line item, on every policy.** On the docs run, senior + security review were 59% of the bill against 9% for the two writing passes. Senior review alone billed $1.04 to review a 20-line diff. This showed up on unrelated adapters, so it is structural — and it is also what caught the defects.

3. **The mechanical tier barely matters.** On feature-extend-2 with Opus+Sonnet, Sonnet handled codegen for 9.3% of the spend; Opus took 90.7%. Choosing the cheap second model moves almost nothing.

4. **Cost varied 5.4×; quality did not.** All 20 accepted, zero regressions, +1 to +88 tests added. Four runs needed one correction cycle inside the pipeline. On refactor, all four policies produced **byte-identical** source — a 2.7× cost spread bought nothing extra.

## Caveats worth knowing

- **Only 6 of 20 runs are vendor-metered.** The other 14 are estimated and undercount by an unmeasured amount. "Policy X is N% cheaper" is not supportable from this data.
- **`flash-agsdk-only` totals omit orchestration.** No phase routes to the orchestrator's own tier under that policy, so its orchestration turns are unbilled in these numbers. Its real total is higher.
- **Branch names don't match policies.** `feature-extend-1/gemini-only` and `feature-extend-3/flash-only` both actually ran `flash-agsdk-only`. Figures above use the manifest, not the branch name.
- **Runs got unequal help.** Later runs received more prescriptive operator instructions than earlier ones, which confounds some quality comparisons.

## Highest-value next step

Re-run one estimated task under vendor metering. That single run would put a real multiplier on the estimator and turn this from a suggestive comparison into a rankable one.

---

*Costs summed from each run's `telemetry.jsonl` (excluding smoke dispatches); policy read from `manifest.json`; timing summed from `latency_ms` with null events contributing nothing. Full per-run records live on each run's own branch. For the long-form version with per-phase detail, see `Summary.md`.*

# Kaneo: SDLC Policy Runs Cost & Time Roll-Up

**Repository:** `tl-ai-labs/kaneo`
**Sample Size:** 20 runs (4 policy branches across 5 briefs — docs, refactor, feature-extend-1/2/3)
**Base Commit:** all 20 runs branched from `5d1fc910`; none merged to main
**Data Sources:** `.sdlc/runs/<id>/telemetry.jsonl`, `manifest.json`, `provenance.json`, `SUMMARY.md`, cross-checked against `git diff main...<branch>`
**Branch-Name Correction:** branch names do not reliably indicate policy. `feature-extend-1/gemini-only` and `feature-extend-3/flash-only` both ran **`flash-agsdk-only`** per their manifests; policy columns below use the manifest value, not the branch name.
**Deletion:** `feature-extend-2/flash-only` (`flash-vertex-only`, SHA `b62ad075`) was deleted at the operator's instruction after the set completed. It is the only `flash-vertex-only` arm that existed; its removal is why no completion-adapter Flash datapoint remains.

> **Note on ⚠ Flags:** Costs marked ⚠ indicate non-comparable baseline metrics — estimated rather than vendor-metered spend, or unmetered orchestration layers (see Comparability Caveats). All costs exclude the pre-check smoke dispatch.

---

## Key takeaways

- **The cheapest column is the least measured one.** `opus-plus-flash-v37` totals $13.09 against $19.83–$21.67 for the field — but 4 of its 5 runs are estimated, and one run measured the estimator undercounting agentic phases by **2.03× and 2.64×** on exactly the phases that dominate these bills. Corrected, its 40% advantage plausibly disappears. This is not a ranking.

- **Same model, different door, very different economics.** `flash-agsdk-only` runs the cheapest model and finished third by spend. The Antigravity agent adapter re-explores the repo on every dispatch — a trivial "return OK" smoke packet costs **$0.018 and 10.9k input tokens** before any work happens, versus **$0.001 and 122 tokens** for the same packet on the completion adapter. An 18× floor per dispatch. The routing path mattered more than the model.

- **A real agentic packet is 40× the smoke floor, and the mechanism is turns.** One requirements packet billed 267k uncached **plus 1.005M cached** input for a single document. The worker is an agent loop, so every internal turn re-bills accumulated context: cost scales with *turns taken*, not work requested.

- **Turns are substitutable with supplied context — up to a hard boundary.** Front-loading file excerpts instead of naming files cut one phase's cost **65%** and its tool calls 25 → 9. The ratio collapses on packets that edit large files ($0.576 on a 439-line component). Front-loading buys back *exploration* turns; it cannot buy back *reading* turns.

- **Premium review dominates every mixed bill.** On the docs brief under `opus-plus-sonnet-max`, senior + security review were **59% of run cost** against 9% for both writing passes. Senior review alone billed $1.04 on 268k cached input to review a 20-line diff. Confirmed on two unrelated adapters — this is structural, not policy-specific.

- **That review cost is what found the defects.** Every defect those reviews caught required reading past the diff: two style divergences needed a grep of the whole docs tree, and one factual defect lived in a function the diff never touched. Trimming review scope to cut the 59% removes the defect-finding with it.

- **Cost varied 5.4×; quality did not.** All 20 runs accepted at Gate 4, zero new test failures, +1 to +88 tests added on feature work. Policy choice here is an economic decision, not a quality one.

- **Task type dwarfs policy choice.** docs ≈ $0.53–2.84, refactor ≈ $0.97–2.58, feature-extend ≈ $2.70–9.55. Most of the cross-brief spread is task size, not routing.

- **Constrained work converges completely.** All four refactor legs produced **byte-identical** source for both changed files, despite a 2.7× cost spread and three different adapters. On the docs brief, where prose admits more valid forms, the four legs diverged. Convergence is a property of tightly-specified mechanical work.

- **Six configured limits record but do not constrain.** The write-contract hook classifies and permits; a 540s worker timeout did not fire after **906.9 minutes**; `maxOutputTokens` overshot 5,000 to 8,928; output-cap doubling never fires inside an agent turn; `outputSchema` passed malformed output as `success: true` three times; and nothing bounds the worker's shell access — it ran `pnpm typecheck` and `pnpm test` unprompted, visible only by parsing tool calls.

- **Time is largely unmeasured.** In-session phases record `latency_ms: null`, so only **7 of 20** runs have complete dispatch timing. Recorded figures mix full dispatch sums with partial ones. Speed cannot be compared across policies from this data.

---

## 1. Summarized and Complete Run Log

### Summarized Log

| Task / Brief | Opus + Flash | Opus-Only | Flash-AGSDK | Opus + Sonnet | Total |
|---|---:|---:|---:|---:|---:|
| docs | $0.6385 ⚠ | $0.5265 ⚠ | $1.0356 ⚠ | $2.8378 (metered) | **$5.0384** |
| refactor | $0.9731 ⚠ | $2.5844 (metered) | $1.0323 ⚠ | $2.0372 (metered) | **$6.6270** |
| feature-extend-1 | $2.7874 ⚠ | $3.8845 ⚠ | $3.5014 ⚠ | $2.7070 ⚠ | **$12.8803** |
| feature-extend-2 | $5.9899 ⚠ | $9.5535 ⚠ | $8.0812 ⚠ | $8.0773 ⚠ | **$31.7019** |
| feature-extend-3 | $2.7024 ⚠ | $5.1210 ⚠ | $6.1841 ⚠ | $4.7042 ⚠ | **$18.7117** |
| **Total** | **$13.0913** | **$21.6699** | **$19.8346** | **$20.3635** | **$74.9593** |

### Complete Log

Web-test baseline is **36 files / 112 tests** on every branch. Timing excludes idle; see Caveats.

| Brief / Task | Policy Arm | Run ID | Cost (USD) | Recorded Time | Test Delta | Gate-4 Outcome |
|---|---|---|---:|---|---|---|
| **docs**<br>Board filter chips section | opus-only-v5 | `20260831-060942` | $0.5265 ⚠ | — (all in-session) | No suite (`apps/docs` has no package) | Accepted |
| | opus-plus-flash-v37 | `20260831-042943` | $0.6385 ⚠ | 0.3 min (partial) | No suite | Accepted (1 correction cycle) |
| | flash-agsdk-only | `20260831-064935` | $1.0356 ⚠ | 7.8 min (partial) | No suite | Accepted |
| | opus-plus-sonnet-max | `20260831-083417` | $2.8378 | 10.1 min (partial) | No suite | Accepted (4 defects fixed) |
| **refactor**<br>Extract `PublicColumnHeader` | opus-plus-flash-v37 | `20260827-085807` | $0.9731 ⚠ | 0.6 min (partial) | 112 → 113 (+1) | Accepted |
| | flash-agsdk-only | `20260827-124738` | $1.0323 ⚠ | 18.9 min **complete** | 112 → 115 (+3) | Accepted |
| | opus-plus-sonnet-max | `20260828-081120` | $2.0372 | 13.6 min **complete** | 112 → 113 (+1) | Accepted |
| | opus-only-v5 | `20260828-050440` | $2.5844 | 7.8 min **complete** | 112 → 113 (+1) | Accepted |
| **feature-extend-1**<br>Column WIP limits | opus-plus-sonnet-max | `20260821-094808` | $2.7070 ⚠ | 17.8 min (partial) | Not parseable in manifest | Accepted |
| | opus-plus-flash-v37 | `20260824-095555` | $2.7874 ⚠ | 9.6 min (partial) | API 374 → 399 (+25); web 112 → 118 (+6) | Accepted |
| | flash-agsdk-only | `20260820-123148` | $3.5014 ⚠ | 44.8 min (partial) | Typecheck 6/6; counts not parseable | Accepted |
| | opus-only-v5 | `20260821-065909` | $3.8845 ⚠ | 12.1 min **complete** | API 398; web 126 (+14) | Accepted |
| **feature-extend-2**<br>Estimated hours + rollup | opus-plus-flash-v37 | `20260824-042617` | $5.9899 ⚠ | 37.8 min **complete** | API 391/391 across 60 files | Accepted |
| | opus-plus-sonnet-max | `20260825-114015` | $8.0773 ⚠ | 12.4 min (partial) | Not recorded in manifest | Accepted |
| | flash-agsdk-only | `20260831-092456` | $8.0812 ⚠ | 68.5 min **complete** | API 377; web 112 → 131 (+19) | Accepted (2 nits fixed) |
| | opus-only-v5 | `20260825-084051` | $9.5535 ⚠ | 9.2 min (partial) | API 374 → 384 (+10); web 112 → 176 (+64) | Accepted |
| **feature-extend-3**<br>Board filter URL state | opus-plus-flash-v37 | `20260826-064633` | $2.7024 ⚠ | 3.9 min (partial) | 112 → 155 (+43) | Accepted |
| | opus-plus-sonnet-max | `20260826-132654` | $4.7042 ⚠ | 13.9 min (partial) | 112 → 172 (+60) | Accepted |
| | opus-only-v5 | `20260827-043436` | $5.1210 ⚠ | — (all in-session) | 112 → 200 (+88) | Accepted |
| | flash-agsdk-only | `20260826-103235` | $6.1841 ⚠ | 45.4 min **complete** | 112 → 148 (+36) | Accepted |

---

## 2. Policy Roll-Up Summary

| Policy Arm | Model Architecture | Runs | Total ($) | Mean ($/Run) | Mean on Feature Extensions<br>(fe-1 / fe-2 / fe-3) |
|---|---|---:|---:|---:|---:|
| `opus-plus-flash-v37` | Opus premium + Gemini 3.7 Flash mechanical (Vertex) | 5 | $13.09 ⚠ | $2.62 ⚠ | $3.83 |
| `flash-agsdk-only` | Gemini 3.7 Flash via Antigravity agent (single-tier) | 5 | $19.83 ⚠ | $3.97 ⚠ | $5.92 |
| `opus-plus-sonnet-max` | Opus premium + Sonnet mechanical (claude-cli) | 5 | $20.36 | $4.07 | $5.16 |
| `opus-only-v5` | Single-tier Opus (claude-cli) | 5 | $21.67 ⚠ | $4.33 ⚠ | $6.19 |
| **Total / Aggregate** | — | **20** | **≈ $74.96** | **$3.75** | — |

**Key Takeaway:** the apparent ranking `opus-plus-flash-v37 < flash-agsdk-only < opus-plus-sonnet-max < opus-only-v5` is **not defensible from this data**. Only 4 of 20 runs are vendor-metered; the other 16 are estimated and known-low by an unquantified factor. `opus-plus-sonnet-max` is the only arm with two metered runs, which is why it carries the fewest flags — not because it behaved differently.

---

## 3. Brief-Level Roll-Up

| Brief | Task Category | Combined 4-Policy Spend | Lowest Cost Policy | Highest Cost Policy | Spread |
|---|---|---:|---|---|---:|
| docs | Documentation | $5.04 | opus-only-v5 ($0.53) | opus-plus-sonnet-max ($2.84) | 5.4× |
| refactor | Refactor | $6.63 | opus-plus-flash-v37 ($0.97) | opus-only-v5 ($2.58) | 2.7× |
| feature-extend-1 | Feature Extend | $12.88 | opus-plus-sonnet-max ($2.71) | opus-only-v5 ($3.88) | 1.4× |
| feature-extend-2 | Feature Extend | $31.70 | opus-plus-flash-v37 ($5.99) | opus-only-v5 ($9.55) | 1.6× |
| feature-extend-3 | Feature Extend | $18.71 | opus-plus-flash-v37 ($2.70) | flash-agsdk-only ($6.18) | 2.3× |

Note the inversion: `opus-only-v5` is the *cheapest* arm on docs and the *most expensive* on three other briefs. Its docs run was entirely in-session and estimated, which is exactly where the heuristic understates most.

---

## 4. Comparability Caveats

- **Mixed metering basis.** Runs under `auth_mode: estimated` priced premium phases with a char/3.8 heuristic; runs under `vendor` report real `total_cost_usd` from the CLI. Only 4 runs are metered (`docs/opus-sonnet`, `refactor/opus-only`, `refactor/opus-sonnet`, and partially `feature-extend-2/flash-agsdk`). One run measured its own estimator undercounting agentic phases by **2.03× and 2.64×** against actual subagent token consumption. Every estimated total is an unquantified undercount, so *"policy X is N% cheaper"* is not supportable.

- **Unmetered orchestration in `flash-agsdk-only`.** No phase routes to the orchestrator's own tier under this policy, so its totals count dispatched Flash calls only and omit every orchestration turn. Directly comparable to a completion-adapter Flash arm — which no longer exists after the `feature-extend-2/flash-only` deletion.

- **Repository-exploration overhead.** The Antigravity agent adapter reads repo context on every dispatch. Measured floor on this repo: **$0.018 / 10.9k input tokens** for a packet that does nothing, against **$0.001 / 122 tokens** on the completion adapter. A real packet reached 267k uncached + 1.005M cached for one document.

- **Inconsistent clock telemetry.** In-session phases record `latency_ms: null`. Only 7 of 20 runs have complete dispatch timing. Two runs (`docs/opus-only`, `feature-extend-3/opus-only`) recorded no timing at all. Where a run shows few minutes, that is the dispatched portion only.

- **One excluded stall.** `refactor/flash-only`'s `change_plan` phase ran **906.9 minutes** against a configured `worker_timeout_sec: 540`, reporting `timed_out: false` and `success: true` throughout. That idle is excluded from its 18.9 min figure. The payload was recovered from the sidecar rather than re-dispatched, so it was billed once.

- **Task heterogeneity.** Cross-brief cost differences reflect scope, not model efficiency: the docs brief touched one file with no test suite; feature-extend-2 touched 28–45 files across schema, migration, API, web, i18n and tests.

- **Two shared briefs carry defects.** The docs brief pointed acceptance criterion 5 at `use-task-filters.ts`, but the board wires `useTaskFiltersWithLabelsSupport` — undetected through two runs. The feature-extend-2 brief's allowlist omitted `apps/web/src/lib/`, blocking eight packets mid-run. Both were caught during runs, not by review.

- **Unequal operator assistance.** Later runs received progressively more prescriptive instructions than earlier ones. On the docs set specifically, two legs were handed pre-solved factual traps and two were not — the two that received help are the two whose quality results are confounded.

---

## 5. Empirical Findings

**Quality & gate pass rates.** 20/20 runs accepted at Gate 4 with green suites and zero regressions. Feature work added +1 to +88 net new tests. Four runs required a correction cycle inside the pipeline (docs/opus-flash shipped a factually wrong claim caught by review; docs/opus-sonnet fixed 4 review defects; feature-extend-2/flash-agsdk fixed 2 nits). No run was rejected.

**Output convergence.** All four refactor legs produced byte-identical `public-column-header.tsx` and `kanban-view.tsx`, verified by diff, across a 2.7× cost spread and three adapters. Docs legs diverged in wording while agreeing on every fact. Convergence tracks specification tightness, not model tier.

**Tier load distribution.** Under mixed policies the mechanical tier is near-noise: on `feature-extend-2/opus-sonnet-max`, Sonnet handled the codegen for **9.3%** of spend while Opus took 90.7%. The premium-tier choice drives the bill; the mechanical choice barely moves it.

**Review cost is structural, not policy-specific.** Confirmed independently on `antigravity-worker` and `claude-cli`: where the adapter can read the repo and the packet says *verify against source*, review cost scales with repo surface rather than diff size. Senior review was the single most expensive dispatch in three separate runs.

**Provenance has a design gap.** `drizzle-kit` assigns migration tags randomly, so `0043_odd_random.sql`, its snapshot and the journal entry have no `--before` record. This affects **any packet generating its own filenames**. Nineteen prior runs never surfaced it because they touched only pre-named files. `apps/api/drizzle/meta/_journal.json` is tracked and modified — a revert must **restore** it, not delete it.

**Reliability tax on the agent path.** Across `flash-agsdk-only` runs: one 906.9-minute stall, one DNS failure, three `outputSchema` violations reported as success, and unprompted shell execution. All failed dispatches billed $0 with honest `vendor_error`, so the failure *signalling* works even where the *limits* do not.

---

## 6. What to Look At Next

1. **Fix the write contract — carefully.** Changing `deny()`'s `exit(1)` to `exit(2)` is the obvious one-character fix and breaks every run immediately: the checker currently *denies* a run's own `.sdlc` artifact writes. The run-directory carve-out must land first.
2. **Re-measure one estimated run.** 16 of 20 runs are estimated. A single re-run under `vendor` would put a real multiplier on the heuristic and make the policy roll-up rankable instead of suggestive. Cheapest change with the largest effect on this dataset.
3. **Test whether scoping the reviewer beats downgrading it.** The evidence says the cost driver is the instruction *verify against source*, not the model tier. Bounding what the reviewer reads is untested.
4. **Restore a completion-adapter Flash arm.** With `feature-extend-2/flash-only` deleted (`b62ad075`, recoverable until GC), nothing separates Flash-the-model from the agent adapter's per-turn overhead.
5. **Close every run with a reconciliation.** The provenance gap was found by diffing `provenance.json` against `git status` as a set difference, which also corrected one run's own tally from one gap to four. Self-reported counts drift; set differences do not.

---

## Method

Costs summed from each run's `telemetry.jsonl` across all events excluding `task_type: smoke`. Policy taken from `manifest.json`, not the branch name. Timing summed from `latency_ms`, with `null` events (in-session phases) contributing nothing — which is why 13 runs are marked partial and 2 have no figure. Source counts from `git diff --name-only main...<branch>` excluding `.sdlc/` records and the `.gitignore` / `biome.json` setup edits.

Nothing merged to main. Every run's full record — requirements, change plan, packets, reviews, telemetry, provenance — is committed on its own branch.

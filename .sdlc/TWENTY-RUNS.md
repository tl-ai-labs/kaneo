# Twenty Runs

**Kaneo · AI-SDLC policy benchmark · base commit `5d1fc910`**

Five briefs, each built four times under a different model-routing policy, on identical
starting code. Every run wrote its own telemetry, provenance and review records. This is what
they say — including where the numbers cannot be compared.

| | |
|---|---|
| Runs | 20 |
| Briefs | 5 |
| Policies per brief | 4 |
| Total dispatch spend | **$74.96** (pre-check smoke excluded) |
| Runs with complete timing | **7 of 20** |
| Merged to main | 0 |

---

## Read this first — the totals are not a leaderboard

Two measurement problems govern every table below.

**1. Cost basis is mixed.** Runs under `auth_mode: estimated` ran premium phases in-session and
priced them with a character heuristic. Runs under `vendor` report real `total_cost_usd` from the
CLI. One run measured its own estimator undercounting agentic phases by **2.03× and 2.64×**.
Estimated figures are therefore *known-low by an unquantified factor* — a cheaper estimated run
may well have cost more than a pricier measured one.

**2. Timing is incomplete for 13 of 20 runs.** In-session phases record `latency_ms: null`. Where
a run shows a small number of minutes, that is the dispatched portion only, not the run. Runs
marked *partial* below should not be read as fast.

What survives both problems: the direction of the error is known, the per-run findings are
independent of cost basis, and the seven fully-timed runs compare cleanly against each other.

---

## Cost by brief and policy

Dispatch spend in USD, pre-check smoke excluded. `est` = estimated basis, `MEAS` = vendor-measured.

| Brief | opus+flash | opus-only | flash-agsdk | opus+sonnet | Row total | Spread |
|---|---:|---:|---:|---:|---:|---:|
| **docs** — enrich one docs section | 0.6385 `est` | 0.5265 `est` | 1.0356 `est` | 2.8378 **MEAS** | 5.0384 | 5.4× |
| **refactor** — extract a React component | 0.9731 `est` | 2.5844 **MEAS** | 1.0323 `est` | 2.0372 **MEAS** | 6.6270 | 2.7× |
| **feature-extend-1** — column WIP limits | 2.7874 `est` | 3.8845 `est` | 3.5014 `est` | 2.7070 `est` | 12.8803 | 1.4× |
| **feature-extend-2** — estimated hours + rollup | 5.9899 `est` | 9.5535 `est` | 8.0812 `est` | 8.0773 `est` | 31.7019 | 1.6× |
| **feature-extend-3** — board filter URL state | 2.7024 `est` | 5.1210 `est` | 6.1841 `est` | 4.7042 `est` | 18.7117 | 2.3× |
| **Column total** (4 shared-policy briefs) | **10.3039** | **17.7854** | **16.3332** | **17.6565** | **74.9593** | — |

**The column totals are the trap.** `opus-plus-flash-v37` looks 42% cheaper than the field — but
three of its four cells are estimated, and estimates were measured undercounting by 2–2.6× on
exactly the agentic phases that dominate these runs. Corrected, its advantage plausibly vanishes.

Note also that `feature-extend-1` used a `gemini-only` arm rather than a flash variant, so its
column placement is approximate. And `feature-extend-3/flash-only` actually ran
`flash-agsdk-only` despite the branch name.

---

## Per run — cost, time and output

Dispatch minutes exclude idle. One run's `change_plan` phase hung for **906.9 minutes** against a
configured 540-second timeout; that stall is excluded here and flagged in F4. Source files and
insertions exclude `.sdlc` run records and setup edits. Sorted by cost.

| Branch | Policy | Cost | Dispatch | Files | Insertions | Timing |
|---|---|---:|---:|---:|---:|---|
| `docs/opus-only` | opus-only-v5 | 0.5265 | — | 1 | 6 | none recorded |
| `docs/opus-flash` | opus-plus-flash-v37 | 0.6385 | 0.3m | 1 | 4 | partial |
| `refactor/opus-flash` | opus-plus-flash-v37 | 0.9731 | 0.6m | 3 | 50 | partial |
| `refactor/flash-only` | flash-agsdk-only | 1.0323 | 18.9m | 3 | 57 | **complete** |
| `docs/flash-agsdk` | flash-agsdk-only | 1.0356 | 7.8m | 1 | 16 | partial |
| `refactor/opus-sonnet` | opus-plus-sonnet-max | 2.0372 | 13.6m | 3 | 50 | **complete** |
| `refactor/opus-only` | opus-only-v5 | 2.5844 | 7.8m | 3 | 49 | **complete** |
| `feature-extend-3/opus-flash` | opus-plus-flash-v37 | 2.7024 | 3.9m | 11 | 1139 | partial |
| `feature-extend-1/opus-sonnet` | opus-plus-sonnet-max | 2.7070 | 17.8m | 21 | 5125 | partial |
| `feature-extend-1/opus-flash` | opus-plus-flash-v37 | 2.7874 | 9.6m | 38 | 4890 | partial |
| `docs/opus-sonnet` | opus-plus-sonnet-max | 2.8378 | 10.1m | 1 | 18 | partial |
| `feature-extend-1/gemini-only` | gemini-only | 3.5014 | 44.8m | 20 | 4906 | partial |
| `feature-extend-1/opus-only` | opus-only | 3.8845 | 12.1m | 22 | 5093 | **complete** |
| `feature-extend-3/opus-sonnet` | opus-plus-sonnet-max | 4.7042 | 13.9m | 18 | 1343 | partial |
| `feature-extend-3/opus-only` | opus-only-v5 | 5.1210 | — | 10 | 1854 | none recorded |
| `feature-extend-2/opus-flash` | opus-plus-flash-v37 | 5.9899 | 37.8m | 28 | 5365 | **complete** |
| `feature-extend-3/flash-only` | flash-agsdk-only | 6.1841 | 45.4m | 10 | 834 | **complete** |
| `feature-extend-2/opus-sonnet` | opus-plus-sonnet-max | 8.0773 | 12.4m | 33 | 5413 | partial |
| `feature-extend-2/flash-agsdk` | flash-agsdk-only | 8.0812 | 68.5m | 39 | 5091 | **complete** |
| `feature-extend-2/opus-only` | opus-only-v5 | 9.5535 | 9.2m | 45 | 5619 | partial |

The most expensive run, `feature-extend-2/opus-only` at $9.55, shows only 9.2 minutes of
dispatch — because most of its work ran in-session and was never timed. The genuinely long runs
are the agent-adapter ones: **68.5 and 45.4 minutes**, where every phase is a delegated agent
session.

---

## Findings that transfer

These came out of the runs regardless of which policy produced them, and they are the part of
this exercise that applies to work nobody here has run yet.

### F1 — Identical source output across every refactor policy

All four refactor legs produced **byte-identical** `public-column-header.tsx` and
`kanban-view.tsx`. Four policies spanning gemini-3.7-flash to claude-opus-5, three adapters, a
2.7× cost spread, zero variation in output. Each derived independently — later legs were barred
from reading sibling branches.

*Scope:* one small, tightly-specified extraction. On the docs brief, where prose has more valid
forms, the four legs diverged — so this is a property of constrained mechanical work, not a
general result.

### F2 — Review cost scales with repo surface, not diff size

Confirmed on two unrelated adapters. Where the adapter can read the repo and the packet says
*verify against source*, the reviewer reads the repo — and bills for it.

```
docs/flash-agsdk    senior review 268,296 cached in · 6.5× the writing phase · 20-line diff
docs/opus-sonnet    senior + security = 59% of run cost vs 9% for both writing passes
feature-extend-2    senior review $0.7524 on 1.84M cached input reading 19 files
```

**The counterweight is not optional.** Every defect those reviews caught required reading past
the diff — two style divergences needed a grep of the whole docs tree, and one factual defect
lived in a function the diff never touched. Trimming review scope to cut that 59% removes the
defect-finding with it.

### F3 — Turns are substitutable with supplied context, up to a hard boundary

Front-loading file excerpts into a packet instead of naming files cut one phase's cost **65%**
and its tool calls from 25 to 9. Cached input fell 1.005M → 161k. Roughly 4:1 in favour of
supplying context.

Then the same run measured where it stops. Packets editing large files blew straight through it:
**$0.576** on a 439-line component, $0.547 on a popover, $0.421 on a sidebar.

> Front-loading buys back *exploration* turns. It cannot buy back *reading* turns.

Three independent measurements in one run converge on that boundary, including the senior review
in F2 — the most expensive dispatch of the run was the one that had to read 19 files end to end.

### F4 — Six configured limits that record but do not constrain

Six mechanisms, six unrelated failure modes, one shape.

| Control | What it does instead |
|---|---|
| write-contract hook | Classifies correctly, logs the denial, permits the write. `deny()` exits 1; PreToolUse blocks only on exit 2. |
| `worker_timeout_sec` | Configured 540s. Did not fire after **906.9 minutes**, reporting `timed_out: false` throughout. |
| `budget.maxOutputTokens` | Ran to 8,144 and 8,928 against a 5,000 ceiling, `stop_reason: end_turn`, no doubling. |
| output-cap doubling | Never fires when the cap is hit inside an internal agent turn — surfaces as `vendor_error`, which the doubling logic does not recognise. |
| `outputSchema` | Passed malformed output as `success: true` three times; adapter fell back to `{raw: …}`. |
| shell access | **Unbounded.** The worker ran `pnpm typecheck` and `pnpm test` unprompted. No packet field constrains it. |

**The sixth differs in kind.** The first five fail to stop something the system knows about — it
recorded the overrun, the malformed output, the unblocked write. The sixth means the system does
not know what ran. It was visible only by parsing tool calls. A control that fails to constrain
is a weak control; a surface that leaves no trace is not a control at all.

### F5 — Provenance cannot record filenames it cannot predict

`drizzle-kit` tags migrations randomly, so `0043_odd_random.sql`, its snapshot and the journal
entry have no `--before` record. Not an oversight — a design gap affecting **any packet that
generates its own filenames**: migrations, scaffolds, hashed or timestamped codegen.

Nineteen prior runs never surfaced it because they touched only files named in advance. It was
found by reconciling `provenance.json` against `git status` as a set difference, which also
corrected the run's own tally from one gap to four.

> `apps/api/drizzle/meta/_journal.json` is tracked and modified — it must be **restored**, not
> deleted. A revert that deletes unrecorded files breaks every migration in the repo.

### F6 — Withholding help produced the only unconfounded results

Across the docs set, two legs were given pre-solved answers and two were not. Both withheld-help
legs independently derived every factual distinction — including one that a helped leg had
shipped wrong and corrected only after review.

One of them went further: its reviewer caught a style defect its own writer had introduced,
having never been told to look. Same model tier, separate sessions.

**The two legs that received help are the two whose results carry asterisks.** This is a finding
about how to run a comparison, not about which policy is better.

---

## What to look at next

**Fix the write contract — carefully.** Changing `exit(1)` to `exit(2)` is the obvious
one-character fix and it will break every run immediately: the checker currently *denies* a run's
own `.sdlc` artifact writes. The run-directory carve-out must land first.

**Re-measure one estimated run.** Four of five briefs are entirely estimated. Re-running a single
leg under `vendor` would put a real multiplier on the heuristic and make the column totals
rankable instead of suggestive. Cheapest thing that would materially improve this dataset.

**Scope what the reviewer reads.** F2 and F3 together imply the cost driver is the instruction
*verify against source*, not the model tier. If so, bounding review scope beats downgrading the
reviewer — and no run has tested that.

**The completion-adapter Flash arm is now missing.** `feature-extend-2/flash-only` was deleted at
`b62ad075`. Without it the set cannot separate Flash-the-model from the agent adapter's per-turn
overhead. Recoverable by SHA until GitHub garbage-collects.

**Two shared briefs carry defects.** The docs brief pointed acceptance criteria at the wrong hook
file, undetected through two runs. The feature brief's allowlist omitted `apps/web/src/lib/`,
blocking eight packets. Both were caught mid-run, not by review.

**Close every run with a reconciliation.** F5 was found by diffing `provenance.json` against
`git status` rather than trusting the run's own count of `--before` calls. Self-reported tallies
drift; set differences do not.

---

## Method

Costs read from each run's `telemetry.jsonl`, summed across all events excluding `task_type:
smoke`. Source counts from `git diff --name-only main...<branch>` excluding `.sdlc/` records and
the `.gitignore` / `biome.json` setup edits. Timing summed from `latency_ms`; events recording
`null` (in-session phases) contribute nothing, which is why 13 runs are marked partial.

Nothing merged to main. Every run's full record — requirements, change plan, packets, reviews,
telemetry, provenance — is committed on its own branch.

# Run summary — 20260831-060942-docs-board-features

**Mode:** brownfield · **Intent:** `docs` · **Task type:** `doc_update`
**Policy:** `opus-only-v5` (single tier, `claude-opus-5` via `claude-cli`) · **Auth mode:** `estimated`
**Repo:** kaneo @ `5d1fc910`, branch `refactor/opus-flash` · **Committed:** no (no commit, push, or PR — per AGENTS.md)

## Outcome

One file changed, additively, on the first attempt:

```
apps/docs/core/functional/plan-and-execute-tasks.mdx | 6 ++++++
1 file changed, 6 insertions(+), 0 deletions(-)
```

Section 5 "Use filters to focus" now documents the active-filter-chip UI: chips read subject +
operator + value; the value names the selection only when exactly one value is active and is a
count otherwise, with the Labels chip always a count; each chip's clear control clears the whole
filter field; **Clear all filters** appears inside the filter menu once any filter is active.

Frontmatter untouched, no heading added or renumbered, five-item field list preserved, zero
deleted lines, no new page, `docs.json` untouched, no code file touched, no mention of WIP limits
or hours rollup.

## Gates

| Gate | Outcome |
|---|---|
| 0 — discovery | approved before this session (scope reduced to filter chips only) |
| 1 — requirements | approved |
| 2 — architecture | **skipped** — intent matrix: `docs` SKIPs architecture, so Gate 2 skips too |
| 3 — security review | approved (VERDICT pass, 0 gating findings) |
| 4 — final acceptance | pending |

## Cost

| Phase | task_type | Cost (USD) | in | out | Provenance |
|---|---|---:|---:|---:|---|
| docs (pre-check smoke) | `smoke` | 0.137411 | 13197 | 11 | **vendor** |
| requirements_analysis | `requirements` | 0.089230 | 6631 | 2243 | estimated |
| architecture_design | `skipped` | 0.000000 | 0 | 0 | — |
| plan_task_packets | `decomposition` | 0.054190 | 2643 | 1639 | estimated |
| docs | `doc_update` | 0.038120 | 4579 | 609 | estimated |
| senior_code_review | `review` | 0.142265 | 10688 | 3553 | estimated |
| test_run | `doc_lint` | 0.000000 | 0 | 0 | — |
| security_review | `security_review` | 0.134780 | 10526 | 3286 | estimated |
| generate_final_report | `report` | 0.067895 | 1579 | 2400 | estimated |
| **Total** | | **0.663891** | | | |

Pricing from `opus-only-v5`'s `pricing:` block only: input $5/M, cached $0.50/M, output $25/M.

## Comparison with the sibling run — read the caveat before the number

Sibling: run `20260831-042943-docs-board-features`, branch `docs/opus-flash`, policy
`opus-plus-flash-v37`, same frozen brief, same repo state, **$0.638539**, accepted.

**Raw totals: this run $0.663891 vs sibling $0.638539 — this run is $0.025 (4%) more expensive.**
On n=1 that difference is not meaningful on its own, and the raw comparison is not the honest
headline. Two things matter more.

### 1. The two runs' "estimated" numbers are not equally accurate

Both runs label their review phases `provenance: "estimated"` on the same artifact-level
char/3.8 basis with `input_tokens_cached: 0`. Same label, different accuracy:

| Phase | Sibling declared | This run declared | This run **measured** | Undercount |
|---|---:|---:|---:|---:|
| senior_code_review | 30699 tok / $0.191475 | 14241 tok / $0.142265 | **37636 tok** | **2.64x** |
| security_review | 30873 tok / $0.193825 | 13812 tok / $0.134780 | **28042 tok** | **2.03x** |

The sibling's declared estimates (30699, 30873) sit close to this run's *measured* consumption
(37636, 28042). This run's own declared estimates undercount its own measured truth by 2.0-2.6x.
The artifact-level estimator counts the files a phase consumed and the artifact it produced; it
does not count a subagent's multi-turn tool loop, and both reviewers here ran 18-20 tool calls.

**Consequence:** scaling this run's two review phases to measured tokens (holding the declared
in/out mix) puts them at $0.649616 instead of $0.277045 — **+$0.372571**, for an adjusted total
near **$1.04**. Against the sibling's declared $0.638539 that is roughly +62%, not +4%.

This is a scenario, not a measurement, and it is asymmetric in a way that must be stated: the
sibling's *non-review* phases were not independently measured either, so its true total is also
above its declared figure by an unknown amount. What is established is narrower and still
decisive — **this run's declared total understates its own cost by a factor this run directly
measured, and the sibling's does not appear to understate its own by nearly as much.** The
earlier framing that "both understate similarly, so the comparison stays fair" was wrong once
the sibling's actual figures were available.

### 2. What would have to hold for a total-vs-total comparison to be fair

- **Same estimator accuracy, not just the same estimator label.** Currently false, per above.
- **Same task_type routing behavior.** Held: this run's `doc_update` packet hit `opus-only-v5`'s
  default rule (`rule_index -1`, "Single-model, premium tier"), since the policy defines no
  docs-specific rule.
- **Same number of correction cycles.** **Not held — and it favors this run.**
- **Same packet prescriptiveness.** Not held: requirements input was 6631 tok here vs 15470
  sibling, because the two orchestrators received instructions of different length and detail.
  Same "packet prescriptiveness drift" seen in the four-run refactor comparison; a known
  measurement confound, not a new defect.

### 3. Correction cycles — the quality datapoint

- **This run: 1 write attempt on the `.mdx`, 0 refinement packets.** Senior review approved with
  all three falsifiability traps PASS on the first attempt.
- **Sibling: 2 write attempts**, its first draft having fallen into the FT-1 "chips show selected
  values" trap and corrected only after review.

The difference is explained by *where the trap was caught*, not by model strength: FT-1/FT-2/FT-3
were specified up front in this run's requirements (§5 "Falsifiability traps") because the
operator supplied the trap, rather than being discovered by review. Any conclusion about
single-tier quality drawn from this pair would be confounded by that. Two consequences:

- A cost comparison between a 1-attempt run and a 2-attempt run compares different amounts of
  work, in both directions — the sibling paid for a correction this run did not, and this run
  paid a premium tier for a doc edit the sibling's mechanical tier produced.
- The known provenance/backup gap for files written more than once in a run **was not triggered
  here** — one write, `sha_before`/`sha_after` both recorded, file tracked in git so no backup
  was required.

## Verification

**No automated test was run, and none exists that could be.** Demonstrated, not asserted:

- `apps/docs` has no `package.json`, so it is not a turbo workspace package and `turbo test` /
  `turbo lint` never reach it.
- No `mintlify`, `remark-lint`, or `markdownlint` tooling exists anywhere in the repo.
- `pnpm exec biome check apps/docs/core/functional/plan-and-execute-tasks.mdx` returns
  `Checked 0 files` and lists the path under "these paths were provided but ignored".

Verification was therefore structural and factual, which is the appropriate proof for this
change: zero-deletion diff review; claim-by-claim recheck against `board-toolbar.tsx` and
`use-task-filters.ts`; UI copy matched against `i18n/en-US.json`. The senior and security
reviewers each re-derived the behavioral claims from source independently.

## Findings carried out of this run (none blocking)

1. **Two files outside the allowlist are dirty and are not this run's writes.** `.gitignore`
   (+6, `.sdlc` hygiene) and `biome.json` (+1, `!**/.sdlc`), both mtime `06:15:53`, ~7.5 min
   before this run's only write and before pre-flight at `06:16:43`. Gate-0 housekeeping,
   independently confirmed by the security reviewer via mtime and content. They are **absent from
   `provenance.json`**, so `/mmo:revert` on this run would not undo them.
2. **Live instance of the known hook limitation.** Neither path is in this run's
   `write-contract.json` allowlist, yet both were written — consistent with the standing finding
   that the PreToolUse hook cannot block (`deny()` exits 1; PreToolUse blocks only on exit 2).
3. **The artifact-level estimator undercounts agentic phases** by 2.0-2.6x here. Any future
   cross-policy comparison should either measure subagent tokens directly or apply the estimator
   only to single-shot phases.
4. **Pre-existing, non-gating (security reviewer, out of scope):**
   `apps/web/src/hooks/mutations/use-sign-out.ts` never clears `localStorage`, so
   `kaneo:board-filters:*` survives logout — project IDs and assignee user IDs readable on a
   shared profile. Low severity, opaque identifiers only. Backlog item, not a docs-run fix.
5. **Pre-existing, non-gating (senior reviewer, out of scope):** the Labels chip counts raw label
   ids while the menu groups by name+color, so the count can exceed the number of distinct labels
   a user thinks they picked. The prose deliberately avoids claiming the count equals a number of
   labels.

## Artifacts

- `requirements.md` · `packets.json` · `review.json` · `security_review.md`
- `manifest.json` · `telemetry.jsonl` · `provenance.json` · `discovery.md` · `baseline.json`

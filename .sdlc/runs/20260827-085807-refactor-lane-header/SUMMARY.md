# Run Summary — refactor — Extract `PublicColumnHeader`

- **Run:** `20260827-085807-refactor-lane-header`
- **Mode:** brownfield · **Intent:** `refactor`
- **Policy:** `opus-plus-flash-v37` · **Auth mode:** `estimated`
- **Base commit:** `5d1fc9104337786c3ef295ec0dc31656df371d8d` (no commits made by this run)
- **Outcome:** completed · Gates 1–3 approved · Gate 4 pending

## What changed

Pure structural extraction of the inline column-header JSX from the **public, read-only** kanban
board into its own component. Rendered DOM and Tailwind classes unchanged.

| File | Kind | Packet |
|---|---|---|
| `apps/web/src/components/public-project/public-column-header.tsx` | new | `tp_codegen_001r1` |
| `apps/web/src/components/public-project/kanban-view.tsx` | edit | `tp_codegen_002` |
| `apps/web/src/components/public-project/public-column-header.test.tsx` | new | `tp_tests_001` |

No other path was written. `git status --short` shows only these three plus the user's own
pre-existing `.gitignore` and `.claude/settings.local.json`, neither touched by this run.

## Verification

| Gate | Result |
|---|---|
| `pnpm --filter @kaneo/web typecheck` | exit 0 |
| `pnpm --filter @kaneo/web test` | **37 files / 113 tests passing** vs. baseline 36 / 112 — exactly +1 file, +1 test, **0 new failures** |
| `pnpm exec biome ci` (3 changed paths only) | exit 0, "No fixes applied" |
| Senior review | **approved**, 0 findings |
| Security review | **pass**, 0 findings |

Root `pnpm lint` and root `pnpm test` were never run, per the frozen Gate 0 constraints.

### The DOM invariant

Verified three times independently, mechanically rather than by line diff: the senior reviewer
tokenized both blocks into an ordered tag+className sequence, the security reviewer compared
whitespace-stripped strings, and the coordinator re-checked by hand. All three agree.

Two source-text reflows occurred, both whitespace-only and adjacent to expression children, so
both are DOM-neutral under JSX whitespace rules:
- the `span` wrapped its `{column.tasks.length}` onto its own line (planned, matches Biome output);
- the `h3` collapsed from 3 lines to 1 (**not flagged at Gate 2 — an omission in the orchestrator's
  gate description, caught later by the senior reviewer**).

## Cost

Pipeline cost excludes the two pre-check smoke dispatches at 08:59, which ran before this
pipeline started and are reported separately.

| Phase | Model | Cost |
|---|---|---|
| requirements_analysis | claude-opus-5 | $0.1354 |
| change_plan (architect) | claude-opus-5 | $0.2225 |
| plan_task_packets | claude-opus-5 | $0.0673 |
| codegen (P1 + P2) | gemini-3.7-flash | $0.0207 |
| tests (P3) | gemini-3.7-flash | $0.0122 |
| senior_code_review | claude-opus-5 | $0.2796 |
| security_review | claude-opus-5 | $0.2354 |
| **Pipeline total** | | **$0.9731** |
| — pre-check smoke (before this run) | both tiers | $0.1362 |
| **telemetry.jsonl file total** | | **$1.1093** |

By model, pipeline only: `claude-opus-5` **$0.9402 (96.6%)** · `gemini-3.7-flash` **$0.0329 (3.4%)**.

The mechanical tier produced all three code artifacts for **3.3 cents**, every one first-shot with
zero refinement packets. The premium share reflects the task shape — ~30 lines of codegen wrapped
in six judgment phases — not a routing failure.

**Included line item:** `tp_codegen_001` cost **$0.000731 for zero output**. Vertex returned
429 RESOURCE_EXHAUSTED on the first P1 dispatch; input was billed, nothing was produced. A 60s
backoff cleared it and `tp_codegen_001r1` succeeded on attempt 1. Not a packet defect.

## Known issue — `task_type` routing gap (policy-level, not a defect in this run)

**The most actionable finding of this run.**

`opus-plus-flash-v37`'s codegen rule matches an explicit `task_type` allowlist containing
`react_component`, `dto`, `service_method` and similar — but **none of the brownfield primitives**
(`new_file_add`, `existing_file_edit`, `patch_apply`, `refactor_extract`) that
`pipeline/SKILL.md`'s brownfield table instructs the planner to emit.

- **Bend applied:** `task_type: "react_component"` so packets match codegen rule index 7, with the
  brownfield primitive preserved in `subtype` (`new_file_add`, `existing_file_edit`).
- **Routing without the bend:** all three packets miss every rule and fall through to
  `default: "opus"` — the entire refactor runs at premium rates.
- **The failure mode is silent.** The run still completes, every packet still succeeds, and the
  report still says success. Nothing in the telemetry flags the routing as wrong; the only
  observable difference is the model name on each event. A reader checking "did it work?" would
  see green.

**Consequence for the planned comparison:** three further runs of this identical task are planned
under different policies. The same bend must be applied identically in each, or the cross-policy
cost comparison measures the workaround rather than the policies.

**Recommended fix:** add the brownfield primitives to the codegen rule's `task_type` list in the
policy YAML, or add a rule matching on `subtype`, so the pipeline skill and the policy agree.

## Scope honesty

- **`npm audit` was not run.** No dependency delta exists, so it would surface only pre-existing
  repo-wide advisories unactionable from this run. The repo's dependency posture is
  **unassessed by this review**, not clean.
- **The test proves an icon renders, not which icon.** `container.querySelector("svg")` is truthy
  on every `getColumnIcon` branch. Accepted as proportionate for an extraction test; the test name
  says "an icon" and does not overclaim.
- **The write-contract hook was never exercised.** Every write targeted an allowlisted path, so no
  refusal path ran. `.hook-logs/hook.jsonl` records only `mcp_tool_postuse` telemetry events (4,
  matching the 4 dispatches) and carries no write-decision entries. That only the three allowlisted
  paths changed is evidenced by `git status`, not by a hook log.
- **Direct-tier costs are estimates** (`auth_mode: estimated`). Three were corrected upward from
  the char heuristic using subagent-reported totals, which the heuristic understated by not
  accounting for context re-sent each tool turn. Mechanical-tier costs are vendor-reported.

## Rollback

```
/mmo:revert 20260827-085807-refactor-lane-header
```

Restores all three files. `kanban-view.tsx` was tracked and clean at write time, so it reverts
from git; the two new files are untracked and are deleted. No backup copies were needed and no
commits were made (`git_head_before == git_head_after`, 0 commits recorded).

## Artifacts

All under `.sdlc/runs/20260827-085807-refactor-lane-header/`:
`requirements.md` · `change_plan.md` · `packets.json` · `review.json` · `security_review.md` ·
`manifest.json` · `telemetry.jsonl` · `provenance.json` · `test-baseline.json` · `SUMMARY.md`

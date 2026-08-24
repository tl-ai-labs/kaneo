# Final Report — Task `estimatedHours` + per-column rollup

- **Run:** `20260824-042617-feature-extend-task-hours`
- **Mode / intent:** brownfield / feature-extend
- **Policy:** `opus-plus-flash-v37` (stock, unmodified) · **auth_mode:** `vendor`
- **Branch:** `feature-extend-2/opus-flash` · **Base:** `5d1fc910`
- **Committed:** no. `git_head_after == git_head_before`, 0 commits. Run stops at the working tree.

---

## 1. Headline: this arm is the most expensive, and the cheap tier is not why

| Tier | Model | Cost | Share |
|---|---|---:|---:|
| `opus` | claude-opus-5 (Claude Max via `claude-cli`) | **$5.3738** | **89.7%** |
| `flash-completion` | gemini-3.7-flash (Vertex ADC) | **$0.6161** | **10.3%** |
| | **Total** | **$5.9899** | |

**Gemini 3.7 Flash produced essentially all of the code and all of the tests for 10% of the bill.**
Every source file, every test file, the MCP schema work and the debug fix came out of the mechanical
tier. What dominated was premium *planning and review*: `change_plan` + `plan_task_packets` +
`senior_code_review` + `security_review` = **$4.10, or 68% of the run**, and not one of those phases
produced a line of shipped code.

**Against the comparison arm:** `opus-plus-sonnet-max` completed the whole of its (different) ticket
for **$2.7070**. This arm is **2.2x** that. Adjusting away every avoidable loss below still leaves
**~$4.63**, i.e. **~1.7x** — so this arm is the most expensive *even after* discounting its own
mistakes. The mixed-tier saving on codegen was real but small in absolute terms, and it was
swamped by premium judgment phases.

### Cost by phase

| Phase | Cost | Tier |
|---|---:|---|
| `change_plan` | $1.4103 | opus |
| `codegen` | $1.3671 | $0.8814 opus (misrouted) + $0.4857 flash |
| `senior_code_review` | $1.2467 | opus |
| `plan_task_packets` | $0.8888 | opus |
| `security_review` | $0.5512 | opus |
| `requirements_analysis` | $0.3953 | opus |
| `tests` | $0.1167 | flash |
| `debug` | $0.0136 | flash |

31 telemetry events, 8 failed dispatches. Tokens: 311,288 in · 533,228 cached · 157,395 out.

### Waste breakdown

| What | Cost | Cause |
|---|---:|---|
| Misrouted codegen (4 packets, pre-decision) | **$0.8814** | Plugin bug #1 below. Ran on Opus at ~6x. |
| Flash output-cap failures (3 dispatches) | **~$0.29** | My `old_string` anchors echoed whole 30-line blocks, blowing past flash's 8,192 hard ceiling. |
| Mis-built review packet | **$0.1782** | I left a forward-reference placeholder and attached no diff. The reviewer correctly refused rather than rubber-stamping. |
| `claude-cli` 300s timeouts (2) | **$0.00** | No partial output, no charge. Cost was wall-clock only. |
| Vertex 429s (2) | **~$0.003** | Transient; both retried clean. |
| **Total avoidable** | **~$1.36** | **Adjusted run ≈ $4.63** |

---

## 2. Two upstream plugin bugs

### Bug 1 — every mixed policy silently sends all brownfield codegen to the premium tier

**Severity: high. Affects every brownfield run under any mixed policy.**

`config/policies/*.yaml` gate the codegen rule on an explicit `task_type` allowlist holding only the
**greenfield Nest vocabulary**:

```yaml
- when:
    phase: codegen
    task_type: [controller_handler, service_method, dto, module_wiring, migration,
                seed_data, entity, guard, interceptor, filter, react_component,
                react_page, api_client, frontend_util, frontend_config, frontend_html]
  use: gemini-flash
```

Brownfield packets use the vocabulary defined in `skills/pipeline/SKILL.md` §"Brownfield-mode task
types (v1)" — `existing_file_edit`, `new_file_add`, `patch_apply`, `doc_addition`, `doc_update`,
`test_add`, `test_backfill`, `bug_reproduce`, `bug_diagnose`, `bug_fix_apply`, `refactor_extract`,
`dependency_add`. **None appear in that list**, so no rule matches and every codegen packet falls
through to `- default: opus`, logged as `rule_index: -1, "Unrecognized task — fail safe to premium"`.

The operator independently confirmed **none of the seven bundled policies** lists the brownfield
types. The `tests` rule (`- when: { phase: tests }`) has no `task_type` filter and routes correctly,
so the defect is confined to `codegen` — which makes it easy to miss, because the run still *works*
and only the bill differs.

**Fix:** add the brownfield task types to the codegen rule in every mixed policy, or drop the
`task_type` filter and gate on `phase` alone.

**Workaround used here (operator DECISION 1, policy left stock):** the 14 pending codegen packets
were re-typed to the greenfield vocabulary that the rule actually matches — `controller_handler` for
API route/controller work, `react_component` for web components, `dto` for the schema change. This is
recorded as a `routing_note` on every affected packet in `packets.json`. The first re-typed dispatch
was verified as `model_id: flash-completion, rule_index: 7` **before** the remaining packets were
allowed to spend.

### Bug 2 — reviewer subagents emit zero telemetry under `auth_mode: vendor`

**Severity: medium. Corrupts cost measurement on any benchmarked run.**

`agents/orchestrator.md` directs `architecture_design`, `senior_code_review` and `security_review` to
the `architect` / `senior-reviewer` / `security-reviewer` subagents. Subagent invocations do not pass
through `execute_with_model`, so they emit no TelemetryEvent. Under `auth_mode: vendor` — whose stated
purpose is that *every* LLM call is vendor-metered — this silently omits the single most expensive
category of work. Here that would have hidden **$1.7979** of Opus review spend, 30% of the run.

**Fix:** either route these phases through `execute_with_model` under vendor mode, or have subagents
emit telemetry via `log_telemetry`.

**Deviation taken here (operator-ratified at Gate 3):** all three review phases were dispatched via
`execute_with_model` instead of via subagents, so their cost appears in the split above. **The
numbers in this report are therefore complete, but were produced by a documented departure from the
orchestrator spec.** Reason: a review phase invisible to the cost split would defeat the purpose of a
benchmark arm — a spec deviation that preserves the measurement beats fidelity that destroys it.

---

## 3. Packet granularity changed mid-run — per-packet comparison is unsound

| | Count |
|---|---|
| Planned (v1, granular) | **25** |
| Planned (v2, consolidated) | **5** |
| Executed as planned | **5** |
| Refinement / debug / retry packets | **6** |
| Total successful dispatches | 23 of 31 events |

The original plan was 25 one-file packets. After the routing defect surfaced, the operator directed
(DECISION 2) consolidation to ~3 codegen + 2 test packets grouped by surface, on the grounds that
per-packet overhead was a large part of the cost. The v1 plan is preserved at
`packets.v1-superseded.json`; `packets.json` holds the executed v2 plan plus the 4 already-completed
v1 packets.

**Consequence for the study: per-packet cost, per-packet latency and packet-count metrics from this
arm are NOT comparable with prior arms.** Whole-run totals remain comparable. The 4 packets that ran
before the change are recorded with `status: "completed"` and `routed_model_id: "opus"` so they can be
excluded from any per-packet analysis.

The consolidation also exposed a real ceiling: **flash's `max_output_tokens_absolute` is 8,192**, and
the doubling retry cannot exceed it (8000 → 8192 → fail). Three dispatches died there. The fix was not
smaller packets but *smaller anchors* — constraining `old_string` to the shortest unique 1–3 line
snippet cut one packet's output from 16k to 4.7k tokens and it passed intact. Only two packets were
genuinely split.

---

## 4. What shipped

18 files changed, 9 new — **+298 / −19** in tracked source. **28 unique paths** recorded in `provenance.json` (38 records; the extra 10 are repeat before/after pairs from senior-review refinement). See §10 for the full count reconciliation against the commit.

**API.** Nullable `estimatedHours` integer column on `taskTable`; generated migration
`0043_skinny_mockingbird.sql` (single additive `ADD COLUMN`, no default, no backfill); one shared
Valibot `estimatedHoursValidator` (integer 0..1000) used by both the create and update bodies;
`create-task` / `update-task` / `get-task` / `get-tasks` threading; MCP `create_task` / `update_task`
schemas and `buildFullTaskUpdateBody`.

**Web.** `Task` type gains `estimatedHours?: number | null`; create/update fetchers; `use-create-task`;
two new components (`estimated-hours-input.tsx`, `task-estimated-hours-popover.tsx`); the
task-properties sidebar (**all three** render paths — the design said two); the create-task modal
(state, both resets, `normalizeTask`, draft creation, both submit branches, trigger); the kanban
column-header rollup pill.

**i18n.** 15 new keys in `en-US.json` only, using the repo's no-base-key `_one`/`_other` plural form.

**Tests.** 7 new/extended files: PostgreSQL integration suite, two API unit suites, three web suites,
one appended modal test.

### The design decisions that held

`DR-1` client-side rollup · `DR-2` integer whole hours (`0` is a real estimate, distinct from `null`)
· `DR-3` 0..1000 at Valibot before any DB write · `DR-4` modal + sidebar + two new components ·
**`DR-5` preserve-on-omit** — the highest-risk decision, implemented by conditionally assigning the
key rather than copying the `x || null` shape that would have let every drag-and-drop erase an
estimate · `DR-6` three-state pill distinguished by text, `data-estimate-state` and accessible name,
never colour.

---

## 5. Verification

| Check | Result |
|---|---|
| `biome check` (apps, packages, tests, i18n) | **pass** — 1186 files, 0 errors, 78 pre-existing warnings |
| `pnpm typecheck` | **pass** 6/6 turbo tasks |
| API unit | **pass 391/391** across 60 files |
| Web unit | **pass 132/132** across 39 files |
| API integration (live PostgreSQL) | **pass 187/187** across 30 files |
| `pnpm i18n:check` | **red — expected, not damage** (see below) |

**Integration DB.** `kaneo_test` did not exist beforehand, so the harness created and migrated it from
zero. No cross-arm `0043` collision. `DATABASE_URL` had to be passed directly to vitest —
`pnpm test:integration` routes through turbo, which does not forward the variable and fails with
`ECONNREFUSED 127.0.0.1:5432`.

**`i18n:check` is red for exactly two reasons**, neither caused by this run: the pre-existing
`common:error.*` and Slavic-plural gaps at baseline, and the legitimate widening from 15 new en-US
keys across 16 locales. `i18n:check:fix` was **not** run.

**Migration formatting.** `db:generate` produced the documented 313-insertion / 306-deletion churn in
`_journal.json`; `npx biome format --write` on the generated meta files collapsed it to **+7 lines**,
and `biome ci apps/api/drizzle` is clean.

**Full-repo `biome ci .` still fails** — 78 formatting errors, all in `.sdlc/**` run-bookkeeping JSON
(2-space vs the repo's tab). The `.sdlc/` exclusions for `.gitignore` and `biome.json` are applied at
commit time, outside this run, per the write contract. No source file is implicated.

---

## 6. Review outcomes

Both senior reviews returned **`request_changes`** with substantive findings; all were fixed and
re-verified. The genuinely important ones:

1. **`input[type=number]` silently destroyed estimates.** The browser sanitizes unparseable typing to
   `""`, which parsed as `null` and committed on blur. Exactly the data loss `DR-5` exists to prevent,
   arriving through the UI instead of the API. Now `type="text"` + `inputMode="numeric"`.
2. **MCP was preserve-only.** Neither tool's Zod schema declared `estimatedHours`, and Zod strips
   unknown keys, so `patch.estimatedHours` was permanently `undefined` — clients could never set or
   clear. Verified directly before fixing. Both schemas widened.
3. **The MCP test protected nothing** — it re-implemented the function under test and would have
   passed against reverted code. `buildFullTaskUpdateBody` is now exported and imported. When the
   model wrote the replacement it **inverted the argument order** (`existing`/`patch`), which would
   have tested the patch path while claiming to test preservation; caught and corrected by hand.
4. **`0` never crossed HTTP in any test.** A `?? null` → `|| null` regression would have failed
   nothing. Added a case driving `0` through both POST and PUT.
5. **A vacuous assertion.** `expect(aria-label).toBeTruthy()` passes under a key-echoing `t` even if
   all three states shared one key. Now asserts exact keys per state.
6. **The sidebar has three render paths, not two.** The design was wrong; all three got the field.

**Security review: pass with notes**, four `info` findings, none blocking. Both Gate-3 revisions are
closed in `security_review.md`: the response `taskSchema` now mirrors the request constraint
(AGENTS.md contract boundary), and both middleware chains were read directly and recorded verbatim
rather than inferred.

---

## 7. Follow-ups (not done here — deliberately out of scope)

1. **`apps/docs/openapi.json` is ~11 route-groups stale.** The new `estimatedHours` field is described
   in route metadata in code but not reflected in the checked-in artifact. Regenerating drags in
   ~1,481 insertions / 166 deletions of unrelated churn, so it needs its own change. CI has no
   spec-freshness check, which is why the gap grew unnoticed — adding one is worth its own ticket.
2. **`packages/mcp`** (the published stdio package) was off-limits. If its tool schemas enumerate task
   fields, it needs `estimatedHours` to reach parity with the HTTP MCP surface.
3. **`updateTask` now takes 12 positional parameters** with three trailing optionals. This should be
   the last field added positionally; convert to an options object before the next one.
4. **The estimate change raises no activity entry or event.** Deliberate for this run, but worth a
   product decision on whether it should, consistent with `dueDate` / `priority`.
5. **Plugin bugs 1 and 2** above.
6. **Sidebar duplication** — the ~18-line estimate block is repeated across all three render paths;
   extracting a local component would stop the next change drifting between them.

---

## 8. Honest limitations of this arm as a data point

- **Not a clean policy measurement.** Four codegen packets ran on the wrong tier before the defect was
  caught, and the workaround required deliberately mis-describing packet `task_type` values. The
  policy file itself was left stock, so the arm is comparable at the *policy* level, but the packets
  are not labelled the way a correct implementation would label them.
- **Packet granularity changed mid-run** (§3) — per-packet metrics are unusable.
- **Review phases deviated from the orchestrator spec** (§2, bug 2) — deliberately, and with operator
  ratification, to keep the cost split complete.
- **Three orchestrator-caused failures** ($0.47 combined) are mine, not the policy's: two anchor-size
  blowouts and one mis-built packet. A more careful operator would have spent ~$5.52.

---

## 9. Closeout (Gate 4 — accepted)

Accepted with all nine phases complete and 5/5 packets executed. Final cost **$5.9899**.

**Operator re-verified at acceptance:** API unit **391/391** across 60 files, web unit **132/132**
across 39 files. Integration was **not** re-run at acceptance (it needs the PostgreSQL container on
`:55432`); the run-time result of **187/187** across 30 files stands as reported.

### One repo change made outside the run's write contract

`biome.json` gained `"!**/.sdlc"` to its `files.includes` negation list. **This was made by the
operator, not by this run.** It is deliberately absent from `provenance.json` and from the
write-contract allowlist — the PreToolUse hook would have refused it — and must not be counted as run
output.

**Why it was needed.** The husky pre-commit hook runs `pnpm exec biome ci .`, which scans a wider set
than the run's verification did: 1293 files including the SDLC working directory. It failed with 79
errors, **every one of them in `.sdlc/` run artifacts** — baselines, ledgers, `state.json`,
`write-contract.json`, prior runs' delegation JSON and backup `.ts` files — and none in feature code.
This run's claim of "biome ci clean on 1186 files" was accurate *for the source set*; the hook simply
checks a broader one. After the exclusion: `biome ci` exit 0 over 1198 files, and `pnpm run build`
exit 0 across 7/7 tasks, so both pre-commit gates pass.

### Repo-level observation: this is the third instance of one flaw

Biome's file discovery treats generated and tooling output as source. Three separate manifestations
have now been hit in this repository:

1. **`apps/api/drizzle/**`** — documented in the project fingerprint. `db:generate` writes
   2-space-indented JSON into a tab-formatted repo, rewriting `_journal.json` wholesale (313
   insertions / 306 deletions for what should be a 7-line append) and reddening `biome ci`, the first
   CI job. **Still unexcluded**, and still requires a manual `biome format --write` on the generated
   meta files after every single `db:generate`. This run paid that tax once.
2. **`.sdlc/**`** — the pre-commit failure above, fixed at closeout.
3. The pattern was already being managed ad hoc by the existing negation entries `!**/.claude`,
   `!**/.pi`, `!**/.pi-subagents`, `!**/openapi.json` — each one a previous instance of the same
   problem, solved individually rather than as a class.

**Recommended follow-up (NOT applied):** fold `"!**/apps/api/drizzle"` into the same negation list.
That single line would retire the standing `db:generate` → `biome format --write` workaround
permanently, and it follows a pattern the file already establishes four times over. It is listed in
`manifest.json` under `recommended_followups` as `biome-drizzle-exclusion`.

### Commit status

`committed` remains **false** in this bookkeeping. `git_head_after` is `null` and the commit list is
empty. The operator is committing the feature work to `feature-extend-2/opus-flash` directly, at the
user's explicit instruction; the SHA will follow, at which point `provenance.json` can record
`git_head_after` and the commit list accurately. **The run did not perform the commit**, which is
what makes `/mmo:revert` still meaningful for these 38 tracked paths.

---

## 10. Commit record and count reconciliation

The feature work was committed **by the operator**, at the user's explicit instruction — not by this
run. The run itself performed no `git` write operation at any point.

**`33e24240`** — *feat(task): add optional estimated hours with per-column rollup*
Branch `feature-extend-2/opus-flash`, parent `5d1fc910` (this run's `git_head_before`).
**29 files, +5366 / −19.** Both husky pre-commit gates passed: `biome ci .` exit 0, `pnpm run build`
exit 0. **Not pushed. No pull request.**

The +5366 is not a code-volume signal: it is dominated by `apps/api/drizzle/meta/0043_snapshot.json`,
the generated drizzle snapshot. Hand-written change remains **+298 / −19**.

### Reconciling three different file counts

Three numbers appear across this report and they are all correct for different sets. Stated
explicitly so the record is not subtly wrong:

| Figure | Value | What it actually counts |
|---|---:|---|
| Provenance **records** | 38 | Every `--before` / `--after` pair written, including files edited **twice** during senior-review refinement |
| Provenance **unique paths** | **28** | Distinct run-touched source files. **Zero `.sdlc/` paths** — provenance tracks source only |
| Commit `33e24240` files | **29** | The 28 run-touched paths **+ `biome.json`** (operator's out-of-contract change, §9) |
| Run-time report figure | 27 | An artefact: `git status --porcelain` collapses the untracked directory `tests/api/task/` into one line covering two files |

**Set difference, computed rather than asserted:**
- In provenance but **not** in the commit: **none**. Every run-touched path landed.
- In the commit but not in provenance: **`biome.json`** only — correctly excluded from provenance
  because the run did not make that change.

The 10 duplicate records are `schemas.ts` and `task-estimated-hours.test.ts` (3x each), plus
`mcp/tools.ts`, `estimated-hours-input.tsx`, `task-estimated-hours-popover.tsx`,
`create-task-modal.tsx`, `build-full-task-update-body.test.ts` and `column-header.test.tsx` (2x each)
— all files the senior review sent back for a second pass.

**Two earlier statements are corrected by this section:** the run-time figure of "27 files touched",
and the characterisation of provenance's 38 as "including `.sdlc/` artifacts". Provenance holds 28
unique source paths and no `.sdlc/` entries at all.

### `.sdlc/` is not yet committed

`.sdlc/` is **not** in `33e24240`, and the user has explicitly declined to gitignore it. A second
commit is being held until this manifest is final, so that it captures settled state rather than a
half-written one — which means **these very closeout writes will land in that follow-up commit, not
in `33e24240`**. `sdlc_committed` is therefore `false` in both `state.json` and `manifest.json`.

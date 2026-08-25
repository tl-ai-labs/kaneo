# Final report — feature-extend — Per-lane WIP limit with over-cap indicator

**Run** `20260824-095555-feature-extend-wip-limits` · **Mode** brownfield · **Intent** feature-extend
**Policy** `opus-plus-flash-v37` (premium `claude-opus-5` via claude-cli; mechanical `gemini-3.7-flash` via Vertex ADC, project `ai-studies-console`, location `global`)
**Auth mode** `estimated` · **Outcome** completed · **Nothing committed, pushed, or opened as a PR.**

---

## 1. What shipped

An optional per-lane work-in-progress limit, soft by design.

- `columnTable` gains a nullable `wipLimit` integer (`wip_limit`), no default, no index.
- Migration `0043_broken_weapon_omega.sql` — a single additive `ALTER TABLE "column" ADD COLUMN "wip_limit" integer;`.
- The column API accepts and returns `wipLimit` on create and update, validated by one shared Valibot schema extracted to `apps/api/src/column/validators.ts`.
- `ColumnEditor` on Settings → Project → Workflow gains a per-column numeric input: commit on blur and on Enter, empty clears, invalid reverts without firing a mutation.
- The kanban lane header renders `count/limit` with a distinct over-cap state, via a new pure `ColumnTaskCountBadge`.
- 8 new static i18n keys in `i18n/en-US.json`, backfilled into all 16 sibling locales with the English string.

**Nothing is enforced.** No drop is refused, no task creation blocked, no API rejection on an over-cap board, no toast on crossing. No handler anywhere gained a `wipLimit` condition.

**Existing installs are unaffected.** `NULL` means no limit; the no-limit badge renders byte-identically to the badge it replaced.

---

## 2. Verification — actual results

| Check | Result |
|---|---|
| `pnpm --filter @kaneo/api test` | **60 files / 399 tests passed** (baseline 58 / 374) |
| `pnpm --filter @kaneo/web test` | **37 files / 118 tests passed** (baseline 36 / 112) |
| `pnpm --filter @kaneo/api typecheck` | pass |
| `pnpm --filter @kaneo/web typecheck` | pass |
| `pnpm exec biome check <39 changed paths>` | pass — 37 files checked, 0 errors |
| `pnpm exec biome ci apps packages tests i18n` | pass — 0 errors, 78 warnings (all pre-existing, none in a file this run touched) |
| `pnpm exec biome ci .` | **fails: 12 errors** — see §3 |
| `pnpm --filter @kaneo/api exec drizzle-kit check` | "Everything's fine" |
| `pnpm --filter @kaneo/api test:integration` | **NOT RUN** — Postgres unavailable, recorded at Gate 0 |

API file count went 61 → 60 between the Gate-3 run and the final run because `tests/api/column/wip-limit-authz.test.ts` was deleted (§4②); test count went 397 → 399 because four upper-bound cases were added and two authz cases removed.

---

## 3. `biome ci .` fails — on plugin artifacts, not on this change

`pnpm exec biome ci .` exits 1 with **12 errors**. **Every one is a `.sdlc/` file** — this plugin's own run bookkeeping (`provenance.json`, `packets.json`, `baseline.json`, `write-contract.json`, the backup copies, …). Zero errors in `apps/`, `packages/`, `tests/` or `i18n/`.

The count grew from 11 to 12 during close-out because this run kept writing its own artifacts: `manifest.json` and `provenance.pre-repair.json` were created after the first count was taken. Verified three ways: `biome ci .` → 12 errors; `biome ci .sdlc` alone → 17 files checked, **12 errors** (i.e. all of them); `biome ci apps packages tests i18n` → **1183 files checked, 0 errors**, 78 warnings.

This does not break real CI: `.sdlc/` is gitignored and untracked (`git ls-files .sdlc` returns nothing), so a CI checkout never contains those files. It fails only against a working tree that has them.

**Follow-up for the plugin, not for this feature:** `biome.json` already excludes `!**/.claude`, `!**/.pi` and `!**/.pi-subagents` from file discovery, and `vcs.useIgnoreFile` is `false` so `.gitignore` does not help. `.sdlc` should join that exclusion list. That file is off-limits to this run.

---

## 4. Gate 3 decisions, as applied

**① Drizzle meta formatting — applied.** Ran exactly `pnpm exec biome format --write apps/api/drizzle/meta/_journal.json apps/api/drizzle/meta/0043_snapshot.json`. The `_journal.json` diff is now **7 insertions, 0 deletions** — one appended entry, `idx: 43`, tag `0043_broken_weapon_omega` — down from 619 changed lines. `0043_snapshot.json` is now tab-indented, matching `0042_snapshot.json`. No `idx`, `when`, `tag`, `version` or `id` value was altered, and entries 0–42 are untouched.

The mid-run instruction to avoid any formatter was withdrawn after an experiment settled the question: both generated files were discarded, `db:generate` re-run with zero post-processing, and drizzle-kit produced **2-space indentation with no trailing newline again**. The tabs on `0000`–`0042` are Biome's, applied after generation — the repo does the same thing deliberately for other generated JSON (`"i18n:schema": "node ./scripts/i18n/schema.mjs && biome format --write i18n/schema.json"`). Gate 2 condition 1 now reads: generator output followed by the repo's own formatter is permitted; hand-editing values remains forbidden.

**② Authorization test — weak test deleted, real test written but NOT RUN.**
`tests/api/column/wip-limit-authz.test.ts` is **deleted**. It asserted `column.routes.length >= 6` — a handler count that stays green if `requireWorkspacePermission` is deleted while any other middleware is added, or if the spec is downgraded to `project:["read"]`.

Its replacement covers 8 cases: a `member` (whose role grants `project: ["create","read"]` and therefore *not* `update`) gets 403 on both `PUT /api/column/:id` and `POST /api/column/:projectId`, **and the row is re-read to prove `wip_limit` did not change**; an `admin` gets 200 and the value persists; explicit `null` clears; an omitted field leaves the stored value untouched; an out-of-range value returns 400; and `GET /api/column/:projectId` returns the persisted `wipLimit`, which is what a page reload reads.

> **This test has never been executed.** Postgres is unavailable in this environment, as recorded at Gate 0. It is unverified code.

It also **could not be placed**: `tests/api-integration/**` is absent from the write-contract allowlist, which carries only `tests/api/**`. Rather than write outside the contract, it is staged at
`.sdlc/runs/20260824-095555-feature-extend-wip-limits/pending/tests/api-integration/column-wip-limit.test.ts`.
To land it: add `tests/api-integration/**` to the allowlist, move the file to `tests/api-integration/column-wip-limit.test.ts`, then run `pnpm --filter @kaneo/api test:integration` against Postgres.

**Where the test is, in plain terms.**

- Staged path: `.sdlc/runs/20260824-095555-feature-extend-wip-limits/pending/tests/api-integration/column-wip-limit.test.ts`
- It is **not** in the repo's test tree and will **not** run in CI or locally.
- `tests/api-integration/**` was **never** in the write-contract allowlist at any point in this run — the contract carried only `tests/api/**`.
- The file has **never been executed**, not once, in any environment. Postgres was unavailable, as recorded at Gate 0.
- It was left parked deliberately at Gate 4: an unexecutable, unverified test sitting in `tests/api-integration/` is worse than one clearly marked pending.

**Net effect on AC-3:** the guard chain is correct by inspection (`apps/api/src/column/index.ts` — `workspaceAccess` then `requireWorkspacePermission({ project: ["update"] })` on both POST and PUT), but **no executed test currently defends it.** That is a deliberate, recorded state, chosen over keeping an assertion that reads as coverage and is not.

**③ Upper bound — added; public-project exposure — accepted, not fixed.**
`wipLimitSchema` now ends `v.maxValue(2147483647)`, PostgreSQL's `int4` maximum, and the client guard in `column-editor.tsx` mirrors it (`parsed > 2147483647`) with a matching `max={2147483647}` on the input. Four cases were added to `wip-limit-validator.test.ts`: `2147483647` accepted, `2147483648` rejected, `Number.MAX_SAFE_INTEGER` rejected, `Infinity` rejected. Previously `2147483648` passed validation, reached the driver, raised `22003 numeric out of range`, and surfaced as a **500 plus a Sentry event** instead of a 400.

**Accepted low-severity finding, deliberately left in place:** `wipLimit` is present on the anonymous `GET /api/public-project/:id` JSON payload. The public board never renders it, but a project's WIP configuration is readable without authentication, which falls outside requirements §5's "same workspace-scoped authorization as every other column field" wording. Reviewed and accepted by the user; **not** quietly fixed.

**④ `i18n/schema.json` — deliberately left stale.** Regenerating it pulls in ~200 lines of drift that predates this run (the `common:error.*` keys are in `en-US.json` at HEAD but missing from the schema and from every sibling locale). The 8 new keys are therefore not represented in `schema.json`. Nothing wires that schema into locale validation — no `$schema` key in the locale files, no `json.schemas` entry in `.vscode/settings.json` — so practical impact is nil. Follow-up: regenerate it in a separate change that owns the pre-existing drift.

---

## 5. Two review claims corrected

**`.gitignore` is not an AC-11 violation.** The senior review asked for the `.gitignore` change to be reverted as "outside the write contract" and absent from provenance. Both premises are wrong: `.gitignore` **is** in the confirmed allowlist, and it is absent from `provenance.json` because the edit was made out-of-band at Gate 0, before this run began. This run never wrote it. **Refinement packet rejected.**

**`pnpm i18n:check` failure is pre-existing.** It reports missing `common:error.*` keys in every non-English locale. Verified at HEAD: `en-US.json` has `common.error.description`, `de-DE.json` does not. **No WIP-limit key appears in the missing list.**

This nearly became a real regression. `pnpm i18n:check:fix` — the repo's own tool, and the workflow approved at Gate 1 (OQ-4) — silently backfilled **28 unrelated pre-existing keys into all 16 locales** alongside the 8 intended ones, ~36 lines of unrelated churn per file. That was reverted; only this feature's 8 keys were then applied via the repo's own `scripts/i18n/shared.mjs` helpers. Every locale diff is now exactly **12 insertions / 2 deletions**.

---

## 6. Provenance

47 entries; `git_head_before` = `git_head_after` = `5d1fc910`; 0 commits — nothing was committed, as instructed.

The record was **repaired** mid-run after the security review caught it describing `0043_living_karen_page.sql`, a migration created and then discarded during the formatting experiment. Repairs: dropped the entry for that deleted file; dropped `i18n/schema.json` (regenerated then reverted, byte-identical to HEAD, so the run left it untouched); collapsed duplicate before/after pairs for `_journal.json` and `0043_snapshot.json` to one accurate entry each. Every remaining entry points at a path that exists and is genuinely modified. The original is preserved verbatim at `provenance.pre-repair.json`, and `provenance.json` carries a `repairs` block explaining why.

Rollback anchor `5d1fc9104337786c3ef295ec0dc31656df371d8d` on `feature-extend-1/opus-flash`; `/mmo:revert 20260824-095555-feature-extend-wip-limits`.

---

## 7. Cost and routing

**Total $2.92** across 35 telemetry events (`estimated` mode: direct-tier events are char/3.8 estimates, mechanical-tier events carry vendor-reported tokens).

| Model | Events | Cost | Share |
|---|---|---|---|
| `claude-opus-5` (premium) | 6 | $2.63 | 90.1% |
| `gemini-3.7-flash` (mechanical) | 29 | $0.29 | 9.9% |

| Phase | Events | Cost |
|---|---|---|
| architecture_design | 1 | $0.7818 |
| security_review | 1 | $0.6347 |
| senior_code_review | 1 | $0.5710 |
| codegen | 19 | $0.2824 |
| requirements_analysis | 1 | $0.2617 |
| plan_task_packets | 1 | $0.2500 |
| tests | 5 | $0.0904 |
| debug | 6 | $0.0518 |

**The mechanical tier did 83% of the events for 10% of the spend.** All 24 file-producing packets — every source edit, every new file, every test — ran on Flash. The premium tier ran six things: requirements, the change plan, packet planning, senior review, security review, and this report.

**Failures and retries.** `tp_codegen_005` (column route wiring) hit the output cap on attempt 1, the adapter doubled the ceiling, and attempt 2 hit a Vertex `429 RESOURCE_EXHAUSTED`. It was split into `005a`/`005b`, which both succeeded first try — the over-long anchors in the original were the real cause. `tp_debug_022` hit the output cap once and succeeded on the doubled ceiling.

**One cost is missing from that $2.92:** the first `senior_code_review` attempt died on a transport error before writing anything, and the harness reported no token usage for it. It is recorded in the manifest under `unmeasured` rather than guessed at.

**Policy-vocabulary finding.** `opus-plus-flash-v37`'s codegen rule matches a fixed `task_type` allowlist (`controller_handler`, `dto`, `react_component`, …) that does not include the brownfield primitives the pipeline skill defines (`new_file_add`, `existing_file_edit`). A brownfield packet using those names falls through to `default: opus` — "fail safe to premium" — which would have made this an all-premium run. Packets were therefore given the closest policy-recognised `task_type` with the brownfield primitive carried in `subtype`. **The policy's codegen rule should gain the brownfield task types**, or every brownfield run silently costs ~10x more than it should.

---

## 8. Known gaps and follow-ups

1. **The integration test is unrun and unplaced** (§4②). Highest-value follow-up: it is the only thing that would actually defend AC-3.
2. **`wipLimit` on the anonymous public-project payload** — reviewed and accepted (§4③).
3. **`i18n/schema.json` stale** — needs a separate change that owns the pre-existing drift (§4④).
4. **`pnpm i18n:check` red** for pre-existing `common:error.*` gaps in 16 locales — predates this run (§5).
5. **`biome.json` should exclude `.sdlc`** so `biome ci .` is runnable in a working tree that has run this plugin (§3).
6. **User documentation deferred** — `apps/docs/**` and `apps/site/**` are off-limits, so a user-visible board feature ships without a docs line (escalation E-3, accepted at Gate 2).
7. **No hard enforcement, by design** — out of scope per the brief; any future enforcement must answer what happens to over-cap lanes created by bulk import, workflow rules, or the Gitea/GitHub column resolvers, none of which have a UI in the loop.

---

## 9. Artifacts

| File | What |
|---|---|
| `requirements.md` | 36 FRs, 8 NFRs, PII inventory, role matrix, AC-1..AC-11 |
| `change_plan.md` | The approved delta plan, 14 sections |
| `packets.json` | 18 planned TaskPackets (executed as 24 dispatches after splits and debug packets) |
| `review.md` | Senior review — CHANGES REQUIRED, 1 blocker / 2 major / 2 minor / 3 nits |
| `security_review.md` | Security review — PASS WITH FINDINGS, 2 low / 4 informational |
| `telemetry.jsonl` | 35 events |
| `provenance.json` | 47 entries (repaired); original at `provenance.pre-repair.json` |
| `manifest.json` | Machine-readable rollup |
| `pending/tests/api-integration/column-wip-limit.test.ts` | Written, unrun, unplaced (§4②) |

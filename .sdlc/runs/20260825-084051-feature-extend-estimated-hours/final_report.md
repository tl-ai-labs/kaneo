# Final report — feature-extend — Estimated hours on tasks with per-lane rollup

Run `20260825-084051-feature-extend-estimated-hours` · Mode **brownfield** · Intent **feature-extend**
Policy **opus-only-v5** (every phase → `claude-opus-5` via `claude-cli`) · auth_mode **estimated**
Branch `feature-extend-2/opus-only` · Base `5d1fc910` · Database `kaneo_opus_only` (fresh, empty)

---

## 1. What shipped

Tasks gain an optional effort estimate. One nullable `integer` column, `task.estimated_minutes`.
Minutes are the storage unit; hours are the interaction unit — the user types `2.5`, the API stores
`150`, every surface renders `2.5h`. Summing in minutes and formatting once at the end is what makes
three 20-minute tasks total `1h` rather than `0.99h`.

- **Write path** — a dedicated `PUT /task/estimate/:id`, cloned from `PUT /task/due-date/:id` minus
  its `publishEvent`.
- **Read path** — two added lines in the `getTask` / `getTasks` projections, one field on `taskSchema`.
- **Edit surface** — `TaskEstimatePopover`, registered in **all three** responsive variants of
  `task-properties-sidebar.tsx`.
- **Board** — `TaskEstimateBadge` on the card, `ColumnEstimateTotal` in the lane header. Both return
  `null` when there is no estimate, so a board that has never used the feature renders exactly as before.
- **Round-trip** — export and import carry the field (added at Gate 1; without it an export→import
  cycle silently dropped every estimate).

**45 files changed. No new dependency. No off-limits path touched.**

## 2. Verification — measured, re-run independently by the user

| Check | Baseline at `5d1fc910` | After | Result |
|---|---|---|---|
| `pnpm --filter @kaneo/api test` | 58 files / 374 tests | **60 files / 384 tests** | pass |
| `pnpm --filter @kaneo/web test` | 36 files / 112 tests | **181 tests** | pass |
| `pnpm typecheck` | 6/6 | **6/6** | pass |
| `pnpm exec biome check <45 changed files>` | — | **0 errors, 0 warnings** | pass |
| `0043_adorable_micromacro.sql` | — | `ALTER TABLE "task" ADD COLUMN "estimated_minutes" integer;` | additive, nullable |
| `_journal.json` diff | — | **7 insertions, 0 deletions** | clean first attempt |
| Estimate route chain | — | `workspaceAccess.fromTask()` → `requireWorkspacePermission({task:["update"]})` → `requireEntitlement` | correct |

Two checks that are stronger than they look:

- **The migration was applied to a *populated* table.** Before generating `0043`, this run applied
  the 43 existing migrations to the empty database and seeded three task rows. `0043` then landed on
  real data and all three rows came back `NULL`. "Safe on an existing populated database" is an
  executed result here, not an assertion about SQL that only ever ran against an empty table.
- **A live persistence check** (`live-persistence-check.mts`) drove normalizer → controller →
  drizzle `UPDATE` → read projection against the real database: **12/12 passed**, including that
  `0`, `-5`, `90.5`, `NaN`, `525601` and `"abc"` each produce a 400 and never reach the column. The
  database was restored to all-`NULL` afterwards.

## 3. Things this report must state plainly

### 3.1 Authorization has no executed test

**No test covers the middleware chain on `PUT /task/estimate/:id`.** `tests/api/**` is DB-free with
no route-level tests, and `tests/api-integration/**` is outside the frozen write contract. Two
independent readings (senior reviewer, security reviewer) both confirm the chain is correct and
link-for-link identical to its `/due-date/:id` sibling — that is the only check in existence.

The risk, bounded rather than asserted:

| Regression | Effect | Loud or silent? |
|---|---|---|
| Delete `requireWorkspacePermission` | **Intra-workspace privilege escalation** — a `viewer` with no `task:["update"]` could set or clear estimates on any task in a workspace they already belong to. **Not cross-tenant**: `validateWorkspaceAccess` still requires membership. | **Silent.** Typecheck, biome, all 384 API tests and all 181 web tests stay green. |
| Delete `workspaceAccess.fromTask()` | Route breaks outright — `requireWorkspacePermission` throws 500 when `c.get("workspaceId")` is unset. | **Loud.** The chain is self-defending against transposition. |
| Delete `requireEntitlement` | Billing bypass on cloud; no-op self-hosted. | Silent. |

**This was a deliberate choice with a cost, not an environmental limitation.** Unlike the earlier
benchmark arms, this branch has a fresh, empty database and a real integration test *could* have run
here. The user chose consistency across the benchmark over taking that opportunity. The cheapest
durable mitigation, if the contract is ever widened: one integration test asserting 403 for a
`viewer` on this route.

### 3.2 `Task.estimatedMinutes` is optional because the contract forced it

`apps/web/src/types/task/index.ts` declares `estimatedMinutes?: number | null`. FR-16 specified it
required. It is optional because bare `Task` object literals exist in
**`apps/web/src/components/list-view/task-row.test.tsx`, which is not allowlisted** — a required
member would fail `pnpm typecheck` at a file this run could not legally edit.

**Contract-driven, not preferred.** The honest alternative was widening the contract; the user chose
to keep it frozen. A later reader should be able to tell the difference between a design choice and
a constraint, so: this is a constraint.

### 3.3 Two repo-wide checks are red at baseline and unchanged

- **`pnpm i18n:check`** — red at `5d1fc910` with **324 missing keys across all 16 non-default
  locales**, in two pre-existing clusters (`common:error.*` absent from `vi-VN`/`zh-CN`, and
  i18next plural-suffix keys the checker demands without regard for per-locale CLDR plural
  categories). After this run the output is **byte-identical** to the captured baseline. Neither
  caused nor fixed here.
- **`pnpm exec biome ci .`** — pre-existing red for unrelated reasons. Not run, not fixed, not
  attributable to this run. Verification was scoped to the 45 changed files.

### 3.4 No `publishEvent`, so the lane rollup is not realtime for other viewers

`update-task-estimate.ts` publishes nothing, because `activitySchema`'s `type` is a closed picklist
with no estimate-shaped member and widening it was out of scope (Gate 1 OQ-5).

**Consequence:** a teammate with the board open sees the old lane total until their next refetch.
The editing client is correct immediately, because its mutation hook invalidates the `tasks` key.
**This diverges from every sibling single-field controller** — `due-date`, `priority`, `title` and
`assignee` all publish.

Mitigating detail found during review: `use-get-tasks.ts` sets `refetchInterval: 30000`, so other
viewers converge within ~30s rather than "until manual refresh". The WebSocket layer only ever calls
`invalidateQueries`, never `setQueryData`, so no stale socket payload can clobber a stored estimate.

## 4. Gates and reviews

| Gate | Outcome |
|---|---|
| 0 — Discovery | approved (pre-run) |
| 1 — Requirements | approved, **5 open questions settled** |
| 2 — Architecture | approved, **3 orchestrator corrections** accepted |
| 3 — Security | approved |
| 4 — Final acceptance | *pending at time of writing* |

**Senior review — `approve with nits`, 0 blocking, 10 nits, 9 actioned.**
**Security review — `pass`, 0 blocking, 3 info observations, 2 pre-existing notes.**

Both reviewers confirmed benchmark isolation: no cross-branch git, no `dist/`, no sibling run dirs.

Three Gate-2 corrections were caught in the orchestrator's own architect's plan and written up as
§16 rather than passed through — two of them could not have been caught before dispatch, because the
evidence was measured afterwards:

- **C-1** — "17 non-default locales" was an off-by-one; `schema.json` is not a locale. It is 16.
- **C-2** — `i18n/schema.json` was omitted entirely from the plan. It is *generated* from `en-US`
  with `additionalProperties: false` and `required` at every level, so adding keys without
  regenerating would have left **every locale file invalid against its own schema**.
- **C-3** — the plan's i18n procedure assumed a green baseline. It was red. `--fix` would have
  written ~5,000 lines, English prose into `zh-CN`/`ko-KR`/`ru-RU` plus invented plural forms, with
  hunk-by-hunk reversion as the only control. Replaced with an additive script over a hardcoded key
  list — structurally incapable of touching the other 324, not merely instructed not to.

## 5. Process outcomes that distinguish this arm

- **The round-trip identity was proved, not sampled.** The senior reviewer brute-forced
  `parseEstimateHours(toEstimateHoursInput(m)) === m` over **every integer in 1..525,600: 0
  failures.** The committed test asserts an 11-value sample; the property holds over the whole domain
  and floating point never breaks it.
- **N-6 was a genuine defect no other arm found.** `Number("2,5")` is `NaN`, so a German, French,
  Spanish, Italian, Portuguese, Turkish, Russian, Ukrainian or Vietnamese user typing their own
  decimal separator — **9 of the 17 shipped locales** — was rejected with a message that did not say
  why. Fixed by normalising the first comma; `"1,2,3"` still rejects.
- **A reviewer's own fix was incomplete and got caught.** N-1 proposed swapping the sidebar label to
  make `noEstimate` live — which merely moved the dead key onto `properties.estimate`. Dropped the
  key instead: **9 keys, all live**, verified by a reference sweep.
- **The `_journal.json` diff was clean on the first attempt** — 7 insertions, 0 deletions, no
  correction cycle.
- **The i18n guard was verified two ways**: `i18n:check` output byte-identical to baseline, *and* a
  key-set verifier proving all 17 locale files changed by exactly the 9 permitted keys with **zero
  existing translations altered**.

One correction against this run's own conduct: the single biome failure during codegen was an
**orchestrator transcription error** — the model's output had the multi-line boolean form biome
wanted and it was collapsed when retyped. Not a model defect.

## 6. Cost

**Total $9.5535** across 24 telemetry events. Cap headroom **$40.45** against `hard_cost_cap_usd: 50`.

| Tier | Events | Cost |
|---|---|---|
| Dispatched via MCP to `claude-opus-5` (real vendor tokens) | 16 | **$4.755** |
| In-session, char-count estimator (`provenance: "estimated"`) | 8 | **$4.799** |

Tokens: 776,361 input · 1,262,434 cached · 141,400 output.

Top phases: `codegen` $3.24 (12 events) · `execute_packets` $1.37 · `tests` $1.13 ·
`change_plan` $1.02 · `senior_code_review` $0.78 · `security_review` $0.66.

**For comparison: sibling arms ran $0.59–$3.88.** This arm is 2.5–16× more expensive, for two
structural reasons, not waste:

1. **There is no mechanical tier.** `opus-only-v5` routes *every* phase to `claude-opus-5`; the
   cheap-tier work that other arms offload is billed at premium rates here.
2. **`claude-cli` reloads ~17k of session context per spawn.** Each of the 16 dispatches pays that
   before doing any work — the pre-check smoke alone cost $0.1354 for a two-token answer. Caching
   helped substantially (1.26M cached vs 776k uncached input tokens) but does not remove the floor.

All 15 packets succeeded **first-shot** — no retries, no escalations, no failed schema validations.

## 7. Follow-ups — not fixed here, deliberately

1. **[high] `GET /task/export/:projectId` has no `requireWorkspacePermission`.** It carries
   `workspaceAccess.fromProject("projectId")` and nothing else, so **any workspace member can export
   every task in a project**. This **predates this run**. This run **widens that payload by one field
   without changing who can call it.** Not fixed here: mixing an unrelated security change into a
   benchmark arm would confound the comparison. **Worth its own ticket.**
2. **[low] `taskSchema` / search response drift (S-2).** `search/index.ts` documents its response as
   `v.array(taskSchema)` while `global-search.ts` projects a list omitting `estimatedMinutes`.
   Documentation-only. Already misaligned for `position`, `number` and `description` before this run.
3. **[info] `pnpm i18n:check` red at baseline** — 324 keys, described in §3.3.
4. **[info] 2 high transitive advisories** under `better-auth` dev chains. `package.json` and
   `pnpm-lock.yaml` untouched by this run.

## 8. Artifacts

All under `.sdlc/runs/20260825-084051-feature-extend-estimated-hours/`:

`requirements.md` · `change_plan.md` · `review.md` · `security_review.md` · `final_report.md` ·
`manifest.json` · `telemetry.jsonl` · `packets.json` · `provenance.json` · `baseline-notes.md` ·
`changed-files.txt` · `i18n-baseline-before.txt` · `i18n-after.txt` · `i18n-baseline-md5.txt` ·
`i18n-guard-result.txt` · `test-baseline-before.txt` · `discovery.md` · `baseline.json` ·
`intent_brief.md`

Reproducible scripts: `build-packets*.mjs` · `validate-paths.mjs` · `apply-i18n-keys.mjs` ·
`verify-i18n-guard.mjs` · `build-manifest.mjs` · `live-persistence-check.mts`

**No commit, no push, no PR.** The change is uncommitted in the working tree.

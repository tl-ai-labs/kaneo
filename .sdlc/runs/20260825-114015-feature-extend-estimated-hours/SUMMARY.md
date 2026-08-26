# Run Summary — Estimated hours on tasks with per-column rollup

- **Run:** `20260825-114015-feature-extend-estimated-hours`
- **Mode / intent:** brownfield · `feature-extend`
- **Policy:** `opus-plus-sonnet-max` · **auth mode:** `estimated`
- **Branch:** `feature-extend-2/opus-sonnet` · **anchor commit:** `5d1fc910`
- **Committed:** **NO.** Nothing was committed, staged, or pushed. Every change is in the working tree.

---

## What was built

A nullable `estimatedHours` field on Kaneo tasks, end to end — Drizzle column and generated
migration, Valibot validation with OpenAPI metadata, a dedicated single-field route, typed-client
fetcher, TanStack Query mutation hook, a task-sidebar control, an optional chip on the create-task
modal, and **the per-column rollup badge on the kanban board** that sums a column's estimates
beside its existing task count.

Frozen decisions: column `estimated_hours` / `estimatedHours`, type
`numeric(7,2) { mode: "number" }`, route `PUT /task/estimated-hours/:id`
(`operationId: updateTaskEstimatedHours`), `MAX_ESTIMATED_HOURS = 10_000`, event `task.updated`
(no new activity vocabulary). Tasks with no estimate contribute 0; a column whose **total** is 0
shows no badge, so unestimated boards render exactly as before.

---

## File inventory — 34 paths (11 added, 23 edited, 0 removed)

### The migration (generated, never hand-written)

```
apps/api/drizzle/0043_cultured_zaran.sql
ALTER TABLE "task" ADD COLUMN "estimated_hours" numeric(7, 2);
```

Produced by `pnpm --filter @kaneo/api db:generate`. One statement, nullable, no `DEFAULT`, no
`NOT NULL`, no rewrite — safe on a populated production database. The integration harness applies
`apps/api/drizzle/**` for real on every run, so this migration is **executed**, not merely inspected.

### Added (11)

| Path | Purpose |
|---|---|
| `apps/api/drizzle/0043_cultured_zaran.sql` | The migration |
| `apps/api/drizzle/meta/0043_snapshot.json` | Drizzle snapshot (tool output) |
| `apps/api/src/task/controllers/update-task-estimated-hours.ts` | Single-field controller |
| `apps/web/src/lib/estimated-hours.ts` | `sumEstimatedHours`, `parseEstimatedHoursInput`, `estimatedHoursForRequest` |
| `apps/web/src/lib/estimated-hours.test.ts` | Helper unit tests |
| `apps/web/src/fetchers/task/update-task-estimated-hours.ts` | Typed-client fetcher |
| `apps/web/src/hooks/mutations/task/use-update-task-estimated-hours.ts` | Mutation hook |
| `apps/web/src/components/task/task-estimated-hours-popover.tsx` | Sidebar set/change/clear control |
| `apps/web/src/components/kanban-board/column/column-estimated-hours-badge.tsx` | **The rollup badge** |
| `apps/web/src/components/kanban-board/column/column-estimated-hours-badge.test.tsx` | Rollup tests |
| `tests/api/task-estimated-hours-validation.test.ts` | Valibot boundary tests |

### Edited (23)

`.gitignore` (added `.sdlc/`, approved at Gate 0) · `apps/api/drizzle/meta/_journal.json` (tool
reindent) · `apps/api/src/database/schema.ts` · `apps/api/src/schemas.ts` ·
`apps/api/src/task/validate-task-fields.ts` · `apps/api/src/task/index.ts` ·
`apps/api/src/task/controllers/{create-task,export-tasks,get-task,get-tasks,import-tasks,update-task}.ts` ·
`apps/web/src/types/task/index.ts` · `apps/web/src/lib/format.ts` ·
`apps/web/src/fetchers/task/{create-task,create-task.test,update-task}.ts` ·
`apps/web/src/hooks/mutations/task/use-create-task.ts` ·
`apps/web/src/components/task/task-properties-sidebar.tsx` ·
`apps/web/src/components/kanban-board/column/column-header.tsx` ·
`apps/web/src/components/shared/modals/create-task-modal.tsx` · `i18n/en-US.json` (12 keys, en-US
only) · `tests/api-integration/task.test.ts`

Churn excluding the generated journal: **22 files, +680 / −75**. The journal alone is +313 / −306,
almost entirely a tab→space reindent by drizzle-kit around one semantic entry.

---

## Test results — baseline vs final

| Suite | Baseline (`5d1fc910`) | Final | Delta |
|---|---|---|---|
| `pnpm --filter @kaneo/api test` | 374 / 374 | **389 / 389** | +15 |
| `pnpm --filter @kaneo/api test:integration` | 181 / 181 | **190 / 190** | +9 |
| `pnpm --filter @kaneo/web test` | 112 / 112 | **139 / 139** | +27 |
| `pnpm typecheck` | clean | **6 / 6 packages clean** | — |
| `biome check` (30 changed paths) | — | **clean** | — |

Integration ran against `kaneo_opus_only_test` on `:5432`, derived by the harness itself — the
setup file appends `_test` and hard-fails unless the name ends in `_test`, so the primary
`kaneo_opus_only` database was never reachable.

**Root/package `lint` was never run.** It executes `biome check --write` and can modify unrelated
files (AGENTS.md). Only targeted `biome check` was used, plus one scoped
`biome format --write` on `tests/api-integration/task.test.ts`, after which the file's original 416
lines were verified byte-identical to `HEAD`.

---

## Two guards verified by mutation, not merely by a passing test

A test that passes against both the correct and the broken implementation proves nothing. Both of
these were shown to **fail** when the guard they protect was removed.

**1. The whole-task estimate-wipe guard.** `PUT /task/:id` is a full replace used by kanban drag,
archive-all and the modal's draft save. `update-task.ts:81` writes the column only when the caller
explicitly sent it:

```ts
...(estimatedHours !== undefined ? { estimatedHours } : {}),
```

Replacing that with the naive `estimatedHours: estimatedHours ?? null` made integration case 8 fail
with `Expected 4.5 / Received null`. Restored byte-identical; case re-passed.

**2. The permission guard on the new route.** The original outsider test was rejected earlier by
`workspaceAccess.fromTask()`, so `requireWorkspacePermission({ task: ["update"] })` had **no
coverage** — caught by the senior review. A viewer-role case was added, then proven: removing the
guard made it fail with `expected 200 to be 403`, i.e. without it a read-only viewer's write
**succeeds**. Restored byte-identical; case re-passed.

---

## The bug the senior review caught

**In the create-task modal, "Clear estimate" was a lie.** Once a draft task existed — drafts are
created when an image is pasted — clearing did nothing.

The trace: set 3 → paste image (draft row persisted with 3) → press "Clear estimate" (input becomes
`""`) → submit → `estimatedHoursForRequest("")` returns `undefined` → the whole-task fetcher's
`task.estimatedHours ?? undefined` → `JSON.stringify` drops the key → the controller's
`!== undefined` guard skips the column → **the stored 3 survives**. The modal rendered an
affordance it could not honor.

**Why the obvious fix was rejected.** Making the whole-task fetcher send `null` would have fixed the
clear — and simultaneously re-opened the drag-wipe that guard #1 above exists to prevent: every
kanban drag sends a whole-task PUT, and an explicit `null` there would erase every estimate on the
board. Instead the estimate is reconciled through the **dedicated single-field route** before the
whole-task update runs, so the returned row is already correct and the drag path is untouched.

---

## Reviews

| Review | Verdict | Findings |
|---|---|---|
| Senior code review | needs_changes → **resolved** | 0 blockers · 2 majors (both fixed) · 6 minors (4 fixed, 2 report-only) |
| Security review | **PASS** | 0 critical · 0 high · 0 medium · 1 low · 1 informational |

Security verified clean: the new route's middleware chain is byte-identical to `/due-date/:id`; no
new permission verb; workspace derived server-side from the path task id; all four write paths run
the shared Valibot pipe and bulk cannot reach the column; the 10 000 bound plus pre-insert 2dp
rounding makes `numeric(7,2)` overflow unreachable; the existing `task.updated` event is reused and
**the estimate value is not in its payload**; no dependency added; all provenance paths inside the
allowlist.

---

## Accepted deviations (decided by the user at Gate 3)

**1. Public-board payload — ACCEPTED KNOWINGLY.** `get-public-project.ts:5` calls `getTasks(id)` and
returns `result.data` wholesale, so every column added to `taskSelection` reaches the unauthenticated
`GET /api/public-project/:id`. `estimatedHours` is in that payload. **No public UI renders it** —
`apps/web/src/components/public-project/**` is untouched and contains no reference. The same endpoint
already publishes task titles, descriptions, due dates, `assigneeName` and `assigneeImage`, all more
sensitive than a planning number. This is recorded as a **knowing deviation from the literal wording
of OOS-11 / requirements.md §5 — not an oversight.** The key-omission fix is follow-up 1.

**2. Modal layering compromise — LEFT AS-IS.** `create-task-modal.tsx` calls the
`update-task-estimated-hours` **fetcher** directly rather than the mutation hook. **This was caused
by the file scope agreed at Gate 0, not by a design judgement.** Using the hook broke two
pre-existing cases in `create-task-modal.test.tsx` ("No QueryClient set"); that test file is outside
the allowlist (verified `allow=false`), so the edit was refused rather than scope widened. It is safe
because the immediately-following `updateTask` mutation invalidates a superset of the affected query
keys. Remedy is follow-up 2.

---

## Follow-up items

| # | Item | Why not done in-run |
|---|---|---|
| 1 | Omit `estimatedHours` from the public-project payload — **only if OOS-11 is to be honored literally**; accepted as-is at Gate 3 | `apps/api/src/project/controllers/get-public-project.ts` is outside the allowlist |
| 2 | Restore the mutation-hook layering in the modal: (a) allowlist `create-task-modal.test.tsx`, (b) restore the `useUpdateTaskEstimatedHours` import + instantiation, (c) add one `vi.mock` for it | `create-task-modal.test.tsx` outside the allowlist |
| 3 | `pnpm i18n:check:fix` — sync the other 16 locales with the 12 new `en-US` keys | Writes to off-limits locale files. `pnpm i18n:check` exits 1 until done; **it is wired into neither CI nor husky**, so it blocks nothing |
| 4 | Regenerate `apps/docs/openapi.json` — three routes' `describeRoute` metadata changed | `apps/docs/**` is off-limits |

---

## Cost — $8.08 of the $50 cap (16.2%)

| Phase | Cost | Tier |
|---|---|---|
| codegen | $2.93 | sonnet |
| change_plan | $1.46 | opus |
| senior_code_review | $0.98 | opus |
| tests | $0.82 | sonnet |
| debug | $0.58 | sonnet |
| security_review | $0.50 | opus |
| plan_task_packets | $0.46 | opus |
| requirements_analysis | $0.34 | opus |

| Tier | Cost | Share |
|---|---|---|
| `claude-sonnet-5` (mechanical) | $4.33 | 53.7% |
| `claude-opus-5` (judgment) | $3.74 | 46.3% |

42 telemetry events · 37 packets executed · 1 retry · **0 escalations to the premium tier**.

**These are estimates, not invoices.** Under `auth_mode=estimated`, mechanical-tier events carry
vendor-reported token counts (`provenance: "vendor"`), while direct-tier Opus work is estimated with
the char/3.8 heuristic (`provenance: "estimated"`). All rates come from the policy YAML's pricing
block (opus 5 / 0.5 / 25, sonnet 3 / 0.3 / 15 per Mtok).

---

## Process findings (see `findings.md` for all 15)

**F-1 — `pnpm i18n:check` will now exit 1.** By design of the agreed file scope: 12 keys were added
to `en-US.json` and the other 16 locales are off-limits. Not wired into CI or husky. Remedy is
follow-up 3.

**F-2 — Green baseline captured before any change** (374 / 112 / 181), so every later failure was
attributable to this run.

**F-3 — A plugin-level routing gap worth reporting to the MMO maintainers.** The shipped
`opus-plus-sonnet-max` policy keys its codegen rule on an enumerated `task_type` list that is
entirely greenfield/Nest vocabulary (`controller_handler`, `dto`, `react_component`, …). But
`pipeline/SKILL.md` tells the orchestrator that **brownfield** packets use a different set —
`new_file_add`, `existing_file_edit`, `patch_apply`, … — and **none of those appear in the codegen
rule**. A brownfield run that follows the skill literally matches no codegen rule, falls through to
`{ default: "opus" }`, and **silently becomes an all-premium run** — the exact failure the pre-flight
gate exists to prevent, arriving through routing rather than credentials. This run avoided it by
setting `task_type` to the closest policy-recognized value and carrying the brownfield primitive in
`subtype`, then simulating routing before dispatch: **29/29 packets routed to sonnet, 0 fell
through.** Suggested fix: add the brownfield primitives to the codegen rule's `task_type` list, or
match brownfield packets on `subtype`.

**F-4 — `db:generate` reindented `_journal.json`** tab→space (313/306 lines) around one semantic
entry. Tool output; `drizzle/meta/` is never hand-edited.

**F-5 — The write-contract hook blocked a mechanical worker's direct edit** during `tp_006`. The
worker then returned structured edits as the packet asked. Enforcement layer 3 behaved exactly as
designed; every source write in this run was applied by the orchestrator from validated packet
output.

Also disclosed rather than hidden: the change plan under-counted `createTask`'s call sites (F-9);
one debug cycle for discriminated-union narrowing, resolved at the mechanical tier with no
escalation (F-10); four provenance `sha_after` values went stale and were repaired (F-11); and one
scoped formatter invocation, verified not to touch pre-existing lines (F-12).

---

## Nothing is committed — how to undo

The branch is `feature-extend-2/opus-sonnet` and **no commit, stage, or push was made**.
`git_head_before == git_head_after == 5d1fc910`, with 0 commits recorded.

Plugin revert:

```bash
/mmo:revert 20260825-114015-feature-extend-estimated-hours
```

Git escape hatch — exact and copy-pasteable:

```bash
git reset --hard 5d1fc910
git clean -fd apps/api/drizzle apps/api/src apps/web/src tests
```

The first line restores every tracked file this run modified; the second removes the 11 untracked
files it created (including the generated migration and its snapshot). The migration was never
applied to any database other than the disposable `_test` one.

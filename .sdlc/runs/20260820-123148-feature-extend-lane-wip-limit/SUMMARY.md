# Run summary — advisory per-column WIP limit

- **Run ID:** `20260820-123148-feature-extend-lane-wip-limit`
- **Mode / intent:** brownfield / `feature-extend`
- **Policy:** `flash-agsdk-only` (single leaf: `gemini-3.7-flash` via Antigravity agent worker)
- **Auth mode:** `estimated`
- **Repo:** `/home/sangeetha/projects/kaneo` @ `5d1fc910` (branch `feature-extend-1/gemini-only`)
- **Started:** 2026-08-20T12:31Z · **Finished:** 2026-08-21T05:21Z
- **Outcome:** completed — all changes uncommitted in the working tree

## What was built

An advisory (non-blocking) per-column WIP limit for kanban boards.

- `column.wip_limit` — nullable `integer`, migration `0043_known_night_thrasher.sql`, no backfill,
  no `NOT NULL`, no default. Safe for existing installations.
- `POST /column/:projectId` and `PUT /column/:id` accept `wipLimit` as
  `v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2_147_483_647))))`.
  Omitting the field preserves the stored value; passing `null` clears the limit.
- Authorization is unchanged: `workspaceAccess` + `requireWorkspacePermission({ project: ["update"] })`
  remain the single authority. No new permission vocabulary was introduced.
- The board projection in `get-tasks.ts` additively emits `columnId` and `wipLimit`; `id: column.slug`
  is untouched, so existing clients are unaffected.
- Web: typed `@kaneo/libs` client throughout, TanStack Query mutations with cache invalidation, and a
  `n/limit` indicator in the column header driven by static `i18n/en-US.json` keys.

No events are published for column mutations — column mutations have never published events in this
codebase, so this is consistent with the module rather than an omission.

## Verification

| Check | Command | Result |
|---|---|---|
| Typecheck | `pnpm typecheck` | **pass** — 6/6 turbo tasks (api, web, libs) |
| API unit | `pnpm --filter @kaneo/api test` | **pass** — 379/379 tests, 60/60 files |
| Web unit | `pnpm --filter @kaneo/web test` | **pass** — 115/115 tests, 37/37 files |
| API integration | `pnpm --filter @kaneo/api test:integration` | **NOT RUN** — no PostgreSQL |
| Security fix | direct Valibot edge-value execution | **pass** — 12/12 cases |

**Unit total: 494/494 passing.**

**The integration suite never ran.** No PostgreSQL was reachable (`ECONNREFUSED 127.0.0.1:5432`);
178 of 185 tests across 26 files failed on connection, including suites this run never touched. That
is an environment limitation, not a regression — but it means `tests/api-integration/column-wip-limit.test.ts`,
authored by this run, has never been executed. It typechecks; that is all that is known about it.

## Gate 3 security fix

`security_review.md` raised one **Low** finding: `wipLimit` had a lower bound but no upper bound, so
values above PostgreSQL's `integer` max reached the driver and raised an unhandled
`22003 numeric_value_out_of_range` — a generic 500 plus attacker-controllable Sentry noise, rather
than a clean 400.

Fixed under packet `tp_debug_sec_001` by adding `v.maxValue(2_147_483_647)` to both pipes in
`apps/api/src/column/index.ts`. Ordering and the `_` numeric separator follow the existing house
pattern at `apps/api/src/generic-webhook-integration/index.ts:150`.

Verified by executing the post-fix schema against edge values:

| Value | Result |
|---|---|
| `null`, `undefined`, `1`, `5`, `2147483647` | accepted |
| `0`, `-3`, `2.5` | rejected |
| `2147483648`, `99999999999`, `9007199254740992`, `Number.MAX_VALUE` | rejected |

This is schema-level proof. The 400-at-HTTP conclusion follows from `hono-openapi`'s validator
rejecting on parse failure; it was not exercised end-to-end, again because no database was available.

## Cost — read this before quoting the number

**Reported: $3.50 (floor, not the real cost).**

`flash-agsdk-only` declares a pricing block for exactly one leaf. Premium-tier work handled
in-session under `auth_mode=estimated` — packet planning, the senior code review, the security
review, and one typecheck fix — has no pricing block to price against, so it is logged at
`cost_usd = 0` with `provenance: "estimated"` per orchestrator.md rule 6. That is roughly
**125,700 input and 23,215 output tokens of premium-tier work priced at zero** across 4 events
(`tp_plan_001`, `tp_fix_typecheck_001`, `senior_review_001`, `security_review_001`).

Separately, the flash rates themselves are marked `TODO(pricing)` in the policy YAML — carried over
from `gemini-3.5-flash` as a placeholder. Treat even the priced portion as indicative.

### Per phase

| Phase | Dispatches | Input | Cached | Output | Cost |
|---|---:|---:|---:|---:|---:|
| requirements_analysis | 2 (1 failed) | 27,466 | 11,081 | 11,916 | $0.1501 |
| architecture_design | 1 | 99,193 | 12,619 | 21,311 | $0.3425 |
| plan_task_packets | 1 | 23,700 | 0 | 7,400 | $0.0000 * |
| codegen | 14 (1 failed) | 587,763 | 629,383 | 56,470 | $1.4843 |
| tests | 4 | 79,983 | 35,796 | 16,468 | $0.2736 |
| debug | 7 | 538,639 | 1,497,668 | 24,267 | $1.2510 |
| senior_code_review | 1 | 55,000 | 0 | 8,100 | $0.0000 * |
| security_review | 1 | 47,000 | 0 | 7,715 | $0.0000 * |
| **Total** | **31** | **1,458,744** | **2,186,547** | **153,647** | **$3.5014** |

`*` unpriced in-session premium tier — see above.

**Rework was 36% of spend.** `debug` alone cost $1.25 across 7 dispatches, and 9 of 31 dispatches were
retries or refinements against 15 planned packets. The mechanical tier needed substantial correction
on this change: two lint fixes, three test fixes, one typecheck fix, and two codegen refinements.

## Files touched — 20

Every path was inside the frozen Gate 0 allowlist. Nothing was committed; `git_head_before` ==
`git_head_after` == `5d1fc910`.

**Modified (14):**
- `apps/api/src/database/schema.ts`
- `apps/api/drizzle/meta/_journal.json`
- `apps/api/src/column/index.ts` *(3 writes — codegen, security fix, biome format)*
- `apps/api/src/column/controllers/create-column.ts`
- `apps/api/src/column/controllers/update-column.ts`
- `apps/api/src/task/controllers/get-tasks.ts`
- `apps/web/src/fetchers/column/create-column.ts`
- `apps/web/src/fetchers/column/update-column.ts`
- `apps/web/src/hooks/mutations/column/use-create-column.ts`
- `apps/web/src/hooks/mutations/column/use-update-column.ts`
- `apps/web/src/components/kanban-board/column/column-header.tsx` *(3 writes)*
- `apps/web/src/hooks/mutations/label/sync-task-labels-cache.test.ts` *(fixture patch)*
- `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` *(fixture patch)*
- `i18n/en-US.json` *(2 writes)*

**Created (6):**
- `apps/api/drizzle/0043_known_night_thrasher.sql`
- `apps/api/drizzle/meta/0043_snapshot.json`
- `tests/api/column/create-column.test.ts`
- `tests/api/column/update-column.test.ts`
- `tests/api-integration/column-wip-limit.test.ts`
- `apps/web/src/components/kanban-board/column/column-header.test.tsx`

Full pre/post SHAs and backup paths are in `provenance.json`; `/mmo:revert 20260820-123148-feature-extend-lane-wip-limit`
can restore the pre-run state.

## Outstanding follow-ups

| ID | Severity | Item | Status |
|---|---|---|---|
| FU-1 | Medium | **i18n gap** — the new WIP-limit keys exist only in `en-US`. Deferred by explicit decision at Gate 3: `i18n/schema.json` is off-limits in this run's write contract and the gap pre-dates this run. | deferred |
| FU-2 | Medium | **Integration suite never executed** — run `column-wip-limit.test.ts` against a real PostgreSQL before merge. | open |
| FU-3 | Low | **Negative-authz cases missing** — add cross-workspace member and under-privileged in-workspace role cases to the integration suite. | open |
| FU-4 | Low | **UI has no upper bound** — `column-header.tsx` uses bare `Number(trimmed)` with no ceiling. The API now returns 400, so this is a UX papercut. Mirror `max` on the input. | open |
| FU-5 | Info | **Telemetry gaps** — `senior_code_review` emitted no event when it ran and was backfilled with estimated tokens at final-report time. Discovery ran into the project-wide `.sdlc/baseline/` and is not represented in this run's numbers. No `test_run` events were emitted. | open |

## Artifacts

All under `.sdlc/runs/20260820-123148-feature-extend-lane-wip-limit/`:
`intent_brief.md`, `requirements.md`, `change_plan.md`, `packets.json`, `review.json`,
`security_review.md`, `telemetry.jsonl`, `provenance.json`, `manifest.json`, `orchestrator.log`,
`delegation/`, `backups/`.

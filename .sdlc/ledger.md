# AI-SDLC run ledger — kaneo

Every `/mmo:*` run against this repository, newest last. Machine mirror: [`ledger.json`](./ledger.json).

Cost figures are token-derived estimates from the active policy's pricing block, not vendor
invoices, unless the run's `auth_mode` was `vendor`.

| Run ID | Date | Intent | Policy | Auth | Gates | Files (A/E/D) | Tests (final) | Cost | Committed | Artifacts |
|---|---|---|---|---|---|---|---|---|---|---|
| `20260825-114015-feature-extend-estimated-hours` | 2026-08-25 → 2026-08-26 | feature-extend | opus-plus-sonnet-max | estimated | 0✓ 1✓ 2✓ 3✓ 4✓accept | 11 / 23 / 0 | api 389 · itest 190 · web 139 · typecheck 6/6 | $8.08 | **no** | [runs/20260825-114015-feature-extend-estimated-hours](./runs/20260825-114015-feature-extend-estimated-hours/SUMMARY.md) |

## Run notes

### `20260825-114015-feature-extend-estimated-hours` — Estimated hours on tasks with per-column rollup

Added a nullable `estimatedHours` field to tasks end to end (Drizzle column + generated migration,
Valibot validation, `PUT /task/estimated-hours/:id`, typed fetcher, mutation hook, sidebar control,
create-task-modal chip) plus the kanban **per-column rollup badge**.

- **Anchor commit:** `5d1fc910` on `feature-extend-2/opus-sonnet`. Verified at closeout: `HEAD`
  still `5d1fc910`, 0 staged, 34 changed paths in the working tree. Nothing committed or pushed.
- **Migration:** `apps/api/drizzle/0043_cultured_zaran.sql` — verified to be exactly one nullable
  `ADD COLUMN`, no `DEFAULT`, no table rewrite.
- **Reviews:** senior 0 blockers / 2 majors (both fixed) / 6 minors; security **PASS** with 1 low.
- **Two guards mutation-verified** (each proven to fail when its guard was removed): the whole-task
  estimate-wipe guard, and `requireWorkspacePermission` on the new route.
- **Accepted deviations:** public-project payload now carries `estimatedHours` (payload-only, no UI
  renders it) — accepted knowingly at Gate 3; and the create-task modal calls a fetcher directly
  rather than the mutation hook, caused by the Gate 0 file scope, not by design.
- **Gate 0 commitment kept:** `.gitignore` gained `.sdlc/`.
- **Open follow-ups:** 4 — see `SUMMARY.md`. None blocking.

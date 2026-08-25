# AI-SDLC run ledger

One row per completed run **on this branch**. Scoped deliberately: this branch carries only its own
entries, so a benchmark arm's ledger never inherits another arm's history.

| Run ID | Date | Mode / intent | Policy | Files | Tests after | Cost | Gates | Verdicts |
|---|---|---|---|---|---|---|---|---|
| `20260825-084051-feature-extend-estimated-hours` | 2026-08-25 | brownfield / feature-extend | `opus-only-v5` | 45 | API 384 · web 181 | $9.5535 | all 4 approved | senior: approve-with-nits (0 blocking) · security: pass (0 blocking) |

## `20260825-084051-feature-extend-estimated-hours`

**Estimated hours on tasks with per-lane rollup.** Nullable `task.estimated_minutes` integer; UI
accepts hours and stores minutes; new `PUT /task/estimate/:id` reusing `task:["update"]`; popover in
all three sidebar variants; card badge; lane-header rollup that renders nothing when no task in the
lane has an estimate; export/import round-trip.

- **Base** `5d1fc910` on `feature-extend-2/opus-only`; database `kaneo_opus_only` (fresh).
- **Migration** `0043_adorable_micromacro.sql` — one additive nullable `ADD COLUMN`, applied against
  a *populated* table (3 seeded rows, all `NULL` after). Journal diff 7 insertions / 0 deletions.
- **Packets** 15 planned, 15 executed first-shot, 0 retries, 0 escalations. 1 refinement packet.
- **Cost** $9.5535 = $4.755 dispatched (16 events, vendor tokens) + $4.799 in-session (8 events,
  estimated). Cap headroom $40.45.
- **Known gap** no executed test covers the authorization chain on `PUT /task/estimate/:id`;
  verified by inspection only (Gate 1 OQ-4 chose not to widen the allowlist).
- **Follow-up raised** `GET /task/export/:projectId` lacks `requireWorkspacePermission` —
  pre-existing, widened by one field here, not fixed.
- **Artifacts** `.sdlc/runs/20260825-084051-feature-extend-estimated-hours/`

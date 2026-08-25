# AI-SDLC run ledger — kaneo

One row per completed `/mmo:*` run. Newest last. Machine mirror: `ledger.json`.

| Run ID | Date | Mode · Intent | Policy · Auth | Outcome | Files | Tests after | Cost | Mech. share | Artifacts |
|---|---|---|---|---|---|---|---|---|---|
| `20260824-095555-feature-extend-wip-limits` | 2026-08-24 | brownfield · feature-extend | `opus-plus-flash-v37` · estimated | accepted at Gate 4 | 39 | API 399/399 · Web 118/118 | $2.92 | 29/35 events (83%) for 10% of spend | [runs/20260824-095555-feature-extend-wip-limits](runs/20260824-095555-feature-extend-wip-limits/SUMMARY.md) |

## Notes per run

### `20260824-095555-feature-extend-wip-limits`
Per-lane soft WIP limit: nullable `wipLimit` on `columnTable`, migration `0043_broken_weapon_omega`,
column API + `ColumnEditor` input + over-cap lane-header badge. Advisory only — nothing blocked.
Not committed; rollback anchor `5d1fc910` on `feature-extend-1/opus-flash`.

Open follow-ups carried out of this run:
1. **Policy `task_type` routing gap** (highest value; affects every future brownfield run) —
   `opus-plus-flash-v37`'s codegen rule does not match the brownfield primitives
   `new_file_add` / `existing_file_edit`, so such packets fall through to `default: opus`.
2. `biome.json` has no `.sdlc` exclusion while `vcs.useIgnoreFile` is `false`, so `biome ci .`
   fails on plugin artifacts in any working tree that has run this plugin.
3. Integration test for the column authz chain is written but **parked and never executed**
   (`runs/.../pending/tests/api-integration/column-wip-limit.test.ts`); AC-3 has no executed test.
4. User documentation for the WIP limit — `apps/docs/**` and `apps/site/**` were off-limits.
5. `i18n/schema.json` staleness — pre-existing, not caused by this run.
6. Accepted low finding: `wipLimit` is present on the anonymous `GET /api/public-project/:id` payload.

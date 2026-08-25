# SDLC run ledger

| Date | Run ID | Intent | Feature | Cost (floor) | Files | Gates | Result |
|---|---|---|---|---|---|---|---|
| 2026-08-21 | `20260821-065909-feature-extend-lane-wip-limit` | feature-extend | Advisory per-column WIP limit (`wipLimit`), over-cap indicator in `ColumnHeader` | $3.88 | 22 (15 modified, 7 created) | 0–4 all approved (Gate 1 revised, Gate 3 approved with 2 fixes) | Uncommitted, all four gates green |

## 20260821-065909-feature-extend-lane-wip-limit — feature-extend

**Advisory per-column WIP limit (`wipLimit`), over-cap indicator in `ColumnHeader`** — arm 3 of the three-policy benchmark, `opus-only-v5` (single tier, `claude-opus-5` via the `claude-cli` adapter, `auth_mode: vendor`).

- Not committed — `git_head_before == git_head_after == 5d1fc910`; all 22 files sit in the working tree on `feature-extend-1/opus-only`.
- **$3.8845 across 14 dispatches**, vendor-reported per dispatch. Not a floor, unlike the flash arm — but see `manifest.json#cost_caveat`: five small items (the Gate 1 revision, a 3-line fixture repair, the i18n plural values, the OpenAPI prose, and the plural regression test) were done in-session rather than dispatched, so the comparison to the flash arm's $3.501437 is not strictly like-for-like.
- Configuration deliberately lives in `column-editor.tsx` (the existing per-column settings surface), diverging from the flash arm which put the input in the header. `column-header.tsx` is display-only.
- Gate 1 revised once: the validator gained an explicit `v.integer()` and the int4 ceiling `v.maxValue(2147483647)`. This closes, at requirements time, the Low finding the flash arm only caught at Gate 3 **and** its still-open follow-up FU-4 (unbounded UI input). The security reviewer verified both halves independently from the diff.
- Over-cap is strictly `count > limit`; a column exactly at its limit renders neutral. The indicator is not colour-only — it carries an `AlertTriangle` plus `title`/`aria-label`.
- **Cross-arm contamination, the operational lesson of this run:** the first integration attempt failed 177 tests with `column "wip_limit" of relation "column" already exists`. Migration row 44 (hash `4e298c82…`) in the shared `kaneo_test` database was the **flash arm's** `0043_known_night_thrasher.sql`; both arms generated an `0043` with different content, so Drizzle saw ours as unapplied and re-ran the `ADD COLUMN`. Fixed by dropping the database and migrating from zero. **Future benchmark arms need their own database, or a drop between arms.**
- The change plan named the `get-tasks.ts` projection as the one silent-failure risk. It was wrong in the good direction: the inferred `ProjectWithTasks` broke `pnpm typecheck` immediately at all three column-literal sites. The sibling field `color` is dropped silently there only because nothing ever added it back.
- i18n followed the repo's `_one`/`_other` convention. Note that in `wipLimitAria` the noun agrees with `limit` while i18next selects on `count`, so the `_one`/`_other` texts are intentionally identical (the same shape as `notifications.newCount`). Regression test drives real i18next, because the component suite mocks `react-i18next` and could never catch a plural bug.
- Verification: `pnpm typecheck` 6/6, API unit 398/398, web unit 126/126, API integration 187/187 against the live container on port 55432 with `DATABASE_URL` exported per shell.
- `pnpm i18n:check` fails, and **did so before this run** (`common:error.*` missing from `de-DE`). Not in the confirmed gate; translating the new keys is an explicit non-goal.
- Outstanding: no event/activity row on a `wipLimit` mutation (acceptable only while advisory); API unit tests stub the database so they cannot prove field forwarding (integration tests do); OpenAPI now documents the range on both routes.
- Revert with `/mmo:revert 20260821-065909-feature-extend-lane-wip-limit` — then delete `apps/api/drizzle/0043_next_killraven.sql` and `meta/0043_snapshot.json` by hand (created after provenance init, so no `sha_before`).

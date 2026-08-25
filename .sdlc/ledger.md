# SDLC run ledger

| Date | Run ID | Intent | Feature | Cost (floor) | Files | Gates | Result |
|---|---|---|---|---|---|---|---|
| 2026-08-21 | `20260820-123148-feature-extend-lane-wip-limit` | feature-extend | Advisory per-column WIP limit (`wipLimit`), over-cap indicator in `ColumnHeader` | $3.50 | 20 (14 modified, 6 created) | 0–4 all approved (Gate 3 approved-with-fix) | Uncommitted, all checks green |

## 20260820-123148-feature-extend-lane-wip-limit — feature-extend

**Advisory per-column WIP limit (`wipLimit`), over-cap indicator in LaneHeader**

- Not committed — `git_head_before == git_head_after == 5d1fc910`, all 20 files sit in the working tree on `feature-extend-1/gemini-only`.
- Two Gate-1 blockers resolved: the board renders from `GET /task/tasks/:projectId`, not the column endpoint, so `columnId` and `wipLimit` were added to that projection (additive, alongside the existing slug-as-`id` field which stays load-bearing).
- Gate 2 needed the write contract extended with test-only paths (no user source) to actually assert the acceptance criteria rather than relying on regression-only coverage.
- Gate 2b: adding the two new fields widened the inferred board type, breaking 3 fixtures in 2 pre-existing web test files (compile-time only) — patched under an allowlist extension.
- Gate 3 security review: 1 low finding (`wipLimit` had a floor but no ceiling — could 500 + Sentry-log instead of 400 on an out-of-range value). Fixed with `v.maxValue(2147483647)` before closing.
- Verification, confirmed by the coordinating session directly (not just agent-reported): `pnpm typecheck` 6/6, API unit 379/379, web unit 115/115, API integration 185/185 (30 files, including the 4 wipLimit-specific tests) against the live `kaneo-mmo-itest` Postgres container.
- One in-run correction worth remembering: the final report initially claimed the integration suite "never ran" (`ECONNREFUSED`). That was an artifact of `DATABASE_URL` not persisting across agent shell invocations — the repo has no committed `.env.test`, only `.env.test.example` pointing at the wrong port. Re-running with the correct URL against the already-running container proved the suite genuinely passes. See `manifest.json`'s `verification.api_integration` for the corrected record.
- Cost is a **floor**: `flash-agsdk-only` only prices the Flash leaf; in-session premium-tier work (packet planning, senior review, security review, the maxValue fix) logged at $0/estimated.
- Outstanding, non-blocking: i18n keys not yet translated to 15 other locales (pre-existing gap); negative-authz integration cases not added; WIP-limit input has no client-side ceiling (server-side is authoritative); recommend adding a real `apps/api/.env.test`.
- Revert with `/mmo:revert 20260820-123148-feature-extend-lane-wip-limit`.

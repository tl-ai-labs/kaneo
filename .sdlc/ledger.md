# SDLC run ledger

| Date | Run | Intent | Policy | Files | Tests | Cost | Committed |
|---|---|---|---|---|---|---|---|
| 2026-09-03 | `20260903-125223-feature-extend-task-estimated-hours` | feature-extend | `opus-flash-sdk` (SDK-pinned) | 32 | 390 API / 132 web + typecheck, green | $7.83 | no |

## 2026-09-03 — Task estimated minutes with per-column rollup

Branch `feature-extend-2/opus-flash-sdk`; HEAD unchanged at `5d1fc910`, nothing committed.
Auth `estimated`. Routing: **27/27 mechanical dispatches on `flash-agsdk-worker`**, first
attempt, zero misroutes, retries or escalations.

Stored as integer MINUTES, not decimal hours — the schema has no numeric/decimal/real column
anywhere, Drizzle returns numeric as a JS string, and float sums produce rollup artifacts.
Precedent: `timeEntryTable.duration`. UI speaks hours; the header sums raw minutes and formats
once, so three 100-minute cards read "1.67h" while the header reads "5h" — correct, and
deliberately documented rather than "fixed".

`Task.estimatedMinutes` was kept REQUIRED throughout. That is what surfaced three production
components missing the field, which an optional type would have hidden.

Three contract amendments, one file each: `lib/estimate.ts` (Gate 1),
`shared/modals/create-task-modal.tsx` (B1), `apps/api/src/mcp/tools.ts` (security). Each
corrected an over-tight initial allowlist rather than expanding the feature.

Open follow-ups:
- `.husky/pre-commit` does not typecheck — add a `typecheck` step.
- `.sdlc/` is not gitignored and biome lints it, so committing artifacts fails the hook.
- `pnpm audit --prod`: 7 high, pre-existing, manifest untouched.

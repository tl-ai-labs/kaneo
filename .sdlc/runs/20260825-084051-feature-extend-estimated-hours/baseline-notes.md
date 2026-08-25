# Pre-change baseline — measured, not assumed

Captured before any source file was touched, at `5d1fc910` on `feature-extend-2/opus-only`.
Purpose: at Phase 7 and in the final report, distinguish "this run broke it" from "it was
already like that". Every number below is a real command's real output.

## Test suites — GREEN

| Suite | Command | Result |
|---|---|---|
| API unit | `pnpm --filter @kaneo/api test` | **58 files / 374 tests passed** |
| Web unit | `pnpm --filter @kaneo/web test` | **36 files / 112 tests passed** |
| Typecheck | `pnpm typecheck` | **6/6 tasks successful** (~7 min; scope it per-package while iterating) |

Any failure after the change is therefore attributable to the change.

Note: `pnpm typecheck` transitively runs `@kaneo/api:build`, which rewrites `apps/api/dist/`.
That directory is off-limits to this run's writes and was never read by it.

## `pnpm i18n:check` — ALREADY RED (pre-existing, unrelated)

**324 missing keys across 16 of the 17 locale files.** Zero locales report OK. Full output:
`i18n-baseline-before.txt`; per-file checksums: `i18n-baseline-md5.txt`.

The gap is two unrelated pre-existing clusters:
1. `common:error.*` — 15 keys missing from `vi-VN` and `zh-CN`.
2. i18next **plural-suffix** keys (`_one` / `_few` / `_many` / `_other`) across
   `tasks:bulk.*`, `tasks:archive.*`, `notifications:*`, `settings:*`, `workspace:search.*`.
   The checker compares flattened key sets literally and has no notion of per-locale plural
   rules, so it demands `_few`/`_many` from locales whose CLDR plural set does not include them.

**Consequences for this run, both binding:**

- **AC-9 as originally written is unachievable and has been corrected.** "`pnpm i18n:check` reports
  OK for all locales" cannot be reached without fixing 324 unrelated keys — squarely outside this
  ticket and against AGENTS.md's "stay focused". The real criterion is: *the pre-existing 324 are
  unchanged, and this run adds no new missing key.*
- **The Gate 1 OQ-3 guard is not hypothetical — it is essential.** An unguarded
  `pnpm i18n:check:fix` would backfill all 324 pre-existing keys into 16 locales, producing a diff
  ~30x the size of the feature and writing **English text into `zh-CN`, `ko-KR`, `ru-RU`** and
  the rest, plus grammatically wrong plural forms the checker only *thinks* are missing.
  So the propagation step adds **only this feature's keys**, using the repo's own
  `scripts/i18n/shared.mjs` helpers (`loadLocales` / `setValueAtKey` / `writeJson`) so the output
  is byte-identical to what `--fix` would have written for those keys — and nothing else.
  Verified afterwards by diffing each locale's key set against `i18n-baseline-md5.txt`.

## Database — `kaneo_opus_only`, deliberately staged

Verified empty at start: 0 public tables, no `drizzle.__drizzle_migrations`, no `task` table.

Then, **before** generating `0043`, this run:
1. Applied the 43 existing migrations — `applied migrations: 43`, `task` columns confirmed as
   `id, project_id, position, number, title, description, status, priority, due_date, created_at,
   assignee_id, column_id, start_date, updated_at` — i.e. exactly the pre-feature schema, with
   **no** `estimated_minutes`.
2. Seeded a full FK chain (`user` -> `workspace` -> `project` -> `column`) and **3 pre-existing
   task rows**.

This is the point of the exercise: `0043` will now be applied to a **populated** `task` table, so
AC-1's "safe on an existing populated database" and NFR-1's "existing rows are unaffected" become
*executed checks* — the new column must arrive NULL on all 3 seeded rows — rather than assertions
about SQL that only ever ran against an empty table.

## Known-red things this run must NOT touch or take credit for

- `pnpm exec biome ci .` — pre-existing red (2 formatting errors in untracked `.sdlc` leftovers,
  plus 78 pre-existing warnings). Verification here is scoped: `pnpm exec biome check <changed paths>`.
  `biome.json` and `.gitignore` are off-limits.
- The 324 i18n keys above.

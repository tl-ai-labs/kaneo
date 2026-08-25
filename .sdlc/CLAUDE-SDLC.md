# AI-SDLC on this branch

`feature-extend-2/opus-only` — a **benchmark arm**. The same feature (estimated hours on tasks with a
per-lane rollup) was built on sibling branches under different routing policies, so this branch's
history is only meaningful in isolation.

## Isolation rules — still in force

Nothing in this branch may be reconciled against a sibling arm. Specifically: no `git show` of
another branch's commits, no `git checkout <ref> -- <path>`, no `git diff <branch>`, no `merge`, no
`git restore --source`. Two sibling run directories are present on disk under `.sdlc/runs/` as
untracked leftovers (`20260820-123148-feature-extend-lane-wip-limit`,
`20260824-124116-feature-extend-estimated-hours`) — **treat both as off-limits**; they belong to
other arms and were not read by this run. Stale `dist/` build artifacts also contain a sibling's
compiled build of this exact feature.

An independently weaker implementation is a valid result. A borrowed one invalidates the comparison
while looking like success.

## What lives here

| Path | What it is |
|---|---|
| `.sdlc/ledger.md` / `ledger.json` | One row per completed run **on this branch only** |
| `.sdlc/runs/<run-id>/` | Per-run record: requirements, change plan, reviews, manifest, telemetry, packets, provenance, baselines |
| `.sdlc/baseline/current.json` | Project baseline from discovery |
| `.sdlc/local/write-contract.json` | The frozen file allowlist. `active: false` between runs |
| `.sdlc/local/state.json` | Run state; a non-terminal value triggers a re-prompt on next invocation |

## Repo-specific things a future run must know

These cost this run real time to discover. They are true of the repo, not of the ticket.

- **`pnpm exec biome ci .` is red at baseline** and `pnpm i18n:check` is red at baseline
  (**324 missing keys across all 16 non-default locales**). Verify with **scoped**
  `pnpm exec biome check <changed paths>` and compare `i18n:check` output against a captured
  baseline rather than expecting green. `biome.json` and `.gitignore` are off-limits.
- **Never `pnpm lint`** — it runs `biome check --write .` and rewrites unrelated files.
- **`i18n/` holds 17 locale files plus a generated `schema.json`** (18 `.json` total, so 16
  non-default locales — easy off-by-one). `scripts/i18n/shared.mjs` excludes `schema.json`.
  Key format is **`namespace:nested.path`**, not dot-only.
- **`i18n/schema.json` is generated** by `pnpm i18n:schema` from `en-US`, with
  `additionalProperties: false` and `required` at every level. Add keys without regenerating and
  every locale becomes invalid against its own schema.
- **Never run `pnpm i18n:check:fix` unguarded** — with a red baseline it backfills all 324
  pre-existing keys into 16 locales, writing English into `zh-CN`/`ko-KR`/`ru-RU` plus plural forms
  the checker only *believes* are missing. Drive `shared.mjs` over a hardcoded key list instead;
  `.sdlc/runs/20260825-084051-feature-extend-estimated-hours/apply-i18n-keys.mjs` is a working model.
- **`apps/api/src/task/validate-task-fields.ts` imports `../database`**, so it cannot be imported
  from the DB-free `tests/api` suite. New validators that tests must import need their own db-free
  module.
- **`task-properties-sidebar.tsx` renders three responsive variants** of the same property row
  (compact, mobile, desktop). A new property must be registered in all three.
- **`@/components/ui/input` wraps a base-ui primitive.** Plain controlled `value`/`onChange` needs
  the `nativeInput` escape hatch.
- **`tests/api/**` is DB-free with no route-level tests.** Real authorization coverage requires
  `tests/api-integration/**`. If a ticket's allowlist excludes it, authorization is inspection-only
  and the report must say so.
- **`pnpm typecheck` transitively runs `@kaneo/api:build`** and takes ~7 minutes cold. Scope to
  `pnpm --filter <pkg> typecheck` while iterating.
- **Migration workflow**: `pnpm --filter @kaneo/api db:generate`, inspect the SQL, then
  `pnpm exec biome format --write` on the two generated JSON files (drizzle-kit emits 2-space JSON;
  committed snapshots are tab-indented). Trailing newlines on `.sql` files are *not* a convention —
  23 of 44 lack one. Do not hand-edit generated SQL.
- **Staging the database pays off.** Applying existing migrations and seeding rows *before*
  generating a new one turns "safe on a populated database" from an assertion into an executed check.

## Conventions

`AGENTS.md` is canonical and off-limits for writing. Its load-bearing points: thin Hono handlers with
domain behaviour in controllers, Valibot validation, `HTTPException` for expected failures,
`requireWorkspacePermission` rather than hand-rolled role checks, `publishEvent()` when a mutation
drives realtime state, fetchers under `apps/web/src/fetchers/`, server state in TanStack Query hooks,
the typed client from `@kaneo/libs`, and static i18n keys for every user-facing string.

# AI-SDLC project fingerprint — kaneo

Maintained by the `mmo` plugin. Updated at the close of every run.
**Run history:** [`ledger.md`](./ledger.md) · machine mirror [`ledger.json`](./ledger.json)

- **Last updated:** 2026-08-26
- **Last run:** [`20260825-114015-feature-extend-estimated-hours`](./runs/20260825-114015-feature-extend-estimated-hours/SUMMARY.md) (feature-extend, accepted at Gate 4)
- **Runs recorded:** 1

---

## Stack

Pure-ESM TypeScript 7.0.2 monorepo on pnpm 10.32.1 + Turborepo, Node >= 20.19, Biome 2.5.7 for
lint and format.

| Surface | Stack |
|---|---|
| `apps/api` | Hono + `hono-openapi`, **Valibot** validation, **Drizzle ORM** on PostgreSQL, Better Auth, internal event bus → WebSockets (optional Redis fan-out) |
| `apps/web` | React + Vite, TanStack Router (generated `routeTree.gen.ts`) + TanStack Query, Radix/Base UI + Tailwind, dnd-kit, Zustand, Immer, react-i18next |
| `packages/libs` | `hc<AppType>` Hono RPC client — API route types propagate automatically |
| `packages/permissions` | Canonical permission vocabulary; built-ins `viewer`, `member`, `admin`, `owner` |

## Verified commands

| Purpose | Command |
|---|---|
| API unit tests | `pnpm --filter @kaneo/api test` |
| API integration tests | `pnpm --filter @kaneo/api test:integration` (needs PostgreSQL) |
| Web tests | `pnpm --filter @kaneo/web test` |
| Typecheck | `pnpm typecheck` |
| Migration generation | `pnpm --filter @kaneo/api db:generate` |
| Formatting/lint | **targeted `biome check <path>` only** |

**Do not run root or package `lint`.** Those scripts execute `biome check --write` and can modify
unrelated files (AGENTS.md). Use targeted checks while iterating.

**Do not run `pnpm test` at the root** for API work — use the per-package commands above.

## Facts worth not rediscovering

- **The integration harness protects the primary database by itself.** `tests/api-integration/setup.ts`
  reads `DATABASE_URL`, appends `_test` to the database name, and hard-fails unless the name ends in
  `_test`. It also mocks `dotenv-mono` so the real `.env` is never loaded. With `.env` pointing at
  `kaneo_opus_only`, the suite targets `kaneo_opus_only_test`.
- **The integration harness applies migrations for real.** `helpers/database.ts` runs Drizzle's
  `migrate()` against `apps/api/drizzle` and creates the `_test` database if absent — so a generated
  migration is *executed* by the suite, which is stronger evidence than reading the SQL.
- **Task read controllers use explicit column-selection objects.** `get-tasks.ts` (the kanban board
  payload), `get-task.ts` and `export-tasks.ts` each list columns one by one. A new column is
  invisible to consumers unless added to all three.
- **`get-public-project.ts` reuses `getTasks()` wholesale**, so anything added to `taskSelection`
  reaches the unauthenticated `GET /api/public-project/:id`.
- **`get-projects.ts` is workspace project *statistics*,** not the board payload.
- **`pnpm i18n:check` exits 1** whenever a key exists in `en-US.json` and not in the other 16
  locales. It is wired into neither CI nor husky. `pnpm i18n:check:fix` syncs them.
- **The house pattern for a new scalar task field** is the `dueDate` chain: schema column →
  generated migration → `taskSchema` → controller with read-before-write + `publishEvent` → route
  with `describeRoute` + Valibot + `workspaceAccess.fromTask()` + `requireWorkspacePermission` →
  fetcher → mutation hook with invalidations → UI.

## Conventions

Kebab-case files, one exported unit per file. `export default` for controllers and fetchers;
**named** exports for hooks and kanban-board components (note `components/task/*` popovers are
default exports). Thin handlers, domain logic in controllers. `HTTPException` for expected failures.
`type` over `interface`. All user-facing copy through `t()` against `i18n/en-US.json`. Never
hand-write a migration; never edit `apps/api/drizzle/meta/` or `apps/web/src/routeTree.gen.ts`.

## Default off-limits

From `.sdlc/project.json`: `.env*`, `.mcp.json`, `node_modules/**`, `dist/**`, `build/**`,
`.next/**`, `.sdlc/**`, `.git/**`, `.cursor/rules/**`, `.claude/settings.local.json` — plus every
detected AI config (`.claude/**`, `CLAUDE.md`, `AGENTS.md`, `skills/**`, `.coderabbit.yaml`).

## Default policy

`opus-plus-sonnet-max` (see `.sdlc/project.json`). Judgment phases → `claude-opus-5`; codegen,
tests, docs and debug → `claude-sonnet-5`.

> **Known plugin issue:** the shipped policies key their codegen rule on greenfield-only
> `task_type` values, so canonical brownfield primitives (`new_file_add`, `existing_file_edit`,
> `patch_apply`) match no rule and fall through to the premium default. Simulate routing before
> dispatching, or map `task_type` to a policy-recognized value and carry the brownfield primitive
> in `subtype`. See finding F-3 in the last run's `findings.md`.

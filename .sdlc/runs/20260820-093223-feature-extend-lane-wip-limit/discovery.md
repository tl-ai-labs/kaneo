# Brownfield discovery — kaneo

- **Run ID:** `20260820-093223-feature-extend-lane-wip-limit`
- **Mode:** first-time (full Tier 1 scan)
- **Plugin version:** 0.6.0
- **Scanned at:** 2026-08-20T09:32:23Z
- **Repo root:** `/home/sangeetha/projects/kaneo`

> Scope note: this scan read only the current working tree at `5d1fc910`. The sibling branch
> `feature-extend-1/opus-flash-v37` was not read, not diffed, and did not influence any finding below.

---

## 1. Git state

| Field | Value |
|---|---|
| HEAD | `5d1fc9104337786c3ef295ec0dc31656df371d8d` |
| Branch | `feature-extend-1/gemini-only` |
| Tracked tree | clean |
| Untracked | `.sdlc/` only (this plugin's own output) |
| Remote | `origin` → `https://github.com/tl-ai-labs/kaneo.git` |
| Tracked files | 1578 |
| `.gitignore` covers `.sdlc/` | **No** |

Rollback anchor for this run is `5d1fc910`. The tree is clean, so `git diff` at the end of the run
will show exactly what the plugin produced.

## 2. Topology

Turborepo monorepo over pnpm workspaces (`packages/**`, `apps/**`).

```
apps/          api (Hono), web (React/Vite), site (Next.js), docs (content)
packages/      libs, permissions, email, mcp, planka-import, typescript-config
tests/         api (unit), api-integration (PostgreSQL-backed)
i18n/          19 locale JSON files + resources.ts + schema.json
charts/kaneo   Helm chart
deploy/, sentry/, scripts/, plans/, skills/
```

Entry points: `apps/api/src/index.ts`, `apps/web/src/main.tsx`, `packages/mcp/src/index.ts`.

## 3. Detected stacks

Single language family: **TypeScript on Node ≥ 20.19**, ESM (`"type": "module"`).

| Package | Role | Key frameworks |
|---|---|---|
| `@kaneo/api` (`apps/api`) | HTTP API | Hono, hono-openapi, Better Auth, Drizzle ORM, Valibot, `pg`, ioredis, MCP SDK, Vitest |
| `@kaneo/web` (`apps/web`) | UI | React, Vite, TanStack Router + Query, dnd-kit, Radix UI, Tailwind, TipTap, react-i18next, Vitest |
| `@kaneo/site` (`apps/site`) | Marketing/docs site | Next.js |
| `@kaneo/libs` | Shared typed Hono client + URL helpers | — |
| `@kaneo/permissions` | Permission vocabulary + built-in roles | Better Auth |
| `@kaneo/email` | Email templates | React Email, nodemailer |
| `@kaneo/mcp` | Published stdio MCP package | MCP SDK, zod |
| `@kaneo/planka-import` | CLI importer | — |
| `@kaneo/typescript-config` | tsconfig presets | — |

**Package manager:** pnpm, pinned to `10.32.1` via `package.json#packageManager`. Lockfile `pnpm-lock.yaml`.
Task runner: Turborepo `^2.10.8`. Linter/formatter: Biome `2.5.7`.

**Adaptive stack profile triggered.** Hono + React/Vite/TanStack has no pre-authored adapter
(shipped set is `generic.md`, `nest.md`, `python.md`). Learned profile written to
`.sdlc/baseline/stack-profile.md` and is authoritative over any generic adapter.

## 4. Test / build / lint commands

Proposed default: **`pnpm test`** (source: `package.json#scripts.test` → `turbo test`).

| Purpose | Command |
|---|---|
| All tests | `pnpm test` |
| API unit | `pnpm --filter @kaneo/api test` |
| API integration (needs PostgreSQL) | `pnpm --filter @kaneo/api test:integration` |
| Web unit | `pnpm --filter @kaneo/web test` |
| Typecheck all | `pnpm typecheck` |
| Typecheck web | `pnpm --filter @kaneo/web typecheck` |
| Build | `pnpm build` |
| i18n key check | `pnpm i18n:check` / `pnpm i18n:check:fix` |
| Generate migration | `pnpm --filter @kaneo/api db:generate` |

**Caveats Gate 0 should confirm:**

1. `turbo.json` declares `lint` with `persistent: true`. `turbo lint` behaves as a long-running task
   and may not exit. Prefer targeted `biome check .` in the affected package.
2. Package `lint` scripts are `biome check --write .` — they **mutate files**, including unrelated ones.
   `AGENTS.md` calls this out explicitly.
3. `test` and `typecheck` both `dependsOn: ["^build"]`, so a cold run builds upstream packages first.
4. Integration tests require a live PostgreSQL. `AGENTS.md`: never point them at production.

## 5. Docs present

`README.md`, `CLAUDE.md`, `AGENTS.md` (canonical agent guidance, `CLAUDE.md` just `@`-imports it),
`CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `ENVIRONMENT_SETUP.md`, `CHANGELOG.md`,
plus `apps/docs/` content and a `plans/` directory. No ADR directory.

`AGENTS.md` is unusually prescriptive and should be treated as binding project policy for this run —
notably the "Follow a change through" surface checklist and the "Verification" ladder.

## 6. Detected AI / agent setup

| Path | Type |
|---|---|
| `CLAUDE.md` | Claude Code project instructions (imports `AGENTS.md`) |
| `AGENTS.md` | canonical agent guide |
| `.claude/skills/` | 11 skills (animate, verify, apple-design, coss, prototype, …) |
| `.agents/skills/` | 10 skills, largely mirroring `.claude/skills` |
| `.cursor/rules/` | 7 `.mdc` rule files |
| `.coderabbit.yaml` | CodeRabbit automated PR review |
| `skills/`, `skills-lock.json` | skills source + lockfile |
| `.vscode/`, `.devcontainer/` | editor / container config |

Absent: `.mcp.json`, `.claude/settings.json`, `.claude/settings.local.json`, `CLAUDE.local.md`,
`.cursorrules`, `.aider.conf.*`, `.continue/`, `.github/copilot-instructions.md`, `.roo/`,
repo-local `routing-policy.yaml`.

## 7. Environment variables (names only — no values were read)

Env files found: `.env.sample` (20 keys), `apps/api/.env.test.example` (6),
`apps/web/.env.development` (2), `apps/web/.env.production` (4). No `.env` exists in the tree.

Source references surface ~105 distinct names across auth, OAuth providers, Postgres, Redis,
S3, SMTP, Sentry, Creem billing, and Turnstile. Full lists are in `baseline.json`
(`env_keys_by_file`, `env_keys_referenced_in_code`). No value side was read or recorded.

None of these are relevant to the upcoming job — a WIP-limit feature needs no new credentials.

## 8. Monorepo, submodules, LFS, generated files

- **Monorepo:** pnpm workspaces + Turborepo. 9 workspace packages (table in §3).
- **Submodules:** none (`.gitmodules` absent).
- **Git LFS:** not in use. `.gitattributes` contains only `.husky/* text eol=lf`.
- **Generated files to avoid hand-editing:** `apps/web/src/routeTree.gen.ts` (TanStack Router plugin),
  `apps/api/drizzle/meta/**` (Drizzle Kit journal/snapshots), `i18n/schema.json` (`pnpm i18n:schema`),
  `pnpm-lock.yaml`.
- **Hooks:** Husky is installed (`prepare: husky`) with commitlint conventional-commit enforcement.

## 9. Infra

`Dockerfile.kaneo`, `compose.yml`, `compose.local.yml`, Helm chart at `charts/kaneo`,
13 GitHub Actions workflows (`ci.yml`, `nightly.yml`, `docker.yml`, `helm-chart.yml`, `release.yml`, …),
Sentry config. No Terraform, GitLab CI, CircleCI, or Jenkins.

## 10. `.gitignore` aggressiveness

Standard Node/Turbo/Next ignore set — **not aggressive**. It ignores dependencies, env files,
coverage, `.turbo`, build outputs (`dist`, `build`, `.next/`, `out/`, `.source`), `*.db`, `*.pem`,
`.cache/`, `.worktrees/`, `.idea`, `apps/web/.tanstack/`, `.pi/`, `compose.override.yml`.

Nothing in it would hide legitimate source from this run. The one gap is that **`.sdlc/` is not covered**.

## 11. Regulated-repo signals

Only `SECURITY.md`, which is a conventional open-source vulnerability-disclosure policy.
No `HIPAA/`, `PCI/`, `SOC2/`, `GDPR/`, `compliance/`, `regulated/` paths and no `CODEOWNERS`.
**Not classified as a regulated repo**; no Gate 0 regulated warning required.

That said, the codebase handles auth secrets, OAuth credentials, S3 keys and multi-tenant workspace
data, and `AGENTS.md` forbids leaking secrets or private workspace data through responses, logs,
events, WebSockets, or MCP tools. Keep that constraint in scope even though it isn't a compliance flag.

## 12. Coexistence risks

- **Cursor rules detected** at `.cursor/rules/` (7 `.mdc` files). The plugin will never touch them,
  but if Cursor auto-lint-on-save is running, our changes may trigger it.
- **Two parallel skill trees** (`.claude/skills/`, `.agents/skills/`) plus `skills/` and
  `skills-lock.json`. Untouched by default; do not let `skills-lock.json` drift.
- **CodeRabbit is configured** (`.coderabbit.yaml`). Any PR from this run will get automated review.
- **No custom `.mcp.json`** — no competing MCP servers at project scope. Our bundled dispatcher is unopposed.
- **No repo-local `routing-policy.yaml`** — the shipped policy applies as-is.
- **`.sdlc/` is not gitignored.** Run artifacts under `.sdlc/` (packets, backups, telemetry) will be
  untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` to this run's allowlist
  so the plugin can append the entry as part of the run.
- **Husky + commitlint are active.** Conventional-commit subjects are mandatory if a commit is requested.
- **`pnpm lint` reformats unrelated files** (`biome check --write .`). Do not run it as a blanket
  verification step; use targeted checks and inspect formatter output.

## 13. Proposed off-limits

Defaults for this run (Gate 0 may override individual entries):

```
.git/**            .sdlc/**
.env  .env.*  .env.sample
apps/api/.env.test.example  apps/web/.env.development  apps/web/.env.production
.claude/**  .agents/**  .cursor/**  CLAUDE.md  AGENTS.md  .coderabbit.yaml
skills/**  skills-lock.json  .vscode/**  .devcontainer/**  .husky/**
node_modules/**  **/node_modules/**  dist/**  build/**  .next/**  .turbo/**  coverage/**
apps/web/.tanstack/**  apps/web/src/routeTree.gen.ts
pnpm-lock.yaml  apps/api/drizzle/meta/**
i18n/*.json  EXCEPT i18n/en-US.json          (see note)
CHANGELOG.md  CONTRIBUTORS.svg
```

Notes:
- **`i18n/en-US.json` stays IN scope** — `AGENTS.md` names it the source of truth. The other 16 locales
  and `i18n/schema.json` are off-limits because `pnpm i18n:check --fix` / `pnpm i18n:schema` are the
  sanctioned propagation path; hand-editing them invites drift.
- The Drizzle `.sql` migration file for any schema change must be **generated** via
  `pnpm --filter @kaneo/api db:generate` and then inspected, not hand-authored.
  `apps/api/drizzle/*.sql` is therefore in scope only as generator output.

---

## Job-relevant surfaces — lane WIP limit on the kanban board

All paths below were verified to exist on disk at `5d1fc910`.

### Does a WIP-limit implementation already exist?

**No.** A case-insensitive search for `wip-limit`, `wip_limit`, `wipLimit`, `WIP_LIMIT`, `"wip"`, and
`work in progress` across `apps/`, `packages/`, `tests/`, `i18n/`, `charts/`, `scripts/`
(`.ts`, `.tsx`, `.json`, `.sql`, `.yaml`, `.yml`, `.md`; `node_modules` excluded) returned **zero matches**.

Corroborating evidence:
- `columnTable` in `apps/api/src/database/schema.ts` has no limit-like field.
- `updateColumn` accepts only `name`, `icon`, `color`, `isFinal`.
- `ColumnHeader` renders a bare task count (`{column.tasks.length}`) with no threshold logic.

This feature is a genuine greenfield addition on top of an existing column model.

### Kanban board and column components (`apps/web`)

| Path | Lines | Role |
|---|---|---|
| `apps/web/src/components/kanban-board/index.tsx` | 280 | Board root — lays out columns, owns dnd-kit `DndContext` |
| `apps/web/src/components/kanban-board/column/index.tsx` | 36 | Single column shell — header + dropzone, drag-over styling |
| `apps/web/src/components/kanban-board/column/column-header.tsx` | 105 | **Column header — renders the task count badge; primary UI insertion point** |
| `apps/web/src/components/kanban-board/column/column-dropzone.tsx` | — | Droppable area, task list, drop target |
| `apps/web/src/components/kanban-board/task-card.tsx` | — | Draggable task card |
| `apps/web/src/components/kanban-board/task-card-context-menu/task-card-context-menu-content.tsx` | — | Task card context menu |
| `apps/web/src/components/kanban-board/task-labels.tsx` (+ `.test.tsx`) | — | Label chips; the one existing component test in this tree |
| `apps/web/src/components/board/board-toolbar.tsx` | — | Board toolbar (filter/sort controls) |
| `apps/web/src/components/project/column-editor.tsx` | — | **Column create/edit form — where a WIP-limit input would live** |
| `apps/web/src/components/public-project/kanban-view.tsx` | — | Public/read-only board variant — mirror any header change here |
| `apps/web/src/lib/column.tsx` | — | `getColumnIcon` and column display helpers |
| `apps/web/src/constants/columns.ts`, `apps/web/src/constants/column-icons.ts` | — | Default column definitions and icon registry |
| `apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx` | — | Board route |
| `apps/web/src/hooks/use-board-sort.ts` (+ `.test.tsx`) | — | Board sort logic; existing hook-test pattern to copy |

Column data reaches the UI as `ProjectWithTasks["columns"][number]` from `apps/web/src/types/project`,
held in `useProjectStore` (`apps/web/src/store/project`) and mutated with `immer`'s `produce`.

### Column data model

- `apps/api/src/database/schema.ts` — **`columnTable` at lines 342–367**, table name `"column"`.
  Fields: `id` (cuid2 pk), `projectId` (FK → `project`, cascade), `name`, `slug`,
  `position` (integer, default 0), `icon`, `color`, `isFinal` (boolean, default false),
  `createdAt`, `updatedAt`. Index: `column_projectId_idx` on `projectId`.
- `apps/api/src/database/relations.ts` — Drizzle relations.
- `apps/api/drizzle/` — generated migrations, currently through `0042_previous_the_executioner.sql`.
- `apps/api/drizzle.config.ts` — Drizzle Kit config.

A nullable integer column is the natural shape here; it must default safely for existing installations
per `AGENTS.md` ("Database changes must work for existing installations").

### Column API (`apps/api`)

| Path | Role |
|---|---|
| `apps/api/src/column/index.ts` | Hono router — routes, `describeRoute` OpenAPI metadata, Valibot `validator(...)`, `workspaceAccess.fromProject`, `requireWorkspacePermission` |
| `apps/api/src/column/controllers/get-columns.ts` | list columns by project, ordered by position |
| `apps/api/src/column/controllers/create-column.ts` | create |
| `apps/api/src/column/controllers/update-column.ts` | **update — currently `name`/`icon`/`color`/`isFinal` only** |
| `apps/api/src/column/controllers/delete-column.ts` | delete |
| `apps/api/src/column/controllers/reorder-columns.ts` | reorder |

Mounted in `apps/api/src/index.ts` at line 608 (`api.route("/column", column)`), re-exported in the
app type union around lines 784 / 902 / 944 — that union is what gives `@kaneo/libs` its typed client.

Related but distinct: `apps/api/src/migrations/column-migration.ts` (runtime data backfill),
`apps/api/src/plugins/{github,gitea}/utils/resolve-column.ts` (integration column resolution),
`apps/api/src/utils/migrate-session-column.ts` (unrelated — a session table column).

### Web fetchers and TanStack Query hooks

Fetchers (`apps/web/src/fetchers/column/`): `get-columns.ts`, `create-column.ts`,
`update-column.ts`, `delete-column.ts`, `reorder-columns.ts`.

Hooks:
- Query: `apps/web/src/hooks/queries/column/use-get-columns.ts` — key `["columns", projectId]`
- Mutations: `apps/web/src/hooks/mutations/column/use-create-column.ts`,
  `use-update-column.ts`, `use-delete-column.ts`, `use-reorder-columns.ts`

`use-update-column.ts` already invalidates both `["columns", projectId]` and `["tasks", projectId]`
with `refetchType: "all"` — the right precedent for a WIP-limit mutation, since a limit badge depends
on task counts as well as column config.

### i18n

- **`i18n/en-US.json`** — source of truth, 2148 lines. A `columns` namespace exists at line 2087.
- Sibling locales: `de-DE`, `el-GR`, `es-ES`, `fr-FR`, `hi-IN`, `id-ID`, `it-IT`, `ko-KR`, `mk-MK`,
  `nl-NL`, `pt-BR`, `ru-RU`, `tr-TR`, `uk-UA`, `vi-VN`, `zh-CN` (all in `i18n/`).
- `i18n/resources.ts` wires them; `i18n/schema.json` is generated.
- Propagate new keys with `pnpm i18n:check:fix`, then verify with `pnpm i18n:check`.
- Web components consume keys via `useTranslation()` from `react-i18next`, e.g.
  `t("tasks:archive.success", { count })` in `column-header.tsx`.

### Existing tests to extend

- `tests/api/column/to-slug.test.ts` — the only column-focused API test today.
- `tests/api-integration/` — PostgreSQL-backed; the right home for a schema/migration-affecting change.
- `apps/web/src/components/kanban-board/task-labels.test.tsx` — component-test pattern for this tree.
- `apps/web/src/hooks/use-board-sort.test.tsx` — hook-test pattern.

### Surfaces the `AGENTS.md` checklist implies for this job

Schema + generated migration → column controller + Valibot validator + OpenAPI description →
typed client regeneration via the `apps/api/src/index.ts` route union → web fetcher → mutation hook +
cache invalidation → `column-editor.tsx` input → `column-header.tsx` badge → `kanban-view.tsx`
(public variant) → `en-US.json` keys → tests. Whether drag-and-drop enforcement (blocking a drop that
would exceed the limit) is in scope is a product decision for the Gate, not a discovery finding —
but note it lands in `column-dropzone.tsx` / `kanban-board/index.tsx` if included.

---

## Scan metadata

Tier 1 full scan, no sampling (1578 tracked files, well under the sampling threshold).
No unreadable or non-UTF8 files encountered. Tier 2b adaptive stack profile triggered and written.
Tier 2 items — test-command confirmation, file-scope allowlist, off-limits confirmation — are
Gate 0's job, not this agent's.

---

## Addendum — reconciliation at end of scan

Two things changed or surfaced after the Group 6 read and are recorded here rather than silently folded in.

1. **`.claude/settings.local.json` now exists** (created 09:35, mid-session, by the MMO harness itself —
   its entire content is `{"env":{"MMO_SELECT":"gemini-flash=flash-agsdk-worker"}}`). It was absent when
   Group 6 ran and is not user-authored project config. It is **untracked and not matched by `.gitignore`**,
   which ignores `.idea` but nothing under `.claude/`. A `git add -A` would stage it. The `.gitignore`
   entry offered at Gate 0 should cover it alongside `.sdlc/`.

2. **`.sdlc/` was not empty before this run.** It already contained:
   - `.sdlc/project.json` — `default_policy: flash-agsdk-only`, plus an `off_limits_default` list.
     The §13 proposal above is a **superset** of that list and reconciles with it rather than replacing it.
   - `.sdlc/pre-check-status.json`
   - `.sdlc/runs/20260820-070418-feature-extend-lane-wip-limit/orchestrator.log` — an earlier attempt at
     this same job that **halted at preflight**: the `flash-agsdk-only` policy's single model could not
     dispatch because the Antigravity worker has no Python venv at
     `…/mcp/model-dispatch/worker/.venv/bin/python`. Nothing was dispatched and **no source was modified**,
     so the working tree is still a clean baseline. That blocker is unresolved as of this scan and will
     stop this run too unless the venv is created (`npm run setup` in the plugin root) or
     `GEMINI_WORKER_PYTHON` is pointed at a Python ≥ 3.10 with `google-antigravity` installed.

Neither item changes any finding in §1–13 or in the job-relevant surfaces section.

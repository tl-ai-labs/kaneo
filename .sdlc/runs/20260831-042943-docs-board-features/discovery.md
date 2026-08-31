# Discovery — Kaneo

- **run_id:** 20260831-042943-docs-board-features
- **mode:** first-time (full scan)
- **intent_hint:** docs
- **built_at:** 2026-08-31T04:29:43Z
- **plugin_version:** 0.6.0

## Git state

| Field | Value |
|---|---|
| HEAD | `5d1fc9104337786c3ef295ec0dc31656df371d8d` |
| Branch | `docs/opus-flash` |
| Dirty | yes — untracked only |
| Remote | `origin` → https://github.com/tl-ai-labs/kaneo.git |
| `.sdlc/` gitignored | **no** |

Untracked entries: `.claude/settings.local.json`, `.hook-logs/`, `.sdlc/`. No modified or staged tracked files, so the worktree is clean for rollback purposes.

## Directory topology

Top level: `.agents`, `.claude`, `.cursor`, `.devcontainer`, `.github`, `.husky`, `.turbo`, `.vscode`, `apps`, `charts`, `deploy`, `i18n`, `packages`, `plans`, `scripts`, `sentry`, `skills`, `tests`.

Entry points: `apps/api/src/index.ts`, `apps/web/src/main.tsx`.

## Detected stacks

Single language family (TypeScript/Node, ESM, Node >=20.19.0, TS 7.0.2, pnpm 10.32.1), four distinct app surfaces:

| Manifest | Stack | Frameworks |
|---|---|---|
| `package.json` | node-typescript | turborepo, pnpm-workspace |
| `apps/api/package.json` | node-typescript | hono, hono-openapi (Drizzle/Postgres, Better Auth, Valibot) |
| `apps/web/package.json` | node-typescript | react, vite, react-i18next, TanStack Router/Query |
| `apps/site/package.json` | node-typescript | next, react |
| `apps/docs/package.json` | mintlify-docs | mintlify (`docs.json`, 99 `.mdx`) |

## Monorepo

pnpm workspace (`packages/**`, `apps/**`) driven by Turborepo. Ten packages: `@kaneo/api`, `@kaneo/web`, `@kaneo/site`, `@kaneo/docs`, `@kaneo/email`, `@kaneo/libs`, `@kaneo/mcp`, `@kaneo/permissions`, `@kaneo/planka-import`, `@kaneo/typescript-config`.

No submodules. No git-LFS (`.gitattributes` only pins `.husky/*` to LF).

## Test / build commands

- Proposed: **`pnpm test`** (from `package.json#scripts.test` → `turbo test`; `pnpm-workspace.yaml` present).
- Per-package: `pnpm --filter <pkg> test`. Integration: `pnpm test:integration` (PostgreSQL-backed).
- **Caveat for this run:** the change target is `apps/docs`, which has no test script and no test coverage. `pnpm test` would prove nothing about a docs edit. The meaningful proof is Mintlify navigation integrity — every page listed in `apps/docs/docs.json` must exist on disk, and any new page must be added to the nav. Gate 0 should confirm whether to run `pnpm test` at all.

## Docs landscape (intent-specific)

**READMEs present:** `README.md` (root), `apps/docs/README.md`, `charts/kaneo/README.md`, `packages/mcp/README.md`, `packages/planka-import/README.md`, `plans/README.md`, `sentry/README.md`, `tests/api-integration/README.md`. There is **no** `apps/web/README`.

**Canonical location for user-facing feature docs is `apps/docs` (Mintlify), not the root README.**

- Root `README.md` is 179 lines and entirely install/deploy oriented: Why Kaneo, Sponsors, Getting Started, One-Click Deploy, Docker Compose, Development Setup, Configuration, Kubernetes, Development, MCP Server, Community, Contributing, License. It contains no per-feature reference sections. Adding a "Board features" section there would be the first of its kind and would sit oddly among deployment instructions.
- `apps/docs` carries the "Functional Guides" tab in `docs.json` with ten task-oriented pages, including `core/functional/plan-and-execute-tasks.mdx` ("Plan and execute tasks in Board/List") and `core/functional/backlog-planning.mdx`. This is where board behavior is documented today.
- `apps/docs/README.md` is Mintlify scaffolding, not product content.

**Existing coverage of the three named features:**

| Feature | In docs today? | In source today? |
|---|---|---|
| Filter chips | **Yes** — `plan-and-execute-tasks.mdx` §5 "Use filters to focus" lists Status, Priority, Assignee, Due date, Labels | **Yes** — `apps/web/src/components/board/board-toolbar.tsx`, `apps/web/src/hooks/use-task-filters.ts`, `use-task-filters-with-labels-support.ts` |
| WIP limits | No | **No** — zero hits for `wipLimit`, `columnLimit`, `maxTasks`, `capacity`, `overLimit` across `apps/` and `packages/`; no i18n keys |
| Hours rollup / estimated hours | No (only API reference for time entries) | **Partial** — per-task time tracking exists (`apps/api/src/time-entry/`, `timeEntryTable` with `duration` integer seconds, `apps/web/src/lib/format-duration.ts`). There is **no** `estimatedHours` field and **no** board- or column-level aggregation |

Greps across all `*.md`/`*.mdx`/`*.json` for `wip limit`, `estimated hours`, `hours rollup` returned nothing. "filter chip" appears only in `CHANGELOG.md` history (commits `c3bda60`, `e3f7f9d` — "persist board filters and polish linear-style filter chips"), never in user docs.


### Where the missing features actually live

The three features are not absent from the project — they are absent from **this branch**. Each was built on a sibling experiment branch, and none is merged into `main` or reachable from HEAD (`5d1fc910`):

| Feature | Branch family | Head commit | In HEAD? |
|---|---|---|---|
| WIP limits | `feature-extend-1/*` | `025fdb9f feat(board): add per-lane WIP limit with over-cap indicator` | no |
| Hours rollup | `feature-extend-2/*` | `33e24240 feat(task): add optional estimated hours with per-column rollup` | no |
| Filter chip persistence | `feature-extend-3/*` | `1830d493 feat(board): persist board filter state in the URL` | no |

`feature-extend-1/*` touches `apps/api/src/column/{index.ts,controllers/create-column.ts,controllers/update-column.ts}`; `feature-extend-2/*` touches `apps/api/src/database/schema.ts`, `apps/api/src/schemas.ts`, `apps/api/src/mcp/tools.ts`. Base filter chips already exist in HEAD and are already documented; the `feature-extend-3` work adds URL persistence on top of them.

`.sdlc/` also holds prior run directories for exactly these three efforts (`20260820-...-feature-extend-lane-wip-limit`, `20260824-...-feature-extend-estimated-hours`, `20260826-...-feature-extend-board-filter-chips`), though on this branch they contain only delegation caches.

**Consequence for the intent brief:** one of the three features is already documented, and two do not appear to exist in the codebase. See Repo-state risks below.

## Detected AI/agent setup

- `CLAUDE.md` (delegates to `AGENTS.md` via `@AGENTS.md`) and `AGENTS.md` — canonical project instructions.
- `.claude/settings.local.json` (untracked), `.claude/skills/` (11 skills).
- `.agents/skills/` and `skills/` — parallel mirrors of the same skill tree.
- `.cursor/rules/` — 7 `.mdc` files: `backend-api`, `cursor-rules`, `database-schema`, `deployment-devops`, `development-conventions`, `frontend-web`, `project-overview`.
- No `.mcp.json`, no repo-local `routing-policy.yaml`, no Aider/Continue/Roo/Copilot configs.

## Environment keys (names only — no values read)

Six env files. Flattened key set: `AUTH_SECRET`, `DATABASE_URL`, `DISABLE_GUEST_ACCESS`, `GITHUB_APP_ID`, `GITHUB_APP_NAME`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `GITHUB_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`, `KANEO_API_URL`, `KANEO_CLIENT_URL`, `NODE_ENV`, `POSTGRES_*`, `SMTP_*`, `VITE_API_URL`, `VITE_CLIENT_URL`, `VITE_SENTRY_DSN`, `VITE_TURNSTILE_SITE_KEY`.

`.env` and `.env.local` are real local files (not just samples) and are off-limits.

## Infrastructure

Dockerfiles: `Dockerfile.kaneo`, `apps/api/Dockerfile`, `apps/web/Dockerfile`. Helm chart at `charts/kaneo`. 13 GitHub Actions workflows including `ci.yml`, `docker.yml`, `release.yml`, `deploy-site.yml`. Husky hooks + commitlint (conventional commits) are active.

## Regulated-repo signals

- `SECURITY.md` (repo root)

`regulated_repo_warning_required: true`. Per the group 9 rule, `SECURITY.md` is an enumerated marker and a non-empty signal list sets the flag. This matches prior runs on commit `5d1fc910`. No `HIPAA`/`PCI`/`SOC2`/`GDPR`/`COMPLIANCE` files, no compliance directories, no CODEOWNERS.

## Coexistence risks

- **Cursor rules detected.** You have Cursor rules at `.cursor/rules` (7 `.mdc` files). The plugin will never touch them, but if you have Cursor's auto-lint running on save, changes we make may trigger it.
- **Claude Code project config detected.** `.claude/settings.local.json` and `.claude/skills/` stay untouched. Note `.claude/settings.local.json` is currently untracked.
- **Duplicate skill trees.** `.claude/skills/`, `.agents/skills/`, and `skills/` mirror each other. All three are off-limits; editing one without the others would desynchronize them.
- **`.sdlc/` not gitignored.** Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run.
- **Husky + commitlint.** Conventional-commit subjects are enforced by hook. If a commit is requested, use e.g. `docs: ...`.
- No `.mcp.json` and no repo-local `routing-policy.yaml` — nothing silently altering routing.

## Proposed off-limits

`.git/**`, `.env`, `.env.local`, `.env.sample`, `.env.*`, `apps/api/.env.test.example`, `apps/web/.env.development`, `apps/web/.env.production`, `.claude/**`, `.agents/**`, `skills/**`, `.cursor/**`, `CLAUDE.md`, `AGENTS.md`, `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.turbo/**`, `apps/docs/openapi.json` (generated), `CHANGELOG.md` (release tooling), `pnpm-lock.yaml`, `.hook-logs/**`.

## Repo-state risks for Gate 0

1. **Two of the three features are not on this branch.** WIP limits and estimated-hours rollup have no implementation reachable from HEAD. They exist on `feature-extend-1/*` and `feature-extend-2/*`, which are not merged. Documenting them against this worktree means writing docs whose described behavior cannot be verified in the checked-out code, and which will be wrong for anyone on `main`. Gate 0 must decide: (a) narrow scope to what ships in HEAD, (b) rebase/merge the feature branches first, or (c) accept that the docs describe unmerged work and gate the merge on those branches landing.
2. **Filter chips are already documented** in `apps/docs/core/functional/plan-and-execute-tasks.mdx` §5. The real work may be enriching that section rather than creating a new one.
3. **Target file ambiguity.** The brief says "a README", but the repo's canonical user-facing docs live in `apps/docs` (Mintlify), and the root README has no feature-reference precedent. Gate 0 must pick the target explicitly.
4. **Mintlify nav coupling.** Any new `.mdx` page must also be registered in `apps/docs/docs.json` under `navigation.tabs`, or it will not render. That makes `docs.json` a required member of the write allowlist if a new page is created.
5. **i18n rule does not apply here.** `AGENTS.md` requires static i18n keys for user-facing *web copy*; Mintlify docs are English-only content and are not routed through `i18n/en-US.json`.
6. Regulated-repo warning is active (see above).

## Tier 2b

Triggered — dominant stacks (Hono, React+Vite, Next.js, Mintlify) have no matching pre-authored adapter (shipped: `generic.md`, `nest.md`, `python.md`). Profile written to `.sdlc/baseline/stack-profile.md`.

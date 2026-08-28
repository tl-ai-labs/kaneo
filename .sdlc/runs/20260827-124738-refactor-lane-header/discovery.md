# Brownfield discovery — kaneo

- **run_id:** `20260827-124738-refactor-lane-header`
- **mode:** `first-time` (no `.sdlc/baseline/current.json` existed)
- **intent_hint:** `refactor`
- **scope:** Tier 1 local reads + Tier 2b adaptive stack profile (triggered)

---

## 1. Git state

| field | value |
|---|---|
| head | `5d1fc9104337786c3ef295ec0dc31656df371d8d` |
| branch | `refactor/flash-only` |
| dirty | **yes** (untracked only) |
| remote | `origin` → `https://github.com/tl-ai-labs/kaneo.git` |
| `.sdlc/` gitignored | **no** |

Untracked entries at scan time:

- `.claude/settings.local.json`
- `.hook-logs/`
- `.sdlc/`

No tracked file is modified or staged — the worktree is clean for rollback purposes, and `git reset --hard` / `git stash` anchors are safe. All three untracked paths are agent/tooling artifacts, not user work.

## 2. Directory topology

Top level: `apps/`, `packages/`, `tests/`, `charts/`, `deploy/`, `i18n/`, `scripts/`, `sentry/`, `plans/`, `skills/`, `.agents/`, `.claude/`, `.cursor/`, `.devcontainer/`, `.github/`, `.husky/`, `.turbo/`, `.vscode/`.

- `apps/` → `api`, `web`, `docs`, `site`
- `packages/` → `email`, `libs`, `mcp`, `permissions`, `planka-import`, `typescript-config`
- `tests/` → `api` (unit), `api-integration` (PostgreSQL-backed)

1578 tracked files — small enough for a full scan; no sampling fallback used.

## 3. Detected stacks

Single-language repo: **node-typescript** throughout (TypeScript 7.0.2, ESM, Node >= 20.19, pnpm 10.32.1).

| package | role | frameworks |
|---|---|---|
| root | workspace | turborepo, pnpm workspaces, biome, husky, commitlint |
| `@kaneo/api` | API | Hono, hono-openapi, Better Auth, Drizzle ORM, Valibot, pg, ioredis, MCP SDK, vitest, esbuild |
| `@kaneo/web` | UI | React, Vite, TanStack Router, TanStack Query, react-i18next, react-hook-form, react-use-websocket, vitest + jsdom |
| `@kaneo/site` | marketing | Next.js, React |
| `@kaneo/libs` | shared typed Hono client | — |
| `@kaneo/permissions` | permission vocabulary | Better Auth |
| `@kaneo/mcp` | published stdio MCP | MCP SDK, zod |
| `@kaneo/email` | templates | react-email |
| `@kaneo/planka-import` | CLI importer | — |
| `@kaneo/typescript-config` | tsconfig presets | — |

`apps/docs` has **no** `package.json` — it is Mintlify-style content (`docs.json`, `index.mdx`, `openapi.json`).

**No pre-authored adapter matches.** v1 ships `generic.md`, `nest.md`, `python.md`; this repo is Hono + React/Vite + Next. Tier 2b ran — see `.sdlc/baseline/stack-profile.md`.

## 4. Test / build commands

**Proposed:** `pnpm test` (from `package.json#scripts.test` → `turbo test`).

Caveat for Gate 0: `turbo.json` declares `test.dependsOn: ["^build"]`, so the root command triggers builds across the whole workspace. For a scoped web refactor the cheaper proof is:

| command | scope |
|---|---|
| `pnpm --filter @kaneo/web test` | web unit/component tests (vitest + jsdom, `src/**/*.test.{ts,tsx}`) |
| `pnpm --filter @kaneo/api test` | API unit tests |
| `pnpm test:integration` | PostgreSQL-backed integration suite |
| `pnpm typecheck` | turbo typecheck across workspace |

141 test files exist across the repo. `AGENTS.md` explicitly instructs: "use the smallest proof that covers the changed behavior, then broaden it when the blast radius requires it."

**Gate 0 must confirm which of these Phase 7 runs.**

## 5. Docs

`README.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, `ENVIRONMENT_SETUP.md`, `apps/docs/` (product + API docs), `plans/`.

No ADR directory (`docs/adr/`, `docs/decisions/`, `adr/`) exists.

`CLAUDE.md` is a two-line pointer that `@`-imports `AGENTS.md`. **`AGENTS.md` is the canonical operating guide** and carries hard boundaries downstream phases must respect: API is the authority for authz, Valibot + OpenAPI metadata must stay accurate, `publishEvent()` for realtime-affecting mutations, static i18n keys with `i18n/en-US.json` as source of truth, migrations generated via `db:generate` and inspected.

## 6. Detected AI / agent setup

| path | type |
|---|---|
| `CLAUDE.md` | claude instructions (imports AGENTS.md) |
| `AGENTS.md` | canonical agent guide |
| `.claude/` + `.claude/settings.local.json` + `.claude/skills/` | Claude Code project config |
| `.cursor/rules/` | Cursor — 7 `.mdc` rule files |
| `.agents/skills/` and `skills/` | agent skill packs (10 skills: animate, apple-design, coss, prototype, …) |
| `skills-lock.json` | skill pack lockfile |
| `.coderabbit.yaml` | CodeRabbit PR review bot |
| `.devcontainer/`, `.vscode/` | editor / container config |

Absent: `.mcp.json`, `.cursorrules`, `.aider.conf.*`, `.continue/`, `.github/copilot-instructions.md`, `.roo/`, repo-local `routing-policy.yaml`, `gemini*.{yaml,json}`.

## 7. Env keys (names only — no values read)

| file | keys |
|---|---|
| `.env` | KANEO_CLIENT_URL, KANEO_API_URL, AUTH_SECRET, DATABASE_URL, POSTGRES_DB/USER/PASSWORD/HOST/PORT |
| `.env.local` | POSTGRES_DB/USER/PASSWORD/HOST/PORT |
| `.env.sample` | + GITHUB_* (OAuth + App + webhook), SMTP_* |
| `apps/api/.env.test.example` | NODE_ENV, AUTH_SECRET, DATABASE_URL, KANEO_API_URL, KANEO_CLIENT_URL, DISABLE_GUEST_ACCESS |
| `apps/web/.env.development` | VITE_API_URL, VITE_CLIENT_URL |
| `apps/web/.env.production` | + VITE_TURNSTILE_SITE_KEY, VITE_SENTRY_DSN |

~100 distinct env names are referenced in source, spanning auth, OAuth providers (GitHub/Google/Discord/custom OIDC), Postgres, Redis (incl. cluster + sentinel), S3/AWS, SMTP, Sentry, Turnstile, Creem billing, and MCP. Full list in `baseline.json#env_keys_referenced_in_code`.

**No value side of any env file was read, recorded, or transmitted.**

## 8. Monorepo, submodules, LFS

- **Monorepo:** pnpm workspace (`packages/**`, `apps/**`) + Turborepo. 9 workspace packages.
- **Submodules:** none (`.gitmodules` absent).
- **Git-LFS:** none. `.gitattributes` contains a single rule: `.husky/* text eol=lf`.
- **Entry points:** `apps/api/src/index.ts`, `apps/web/src/main.tsx`, `apps/site/app/`, `packages/mcp/src/index.ts`, `packages/planka-import/src/index.ts`.
- **Data layer:** Drizzle ORM on PostgreSQL. Schema `apps/api/src/database/schema.ts`, relations `relations.ts`, ~43 generated migrations in `apps/api/drizzle/`.
- **Infra:** `Dockerfile.kaneo` + `apps/api/Dockerfile`, `compose.yml` / `compose.local.yml`, Helm chart `charts/kaneo/`, `deploy/`, 13 GitHub Actions workflows, Sentry, husky + commitlint, devcontainer. No Terraform / GitLab CI / CircleCI / Jenkins.

## 9. Regulated-repo signals

- `SECURITY.md` (security-policy)

`regulated_repo_warning_required: true`, but this is a **weak** signal — it is a standard OSS vulnerability-disclosure policy pointing at GitHub private advisories. No `PRIVACY.md` / `COMPLIANCE.md` / HIPAA / PCI / SOC2 / GDPR files or directories, and no `CODEOWNERS` at all (so no security/compliance/legal team entries).

Gate 0 should still print the confirmation prompt so the user consciously acknowledges it.

## Coexistence risks

- **Cursor rules detected** — You have Cursor rules at `.cursor/rules/` (7 `.mdc` files: backend-api, frontend-web, database-schema, deployment-devops, development-conventions, project-overview, cursor-rules). The plugin will never touch them, but if you have Cursor's auto-lint running on save, changes we make may trigger it.
- **No Aider config** — nothing to flag.
- **No custom `.mcp.json`** — no third-party MCP servers registered for this repo. Note that `apps/api/src/mcp/` and `packages/mcp/` implement MCP as *product features*; they are source code, not agent configuration, and our dispatcher will not call them.
- **No repo-local `routing-policy.yaml`** — the shipped policy applies. Pass `--policy <name>` to change it.
- **`.sdlc/` not gitignored** — Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (append, since it exists) to this run's allowlist so the plugin can add the entry as part of the run. `.hook-logs/` and `.claude/settings.local.json` are in the same position.
- **Biome `--write` lint scripts** — `AGENTS.md` warns that root and package `lint` scripts run Biome with `--write` and can modify unrelated files. Phase 7 should prefer a targeted `biome check` (no `--write`) over `pnpm lint`.
- **CodeRabbit bot** — `.coderabbit.yaml` present; automated review fires on pushed branches.
- **Husky + commitlint** — commits are rejected unless they follow conventional-commit format.
- **Turbo `test` depends on `^build`** — root `pnpm test` builds the whole workspace. Prefer `--filter` for scoped work.

## Proposed off-limits

```
.git/**
.env  .env.local  .env.sample  .env.*
apps/api/.env.test.example  apps/web/.env.development  apps/web/.env.production
CLAUDE.md  AGENTS.md
.claude/**  .cursor/**  .agents/**  skills/**  skills-lock.json
.coderabbit.yaml  .devcontainer/**  .vscode/**  .husky/**
node_modules/**  **/node_modules/**
dist/**  **/dist/**  build/**  .next/**  out/**  .source/**  .turbo/**  coverage/**
.hook-logs/**
apps/web/src/routeTree.gen.ts     # generated by @tanstack/router-plugin (@ts-nocheck)
apps/api/drizzle/**               # generated SQL — use `pnpm --filter @kaneo/api db:generate`
apps/docs/openapi.json            # generated by openapi:export
i18n/schema.json                  # generated by scripts/i18n/schema.mjs
pnpm-lock.yaml
charts/kaneo/**  deploy/**
```

## Allowlist hint for Gate 0

`intent_hint=refactor` and the existing brief `.sdlc/briefs/refactor-public-column-header.md` point at the board column header. Likely scope:

- `apps/web/src/components/kanban-board/column/**` (`index.tsx`, `column-header.tsx`, `column-dropzone.tsx`)
- `apps/web/src/components/public-project/**`
- `apps/web/src/components/board/**`
- `i18n/en-US.json` — source of truth for copy

Caution: other `i18n/*.json` locale files are maintained by `scripts/i18n/`. Confirm at Gate 0 whether they belong in scope or should be regenerated via `pnpm i18n:check:fix`.

## Notes

- Tier 1 completed comfortably inside the 30s timebox.
- Tier 2b **triggered** (no matching adapter) — see `.sdlc/baseline/stack-profile.md`.
- Pre-existing `.sdlc/` content from 4 earlier runs was found, but no `.sdlc/baseline/` — first-time discovery is correct.

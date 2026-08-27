# Brownfield discovery — Kaneo

- **run_id:** `20260827-043436-feature-extend-board-filter-chips`
- **mode:** first-time (no prior `.sdlc/baseline/current.json`)
- **scope:** Tier 1 full scan + Tier 2b adaptive stack profile (triggered)
- **intent hint:** feature-extend — assignee + label filter chips at the top of the Board view, with URL-persisted state (`apps/web`)
- **elapsed:** ~12s, inside timebox. No sampling fallback needed (1,578 tracked files).

---

## Git state

| field | value |
|---|---|
| head | `5d1fc9104337786c3ef295ec0dc31656df371d8d` |
| branch | `feature-extend-3/opus-only` |
| dirty | **yes — untracked only** |
| remote | `origin` → `https://github.com/tl-ai-labs/kaneo.git` |
| `.sdlc/` gitignored | **no** |

Untracked entries: `.claude/settings.local.json`, `.hook-logs/`, `.sdlc/`. **No tracked file is modified**, so `5d1fc910` is a clean rollback anchor for user source.

Prior `.sdlc/runs/` directories exist for the same intent slug (`20260826-064633-…`, `20260826-103235-…`). Worth confirming at Gate 0 that no partial work from those runs is sitting in the worktree.

## Topology

Monorepo, pnpm workspaces + Turborepo.

```
apps/      api  web  site  docs
packages/  email  libs  mcp  permissions  planka-import  typescript-config
tests/     api  api-integration        (source dirs, not workspace packages)
charts/kaneo   deploy/   i18n/   scripts/   sentry/   plans/   skills/
```

Entry points: `apps/web/src/main.tsx`, `apps/api/src/index.ts`, `apps/site/app/page.tsx`.

## Detected stacks

Every workspace is TypeScript/ESM on Node ≥ 20.19, pnpm 10.32.1.

| package | root | notable frameworks |
|---|---|---|
| `@kaneo/web` **(target)** | `apps/web` | React 19, Vite 8, TanStack Router + Query, Zustand, nanostores, Tailwind 4, Radix/Base UI, dnd-kit, TipTap, react-hook-form + zod, i18next, Vitest + Testing Library + jsdom |
| `@kaneo/api` | `apps/api` | Hono, hono-openapi, Better Auth, Drizzle ORM + pg, Valibot, ioredis, MCP SDK, Vitest |
| `@kaneo/site` | `apps/site` | Next.js, React, Tailwind |
| `@kaneo/libs` | `packages/libs` | typed Hono client |
| `@kaneo/permissions` | `packages/permissions` | Better Auth permission vocabulary |
| `@kaneo/email`, `@kaneo/mcp`, `@kaneo/planka-import`, `@kaneo/typescript-config` | `packages/*` | build/test utilities |
| docs content | `apps/docs` | MDX + `docs.json`; **no package.json**, not a workspace package |

Multi-package by design — no single stack was picked.

## Test / build commands

**Proposed for this run:** `pnpm --filter @kaneo/web test`
(source: `apps/web/package.json#scripts.test` → `vitest run --config vitest.config.ts`)

Repo-wide fallback: `pnpm test` (root `turbo test`) — the exact command the CI `test` job runs.

Other gates observed in `.github/workflows/ci.yml`: `pnpm exec biome ci .`, `pnpm typecheck`, `pnpm build`, `pnpm test:integration` (PostgreSQL-backed).

> **No suite was executed during discovery** — it is read-only. Whether the suite is currently green is **unknown**. Capture a pre-edit baseline before Phase 7 attributes any failure to this run.

## Docs present

`README.md`, `AGENTS.md`, `CLAUDE.md` (which just points at `AGENTS.md`), `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, `ENVIRONMENT_SETUP.md`, `apps/docs/**`, `tests/api-integration/README.md`, `plans/`.

No ADR directory exists.

`AGENTS.md` is the canonical operating guide and carries binding constraints — API-side authorization authority, Valibot validation, `requireWorkspacePermission`, fetchers in `apps/web/src/fetchers/`, static i18n keys with `i18n/en-US.json` as source of truth, and "do not commit, push, or open a pull request unless explicitly requested."

## Detected AI / agent setup

Presence only, no deep parsing.

- `.claude/` — project config, 13 skills, plus an **untracked** `.claude/settings.local.json`
- `CLAUDE.md`, `AGENTS.md`
- `.cursor/rules/` — 7 `.mdc` files (project-overview, backend-api, frontend-web, database-schema, development-conventions, deployment-devops, cursor-rules)
- `.agents/skills/` (10) and `skills/` (10) with `skills-lock.json` — a second, sync-managed skill tree
- `.coderabbit.yaml` — AI code review on PRs
- `.devcontainer/`

Absent: `.mcp.json`, `CLAUDE.local.md`, `.cursorrules`, aider, `.continue/`, `.roo/`, copilot instructions, gemini configs, and **no repo-local `routing-policy.yaml`**.

## Env keys (names only — no values were read)

Files: `.env`, `.env.local`, `.env.sample`, `apps/api/.env.test.example`, `apps/web/.env.development`, `apps/web/.env.production`.

30 distinct declared key names, spanning Postgres, `AUTH_SECRET`, GitHub App/OAuth, SMTP, and the Vite public vars. 98 distinct `process.env.*` names are referenced across source (S3, Sentry, Creem billing, Turnstile, custom OAuth, Discord, Google). Web-side `import.meta.env` usage: `VITE_API_URL`, `VITE_APP_URL`, `VITE_CLIENT_URL`, `VITE_SENTRY_DSN`, `VITE_TURNSTILE_SITE_KEY`, `DEV`, `MODE`.

`.env` and `.env.local` hold real local credentials but **are** gitignored. No encrypted-secret tooling is in use (no sops/age/git-crypt/vault artifacts).

## Monorepo, submodules, LFS

- **Monorepo:** pnpm workspaces (`packages/**`, `apps/**`) + Turborepo. Per-package tests via `pnpm --filter <name> test`.
- **Submodules:** none (`.gitmodules` absent).
- **Git-LFS:** none. `.gitattributes` exists but only forces LF on `.husky/*`.

## Infra

`Dockerfile.kaneo` + `apps/api/Dockerfile`, `compose.yml` / `compose.local.yml`, Helm chart at `charts/kaneo`, `deploy/kaneo-entrypoint.sh`, 13 GitHub Actions workflows, devcontainer. No Terraform, GitLab CI, CircleCI, or Jenkins.

## Regulated-repo signals

- `security-policy` → `SECURITY.md`

**Signal strength: weak.** This is a standard open-source security policy. There are no HIPAA/PCI/SOC2/GDPR/PRIVACY/COMPLIANCE documents, no compliance-named directories, and no CODEOWNERS file at all. The warning flag is set because the signal list is non-empty; treat it as a prompt to confirm scope, not as evidence of a compliance regime. That said, the product does hold self-hosted user data behind workspace authorization boundaries and the worktree contains live OAuth/SMTP/DB credentials, so off-limits still earns its keep.

## Coexistence risks

- **Cursor rules detected** — You have Cursor rules at `.cursor/rules/` (7 files). The plugin will never touch them, but if you have Cursor's auto-lint running on save, changes we make may trigger it.
- **Second agent-skill tree** — `.agents/skills/`, `skills/`, and `skills-lock.json` are managed by some sync tool. Untouched by default; if that tool runs mid-session it may rewrite those trees underneath us.
- **`.coderabbit.yaml` detected** — AI code review will comment on any PR this work produces. Not a conflict, just expect a second reviewer.
- **No custom `.mcp.json`** — no project-local MCP servers registered. The dispatcher uses our own bundled `model-dispatch` server.
- **No repo-local `routing-policy.yaml`** — policy resolution falls through to the shipped/global policy. Pass `--policy <name>` if you want something specific.
- **`.sdlc/` not gitignored** — Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (append) to this run's allowlist so the plugin can add the entry as part of the run. `.hook-logs/` is in the same position.
- **Heavy pre-commit hook** — `.husky/pre-commit` runs `pnpm exec biome ci .` followed by `pnpm run build` (full Turborepo build). Any commit will be slow and will hard-fail on a single formatting deviation. Run `pnpm exec biome check --write <changed files>` before committing.
- **`lint` scripts write** — root and package `lint` scripts are `biome check --write .` and can reformat unrelated files. `AGENTS.md` calls this out explicitly. Prefer targeted checks.
- **commitlint** — `commit-msg` enforces conventional commits (`feat(web): …`).

## Proposed off-limits

Never written by this run unless explicitly moved into scope at Gate 0:

```
.git/**                 .sdlc/**                .hook-logs/**
.env  .env.*  .env.local  .env.sample
apps/api/.env.test.example
apps/web/.env.development  apps/web/.env.production
.claude/**  CLAUDE.md  AGENTS.md
.cursor/**  .agents/**  skills/**  skills-lock.json
.coderabbit.yaml  .devcontainer/**  .husky/**  .github/workflows/**
node_modules/**  dist/**  build/**  .next/**  out/**  .turbo/**  coverage/**
pnpm-lock.yaml
apps/web/src/routeTree.gen.ts        (TanStack Router generated)
apps/api/drizzle/**                  (drizzle-kit generated SQL)
apps/api/auth-schema.ts              (Better Auth generated)
i18n/schema.json                     (generated by pnpm i18n:schema)
charts/**  deploy/**  sentry/**
```

Soft off-limits (out of scope for this intent, unlockable at Gate 0): `apps/api/**`, `apps/site/**`, `apps/docs/**`, `charts/**`.

## Likely in-scope files for this intent

Board filtering already exists — it is persisted to a **Zustand/localStorage** store, not the URL. The gap this run addresses is URL persistence plus chip UI.

- `apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx` — currently `validateSearch` only accepts `taskId`
- `apps/web/src/components/board/board-toolbar.tsx`
- `apps/web/src/hooks/use-task-filters.ts` — `BoardFilters` already has `assignee` and `labels` arrays
- `apps/web/src/hooks/use-task-filters-with-labels-support.ts`
- `apps/web/src/store/user-preferences.ts` — current persistence home
- `i18n/en-US.json` — static keys required for any new user-facing copy

## Tier 2b

**Triggered.** The target stack (React 19 + Vite + TanStack Router/Query) has no pre-authored adapter; shipped adapters are `generic.md`, `nest.md`, `python.md`, and the API here is Hono rather than Nest. Learned profile written to `.sdlc/baseline/stack-profile.md` — it is authoritative over `generic.md` where they disagree.

# Brownfield discovery — kaneo

- **run_id:** `20260827-085807-refactor-lane-header`
- **mode:** first-time (full Tier 1 scan)
- **intent hint:** refactor
- **plugin version:** 0.6.0
- **scan tier:** Tier 1 (cheap local reads) + Tier 2b adaptive stack profile

## Git state

| Field | Value |
|---|---|
| HEAD | `5d1fc9104337786c3ef295ec0dc31656df371d8d` |
| Branch | `refactor/opus-flash` (not `main`) |
| Dirty | **yes** — 3 untracked paths |
| Remote | `origin` → `https://github.com/tl-ai-labs/kaneo.git` |
| Tracked files | 1578 |
| `.gitignore` covers `.sdlc/` | **no** |

Untracked at scan time: `.claude/settings.local.json`, `.hook-logs/`, `.sdlc/`.
No tracked-file modifications — the worktree is clean apart from untracked tooling output, so a rollback anchor at HEAD is safe.

## Topology

Top level: `.agents`, `.claude`, `.cursor`, `.devcontainer`, `.github`, `.husky`, `.vscode`, `apps`, `charts`, `deploy`, `i18n`, `packages`, `plans`, `scripts`, `sentry`, `skills`, `tests`.

- Apps: `apps/api` (Hono), `apps/web` (React + Vite), `apps/site` (Next.js), `apps/docs` (Mintlify content, no package.json).
- Packages: `packages/{email,libs,mcp,permissions,planka-import,typescript-config}`.
- Tests live outside the packages they test: `tests/api` (unit) and `tests/api-integration` (PostgreSQL-backed).
- Entry points: `apps/api/src/index.ts`, `apps/web/src/main.tsx`.

## Detected stacks

Single language family — **TypeScript/Node** (`node >= 20.19`, `pnpm@10.32.1`, ESM), split by role:

| Package | Role | Frameworks |
|---|---|---|
| root | monorepo | turborepo, pnpm workspaces, biome, husky, commitlint |
| `@kaneo/api` | API | hono, hono-openapi, better-auth, drizzle-orm (pg), valibot, ioredis, vitest |
| `@kaneo/web` | UI | react, vite, tanstack-router, tanstack-react-query, tailwindcss, react-i18next, vitest |
| `@kaneo/site` | marketing site | next, react, tailwindcss |
| `@kaneo/libs` | shared typed Hono client | hono, vite, vitest |
| `@kaneo/permissions` | permission vocabulary | better-auth, vitest |
| `@kaneo/email` | transactional email | react-email, vitest |
| `@kaneo/mcp`, `@kaneo/planka-import` | published packages | vitest |
| `apps/docs` | Mintlify content | (no manifest) |

No non-JS stack manifests exist (no `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `Gemfile`, `composer.json`, `mix.exs`).

## Test / build commands

- **Proposed:** `pnpm test` — source: `package.json#scripts.test` → `turbo test`.
- Turbo's `test` task has `dependsOn: ["^build"]` and `cache: false`, so a cold root run also builds every dependency. That is slow for a single-surface change.
- Narrower proofs (preferred for a scoped refactor):
  - web: `pnpm --filter @kaneo/web test`
  - api: `pnpm --filter @kaneo/api test`
  - typecheck: `pnpm --filter <pkg> typecheck`
- Integration tests are a separate task and require PostgreSQL: `pnpm test:integration`.
- Test framework is **vitest** everywhere; web component tests use `@testing-library/react`.

Gate 0 must confirm which command counts as this run's proof.

## Docs present

`README.md`, `CLAUDE.md`, `AGENTS.md` (CLAUDE.md is a thin pointer that `@`-imports AGENTS.md — AGENTS.md is the real operating guide), `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `ENVIRONMENT_SETUP.md`, `CHANGELOG.md`, `apps/docs/README.md`. No ADR directory.

## Detected AI / agent setup

Present:

- `.claude/` — project config, `settings.local.json` (untracked), and `.claude/skills/` (11 skills)
- `CLAUDE.md` + `AGENTS.md` — canonical operating guide, checked in
- `.agents/skills/` and `skills/` — two more mirrored skill trees, plus `skills-lock.json` (vendored from external sources)
- `.cursor/rules/` — 7 `.mdc` rule files (`backend-api`, `cursor-rules`, `database-schema`, `deployment-devops`, `development-conventions`, `frontend-web`, `project-overview`)
- `.coderabbit.yaml` — CodeRabbit PR review bot config
- `.sdlc/` — prior MMO runs already exist (`20260820-…`, `20260824-…`, `20260826-…`) even though no `baseline/` had been written before this scan

Absent: `.mcp.json`, `.cursorrules`, `.aider.conf.*`, `.continue/`, `.roo/`, `.github/copilot-instructions.md`, `CLAUDE.local.md`, repo-local `routing-policy.yaml`, any `gemini*.{yaml,json}`.

## Coexistence risks

- **Cursor rules detected.** You have Cursor rules at `.cursor/rules/` (7 `.mdc` files). The plugin will never touch them, but if you have Cursor's auto-lint running on save, changes we make may trigger it. Their content also overlaps with `AGENTS.md`; if the two disagree, `AGENTS.md` is the checked-in canonical guide.
- **`.sdlc/` is not gitignored.** Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` to this run's allowlist so the plugin can append the entry as part of the run. Note `backups/<file>` echoes source content of touched files.
- **Husky pre-commit is heavy and mutating-adjacent.** `.husky/pre-commit` runs `pnpm exec biome ci .` followed by a full `pnpm run build`. Any commit made during or after a run is slow and will hard-fail if plugin-written files are not Biome-formatted. `.husky/commit-msg` enforces commitlint conventional commits.
- **Root `pnpm lint` rewrites files.** Per `AGENTS.md`, root and package `lint` scripts run Biome with `--write` and can modify unrelated files. Do not use `pnpm lint` as a verification step; prefer `biome ci` on changed paths.
- **Not on `main`.** Current branch is `refactor/opus-flash`. Rollback anchors and any commit will land there.
- **Generated files in source tree.** `apps/web/src/routeTree.gen.ts` is generated by the TanStack Router plugin and `i18n/schema.json` by `pnpm i18n:schema`. Editing them by hand will be overwritten.
- **No custom `.mcp.json`.** Nothing to conflict with the plugin's bundled dispatcher.
- **No repo-local `routing-policy.yaml`.** The shipped/CLI policy applies; nothing silently overrides routing.

## Regulated-repo signals

Only `SECURITY.md` (a standard OSS vulnerability-disclosure policy) matched. No `HIPAA/`, `PCI/`, `SOC2/`, `compliance/`, `regulated/`, `PRIVACY.md`, `GDPR.md`, or CODEOWNERS security/compliance entries. `regulated_repo_warning_required: false` — no Gate 0 regulated warning needed.

Independent of that flag: `AGENTS.md` states hard boundaries around workspace authorization and secret exposure, and the `.env` files hold live-looking local credentials. Off-limits covers them.

## Environment keys (names only — values never read)

- `.env` (9 keys), `.env.local` (5), `.env.sample` (19); 24 unique across files.
- 114 distinct `process.env.*` references in source, spanning auth/OAuth (`GITHUB_*`, `GOOGLE_*`, `DISCORD_*`, `CUSTOM_OAUTH_*`), storage (`S3_*`, `AWS_*`), Redis (`REDIS_*`), billing (`CREEM_*`, `BILLING_*`), SMTP, Sentry, and Kaneo feature flags (`DISABLE_*`, `DEMO_MODE`, `KANEO_*`).
- `.env` and `.env.local` are already gitignored. Full name lists are in `baseline.json`.

## Monorepo / submodules / LFS

- **Monorepo:** pnpm workspaces (`packages/**`, `apps/**`) + Turborepo. 9 workspace members.
- **Submodules:** none (`.gitmodules` absent).
- **Git LFS:** not in use. `.gitattributes` exists only to force LF endings on `.husky/*`.
- **Infra:** `Dockerfile.kaneo`, `compose.yml`, `compose.local.yml`, `charts/kaneo` (Helm), `deploy/`, `.devcontainer/`, 13 GitHub Actions workflows. No Terraform, GitLab CI, CircleCI, or Jenkins.

## Proposed off-limits

```
.git/**            .sdlc/**            .env             .env.*
.claude/**         .agents/**          skills/**        skills-lock.json
.cursor/**         .coderabbit.yaml    .husky/**
CLAUDE.md          AGENTS.md
node_modules/**    dist/**             build/**         .next/**
out/**             .source/**          .turbo/**        coverage/**
.hook-logs/**
pnpm-lock.yaml     apps/web/src/routeTree.gen.ts        i18n/schema.json
```

`CLAUDE.md`/`AGENTS.md` are listed as off-limits because they are the repo's own agent instructions; the user can move them into scope at Gate 0 if the run is meant to update guidance. `pnpm-lock.yaml` is off-limits so a dependency change must be an explicit, human-approved decision.

## Notes

Scan completed inside the Tier 1 budget. Repo is 1578 tracked files — no sampling fallback was needed. Tier 2b (adaptive stack profile) **was** triggered: the primary stacks are Hono and React/TanStack, and the shipped adapters are only `generic.md`, `nest.md`, `python.md`. See `.sdlc/baseline/stack-profile.md`; that profile is authoritative over `generic.md` where they disagree.

# Brownfield discovery — kaneo

- **Run ID:** `20260820-122044-precheck`
- **Mode:** `first-time` (full scan)
- **Built at:** 2026-08-20T12:20:44+00:00
- **Plugin version:** 0.6.0
- **Scan tier:** Tier 1 (full) + Tier 2b (adaptive stack profile — triggered)

Discovery completed cleanly. No read failures, no timebox overrun, no sampling fallback (1,578 tracked files).

---

## 1. Git state

| Field | Value |
|---|---|
| HEAD | `5d1fc9104337786c3ef295ec0dc31656df371d8d` |
| Branch | `feature-extend-1/gemini-only` |
| Dirty | yes — **untracked only** |
| Remote | `origin` → `https://github.com/tl-ai-labs/kaneo.git` |
| `.sdlc/` gitignored | **no** |

Untracked entries: `.claude/settings.local.json`, `.sdlc/`. No tracked file is modified, so HEAD is a clean rollback anchor for this run.

## 2. Topology

Top-level: `.agents`, `.claude`, `.cursor`, `.devcontainer`, `.husky`, `.turbo`, `.vscode`, `apps`, `charts`, `deploy`, `i18n`, `packages`, `plans`, `scripts`, `sentry`, `skills`, `tests`.

Entry points: `apps/api/src/index.ts`, `apps/web/src/main.tsx`, `packages/libs/src/index.ts`, `packages/mcp/src/index.ts`.

## 3. Detected stacks

Single language family — **TypeScript on Node ≥ 20.19**, ESM (`"type": "module"`), pnpm 10.32.1, TypeScript 7.0.2, Biome 2.5.7, `strict: true` from `packages/typescript-config/base.json`.

| Package | Root | Frameworks |
|---|---|---|
| `@kaneo/api` | `apps/api` | Hono, hono-openapi, Better Auth, Drizzle ORM, Valibot, `pg`, ioredis, MCP SDK, Sentry |
| `@kaneo/web` | `apps/web` | React, Vite, TanStack Router + Query, Radix, Tailwind, TipTap, dnd-kit, Sentry |
| `@kaneo/site` | `apps/site` | Next.js, React, Radix, Tailwind, Zustand |
| `@kaneo/email` | `packages/email` | react-email, nodemailer |
| `@kaneo/libs` | `packages/libs` | typed Hono RPC client |
| `@kaneo/mcp` | `packages/mcp` | MCP SDK, zod |
| `@kaneo/permissions` | `packages/permissions` | Better Auth access control |
| `@kaneo/planka-import` | `packages/planka-import` | — |
| `@kaneo/typescript-config` | `packages/typescript-config` | shared tsconfigs |

## 4. Test / build commands

**Proposed test command: `pnpm test`** (source: `package.json#scripts.test` → `turbo test`; pnpm selected from `pnpm-lock.yaml` + `pnpm-workspace.yaml`). Runner is **Vitest** across every package.

Narrower options for scoped verification:

- `pnpm --filter @kaneo/api test` — API unit tests (`vitest.config.ts`)
- `pnpm --filter @kaneo/api test:integration` — **requires a live PostgreSQL** (`vitest.integration.config.ts`)
- `pnpm --filter @kaneo/web test`
- `pnpm typecheck` — turbo-wide `tsc --noEmit`

Gate 0 must confirm the command. Two cautions worth raising there:

1. `pnpm test:integration` needs PostgreSQL; it will fail in a bare environment and that failure is environmental, not a regression.
2. `AGENTS.md` warns that root/package `lint` scripts run Biome with `--write` and can modify unrelated files. **Do not use `pnpm lint` as a verification step** — prefer `pnpm typecheck` plus targeted `biome check` without `--write`.

## 5. Docs present

`README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `SECURITY.md`, `ENVIRONMENT_SETUP.md`, `apps/docs/`, `plans/README.md`, `sentry/README.md`. No ADR directory.

`CLAUDE.md` is a thin pointer that `@`-includes `AGENTS.md`. **`AGENTS.md` is the binding convention document** — it specifies authorization boundaries, the "follow a change through" surface checklist, and verification depth. Downstream phases should treat it as a hard constraint source, and it is a read-only input, never a write target.

## 6. Detected AI / agent setup

| Path | Type |
|---|---|
| `CLAUDE.md` | Claude Code project instructions |
| `AGENTS.md` | agent guide (canonical conventions) |
| `.claude/` | Claude Code project config |
| `.claude/settings.local.json` | Claude Code local settings (untracked) |
| `.claude/skills/` | Claude Code skills (11 skills) |
| `.cursor/rules/` | Cursor rules — 7 `.mdc` files |
| `.agents/skills/` | agent skill tree |
| `skills/` | symlinks into `.agents/skills` |

Cursor rule files: `backend-api.mdc`, `cursor-rules.mdc`, `database-schema.mdc`, `deployment-devops.mdc`, `development-conventions.mdc`, `frontend-web.mdc`, `project-overview.mdc`.

Confirmed **absent**: `.mcp.json`, `.cursorrules`, `.aider.conf.y*ml`, `.continue/`, `.roo/`, `.github/copilot-instructions.md`, `CLAUDE.local.md`, any `gemini*.{yaml,json}`, and any repo-local `routing-policy.yaml`.

Note: `apps/api/src/mcp/` and `packages/mcp/` are **product features** (Kaneo ships an MCP server), not agent tooling config. They are ordinary source and are not off-limits.

## 7. Env keys (names only — no values read)

Only `.env.sample` exists at the repo root; there is no `.env`, `.env.local`, or `.env.example`. `.env` and `.env.local` are already gitignored.

`.env.sample` declares 20 keys: `KANEO_CLIENT_URL`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `AUTH_SECRET`, `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_APP_ID`, `GITHUB_WEBHOOK_SECRET`, `GITHUB_PRIVATE_KEY`, `GITHUB_APP_NAME`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_REQUIRE_TLS`.

Code references **97 distinct env names** — far more than the sample documents. Notable clusters not in `.env.sample`: `DATABASE_URL` / `POSTGRES_HOST` / `POSTGRES_PORT`, the `REDIS_*` family (URL, cluster, sentinel, TLS), `S3_*` + `AWS_*` storage, `SENTRY_*`, `CREEM_*` billing, `CUSTOM_OAUTH_*` / `DISCORD_*` / `GOOGLE_*` auth providers, `TURNSTILE_SECRET_KEY`, `NOTIFICATION_SECRET_ENCRYPTION_KEY`, `CORS_ORIGINS`, `TRUSTED_PROXIES`, and the `DISABLE_*` feature flags. The full list is in `baseline.json#env_keys_referenced_in_code`.

Per `ENVIRONMENT_SETUP.md` and `AGENTS.md`: server env comes from the root `.env`; Vite-only overrides go in `apps/web/.env.local`.

## 8. Monorepo, submodules, LFS

- **Monorepo:** pnpm workspace (`packages/**`, `apps/**`) orchestrated by Turborepo. Turbo tasks: `build`, `dev`, `lint`, `typecheck`, `test`, `test:integration`. `test` and `test:integration` are `cache: false`, so runs are always fresh.
- **Submodules:** none (`.gitmodules` absent).
- **Git LFS:** not in use — `.gitattributes` exists but has no `filter=lfs` / `diff=lfs` / `merge=lfs` entries.
- **Tests live outside the workspace:** `tests/api/` (unit, heavy `vi.mock` of `apps/api/src/*`) and `tests/api-integration/` (PostgreSQL-backed).

## 9. Infra

Dockerfiles: `Dockerfile.kaneo`, `apps/api/Dockerfile`, `apps/web/Dockerfile`. Helm chart at `charts/kaneo`. Deployment assets under `deploy/`. 13 GitHub Actions workflows (`ci.yml`, `docker.yml`, `helm-chart.yml`, `release.yml`, `nightly.yml`, publish workflows, notification workflows). Husky hooks + commitlint (conventional commits) are active — relevant if a later phase is asked to commit. Devcontainer present. No Terraform, GitLab CI, CircleCI, or Jenkins.

## 10. Regulated-repo signals

One low-strength hit: `SECURITY.md` at repo root. That is a standard open-source vulnerability-disclosure policy, not a compliance artifact. **No** HIPAA / SOC2 / PCI / GDPR files, no `compliance/` or `regulated/` directories, no CODEOWNERS naming security, compliance, privacy, or legal teams.

`regulated_repo_warning_required: false` — Gate 0 does not need to print the regulated-repo confirmation.

Independent of that flag, the repo does handle real secrets (OAuth client secrets, SMTP credentials, S3 keys, webhook signing secrets, an encryption key) and `AGENTS.md` makes non-leakage a hard boundary. The env-file off-limits entries below cover that.

## Coexistence risks

- **Cursor rules detected at `.cursor/rules` (7 `.mdc` files).** The plugin will never touch them, but if you have Cursor's auto-lint or format-on-save running, changes we make may trigger it.
- **Claude Code project config detected (`.claude/`, `.claude/settings.local.json`, `.claude/skills/`).** Untouched by default. `.claude/settings.local.json` is currently untracked.
- **Agent skill trees at `.agents/skills/` and `skills/`.** `skills/*` entries are symlinks into `.agents/skills`. Targets stay inside the repo; the plugin will not follow or write through them.
- **No custom `.mcp.json`.** Nothing to reconcile — the plugin uses its own bundled dispatch server. (`packages/mcp` and `apps/api/src/mcp` are Kaneo product code, not agent config.)
- **No repo-local `routing-policy.yaml`.** The plugin will use a shipped policy; pass `--policy <name>` to select a specific one.
- **`.sdlc/` is not gitignored.** Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A` — and `backups/<file>` can echo source content of files touched this run. Gate 0 will offer to add `.gitignore` (append) to this run's allowlist so the plugin can add the entry as part of the run.
- **Biome `--write` in lint scripts.** `AGENTS.md` explicitly warns that `pnpm lint` rewrites files repo-wide. Any verification phase should avoid it.
- **Husky + commitlint active.** Conventional-commit format is enforced by hook if a commit is ever requested.

## Proposed off-limits

Defaults for this run, confirmable at Gate 0:

```
.git/**            .sdlc/**            .husky/**
.env               .env.*              .env.sample
.claude/**         .cursor/**          .agents/**        skills/**
CLAUDE.md          AGENTS.md
node_modules/**    **/node_modules/**
dist/**            **/dist/**          build/**          **/build/**
.next/**           **/.next/**         .turbo/**         **/.turbo/**
out/**             coverage/**
pnpm-lock.yaml
apps/web/src/routeTree.gen.ts
apps/api/drizzle/**
i18n/schema.json
```

Rationale on the non-obvious ones:

- **`apps/api/drizzle/**`** — Drizzle-generated migration SQL. `AGENTS.md` requires migrations be produced by `pnpm --filter @kaneo/api db:generate` from a `schema.ts` change, then inspected. Never hand-edited. Schema edits belong in `apps/api/src/database/schema.ts` (editable).
- **`i18n/schema.json`** — generated by `pnpm i18n:schema`. Note that **`i18n/en-US.json` is editable** and is the source of truth for user-facing copy.
- **`apps/web/src/routeTree.gen.ts`** — generated by the TanStack Router Vite plugin.
- **`pnpm-lock.yaml`** — regenerate through pnpm, never hand-edit.
- **`CLAUDE.md` / `AGENTS.md`** — read-only convention inputs. Off-limits as write targets, but downstream phases should still read them.

## Stack profile (Tier 2b)

**Triggered.** The primary stack is Hono + Drizzle + Valibot on the API and TanStack React on the web; shipped adapters are only `generic.md`, `nest.md`, `python.md` — no match. A learned profile was sampled from real files and written to `.sdlc/baseline/stack-profile.md`. Where it disagrees with `generic.md`, the profile is authoritative.

## Deferred to Gate 0 (Tier 2)

1. Confirm the test command (`pnpm test` vs a filtered variant; integration tests need PostgreSQL).
2. Confirm the file-scope allowlist for the run.
3. Confirm the off-limits list above.
4. Decide whether to add `.gitignore` to the allowlist so `.sdlc/` can be ignored.

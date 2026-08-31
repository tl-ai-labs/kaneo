# Brownfield discovery — kaneo

- **Run:** `20260828-081120-refactor-lane-header`
- **Mode:** `first-time` (no `.sdlc/baseline/current.json` existed)
- **Intent hint:** `refactor`
- **Scan scope:** Tier 1 (cheap local reads) + Tier 2b adaptive stack profile
- **Plugin version:** 0.6.0

## Git state

| Field | Value |
| --- | --- |
| HEAD | `5d1fc9104337786c3ef295ec0dc31656df371d8d` |
| Branch | `refactor/opus-sonnet` |
| Dirty | **yes** — untracked only |
| Untracked | `.claude/settings.local.json`, `.hook-logs/`, `.sdlc/` |
| Tracked modifications | none |
| Remote | `origin` → `https://github.com/tl-ai-labs/kaneo.git` |
| `.gitignore` covers `.sdlc/` | **no** |
| Tracked files | 1578 |

The worktree is clean in the sense that matters for rollback: **no tracked file is modified**, so `5d1fc910` is a sound rollback anchor. The three untracked entries are all tooling side-effects, not product code.

This is the **fourth** discovery run recorded against this exact commit. Prior run directories present under `.sdlc/runs/`: `20260820-123148-feature-extend-lane-wip-limit`, `20260824-124116-feature-extend-estimated-hours`, `20260826-103235-feature-extend-board-filter-chips`, `20260827-124738-refactor-lane-header`, `20260828-050440-refactor-lane-header`. No `baseline/current.json` existed, so `first-time` is correct and a full scan was performed.

## Topology

Top-level: `apps/`, `packages/`, `tests/`, `charts/`, `deploy/`, `i18n/`, `scripts/`, `sentry/`, `plans/`, `skills/`, plus tooling dirs (`.agents/`, `.claude/`, `.cursor/`, `.devcontainer/`, `.husky/`, `.turbo/`, `.vscode/`).

Entry points found: `apps/api/src/index.ts`, `apps/web/src/main.tsx`, `packages/libs/src/index.ts`, `packages/mcp/src/index.ts`, `packages/permissions/src/index.ts`.

## Detected stacks

Single language family — **TypeScript on Node ≥ 20.19**, pnpm 10.32.1, Turborepo.

| Package | Root | Role | Notable frameworks |
| --- | --- | --- | --- |
| `kaneo` (root) | `.` | workspace root | turborepo, pnpm workspace, biome, husky, commitlint |
| `@kaneo/api` | `apps/api` | API | **Hono**, hono-openapi, Better Auth, **Drizzle ORM** + `pg`, **Valibot**, ioredis, MCP SDK, Sentry, vitest |
| `@kaneo/web` | `apps/web` | Web UI | **React + Vite**, TanStack Router/Query, Tailwind, Radix, dnd-kit, TipTap, i18next, zustand, immer, vitest + Testing Library |
| `@kaneo/site` | `apps/site` | marketing site | **Next.js**, React, Tailwind, shadcn |
| `@kaneo/libs` | `packages/libs` | shared typed Hono client | hono client, vitest |
| `@kaneo/permissions` | `packages/permissions` | permission vocabulary | better-auth, vitest |
| `@kaneo/mcp` | `packages/mcp` | published stdio MCP | MCP SDK, zod, vitest |
| `@kaneo/email` | `packages/email` | email templates | react-email, nodemailer, vitest |
| `@kaneo/planka-import` | `packages/planka-import` | CLI importer | vitest |
| `@kaneo/typescript-config` | `packages/typescript-config` | shared tsconfig | — |

`apps/docs` has **no** `package.json` — it is Mintlify-style content (`docs.json` + `.mdx`), not a workspace package.

## Monorepo, submodules, LFS

- **Monorepo:** yes — `pnpm-workspace.yaml` (globs `packages/**`, `apps/**`) plus `turbo.json`. Root `pnpm-workspace.yaml` also pins a large `overrides` block; treat it as security-sensitive and off-scope unless the task is explicitly about dependency pinning.
- **Submodules:** none (`.gitmodules` absent).
- **Git-LFS:** none (`.gitattributes` has no `filter=lfs`).

## Test / build / run

- **Proposed test command: `pnpm test`** (source: `package.json#scripts.test` → `turbo test`; `packageManager` is `pnpm@10.32.1`).
- Turbo's `test` task declares `dependsOn: ["^build"]` and `cache: false`, so the root command is the broad, slow proof.
- Narrower proofs, per `AGENTS.md`'s "smallest proof that covers the changed behavior" rule:
  - `pnpm --filter @kaneo/web test` — vitest + Testing Library (the right default for a lane/column-header refactor)
  - `pnpm --filter @kaneo/api test` — vitest unit
  - `pnpm test:integration` — PostgreSQL-backed, `tests/api-integration`
- Also available: `pnpm typecheck`, `pnpm lint` (**Biome with `--write`** — mutates files, see coexistence risks).

**Gate 0 must confirm the test command.** Recommendation: `pnpm --filter @kaneo/web test` for the narrow loop, `pnpm test` before finishing.

## Docs present

`README.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `ENVIRONMENT_SETUP.md`, `apps/docs/README.md`, `apps/docs/index.mdx`. No ADR directory.

`CLAUDE.md` is a two-line pointer that `@`-imports `AGENTS.md`; **`AGENTS.md` is the canonical operating guide** and encodes binding rules (thin Hono handlers, Valibot validation, `requireWorkspacePermission`, `publishEvent()`, fetchers under `apps/web/src/fetchers/`, TanStack Query for server state, static i18n keys with `i18n/en-US.json` as source of truth, migrations via `pnpm --filter @kaneo/api db:generate`, no commits/PRs unless explicitly requested).

## Detected AI/agent setup

| Path | Type |
| --- | --- |
| `.claude/` | Claude Code project config |
| `.claude/settings.local.json` | local settings (untracked) |
| `.claude/skills/` | 11 skills (animation/design oriented) |
| `CLAUDE.md` | Claude instructions (pointer to AGENTS.md) |
| `AGENTS.md` | canonical agent guide |
| `.agents/`, `.agents/skills/` | mirror of `.claude/skills/` |
| `.cursor/`, `.cursor/rules/` | 7 Cursor `.mdc` rule files |
| `skills/` | repo-level skills dir |

Absent: `.mcp.json`, `.cursorrules`, `.aider*`, `.continue/`, `.github/copilot-instructions.md`, `.roo/`, `routing-policy.yaml`, `gemini*.{yaml,json}`, `CLAUDE.local.md`.

## Env keys (names only — no values read or recorded)

- `.env` → `AUTH_SECRET`, `DATABASE_URL`, `KANEO_API_URL`, `KANEO_CLIENT_URL`, `POSTGRES_{DB,HOST,PASSWORD,PORT,USER}`
- `.env.local` → `POSTGRES_{DB,HOST,PASSWORD,PORT,USER}`
- `.env.sample` → `AUTH_SECRET`, `GITHUB_*` (app/oauth/webhook), `KANEO_CLIENT_URL`, `POSTGRES_*`, `SMTP_*`

**98 distinct `process.env.*` names** referenced across source, spanning auth, OAuth providers, billing (Creem), S3, Redis (incl. sentinel/cluster), SMTP, Sentry, and feature flags. Plus 7 Vite client-side names (`VITE_API_URL`, `VITE_APP_URL`, `VITE_CLIENT_URL`, `VITE_SENTRY_DSN`, `VITE_TURNSTILE_SITE_KEY`, `DEV`, `MODE`).

Note the real `.env` carries live-looking values for a Postgres instance. `AGENTS.md` is explicit: never use production databases or credentials for development or tests.

## Infra hints

`Dockerfile.kaneo`, `deploy/kaneo-entrypoint.sh`, `charts/kaneo` (Helm), 13 GitHub Actions workflows (`ci.yml`, `nightly.yml`, `release.yml`, `docker.yml`, `helm-chart.yml`, publish workflows, automation). No docker-compose at root, no Terraform, no GitLab/CircleCI/Jenkins. `.devcontainer/` and Husky hooks present.

## Regulated-repo signals

**Verdict: `regulated_repo_warning_required: true`.**

| Kind | Path |
| --- | --- |
| `SECURITY.md` | `SECURITY.md` |

Applying group 9 as written: `SECURITY.md` at repo root is an enumerated marker, the signals list is therefore non-empty, and a non-empty list sets the flag. The flag follows mechanically. Suppressing it would require an unwritten "is this repo *really* regulated?" judgment that the rule does not authorize — which is what run 1's `false` verdict silently did. Runs 2 and 3 were right.

For the human at Gate 0, the honest context: this is the **only** signal. No `PRIVACY.md`, `COMPLIANCE.md`, `HIPAA.md`, `SOC2.md`, `PCI.md`, or `GDPR.md`; no `HIPAA/`, `PCI/`, `SOC2/`, `regulated/`, or `compliance/` directories; no `CODEOWNERS` at all, so no security/compliance/legal team routing. `SECURITY.md`'s content is an ordinary open-source vulnerability-disclosure policy (private reporting via GitHub advisories, maintainer email), not a statement of compliance obligation. The warning is non-blocking; the user can read it and move on.

Gate 0 must print verbatim:

> *"This repo appears regulated (signals: `SECURITY.md`). Confirm the active policy uses only compliant endpoints, and that off-limits protects your regulated data folders."*

## Coexistence risks

- **Cursor rules detected.** You have Cursor rules at `.cursor/rules/` (7 `.mdc` files covering project overview, backend API, frontend web, database schema, development conventions, deployment). The plugin will never touch them, but if you have Cursor's auto-lint running on save, changes we make may trigger it.
- **Two parallel agent-instruction surfaces.** `.claude/skills/` and `.agents/skills/` mirror each other (11 vs 10 skills). Both are untouched by default; be aware that guidance may come from either.
- **`AGENTS.md` is binding and canonical.** `CLAUDE.md` merely imports it. Downstream phases must treat its conventions as constraints, not suggestions — especially "do not mix requested work with speculative features or broad refactors" and "do not commit, push, or open a pull request unless explicitly requested."
- **No custom `.mcp.json`.** No editor-registered MCP servers for this repo, so no dispatcher ambiguity. (`packages/mcp` is a *published product* MCP package, not an editor config — do not confuse the two.)
- **No repo-local `routing-policy.yaml`.** Plugin policy resolution is unaffected; the shipped/selected policy applies.
- **`.sdlc/` is not gitignored.** Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run. **This matters more than usual here:** five prior run directories already sit untracked under `.sdlc/`, and `backups/<file>` may echo source content.
- **`lint` mutates files.** Root and package `lint` scripts run Biome with `--write` and can modify unrelated files. Prefer targeted checks while iterating and inspect formatter changes before any commit.
- **Husky + commitlint active.** Any commit path must satisfy conventional-commit format.

## Proposed off-limits

```
.git/**              .sdlc/**
.env  .env.*  .env.local  .env.sample
.claude/**  CLAUDE.md  AGENTS.md  .agents/**  .cursor/**  skills/**
node_modules/**  **/node_modules/**
dist/**  **/dist/**  build/**  **/build/**  .next/**  **/.next/**
.turbo/**  .hook-logs/**
pnpm-lock.yaml
apps/web/src/routeTree.gen.ts
apps/api/src/migrations/**
```

Rationale for the two non-obvious entries:
- `apps/web/src/routeTree.gen.ts` — TanStack Router generated output; never hand-edit.
- `apps/api/src/migrations/**` — drizzle-kit generated; `AGENTS.md` requires generating via `pnpm --filter @kaneo/api db:generate` and inspecting the SQL, not hand-authoring.

The user may move any of these into scope at Gate 0. Given `intent_hint: refactor` on a lane header, the expected write scope is `apps/web/src/components/kanban-board/**` and possibly `i18n/en-US.json`.

## Tier 2b — adaptive stack profile

**Triggered.** The dominant stacks are Hono (`apps/api`) and React + Vite (`apps/web`); the shipped adapters are only `generic.md`, `nest.md`, `python.md`. No pre-authored adapter matches, so the repo was sampled directly. Profile written to `.sdlc/baseline/stack-profile.md` — it is **authoritative** over any generic adapter where the two disagree.

## Scan notes

- Tier 1 completed inside the timebox; 1578 tracked files, no sampling fallback needed.
- No non-UTF8 read failures.
- Env files read for key names only. No values were recorded or transmitted.

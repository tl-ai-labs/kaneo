# Brownfield discovery — kaneo

- **Run:** `20260903-125223-feature-extend-task-estimated-hours`
- **Mode:** first-time (no prior `.sdlc/baseline/`)
- **Built:** 2026-09-03T12:55:00Z
- **Plugin:** mmo 0.6.0
- **Scan tier:** Tier 1 (local reads) + Tier 2b adaptive stack profile + a one-off baseline test run

---

## 1. Git state

| Field | Value |
|---|---|
| HEAD | `5d1fc9104337786c3ef295ec0dc31656df371d8d` |
| Branch | `feature-extend-2/opus-flash-sdk` |
| Upstream | none (branch not pushed) |
| Remote | `origin` → `https://github.com/tl-ai-labs/kaneo.git` |
| Dirty | **yes**, but only `.sdlc/`, `.claude/`, `.hook-logs/` |
| `.gitignore` covers `.sdlc/` | **no** |

Dirty worktree detail — **no tracked source file is modified**:

- staged: `.sdlc/policies/opus-flash-sdk.yaml`
- untracked: `.claude/settings.local.json`, `.hook-logs/`, `.sdlc/local/`, `.sdlc/pre-check-status.json`, `.sdlc/project.json`, `.sdlc/runs/`

HEAD is identical to the `main` tip, so this branch carries **zero source commits**. That makes
`5d1fc910` a clean rollback anchor.

> **Branch warning carried forward from the caller and confirmed by inspection:** the sibling branch
> `feature-extend-1/opus-flash-sdk` contains a completed WIP-limit feature and a committed `.sdlc/`
> tree. **None of it is present here.** Latest migration on this branch is
> `apps/api/drizzle/0042_previous_the_executioner.sql`.

### Git hooks — these matter

- `.husky/pre-commit` → `set -e; pnpm exec biome ci .; pnpm run build`
- `.husky/commit-msg` → `pnpm exec commitlint --edit "$1"`

Any commit during this run triggers a **full Turborepo build** plus a repo-wide read-only Biome
check, and requires a **conventional-commits** subject line.

---

## 2. Directory topology

```
.agents/  .claude/  .cursor/  .devcontainer/  .github/  .husky/  .vscode/
apps/     charts/   deploy/   i18n/  packages/  plans/  scripts/  sentry/
skills/   tests/
```

1,579 tracked files. Entry points: `apps/api/src/index.ts`, `apps/web/src/main.tsx`.

---

## 3. Detected stacks

Single-language repo (TypeScript on Node ≥ 20.19), multiple runtimes.

| Manifest | Role | Frameworks |
|---|---|---|
| `package.json` | workspace root | Turborepo, pnpm workspaces, Biome, Husky, commitlint |
| `apps/api/package.json` | API | Hono, hono-openapi, Drizzle ORM + drizzle-kit, Better Auth, Valibot, `pg`, ioredis, MCP SDK, Sentry, Vitest |
| `apps/web/package.json` | Web | React, Vite, TanStack Router + Query, Radix/base-ui, Tailwind, dnd-kit, TipTap, react-i18next, Zustand, Vitest + Testing Library + jsdom |
| `apps/site/package.json` | marketing site | Next.js |
| `packages/libs` | shared typed Hono client | — |
| `packages/permissions` | permission vocabulary | — |
| `packages/mcp` | published stdio MCP | MCP SDK |
| `packages/email` | email templates | react-email |
| `packages/planka-import` | import CLI | — |
| `packages/typescript-config` | tsconfig presets | — |

`apps/docs` is MDX content with no `package.json`.

**No pre-authored adapter matches** (we ship `generic.md`, `nest.md`, `python.md`), so Tier 2b ran —
see `.sdlc/baseline/stack-profile.md`.

---

## 4. Test / build / lint commands

**Proposed verification command:**

```
pnpm --filter @kaneo/api test && pnpm --filter @kaneo/web test
```

Source: `apps/api/package.json#scripts.test` + `apps/web/package.json#scripts.test`.

Notes:

- Root `pnpm test` is `turbo test` with `dependsOn: ["^build"]` — it rebuilds every workspace
  package. Do not use it for iteration.
- **API unit tests live at repo root under `tests/api/**`, not inside `apps/api`.**
  `apps/api/vitest.config.ts` sets `include: ["../../tests/api/**/*.test.ts"]`. Test files import
  source through relative paths like `../../../apps/api/src/...`.
- Web tests live in `apps/web/src/**/*.test.{ts,tsx}`.
- Integration tests (`tests/api-integration/**`, `pnpm --filter @kaneo/api test:integration`) need a
  live PostgreSQL and were **not** run.
- Typecheck: `pnpm --filter @kaneo/api typecheck && pnpm --filter @kaneo/web typecheck`.
- **Read-only lint is `pnpm exec biome ci .`.** Every package `lint` script is `biome check --write .`
  and will rewrite files, including unrelated ones.

### Baseline test run (executed during discovery)

| Suite | Result |
|---|---|
| `pnpm --filter @kaneo/api test` | **PASS** — 58 files, 374 tests, 0 failures, 7.59s |
| `pnpm --filter @kaneo/web test` | **PASS** — 36 files, 112 tests, 0 failures, 24.33s |
| integration | not run (needs PostgreSQL) |

**The baseline is green.** Any failure after this point is attributable to the run.

---

## 5. Docs

`README.md`, `AGENTS.md` (canonical), `CLAUDE.md` (thin pointer that `@`-imports `AGENTS.md`),
`CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, `ENVIRONMENT_SETUP.md`,
`apps/docs/` (MDX product + API docs), `plans/` (7 motion/UX design plans + README).

No ADR directory.

---

## 6. Detected AI / agent setup

| Path | Type | Note |
|---|---|---|
| `.claude/` | Claude Code project dir | |
| `.claude/settings.local.json` | local settings, untracked | sets `MMO_SELECT=gemini-flash=flash-agsdk-worker` |
| `.claude/skills/` | 10 skills | mirrors `skills/` and `.agents/skills/` |
| `CLAUDE.md` | Claude instructions | pointer to `AGENTS.md` |
| `AGENTS.md` | canonical agent guide | |
| `.agents/skills/` | agent skills | |
| `skills/` + `skills-lock.json` | vendored skills | pinned to upstream GitHub sources by hash |
| `.cursor/rules/` | Cursor | 7 `.mdc` files: `backend-api`, `cursor-rules`, `database-schema`, `deployment-devops`, `development-conventions`, `frontend-web`, `project-overview` |
| `.coderabbit.yaml` | CodeRabbit AI review | `auto_review` enabled on PRs |
| `.sdlc/policies/opus-flash-sdk.yaml` | MMO repo-local policy | git-staged, uncommitted |

**Absent:** `.mcp.json`, `.cursorrules`, `.aider.conf.*`, `.continue/`,
`.github/copilot-instructions.md`, `.roo/`, `CLAUDE.local.md`, `routing-policy.yaml`.

The `apps/api/src/mcp/` and `packages/mcp/` trees are Kaneo **product** code (Kaneo ships an MCP
server), not agent tooling configuration.

---

## 7. Env keys (names only — no values were read)

- `.env` — `AUTH_SECRET`, `DATABASE_URL`, `KANEO_API_URL`, `KANEO_CLIENT_URL`, `POSTGRES_*`
- `.env.local` — `POSTGRES_*`
- `.env.sample` — adds `GITHUB_*` (app + OAuth + webhook) and `SMTP_*`

86 distinct env names are referenced in code (`process.env.*` and `import.meta.env.VITE_*`),
including Redis, S3, Sentry, Creem billing, Turnstile, and custom-OAuth families. Full list is in
`baseline.json#env_keys_referenced_in_code`. **No value side was read, recorded, or transmitted.**

`.env` and `.env.local` are plaintext but **are** covered by `.gitignore`. No `apps/web/.env.local`.

---

## 8. Monorepo, submodules, LFS, secrets

- **Monorepo:** pnpm workspaces (`packages/**`, `apps/**`) + Turborepo. pnpm 10.32.1, Node ≥ 20.19.
- **Submodules:** none (`.gitmodules` absent).
- **Git-LFS:** not in use. `.gitattributes` contains only `.husky/* text eol=lf`.
- **Encrypted secrets:** none detected — no sops, age, git-crypt, ansible-vault, or `.gpg` artifacts.

### Infra

`Dockerfile.kaneo`; `compose.yml` + `compose.local.yml`; Helm chart at `charts/kaneo`; 13 GitHub
Actions workflows. No Terraform, GitLab CI, CircleCI, or Jenkins.

### Generated / derived paths

`apps/web/src/routeTree.gen.ts` (TanStack Router), `apps/api/drizzle/**` (drizzle-kit migrations —
generated but hand-inspected and committed per `AGENTS.md`), `i18n/schema.json`, `pnpm-lock.yaml`.

---

## 9. Regulated-repo signals

Only `SECURITY.md` (a standard OSS vulnerability-disclosure policy). No HIPAA/PCI/SOC2/GDPR
documents, no `compliance/` or `regulated/` directories, no CODEOWNERS. **No regulated-repo warning
is required at Gate 0.**

---

## 10. Coexistence risks

- **Cursor rules detected at `.cursor/rules/` (7 `.mdc` files).** The plugin will never touch them.
  `backend-api.mdc`, `frontend-web.mdc` and `database-schema.mdc` restate much of `AGENTS.md`; where
  the two drift, `AGENTS.md` is canonical. If Cursor auto-lint-on-save is running, our edits may
  trigger it.
- **No `.mcp.json`,** so no third-party MCP servers compete with the bundled dispatcher.
- **No Aider config,** so no auto-commit hazard from that direction.
- **`.sdlc/` is not gitignored.** Run artifacts under `.sdlc/` — `packets.json`, `changes.md`, and
  `backups/<file>` (which echo source content of files touched this run) — will be untracked but
  visible to `git add -A`, and a distracted commit could push them. Gate 0 should offer to add
  `.gitignore` to this run's allowlist so the plugin can append a `.sdlc/` entry.
- **`.husky/pre-commit` runs `pnpm exec biome ci .` then `pnpm run build`.** A commit made during
  this run will be slow and will hard-fail on one formatting deviation. Format with Biome before any
  commit is attempted.
- **`.husky/commit-msg` runs commitlint (`config-conventional`).** Commit subjects must be
  conventional-commits.
- **`.coderabbit.yaml` enables automatic AI review on PRs** — not a local execution risk, but a
  pushed branch will attract an automated reviewer.
- **A repo-local MMO policy `.sdlc/policies/opus-flash-sdk.yaml` is staged but uncommitted.** Confirm
  it is the intended active policy.

---

## 11. Proposed off-limits

```
.git/**
.env  .env.*  .env.local  .env.sample
.claude/**  .cursor/**  .agents/**  skills/**  skills-lock.json  .coderabbit.yaml
.sdlc/policies/**
node_modules/**  dist/**  build/**  .next/**  .turbo/**  .hook-logs/**  coverage/**
pnpm-lock.yaml
apps/web/src/routeTree.gen.ts
apps/site/**  charts/**  deploy/**  sentry/**  .husky/**  .github/**
```

`apps/api/drizzle/**` is deliberately **not** off-limits: `AGENTS.md` requires a generated migration
to accompany any schema change. It should be write-allowed but generated via
`pnpm --filter @kaneo/api db:generate` and then inspected, never hand-authored.

---

## 12. Scan notes

Whole Tier 1 scan completed well inside the timebox. Nothing was sampled or truncated. The two
baseline test suites were run deliberately and account for most of the wall-clock time; they are not
part of the Tier 1 budget.

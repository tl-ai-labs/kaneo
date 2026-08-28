# Brownfield discovery — Kaneo

- **Run:** `20260828-050440-refactor-lane-header`
- **Mode:** `first-time` (no `.sdlc/baseline/current.json` existed)
- **Intent hint:** `refactor`
- **Built at:** 2026-08-28T05:06:43Z
- **Plugin version:** 0.6.0
- **Scan scope:** Tier 1 (full) + Tier 2b adaptive stack profile

---

## 1. Git state

| Field | Value |
|---|---|
| HEAD | `5d1fc9104337786c3ef295ec0dc31656df371d8d` |
| Branch | `refactor/opus-only` |
| Dirty | **yes — untracked only** |
| Remote | `origin` → `https://github.com/tl-ai-labs/kaneo.git` |
| `.sdlc/` gitignored | **no** |

Untracked entries: `.claude/settings.local.json`, `.hook-logs/`, `.sdlc/`.

No tracked file is modified, staged, or deleted. The rollback anchor at `5d1fc910`
is clean, so a `git checkout`-based revert of plugin edits will not destroy
pre-existing work. The three untracked paths are all tool/agent scratch, not
source.

## 2. Topology

Top level: `apps/`, `packages/`, `tests/`, `charts/`, `deploy/`, `i18n/`,
`scripts/`, `sentry/`, `plans/`, plus tooling dirs (`.claude`, `.cursor`,
`.agents`, `skills`, `.husky`, `.devcontainer`, `.vscode`, `.turbo`).

Entry points: `apps/api/src/index.ts`, `apps/web/src/main.tsx`,
`apps/site/app/`, `packages/mcp/src/index.ts`.

Repo is modest — 1,578 tracked files. No sampling fallback needed.

## 3. Detected stacks

Single-language repo (TypeScript / Node ≥ 20.19), many packages.

| Package | Role | Notable frameworks |
|---|---|---|
| root | monorepo | turborepo, pnpm workspace, biome, husky, commitlint |
| `@kaneo/api` (`apps/api`) | API | Hono, hono-openapi, Better Auth, Drizzle ORM, Valibot, pg, ioredis, MCP SDK, Sentry |
| `@kaneo/web` (`apps/web`) | UI | React, Vite, TanStack Router + Query, Tailwind, Radix/Base UI, dnd-kit, TipTap, zustand, react-i18next |
| `@kaneo/site` (`apps/site`) | marketing/docs host | Next.js, React, Tailwind |
| `@kaneo/libs` | shared typed Hono client | — |
| `@kaneo/permissions` | permission vocabulary | better-auth |
| `@kaneo/mcp` | published stdio MCP | MCP SDK, zod |
| `@kaneo/email` | email templates | react-email, nodemailer |
| `@kaneo/planka-import` | import CLI | — |
| `@kaneo/typescript-config` | shared tsconfig | — |

`apps/docs` is content only (no `package.json`). `tests/api` and
`tests/api-integration` are test corpora consumed by `apps/api`'s vitest
configs, not workspace packages.

## 4. Test / build commands

**Proposed:** `pnpm test` — from `package.json#scripts.test` (`turbo test`),
with pnpm chosen because `pnpm-workspace.yaml` and `packageManager:
pnpm@10.32.1` are both present.

Caveat for Gate 0: root `pnpm test` fans out across every package and the turbo
`test` task declares `dependsOn: ["^build"]`, so it is a slow loop. For a
lane-header refactor the smallest honest proof is:

```
pnpm --filter @kaneo/web test      # vitest, jsdom, src/**/*.test.{ts,tsx}
pnpm --filter @kaneo/web typecheck # tsc on tsconfig.app.json + tsconfig.node.json
```

Integration tests are a **separate** turbo task (`pnpm test:integration`) and
require a live PostgreSQL. They are not part of `pnpm test`.

## 5. Docs present

`README.md`, `CLAUDE.md`, `AGENTS.md` (canonical guide, `@`-included by
CLAUDE.md), `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`,
`ENVIRONMENT_SETUP.md`, `CHANGELOG.md`, plus `apps/docs/` (Mintlify-style:
`docs.json`, `index.mdx`, `openapi.json`, `api-reference/`, `core/`) and
`tests/api/README.md`.

No ADR directory.

`AGENTS.md` carries binding project rules that downstream phases must respect —
API is the authorization authority, static i18n keys only (`i18n/en-US.json` is
source of truth), Biome `lint` scripts run with `--write` and can touch
unrelated files, and no commit/push/PR unless explicitly requested.

## 6. Detected AI / agent setup

| Path | Type |
|---|---|
| `.claude/` | Claude Code project config |
| `.claude/settings.local.json` | local settings (untracked) |
| `.claude/skills/` | Claude Code skills |
| `CLAUDE.md` | Claude instructions |
| `AGENTS.md` | agent instructions |
| `.cursor/rules/` | Cursor (7 `.mdc` files) |
| `.agents/skills/` | agent skills |
| `skills/` + `skills-lock.json` | agent skills + lockfile |
| `.coderabbit.yaml` | CodeRabbit review bot |

**Absent:** `.mcp.json`, `.cursorrules`, `.aider*`, `.continue/`,
`.github/copilot-instructions.md`, `.roo/`, repo-local `routing-policy.yaml`,
`gemini*.{yaml,json}`.

## 7. Env keys (names only — no values read or recorded)

Files: `.env`, `.env.local`, `.env.sample`, `apps/api/.env.test.example`,
`apps/web/.env.development`, `apps/web/.env.production`.

Declared keys cover Postgres connection, `AUTH_SECRET`, Kaneo API/client URLs,
GitHub App + OAuth, SMTP, and Vite public vars.

Code references a much wider set (~85 names) — billing/Creem, custom OAuth,
Discord/Google, Redis (URL, sentinel, cluster), S3, Sentry, Turnstile,
notification encryption, feature flags such as `DEMO_MODE` and
`DISABLE_REGISTRATION`. Names only are stored in `baseline.json`.

## 8. Monorepo, submodules, LFS

- **Monorepo:** pnpm workspace (`packages/**`, `apps/**`) orchestrated by
  Turborepo. Nine packages, per-package test commands recorded.
- **Submodules:** none (`.gitmodules` absent).
- **Git-LFS:** none. `.gitattributes` exists but only forces LF on `.husky/*`.
- **Infra:** `Dockerfile.kaneo`, `compose.yml`, `compose.local.yml`,
  `charts/kaneo` (Helm), `deploy/`, `.devcontainer/`, 13 GitHub Actions
  workflows. No Terraform, GitLab CI, CircleCI, or Jenkins.

## 9. Regulated-repo signals

**Verdict: `regulated_repo_warning_required: true`. Signal strength: weak.**

Signals found:

- `security-policy` → `SECURITY.md`

Nothing else matched. There is **no** `PRIVACY.md`, `COMPLIANCE.md`,
`HIPAA.md`, `SOC2.md`, `PCI.md` or `GDPR.md`; no `compliance/`, `regulated/`,
`hipaa/`, `pci/`, `soc2/` directory at any depth ≤ 3; and **no CODEOWNERS file
exists anywhere in the repo**, so the security/compliance/privacy/legal team
check could not contribute a signal either.

### Resolving the prior disagreement

This is the third discovery run on commit `5d1fc910`. Run 1 recorded `false`,
run 2 recorded `true`, both from `SECURITY.md` alone. The rule in the discovery
agent definition (group 9) is mechanical and admits no judgment step:

> Record `regulated_repo_signals` … **When the list is non-empty**, produce a
> `## Regulated-repo signals` section … and set
> `regulated_repo_warning_required: true`.

`SECURITY.md` is an explicitly enumerated root-file marker. The list is
therefore non-empty, and the flag is `true` by the letter of the rule. **Run 2
was correct; run 1 applied an unwritten "is this really regulated?" judgment
that the rule does not authorize.** I have matched run 2 so the field is
reproducible from the rule alone.

Recording the honest caveat rather than silently suppressing the flag: a
`SECURITY.md` is near-universal in public OSS (GitHub actively prompts for one),
so on its own it is very weak evidence of a compliance regime. Kaneo is an
MIT-licensed self-hosted product; the file is a vulnerability-disclosure policy,
not a regulatory attestation. That is why `regulated_repo_signal_strength` is
recorded as `weak` alongside the boolean.

Two consequences worth flagging upward, because they are the real fix:

1. The warning is **non-blocking** by design — Gate 0 prints it and the user
   confirms or edits scope. Firing it here costs one confirmation, whereas
   suppressing it would mean a genuinely regulated repo whose only marker is
   `SECURITY.md` gets no prompt. The asymmetry favours `true`.
2. If this prompt proves noisy, the correct remedy is to **amend the group 9
   rule** — e.g. weight `SECURITY.md` as insufficient on its own, requiring a
   second signal — not to have individual runs quietly disagree. Until the rule
   changes, every run on this commit should produce `true`.

Gate 0 should print, verbatim:

> *"This repo appears regulated (signals: `security-policy`). Confirm the active
> policy uses only compliant endpoints, and that off-limits protects your
> regulated data folders."*

## 10. Coexistence risks

- **Cursor rules detected** at `.cursor/rules/` (7 `.mdc` files). The plugin
  will never touch them, but if Cursor's auto-lint-on-save is running, changes
  we make may trigger it.
- **No custom `.mcp.json`.** No project-scoped MCP servers are registered, so
  nothing competes with the bundled dispatch server. Note that the repo itself
  *ships* MCP surfaces (`packages/mcp`, MCP HTTP routes in `apps/api`) — those
  are product code, not agent config, and are in scope for edits like any other
  source.
- **No repo-local `routing-policy.yaml`.** Policy resolution falls back to the
  shipped default; pass `--policy <name>` to override deliberately.
- **CodeRabbit configured** (`.coderabbit.yaml`). It reviews pushed branches, so
  it will not interfere with local edits, but it will comment on any PR.
- **Three agent-skill trees coexist** — `.claude/skills/`, `.agents/skills/`,
  and `skills/` with `skills-lock.json`. All are off-limits. Do not "tidy" or
  reconcile them as part of a refactor run.
- **`.sdlc/` is not gitignored.** Run artifacts (packets, `changes.md`,
  `backups/<file>` which may echo source content) will be untracked but visible
  to `git add -A`, and a distracted commit could push them. Gate 0 will offer to
  add `.gitignore` to this run's allowlist so the plugin can append the entry.
- **Biome `lint` scripts write.** `AGENTS.md` warns that root and package `lint`
  run Biome with `--write` and can modify unrelated files. Phase 7 should prefer
  `biome check` without `--write`, or a path-scoped invocation.

## 11. Proposed off-limits

`.git/**`, all env files (`.env`, `.env.*`, `.env.sample`,
`apps/api/.env.test.example`, `apps/web/.env.{development,production}`),
`.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.cursor/**`, `.agents/**`, `skills/**`,
`skills-lock.json`, `.coderabbit.yaml`, `node_modules/**`, `dist/**`,
`build/**`, `.next/**`, `out/**`, `.turbo/**`, `coverage/**`, `.husky/**`,
`.hook-logs/**`, `.sdlc/**`, plus three repo-specific generated artifacts:

- `apps/web/src/routeTree.gen.ts` — TanStack Router generated; regenerated by
  the router plugin, never hand-edited.
- `apps/api/src/database/migrations/**` — Drizzle-generated SQL. `AGENTS.md`
  requires `pnpm --filter @kaneo/api db:generate`, not hand-authored migrations.
- `pnpm-lock.yaml` — regenerate via pnpm only.

## 12. Tier 2b

**Triggered.** Primary stacks (Hono API, React + Vite + TanStack web, Next.js
site) have no pre-authored adapter — the plugin ships only `generic.md`,
`nest.md`, `python.md`. Learned profile written to
`.sdlc/baseline/stack-profile.md`; it is authoritative over `generic.md` where
they conflict.

## 13. Scan notes

Full Tier 1 completed within the timebox; no group was truncated and no
sampling fallback was needed. No unreadable/non-UTF8 files encountered. No
symlinks followed outside the repo root. No env values were read at any point —
key names only.

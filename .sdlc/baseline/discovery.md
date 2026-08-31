# Discovery — Kaneo

- **Run id:** `20260831-064935-docs-board-features`
- **Mode:** `first-time` (full Tier 1 scan; no `.sdlc/baseline/current.json` existed)
- **Intent hint:** `docs`
- **Built at:** 2026-08-31T06:49:35Z
- **Plugin version:** 0.6.0

## 1. Git state

| Field | Value |
|---|---|
| HEAD | `5d1fc9104337786c3ef295ec0dc31656df371d8d` |
| Branch | `docs/flash-agsdk` |
| Tracked worktree | **clean** — no modified or staged tracked files |
| Untracked | `.claude/settings.local.json`, `.hook-logs/`, `.sdlc/` |
| Remote | `origin` → `https://github.com/tl-ai-labs/kaneo.git` |
| Tracked files | 1578 |
| `.gitignore` covers `.sdlc/` | **No** |

HEAD is identical to `main` and to the commit two sibling runs (`docs/opus-flash`, `docs/opus-only`)
already discovered. This branch carries none of their edits.

## 2. Topology

Top-level: `.agents/`, `.claude/`, `.cursor/`, `.devcontainer/`, `.github/`, `.husky/`, `.vscode/`,
`apps/`, `charts/`, `deploy/`, `i18n/`, `packages/`, `plans/`, `scripts/`, `sentry/`, `skills/`, `tests/`.

Entry points: `apps/api/src/index.ts`, `apps/web/src/main.tsx`.

## 3. Detected stacks

Single-language repo (TypeScript/Node ≥ 20.19, pnpm 10.32.1, ESM), several frameworks:

| Manifest | Stack | Frameworks |
|---|---|---|
| `package.json` (root) | node-typescript | turborepo, pnpm workspace, biome, husky, commitlint |
| `apps/api/package.json` | node-typescript | **hono**, hono-openapi, better-auth, drizzle-orm, valibot, pg, ioredis, MCP SDK, sentry |
| `apps/web/package.json` | node-typescript-react | react, vite, tanstack-router, tanstack-query, radix-ui, dnd-kit, tiptap, tailwind |
| `apps/site/package.json` | node-typescript-react | next, react, radix-ui, tailwind, zustand |
| `packages/email/package.json` | node-typescript-react | react-email, nodemailer |
| `packages/mcp/package.json` | node-typescript | MCP SDK, zod |
| `apps/docs/` (no manifest) | **mintlify-mdx** | Mintlify (`docs.json`, `.mdx` content) |

No Python, Go, Rust, Java, Ruby, PHP, or Elixir manifests.

## 4. Test / build / run

- **Proposed test command:** `pnpm test`
- **Source:** `package.json#scripts.test` → `turbo test`; `pnpm-workspace.yaml` present; `packageManager: pnpm@10.32.1`
- Other targets: `pnpm typecheck`, `pnpm test:integration` (PostgreSQL-backed, `tests/api-integration`),
  `pnpm i18n:check`, per-package `pnpm --filter <pkg> test`.

**Caveat for this run:** the intent is documentation. A change confined to `apps/docs/**/*.mdx` has no
meaningful test target — `pnpm test` would run the whole monorepo suite and prove nothing about the
change. Gate 0 should decide explicitly between a no-test verification and a docs-only check
(link/heading review, Mintlify nav consistency).

## 5. Docs present

Root: `README.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`,
`CHANGELOG.md`, `ENVIRONMENT_SETUP.md`.

`apps/docs/`: `docs.json` (Mintlify config with explicit nav), `index.mdx`, `core/`, `api-reference/`,
`openapi.json`, `README.md`, `CONTRIBUTING.md`.

No ADR directory (`docs/adr/`, `docs/decisions/`, `adr/` all absent).

`CLAUDE.md` is a two-line pointer that `@`-imports `AGENTS.md`. **`AGENTS.md` is the binding convention
document** and constrains any change made in this repo.

## 6. Detected AI / agent setup

| Path | Type |
|---|---|
| `.claude/` (+ `settings.local.json`, `skills/`) | Claude Code project config |
| `CLAUDE.md` | Claude instructions (imports `AGENTS.md`) |
| `AGENTS.md` | agent guide — authoritative conventions |
| `.cursor/rules/` (7 `.mdc` files) | Cursor |
| `.agents/skills/` (10 skills) | agent skills |
| `skills/`, `skills-lock.json` | agent skills + lockfile |
| `.coderabbit.yaml` | CodeRabbit PR review bot |

Absent: `.mcp.json`, `.cursorrules`, `.aider.conf.*`, `.continue/`, `.github/copilot-instructions.md`,
`.roo/`, repo-local `routing-policy.yaml`, `gemini*.{yaml,json}`.

Note: `apps/api/src/mcp/` and `packages/mcp/` are **product features** (Kaneo ships an MCP server), not
agent configuration. They are ordinary source and are not off-limits on that basis.

## 7. Env keys (names only — no values read)

- `.env` — 9 keys (Postgres, `AUTH_SECRET`, `DATABASE_URL`, `KANEO_*_URL`)
- `.env.local` — 5 keys (Postgres only)
- `.env.sample` — 20 keys (Postgres, auth, GitHub App/OAuth, SMTP)

Code references ~60+ distinct names across OAuth providers (GitHub, Google, Discord, custom OIDC),
billing (Creem), storage (AWS S3), notifications, and feature flags (`DEMO_MODE`,
`DISABLE_REGISTRATION`, etc.). Values were never read.

## 8. Monorepo, submodules, LFS, infra

- **Monorepo:** pnpm workspace (`packages/**`, `apps/**`) + Turborepo. 9 workspace packages plus the
  manifest-less `apps/docs`. Standalone test dirs `tests/api` and `tests/api-integration` sit outside
  the workspace globs.
- **Submodules:** none.
- **Git-LFS:** none (`.gitattributes` only pins `.husky/*` to LF).
- **Infra:** `Dockerfile.kaneo`, `compose.yml`, `compose.local.yml`, `.github/workflows/`,
  `charts/kaneo` (Helm), `deploy/`, `.devcontainer/`. No Terraform, GitLab CI, CircleCI, or Jenkins.

## 9. Regulated-repo signals

| Kind | Path |
|---|---|
| `SECURITY.md` | `SECURITY.md` |

`regulated_repo_warning_required: true` — set by the Group 9 rule (root `SECURITY.md` is a listed
marker). Matches the verdict the two prior runs on commit `5d1fc910` reached.

No `PRIVACY.md`, `COMPLIANCE.md`, `HIPAA.md`, `SOC2.md`, `PCI.md`, `GDPR.md`; no `HIPAA/`, `PCI/`,
`SOC2/`, `regulated/`, or `compliance/` path segments; no CODEOWNERS file at all. The signal is a
single generic vulnerability-disclosure policy — weak evidence of actual regulatory scope — but the
rule is deterministic, so the Gate 0 warning fires.

## Intent verification — Board features docs landscape

Re-verified independently on this commit rather than inherited from the prior runs. All three prior
findings hold.

### WIP limits — **absent**

`git grep -inE '\b(wip[-_ ]?limit|wipLimit|overLimit|columnLimit|capacity)\b'` across `apps packages
tests i18n charts README.md` → **0 matches**. A loose word-boundary `wip` search matches only a binary
asset (`apps/site/public/images/hero.png`). No schema column, no i18n key, no UI, no docs.

The feature lives only on unmerged branches `feature-extend-1/{gemini-only,opus-flash,opus-only,opus-sonnet}`.
**Documenting WIP limits on this commit would document a feature that does not exist.**

### Hours rollup — **partial**

Per-task time tracking exists: `apps/api/src/time-entry/` with `create-time-entry.ts`,
`get-time-entries.ts`, `get-time-entry.ts`, `update-time-entry.ts`.

`timeEntryTable` (`time_entry`) in `apps/api/src/database/schema.ts` L508: `id`, `taskId`, `userId`,
`description`, `startTime`, `endTime`, `duration` (integer, default 0), `createdAt`, `updatedAt`.

`git grep -inE '\b(estimate[ds]?|estimatedHours|rollup|totalHours|hoursSum)\b'` over `apps/api/src
apps/web/src packages i18n` → **0 matches**. There is **no estimate field** and **no column-level
aggregation**. The 18 `hours?` hits are unrelated (notification lead-time units, `format-duration.ts`).

Full feature lives only on `feature-extend-2/*`. **A "hours rollup" doc section would overstate what
ships.**

### Filter chips — **shipped, partially documented**

Code: `apps/web/src/components/board/board-toolbar.tsx` — `ActiveFilterChipProps` (L78),
`ActiveFilterChip` (L85), five render sites (L534, 560, 585, 610, 635) mapping to `filters.status`,
`filters.priority`, `filters.assignee`, `filters.dueDate`, `filters.labels`.

Docs: `apps/docs/core/functional/plan-and-execute-tasks.mdx` section `## 5. Use filters to focus`
(L45) lists exactly those five fields — Status, Priority, Assignee, Due date, Labels — and closes with
"Use filters aggressively during standups, planning, and triage."

**Gap:** the section documents *what can be filtered*, not the chip affordance itself (active-filter
chips, individual removal, clear-all). That is the only genuine, ship-accurate documentation gap of
the three requested topics.

### Docs convention — **`apps/docs`, not README**

`apps/docs/docs.json` is a Mintlify config with an explicit nav listing `core/functional/*` pages
including `plan-and-execute-tasks`. `README.md` (179 lines) has 15 headings, all install/deploy/community:
Why Kaneo?, Sponsors, Getting Started, Kubernetes Deployment, Development, MCP Server, Community,
Contributing, License. There is no feature-documentation section in `README.md` at all — adding a
"Board features" section there would break the established structure.

### Branch cleanliness — **confirmed**

`git diff HEAD -- apps/docs/core/functional/plan-and-execute-tasks.mdx` → **empty**.
`git status --short apps/docs` → **empty**. Neither sibling-branch edit is present.

## Coexistence risks

- **Cursor rules detected** at `.cursor/rules/` (7 `.mdc` files). The plugin will never touch them, but
  if Cursor's auto-lint runs on save, changes we make may trigger it.
- **No custom `.mcp.json`.** No project-scoped MCP servers to conflict with the bundled dispatcher.
- **No repo-local `routing-policy.yaml`.** The shipped policy applies; nothing silently overrides routing.
- **`.sdlc/` not gitignored.** `.gitignore` covers `node_modules`, `.env*`, `.turbo`, `dist`, `build`,
  `.next/`, `*.db`, `.worktrees/`, `.pi/` — but **not** `.sdlc/`. Run artifacts under `.sdlc/` (packets,
  `changes.md`, `backups/<file>` which may echo source content) will be untracked but visible to
  `git add -A`, and a distracted commit could push them. Gate 0 will offer to add `.gitignore` to this
  run's allowlist so the plugin can append the entry as part of the run.
  *(Partial mitigation only: the existing `*.db` rule happens to cover
  `.sdlc/delegation/_gemini_worker_save/*.db`, but nothing else under `.sdlc/`.)*
- **Husky + commitlint installed.** `.husky/` hooks and `commitlint.config.js` are active; any commit
  must satisfy conventional-commit format.
- **Biome `lint --write`.** Per `AGENTS.md`, root and package `lint` scripts run Biome with `--write`
  and can modify unrelated files. Prefer targeted checks.
- **CodeRabbit** (`.coderabbit.yaml`) will auto-review any PR this run produces.
- **Pre-existing `.sdlc/` content.** Despite `mode: first-time`, `.sdlc/` already holds 6 prior run
  directories, `.sdlc/local/write-contract.json`, `.sdlc/project.json`, and a
  `.sdlc/delegation/_gemini_worker_save/` cache with 3 `.db` files. Only `baseline/` was missing.
  Stale state from earlier runs may be picked up — worth a glance at Gate 0.
- **Other untracked paths.** `.claude/settings.local.json` and `.hook-logs/` are untracked and unrelated
  to this run. `AGENTS.md` requires preserving unrelated work in a dirty worktree; do not sweep them.

## Proposed off-limits

```
.git/**
.env, .env.*, .env.local, .env.sample
.claude/**, CLAUDE.md, CLAUDE.local.md
AGENTS.md
.cursor/**
.agents/**
skills/**, skills-lock.json
.coderabbit.yaml
.husky/**
node_modules/**, **/node_modules/**
dist/**, build/**, .next/**, .turbo/**, out/**, .source/**
pnpm-lock.yaml
apps/docs/openapi.json          (generated from API)
apps/web/src/routeTree.gen.ts   (TanStack Router generated)
apps/api/src/migrations/**      (generated by drizzle-kit)
.sdlc/**
.hook-logs/**
plans/**
```

## Recommended scope for Gate 0 (docs intent)

Given the verification above, the honest write-scope for this run is narrow:

1. `apps/docs/core/functional/plan-and-execute-tasks.mdx` — extend section 5 to describe the active
   filter-chip UI that already ships.
2. Nothing for WIP limits (no such feature on this commit).
3. Nothing, or a strictly time-tracking-scoped mention, for hours (per-task time entries ship;
   estimates and column rollups do not).
4. `README.md` — **not** the right home for feature documentation in this repo.
5. `.gitignore` — worth adding to the allowlist solely to append `.sdlc/`.

## Scan notes

Tier 1 completed well inside the timebox. Repo is 1578 tracked files — no sampling fallback needed.
Tier 2b (adaptive stack profile) triggered and written to `.sdlc/baseline/stack-profile.md`.

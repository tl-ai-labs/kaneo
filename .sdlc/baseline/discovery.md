# Brownfield discovery — Kaneo

- **run_id:** `20260831-060942-docs-board-features`
- **mode:** first-time (no `.sdlc/baseline/current.json` existed on this branch)
- **intent_hint:** docs
- **scan:** Tier 1 full + Tier 2b adaptive stack profile

## Git state

| Field | Value |
|---|---|
| HEAD | `5d1fc9104337786c3ef295ec0dc31656df371d8d` |
| Branch | `docs/opus-only` |
| Tracked modifications | none — worktree clean |
| Untracked | `.claude/settings.local.json`, `.hook-logs/`, `.sdlc/` |
| Remote | `origin` → `https://github.com/tl-ai-labs/kaneo.git` |
| `.gitignore` covers `.sdlc/` | **no** |
| Tracked files | 1578 |

Branch is a clean fresh cut from `main` at `5d1fc910`. No sibling-branch work is present here.

## Directory topology

Top level: `apps/` (`api`, `web`, `site`, `docs`), `packages/` (`libs`, `permissions`, `mcp`, `email`, `planka-import`, `typescript-config`), `tests/` (`api`, `api-integration`), `charts/kaneo`, `deploy/`, `i18n/`, `plans/`, `scripts/`, `sentry/`, `skills/`.

Entry points: `apps/api/src/index.ts`, `apps/web/src/main.tsx`, `packages/mcp/src/index.ts`.

## Detected stacks

Single stack: **node-typescript**, TypeScript 7.0.2, ESM (`"type": "module"`), Node `>=20.19.0`.

Frameworks: Hono + hono-openapi + Valibot (API), Drizzle ORM on PostgreSQL, Better Auth, React + Vite + TanStack Router/Query (web), Next.js (marketing site), Mintlify (`apps/docs`), Vitest (tests), Biome 2.5.7 (lint/format), Turborepo + pnpm workspaces.

No Python, Go, Rust, Java, Ruby, PHP, or Elixir manifests.

## Test / build commands

- **Proposed test command:** `pnpm test` (root `package.json#scripts.test` → `turbo test`)
- Per package: `pnpm --filter @kaneo/web test`, `pnpm --filter @kaneo/api test`, etc.
- Integration (PostgreSQL-backed): `pnpm test:integration`
- Typecheck: `pnpm typecheck`
- **Docs caveat:** `apps/docs` has no `package.json` and no test script. For a docs-only change the meaningful proof is content review plus Mintlify nav validity, not a test run. Gate 0 should confirm whether Phase 7 runs any test at all for this intent.

## Docs landscape

Root: `README.md` (179 lines), `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `ENVIRONMENT_SETUP.md`, `CHANGELOG.md`.

`README.md` headings are deployment- and contribution-oriented: Why Kaneo?, Sponsors, Getting Started, Kubernetes Deployment, Development, MCP Server, Community, Contributing, License. **There is no feature-documentation section in the README today.**

User-facing feature documentation lives in `apps/docs/` (Mintlify), specifically `apps/docs/core/functional/*.mdx`, registered in `apps/docs/docs.json` under the `Functional Guides` group. No ADR directory exists.

## Verification of the three requested feature claims

All three re-verified independently on this branch at `5d1fc910`.

### WIP limits — CONFIRMED absent
`git grep -niE 'wipLimit|wip_limit|wip limit|overLimit|columnLimit|capacityLimit'` across all tracked files: **zero hits**. A broader case-insensitive `wip` search over all 1578 tracked files returns only false positives (`swipe`/`wipe` in `toast.tsx`, animation skill docs, `CONTRIBUTORS.svg`, `plans/`). No schema column, no API surface, no UI, no docs. Documenting WIP limits would document a feature that does not exist on this branch.

### Hours rollup — CONFIRMED partial
- Per-task time tracking **does** exist: `apps/api/src/time-entry/` with controllers `create-time-entry.ts`, `get-time-entries.ts`, `get-time-entry.ts`, `update-time-entry.ts`, and `timeEntryTable` in `apps/api/src/database/schema.ts` (line 508).
- `taskTable` (line ~404) fields are: `id`, `projectId`, `position`, `number`, `userId`(assignee), `title`, `description`, `status`, `columnId`, `priority`, `startDate`, `dueDate`, `createdAt`, `updatedAt`. **No estimate/estimated-hours field.**
- `git grep -niE 'estimatedHours|estimated_hours|hoursRollup|rollupHours|totalHours'`: **zero hits** in `apps/` and `packages/`. Only `estimat*` matches are in `plans/00*.md` (unrelated motion-design plans) and `tests/api/utils/openapi-spec.test.ts`.
- Conclusion: no column-level or board-level hours aggregation exists. Only per-task time entries.

### Filter chips — CONFIRMED shipped, partially documented
- UI exists: `apps/web/src/components/board/board-toolbar.tsx` defines `ActiveFilterChipProps` (line 78) and the `ActiveFilterChip` component (line 85) with an `onClear` affordance, plus `clearFilters` / `hasActiveFilters` in the toolbar props (lines 54-55).
- Filter state: `apps/web/src/hooks/use-task-filters.ts` (exports `BoardFilters`, `DUE_DATE_FILTER_VALUES`, `useTaskFilters`) and `use-task-filters-with-labels-support.ts`, with persistence to `localStorage` under `kaneo:board-filters:<projectId>`. Covered by `use-task-filters-with-labels-support.test.tsx`.
- Filterable subjects in code: status, priority, assignee, dueDate, labels — five, matching the docs.
- Docs: `apps/docs/core/functional/plan-and-execute-tasks.mdx` section 5 "Use filters to focus" (lines 45-55) lists exactly those five fields and closes with "Use filters aggressively during standups, planning, and triage." **It does not describe the chip UI itself** (active-filter chips, per-chip clear, clear-all, cross-session persistence).
- **`git status` and `git diff HEAD` on that file are both empty** — the sibling branch's edit is correctly NOT present here. This branch shows unmodified `main` content, as expected.

### Implication for this run
The original request ("README Board features section covering WIP limits, hours rollup, filter chips") is only ~1/3 supportable as stated, and its proposed location conflicts with repo convention:
1. WIP limits — nothing to document.
2. Hours rollup — only per-task time entries exist; there is no rollup.
3. Filter chips — real and shippable, but `apps/docs/core/functional/plan-and-execute-tasks.mdx` §5 is the established home, not `README.md`. The README carries no feature documentation at all.

Gate 0 should resolve scope with the user before planning.

## Detected AI/agent setup

Present: `.claude/` (+ `settings.local.json`, `skills/`), `CLAUDE.md`, `AGENTS.md`, `.agents/skills/`, `skills/` + `skills-lock.json`, `.cursor/rules/`, `.coderabbit.yaml`.

Absent: `.mcp.json`, `.cursorrules`, `.aider.conf.*`, `.continue/`, `.github/copilot-instructions.md`, `.roo/`, repo-local `routing-policy.yaml`, any `gemini*.{yaml,json}`.

`CLAUDE.md` is a two-line pointer that `@`-imports `AGENTS.md`. **`AGENTS.md` is the canonical operating guide** and constrains this run: keep scope tight, do not mix speculative features, do not commit/push/open PRs unless explicitly asked, and prefer targeted checks over the root `lint` script (which runs Biome `--write` and can modify unrelated files).

## Environment keys (names only — no values read)

`.env`: 9 keys. `.env.local`: 5 keys. `.env.sample`: 20 keys. 24 distinct across files; 100 referenced in code (including `VITE_*` client vars). Full lists in `baseline.json`. No values were read, recorded, or transmitted.

## Monorepo, submodules, LFS

- **Monorepo:** pnpm workspace (`packages/**`, `apps/**`) + Turborepo. pnpm 10.32.1. Nine `package.json` packages plus `apps/docs` (Mintlify, no manifest).
- **Submodules:** none (`.gitmodules` absent).
- **Git LFS:** none (`.gitattributes` present but carries no `filter=lfs` entries).
- **Infra:** `Dockerfile.kaneo`, `compose.yml`, `compose.local.yml`, Helm chart at `charts/kaneo`, 10 GitHub Actions workflows, Husky hooks. No Terraform, no GitLab CI.

## Regulated-repo signals

- `SECURITY.md` at repo root (kind: `security-policy`)

`regulated_repo_warning_required: true`. Gate 0 must print:

> *"This repo appears regulated (signals: `security-policy`). Confirm the active policy uses only compliant endpoints, and that off-limits protects your regulated data folders."*

Not a blocker. Note this is a low-strength signal — `SECURITY.md` is standard OSS hygiene, not evidence of a compliance regime. Applied per the group 9 rule for consistency with prior runs on this commit.

## Coexistence risks

- **Cursor rules detected.** You have Cursor rules at `.cursor/rules/`. The plugin will never touch them, but if you have Cursor's auto-lint running on save, changes we make may trigger it.
- **No custom `.mcp.json`.** No repo-level MCP servers registered; nothing to conflict with the bundled dispatcher.
- **No repo-local `routing-policy.yaml`.** The shipped/default policy applies. Pass `--policy <name>` to override.
- **`.sdlc/` not gitignored.** Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` to this run's allowlist so the plugin can add the entry as part of the run. Note `.sdlc/` already contains six prior run directories and a `delegation/_gemini_worker_save/` cache with `.db` files.
- **CodeRabbit configured.** `.coderabbit.yaml` is present; an automated reviewer will comment on any PR raised from this run.
- **Layered agent instructions.** `CLAUDE.md` → `AGENTS.md`, plus `.agents/skills/`, `skills/`, and `.cursor/rules/`. All are off-limits by default; `AGENTS.md` governs the conventions this run must respect.
- **Biome `--write` lint.** Per `AGENTS.md`, root/package `lint` scripts modify files in place and can touch unrelated code. Phase 7 should prefer targeted checks.

## Proposed off-limits

`.git/**`, `.env`, `.env.*`, `.env.local`, `.env.sample`, `.claude/**`, `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `.agents/**`, `skills/**`, `skills-lock.json`, `.cursor/**`, `.coderabbit.yaml`, `.sdlc/**`, `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.turbo/**`, `pnpm-lock.yaml`, `apps/site/tsconfig.tsbuildinfo`, `apps/docs/openapi.json`, `.husky/**`, `.hook-logs/**`.

`AGENTS.md` and `CLAUDE.md` are off-limits deliberately — they are the instructions governing this run, not its output. `apps/docs/openapi.json` and `pnpm-lock.yaml` are generated.

## Scan notes

Full Tier 1 completed within budget; repo is small (1578 tracked files), no sampling fallback required. Tier 2b triggered — see `.sdlc/baseline/stack-profile.md`.

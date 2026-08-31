# Brownfield discovery — Kaneo

- **Run:** `20260831-083417-docs-board-features`
- **Mode:** `first-time` (no `.sdlc/baseline/current.json` on this branch)
- **Intent hint:** `docs`
- **Scanned at:** 2026-08-31T08:34:17Z
- **Plugin version:** 0.6.0
- **Scan duration:** within the Tier 1 timebox; no sampling fallbacks needed (1,578 tracked files).

## 1. Git state

| Field | Value |
|---|---|
| HEAD | `5d1fc9104337786c3ef295ec0dc31656df371d8d` |
| Branch | `docs/opus-sonnet` |
| Remote | `origin` → `https://github.com/tl-ai-labs/kaneo.git` |
| Tracked worktree | **clean** — `git diff HEAD` is empty |
| Untracked | `.claude/settings.local.json`, `.hook-logs/`, `.sdlc/` |
| `.gitignore` covers `.sdlc/` | **no** |

The branch has no upstream set and no commits ahead of `main`. It sits exactly on the same commit as
the three sibling docs branches (`docs/opus-flash`, `docs/opus-only`, `docs/flash-agsdk`) and carries
none of their edits.

## 2. Directory topology

Top-level: `.agents`, `.claude`, `.cursor`, `.devcontainer`, `.husky`, `.turbo`, `.vscode`, `apps`,
`charts`, `deploy`, `i18n`, `packages`, `plans`, `scripts`, `sentry`, `skills`, `tests`.

Entry points: `apps/api/src/index.ts`, `apps/web/src/main.tsx`, `packages/mcp/src/index.ts`.

## 3. Detected stacks

A pnpm/Turborepo TypeScript monorepo. Every workspace member is Node + TypeScript; no second language.

| Package | Root | Stack notes |
|---|---|---|
| `@kaneo/api` | `apps/api` | Hono + hono-openapi, Better Auth, Drizzle ORM on PostgreSQL, Valibot validation, ioredis, MCP SDK, Sentry, Vitest |
| `@kaneo/web` | `apps/web` | React + Vite, TanStack Router/Query, Tailwind, Radix, dnd-kit, TipTap, Zustand, i18next, Vitest |
| `@kaneo/site` | `apps/site` | Next.js marketing/doc host |
| (docs) | `apps/docs` | **Mintlify** content site (`docs.json`, `$schema: https://mintlify.com/docs.json`) |
| `@kaneo/libs` | `packages/libs` | Shared typed Hono client + URL helpers |
| `@kaneo/permissions` | `packages/permissions` | Permission vocabulary, built-in roles |
| `@kaneo/mcp` | `packages/mcp` | Published stdio MCP package |
| `@kaneo/email` | `packages/email` | React Email templates + nodemailer |
| `@kaneo/planka-import` | `packages/planka-import` | Import CLI |
| `@kaneo/typescript-config` | `packages/typescript-config` | Shared tsconfig, no scripts |

Toolchain pinned: pnpm 10.32.1, Node >= 20.19.0, TypeScript 7.0.2, Biome 2.5.7, Turbo 2.10.8.

## 4. Test / build commands

**Proposed test command: `pnpm test`** (from `package.json#scripts.test` → `turbo test`; pnpm chosen
because `pnpm-workspace.yaml` and `pnpm-lock.yaml` are present and `packageManager` pins pnpm).

Caveats Gate 0 should weigh:

- Root `pnpm test` fans out through Turbo across every package and rebuilds dependencies. For a
  docs-scoped run it is heavier than necessary.
- Filtered alternatives: `pnpm --filter @kaneo/web test`, `pnpm --filter @kaneo/api test`.
- Integration tests are a separate target, `pnpm test:integration`, and are PostgreSQL-backed
  (`tests/api-integration`). They should not be part of a docs run.
- Root `pnpm lint` runs Biome with `--write` and **rewrites files**, including unrelated ones. Use
  `biome ci` for a read-only check.
- `apps/docs` and `apps/site` have no test script at all. A docs-only change to `apps/docs/**` has no
  automated test to run; the meaningful proof is a Mintlify content review plus link validity.

## 5. Docs present

Root: `README.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`,
`CHANGELOG.md`, `LICENSE`, `ENVIRONMENT_SETUP.md`.

Docs site: `apps/docs/` (Mintlify) with `docs.json`, `index.mdx`, `core/`, `api-reference/`,
`openapi.json`. User-facing feature docs live in `apps/docs/core/functional/` — 10 `.mdx` pages
including `plan-and-execute-tasks.mdx`, `backlog-planning.mdx`, `configure-workflows.mdx`,
`manage-workspace-labels.mdx`.

No ADR directory exists (`docs/adr/`, `docs/decisions/`, `adr/` all absent). `plans/` holds planning
documents.

## 6. Detected AI / agent setup

| Path | Type | Tracked |
|---|---|---|
| `.claude/` | Claude Code project config | dir tracked; see below |
| `.claude/settings.local.json` | Claude Code local settings | **untracked** |
| `.claude/skills/` | Claude Code skills | yes |
| `CLAUDE.md` | Claude instructions (imports `@AGENTS.md`) | yes |
| `AGENTS.md` | canonical agent operating guide | yes |
| `.agents/`, `.agents/skills/` | agent config + skills | yes |
| `skills/` | repo skills directory | yes |
| `.cursor/rules/` | 7 Cursor `.mdc` rule files | yes |
| `.vscode/`, `.devcontainer/` | editor / container config | yes |

Cursor rule files: `backend-api.mdc`, `cursor-rules.mdc`, `database-schema.mdc`,
`deployment-devops.mdc`, `development-conventions.mdc`, `frontend-web.mdc`, `project-overview.mdc`.

**Absent:** `.mcp.json`, `.cursorrules`, `.aider.conf.*`, `.continue/`,
`.github/copilot-instructions.md`, `.roo/`, `routing-policy.yaml`, any `gemini*.{yaml,json}`.

## 7. Env keys (names only — no values read or recorded)

Six env files found: `.env`, `.env.local`, `.env.sample`, `apps/api/.env.test.example`,
`apps/web/.env.development`, `apps/web/.env.production`. `.env` and `.env.local` are gitignored;
`.env.sample`, `apps/web/.env.development`, `apps/web/.env.production` are tracked.

30 distinct declared keys; 101 distinct keys referenced in source (`process.env.*` and
`import.meta.env.*`) — the gap is the large optional surface (S3, Redis Sentinel/Cluster, Sentry,
Creem billing, OAuth providers, Turnstile, feature-disable flags) that is not in any sample file.
Full lists are in `baseline.json`.

## 8. Monorepo, submodules, LFS, infra

- **Monorepo:** pnpm workspace (`packages/**`, `apps/**`) orchestrated by Turborepo. 10 packages.
- **Submodules:** none (no `.gitmodules`).
- **Git LFS:** not in use.
- **Infra:** `Dockerfile.kaneo`, `compose.yml`, `compose.local.yml`, Helm chart at `charts/kaneo`,
  10 GitHub Actions workflows (`ci.yml`, `docker.yml`, `helm-chart.yml`, `nightly.yml`,
  `deploy-site.yml`, `publish-mcp.yml`, …). No Terraform, GitLab CI, CircleCI, or Jenkins.
- Husky git hooks and commitlint (conventional commits) are active.

## 9. Regulated-repo signals

`regulated_repo_warning_required: true`

| Kind | Path |
|---|---|
| `SECURITY.md` | `SECURITY.md` |

No `PRIVACY.md`, `COMPLIANCE.md`, `HIPAA.md`, `SOC2.md`, `PCI.md`, `GDPR.md`; no `hipaa/`, `pci/`,
`soc2/`, `regulated/`, or `compliance/` directories; no `CODEOWNERS` file anywhere.

The single signal is the root `SECURITY.md` — a standard OSS vulnerability-disclosure policy rather
than evidence of a regulatory regime. The group 9 rule is mechanical, so the flag is set and Gate 0
should print the warning, but the underlying risk here is low. This matches the verdict the three
prior runs on this commit reached.

## Detected stacks — Tier 2b

Tier 2b **triggered**. The pre-authored adapters shipped with the plugin are `generic.md`, `nest.md`,
and `python.md`; the primary stacks here are Hono (API) and React/Vite plus Next.js (web/site), so no
adapter matches. A learned profile has been written to `.sdlc/baseline/stack-profile.md` and is
authoritative over `generic.md` where they disagree.

## Coexistence risks

- **Cursor rules detected.** You have Cursor rules at `.cursor/rules/` (7 `.mdc` files). The plugin
  will never touch them, but if you have Cursor's auto-lint running on save, changes we make may
  trigger it.
- **`.sdlc/` not gitignored.** Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/`
  (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to
  add `.gitignore` (append to the existing file) to this run's allowlist so the plugin can add the
  entry as part of the run.
- **Pre-existing untracked paths.** `.claude/settings.local.json` and `.hook-logs/` are untracked and
  not gitignored. AGENTS.md requires preserving unrelated work in a dirty worktree — neither may be
  deleted or committed by this run.
- **Biome `--write` in lint scripts.** Root and package `lint` scripts run Biome with `--write` and
  can modify unrelated files. Use `biome ci` for read-only verification.
- **Two instruction files.** `CLAUDE.md` delegates to `AGENTS.md` via an `@AGENTS.md` import;
  `AGENTS.md` is the canonical operating guide. Its constraints (i18n keys must be static and sourced
  from `i18n/en-US.json`; migrations generated not hand-written; no scope expansion) bind this run.
- **No `.mcp.json` and no repo-local `routing-policy.yaml`.** Nothing in the repo overrides routing.

## Docs landscape verification (independently re-verified at HEAD `5d1fc910`)

All four prior-run findings **confirmed**. Evidence gathered fresh, not inherited.

### WIP limits — absent, confirmed

`git grep -inE 'wip[ _-]?limit|wipLimit|work[ _-]in[ _-]progress'` across all tracked files returns
**zero** matches. Zero matches in `apps/docs/` and `README.md`. The feature exists only on the
unmerged `feature-extend-1/*` branches (four such branches exist locally and on origin).

### Hours rollup — partial, confirmed

- `apps/api/src/time-entry/` exists: `index.ts` plus `controllers/create-time-entry.ts`,
  `get-time-entries.ts`, `get-time-entry.ts`, `update-time-entry.ts`.
- `timeEntryTable` in `apps/api/src/database/schema.ts` has `taskId`, `userId`, `description`,
  `startTime`, `endTime`, `duration`, timestamps, and indexes on `taskId`/`userId`.
- `taskTable` has **no** `estimate` field. Its columns are `id`, `projectId`, `position`, `number`,
  `userId` (assignee), `title`, `description`, `status`, `columnId`, `priority`, `startDate`,
  `dueDate`, `createdAt`, `updatedAt`. `grep estimate` in `schema.ts` returns zero matches.
- **No column-level aggregation.** Searching `totalHours|hoursRollup|rollup|sumHours|totalMinutes|
  columnHours` across `apps/`, `packages/` produces only false positives
  (`SelectPrimitive.ScrollUpArrow`, Vite's `rollupOptions`).

Full feature exists only on unmerged `feature-extend-2/*`.

### Filter chips — shipped, docs gap confirmed

`ActiveFilterChip` is declared in `apps/web/src/components/board/board-toolbar.tsx` — type at
line 78, component at line 85 — and rendered at lines 534, 560, 585, 610, 635: five instances,
one per filterable field.

`apps/docs/core/functional/plan-and-execute-tasks.mdx` section 5 "Use filters to focus" (line 45)
reads:

> The board toolbar supports filtering by: Status / Priority / Assignee / Due date / Labels.
> Use filters aggressively during standups, planning, and triage.

It lists the five fields and **does not describe the chip UI**. The word "chip" appears nowhere in
`apps/docs/` or `README.md`.

### `apps/docs` is the convention for user-facing feature docs — confirmed

`apps/docs` is Mintlify (`docs.json` with the Mintlify schema). Feature documentation lives in
`apps/docs/core/functional/`. `README.md`'s headings are Why Kaneo, Sponsors, Getting Started,
Kubernetes Deployment, Development, MCP Server, Community, Contributing, License — deployment and
onboarding only, with no feature-documentation section. A "Board features" section added to the root
README would be against the repo's established convention.

### `git diff HEAD` on `plan-and-execute-tasks.mdx` — empty, confirmed

`git diff HEAD --stat -- apps/docs/core/functional/plan-and-execute-tasks.mdx` produces no output,
and `git diff HEAD --stat` for the whole worktree is likewise empty. None of the three sibling
branches' edits to that file are present here.

## Frozen-brief AC-5 defect — independent verdict

**The brief's acceptance criterion 5 names the wrong file.** The defect report is correct.

AC-5 names `apps/web/src/hooks/use-task-filters.ts`. The file that actually governs board filtering
is `apps/web/src/hooks/use-task-filters-with-labels-support.ts`.

Evidence:

1. **The board route wires the labels-support hook.**
   `apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx`
   line 19 imports `useTaskFiltersWithLabelsSupport` from
   `@/hooks/use-task-filters-with-labels-support`, and invokes it at line 166 as
   `useTaskFiltersWithLabelsSupport(project, projectId, boardSearchQuery)`.

2. **`useTaskFilters` is never called.** Searching `useTaskFilters\b` (excluding the
   `WithLabels` variant) across `apps/web/src` matches exactly one line — its own definition at
   `apps/web/src/hooks/use-task-filters.ts:56`. It has zero call sites.

3. **The labels filtering branch lives in the labels-support file.**
   `apps/web/src/hooks/use-task-filters-with-labels-support.ts` lines 169-180, inside `filterTasks`,
   under the comment `// Label filtering`:

   ```ts
   // Label filtering
   if (filters.labels && filters.labels.length > 0) {
     const taskLabelIds = (task.labels ?? []).map((label) => label.id);

     // Check if task has at least one of the selected labels
     const hasMatchingLabel = filters.labels.some((labelId) =>
       taskLabelIds.includes(labelId),
     );

     if (!hasMatchingLabel) {
       return false;
     }
   }
   ```

   That file's `filterTasks` also holds the free-text query branch (title, description, task number,
   `slug-number` and `#number` identifiers), which `use-task-filters.ts` lacks entirely.

4. **`use-task-filters.ts` has a `filterTasks`, but with no labels branch.** Its `filterTasks` starts
   at line 86 and covers status, priority, assignee, and due date only. Grepping `label|Label` in
   that file matches only line 12 (the `BoardFilters.labels` type field), line 26 (`DEFAULT_FILTERS`),
   line 34 (`FILTER_KEYS`), and lines 186-207 (`updateLabelFilter`, a `setFilters` state setter).
   Nothing in the 86-165 range. So the file carries label **state** management and the label type,
   with no filtering behavior — exactly as the defect report claims.

5. **`use-task-filters.ts` is not dead, but it is a types/constants module.**
   `board-toolbar.tsx` lines 19-22 import `{ type BoardFilters, DUE_DATE_FILTER_VALUES }` from it;
   `backlog.tsx:32` imports `DUE_DATE_FILTER_VALUES`; and
   `use-task-filters-with-labels-support.ts:6` imports both from it. Any corrected AC should say so
   rather than deleting the reference outright.

6. **Test coverage confirms the split.** `use-task-filters-with-labels-support.test.tsx` exists
   (242-line hook, 176+ line test). There is no test file for `use-task-filters.ts`.

**Recommended correction to the brief:** AC-5 should name
`apps/web/src/hooks/use-task-filters-with-labels-support.ts` as the falsifiability anchor for board
filtering claims, optionally noting that `apps/web/src/hooks/use-task-filters.ts` supplies the
`BoardFilters` type and `DUE_DATE_FILTER_VALUES` constants consumed by the toolbar. Claims about
which fields are filterable and how labels match (OR semantics — "at least one of the selected
labels") are falsifiable only against the labels-support file.

## Proposed off-limits

```
.git/**
.env, .env.*, .env.local, .env.sample
apps/api/.env.test.example, apps/web/.env.development, apps/web/.env.production
.claude/**, CLAUDE.md, CLAUDE.local.md
AGENTS.md, .agents/**, skills/**
.cursor/**
.vscode/**, .devcontainer/**
.husky/**
node_modules/**, dist/**, build/**, .next/**, .turbo/**, out/**, coverage/**
apps/web/src/routeTree.gen.ts        (TanStack Router generated)
apps/api/src/migrations/**           (Drizzle generated; regenerate, never hand-edit)
apps/docs/openapi.json               (generated by openapi:export)
pnpm-lock.yaml
.sdlc/**
```

Gate 0 may move individual entries into scope. Note that `.gitignore` is a likely deliberate
exception this run (see coexistence risks).

## Notes for Gate 0

1. Intent is `docs`; the natural write scope is `apps/docs/core/functional/plan-and-execute-tasks.mdx`
   (and possibly a sibling page plus a `docs.json` nav entry), **not** `README.md`.
2. Only one of the three requested topics is shippable as documentation of current behavior — filter
   chips. WIP limits and column hours rollup do not exist at this commit; documenting them would be
   false.
3. There is no test command that meaningfully verifies a docs change. Verification should be
   content review against the source files named above.
4. `regulated_repo_warning_required` is true; print the standard warning.
5. Offer `.gitignore` in the allowlist so `.sdlc/` can be ignored.

# Brownfield discovery — Kaneo

- **run_id**: `20260826-103235-feature-extend-board-filter-chips`
- **mode**: `first-time` (no prior `.sdlc/baseline/current.json`)
- **plugin_version**: 0.6.0
- **scope**: Tier 1 local reads + Tier 2b adaptive stack profile (triggered)
- **intent hint**: feature-extend — URL persistence for the project Board's filter state

---

## Git state

| field | value |
|---|---|
| HEAD | `5d1fc9104337786c3ef295ec0dc31656df371d8d` |
| branch | `feature-extend-3/flash-only` |
| remote | `origin` → `https://github.com/tl-ai-labs/kaneo.git` |
| tracked modifications | none |
| untracked | `.claude/settings.local.json`, `.hook-logs/`, `.sdlc/` |
| `.sdlc/` gitignored | **no** |

The worktree is pristine at the tracked level. This matches the caller's context: a fresh branch off
`main` for a controlled policy comparison. Pre-existing `.sdlc/runs/` directories from earlier runs
were left untouched.

---

## Directory topology

Top level: `.agents`, `.claude`, `.cursor`, `.devcontainer`, `.github`, `.husky`, `.vscode`,
`apps`, `charts`, `deploy`, `i18n`, `packages`, `plans`, `scripts`, `sentry`, `skills`, `tests`.

- `apps/api` — Hono API (Better Auth, Drizzle, Valibot, events, WebSockets, MCP HTTP routes)
- `apps/web` — React 19 / Vite 8 SPA (TanStack Router + Query) ← **the surface this ticket touches**
- `apps/docs` — documentation content (no `package.json`)
- `apps/site` — Next.js public site
- `packages/` — `libs` (typed Hono client), `permissions`, `mcp`, `email`, `planka-import`, `typescript-config`
- `tests/api`, `tests/api-integration` — API unit and PostgreSQL-backed integration tests
- `charts/kaneo` — Helm; `deploy/` — deployment surface; `i18n/` — 20+ locale JSON files

1578 tracked files. Well inside scan bounds — no sampling fallback used.

---

## Detected stacks

Single-language monorepo: **TypeScript 7.0.2 on Node ≥20.19, pnpm 10.32.1, Turborepo**.

| manifest | role | frameworks |
|---|---|---|
| `package.json` | monorepo root | turborepo, pnpm workspaces, biome, husky, commitlint |
| `apps/web/package.json` | frontend | react 19, vite 8, tanstack-router, tanstack-query, zustand, tailwind 4, radix-ui, better-auth, vitest, **zod 4**, i18next, dnd-kit, tiptap, sentry |
| `apps/api/package.json` | backend | hono, better-auth, drizzle, **valibot**, vitest, postgres |
| `apps/site/package.json` | marketing/docs site | next |
| `packages/libs` | shared typed client | hono/client |
| `packages/permissions` | permission vocabulary | — |
| `packages/mcp` | published stdio MCP | modelcontextprotocol |
| `packages/email`, `packages/planka-import`, `packages/typescript-config` | support | — |

Note the validator split: **zod in `apps/web`, valibot in `apps/api`.**

---

## Test command

**Proposed: `pnpm --filter @kaneo/web test`**
Source: `apps/web/package.json#scripts.test` → `vitest run --config vitest.config.ts`.

This is the narrowest proof for a web-only change, matching the AGENTS.md verification guidance
("use the smallest proof that covers the changed behavior").

Alternatives for Gate 0:

| command | source | when |
|---|---|---|
| `pnpm test` | root → `turbo test` | all packages; broader blast radius |
| `pnpm --filter @kaneo/web typecheck` | `apps/web` | type-level proof; run alongside tests |
| `pnpm test:integration` | root → `turbo test:integration` | needs PostgreSQL; not needed for a web-only change |

Web test environment: vitest + jsdom + `@testing-library/react`, setup file `apps/web/src/test/setup.ts`,
include glob `src/**/*.test.{ts,tsx}`. 36 test files exist under `apps/web/src`.

> **Do not use `pnpm lint` as a verification step.** Root and package `lint` scripts run Biome with
> `--write` and can modify unrelated files — AGENTS.md calls this out explicitly.

---

## Docs

`README.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`,
`CHANGELOG.md`, `ENVIRONMENT_SETUP.md`, plus `apps/docs/` and `plans/`. No ADR directory.

`CLAUDE.md` is a thin pointer that `@`-includes `AGENTS.md`, which is canonical. Constraints from
AGENTS.md that bind a web-only change: static i18n keys with `i18n/en-US.json` as source of truth;
web requests live in `apps/web/src/fetchers/` and server state in TanStack Query hooks; use the
`@kaneo/libs` typed client; prefer inferred types and `type` over `interface`; do not commit, push,
or open a PR unless explicitly requested.

---

## Detected AI/agent setup

| path | type |
|---|---|
| `.claude/` + `.claude/settings.local.json` + `.claude/skills/` (11) | Claude Code project config |
| `CLAUDE.md`, `AGENTS.md` | agent instructions |
| `.agents/skills/` (10) | agents skill mirror |
| `skills/` (10) + `skills-lock.json` | skill source + lockfile |
| `.cursor/rules/` (7 `.mdc`) | Cursor rules |
| `.coderabbit.yaml` | CodeRabbit AI review |

Absent: `.mcp.json`, `.cursorrules`, `.aider.conf.*`, `.continue/`, `.roo/`,
`.github/copilot-instructions.md`, `CLAUDE.local.md`, `routing-policy.yaml`, `gemini*.{yaml,json}`.

---

## Environment

Env files present: `.env`, `.env.local`, `.env.sample`, `apps/api/.env.test.example`,
`apps/web/.env.development`, `apps/web/.env.production`.

**Key names only were read. No values were read, recorded, or transmitted.**

Web-relevant keys: `VITE_API_URL`, `VITE_CLIENT_URL`, `VITE_SENTRY_DSN`, `VITE_TURNSTILE_SITE_KEY`.
Server keys cover Postgres, auth, SMTP, and GitHub App/OAuth. This ticket needs no new credentials.

---

## Monorepo / submodules / LFS

- **Monorepo**: pnpm workspaces (`packages/**`, `apps/**`) + Turborepo. Nine packages.
- **Submodules**: none (no `.gitmodules`).
- **Git-LFS**: none. `.gitattributes` exists but only forces LF on `.husky/*`.

---

## Infrastructure

`Dockerfile.kaneo`, `compose.yml`, `compose.local.yml`, `charts/kaneo` (Helm), `.devcontainer/`,
and 13 GitHub Actions workflows including `ci.yml` and `nightly.yml`. No Terraform, GitLab CI,
CircleCI, or Jenkins.

---

## Regulated-repo signals

Only `SECURITY.md` — a standard OSS vulnerability-disclosure policy, not a compliance-program marker.
No HIPAA/PCI/SOC2/GDPR/PRIVACY/COMPLIANCE files, no `compliance/` or `regulated/` directories, no
CODEOWNERS. **`regulated_repo_warning_required: false`** — no Gate 0 warning needed.

---

## Coexistence risks

- You have Cursor rules at `.cursor/rules/` (7 `.mdc` files: backend-api, cursor-rules,
  database-schema, deployment-devops, development-conventions, frontend-web, project-overview).
  The plugin will never touch them, but if you have Cursor's auto-lint running on save, changes we
  make may trigger it.
- Three parallel skill trees exist — `skills/` (10), `.claude/skills/` (11, adds `verify`),
  `.agents/skills/` (10) — plus `skills-lock.json`. These look sync-managed. The plugin will not
  write to any of them; if a sync script runs mid-run it could re-touch files and confuse change
  accounting.
- No `.mcp.json` in this repo — no competing project-level MCP server registrations.
- No repo-local `routing-policy.yaml` — the plugin will use the shipped/active policy.
- `.coderabbit.yaml` detected. CodeRabbit reviews, it does not write, so there is no write conflict;
  expect automated review comments on anything this run pushes.
- Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups,
  telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore`
  (create if missing, append if present) to this run's allowlist so the plugin can add the entry as
  part of the run.
- Husky + commitlint (`config-conventional`) are active. Any commit made during this run must use a
  conventional-commit subject or the `commit-msg` hook will reject it.

---

## Proposed off-limits

```
.git/**                                .claude/**            node_modules/**
.sdlc/**                               CLAUDE.md             dist/**
.env  .env.local  .env.sample  .env.*  AGENTS.md             build/**
apps/api/.env.test.example             .agents/**            .next/**
apps/web/.env.development              skills/**             .turbo/**
apps/web/.env.production               skills-lock.json      out/**
.github/**                             .cursor/**            coverage/**
.husky/**                              .coderabbit.yaml      pnpm-lock.yaml
.devcontainer/**                       .vscode/**            CHANGELOG.md
.hook-logs/**                          charts/**             CONTRIBUTORS.svg
plans/**                               deploy/**
apps/web/src/routeTree.gen.ts
apps/api/src/database/migrations/**    apps/api/drizzle/**
```

Notable rationale:

- **`apps/web/src/routeTree.gen.ts`** — TanStack Router generated. Its header is
  `/* eslint-disable */` + `// @ts-nocheck`. Regenerated by the router Vite plugin; never hand-edit.
  This matters for this ticket: adding a search schema to the board route does **not** require
  editing the generated tree.
- **`apps/api/src/database/migrations/**`** — must be produced by `pnpm --filter @kaneo/api db:generate`.
- **`plans/**`** — human planning notes, out of scope for codegen.

---

# Scoping notes for this ticket

## 1. Board route — current `BoardSearchParams` and `validateSearch`

`apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx`

```ts
// line 24
type BoardSearchParams = {
  taskId?: string;
};

// line 32
validateSearch: (search: Record<string, unknown>): BoardSearchParams => ({
  taskId: typeof search.taskId === "string" ? search.taskId : undefined,
}),
```

Hand-rolled narrowing predicate — **no schema library**. The only search param today is `taskId`,
consumed at line 80 (`const { taskId } = Route.useSearch()`) and passed to `TaskDetailsSheet`.

Board state that is **not** in the URL today:
- `boardSearchQuery` — Cmd/Ctrl+F text search, plain `useState` (line 86)
- `viewMode` — zustand `user-preferences` store
- `sort` — `useBoardSort` → localStorage
- `filters` — `useTaskFiltersWithLabelsSupport` → localStorage

## 2. `board-toolbar.tsx` — filter UI that already exists

`apps/web/src/components/board/board-toolbar.tsx`

A single **Filter** dropdown (line 259) with five `DropdownMenuSub` sections:

| section | source of options | reset action |
|---|---|---|
| status | `project.columns` | `updateFilter("status", null)` |
| priority | hardcoded `["urgent","high","medium","low"]` | `updateFilter("priority", null)` |
| assignee | `users.members` | `updateFilter("assignee", null)` |
| dueDate | `DUE_DATE_FILTER_VALUES` (dueThisWeek, dueNextWeek, noDueDate) | `updateFilter("dueDate", null)` |
| labels | `workspaceLabels` de-duplicated by `(name, color)` | `clearLabelFilters()` looping `updateLabelFilter` |

Plus a "Clear all filters" item shown only when `hasActiveFilters`.

**Filter chips already exist.** `ActiveFilterChip` is a local component (lines 78–108) rendering
subject / operator / value / X-clear. One chip per active filter group is rendered at lines 533–643.
`SortControl` sits inline with them; the board/list view toggle is on the right.

**The toolbar is fully controlled** — `BoardToolbarProps` receives `filters`, `updateFilter`,
`updateLabelFilter`, `clearFilters`, `hasActiveFilters` and holds no filter state of its own.
URL persistence can be implemented entirely behind the hook without changing this component's props.

## 3. The two filter hooks and the test

**`apps/web/src/hooks/use-task-filters.ts`**

```ts
export type BoardFilters = {
  status: string[] | null;
  priority: string[] | null;
  assignee: string[] | null;
  dueDate: string[] | null;
  labels: string[] | null;
};
```

Exports `BoardFilters`, `DUE_DATE_FILTER_VALUES`, and `useTaskFilters()`.
**`useTaskFilters()` itself has zero call sites — it is dead code.** Only the type and the const are
imported (board-toolbar.tsx line 22, backlog.tsx line 32). It is a near-duplicate of the
labels-support hook minus label filtering, text query, and memoization.

**`apps/web/src/hooks/use-task-filters-with-labels-support.ts`**

Signature `(project, projectId?, textQuery?)` returning
`{ filters, setFilters, updateFilter, updateLabelFilter, filteredProject, hasActiveFilters, clearFilters }`.
Sole production consumer is `board.tsx` line 166. It **re-declares its own private**
`DEFAULT_FILTERS`, `FILTER_KEYS`, and `normalizeFilters` — copied verbatim from `use-task-filters.ts`
rather than imported. Filter state is `useState<BoardFilters>(DEFAULT_FILTERS)` seeded from
localStorage in an effect.

**`apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx`**

vitest + `renderHook`/`waitFor`, `window.localStorage.clear()` in `beforeEach`/`afterEach`, storage
key `kaneo:board-filters:project-1`. Covers restoring persisted label filters and matching tasks.
**These tests assert localStorage behavior directly**, so a move to URL persistence will require
updating them — and TanStack Router hooks would need a router harness, which this file does not have
today.

## 4. How filter state is currently persisted

`window.localStorage`, per project:

- **key**: `` `kaneo:board-filters:${projectId}` ``
- **value**: `JSON.stringify(BoardFilters)`
- **read**: `useEffect` on `[storageKey]` — reads once per project, `JSON.parse`,
  `normalizeFilters()`; falls back to `DEFAULT_FILTERS` on missing / invalid / throw
- **write**: `useEffect` on `[filters, storageKey]` — unconditional `setItem` on every change
  (it also writes the all-null default on mount)
- **normalization**: keeps only `string[]` values with `length > 0`, otherwise `null`
- **guards**: `typeof window === "undefined"` guard, `try`/`catch` around the read

`useBoardSort` (`apps/web/src/hooks/use-board-sort.ts`) uses the **identical** shape at
`` `kaneo:board-sort:${projectId}` `` with its own `normalizeSort()`. This localStorage-keyed-by-project
pattern is the house convention for board view state — worth deciding explicitly whether URL
persistence replaces it, layers on top of it, or leaves sort behind.

**Nothing about filters is in the URL today.** The board search object carries `taskId` only.

## 5. `navigate()` call sites reachable from the board that replace the whole search object

All nine are reachable: `board.tsx` renders `KanbanBoard` or `ListView` depending on `viewMode`.
Every one of these would drop new filter params.

| file | line | call | context |
|---|---|---|---|
| `board.tsx` | 97 | `navigate({ to: ".", search: {}, replace: true })` | `handleCloseTaskSheet` — closes `TaskDetailsSheet` |
| `components/kanban-board/task-card.tsx` | 148 | `navigate({ to: ".", search: {} })` | card click when task already open (toggle close) |
| `components/kanban-board/task-card.tsx` | 153 | `navigate({ to: ".", search: { taskId: task.id } })` | card click to open task |
| `components/kanban-board/index.tsx` | 67 | `navigate({ to: ".", search: { taskId: state.focusedTaskId } })` | `j` shortcut, focus next |
| `components/kanban-board/index.tsx` | 74 | `navigate({ to: ".", search: { taskId: state.focusedTaskId } })` | `k` shortcut, focus previous |
| `components/list-view/task-row.tsx` | 147 | `navigate({ to: ".", search: {} })` | row click when task already open |
| `components/list-view/task-row.tsx` | 152 | `navigate({ to: ".", search: { taskId: task.id } })` | row click to open task |
| `components/list-view/index.tsx` | 97 | `navigate({ to: ".", search: { taskId: state.focusedTaskId } })` | `j` shortcut |
| `components/list-view/index.tsx` | 104 | `navigate({ to: ".", search: { taskId: state.focusedTaskId } })` | `k` shortcut |

Not search replacements (they navigate away from the board): the `Enter` handlers targeting
`/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId`, and the `g`-prefix view
shortcuts to `/gantt` and `/backlog` in `board.tsx` lines 110 and 114.

**Sibling hazard, out of scope unless the ticket extends there**: the backlog route has the identical
pattern — `backlog.tsx` line 75 (`search: {}, replace: true`), `backlog-list-view/backlog-task-row.tsx`
lines 103 and 108, `backlog-list-view/index.tsx` lines 97 and 104.

## 6. Schema validation library in `apps/web` and which routes use it in `validateSearch`

**Yes — `zod ^4.4.3`** is a direct dependency of `apps/web`. Import style throughout is
`import { z } from "zod/v4"`. (`valibot` is the **API's** validator, not the web app's.)

Routes with a zod schema in `validateSearch`:

- `apps/web/src/routes/auth/sign-in.tsx` → `signInSearchSchema`
- `apps/web/src/routes/auth/sign-up.tsx` → `signUpSearchSchema`
- `apps/web/src/routes/device/index.tsx` → `deviceSearchSchema` (`z.object` at line 14)
- `apps/web/src/routes/device/approve.tsx` → `approveSearchSchema` (`z.object` at line 13)
- `apps/web/src/routes/mcp.authorize.tsx` → `authorizationSearchSchema` (`z.object` at line 13)

Routes with hand-rolled `validateSearch`:

- `.../project/$projectId/board.tsx`, `.../backlog.tsx`, `.../gantt.tsx`
- `auth/verify-otp.tsx`, `auth/check-email.tsx`

Other zod usage in web (form resolvers via `@hookform/resolvers`):
`components/settings/create-api-key-dialog.tsx`, `settings/account/information.tsx`,
`settings/projects/$projectId/general.tsx`, `settings/workspace/general.tsx`.

**Verdict:** both styles are established in-repo. A zod v4 search schema for the board route is
precedented and is the safer choice for array-valued filter params (five `string[] | null` fields
need real coercion and de-duplication). The hand-rolled style is what the three project sub-routes
currently use. **This is a genuine convention fork, not a settled question — Gate 0 should let the
user pick.**

## 7. i18n

Board filter copy already uses static keys under `tasks:boardFilters.*` and `tasks:backlog.filters.*`.
`i18n/en-US.json` is the source of truth and 20+ locale files exist. Any new user-facing string needs
a key there; `pnpm i18n:check` validates.

---

## Scan notes

- Completed well inside the 30-second bound. No sampling fallback needed (1578 tracked files).
- Tier 2b adaptive stack profile **triggered** — primary stack is React/Vite + Hono, which has no
  pre-authored adapter (shipped: `generic`, `nest`, `python`). Written to
  `.sdlc/baseline/stack-profile.md`.
- No files outside `.sdlc/` were written.

# Brownfield discovery — Kaneo

- **Run**: `20260826-064633-feature-extend-board-filter-chips`
- **Mode**: `first-time` (no `.sdlc/baseline/current.json` existed)
- **Built at**: 2026-08-26T06:46:33Z
- **Plugin**: mmo 0.6.0
- **Scan**: Tier 1 full, plus Tier 2b adaptive stack profile (triggered — see below)

---

## Group 1 — Git state

| Field | Value |
|---|---|
| HEAD | `5d1fc9104337786c3ef295ec0dc31656df371d8d` |
| Branch | `feature-extend-3/opus-flash` |
| Remote | `origin` → `https://github.com/tl-ai-labs/kaneo.git` |
| Dirty | yes — but **only untracked, non-source paths** |
| `.gitignore` covers `.sdlc/` | **no** |

Dirty entries:

```
?? .claude/settings.local.json
?? .hook-logs/
?? .sdlc/
```

No tracked file is modified. The branch is freshly cut from `main` at `5d1fc910`
("docs: update contributors and sponsors"). `HEAD` is a clean rollback anchor.

AGENTS.md requires preserving unrelated work in a dirty worktree — do **not** clean
`.hook-logs/` or `.claude/settings.local.json`.

**Note on prior runs.** `.sdlc/runs/` already contains three leftover directories from
abandoned runs on other branches (`...lane-wip-limit`, two `...estimated-hours`). They hold
only binary worker caches and one `orchestrator.log` — no artifacts. `.sdlc/baseline/` did
not exist. The estimated-hours feature built on `feature-extend-2/opus-sonnet` is **not**
present on this branch. Treated as first-time, as instructed.

`.sdlc/project.json` does pre-exist (`schema_version: 2`, `default_policy:
opus-plus-flash-v37`, an `off_limits_default` list). Left untouched; its off-limits entries
are folded into the proposal below.

## Group 2 — Topology

```
apps/       api  web  site  docs
packages/   email  libs  mcp  permissions  planka-import  typescript-config
tests/      api  api-integration
charts/kaneo        Helm chart
deploy/  i18n/  plans/  scripts/  sentry/
.agents/ .claude/ .cursor/ .devcontainer/ .github/ .husky/ .vscode/ skills/
```

Entry points: `apps/api/src/index.ts`, `apps/web/src/main.tsx`. 1578 tracked files — well
inside Tier 1 bounds, no sampling needed.

## Detected stacks

TypeScript everywhere. pnpm workspaces + Turborepo.

| Package | Role | Frameworks |
|---|---|---|
| root | monorepo | Turborepo, pnpm 10.32.1, Biome 2.5.7, Husky, commitlint, TypeScript 7.0.2, Node ≥20.19 |
| `@kaneo/api` | backend | **Hono** + hono-openapi, Better Auth, **Drizzle ORM** + Postgres (`pg`), **Valibot**, ioredis, Sentry, MCP SDK, Vitest |
| `@kaneo/web` | frontend SPA | **React + Vite**, **TanStack Router**, **TanStack Query**, Tailwind, Radix, dnd-kit, TipTap, react-i18next, Vitest + jsdom + Testing Library |
| `@kaneo/site` | marketing | Next.js, React, Tailwind, zustand |
| `@kaneo/docs` | docs | MDX content |
| `@kaneo/libs` | shared typed Hono client | Vitest |
| `@kaneo/permissions` | permission vocabulary | Better Auth, Vitest |
| `@kaneo/email` | templates | react-email, nodemailer |
| `@kaneo/mcp` | published stdio MCP | MCP SDK, zod |
| `@kaneo/planka-import` | import CLI | — |
| `@kaneo/typescript-config` | tsconfig base | — |

## Group 4 — Test / build commands

**Proposed: `pnpm --filter @kaneo/web test`** (source: `apps/web/package.json#scripts.test`
→ `vitest run --config vitest.config.ts`; `pnpm-workspace.yaml` present so `pnpm` is the
right driver).

The upcoming job is web-only (board route, toolbar, filter hooks), and AGENTS.md asks for
"the smallest proof that covers the changed behavior." Pair it with
`pnpm --filter @kaneo/web typecheck` because the route's search-param type is a cross-file
contract consumed by the generated route tree.

Alternatives for Gate 0:

| Command | Scope |
|---|---|
| `pnpm test` | whole monorepo via `turbo test` |
| `pnpm --filter @kaneo/web test` | **proposed** — web unit/component tests |
| `pnpm --filter @kaneo/api test` | api unit tests |
| `pnpm test:integration` | Postgres-backed; needs a live DB — **do not run by default** |
| `pnpm --filter @kaneo/web typecheck` | `tsc --noEmit` on app + node tsconfigs |

**Lint warning.** Root and package `lint` scripts are `biome check --write .` and will
rewrite unrelated files. AGENTS.md calls this out explicitly. Use targeted
`biome check <paths>` without `--write` while iterating.

## Group 5 — Docs

`README.md`, `CLAUDE.md` (a thin pointer that `@`-imports `AGENTS.md`), **`AGENTS.md`**
(the canonical, binding guide), `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`,
`CHANGELOG.md`, `ENVIRONMENT_SETUP.md`, `apps/docs/` (product + API reference),
`tests/api-integration/README.md`.

ADRs live in **`plans/`** (not `docs/adr/`): 001-motion-tokens-and-easing …
007-board-reflow, plus `plans/README.md`. `007-board-reflow.md` may be relevant background
for board work.

## Detected AI/agent setup

| Path | Type |
|---|---|
| `AGENTS.md` | canonical agent guide — binding conventions |
| `CLAUDE.md` | Claude instructions (imports AGENTS.md) |
| `.claude/`, `.claude/settings.local.json`, `.claude/skills/` | Claude project config + 11 vendored skills |
| `.agents/skills/` | mirror of `.claude/skills` |
| `skills/` + `skills-lock.json` | vendored skill sources, hash-locked (`emilkowalski/skill`) |
| `.cursor/rules/` | 7 `.mdc` rules: project-overview, backend-api, frontend-web, database-schema, development-conventions, deployment-devops, cursor-rules |
| `.coderabbit.yaml` | CodeRabbit AI auto-review |
| `.github/workflows/auto-merge.yml`, `auto-assign.yml` | CI automation |

Absent: `.mcp.json`, `.cursorrules`, `.aider.conf.*`, `.continue/`,
`.github/copilot-instructions.md`, `.roo/`, `routing-policy.yaml`, `CLAUDE.local.md`.

## Coexistence risks

- **Cursor rules detected** — You have Cursor rules at `.cursor/rules/` (7 `.mdc` files).
  The plugin will never touch them, but if you have Cursor's auto-lint running on save,
  changes we make may trigger it.
- **No custom `.mcp.json`** — nothing competing at project scope; the plugin uses its own
  bundled dispatch server.
- **No repo-local `routing-policy.yaml`** — routing falls back to `.sdlc/project.json`
  `default_policy: opus-plus-flash-v37`.
- **`.sdlc/` not gitignored** — Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts
  under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to
  `git add -A`. Gate 0 will offer to add `.gitignore` (append) to this run's allowlist so
  the plugin can add the entry as part of the run.
- **CodeRabbit** — `.coderabbit.yaml` means any PR from this branch gets auto-reviewed.
  Not a conflict, but generated code will be publicly commented on.
- **auto-merge workflow** — `.github/workflows/auto-merge.yml` exists. Do not open a PR
  unless explicitly asked (AGENTS.md forbids it independently).
- **Biome `--write`** — the repo's own `lint` scripts modify unrelated files. Never invoke
  them wholesale during a run.
- **Hash-locked skills** — `skills/`, `.claude/skills/`, `.agents/skills/` are verified
  against `skills-lock.json`. Any edit breaks hash verification. All three go off-limits.

## Group 7 — Environment keys (names only)

No values were read, recorded, or transmitted. Names only.

- `.env` — `AUTH_SECRET`, `DATABASE_URL`, `KANEO_API_URL`, `KANEO_CLIENT_URL`,
  `POSTGRES_{DB,HOST,PASSWORD,PORT,USER}`
- `.env.local` — `POSTGRES_{DB,HOST,PASSWORD,PORT,USER}`
- `.env.sample` — `AUTH_SECRET`, `GITHUB_*` (app/OAuth/webhook), `KANEO_CLIENT_URL`,
  `POSTGRES_*`, `SMTP_*`

Code references ~100 more (`REDIS_*`, `S3_*`, `SENTRY_*`, `CREEM_*`, `CUSTOM_OAUTH_*`,
`DISCORD_*`, `GOOGLE_*`, `TURNSTILE_SECRET_KEY`, …) — full list in `baseline.json`.
Vite client-side: `VITE_API_URL`, `VITE_APP_URL`, `VITE_CLIENT_URL`, `VITE_SENTRY_DSN`,
`VITE_TURNSTILE_SITE_KEY`.

**This run needs no credentials.** The work is client-side filtering and URL state.

## Group 8 — Monorepo / submodules / LFS / infra

- **Monorepo**: pnpm workspaces (`packages/**`, `apps/**`) + Turborepo. 10 packages.
- **Submodules**: none.
- **Git LFS**: not in use.
- **Infra**: `Dockerfile.kaneo`, `compose.yml`, `compose.local.yml`, Helm at
  `charts/kaneo`, `.devcontainer/`, Husky hooks, 10 GitHub Actions workflows. No Terraform,
  no GitLab CI, no CircleCI, no Jenkins.

## Regulated-repo signals

Only a conventional open-source `SECURITY.md`. No HIPAA/PCI/SOC2/GDPR/compliance markers,
no CODEOWNERS naming security/compliance/legal teams. **Not treated as regulated** —
`regulated_repo_warning_required: false`.

## Proposed off-limits

```
.env  .env.*  .env.local  .env.sample
.claude/**  .agents/**  skills/**  skills-lock.json
.cursor/**  .coderabbit.yaml  .mcp.json  routing-policy.yaml
.git/**  .sdlc/**
node_modules/**  dist/**  build/**  .next/**  out/**  .turbo/**  coverage/**  .hook-logs/**
pnpm-lock.yaml
apps/web/.tanstack/**
apps/web/src/routeTree.gen.ts
apps/api/drizzle/**
charts/kaneo/**  Dockerfile.kaneo  compose.yml  compose.local.yml
.github/workflows/**  .husky/**
```

Beyond the standard set, three earn a specific justification:

- **`apps/web/src/routeTree.gen.ts`** — generated by `@tanstack/router-plugin`. Hand-editing
  is always wrong; it regenerates from the route file tree. This one matters for this run,
  since the job changes a route's search-param type.
- **`apps/api/drizzle/**`** — migrations must only come from
  `pnpm --filter @kaneo/api db:generate`.
- **`pnpm-lock.yaml`** — package-manager-owned.

---

# Job-scope findings (feature-extend: board filter chips + URL state)

## Headline: the chips already exist

`apps/web/src/components/board/board-toolbar.tsx` (676 lines) already contains an
`ActiveFilterChip` component and already renders chips for status, priority, **assignee**
and **labels**, plus a `Filter` dropdown with per-subject submenus. So the real delta is
**(a) persisting filter state in the URL** and possibly **(b) promoting/repositioning the
assignee and label chips** — not building chips from scratch.

## Current `BoardSearchParams`

`apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx`,
lines 24-35:

```ts
type BoardSearchParams = {
  taskId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): BoardSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});
```

Consumed as `const { taskId } = Route.useSearch()` (line 80). Its sibling routes
`backlog.tsx` and `gantt.tsx` use the identical one-field shape. Richer `validateSearch`
examples to pattern-match against live in `routes/auth/{sign-in,sign-up,verify-otp,check-email}.tsx`,
`routes/device/{index,approve}.tsx` and `routes/mcp.authorize.tsx`.

## What the filter hooks already support

`BoardFilters` (`apps/web/src/hooks/use-task-filters.ts`):

```ts
export type BoardFilters = {
  status: string[] | null;
  priority: string[] | null;
  assignee: string[] | null;
  dueDate: string[] | null;
  labels: string[] | null;
};
```

Due-date values: `dueThisWeek`, `dueNextWeek`, `noDueDate`.

**`useTaskFilters`** (`use-task-filters.ts`) — filters status, priority, assignee, dueDate.
It exposes `labels` on the type and an `updateLabelFilter`, but **its `filterTasks` never
reads `filters.labels`** — labels are stored and ignored. Not memoized. Not used by
`board.tsx`.

**`useTaskFiltersWithLabelsSupport`** (`use-task-filters-with-labels-support.ts`) — the one
`board.tsx` actually uses (line 166), signature `(project, projectId?, textQuery?)`. Adds
free-text matching over title / description / number / `PROJ-123` / `#123`, and real label
filtering (OR / any-of over `task.labels[].id`). `filterTasks` is `useCallback`,
`filteredProject` is `useMemo`. Its `hasActiveFilters` treats empty arrays as inactive; the
other hook's does not.

Both persist to the **same** `localStorage` key `kaneo:board-filters:${projectId}` and both
carry a **copy-pasted** `normalizeFilters` / `DEFAULT_FILTERS` / `FILTER_KEYS` block.

Both return `{ filters, setFilters, updateFilter, updateLabelFilter, filteredProject,
hasActiveFilters, clearFilters }`.

Test: `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` (184 lines,
Vitest + `renderHook`) seeds `window.localStorage` then asserts filtered tasks — that
seeding pattern will need rework if persistence moves to the URL.

## How assignees are surfaced

`Task` (`apps/web/src/types/task/index.ts`) carries `userId`, `assigneeId`, `assigneeName`,
`assigneeImage`, `labels?: TaskLabel[]`. **Both hooks filter on `task.userId`, not
`assigneeId`** — worth preserving deliberately rather than "fixing" mid-run. Options come
from `useGetActiveWorkspaceUsers(workspaceId)`; the toolbar reads `users.members[].userId`
and `members[].user.{image,name}`, rendering `Avatar`/`AvatarFallback`/`AvatarImage` with
`getInitials`.

## Label domain

API: `apps/api/src/label/index.ts` (Hono + `describeRoute` + Valibot + `workspaceAccess`
middleware), eight controllers under `apps/api/src/label/controllers/`, mounted at
`apps/api/src/index.ts:612` as `api.route("/label", label)`. Web: seven fetchers under
`fetchers/label/`, query hooks `use-get-labels-by-workspace` (queryKey
`["labels", workspaceId]`) and `use-get-labels-by-task`, plus `lib/get-task-label-options.ts`
and `constants/label-colors.ts`.

**No API change should be needed** — filtering is client-side over already-fetched tasks.

## i18n

`i18n/en-US.json` already has `tasks.boardFilters` with `filterBy`, `allStatuses`,
`allPriorities`, `allAssignees`, `allDueDates`, `allLabels`, `selectedCount`,
`subjects.{status,priority,assignee,dueDate,labels}`, `operators.{isAnyOf,includeAnyOf}`.
AGENTS.md: user-facing copy must use static i18n keys, `en-US.json` is the source of truth,
and `pnpm i18n:check` gates it.

## Hazards for the packet planner

1. **Search-param clobbering — the big one.** Several call sites do
   `navigate({ to: ".", search: { taskId } })` or `search: {}`, which **replaces the whole
   search object**. Once filters live in the URL, each of these wipes them. Affected:
   `board.tsx:96-102` (`handleCloseTaskSheet`, `search: {}`),
   `components/kanban-board/index.tsx:67,74`, `components/list-view/index.tsx:97,104`,
   `components/list-view/task-row.tsx:148-155`, `components/task/task-details-sheet.tsx:55`.
   All must move to the functional form `search: (prev) => ({ ...prev, taskId })`.
2. **Dual persistence.** The `localStorage` write-back `useEffect` will overwrite
   URL-provided filters on mount unless precedence is decided explicitly (URL-wins-on-load
   is the usual answer).
3. **Shared storage key.** `kaneo:board-filters:${projectId}` is read by other consumers;
   changing its shape has reach.
4. **Duplicated logic.** `normalizeFilters` exists twice. Any serialization change must
   land in both — or be consolidated deliberately, noting that AGENTS.md says stay focused
   and avoid opportunistic refactors.
5. **Array-valued search params.** `BoardFilters` values are `string[] | null`.
   `validateSearch` must accept both a bare string and an array, since a single-element
   query string commonly parses as a bare string.
6. **`routeTree.gen.ts` is generated.** Never hand-edit.
7. **i18n + Biome.** New copy needs `en-US.json` keys; never run `pnpm lint` wholesale.

## Likely write scope

```
apps/web/src/routes/.../project/$projectId/board.tsx
apps/web/src/components/board/board-toolbar.tsx
apps/web/src/hooks/use-task-filters-with-labels-support.ts
apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx
apps/web/src/components/kanban-board/index.tsx
apps/web/src/components/list-view/index.tsx
apps/web/src/components/list-view/task-row.tsx
apps/web/src/components/task/task-details-sheet.tsx
i18n/en-US.json
```

---

## Scan notes

1578 tracked files; no sampling, no timeouts, within the Tier 1 budget. Tier 2b adaptive
stack profile triggered (React/Vite + Hono has no pre-authored adapter among
`generic.md` / `nest.md` / `python.md`) — written to `.sdlc/baseline/stack-profile.md`.

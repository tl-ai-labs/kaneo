# Brownfield discovery — Kaneo

- **Run id:** `20260826-132654-feature-extend-board-filter-chips`
- **Mode:** `first-time` (full scan)
- **Built at:** 2026-08-26T13:26:54Z
- **Plugin version:** 0.6.0
- **Scope:** Tier 1 local reads + Tier 2b adaptive stack profile (triggered)

---

## Group 1 — git state

| Field | Value |
|---|---|
| HEAD | `5d1fc9104337786c3ef295ec0dc31656df371d8d` |
| Branch | `feature-extend-3/opus-sonnet` |
| Dirty | **yes** — untracked only |
| Untracked | `.claude/settings.local.json`, `.hook-logs/`, `.sdlc/` |
| Remote | `origin` → `https://github.com/tl-ai-labs/kaneo.git` |
| Tracked files | 1578 |
| `.sdlc/` gitignored | **NO** |

No tracked-file modifications. The worktree is at pristine main-equivalent state — a clean rollback anchor.

## Group 2 — directory topology

Top level: `apps/`, `packages/`, `tests/`, `charts/`, `deploy/`, `i18n/`, `scripts/`, `sentry/`, `plans/`, `skills/`, `.agents/`, `.claude/`, `.cursor/`, `.devcontainer/`, `.github/`, `.husky/`, `.vscode/`.

- `apps/` → `api`, `web`, `site`, `docs`
- `packages/` → `email`, `libs`, `mcp`, `permissions`, `planka-import`, `typescript-config`
- `tests/` → `api`, `api-integration`

Entry points: `apps/api/src/index.ts`, `apps/web/src/main.tsx`.

## Group 3 — Detected stacks

Single-language monorepo, TypeScript throughout. Node `>=20.19.0`, pnpm `10.32.1`, TypeScript `7.0.2`.

| Manifest | Role | Frameworks |
|---|---|---|
| `package.json` | monorepo root | Turborepo, pnpm workspaces, Biome, Husky, commitlint |
| `apps/api/package.json` | API | Hono, hono-openapi, Better Auth, Drizzle ORM, Valibot, ioredis, pg, Vitest, Sentry, MCP SDK |
| `apps/web/package.json` | Web | React, Vite, TanStack Router + Query, Zustand, nanostores, Tailwind, Radix/Base UI, dnd-kit, Tiptap, react-i18next, **zod**, Vitest + Testing Library + jsdom |
| `apps/site/package.json` | Public site | Next.js |
| `packages/libs/package.json` | Shared typed Hono client | Hono |
| `packages/permissions/package.json` | Permission vocabulary | Better Auth |

## Group 4 — Proposed test command

**`pnpm test`** — from `package.json#scripts.test` (`turbo test`). Runner is **Vitest** everywhere.

Narrower commands, preferred for this run's blast radius:

```
pnpm --filter @kaneo/web test
pnpm --filter @kaneo/web exec vitest run --config vitest.config.ts src/hooks/use-task-filters-with-labels-support.test.tsx
pnpm --filter @kaneo/web typecheck
```

API: `pnpm --filter @kaneo/api test` (unit), `test:integration` (PostgreSQL-backed).

> **Warning:** root and package `lint` scripts run `biome check --write .` and will rewrite unrelated files. Do not use lint as a verification step. `AGENTS.md` says the same.

## Group 5 — Docs

`README.md`, `CLAUDE.md`, `AGENTS.md` (canonical — `CLAUDE.md` just `@`-includes it), `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `ENVIRONMENT_SETUP.md`, `LICENSE`, plus `apps/docs/` content and a `plans/` directory. No ADR directory.

`AGENTS.md` is unusually prescriptive and should be treated as binding: API owns authorization, Valibot for API validation, `requireWorkspacePermission`, `publishEvent()`, fetchers in `apps/web/src/fetchers/`, static i18n keys with `i18n/en-US.json` as source of truth, no commits/PRs unless asked.

## Group 6 — Detected AI/agent setup

| Path | Type |
|---|---|
| `.claude/` | Claude Code project config |
| `.claude/settings.local.json` | local settings (untracked) |
| `.claude/skills/` | 11 skills |
| `CLAUDE.md` / `AGENTS.md` | instruction files |
| `.agents/skills/` | 10 skills (mirror) |
| `skills/` | 10 skills (mirror) |
| `.cursor/rules/` | 7 `.mdc` rule files |

`.cursor/rules/` contains `backend-api.mdc`, `cursor-rules.mdc`, `database-schema.mdc`, `deployment-devops.mdc`, `development-conventions.mdc`, `frontend-web.mdc`, `project-overview.mdc`.

**Absent:** `.mcp.json`, `.cursorrules`, `.aider.conf.*`, `.continue/`, `.github/copilot-instructions.md`, `.roo/`, repo-local `routing-policy.yaml`, `gemini*.{yaml,json}`.

## Group 7 — Env keys (names only, no values read)

Files: `.env`, `.env.local`, `.env.sample`, `apps/api/.env.test.example`, `apps/web/.env.development`, `apps/web/.env.production`.

30 distinct declared keys (Postgres, auth secret, SMTP, GitHub app/OAuth, Kaneo URLs, Vite public vars). Code references ~100 keys (S3, Redis Sentinel/Cluster, Sentry, Creem billing, custom OAuth, Discord/Google/GitHub providers, Turnstile). Full lists in `baseline.json`. **No values were read or recorded.**

Nothing in this run's likely scope needs a credential — the board filter surface is client-side only.

## Group 8 — Monorepo / submodules / LFS / infra

- **Monorepo:** pnpm workspace (`packages/**`, `apps/**`) + Turborepo. 10 packages.
- **Submodules:** none.
- **Git-LFS:** not in use (`.gitattributes` present but no lfs filters).
- **Infra:** 13 GitHub workflows, Helm chart at `charts/kaneo`, `deploy/`, `.devcontainer/`, Husky hooks. No repo-root Dockerfile or compose file; no Terraform, GitLab CI, CircleCI, or Jenkins.

## Group 9 — Regulated-repo signals

One weak signal: `SECURITY.md` at repo root.

No HIPAA/PCI/SOC2/GDPR/compliance directories, no `CODEOWNERS`. This is a standard open-source vulnerability-disclosure file, not a compliance obligation marker. Flag is set for Gate 0 completeness but should be read as informational.

## Coexistence risks

- You have Cursor rules at `.cursor/rules/` (7 `.mdc` files, including `frontend-web.mdc` and `development-conventions.mdc`). The plugin will never touch them, but if you have Cursor's auto-lint or format-on-save running, changes we make may trigger it.
- Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run. `.claude/settings.local.json` and `.hook-logs/` are in the same position.
- No custom `.mcp.json` and no repo-local `routing-policy.yaml` — nothing silently redirects dispatch or routing.
- Three overlapping skill trees (`.claude/skills/`, `.agents/skills/`, `skills/`) carry the same 10-11 skill names. All are off-limits; do not "reconcile" them.
- The repo-wide `lint` script rewrites files with Biome. Never invoke it as verification.

## Proposed off-limits

```
.git/**
.env, .env.*, .env.local, .env.sample
apps/api/.env.test.example, apps/web/.env.development, apps/web/.env.production
.claude/**, CLAUDE.md, CLAUDE.local.md, AGENTS.md
.agents/**, skills/**
.cursor/**
.husky/**
node_modules/**, **/node_modules/**
dist/**, build/**, .next/**, out/**, .turbo/**, coverage/**
pnpm-lock.yaml
apps/web/src/routeTree.gen.ts      (TanStack Router generated — regenerate, never hand-edit)
apps/api/drizzle/**                (drizzle-kit generate output)
apps/web/.tanstack/**
.hook-logs/**
.sdlc/**
```

`apps/web/src/routeTree.gen.ts` deserves emphasis: it is regenerated by `@tanstack/router-plugin` and carries an explicit "do NOT make any changes" header, and Biome is configured to ignore it.

---

## Scoping-hint findings (board filter chips)

### Current `BoardSearchParams` and `validateSearch`

`apps/web/src/routes/.../project/$projectId/board.tsx:24-35`

```ts
type BoardSearchParams = {
  taskId?: string;
};

export const Route = createFileRoute(".../board")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): BoardSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});
```

Search state holds exactly one key: `taskId` (drives the task-details sheet). **No filter state lives in the URL today.**

### Existing filter UI in `board-toolbar.tsx`

676 lines. Filter chips **already exist** — `ActiveFilterChip` is defined at lines 78-108 and rendered five times (lines 534, 560, 585, 610, 635) for status, priority, assignee, dueDate, labels. Each chip renders `subject / operator / value / clear-button` and calls `updateFilter(key, null)` (labels use `clearLabelFilters`). Filter selection itself is a `DropdownMenu` with `DropdownMenuSub` submenus per facet. Helper `StackedIcons` renders up to 3 overlapped icons. All copy goes through `t("tasks:boardFilters.*")`.

### The two filter hooks

- `apps/web/src/hooks/use-task-filters.ts` (212 lines) — exports `BoardFilters`, `DUE_DATE_FILTER_VALUES`, `useTaskFilters`. No label filtering, no text query, no memoization.
- `apps/web/src/hooks/use-task-filters-with-labels-support.ts` (242 lines) — the one the board actually uses. Adds label filtering and a `textQuery` param; wraps `filterTasks` in `useCallback` and `filteredProject` in `useMemo`.

These two are near-duplicates: `DEFAULT_FILTERS`, `FILTER_KEYS`, `normalizeFilters`, the storage effects, `clearFilters`, `updateFilter`, and `updateLabelFilter` are copy-pasted. `hasActiveFilters` differs subtly — the labels version treats an empty array as inactive, the base version does not.

`use-task-filters-with-labels-support.test.tsx` exists (`renderHook` + `waitFor`, `vitest` `describe/it`, seeds `window.localStorage` directly). `use-task-filters.ts` has no test.

### How filter state is currently persisted

**`localStorage`, not the URL.** Key: `` `kaneo:board-filters:${projectId}` ``. Two effects — one reads and `normalizeFilters()`-guards on `storageKey` change, one writes `JSON.stringify(filters)` on every change. `normalizeFilters` accepts only string arrays and coerces empty arrays to `null`. Consequence: filters do not survive a link share and do not sync across tabs, but they do survive reload.

### `navigate()` call sites that replace the whole search object

Every one of these passes a literal object, so any new search key would be silently dropped:

| File:line | Call |
|---|---|
| `apps/web/src/routes/.../board.tsx:97-101` | `navigate({ to: ".", search: {}, replace: true })` — `handleCloseTaskSheet` |
| `apps/web/src/components/kanban-board/task-card.tsx:149-152` | `navigate({ to: ".", search: {} })` — deselect |
| `apps/web/src/components/kanban-board/task-card.tsx:153-157` | `navigate({ to: ".", search: { taskId: task.id } })` |
| `apps/web/src/components/kanban-board/index.tsx:67` | `navigate({ to: ".", search: { taskId: state.focusedTaskId } })` — `j` shortcut |
| `apps/web/src/components/kanban-board/index.tsx:74` | same — `k` shortcut |
| `apps/web/src/components/list-view/task-row.tsx:148-151` | `navigate({ to: ".", search: {} })` |
| `apps/web/src/components/list-view/task-row.tsx:152-156` | `navigate({ to: ".", search: { taskId: task.id } })` |
| `apps/web/src/components/list-view/index.tsx:97` | `navigate({ to: ".", search: { taskId: ... } })` — `j` |
| `apps/web/src/components/list-view/index.tsx:104` | same — `k` |

Not board-reachable but structurally identical (same bug class, sibling routes): `backlog.tsx:77`, `gantt.tsx:404`, `backlog-task-row.tsx:105`.

TanStack Router supports `search: (prev) => ({ ...prev, taskId })`. None of these use it.

### Does `apps/web` depend on a schema validation library?

**Yes — `zod`, imported as `zod/v4`.** (`valibot` is API-side only; zero imports in `apps/web`.)

Routes that pass a zod schema object directly to `validateSearch`:

- `apps/web/src/routes/auth/sign-in.tsx:30-38` — `z.object({ invitationId, email, redirect, error }).optional()` fields
- `apps/web/src/routes/auth/sign-up.tsx:34`
- `apps/web/src/routes/device/index.tsx:14-20` — `z.object({ user_code: z.string().optional() })`
- `apps/web/src/routes/device/approve.tsx:19`
- `apps/web/src/routes/mcp.authorize.tsx:19`

Routes that hand-roll a validator function instead: `board.tsx:32`, `backlog.tsx:51`, `gantt.tsx:37`, `auth/verify-otp.tsx:31`, `auth/check-email.tsx:9`.

So both idioms are established in-repo; the zod-schema idiom is the newer and more robust one, and there is precedent for using it in `validateSearch`.

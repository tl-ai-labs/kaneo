# Brownfield discovery — Kaneo

- **Run ID:** `20260904-061318-feature-extend-board-filter-chips`
- **Mode:** `first-time` (no `.sdlc/baseline/current.json` existed)
- **Built at:** 2026-09-04T06:13:18Z
- **Plugin version:** 0.6.0
- **Scan cost:** Tier 1 local reads only, ~12s. No sampling fallback needed.

---

## 1. Git state

| Field | Value |
|---|---|
| HEAD | `5d1fc9104337786c3ef295ec0dc31656df371d8d` |
| Branch | `feature-extend-3/opus-flash-sdk` |
| Remote | `origin` → `https://github.com/tl-ai-labs/kaneo.git` |
| Dirty | **yes** (untracked only) |
| Stash entries | none |
| `.gitignore` covers `.sdlc/` | **no** |

### Dirty worktree — must be preserved

The worktree is dirty. As of this scan there are **no staged and no unstaged modifications**; the dirt is entirely untracked paths:

```
?? .claude/settings.local.json
?? .hook-logs/
?? .sdlc/
```

Two notes for downstream phases:

1. **Preserve all three.** `.claude/settings.local.json` carries the local `MMO_SELECT` routing override for this very run; `.hook-logs/` and `.sdlc/` are orchestration state. Deleting or "cleaning" any of them breaks the run in progress.
2. **The session-start snapshot differed.** At the time this session opened, git reported branch `feature-extend-2/opus-flash-sdk` with `.sdlc/policies/opus-flash-sdk.yaml` **staged** (`A`). That staged entry is no longer present and the branch has moved to `feature-extend-3/...`. Something re-branched and unstaged between session start and this scan. Treat the values in this document (and `baseline.json`) as authoritative for the rollback anchor, and **re-check `git status` before any write phase** rather than trusting the session-start snapshot.

Rollback anchor for this run: `5d1fc9104337786c3ef295ec0dc31656df371d8d`.

---

## 2. Directory topology

```
apps/       api, web, site, docs
packages/   libs, permissions, mcp, email, planka-import, typescript-config
tests/      api, api-integration          (not workspace packages)
i18n/       17 locale JSONs + schema.json + resources.ts
scripts/    i18n/{check,report,schema,shared}.mjs
charts/     kaneo (Helm)
deploy/     sentry/  plans/
.agents/ .claude/ .cursor/ skills/        (agent config — see §6)
.github/    13 workflows
```

Entry points: `apps/api/src/index.ts`, `apps/web/src/main.tsx`, `packages/mcp/src/index.ts`.

---

## 3. Detected stacks

Single language family: **TypeScript / Node ≥ 20.19**, pnpm 10.32.1, Turborepo.

| Package | Root | Frameworks |
|---|---|---|
| `@kaneo/api` | `apps/api` | Hono, hono-openapi, Better Auth, Drizzle ORM, Valibot, ioredis, Postgres, MCP SDK, Sentry |
| `@kaneo/web` | `apps/web` | **React + Vite + TanStack Router + TanStack Query**, Zustand, nanostores, react-i18next, Tailwind, Radix/Base UI, dnd-kit, TipTap |
| `@kaneo/site` | `apps/site` | Next.js, Tailwind, shadcn |
| `@kaneo/libs` | `packages/libs` | typed Hono client |
| `@kaneo/permissions` | `packages/permissions` | Better Auth permission vocabulary |
| `@kaneo/mcp` | `packages/mcp` | MCP SDK, zod |
| `@kaneo/email` | `packages/email` | react-email, nodemailer |
| `@kaneo/planka-import` | `packages/planka-import` | — |

Test runner is **Vitest** everywhere. Linter/formatter is **Biome 2.5.7**.

---

## 4. Test / typecheck / lint — how they are actually invoked

Root scripts fan out through Turborepo, and `test`, `typecheck`, and `build` all declare `dependsOn: ["^build"]`. Root `pnpm test` therefore rebuilds every workspace package before running anything — expensive and unnecessary for a web-only change.

**Proposed for this run (web-scoped):**

```bash
pnpm --filter @kaneo/web test        # vitest run --config vitest.config.ts
pnpm --filter @kaneo/web typecheck   # tsc --noEmit on tsconfig.app.json AND tsconfig.node.json
pnpm --filter @kaneo/web exec biome ci .
```

> **Lint hazard.** Every `lint` script in this repo — root and per-package — is `biome check --write .`, which rewrites files, including files unrelated to the change. Use `biome ci` (check-only) while iterating. `AGENTS.md` states this explicitly.

Web Vitest config (`apps/web/vitest.config.ts`): jsdom environment, `setupFiles: ["./src/test/setup.ts"]`, `include: ["src/**/*.test.{ts,tsx}"]`, aliases `@` → `./src` and `@i18n` → `../../i18n`.

API tests live outside the package: `tests/api` (unit, `vitest.config.ts`) and `tests/api-integration` (Postgres-backed, `vitest.integration.config.ts`), both driven by `@kaneo/api`.

Gate 0 should confirm `pnpm --filter @kaneo/web test` as the verification command for this run.

---

## 5. Docs present

`README.md`, `AGENTS.md` (canonical agent guide), `CLAUDE.md` (thin — imports `@AGENTS.md`), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `CHANGELOG.md`, `ENVIRONMENT_SETUP.md`, `apps/docs/` (product + API reference), `tests/api-integration/README.md`.

`AGENTS.md` is load-bearing: it constrains architecture boundaries, conventions, verification depth, and explicitly forbids mixing requested work with speculative refactors. Downstream phases should treat it as a hard constraint, not advice.

---

## 6. Detected AI / agent setup

| Path | Type |
|---|---|
| `CLAUDE.md` | Claude Code project instructions (imports `AGENTS.md`) |
| `AGENTS.md` | canonical agent guide |
| `.claude/settings.local.json` | local settings — sets `MMO_SELECT=gemini-flash=flash-agsdk-worker` |
| `.claude/skills/` | symlinks → `../../.agents/skills/*` (10 skills) + local `verify/` |
| `.agents/skills/` | skill source of truth |
| `skills/` | mirror of the same 10 skill names |
| `skills-lock.json` | skill pin file |
| `.cursor/rules/` | 7 Cursor `.mdc` rule files |
| `.coderabbit.yaml` | CodeRabbit review bot config |

**Absent:** `.mcp.json`, `.cursorrules`, `.aider.conf.*`, `.continue/`, `.github/copilot-instructions.md`, `.roo/`, repo-local `routing-policy.yaml`, any `gemini*.yaml`.

`.sdlc/project.json` (schema v2) already exists and sets `default_policy: opus-plus-flash-v37`.

---

## 7. Coexistence risks

- **Cursor rules detected.** You have Cursor rules at `.cursor/rules/` (7 `.mdc` files: backend-api, cursor-rules, database-schema, deployment-devops, development-conventions, frontend-web, project-overview). The plugin will never touch them, but if you have Cursor's auto-lint-on-save running, changes we make may trigger it — and Biome here is configured with `--write`.
- **Three-way skill mirror.** `.claude/skills/` symlinks into `.agents/skills/`, and `skills/` mirrors the same names with `skills-lock.json` pinning them. Editing any one surface silently desyncs the other two. All three are off-limits.
- **`.claude/settings.local.json` is live routing config.** It sets `MMO_SELECT=gemini-flash=flash-agsdk-worker`. Modifying it mid-run changes model routing under the run's feet. Off-limits.
- **No custom `.mcp.json`.** Nothing to conflict with; the plugin's bundled `model-dispatch` server is the only dispatch path.
- **No repo-local `routing-policy.yaml`.** Routing comes from `.sdlc/project.json` → `opus-plus-flash-v37`. Nothing silently overriding.
- **CodeRabbit is watching.** `.coderabbit.yaml` is configured, so any PR opened from this work draws automated review comments. Not a blocker, but expect noise.
- **`.sdlc/` is not gitignored.** Your `.gitignore` doesn't cover `.sdlc/` (nor `.hook-logs/`). Run artifacts under `.sdlc/` — packets, backups, telemetry, and `backups/<file>` which may echo source content of files touched this run — will be untracked but visible to `git add -A`, and a distracted commit could push them. Gate 0 should offer to add `.gitignore` to this run's allowlist so the plugin can append `.sdlc/` and `.hook-logs/` as part of the run.

---

## 8. Regulated-repo signals

One weak signal: `SECURITY.md` at repo root. This is a standard OSS vulnerability-disclosure policy, not a compliance framework marker — no `HIPAA/`, `PCI/`, `SOC2/`, `GDPR`, `compliance/`, or `regulated/` paths exist, and there is no `CODEOWNERS` naming a security/compliance/legal team.

`regulated_repo_warning_required: false`. No Gate 0 regulated-repo prompt needed.

---

## 9. Env keys (names only — no values read)

- `.env` — `AUTH_SECRET`, `DATABASE_URL`, `KANEO_API_URL`, `KANEO_CLIENT_URL`, `POSTGRES_{DB,HOST,PASSWORD,PORT,USER}`
- `.env.local` — `POSTGRES_{DB,HOST,PASSWORD,PORT,USER}`
- `.env.sample` — the above plus `GITHUB_*` app/OAuth/webhook keys and `SMTP_*`

Code references a much wider set (Creem billing, Discord, Google, custom OAuth, device auth, notification encryption). Full list in `baseline.json`.

No values were read, recorded, or transmitted.

---

## 10. Monorepo, submodules, LFS

- **Monorepo:** pnpm workspace (`packages/**`, `apps/**`) + Turborepo. 9 packages.
- **Submodules:** none (`.gitmodules` absent).
- **Git LFS:** not in use. `.gitattributes` contains only a `.husky/* text eol=lf` rule.

---

## 11. Infra

`Dockerfile.kaneo`, `compose.yml`, `compose.local.yml`, Helm chart at `charts/kaneo`, `deploy/`, Sentry config, and 13 GitHub Actions workflows (`ci`, `docker`, `helm-chart`, `release`, `nightly`, `publish-mcp`, …). No Terraform, GitLab CI, CircleCI, or Jenkins.

---

## 12. Scope findings for this run — Board filter chips

The stated job is "add assignee and label filter chips with URL-persisted state to the web Board view." **Read the following before planning, because the premise is partly already satisfied.**

### The chips already exist

`apps/web/src/components/board/board-toolbar.tsx` already implements a full `ActiveFilterChip` component (subject / operator / value / clear-button segments) and already renders chips for **status, priority, assignee, due date, and labels**, including stacked avatar previews for assignees and a `selectedCount` fallback when more than one value is selected. The filter dropdown already has assignee and label submenus with checkbox slots.

So the deliverable is **not** "build chips." The genuine gap is the second half of the request.

### The gap: state is in localStorage, not the URL

`apps/web/src/hooks/use-task-filters-with-labels-support.ts` (the hook the board actually uses) holds filters in `useState` and persists them to `window.localStorage` under `kaneo:board-filters:${projectId}`. Same pattern in the older `use-task-filters.ts` and in `use-board-sort.ts` (`kaneo:board-sort:${projectId}`). Nothing about filter state reaches the URL, so filtered board views are not shareable or back/forward navigable.

Meanwhile the board route's search schema is minimal:

```ts
type BoardSearchParams = { taskId?: string };

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): BoardSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});
```

Two live hazards for a URL-migration:

1. `handleCloseTaskSheet` calls `navigate({ to: ".", search: {}, replace: true })` — it **wipes the entire search object** to clear `taskId`. Once filters live in search params, closing the task sheet would silently drop every active filter. Same wipe pattern exists in `backlog.tsx`.
2. Both `use-task-filters.ts` and `use-task-filters-with-labels-support.ts` exist with near-duplicate `normalizeFilters`/`FILTER_KEYS`/`DEFAULT_FILTERS` blocks. Only the `-with-labels-support` variant is wired to the board. Changing one without the other leaves a divergent copy; deleting the unused one is a refactor beyond a feature-extend and `AGENTS.md` forbids opportunistic scope expansion.

### Files in play

Primary:
- `apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx`
- `apps/web/src/components/board/board-toolbar.tsx`
- `apps/web/src/hooks/use-task-filters-with-labels-support.ts`
- `apps/web/src/hooks/use-task-filters.ts`

Secondary / reference:
- `apps/web/src/hooks/use-board-sort.ts` — the localStorage-persistence precedent, with `normalizeSort` type guards worth mirroring for search-param validation
- `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` — the existing test to extend
- `apps/web/src/hooks/use-board-sort.test.tsx` — persistence-hook test shape
- `apps/web/src/components/kanban-board/`, `apps/web/src/components/list-view/` — both consume the filtered project; the board toggles between them

Existing `validateSearch` precedents to copy from: `backlog.tsx`, `gantt.tsx`, `auth/sign-in.tsx`, `device/approve.tsx`, `mcp.authorize.tsx` — all use the same hand-rolled `typeof search.x === "string" ? … : undefined` idiom. There is **no** zod/valibot search-schema precedent in `apps/web`; do not introduce one.

### i18n

Keys live in `i18n/en-US.json`, namespace `tasks.boardFilters`, and are already populated:

```
filterBy, allStatuses, allPriorities, allAssignees, allDueDates, allLabels,
selectedCount ("{{count}} selected"),
subjects.{status,priority,assignee,dueDate,labels},
operators.{isAnyOf,includeAnyOf}
```

17 locales exist (`i18n/*.json`), registered in `i18n/resources.ts`, `en-US` is the reference. **`i18n/schema.json` is generated** from the reference locale by `scripts/i18n/schema.mjs` with `additionalProperties: false`, so **any new `en-US.json` key invalidates the strict schema until you run `pnpm i18n:schema`**. Run that, never `pnpm i18n:check:fix`. If the change adds no new copy — likely, since the chip strings already exist — no i18n step is needed at all.

### Suggested Gate 0 framing

Confirm with the user which is wanted, because they are different jobs:
- (a) migrate existing board filter state from localStorage to URL search params (shareable/back-button behavior), or
- (b) genuinely new chip UI beyond the five subjects already shipped.

Reading of the code says (a).

---

## 13. Proposed off-limits

```
.env  .env.*  .env.local  .env.sample
.claude/**  .agents/**  skills/**  skills-lock.json
.cursor/**  .coderabbit.yaml  .mcp.json
.husky/**  .github/**
.hook-logs/**  .sdlc/**  .turbo/**  .git/**
node_modules/**  dist/**  build/**  .next/**
pnpm-lock.yaml
apps/web/src/routeTree.gen.ts        (generated by TanStack Router, @ts-nocheck header)
i18n/schema.json                     (generated — regenerate via `pnpm i18n:schema`)
i18n/<all non-en-US locales>         (translation pipeline owns these)
charts/**  deploy/**
apps/api/src/database/migrations/**  (generated by drizzle-kit)
```

The user may move any of these into scope at Gate 0. Recommended exception: **`.gitignore`** should be added to the allowlist so the plugin can append `.sdlc/` and `.hook-logs/` (see §7).

---

## 14. Adaptive stack profile

**Triggered.** The primary stack for this run — React + Vite + TanStack Router — has no pre-authored adapter (shipped adapters are `generic.md`, `nest.md`, `python.md`). A learned profile was written to `.sdlc/baseline/stack-profile.md` and should be passed to the packet planner as authoritative.

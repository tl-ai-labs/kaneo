# Discovery — Kaneo

- **run_id**: `20260831-092456-feature-extend-estimated-hours`
- **mode**: `first-time` (full scan)
- **intent_hint**: `feature-extend`
- **built_at**: 2026-08-31T09:27:49Z
- **plugin_version**: 0.6.0

Scope note: this describes the working tree at `5d1fc910` on branch `feature-extend-2/flash-agsdk`. No sibling branch was read, diffed or consulted.

---

## 1. Git state

| field | value |
|---|---|
| HEAD | `5d1fc9104337786c3ef295ec0dc31656df371d8d` |
| branch | `feature-extend-2/flash-agsdk` |
| upstream | none (branch not pushed) |
| dirty | **yes — untracked only, no tracked modifications** |
| remote | `origin` → `https://github.com/tl-ai-labs/kaneo.git` |
| tracked files | 1578 |
| `.gitignore` covers `.sdlc` | **no** |

Untracked entries present before the run:

```
?? .claude/settings.local.json
?? .hook-logs/
?? .sdlc/
```

No tracked file is modified or staged. The tree is clean enough for a safe rollback anchor at `5d1fc910`, but the three untracked paths must be preserved (`AGENTS.md`: "Preserve unrelated work in a dirty worktree").

## 2. Topology

```
.agents/  .claude/  .cursor/  .devcontainer/  .github/  .husky/  .vscode/
apps/  charts/  deploy/  i18n/  packages/  plans/  scripts/  sentry/  skills/  tests/
```

Entry points: `apps/api/src/index.ts` (Hono app, `app.route("/api", api)`), `apps/web/src/main.tsx`.

## 3. Detected stacks

Single language: **TypeScript on Node ≥ 20.19**, ESM (`"type": "module"`), pnpm 10.32.1 + Turborepo.

| package | root | frameworks |
|---|---|---|
| `@kaneo/api` | `apps/api` | Hono, hono-openapi, Drizzle ORM (postgres), Better Auth, Valibot, Vitest, ioredis, MCP SDK |
| `@kaneo/web` | `apps/web` | React, Vite, TanStack Router + Query, dnd-kit, Tailwind, Radix/Base UI, i18next, Vitest + Testing Library |
| `@kaneo/site` | `apps/site` | Next.js |
| `@kaneo/libs` | `packages/libs` | typed Hono client (`hc`) |
| `@kaneo/permissions` | `packages/permissions` | Better Auth access control |
| `@kaneo/mcp` | `packages/mcp` | MCP SDK (stdio), zod |
| `@kaneo/email` | `packages/email` | react-email, nodemailer |
| `@kaneo/planka-import` | `packages/planka-import` | — |
| `@kaneo/typescript-config` | `packages/typescript-config` | — |

`apps/docs` has **no** `package.json` — it is documentation content rendered by `apps/site`.

## 4. Monorepo signals

- `pnpm-workspace.yaml` with globs `packages/**`, `apps/**`, plus a large `overrides` block (security pins).
- `turbo.json` with tasks `build`, `dev`, `lint`, `typecheck`, `test`, `test:integration`. `test` declares `dependsOn: ["^build"]` — this is why root `pnpm test` is expensive.
- **No submodules** (`.gitmodules` absent). **No Git-LFS** (`.gitattributes` has no lfs filters).
- `tests/` at repo root is **not** a workspace package. It has no `package.json`; its files are picked up by `@kaneo/api`'s vitest configs through relative include globs.

## 5. Test / build commands

**Proposed test command:**

```
pnpm --filter @kaneo/api test:unit && pnpm --filter @kaneo/web test
```

Source: `apps/api/package.json#scripts.test:unit`, `apps/web/package.json#scripts.test`.

Caveats Gate 0 must confirm:

1. **Do not use root `pnpm test`.** It is `turbo test` with `dependsOn: ["^build"]` and rebuilds every workspace package. (Consistent with the user's stored preference for filtered commands.)
2. `pnpm --filter @kaneo/api test` is an alias for `test:unit` and runs **only** `tests/api/**/*.test.ts` per `vitest.config.ts`. It does **not** cover integration.
3. Integration is a separate command: `pnpm --filter @kaneo/api test:integration` → `vitest.integration.config.ts`, includes `tests/api-integration/**/*.test.ts`, uses `tests/api-integration/setup.ts`, runs serially (`fileParallelism: false`, `maxWorkers: 1`), and aliases `@kaneo/email` to a mock. **It needs a live PostgreSQL.** A schema + migration change is proved here, not in unit tests.
4. **Lint is destructive.** Root and package `lint` scripts are `biome check --write .`. The read-only equivalent, and what CI runs, is `pnpm exec biome ci .`.
5. Typecheck is per-package. Web runs two projects: `tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.node.json`.

CI (`.github/workflows/ci.yml`) runs, as separate jobs: `pnpm exec biome ci .`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:integration`, plus a Docker smoke build.

Per-surface commands:

| surface | command |
|---|---|
| API unit | `pnpm --filter @kaneo/api test:unit` |
| API integration | `pnpm --filter @kaneo/api test:integration` |
| Web | `pnpm --filter @kaneo/web test` |
| libs / permissions | `pnpm --filter @kaneo/libs test`, `pnpm --filter @kaneo/permissions test` |
| typecheck | `pnpm --filter @kaneo/api typecheck`, `pnpm --filter @kaneo/web typecheck` |
| lint (read-only) | `pnpm exec biome ci .` |
| i18n | `pnpm i18n:check` / `pnpm i18n:check:fix` |
| migration | `pnpm --filter @kaneo/api db:generate` |

## 6. Docs present

`README.md`, `CLAUDE.md`, `AGENTS.md` (canonical; `CLAUDE.md` just `@`-includes it), `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `ENVIRONMENT_SETUP.md`, `CHANGELOG.md`, `apps/docs/`, `plans/`, `tests/api-integration/README.md`.

No ADR directory (`docs/adr`, `docs/decisions`, `adr/` all absent).

## 7. Detected AI / agent setup

| path | type |
|---|---|
| `.claude/` | Claude Code project config |
| `.claude/settings.local.json` | local settings (untracked) |
| `.claude/skills/` | 13 skill dirs (design/animation oriented) |
| `CLAUDE.md` | Claude instructions → includes `AGENTS.md` |
| `AGENTS.md` | canonical agent guide |
| `.agents/skills/` | mirror of `skills/` |
| `skills/` | 10 skill dirs |
| `.cursor/rules/` | 7 `.mdc` files |
| `.vscode/`, `.devcontainer/` | editor / container config |

Absent: `.mcp.json`, `.cursorrules`, `.aider.conf.*`, `.continue/`, `.github/copilot-instructions.md`, `.roo/`, `routing-policy.yaml`, any `gemini*.{yaml,json}`.

`.cursor/rules` contents: `backend-api.mdc`, `cursor-rules.mdc`, `database-schema.mdc`, `deployment-devops.mdc`, `development-conventions.mdc`, `frontend-web.mdc`, `project-overview.mdc`.

## 8. Coexistence risks

- **Cursor rules detected** at `.cursor/rules/` (7 `.mdc` files, including `database-schema.mdc` and `frontend-web.mdc` which cover exactly the surfaces this feature touches). The plugin will never touch them, but if Cursor's auto-lint runs on save, changes we make may trigger it.
- **No `.mcp.json`.** The repo *does* ship MCP code (`apps/api/src/mcp` HTTP routes, `packages/mcp` published stdio server), but neither is a Claude Code MCP registration for this repo, so nothing is picked up implicitly.
- **No repo-local `routing-policy.yaml`** — policy resolution falls through to the shipped policy or `--policy`.
- **`.sdlc/` is not gitignored.** Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` to this run's allowlist so the plugin can add the entry as part of the run.
- **Husky + commitlint are active.** `.husky/` is installed and `@commitlint/config-conventional` is configured, so any commit must be a conventional commit.
- **`lint` rewrites files.** Root and package `lint` = `biome check --write .`, which can modify unrelated files. Use `pnpm exec biome ci .`.

## 9. Regulated-repo signals

- `SECURITY.md` — present at repo root (enumerated group 9 marker).

No `PRIVACY.md` / `COMPLIANCE.md` / `HIPAA.md` / `SOC2.md` / `PCI.md` / `GDPR.md`, no compliance-named directories, no `CODEOWNERS`.

`regulated_repo_warning_required: true`.

## 10. Env keys (names only — no values read)

Files: `.env`, `.env.local`, `.env.sample`, `apps/api/.env.test.example`, `apps/web/.env.development`, `apps/web/.env.production`.

`.env` and `.env.local` are untracked-or-ignored local files containing real Postgres credentials and `AUTH_SECRET`. Names only were extracted; **no value was read or recorded.** All env files are on the off-limits list.

87 distinct env names are referenced in code (full list in `baseline.json`). None relate to this feature.

## 11. Infra hints

`Dockerfile.kaneo`, `apps/api/Dockerfile`, `apps/web/Dockerfile`; `charts/kaneo` (Helm); `deploy/`; `sentry/`; 13 GitHub workflows. No docker-compose at root, no Terraform, no GitLab CI.

---

# Focus-area findings

## A. `apps/api/src/database/schema.ts`

### `taskTable` (`pgTable("task", …)`) — 14 columns, **no estimate field exists**

```
id            text, cuid2 default, PK
projectId     text "project_id"  NOT NULL → project.id (cascade/cascade)
position      integer            default 0
number        integer            default 1
userId        text "assignee_id" → user.id (set null / cascade)
title         text               NOT NULL
description   text
status        text               NOT NULL default "to-do"
columnId      text "column_id"   → column.id (set null / cascade)
priority      text               NOT NULL default "low"
startDate     timestamp "start_date" { mode: "date" }
dueDate       timestamp "due_date"   { mode: "date" }
createdAt     timestamp          defaultNow NOT NULL
updatedAt     timestamp          defaultNow, $onUpdate NOT NULL
```

Indexes/constraints: `task_projectId_idx`, `task_dueDate_idx`, `task_assigneeId_idx`, `task_columnId_idx`, `unique("task_project_number_unique")` on (projectId, number).

There is **no** `estimatedHours`, `estimate`, `points`, or equivalent. This is a genuine additive change.

Nearest precedent for an optional numeric column on this table: none — every numeric column on `task` (`position`, `number`) is defaulted. The nearest precedent for an *optional* column is `startDate` / `dueDate` / `description`, which are nullable with no default.

### `timeEntryTable` (`pgTable("time_entry", …)`) — **out of scope, do not touch**

```
id, taskId (NOT NULL → task.id cascade), userId, description,
startTime (NOT NULL), endTime, duration integer default 0,
createdAt, updatedAt
```

`duration` here is **tracked elapsed time**, written by the time-entry module when a timer stops. It is semantically distinct from an estimate. Confirmed: this feature must not modify `timeEntryTable`, and the new field belongs on `taskTable`.

Naming risk worth flagging to the planner: `task.estimatedHours` (hours) vs `time_entry.duration` (whichever unit the time-entry module uses) sit in adjacent surfaces. Whatever unit is chosen for the estimate should be explicit in the column name so the two are never conflated.

## B. Drizzle migration workflow

- Config: `apps/api/drizzle.config.ts` — `out: "./drizzle"`, `schema: "./src/database/schema.ts"`, `dialect: "postgresql"`, URL from `resolveDatabaseConnectionString()` after `dotenv-mono` `config()`.
- Migrations live in **`apps/api/drizzle/`**: 43 `.sql` files, `0000` … `0042_previous_the_executioner.sql`.
- `pnpm --filter @kaneo/api db:generate` → `drizzle-kit generate`, which writes **three** things:
  1. `apps/api/drizzle/00NN_<codename>.sql`
  2. `apps/api/drizzle/meta/00NN_snapshot.json`
  3. a new entry appended to `apps/api/drizzle/meta/_journal.json` (`{idx, version:"7", when, tag, breakpoints:true}`)
- `db:generate` requires a reachable database URL to resolve; `db:migrate` applies.

**Is the existing set hand-edited or generated?** **Mixed, and it matters.**

- Most files carry drizzle-kit's random codename (`0042_previous_the_executioner`, `0041_famous_cable`, `0038_supreme_dagger`), i.e. generated and left alone.
- Eight carry descriptive names that drizzle-kit never emits, implying post-generation rename or hand authoring: `0014_private_assets`, `0015_add_comment_and_archival`, `0016_add_task_relation`, `0020_gitea_dedup_guards`, `0024_device_code_timestamps`, `0026_encrypt_notification_preference_secrets`, `0029_fk_supporting_indexes`, `0032_unify_task_comments`.
- Direct evidence of hand editing: one migration contains `ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "start_date" timestamp;` — `drizzle-kit` does not emit `IF NOT EXISTS` for `ADD COLUMN`.
- Evidence of deliberate data-safe authoring: `0042` is a two-statement backfill-then-tighten:
  ```sql
  UPDATE "task" SET "priority" = 'low' WHERE "priority" IS NULL;--> statement-breakpoint
  ALTER TABLE "task" ALTER COLUMN "priority" SET NOT NULL;
  ```
  This matches `AGENTS.md`: "Database changes must work for existing installations, not only empty development databases."

Implication for this feature: generate the migration with `db:generate`, inspect the SQL, and commit SQL + snapshot + journal together. An optional nullable column needs no backfill, so a plain single-statement `ALTER TABLE "task" ADD COLUMN …` is the expected output.

## C. `apps/api/src/task/**` and `apps/api/src/schemas.ts`

Layout is: `index.ts` (Hono routes + Valibot validators + OpenAPI) → `controllers/<verb-noun>.ts` (one default-exported async function each) → Drizzle.

Files: `index.ts` (903 lines), `validate-task-fields.ts`, and 17 controllers.

### `apps/api/src/schemas.ts` — `taskSchema` (Valibot, feeds OpenAPI via `resolver()`)

```ts
export const taskSchema = v.object({
  id, projectId, position: v.nullable(v.number()), number, userId,
  title, description, status,
  priority: v.picklist(["no-priority","low","medium","high","urgent"]),
  startDate: v.optional(v.date()),
  dueDate: v.optional(v.date()),
  createdAt: v.date(),
});
```

Note it is already a **partial** projection — `columnId` and `updatedAt` are absent. It is referenced by `resolver(taskSchema)` in the create, get and update route descriptions.

### Surfaces that would need the new field

| file | why |
|---|---|
| `schemas.ts` → `taskSchema` | response shape + OpenAPI |
| `task/index.ts` POST `/:projectId` | `validator("json", v.object({title, description, startDate, dueDate, priority, status, userId}))` — add the field |
| `task/index.ts` PUT `/:id` | same validator plus `projectId`, `position` |
| `controllers/create-task.ts` | destructured named-arg object → `tx.insert(taskTable).values({...})` |
| `controllers/update-task.ts` | **positional parameters** — see risk below |
| `controllers/get-task.ts` | explicit `db.select({...})` allowlist; field is invisible unless added |
| `controllers/get-tasks.ts` | explicit `taskSelection` allowlist; this is the board query |
| `controllers/bulk-update-tasks.ts`, `export-tasks.ts`, `import-tasks.ts` | carry task field sets |

**Risk to flag:** `updateTask` has an 11-parameter positional signature:

```ts
async function updateTask(
  id, title, status, startDate, dueDate, projectId,
  description, priority, position, userId?, currentUserId?
)
```

Adding a parameter mid-list is error-prone; the call site in `index.ts` passes all 11 positionally. Either append at the end after the optionals (awkward) or convert to a named-arg object like `createTask` uses. That is a judgement call for the planner, not discovery.

**Read-projection risk:** both `get-task.ts` and `get-tasks.ts` use explicit column allowlists, not `select()`. A schema-only change will silently not reach the client. `get-tasks.ts` is the board endpoint — its `taskSelection` object is what populates `columns[].tasks[]`, which is exactly what the column-header total will sum over.

**Per-field update-endpoint precedent:** the codebase already has dedicated `PUT /:id/priority`, `/due-date`, `/assignee`, `/status`, `/title`, `/description` routes, each with a one-key validator (e.g. `validator("json", v.object({ dueDate: v.optional(v.string()) }))`) and a matching controller. An estimate popover would most naturally follow this pattern rather than reusing the 11-arg full update.

**Validation precedent:** `validate-task-fields.ts` holds `VALID_PRIORITIES`, `assertValidPriority`, `assertValidTaskStatus`, `coerceStatus`, `coercePriority` — all throwing `HTTPException(400, …)`. A numeric-range guard for the estimate belongs here.

**Blast radius beyond `task/`** (using `dueDate` as a proxy for a task field that propagates): `apps/api/src/mcp/tools.ts`, `packages/mcp/src/kaneo/task-helpers.ts`, `packages/mcp/src/tools/register.ts`, `apps/api/src/project/controllers/get-projects.ts`, and the webhook/notification plugins all reference task fields. Whether the estimate should surface in MCP tools and webhooks is a scope decision for Gate 0 — `AGENTS.md` explicitly asks that this be decided deliberately rather than expanded automatically.

## D. `apps/web/src/components/kanban-board/**`

Files (8 total):

```
index.tsx                                   (280 lines, board root)
column/index.tsx                            (36)  Column shell
column/column-header.tsx                    (105) ColumnHeader  ← "LaneHeader"
column/column-dropzone.tsx                        dnd-kit droppable
task-card.tsx                               (439) TaskCard      ← "Card"
task-labels.tsx / task-labels.test.tsx
task-card-context-menu/task-card-context-menu-content.tsx
```

### Vocabulary: **Column, not Lane — confirmed explicitly**

Zero word-boundary matches for `lane` across `apps/web/src`, `apps/api/src` and `i18n/`. The single case-insensitive substring hit is the word "plane" inside a comment in `apps/web/src/lib/generate-project-id.ts`. Throughout, the concept is **Column**: directory `components/kanban-board/column/`, component `ColumnHeader`, type `ProjectWithTasks["columns"][number]`, DB table `columnTable` / `"column"`, API module `apps/api/src/column`, icon helper `@/lib/column#getColumnIcon`. The request's "Card" → `task-card.tsx`, and "LaneHeader" → `column/column-header.tsx`. Any generated code, identifier, i18n key or comment must say Column.

### `ColumnHeader` as it stands

Props are `{ column: ProjectWithTasks["columns"][number] }`. It renders a left group — icon (`getColumnIcon(column.id, column.isFinal, column.icon)`), `column.name`, and **an existing count badge**:

```tsx
<span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
  {column.tasks.length}
</span>
```

— and a right group of two icon buttons (archive-all when `column.isFinal`, add-task), both permission-gated via `useWorkspacePermission()`. A per-column estimate total has an obvious home right next to that existing count badge, and `column.tasks` is already in scope, so the sum needs no new query.

### `TaskCard` as it stands

Uses `useSortable` (dnd-kit), `useTranslation`, `useProjectStore`, `useUserPreferencesStore`. Its metadata footer already renders, in order: `TaskLabels`, priority icon via `getPriorityIcon(task.priority ?? "")`, and a due-date chip gated on a `showDueDates` user preference:

```tsx
{showDueDates && task.dueDate && (
  <div className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded ${dueDateStatusColors[...]}`}>
    … <span>{format(new Date(task.dueDate), "MMM d")}</span>
  </div>
)}
```

That chip is the pattern an estimate badge should copy — small text, `lucide-react` icon, conditional on the value being present.

### Web `Task` type

`apps/web/src/types/task/index.ts` — a hand-maintained `type Task = { … }` with `priority: string | null`, `startDate: string | null`, `dueDate: string | null`, `position: number | null`, plus optional `labels` / `externalLinks`. Dates arrive as strings. A new optional field must be added here too.

## E. Task properties sidebar and popovers

`apps/web/src/components/task/task-properties-sidebar.tsx` (769 lines) is the detail-panel host. It imports and composes seven popovers: `TaskMovePopover`, `TaskStatusPopover`, `TaskPriorityPopover`, `TaskAssigneePopover`, `TaskStartDatePopover`, `TaskDueDatePopover`, `TaskLabelsPopover`. Each is used as a wrapper around a trigger element:

```tsx
<TaskDueDatePopover task={task}>
  { …trigger markup showing the current value… }
</TaskDueDatePopover>
```

The popover contract is uniform and small (`task-due-date-popover.tsx`, 79 lines; `task-start-date-popover.tsx`, 79; `task-priority-popover.tsx`, 103):

1. Props `{ task: Task; children: React.ReactNode }`, default export.
2. `const { t } = useTranslation()`, `const [open, setOpen] = useState(false)`.
3. A dedicated mutation hook — `useUpdateTaskDueDate()` etc. — destructured as `mutateAsync`.
4. `const { canUpdateTasks } = useWorkspacePermission(); const canEdit = canUpdateTasks();`
5. **`if (!canEdit) return <>{children}</>;`** — read-only users get the trigger with no popover.
6. Handler: `try { await mutate({ ...task, field: newValue }); toast.success(t("tasks:popover.<field>.updateSuccess")); setOpen(false) } catch (error) { toast.error(error instanceof Error ? error.message : t("tasks:popover.<field>.updateError")) }`
7. `<Popover open onOpenChange><PopoverTrigger asChild>{children}</PopoverTrigger><PopoverContent …>`, plus a clear/"X" ghost `Button` when the field has a value.

The matching mutation hook (`hooks/mutations/task/use-update-task-due-date.ts`) is `useMutation({ mutationFn: (task: Task) => updateTaskDueDate(task.id, task) })` with `onSuccess` invalidating `["task", id]`, `["tasks", projectId]`, `["notifications"]`, `["projects"]`, `["activities", id]`. The fetcher lives in `apps/web/src/fetchers/task/update-task-due-date.ts`.

So a new estimate control means: fetcher → mutation hook → popover → sidebar row, four files following four existing templates.

## F. i18n layout

- **Root: `i18n/` at the repo root** (not `apps/web/src/locales`). Confirmed by `scripts/i18n/shared.mjs`: `export const i18nDir = path.join(repoRoot, "i18n")`.
- **Source of truth: `i18n/en-US.json`** — `export const defaultLocale = "en-US"`; `loadLocales()` throws `Missing reference locale: en-US.json` if absent.
- **Layout is flat**: one JSON file per locale, `i18n/<locale>.json`. There are no per-locale directories and no per-namespace files. Namespaces are top-level keys *inside* each file: `common`, `auth`, `settings`, `navigation`, `notifications`, `activity`, `tasks`, `invitations`, `workspace`, `team`, `publicProject`.
- **17 locales**: de-DE, el-GR, en-US, es-ES, fr-FR, hi-IN, id-ID, it-IT, ko-KR, mk-MK, nl-NL, pt-BR, ru-RU, tr-TR, uk-UA, vi-VN, zh-CN.
- Also in `i18n/`: `resources.ts` (i18next resource wiring) and `schema.json` (generated by `pnpm i18n:schema`).
- **Check/fix scripts exist**: `pnpm i18n:check` (reports missing + extra keys per locale against en-US, exits non-zero on drift) and `pnpm i18n:check:fix`. Plus `pnpm i18n:report` / `:report:fix` and `pnpm i18n:schema` (regenerates `schema.json`, then `biome format --write`).
- Keys this feature would extend: `tasks.popover.*` (currently `assignee`, `status`, `priority`, `dueDate`, `startDate`, `labels` — each with its own `updateSuccess`/`updateError`/`clear` subtree) and `tasks.kanban.*` (currently only `addTask`).
- Consequence: adding an en-US key without running `i18n:check:fix` makes the other 16 locales fail `pnpm i18n:check`. This is a hard gate that must be in the verification plan.

## G. Test layout

| | API | Web |
|---|---|---|
| location | `tests/api/**` (unit), `tests/api-integration/**` (integration) — **repo root, outside the package** | co-located, `apps/web/src/**/*.test.ts(x)` (36 files) |
| runner | Vitest | Vitest |
| environment | `node` | `jsdom` + `@testing-library/react` + `@testing-library/jest-dom` |
| config | `apps/api/vitest.config.ts`, `apps/api/vitest.integration.config.ts` | `apps/web/vitest.config.ts` |
| command | `pnpm --filter @kaneo/api test:unit` / `test:integration` | `pnpm --filter @kaneo/web test` |

API unit tests import across the boundary with relative paths, e.g. `import { toSlug } from "../../../apps/api/src/column/controllers/create-column"`, and are pure-function focused (`describe`/`it`/`expect`, no DB). Integration tests use `tests/api-integration/setup.ts`, `helpers/`, and `mocks/email.ts`, and are the only place PostgreSQL behavior is proved. Existing task coverage: `tests/api-integration/task.test.ts`, `task-title-activity.test.ts`, `task-image-upload.test.ts`.

Web tests are minimal render-and-assert, e.g. `apps/web/src/components/kanban-board/task-labels.test.tsx` — `afterEach(cleanup)`, `render(<TaskLabels labels={[…]} />)`, `expect(screen.getByText("Bug")).toBeVisible()`. That file is the direct template for a `column-header` or `task-card` estimate test, since it sits in the same directory.

---

## Proposed off-limits

```
.git/**                    .sdlc/**                   .hook-logs/**
.env  .env.*  .env.local  .env.sample
apps/api/.env.test.example  apps/web/.env.development  apps/web/.env.production
.claude/**  CLAUDE.md  AGENTS.md  .agents/**  skills/**
.cursor/**  .vscode/**  .devcontainer/**
node_modules/**  dist/**  build/**  .next/**  .turbo/**
pnpm-lock.yaml  CHANGELOG.md
charts/**  deploy/**  .github/workflows/**
apps/api/drizzle/meta/**   (see carve-out)
```

Carve-outs Gate 0 should resolve:

- **`apps/api/drizzle/meta/**` is off-limits to *hand* editing only.** `pnpm --filter @kaneo/api db:generate` must still write `_journal.json` and `00NN_snapshot.json`; a migration committed without them is broken. Mark as tool-written, not hand-written.
- **Non-en-US `i18n/*.json`** are writable but should be updated via `pnpm i18n:check:fix` rather than hand-edited.
- **`.gitignore`** should be added to the allowlist so the plugin can add the `.sdlc/` entry during this run.

## Repo-state risks for Gate 0

1. `.sdlc/` is not gitignored — artifacts are exposed to `git add -A`.
2. Untracked `.claude/settings.local.json` and `.hook-logs/` predate the run and must survive it.
3. Branch has no upstream; `5d1fc910` is the rollback anchor.
4. Husky + commitlint are active — commits must be conventional.
5. `lint` scripts rewrite files; use `pnpm exec biome ci .`.
6. Integration tests require a live PostgreSQL that is not guaranteed present in this environment. If it is unavailable, the migration cannot be proved end-to-end and that limitation must be stated rather than papered over.
7. Regulated-repo signal (`SECURITY.md`) → confirm the active policy uses only compliant endpoints, and that off-limits protects sensitive data.
8. `.env` and `.env.local` hold real local credentials. Names only were read.

## Notes

Full Tier 1 scan completed within the timebox; 1578 tracked files, no sampling fallback needed.

**Tier 2b triggered** — the primary stacks are Hono (API) and React/Vite (web); the shipped adapters are only `generic.md`, `nest.md`, `python.md`. `nest.md` is the closest but describes NestJS, which this repo does not use. Learned profile written to `.sdlc/baseline/stack-profile.md`.

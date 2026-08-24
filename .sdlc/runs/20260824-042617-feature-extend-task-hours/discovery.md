# Discovery — run 20260824-042617-feature-extend-task-hours

- **Repo:** `/home/sangeetha/projects/kaneo`
- **Mode:** `refresh` → helper decision **`cached`**
- **Reason:** git HEAD unchanged and no stack-manifest mtime changed since baseline
- **Baseline source:** `.sdlc/baseline/current.json`, built `2026-08-20T12:20:44+00:00` at HEAD `5d1fc9104337786c3ef295ec0dc31656df371d8d`
- **Age:** 0 commits behind, 4 days old
- **Action:** baseline copied verbatim to `runs/20260824-042617-feature-extend-task-hours/baseline.json`. No Tier-1 re-scan performed. `baseline/current.json` had only its `last_verified_*` provenance fields refreshed.

Tier 1 facts below are restated from the cached baseline for convenience. The impact map is new work performed for this run.

---

## Clean-base verification

Requested check: case-insensitive `wipLimit|wip_limit` across tracked files, excluding `dist/`, `build/`, `.next/`, `.sdlc/`.

```
TOTAL_MATCHING_FILES=0
TOTAL_MATCHING_LINES=0
```

**Zero hits.** The working tree at `5d1fc910` is at clean base state — no prior `wipLimit` work is present in tracked source. No sibling branches, prior run artifacts, ledger, or build output were read.

---

## Git state

| Field | Value |
|---|---|
| HEAD | `5d1fc9104337786c3ef295ec0dc31656df371d8d` |
| Branch | `feature-extend-2/opus-flash` (tracking `origin/main`) |
| Tracked modifications | none |
| Untracked | `.claude/settings.local.json`, `.hook-logs/`, `.sdlc/` |
| Remote | `origin` → `https://github.com/tl-ai-labs/kaneo.git` |
| `.gitignore` covers `.sdlc/` | **no** |
| Tracked files | 1578 |

## Stacks

Node/TypeScript pnpm + Turborepo monorepo (node >= 20.19, pnpm 10.32.1, TypeScript 7.0.2, Biome 2.5.7, ESM).

- `apps/api` — Hono, hono-openapi, Better Auth, Drizzle ORM, **Valibot**, pg, ioredis, MCP SDK, Sentry
- `apps/web` — React, Vite, TanStack Router + Query, Radix, Tailwind, TipTap, dnd-kit
- `apps/site` — Next.js; `packages/{libs,permissions,mcp,email,planka-import,typescript-config}`

## Proposed test command

`pnpm test` (root `package.json#scripts.test` → `turbo test`). Runner is **vitest**. Needs Gate 0 confirmation.

Narrower alternatives relevant to this feature:

- `pnpm --filter @kaneo/api test` — API unit
- `pnpm --filter @kaneo/api test:integration` — PostgreSQL-backed integration (`tests/api-integration`)
- `pnpm --filter @kaneo/web test` — web component/unit
- `pnpm typecheck`

## Monorepo / submodules / LFS

- Monorepo: pnpm workspace (`apps/**`, `packages/**`) + Turborepo. 9 packages.
- Submodules: none. Git-LFS: not in use.
- `tests/` lives at repo root, not as a workspace package.

## Competing AI configs

`.claude/` (+ `settings.local.json`, `skills/`), `.cursor/rules/` (7 `.mdc`), `.agents/skills/`, `skills/` (symlinks), `CLAUDE.md`, `AGENTS.md`. Absent: `.mcp.json`, `.cursorrules`, Aider, Continue, Roo, Copilot instructions, repo-local `routing-policy.yaml`.

## Coexistence risks

- Cursor rules at `.cursor/rules` (7 files) — untouched by default. Cursor auto-lint-on-save may react to our edits.
- Claude Code project config at `.claude/` — untouched.
- `CLAUDE.md` delegates to `AGENTS.md`, which carries binding conventions (Valibot validators, `requireWorkspacePermission`, `publishEvent`, migrations via `db:generate`, static i18n keys). Read-only input, never a write target.
- Agent skill trees at `.agents/skills` and `skills/` (symlinks) — untouched.
- No `.mcp.json` and no repo-local `routing-policy.yaml` — shipped policy applies.
- **`.gitignore` does not cover `.sdlc/`.** Run artifacts (packets, backups, telemetry) are untracked but visible to `git add -A`. Gate 0 should offer to add `.gitignore` to this run's allowlist so the entry can be added.
- Root/package `lint` scripts run Biome with `--write` and can touch unrelated files — prefer targeted checks.

## Proposed off-limits

Unchanged from cached baseline: `.git/**`, `.sdlc/**`, `.env*`, `.claude/**`, `.cursor/**`, `.agents/**`, `skills/**`, `CLAUDE.md`, `AGENTS.md`, `**/node_modules/**`, `**/dist/**`, `**/build/**`, `**/.next/**`, `**/.turbo/**`, `out/**`, `coverage/**`, `pnpm-lock.yaml`, `apps/web/src/routeTree.gen.ts`, `apps/api/drizzle/**`, `i18n/schema.json`, `.husky/**`.

Note two of these matter directly for this feature:

- `apps/api/drizzle/**` is off-limits for hand-editing, but a migration **must** be produced for a schema change via `pnpm --filter @kaneo/api db:generate` and committed. Gate 0 should decide whether the generated `.sql` enters the allowlist as a generator output.
- `i18n/schema.json` is generated; `i18n/en-US.json` **is** the editable source of truth.

## Regulated-repo signals

Only a standard open-source `SECURITY.md`. No HIPAA/SOC2/PCI/GDPR markers, no compliance CODEOWNERS. `regulated_repo_warning_required: false`.

---

# Impact map — optional estimated-hours on a task + per-column rollup

Product vocabulary note: the ticket's "Card" is this repo's **task**; the ticket's "LaneHeader" is `ColumnHeader`.

## 1. Task entity and schema

**`apps/api/src/database/schema.ts:401-442`** — `taskTable`, physical table `"task"`.

Existing columns: `id`, `projectId`, `position`, `number`, `userId` (db `assignee_id`), `title`, `description`, `status`, `columnId`, `priority`, `startDate`, `dueDate`, `createdAt`, `updatedAt`.

Numeric columns already on the task (`schema.ts:413-414`):

```ts
position: integer("position").default(0),
number: integer("number").default(1),
```

**Numeric idiom across the whole schema is `integer()` only.** A grep for `integer|real|doublePrecision|numeric|decimal|bigint|smallint` returns `integer(` at every one of 17 sites and nothing else. There is **no `real`/`numeric`/`decimal` precedent anywhere in the file** — a fractional-hours field (e.g. 1.5h) would introduce a new Drizzle column type to this codebase; a whole-hours or minutes-as-integer field would not.

**Nullable-numeric precedent does exist**, just not on `taskTable`:

- `schema.ts:1009` `remaining: integer("remaining")` — nullable, no default
- `schema.ts:1001-1002` `refillInterval` / `refillAmount` — nullable
- `schema.ts:852` `installationId: integer("installation_id")` — nullable
- `schema.ts:1045` `pollingInterval: integer("polling_interval")` — nullable

Nullable-optional precedent **on `taskTable` itself** is `startDate` / `dueDate` (`schema.ts:427-428`) — declared with no `.notNull()` and no default.

Indexes on the task (`schema.ts:435-441`): `task_projectId_idx`, `task_dueDate_idx`, `task_assigneeId_idx`, `task_columnId_idx`, plus unique `(projectId, number)`.

**Column table:** `apps/api/src/database/schema.ts:342-368` — `columnTable` has `id`, `projectId`, `name`, `slug`, `position`, `icon`, `color`, `isFinal`, timestamps.

**Migration convention:** `apps/api/drizzle/` holds 43 numbered SQL files (latest `0042_previous_the_executioner.sql`) plus `meta/`. Generated by `pnpm --filter @kaneo/api db:generate` (`apps/api/package.json:25`). Per `AGENTS.md`, generate and inspect — never hand-write.

## 2. Task API surface

Routes live in one file: **`apps/api/src/task/index.ts`** (904 lines). All task routes are guarded by `workspaceAccess.*` for scoping plus `requireWorkspacePermission` for the action.

| Route | Lines | Validator | Permission |
|---|---|---|---|
| `GET /tasks/:projectId` (board payload) | `55-105` | `71-95` query | `workspaceAccess.fromProject` only — **no** `requireWorkspacePermission` |
| `POST /:projectId` (create) | `175-242` | `190-201` | `requireWorkspacePermission({ task: ["create"] })` `:203` + `requireEntitlement` `:204` |
| `GET /:id` | `243-267` | `258` | `workspaceAccess.fromTask()` only |
| `PUT /:id` (full update) | `317-394` | `333-346` | `{ task: ["update"] }` `:348` + `requireTaskAssigneePermission` `:349` + `requireEntitlement` |
| `PUT /status/:id` | `492-521` | `508` | `{ task: ["update"] }` |
| `PUT /priority/:id` | `522-551` | `538` | `{ task: ["update"] }` |
| `PUT /assignee/:id` | `552-581` | `568` | `{ task: ["assign"] }` |
| `PUT /due-date/:id` | `582-615` | `598` | `{ task: ["update"] }` |
| `PUT /title/:id` | `617-646` | `633` | `{ task: ["update"] }` |
| `PUT /description/:id` | `868-901` | `884` | `{ task: ["update"] }` |
| `PATCH /bulk` | `106-174` | `128-143` | `requireBulkTaskPermission` `:145` |
| `POST /import/:projectId` | `420-464` | `436-451` | `{ task: ["create"] }` |

**Permission actions are task-level, not project-level.** Vocabulary is `packages/permissions/src/index.ts:12`:

```ts
task: ["create", "read", "update", "delete", "assign"],
```

Role grants: `viewer` → `task: ["read"]` (`:22`); `member` → `create, read, update` (`:30`); `admin`/`owner` → all (`:38`, `:46`). Note `member` can update tasks but cannot delete or assign. Editing an hours field would fall under `task: ["update"]` under the existing vocabulary — **no new permission statement is required** unless the design deliberately gates it.

There is a strong per-field endpoint precedent (`/status`, `/priority`, `/assignee`, `/due-date`, `/title`, `/description`) — six single-field PUTs, each with a tiny Valibot validator and a dedicated controller in `apps/api/src/task/controllers/`.

### Create/update controllers

- **`apps/api/src/task/controllers/create-task.ts:73-87`** — `.insert(taskTable).values({...})` with an explicit field list. A new column must be added here or it is never set on create.
- **`apps/api/src/task/controllers/update-task.ts:9-21`** — positional signature of 11 parameters (`id, title, status, startDate, dueDate, projectId, description, priority, position, userId?, currentUserId?`). Adding a field means extending this positional list, which is brittle; all callers are `apps/api/src/task/index.ts:378-390` and the MCP tools.
- **`update-task.ts:54-69`** — `.set({...})` with an explicit field list, then `.returning()`.

**Important nuance on the full PUT.** `update-task.ts:56-67` uses `.set()` with a fixed field list. If a new column is simply *not* added there, Drizzle leaves the existing value untouched — so a field omitted from the PUT is **not** silently nulled today. But `startDate`/`dueDate` show the opposite pattern (`:60-61`, `startDate: startDate || null`) — an optional-in-validator field that gets **coerced to null** when the client omits it. If the new hours field follows the `dueDate` shape verbatim, then **every** full-PUT caller that does not send it will erase it. Full-PUT callers that would erase it: the web `updateTask` fetcher (drag-and-drop and archive-all), and the MCP read-modify-write path. This is the single highest-risk detail in the whole change and the design phase must decide it explicitly.

Also note `PUT /:id`'s validator (`index.ts:335-345`) makes `title`, `description`, `priority`, `status`, `projectId`, `position` **required**. Adding a required field would break every existing caller.

`update-task.ts:77-101` publishes `task.status_changed`, `task-relation.refresh`, and always `task.updated` via `publishEvent`.

## 3. The board projection — the decisive finding

**`apps/api/src/task/controllers/get-tasks.ts`** builds the entire kanban payload. It is reached by `GET /task/tasks/:projectId` and is also reused by `apps/api/src/project/controllers/get-public-project.ts:2`, so the public board shares this projection.

There are **three** hand-maintained whitelists, and a new task column is dropped by all of them unless added.

**(a) Task field whitelist — `get-tasks.ts:123-139`:**

```ts
const taskSelection = {
  id: taskTable.id,
  title: taskTable.title,
  number: taskTable.number,
  description: taskTable.description,
  status: taskTable.status,
  priority: taskTable.priority,
  startDate: taskTable.startDate,
  dueDate: taskTable.dueDate,
  position: taskTable.position,
  createdAt: taskTable.createdAt,
  userId: taskTable.userId,
  assigneeName: userTable.name,
  assigneeId: userTable.id,
  assigneeImage: userTable.image,
  projectId: taskTable.projectId,
};
```

**This is an explicit `db.select()` projection, not `select()`-all.** A new `taskTable` column added in `schema.ts` and nothing else **will not appear in the board payload at all.** That directly answers the scoping question: **a client-side rollup is impossible until `get-tasks.ts:123-139` is amended.** Exact line range to change: **`apps/api/src/task/controllers/get-tasks.ts:123-139`**.

**(b) Column field whitelist — `get-tasks.ts:224-237`:**

```ts
const columns = projectColumns.map((column) => ({
  id: column.slug,        // note: `id` is the SLUG, not column.id
  slug: column.slug,
  name: column.name,
  icon: column.icon,
  isFinal: column.isFinal,
  tasks: paginatedTasks
    .filter((task) => task.status === column.slug)
    .map((task) => ({ ...task, labels: ..., externalLinks: ... })),
}));
```

Yes — **columns are hand-whitelisted too**, and more aggressively than tasks: `column.id`, `column.position`, and `column.color` are all dropped. `id` is deliberately set to `column.slug`. A server-computed per-column aggregate would be added here, at **`get-tasks.ts:224-237`**.

Also note tasks are bucketed by **`task.status === column.slug`** (`:231`), not by `task.columnId`, even though the FK exists.

**(c) Single-task whitelist — `apps/api/src/task/controllers/get-task.ts:8-23`** — an independent `db.select({...})` field list for `GET /task/:id`. Same problem, third place to amend. (It omits `assigneeImage`, which `get-tasks` includes — the two lists have already drifted.)

Two further projections that may or may not be in scope: `apps/api/src/task/controllers/export-tasks.ts:23-31` and `:82-86` (export field list), and `apps/api/src/mcp/tools.ts`.

## 4. Where a per-column rollup could be computed — facts, no recommendation

**What the payload already contains.** `get-tasks.ts:255-281` returns `{ data: { id, name, slug, icon, description, isPublic, workspaceId, columns, archivedTasks, plannedTasks }, pagination }`. Each `columns[]` entry carries its **full task array** (`:230-236`), each task carrying the 15 whitelisted scalar fields plus `labels[]` and `externalLinks[]`. There is no aggregate of any kind in the payload today.

**Pagination is off for the board.** The web fetcher `apps/web/src/fetchers/task/get-tasks.ts` calls `client.task.tasks[":projectId"].$get({ param: { projectId } })` with **no query params**. In `get-tasks.ts:105`, `usePagination` is `options.page != null || options.limit != null` → **false** for the board. So `:149-151` returns the full unpaginated task set. A client-side sum would therefore be over *all* tasks, not a page. (If a caller ever passes `page`/`limit`, `:107-108` caps `pageSize` at 100 and a client-side sum silently becomes a partial sum.)

**But the client-side sum would be over *filtered* tasks.** The board route composes: `useGetTasks(projectId)` (`board.tsx:82`) → `useTaskFiltersWithLabelsSupport(...)` producing `filteredProject` (`board.tsx:163-166`) → `sortedProject` (`board.tsx:168-177`) → `<KanbanBoard project={sortedProject} />` (`board.tsx:238`) → `<Column column={column} />` (`kanban-board/index.tsx:259`) → `<ColumnHeader column={column} />`. So `ColumnHeader` receives a **filter-narrowed** `column.tasks`. This exactly matches the existing `column.tasks.length` badge, which already displays a filtered count.

**The consequence, stated neutrally:** a client-side sum is consistent with the existing count badge (both filter-sensitive); a server-side aggregate would be filter-*insensitive* and could disagree with the count badge sitting next to it. Design phase decides.

**Server-side would also need a filter decision.** `get-tasks.ts:82-104` builds `conditions` from `status`, `priority`, `assigneeId`, `dueBefore`, `dueAfter` — a `SUM()` would have to choose whether to honour those conditions.

Costs for reference: (a) client-side touches `get-tasks.ts:123-139` + the header component; (b) server-side touches `get-tasks.ts:224-237` plus a new aggregate query, plus the inferred web types.

## 5. Web data layer

- **Fetchers:** `apps/web/src/fetchers/task/` — 15 files. Board read is `get-tasks.ts`; full update is `update-task.ts`; create is `create-task.ts`.
- **`apps/web/src/fetchers/task/update-task.ts:9-27`** sends a **fixed JSON body** (`userId, title, description, status, priority, startDate, dueDate, position, projectId`). A new field must be added here or every full update drops it. This file already carries a comment about a prior bug of exactly this shape (priority `""` rejecting the whole update and breaking drag of imported tasks).
- **`apps/web/src/fetchers/task/create-task.ts:8-13`** takes 8 positional args; `CreateTaskRequest` is inferred via `InferRequestType`.
- **Query hooks:** `apps/web/src/hooks/queries/task/use-get-tasks.ts` — key **`["tasks", projectId]`**, `refetchInterval: 30000`. Also `use-get-task.ts`.
- **Mutation hooks:** `apps/web/src/hooks/mutations/task/` — 13 files. `use-update-task.ts:11-33` invalidates **`["task", id]`, `["tasks", projectId]`, `["notifications"]`, `["projects"]`, `["activities", id]`**. The board rollup refreshes automatically off `["tasks", projectId]`.
- **Types:**
  - `apps/web/src/types/task/index.ts:21-40` — `Task` is **hand-written**, not inferred. Must be extended manually.
  - `apps/web/src/types/project/index.ts` — `ProjectWithTasks` is inferred from the Hono client via `InferResponseType`, then `Omit`s `columns`/`archivedTasks`/`plannedTasks` and re-substitutes the hand-written `Task`. So a **server-side column aggregate flows in automatically** through inference, while a **task field must be added by hand** to `types/task/index.ts`.
- **Typed client:** `@kaneo/libs` (`packages/libs`). Do not build a parallel request layer (`AGENTS.md`).

## 6. The column header component

**`apps/web/src/components/kanban-board/column/column-header.tsx`** (105 lines).

Per-column information is rendered at **lines 54-65**, specifically the count badge at **lines 62-64**:

```tsx
<span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
  {column.tasks.length}
</span>
```

Props: `column: ProjectWithTasks["columns"][number]` (`:14-16`). `column.tasks` is already read at `:38`, `:49`, `:63`, `:68`, `:101`. Uses `useTranslation()` (`:19`) and `useWorkspacePermission()` (`:22-24`).

Rendered by `apps/web/src/components/kanban-board/column/index.tsx:4`. Sibling `column-dropzone.tsx:39,44` renders the task list.

Adjacent surfaces that render the same board data and may want parity: `apps/web/src/components/list-view/index.tsx`, `apps/web/src/components/public-project/kanban-view.tsx`, `apps/web/src/components/backlog-list-view/index.tsx`.

## 7. Where a task's fields are edited in the UI

Each of these is a surface that would need the new field:

1. **`apps/web/src/components/task/task-properties-sidebar.tsx`** (769 lines) — the canonical per-field editor rail. Existing rows: `TaskStatusPopover` (`:199-214`), `TaskPriorityPopover` (`:217-228`), `TaskAssigneePopover` (`:231-263`), `TaskStartDatePopover` (`:266-281`), `TaskDueDatePopover` (`:284-...`), `TaskLabelsPopover`, `TaskMovePopover` (`:146`). The popover-per-field pattern (`apps/web/src/components/task/task-*-popover.tsx`) is the local idiom to follow.
2. **`apps/web/src/components/shared/modals/create-task-modal.tsx`** (1109 lines) — create form. Field state at `:185-199` (`title`, `description`, `priority`, `assigneeId`, `startDate`, `dueDate`, `labels`); reset at `:249`; submit at `:342-349`. Also builds an optimistic draft task at `:96-103`.
3. **`apps/web/src/components/task/task-details-content.tsx`** (138 lines) and `task-details-sheet.tsx` — detail view shell.
4. **`apps/web/src/components/kanban-board/task-card.tsx`** — the card face, if hours should show per card.
5. **`apps/web/src/components/list-view/task-row.tsx`** and **`apps/web/src/components/backlog-list-view/backlog-task-row.tsx`** — alternate row renderings.
6. **`apps/web/src/components/bulk-selection/bulk-toolbar.tsx`** — only if bulk-setting hours is in scope; the API `PATCH /bulk` operation picklist (`apps/api/src/task/index.ts:132-140`) would need a new member.
7. **`apps/web/src/components/public-project/task-card.tsx` / `task-row.tsx`** — public board mirrors.

## 8. i18n

- **Source of truth: `i18n/en-US.json`.** 17 locale files total (`de-DE, el-GR, en-US, es-ES, fr-FR, hi-IN, id-ID, it-IT, ko-KR, mk-MK, nl-NL, pt-BR, ru-RU, tr-TR, uk-UA, vi-VN, zh-CN`) plus `resources.ts` and generated `schema.json`.
- Relevant namespace: **`tasks`**. Sub-keys: `status, priority, boardSearchPlaceholder, view, common, detail, entity, relations, subtasks, properties, move, popover, backlog, sort, boardFilters, gantt, delete, archive, listView, kanban, pr, assignee, dueDate, labels, update, contextMenu, actions, bulk, editor`.
- Board-header copy belongs in **`tasks.kanban`** (currently only `{"addTask": "Add task"}`).
- Field-editor copy belongs in **`tasks.properties`** (currently `title, labels, copyTaskLink, copyTaskBranch, start, startDate, noDate`) — mirroring how `tasks.dueDate` and `tasks.properties.startDate` are organised.
- `AGENTS.md` requires **static** i18n keys; `i18n/schema.json` is generated by `pnpm i18n:schema` and is off-limits for hand-editing.

## 9. Tests and conventions

**API integration — `tests/api-integration/`** (PostgreSQL-backed, `vitest run --config vitest.integration.config.ts`):

- **`tests/api-integration/task.test.ts`** — the primary reference. Conventions (`:1-60`): import `db, { schema }` from `../../apps/api/src/database`, `createApp` from `../../apps/api/src/index`, helpers `mockAnonymousSession` / `mockAuthenticatedSession` from `./helpers/auth`, `resetTestDatabase()` in `beforeEach`, fixtures `createProjectFixture` / `createWorkspaceMember` from `./helpers/fixtures`. Exercises routes with `app.request('/api/task/...', { method, headers, body })` and asserts on `response.status`. Covers 401-unauthenticated first, then the happy path.
- `tests/api-integration/task-title-activity.test.ts`, `task-image-upload.test.ts`, `project.test.ts`, `workspace-rbac.test.ts` (RBAC reference), `openapi.test.ts` (OpenAPI-shape assertions — relevant since a new field changes the spec).

**API unit — `tests/api/`**: `column/to-slug.test.ts`, `time-entry/`, `utils/openapi-spec.test.ts`, `mcp-tools.test.ts`, plus `billing/`, `events/`, `ws/`.

**Web — colocated `*.test.tsx` next to components**, vitest + Testing Library. Directly relevant precedents: `apps/web/src/components/kanban-board/task-labels.test.tsx` (kanban-subtree component test), `apps/web/src/components/shared/modals/create-task-modal.test.tsx`, `apps/web/src/fetchers/task/create-task.test.ts` (fetcher body-shape test), `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` (asserts on `filteredProject.columns[0].tasks`), `apps/web/src/components/task/task-status-popover.test.tsx`. There is **no existing `column-header.test.tsx`** — a rollup test would be new.

## 10. Pre-existing hours / time / estimation concepts — reconciliation required

**A full time-tracking feature already ships.** The design must reconcile with it rather than duplicate it.

**`timeEntryTable` — `apps/api/src/database/schema.ts:508-538`:**

```ts
taskId: text("task_id").notNull().references(() => taskTable.id, { onDelete: "cascade", ... }),
userId: text("user_id").references(() => userTable.id, { onDelete: "set null", ... }),
description: text("description"),
startTime: timestamp("start_time", { mode: "date" }).notNull(),
endTime: timestamp("end_time", { mode: "date" }),
duration: integer("duration").default(0),
```

Indexed on `taskId` and `userId` (`:535-536`).

This is **actual/logged** time (a start/stop timer with a materialised `duration`), one-to-many per task. The proposed estimated-hours field is **planned** time — a different concept, but the two are the obvious pairing (estimate vs. actual), and `duration` is the existing precedent for how this codebase stores a quantity of time: **`integer`, on its own table, defaulting to 0**.

Supporting surfaces already built:

- API: `apps/api/src/time-entry/index.ts` — `GET /:taskId` (`:17`), `GET /:id` (`:40`), `POST` (`:63`), `PUT /:id` (`:102`). Guarded by **`requireWorkspacePermission({ task: ["update"] })`** (`:88`, `:127`) — i.e. time data reuses the **task** permission vocabulary, no separate statement. Controllers in `apps/api/src/time-entry/controllers/` (create/get/get-entries/update).
- Web: `apps/web/src/fetchers/time-entry/{create,get,update}-time-entry.ts`, `apps/web/src/hooks/mutations/time-entry/{use-create,use-update}-time-entry.ts`, `apps/web/src/hooks/queries/time-entry/use-get-time-entries.ts`.
- Type: `apps/web/src/types/time-entry/index.ts` — `duration: number | null`, `startTime: string`, `endTime: string | null`.

Other adjacent fields on the task itself:

- **`dueDate`** — `schema.ts:428`, indexed (`:437`), with a dedicated endpoint `PUT /due-date/:id` (`index.ts:582-615`), a dedicated controller, a dedicated popover, and its own i18n namespace `tasks.dueDate`. This is the **closest structural template** for adding a new optional task field end-to-end.
- **`startDate`** — `schema.ts:427`, no dedicated endpoint; set only via the full PUT. Range-validated against `dueDate` by `validateDateRange` (`apps/api/src/utils/validate-dates.ts`, called at `index.ts:226` and `:376`).
- **`position`** / **`number`** — integers, but structural, not user-facing quantities.

**Not present:** no story points, no `estimate` field, no velocity. The one `estimate` string in the repo is **`tests/api/utils/openapi-spec.test.ts:306`**, a synthetic fixture inside a test for `markOptionalSchemaFieldsNullable`:

```ts
estimate: { type: "number", nullable: true },
```

That is a made-up property in a test fixture, **not** a real schema field. Worth knowing because a naive grep for "estimate" surfaces it and could mislead.

## 11. Other surfaces AGENTS.md would have us check

- **MCP.** `apps/api/src/mcp/tools.ts` performs a **read-modify-write** against `PUT /task/:id` (`:119-186`): it reads the existing task, merges a patch, and re-sends a full body containing `title`, `priority`, `position`, and optionally `startDate`/`dueDate`. If a new field is added to the full-PUT with null-coercion semantics, **every MCP task update erases it**. Also `packages/mcp` is the published stdio package.
- **Events / realtime.** `update-task.ts:95-101` always publishes `task.updated`; `create-task.ts:98` publishes `task.created`. WebSocket delivery is project-scoped; `apps/web/src/hooks/use-project-websocket.test.ts` exists. Existing cache invalidation on `["tasks", projectId]` should carry a rollup change without new plumbing.
- **OpenAPI.** Every route uses `describeRoute` + `resolver(taskSchema)`. `taskSchema` is at **`apps/api/src/schemas.ts:25-44`** and is a Valibot object that **also hand-lists task fields** — a fourth whitelist:
  ```ts
  id, projectId, position, number, userId, title, description, status,
  priority (picklist), startDate (optional date), dueDate (optional date), createdAt
  ```
  Note it already omits `columnId` and `updatedAt`. `tests/api-integration/openapi.test.ts` asserts on spec shape.
- **Export/import.** `export-tasks.ts:23-31`, `:82-86` and the import validator `index.ts:436-451` both hand-list fields; round-tripping hours would need both.
- **Docker/Helm** (`charts/kaneo`, `Dockerfile.kaneo`): no impact expected for a pure column addition.

## 12. Summary of the field-whitelist hazard

A new `taskTable` column is invisible unless added in **all** of these:

| # | File | Lines | What it gates |
|---|---|---|---|
| 1 | `apps/api/src/database/schema.ts` | `401-442` | the column itself |
| 2 | `apps/api/drizzle/00XX_*.sql` | new | the migration (via `db:generate`) |
| 3 | `apps/api/src/task/controllers/get-tasks.ts` | `123-139` | **board payload — blocks any client-side rollup** |
| 4 | `apps/api/src/task/controllers/get-tasks.ts` | `224-237` | column shape — where a server-side aggregate would go |
| 5 | `apps/api/src/task/controllers/get-task.ts` | `8-23` | single-task read |
| 6 | `apps/api/src/schemas.ts` | `25-44` | `taskSchema` / OpenAPI |
| 7 | `apps/api/src/task/controllers/create-task.ts` | `73-87` | create |
| 8 | `apps/api/src/task/controllers/update-task.ts` | `9-21`, `54-69` | update (positional signature + `.set()`) |
| 9 | `apps/api/src/task/index.ts` | `190-201`, `333-346` | create + update validators |
| 10 | `apps/web/src/types/task/index.ts` | `21-40` | hand-written web `Task` type |
| 11 | `apps/web/src/fetchers/task/update-task.ts` | `9-27` | fixed PUT body |
| 12 | `apps/web/src/fetchers/task/create-task.ts` | `8-13` | positional create args |
| 13 | `i18n/en-US.json` | `tasks.kanban`, `tasks.properties` | copy (×17 locales) |

## Scan notes

- Refresh decision `cached`; Tier 1 restated from baseline without re-scan. Impact map executed fresh against the working tree at `5d1fc910`.
- No `.sdlc/runs/**` other than this run's directory was read. `.sdlc/ledger.md` and `.sdlc/CLAUDE-SDLC.md` were not read. No sibling branches, no `git show`/`git diff`/`git log -p`. No `apps/api/dist/**`, `apps/web/dist/**`, or `apps/site/.next/**`.
- No Read failures, no non-UTF8 skips. Well inside timebox.

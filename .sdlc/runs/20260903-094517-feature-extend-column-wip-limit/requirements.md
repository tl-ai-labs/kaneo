# Delta Requirements — Per-column WIP limit with over-cap indicator

- Run: `20260903-094517-feature-extend-column-wip-limit`
- Mode: brownfield · Intent: `feature-extend` (delta requirements form)
- Repo HEAD at start: `5d1fc9104337786c3ef295ec0dc31656df371d8d` (branch `feature-extend-1/opus-flash-sdk`)
- Source brief: `intent_brief.md` · Baseline: `.sdlc/baseline/current.json`

This is a **delta** document. It states only what changes relative to the code at HEAD.
Everything not named here keeps its current behavior.

---

## 1. In scope

1. A nullable `wipLimit` integer column on `columnTable` (`apps/api/src/database/schema.ts`),
   plus a Drizzle-generated migration that adds it to existing installations as `NULL`.
2. `wipLimit` accepted on column create and column update, validated as a positive integer
   (or `null` on update, meaning "clear the limit"), with accurate Valibot schemas and the
   existing `hono-openapi` `describeRoute` metadata kept accurate.
3. `wipLimit` returned by `GET /column/:projectId` and carried through the typed
   `@kaneo/libs` client and the web fetchers, mutation hooks and query hook for columns.
4. Set / clear affordance for the limit in the project settings column editor
   (`apps/web/src/components/project/column-editor.tsx`).
5. An **over-cap indicator** in the authenticated board's column header
   (`apps/web/src/components/kanban-board/column/column-header.tsx`), shown only when a limit
   is set and the column's current task count exceeds it.
6. Static English i18n keys for all new copy, added to `i18n/en-US.json`.
7. Tests: API-side validator/controller behavior under `tests/api/column/`, web-side
   indicator rendering under `apps/web/src/components/kanban-board/column/`.

## 2. Out of scope

1. Any enforcement. No API rejection, no drag-and-drop blocking, no move refusal. The limit is
   advisory and a column over its cap is a valid persisted state.
2. The public read-only board (`apps/web/src/components/public-project/**`).
3. The second, separate board implementation at `apps/web/src/components/board/**`.
4. Per-user or client-local limits; limits are workspace-shared column state.
5. The 17 non-English locale files under `i18n/`.
6. `apps/site/`, `apps/docs/`, `charts/`, `packages/mcp/`.
7. Integration tests requiring live PostgreSQL (`tests/api-integration/`) — unverified at
   baseline, so not a gate for this run.
8. Editing migrations `0000`–`0042`. Only a newly generated migration is written.

## 3. Functional requirements

### Module: API — database (`apps/api/src/database/schema.ts`, `apps/api/drizzle/`)

- **FR-1** `columnTable` gains `wipLimit: integer("wip_limit")` — nullable, no default.
- **FR-2** The migration is produced by `pnpm --filter @kaneo/api db:generate` and committed
  alongside the schema change (repo convention, AGENTS.md). Its SQL must be inspected and must
  be a plain `ALTER TABLE "column" ADD COLUMN "wip_limit" integer;` with no destructive
  statement and no `NOT NULL`/`DEFAULT` clause.
- **FR-3** Existing rows migrate with `wip_limit = NULL` and behave exactly as today.
- **FR-4** No change to `relations.ts` — `wipLimit` is a scalar, not a relation.

### Module: API — column routes (`apps/api/src/column/index.ts`)

- **FR-5** `POST /column/:projectId` accepts optional `wipLimit`. Valibot:
  `v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)))`. Absent means no limit.
- **FR-6** `PUT /column/:id` accepts optional **nullable** `wipLimit`. Valibot:
  `v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))))`. `null` clears the
  limit; omission leaves it untouched (matches the existing `icon`/`color` convention in this
  file exactly).
- **FR-7** Rejected input returns the framework's existing 400 validation response. No new
  error type, no new `HTTPException` site.
- **FR-8** Authorization is unchanged: `workspaceAccess.fromProject` / `fromColumn` plus
  `requireWorkspacePermission({ project: ["update"] })` on create and update. No new
  permission verb is introduced into `@kaneo/permissions`.
- **FR-9** `describeRoute` metadata for the touched routes stays accurate. The current routes
  use `resolver(v.any())` for responses; this run does not regress that, and does not expand
  it beyond the touched routes.

### Module: API — column controllers (`apps/api/src/column/controllers/`)

- **FR-10** `createColumn` accepts `wipLimit?: number` and inserts `wipLimit: wipLimit ?? null`.
  Note it must NOT use the `icon || null` falsy idiom, which would coerce a legitimate value
  incorrectly; `wipLimit` is validated `>= 1` so the distinction is between "absent" and "set".
- **FR-11** `updateColumn` accepts `wipLimit?: number | null` and applies it with the existing
  `...(data.wipLimit !== undefined && { wipLimit: data.wipLimit })` spread idiom, so `null`
  clears and `undefined` leaves untouched.
- **FR-12** `getColumns` is `db.select()` over the whole row, so `wipLimit` flows out with no
  change to that file once FR-1 lands. It is listed in scope only to be verified, not edited.
- **FR-13** No change to `delete-column.ts` or `reorder-columns.ts`.

### Module: Web — data layer

- **FR-14** `fetchers/column/create-column.ts` and `update-column.ts` widen their `data`
  parameter types to include `wipLimit` (`number | undefined` on create; `number | null |
  undefined` on update). They pass it straight through to the typed client.
- **FR-15** `hooks/mutations/column/use-create-column.ts` and `use-update-column.ts` widen
  their `data` types identically.
- **FR-16** Cache invalidation is already correct and must be preserved, not re-implemented:
  `useUpdateColumn` invalidates `["columns", projectId]` and `["tasks", projectId]` with
  `refetchType: "all"`; `useCreateColumn` invalidates everything. This satisfies AC-5.
- **FR-17** `hooks/queries/column/use-get-columns.ts` needs no change — its return type is
  inferred from the client and will carry `wipLimit` once FR-1 lands.

### Module: Web — column editor (`apps/web/src/components/project/column-editor.tsx`)

- **FR-18** Each existing column row gains a small numeric input for the WIP limit, shown
  next to the "Done column" switch group, disabled when `!canEdit` (same gate the rename input
  and the switch already use).
- **FR-19** Committing a value on blur (and on Enter, matching the rename input's existing
  `onKeyDown` behavior) calls `updateColumn({ id, projectId, data: { wipLimit } })`.
- **FR-20** Clearing the input to empty sends `wipLimit: null`. A value that is not a positive
  integer is not sent; the input reverts to the persisted value.
- **FR-21** Success and failure produce toasts through the existing `toast` helper with new
  `settings:columnEditor.*` keys, matching the shape of `toastRenamed` / `toastRenameError`.
- **FR-22** The "add new column" row is NOT extended with a limit field. A limit is set after
  creation. This keeps the create path unchanged in the UI while the API still accepts it
  (FR-5), which is what the typed client and any MCP/API consumer needs.

### Module: Web — over-cap indicator (`apps/web/src/components/kanban-board/column/`)

- **FR-23** `ColumnHeader` renders an over-cap indicator when, and only when, the column has a
  non-null `wipLimit` and its task count is strictly greater than that limit.
- **FR-24** When a limit is set and NOT exceeded, the header shows the count as
  `<count>/<limit>` in place of the bare count, with no alert styling. When no limit is set,
  the header is visually identical to today (bare count).
- **FR-25** The indicator is accessible: it carries a `title` and an accessible name from a
  static i18n key, not a bare colored dot. It uses the existing destructive/warning token from
  the Tailwind theme rather than a hard-coded hex.
- **FR-26 (source of `wipLimit` — key design constraint).** The board's column objects come
  from `GET /task/tasks/:projectId`, whose controller
  (`apps/api/src/task/controllers/get-tasks.ts`) **explicitly projects** a narrow column shape
  (`id: column.slug, slug, name, icon, isFinal, tasks`) rather than spreading the row. That
  file is **outside this run's write-contract allowlist**. Therefore `ColumnHeader` must source
  the limit from the already-allowlisted `useGetColumns(projectId)` query and match on `slug`.
  This is an established pattern inside this very subtree —
  `kanban-board/task-card-context-menu/task-card-context-menu-content.tsx` already calls
  `useGetColumns`. See OQ-1 for the alternative.
- **FR-27** While the columns query is loading or errored, the header falls back to today's
  bare-count rendering. No spinner, no layout shift, no error surface.

### Module: i18n (`i18n/en-US.json`)

- **FR-28** All new copy uses static keys added to `en-US.json` only. No interpolated key
  names, no runtime-constructed key paths.
- **FR-29** New keys live under the existing namespaces already used by the two touched
  components: `settings.columnEditor.*` for the editor, `tasks.kanban.*` for the board header.
- **FR-30** `i18n/schema.json` is consulted; if it is a generated/validating artifact for the
  locale files, the run must not leave `en-US.json` inconsistent with it. `schema.json` is not
  in the allowlist, so if a conflict arises it is raised as a mini-gate, not silently patched.

### Module: Tests

- **FR-31** `tests/api/column/` gains unit coverage for `createColumn` and `updateColumn`
  `wipLimit` handling, following the existing `vi.mock("../../../apps/api/src/database", ...)`
  pattern used by `tests/api/label/delete-label.test.ts`. No live database.
- **FR-32** A web test under `apps/web/src/components/kanban-board/column/` covers the three
  indicator states (no limit → bare count; limit not exceeded → `n/limit`, no alert;
  limit exceeded → indicator present), mocking `useGetColumns` the way
  `apps/web/src/components/task/task-status-popover.test.tsx` already does.
- **FR-33** No existing test is modified or deleted to make new code pass.

## 4. Non-functional requirements

- **NFR-1 Verification.** `pnpm --filter @kaneo/api test && pnpm --filter @kaneo/web test`
  must be green, with a count of **at least** the baseline 374 API tests and 112 web tests.
- **NFR-2 Typecheck.** `pnpm --filter @kaneo/api typecheck` and
  `pnpm --filter @kaneo/web typecheck` must pass. The web typecheck is the real proof that
  `wipLimit` propagates through `@kaneo/libs`' inferred client types.
- **NFR-3 Lint.** `pnpm exec biome ci .` (read-only) must pass on the changed files. The
  package `lint` scripts are `biome check --write` and are forbidden in this run.
- **NFR-4 Performance.** No new N+1 query and no new per-render network call. `useGetColumns`
  is a cached TanStack query already resident in this page's tree.
- **NFR-5 Migration safety.** Additive, nullable, no backfill, no lock-heavy DDL. Must be
  correct for an existing populated installation, not only a fresh dev database.
- **NFR-6 Simplicity (AGENTS.md).** Thin handlers, domain behavior in controllers, no new
  abstraction layer, no parallel untyped request path, no speculative extension points.
- **NFR-7 Scope containment.** The write-contract allowlist is frozen and strict. Any need to
  touch a file outside it stops for a mini-gate rather than being worked around.

## 5. PII inventory

| Field | Sensitivity | Protection |
| --- | --- | --- |
| `column.wip_limit` | **None.** A small positive integer describing a project's process policy. | Same workspace-scoped authorization as every other column field. Not user-identifying, not free text, not a secret. |

No new PII, no new free-text field, no new user-supplied string reaching logs, events, or
WebSocket payloads. The run introduces no new column that could carry personal data.

## 6. Role matrix (delta only — no new roles or verbs)

| Role capability | Resource | Action | Enforcement |
| --- | --- | --- | --- |
| `project: ["update"]` | column | create with `wipLimit` | `requireWorkspacePermission` on `POST /column/:projectId` — unchanged |
| `project: ["update"]` | column | set / clear `wipLimit` | `requireWorkspacePermission` on `PUT /column/:id` — unchanged |
| workspace member (any) | column | read `wipLimit` | `workspaceAccess.fromProject` on `GET /column/:projectId` — unchanged |
| non-member | column | none | existing workspace-access middleware — unchanged |

Web-side, the editor's input is gated by the existing `canManageProjects()` check that already
gates rename and delete. Per AGENTS.md, that UI gate is a convenience; the API remains the
authority.

## 7. Acceptance criteria

Numbered to match the brief, expanded into executable form.

1. **AC-1** `wipLimit` is nullable. A generated migration adds `wip_limit integer` to table
   `column`; the SQL contains no `NOT NULL`, no `DEFAULT`, no `DROP`. Columns created before
   this run read back `wipLimit: null` and render exactly as before.
2. **AC-2** `POST /column/:projectId` with `wipLimit: 5` persists 5. With `wipLimit: 0`,
   `-1`, `2.5`, or `"5"` it returns 400. `PUT /column/:id` with `wipLimit: null` clears it;
   with the field omitted, the stored value is unchanged. Permission middleware on both routes
   is byte-for-byte the same as at HEAD apart from the added validator field.
3. **AC-3** `GET /column/:projectId` includes `wipLimit` for every column.
   `pnpm --filter @kaneo/web typecheck` passes with `wipLimit` read off the `useGetColumns`
   result without a cast — proving the typed client carried it end to end.
4. **AC-4** In the authenticated board header: `wipLimit === null` → bare count, no indicator,
   DOM unchanged from HEAD. `wipLimit = 5`, 3 tasks → `3/5`, no alert styling, no indicator.
   `wipLimit = 5`, 6 tasks → indicator present with an accessible name from a static key.
   Boundary: exactly 5 tasks with limit 5 is **not** over cap.
5. **AC-5** Setting or clearing a limit in the column editor invalidates `["columns",
   projectId]` and `["tasks", projectId]` with `refetchType: "all"`, so an open board updates
   without a manual reload. Verified by the existing `useUpdateColumn` implementation being
   preserved, not rewritten.
6. **AC-6** Every new user-facing string resolves through a static key present in
   `i18n/en-US.json`. No literal English copy is introduced into either touched component.
   `grep` for the new keys finds them in `en-US.json`.
7. **AC-7** `pnpm --filter @kaneo/api test && pnpm --filter @kaneo/web test` exits 0 with
   >= 374 API and >= 112 web tests. Both typechecks pass. `pnpm exec biome ci .` passes.
8. **AC-8** `git status` shows changes confined to the write-contract allowlist. No file under
   `apps/web/src/components/public-project/`, `apps/site/`, `charts/`, `packages/mcp/`, no
   non-English locale, no migration `0000`–`0042`, and no AI-config file is modified.

## 8. Open questions for HITL

- **OQ-1 (decision embedded in FR-26 — please confirm or override).** The board's column
  objects are built by `apps/api/src/task/controllers/get-tasks.ts`, which hand-projects a
  narrow column shape and so will *not* carry `wipLimit`. That file is outside the frozen
  allowlist. Two ways forward:
  - **(a) chosen** — `ColumnHeader` reads the limit from `useGetColumns(projectId)` and matches
    by `slug`. Stays entirely inside the allowlist. Costs one extra already-cached query in a
    component tree that reaches for `useGetColumns` elsewhere anyway. Slight duplication of
    "where does column metadata come from" on the board.
  - **(b)** — amend the write contract to add `apps/api/src/task/controllers/get-tasks.ts`,
    add one line to its projection, and let `wipLimit` arrive with the rest of the board data.
    Cleaner data flow and one source of truth for the board's column shape; requires reopening
    a frozen contract and touching the busiest read path in the API.

  Proceeding with **(a)** unless you say otherwise.
- **OQ-2.** `i18n/schema.json` exists and is not in the allowlist. If it turns out to be a
  strict schema that enumerates every key (rather than a shape-only schema), adding keys to
  `en-US.json` may require a matching edit there. Discovery did not classify it. If that
  proves necessary, the run will stop at a mini-gate rather than write outside the allowlist.
- **OQ-3.** The 17 non-English locale files are off-limits, so the new keys will be missing
  there and i18next will fall back to English for those users until a separate translation
  pass. Confirmed as acceptable by the brief's non-goals; flagged here so it is a decision and
  not a surprise.

# Requirements — feature-extend — Per-lane WIP limit with over-cap indicator

Run: `20260824-095555-feature-extend-wip-limits` · Intent: `feature-extend` · Mode: brownfield
Form: **delta requirements** (Intent matrix, feature-extend row)

This is a delta against the existing Kaneo behavior, not a greenfield spec. Every requirement below
is expressed as a change to a surface that already exists.

---

## 0. Delta summary

Today `columnTable` has no notion of a work-in-progress cap. Columns are created/updated through
`apps/api/src/column/` and edited in `ColumnEditor` on Settings → Project → Workflow. The kanban
lane header (`apps/web/src/components/kanban-board/column/column-header.tsx`) renders the lane's
task count as a bare badge (`{column.tasks.length}`).

The delta adds one nullable integer to the column, plumbs it through the column API and the board's
column payload, adds one input to `ColumnEditor`, and changes the lane header's count badge to a
count-vs-limit badge with a distinct over-cap state. Nothing is enforced.

---

## 1. In scope

1. `columnTable.wipLimit` — nullable `integer`, no default, added by a drizzle-kit generated
   migration that is additive and safe on a populated database.
2. Column API accepts `wipLimit` on create and update, returns it on get/create/update, validated
   with Valibot as a positive integer or `null`, with OpenAPI metadata kept accurate.
3. `wipLimit` is surfaced on the column objects the board reads, so the lane header can render it.
4. `ColumnEditor` gains a per-column WIP-limit input that can set, change, and clear the limit.
5. Lane header renders `count / limit` when a limit is set, and a visually distinct over-cap state
   when `count > limit`.
6. New user-facing copy added as static i18n keys with `i18n/en-US.json` as the source of truth,
   and the other 17 locale files kept structurally in sync with the repo's existing tooling.
7. Focused API tests for validation + persistence; focused web tests for the indicator's
   under/at/over-cap and no-limit states.

## 2. Out of scope

1. Any hard enforcement — no blocked drops, no rejected task creation, no API 4xx on over-cap moves,
   no toasts or warnings on crossing the cap.
2. Inline WIP-limit editing from the board lane header.
3. Workspace-level or project-level default limits, or limit templates.
4. WIP-limit analytics, history, activity entries, notifications, or events.
5. Changes to `workflowRuleTable`, gitea/github column resolvers, MCP tools, or task import/export.
6. Any new entry in the `@kaneo/permissions` vocabulary.
7. Board performance refactoring beyond what the indicator itself needs.
8. Backfilling limits onto existing columns.

---

## 3. Functional requirements per module

### 3.1 Module `api/database` — schema + migration

- **FR-1** `columnTable` gains `wipLimit: integer("wip_limit")` — nullable, no default. NULL means
  "no limit". Existing rows are unaffected.
- **FR-2** A migration is generated with `pnpm --filter @kaneo/api db:generate`, inspected, and
  committed alongside the schema change. It must be a single additive `ALTER TABLE "column" ADD
  COLUMN "wip_limit" integer;` with no data rewrite, no NOT NULL, no default, and no index.
- **FR-3** The migration is numbered after the existing latest (`0042_previous_the_executioner.sql`)
  and does not renumber or edit any existing migration.
- **FR-4** `apps/api/src/database/relations.ts` is touched only if drizzle requires it. A scalar
  column addition does not; expect no change.

### 3.2 Module `api/column` — validators + controllers + OpenAPI

- **FR-5** `POST /column/:projectId` accepts optional `wipLimit`. Valibot shape:
  `v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))))`. Omitted → stored NULL.
- **FR-6** `PUT /column/:id` accepts optional `wipLimit` with the same shape. Explicit `null` clears
  the limit; omission leaves the stored value untouched (matching the existing
  `data.x !== undefined` merge convention in `update-column.ts`).
- **FR-7** Invalid values are rejected by the validator with the framework's standard 400: `0`,
  negatives, non-integers (`2.5`), strings (`"3"`), booleans.
- **FR-8** `createColumn` persists `wipLimit` on insert (`wipLimit ?? null`); `updateColumn` includes
  it in its conditional `.set()` spread.
- **FR-9** `getColumns` returns `wipLimit` — it already does `db.select()` with no projection, so
  this is satisfied by FR-1 with no code change. Verified by test, not by edit.
- **FR-10** The `describeRoute` metadata for create and update is updated so the OpenAPI description
  reflects the new field's meaning and its null semantics.
- **FR-11** Authorization is unchanged: `workspaceAccess.fromProject`/`fromColumn` +
  `requireWorkspacePermission({ project: ["update"] })` already guard create/update. Setting a WIP
  limit therefore requires exactly the permission that already gates column editing. No new check,
  no new vocabulary, and no UI-only gating.

### 3.3 Module `api/task` — board column payload

- **FR-12** The board reads its columns from `GET /task/tasks/:projectId`
  (`apps/api/src/task/controllers/get-tasks.ts`), whose `projectColumns.map(...)` projects an
  explicit subset (`id`, `slug`, `name`, `icon`, `isFinal`, `tasks`). `wipLimit` must be added to
  that projection for the lane header to see it.
- **FR-13** This is a purely additive response field. Existing consumers of the endpoint are
  unaffected.
- **See OQ-1** — `apps/api/src/task/**` is not in the frozen write contract. Requires an allowlist
  amendment or the OQ-1 fallback.

### 3.4 Module `web/plumbing` — fetchers, hooks, types

- **FR-14** `apps/web/src/fetchers/column/update-column.ts` and `create-column.ts` widen their `data`
  parameter type with `wipLimit?: number | null`.
- **FR-15** `apps/web/src/hooks/mutations/column/use-update-column.ts` and `use-create-column.ts`
  widen their mutation-variable types identically. Existing cache invalidation (`["columns", id]`
  and `["tasks", id]`) already covers both the settings list and the board, so **no new
  invalidation is required** — the board's task query is already invalidated on column update.
- **FR-16** `ProjectWithTasks` (`apps/web/src/types/project/index.ts`) is inferred from the tasks
  endpoint via `InferResponseType`, so `wipLimit` appears on `ProjectWithTasks["columns"][number]`
  automatically once FR-12 lands. No manual type edit expected.
- **FR-17** `packages/libs` exposes the typed client via hono RPC inference. No hand-written type
  changes expected there; the package is in scope only if inference proves insufficient.

### 3.5 Module `web/settings` — ColumnEditor

- **FR-18** Each column row in `ColumnEditor` gains a small numeric input for the WIP limit, placed
  in the existing right-hand controls group beside the "Done column" switch.
- **FR-19** The input is `disabled` when `!canEdit` (`canManageProjects()`), consistent with the name
  input, icon picker, and switch. This mirrors — never replaces — the API check in FR-11.
- **FR-20** Commit-on-blur and commit-on-Enter, matching the existing rename input's interaction
  pattern. No commit on every keystroke.
- **FR-21** An empty input clears the limit — sends `wipLimit: null`.
- **FR-22** A value that is not a positive integer is not sent; the input reverts to the stored value
  and no mutation fires. (Client-side guard; the API validator in FR-7 remains the authority.)
- **FR-23** Success and failure use the existing `toast.success` / `toast.error` convention with new
  `settings:columnEditor.*` keys.
- **FR-24** The change persists across a page reload — guaranteed by FR-8 plus the existing
  `["columns", projectId]` invalidation.

### 3.6 Module `web/board` — lane header indicator

- **FR-25** When `column.wipLimit` is null/undefined, the header renders **exactly** as today: the
  bare count badge, same classes, same DOM shape. This is a regression-sensitive requirement.
- **FR-26** When a limit is set and `count <= limit`, the badge renders `count / limit` in the
  existing neutral muted style.
- **FR-27** When `count > limit`, the badge renders `count / limit` in a distinct over-cap style
  using existing Tailwind design tokens (destructive/warning family), not a new hard-coded color.
- **FR-28** The badge carries an accessible label/title from a static i18n key conveying "N of M
  tasks, over the limit" vs "N of M tasks", so the state is not conveyed by color alone (WCAG 1.4.1).
- **FR-29** Drag/drop, task creation, the archive-all control, and the create-task modal behave
  identically regardless of limit or over-cap state. No handler is gated on `wipLimit`.
- **FR-30** The count used is `column.tasks.length`, the same value rendered today. No new query, no
  new derived count source.

### 3.7 Module `i18n`

- **FR-31** All new copy uses static keys under existing namespaces — `settings:columnEditor.*` for
  the editor, `tasks:kanban.*` for the lane header. No interpolated key names, no dynamic lookup.
- **FR-32** `i18n/en-US.json` is the source of truth. The other 17 locales are brought into
  structural sync so `pnpm i18n:check` stays clean (the repo's `--fix` mode copies the English value
  as a placeholder).
- **FR-33** `i18n/schema.json` is regenerated with `pnpm i18n:schema` if new keys change it.
- **See OQ-2** — the actual i18n root is `./i18n/`, not the `apps/web/src/i18n/**` path in the frozen
  write contract.

### 3.8 Module `tests`

- **FR-34** API tests under `tests/api/column/` cover: valid limit persists on create; valid limit
  persists on update; `null` clears; `0`, `-1`, `2.5`, `"3"` are rejected; omission on update leaves
  the stored value untouched; `getColumns` returns the field.
- **FR-35** Web component tests beside the component cover the lane header's four states: no limit
  (renders bare count, no "/"), under cap, exactly at cap, over cap (over-cap styling/label present).
- **FR-36** No existing test is modified to make new code pass. The green baseline (API 374, web 112)
  must still be green, plus the new tests.

---

## 4. Non-functional requirements

- **NFR-1 Compatibility.** Existing installations upgrade with one additive DDL statement. No
  backfill, no downtime-sensitive lock beyond a catalog-only `ADD COLUMN` with no default (fast in
  PostgreSQL 11+).
- **NFR-2 Zero-cost default.** A project that never sets a limit sees no behavioral, visual, or
  query-shape change.
- **NFR-3 Performance.** No additional network request per board mount, and no additional query per
  lane. The limit rides along on the payload the board already fetches (FR-12).
- **NFR-4 Simplicity (AGENTS.md).** Thin Hono handlers; domain behavior stays in the column
  controllers; web requests stay in `apps/web/src/fetchers/`; server state stays in TanStack Query
  hooks; the typed `@kaneo/libs` client is used, not bypassed.
- **NFR-5 Accessibility.** Over-cap state is conveyed by text/label as well as color (FR-28).
- **NFR-6 Type safety.** `pnpm --filter @kaneo/api typecheck` and `pnpm --filter @kaneo/web
  typecheck` pass. Inferred types preferred; `type` over `interface`.
- **NFR-7 Formatting.** Changed files satisfy Biome. Verified with `pnpm biome check` scoped to
  changed paths — never repo-wide `pnpm lint`, which writes.
- **NFR-8 No scope creep.** No unrelated refactor of the board, the editor, or the column module.

---

## 5. PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| `column.wipLimit` | **None.** A small integer describing a project's process policy. Not personal data, not a secret, not a credential. | Same workspace-scoped authorization as every other column field (`workspaceAccess` + `project:update`). Never logged, never emitted to events/WebSockets/MCP. |
| Lane task counts (`column.tasks.length`) | Unchanged — already rendered today. | No change. Derived client-side from data the user is already authorized to see. |

No new PII is introduced, stored, transmitted, or logged. No new event is published, so no new
data crosses the event → WebSocket → Redis fan-out boundary.

---

## 6. Role matrix

Roles from `@kaneo/permissions`; no new vocabulary (FR-11).

| Role / capability | Read `wipLimit` (board + settings) | Set / change / clear `wipLimit` |
|---|---|---|
| Workspace member with project **read** (`workspaceAccess` passes) | Yes — it rides on the column payload they already receive | No |
| Workspace member with **`project:update`** (what `canManageProjects()` reflects) | Yes | Yes |
| Non-member of the workspace | No — blocked by existing `workspaceAccess` middleware before the handler | No |
| Public/anonymous project viewer | Read-only, via the existing public-project path; unchanged by this delta | No |

Enforcement point: `requireWorkspacePermission({ project: ["update"] })` on `POST /column/:projectId`
and `PUT /column/:id`. The `ColumnEditor` `disabled` state is presentation only.

---

## 7. Acceptance criteria

Numbered to match the intent brief's criteria 1–9, plus two added by this analysis.

1. **AC-1** `columnTable` has a nullable `wipLimit` integer, with a generated and inspected migration
   that is additive and safe on a populated database. *(FR-1..FR-3)*
2. **AC-2** The column API accepts and returns `wipLimit`, validated as positive-integer-or-null with
   accurate OpenAPI metadata, and rejects `0`, negatives, non-integers, and non-numbers.
   *(FR-5..FR-10, FR-34)*
3. **AC-3** Setting a limit requires `project:update`, enforced in the API. A request without it is
   rejected by the existing middleware, proven by test, not by UI absence. *(FR-11)*
4. **AC-4** `ColumnEditor` can set, change, and clear a column's limit, and the change survives a
   reload. *(FR-18..FR-24)*
5. **AC-5** The lane header shows count vs limit when a limit is set, with a distinct over-cap state
   when count exceeds limit. *(FR-26, FR-27)*
6. **AC-6** A column with no limit renders exactly as it does today — identical badge markup.
   *(FR-25)*
7. **AC-7** All new user-facing copy uses static i18n keys; `i18n/en-US.json` is the source of truth
   and `pnpm i18n:check` is clean. *(FR-31..FR-33)*
8. **AC-8** Drag/drop, task creation, and archiving are unchanged; nothing is blocked by a limit.
   *(FR-29)*
9. **AC-9** Focused API tests cover validation and persistence; focused web tests cover the
   indicator's no-limit/under/at/over states; `pnpm --filter @kaneo/api test` and
   `pnpm --filter @kaneo/web test` are green with no baseline test modified. *(FR-34..FR-36)*
10. **AC-10** Affected packages typecheck. *(NFR-6)*
11. **AC-11** No file outside the confirmed write contract is modified. Every write is preceded by a
    provenance record so `/mmo:revert` can restore the pre-run state.

---

## 8. Open questions for HITL

Three findings from reading the actual code contradict paths frozen into
`.sdlc/local/write-contract.json` at Gate 0. The contract is enforced at the tool boundary by the
PreToolUse hook, so these must be resolved before Phase 5 or the corresponding writes will be
refused.

### OQ-1 — The board's column payload comes from the **task** module, not the column module

`ColumnHeader` consumes `ProjectWithTasks["columns"][number]`, which is inferred from
`GET /task/tasks/:projectId`, not from `GET /column/:projectId`. That handler
(`apps/api/src/task/controllers/get-tasks.ts:224`) projects an explicit field subset:

```ts
const columns = projectColumns.map((column) => ({
  id: column.slug,
  slug: column.slug,
  name: column.name,
  icon: column.icon,
  isFinal: column.isFinal,
  tasks: /* ... */,
}));
```

`wipLimit` will not reach the lane header unless that projection includes it.
`apps/api/src/task/**` is **not** in the allowlist.

- **Option A (recommended).** Amend the allowlist with the single file
  `apps/api/src/task/controllers/get-tasks.ts`. The change is one additive line
  (`wipLimit: column.wipLimit,`) in the same projection that already carries `icon` and `isFinal`.
  Cheapest, matches the existing pattern, no extra request per board mount, and keeps a single
  source of truth for the lane's data.
- **Option B.** Stay strictly inside the frozen contract: have the board call the existing
  `useGetColumns(projectId)` query and join limits onto lanes client-side. Costs one extra
  `GET /column/:projectId` per board mount and introduces two sources of truth for the same lane,
  which can render a stale limit against a fresh count.

### OQ-2 — The i18n root is `./i18n/`, not `apps/web/src/i18n/**`

The allowlist entry `apps/web/src/i18n/**` matches **no directory in this repo** — that path does not
exist. Locale files live at the repo root: `i18n/en-US.json` plus 17 other locales, `i18n/schema.json`,
and `i18n/resources.ts`, consumed by the web app through the `@i18n` Vite alias. AGENTS.md's
"`i18n/en-US.json` is the source of truth" refers to this root directory.

Without an amendment, **no user-facing copy can be added at all** and AC-7 cannot be met.

- **Recommended.** Amend the allowlist with `i18n/*.json` — enough for `en-US.json`, the 17 sibling
  locales that `pnpm i18n:check --fix` backfills, and the generated `schema.json`. `i18n/resources.ts`
  is not expected to need a change and can be left out.

### OQ-3 — `apps/web/src/lib/column.ts` does not exist; the file is `column.tsx`

The allowlist names `apps/web/src/lib/column.ts`; the real module is
`apps/web/src/lib/column.tsx` (it returns JSX from `getColumnIcon`). Analysis found **no reason to
modify it** — the WIP indicator does not touch icon resolution — so this is recorded for accuracy
rather than as a blocker.

- **Recommended.** Leave as-is. If Phase 5 discovers a genuine need, it will come back as a
  mini-gate rather than silently widening scope.

### OQ-4 — Locale backfill policy

`pnpm i18n:check` fails on any locale missing a key present in `en-US.json`. The repo's own
`--fix` mode backfills the missing key with the **English** string as a placeholder.

- **Recommended.** Use `pnpm i18n:check:fix` to backfill the 17 non-English locales with English
  placeholders, exactly as the repo's tooling intends, rather than machine-translating copy.
  Confirm this is acceptable, or the run will add keys to `en-US.json` only and leave
  `pnpm i18n:check` reporting missing keys.

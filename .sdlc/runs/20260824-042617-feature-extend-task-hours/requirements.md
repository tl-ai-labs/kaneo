# Requirements Delta — Task Estimated Hours + Column Rollup

## 1. Scope of the delta

1. Add an optional, nullable `estimatedHours` field to the TASK entity, persisted in PostgreSQL.
2. Accept the field on task create and task update through the HTTP API with Valibot validation and accurate OpenAPI metadata.
3. Return the field on the single-task read, the board payload per-task shape, and any task shape consumed by the kanban board.
4. Expose the field on the MCP task update tool's full-body reconstruction so MCP updates do not erase it.
5. Thread the field through the web `Task` type, the create fetcher, the update fetcher, and the mutation hooks that call them.
6. Add the field to at least one task-editing surface reachable from the board (final list of surfaces DEFERRED TO DESIGN).
7. Render, in the kanban column header, a rollup of the estimated hours of the tasks visible in that column.
8. Distinguish three states in the header: no task in the column has an estimate; some do and some do not; every task has an estimate.
9. Add every new user-facing string as a static key in `i18n/en-US.json` only.
10. Generate the schema migration via `pnpm --filter @kaneo/api db:generate`, inspect the SQL, and commit it alongside the schema change with no backfill and no data rewrite.
11. Add API unit tests, a web component test for the column header, and a PostgreSQL-backed integration test covering the mixed-estimate rollup case.

## 2. Out of scope

1. Time tracking / logged hours — the `timeEntryTable` subsystem is off-limits this run.
2. Burn-down, velocity, or story points — no analytical layer is added.
3. Per-user or per-project default estimates — no defaulting behaviour.
4. Any change to drag-and-drop or drop-zone behaviour — `column-dropzone.tsx` is off-limits.
5. Blocking, warning, or gating any action on the rollup total — display only.
6. Translation into locales other than en-US — other locale files are translated separately.
7. New permission actions — reuse the existing `task:["create"|"update"]` vocabulary.
8. A new dedicated PUT endpoint like `update-task-due-date` — no new fetcher files are permitted by the write contract (see §5, §7).
9. Committing, pushing, or opening a pull request — explicitly excluded by the brief.
10. Backfill of existing rows — the fixed constraint forbids it.

## 3. Functional requirements

### Database
- **FR-1** `taskTable` in `apps/api/src/database/schema.ts` gains a nullable `estimatedHours` column. Column type (integer vs numeric) is DEFERRED TO DESIGN (DR-2).
- **FR-2** A Drizzle-generated migration under `apps/api/drizzle/` adds the column as nullable with no default and no backfill; it must apply cleanly to a populated database.
- **FR-3** No index is added unless the design chooses a server-side aggregate that requires one (DR-1).

### API — schemas and validation
- **FR-4** `taskSchema` in `apps/api/src/schemas.ts` includes `estimatedHours` as an optional/nullable value so the OpenAPI response for create/get/update accurately advertises it.
- **FR-5** POST `/:projectId` Valibot body in `apps/api/src/task/index.ts` accepts an optional `estimatedHours` and rejects out-of-range or wrongly-typed values with HTTP 400 before the DB is touched.
- **FR-6** PUT `/:id` Valibot body in `apps/api/src/task/index.ts` accepts an optional `estimatedHours` with the same validation as create.
- **FR-7** The validator states an explicit accepted range consistent with the chosen column type (bound value DEFERRED TO DESIGN, DR-3).

### API — controllers
- **FR-8** `create-task.ts` accepts `estimatedHours` on its named-object arg and inserts it (or `null` when omitted). Existing callers that omit it must continue to work.
- **FR-9** `update-task.ts` accepts `estimatedHours` and persists it. It must distinguish "not supplied" from "explicitly cleared" so a full-PUT caller that omits the field does not silently null it (see §7, R-1). The exact preserve/clear semantics are DEFERRED TO DESIGN (DR-5) but must satisfy this constraint.
- **FR-10** `get-task.ts` selection includes `estimatedHours`.
- **FR-11** `get-tasks.ts` taskSelection (board payload) includes `estimatedHours` on every task returned.
- **FR-12** If the design chooses a server-side aggregate (DR-1), `get-tasks.ts` column shape at lines 224-237 adds a numeric field carrying the sum; otherwise the column shape is unchanged and the client sums per-task values.

### API — MCP
- **FR-13** `buildFullTaskUpdateBody` in `apps/api/src/mcp/tools.ts` forwards `estimatedHours` from the existing task when a patch omits it, so MCP updates never erase an estimate.

### Web
- **FR-14** The hand-written `Task` type in `apps/web/src/types/task/index.ts` gains an optional `estimatedHours` field.
- **FR-15** `apps/web/src/fetchers/task/create-task.ts` extends its positional signature to carry `estimatedHours` and forwards it in the JSON body.
- **FR-16** `apps/web/src/fetchers/task/update-task.ts` includes `estimatedHours` in its fixed body so drag-and-drop, archive-all, and draft promotion do not erase the estimate.
- **FR-17** `use-create-task` and `use-update-task` hooks pass `estimatedHours` through to their fetchers without reshaping.
- **FR-18** At least one task-editing surface reachable from the board exposes an input for `estimatedHours` gated on `canUpdateTasks()`. The set of surfaces is DEFERRED TO DESIGN (DR-4); each surface not chosen must have a stated reason.
- **FR-19** `column-header.tsx` renders a rollup element in addition to the existing count pill. The element carries an accessible name (DEFERRED TO DESIGN, DR-6) and distinguishes the three states from FR-8 of §1. The element must not affect drop-zone behaviour or the count pill.
- **FR-20** The rollup source (client-side sum over the filter-narrowed `column.tasks`, or a server-side field from FR-12) is DEFERRED TO DESIGN (DR-1); whichever is chosen, the header must not issue an extra request per column.

### i18n
- **FR-21** Every new user-facing string (field label, placeholder, rollup label, empty-state label, validation error copy) is added as a static key under `tasks.properties`, `tasks.kanban`, or `common.modals.createTask` in `i18n/en-US.json` only. No other locale file is edited. `i18n/schema.json` is not edited.

## 4. Non-functional requirements

- **NFR-1 Backward compatibility.** Existing rows read back with `estimatedHours = null`. Existing API request bodies that omit the field must still succeed. Existing MCP callers must continue to work with no client change.
- **NFR-2 Migration safety.** The generated migration must add the column as nullable with no default, no backfill, no table rewrite, and no lock beyond a brief metadata lock on a populated `task` table.
- **NFR-3 Board performance.** The board payload gains at most one scalar per task and (if DR-1 chooses server-side) one scalar per column. No new N+1 query, no per-column round trip, no additional join outside the existing task query.
- **NFR-4 Rollup rendering cost.** If client-side, the sum is O(tasks-in-column) per render and must not cause a re-render of sibling columns.
- **NFR-5 Accessibility.** The rollup element has a programmatic accessible name; the visual distinction between the three states (§1.8) must not be conveyed by colour alone.
- **NFR-6 i18n discipline.** All new copy is a static key. No string is inlined in a component. Placeholders use ICU where a number is interpolated.
- **NFR-7 Type-safety limits.** Because `ProjectWithTasks` overrides `columns[].tasks` with the hand-written `Task`, a missing `estimatedHours` in `get-tasks.ts` taskSelection will not fail typecheck — an integration test is required to catch it (see AC-8).
- **NFR-8 Authorization parity.** The read guard for the board payload (`workspaceAccess.fromProject` only) is inherited by the rollup; no new permission action is introduced (see §8).

## 5. Decision register — DEFERRED TO DESIGN

| ID | Question | Constraint requirements impose | Evidence that will decide it |
|---|---|---|---|
| DR-1 | Rollup computed client-side (sum over `column.tasks`) or server-side (new field on `get-tasks.ts` column shape). | Must render without an extra request per column (FR-20); must not visibly disagree with the adjacent count pill when a filter or board search narrows `column.tasks`. | F5: board fetcher sends no pagination, so a client-side sum is complete; `column.tasks` reaching header is filter-narrowed via `useTaskFiltersWithLabelsSupport`; count pill uses `{column.tasks.length}` so a server-side aggregate can visibly disagree under active filters. |
| DR-2 | Fractional hours allowed (implies `numeric`/`real`) or integer only (`integer`). | Column type must match validator; if fractional, summation and display rounding rules must be stated. | F4: Drizzle schema uses `integer()` at all 17 numeric sites; no `numeric`/`real`/`decimal` precedent exists. A new column type is a cost, not a prohibition. |
| DR-3 | Whether an upper bound applies and what it is. | Out-of-range values are rejected by the Valibot validator with HTTP 400 before reaching the DB (FR-5, FR-6). | Chosen column type from DR-2 sets the hard ceiling; product judgement sets the soft ceiling. |
| DR-4 | Which task-editing surfaces expose the field (create modal, detail view, inline popover à la due-date, etc.). | At least one surface reachable from the board (FR-18). Each surface not chosen has a stated reason. Choice must be satisfiable within the write contract (see §7 constraint gaps). | F6/F7: `create-task-modal.tsx` create+draft path; due-date-popover is the structural template; F10 write contract restricts which files can host new UI. |
| DR-5 | Update semantics: how to distinguish "field not sent" from "explicitly clear the estimate" in the PUT body. | Full-PUT callers (drag-and-drop, archive-all, MCP, draft promotion) must not silently null the estimate (R-1). | F2: `update-task.ts:54-69` applies the `|| null` pattern; the existing in-code comment about the priority-empty-string incident is the precedent. |
| DR-6 | Rollup element's accessible name, visual form (pill vs inline text vs adjacent badge), and the three-state distinction (none/mixed/all). | Must have a programmatic accessible name; must distinguish the three states without relying on colour alone (NFR-5). Must not affect drop behaviour. | F6: existing count pill is a bare `<span>` with no accessible name — the rollup is not required to mirror it. |

## 6. Thirteen-whitelist checklist

| # | File | Requirement IDs |
|---|---|---|
| 1 | `apps/api/src/database/schema.ts` (401-442) | FR-1 |
| 2 | `apps/api/drizzle/` (new generated migration) | FR-2, NFR-2 |
| 3 | `apps/api/src/task/controllers/get-tasks.ts` (123-139, board taskSelection) | FR-11 |
| 4 | `apps/api/src/task/controllers/get-tasks.ts` (224-237, column shape) | FR-12 (conditional on DR-1) |
| 5 | `apps/api/src/task/controllers/get-task.ts` (8-23) | FR-10 |
| 6 | `apps/api/src/schemas.ts` (25-44) | FR-4 |
| 7 | `apps/api/src/task/controllers/create-task.ts` (73-87) | FR-8 |
| 8 | `apps/api/src/task/controllers/update-task.ts` (9-21, 54-69) | FR-9, R-1 |
| 9 | `apps/api/src/task/index.ts` (190-201 create, 333-346 update) | FR-5, FR-6, FR-7 |
| 10 | `apps/web/src/types/task/index.ts` (21-40) | FR-14, NFR-7 |
| 11 | `apps/web/src/fetchers/task/update-task.ts` (9-27) | FR-16, R-1 |
| 12 | `apps/web/src/fetchers/task/create-task.ts` (8-13) | FR-15 |
| 13 | `i18n/en-US.json` (`tasks.kanban`, `tasks.properties`, `common.modals.createTask`) | FR-21, NFR-6 |
| +a | `apps/web/src/components/kanban-board/column/column-header.tsx` | FR-19, FR-20 |
| +b | `apps/web/src/components/kanban-board/column/column-header.test.tsx` | AC-6 |
| +c | Editing surface(s) chosen by DR-4 within the writable set (`apps/web/src/components/task/**` and the create-task modal, subject to §7 gap G-1) | FR-18 |
| +d | `apps/api/src/mcp/tools.ts` (`buildFullTaskUpdateBody`, 115-189) | FR-13 |
| +e | `apps/web/src/hooks/mutations/task/use-create-task.ts`, `use-update-task.ts` | FR-17 |
| +f | `tests/api/task/**` (new), `tests/api/column/**` | AC-4, AC-5 |
| +g | `tests/api-integration/task-estimated-hours.test.ts` (new) | AC-7, AC-8 |

## 7. Risk register

- **R-1 (highest) — Null-coercion trap on full-PUT.** `update-task.ts:54-69` applies the `x || null` pattern to fields on a full-PUT body. If `estimatedHours` is added naively, any full-PUT caller that omits it will silently overwrite an existing estimate with `NULL`. **Blast radius, three named callers:**
  1. `apps/web/src/fetchers/task/update-task.ts` — the fixed body used by `useUpdateTask`, which is reached from drag-and-drop (position/status changes on every card move) and from `column-header.tsx` archive-all.
  2. `apps/api/src/mcp/tools.ts` `buildFullTaskUpdateBody` — every MCP task update reconstructs a full body from a hand-picked field list.
  3. `create-task-modal.tsx` draft-promotion path — `handleSubmit` spreads the draft into `updateTask({...draftTask, ...})` and re-enters the same fetcher, dropping any field the fetcher does not forward.
  Mitigation constraint: DR-5 must resolve preserve-vs-clear semantics such that omission preserves.
- **R-2 — Filter-inconsistency vs count pill.** A server-side aggregate (DR-1 option) will disagree with the adjacent `{column.tasks.length}` pill under active filter/search. DR-1 resolution must state the failure mode of the option rejected (per intent brief).
- **R-3 — Type-safety blind spot.** `ProjectWithTasks` overrides `columns[].tasks` with the hand-written `Task[]`, so `pnpm typecheck` will NOT catch a missing entry in `get-tasks.ts` taskSelection. Only a runtime/integration test covers this — see AC-8.
- **R-4 — OpenAPI drift.** `taskSchema` already omits `assigneeName`/`assigneeImage`/`updatedAt` versus the real payload. Adding `estimatedHours` without updating `taskSchema` compounds the drift. FR-4 forbids this.
- **R-5 — Migration on populated DB.** A `NOT NULL` column or a column with a computed default would rewrite the table. NFR-2 forbids both.
- **R-6 — Fractional summation drift (conditional on DR-2 choosing numeric/real).** Client-side sum of floating-point values across many tasks can present a non-canonical string. If DR-2 chooses fractional, design must state rounding and display precision.
- **R-7 — Write-contract gaps (from F10).** The design must be satisfiable within the writable set:
  - **G-1** — `apps/web/src/components/shared/modals/create-task-modal/**` is a directory pattern but the real file is `create-task-modal.tsx` (a file). The modal is effectively **NOT writable** under the current contract. If DR-4 requires editing it, the contract must be extended by the operator before implementation begins.
  - **G-2** — `apps/web/src/fetchers/task/**` is not allowlisted; only `create-task.ts` and `update-task.ts` are individually writable. **No new fetcher file may be created.** Design must not propose a dedicated `update-task-estimated-hours.ts` fetcher parallel to the due-date one.

## 8. Authorization and PII note

- **Authorization.** No new permission actions are introduced. Create is gated by `requireWorkspacePermission({ task: ["create"] })`; update by `requireWorkspacePermission({ task: ["update"] })` plus `requireTaskAssigneePermission` and `requireEntitlement` as today. Read of the board payload remains guarded by `workspaceAccess.fromProject` only; the rollup and per-task `estimatedHours` inherit that read guard and expose no data beyond what a workspace member already sees.
- **PII.** `estimatedHours` is a scalar numeric attribute of a task. It is not personally identifying and does not encode user identity, credentials, or private workspace metadata. No new fields are added to events, logs, or WebSocket payloads by these requirements; `task.updated` continues to publish its hand-picked subset (`taskId, projectId, title, status, userId`) unchanged.

## 9. Acceptance criteria

- **AC-1** (FR-5, FR-8) `POST /tasks/:projectId` with a valid `estimatedHours` persists the value; the response body echoes it; omitting the field creates a task with `estimatedHours = null`.
- **AC-2** (FR-6, FR-9, R-1) `PUT /tasks/:id` supplying `estimatedHours` updates the value; a subsequent full-PUT that omits `estimatedHours` (mimicking the web fetcher, MCP tool, and archive-all path) leaves the stored value unchanged, not `NULL`.
- **AC-3** (FR-5, FR-6, FR-7) An out-of-range or wrongly-typed `estimatedHours` in create or update is rejected with HTTP 400 by Valibot before any DB write; the DB never sees an invalid value.
- **AC-4** (FR-11) A `GET /tasks/:projectId` board payload returns `estimatedHours` on every task; an integration test asserting the exact key set of a returned task fails if the field is missing.
- **AC-5** (FR-10) A `GET /task/:id` single-task read returns `estimatedHours`.
- **AC-6** (FR-19, NFR-5) A component test on `column-header.tsx` renders three fixtures — column with no estimated tasks, column with a mix, column with all tasks estimated — and asserts the rollup element is present, distinguishable across the three states, and carries an accessible name. The existing count pill is unchanged.
- **AC-7** (FR-19, FR-20, mixed-estimate arithmetic) A PostgreSQL-backed integration test seeds a column with tasks where some have an estimate and others do not, fetches the board payload, and asserts the rollup value renders correctly (sum of non-null estimates) whether the source is client-side or server-side per DR-1.
- **AC-8** (NFR-7, R-3) The same integration test asserts that a task returned by the board payload contains the `estimatedHours` key, catching a missing entry in `get-tasks.ts` taskSelection that `pnpm typecheck` cannot.
- **AC-9** (FR-13, R-1) A test on `buildFullTaskUpdateBody` asserts an MCP patch omitting `estimatedHours` produces a body that preserves the existing value.
- **AC-10** (FR-2, NFR-2) The generated migration file adds the column as nullable with no default and no backfill; applying it against a database with existing task rows succeeds and leaves all existing rows with `estimatedHours = NULL`.
- **AC-11** (FR-21, NFR-6) Every new visible string in the diff resolves to a key in `i18n/en-US.json`. No other locale file and no `i18n/schema.json` change is included.
- **AC-12** (§8) The permission definitions in `packages/permissions` are unchanged. Existing middleware (`requireWorkspacePermission`, `workspaceAccess.fromProject`) enforces access on the new field with no additional guard added or bypassed.

---

## 10. Errata (appended 2026-08-24, after Gate 2)

Two claims in **§7 R-7** are **FALSE** and are superseded by `design.md` §4.0. They were written
against an inaccurate reading of `.sdlc/local/write-contract.json`; the operator independently
verified the contract afterwards. The rest of §7 stands.

| Claim in §7 R-7 | Status | Fact |
|---|---|---|
| **G-1** — `create-task-modal` is effectively NOT writable, because the contract holds a directory pattern `create-task-modal/**` while the real target is a file; the contract must be extended by the operator before implementation. | **FALSE — withdrawn** | The contract lists the literal file path `apps/web/src/components/shared/modals/create-task-modal.tsx` (write-contract.json allowlist line 24), plus its `.test.tsx` sibling. The modal **is** writable. **No operator action is or was required.** |
| **G-2** — `apps/web/src/fetchers/task/**` is not allowlisted; only `create-task.ts` and `update-task.ts` are individually writable, so **no new fetcher file may be created**, and the design must not propose a dedicated fetcher. | **FALSE — withdrawn** | `apps/web/src/fetchers/task/**` **is** allowlisted as a whole-directory glob (write-contract.json allowlist line 18). New fetcher files **are** permitted. |

Consequences for the approved scope:

- **§2 item 8** ("no new fetcher files are permitted by the write contract (see §5, §7)") is correct
  in its *conclusion* but wrong in its *reason*. A dedicated `update-task-estimated-hours.ts` fetcher
  is out of scope because **requirements §2 item 8 rules out a new dedicated PUT endpoint**, and a
  dedicated fetcher without a dedicated endpoint would only wrap the existing full PUT. It is a
  decision on the merits (design.md §4.1, row 3b), **not** a contract restriction.
- **DR-4** (§5) was recorded as constrained by these two gaps. It was not. It was resolved on the
  merits in design.md §4.1, with `create-task-modal.tsx` and `task-properties-sidebar.tsx` both in
  scope.
- **§6 row +c** ("subject to §7 gap G-1") — the qualifier is void.

This errata does not reopen Gate 1. No functional requirement, acceptance criterion, or non-goal
changes; only the stated reason for two scope boundaries.

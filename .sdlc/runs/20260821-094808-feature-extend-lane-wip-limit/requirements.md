# Delta requirements — Advisory per-lane WIP limit with over-cap indicator

Module: `column-wip-limit`. Run: `20260821-094808-feature-extend-lane-wip-limit`. Intent: brownfield feature-extend.
Tier: `claude-opus-5` (policy `opus-plus-sonnet-max`, rule 0 — "Judgment-heavy, low volume").

This document is a DELTA against the current state of the working tree at `5d1fc910`. It adds a single
optional, nullable integer setting on a board column plus a purely visual over-cap indicator; it does not
change authorization, drag-and-drop, or the semantics of any existing field.

**Orchestrator corrections applied to the model's draft** (each verified against the tree):
`i18n/en-US.json` lives at the repo root, not `apps/web/src/i18n/`; the kanban namespace is `tasks:kanban.*`,
there is no `board:` namespace; the column routes return **200** on create (`c.json(result)`), not 201; and the
integration test path is fixed by the write contract to `tests/api-integration/column-wip-limit.test.ts`.

---

## 1. In scope

1. Add an optional, nullable whole-number `wipLimit` scalar to the `column` table via a Drizzle-generated
   migration that is safe on populated databases (no backfill, no rewrite, no `NOT NULL`).
2. Accept an optional, nullable `wipLimit` on the column create endpoint (`POST /column/:projectId`) and the
   column update endpoint (`PUT /column/:id`), validated with an **explicit integer constraint** in the
   inclusive range `1..2147483647`.
3. Preserve the existing absent-vs-null semantics of the update controller: `wipLimit` absent from the update
   payload leaves the stored value unchanged; `wipLimit: null` clears it.
4. Include `wipLimit` in the board projection at `apps/api/src/task/controllers/get-tasks.ts:224-229` so the
   React board renders the value without an extra request, and let `ProjectWithTasks` pick the field up from
   the response inference.
5. Surface the setting in the existing per-column settings row rendered by
   `apps/web/src/components/project/column-editor.tsx`, gated by the same `canManageProjects()` check that
   already disables every sibling control.
6. Render the current limit on the board column header alongside the existing task-count badge, plus a
   distinct over-cap indicator when `tasks.length > wipLimit`.
7. Add every new user-facing string as a static key in `i18n/en-US.json`, following its existing conventions.
8. Add API unit tests for the validator and the update controller, one web component test for the header, and
   one PostgreSQL-backed integration test covering the round trip through the board projection.

## 2. Out of scope

1. Enforcing the limit. Task create, update, move, drag-and-drop and assignment behavior are unchanged;
   nothing rejects a task because a column is at or over its limit.
2. Any edit to `apps/web/src/components/kanban-board/column/column-dropzone.tsx`.
3. New permission vocabulary, new role, or any change to workspace-scoped authorization semantics.
4. Defaults or inheritance from user, project or workspace scope.
5. Analytics, breach history, event fan-out, notifications, integration webhooks, or an MCP surface for the
   new field.
6. Translations into locales other than `en-US`.
7. Committing, pushing or opening a pull request.
8. Backfilling `wipLimit` on existing rows; adding a database-level `CHECK` constraint (bounds are enforced at
   the API boundary, per constraint 3 of the brief).

---

## 3. Functional requirements per surface

### Data

- **FR-1 (schema).** `columnTable` in `apps/api/src/database/schema.ts` gains `wipLimit: integer("wip_limit")`.
  Nullable, no default. No other column, index, cascade or relation is modified.
- **FR-2 (migration).** A migration generated via `pnpm --filter @kaneo/api db:generate` adds the column with
  `ADD COLUMN "wip_limit" integer` — no `NOT NULL`, no `DEFAULT`, no `UPDATE`. Existing rows keep NULL and read
  back as "no limit". The file is generated and inspected, never hand-authored.
- **FR-3 (no DB constraint).** No CHECK constraint is added; the `1..2147483647` bound is enforced by the API.

### API

- **FR-4 (validator building block).** A single Valibot schema —
  `v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2147483647))` — is defined once and reused by both
  endpoints. `v.integer()` is required: a bare `v.number()` accepts `1.5`.
- **FR-5 (create).** The `POST /:projectId` JSON validator (`apps/api/src/column/index.ts:56-64`) gains
  `wipLimit: v.optional(v.nullable(wipLimitSchema))`. Absent or `null` at create stores NULL.
- **FR-6 (update).** The `PUT /:id` JSON validator (`apps/api/src/column/index.ts:132-140`) gains
  `wipLimit: v.optional(v.nullable(wipLimitSchema))`. Absent = leave unchanged; `null` = clear; valid integer =
  set.
- **FR-7 (update controller).** `updateColumn` extends its `data` type with `wipLimit?: number | null` and its
  conditional-set object with `...(data.wipLimit !== undefined && { wipLimit: data.wipLimit })`, preserving the
  existing `icon`/`color` idiom exactly.
- **FR-8 (create controller).** `createColumn` accepts `wipLimit?: number | null` and persists it, NULL
  otherwise. Note it must use `wipLimit ?? null` and **not** the `icon || null` idiom, because `0` is not a
  legal value anyway but a `||` on a numeric field is a latent bug.
- **FR-9 (error contract).** Validator failures produce the standard Valibot 400 from `hono-openapi`; no new
  `HTTPException` code is introduced. Existing 404/409/500 paths are untouched.
- **FR-10 (authorization unchanged).** Both routes keep `workspaceAccess.*` +
  `requireWorkspacePermission({ project: ["update"] })`. No new middleware, no new permission action.
- **FR-11 (advisory-only — a testable non-behavior).** No route rejects a task create/update/move because a
  target column is at or over `wipLimit`.
- **FR-12 (get-columns).** `get-columns.ts` uses `select()` star and carries the new field for free; it is not
  edited.

### Board projection

- **FR-13 (get-tasks mapping).** The mapping at `get-tasks.ts:224-229` gains `wipLimit: column.wipLimit` so the
  field survives the re-shape that currently drops `color`, `position` and the real `column.id`. No other
  dropped field is revived — reviving `color` or `position` is scope creep.
- **FR-14 (inferred client type).** `ProjectWithTasks` (`apps/web/src/types/project/index.ts:10-28`) picks up
  `wipLimit: number | null` automatically because it is inferred from this response. No manual type edit; the
  proof that inference landed is `pnpm typecheck`.

### Web data layer

- **FR-15 (fetchers).** `apps/web/src/fetchers/column/update-column.ts` and `create-column.ts` extend their
  hand-written `data` shapes with `wipLimit?: number | null` and forward it verbatim. The typed `@kaneo/libs`
  client stays the only transport.
- **FR-16 (hooks).** `use-update-column.ts` (and `use-create-column.ts`) extend the same shape a third time.
  Their existing invalidation of `["columns", projectId]` and `["tasks", projectId]` already covers the new
  field; no additional invalidation is added.
- **FR-17 (three-way sync).** The Valibot schema, the fetcher shape and the hook shape must agree. A mismatch
  is caught by `pnpm typecheck`, which is why that command is load-bearing for this ticket.

### UI

- **FR-18 (column editor row).** `column-editor.tsx` gains a numeric input for `wipLimit` in the existing
  per-column control cluster (`:299-341`), next to the isFinal Switch. Empty means "no limit" and is sent as
  `null`; a valid integer is sent as a number. Mutations key on `col.id` (the real cuid), matching every
  sibling handler.
- **FR-19 (client bound is convenience only).** The input carries `min=1`, `max=2147483647`, `step=1` as
  browser hints. The API remains the authority; a rejected value surfaces through the same
  `toast.error(error instanceof Error ? error.message : t(...))` pattern the sibling handlers use.
- **FR-20 (clear affordance).** Clearing the input and committing calls the update mutation with
  `wipLimit: null`.
- **FR-21 (no-op guard).** Committing an unchanged value must not fire a mutation, matching the
  `if (e.target.value !== col.name)` guard already used by the rename handler.
- **FR-22 (header limit display).** `column-header.tsx` renders the limit adjacent to the existing count badge
  whenever `column.wipLimit != null`, as `count / wipLimit`.
- **FR-23 (over-cap indicator).** When `column.wipLimit != null && column.tasks.length > column.wipLimit`, the
  header shows a distinct indicator — a colour change on the badge **plus** a non-colour signal (icon) and an
  i18n-driven accessible label. When `tasks.length <= wipLimit` the indicator is absent.
- **FR-24 (no limit → no change).** When `wipLimit == null` the header renders exactly as it does today: bare
  count badge, no ratio, no placeholder, no divider.
- **FR-25 (drag-and-drop untouched).** No behavioural or visual change to `column-dropzone.tsx`; dropping onto
  an over-cap column succeeds silently.

### i18n

- **FR-26 (new keys, en-US only).** New static keys are added to the repo-root `i18n/en-US.json` under the two
  namespaces the affected surfaces already use: `settings:columnEditor.*` (from `:883`) for the editor control,
  and `tasks:kanban.*` (from `:1884`) for the header. Key naming and interpolation follow the conventions
  already in that file. No other locale file is touched; `i18n/schema.json` is generated and off-limits.
- **FR-27 (no inline strings).** Every new user-visible string is looked up through `useTranslation()`; no
  hardcoded English literal ships in a component.

---

## 4. Non-functional requirements

- **NFR-1 (backwards compatibility).** Existing API callers that omit `wipLimit` on create and update continue
  to succeed with identical response shapes plus one new optional field. Existing web clients that ignore
  `wipLimit` on the board response are unaffected.
- **NFR-2 (migration safety).** `ADD COLUMN` only; safe on a populated `column` table; reversible by dropping
  the column. Generated at ordinal 0043 (0042 is the latest on this branch).
- **NFR-3 (performance).** No additional query per board render; the field piggybacks on the existing
  `select()` in `get-tasks.ts`. The over-cap check is O(1) per column against the already-computed
  `tasks.length`.
- **NFR-4 (self-hosting parity).** Behaviour is identical with or without Redis; no new event is published and
  no new WebSocket message is defined.
- **NFR-5 (privacy).** `wipLimit` is not sensitive and is not added to logs, events, WebSocket payloads or MCP
  tools.
- **NFR-6 (typing).** Types flow from the schema through the board projection into `ProjectWithTasks` with no
  `any` cast and no manual duplication beyond the three shapes FR-17 names.
- **NFR-7 (accessibility).** Colour is not the sole signal for over-cap; the badge exposes the ratio and the
  over-cap state to assistive technology via i18n-driven labels. ARIA attributes used must be valid for the
  element they sit on.
- **NFR-8 (deployment).** No change to Docker, Helm, environment variables or the startup path.

---

## 5. Validation truth table — `wipLimit`

Create = `POST /column/:projectId` body; Update = `PUT /column/:id` body. This Hono API returns **200** on
success for both (`c.json(result)`).

| # | Input value | Semantics | Create | Update | Post-state on success |
|---|---|---|---|---|---|
| 1 | `null` | Clear / create with no limit | 200 | 200 | `wip_limit = NULL` |
| 2 | absent (key omitted) | Create: no limit. Update: leave unchanged | 200 | 200 | Create: NULL. Update: unchanged. |
| 3 | `0` | Below lower bound | 400 | 400 | no write |
| 4 | `-1` | Below lower bound | 400 | 400 | no write |
| 5 | `1` | Lower bound accepted | 200 | 200 | `wip_limit = 1` |
| 6 | `2147483647` | Upper bound (int4 max) accepted | 200 | 200 | `wip_limit = 2147483647` |
| 7 | `2147483648` | Above int4 ceiling — API rejects before PostgreSQL can raise | 400 | 400 | no write |
| 8 | `1.5` | Non-integer, rejected by `v.integer()` | 400 | 400 | no write |
| 9 | `"5"` (string) | Wrong type, rejected by `v.number()` | 400 | 400 | no write |

Row 7 is why `v.maxValue(2147483647)` exists even though PostgreSQL would eventually reject the write: the
rejection must be a 400 from the API, not a 500 from a downstream `integer out of range`.
Row 8 is why `v.integer()` is required.

---

## 6. Role matrix

Authorization is **unchanged**. This restates the current effective permissions and confirms `wipLimit`
inherits them.

| Role (workspace-scoped) | Resource | Action | Allowed | Enforcement point |
|---|---|---|---|---|
| Any role with `project:update` | column (create) | Set `wipLimit` at create | yes | `requireWorkspacePermission({ project: ["update"] })` — unchanged |
| Any role with `project:update` | column (update) | Set / change / clear `wipLimit` | yes | same middleware — unchanged |
| Any role without `project:update` | column | Set / change / clear `wipLimit` | no | same middleware — 403 |
| Any workspace member | column (read via board) | See `wipLimit` and the over-cap badge | yes | existing board-read authorization — unchanged |
| Non-member | column | anything | no | `workspaceAccess` middleware — unchanged |

No new action is added to `@kaneo/permissions`; no new role is defined. The web `canManageProjects()` check on
the editor control is a UI convenience, not the enforcement point.

---

## 7. Acceptance criteria and verification mapping

1. **AC-1** — A column can be created or updated with an optional `wipLimit`; omitting it leaves no limit on
   create and leaves the stored value unchanged on update.
   *Proof:* `pnpm --filter @kaneo/api test`.
2. **AC-2** — `wipLimit` is nullable end to end; pre-existing rows read back as no limit; the generated
   migration applies cleanly to a populated table.
   *Proof:* `DATABASE_URL=postgresql://postgres:postgres@localhost:55432/kaneo_test pnpm --filter @kaneo/api test:integration`
   plus inspection of the generated SQL in `apps/api/drizzle/`.
3. **AC-3** — Invalid values are rejected with 400: floats, `0`, negatives and values above `2147483647`;
   `null` and absent are accepted per rows 1-2.
   *Proof:* `pnpm --filter @kaneo/api test` — a table-driven test covering every row of §5.
4. **AC-4** — The board response carries `wipLimit`, so the client renders without an extra request.
   *Proof:* the integration test asserts the `get-tasks` board payload includes `wipLimit`.
5. **AC-5** — The header shows the limit and a distinct over-cap indicator when the count exceeds it, and is
   unchanged when the limit is null.
   *Proof:* `pnpm --filter @kaneo/web test` — three fixtures: no-limit, under/at-cap, over-cap.
6. **AC-6** — Every new user-facing string resolves through a static key in `i18n/en-US.json`.
   *Proof:* `pnpm --filter @kaneo/web test` plus grep of the diff for English literals.
7. **AC-7** — Authorization is unchanged; `packages/permissions` is untouched and both routes keep their
   existing middleware chain.
   *Proof:* diff inspection (no change to the middleware lines) and the integration test exercising the
   authorized path.
8. **AC-8** — All affected packages typecheck together, proving the three duplicated `data` shapes and the
   inferred `ProjectWithTasks` agree.
   *Proof:* `pnpm typecheck`.
9. **AC-9** — The change set is lint-clean without touching unrelated files.
   *Proof:* `npx biome check <changed files>` (never the repo-wide `lint` script, which runs `--write`).
10. **AC-10** — Advisory-only: a task can still be created into and moved into a column at or over its limit.
    *Proof:* integration test drives a task into a column where `tasks.length >= wipLimit` and asserts success.

---

## 8. Open questions for HITL

The brief deliberately left UI placement and presentation open. These are the orchestrator's proposed
resolutions — Gate 1 is the point to overrule them.

1. **Where the limit is configured.** Proposed: the existing per-column row in `column-editor.tsx`
   (project → settings → workflow), inline next to the "Done column" switch. It is the only per-column
   settings surface that exists, so a new one would be a bigger change than the feature warrants.
2. **Header presentation.** Proposed: the existing count badge becomes `count / limit` when a limit is set,
   rather than adding a second badge — the count and the limit are one fact.
3. **Over-cap visual language.** Proposed: the destructive/warning token plus a small icon and an
   `aria-label`, so colour is not the only signal (NFR-7).
4. **Toast on set/clear.** Sibling controls toast every change; proposed to match them for consistency.
5. **Empty input semantics.** Proposed: empty → `null` (clear), because there is no other affordance to remove
   a limit.
6. **Test locations.** `tests/api/column/wip-limit.test.ts` (unit),
   `apps/web/src/components/kanban-board/column/column-header.test.tsx` (component),
   `tests/api-integration/column-wip-limit.test.ts` (integration) — the last is fixed by the write contract.

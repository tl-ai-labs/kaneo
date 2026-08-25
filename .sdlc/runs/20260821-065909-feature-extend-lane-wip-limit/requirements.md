# Requirements — Advisory per-column WIP limit

## In scope

1. Add a nullable, optional integer `wipLimit` to columns, settable at create and update.
2. Expose `wipLimit` on the board's column projection so the web client renders without an extra request.
3. Configure the limit from `apps/web/src/components/project/column-editor.tsx`, reusing the existing `useUpdateColumn` flow.
4. Render `{count} / {wipLimit}` in `column-header.tsx` and apply a distinct over-cap style when `wipLimit != null && count > wipLimit`.
5. Add all new user-facing copy as static keys under `settings.columnEditor` and `tasks.kanban` in `i18n/en-US.json`.
6. Ship a Drizzle-generated migration that is safe for populated databases.
7. Cover the change with API unit tests, a web component test, and a PostgreSQL-backed integration test.
8. Bound the limit at both ends in the API validator — explicit integer, `>= 1`, `<= 2147483647` (int4 ceiling) — and mirror that ceiling in the editor input as a UX guard.

## Out of scope

1. Enforcing the limit at the API — no rejection of task create/move/assign into a full column.
2. Per-user, per-project, or per-workspace default limits.
3. Analytics, history, or notifications on limit breaches.
4. Translating new keys into locales other than `en-US`.
5. Any change to the drag-and-drop implementation.
6. Committing, pushing, or opening a PR from this run.

## Functional requirements

### API data layer
- **FR-1**: `columnTable` in `apps/api/src/database/schema.ts` gains `wipLimit: integer("wip_limit")` (nullable, no default). *Test*: Drizzle schema inference includes `wipLimit: number | null`; generated migration adds the column as nullable with no backfill.
- **FR-2**: `create-column` and `update-column` controllers persist `wipLimit` when supplied and treat explicit `null` as a clear via the existing `data.x !== undefined && { x: data.x }` spread idiom. *Test*: unit test asserts insert receives the value and update spread includes `wipLimit` only when the field was present in input.

### API validation
- **FR-3**: Create validator (`apps/api/src/column/index.ts` L56–64) and update validator (L132–140) accept `wipLimit` as `v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2147483647))))`, mirroring the `icon`/`color` clearable pattern. Three constraints are load-bearing and none may be left implicit:
  - **Explicit integer check.** Valibot's `v.number()` accepts floats, so `2.5` passes a bare `v.number()`. The integer constraint must be stated explicitly.
  - **Lower bound 1 inclusive.** A limit of `0` or below is meaningless; clearing is expressed as `null`, not `0`.
  - **Upper bound 2147483647 inclusive.** PostgreSQL `integer` is int4; anything above `2147483647` overflows the column at write time. The validator must reject it with a 400 rather than let the database raise.

  The accept/reject set is exact and is the contract the unit tests assert:
  - **ACCEPT (2xx)**: `null`, absent/`undefined`, `1`, `5`, `2147483647`
  - **REJECT (400)**: `0`, `-3`, `2.5`, `2147483648`, `99999999999`, `9007199254740992`, `Number.MAX_VALUE`

  *Test*: api unit — every value in the ACCEPT row returns 2xx and every value in the REJECT row returns 400, on both the create and the update route.
- **FR-4**: OpenAPI metadata for the column create and update routes describes `wipLimit` as an optional nullable integer in the inclusive range `1..2147483647`. *Test*: generated OpenAPI schema snapshot contains the field with both bounds and the integer constraint documented.

### API projection
- **FR-5**: `apps/api/src/task/controllers/get-tasks.ts` (L224–237) hand-whitelisted column projection includes `wipLimit`. *Test*: integration test asserts the board response carries `wipLimit` for a column that has one set and `null` for one that does not.

### Web data layer
- **FR-6**: `apps/web/src/fetchers/column/create-column.ts` and `update-column.ts` forward `wipLimit` through the `@kaneo/libs` typed client. *Test*: typecheck — request bodies accept `wipLimit?: number | null`; runtime fetcher forwards the field verbatim.
- **FR-7**: `use-create-column` and `use-update-column` mutations accept `wipLimit` and continue to invalidate `["columns", projectId]` and `["tasks", projectId]`. *Test*: component test — after a WIP-limit update the tasks query is invalidated so the header re-renders with the new limit.

### Web UI
- **FR-8**: `column-editor.tsx` renders a WIP-limit input alongside existing controls, submits via `useUpdateColumn()` with the same `handleX` → `updateColumn` → toast pattern, and clears the limit by sending `null`. The input mirrors the API's bounds as a **UX guard**: `type="number"`, `min={1}`, `max={2147483647}`, `step={1}`, plus whatever coercion the existing input pattern in this file already uses, so a user cannot easily type a value the API will answer with a 400. This is a guard, not the enforcement point — **FR-3's validator remains authoritative** and the UI must not be relied on to reject anything. Out-of-range or non-integer input that still reaches the client is not submitted; the field is left unchanged and no mutation fires. *Test*: component test — entering a valid value updates the column; clearing the input sends `null`; the rendered input carries `min`/`max`/`step` attributes matching the validator's bounds.
- **FR-9**: `column-header.tsx` count badge (L62–64) renders `{count}` when `wipLimit == null` and `{count} / {wipLimit}` when set; applies a distinct over-cap style when `wipLimit != null && count > wipLimit`. *Test*: component test covers no-limit, at-limit, and over-cap variants.

### i18n
- **FR-10**: All new user-facing strings are static keys in `i18n/en-US.json` under `settings.columnEditor` (editor control) and `tasks.kanban` (header indicator). *Test*: source grep finds no inline literals for the new copy; keys resolve at render time.

## Non-functional requirements

- **NFR-1**: Backward compatibility on populated databases — migration adds a nullable column with no default; existing rows read back as `wipLimit: null`.
- **NFR-2**: No new permission vocabulary — reuses the workspace `project:update` permission via existing `workspaceAccess.fromColumn("id")` + `requireWorkspacePermission({ project: ["update"] })`.
- **NFR-3**: No change to realtime or event contracts — no new events published; existing column mutation events continue to trigger the invalidations that already cover this field.
- **NFR-4**: `pnpm typecheck` passes end to end; the inferred `@kaneo/libs` client types propagate `wipLimit` to the web fetchers and hooks without manual typing.
- **NFR-5**: Performance neutral on task-heavy boards — `wipLimit` is one extra scalar per column in the existing projection; the over-cap check is `O(1)` against the already-computed task count. No new queries, joins, or per-task work.

## Data contract

| Field      | Type                 | Nullability      | Default | DB (`columnTable`)                    | API validator                              | API projection (`get-tasks`) | Typed client / fetcher            | Web UI                                   |
|------------|----------------------|------------------|---------|---------------------------------------|--------------------------------------------|------------------------------|-----------------------------------|------------------------------------------|
| `wipLimit` | integer, inclusive `1..2147483647` (int4) | nullable, optional | none   | `integer("wip_limit")` on `columnTable` | `v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2147483647))))` on create and update | included in column whitelist, returned as `number \| null` | `wipLimit?: number \| null` in create/update request bodies | Number input in `column-editor` with `min=1` / `max=2147483647` / `step=1`; `{count} / {wipLimit}` badge in `column-header` with over-cap style |

## PII inventory

| Field      | Personal? | Notes                                                                 |
|------------|-----------|-----------------------------------------------------------------------|
| `wipLimit` | No        | Non-personal integer capacity hint on a column. No new PII introduced. |

## Role matrix

| Role                                    | Resource        | Action                        | Permission used             | New vocabulary? |
|-----------------------------------------|-----------------|-------------------------------|-----------------------------|-----------------|
| Any workspace member with `project:update` | Column (workspace-scoped) | Set / change / clear `wipLimit` | `project:update` (existing) | No              |
| Any authenticated viewer of the board   | Column          | Read `wipLimit` via board projection | existing board-read path    | No              |

Authorization flows through the existing `workspaceAccess.fromColumn("id")` + `requireWorkspacePermission({ project: ["update"] })` middleware unchanged.

## Acceptance criteria

- **AC-1**: A column can be created or updated with an optional `wipLimit`; omitting it leaves the column with no limit. *Proof*: api unit (`tests/api/column/create-column.test.ts`, `update-column.test.ts`) — omitted field yields `wipLimit: null` on the persisted row.
- **AC-2**: `wipLimit` is nullable and optional end to end; existing columns, existing API callers, and populated databases keep working; the generated migration is safe against non-empty data. *Proof*: api integration (`tests/api-integration/column-wip-limit.test.ts`) — pre-seed columns without `wipLimit`, run migration, read back as `null`, existing create/update requests without the field still succeed.
- **AC-3**: Invalid values are rejected at the API with a 400 — the limit must be a whole number in the inclusive range `1..2147483647`, or null/absent to clear it. *Proof*: api unit — exactly the FR-3 set: `null`, absent, `1`, `5`, `2147483647` return 2xx; `0`, `-3`, `2.5`, `2147483648`, `99999999999`, `9007199254740992`, `Number.MAX_VALUE` return 400. Asserted on both the create and the update route.
- **AC-4**: The board projection returns each column's `wipLimit` so the client can render without an extra request. *Proof*: api integration — GET tasks response includes `wipLimit` on each column entry.
- **AC-5**: The column header displays the current limit and shows a distinct over-cap indicator when the column's task count exceeds it. *Proof*: web component (`apps/web/src/components/kanban-board/column/column-header.test.tsx`) — asserts badge text and over-cap class across no-limit / at-limit / over-cap fixtures.
- **AC-6**: Every new user-facing string is a static key in `i18n/en-US.json`. *Proof*: web component test resolves keys via the i18n harness; keys exist under `settings.columnEditor` and `tasks.kanban`.
- **AC-7**: Authorization is unchanged and enforced by the API: setting a WIP limit is a workspace-scoped column mutation and goes through the existing `requireWorkspacePermission` path; no new permission vocabulary. *Proof*: api integration — a member without `project:update` receives 403 when setting `wipLimit`; `@kaneo/permissions` diff is empty.
- **AC-8**: Covered by API unit tests, a web component test, and a PostgreSQL-backed integration test. *Proof*: typecheck + all four suites (`pnpm --filter @kaneo/api test`, `pnpm --filter @kaneo/web test`, `pnpm --filter @kaneo/api test:integration`, `pnpm typecheck`) pass.
- **AC-9**: The validator has an explicit upper bound and an explicit integer check — not merely a minimum. `2147483648` and larger (`99999999999`, `9007199254740992`, `Number.MAX_VALUE`) are refused with a 400 before reaching PostgreSQL, so no int4 overflow can occur at the database; `2.5` is refused by an explicit integer constraint rather than being silently accepted by a bare `v.number()`. *Proof*: api unit (`tests/api/column/create-column.test.ts`, `tests/api/column/update-column.test.ts`) — each rejected value asserted individually with its status code, so a regression names the value that broke.
- **AC-10**: The column-editor input mirrors the validator's ceiling (`min=1`, `max=2147483647`, `step=1`) so a user is not led into a 400. The API remains the enforcement point. *Proof*: web component (`apps/web/src/components/project/column-editor.test.tsx`) — asserts the input's bound attributes and that out-of-range input fires no mutation.

## Open questions for HITL

None — the brief settles scope, validation shape, configuration surface, projection, UI treatment, i18n policy, authorization, and test coverage.

## Revision log

- **Gate 1, revision 1** — added an explicit upper bound (`2147483647`, the PostgreSQL int4 ceiling) and an explicit integer constraint to FR-3, with an exact accept/reject set; extended AC-3's proof set to that set; added AC-9 (bound + non-integer rejection, api unit) and AC-10 (editor input mirrors the ceiling as a UX guard, web component); mirrored both bounds into FR-4's OpenAPI metadata, FR-8's input attributes, the data-contract table, and In-scope item 8. Rationale: the prior benchmark arm (`flash-agsdk-only`, run `20260820-123148`) shipped this gap; its security review caught it as a Low input-validation finding conditioning Gate 3, and it closed with follow-up FU-4 ("UI input has no upper bound") still open. Both are closed here at requirements time.

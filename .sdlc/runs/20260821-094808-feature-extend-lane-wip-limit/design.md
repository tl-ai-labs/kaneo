# Change plan — Advisory per-column WIP limit with over-cap indicator

Run `20260821-094808-feature-extend-lane-wip-limit` · intent `feature-extend` · base `5d1fc910`.
Produced by `claude-opus-5` in two dispatches (`tp_plan_002a` contract, `tp_plan_002b` tests/risks) under
policy `opus-plus-sonnet-max` rule 6, then reconciled by the orchestrator against the working tree.

## 0. Locked decisions (approved at Gate 1)

1. Configuration lives **inline in the existing per-column row** of `column-editor.tsx`, next to the isFinal
   Switch. No new settings surface, route or modal.
2. The board header's **existing count badge becomes `count / limit`** when a limit is set. No second badge.
3. Over-cap is signalled by **colour + icon + i18n aria-label**; colour is never the sole signal.
4. A `<span>` carrying `aria-label` **must** carry an explicit role — `role="img"`. A bare span with
   `aria-label` is invalid ARIA and Biome's `lint/a11y/useAriaPropsSupportedByRole` rejects it. A prior arm
   shipped exactly this defect past a green four-command gate.
5. `createColumn` persists with `wipLimit ?? null`, **never** the `icon || null` idiom used on the adjacent
   string fields — `||` is a latent bug on a numeric field.
6. The `get-tasks` projection gains **only** `wipLimit`. Reviving the already-dropped `color`/`position` is
   scope creep and is forbidden.
7. Advisory only: nothing blocks task create/move/drop. `column-dropzone.tsx` is off-limits.
8. Bounds: integer, inclusive `1..2147483647`; `null` clears; absent leaves unchanged on update. The API is
   the authority; the client bound is convenience only.

### Orchestrator corrections applied to the model's draft

Each was checked against the tree; the draft is overridden where they conflict.

| # | Draft said | Corrected to | Why |
|---|---|---|---|
| C1 | create validator `v.optional(wipLimitSchema)`, update `v.optional(v.nullable(...))` | **both** `v.optional(v.nullable(wipLimitSchema))` | The truth table must be identical for create and update; create must accept explicit `null` as "no limit". |
| C2 | an amber **at-cap** state at `count === limit` | **no at-cap state** — only over-cap | AC-5 says the indicator appears when the count *exceeds* the limit. An at-cap tier is unrequested scope. |
| C3 | `role="img"` + aria-label on the badge in **all** cases, incl. no-limit | no-limit path renders **byte-identical to today** | Locked decision 2. Adding ARIA to the unlimited badge changes existing behaviour for every column in every project. |
| C4 | `{{count}}` interpolation | `{{current}}` and `{{limit}}` | This repo drives i18next pluralization off `count` (`permissionCount_one/_other`, `newCount_one/_other`). A two-number label must not trigger plural resolution on one of its numbers. |
| C5 | an IIFE inside JSX | hoist three consts above `return` | Readability and testability; no behavioural difference. |
| C6 | web test mocks `canUpdateTasks: true` | `canUpdateTasks: () => true` | The component **calls** these (`canUpdateTasks()`); booleans would throw. |
| C7 | `import ColumnHeader from "./column-header"` | `import { ColumnHeader }` | It is a named export. |
| C8 | `getColumnIcon: () => () => null` | `getColumnIcon: () => null` | It returns a ReactNode, not a component. |
| C9 | db mock chain `.where(() => ({ limit: ... }))` | chain matching the real calls (§7.2) | The real controller calls `.where()` and awaits the array directly; there is no `.limit()`. |

---

## 1. Per-file change table

| # | File | State | Anchor | Edit |
|---|---|---|---|---|
| 1 | `apps/api/src/database/schema.ts` | existing | `columnTable`, after `isFinal` (:359) | Add `wipLimit: integer("wip_limit"),`. Nullable, no default. `integer` is already imported. |
| 2 | `apps/api/drizzle/0043_*.sql` + `meta/` | **generated** | — | `pnpm --filter @kaneo/api db:generate`; must emit `ALTER TABLE "column" ADD COLUMN "wip_limit" integer;`. Never hand-authored. |
| 3 | `apps/api/src/column/controllers/create-column.ts` | existing | after `toSlug`; params type; `.values({...})` | Export `wipLimitSchema` (§2). Add `wipLimit?: number \| null` to params. Insert `wipLimit: wipLimit ?? null`. |
| 4 | `apps/api/src/column/controllers/update-column.ts` | existing | `data` type; `.set({...})` | Add `wipLimit?: number \| null`; append `...(data.wipLimit !== undefined && { wipLimit: data.wipLimit }),`. |
| 5 | `apps/api/src/column/index.ts` | existing | POST :56-64 and PUT :132-140 validators + both handlers | `import createColumn, { wipLimitSchema } from "./controllers/create-column";`. Add `wipLimit: v.optional(v.nullable(wipLimitSchema)),` to **both** validators; destructure and forward `wipLimit` in the create handler (the update handler already forwards `data` wholesale). |
| 6 | `apps/api/src/column/controllers/get-columns.ts` | existing | — | **No change.** `select()` star already carries the field. Listed only to record the decision. |
| 7 | `apps/api/src/task/controllers/get-tasks.ts` | existing | :224-229 | Add exactly one line: `wipLimit: column.wipLimit,`. Do not revive `color`/`position`. |
| 8 | `apps/web/src/fetchers/column/create-column.ts` | existing | `data` type | `wipLimit?: number \| null`. |
| 9 | `apps/web/src/fetchers/column/update-column.ts` | existing | `data` type :5-10 | `wipLimit?: number \| null`. |
| 10 | `apps/web/src/hooks/mutations/column/use-create-column.ts` | existing | `mutationFn` param type | `wipLimit?: number \| null`. |
| 11 | `apps/web/src/hooks/mutations/column/use-update-column.ts` | existing | `mutationFn` param type :14-19 | `wipLimit?: number \| null`. Invalidation at :21-31 already covers both query keys. |
| 12 | `apps/web/src/components/kanban-board/column/column-header.tsx` | existing | count span :62-64 | Limit-aware badge (§4). Add `AlertTriangle` to the lucide import; add `cn` from `@/lib/utils`. |
| 13 | `apps/web/src/components/project/column-editor.tsx` | existing | handler block :86-116; row cluster :299-341 | Add `handleWipLimitChange` and the numeric Input (§5). |
| 14 | `i18n/en-US.json` | existing | `settings.columnEditor` (:883), `tasks.kanban` (:1884) | Add the key block (§3). |
| 15 | `tests/api/column/wip-limit.test.ts` | **new** | — | Validator table + controller coalesce guard (§6.1). |
| 16 | `apps/web/src/components/kanban-board/column/column-header.test.tsx` | **new** | — | Header rendering (§6.2). |
| 17 | `apps/web/src/components/project/column-editor.test.tsx` | **new** | — | Editor control behaviour (§6.3). |
| 18 | `tests/api-integration/column-wip-limit.test.ts` | **new** | — | PostgreSQL round trip (§6.4). |

`apps/web/src/components/kanban-board/column/index.tsx` needs **no change** — it passes the whole column
object through, and `ProjectWithTasks` is inferred from the API response.

## 2. The shared Valibot schema

```ts
export const wipLimitSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(1),
  v.maxValue(2147483647),
);
```

**Home: `apps/api/src/column/controllers/create-column.ts`.** The write contract forbids a new module such as
`apps/api/src/column/wip-limit.ts`; `index.ts` is route wiring, not a schema home; and putting it in
`update-column.ts` would make create import from update. `create-column.ts` is already the established home
for a shared symbol consumed from outside — `toSlug` is exported from there and imported by
`tests/api/column/to-slug.test.ts`. Consumers use:

```ts
import createColumn, { wipLimitSchema } from "./controllers/create-column";
```

`v.integer()` is load-bearing: `v.number()` alone accepts `1.5`. `v.maxValue(2147483647)` is load-bearing:
without it PostgreSQL raises `integer out of range` and the caller sees a 500 instead of a 400.

## 3. i18n keys (`i18n/en-US.json`, en-US only)

**Amended post-implementation** to record the names that actually shipped (the codegen tier proposed
clearer badge names and the orchestrator accepted them; code and JSON agree).

Under `settings.columnEditor`:

```json
"wipLimitLabel": "WIP limit",
"wipLimitPlaceholder": "No limit",
"wipLimitTooltip": "Advisory limit on tasks in this column. Leave empty for no limit.",
"wipLimitAria": "Set WIP limit for {{name}}",
"toastWipLimitUpdated": "WIP limit updated",
"toastWipLimitCleared": "WIP limit cleared",
"toastWipLimitInvalid": "WIP limit must be a whole number between 1 and 2147483647"
```

Under `tasks.kanban`:

```json
"wipLimitBadgeAria": "{{current}} of {{limit}} tasks",
"wipLimitBadgeOverAria": "{{current}} of {{limit}} tasks, over the WIP limit"
```

Conventions followed: flat camelCase inside the namespace, sentence-case values, `Aria` suffix for accessible
labels, `Tooltip` suffix for titles, `toast` prefix for toasts, `{{...}}` interpolation. `{{count}}` is
deliberately avoided (C4). Other locale files and `i18n/schema.json` are untouched.

## 4. `column-header.tsx` rendering contract

Hoisted above `return` (no IIFE):

```tsx
const taskCount = column.tasks.length;
const wipLimit = column.wipLimit ?? null;
const isOverCap = wipLimit !== null && taskCount > wipLimit;
```

The count span at :62-64 becomes:

```tsx
{wipLimit === null ? (
  <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
    {taskCount}
  </span>
) : (
  <span
    role="img"
    aria-label={t(
      isOverCap ? "tasks:kanban.wipLimitBadgeOverAria" : "tasks:kanban.wipLimitBadgeAria",
      { current: taskCount, limit: wipLimit },
    )}
    className={cn(
      "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
      isOverCap
        ? "border border-destructive/30 bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground",
    )}
  >
    {isOverCap && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
    {`${taskCount} / ${wipLimit}`}
  </span>
)}
```

Enforced points: the no-limit branch is the *existing* markup unchanged (C3); `role="img"` accompanies every
`aria-label` (decision 4); the icon is `aria-hidden` because the label already conveys the state; colour is
never alone (icon + label). Nothing here reads or affects the drop path.

## 5. `column-editor.tsx` control contract

Handler, alongside `handleToggleFinal`:

```ts
const handleWipLimitChange = async (
  id: string,
  raw: string,
  previous: number | null,
) => {
  const trimmed = raw.trim();

  if (trimmed === "") {
    if (previous === null) return;              // no-op guard
    try {
      await updateColumn({ id, projectId, data: { wipLimit: null } });
      toast.success(t("settings:columnEditor.toastWipLimitCleared"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings:columnEditor.toastUpdateError"));
    }
    return;
  }

  if (!/^\d+$/.test(trimmed)) {
    toast.error(t("settings:columnEditor.toastWipLimitInvalid"));
    return;                                      // rejects floats, signs, exponents
  }

  const parsed = Number(trimmed);
  if (parsed < 1 || parsed > 2147483647) {
    toast.error(t("settings:columnEditor.toastWipLimitInvalid"));
    return;
  }
  if (parsed === previous) return;               // no-op guard

  try {
    await updateColumn({ id, projectId, data: { wipLimit: parsed } });
    toast.success(t("settings:columnEditor.toastWipLimitUpdated"));
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t("settings:columnEditor.toastUpdateError"));
  }
};
```

JSX, inside the per-row cluster before the delete Button:

```tsx
<div className="flex items-center gap-2" title={t("settings:columnEditor.wipLimitTooltip")}>
  <span className="text-xs text-muted-foreground whitespace-nowrap">
    {t("settings:columnEditor.wipLimitLabel")}
  </span>
  <Input
    type="number"
    inputMode="numeric"
    min={1}
    max={2147483647}
    step={1}
    defaultValue={col.wipLimit ?? ""}
    placeholder={t("settings:columnEditor.wipLimitPlaceholder")}
    aria-label={t("settings:columnEditor.wipLimitAria", { name: col.name })}
    disabled={!canEdit}
    className="h-8 w-20 text-sm"
    onBlur={(e) => handleWipLimitChange(col.id, e.target.value, col.wipLimit ?? null)}
    onKeyDown={(e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.currentTarget.blur();
      }
    }}
  />
</div>
```

`defaultValue`, never `value`: rows are keyed by `col.id` and a controlled input would fight the query cache
on every invalidation — the reason the sibling name Input already uses `defaultValue`. Commit on blur, Enter
blurs, mutations key on `col.id` (the real cuid), `disabled={!canEdit}` mirrors every sibling control. The
client bound is a convenience; the API still validates (constraint 3).

## 6. Test plan

### 6.1 `tests/api/column/wip-limit.test.ts` — API unit (AC-1, AC-3)

Two describes in one file. The `vi.mock` of the database module is hoisted and file-wide, which is harmless
for the schema cases.

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as v from "valibot";

const insertedRows: Record<string, unknown>[] = [];
const setPayloads: Record<string, unknown>[] = [];
let existingColumn: Record<string, unknown> | undefined;

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    select: () => ({ from: () => ({ where: () => [] }) }),
    insert: () => ({
      values: (row: Record<string, unknown>) => {
        insertedRows.push(row);
        return { returning: () => [{ id: "col_1", ...row }] };
      },
    }),
    update: () => ({
      set: (payload: Record<string, unknown>) => {
        setPayloads.push(payload);
        return { where: () => ({ returning: () => [{ id: "col_1", ...payload }] }) };
      },
    }),
    query: { columnTable: { findFirst: async () => existingColumn } },
  },
}));

import createColumn, { wipLimitSchema } from "../../../apps/api/src/column/controllers/create-column";
import updateColumn from "../../../apps/api/src/column/controllers/update-column";
```

Why the mock shape is exactly this (C9): `createColumn` awaits `db.select({...}).from(t).where(...)` **twice**
and destructures each result — returning `[]` for both is correct, because `const [maxPos] = []` gives
`undefined` and `(undefined ?? -1) + 1 = 0`. `updateColumn` calls `db.query.columnTable.findFirst` then
`db.update(t).set(payload).where(...).returning()`. There is no `.limit()` anywhere in either controller.

Schema cases (each `v.safeParse(wipLimitSchema, x).success`): accepts `1`, `2147483647`; rejects `0`, `-1`,
`1.5`, `2147483648`, `"5"`, `null`, `undefined` (nullability is layered by the route's
`v.optional(v.nullable(...))`, not by the base schema). One case rebuilds the route wrapper
`v.object({ wipLimit: v.optional(v.nullable(wipLimitSchema)) })` and asserts `{}`, `{wipLimit: null}`,
`{wipLimit: 1}` pass and `{wipLimit: 0}` fails — this is the truth table of requirements §5. **AC-3.**

Controller cases:
1. omitted `wipLimit` → inserted row has `wipLimit === null`. **AC-1**
2. explicit `null` → `wipLimit === null`. **AC-1**
3. `wipLimit: 5` → `wipLimit === 5`. **AC-1**
4. **coalesce guard:** call `createColumn({ projectId, name, wipLimit: 0 })` directly and assert the recorded
   row has `wipLimit === 0`. The HTTP validator never lets `0` through (`minValue(1)`), so bypassing the route
   and calling the controller with a cast is the *only* way to distinguish the two operators:
   `0 ?? null === 0` but `0 || null === null`. A regression to `||` fails this case with
   `expected null to be 0`. **Guards decision 5.**
5. `updateColumn(id, { name: "x" })` → the recorded `.set()` payload has **no** `wipLimit` key. **AC-1**
6. `updateColumn(id, { wipLimit: null })` → payload has own property `wipLimit: null`. **AC-2**
7. `updateColumn(id, { wipLimit: 7 })` → payload has `wipLimit: 7`. **AC-1**

### 6.2 `apps/web/src/components/kanban-board/column/column-header.test.tsx` — component (AC-5, AC-6)

Mocks (corrected per C6–C8): `react-i18next` with a `t` that echoes `key::{json opts}`; `@/store/project`;
`@/hooks/mutations/task/use-update-task`; `@/hooks/use-workspace-permission` returning
`{ canUpdateTasks: () => true, canCreateTasks: () => true }`; `@/lib/column` → `getColumnIcon: () => null`;
`@/components/shared/modals/create-task-modal` → `default: () => null`;
`../../shared/modals/archive-tasks-modal` → `ArchiveTasksModal: () => null`; `@/lib/toast`.
Import is `import { ColumnHeader } from "./column-header";`.

1. `wipLimit: null`, 3 tasks → badge text `3`, no `/`, no element with `role="img"`, no icon. **AC-5, C3**
2. 2 tasks, limit 5 → text `2 / 5`, `role="img"` present, no destructive class, no icon. **AC-5**
3. 5 tasks, limit 5 (at cap) → text `5 / 5`, **no** over-cap indicator. **AC-5, C2**
4. 6 tasks, limit 5 → text `6 / 5`, icon present with `aria-hidden="true"`, class list contains
   `text-destructive`. **AC-5**
5. over-cap aria-label starts with `tasks:kanban.wipLimitBadgeOverAria` and its opts contain `current` and `limit`
   and **no** `count`. **AC-6, C4**
6. under-cap aria-label starts with `tasks:kanban.wipLimitBadgeAria`, same opts assertion. **AC-6, C4**
7. advisory smoke: at 6/5 the add-task button still renders and is not disabled. **AC-10**

### 6.3 `apps/web/src/components/project/column-editor.test.tsx` — component (AC-1, AC-6)

Mocks the four column mutation hooks (`useUpdateColumn` returning a captured `mutateAsync` spy),
`useGetColumns` returning two raw rows (one with `wipLimit: 3`, one with `wipLimit: null`),
`useWorkspacePermission` → `canManageProjects: () => true`, `react-i18next`, `@/lib/toast`, `@/lib/column`.

1. renders the input with `defaultValue` `3` for the limited column and `""` for the unlimited one. **AC-1**
2. blur with the value unchanged → `mutateAsync` not called (no-op guard).
3. blur with `5` → called with `{ id: <cuid>, projectId, data: { wipLimit: 5 } }` — asserts it keys on the real
   `col.id`, not the slug. **AC-1**
4. blur with `""` on the limited column → called with `data: { wipLimit: null }`. **AC-2**
5. blur with `""` on the already-unlimited column → not called.
6. blur with `abc` or `1.5` → `toast.error` called with the invalid key, `mutateAsync` not called.
7. `canManageProjects: () => false` → the input is disabled.

### 6.4 `tests/api-integration/column-wip-limit.test.ts` — PostgreSQL (AC-2, AC-3, AC-4, AC-7, AC-10)

Uses `createApp()`, `mockAuthenticatedSession`, `resetTestDatabase`, `createWorkspaceMember({role:"admin"})`,
`createProjectFixture`. Routes: `POST/PUT /api/column/...`, `GET /api/task/:projectId` for the board
projection, `POST /api/task/:projectId` with `{title, description, priority, status}` where `status` is the
column **slug**.

1. Seeded default columns (fixture never sets a limit) read back `wipLimit === null` — the pre-existing-row
   case, and proof the migration is safe on populated data. **AC-2**
2. `POST /api/column/:projectId` with `wipLimit: 3` → 200, persisted 3. **AC-1**
3. `POST` without `wipLimit` → 200, persisted `null`. **AC-1**
4. `PUT` with `{ wipLimit: 2 }` → 200; a subsequent `PUT` with `{ name: "Renamed" }` leaves `wipLimit === 2`
   (absent = unchanged). **AC-1**
5. `PUT` with `{ wipLimit: null }` → 200, cleared. **AC-2**
6. `PUT` with each of `0`, `-1`, `1.5`, `2147483648`, `"5"` → **400**, and a direct db read shows the stored
   value unchanged. Also `PUT` with `2147483647` → 200. **AC-3**
7. `GET /api/task/:projectId` → the column with a limit carries `wipLimit`, and one without carries `null`.
   This is the test that catches the lossy projection. **AC-4**
8. Advisory: set `wipLimit: 1`, then create three tasks with `status` = that column's slug → all 200, and the
   board still returns them all. **AC-10**
9. Authorization unchanged: a `member`-role user (no `project:update`) gets a non-2xx on `PUT` with
   `wipLimit`, using the same middleware as every other column mutation. **AC-7**

## 7. Risk register

| # | Risk | Likelihood | Blast radius | Mitigation | Caught by |
|---|---|---|---|---|---|
| 1 | **Lossy `get-tasks` projection** re-maps columns and already silently drops `color`/`position`; a new field is invisible to the board unless added at :224-229. `ProjectWithTasks` is *inferred*, so it fails silently rather than erroring. | Medium | Badge never appears in production; unit tests still green. | One-line projection edit in the same change as the schema. | §6.4 case 7; `pnpm --filter @kaneo/api test:integration`. |
| 2 | **Four hand-written request shapes drift** (2 fetchers + 2 hooks) — one missed and the field is dropped before the request, with a 200 and no error. | High | Editor appears to work, nothing persists. | Edit all four together. | `pnpm typecheck` (AC-8) — the typed `@kaneo/libs` client rejects a shape mismatch. |
| 3 | **i18next plural resolution** — `{{count}}` engages the plural pipeline this repo already uses (`permissionCount_one/_other`), silently selecting a wrong/missing key at `count === 1`. | Medium | Screen readers announce the wrong string; invisible in visual review. | C4: `{{current}}`/`{{limit}}`. | §6.2 cases 5-6 assert opts contain no `count`. |
| 4 | **Migration ordinal collision** — a prior arm's `0043` was resident in the shared test DB. | Medium | Migration fails to apply, or applies empty. | DB dropped before this run; generate against this tree; inspect the emitted SQL for `ADD COLUMN "wip_limit" integer`. | `resetTestDatabase()` replays `apps/api/drizzle` from zero, so a bad migration fails the whole integration suite immediately. |
| 5 | **Controlled-vs-uncontrolled regression** — switching the Input to `value=` without local state makes the query cache fight typing. | High (common React reflex) | Users cannot type a limit; every keystroke reverts. | §5 pins `defaultValue` + blur commit, matching the sibling name Input. | §6.3 cases 1-3; a reviewer check that `value=` does not appear. |
| 6 | **Advisory guarantee broken** — a follow-up wires the limit into task create/move or the dropzone. | Medium | Users blocked; violates the brief's central constraint. | No task-controller change; `column-dropzone.tsx` off-limits. | §6.2 case 7, §6.4 case 8; `grep -r wipLimit apps/api/src/task` should return only the projection line. |
| 7 | **`??` → `\|\|` regression** — invisible at the route boundary because the validator rejects `0`. | Low | A future direct caller (MCP, seed script) silently turns `0` into "no limit". | Decision 5. | §6.1 controller case 4 — the only case that can distinguish them. |
| 8 | **Invalid ARIA on the badge** — `aria-label` on a bare `<span>`; four-command gate has no linter and would not catch it. | Medium (it already happened once) | Ships an a11y defect past a green build. | Decision 4: `role="img"`. | `npx biome check` on the changed files, run before any phase is declared green. |

## 8. Packet decomposition (input to Phase 4)

Five coarse units, batched to amortise the ~$0.10 per-dispatch spawn floor.

| Unit | Files | Tier | Note |
|---|---|---|---|
| P1 · API data + contract | schema.ts, create-column.ts, update-column.ts, column/index.ts, get-tasks.ts | mechanical (sonnet) | One packet; five small, tightly-specified edits sharing one contract. Migration generated by the orchestrator after this lands. |
| P2 · Web data layer + i18n | 2 fetchers, 2 hooks, i18n/en-US.json | mechanical (sonnet) | Pure shape propagation plus a JSON key block. |
| P3 · UI | column-header.tsx, column-editor.tsx | mechanical (sonnet) | §4 and §5 give exact JSX; the two files are independent. |
| P4 · API tests | tests/api/column/wip-limit.test.ts, tests/api-integration/column-wip-limit.test.ts | mechanical (sonnet, `phase: tests`) | Both need the real call-chain detail in §6.1/§6.4. |
| P5 · Web tests | column-header.test.tsx, column-editor.test.tsx | mechanical (sonnet, `phase: tests`) | Mock lists are given verbatim in §6.2/§6.3. |

Migration generation, `biome check`, the four-command verification gate, senior review and security review stay
with the orchestrator/premium tier.

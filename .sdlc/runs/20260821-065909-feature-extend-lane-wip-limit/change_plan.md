# change_plan.md — column-wip-limit (advisory)

## 1. Delta summary

Add a nullable, advisory integer `wipLimit` to `columnTable`. Configuration lives in `column-editor.tsx`; `column-header.tsx` renders a badge and an over-cap affordance. Validator refuses `<1`, non-integer, and any value above the PostgreSQL int4 ceiling (`2147483647`). Nothing blocks task create, update, or move — the limit is purely visual. en-US i18n only; no new permissions; no drag-and-drop changes.

## 2. Change inventory

| file | change | exact anchor | new/edit |
|---|---|---|---|
| `apps/api/src/database/schema.ts` | add `wipLimit` column | insert after `isFinal: boolean("is_final").default(false).notNull(),` inside `columnTable` (L342-367) | edit |
| `apps/api/drizzle/00XX_<generated>.sql` + `apps/api/drizzle/meta/*` | generated `ALTER TABLE`, snapshot and journal entry | produced by `pnpm --filter @kaneo/api db:generate` (drizzle.config.ts sets `out: "./drizzle"`) | new (generated) |
| `apps/api/src/column/index.ts` | extend create + update Valibot schemas; pass `wipLimit` through to controllers | `.post("/:projectId", …)` validator (L40-79) and `.put("/:id", …)` validator (L116-149) | edit |
| `apps/api/src/column/controllers/create-column.ts` | accept `wipLimit`, insert with `wipLimit: wipLimit ?? null` | destructured params block and `db.insert(columnTable).values({...})` | edit |
| `apps/api/src/column/controllers/update-column.ts` | accept `wipLimit`, apply conditional-spread clear | `data` param type and `.set({ …conditional spreads… })` (L25-30 idiom) | edit |
| `apps/api/src/task/controllers/get-tasks.ts` | include `wipLimit` in the projected column shape | `const columns = projectColumns.map((column) => ({ id: column.slug, … }))` (L218-237) | edit |
| `apps/web/src/fetchers/column/create-column.ts` | add `wipLimit?: number \| null` to `data` param | inline `data` param type | edit |
| `apps/web/src/fetchers/column/update-column.ts` | add `wipLimit?: number \| null` to `data` param | inline `data` param type | edit |
| `apps/web/src/hooks/mutations/column/use-create-column.ts` | add `wipLimit?: number \| null` to `data` in `mutationFn` variables | `mutationFn: ({ projectId, data }: { … })` | edit |
| `apps/web/src/hooks/mutations/column/use-update-column.ts` | add `wipLimit?: number \| null` to `data` in `mutationFn` variables | `mutationFn: ({ id, data }: { … })` | edit |
| `apps/web/src/components/project/column-editor.tsx` | add `handleWipLimitChange`; render numeric input in the per-column row alongside the Done toggle | per-column row block L299-341; mirror `handleToggleFinal` idiom | edit |
| `apps/web/src/components/kanban-board/column/column-header.tsx` | render advisory badge + over-cap affordance; **add imports** `AlertTriangle` (lucide-react, join existing `Archive, Plus`) and `cn` from `@/lib/utils` (not currently imported in this file) | count `<span>` at L62-64 | edit |
| `i18n/en-US.json` | add keys under `settings.columnEditor` and `tasks.kanban` | existing namespaces | edit |
| `tests/api/column/create-column.test.ts` | validator accept/reject cases for `wipLimit` on create | new file (only `to-slug.test.ts` exists today) | new |
| `tests/api/column/update-column.test.ts` | validator accept/reject cases for `wipLimit` on update, including explicit-null clear | new file | new |
| `tests/api-integration/column-wip-limit.test.ts` | end-to-end persist + board projection + advisory-only behavior | new file | new |
| `apps/web/src/components/kanban-board/column/column-header.test.tsx` | badge visibility and over-cap affordance | new file | new |
| `apps/web/src/components/project/column-editor.test.tsx` | commit/clear behavior for the WIP-limit input | new file | new |

## 3. Data model and migration

Schema line to add, inserted directly after `isFinal` inside `columnTable`:

```ts
wipLimit: integer("wip_limit"),
```

Generate with:

```
pnpm --filter @kaneo/api db:generate
```

Expected generated SQL:

```sql
ALTER TABLE "column" ADD COLUMN "wip_limit" integer;
```

Two properties that make it safe on populated data: (1) the column is **nullable** — no `NOT NULL` on a table with existing rows, so no backfill is required; (2) there is **no `DEFAULT`** and no unique/check constraint, so the `ALTER TABLE` acquires only a brief metadata lock and does not rewrite existing rows. Do not hand-author the migration; keep the generator output verbatim after inspecting it. Output lands in `apps/api/drizzle/` alongside a new `meta/00XX_snapshot.json` and a new `_journal.json` entry (latest existing migration is `0042_previous_the_executioner`).

## 4. API delta

### Shared validator fragment

```ts
wipLimit: v.optional(
  v.nullable(
    v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2147483647)),
  ),
),
```

Accepts: `null`, absent, `1`, `5`, `2147483647`. Rejects with HTTP 400: `0`, `-3`, `2.5`, `2147483648`, `99999999999`, `9007199254740992`, `Number.MAX_VALUE`. `2147483647` is the PostgreSQL `int4` ceiling — the validator refuses overflow before the value can reach the database. The editor input mirrors `min=1 max=2147483647 step=1` only as a UX guard.

### `apps/api/src/column/index.ts` — create route validator

```ts
validator(
  "json",
  v.object({
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    isFinal: v.optional(v.boolean()),
    wipLimit: v.optional(
      v.nullable(
        v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2147483647)),
      ),
    ),
  }),
),
```

Handler destructure adds `wipLimit`, passes it into `createColumn({ …, wipLimit })`.

### `apps/api/src/column/index.ts` — update route validator

```ts
validator(
  "json",
  v.object({
    name: v.optional(v.string()),
    icon: v.optional(v.nullable(v.string())),
    color: v.optional(v.nullable(v.string())),
    isFinal: v.optional(v.boolean()),
    wipLimit: v.optional(
      v.nullable(
        v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2147483647)),
      ),
    ),
  }),
),
```

The handler already forwards `c.req.valid("json")` verbatim into `updateColumn(id, data)`; no handler change beyond types.

### `create-column.ts` controller

```ts
async function createColumn({
  projectId,
  name,
  icon,
  color,
  isFinal,
  wipLimit,
}: {
  projectId: string;
  name: string;
  icon?: string;
  color?: string;
  isFinal?: boolean;
  wipLimit?: number | null;
}) {
  // …existing slug/position logic…
  const [created] = await db
    .insert(columnTable)
    .values({
      projectId,
      name,
      slug,
      position,
      icon: icon || null,
      color: color || null,
      isFinal: isFinal ?? false,
      wipLimit: wipLimit ?? null,
    })
    .returning();
  // …
}
```

### `update-column.ts` controller

Extend the `data` param type and add one conditional-spread line so an explicit `null` clears the limit:

```ts
async function updateColumn(
  id: string,
  data: {
    name?: string;
    icon?: string | null;
    color?: string | null;
    isFinal?: boolean;
    wipLimit?: number | null;
  },
) {
  // …existing lookup…
  const [updated] = await db
    .update(columnTable)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.icon !== undefined && { icon: data.icon }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.isFinal !== undefined && { isFinal: data.isFinal }),
      ...(data.wipLimit !== undefined && { wipLimit: data.wipLimit }),
    })
    .where(eq(columnTable.id, id))
    .returning();
  // …
}
```

### `get-tasks.ts` board projection

This is the load-bearing edit. The projection at L218-237 hand-whitelists column fields; `color` is already silently dropped there, proving the omission is easy to make. Because `ProjectWithTasks` is INFERRED from this endpoint via `InferResponseType`, omitting `wipLimit` here fails silently in web types too — the field would simply not exist on the board column shape and no compile error would flag it.

```ts
const columns = projectColumns.map((column) => ({
  id: column.slug,
  slug: column.slug,
  name: column.name,
  icon: column.icon,
  isFinal: column.isFinal,
  wipLimit: column.wipLimit,
  tasks: /* …unchanged… */,
}));
```

## 5. Web data-layer delta

The create/update data shape is duplicated in **three** places. All three must be extended in the same packet or the types drift.

1. `apps/web/src/fetchers/column/create-column.ts` — `data` param:

```ts
data: {
  name: string;
  icon?: string;
  color?: string;
  isFinal?: boolean;
  wipLimit?: number | null;
},
```

2. `apps/web/src/fetchers/column/update-column.ts` — `data` param:

```ts
data: {
  name?: string;
  icon?: string | null;
  color?: string | null;
  isFinal?: boolean;
  wipLimit?: number | null;
},
```

3. `apps/web/src/hooks/mutations/column/use-create-column.ts` — `mutationFn` variables:

```ts
{ projectId: string; data: { name: string; icon?: string; color?: string; isFinal?: boolean; wipLimit?: number | null } }
```

`apps/web/src/hooks/mutations/column/use-update-column.ts` — `mutationFn` variables:

```ts
{ id: string; projectId: string; data: { name?: string; icon?: string | null; color?: string | null; isFinal?: boolean; wipLimit?: number | null } }
```

Existing invalidations in `use-update-column` (`["columns", projectId]` + `["tasks", projectId]`) already cover the board refresh; no change to the `onSuccess` handlers.

## 6. UI delta

### (a) `column-editor.tsx` — configuration

Add `handleWipLimitChange` mirroring `handleToggleFinal`:

```ts
const handleWipLimitChange = async (id: string, wipLimit: number | null) => {
  try {
    await updateColumn({ id, projectId, data: { wipLimit } });
    toast.success(t("settings:columnEditor.toastWipLimitUpdated"));
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : t("settings:columnEditor.toastWipLimitUpdateError"),
    );
  }
};
```

Placement: in the per-column row block (L299-341), inside the `flex items-center gap-1.5 shrink-0` cluster, **before** the Done-column toggle group. Control:

```tsx
<div className="flex items-center gap-2" title={t("settings:columnEditor.wipLimitTooltip")}>
  <span className="text-xs text-muted-foreground whitespace-nowrap">
    {t("settings:columnEditor.wipLimit")}
  </span>
  <Input
    type="number"
    inputMode="numeric"
    min={1}
    max={2147483647}
    step={1}
    defaultValue={col.wipLimit ?? ""}
    placeholder={t("settings:columnEditor.wipLimitPlaceholder")}
    disabled={!canEdit}
    aria-label={t("settings:columnEditor.wipLimitAria", { name: col.name })}
    className="h-7 w-16 text-xs"
    onBlur={(e) => {
      const raw = e.target.value.trim();
      const next = raw === "" ? null : Number(raw);
      const current = col.wipLimit ?? null;
      if (next === current) return;
      if (next !== null && (!Number.isInteger(next) || next < 1 || next > 2147483647)) {
        e.target.value = current === null ? "" : String(current);
        return;
      }
      handleWipLimitChange(col.id, next);
    }}
    onKeyDown={(e) => {
      if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
    }}
  />
</div>
```

Debounce/commit strategy: reuse the file's existing `onBlur`/Enter idiom (identical to the rename `Input`). No timer-based debounce — commit fires exactly once per blur, empty string commits `null`, and out-of-range values silently revert to the previous value (server-side validator is still the authority). `min`, `max`, and `step` mirror the validator strictly as a UX guard only.

### (b) `column-header.tsx` — display only

At the count `<span>` (L62-64), swap the fixed "count" span for a count/limit badge. Requires adding `AlertTriangle` to the existing lucide-react import and importing `cn` from `@/lib/utils`:

```tsx
{(() => {
  const count = column.tasks.length;
  const limit = column.wipLimit ?? null;
  const over = limit !== null && count > limit;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground",
        over && "bg-destructive/15 text-destructive",
      )}
      aria-label={
        limit === null
          ? t("tasks:kanban.taskCountAria", { count })
          : t("tasks:kanban.wipLimitAria", { count, limit })
      }
      title={
        limit === null
          ? undefined
          : over
            ? t("tasks:kanban.wipLimitOver", { count, limit })
            : t("tasks:kanban.wipLimitWithin", { count, limit })
      }
    >
      {limit === null ? count : `${count} / ${limit}`}
      {over && (
        <AlertTriangle
          className="w-3 h-3"
          aria-hidden="true"
        />
      )}
    </span>
  );
})()}
```

- `wipLimit === null` → render just the number, identical to today.
- `wipLimit` set and `count <= limit` → render `count / limit` in the neutral muted style.
- `count > limit` → swap to the `bg-destructive/15 text-destructive` tokens **and** render a small `AlertTriangle` icon; the icon plus the `wipLimitOver` `title` and `aria-label` provide the non-color affordance for the over-cap state.

Nothing else in the header changes; the Archive and Plus buttons are untouched.

## 7. i18n keys (en-US only)

| key | en-US string |
|---|---|
| `settings.columnEditor.wipLimit` | `WIP limit` |
| `settings.columnEditor.wipLimitTooltip` | `Advisory maximum number of tasks for this column` |
| `settings.columnEditor.wipLimitPlaceholder` | `None` |
| `settings.columnEditor.wipLimitAria` | `WIP limit for {{name}}` |
| `settings.columnEditor.toastWipLimitUpdated` | `WIP limit updated` |
| `settings.columnEditor.toastWipLimitUpdateError` | `Failed to update WIP limit` |
| `tasks.kanban.taskCountAria` | `{{count}} tasks` |
| `tasks.kanban.wipLimitAria` | `{{count}} of {{limit}} tasks (WIP limit)` |
| `tasks.kanban.wipLimitWithin` | `{{count}} of {{limit}} — within WIP limit` |
| `tasks.kanban.wipLimitOver` | `{{count}} of {{limit}} — over WIP limit` |

All strings added to `i18n/en-US.json` inside the existing `settings.columnEditor` and `tasks.kanban` objects. No other locale files are touched.

## 8. Test plan

| AC | file | test name | harness |
|---|---|---|---|
| AC-1 | `tests/api/column/create-column.test.ts` | `accepts wipLimit values 1, 5, and 2147483647` | apps/api vitest (node, no db setup) |
| AC-2 | `tests/api/column/create-column.test.ts` | `accepts null and absent wipLimit` | apps/api vitest |
| AC-3 | `tests/api/column/create-column.test.ts` | `rejects wipLimit 0, -3, 2.5, 2147483648, 99999999999, 9007199254740992, Number.MAX_VALUE with 400` | apps/api vitest |
| AC-4 | `tests/api/column/update-column.test.ts` | `accepts explicit null to clear wipLimit` | apps/api vitest |
| AC-5 | `tests/api/column/update-column.test.ts` | `rejects the same overflow and non-integer set as create` | apps/api vitest |
| AC-6 | `tests/api-integration/column-wip-limit.test.ts` | `persists wipLimit through create and update and returns it via GET tasks board projection` | tests/api-integration vitest (single worker, PostgreSQL, `_test` db, mockAuthenticatedSession) |
| AC-7 | `tests/api-integration/column-wip-limit.test.ts` | `does not block creating a task when the column is at or over the limit` | integration |
| AC-8 | `tests/api-integration/column-wip-limit.test.ts` | `does not block moving a task into a column that is over the limit` | integration |
| AC-9 | `apps/web/src/components/kanban-board/column/column-header.test.tsx` | `renders bare count when wipLimit is null`, `renders count / limit within cap`, `applies destructive tokens and AlertTriangle when over cap` | apps/web vitest (jsdom, `vi.mock` all hook/store deps, `t` returns the key) |
| AC-10 | `apps/web/src/components/project/column-editor.test.tsx` | `commits new wipLimit on blur`, `commits null when input cleared`, `does not commit when value unchanged`, `reverts on out-of-range without calling the mutation` | apps/web vitest (jsdom) |

## 9. Risks and pitfalls

- **`get-tasks` whitelist**: the board projection hand-selects column fields and already drops `color` silently. Omit `wipLimit` there and the badge simply never renders — with zero compile error, because `ProjectWithTasks` is inferred from the endpoint. Adding `wipLimit: column.wipLimit` to that map is the single most important line in this change.
- **Board columns carry no real column id**: the projection sets `id: column.slug`, so `column.id` in the board shape is the slug, not the row's primary key. Any mutation that needs the real id (rename, WIP-limit edit) must come from the editor surface — `getColumns` returns the full row — not from the header. This is why configuration lives in `column-editor.tsx` and the header stays display-only.
- **int4 overflow**: PostgreSQL `integer` tops out at `2147483647`. The Valibot `maxValue(2147483647)` is what stops overflow — without it a JSON-safe `2147483648` would reach the driver and either error or corrupt. The editor `max` attribute is not a substitute.
- **Three-place data shape drift**: the create/update shape lives in the API validator, the fetcher param, and the mutation hook variables. Ship all three edits in one packet or the web build silently loses field awareness.
- **Do not touch drag-and-drop**: task moves stay unconditional. The header badge reflects state after the move; no pre-move guard, no toast, no rejection.
- **Migration on populated data**: rely on the generator; do not hand-add a `DEFAULT` or `NOT NULL`. Nullable + no default = metadata-only alter, safe on live tables.
- **i18n scope**: add keys only to `i18n/en-US.json`. Do not touch other locale files — they intentionally fall back to en-US for missing keys.
- **No permission change**: reuse `requireWorkspacePermission({ project: ["update"] })` that already guards the two routes; no new verb is needed.

## 10. Proposed packet decomposition

1. **pkt-01 schema + migration** — add `wipLimit: integer("wip_limit")` to `columnTable`, run `pnpm --filter @kaneo/api db:generate`, keep generated SQL. `artifact_path: apps/api/src/database/schema.ts` (+ generated migration under `apps/api/drizzle/`).
2. **pkt-02 api-validators-and-controllers** — extend create/update Valibot schemas in `apps/api/src/column/index.ts`, extend `create-column.ts` + `update-column.ts` controllers to accept and persist `wipLimit` (null-clear via conditional spread). `artifact_path: apps/api/src/column/`.
3. **pkt-03 board-projection** — add `wipLimit: column.wipLimit` to the projection in `apps/api/src/task/controllers/get-tasks.ts`. Isolated because it is the single silent-failure risk and deserves its own review. `artifact_path: apps/api/src/task/controllers/get-tasks.ts`.
4. **pkt-04 api-tests** — new `tests/api/column/create-column.test.ts`, `tests/api/column/update-column.test.ts`, and `tests/api-integration/column-wip-limit.test.ts` covering the full validator accept/reject matrix, null-clear, persistence, projection round-trip, and advisory-only behavior on task create/move. `artifact_path: tests/api/column/, tests/api-integration/column-wip-limit.test.ts`.
5. **pkt-05 web-data-layer** — extend the create/update `data` shape in both fetchers and both mutation hooks in one commit so the three duplicated shapes stay in lockstep. `artifact_path: apps/web/src/fetchers/column/, apps/web/src/hooks/mutations/column/`.
6. **pkt-06 column-editor-ui** — add `handleWipLimitChange`, render the numeric input inside the per-column row (mirroring the Done toggle idiom), wire the onBlur commit / Enter blur / empty-string-null semantics. `artifact_path: apps/web/src/components/project/column-editor.tsx`.
7. **pkt-07 column-header-ui** — replace the count span with the count/limit badge, apply `bg-destructive/15 text-destructive` + `AlertTriangle` on over-cap with `title`/`aria-label` for the non-color affordance. `artifact_path: apps/web/src/components/kanban-board/column/column-header.tsx`.
8. **pkt-08 i18n** — add the ten en-US keys under `settings.columnEditor` and `tasks.kanban`. `artifact_path: i18n/en-US.json`.
9. **pkt-09 web-component-tests** — new `column-header.test.tsx` and `column-editor.test.tsx` following the `task-row.test.tsx` mocking idiom. `artifact_path: apps/web/src/components/kanban-board/column/column-header.test.tsx, apps/web/src/components/project/column-editor.test.tsx`.

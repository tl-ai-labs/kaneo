# Change Plan — feature-extend — Per-lane WIP limit with over-cap indicator

Run: `20260824-095555-feature-extend-wip-limits` · Intent: `feature-extend` · Mode: brownfield
Form: **delta change plan** (Intent matrix, feature-extend row). Delta against the current Kaneo
tree at `feature-extend-1/opus-flash` (cut from `main` at `5d1fc910`; corrected post-Gate-2 — an
earlier draft of this line named `feature-extend-2/opus-flash`, which is not this worktree's branch).
Stack: Hono + drizzle-orm/pg + Valibot on the API side,
React 19 + TanStack Query + Vite + Tailwind v4 on the web side, per `AGENTS.md`.

---

## 1. Delta overview

1. `columnTable` gains one nullable scalar `wipLimit` (`integer("wip_limit")`), added by a single
   additive drizzle-kit migration. NULL means "no limit".
2. `POST /column/:projectId` and `PUT /column/:id` accept `wipLimit` through a shared, unit-testable
   Valibot schema (`positive integer | null | omitted`); the two column controllers persist it.
3. `get-tasks.ts` adds one line to its `projectColumns.map()` projection so the limit rides on the
   payload the board already fetches — no new request per board mount.
4. A new pure presentational `ColumnTaskCountBadge` replaces the lane header's inline count `<span>`
   and renders a soft over-cap state; the no-limit branch is byte-identical to today's markup.
5. `ColumnEditor` gains a per-row numeric input (commit on blur + Enter, empty clears, invalid
   reverts without firing a mutation). Nothing anywhere is blocked or rejected on over-cap.

---

## 2. Data model delta

### 2.1 `apps/api/src/database/schema.ts`

`columnTable` is defined at line 342. Insert **one line** between `isFinal` (line 359) and
`createdAt` (line 360). `integer` is already imported and already used by `position` on the same
table — no import change.

```ts
    isFinal: boolean("is_final").default(false).notNull(),
    // Soft work-in-progress cap for the lane. NULL means no limit; never enforced server-side.
    wipLimit: integer("wip_limit"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
```

Constraints, deliberately: **no** `.notNull()`, **no** `.default()`, **no** index. The table's
`(table) => [index("column_projectId_idx").on(table.projectId)]` clause is untouched — the field is
never a filter or sort key, so an index would be dead weight.

### 2.2 Generated migration — `apps/api/drizzle/0043_<generated-name>.sql`

Produced by `pnpm --filter @kaneo/api db:generate`. **Do not hand-author it.** Expected content,
matching the plain style of `0042_previous_the_executioner.sql` (raw SQL, trailing newline, and —
because this is a single statement — **no** `--> statement-breakpoint` marker):

```sql
ALTER TABLE "column" ADD COLUMN "wip_limit" integer;
```

Inspection gate before the packet is accepted:
- exactly one statement;
- no `NOT NULL`, no `DEFAULT`, no `USING`, no `CREATE INDEX`, no `UPDATE`;
- filename prefix is `0043_`, and **no existing migration file is renamed, renumbered, or edited**.

In PostgreSQL 11+ this is a catalog-only rewrite-free `ADD COLUMN` (NFR-1).

drizzle-kit will not prompt: a pure addition with no dropped column is unambiguous, so there is no
rename question to answer. If it does prompt, stop and escalate rather than guessing.

### 2.3 `apps/api/src/database/relations.ts` — **no change**

Justified, not assumed. `relations()` in drizzle declares *relationships* (`one`/`many` over foreign
keys), not columns. `columnTableRelations` therefore lists no scalar field at all — `position`,
`icon`, `color`, and `isFinal` are all absent from it today. A scalar, non-FK, non-referenced column
addition is invisible to `relations.ts`. Expect a zero-line diff. The path stays in the allowlist
only as a safety valve; if a packet proposes editing it, that is a signal something went wrong.

### 2.4 `packages/libs` — **no change expected**

The client is `hc<AppType>()`; the column contract reaches the web app by Hono RPC type inference
from the route definitions in `apps/api/src/column/index.ts`, not by hand-written types. Adding a
field to the Valibot json validator and to the `c.json(...)` payload updates `AppType`
automatically. Touch `packages/libs` only if `pnpm --filter @kaneo/web typecheck` proves inference
insufficient — expected zero edits.

---

## 3. API contract delta

### 3.1 New file — `apps/api/src/column/validators.ts`

The `wipLimit` shape is extracted to a named export so it can be unit-tested without booting the
Hono app or touching a database (the `tests/api/**` suite is node-env, DB-free).

```ts
import * as v from "valibot";

/**
 * Soft work-in-progress cap for a column.
 * Positive integer sets the cap; `null` clears it; omitting the field on update
 * leaves the stored value untouched. Advisory only — never enforced.
 */
export const wipLimitSchema = v.optional(
  v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))),
);
```

Scope discipline: this file exports **only** `wipLimitSchema`. Do not migrate the existing inline
`name`/`icon`/`color`/`isFinal` validators into it — that is an unrelated refactor (NFR-8).

### 3.2 `POST /column/:projectId`

Authorization unchanged: `workspaceAccess.fromProject("projectId")` then
`requireWorkspacePermission({ project: ["update"] })`. No new middleware, no new permission verb.

json validator (`apps/api/src/column/index.ts`, currently lines 56–64) becomes:

```ts
    validator(
      "json",
      v.object({
        name: v.string(),
        icon: v.optional(v.string()),
        color: v.optional(v.string()),
        isFinal: v.optional(v.boolean()),
        wipLimit: wipLimitSchema,
      }),
    ),
```

Handler (lines 68–76):

```ts
      const { projectId } = c.req.valid("param");
      const { name, icon, color, isFinal, wipLimit } = c.req.valid("json");
      const result = await createColumn({
        projectId,
        name,
        icon,
        color,
        isFinal,
        wipLimit,
      });
```

`describeRoute.description` becomes:

> `"Create a new column in a project. Optional wipLimit sets a soft work-in-progress cap as a positive integer; omit it or send null for no limit. The cap is advisory — the API never rejects a task for exceeding it."`

Null-vs-omitted semantics on create: **identical**. Both store NULL. There is no prior value to
preserve on an insert, so `wipLimit ?? null` collapses the two cases.

### 3.3 `PUT /column/:id`

Authorization unchanged: `workspaceAccess.fromColumn("id")` then
`requireWorkspacePermission({ project: ["update"] })`.

json validator (currently lines 132–140) becomes:

```ts
    validator(
      "json",
      v.object({
        name: v.optional(v.string()),
        icon: v.optional(v.nullable(v.string())),
        color: v.optional(v.nullable(v.string())),
        isFinal: v.optional(v.boolean()),
        wipLimit: wipLimitSchema,
      }),
    ),
```

The handler body (lines 143–147) is **unchanged** — it already forwards `c.req.valid("json")`
wholesale as `data`.

Null-vs-omitted semantics on update, and this is the load-bearing difference:

| Request body | Stored result |
|---|---|
| `{ "wipLimit": 5 }` | set to `5` |
| `{ "wipLimit": null }` | cleared to NULL |
| `{}` (omitted) | **untouched** — retains whatever was stored |

This is delivered by the existing `data.x !== undefined && { x: data.x }` merge convention, which
distinguishes `null` (present, falsy-but-defined → included) from `undefined` (absent → excluded).

`describeRoute.description` becomes:

> `"Update a column. Send wipLimit as a positive integer to set the soft work-in-progress cap, null to clear it, or omit it to leave it unchanged. The cap is advisory and is never enforced."`

The `responses` blocks and `resolver(v.any())` stay exactly as they are on both routes — matching the
module's existing pattern; do not introduce a typed response resolver here (NFR-8).

### 3.4 Import to add in `apps/api/src/column/index.ts`

```ts
import { wipLimitSchema } from "./validators";
```

Placed with the other relative imports; Biome's organize-imports will order it — sort it next to the
`./controllers/*` imports and let `biome check` confirm.

### 3.5 `createColumn` controller — `apps/api/src/column/controllers/create-column.ts`

Signature (lines 18–30) gains one destructured field and one type field:

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
```

`.values()` (lines 69–77) gains one entry, after `isFinal`:

```ts
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
```

Note `?? null`, not `|| null` — `||` would be wrong in principle for a numeric field, and using `??`
documents that intent even though `0` can never reach here (the validator rejects it).

Nothing else in this controller changes. `toSlug`, the reserved-slug check, the duplicate-slug check,
and the `MAX(position)` query are all untouched.

### 3.6 `updateColumn` controller — `apps/api/src/column/controllers/update-column.ts`

`data` type (lines 8–13) gains one field:

```ts
  data: {
    name?: string;
    icon?: string | null;
    color?: string | null;
    isFinal?: boolean;
    wipLimit?: number | null;
  },
```

`.set()` (lines 25–30) gains one conditional spread, after `isFinal`:

```ts
      ...(data.isFinal !== undefined && { isFinal: data.isFinal }),
      ...(data.wipLimit !== undefined && { wipLimit: data.wipLimit }),
```

`data.wipLimit === null` satisfies `!== undefined`, so an explicit null is spread in and clears the
column. That is the intended behavior, not an accident.

### 3.7 `getColumns` controller — **no change**

`apps/api/src/column/controllers/get-columns.ts` does `db.select()` with no projection argument, so
it returns every column of `columnTable`. `wipLimit` appears in the response the moment §2.1 lands.
Proven by test (§9), not by edit.

### 3.8 Status codes per invalid input class

All four routes' error behavior is provided by `hono-openapi`'s `validator`, which rejects a failed
Valibot parse before any middleware after it runs. No custom `HTTPException` is added for `wipLimit`.

| Input | Failing pipe stage | Status | Body |
|---|---|---|---|
| `{"wipLimit": 3}` | — | `200` | column with `wipLimit: 3` |
| `{"wipLimit": null}` | — | `200` | column with `wipLimit: null` |
| `{}` (omitted) | — | `200` | create → NULL; update → prior value |
| `{"wipLimit": 0}` | `v.minValue(1)` | **`400`** | validator issue payload |
| `{"wipLimit": -1}` | `v.minValue(1)` | **`400`** | validator issue payload |
| `{"wipLimit": 2.5}` | `v.integer()` | **`400`** | validator issue payload |
| `{"wipLimit": "3"}` | `v.number()` | **`400`** | validator issue payload |
| `{"wipLimit": true}` | `v.number()` | **`400`** | validator issue payload |

Unchanged, and explicitly **not** in this delta: there is no `409`, no `422`, and no new `4xx` for
an over-cap board state. Over-cap is a rendering state, never a request outcome.

---

## 4. Board payload delta

### 4.1 `apps/api/src/task/controllers/get-tasks.ts`

The projection at line 224 currently emits an explicit subset. Add **one line** after
`isFinal: column.isFinal,` (line 229) and before `tasks:` (line 230):

```ts
  const columns = projectColumns.map((column) => ({
    id: column.slug,
    slug: column.slug,
    name: column.name,
    icon: column.icon,
    isFinal: column.isFinal,
    wipLimit: column.wipLimit,
    tasks: paginatedTasks
      .filter((task) => task.status === column.slug)
      .map((task) => ({
        ...task,
        labels: taskLabelsMap.get(task.id) || [],
        externalLinks: taskExternalLinksMap.get(task.id) || [],
      })),
  }));
```

`projectColumns` is already `db.select().from(columnTable)` with no projection (line 218), so
`column.wipLimit` exists as soon as §2.1 lands. **This is the only edit to this file, and this file
is the only file under `apps/api/src/task/**` that may be touched** (write-contract carve-out).

Purely additive to the response — `archivedTasks`, `plannedTasks`, and `pagination` are untouched,
and no existing consumer of `GET /task/tasks/:projectId` sees a changed field (FR-13).

### 4.2 Why `apps/web/src/types/project/index.ts` needs **NO** manual edit

State plainly: **a manual type edit is NOT needed.** The inference chain, end to end:

1. `get-tasks.ts` returns `{ data: { ..., columns } }` where `columns` is inferred structurally from
   the object literal in §4.1 — so `columns[number]` now carries `wipLimit: number | null`.
2. The task route hands that object to `c.json(...)`, so Hono's `AppType` for
   `client.task.tasks[":projectId"].$get` carries it in the `200` branch.
3. `apps/web/src/types/project/index.ts` line 10 does
   `InferResponseType<(typeof client)["task"]["tasks"][":projectId"]["$get"], 200>`, then
   `ProjectWithTasksRaw = TasksApiResponse["data"]`.
4. `ProjectWithTasks` (line 17) is
   `Omit<ProjectWithTasksRaw, "archivedTasks" | "columns" | "plannedTasks"> & { columns: Array<Omit<ProjectWithTasksRaw["columns"][number], "tasks"> & { tasks: Task[] }> }`.
   The `Omit` on the column member removes **only** `"tasks"`. Every other member field — including
   the new `wipLimit` — survives the `Omit` untouched.

Therefore `ProjectWithTasks["columns"][number]["wipLimit"]` is `number | null` with zero edits to
`apps/web/src/types/**`. The path remains allowlisted purely as a safety valve; a packet that
proposes editing it should be treated as a signal that §4.1 was not applied.

Same story for `ColumnEditor`: `useGetColumns` is typed off `client.column[":projectId"].$get`, whose
handler returns `getColumns()`'s select-all rows, so `col.wipLimit` types itself once §2.1 lands.

Practical note for the executor: TypeScript project references / editor caches can lag. If
`col.wipLimit` reports as unknown, re-run `pnpm --filter @kaneo/web typecheck` from a clean state
before concluding a type edit is needed.

---

## 5. Web plumbing delta

Four small type widenings. All four are pure type edits — **no runtime line changes at all**,
because every one of these functions already forwards its `data` object opaquely.

### 5.1 `apps/web/src/fetchers/column/create-column.ts`

```ts
async function createColumn(
  projectId: string,
  data: {
    name: string;
    icon?: string;
    color?: string;
    isFinal?: boolean;
    wipLimit?: number | null;
  },
) {
```

Body unchanged (`client.column[":projectId"].$post({ param, json: data })`).

### 5.2 `apps/web/src/fetchers/column/update-column.ts`

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
```

Body unchanged.

### 5.3 `apps/web/src/hooks/mutations/column/use-create-column.ts`

```ts
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: {
        name: string;
        icon?: string;
        color?: string;
        isFinal?: boolean;
        wipLimit?: number | null;
      };
    }) => createColumn(projectId, data),
```

`onSuccess` unchanged — it already does a blanket
`queryClient.invalidateQueries({ refetchType: "all" })`.

### 5.4 `apps/web/src/hooks/mutations/column/use-update-column.ts`

```ts
      data: {
        name?: string;
        icon?: string | null;
        color?: string | null;
        isFinal?: boolean;
        wipLimit?: number | null;
      };
```

### 5.5 Cache invalidation — **no new invalidation is required**

Explicitly stated, with the reason. `useUpdateColumn.onSuccess` already invalidates **both** keys
that matter, in parallel:

- `["columns", variables.projectId]` — backs `useGetColumns`, which is what `ColumnEditor` renders,
  so the editor's own row re-syncs from the server after a commit;
- `["tasks", variables.projectId]` — backs the board's `ProjectWithTasks` query, so the lane header
  picks up a changed limit without any board-specific wiring.

`useCreateColumn` invalidates everything. Adding a third key, an `onMutate` optimistic patch, or a
`setQueryData` write would be net-new complexity for zero behavior change (NFR-4, NFR-8). Do not add
one.

No new `publishEvent()` call, no WebSocket message, no Redis fan-out. A WIP limit is process
metadata, not activity (out-of-scope item 4 in the requirements).

---

## 6. `ColumnEditor` delta — `apps/web/src/components/project/column-editor.tsx`

### 6.1 Placement

Inside the per-column row's right-hand controls container — the
`<div className="flex items-center gap-1.5 shrink-0">` opened at line 299 — insert the WIP group as
its **first child**, immediately before the existing "Done column" `<div className="flex items-center gap-2" title={...doneColumnTooltip}>`
at line 300. Reading order becomes: grip → icon picker → name input → **WIP limit** → Done column
switch → delete. The container's own classes are unchanged.

The "add a new column" row at the bottom (lines 346–428) is **not** modified. New columns are created
with no limit and the limit is set afterwards on the row input. The create-side `wipLimit` support in
§3.2 / §5.1 / §5.3 exists for API-contract completeness and is covered by API tests; it is
deliberately not surfaced in the create form (keeps the add row a two-field affordance).

### 6.2 JSX to insert

```tsx
              <div
                className="flex items-center gap-1.5"
                title={t("settings:columnEditor.wipLimitTooltip")}
              >
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {t("settings:columnEditor.wipLimit")}
                </span>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  defaultValue={col.wipLimit ?? ""}
                  disabled={!canEdit}
                  aria-label={t("settings:columnEditor.wipLimitAria", {
                    name: col.name,
                  })}
                  placeholder={t("settings:columnEditor.wipLimitPlaceholder")}
                  className="h-8 w-16 text-sm"
                  onBlur={(e) =>
                    handleUpdateWipLimit(col.id, col.wipLimit ?? null, e.currentTarget)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                />
              </div>
```

Contract points, each deliberate:

- **Uncontrolled** (`defaultValue`, not `value`), exactly like the existing name input at line 283.
  No new `useState` map keyed by column id.
- **`disabled={!canEdit}`** where `canEdit = canManageProjects()` — same binding as the name input
  (line 286), the icon-picker trigger (line 236), and the Switch (line 319). This is presentation
  only and mirrors, never replaces, `requireWorkspacePermission({ project: ["update"] })` (§3.2/§3.3).
- **Accessible label** is `aria-label`, not a `<label>` element — matching `markDoneAria` on the
  Switch (line 320) and keeping the row's dense layout. The visible `"WIP"` `<span>` is decorative
  reinforcement; the `aria-label` interpolates the column name so screen-reader users can tell rows
  apart.
- **Commit on Enter** is implemented by blurring, so Enter and blur share one code path — identical
  to the name input's `onKeyDown` (lines 292–297).
- **No commit on keystroke.** There is no `onChange` handler. Do not add one.

### 6.3 Handlers to add

Place both next to `handleToggleFinal` (after line 101), keeping the file's existing
`try/catch` + `toast` shape.

```tsx
  const commitWipLimit = async (id: string, wipLimit: number | null) => {
    try {
      await updateColumn({ id, projectId, data: { wipLimit } });
      toast.success(
        wipLimit === null
          ? t("settings:columnEditor.toastWipLimitCleared")
          : t("settings:columnEditor.toastWipLimitUpdated"),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:columnEditor.toastUpdateError"),
      );
    }
  };

  const handleUpdateWipLimit = (
    id: string,
    current: number | null,
    input: HTMLInputElement,
  ) => {
    const raw = input.value.trim();

    if (raw === "") {
      if (current === null) return;
      void commitWipLimit(id, null);
      return;
    }

    const parsed = Number(raw);

    // Client-side guard only; the Valibot validator on PUT /column/:id is the authority.
    if (!Number.isInteger(parsed) || parsed < 1) {
      input.value = current === null ? "" : String(current);
      return;
    }

    if (parsed === current) return;

    void commitWipLimit(id, parsed);
  };
```

Behavior table this encodes:

| Input value on blur/Enter | Stored value | Action |
|---|---|---|
| `""` | already NULL | no mutation, no toast |
| `""` | `4` | `PUT { wipLimit: null }` → `toastWipLimitCleared` |
| `"3"` | `3` | no mutation (no-op edit), no toast |
| `"3"` | NULL or `4` | `PUT { wipLimit: 3 }` → `toastWipLimitUpdated` |
| `"0"`, `"-2"`, `"2.5"`, `"abc"` | anything | **no mutation**; input reverts to stored value |

**Executor trap — read this.** `handleUpdateWipLimit` is intentionally **synchronous**, and the
`HTMLInputElement` is passed as an argument captured at call time from `e.currentTarget`. React
nulls `currentTarget` on a synthetic event once the handler returns, so reading or writing
`e.currentTarget.value` after an `await` silently fails. Both the read (`input.value`) and the
revert write (`input.value = ...`) happen before any promise is created. Do not convert
`handleUpdateWipLimit` to `async`, and do not inline the body into the `onBlur` arrow with an
`await` in it.

`type="number"` in jsdom/Chrome yields `""` for unparseable text like `"abc"`, which would hit the
"clear the limit" branch. That is acceptable and matches native number-input semantics — the field
visibly empties as the user types garbage, so clearing is the honest reading of the UI state. The
`Number.isInteger` guard still catches `2.5`, `0`, and `-1`, which `type="number"` does accept.

`Number("")` is `0`, which is why the empty check runs **before** `Number(raw)`. Do not reorder.

### 6.4 Not changed in this file

`handleCreate`, `handleRename`, `handleToggleFinal`, `handleUpdateIcon`, `handleDelete`, all three
drag handlers, the drag-preview clone logic, `filteredIcons`, and the loading branch are all
untouched. No import is added (`Input`, `useTranslation`, `toast`, `updateColumn` are all already in
scope; no new lucide icon is needed).

---

## 7. Lane header delta

### 7.1 New component — `apps/web/src/components/kanban-board/column/column-task-count-badge.tsx`

Extracted deliberately; see ADR-4. Full intended source:

```tsx
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type ColumnTaskCountBadgeProps = {
  count: number;
  wipLimit?: number | null;
};

export function ColumnTaskCountBadge({
  count,
  wipLimit,
}: ColumnTaskCountBadgeProps) {
  const { t } = useTranslation();

  // No limit: render byte-identically to the pre-WIP-limit badge.
  if (wipLimit == null) {
    return (
      <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
        {count}
      </span>
    );
  }

  const isOverCap = count > wipLimit;
  const label = isOverCap
    ? t("tasks:kanban.wipLimit.overLabel", { current: count, limit: wipLimit })
    : t("tasks:kanban.wipLimit.withinLabel", { current: count, limit: wipLimit });

  return (
    <span
      data-over-limit={isOverCap ? "true" : "false"}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
        isOverCap
          ? "bg-destructive/10 text-destructive ring-1 ring-destructive/30"
          : "bg-muted text-muted-foreground",
      )}
    >
      {isOverCap ? (
        <AlertTriangle aria-hidden="true" className="h-3 w-3 shrink-0" />
      ) : null}
      {`${count}/${wipLimit}`}
    </span>
  );
}
```

### 7.2 The four states, precisely

| State | Condition | Rendered |
|---|---|---|
| **No limit** | `wipLimit == null` (covers both `null` and `undefined`) | `<span class="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">{count}</span>` — **byte-identical to today**. No `/`, no `title`, no `aria-label`, no `data-over-limit`, no icon. |
| **Under cap** | `count < wipLimit` | `count/limit` in the neutral muted style; `data-over-limit="false"`; label from `withinLabel`. |
| **At cap** | `count === wipLimit` | Identical to under cap. At-cap is **not** over-cap — the boundary is strictly `>`. |
| **Over cap** | `count > wipLimit` | `count/limit` in the destructive style; `data-over-limit="true"`; `AlertTriangle` glyph; label from `overLabel`. |

The **byte-identical** requirement (FR-25, AC-6) is why the no-limit case is an **early return with a
literal `<span>`**, not a `cn()` ternary that happens to produce the same class list. A ternary would
reorder classes, append `inline-flex items-center gap-1 tabular-nums`, and attach `title`/
`aria-label`/`data-over-limit` — all of which are DOM diffs against today. This is the single
highest-regression-risk line in the whole delta. Copy the existing `className` string from
`column-header.tsx` line 62 verbatim:

```
rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground
```

### 7.3 Design tokens

No raw hex, no arbitrary values, no new CSS variable. Every class uses a token the repo already
ships: `bg-muted` / `text-muted-foreground` (used in the current badge and throughout
`column-editor.tsx`), and `destructive` (used at `column-editor.tsx:335`,
`hover:text-destructive`). `bg-destructive/10` and `ring-destructive/30` are Tailwind v4 opacity
modifiers on that same token, so they follow the theme in both light and dark mode. `tabular-nums`
stops the badge from reflowing as the count ticks 9 → 10.

### 7.4 Accessibility contract

State is **never conveyed by color alone** (WCAG 1.4.1, FR-28, NFR-5). Three redundant channels:

1. **Text** — the badge itself changes from `5` to `5/3`, so the relationship is legible without
   color.
2. **Shape/glyph** — over-cap adds an `AlertTriangle` and a `ring-1` outline, both visible in
   grayscale and to users with any form of color vision deficiency.
3. **Programmatic** — `aria-label` carries the full sentence ("5 of 3 tasks, over the WIP limit"),
   and `title` gives the same string to sighted mouse users. The icon is `aria-hidden` so the label
   is not doubled.

`data-over-limit` is a test/inspection hook, not a styling hook. It is stable API for the tests in
§9 and must not be removed.

No `role="status"`, no `aria-live`. The badge is not an announcement — it is static state that
re-renders with the board, and a live region would spam screen readers on every drag.

### 7.5 `apps/web/src/components/kanban-board/column/column-header.tsx`

Exactly two edits. Add the import next to the sibling imports at the top:

```tsx
import { ColumnTaskCountBadge } from "./column-task-count-badge";
```

and replace lines 62–64 —

```tsx
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          {column.tasks.length}
        </span>
```

— with:

```tsx
        <ColumnTaskCountBadge
          count={column.tasks.length}
          wipLimit={column.wipLimit}
        />
```

**Nothing else in this file changes.** `handleConfirmArchive`, the archive button's
`canTask && column.isFinal && column.tasks.length > 0` condition, the create-task button's
`canCreate` condition, `CreateTaskModal`, and `ArchiveTasksModal` are all untouched. The count source
stays `column.tasks.length` — no new query, no derived count (FR-30).

### 7.6 Nothing is enforced — the negative contract

Zero handlers gain a `wipLimit` condition. Specifically, **do not** touch:

- `apps/web/src/components/kanban-board/column/column-dropzone.tsx` — drop acceptance;
- `apps/web/src/components/kanban-board/column/index.tsx` — the `disableDragDrop` prop and the
  dropzone-over styling;
- any task-create, task-move, or archive path.

No toast fires on crossing the cap. No drag is refused. No API call is short-circuited. If a packet
diff contains `wipLimit` inside a conditional in a drag, drop, create, or archive handler, reject it
(FR-29, AC-8).

---

## 8. i18n key inventory

Source of truth is repo-root **`i18n/en-US.json`** (the web app reads it through the `@i18n` Vite
alias; `apps/web/src/i18n/` does not exist). Namespace separator is `:`, key separator is `.`, so
`settings:columnEditor.wipLimit` lives at `settings.columnEditor.wipLimit` in the JSON. All keys are
static string literals — no template-built key names, no dynamic lookup (FR-31).

| Full dotted key | Namespace / section | English string | Interpolation | Used in |
|---|---|---|---|---|
| `settings:columnEditor.wipLimit` | `settings` / `columnEditor` | `WIP` | — | `column-editor.tsx` — visible label beside the input |
| `settings:columnEditor.wipLimitPlaceholder` | `settings` / `columnEditor` | `∞` | — | `column-editor.tsx` — input placeholder when no limit is set |
| `settings:columnEditor.wipLimitAria` | `settings` / `columnEditor` | `Work-in-progress limit for {{name}}` | `name` (column name) | `column-editor.tsx` — input `aria-label` |
| `settings:columnEditor.wipLimitTooltip` | `settings` / `columnEditor` | `Soft work-in-progress limit. The board shows an over-limit indicator; nothing is blocked.` | — | `column-editor.tsx` — group `title` |
| `settings:columnEditor.toastWipLimitUpdated` | `settings` / `columnEditor` | `WIP limit updated` | — | `column-editor.tsx` — `commitWipLimit` success, non-null |
| `settings:columnEditor.toastWipLimitCleared` | `settings` / `columnEditor` | `WIP limit cleared` | — | `column-editor.tsx` — `commitWipLimit` success, null |
| `tasks:kanban.wipLimit.withinLabel` | `tasks` / `kanban` | `{{current}} of {{limit}} tasks` | `current`, `limit` | `column-task-count-badge.tsx` — under/at cap `title` + `aria-label` |
| `tasks:kanban.wipLimit.overLabel` | `tasks` / `kanban` | `{{current}} of {{limit}} tasks, over the WIP limit` | `current`, `limit` | `column-task-count-badge.tsx` — over cap `title` + `aria-label` |

Eight new keys. **Reused, not added:** `settings:columnEditor.toastUpdateError` already exists (used
by `handleToggleFinal` and `handleUpdateIcon`) and covers the WIP failure path — do not add a
`toastWipLimitError`.

### 8.1 Interpolation variable naming — deliberate

The variables are `current` and `limit`, **not** `count`. In i18next, `count` is a magic option that
triggers plural resolution and requires `_one` / `_other` suffixed sibling keys; supplying it against
a non-pluralized key produces fallback behavior that varies by locale and is a classic mechanical
failure. `current`/`limit` are ordinary interpolations with no special handling. Do not rename them
to `count`.

### 8.2 Execution notes for the i18n packets

1. Edit `i18n/en-US.json` only. **Preserve the file's TAB indentation** — the file is tab-indented
   (verified at `i18n/en-US.json:1-40`); writing spaces will produce an enormous spurious diff and
   fail Biome.
2. Insert the six `columnEditor.*` keys inside the existing `settings.columnEditor` object,
   alongside `doneColumn`, `markDoneAria`, `toastUpdateError`, etc. Insert the `kanban.wipLimit`
   object inside the existing `tasks.kanban` object, alongside `addTask`.
3. Run `pnpm i18n:check:fix` to backfill the 17 sibling locales with the English placeholder — this
   is the repo's own intended flow (OQ-4, resolved). **Do not hand-author translations**; do not
   machine-translate.
4. Run `pnpm i18n:schema` to regenerate `i18n/schema.json` if the new keys change it.
5. Verify with `pnpm i18n:check` (non-writing) — must report clean.
6. Confirm the exact script names in the root `package.json` before invoking; if `i18n:check:fix`
   does not exist, use the documented `--fix` flag form of `i18n:check`.
7. `i18n/resources.ts` needs **no change** — it imports whole locale files by name and no new locale
   file is created. It is also outside the `i18n/*.json` allowlist glob, which confirms the
   expectation.

---

## 9. Test plan

Baseline that must stay green and **unmodified**: API 374 tests, web 112 tests (FR-36, AC-9). No
existing test file is edited. Integration tests (`tests/api-integration`, needs Postgres) are out of
the write contract and are not run.

Runner facts the executor must respect:

- **API** — `apps/api/vitest.config.ts`: `environment: "node"`, `include: ["../../tests/api/**/*.test.ts"]`.
  No setup file, **no database**. The default `db` export from `apps/api/src/database` is a lazy
  `Proxy` that only opens a `pg.Pool` on first property access, so importing a controller is safe;
  *calling* one is not, unless `db` is mocked.
- **Web** — `apps/web/vitest.config.ts`: `environment: "jsdom"`,
  `setupFiles: ["./src/test/setup.ts"]` (which contains exactly
  `import "@testing-library/jest-dom/vitest";` — **no i18next init, no QueryClient, no router**),
  `include: ["src/**/*.test.{ts,tsx}"]`, aliases `@` → `apps/web/src` and `@i18n` → repo-root `i18n`.
- Neither vitest config is in the write contract, and **neither needs a change** — both existing
  globs already cover every new test path below.

### 9.1 `tests/api/column/wip-limit-validator.test.ts` — NEW

Imports `wipLimitSchema` from `../../../apps/api/src/column/validators` and `* as v from "valibot"`.
Pull no DB, no Hono app. Assert through a wrapper object so the test mirrors real route usage:

```ts
const schema = v.object({ wipLimit: wipLimitSchema });
```

Cases:
- `v.parse(schema, { wipLimit: 3 })` → `{ wipLimit: 3 }`.
- `v.parse(schema, { wipLimit: 1 })` → `{ wipLimit: 1 }` (lower boundary accepted).
- `v.parse(schema, { wipLimit: null })` → `{ wipLimit: null }`.
- `v.parse(schema, {})` → `wipLimit` is `undefined` (omission is legal on both verbs).
- `expect(() => v.parse(schema, { wipLimit: 0 })).toThrow()`.
- `expect(() => v.parse(schema, { wipLimit: -1 })).toThrow()`.
- `expect(() => v.parse(schema, { wipLimit: 2.5 })).toThrow()`.
- `expect(() => v.parse(schema, { wipLimit: "3" })).toThrow()`.
- `expect(() => v.parse(schema, { wipLimit: true })).toThrow()`.
- `expect(() => v.parse(schema, { wipLimit: Number.NaN })).toThrow()`.

Use `v.safeParse` if a non-throwing assertion reads better, but `toThrow()` is sufficient and
matches the DB-free, dependency-free style of `tests/api/column/to-slug.test.ts`.

### 9.2 `tests/api/column/wip-limit-persistence.test.ts` — NEW

Covers FR-8 (insert), FR-6 (conditional `.set()`), and FR-1/FR-9 (drizzle column metadata + the
select-all guarantee). Mocks the database module.

**Use `vi.hoisted()`.** `vi.mock` factories are hoisted above the file's `const` declarations, so a
factory that closes over a plain `const vi.fn()` throws `Cannot access before initialization`. This
is the single most likely failure point in this file:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insertValues: vi.fn(),
  updateSet: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    query: {
      columnTable: { findFirst: mocks.findFirst },
    },
    // Both selects in createColumn (duplicate-slug probe, MAX(position) probe)
    // resolve to [] — which yields no duplicate and position 0.
    select: () => ({ from: () => ({ where: async () => [] }) }),
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        mocks.insertValues(values);
        return { returning: async () => [{ id: "col-1", ...values }] };
      },
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        mocks.updateSet(values);
        return {
          where: () => ({ returning: async () => [{ id: "col-1", ...values }] }),
        };
      },
    }),
  },
}));
```

`beforeEach` clears the three mocks and sets
`mocks.findFirst.mockResolvedValue({ id: "col-1", name: "Doing", wipLimit: 4 })`.

`describe("createColumn")` cases — import the default export from
`../../../apps/api/src/column/controllers/create-column`:
- `wipLimit: 3` → `mocks.insertValues` called with an object where `wipLimit === 3`.
- `wipLimit` omitted → called with `wipLimit === null`.
- `wipLimit: null` → called with `wipLimit === null`.
- unrelated fields still land (`slug === "doing"`, `position === 0`, `isFinal === false`) — proves
  the addition did not disturb the existing insert.

`describe("updateColumn")` cases — import the default export from
`../../../apps/api/src/column/controllers/update-column`:
- `{ wipLimit: 5 }` → `mocks.updateSet` called with an object having `wipLimit === 5`.
- `{ wipLimit: null }` → called with an object where `"wipLimit" in values` is **true** and the value
  is `null` (this is the "explicit null clears" case; assert key presence, not just value).
- `{ name: "Doing" }` → called with an object where `"wipLimit" in values` is **false** (omission
  leaves the stored value untouched).
- `{}` → `"wipLimit" in values` is false.

`describe("columnTable.wipLimit")` cases — import `{ columnTable }` from
`../../../apps/api/src/database/schema` (no mock needed; drizzle table objects are inert):
- `columnTable.wipLimit.name === "wip_limit"`.
- `columnTable.wipLimit.notNull === false`.
- `columnTable.wipLimit.hasDefault === false`.
- This triple is the FR-9 proof: `getColumns` does `db.select()` with no projection, so every column
  present on the table object is returned. Add a comment saying exactly that, so a future reader does
  not "improve" it into a DB test.

If drizzle's internal property names differ in the installed version, assert on
`getTableColumns(columnTable).wipLimit` from `drizzle-orm` instead. Verify against the installed
drizzle-orm before finalizing; do not guess.

### 9.3 `tests/api/column/wip-limit-authz.test.ts` — NEW

Guards AC-3 without a database. Imports the default Hono app from
`../../../apps/api/src/column` and inspects `column.routes`. Hono registers one entry per handler
per path, so the middleware chain is observable:

- `PUT /:id` has **at least 6** registered handlers (`describeRoute`, param validator, json
  validator, `workspaceAccess.fromColumn`, `requireWorkspacePermission`, final handler).
- `POST /:projectId` has **at least 6** registered handlers.

Use `toBeGreaterThanOrEqual`, **not** an exact equality — the assertion's job is to catch a *deleted*
guard, and an exact count would break the next legitimate middleware addition. Add a comment stating
that intent. The permission enforcement itself is unchanged by this delta; this test exists so a
future refactor cannot quietly drop it while adding WIP-limit behavior.

### 9.4 `apps/web/src/components/kanban-board/column/column-task-count-badge.test.tsx` — NEW

Beside the component, matching the `task-labels.test.tsx` idiom (`render` / `screen` / `cleanup` in
`afterEach`).

**How to handle `useTranslation` — the decision, and why.** Mock `react-i18next` at the module level
in this one file. The web test setup does **not** initialize i18next, so an unmocked `useTranslation`
returns a `t` whose behavior with interpolation is environment-dependent and would make label
assertions flaky. A module mock makes the test assert the *correct key* was chosen, which is the
actual thing worth testing:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}|${JSON.stringify(options)}` : key,
  }),
}));

import { ColumnTaskCountBadge } from "./column-task-count-badge";

afterEach(() => {
  cleanup();
});
```

**How to handle `useProjectStore` / `useWorkspacePermission` / `useUpdateTask` — the decision, and
why.** They are not handled, because they are not reachable. This is precisely why ADR-4 extracts the
badge: `ColumnTaskCountBadge` imports only `lucide-react`, `react-i18next`, and `@/lib/utils` (`cn`,
a pure `clsx`+`tailwind-merge` wrapper). It touches no store, no TanStack Query client, no router, no
permission hook, no modal. The alternative — testing `ColumnHeader` directly — would require four
module mocks (`@/store/project`, `@/hooks/use-workspace-permission`,
`@/hooks/mutations/task/use-update-task`, plus a `QueryClientProvider` for the modals) purely to
reach one `<span>`. Chosen: extract and test the pure subcomponent. Rejected: mock four hooks.

Cases:
1. **No limit — `wipLimit={null}`.** Assert `screen.getByText("7")` is visible; assert
   `screen.queryByText("7/3")` is null; assert the rendered element has
   `className === "rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"`
   (exact string equality — this is the AC-6 byte-identity guard); assert
   `element.getAttribute("data-over-limit")` is `null` and `element.getAttribute("aria-label")` is
   `null`.
2. **No limit — `wipLimit` prop omitted entirely.** Same assertions as case 1 (covers `undefined`,
   which is what an older cached payload would supply).
3. **Under cap — `count={2} wipLimit={5}`.** `getByText("2/5")` visible;
   `data-over-limit === "false"`; `aria-label` contains `tasks:kanban.wipLimit.withinLabel` and the
   serialized `{"current":2,"limit":5}`.
4. **At cap — `count={5} wipLimit={5}`.** `getByText("5/5")` visible; `data-over-limit === "false"`;
   `aria-label` uses `withinLabel`, **not** `overLabel`. This is the boundary test — at-cap is not
   over-cap.
5. **Over cap — `count={7} wipLimit={5}`.** `getByText("7/5")` visible; `data-over-limit === "true"`;
   `aria-label` contains `tasks:kanban.wipLimit.overLabel` and `{"current":7,"limit":5}`;
   `className` contains `text-destructive`.
6. **Over cap is not signalled by color alone.** Assert that the over-cap render contains an
   `svg[aria-hidden="true"]` child **and** a non-empty `aria-label`, and that the under-cap render
   contains no `svg`. This is the WCAG 1.4.1 regression guard.

Render the count/limit as a single template literal (`{`${count}/${wipLimit}`}`) so
`getByText("7/5")` matches a single text node and is not affected by the sibling icon element.

Grab the element via `screen.getByText(...)` for the no-limit cases and via
`container.querySelector("[data-over-limit]")` for the limited cases; do not add a `data-testid`.

### 9.5 Not tested, deliberately

- No test asserts that a drop is *not* blocked — proving a negative through the drag-and-drop stack
  would require mounting the whole board. The guarantee is enforced by review: §7.6's negative
  contract, verified by inspecting the diff for `wipLimit` inside any handler condition.
- No web test for `ColumnEditor`'s input. It needs `useGetColumns`, four mutation hooks, and a
  permission hook — five module mocks for interaction logic whose failure mode is a missing toast,
  not data loss. The API validator (§9.1) is the authority on what is accepted, and it *is* tested.
  Revisit only if this input regresses in practice.

### 9.6 Verification commands

Per-packet, scoped:
- `pnpm --filter @kaneo/api test`
- `pnpm --filter @kaneo/web test`
- `pnpm --filter @kaneo/api typecheck`
- `pnpm --filter @kaneo/web typecheck`
- `pnpm biome check <changed paths>` — **scoped only**. Never `pnpm lint`, which runs Biome with
  `--write` and will reformat unrelated files (AGENTS.md, and the Gate-0 known-constraints note).
- `pnpm i18n:check`

---

## 10. File-by-file change table

Ordered by dependency. "Tier" is the suggested execution tier under `opus-plus-flash-v37`.

| # | Path | New/Edit | Change | Risk | Tier |
|---|---|---|---|---|---|
| 1 | `apps/api/src/database/schema.ts` | edit | Add `wipLimit: integer("wip_limit")` to `columnTable` between `isFinal` and `createdAt` | low | mechanical |
| 2 | `apps/api/drizzle/0043_<generated>.sql` | new (tool) | drizzle-kit output: `ALTER TABLE "column" ADD COLUMN "wip_limit" integer;` | low | mechanical + human inspection |
| 3 | `apps/api/src/column/validators.ts` | new | Export `wipLimitSchema` (`v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))))`) | low | mechanical |
| 4 | `apps/api/src/column/controllers/create-column.ts` | edit | Accept `wipLimit?: number \| null`; add `wipLimit: wipLimit ?? null` to `.values()` | low | mechanical |
| 5 | `apps/api/src/column/controllers/update-column.ts` | edit | Accept `wipLimit?: number \| null`; add conditional spread to `.set()` | low | mechanical |
| 6 | `apps/api/src/column/index.ts` | edit | Import `wipLimitSchema`; add to POST + PUT json validators; destructure in POST handler; rewrite two `describeRoute` descriptions | med | premium |
| 7 | `apps/api/src/task/controllers/get-tasks.ts` | edit | One line: `wipLimit: column.wipLimit,` in the `projectColumns.map()` projection. **Only file permitted under `apps/api/src/task/`** | low | mechanical |
| 8 | `i18n/en-US.json` | edit | 8 new keys (6 under `settings.columnEditor`, 2 under `tasks.kanban.wipLimit`). Preserve TAB indentation | low | mechanical |
| 9 | `i18n/<17 locales>.json`, `i18n/schema.json` | edit (tool) | `pnpm i18n:check:fix` backfill + `pnpm i18n:schema` regen. No hand edits | low | tooling |
| 10 | `apps/web/src/fetchers/column/create-column.ts` | edit | Widen `data` with `wipLimit?: number \| null`. Type-only | low | mechanical |
| 11 | `apps/web/src/fetchers/column/update-column.ts` | edit | Widen `data` with `wipLimit?: number \| null`. Type-only | low | mechanical |
| 12 | `apps/web/src/hooks/mutations/column/use-create-column.ts` | edit | Widen mutation variable `data` type. No `onSuccess` change | low | mechanical |
| 13 | `apps/web/src/hooks/mutations/column/use-update-column.ts` | edit | Widen mutation variable `data` type. No `onSuccess` change | low | mechanical |
| 14 | `apps/web/src/components/kanban-board/column/column-task-count-badge.tsx` | new | Pure presentational badge; four states; byte-identical no-limit early return | **med** | premium |
| 15 | `apps/web/src/components/kanban-board/column/column-header.tsx` | edit | Add import; replace the lines 62–64 `<span>` with `<ColumnTaskCountBadge />`. Nothing else | **med** | premium |
| 16 | `apps/web/src/components/project/column-editor.tsx` | edit | Add `commitWipLimit` + `handleUpdateWipLimit`; insert WIP input group as first child of the row's controls div | **med** | premium |
| 17 | `tests/api/column/wip-limit-validator.test.ts` | new | 10 Valibot cases, DB-free | low | mechanical |
| 18 | `tests/api/column/wip-limit-persistence.test.ts` | new | `vi.hoisted()` db mock; create/update/schema-metadata cases | **med** | premium |
| 19 | `tests/api/column/wip-limit-authz.test.ts` | new | `column.routes` handler-count lower-bound guard on POST/PUT | low | mechanical |
| 20 | `apps/web/src/components/kanban-board/column/column-task-count-badge.test.tsx` | new | 6 cases across the four states + the a11y guard; mocks `react-i18next` only | low | mechanical |
| 21 | `.gitignore` | edit | **OPTIONAL, non-feature.** Append `.sdlc/`. See §13/§14 — `.sdlc/` is already tracked as of `845f0940`, so this packet is contradictory. Recommend skipping | low | mechanical |

**20 feature files + 1 optional housekeeping file = 21 declared paths**, plus 18 tool-generated i18n
files under row 9. Files confirmed to need **no** change despite being allowlisted:
`apps/api/src/database/relations.ts` (§2.3), `apps/web/src/types/project/index.ts` (§4.2),
`packages/libs/**` (§2.4), `apps/api/src/column/controllers/get-columns.ts` (§3.7),
`apps/web/src/components/kanban-board/column/column-dropzone.tsx` and
`.../column/index.tsx` (§7.6).

---

## 11. Sequencing & dependencies

```
P1  schema.ts  +  db:generate            [ATOMIC — never split]
      |
      +--> P2  column module (3,4,5,6)
      |          |
      |          +--> P5  web fetchers + hooks (10,11,12,13)
      |          |          |
      |          +--> P8a  API tests (17,18,19)
      |                     |
      +--> P3  get-tasks.ts (7)          |
                 |                       |
P4  i18n en-US + tooling (8,9)           |
      |          |                       |
      +----------+--> P6  badge + header (14,15)
      |                     |
      +----------+--> P7  column-editor (16)   <-- also needs P5
                            |
                     P8b  web test (20)
                            |
                     P9  .gitignore (21, OPTIONAL)
```

Rules the packet planner must honor:

1. **P1 is atomic.** The `schema.ts` edit and the generated `.sql` ship in one packet. A schema
   change without its migration is a broken deploy for every existing installation; a migration
   without its schema change is a drifted snapshot. Never split, never reorder.
2. **P2 and P3 both hard-depend on P1.** `column.wipLimit` does not exist as a TypeScript property
   until §2.1 lands, so both packets fail typecheck if run first.
3. **P5 depends on P2, not on P3.** The fetchers' `json: data` argument is checked against the Hono
   RPC type derived from the column route validators. Widening the fetcher before the validator
   produces an excess-property error.
4. **P6 depends on P3 and P4.** P3 for `ProjectWithTasks["columns"][number]["wipLimit"]`, P4 for the
   two `tasks:kanban.wipLimit.*` keys.
5. **P7 depends on P4 and P5.** P4 for the six `settings:columnEditor.*` keys, P5 for the widened
   `useUpdateColumn` variable type.
6. **P4 is otherwise independent** and can run first, in parallel with P1. Doing so removes it from
   the critical path of both UI packets.
7. **P8a/P8b run last** within their branches. Run `pnpm --filter @kaneo/api test` after P8a and
   `pnpm --filter @kaneo/web test` after P8b, then both typechecks, then scoped `biome check`, then
   `pnpm i18n:check`.
8. **P9 is optional and last.** It is unrelated to the feature and currently self-contradictory (§14).

---

## 12. Decisions (ADR-style)

### ADR-1 — Persist the limit on `columnTable`, not in a separate table

**Context.** A WIP limit is one optional small integer per column. Alternatives were a
`column_wip_limit` side table (1:0..1) or a JSON `settings` blob on the column.

**Decision.** A nullable scalar `wipLimit` on `columnTable`.

**Consequences.** One additive DDL statement, no join, no second query anywhere, and the limit
arrives free on every existing `db.select()` of `columnTable` — including `getColumns` (zero code
change) and `get-tasks.ts` (one projection line). Cascade delete comes for free with the row. The
cost is that a future multi-dimensional WIP policy (per-assignee caps, time-boxed caps) would need
either more columns or a later extraction — accepted, because the requirements explicitly rule those
out (out-of-scope items 3 and 4) and AGENTS.md says to build the smallest model that makes correct
behavior obvious. A JSON blob was rejected outright: it defeats Valibot validation, defeats RPC type
inference, and hides the field from the schema.

### ADR-2 — Surface the limit on the existing tasks payload, not via a second board query

**Context.** The lane header reads `ProjectWithTasks["columns"][number]`, inferred from
`GET /task/tasks/:projectId`, whose handler projects an explicit field subset. That handler lives
under `apps/api/src/task/`, originally outside the write contract (OQ-1). The alternative was to keep
the contract untouched and have the board additionally call `useGetColumns(projectId)`, joining
limits onto lanes client-side.

**Decision.** Add `wipLimit` to the `projectColumns.map()` projection in `get-tasks.ts`, under a
single-file carve-out in the write contract. Option A from OQ-1.

**Consequences.** One additive line, in the same projection that already carries `icon` and
`isFinal`, satisfies NFR-3 (no extra request per board mount) and keeps one source of truth for a
lane's data. The rejected option would have introduced two independently-cached sources for the same
lane, which can render a stale limit against a fresh count during the window between the two
queries' invalidations — a visible, hard-to-reproduce bug for a purely cosmetic feature. The
consequence to manage is that the write contract now permits one file under `apps/api/src/task/`;
the plan constrains that to exactly one line, and the diff must be checked against that.

### ADR-3 — Soft indicator, not enforcement

**Context.** WIP limits in kanban tooling range from advisory to hard-blocking. Blocking would mean
gating drop targets, rejecting `PUT /task/:id` status changes with a `409`, or toasting on the
crossing.

**Decision.** Purely advisory. The API never rejects on cap. No handler anywhere gains a `wipLimit`
condition. No toast fires when a lane crosses its cap.

**Consequences.** Zero risk to the drag-and-drop stack, to task creation, to the archive-all path, or
to the MCP/API-key/webhook surfaces — none of which are touched. It also means the limit is a
*signal*, not a *control*: teams can and will exceed it, and the product's answer is a red badge. Any
future enforcement is a separate decision with its own risk budget, and would need to answer what
happens to an over-cap lane created by a bulk import, by a workflow rule, or by a Gitea/GitHub column
resolver — all of which currently move tasks without any UI in the loop. Rejected: hard enforcement,
which the interview explicitly ruled out. The negative contract in §7.6 is the enforceable form of
this decision.

### ADR-4 — Extract the badge into its own component

**Context.** The over-cap state could live inline in `ColumnHeader`. `ColumnHeader` depends on
`useTranslation`, `useProjectStore`, `useUpdateTask`, `useWorkspacePermission`, `CreateTaskModal`, and
`ArchiveTasksModal`. Testing the four badge states through it requires four module mocks plus a
`QueryClientProvider`, and the web test setup file provides none of that (it is one line:
`import "@testing-library/jest-dom/vitest"`).

**Decision.** Extract `ColumnTaskCountBadge` into
`apps/web/src/components/kanban-board/column/column-task-count-badge.tsx` — a pure function of
`{ count, wipLimit }` whose only imports are `lucide-react`, `react-i18next`, and `cn`. Test that
directly, mocking only `react-i18next`.

**Consequences.** The four states become cheaply and reliably testable, matching the existing
`task-labels.test.tsx` idiom of testing a presentational component in isolation. `ColumnHeader`'s
diff shrinks to one import plus one three-line replacement, which makes the AC-6 byte-identity review
trivial. The cost is one more file in a directory that currently has three, and one more indirection
when reading the header. Accepted: the alternative concentrates untestable branching inside a
six-dependency component, which is how a "renders exactly as today" regression ships unnoticed.
Rejected: `useState`-free inline ternary in `ColumnHeader`.

### ADR-5 — Extract the Valibot fragment to `apps/api/src/column/validators.ts`

**Context.** The column module declares its validators inline in `index.ts`. The `tests/api/**` suite
is node-env and DB-free; importing the Hono app to reach an inline schema is possible but couples the
validation test to route wiring, middleware imports, and the permissions package.

**Decision.** Export a single named `wipLimitSchema` from a new `validators.ts` and reference it from
both the POST and PUT json validators.

**Consequences.** The eight invalid-input cases in §9.1 become a dependency-free unit test, and the
create and update verbs are guaranteed to share one definition — they cannot drift. The cost is one
new file and a mild inconsistency with the module's inline style. Scope is explicitly capped: only
`wipLimitSchema` moves. Migrating `name`/`icon`/`color`/`isFinal` into the same file would be an
unrelated refactor and is forbidden by NFR-8.

### ADR-6 — Uncontrolled input with commit-on-blur, not controlled state

**Context.** The editor row could hold a `Record<columnId, string>` draft state and commit on a
debounce, or stay uncontrolled with `defaultValue` and commit on blur/Enter.

**Decision.** Uncontrolled `defaultValue={col.wipLimit ?? ""}`, commit on blur and on Enter (Enter
routed through `blur()` so there is one code path), no `onChange`. Invalid input is reverted by
writing `input.value` synchronously in the blur handler.

**Consequences.** Exactly mirrors the name input three lines above it, so the row has one interaction
grammar rather than two. No debounce timer, no draft-state map, no per-keystroke mutation traffic on
a board with many columns. The cost is the `e.currentTarget` capture hazard called out in §6.3 — the
handler must stay synchronous, which is why `commitWipLimit` is a separate `async` function invoked
with `void`. Rejected: controlled state with a debounce, which adds a state map, a timer, and a
cleanup path to set one integer.

---

## 13. Risks & non-goals

### Top risk — the no-limit rendering path regresses (AC-6, FR-25)

Every existing column in every existing installation has `wipLimit === null`. If the no-limit branch
produces even a different class *order*, an extra `title`, or a `data-over-limit="false"` attribute,
the entire installed base ships a DOM change for a feature nobody enabled. Mitigations, all three
required: the early return in §7.1 (not a `cn()` ternary); the verbatim class string copied from
`column-header.tsx:62`; and the exact-string `className` assertion in §9.4 case 1. Review the
`column-task-count-badge.tsx` diff against the original `<span>` character by character.

### Other risks

| Risk | Mitigation |
|---|---|
| `vi.mock` factory closes over a non-hoisted `const` → `Cannot access before initialization` | §9.2 mandates `vi.hoisted()`. Highest-probability mechanical failure in the plan. |
| `e.currentTarget` is null after an `await` → the invalid-input revert silently no-ops | §6.3: handler stays synchronous, element passed by argument, `commitWipLimit` split out. |
| i18next `count` magic option triggers plural fallback | §8.1: interpolation vars are `current`/`limit`, never `count`. |
| `i18n/en-US.json` rewritten with spaces instead of tabs → huge spurious diff, Biome failure | §8.2 step 1. Verify the diff is 8 added lines, not thousands. |
| drizzle-kit writes `apps/api/drizzle/meta/**`, which is off-limits to the agent | **Escalation E-1.** Without the `_journal.json` entry the migration never runs on existing installs. |
| RPC type inference appears stale in the editor → executor "fixes" it by hand-editing `apps/web/src/types/project/index.ts` | §4.2 states no type edit is needed and gives the chain. Re-run `typecheck` before editing types. |
| `pnpm lint` runs Biome with `--write` and reformats unrelated files | §9.6: scoped `pnpm biome check <paths>` only. |
| Drizzle column-metadata property names (`notNull`, `hasDefault`) differ by version | §9.2 offers `getTableColumns()` as the fallback; verify against the installed drizzle-orm rather than guessing. |
| `type="number"` yields `""` for `"abc"`, hitting the clear branch | Documented and accepted in §6.3 as native semantics; the `Number.isInteger` guard still catches `0`, `-1`, `2.5`. |
| Scope creep into the column module or the board while editing them | NFR-8; §3.1, §6.4, §7.5 each enumerate what must **not** change. |

### Non-goals — deliberately not done

No hard enforcement of any kind. No inline WIP editing from the lane header. No WIP field on the
"add column" form. No workspace- or project-level default limits and no templates. No analytics,
history, activity entries, notifications, or `publishEvent()` calls. No WebSocket message and no
Redis fan-out change. No changes to `workflowRuleTable`, the Gitea/GitHub column resolvers, MCP
tools, API keys, webhooks, or task import/export. No backfill onto existing columns. No index on
`wip_limit`. No board performance refactor. No `apps/docs` / `apps/site` / `charts` documentation
update (all off-limits; note as follow-up). No migration of the column module's other validators.

---

## 14. Escalations

### E-1 (BLOCKER for AC-1) — `apps/api/drizzle/meta/**` must be writable by the generator

`pnpm --filter @kaneo/api db:generate` writes three things: the new `0043_*.sql`, a new
`apps/api/drizzle/meta/0043_snapshot.json`, and an appended entry in
`apps/api/drizzle/meta/_journal.json`. `apps/api/drizzle/meta/**` is on the off-limits list.

This is not cosmetic. Drizzle's migrator reads `meta/_journal.json` to decide which SQL files to
execute. A `0043_*.sql` with no journal entry **never runs** — the column is added to the dev schema
but never to any real database, and FR-2 / AC-1 silently fail while every test still passes.

Resolution required before P1 executes. Pick one:

- **Preferred.** Confirm that `apps/api/drizzle/meta/**` is off-limits to *hand-editing* only, and
  that writes produced by the repo's own `db:generate` command are permitted. This matches the
  constraint's stated intent and the existing repo convention in AGENTS.md ("Generate migrations with
  `pnpm --filter @kaneo/api db:generate`, inspect the SQL, and include it with the schema change").
- **Fallback.** Amend the allowlist with `apps/api/drizzle/meta/**` restricted to generator output,
  with a review gate on the diff (expected: one new snapshot file, one appended journal array entry,
  no edits to prior entries).

Do **not** hand-author the SQL and leave the journal alone. That is a silent production bug.

### E-2 (advisory) — `.gitignore` packet is self-contradictory

The Gate-0 contract allows appending `.sdlc/` to `.gitignore`, but commit `845f0940`
("chore(sdlc): add AI-SDLC run artifacts and benchmark records") already tracks `.sdlc/`. Adding it
to `.gitignore` will not untrack the existing files, will not stop them from being committed, and
will confuse the next reader. It is also unrelated to this feature. **Recommend dropping packet 21.**
If the intent is genuinely to stop tracking run artifacts, that is a separate `git rm --cached`
decision that belongs in its own commit, not in a WIP-limit feature.

### E-3 (advisory) — user documentation is out of reach

AGENTS.md's "Follow a change through" checklist includes user documentation, but `apps/docs/**` and
`apps/site/**` are off-limits. A user-visible board feature normally warrants a docs line. Recorded
as a follow-up rather than a scope expansion; the run should report it as deliberately deferred.

### E-4 (resolved, no action) — OQ-2 and OQ-3

- **OQ-2** is resolved by the confirmed contract: the i18n root is `i18n/*.json` at the repo root,
  which covers `en-US.json`, the 17 sibling locales, and `schema.json`. `apps/web/src/i18n/` does not
  exist and is not needed. `i18n/resources.ts` needs no change (§8.2 step 7).
- **OQ-3** is resolved: `apps/web/src/lib/column.tsx` (not `.ts`) is off-limits and this plan does
  **not** need it. `getColumnIcon` is imported by `column-header.tsx` and `column-editor.tsx` and
  called with unchanged arguments; icon resolution is untouched by the WIP indicator. No escalation.

### E-5 (resolved, no action) — vitest configs

Neither `apps/web/vitest.config.ts` (`include: ["src/**/*.test.{ts,tsx}"]`) nor
`apps/api/vitest.config.ts` (`include: ["../../tests/api/**/*.test.ts"]`) needs a change. All four
new test paths in §9 are already covered by the existing globs, and both configs are outside the
write contract. Verified, not assumed.

# Change Plan — Per-column WIP limit with over-cap indicator

- Run: `20260903-094517-feature-extend-column-wip-limit`
- Mode: brownfield · Intent: `feature-extend` (delta `change_plan.md`)
- Inputs: `requirements.md` (authoritative), `intent_brief.md`, `AGENTS.md`
- Gate 1 decisions treated as fixed: **OQ-1 = (a)**, **OQ-2 = mini-gate only**, **OQ-3 = English fallback accepted**

---

## 1. Summary

`columnTable` gains one nullable scalar, `wipLimit`. The column create and update routes accept
it under Valibot; `getColumns` already selects the whole row so it flows out untouched. The web
data layer widens four type literals to carry it. Project settings gets a small numeric input per
column row; the authenticated board's `ColumnHeader` renders `count/limit` and an over-cap badge.

What does **not** change: no enforcement anywhere (no rejected move, no drag block, no 409), no new
permission verb, no new dependency, no new abstraction layer, no change to `get-columns.ts`,
`use-get-columns.ts`, `relations.ts`, `delete-column.ts`, `reorder-columns.ts`,
`kanban-board/column/index.tsx`, `apps/web/src/components/board/**`,
`apps/web/src/components/public-project/**`, or any existing test.

The one structural consequence of the frozen write contract: the board's task count and the WIP
limit arrive from two different queries. Section 8 handles that head-on.

---

## 2. Change inventory

Every path below is inside the frozen allowlist:
`apps/api/src/database/schema.ts`, `apps/api/drizzle/**`, `apps/api/src/column/**`,
`apps/web/src/fetchers/column/**`, `apps/web/src/hooks/mutations/column/**`,
`apps/web/src/hooks/queries/column/**`, `apps/web/src/components/kanban-board/column/**`,
`apps/web/src/components/project/column-editor.tsx`, `i18n/en-US.json`, `tests/api/**`,
`apps/web/src/**/*.test.tsx`, `apps/web/src/**/*.test.ts`.

| # | Path | New / Edited | Change | FR |
| --- | --- | --- | --- | --- |
| 1 | `apps/api/src/database/schema.ts` | edited (`patch_apply`) | one line added to `columnTable`: `wipLimit: integer("wip_limit"),` | FR-1 |
| 2 | `apps/api/drizzle/0043_<drizzle-generated-name>.sql` | new (tool-generated) | `ALTER TABLE "column" ADD COLUMN "wip_limit" integer;` | FR-2, FR-3 |
| 3 | `apps/api/drizzle/meta/0043_snapshot.json` | new (tool-generated) | drizzle snapshot for migration 0043 | FR-2 |
| 4 | `apps/api/drizzle/meta/_journal.json` | edited (tool-generated) | one appended journal entry for 0043 | FR-2 |
| 5 | `apps/api/src/column/index.ts` | edited (`patch_apply`) | `wipLimit` added to the POST and PUT json validators; destructure + pass through in the POST handler | FR-5, FR-6, FR-7, FR-8, FR-9 |
| 6 | `apps/api/src/column/controllers/create-column.ts` | edited (`patch_apply`) | `wipLimit?: number` param; `wipLimit: wipLimit ?? null` in `.values()` | FR-10 |
| 7 | `apps/api/src/column/controllers/update-column.ts` | edited (`patch_apply`) | `wipLimit?: number \| null` in `data`; one spread line in `.set()` | FR-11 |
| 8 | `apps/web/src/fetchers/column/create-column.ts` | edited (`patch_apply`) | `data` type gains `wipLimit?: number` | FR-14 |
| 9 | `apps/web/src/fetchers/column/update-column.ts` | edited (`patch_apply`) | `data` type gains `wipLimit?: number \| null` | FR-14 |
| 10 | `apps/web/src/hooks/mutations/column/use-create-column.ts` | edited (`patch_apply`) | mutation `data` type gains `wipLimit?: number` | FR-15 |
| 11 | `apps/web/src/hooks/mutations/column/use-update-column.ts` | edited (`patch_apply`) | mutation `data` type gains `wipLimit?: number \| null`; **`onSuccess` untouched** | FR-15, FR-16 |
| 12 | `apps/web/src/components/kanban-board/column/column-header.tsx` | edited (`existing_file_edit`) | `useGetColumns` lookup by slug; three-state count badge | FR-23, FR-24, FR-25, FR-26, FR-27 |
| 13 | `apps/web/src/components/project/column-editor.tsx` | edited (`existing_file_edit`) | `handleUpdateWipLimit` + numeric `Input` in each column row | FR-18, FR-19, FR-20, FR-21, FR-22 |
| 14 | `i18n/en-US.json` | edited (`patch_apply`) | 6 keys under `settings.columnEditor`, 2 under `tasks.kanban` | FR-28, FR-29 |
| 15 | `tests/api/column/create-column-wip-limit.test.ts` | new | controller unit tests for `createColumn` | FR-31 |
| 16 | `tests/api/column/update-column-wip-limit.test.ts` | new | controller unit tests for `updateColumn` | FR-31 |
| 17 | `tests/api/column/wip-limit-validation.test.ts` | new | route-level Valibot 400/200 tests | FR-5, FR-6, FR-7 |
| 18 | `apps/web/src/components/kanban-board/column/column-header.test.tsx` | new | three indicator states + strict boundary | FR-32 |

### Verified-not-edited (state this explicitly in the packet notes)

| Path | Why no edit |
| --- | --- |
| `apps/api/src/column/controllers/get-columns.ts` | `db.select()` with no projection — `wipLimit` flows out the moment FR-1 lands (FR-12) |
| `apps/api/src/database/relations.ts` | `wipLimit` is a scalar, not a relation (FR-4) |
| `apps/api/src/column/controllers/delete-column.ts`, `reorder-columns.ts` | untouched by this feature (FR-13) |
| `apps/web/src/fetchers/column/get-columns.ts` | returns `response.json()`; type is inferred |
| `apps/web/src/hooks/queries/column/use-get-columns.ts` | return type inferred from the fetcher (FR-17) |
| `apps/web/src/components/kanban-board/column/index.tsx` | the query lives in `ColumnHeader`; no prop threading needed (see §7) |
| `apps/web/src/types/project/index.ts` | `ProjectWithTasks` is derived from the tasks response, which is unchanged |

### Blocked / needs mini-gate

1. **`i18n/schema.json` — outside the allowlist, and it is strict.** Confirmed at
   `i18n/schema.json:6`: the root object is `"additionalProperties": false`, and every nested
   object repeats it. Adding `settings.columnEditor.wipLimit*` and `tasks.kanban.wipLimit*` to
   `en-US.json` makes `en-US.json` fail validation against `schema.json` until the schema is
   regenerated. `schema.json` is a **generated** artifact: root `package.json` exposes
   `"i18n:schema": "node ./scripts/i18n/schema.mjs && biome format --write i18n/schema.json"`.
   - It is **not** part of this run's verification gate — none of `pnpm --filter @kaneo/api test`,
     `pnpm --filter @kaneo/web test`, either `typecheck`, or `pnpm exec biome ci .` reads it.
   - **Mini-gate item:** the run stops and reports that the user should run `pnpm i18n:schema`
     (and, if they want translation coverage, `pnpm i18n:check`) before committing. Codegen must
     **not** write `i18n/schema.json`. This is OQ-2 resolving to "raise, do not patch".
2. **`apps/api/src/task/controllers/get-tasks.ts` — outside the allowlist, and stays that way.**
   This is OQ-1(b), rejected at Gate 1. Do not add it to the allowlist, do not edit it, do not
   propose a projection change. Section 8 is the design that makes (a) correct.
3. **The 17 non-English locale files — off-limits (OQ-3).** `pnpm i18n:check` will report the new
   keys as missing there. That is expected and accepted; i18next falls back to English. Do not
   run `pnpm i18n:check:fix`, which writes those files.

---

## 3. Data-layer changes

### 3.1 Drizzle column definition

`integer` is already imported in `apps/api/src/database/schema.ts` (it backs `position`), so no
import edit. Insert one line into `columnTable` between `isFinal` and `createdAt`
(`apps/api/src/database/schema.ts:359`):

```ts
    isFinal: boolean("is_final").default(false).notNull(),
    wipLimit: integer("wip_limit"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
```

Nullable, no `.notNull()`, no `.default()`. Do not touch the table's index tuple —
`index("column_projectId_idx").on(table.projectId)` is unchanged. No new index: `wip_limit` is
never a filter or sort key; it is read as part of the full-row select the board already performs.

### 3.2 Migration

**The migration is produced by `pnpm --filter @kaneo/api db:generate` and is never hand-written.**
The codegen packet runs the command and commits whatever drizzle-kit emits. Drizzle picks the
migration's random suffix; do not invent a filename.

Expected artifacts:

- `apps/api/drizzle/0043_<generated-name>.sql` containing exactly one statement:
  ```sql
  ALTER TABLE "column" ADD COLUMN "wip_limit" integer;
  ```
- `apps/api/drizzle/meta/0043_snapshot.json` (new)
- `apps/api/drizzle/meta/_journal.json` (one appended entry, `idx: 43`)

**Inspection gate before the packet is accepted (FR-2, AC-1):** the `.sql` file must contain no
`NOT NULL`, no `DEFAULT`, no `DROP`, no `ALTER COLUMN`, no `CREATE TABLE`, and no statement
touching any table other than `"column"`. If drizzle emits anything else, stop — it means the
working tree contained an unrelated uncommitted schema drift, and that must be resolved first.

**Migrations `0000`–`0042` are immutable.** They are not read, edited, renamed, or reordered.
`0042_previous_the_executioner.sql` is the last pre-existing migration.

### 3.3 Migration safety (NFR-5)

`ADD COLUMN <name> integer` with no `DEFAULT` and no `NOT NULL` is a catalog-only change in
PostgreSQL: no table rewrite, no backfill, no long lock. It takes a brief `ACCESS EXCLUSIVE` lock
to update `pg_attribute` and returns. Existing rows read back `wip_limit = NULL` →
`wipLimit: null` in Drizzle → the board renders the bare count exactly as at HEAD (AC-1). Correct
for a populated production install, not just a fresh dev database.

### 3.4 Why `relations.ts` needs no change

`columnTableRelations` declares the `project` and `tasks` edges. `wipLimit` is a scalar attribute
on the row, so `db.query.columnTable.findFirst` and `db.select()` both pick it up from the table
definition alone. FR-4 satisfied by doing nothing.

---

## 4. API contract changes

No new route. No removed route. No changed status codes. No changed authorization.

### 4.1 `POST /column/:projectId`

Valibot json validator in `apps/api/src/column/index.ts` — add the last line:

```ts
    validator(
      "json",
      v.object({
        name: v.string(),
        icon: v.optional(v.string()),
        color: v.optional(v.string()),
        isFinal: v.optional(v.boolean()),
        wipLimit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
      }),
    ),
```

Handler destructure and pass-through:

```ts
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

Not nullable on create: absence *is* "no limit". Adding `v.nullable` here would create a second
spelling for the same state with no caller that needs it.

### 4.2 `PUT /column/:id`

```ts
    validator(
      "json",
      v.object({
        name: v.optional(v.string()),
        icon: v.optional(v.nullable(v.string())),
        color: v.optional(v.nullable(v.string())),
        isFinal: v.optional(v.boolean()),
        wipLimit: v.optional(
          v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))),
        ),
      }),
    ),
```

`v.optional(v.nullable(...))` exactly mirrors the existing `icon` / `color` convention two lines
above it: `null` clears, omitted leaves untouched. The handler already does
`const data = c.req.valid("json"); await updateColumn(id, data);` — **no handler edit on PUT.**

### 4.3 OpenAPI implication (FR-9)

`hono-openapi` derives the request-body schema from the `validator("json", …)` Valibot object, so
adding the field to the validator *is* the OpenAPI change; nothing in `describeRoute` needs to
move. Both routes keep `resolver(v.any())` for their 200 responses — this run does not regress
that and does not expand it. The `description` strings ("Create a new column in a project",
"Update a column") remain accurate and are left byte-identical.

### 4.4 Authorization — explicitly unchanged (FR-8, AC-2)

The middleware lines are byte-for-byte identical to HEAD:

```ts
    workspaceAccess.fromProject("projectId"),          // POST /column/:projectId
    requireWorkspacePermission({ project: ["update"] }),
```
```ts
    workspaceAccess.fromColumn("id"),                  // PUT /column/:id
    requireWorkspacePermission({ project: ["update"] }),
```
```ts
    workspaceAccess.fromProject("projectId"),          // GET /column/:projectId
```

No new permission verb enters `@kaneo/permissions`. No duplicated role check. The web-side
`canManageProjects()` gate in the editor is a convenience only; the API remains the authority
(AGENTS.md).

### 4.5 Examples

**Set a limit**

```http
PUT /column/col_7fq2 HTTP/1.1
Content-Type: application/json

{ "wipLimit": 5 }
```
```http
200 OK
{ "id": "col_7fq2", "projectId": "prj_1", "name": "In Progress", "slug": "in-progress",
  "position": 1, "icon": "Timer", "color": null, "isFinal": false, "wipLimit": 5,
  "createdAt": "...", "updatedAt": "..." }
```

**Clear a limit**

```http
PUT /column/col_7fq2
{ "wipLimit": null }
```
```http
200 OK
{ ..., "wipLimit": null }
```

**Reject invalid input** — `0`, `-1`, `2.5`, `"5"` all fail the pipe and return the framework's
existing validation response. No new `HTTPException` site, no new error type (FR-7).

```http
PUT /column/col_7fq2
{ "wipLimit": 0 }
```
```http
400 Bad Request
```

**Leave untouched** — `PUT /column/col_7fq2` with `{ "name": "Doing" }` does not include
`wipLimit` in the `.set()` object; the stored value survives.

**Create with a limit** — `POST /column/prj_1` with `{ "name": "Doing", "wipLimit": 3 }` →
`200` with `"wipLimit": 3`. Omitting the field → `"wipLimit": null`.

---

## 5. Controller changes

### 5.1 `apps/api/src/column/controllers/create-column.ts`

Signature (add one destructured name and one type member):

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
  wipLimit?: number;
}) {
```

Insert values (add one line):

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

> **Trap — do not copy the neighbouring idiom.** The two lines above use `icon || null` /
> `color || null`, which is correct for strings (empty string means "unset"). Using
> `wipLimit || null` here would be wrong in kind: it maps every falsy number to `null`. The
> validator already rejects `0`, so `||` and `??` happen to agree today — which is exactly why a
> reviewer would not catch it, and why a later relaxation of `minValue(1)` would silently break.
> Use `??`. The distinction this controller must preserve is **absent vs. set**, not
> **empty vs. non-empty**.

Everything else in this file — `toSlug`, the reserved-slug 409, the duplicate-slug 409, the
`MAX(position)` query, the 500 fallback — is untouched. `toSlug` stays exported (its existing test
at `tests/api/column/to-slug.test.ts` imports it).

### 5.2 `apps/api/src/column/controllers/update-column.ts`

Type (add one member):

```ts
  data: {
    name?: string;
    icon?: string | null;
    color?: string | null;
    isFinal?: boolean;
    wipLimit?: number | null;
  },
```

Set object (add one line, using the file's existing spread idiom verbatim):

```ts
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.icon !== undefined && { icon: data.icon }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.isFinal !== undefined && { isFinal: data.isFinal }),
      ...(data.wipLimit !== undefined && { wipLimit: data.wipLimit }),
    })
```

`!== undefined` is load-bearing: `null` is a legitimate value that must reach the `.set()` (clear),
while `undefined` must be absent from the object (leave untouched). The 404-if-missing guard and
the 500 fallback are unchanged. No `publishEvent()` call is added — a WIP-limit change is column
configuration, not task activity, and the existing `useUpdateColumn` invalidation already refreshes
open boards (§6, AC-5).

### 5.3 `apps/api/src/column/controllers/get-columns.ts` — no edit, confirmed

```ts
  const columns = await db
    .select()
    .from(columnTable)
    .where(eq(columnTable.projectId, projectId))
    .orderBy(asc(columnTable.position));
```

`db.select()` with no projection argument selects every column of `columnTable`. The moment FR-1
lands, `wipLimit` is in the returned rows and in the inferred return type, which propagates through
`@kaneo/libs` to `useGetColumns`. **This file is verified, not edited** (FR-12). A codegen packet
that touches it is wrong.

---

## 6. Web data-layer changes

### 6.1 `apps/web/src/fetchers/column/create-column.ts`

```ts
async function createColumn(
  projectId: string,
  data: {
    name: string;
    icon?: string;
    color?: string;
    isFinal?: boolean;
    wipLimit?: number;
  },
) {
```
Body unchanged — `json: data` already passes everything through to the typed client.

### 6.2 `apps/web/src/fetchers/column/update-column.ts`

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

### 6.3 `apps/web/src/hooks/mutations/column/use-create-column.ts`

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
        wipLimit?: number;
      };
    }) => createColumn(projectId, data),
```
`onSuccess` (blanket `invalidateQueries({ refetchType: "all" })`) is untouched.

### 6.4 `apps/web/src/hooks/mutations/column/use-update-column.ts`

```ts
      data: {
        name?: string;
        icon?: string | null;
        color?: string | null;
        isFinal?: boolean;
        wipLimit?: number | null;
      };
```

**The `onSuccess` block is preserved verbatim and must not be rewritten (FR-16, AC-5).** It
already does exactly what this feature needs:

```ts
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["columns", variables.projectId],
          refetchType: "all",
        }),
        queryClient.invalidateQueries({
          queryKey: ["tasks", variables.projectId],
          refetchType: "all",
        }),
      ]);
    },
```

`["columns", projectId]` is the exact key `useGetColumns` registers, and `["tasks", projectId]` is
the board's key. Setting or clearing a limit in the editor therefore refreshes an open board with
no manual reload. AC-5 is satisfied by *not* touching this code.

### 6.5 `apps/web/src/hooks/queries/column/use-get-columns.ts` — no edit, confirmed

```ts
export function useGetColumns(projectId: string) {
  return useQuery({
    queryKey: ["columns", projectId],
    queryFn: () => getColumns(projectId),
    enabled: !!projectId,
  });
}
```

The return type is fully inferred from `getColumns` → `client.column[":projectId"].$get` →
the API's route types. `wipLimit` arrives with no code change (FR-17). The web typecheck
(`pnpm --filter @kaneo/web typecheck`) reading `col.wipLimit` **without a cast** is the end-to-end
proof for AC-3.

---

## 7. Column-header design

### 7.1 Where the query lives — `ColumnHeader`, not `column/index.tsx`

**Decision: the `useGetColumns` call goes inside `column-header.tsx`.**

Justification:
1. `ColumnHeader` is the only consumer. Putting the query in `column/index.tsx` means adding a
   prop, widening `ColumnProps`, and editing two files to deliver one number — extra surface for
   zero benefit.
2. TanStack Query deduplicates by key. `["columns", projectId]` is already subscribed by
   `TaskCardContextMenuContent` and `TaskStatusPopover` inside this same tree, so N mounted
   `ColumnHeader`s produce **zero** additional network requests (NFR-4). Hoisting to the parent
   would not save a fetch; it would only move a hook call.
3. It matches the established local pattern: `task-card-context-menu-content.tsx:52` calls
   `useGetColumns` at the leaf and reconciles with `useProjectStore` there.
4. `column/index.tsx` stays untouched, which keeps the diff smaller (AGENTS.md: smallest change
   that makes correct behavior obvious).

### 7.2 Derivation

```tsx
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import { cn } from "@/lib/utils";

  const { data: columnsData } = useGetColumns(project?.id ?? "");
  const wipLimit =
    columnsData?.find((entry) => entry.slug === column.slug)?.wipLimit ?? null;
  const taskCount = column.tasks.length;
  const isOverCap = wipLimit !== null && taskCount > wipLimit;
```

- `project` already exists in this component (`const { project, setProject } = useProjectStore()`).
- `useGetColumns` is `enabled: !!projectId`, so `""` is a no-op, not a bad request.
- The slug match is safe: `apps/api/src/task/controllers/get-tasks.ts:224` sets both
  `id: column.slug` and `slug: column.slug`, so `column.slug` exists on
  `ProjectWithTasks["columns"][number]`. Match on `slug`, not on `id` — `id` on the board object is
  the slug, while `id` on the `useGetColumns` row is the cuid. Matching those two would always
  fail, silently and invisibly. This is the single most likely codegen mistake in this file.
- `?? null` collapses "query not resolved", "column not found by slug", and "limit is null" into
  one value. There is exactly one no-indicator branch (FR-27).
- `>` not `>=`. `taskCount === wipLimit` is **at** the cap, not over it (AC-4 boundary).

No `isLoading` / `isError` destructuring. Reading them would only let the component render
something other than the fallback, which FR-27 forbids.

### 7.3 The three render states

Replace only the existing count badge (`column-header.tsx:62-64`). Everything else in the file —
the icon span, the name span, the archive button, the add button, `CreateTaskModal`,
`ArchiveTasksModal`, `handleConfirmArchive` — is unchanged.

```tsx
        {wipLimit === null ? (
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            {taskCount}
          </span>
        ) : (
          <span
            className={cn(
              "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
              isOverCap
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground",
            )}
            title={
              isOverCap
                ? t("tasks:kanban.wipLimitOverCap", { taskCount, limit: wipLimit })
                : t("tasks:kanban.wipLimitTitle", { taskCount, limit: wipLimit })
            }
          >
            {isOverCap && <TriangleAlert className="h-3 w-3" aria-hidden="true" />}
            {`${taskCount}/${wipLimit}`}
            {isOverCap && (
              <span className="sr-only">
                {t("tasks:kanban.wipLimitOverCap", { taskCount, limit: wipLimit })}
              </span>
            )}
          </span>
        )}
```

| State | Condition | Render |
| --- | --- | --- |
| No limit / query unresolved / no slug match | `wipLimit === null` | **Byte-identical to HEAD**: `<span class="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">3</span>`. No spinner, no placeholder, no reserved space, no layout shift (FR-27, AC-4). |
| Limit set, at or under cap | `taskCount <= wipLimit` | `3/5`, same `bg-muted` / `text-muted-foreground` tokens, `title` from `tasks:kanban.wipLimitTitle`. **No alert styling, no icon, no sr-only text** (FR-24, AC-4). |
| Over cap | `taskCount > wipLimit` | `6/5` with `bg-destructive/10 text-destructive`, a `TriangleAlert` icon, `title` and an `sr-only` accessible name from `tasks:kanban.wipLimitOverCap` (FR-23, FR-25, AC-4). |

### 7.4 Accessibility (FR-25)

- Not a bare colored dot. The numeric ratio `6/5` is always visible text — the state is legible
  without color perception.
- The `TriangleAlert` icon is `aria-hidden="true"` (decorative; it duplicates information already
  in text).
- The accessible name comes from an `sr-only` span holding a static i18n key, not from `aria-label`
  on a `<span>` with no role — an `aria-label` on a generic element is not reliably exposed by
  assistive tech, and `role="status"` would make it a live region that announces on every task
  move. The `sr-only` span is the correct, quiet choice.
- `title` is set for sighted mouse users on both limit states.
- No `role`, no `aria-live`, no focus target added. The badge is not interactive.

### 7.5 Styling

Existing Tailwind theme tokens only: `bg-muted`, `text-muted-foreground`, `bg-destructive/10`,
`text-destructive`, `rounded-md`, `px-1.5`, `py-0.5`, `text-xs`, `font-medium`. **No hard-coded hex,
no `red-500`, no new CSS, no `style` prop.** `cn` is imported from `@/lib/utils` (already the
repo-wide helper; used in `column-editor.tsx`). `TriangleAlert` comes from `lucide-react`, which
this file already imports (`Archive`, `Plus`).

---

## 8. Two-query consistency — the design consequence of OQ-1(a)

The task count comes from `GET /task/tasks/:projectId` (via `useProjectStore` → props). The limit
comes from `GET /column/:projectId` (via `useGetColumns`). These are two independently-cached
TanStack queries with independent refetch timing.

### 8.1 Chosen approach

**Render both inputs uncoordinated, from whatever each query currently holds, and treat a missing
limit as "no limit".** No debounce, no suspense, no coalescing, no derived store, no
`isLoading`/`isError` branch. The indicator is a pure function of the two values at render time:

```
wipLimit  = columnsData?.find(c => c.slug === column.slug)?.wipLimit ?? null
isOverCap = wipLimit !== null && column.tasks.length > wipLimit
```

### 8.2 Why this is safe — every transient window, enumerated

**W1 — a task moves; the tasks query updates before the columns query refetches.**
`wipLimit` is column configuration; moving a task cannot change it. The columns cache is therefore
not stale in any meaningful sense — it holds the current, correct limit. The count is the fresh
one. The indicator is **immediately and unambiguously correct**. This window produces no wrong
render at all.

**W2 — a limit is set/cleared in the editor; the columns query resolves before the tasks query.**
`useUpdateColumn` invalidates both keys with `refetchType: "all"`, and the two refetches race.
During the race the header pairs the new limit with the pre-refetch count. But changing a WIP limit
does not create, delete, or move any task — the tasks refetch returns semantically identical column
membership. Old count === new count. The indicator is correct throughout the window, and the tasks
refetch produces no visible change to the badge.

**W3 — the columns query resolves before the tasks query has ever loaded.**
The board does not render `ColumnHeader` until it has project data, so `column.tasks` is always a
real array by the time this component exists. There is no "count is undefined" state.

**W4 — cold columns query (first paint after a hard load).**
`columnsData` is `undefined` → `wipLimit === null` → the header renders today's bare count. When
the query resolves, a column that has a limit transitions **once**, `3` → `3/5`. This is a single
monotonic reveal, not an oscillation. In practice it is rarely visible: `["columns", projectId]` is
usually already warm because `ColumnEditor`, `TaskStatusPopover`, and `TaskCardContextMenuContent`
share the key, and TanStack serves cached data instantly on remount.

**W5 — background refetch of the columns query.**
TanStack Query keeps `data` populated during a background refetch (`isFetching` true, `data`
unchanged). `wipLimit` never transiently drops to `undefined` once loaded. **This is the reason
there is no flicker**: the only null→value transition in the component's lifetime is W4, and there
is no value→null transition short of an explicit clear.

**W6 — a column is renamed, changing its slug; the two queries momentarily disagree on slugs.**
The `find` misses → `wipLimit === null` → bare count. The failure mode degrades to today's exact
rendering. It **never** shows a wrong limit or a false alarm, because a limit is only ever read
from a row whose slug matches the rendered column.

**W7 — a column exists on the board but not in `columnTable` (virtual statuses).**
`find` misses → bare count. Same safe degradation.

> **AMENDED after Gate 3 (senior review finding N-2). The paragraph below originally claimed a
> false over-cap alarm was unreachable. That claim was wrong and has been corrected.**

Across the windows above the common-case degradation argument holds: the usual failure is *"the
indicator is absent for one render tick"*, which is safe.

But the absolute claim does not hold. `use-get-tasks.ts:8` polls every 30 seconds, whereas
`use-get-columns` does **not** poll, and `apps/api/src/column/` publishes no events at all
(`grep publishEvent apps/api/src/column/` returns nothing). So when **another user raises a
column's limit**, this client keeps the old, lower limit in its columns cache while the task
count refreshes on the 30-second poll. The result is a **persistent false over-cap alarm** —
a red indicator for a column that is no longer over its cap — lasting until the columns query
is invalidated by a window refocus or a local mutation. A limit *lowered* by another user
produces the mirror case: a missed alarm.

This is a staleness bound, not a logic error, and it follows from the frozen write contract
(OQ-1a) rather than from a mistake in this design. It is worth stating plainly because the
original wording would have let a reader dismiss a real class of wrong render.

Note also that Kaneo's own `AGENTS.md` says to use `publishEvent()` when a mutation drives
realtime updates. Column mutations have **never** done so — that predates this run, is not a
regression introduced by it, and is deliberately out of scope here. Adding column events would
be the correct long-term fix for this staleness and belongs in its own change.

### 8.2b AMENDED after Gate 3 — the count used for the comparison (finding N-1)

§8.2 as originally written assumed `column.tasks.length` was the column's true task count. It is
not. `board.tsx:166` derives `filteredProject` via `useTaskFiltersWithLabelsSupport(...)`, then
`sortedProject` (line 168), and passes that to `<KanbanBoard project={sortedProject}>` (line 239)
→ `<Column>` (`kanban-board/index.tsx:259`) → `ColumnHeader`. The prop is therefore the
**post-filter, post-search** column.

Shipping that unchanged would mean any active filter silently cleared a genuine breach — false
reassurance, which is precisely the failure a WIP limit exists to prevent.

**Resolved at Gate 3: decide on the unfiltered count, display the filtered count.**

```
displayCount = column.tasks.length                       // filtered — what is on screen
totalCount   = project?.columns?.find(e => e.slug === column.slug)?.tasks.length ?? displayCount
isOverCap    = wipLimit !== null && totalCount > wipLimit // decision uses the TRUE count
isFiltered   = totalCount !== displayCount
```

`project` is the store's unfiltered project, already present in the component. The badge still
renders `displayCount/wipLimit` so it matches the visible cards; when `isFiltered` is true the
`title` and `sr-only` text switch to `tasks:kanban.wipLimitOverCapFiltered` /
`wipLimitFiltered`, which disclose the true total.

The `?? displayCount` fallback preserves the run's central invariant: a store miss degrades to
the filtered count, which can only ever **under**-report. **Filters can never manufacture a
breach.**

### 8.3 Alternatives considered and rejected

- **Debounce the indicator (delay showing/hiding by ~300 ms).** Adds a timer, an effect, and local
  state to smooth a mismatch that §8.2 shows cannot produce a wrong render. It would also *delay*
  a correct alarm. Rejected.
- **`useSuspenseQuery` / gate the header on the columns query.** Blocks the board header on a
  secondary query, producing a spinner and layout shift — a direct violation of FR-27, and a
  regression for the overwhelmingly common `wipLimit === null` case. Rejected.
- **Derive the task count from the columns query instead of the board data.**
  `GET /column/:projectId` returns no task counts. This would require a new aggregate endpoint or a
  count subquery — new API surface, new N+1 risk, out of scope. Rejected.
- **Copy `wipLimit` into `useProjectStore` when the board loads.** Duplicates server state into
  client state, needs its own invalidation wiring, and reintroduces exactly the staleness it claims
  to fix. Contradicts AGENTS.md ("server state in TanStack Query hooks"). Rejected.
- **Amend the write contract to add `get-tasks.ts` to the allowlist (OQ-1b).** Decided against at
  Gate 1. Not reopened here.

---

## 9. Column-editor design

File: `apps/web/src/components/project/column-editor.tsx`.

### 9.1 Handler

Added next to `handleToggleFinal`, following the identical shape (`updateColumn` → success toast →
`catch` → error toast):

```ts
  const handleUpdateWipLimit = async (id: string, wipLimit: number | null) => {
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
```

Failure reuses the existing `toastUpdateError` key rather than adding a third error key — the
editor already funnels `handleToggleFinal` and `handleUpdateIcon` failures there.

### 9.2 Input placement

Inside the existing right-hand cluster `<div className="flex items-center gap-1.5 shrink-0">`
(`column-editor.tsx:299`), as a new sibling **immediately before** the "Done column" group, so the
row reads: grip · icon · name · **WIP limit** · Done column · delete.

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
                  placeholder={t("settings:columnEditor.wipLimitPlaceholder")}
                  aria-label={t("settings:columnEditor.wipLimitAria", {
                    name: col.name,
                  })}
                  className="h-8 w-16 text-sm"
                  disabled={!canEdit}
                  onBlur={(e) => {
                    const input = e.currentTarget;
                    const current = col.wipLimit ?? null;
                    const trimmed = input.value.trim();
                    const next = trimmed === "" ? null : Number(trimmed);

                    if (
                      next !== null &&
                      !(Number.isInteger(next) && next >= 1)
                    ) {
                      input.value = current === null ? "" : String(current);
                      return;
                    }

                    if (next === current) return;

                    handleUpdateWipLimit(col.id, next);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                />
              </div>
```

### 9.3 Semantics

- **`canEdit` gate (FR-18).** `disabled={!canEdit}` — the same `canManageProjects()` gate the
  rename `Input` and the `Switch` already use. No new permission check, no new hook call.
- **Commit on blur and on Enter (FR-19).** The `onKeyDown` handler is character-for-character the
  rename input's: `preventDefault()` then `blur()`, so Enter routes through the single `onBlur`
  path. One commit site, not two.
- **Empty → `null` (FR-20).** `trimmed === ""` produces `null`, which the PUT validator accepts and
  `updateColumn` writes as a clear.
- **Invalid → revert, do not send (FR-20).** `Number("abc")` → `NaN`, `Number("2.5")` → non-integer,
  `Number("-1")` → `< 1`; all three fail the guard and the input's value is reset to the persisted
  value. `Number("")` would be `0`, which is why the empty check comes first.
- **No-op → no request.** `next === current` returns early, so tabbing through the field sends
  nothing.
- **Trap — do not `await` before touching the DOM.** `input.value` is captured and written
  synchronously inside `onBlur`; `handleUpdateWipLimit` is fired without `await`. Awaiting first and
  then reading `e.currentTarget` yields `null` in React's synthetic event lifecycle.
- **Uncontrolled, matching the rename input.** `defaultValue` with no `key` and no `useState`,
  exactly like `defaultValue={col.name}`. No new component state is introduced (NFR-6).
- **The "add new column" row is NOT extended (FR-22).** The block at `column-editor.tsx:346-428`
  is untouched: no WIP input, no `wipLimit` in `handleCreate`'s payload. A limit is set after
  creation. The API still accepts `wipLimit` on create (FR-5) for the typed client, MCP, and API-key
  consumers.

---

## 10. i18n keys

All keys are static literals passed to `t()`. No template-literal key, no key built from a variable,
no runtime-constructed path (FR-28). The `{{name}}`, `{{taskCount}}`, `{{limit}}` placeholders are
**interpolated values**, not dynamic key names — the same pattern as the existing
`settings:columnEditor.markDoneAria` (`{{name}}`).

> Deliberately avoiding the placeholder name `count`: i18next reserves it for pluralization and
> would demand `_one` / `_other` variants. `taskCount` is used instead.

### 10.1 `settings.columnEditor` — insert after `"add": "Add"` (`i18n/en-US.json:903`)

```json
		"columnEditor": {
			"…existing keys…": "…",
			"newColumnPlaceholder": "New column name...",
			"add": "Add",
			"wipLimit": "WIP limit",
			"wipLimitPlaceholder": "None",
			"wipLimitTooltip": "Advisory limit on tasks in this column. Leave empty for no limit.",
			"wipLimitAria": "WIP limit for {{name}}",
			"toastWipLimitUpdated": "WIP limit updated",
			"toastWipLimitCleared": "WIP limit cleared"
		},
```

### 10.2 `tasks.kanban` — extend the object at `i18n/en-US.json:1884-1886`

```json
		"kanban": {
			"addTask": "Add task",
			"wipLimitTitle": "WIP limit: {{taskCount}} of {{limit}}",
			"wipLimitOverCap": "Over WIP limit: {{taskCount}} of {{limit}}"
		},
```

### 10.3 Key inventory (8 new keys)

| Key | English value | Used by |
| --- | --- | --- |
| `settings:columnEditor.wipLimit` | `WIP limit` | editor row label |
| `settings:columnEditor.wipLimitPlaceholder` | `None` | editor input placeholder |
| `settings:columnEditor.wipLimitTooltip` | `Advisory limit on tasks in this column. Leave empty for no limit.` | editor group `title` |
| `settings:columnEditor.wipLimitAria` | `WIP limit for {{name}}` | editor input `aria-label` |
| `settings:columnEditor.toastWipLimitUpdated` | `WIP limit updated` | success toast (set) |
| `settings:columnEditor.toastWipLimitCleared` | `WIP limit cleared` | success toast (clear) |
| `tasks:kanban.wipLimitTitle` | `WIP limit: {{taskCount}} of {{limit}}` | header badge `title`, at/under cap |
| `tasks:kanban.wipLimitOverCap` | `Over WIP limit: {{taskCount}} of {{limit}}` | header badge `title` + `sr-only`, over cap |

Failure toasts reuse `settings:columnEditor.toastUpdateError` — no new error key.
No literal English string appears in either touched component (AC-6).

**Reminder:** editing `i18n/en-US.json` triggers mini-gate item 1 in §2 (`i18n/schema.json` is
strict and generated, and is outside the allowlist).

---

## 11. Testing surface

**No existing test is modified or deleted (FR-33).** `tests/api/column/to-slug.test.ts` keeps
passing unchanged — `toSlug` and its export are untouched. Baseline: 374 API tests, 112 web tests.
This plan adds 4 files and roughly 13 tests, so both counts only go up (NFR-1, AC-7).

### 11.1 `tests/api/column/create-column-wip-limit.test.ts` (new)

- **Copies:** the mocking pattern of `tests/api/label/delete-label.test.ts` — top-level
  `const mockX = vi.fn()`, `vi.mock("../../../apps/api/src/database", () => ({ default: { … } }))`,
  hand-built chain objects, `beforeEach(vi.clearAllMocks)` / `afterEach(vi.restoreAllMocks)`.
- **Mocks:** `db.select` (called twice: the duplicate-slug probe, then the `MAX(position)` probe) and
  `db.insert`. Chain helpers:
  ```ts
  function makeSelectMock(rows: unknown[]) {
    const chain: Record<string, unknown> = {};
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => Promise.resolve(rows));
    return chain;
  }
  function makeInsertMock(row: unknown) {
    const chain: Record<string, unknown> = {};
    chain.values = vi.fn(() => chain);
    chain.returning = vi.fn(() => Promise.resolve([row]));
    return chain;
  }
  ```
  Per test: `mockSelect.mockReturnValueOnce(makeSelectMock([]))` then
  `.mockReturnValueOnce(makeSelectMock([{ maxPosition: -1 }]))`.
- **Asserts:**
  1. `createColumn({ projectId, name: "Doing", wipLimit: 5 })` → `insertChain.values` called with an
    object containing `wipLimit: 5`. → **AC-2**
  2. `createColumn({ projectId, name: "Doing" })` → `values` called with `wipLimit: null`. → **AC-1**
  3. Regression guard for the `||` trap: `createColumn({ …, wipLimit: 1 })` → `values` receives
    `wipLimit: 1`, not `null`. → **AC-2**
- No live database, no PostgreSQL, no `tests/api-integration`.

### 11.2 `tests/api/column/update-column-wip-limit.test.ts` (new)

- **Copies:** same `delete-label.test.ts` pattern; mocks `db.query.columnTable.findFirst` and
  `db.update`.
  ```ts
  function makeUpdateMock(row: unknown) {
    const chain: Record<string, unknown> = {};
    chain.set = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.returning = vi.fn(() => Promise.resolve([row]));
    return chain;
  }
  ```
- **Asserts:**
  1. `updateColumn("col-1", { wipLimit: 5 })` → `.set` receives `{ wipLimit: 5 }`. → **AC-2**
  2. `updateColumn("col-1", { wipLimit: null })` → `.set` receives `{ wipLimit: null }` (clear).
    → **AC-2**
  3. `updateColumn("col-1", { name: "Doing" })` → the `.set` argument has **no** `wipLimit` own
    property (`expect("wipLimit" in setArg).toBe(false)`), proving omission leaves it untouched.
    → **AC-2**

### 11.3 `tests/api/column/wip-limit-validation.test.ts` (new)

Route-level proof for FR-5 / FR-6 / FR-7 and the rejection half of AC-2.

- **Mocks (all four, declared before the `import column from …` line, matching the
  `delete-label.test.ts` ordering convention):**
  ```ts
  vi.mock("../../../apps/api/src/utils/workspace-access-middleware", () => ({
    workspaceAccess: {
      fromProject: () => async (_c: Context, next: Next) => next(),
      fromColumn: () => async (_c: Context, next: Next) => next(),
    },
  }));
  vi.mock("../../../apps/api/src/utils/require-workspace-permission", () => ({
    requireWorkspacePermission: () => async (_c: Context, next: Next) => next(),
  }));
  vi.mock("../../../apps/api/src/column/controllers/create-column", () => ({
    default: (...args: unknown[]) => mockCreateColumn(...args),
  }));
  vi.mock("../../../apps/api/src/column/controllers/update-column", () => ({
    default: (...args: unknown[]) => mockUpdateColumn(...args),
  }));
  ```
  `delete-column`, `get-columns`, and `reorder-columns` need no mock: `apps/api/src/database`
  exports `db` as a lazy `Proxy` (`database/index.ts:169`), so importing them opens no connection.
- **Requests:** `column.request("/proj-1", { method: "POST", headers: { "content-type":
  "application/json" }, body: JSON.stringify({ … }) })` and
  `column.request("/col-1", { method: "PUT", … })`. `PUT /reorder/:projectId` is registered before
  `PUT /:id`, so `/col-1` routes correctly.
- **Asserts (status codes only, never response-body shape):**
  1. POST `{ name: "Doing", wipLimit: 5 }` → `200`, `mockCreateColumn` called with
    `wipLimit: 5`. → **AC-2**
  2. POST `{ name: "Doing" }` → `200`, `mockCreateColumn` called with `wipLimit: undefined`.
  3. POST `{ name: "Doing", wipLimit: 0 }` → `400`. → **AC-2**
  4. POST `{ name: "Doing", wipLimit: -1 }` → `400`. → **AC-2**
  5. POST `{ name: "Doing", wipLimit: 2.5 }` → `400`. → **AC-2**
  6. POST `{ name: "Doing", wipLimit: "5" }` → `400`. → **AC-2**
  7. PUT `{ wipLimit: null }` → `200`, `mockUpdateColumn` called with `{ wipLimit: null }`.
    → **AC-2**
  8. PUT `{ wipLimit: 0 }` → `400`. → **AC-2**

### 11.4 `apps/web/src/components/kanban-board/column/column-header.test.tsx` (new)

- **Copies:** `apps/web/src/components/task/task-status-popover.test.tsx` for the
  `const useGetColumns = vi.fn()` + `vi.mock("@/hooks/queries/column/use-get-columns", …)` pattern
  and the `t: (key: string) => key` i18n stub; `apps/web/src/components/kanban-board/task-labels.test.tsx`
  for the plain `render` / `screen.getByText` / `afterEach(cleanup)` shape.
- **Additional mocks required by this component:**
  ```ts
  vi.mock("@/store/project", () => ({
    default: () => ({ project: { id: "project-1" }, setProject: vi.fn() }),
  }));
  vi.mock("@/hooks/mutations/task/use-update-task", () => ({
    useUpdateTask: () => ({ mutate: vi.fn() }),
  }));
  vi.mock("@/hooks/use-workspace-permission", () => ({
    useWorkspacePermission: () => ({
      canUpdateTasks: () => false,
      canCreateTasks: () => false,
    }),
  }));
  vi.mock("@/components/shared/modals/create-task-modal", () => ({ default: () => null }));
  vi.mock("@/components/shared/modals/archive-tasks-modal", () => ({
    ArchiveTasksModal: () => null,
  }));
  vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
  ```
  Mocking both modals and the permission hook keeps the rendered DOM to the header row only, so the
  badge assertions are unambiguous and no `QueryClientProvider` is needed.
- **Column fixture helper:** `makeColumn(taskCount: number)` returning
  `{ id: "in-progress", slug: "in-progress", name: "In Progress", icon: null, isFinal: false,
  tasks: Array.from({ length: taskCount }, (_, i) => ({ id: \`t-\${i}\`, … })) }` cast to
  `ProjectWithTasks["columns"][number]`.
- **Asserts:**

  | # | `useGetColumns` mock | Tasks | Expectation | Proves |
  | --- | --- | --- | --- | --- |
  | 1 | `{ data: [{ slug: "in-progress", wipLimit: null }] }` | 3 | `getByText("3")` visible; `queryByText("3/")` null; `queryByText("tasks:kanban.wipLimitOverCap")` null | AC-4 no-limit, FR-24 |
  | 2 | `{ data: [{ slug: "in-progress", wipLimit: 5 }] }` | 3 | `getByText("3/5")` visible; `queryByText("tasks:kanban.wipLimitOverCap")` null | AC-4 under cap, FR-24 |
  | 3 | `{ data: [{ slug: "in-progress", wipLimit: 5 }] }` | **5** | `getByText("5/5")` visible; `queryByText("tasks:kanban.wipLimitOverCap")` **null** | **AC-4 strict boundary — `===` is not over cap** |
  | 4 | `{ data: [{ slug: "in-progress", wipLimit: 5 }] }` | 6 | `getByText("6/5")` visible; `getByText("tasks:kanban.wipLimitOverCap")` present | AC-4 over cap, FR-23, FR-25 |
  | 5 | `{ data: undefined }` (loading) | 3 | `getByText("3")` visible; no `/`; no indicator | FR-27, §8 W4 |
  | 6 | `{ data: [{ slug: "done", wipLimit: 1 }] }` (no slug match) | 3 | `getByText("3")` visible; no indicator | §8 W6/W7 |
  | 7 | any | any | `expect(useGetColumns).toHaveBeenCalledWith("project-1")` | FR-26 |

  Tests 3 and 5 are the two that a naive implementation fails; neither may be dropped.

### 11.5 Not run in this run

`tests/api-integration/**` requires live PostgreSQL and is unverified at baseline (requirements §2.7).
It is not a gate. The migration's correctness against a populated database is argued in §3.3 and
verified by SQL inspection, not by an integration run.

---

## 12. Decision records

### ADR-1 — Nullable additive column on `column`, not a separate settings table

**Context.** A WIP limit is a single optional small integer per column. It could live on
`columnTable` or in a `column_settings` side table keyed by `columnId`.
**Decision.** Add `wipLimit integer` (nullable) directly to `columnTable`.
**Consequences.** `getColumns` and `get-tasks`'s `db.select()` pick it up for free; no join, no N+1,
no cascade wiring, no new relation. The migration is a metadata-only `ADD COLUMN`. `columnTable`
grows one field.
**Alternatives rejected.** A `column_settings` table would add a table, a relation, a cascade, a
join on the busiest read path, and a "row may not exist" branch — all to store one nullable integer.
A JSON `settings` blob would lose type safety and make the Valibot contract untestable. Both violate
"build the smallest model that makes correct behavior obvious" (AGENTS.md).

### ADR-2 — Advisory-only limit; no enforcement anywhere

**Context.** WIP limits can be hard (reject the move) or soft (show it).
**Decision.** Indicate only. No API rejection, no 409, no drag-and-drop block, no move refusal. A
column over its cap is a valid persisted state, including immediately after a limit is lowered.
**Consequences.** Zero change to the task-move path, to `get-tasks.ts`, to the drag-and-drop layer,
or to any WebSocket/event payload. No user can be locked out of moving work. Setting a limit is
always safe and instantly reversible. The blast radius stays inside the column module.
**Alternatives rejected.** Hard enforcement would require a count-on-write check in the task update
path (a new query on the hottest mutation), a new error contract, new client-side error handling,
and a migration story for columns already over cap. It is explicitly a non-goal in the brief.

### ADR-3 — Two-query sourcing on the board, forced by the frozen write contract

**Context.** `apps/api/src/task/controllers/get-tasks.ts:224` hand-projects the board's column shape
as `{ id, slug, name, icon, isFinal, tasks }`. A new row field is silently dropped there. That file
is outside the frozen allowlist.
**Decision.** `ColumnHeader` reads `wipLimit` from `useGetColumns(projectId)` and matches on `slug`,
following the established `task-card-context-menu-content.tsx:52` pattern. The count still comes
from the board data.
**Consequences.** The change stays entirely inside the allowlist. No extra network request
(TanStack dedupes `["columns", projectId]`, already subscribed elsewhere in the tree). The cost is
one more place on the board that asks "where does column metadata come from", plus the transient
windows enumerated in §8 — all of which degrade to today's bare-count rendering rather than to a
wrong render.
**Alternatives rejected.** Adding `wipLimit` to the `get-tasks` projection (OQ-1b) is the cleaner
data flow and one source of truth, but requires reopening a frozen contract and editing the busiest
read path in the API. Decided against at Gate 1.

### ADR-4 — Uncontrolled numeric input, blur/Enter commit, no new component state

**Context.** The editor needs a set/clear affordance. Options: controlled input with a
`Record<columnId, string>` draft map, a form library, or an uncontrolled input mirroring the rename
field.
**Decision.** Uncontrolled `<Input type="number" defaultValue={col.wipLimit ?? ""}>` committing on
blur, with Enter routed through `blur()` — character-for-character the pattern the rename input two
elements away already uses. Invalid input reverts by assigning `input.value` synchronously.
**Consequences.** Zero new `useState`, zero new dependency, one new handler. Behavior is consistent
with the field users already know in that row. Like the rename input, it does not live-update from a
background refetch caused by another user's edit — an accepted, pre-existing limitation of this
editor rather than a new one.
**Alternatives rejected.** A draft-state map adds state that must be reconciled with every query
invalidation. `react-hook-form` for one integer is disproportionate and inconsistent with the file.
Committing on every keystroke would fire a PUT per digit.

### ADR-5 — Reuse existing i18n namespaces; accept English fallback elsewhere

**Context.** Eight new strings across two components. `i18n/en-US.json` is the source of truth; the
17 other locales are off-limits this run; `i18n/schema.json` is strict, generated, and outside the
allowlist.
**Decision.** Add keys under the existing `settings.columnEditor` and `tasks.kanban` objects — the
namespaces those two components already use. Reuse `toastUpdateError` for failures. No new
namespace. Do not write `i18n/schema.json`; raise it as a mini-gate.
**Consequences.** No i18n wiring change, no new namespace registration, no interpolated key names.
Non-English users see English for these eight strings until a separate translation pass (OQ-3,
accepted). The user must run `pnpm i18n:schema` before committing, and `pnpm i18n:check` will report
the 17 locales as incomplete — expected, not a failure of this run.
**Alternatives rejected.** A new `wip` namespace would need registration and would split column-editor
copy across two files. Hard-coded English strings violate AGENTS.md and AC-6. Silently patching
`i18n/schema.json` would breach the write contract.

---

## 13. Verification

Run exactly these, in this order, and report what ran and what did not:

```bash
pnpm --filter @kaneo/api test && pnpm --filter @kaneo/web test
pnpm --filter @kaneo/api typecheck
pnpm --filter @kaneo/web typecheck
pnpm exec biome ci .
```

**Pass criteria**

- API tests: exit 0, **>= 374** tests (baseline 374, this plan adds ~13 across three files).
- Web tests: exit 0, **>= 112** tests (baseline 112, this plan adds 7).
- Both typechecks: exit 0. `pnpm --filter @kaneo/web typecheck` is the real proof of AC-3 — it only
  passes if `wipLimit` propagated from the Drizzle schema through the API route types, through
  `@kaneo/libs`, into `useGetColumns`'s inferred result, read in `column-header.tsx` and
  `column-editor.tsx` **without a cast**. Do not introduce an `as` anywhere to make it pass; if it
  fails, the propagation is genuinely broken.
- `pnpm exec biome ci .`: exit 0. Read-only; it does not rewrite files.

**Forbidden in this run**

- `pnpm test` (root) — runs `turbo test`, rebuilds every package, and is far wider than this change.
- `pnpm lint`, `pnpm --filter @kaneo/api lint`, `pnpm --filter @kaneo/web lint` — all of these are
  `biome check --write`, which rewrites unrelated files in a dirty worktree. Use `biome ci` only.
- `pnpm i18n:check:fix` / `pnpm i18n:report:fix` — they write the 17 off-limits locale files.
- `pnpm --filter @kaneo/api test:integration` — needs live PostgreSQL; unverified at baseline.
- `pnpm --filter @kaneo/api db:migrate` — applying the migration is the user's step, not the
  plugin's. Only `db:generate` runs here.

**Scope check before reporting done (AC-8).** `git status --porcelain` must list only the 18 paths
in §2, plus nothing under `apps/web/src/components/public-project/`, `apps/web/src/components/board/`,
`apps/site/`, `apps/docs/`, `charts/`, `packages/mcp/`, no non-English locale, no migration
`0000`–`0042`, no `i18n/schema.json`, and no AI-config file.

---

## 14. Packet decomposition hint

Ordered units of work. "Mechanical" = a mechanical-tier model can apply it from the fragments in
this document verbatim. "Judgment" = requires reading surrounding code or inspecting tool output.

| # | Unit | Files | Depends on | Tier |
| --- | --- | --- | --- | --- |
| P1 | Schema field | `apps/api/src/database/schema.ts` | — | **Mechanical** — one line, exact text in §3.1 |
| P2 | Generate + inspect migration | `apps/api/drizzle/0043_*.sql`, `meta/0043_snapshot.json`, `meta/_journal.json` | P1 | **Judgment** — runs `pnpm --filter @kaneo/api db:generate`, then applies the §3.2 inspection gate to tool output it did not author |
| P3 | Create/update controllers | `create-column.ts`, `update-column.ts` | P1 | **Judgment** — small, but carries the `??` vs `\|\|` trap (§5.1) that mechanical pattern-matching gets wrong |
| P4 | Route validators + POST handler pass-through | `apps/api/src/column/index.ts` | P3 | **Mechanical** — exact Valibot fragments in §4.1/§4.2; middleware lines must not move |
| P5 | API controller tests | `tests/api/column/create-column-wip-limit.test.ts`, `update-column-wip-limit.test.ts` | P3 | **Mechanical** — chain-mock helpers given in §11.1/§11.2 |
| P6 | API route validation test | `tests/api/column/wip-limit-validation.test.ts` | P4 | **Judgment** — mock hoisting order and Hono `app.request()` routing need care |
| P7 | i18n keys | `i18n/en-US.json` | — | **Mechanical** — exact JSON in §10; insertion points at lines 903 and 1884 |
| P8 | Web fetchers + mutation hook types | `fetchers/column/{create,update}-column.ts`, `hooks/mutations/column/use-{create,update}-column.ts` | P1, P4 (types must exist for typecheck) | **Mechanical** — four type-literal widenings, §6 |
| P9 | Column header indicator | `components/kanban-board/column/column-header.tsx` | P8, P7 | **Judgment** — the slug-vs-id match, the strict `>`, and the null-collapse are all easy to get subtly wrong (§7.2) |
| P10 | Column editor input | `components/project/column-editor.tsx` | P8, P7 | **Judgment** — the synchronous-DOM-before-await trap and the revert path (§9.2) |
| P11 | Web header test | `components/kanban-board/column/column-header.test.tsx` | P9 | **Mechanical** — the seven cases are fully tabulated in §11.4 |

**Dependency notes**

- **P1 → P2 is hard.** `db:generate` diffs the schema file; it must run after P1 and before any
  further schema edit.
- **P1 + P4 → P8 is hard for the typecheck, not for the edit.** `@kaneo/web`'s inferred client type
  only carries `wipLimit` once both the Drizzle column and the route validator exist. P8's files can
  be written earlier, but `pnpm --filter @kaneo/web typecheck` will not pass until P1 and P4 land.
- **P7 has no code dependency** and can execute at any point; P9 and P10 fail AC-6 without it.
- **P9 and P10 are independent of each other** and can execute in either order.
- **P2, P5, P6, P11 are the verification-bearing packets.** If any of them cannot be made green
  without editing a file outside the allowlist, stop for a mini-gate — do not widen the contract.

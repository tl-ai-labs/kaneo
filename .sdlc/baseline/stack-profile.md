# Stack profile — learned from repo scan

Built 2026-09-03 for run `20260903-125223-feature-extend-task-estimated-hours`.

**Why this exists:** Kaneo's primary stacks are Hono (API) and React + Vite (web). Neither matches a
pre-authored adapter (`generic.md`, `nest.md`, `python.md`), so Tier 2b sampled the repo directly.
**Where this profile and any adapter fragment disagree, this profile wins** — it reflects the code
that is actually here.

---

## Language & runtime

TypeScript throughout, `"type": "module"` at the root, TypeScript 7.0.2, Node ≥ 20.19, pnpm 10.32.1,
Turborepo 2.x. Formatting and linting are Biome 2.5.7 (`biome.json` at root) — **not** ESLint or
Prettier. Two-space indent, double-quoted strings, trailing commas, semicolons. Imports are sorted by
Biome's organizer: node builtins, then external packages, then `@/` aliases, then relative — so
**new imports must be inserted in sorted position** or `biome ci` fails the pre-commit hook.

Path aliases: web uses `@/` → `apps/web/src` and `@i18n` → `i18n/`. API uses plain relative imports.

---

## Framework

- **API:** Hono + `hono-openapi` (`describeRoute`, `resolver`, `validator`), Valibot (`import * as v`)
  for input validation, Drizzle ORM against PostgreSQL, Better Auth, an event bus, WebSockets, and
  optional Redis fan-out.
- **Web:** React + Vite, TanStack Router (file-based, generated `routeTree.gen.ts`), TanStack Query
  for server state, Zustand + nanostores for local state, Radix/base-ui + Tailwind for UI,
  react-i18next for all user-facing copy.
- **Contract:** `packages/libs` exports a typed Hono RPC `client`; the web app calls the API only
  through it and derives request types with `InferRequestType`.

---

## Conventions detected

### File naming

`kebab-case.ts` / `kebab-case.tsx` everywhere, on both sides. There is no `PascalCase.tsx`.

- API: `apps/api/src/<feature>/index.ts` (routes) and
  `apps/api/src/<feature>/controllers/<verb>-<noun>.ts` — e.g. `create-task.ts`, `update-task.ts`,
  `get-tasks.ts`, `update-task-due-date.ts`.
- Web components: `apps/web/src/components/<area>/<thing>.tsx` — e.g. `task-due-date-popover.tsx`,
  `column-header.tsx`.
- Web data layer: `apps/web/src/fetchers/<domain>/<verb>-<noun>.ts` and
  `apps/web/src/hooks/mutations/<domain>/use-<verb>-<noun>.ts`,
  `apps/web/src/hooks/queries/<domain>/use-<verb>-<noun>.ts`.
- Tests: colocated `<thing>.test.tsx` on the web side; **repo-root `tests/api/<area>/<thing>.test.ts`**
  on the API side.

Controllers use `export default` with a function whose name matches the file in camelCase
(`create-task.ts` exports `createTask`). Web components use `export default function PascalName`,
except small named helpers which use `export function`.

### Route shape (API)

Routes are one long chained `Hono` builder per feature, each link being
`describeRoute` → `validator("param", …)` → `validator("json", …)` → handler. From
`apps/api/src/task/index.ts:317`:

```ts
  .put(
    "/:id",
    describeRoute({
      operationId: "updateTask",
      tags: ["Tasks"],
      description: "Update all fields of a task",
      responses: {
        200: {
          description: "Task updated successfully",
          content: {
            "application/json": { schema: resolver(taskSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({
        title: v.string(),
        description: v.string(),
        startDate: v.optional(v.string()),
        dueDate: v.optional(v.string()),
        priority: v.picklist(VALID_PRIORITIES),
        status: v.string(),
        projectId: v.string(),
        position: v.number(),
        userId: v.optional(v.string()),
      }),
    ),
```

Handlers stay thin: pull `c.req.valid("json")` / `c.req.valid("param")`, read `c.get("userId")`,
call a controller, `return c.json(...)`. Every route carries `operationId`, `tags`, `description`,
and a `resolver(<schema>)` response — OpenAPI metadata is not optional here.

The shared response schemas live in `apps/api/src/schemas.ts` (`taskSchema`, `activitySchema`, …).
They are Valibot objects used for documentation via `resolver`.

### Controller shape (API)

Plain async functions, `export default`, taking either a destructured object (newer controllers, e.g.
`createTask`) or **positional parameters** (older ones — `updateTask(id, title, status, startDate,
dueDate, projectId, description, priority, position, userId?, currentUserId?)`). Drizzle query
builder is used directly; there is no repository layer. `HTTPException` for expected failures.
Mutations that change realtime state end with `publishEvent(...)`.

```ts
async function updateTask(/* … */) {
  const [existingTask] = await db
    .select({ id: taskTable.id, description: taskTable.description, /* … */ })
    .from(taskTable)
    .where(eq(taskTable.id, id))
    .limit(1);

  if (!existingTask) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  const [updatedTask] = await db
    .update(taskTable)
    .set({ title, status, dueDate: dueDate || null, priority, position })
    .where(eq(taskTable.id, id))
    .returning();

  await publishEvent("task.status_changed", { /* … */ });
  return updatedTask;
}
```

Validation helpers that are shared across controllers sit one level up, at
`apps/api/src/<feature>/validate-<feature>-fields.ts` — e.g. `VALID_PRIORITIES`,
`assertValidPriority`, `assertValidTaskStatus`, `coercePriority`.

### Data layer

Drizzle ORM, PostgreSQL dialect. Schema in `apps/api/src/database/schema.ts`, relations in
`relations.ts`, migrations generated into `apps/api/drizzle/` by
`pnpm --filter @kaneo/api db:generate` (drizzle-kit, `out: "./drizzle"`). Latest is
`0042_previous_the_executioner.sql`.

```ts
export const taskTable = pgTable(
  "task",
  {
    id: text("id").$defaultFn(() => createId()).primaryKey(),
    projectId: text("project_id").notNull().references(() => projectTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    priority: text("priority").default("low").notNull(),
    startDate: timestamp("start_date", { mode: "date" }),
    dueDate: timestamp("due_date", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("task_projectId_idx").on(table.projectId),
    unique("task_project_number_unique").on(table.projectId, table.number),
  ],
);
```

Column naming is **camelCase in TS, snake_case in SQL** (`startDate` → `"start_date"`). IDs are
`text` + cuid2. Indexes are declared in the second callback as `<table>_<column>_idx`.

**Column types in use:** `text`, `integer`, `boolean`, `timestamp`, `jsonb`, plus a `bytea`
`customType`. There is **no `numeric` / `decimal` / `real` column anywhere in the schema**, and
`numeric` is not currently imported from `drizzle-orm/pg-core`. The closest precedent for a quantity
is `timeEntryTable.duration: integer("duration").default(0)`.

### Read-path projections

Read controllers use **explicit named projections**, not `select()`. `get-tasks.ts` defines a
`taskSelection` object literal and `get-task.ts` inlines the same field list. A new task column does
**not** reach the client until it is added to those projections.

### Web data flow

Strictly four layers, one file each:

1. `fetchers/<domain>/<verb>-<noun>.ts` — calls the typed client, throws on `!response.ok`:

```ts
import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

async function updateTask(taskId: string, task: Task) {
  const response = await client.task[":id"].$put({
    param: { id: taskId },
    json: { title: task.title, status: task.status, /* … */ },
  });
  if (!response.ok) throw new Error(await response.text());
  return await response.json();
}
export default updateTask;
```

2. `hooks/mutations/<domain>/use-<verb>-<noun>.ts` — `useMutation` + an explicit list of
   `queryClient.invalidateQueries` calls (`["task", id]`, `["tasks", projectId]`, `["projects"]`,
   `["activities", id]`, `["notifications"]`). Cache invalidation is enumerated by hand; copy the
   neighbouring hook's list.
3. `components/...` — a popover/control that calls `mutateAsync`, shows `toast.success` /
   `toast.error` with i18n keys, and gates on `useWorkspacePermission()`.
4. `types/task/index.ts` — a hand-maintained `Task` type with `string | null` dates (ISO strings on
   the wire, not `Date`).

The editable-field control pattern, verbatim in shape, from `task-due-date-popover.tsx`:

```tsx
export default function TaskDueDatePopover({ task, children }: TaskDueDatePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { mutateAsync: updateTaskDueDate } = useUpdateTaskDueDate();
  const { canUpdateTasks } = useWorkspacePermission();

  if (!canUpdateTasks()) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="p-0" align="start">{/* … */}</PopoverContent>
    </Popover>
  );
}
```

Note the **permission early-return that renders `children` unwrapped** when the user cannot edit —
that is the house pattern for read-only degradation.

### Test shape

Vitest everywhere. `describe` / `it` / `expect`, `vi.mock` for hooks.

- **API** (`tests/api/<area>/<name>.test.ts`, environment `node`) — imports the unit under test by
  relative path back into the app: `import { toSlug } from "../../../apps/api/src/column/controllers/create-column";`
  Pure-function and helper tests dominate; anything needing a database goes to
  `tests/api-integration/`.
- **Web** (colocated `src/**/<name>.test.tsx`, environment `jsdom`, setup `src/test/setup.ts`) —
  Testing Library, with every hook mocked at module level:

```tsx
vi.mock("@/hooks/mutations/task/use-update-task-status", () => ({
  useUpdateTaskStatus: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});
```

`react-i18next` is mocked to an identity `t`, so assertions are written against **raw i18n keys**,
not English strings.

### Config

Server config comes from the root `.env` via `dotenv-mono`; Vite-only overrides go in
`apps/web/.env.local`. API reads `process.env.*` through `apps/api/src/config`; web reads
`import.meta.env.VITE_*`. There is no Zod/envalid config validator — it is direct reads with
defaults.

### i18n

All user-facing copy uses static keys through `useTranslation()`. `i18n/en-US.json` is the source of
truth, with namespaces `common, auth, settings, navigation, notifications, activity, tasks,
invitations, workspace, team, publicProject`. 12+ locale files sit alongside it and are validated by
`pnpm i18n:check`. **Never inline a literal string into JSX.**

### Framework-owned wiring

- **New API route:** add a `.get/.post/.put/.delete` link to the existing chained builder in
  `apps/api/src/<feature>/index.ts`. The feature router is mounted once in `apps/api/src/index.ts`.
- **New web route:** create the file under `apps/web/src/routes/...`; `routeTree.gen.ts` is
  regenerated by the TanStack Router Vite plugin. Do not hand-edit it.
- **New DB column:** edit `schema.ts`, run `pnpm --filter @kaneo/api db:generate`, inspect the
  emitted SQL, commit both.
- **New permission:** extend `@kaneo/permissions` and enforce with `requireWorkspacePermission`.

---

## Sample files inspected

- `apps/api/src/task/index.ts` (routes + Valibot validators)
- `apps/api/src/task/controllers/get-tasks.ts` (read projection)
- `apps/api/src/task/controllers/get-task.ts` (read projection)
- `apps/api/src/task/controllers/create-task.ts` (write controller)
- `apps/api/src/task/controllers/update-task.ts` (write controller)
- `apps/api/src/task/controllers/export-tasks.ts` (projection)
- `apps/api/src/task/validate-task-fields.ts` (shared validation helpers)
- `apps/api/src/database/schema.ts` (`taskTable`, `timeEntryTable`)
- `apps/api/src/schemas.ts` (`taskSchema` OpenAPI response schema)
- `apps/api/drizzle.config.ts`, `apps/api/vitest.config.ts`
- `tests/api/column/to-slug.test.ts` (API test idiom)
- `apps/web/src/types/task/index.ts` (client `Task` type)
- `apps/web/src/fetchers/task/update-task.ts` (fetcher idiom)
- `apps/web/src/hooks/mutations/task/use-update-task-due-date.ts` (mutation hook idiom)
- `apps/web/src/components/task/task-due-date-popover.tsx` (editable-field control idiom)
- `apps/web/src/components/task/task-properties-sidebar.tsx` (task detail edit surface)
- `apps/web/src/components/kanban-board/index.tsx`, `column/index.tsx`, `column/column-header.tsx`
- `apps/web/src/hooks/use-task-filters-with-labels-support.ts` (board filtering)
- `apps/web/src/components/task/task-status-popover.test.tsx` (web test idiom)
- `apps/web/vitest.config.ts`, `turbo.json`, `pnpm-workspace.yaml`, `.husky/*`

---

## Notes for downstream codegen

- Import order is Biome-enforced. Insert new imports in sorted position or `biome ci` fails.
- Never inline user-facing strings; add keys to `i18n/en-US.json` under the right namespace and use
  `t("namespace:path.key")`.
- Adding a task field is a **six-file minimum** on the read path alone: `schema.ts`, a generated
  migration, `taskSelection` in `get-tasks.ts`, the projection in `get-task.ts`, `taskSchema` in
  `schemas.ts`, and the `Task` type in `apps/web/src/types/task/index.ts`.
- `updateTask` takes positional parameters. Append new ones as optional at the end rather than
  reordering, and update every call site.
- Valibot, not Zod, for API validation — `import * as v from "valibot"`.
- Web dates cross the wire as ISO strings and are typed `string | null`, while the API models them as
  `Date`. Match whichever side you are on.
- If a decimal column is needed, `numeric` must be newly imported from `drizzle-orm/pg-core`, and
  Drizzle returns `numeric` as a **string** in JS by default — any client-side arithmetic needs an
  explicit parse. The existing in-repo precedent for a quantity is an `integer`.
- Follow the mutation-hook invalidation list of the nearest sibling hook; it is hand-maintained and
  omissions produce stale boards.
- Web tests assert on raw i18n keys because `react-i18next` is mocked to an identity `t`.

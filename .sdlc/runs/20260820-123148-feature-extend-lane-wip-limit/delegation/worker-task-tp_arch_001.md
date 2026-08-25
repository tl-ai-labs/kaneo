## Task tp_arch_001 — architecture_design / delta_change_plan
Module: column
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
IMPORTANT: do NOT explore the repository. Every fact you need is in `inputs` below (an earlier attempt in this run burned its whole budget wandering the file tree and was killed). Make exactly ONE file write — create `.sdlc/runs/20260820-123148-feature-extend-lane-wip-limit/change_plan.md` — and perform ZERO file reads.

Task: write the DELTA CHANGE PLAN for adding an optional per-column WIP limit to Kaneo (indicator only, never enforced). Requirements are already approved; you are deciding HOW, not WHETHER. Delta = only what changes against the current code shown in inputs.

Sections, in this order:
1. `## Summary` — 5 lines max: what lands, and the one-sentence rationale for the board-projection change.
2. `## Change inventory` — a table with columns File | Change type (edit/new) | What changes | Requirement IDs. One row per file you touch. Every path MUST come from the WRITE CONTRACT ALLOWLIST input; if a change seems to need a file outside it, do not plan the change — record it under `## Contract conflicts` instead.
3. `## Data model` — the exact drizzle column definition line added to `columnTable`, the generated SQL you expect (`ALTER TABLE ... ADD COLUMN`), and why it is safe on a populated database. Name the generate command.
4. `## API contract` — for POST /column/:projectId and PUT /column/:id: the exact Valibot fragment added to each json validator, and the exact controller signature/`.set()` delta. State precisely how `null` (clear) is distinguished from omitted (leave unchanged), given the existing `data.field !== undefined` pattern.
5. `## Board payload projection` — the delta to the `projectColumns.map(...)` object in apps/api/src/task/controllers/get-tasks.ts. Show the resulting object literal in full. Call out in bold that `id: column.slug` is UNCHANGED and load-bearing.
6. `## Web data layer` — type deltas for the two fetchers and the two mutation hooks. Note explicitly whether `packages/libs` needs any edit and justify the answer from the inputs.
7. `## UI design` — the ColumnHeader delta: badge rendering rule for null vs set vs exceeded, which existing permission helper gates the editor, the control pattern (popover + number input + clear + save), local state, which mutation it calls and with which id, and the empty/clear semantics. Give the i18n key names you will use and their English strings.
8. `## Type flow` — trace `wipLimit` from columnTable through AppType, the hono client, ProjectWithTasks, into ColumnHeader, and state where inference makes an explicit type edit unnecessary.
9. `## ADRs` — 3 to 5 short records, each `**ADR-n: <decision>** — Context / Decision / Consequence / Alternative rejected`. Cover at minimum: additive `columnId` vs re-pointing `id`; extending the board projection vs a second columns query; nullable-no-default vs default 0.
10. `## Invariants for review` — bullet list a senior reviewer can check mechanically. Must include the `id: column.slug` invariant and indicator-only (no blocking anywhere).
11. `## Test plan` — per changed surface: what is tested and with which command from the acceptance criteria.
12. `## Contract conflicts` — list any needed change whose file is not in the allowlist, or write `None.`

Rules: be concrete — real identifiers, real paths, real snippets, no placeholders. Do not restate requirements prose. Do not plan enforcement/blocking behavior anywhere. Do not plan any new database table, permission, route, or realtime event.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260820-123148-feature-extend-lane-wip-limit/requirements.md
_Included because: Approved delta requirements — condensed to the FR/NFR list, the acceptance criteria, and the Gate 1 decision that resolved both blockers. This is the contract your plan must satisfy._

```
IN SCOPE: nullable integer wipLimit on column schema; POST/PUT column contract accepts+persists+returns it; web fetchers/hooks carry it; Kanban column header shows count vs limit; over-capacity styling; inline editor for users with project:update; static i18n keys.
OUT OF SCOPE: any enforcement/blocking of task create/move; global or swimlane limits; history/analytics; new tables; new WebSocket event types; editing i18n/schema.json; changing archive/drag-drop/virtual-status behavior.

FUNCTIONAL REQUIREMENTS
- FR-1 apps/api/src/database/schema.ts — add nullable integer column wipLimit (integer("wip_limit")) to columnTable.
- FR-2 apps/api/src/column/index.ts — POST /:projectId validator accepts optional positive integer or null wipLimit.
- FR-3 apps/api/src/column/index.ts — PUT /:id validator accepts optional nullable integer wipLimit.
- FR-4 apps/api/src/column/controllers/create-column.ts — accept wipLimit in typed params and insert it.
- FR-5 apps/api/src/column/controllers/update-column.ts — partial update: integer sets, explicit null clears, omitted leaves unchanged.
- FR-6 apps/api/src/column/controllers/get-columns.ts — wipLimit returned in the project column list.
- FR-7 apps/web/src/fetchers/column/create-column.ts and update-column.ts — payload types include optional/nullable wipLimit.
- FR-8 apps/web/src/hooks/mutations/column/use-create-column.ts and use-update-column.ts — mutation param types support wipLimit; preserve existing invalidations of ["columns", projectId] and ["tasks", projectId].
- FR-9 column-header.tsx — badge shows <count>/<wipLimit> when wipLimit is a positive integer.
- FR-10 column-header.tsx — over-capacity styling when tasks.length > wipLimit.
- FR-11 column-header.tsx — inline control to set/update/clear wipLimit.
- FR-12 column-header.tsx — that control is restricted to users with project:update.
- FR-13 i18n/en-US.json — static keys under tasks.kanban for tooltip, edit trigger, placeholder, exceeded status.
- FR-14 apps/api/src/task/controllers/get-tasks.ts — add wipLimit to the board column projection.
- FR-15 apps/api/src/task/controllers/get-tasks.ts — add columnId: column.id to the board column projection, leaving id: column.slug unchanged.
- FR-16 column-header.tsx — the inline editor updates against column.columnId, never column.id.

NON-FUNCTIONAL
- NFR-1 migration nullable, no default, no backfill; safe on populated DBs.
- NFR-2 when wipLimit is null, rendering and behavior are byte-identical to today.
- NFR-3 all UI text via static i18n keys, no runtime key construction.
- NFR-4 no new permission scope; reuse requireWorkspacePermission({ project: ["update"] }).
- NFR-5 indicator only — task creation, status update and drag-drop are never blocked or rejected.
- NFR-6 no new realtime event type or topic; rely on existing query-key invalidation.
- NFR-7 end-to-end type safety, no untyped request layer, no loose assertions.

GATE 1 DECISION (user-approved, binding)
- Blocker 1 -> Option A: extend the get-tasks.ts board column projection with wipLimit. No second columns query on board load.
- Blocker 2 -> Option A: add a DISTINCT columnId: column.id (the columnTable UUID) to the same projection.
- R-3 INVARIANT: the existing id: column.slug assignment stays exactly as-is. It is load-bearing for getColumnIcon(column.id, ...) and for CreateTaskModal status={column.id}. Re-pointing id at the UUID is a regression.
- Write contract was extended by the user to add apps/api/src/task/controllers/get-tasks.ts. Nothing else changed.

ACCEPTANCE CRITERIA (each maps to a verification command)
1. Migration applies cleanly on a non-empty DB; wip_limit nullable. -> pnpm --filter @kaneo/api test
2. POST /column/:projectId persists an integer wipLimit and returns the created column. -> pnpm --filter @kaneo/api test
3. PUT /column/:id sets on integer, clears on explicit null, leaves unchanged on omit. -> pnpm --filter @kaneo/api test
4. PUT /column/:id returns 403 without project:update. -> pnpm --filter @kaneo/api test
5. Fetchers and hooks typecheck with wipLimit. -> pnpm typecheck
6. wipLimit null -> badge renders exactly today's count-only output. -> pnpm --filter @kaneo/web test + manual
7. wipLimit 5, count 3 -> renders 3/5, no warning styling. -> pnpm --filter @kaneo/web test + manual
8. wipLimit 5, count 6 -> renders 6/5 with over-capacity styling. -> pnpm --filter @kaneo/web test + manual
9. Adding/moving a task into an over-capacity column still succeeds. -> manual
10. project:update user can open the inline editor, submit, and see the header update. -> manual
11. user without project:update cannot see or activate the control. -> manual
12. GET /task/tasks/:projectId returns id === slug, plus distinct columnId UUID and wipLimit (null when unset). -> pnpm --filter @kaneo/api test
13. Column icon resolution and task-creation status prefill are unregressed. -> pnpm --filter @kaneo/web test + manual
```

#### .sdlc/local/write-contract.json
_Included because: WRITE CONTRACT ALLOWLIST (frozen, strict). Every path in your Change inventory must appear here. Anything else goes under Contract conflicts._

```
ALLOWLIST (the only writable paths):
  apps/api/src/database/schema.ts
  apps/api/drizzle/**
  apps/api/src/column/index.ts
  apps/api/src/column/controllers/create-column.ts
  apps/api/src/column/controllers/update-column.ts
  apps/api/src/column/controllers/get-columns.ts
  apps/api/src/task/controllers/get-tasks.ts   <-- added at Gate 1
  packages/libs/src/**
  apps/web/src/fetchers/column/create-column.ts
  apps/web/src/fetchers/column/update-column.ts
  apps/web/src/fetchers/column/get-columns.ts
  apps/web/src/hooks/mutations/column/use-update-column.ts
  apps/web/src/hooks/mutations/column/use-create-column.ts
  apps/web/src/components/kanban-board/column/column-header.tsx
  apps/web/src/components/kanban-board/column/index.tsx
  i18n/en-US.json
  .gitignore
  .sdlc/**

NOTABLY OFF LIMITS: apps/api/src/database/relations.ts, apps/web/src/routeTree.gen.ts, i18n/schema.json, AGENTS.md, CLAUDE.md, pnpm-lock.yaml, .env*.
NOT IN THE ALLOWLIST (so cannot be edited): apps/web/src/types/project/index.ts, apps/web/src/lib/column.ts, apps/web/src/components/kanban-board/column/column-dropzone.tsx, any test directory (tests/api, tests/api-integration).
```

#### apps/api/src/database/schema.ts
_Included because: columnTable as it exists today. `integer` is already imported from drizzle-orm/pg-core in this file. Migrations: pnpm --filter @kaneo/api db:generate, output lands in apps/api/drizzle/._

```
export const columnTable = pgTable(
  "column",
  {
    id: text("id").$defaultFn(() => createId()).primaryKey(),
    projectId: text("project_id").notNull().references(() => projectTable.id, { onDelete: "cascade", onUpdate: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    position: integer("position").notNull().default(0),
    icon: text("icon"),
    color: text("color"),
    isFinal: boolean("is_final").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [ /* existing indexes, unchanged */ ],
);
```

#### apps/api/src/column/index.ts
_Included because: Current Hono routes. Note the PUT validator already uses v.optional(v.nullable(...)) for icon and color — that is the established nullable-clear pattern to follow. Both mutating routes are guarded by requireWorkspacePermission({ project: ["update"] })._

```
// POST /:projectId — operationId createColumn, tags ["Columns"]
validator("param", v.object({ projectId: v.string() })),
validator(
  "json",
  v.object({
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    isFinal: v.optional(v.boolean()),
  }),
),
workspaceAccess.fromProject("projectId"),
requireWorkspacePermission({ project: ["update"] }),
async (c) => {
  const { projectId } = c.req.valid("param");
  const { name, icon, color, isFinal } = c.req.valid("json");
  const result = await createColumn({ projectId, name, icon, color, isFinal });
  return c.json(result);
},

// PUT /:id — operationId updateColumn, tags ["Columns"]
validator("param", v.object({ id: v.string() })),
validator(
  "json",
  v.object({
    name: v.optional(v.string()),
    icon: v.optional(v.nullable(v.string())),
    color: v.optional(v.nullable(v.string())),
    isFinal: v.optional(v.boolean()),
  }),
),
workspaceAccess.fromColumn("id"),
requireWorkspacePermission({ project: ["update"] }),
async (c) => {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const result = await updateColumn(id, data);
  return c.json(result);
},

// GET /:projectId is workspaceAccess.fromProject only (no project:update needed to read).
// All column responses currently declare schema: resolver(v.any()).
// Imports at top: valibot as v; describeRoute, resolver, validator from hono-openapi.
```

#### apps/api/src/column/controllers/create-column.ts
_Included because: createColumn today — the typed param object and the .values() insert you extend._

```
async function createColumn({ projectId, name, icon, color, isFinal }: {
  projectId: string;
  name: string;
  icon?: string;
  color?: string;
  isFinal?: boolean;
}) {
  const slug = toSlug(name);
  // ... 400 on empty slug, 409 on reserved VIRTUAL_STATUSES, 409 on duplicate slug ...
  const position = (maxPos?.maxPosition ?? -1) + 1;
  const [created] = await db.insert(columnTable).values({
    projectId, name, slug, position,
    icon: icon || null,
    color: color || null,
    isFinal: isFinal ?? false,
  }).returning();
  if (!created) throw new HTTPException(500, { message: "Failed to create column" });
  return created;
}
```

#### apps/api/src/column/controllers/update-column.ts
_Included because: updateColumn today — the exact partial-update idiom to extend. Note the spread-guard pattern keys off !== undefined, which is what makes explicit null mean 'clear'._

```
async function updateColumn(
  id: string,
  data: { name?: string; icon?: string | null; color?: string | null; isFinal?: boolean },
) {
  const existing = await db.query.columnTable.findFirst({ where: eq(columnTable.id, id) });
  if (!existing) throw new HTTPException(404, { message: "Column not found" });

  const [updated] = await db.update(columnTable).set({
    ...(data.name !== undefined && { name: data.name }),
    ...(data.icon !== undefined && { icon: data.icon }),
    ...(data.color !== undefined && { color: data.color }),
    ...(data.isFinal !== undefined && { isFinal: data.isFinal }),
  }).where(eq(columnTable.id, id)).returning();

  if (!updated) throw new HTTPException(500, { message: "Failed to update column" });
  return updated;
}
```

#### apps/api/src/column/controllers/get-columns.ts
_Included because: getColumns today — a bare select() with no explicit projection, so a new table column flows through with no edit. Decide and state whether FR-6 therefore needs any change at all._

```
async function getColumns(projectId: string) {
  const columns = await db
    .select()
    .from(columnTable)
    .where(eq(columnTable.projectId, projectId))
    .orderBy(asc(columnTable.position));
  return columns;
}
```

#### apps/api/src/task/controllers/get-tasks.ts
_Included because: THE board payload projection (around line 218-236) — the file added to the allowlist at Gate 1. This explicit object literal is why wipLimit and the UUID do not reach the board today._

```
const projectColumns = await db
  .select()
  .from(columnTable)
  .where(eq(columnTable.projectId, projectId))
  .orderBy(asc(columnTable.position));

const columns = projectColumns.map((column) => ({
  id: column.slug,
  slug: column.slug,
  name: column.name,
  icon: column.icon,
  isFinal: column.isFinal,
  tasks: paginatedTasks
    .filter((task) => task.status === column.slug)
    .map((task) => ({
      ...task,
      labels: taskLabelsMap.get(task.id) || [],
      externalLinks: taskExternalLinksMap.get(task.id) || [],
    })),
}));

// Elsewhere in the same controller: archivedTasks is built from paginatedTasks where status === "archived". Do not touch it.
```

#### apps/web/src/fetchers/column/create-column.ts + update-column.ts + get-columns.ts
_Included because: The three fetchers. get-columns has no payload type at all, so judge whether it needs an edit._

```
// create-column.ts
async function createColumn(projectId: string, data: { name: string; icon?: string; color?: string; isFinal?: boolean }) {
  const response = await client.column[":projectId"].$post({ param: { projectId }, json: data });
  if (!response.ok) { const error = await response.text(); throw new Error(error); }
  return response.json();
}

// update-column.ts
async function updateColumn(id: string, data: { name?: string; icon?: string | null; color?: string | null; isFinal?: boolean }) {
  const response = await client.column[":id"].$put({ param: { id }, json: data });
  if (!response.ok) { const error = await response.text(); throw new Error(error); }
  return response.json();
}

// get-columns.ts — takes only projectId, has no data payload type.
async function getColumns(projectId: string) {
  const response = await client.column[":projectId"].$get({ param: { projectId } });
  if (!response.ok) { const error = await response.text(); throw new Error(error); }
  return response.json();
}
```

#### apps/web/src/hooks/mutations/column/use-update-column.ts + use-create-column.ts
_Included because: The two mutation hooks. use-update-column already invalidates both query keys the requirements demand be preserved; use-create-column invalidates everything._

```
// use-update-column.ts
export function useUpdateColumn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: {
      id: string;
      projectId: string;
      data: { name?: string; icon?: string | null; color?: string | null; isFinal?: boolean };
    }) => updateColumn(id, data),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["columns", variables.projectId], refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId], refetchType: "all" }),
      ]);
    },
  });
}

// use-create-column.ts
export function useCreateColumn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: { name: string; icon?: string; color?: string; isFinal?: boolean } }) => createColumn(projectId, data),
    onSuccess: async () => { await queryClient.invalidateQueries({ refetchType: "all" }); },
  });
}
```

#### apps/web/src/components/kanban-board/column/column-header.tsx
_Included because: THE file the UI delta lands in, complete. Note line 57 getColumnIcon(column.id,...) and line 94 status={column.id} — both depend on column.id being the SLUG. Note the existing count badge classes on lines 62-64, and that useWorkspacePermission is already imported and destructured here._

```
import { produce } from "immer";
import { Archive, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { getColumnIcon } from "@/lib/column";
import { toast } from "@/lib/toast";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import { ArchiveTasksModal } from "../../shared/modals/archive-tasks-modal";

type ColumnHeaderProps = { column: ProjectWithTasks["columns"][number] };

export function ColumnHeader({ column }: ColumnHeaderProps) {
  const { t } = useTranslation();
  const { project, setProject } = useProjectStore();
  const { mutate: updateTask } = useUpdateTask();
  const { canUpdateTasks, canCreateTasks } = useWorkspacePermission();
  const canTask = canUpdateTasks();
  const canCreate = canCreateTasks();

  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const handleConfirmArchive = () => { /* unchanged: archives every task in a final column */ };

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-muted-foreground">
          {getColumnIcon(column.id, column.isFinal, column.icon)}
        </span>
        <span className="truncate text-sm font-medium text-foreground/95">{column.name}</span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          {column.tasks.length}
        </span>
      </div>

      <div className="flex items-center">
        {canTask && column.isFinal && column.tasks.length > 0 && (
          <button type="button" onClick={() => setIsArchiveModalOpen(true)} className="flex items-center rounded-md px-2 py-1 text-left text-muted-foreground transition-colors hover:bg-accent/50" title={t("tasks:listView.archiveAllTooltip")}>
            <Archive className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
        {canCreate && (
          <button type="button" onClick={() => setIsTaskModalOpen(true)} className="flex items-center rounded-md px-2 py-1 text-left text-muted-foreground transition-colors hover:bg-accent/50" title={t("tasks:kanban.addTask")}>
            <Plus className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      <CreateTaskModal open={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} projectId={project?.id} status={column.id} />
      <ArchiveTasksModal open={isArchiveModalOpen} onClose={() => setIsArchiveModalOpen(false)} onConfirm={handleConfirmArchive} taskCount={column.tasks.length} />
    </div>
  );
}
```

#### apps/web/src/hooks/use-workspace-permission.ts
_Included because: The permission hook. It ALREADY has an updateProjects capability mapped to { project: ["update"] }, exposed as canUpdateProjects(). No new capability is needed — NFR-4. This file is NOT in the allowlist, so your plan must use what already exists here._

```
const CAPABILITIES = {
  manageProjects: { project: ["create", "update", "delete"] },
  createProjects: { project: ["create"] },
  updateProjects: { project: ["update"] },   // <-- exposed as canUpdateProjects()
  deleteProjects: { project: ["delete"] },
  updateTasks: { task: ["update"] },
  createTasks: { task: ["create"] },
  // ... more ...
} as const;

// Returned helpers include: canManageProjects(), canCreateProjects(), canUpdateProjects(),
// canDeleteProjects(), canUpdateTasks(), canCreateTasks(), ...
// Also returns isCheckingPermissions (true while the first capability fetch is in flight —
// useful for not flashing an action control on then off).
```

#### apps/web/src/components/kanban-board/column/index.tsx
_Included because: The Column wrapper — it passes `column` straight through to ColumnHeader and ColumnDropzone. Both take ProjectWithTasks["columns"][number]. Judge whether this file needs any edit at all._

```
type ColumnProps = { column: ProjectWithTasks["columns"][number]; disableDragDrop?: boolean };

function Column({ column, disableDragDrop = false }: ColumnProps) {
  const [isDropzoneOver, setIsDropzoneOver] = useState(false);
  return (
    <div className={/* border/bg classes, isDropzoneOver toggles ring */}>
      <div className="shrink-0 border-b border-border/60 px-3 py-2">
        <ColumnHeader column={column} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-1">
        <ColumnDropzone column={column} disableDragDrop={disableDragDrop} onIsOverChange={setIsDropzoneOver} />
      </div>
    </div>
  );
}
```

#### apps/web/src/types/project/index.ts + packages/libs/src/hono.ts
_Included because: Why the type flow is inference-only. ProjectWithTasks is INFERRED from the get-tasks response via the typed client, and the client is generated from AppType. project/index.ts is NOT in the allowlist — your plan must rely on inference rather than editing it._

```
// packages/libs/src/hono.ts
import type { AppType } from "@kaneo/api";
import { hc } from "hono/client";
export const client = hc<AppType>(apiUrl, { /* fetch wrapper: credentials include, X-Kaneo-Window-Id */ });
// packages/libs/src/index.ts exports only { resolveApiBaseUrl, client, windowId } — no per-route types.

// apps/web/src/types/project/index.ts (NOT WRITABLE)
// ProjectWithTasks is derived by InferResponseType from client.task.tasks[":projectId"].$get,
// so board column fields follow get-tasks.ts automatically once the projection changes.
```

#### i18n/en-US.json
_Included because: Current translation file. The tasks.kanban namespace holds exactly one key today. Components call it as t("tasks:kanban.addTask") — namespace separated by a colon, path by dots. i18n/schema.json is OFF LIMITS and must not be planned for._

```
Top-level namespaces: common, auth, settings, navigation, notifications, activity, tasks, invitations, workspace, team, publicProject.

"tasks": {
  "kanban": { "addTask": "Add task" },
  "listView": { "archiveAllTooltip": "...", ... },
  "archive": { "success": "..." },
  ...
}

Usage in components: t("tasks:kanban.addTask"), t("tasks:listView.archiveAllTooltip"), t("tasks:archive.success", { count }).
```

#### AGENTS.md
_Included because: House rules the plan must obey (this file is off-limits for writing, but binding on design)._

```
- API is the authority for authz; hiding an action in the UI is not an authorization check.
- Validate API inputs with Valibot; use HTTPException for expected HTTP failures.
- Use requireWorkspacePermission rather than duplicating role checks.
- Keep handlers thin; domain behavior in controllers.
- Web requests live in apps/web/src/fetchers/; server state in TanStack Query hooks; use the @kaneo/libs client, never a parallel untyped request layer.
- Schema in apps/api/src/database/schema.ts, relations in relations.ts (relations.ts is OFF LIMITS this run — do not plan a relation change).
- Generate migrations with pnpm --filter @kaneo/api db:generate, inspect the SQL, commit it with the schema change.
- Prefer inferred types and `type` over `interface`.
- Database changes must work for existing installations, not just empty dev databases.
- User-facing web copy must use static i18n keys; i18n/en-US.json is the source of truth.
- Public API behavior must retain accurate Valibot validation and OpenAPI metadata.
- Comments explain constraints or surprising decisions, not narrate code.
- Stay focused: no speculative features, no broad refactors, no unrelated cleanup.
```
### Acceptance criteria
- Exactly one file was written: .sdlc/runs/20260820-123148-feature-extend-lane-wip-limit/change_plan.md
- All 12 required sections are present, in the specified order, with the specified headings
- Every path in the Change inventory appears in the write-contract allowlist input
- The Board payload projection section shows the full resulting object literal and states in bold that id: column.slug is unchanged
- The API contract section states exactly how explicit null is distinguished from an omitted field
- At least 3 ADRs are present, including additive columnId vs re-pointing id, and extending the projection vs a second columns query
- The Invariants section includes the id-is-the-slug invariant and indicator-only/no-blocking
- No enforcement, new table, new permission, new route, or new realtime event is planned anywhere
- i18n keys are named concretely under tasks.kanban with their English strings
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "artifact_written": {
      "type": "string",
      "description": "Path of the single file written"
    },
    "files_changed_count": {
      "type": "number",
      "description": "Number of rows in the Change inventory table"
    },
    "contract_conflicts": {
      "type": "number",
      "description": "Count of entries under Contract conflicts; 0 if None"
    }
  },
  "required": [
    "artifact_written",
    "files_changed_count",
    "contract_conflicts"
  ]
}
```
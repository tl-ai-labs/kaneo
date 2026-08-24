## Task tp_req_002 — requirements_analysis / delta_requirements
Module: column
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
IMPORTANT: do NOT explore the repository. Every fact you need is already in `inputs` below (a previous attempt timed out wandering the file tree). Use exactly one file-write to produce the artifact, and no file reads at all.

Task: write a DELTA requirements document for adding an optional per-lane WIP limit to Kaneo columns (indicator only, no enforcement). Delta = what changes relative to the current behavior shown in the inputs; do not restate the whole product.

Sections, in this order:
1. `## In scope` — numbered, testable.
2. `## Out of scope` — numbered (carry the brief's non-goals).
3. `## Current behavior (delta baseline)` — per input file, the exact shape today, quoting the real identifiers from the slices.
4. `## Functional requirements` — FR-1..n grouped under `### api-schema`, `### api-contract`, `### web-data`, `### web-ui`, `### i18n`; each FR names its target file and is independently verifiable.
5. `## Non-functional requirements` — NFR-1..n covering: migration safe on non-empty existing DBs (nullable, no backfill), zero behavior change when wipLimit is null, static i18n keys only, no new permission (reuse project:update), indicator-only/no blocking, no new realtime event type, no untyped request layer.
6. `## PII inventory` — table field|sensitivity|protection; wipLimit is a non-personal integer, state that plainly and note no new PII is introduced.
7. `## Role matrix` — role x resource x action, reusing the existing requireWorkspacePermission({project:['update']}) gate that already guards column create/update.
8. `## Acceptance criteria` — numbered, executable, each mapped to a verification command (`pnpm --filter @kaneo/api test`, `pnpm --filter @kaneo/web test`, `pnpm typecheck`) or a manual UI check.
9. `## Open questions for HITL` — you MUST lead this section with the two blockers described in the `ORCHESTRATOR FINDINGS` input, each stated as a decision the user has to make, with the concrete options and the scope consequence of each (both touch a file outside the frozen allowlist). Add any further genuine ambiguities you find, and say explicitly if there are none beyond those two.

Rules: no implementation code, no SQL, no TypeScript in the document — design is the next phase. Reference files by repo-relative path. Keep it tight and specific; every requirement must be checkable.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/api/src/database/schema.ts
_Included because: columnTable definition as it exists today (lines 342-366) — the wipLimit column is added here._

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
  (table) => [ /* indexes */ ],
);
// NOTE: drizzle-orm/pg-core; `integer` is already imported in this file. Migrations are generated with `pnpm --filter @kaneo/api db:generate` and land in apps/api/drizzle/.
```

#### apps/api/src/column/index.ts
_Included because: Hono route + hono-openapi describeRoute + Valibot validators for create (POST /:projectId) and update (PUT /:id). Both are guarded by requireWorkspacePermission({project:['update']}). Response schemas are currently resolver(v.any())._

```
// POST /:projectId  (operationId createColumn, tags ["Columns"], description "Create a new column in a project")
validator("json", v.object({
  name: v.string(),
  icon: v.optional(v.string()),
  color: v.optional(v.string()),
  isFinal: v.optional(v.boolean()),
})),
workspaceAccess.fromProject("projectId"),
requireWorkspacePermission({ project: ["update"] }),
async (c) => {
  const { projectId } = c.req.valid("param");
  const { name, icon, color, isFinal } = c.req.valid("json");
  const result = await createColumn({ projectId, name, icon, color, isFinal });
  return c.json(result);
}

// PUT /:id  (operationId updateColumn, tags ["Columns"], description "Update a column")
validator("json", v.object({
  name: v.optional(v.string()),
  icon: v.optional(v.nullable(v.string())),
  color: v.optional(v.nullable(v.string())),
  isFinal: v.optional(v.boolean()),
})),
workspaceAccess.fromColumn("id"),
requireWorkspacePermission({ project: ["update"] }),
async (c) => {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const result = await updateColumn(id, data);
  return c.json(result);
}

// GET /:projectId (operationId getColumns) returns await getColumns(projectId) verbatim.
// All five routes (get, post, put /reorder/:projectId, put /:id, delete /:id) currently declare 200 responses as resolver(v.any()).
```

#### apps/api/src/column/controllers/create-column.ts
_Included because: Insert path — shows the typed params object and the .values({...}) insert that wipLimit must join._

```
async function createColumn({ projectId, name, icon, color, isFinal }: { projectId: string; name: string; icon?: string; color?: string; isFinal?: boolean; }) {
  const slug = toSlug(name);
  // 400 if slug empty; 409 if slug is a VIRTUAL_STATUS; 409 if slug already exists in project
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
_Included because: Update path — the partial-update pattern (`...(data.x !== undefined && { x: data.x })`) that wipLimit must follow so that explicit null clears it and absent leaves it untouched._

```
async function updateColumn(id: string, data: { name?: string; icon?: string | null; color?: string | null; isFinal?: boolean; }) {
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
_Included because: Whole file — already `db.select()` with no column projection, so it returns wipLimit for free once the schema has it._

```
async function getColumns(projectId: string) {
  const columns = await db.select().from(columnTable).where(eq(columnTable.projectId, projectId)).orderBy(asc(columnTable.position));
  return columns;
}
```

#### apps/api/src/task/controllers/get-tasks.ts
_Included because: BLOCKER EVIDENCE 1 & 2 — lines 224-237. This is the endpoint the BOARD actually renders from, and it hand-picks column fields. It is NOT in this run's write-contract allowlist._

```
const projectColumns = await db.select().from(columnTable).where(eq(columnTable.projectId, projectId)).orderBy(asc(columnTable.position));

const columns = projectColumns.map((column) => ({
  id: column.slug,        // <-- the board's column.id IS THE SLUG, not columnTable.id
  slug: column.slug,
  name: column.name,
  icon: column.icon,      // <-- note: `color` is already dropped here today
  isFinal: column.isFinal,
  tasks: paginatedTasks.filter((task) => task.status === column.slug).map(...),
}));

return { data: { id, name, slug, icon, description, isPublic, workspaceId, columns, archivedTasks, plannedTasks }, pagination: ... };
```

#### apps/web/src/types/project/index.ts
_Included because: BLOCKER EVIDENCE — proves ColumnHeader's column type is inferred from the TASK endpoint response, not from getColumns._

```
type TasksApiResponse = InferResponseType<(typeof client)["task"]["tasks"][":projectId"]["$get"], 200>;
type ProjectWithTasksRaw = TasksApiResponse["data"];
export type ProjectWithTasks = Omit<ProjectWithTasksRaw, "archivedTasks" | "columns" | "plannedTasks"> & {
  archivedTasks: Task[];
  columns: Array<Omit<ProjectWithTasksRaw["columns"][number], "tasks"> & { tasks: Task[] }>;
  plannedTasks: Task[];
};
// Types are INFERRED from the Hono client (packages/libs) — nothing is hand-declared, so packages/libs likely needs no edit.
```

#### apps/web/src/fetchers/column/update-column.ts
_Included because: Typed-client call whose `data` param must gain wipLimit. create-column.ts and get-columns.ts follow the identical shape._

```
async function updateColumn(id: string, data: { name?: string; icon?: string | null; color?: string | null; isFinal?: boolean; }) {
  const response = await client.column[":id"].$put({ param: { id }, json: data });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
// create-column.ts: createColumn(projectId, data: { name: string; icon?: string; color?: string; isFinal?: boolean })
//   -> client.column[":projectId"].$post({ param, json: data })
// get-columns.ts: client.column[":projectId"].$get({ param: { projectId } })
```

#### apps/web/src/hooks/mutations/column/use-update-column.ts
_Included because: TanStack mutation whose variables type must gain wipLimit; already invalidates both columns and tasks query keys._

```
export function useUpdateColumn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; projectId: string; data: { name?: string; icon?: string | null; color?: string | null; isFinal?: boolean } }) => updateColumn(id, data),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["columns", variables.projectId], refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId], refetchType: "all" }),
      ]);
    },
  });
}
// use-create-column.ts mirrors this with data: { name: string; icon?: string; color?: string; isFinal?: boolean } and a blanket invalidateQueries({ refetchType: "all" }).
```

#### apps/web/src/components/kanban-board/column/column-header.tsx
_Included because: The 'LaneHeader' — whole file, 105 lines. The task-count badge is the element the inline WIP editor and over-cap indicator attach to._

```
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
  const handleConfirmArchive = () => { /* immer produce over project.columns, updateTask -> status archived, toast t("tasks:archive.success", { count }) */ };

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-muted-foreground">{getColumnIcon(column.id, column.isFinal, column.icon)}</span>
        <span className="truncate text-sm font-medium text-foreground/95">{column.name}</span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">{column.tasks.length}</span>
      </div>
      <div className="flex items-center">
        {canTask && column.isFinal && column.tasks.length > 0 && (<button ... title={t("tasks:listView.archiveAllTooltip")}><Archive/></button>)}
        {canCreate && (<button ... title={t("tasks:kanban.addTask")}><Plus/></button>)}
      </div>
      <CreateTaskModal open={isTaskModalOpen} ... projectId={project?.id} status={column.id} />
      <ArchiveTasksModal open={isArchiveModalOpen} ... taskCount={column.tasks.length} />
    </div>
  );
}
// Permission hook available: useWorkspacePermission(). It exposes canUpdateTasks/canCreateTasks here; whichever member corresponds to project:update is what should gate the WIP editor.
```

#### apps/web/src/components/kanban-board/column/index.tsx
_Included because: Parent — passes the whole `column` object down, so no prop-threading change is needed if ColumnHeader reads column.wipLimit directly._

```
type ColumnProps = { column: ProjectWithTasks["columns"][number]; disableDragDrop?: boolean };
function Column({ column, disableDragDrop = false }: ColumnProps) {
  const [isDropzoneOver, setIsDropzoneOver] = useState(false);
  return (<div ...><div className="shrink-0 border-b border-border/60 px-3 py-2"><ColumnHeader column={column} /></div><div ...><ColumnDropzone column={column} disableDragDrop={disableDragDrop} onIsOverChange={setIsDropzoneOver} /></div></div>);
}
```

#### i18n/en-US.json
_Included because: i18n source of truth — structure and existing key conventions for the new copy._

```
Top-level namespaces: common, auth, settings, navigation, notifications, activity, tasks, invitations, workspace, team, publicProject.
Existing keys used by ColumnHeader today:
  tasks.kanban = { "addTask": "Add task" }
  tasks.listView = { "addTask": ..., "archiveAllTooltip": ..., "noTasks": ... }
  tasks.archive.success (interpolates {{count}})
Usage form in code: t("tasks:kanban.addTask") — namespace separated by ':', nested path by '.'.
NOTE: i18n/schema.json is GENERATED and off-limits for this run; only i18n/en-US.json may be edited.
```

#### ORCHESTRATOR FINDINGS
_Included because: Two blockers found while assembling this packet. Section 9 of the document must lead with these._

```
BLOCKER 1 — the board cannot see wipLimit without editing an out-of-scope file.
ColumnHeader's `column` type is inferred from the TASK endpoint (GET /task/tasks/:projectId), whose controller apps/api/src/task/controllers/get-tasks.ts explicitly projects only { id, slug, name, icon, isFinal, tasks } (proof: it already drops `color`). Adding wipLimit to columnTable and to the /column endpoints therefore does NOT make it reach the board. get-tasks.ts is NOT in this run's frozen write-contract allowlist, so a packet targeting it would be rejected at dispatch and refused by the PreToolUse hook.
Options to present: (a) extend the allowlist with apps/api/src/task/controllers/get-tasks.ts, limited to adding wipLimit (and columnId, see blocker 2) to that projection object; (b) have ColumnHeader fetch columns separately via the existing GET /column/:projectId + a columns query hook, leaving get-tasks.ts untouched but adding a second request per board; (c) descope the over-cap indicator to a surface that already reads getColumns.

BLOCKER 2 — the inline editor has no column id to PUT to.
PUT /column/:id takes columnTable.id, but in the board payload `column.id` IS the slug (get-tasks.ts line 225: `id: column.slug`). ColumnHeader has no access to the real column id, so an inline save cannot address the row. Also note getColumnIcon(column.id, ...) and CreateTaskModal status={column.id} both depend on that id-is-slug behavior, so the field must not be repurposed.
Options to present: (a) add a distinct `columnId: column.id` field to the get-tasks projection alongside wipLimit (same allowlist extension as blocker 1, additive, no existing consumer changes); (b) resolve the id client-side by matching slug against a separate columns query; (c) add a slug-addressed update route (larger API surface change, not recommended).

Both blockers are scope decisions for the user, not design choices. Do not pick one — present them.
```
### Acceptance criteria
- All nine sections present, in the specified order, with the specified headings
- Every FR names its target repo-relative file and is independently verifiable
- Current-behavior section quotes only identifiers present in the inputs; nothing invented
- No code, SQL or TypeScript appears in the document
- Open questions lead with the two ORCHESTRATOR FINDINGS blockers, each with options and scope consequence
- scope_change_requested lists apps/api/src/task/controllers/get-tasks.ts
- Artifact written to .sdlc/runs/20260820-123148-feature-extend-lane-wip-limit/requirements.md
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "requirements_markdown": {
      "type": "string",
      "description": "The complete requirements document in markdown, all 9 sections."
    },
    "open_questions": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "One entry per open question, blockers first."
    },
    "scope_change_requested": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Repo-relative paths that the requirements imply are needed but are absent from the frozen allowlist."
    }
  },
  "required": [
    "requirements_markdown",
    "open_questions",
    "scope_change_requested"
  ]
}
```
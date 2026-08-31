## Task tp_design_001 — architecture_design / delta_change_plan
Module: estimated-hours
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Write a DELTA change plan to .sdlc/runs/20260831-092456-feature-extend-estimated-hours/change_plan.md for the estimated-hours feature.

Read .sdlc/runs/20260831-092456-feature-extend-estimated-hours/requirements.md first. The DESIGN_CONSTRAINTS input below is authoritative and already verified against source — obey it exactly and do NOT re-derive it. The other inputs are real repo excerpts showing the patterns to imitate.

Do NOT modify any file except change_plan.md. Do not run git commands. Read at most 6 additional files; prefer the excerpts given.

Required sections:
1. Decisions and rationale (ADR-style, one short block per decision: storage unit, endpoint shape, validation placement, badge format, rollup placement, i18n key layout). Record explicitly that requirements FR-3 was defective (it specified v.optional(v.nullable(v.number())), which admits 2.5 on the read path while FR-4 correctly constrains the write path) and that this plan tightens it to an integer schema.
2. Data model delta — exact Drizzle column line and the exact command that generates the migration.
3. API contract — exact route, exact Valibot validator expression, request/response shape, status codes, middleware chain in order.
4. Module-by-module file plan — a TABLE with columns: file path | new or edit | what changes | depends on. This table IS the packet list, so it must be complete and ordered so no file depends on a later one. Include every file: API schema, migration, validators, controller, router, response schema, both read projections, web types, fetcher, hook, popover, sidebar registration, task card, column header, i18n locales, API test, web tests.
5. Formatting helper — specify one shared pure function for minutes to display hours, where it lives, and its exact behaviour for 150 -> '2.5h', 120 -> '2h', 0 and null -> no render.
6. Test plan — name each test file and the exact cases, respecting the constraint that tests/api has no HTTP or DB harness.
7. Risks and rollback.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### DESIGN_CONSTRAINTS
_Included because: Authoritative decisions already settled by the human at Gate 1 plus repo facts verified against source. Non-negotiable._

```
SETTLED DECISIONS (do not re-open, do not list as open questions):
1. Badge format: DECIMAL hours, e.g. 150 -> '2.5h', 120 -> '2h' (no trailing .0). Not compound '2h 30m'.
2. Card badge: ALWAYS render when set. NO useUserPreferencesStore toggle. Adding one expands scope beyond AC-5.
3. Upper bound: 525600 minutes (one year).
4. FR-3 defect: tighten read-path schema to an integer schema.

VERIFIED REPO FACTS:
A. Route convention is FIELD FIRST then id: existing routes are PUT /status/:id, /priority/:id, /assignee/:id, /due-date/:id, /title/:id in apps/api/src/task/index.ts. The new route is PUT /estimated-minutes/:id. Client call shape is client.task['estimated-minutes'][':id'].$put.
B. Middleware order on those routes: describeRoute(...), validator('param', ...), validator('json', ...), workspaceAccess.fromTask(), requireWorkspacePermission({ task: ['update'] }), requireEntitlement, handler.
C. Valibot integer idiom already used in this repo: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(525600)). For a nullable body field use v.nullable(that pipe).
D. NO ACTIVITY EVENT. The brief's non-goals forbid estimate history, activity events and notifications. update-task-priority.ts calls publishEvent('task.priority_changed'), but the new controller MUST NOT call publishEvent, because activitySchema in apps/api/src/schemas.ts has a closed picklist of activity types and adding one violates the non-goals.
E. TEST HARNESS CONSTRAINT, the most important one: apps/api/vitest.config.ts sets environment 'node' and include ['../../tests/api/**/*.test.ts']. Every existing test under tests/api is a PURE FUNCTION test (e.g. tests/api/column/to-slug.test.ts, tests/api/utils/to-normal-case.test.ts). There is NO HTTP harness, NO supertest, NO database in that suite. Integration tests live in tests/api-integration and are OUT OF SCOPE for this run. THEREFORE: the estimate validation logic must be extracted into a PURE, EXPORTED helper in apps/api/src/task/validate-task-fields.ts, alongside the existing assertValidPriority, so that a pure unit test under tests/api can cover AC-2 validation. Do not plan an API test that needs a server or a database.
F. Web tests are colocated: apps/web/vitest.config.ts uses environment 'jsdom', include ['src/**/*.test.{ts,tsx}'], setupFiles ./src/test/setup.ts, alias '@' -> ./src and '@i18n' -> ../../i18n.
G. i18n: repo-root i18n/ has 17 locale JSON files. en-US.json is source of truth. 'pnpm i18n:check' is a hard gate; 'pnpm i18n:check:fix' propagates keys. i18n/schema.json and i18n/resources.ts are OFF-LIMITS.
H. Read projections use explicit allowlists. get-task.ts .select({...}) and get-tasks.ts taskSelection BOTH need the field. taskSelection feeds columns[].tasks[], archivedTasks[] and plannedTasks[].
I. updateTask in update-task.ts has 11 POSITIONAL params. Do NOT add a parameter to it.
J. ColumnHeader already has column.tasks in scope and already renders {column.tasks.length}. The rollup needs NO new query.
K. Popover files are 79-103 lines: props { task, children }, default export, useTranslation + useState(open) + mutateAsync hook + useWorkspacePermission() with 'if (!canEdit) return <>{children}</>;', try/catch with toast on tasks:popover.<field>.updateSuccess / updateError.
```

#### apps/api/src/task/controllers/update-task-priority.ts
_Included because: Exact controller pattern to imitate — named-object params. Note the new controller must NOT publishEvent._

```
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function updateTaskPriority({ id, priority, currentUserId }: { id: string; priority: string; currentUserId: string; }) {
  const existingTask = await db.query.taskTable.findFirst({ where: eq(taskTable.id, id) });
  if (!existingTask) { throw new HTTPException(404, { message: "Task not found" }); }
  const [updatedTask] = await db.update(taskTable).set({ priority }).where(eq(taskTable.id, id)).returning();
  if (!updatedTask) { throw new HTTPException(500, { message: "Failed to update task priority" }); }
  await publishEvent("task.priority_changed", { /* omitted */ });
  return updatedTask;
}

export default updateTaskPriority;
```

#### apps/api/src/task/index.ts (priority route excerpt)
_Included because: Exact router registration shape including middleware order._

```
  .put(
    "/priority/:id",
    describeRoute({
      operationId: "updateTaskPriority",
      tags: ["Tasks"],
      description: "Update only the priority of a task",
      responses: { 200: { description: "Task priority updated successfully", content: { "application/json": { schema: resolver(taskSchema) } } } },
    }),
    validator("param", v.object({ id: v.string() })),
    validator("json", v.object({ priority: v.picklist(VALID_PRIORITIES) })),
    workspaceAccess.fromTask(),
    requireWorkspacePermission({ task: ["update"] }),
    requireEntitlement,
    async (c) => {
      const { id } = c.req.valid("param");
      const { priority } = c.req.valid("json");
      const currentUserId = c.get("userId");
      const task = await updateTaskPriority({ id, priority, currentUserId });
      return c.json(task);
    },
  )
```

#### apps/api/src/schemas.ts (taskSchema)
_Included because: The response schema to extend. Note startDate/dueDate use v.optional._

```
export const taskSchema = v.object({
  id: v.string(),
  projectId: v.string(),
  position: v.nullable(v.number()),
  number: v.nullable(v.number()),
  userId: v.nullable(v.string()),
  title: v.string(),
  description: v.nullable(v.string()),
  status: v.string(),
  priority: v.picklist(["no-priority","low","medium","high","urgent"] as const),
  startDate: v.optional(v.date()),
  dueDate: v.optional(v.date()),
  createdAt: v.date(),
});
```

#### apps/api/src/task/validate-task-fields.ts (excerpt)
_Included because: Where the pure validation helper must go, next to assertValidPriority._

```
export const VALID_PRIORITIES = ["no-priority","low","medium","high","urgent"] as const;

export function assertValidPriority(priority: string): void {
  if (!(VALID_PRIORITIES as readonly string[]).includes(priority)) {
    throw new HTTPException(400, { message: `Invalid priority "${priority}". Valid values: ${VALID_PRIORITIES.join(", ")}` });
  }
}
```

#### apps/web/src/fetchers/task/update-task-due-date.ts
_Included because: Exact fetcher pattern._

```
import { client } from "@kaneo/libs";
import type Task from "@/types/task";

async function updateTaskDueDate(taskId: string, task: Task) {
  const response = await client.task["due-date"][":id"].$put({ param: { id: taskId }, json: { dueDate: task.dueDate || "" } });
  if (!response.ok) { const error = await response.text(); throw new Error(error); }
  const data = await response.json();
  return data;
}

export default updateTaskDueDate;
```

#### apps/web/src/hooks/mutations/task/use-update-task-due-date.ts
_Included because: Exact mutation hook pattern and the invalidation key set._

```
import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskDueDate from "@/fetchers/task/update-task-due-date";
import type Task from "@/types/task";

export function useUpdateTaskDueDate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (task: Task) => updateTaskDueDate(task.id, task),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["task", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
```

#### apps/web/src/components/kanban-board/column/column-header.tsx (excerpt)
_Included because: The rollup insertion point. column.tasks is already in scope; the count badge shows the styling to match._

```
type ColumnHeaderProps = { column: ProjectWithTasks["columns"][number]; };

export function ColumnHeader({ column }: ColumnHeaderProps) {
  // ...
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-muted-foreground">{getColumnIcon(column.id, column.isFinal, column.icon)}</span>
        <span className="truncate text-sm font-medium text-foreground/95">{column.name}</span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">{column.tasks.length}</span>
      </div>
      {/* action buttons */}
    </div>
  );
}
```

#### apps/web/src/types/task/index.ts
_Included because: The Task type to extend._

```
type Task = {
  id: string; title: string; number: number | null; description: string | null;
  status: string; priority: string | null; startDate: string | null; dueDate: string | null;
  position: number | null; createdAt: string; updatedAt?: string; userId: string | null;
  assigneeId: string | null; assigneeName: string | null; assigneeImage?: string | null;
  projectId: string; columnId?: string | null; labels?: TaskLabel[]; externalLinks?: TaskExternalLink[];
};
export default Task;
```
### Acceptance criteria
- change_plan.md written with all seven required sections
- The file plan table is complete and dependency-ordered and covers both read projections
- The API contract uses PUT /estimated-minutes/:id with the exact middleware order given
- Validation is placed in a pure exported helper in validate-task-fields.ts so a pure unit test can cover it
- No publishEvent call is planned for the new controller
- The FR-3 defect is explicitly recorded and corrected
- file_plan in the structured output matches the table in the document
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "written_path": {
      "type": "string"
    },
    "file_plan": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string"
          },
          "change": {
            "type": "string"
          },
          "summary": {
            "type": "string"
          }
        },
        "required": [
          "path",
          "change",
          "summary"
        ]
      }
    },
    "decisions": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "written_path",
    "file_plan",
    "decisions",
    "summary"
  ]
}
```
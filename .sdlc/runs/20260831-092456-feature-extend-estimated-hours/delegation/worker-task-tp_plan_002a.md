## Task tp_plan_002a — plan_task_packets / decomposition
Module: estimated-hours
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

Write a JSON ARRAY of exactly 9 TaskPacket objects to .sdlc/runs/20260831-092456-feature-extend-estimated-hours/packets-api.json, one per unit in the API_UNITS input, in the order given. Do not read any repository file - API_UNITS is complete. Write only that one file.

Each packet has exactly these keys: id, phase, task_type, module, pass_id, intent, artifact_path, instruction, acceptance, budget, depends_on.

- id: as given in API_UNITS.
- phase: 'codegen', except unit 9 which is 'tests'.
- task_type: as given.
- module: as given.
- pass_id: '20260831-092456-feature-extend-estimated-hours'
- intent: 'feature-extend'
- artifact_path: as given.
- instruction: 3-6 imperative sentences naming exact identifiers and exact behaviour. Keep it under 140 words. Do not restate repo-wide context.
- acceptance: 2-4 testable bullets.
- budget: { "maxInputTokens": 30000, "maxOutputTokens": 3000 }, except unit 9 which uses maxOutputTokens 4000.
- depends_on: as given.

Be terse. The whole array must fit well inside your output budget.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### API_UNITS
_Included because: Approved dependency-ordered API units from change_plan.md section 4, with the amended ADR-3 already applied._

```
id=tp_cg_001 | task_type=existing_file_edit | module=api-schema | path=apps/api/src/database/schema.ts | depends_on=[] | Add a nullable estimatedMinutes column to taskTable: estimatedMinutes: integer("estimated_minutes"). No default, not notNull. integer is already imported or must be added to the drizzle-orm/pg-core import. Place it next to priority. Change nothing else.

id=tp_cg_002 | task_type=migration | module=api-schema | path=apps/api/drizzle/ | depends_on=[tp_cg_001] | Run 'pnpm --filter @kaneo/api db:generate' from the repo root to generate the migration. Then inspect the generated .sql and confirm it contains exactly ALTER TABLE "task" ADD COLUMN "estimated_minutes" integer; and no other statement. Never hand-write the .sql, the meta snapshot, or the _journal.json entry - the tool writes all three together. Report the generated migration tag.

id=tp_cg_003 | task_type=existing_file_edit | module=api-validation | path=apps/api/src/task/validate-task-fields.ts | depends_on=[] | Export ESTIMATED_MINUTES_MAX = 525_600 and export estimatedMinutesSchema = v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(ESTIMATED_MINUTES_MAX))). Add 'import * as v from "valibot";' if absent. This schema is the single source of truth consumed by the route; do NOT add a standalone assert helper. Change nothing else.

id=tp_cg_004 | task_type=existing_file_edit | module=api-schema | path=apps/api/src/schemas.ts | depends_on=[tp_cg_001] | Add estimatedMinutes to taskSchema as v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(525_600)))). Place it after priority. This is the OpenAPI response schema; it must not admit fractional values. Change nothing else.

id=tp_cg_005 | task_type=existing_file_edit | module=api-read | path=apps/api/src/task/controllers/get-task.ts | depends_on=[tp_cg_001] | Add estimatedMinutes: taskTable.estimatedMinutes to the explicit .select({...}) projection allowlist. The projection is an explicit allowlist, so omitting the field makes it invisible to the client. Change nothing else.

id=tp_cg_006 | task_type=existing_file_edit | module=api-read | path=apps/api/src/task/controllers/get-tasks.ts | depends_on=[tp_cg_001] | Add estimatedMinutes: taskTable.estimatedMinutes to the taskSelection object. taskSelection feeds columns[].tasks[], archivedTasks[] and plannedTasks[], which is what the board column rollup sums over. Change nothing else.

id=tp_cg_007 | task_type=new_file_add | module=api-write | path=apps/api/src/task/controllers/update-task-estimated-minutes.ts | depends_on=[tp_cg_001] | Create a controller following the update-task-priority.ts shape: default-export an async function taking named args { id, estimatedMinutes, currentUserId }: { id: string; estimatedMinutes: number | null; currentUserId: string }. Look up the task with db.query.taskTable.findFirst; throw HTTPException 404 'Task not found' if absent. Update taskTable setting estimatedMinutes, returning(). Throw HTTPException 500 'Failed to update task estimated minutes' if nothing returned. MUST NOT call publishEvent - activity events are an explicit non-goal. Return the updated task.

id=tp_cg_008 | task_type=existing_file_edit | module=api-write | path=apps/api/src/task/index.ts | depends_on=[tp_cg_003,tp_cg_004,tp_cg_007] | Register PUT /estimated-minutes/:id immediately after the /priority/:id route, matching its structure exactly. describeRoute operationId 'updateTaskEstimatedMinutes', tags ["Tasks"], description 'Update only the estimated minutes of a task', 200 response resolver(taskSchema). Then validator('param', v.object({ id: v.string() })), validator('json', v.object({ estimatedMinutes: estimatedMinutesSchema })), workspaceAccess.fromTask(), requireWorkspacePermission({ task: ["update"] }), requireEntitlement, then the handler calling updateTaskEstimatedMinutes({ id, estimatedMinutes, currentUserId }) and returning c.json(task). Add the two imports.

id=tp_test_001 | task_type=test_add | module=tests | path=tests/api/task/validate-task-fields.test.ts | depends_on=[tp_cg_003] | Create a pure vitest suite exercising estimatedMinutesSchema with v.safeParse. There is no HTTP server and no database in this suite - test the schema directly. Accept 0, 60, 150, 525600 and null. Reject -1, 525601, 2.5, 0.5, the string '120', and undefined. Assert on result.success. Import from '../../../apps/api/src/task/validate-task-fields'.
```
### Acceptance criteria
- packets-api.json is a valid JSON array of exactly 9 objects
- Every packet has all eleven required keys
- Order and depends_on match API_UNITS exactly
- No other file is created or modified
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
    "packet_count": {
      "type": "integer"
    },
    "packet_ids": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "written_path",
    "packet_count",
    "packet_ids"
  ]
}
```
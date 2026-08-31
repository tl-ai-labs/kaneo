## Task tp_plan_001 — plan_task_packets / decomposition
Module: estimated-hours
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Decompose the approved change plan into a TaskPacket list and write it as a JSON ARRAY to .sdlc/runs/20260831-092456-feature-extend-estimated-hours/packets.json.

The FILE_PLAN input below is the approved, dependency-ordered plan. Emit ONE packet per file-sized unit of work, in dependency order. Do not merge units. Do not invent units. Do not read the repository - everything you need is in the inputs.

Each packet object must have exactly these keys: id, phase, task_type, module, pass_id, intent, artifact_path, instruction, acceptance, budget, depends_on.

Rules:
- id: tp_cg_NNN sequential from 001, except test packets which use tp_test_NNN.
- phase: 'codegen' for source/schema/i18n units, 'tests' for the three test-file units.
- task_type: 'existing_file_edit' for a file that exists today, 'new_file_add' for a file being created, 'test_add' for new test files, 'migration' for the drizzle generation unit.
- module: one of api-schema, api-validation, api-read, api-write, web-data, web-ui, i18n, tests.
- pass_id: '20260831-092456-feature-extend-estimated-hours' on every packet.
- intent: 'feature-extend' on every packet.
- artifact_path: the exact repo-relative path from the plan.
- instruction: 3-6 sentences, imperative, specific enough that an engineer who has the surrounding file could implement it without the change plan. State the exact identifier names and the exact behaviour. Do NOT restate repo-wide context.
- acceptance: 2-5 testable bullets.
- budget: { maxInputTokens: 30000, maxOutputTokens: 3000 } for source units; maxOutputTokens 4000 for the three test units.
- depends_on: array of packet ids that must complete first (empty array if none).

CORRECTIONS to the change plan that you MUST encode in the relevant packets:
- ADR-3 is amended. Do NOT plan a standalone assertValidEstimatedMinutes helper. Instead apps/api/src/task/validate-task-fields.ts exports ESTIMATED_MINUTES_MAX = 525_600 and estimatedMinutesSchema = v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(ESTIMATED_MINUTES_MAX))). The route in task/index.ts consumes it as v.object({ estimatedMinutes: estimatedMinutesSchema }). The API test exercises estimatedMinutesSchema via v.safeParse. This avoids dead code.
- The i18n unit is TWO packets: one editing i18n/en-US.json to add the keys, and one that runs 'pnpm i18n:check:fix' to propagate them to the other 16 locales and then confirms 'pnpm i18n:check' passes.
- The drizzle unit runs 'pnpm --filter @kaneo/api db:generate' and inspects the generated SQL. It must never hand-write the .sql, the snapshot, or the journal entry.

Return the packet count and the ordered list of ids in your structured output.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### FILE_PLAN
_Included because: The approved dependency-ordered file plan from change_plan.md section 4. This is the authoritative unit list._

```
1. apps/api/src/database/schema.ts | edit | add estimatedMinutes: integer("estimated_minutes") to taskTable (nullable, no default) | deps: none
2. apps/api/drizzle/ | migration | run pnpm --filter @kaneo/api db:generate; expect ALTER TABLE "task" ADD COLUMN "estimated_minutes" integer; writes .sql + meta/NNNN_snapshot.json + meta/_journal.json entry | deps: 1
3. apps/api/src/task/validate-task-fields.ts | edit | export ESTIMATED_MINUTES_MAX and estimatedMinutesSchema (see corrections) | deps: none
4. apps/api/src/schemas.ts | edit | taskSchema gains estimatedMinutes as an optional nullable integer-constrained field | deps: 1
5. apps/api/src/task/controllers/get-task.ts | edit | add estimatedMinutes: taskTable.estimatedMinutes to the explicit .select({...}) allowlist | deps: 1
6. apps/api/src/task/controllers/get-tasks.ts | edit | add estimatedMinutes: taskTable.estimatedMinutes to the taskSelection object, which feeds columns[].tasks[], archivedTasks[] and plannedTasks[] | deps: 1
7. apps/api/src/task/controllers/update-task-estimated-minutes.ts | new | controller with named-object args { id, estimatedMinutes, currentUserId }; 404 if task missing; 500 if update returns nothing; MUST NOT call publishEvent | deps: 1
8. apps/api/src/task/index.ts | edit | register PUT /estimated-minutes/:id with describeRoute + validator param + validator json (estimatedMinutesSchema) + workspaceAccess.fromTask() + requireWorkspacePermission({ task: ["update"] }) + requireEntitlement + handler | deps: 3,4,7
9. tests/api/task/validate-task-fields.test.ts | test | pure vitest covering estimatedMinutesSchema via v.safeParse | deps: 3
10. apps/web/src/types/task/index.ts | edit | Task gains estimatedMinutes?: number | null | deps: none
11. apps/web/src/lib/format-estimated-hours.ts | new | pure formatEstimatedHours(minutes) -> string | null, decimal hours, null for 0/negative/null/undefined | deps: none
12. apps/web/src/lib/format-estimated-hours.test.ts | test | unit tests for the helper | deps: 11
13. apps/web/src/fetchers/task/update-task-estimated-minutes.ts | new | client.task["estimated-minutes"][":id"].$put | deps: 10
14. apps/web/src/hooks/mutations/task/use-update-task-estimated-minutes.ts | new | TanStack mutation hook, invalidates ["task",id], ["tasks",projectId], ["projects"] | deps: 13
15. i18n/en-US.json | edit | add the new keys | deps: none
16. i18n locale propagation | edit | pnpm i18n:check:fix then pnpm i18n:check | deps: 15
17. apps/web/src/components/task/task-estimated-hours-popover.tsx | new | popover following the due-date popover pattern; accepts decimal hours, stores Math.round(hours*60) minutes, supports clearing to null, short-circuits when !canEdit | deps: 11,14,15
18. apps/web/src/components/task/task-properties-sidebar.tsx | edit | register the popover in both compact and desktop views | deps: 17
19. apps/web/src/components/kanban-board/task-card.tsx | edit | render the estimate badge when formatEstimatedHours returns non-null | deps: 11
20. apps/web/src/components/kanban-board/task-card.test.tsx | test | badge present at 150, absent at null/0 | deps: 19
21. apps/web/src/components/kanban-board/column/column-header.tsx | edit | sum estimatedMinutes over column.tasks, render rollup when > 0, render nothing otherwise | deps: 11
22. apps/web/src/components/kanban-board/column/column-header.test.tsx | test | rollup at zero, one and several estimates | deps: 21
```
### Acceptance criteria
- packets.json is a valid JSON array
- One packet per unit in FILE_PLAN, in dependency order, none merged or invented
- Every packet has all eleven required keys with correct types
- Every packet carries pass_id and intent
- The validate-task-fields packet encodes the amended ADR-3 schema-export approach, not a standalone assert helper
- The i18n work is split into two packets
- No file other than packets.json is created or modified
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
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "written_path",
    "packet_count",
    "packet_ids",
    "summary"
  ]
}
```
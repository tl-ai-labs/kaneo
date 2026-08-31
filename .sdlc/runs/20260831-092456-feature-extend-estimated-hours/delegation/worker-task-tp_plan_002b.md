## Task tp_plan_002b — plan_task_packets / decomposition
Module: estimated-hours
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

Write a JSON ARRAY of exactly 13 TaskPacket objects to .sdlc/runs/20260831-092456-feature-extend-estimated-hours/packets-web.json, one per unit in the WEB_UNITS input, in the order given. Do not read any repository file - WEB_UNITS is complete. Write only that one file.

Each packet has exactly these keys: id, phase, task_type, module, pass_id, intent, artifact_path, instruction, acceptance, budget, depends_on.

- id, task_type, module, artifact_path, depends_on: as given in WEB_UNITS.
- phase: 'codegen', except the three units whose task_type is test_add, which use 'tests'.
- pass_id: '20260831-092456-feature-extend-estimated-hours'
- intent: 'feature-extend'
- instruction: 3-6 imperative sentences naming exact identifiers and exact behaviour. Keep it under 140 words. Do not restate repo-wide context.
- acceptance: 2-4 testable bullets.
- budget: { "maxInputTokens": 30000, "maxOutputTokens": 3000 }, except test_add units which use maxOutputTokens 4000.

Be terse. The whole array must fit well inside your output budget.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### WEB_UNITS
_Included because: Approved dependency-ordered web and i18n units from change_plan.md section 4._

```
id=tp_cg_009 | task_type=existing_file_edit | module=web-data | path=apps/web/src/types/task/index.ts | depends_on=[] | Add estimatedMinutes?: number | null to the Task type. Change nothing else.

id=tp_cg_010 | task_type=new_file_add | module=web-data | path=apps/web/src/lib/format-estimated-hours.ts | depends_on=[] | Create and named-export a pure function formatEstimatedHours(minutes: number | null | undefined): string | null. Return null when minutes is null, undefined, not a number, or <= 0. Otherwise convert to hours (minutes / 60), round to at most 2 decimal places, strip trailing zeros, and return the value suffixed with 'h'. 150 gives '2.5h', 120 gives '2h', 45 gives '0.75h'. No React, no i18n, no side effects.

id=tp_test_002 | task_type=test_add | module=tests | path=apps/web/src/lib/format-estimated-hours.test.ts | depends_on=[tp_cg_010] | Create a vitest suite for formatEstimatedHours. Assert 120 gives '2h', 60 gives '1h', 150 gives '2.5h', 45 gives '0.75h'. Assert null is returned for 0, -10, null and undefined. Use describe/it/expect imported from vitest.

id=tp_cg_011 | task_type=new_file_add | module=web-data | path=apps/web/src/fetchers/task/update-task-estimated-minutes.ts | depends_on=[tp_cg_009] | Create a fetcher following update-task-due-date.ts exactly. Default-export async function updateTaskEstimatedMinutes(taskId: string, estimatedMinutes: number | null). Call client.task["estimated-minutes"][":id"].$put({ param: { id: taskId }, json: { estimatedMinutes } }). If !response.ok, read response.text() and throw new Error(text). Otherwise return await response.json(). Import { client } from "@kaneo/libs".

id=tp_cg_012 | task_type=new_file_add | module=web-data | path=apps/web/src/hooks/mutations/task/use-update-task-estimated-minutes.ts | depends_on=[tp_cg_011] | Create a TanStack Query mutation hook following use-update-task-due-date.ts. Named-export useUpdateTaskEstimatedMinutes. mutationFn takes ({ task, estimatedMinutes }: { task: Task; estimatedMinutes: number | null }) and calls the fetcher with task.id. onSuccess invalidates queryKey ["task", variables.task.id], ["tasks", variables.task.projectId] and ["projects"].

id=tp_cg_013 | task_type=existing_file_edit | module=i18n | path=i18n/en-US.json | depends_on=[] | Add static keys only to en-US.json. Under tasks.popover add an estimatedHours object with keys label, placeholder, clear, updateSuccess, updateError. Under tasks.kanban add estimatedHoursRollup. Match the surrounding style of the existing dueDate and startDate popover entries. Do not touch i18n/schema.json. Do not edit any other locale file - a later packet propagates them.

id=tp_cg_014 | task_type=existing_file_edit | module=i18n | path=i18n/ | depends_on=[tp_cg_013] | Run 'pnpm i18n:check:fix' from the repo root to propagate the new keys from en-US.json into the other 16 locale files. Then run 'pnpm i18n:check' and confirm it exits 0. Do not hand-edit any locale file and do not modify i18n/schema.json. Report which locale files changed.

id=tp_cg_015 | task_type=new_file_add | module=web-ui | path=apps/web/src/components/task/task-estimated-hours-popover.tsx | depends_on=[tp_cg_010,tp_cg_012,tp_cg_013] | Create a popover following task-due-date-popover.tsx exactly in shape. Props { task, children }, default export, useTranslation, useState for open, useState for the text input, useUpdateTaskEstimatedMinutes mutateAsync, useWorkspacePermission with 'if (!canEdit) return <>{children}</>;'. The input accepts decimal hours; on submit convert with Math.round(parseFloat(value) * 60) and reject NaN, negative, or above 525600 without calling the API. Provide a clear action sending null. Wrap the call in try/catch with toast.success on tasks:popover.estimatedHours.updateSuccess and toast.error on updateError, then close.

id=tp_cg_016 | task_type=existing_file_edit | module=web-ui | path=apps/web/src/components/task/task-properties-sidebar.tsx | depends_on=[tp_cg_015] | Register TaskEstimatedHoursPopover alongside the existing due-date and priority popovers, in both the compact and the desktop layouts, following exactly how the neighbouring popovers are registered. Show the formatted value via formatEstimatedHours when set and the tasks:popover.estimatedHours.label placeholder when not. Change nothing else.

id=tp_cg_017 | task_type=existing_file_edit | module=web-ui | path=apps/web/src/components/kanban-board/task-card.tsx | depends_on=[tp_cg_010] | Render an estimate badge on the card. Compute formatEstimatedHours(task.estimatedMinutes) once; when it returns null render nothing at all so an unset card is byte-identical to today. When non-null render a small badge next to the existing card metadata badges, matching their styling. Change nothing else.

id=tp_test_003 | task_type=test_add | module=tests | path=apps/web/src/components/kanban-board/task-card.test.tsx | depends_on=[tp_cg_017] | Create a vitest + @testing-library/react suite following the vi.mock-per-dependency style of apps/web/src/components/list-view/task-row.test.tsx. Mock every hook and child component the card imports. Assert the badge text '2.5h' appears when estimatedMinutes is 150, and that no estimate badge is present when it is null, 0, or omitted. Use cleanup in afterEach.

id=tp_cg_018 | task_type=existing_file_edit | module=web-ui | path=apps/web/src/components/kanban-board/column/column-header.tsx | depends_on=[tp_cg_010] | Sum estimatedMinutes across column.tasks (treating null and undefined as 0) and pass the total to formatEstimatedHours. When it returns null render nothing. When non-null render a rollup badge beside the existing {column.tasks.length} count badge, matching its styling. column.tasks is already in scope so no new query is needed. Change nothing else.

id=tp_test_004 | task_type=test_add | module=tests | path=apps/web/src/components/kanban-board/column/column-header.test.tsx | depends_on=[tp_cg_018] | Create a vitest + @testing-library/react suite following the vi.mock-per-dependency style of apps/web/src/components/list-view/task-row.test.tsx. Mock every hook and child component the header imports. Cover the rollup at several estimates (tasks with 120 and 240 gives '6h'), at one estimate (150 plus two nulls gives '2.5h'), and at zero estimates (all null renders no rollup badge). Assert the existing task-count badge still renders in every case.
```
### Acceptance criteria
- packets-web.json is a valid JSON array of exactly 13 objects
- Every packet has all eleven required keys
- Order and depends_on match WEB_UNITS exactly
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
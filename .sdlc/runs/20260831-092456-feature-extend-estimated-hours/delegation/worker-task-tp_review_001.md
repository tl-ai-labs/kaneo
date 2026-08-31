## Task tp_review_001 — senior_code_review / module_review
Module: estimated-hours
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one. Do NOT modify any source file - this is a review, write ONLY review.md.

Perform a senior code review of this feature-extend change and write .sdlc/runs/20260831-092456-feature-extend-estimated-hours/review.md.

Read these changed files (the complete change set):
API: apps/api/src/database/schema.ts (taskTable), apps/api/src/schemas.ts (taskSchema), apps/api/src/task/validate-task-fields.ts, apps/api/src/task/controllers/get-task.ts, apps/api/src/task/controllers/get-tasks.ts, apps/api/src/task/controllers/update-task-estimated-minutes.ts, apps/api/src/task/index.ts (the PUT /estimated-minutes/:id route only), apps/api/drizzle/0043_odd_random.sql, tests/api/task/validate-task-fields.test.ts.
Web: apps/web/src/types/task/index.ts, apps/web/src/lib/format-estimated-hours.ts, apps/web/src/lib/format-estimated-hours.test.ts, apps/web/src/fetchers/task/update-task-estimated-minutes.ts, apps/web/src/hooks/mutations/task/use-update-task-estimated-minutes.ts, apps/web/src/components/task/task-estimated-hours-popover.tsx, apps/web/src/components/task/task-properties-sidebar.tsx (the three TaskEstimatedHoursPopover registrations only), apps/web/src/components/kanban-board/task-card.tsx (the estimate badge only), apps/web/src/components/kanban-board/column/column-header.tsx (the rollup only), and the two new component test files beside them.

Also read AGENTS.md, which is the repo's binding convention guide, and judge conformance against it.

Review against the acceptance criteria in .sdlc/runs/20260831-092456-feature-extend-estimated-hours/requirements.md.

Structure review.md as: Verdict (one of APPROVE / APPROVE WITH NITS / REQUEST CHANGES) / Findings table with columns severity (blocker|major|minor|nit), file, line-ish, finding, recommendation / Acceptance-criteria coverage table AC-1..AC-9 with met/partially-met/not-met and the evidence / What was done well / Refinement packets, as a JSON array, for any blocker or major finding only.

Be specific and adversarial. Things worth probing hard: whether the write path and read path agree on the integer bound; whether the popover can send a value the API would reject or vice versa; whether the rollup can mis-handle an empty or all-null column; whether existing tasks and cards are genuinely unaffected when the field is null; whether the permission check is actually enforced server-side and not merely in the UI; whether anything duplicates a bound or a constant that should have one source of truth. Do not invent problems - if it is correct, say so.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### CONTEXT: decisions already settled, do not re-litigate
_Included because: These were decided by the human operator at earlier gates. Judge the implementation against them, not the decisions themselves._

```
1. Decimal hour display (150 -> '2.5h', 120 -> '2h'), NOT compound '2h 30m'.
2. Card badge always renders when set; deliberately NO user-preference toggle (would exceed AC-5).
3. Upper bound 525600 minutes (one year).
4. Dedicated endpoint PUT /estimated-minutes/:id rather than extending updateTask, which has 11 positional params. Route convention in this repo is field-first: /priority/:id, /due-date/:id.
5. The controller deliberately does NOT publishEvent: activity events and estimate history are explicit non-goals, and activitySchema uses a closed picklist.
6. Validation lives as an exported Valibot schema (estimatedMinutesSchema) in validate-task-fields.ts consumed by the route, deliberately NOT as a standalone assert helper, because a standalone assert would never be called by production code and its test would prove nothing.
7. tests/api has no HTTP or DB harness - every test there is a pure function test. Integration tests (tests/api-integration) are out of scope for this run by deliberate decision.
8. i18n: en-US.json is source of truth, 17 locales, non-English locales carry English placeholder values, which is what the repo's own i18n:check:fix produces.
```
### Acceptance criteria
- review.md exists with a verdict, a findings table, and an AC-1..AC-9 coverage table
- Every finding names a specific file and a concrete recommendation
- Refinement packets are emitted for blockers and majors only
- No source file was modified
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
    "verdict": {
      "type": "string"
    },
    "blocker_count": {
      "type": "integer"
    },
    "major_count": {
      "type": "integer"
    },
    "minor_count": {
      "type": "integer"
    },
    "findings_summary": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "refinement_packets": {
      "type": "array",
      "items": {
        "type": "object"
      }
    }
  },
  "required": [
    "written_path",
    "verdict",
    "blocker_count",
    "major_count",
    "minor_count",
    "findings_summary",
    "refinement_packets"
  ]
}
```
# Code Review: Estimated Hours on Tasks with Per-Lane Rollup

## Verdict

**APPROVE WITH NITS**

The feature implementation is well-structured, follows Kaneo's architectural patterns and repository conventions from `AGENTS.md`, and satisfies all functional and non-functional requirements without regressions.

---

## Findings

| Severity | File | Line-ish | Finding | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| `nit` | [`apps/api/src/schemas.ts`](file:///home/sangeetha/projects/kaneo/apps/api/src/schemas.ts#L43) | 43 | The upper bound `525_600` is duplicated as a numeric literal in `taskSchema` rather than referencing `ESTIMATED_MINUTES_MAX` exported from [`validate-task-fields.ts`](file:///home/sangeetha/projects/kaneo/apps/api/src/task/validate-task-fields.ts#L18). | Import and reuse `ESTIMATED_MINUTES_MAX` to maintain a single source of truth across schema definitions. |
| `nit` | [`apps/web/src/components/task/task-estimated-hours-popover.tsx`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/task/task-estimated-hours-popover.tsx#L55) | 55 | The upper bound limit `525600` is hardcoded as an inline constant in client-side form validation. | Export a shared constant (e.g., `MAX_ESTIMATED_MINUTES = 525_600` in [`format-estimated-hours.ts`](file:///home/sangeetha/projects/kaneo/apps/web/src/lib/format-estimated-hours.ts)) and reference it in the popover. |
| `nit` | [`apps/web/src/components/task/task-properties-sidebar.tsx`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/task/task-properties-sidebar.tsx#L331-L343) | 331, 537, 745 | The `TaskEstimatedHoursPopover` trigger button and icon markup are duplicated across the three responsive layout sections (compact header, mobile layout, and desktop sidebar). | Adheres to the existing pattern used for other properties in this file, but consider extracting a small property button component during future sidebar refactoring. |

---

## Acceptance Criteria Coverage

| AC # | Description | Status | Evidence |
| :--- | :--- | :---: | :--- |
| **AC-1** | `taskTable` has a nullable `estimatedMinutes` integer with a generated, inspected migration safe for populated production databases. | **MET** | [`apps/api/src/database/schema.ts:427`](file:///home/sangeetha/projects/kaneo/apps/api/src/database/schema.ts#L427) adds nullable `estimatedMinutes: integer("estimated_minutes")`. [`apps/api/drizzle/0043_odd_random.sql:1`](file:///home/sangeetha/projects/kaneo/apps/api/drizzle/0043_odd_random.sql#L1) provides `ALTER TABLE "task" ADD COLUMN "estimated_minutes" integer;` without `NOT NULL`. |
| **AC-2** | Task API accepts and returns the estimate, validated with Valibot (`0 <= x <= 525600` or `null`), with accurate OpenAPI metadata, rejecting invalid values with 4xx. | **MET** | Validated via `estimatedMinutesSchema` in [`apps/api/src/task/validate-task-fields.ts:20-27`](file:///home/sangeetha/projects/kaneo/apps/api/src/task/validate-task-fields.ts#L20-L27) and OpenAPI route metadata in [`apps/api/src/task/index.ts:557-587`](file:///home/sangeetha/projects/kaneo/apps/api/src/task/index.ts#L557-L587). Unit tests in [`tests/api/task/validate-task-fields.test.ts`](file:///home/sangeetha/projects/kaneo/tests/api/task/validate-task-fields.test.ts) confirm acceptance of `0`, `60`, `150`, `525600`, `null` and rejection of `-1`, `525601`, `2.5`, `"120"`, `undefined`. |
| **AC-3** | Setting an estimate requires workspace permission `task: ["update"]` enforced server-side. | **MET** | `PUT /estimated-minutes/:id` is guarded by `workspaceAccess.fromTask()`, `requireWorkspacePermission({ task: ["update"] })`, and `requireEntitlement` middleware in [`apps/api/src/task/index.ts:573-575`](file:///home/sangeetha/projects/kaneo/apps/api/src/task/index.ts#L573-L575). |
| **AC-4** | Task properties sidebar can set, change, and clear an estimate, persisting across reload. | **MET** | [`apps/web/src/components/task/task-estimated-hours-popover.tsx`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/task/task-estimated-hours-popover.tsx) implements input parsing, rounding to integer minutes, clearing with `null`, and React Query mutation cache invalidation via [`useUpdateTaskEstimatedMinutes`](file:///home/sangeetha/projects/kaneo/apps/web/src/hooks/mutations/task/use-update-task-estimated-minutes.ts). |
| **AC-5** | The card shows the estimate when set, formatted in hours, and is visually unchanged when unset. | **MET** | [`apps/web/src/components/kanban-board/task-card.tsx:83,285-290`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/kanban-board/task-card.tsx#L83) conditionally renders the estimate badge only when `formatEstimatedHours(task.estimatedMinutes)` returns non-null. Verified in [`task-card.test.tsx`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/kanban-board/task-card.test.tsx). |
| **AC-6** | The lane header shows the summed estimate for its tasks, and renders nothing when the lane has no estimates. | **MET** | [`apps/web/src/components/kanban-board/column/column-header.tsx:33,71-78`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/kanban-board/column/column-header.tsx#L33) sums minutes via `sumEstimatedMinutes(column.tasks)` and conditionally renders the total rollup badge. Verified in [`column-header.test.tsx`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/kanban-board/column/column-header.test.tsx). |
| **AC-7** | All new user-facing copy uses static i18n keys across all locales. | **MET** | Static translation keys `tasks:popover.estimatedHours.*` and `tasks:kanban.estimatedHoursRollup` are defined in `i18n/en-US.json` and synchronized across all 17 locale JSON files in `i18n/`. |
| **AC-8** | Existing tasks, cards, and lane headers render exactly as today when estimate is null/omitted. | **MET** | Verified via test assertions in [`task-card.test.tsx`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/kanban-board/task-card.test.tsx#L110-L120) and [`column-header.test.tsx`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/kanban-board/column/column-header.test.tsx#L105-L139), ensuring no badge elements or layout shifts occur when `estimatedMinutes` is `null` or omitted. |
| **AC-9** | Focused API tests cover validation; focused web tests cover card badge and rollup at zero, one, and several estimates. Affected packages typecheck. | **MET** | `tests/api/task/validate-task-fields.test.ts`, `apps/web/src/lib/format-estimated-hours.test.ts`, `apps/web/src/components/kanban-board/task-card.test.tsx`, and `apps/web/src/components/kanban-board/column/column-header.test.tsx` all pass. `pnpm --filter @kaneo/api typecheck` and `pnpm --filter @kaneo/web typecheck` exit with code 0. |

---

## What Was Done Well

1. **Exact Storage Representation**: Storing duration in integer minutes (`estimatedMinutes`) prevents floating-point accumulation drift during client-side lane rollups while supporting clean decimal hour presentation (`2.5h`, `0.75h`).
2. **Explicit Read Projections**: Both single-task ([`get-task.ts`](file:///home/sangeetha/projects/kaneo/apps/api/src/task/controllers/get-task.ts#L15)) and board-view column queries ([`get-tasks.ts`](file:///home/sangeetha/projects/kaneo/apps/api/src/task/controllers/get-tasks.ts#L130)) correctly updated their explicit column allowlists, ensuring field presence across board columns, archived tasks, and planned tasks.
3. **Dedicated Route Convention**: Followed Kaneo's single-purpose field mutation endpoint pattern (`PUT /estimated-minutes/:id`), avoiding positional parameter proliferation in `updateTask`.
4. **Clean Boundary Fallbacks**: Helper functions in `format-estimated-hours.ts` handle `null`, `undefined`, `NaN`, `0`, and negative numbers robustly, ensuring neither cards nor lane headers render empty badges or broken labels.
5. **Full i18n Locale Coverage**: Keys were synchronized across all 17 locale files.

---

## Refinement Packets

```json
[]
```

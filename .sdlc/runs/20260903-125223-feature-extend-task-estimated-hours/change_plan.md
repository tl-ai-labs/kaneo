# Change Plan — Task estimate (`estimated_minutes`) with per-column rollup

Run: `20260903-125223-feature-extend-task-estimated-hours` · Intent: `feature-extend` · Mode: brownfield
Input spec: `requirements.md` (FR-A..FR-J, AC-1..AC-11). This plan does not contradict it; where it
adds detail (rounding rule, schema file location, mount sites), that detail is binding on codegen.

---

## 1. Summary

`taskTable` gains one nullable column, `estimated_minutes integer`, exposed end-to-end as
`estimatedMinutes: number | null`. The API stores, validates, and returns **integer minutes**; the
web app **parses and displays decimal hours** and never sends hours over the wire. The estimate is
written through the existing full-document `POST /task/:projectId` and `PUT /task/:id` — no new
endpoint, no new permission verb, no new event topic. Three read surfaces change: the task detail
properties sidebar (new `TaskEstimatePopover`), the kanban task card (a badge), and the kanban
column header (a rollup badge that sums raw integer minutes across `column.tasks` and formats once).

The **one-way door** is the migration. `0043_*.sql` must be a bare
`ALTER TABLE "task" ADD COLUMN "estimated_minutes" integer;`. Once merged, the column name and unit
are fixed. Migrations `0000`–`0042` are immutable and must show zero diff.

---

## 2. The rounding rule

Owned by exactly one module: **`apps/web/src/lib/estimate.ts`** (added by the Gate-1 allowlist
amendment). Nothing else in the repo converts between minutes and hours.

### 2.1 Do not reuse `format-duration.ts`

`apps/web/src/lib/format-duration.ts` exists, has **zero importers**, takes **seconds**, and emits
`"1h 30m 0s"`. It is the wrong unit, the wrong format, and it is **not on the write allowlist**.
Do not import it, do not extend it, do not delete it. If a codegen worker greps for "duration" and
finds it, ignore the result. `apps/web/src/lib/format.ts` and `apps/web/src/lib/column.tsx` are
likewise off-limits — `estimate.ts` is the only new or writable file under `apps/web/src/lib/`.

### 2.2 The formatting formula (normative)

Given an integer minute count `m`:

1. Reject unless `Number.isInteger(m) && m >= 1 && m <= 2147483647`. Rejection returns `null`; the
   caller renders nothing.
2. `const fixed = (m / 60).toFixed(2)` — always exactly two decimal places, JS half-away-from-zero
   at the second decimal. This is the *only* rounding step.
3. `const trimmed = fixed.replace(/0+$/, "").replace(/\.$/, "")` — two separate replaces, in this
   order. Do not collapse them into one regex.
4. Return `` `${trimmed}h` ``.

Required outputs (these are the assertions in the unit test):

| minutes | `(m/60).toFixed(2)` | trimmed | display |
|---|---|---|---|
| `0` | — | — | `null` (hidden) |
| `-5` | — | — | `null` |
| `1` | `"0.02"` | `"0.02"` | `"0.02h"` |
| `30` | `"0.50"` | `"0.5"` | `"0.5h"` |
| `90` | `"1.50"` | `"1.5"` | `"1.5h"` |
| `100` | `"1.67"` | `"1.67"` | `"1.67h"` |
| `120` | `"2.00"` | `"2"` | `"2h"` |
| `300` | `"5.00"` | `"5"` | `"5h"` |
| `4825` | `"80.42"` | `"80.42"` | `"80.42h"` |
| `6000` | `"100.00"` | `"100"` | `"100h"` |
| `2147483647` | `"35791394.12"` | `"35791394.12"` | `"35791394.12h"` |
| `null` / `undefined` / `1.5` / `NaN` | — | — | `null` |

`6000` is in the table deliberately: it proves the two-step trim handles integral hundreds
(`"100.00"` → `"100"`, never `"1"`).

### 2.3 Rollup: sum integers, format once

The rollup **sums raw integer minutes and calls the formatter exactly once, on the total**.

Worked example — a column holding three tasks of `100` minutes each:

- Each card renders `formatEstimateMinutes(100)` = `"1.67h"`.
- The header renders `formatEstimateMinutes(100 + 100 + 100)` = `formatEstimateMinutes(300)` = `"5h"`.
- Naively adding the displayed values gives `1.67 + 1.67 + 1.67 = 5.01`, which is **not** what the
  header shows.

The header showing `"5h"` next to three cards reading `"1.67h"` is **correct**: the true total is
exactly 300 minutes, and `"1.67h"` is a lossy two-decimal rendering of 1⅔ h. Summing the formatted
values would accumulate three separate rounding errors and report a total that no combination of
stored values can produce — that is the bug this rule exists to prevent.

### 2.4 Parse round-trip is exact

For any integer `m` in `[1, 2147483647]`, `parseEstimateHours(estimateMinutesToHoursInput(m)) === m`.
Proof: the 2-decimal hour string differs from `m/60` by at most `0.005 h = 0.3 min`, and
`Math.round(m ± 0.3) = m` for integer `m`. So opening the popover and re-saving an untouched value
never shifts the stored estimate. Add this as a test case.

### 2.5 Exact module contract — `apps/web/src/lib/estimate.ts`

```ts
import type Task from "@/types/task";

export const MIN_ESTIMATE_MINUTES = 1;
export const MAX_ESTIMATE_MINUTES = 2147483647;

/**
 * Renders a stored minute count as decimal hours. Two decimal places, trailing
 * zeros trimmed. Returns null for anything not a storable estimate so callers
 * render nothing rather than "0h".
 */
export function formatEstimateMinutes(
  minutes: number | null | undefined,
): string | null;

/**
 * Parses a decimal-hours string typed by a user into storable minutes.
 * Returns null for empty, malformed, non-positive, or out-of-range input.
 * Accepts only /^\d+(\.\d+)?$/ — no sign, no exponent, no comma decimal separator.
 */
export function parseEstimateHours(input: string): number | null;

/** Prefill value for the hours input. "" when there is no estimate. No "h" suffix. */
export function estimateMinutesToHoursInput(
  minutes: number | null | undefined,
): string;

/** Sums raw integer minutes. Null/undefined estimates contribute 0. Never NaN. */
export function sumEstimateMinutes(
  tasks: ReadonlyArray<Pick<Task, "estimatedMinutes">>,
): number;
```

Reference implementation (codegen writes this verbatim; the JSDoc above stays):

```ts
function toTrimmedHours(minutes: number): string {
  return (minutes / 60).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function isStorableEstimate(minutes: number | null | undefined): minutes is number {
  return (
    typeof minutes === "number" &&
    Number.isInteger(minutes) &&
    minutes >= MIN_ESTIMATE_MINUTES &&
    minutes <= MAX_ESTIMATE_MINUTES
  );
}

export function formatEstimateMinutes(minutes: number | null | undefined): string | null {
  if (!isStorableEstimate(minutes)) return null;
  return `${toTrimmedHours(minutes)}h`;
}

export function parseEstimateHours(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const hours = Number(trimmed);
  if (!Number.isFinite(hours)) return null;
  const minutes = Math.round(hours * 60);
  return isStorableEstimate(minutes) ? minutes : null;
}

export function estimateMinutesToHoursInput(minutes: number | null | undefined): string {
  if (!isStorableEstimate(minutes)) return "";
  return toTrimmedHours(minutes);
}

export function sumEstimateMinutes(
  tasks: ReadonlyArray<Pick<Task, "estimatedMinutes">>,
): number {
  return tasks.reduce((total, task) => total + (task.estimatedMinutes ?? 0), 0);
}
```

Notes binding on codegen:

- `sumEstimateMinutes` does **not** clamp to `MAX_ESTIMATE_MINUTES`. A column total may legitimately
  exceed a single task's ceiling; `formatEstimateMinutes` would then return `null` and hide the
  badge. That requires >40,000 years of estimated work in one column and is accepted.
- Import direction is **one-way**: `components/kanban-board/column/column-header.tsx`,
  `components/kanban-board/task-card.tsx`, and `components/task/task-estimate-popover.tsx` all
  import from `@/lib/estimate`. `@/lib/estimate` imports only the `Task` type. No component imports
  another component's helper.

---

## 3. Per-file change table

Dependency order — top to bottom is a valid execution order.

| # | Layer | Path | New/Edit | Change | FR |
|---|---|---|---|---|---|
| 1 | db | `apps/api/src/database/schema.ts` | edit | Add `estimatedMinutes: integer("estimated_minutes")` to `taskTable` | FR-A1 |
| 2 | db | `apps/api/drizzle/0043_<generated>.sql` + `apps/api/drizzle/meta/**` | new | Generated migration, `ADD COLUMN` only | FR-A2 |
| 3 | api | `apps/api/src/task/estimate-schema.ts` | new | Exported Valibot schema + bounds, zero db imports | FR-B3 |
| 4 | api | `apps/api/src/task/controllers/create-task.ts` | edit | Object param + insert value | FR-B4 |
| 5 | api | `apps/api/src/task/controllers/update-task.ts` | edit | 12th positional param + `.set()` value | FR-B5 |
| 6 | api | `apps/api/src/task/controllers/get-tasks.ts` | edit | Add to `taskSelection` whitelist | FR-C1 |
| 7 | api | `apps/api/src/task/controllers/get-task.ts` | edit | Add to inline select whitelist | FR-C2 |
| 8 | api | `apps/api/src/schemas.ts` | edit | `taskSchema` gains the field | FR-C3 |
| 9 | api | `apps/api/src/task/index.ts` | edit | POST + PUT json validators, destructures, call sites | FR-B1, FR-B2, FR-B5 |
| 10 | web-data | `apps/web/src/types/task/index.ts` | edit | `Task.estimatedMinutes: number \| null` | FR-D1 |
| 11 | web-data | `apps/web/src/fetchers/task/update-task.ts` | edit | Round-trip the field in the PUT body | FR-D2 |
| 12 | web-ui | `apps/web/src/lib/estimate.ts` | new | Minutes↔hours conversion + rollup sum | FR-E1..E4 |
| 13 | i18n | `i18n/en-US.json` | edit | 9 new keys | FR-I1 |
| 14 | web-ui | `apps/web/src/components/task/task-estimate-popover.tsx` | new | Hours input + clear, `useUpdateTask()` | FR-F1..F3 |
| 15 | web-ui | `apps/web/src/components/task/task-properties-sidebar.tsx` | edit | Mount the trigger at 3 sites | FR-F4 |
| 16 | web-ui | `apps/web/src/components/kanban-board/task-card.tsx` | edit | Estimate badge in metadata row | FR-G1, FR-G2 |
| 17 | web-ui | `apps/web/src/components/kanban-board/column/column-header.tsx` | edit | Rollup badge next to the count | FR-H1..H5 |
| 18 | test | `tests/api/task/estimate-schema.test.ts` | new | Valibot boundary cases | FR-J1 |
| 19 | test | `apps/web/src/lib/estimate.test.ts` | new | Parse/format/sum/round-trip | FR-J2 |
| 20 | test | `apps/web/src/components/kanban-board/column/column-header.test.tsx` | new | Rollup with mixed nulls | FR-J3 |
| 21 | test | `apps/web/src/components/task/task-estimate-popover.test.tsx` | new | Save, clear, read-only | FR-F1, AC-7 |

**Files removed: none.**

---

## 4. Per-file change detail

### 4.1 `apps/api/src/database/schema.ts` (edit)

In `taskTable` (starts line 401), insert **immediately after the `dueDate:` line** (currently
line 428, `dueDate: timestamp("due_date", { mode: "date" }),`) and before `createdAt:`:

```ts
    estimatedMinutes: integer("estimated_minutes"),
```

`integer` is already imported in this file (`position`, `number` use it). Do **not** add
`.notNull()`, `.default()`, or an index entry to the `(table) => [...]` array (FR-A3).

### 4.2 `apps/api/drizzle/**` (new)

See §6.

### 4.3 `apps/api/src/task/estimate-schema.ts` (new)

Full contents:

```ts
import * as v from "valibot";

// PostgreSQL int4 upper bound. A larger value would reach the driver as a
// range error and surface as a 500 instead of a 400.
export const MAX_ESTIMATED_MINUTES = 2147483647;
export const MIN_ESTIMATED_MINUTES = 1;

export const estimatedMinutesSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(MIN_ESTIMATED_MINUTES),
  v.maxValue(MAX_ESTIMATED_MINUTES),
);

export const estimatedMinutesFieldSchema = v.optional(
  v.nullable(estimatedMinutesSchema),
);
```

**Why a new file and not `validate-task-fields.ts`:** that module imports `../database` at top
level, which constructs the connection pool on import. `tests/api/task/estimate-schema.test.ts` is a
pure-function test running under `apps/api/vitest.config.ts` with no database. Importing the schema
from `validate-task-fields.ts` would drag the pool into the test process. `estimate-schema.ts` has
no imports other than `valibot`. Keep it that way.

### 4.4 `apps/api/src/task/controllers/create-task.ts` (edit)

Three edits:

1. Destructured object parameter (lines 9–18): add `estimatedMinutes,` on its own line
   **immediately after `priority,`** (line 18).
2. Type literal (lines 19–29): add `estimatedMinutes?: number | null;` **immediately after
   `priority?: string;`** (line 28).
3. Insert values object (lines 74–86): add **immediately after `priority: resolvedPriority,`**
   (line 83):

```ts
        estimatedMinutes: estimatedMinutes ?? null,
```

No other change. `publishEvent("task.created", { ...createdTask, ... })` already spreads the row; do
not add the field to the event payload explicitly and do not remove it (FR-B6, PII inventory: it is
a non-sensitive integer already carried by the spread of `createdTask`).

### 4.5 `apps/api/src/task/controllers/update-task.ts` (edit) — **highest-risk edit**

Signature, before (lines 9–21):

```ts
async function updateTask(
  id: string,
  title: string,
  status: string,
  startDate: Date | undefined,
  dueDate: Date | undefined,
  projectId: string,
  description: string,
  priority: string,
  position: number,
  userId?: string,
  currentUserId?: string,
) {
```

Signature, after — the new parameter is **appended last**, position 12, after `currentUserId`.
Do not reorder, rename, or re-type any existing parameter:

```ts
async function updateTask(
  id: string,
  title: string,
  status: string,
  startDate: Date | undefined,
  dueDate: Date | undefined,
  projectId: string,
  description: string,
  priority: string,
  position: number,
  userId?: string,
  currentUserId?: string,
  estimatedMinutes?: number | null,
) {
```

In the `.set({ ... })` object (lines 56–67), add **immediately after `userId: userId || null,`**
(line 66):

```ts
      estimatedMinutes: estimatedMinutes ?? null,
```

**The one call site of this controller is `apps/api/src/task/index.ts:378`** (see §4.9). After the
edit, verify with `grep -rn "updateTask(" apps/api/src` and confirm the only matches are (a) this
declaration, (b) the `apps/api/src/task/index.ts` call, and (c) unrelated names such as
`updateTaskStatus(`, `updateTaskPriority(`, `updateTaskDueDate(`, `updateTaskAssignee(`,
`updateTaskTitle(`, `updateTaskDescription(` — none of which share this signature. Do not touch
`bulk-update-tasks.ts`, `import-tasks.ts`, `move-task.ts`, or `export-tasks.ts`; they do not call
this function and `export-tasks.ts` is off-limits.

### 4.6 `apps/api/src/task/controllers/get-tasks.ts` (edit)

In `taskSelection` (line 123), add **immediately after `dueDate: taskTable.dueDate,`** (line 131):

```ts
    estimatedMinutes: taskTable.estimatedMinutes,
```

That is the only edit in this file. The three `...task` spreads at lines ~233, ~242, ~250 propagate
it with no change.

### 4.7 `apps/api/src/task/controllers/get-task.ts` (edit)

In the `db.select({ ... })` whitelist (lines 8–23), add **immediately after
`dueDate: taskTable.dueDate,`** (line 16):

```ts
      estimatedMinutes: taskTable.estimatedMinutes,
```

### 4.8 `apps/api/src/schemas.ts` (edit)

In `taskSchema` (line 25), add **immediately after `dueDate: v.optional(v.date()),`** (line 42):

```ts
  estimatedMinutes: v.nullable(v.number()),
```

This schema is used only by `resolver()` for OpenAPI response documentation; it does not validate at
runtime. Keeping it accurate is required by `AGENTS.md` ("Public API behavior must retain accurate
Valibot validation and OpenAPI metadata").

### 4.9 `apps/api/src/task/index.ts` (edit)

Four edits.

**(a) Import.** Add to the import block, alphabetically placed among the local `./` imports —
immediately before `import updateTask from "./controllers/update-task";` (line 41) is wrong
alphabetically; place it immediately after `import getTasks from "./controllers/get-tasks";`
(line 33) is also wrong. Use the position Biome's import sorter produces: `./estimate-schema` sorts
after `./controllers/*` and before `./validate-task-fields`, i.e. **immediately before line 48**
(`import { VALID_PRIORITIES } from "./validate-task-fields";`):

```ts
import { estimatedMinutesFieldSchema } from "./estimate-schema";
```

**(b) POST `/:projectId` json validator** (lines 190–201). Add **immediately after
`priority: v.picklist(VALID_PRIORITIES),`** (line 197):

```ts
        estimatedMinutes: estimatedMinutesFieldSchema,
```

**(c) POST handler.** In the destructure at lines 207–215, add `estimatedMinutes,` immediately after
`priority,` (line 211). In the `createTask({ ... })` call at lines 228–238, add
`estimatedMinutes,` immediately after `priority,` (line 236).

**(d) PUT `/:id` json validator** (lines 333–346). Add **immediately after
`priority: v.picklist(VALID_PRIORITIES),`** (line 340):

```ts
        estimatedMinutes: estimatedMinutesFieldSchema,
```

In the destructure at lines 353–363, add `estimatedMinutes,` immediately after `priority,`
(line 357). At the `updateTask(...)` call (lines 378–390), append `estimatedMinutes,` as the
**twelfth and last argument**, after `currentUserId,`:

```ts
      const task = await updateTask(
        id,
        title,
        status,
        parsedStartDate,
        parsedDueDate,
        projectId,
        description,
        priority,
        position,
        userId,
        currentUserId,
        estimatedMinutes,
      );
```

Do not change the `describeRoute` blocks; they already point at `resolver(taskSchema)`, which now
carries the field via §4.8.

### 4.10 `apps/web/src/types/task/index.ts` (edit)

In the `Task` type, add **immediately after `dueDate: string | null;`** (line 26):

```ts
  estimatedMinutes: number | null;
```

This is a **required, non-optional** property. Every object literal in the repo typed as `Task` must
now supply it — that is intentional (it is how the compiler finds every construction site) and is
the reason this edit and its consumers (§4.11 and the existing test fixtures) must land together.
Existing web test fixtures that construct a bare `Task` literal live under
`apps/web/src/**/*.test.tsx`, which is allowlisted; add `estimatedMinutes: null,` to each such
literal that fails typecheck. Do **not** widen the property to optional to avoid this.

### 4.11 `apps/web/src/fetchers/task/update-task.ts` (edit)

In the `json` object, add **immediately after `position: task.position ?? 0,`** (line 24):

```ts
      estimatedMinutes: task.estimatedMinutes ?? null,
```

The `?? null` is load-bearing for the same reason the existing priority comment describes: this one
fetcher round-trips the **whole** task for drag-reorder, archive-all, and inline edits. Omitting the
key would send `undefined`, which the PUT treats as "clear" (§5), silently wiping estimates on every
drag. Do not modify or remove the existing priority comment.

### 4.12 `apps/web/src/hooks/mutations/task/use-update-task.ts` — **no change**

Its existing invalidations (`["task", id]`, `["tasks", projectId]`, `["projects"]`, plus
notifications and activities) already refresh the detail sidebar, the board, and therefore the card
and the rollup. Listed here so no packet is written against it.

### 4.13 `apps/web/src/lib/estimate.ts` (new)

Contents exactly as §2.5.

### 4.14 `apps/web/src/components/task/task-estimate-popover.tsx` (new)

Structured after `task-start-date-popover.tsx` — same imports, same `canEdit` early return, same
toast pattern, same `updateTask({ ...task, <field> })` whole-task mutation. Full contents:

```tsx
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { estimateMinutesToHoursInput, parseEstimateHours } from "@/lib/estimate";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskEstimatePopoverProps = {
  task: Task;
  children: React.ReactNode;
};

export default function TaskEstimatePopover({
  task,
  children,
}: TaskEstimatePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(() =>
    estimateMinutesToHoursInput(task.estimatedMinutes),
  );
  const { mutateAsync: updateTask } = useUpdateTask();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();

  // Re-seed the field from the task whenever the popover is opened, so a
  // discarded edit does not persist into the next open.
  useEffect(() => {
    if (open) setValue(estimateMinutesToHoursInput(task.estimatedMinutes));
  }, [open, task.estimatedMinutes]);

  const parsed = parseEstimateHours(value);
  const showError = value.trim() !== "" && parsed === null;

  const commit = async (estimatedMinutes: number | null) => {
    try {
      await updateTask({ ...task, estimatedMinutes });
      toast.success(t("tasks:popover.estimate.updateSuccess"));
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.estimate.updateError"),
      );
    }
  };

  if (!canEdit) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <form
          className="flex flex-col gap-2 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (parsed === null) return;
            commit(parsed);
          }}
        >
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="task-estimate-hours"
          >
            {t("tasks:popover.estimate.label")}
          </label>
          <Input
            nativeInput
            id="task-estimate-hours"
            inputMode="decimal"
            autoComplete="off"
            placeholder={t("tasks:popover.estimate.placeholder")}
            value={value}
            aria-invalid={showError || undefined}
            onChange={(event) => setValue(event.target.value)}
          />
          {showError && (
            <p className="text-xs text-destructive">
              {t("tasks:popover.estimate.invalid")}
            </p>
          )}
          <Button type="submit" size="sm" disabled={parsed === null}>
            {t("tasks:popover.estimate.save")}
          </Button>
        </form>
        {task.estimatedMinutes !== null && (
          <div className="pt-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => commit(null)}
            >
              <X className="h-4 w-4" />
              {t("tasks:popover.estimate.clear")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

`nativeInput` on `<Input>` is required: it renders a plain `<input>` so the component test can use
`getByLabelText` + `fireEvent.change`. Do not drop it.

### 4.15 `apps/web/src/components/task/task-properties-sidebar.tsx` (edit)

There are **three** mount sites for the per-field triggers in this file — compact, mobile
non-compact, and desktop non-compact. Add the estimate trigger to **all three**, each time
**immediately after the closing `)}` of the `TaskDueDatePopover` block** in that group:

| Site | Anchor | Trigger `className` |
|---|---|---|
| compact | after line 326 (`)}` closing the `{task && (<TaskDueDatePopover .../>)}` inside the compact `<div>`) | `"justify-start h-7 px-1.5 gap-1.5"` |
| mobile non-compact | after line 517 | `"justify-start h-7 px-1.5 gap-1.5"` |
| desktop non-compact | after line 710 | `"justify-start h-7 px-1.5 gap-1.5 w-full"` |

Block to insert (substitute the `className` from the table):

```tsx
              {task && (
                <TaskEstimatePopover task={task}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="<from table>"
                  >
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span
                      className={`text-xs font-semibold ${task.estimatedMinutes ? "" : "text-muted-foreground"}`}
                    >
                      {formatEstimateMinutes(task.estimatedMinutes) ??
                        t("tasks:properties.estimate")}
                    </span>
                  </Button>
                </TaskEstimatePopover>
              )}
```

Also in this file:

- Add `Clock,` to the `lucide-react` import (line 1–9), between `CalendarX,` and `Copy,`.
- Add `import { formatEstimateMinutes } from "@/lib/estimate";` — Biome sorts it after
  `import { getDueDateStatus... } from "@/lib/due-date-status";` (line 32–36) and before
  `import { formatDateShort } from "@/lib/format";` (line 37).
- Add `import TaskEstimatePopover from "./task-estimate-popover";` immediately after
  `import TaskDueDatePopover from "./task-due-date-popover";` (line 43).

### 4.16 `apps/web/src/components/kanban-board/task-card.tsx` (edit)

- Add `Clock,` to the `lucide-react` import (lines 5–11), between `CalendarX,` and `GitMerge,`.
- Add `import { formatEstimateMinutes } from "@/lib/estimate";` — Biome sorts it after
  `import { getDueDateStatus... } from "@/lib/due-date-status";` (lines 32–36) and before
  `import { getInitials } from "@/lib/get-initials";` (line 37).
- Immediately after the `assignee` `useMemo` (ends line 132), add:

```tsx
  const estimateLabel = formatEstimateMinutes(task.estimatedMinutes);
```

- In the metadata row `<div className="flex items-center gap-1.5">` (line 259), insert
  **immediately after the `showDueDates && task.dueDate` block closes** (line 280) and before the
  `pullRequests.length === 1` block (line 282):

```tsx
              {estimateLabel && (
                <span
                  title={t("tasks:properties.estimate")}
                  className="inline-flex items-center gap-1 rounded border border-border/70 bg-muted/55 px-2 py-1 text-[10px] font-medium text-muted-foreground"
                >
                  <Clock className="h-3 w-3" />
                  <span>{estimateLabel}</span>
                </span>
              )}
```

There is **no** user-preference toggle for this badge; do not add one to
`useUserPreferencesStore` (out of scope, and `store/user-preferences` is not allowlisted). When
`task.estimatedMinutes` is `null`, `estimateLabel` is `null` and nothing renders — the card's DOM is
unchanged from today (AC-5).

### 4.17 `apps/web/src/components/kanban-board/column/column-header.tsx` (edit)

- Add `import { formatEstimateMinutes, sumEstimateMinutes } from "@/lib/estimate";` — Biome sorts it
  after `import { getColumnIcon } from "@/lib/column";` (line 8) and before
  `import { toast } from "@/lib/toast";` (line 9).
- Immediately after `const canCreate = canCreateTasks();` (line 24), add:

```tsx
  const estimateTotal = formatEstimateMinutes(sumEstimateMinutes(column.tasks));
```

  Derived per render from props already in hand — no `useMemo`, no `useEffect`, no store write, no
  query (FR-H5).
- Immediately after the task-count `<span>` (lines 62–64) and still inside the
  `<div className="flex min-w-0 items-center gap-2">`, add:

```tsx
        {estimateTotal && (
          <span
            title={t("tasks:kanban.estimateTotal")}
            className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
          >
            {estimateTotal}
          </span>
        )}
```

`column.tasks` is typed `Task[]` via `ProjectWithTasks` and is **already the filtered set** —
`use-task-filters-with-labels-support.ts:196` rebuilds each column as `tasks: filterTasks(column.tasks)`.
No new prop, no new query, no new store read (FR-H2).

When the total is `0` — whether because there are no tasks, or because every task's estimate is
`null` — `formatEstimateMinutes(0)` returns `null` and the badge is not rendered. Those two states
collapsing to the same hidden output is an accepted Gate-1 decision (Q-2), not a defect.

### 4.18 `i18n/en-US.json` (edit)

See §7.

---

## 5. Validation contract

**Definition:** `apps/api/src/task/estimate-schema.ts` (§4.3), a new file with no database import.

**Exports:** `estimatedMinutesSchema` (the bare bounded integer, used by tests and reusable) and
`estimatedMinutesFieldSchema` (the request-body member).

**Shape:** `v.optional(v.nullable(estimatedMinutesSchema))` — **both**. Concretely:

| Body value | Result |
|---|---|
| key omitted | accepted, arrives as `undefined` |
| `null` | accepted, arrives as `null` |
| `1` … `2147483647` (integer) | accepted |
| `0`, `-5` | rejected — `minValue` |
| `2147483648` | rejected — `maxValue` |
| `1.5` | rejected — `integer` |
| `"90"` (string) | rejected — `number` |
| `NaN`, `Infinity` | rejected — `integer` (Valibot's `integer` uses `Number.isInteger`) |

**Omission semantics on `PUT /task/:id`:** omitting the key is **identical to sending `null`** —
the estimate is cleared. `PUT /task/:id` is a full-document replace today; every other optional
field behaves this way (`startDate`, `dueDate`, `userId` all become `null` when absent). The
controller enforces it with `estimatedMinutes ?? null` in `.set()`, which maps both `undefined` and
`null` to SQL `NULL`. This is exactly why §4.11 sends `?? null` explicitly rather than relying on
`undefined` being dropped by JSON serialization.

**Omission semantics on `POST /task/:projectId`:** identical — `estimatedMinutes ?? null` in the
insert values, so a create without the key stores `NULL`.

**400 vs 500 reasoning:** `hono-openapi`'s `validator("json", ...)` runs before the route handler and
returns **400** on any Valibot failure, without touching the database. Without the `integer` /
`minValue` / `maxValue` pipe, a body of `1.5` or `2147483648` would pass a bare `v.number()`, reach
`db.update(...).set({ estimatedMinutes: 2147483648 })`, and fail inside the Postgres driver as an
`int4` range error — surfacing as an unhandled **500**. The bounds exist to convert a driver-level
500 into a contract-level 400. `MAX_ESTIMATED_MINUTES = 2147483647` is the `int4` ceiling and must
match the column type exactly; if the column type ever changes, this constant changes with it.

**Authorization: unchanged.** The estimate is written only through routes already guarded by
`workspaceAccess` + `requireWorkspacePermission({ task: [...] })` (+ `requireTaskAssigneePermission`
and `requireEntitlement` on the PUT). No new permission verb, no new middleware, no change to
`@kaneo/permissions`. `useWorkspacePermission().canUpdateTasks()` in the popover is a UI
convenience only.

**Events: unchanged.** No new `publishEvent()` topic. The existing `task.updated` publication in
`update-task.ts` already fires on every PUT and drives the realtime refresh; the existing
`task.created` spread already carries the new column. Do not add an activity-feed entry — `startDate`
has none either (FR-B6).

---

## 6. Migration

Run from the repo root, **after** §4.1 lands and before anything else in the API layer is verified:

```
pnpm --filter @kaneo/api db:generate
```

Expected new files:

- `apps/api/drizzle/0043_<drizzle-generated-name>.sql`
- modified `apps/api/drizzle/meta/_journal.json` (a new entry with `"idx": 43`, `"version": "7"`)
- new `apps/api/drizzle/meta/0043_snapshot.json`

Expected SQL — the **entire** contents of `0043_*.sql`:

```sql
ALTER TABLE "task" ADD COLUMN "estimated_minutes" integer;
```

Accept the migration only if all of the following hold:

1. The statement is exactly the one above — one line, one statement.
2. No `NOT NULL`, no `DEFAULT`, no `UPDATE`, no backfill, no `CREATE INDEX`. Any of these makes the
   migration unsafe on a populated production table (NFR-2). `ADD COLUMN` of a nullable column with
   no default is a catalog-only operation on PG 11+ and takes no table rewrite.
3. The column name is `estimated_minutes` and the Drizzle field is `estimatedMinutes` — verify both
   sides agree by reading `0043_*.sql` and `schema.ts` together. A mismatch here is silent at
   compile time and fatal at runtime.
4. **`git status` shows no modification to `apps/api/drizzle/0000_*.sql` … `0042_previous_the_executioner.sql`.**
   Those 43 files are immutable. If `db:generate` rewrites any of them, discard the whole generation
   and stop — do not hand-edit them back (AC-1).
5. `_journal.json` is *appended to*, never rewritten. The existing entry `{"idx": 42, "tag":
   "0042_previous_the_executioner"}` must be byte-identical afterwards.

If the drizzle name generator produces a name other than `0043_...`, stop — it means the journal was
out of sync before the run.

---

## 7. i18n keys

File: `i18n/en-US.json`. **The file is TAB-indented.** Match the surrounding indentation exactly —
new lines under `tasks.properties` are three tabs, under `tasks.popover.estimate` are four tabs.
Only `en-US.json` changes; the 17 other locale files are off-limits and fall back to English, which
is this repo's existing behavior for new copy (FR-I3).

**(a) `tasks.properties`** (object at line 1728). Add after `"noDate": "No date"` (line 1735) —
remember to add a comma to the `noDate` line:

```json
				"estimate": "Estimate"
```

**(b) `tasks.popover`** (object at line 1748). Add a new `estimate` object after the `startDate`
object closes (line 1768) and before `"labels": {` (line 1769) — add a comma after the `startDate`
object's closing brace:

```json
			"estimate": {
				"label": "Estimated hours",
				"placeholder": "e.g. 1.5",
				"save": "Save",
				"clear": "Clear estimate",
				"invalid": "Enter hours as a positive number, for example 1.5",
				"updateSuccess": "Task estimate updated successfully",
				"updateError": "Failed to update task estimate"
			},
```

**(c) `tasks.kanban`** (object at line 1884). Add after `"addTask": "Add task"` (line 1885) — add a
comma to that line:

```json
			"estimateTotal": "Total estimate"
```

Final key list (9 keys, all static, no template interpolation, no new namespace):

| Key | English | Used by |
|---|---|---|
| `tasks:properties.estimate` | `Estimate` | sidebar trigger placeholder, card badge `title` |
| `tasks:popover.estimate.label` | `Estimated hours` | popover input label |
| `tasks:popover.estimate.placeholder` | `e.g. 1.5` | popover input placeholder |
| `tasks:popover.estimate.save` | `Save` | popover submit button |
| `tasks:popover.estimate.clear` | `Clear estimate` | popover clear action |
| `tasks:popover.estimate.invalid` | `Enter hours as a positive number, for example 1.5` | popover inline error |
| `tasks:popover.estimate.updateSuccess` | `Task estimate updated successfully` | `toast.success` |
| `tasks:popover.estimate.updateError` | `Failed to update task estimate` | `toast.error` |
| `tasks:kanban.estimateTotal` | `Total estimate` | rollup badge `title` |

The rollup badge and the card badge render the **formatter output** (`"1.5h"`), which is a number
plus a unit letter and is deliberately not translated — same treatment as `column.tasks.length`.

---

## 8. Test plan

### 8.1 `tests/api/task/estimate-schema.test.ts` (new)

New directory `tests/api/task/`. Runs under `apps/api/vitest.config.ts`
(`include: ["../../tests/api/**/*.test.ts"]`, `environment: "node"`). Pure-function style, matching
`tests/api/column/to-slug.test.ts` — `import { describe, expect, it } from "vitest"` plus a relative
import three levels up:

```ts
import {
  estimatedMinutesFieldSchema,
  estimatedMinutesSchema,
  MAX_ESTIMATED_MINUTES,
} from "../../../apps/api/src/task/estimate-schema";
```

Assert with `v.safeParse(schema, input).success`. Cases:

| Input | Schema | Expected |
|---|---|---|
| `1` | `estimatedMinutesSchema` | success |
| `90` | `estimatedMinutesSchema` | success |
| `2147483647` | `estimatedMinutesSchema` | success |
| `MAX_ESTIMATED_MINUTES` | — | equals `2147483647` |
| `0` | `estimatedMinutesSchema` | failure |
| `-5` | `estimatedMinutesSchema` | failure |
| `1.5` | `estimatedMinutesSchema` | failure |
| `2147483648` | `estimatedMinutesSchema` | failure |
| `Number.NaN` | `estimatedMinutesSchema` | failure |
| `Number.POSITIVE_INFINITY` | `estimatedMinutesSchema` | failure |
| `"90"` | `estimatedMinutesSchema` | failure |
| `null` | `estimatedMinutesSchema` | failure |
| `null` | `estimatedMinutesFieldSchema` | success (explicit clear) |
| `undefined` | `estimatedMinutesFieldSchema` | success (omitted key) |
| `60` | `estimatedMinutesFieldSchema` | success |
| `0` | `estimatedMinutesFieldSchema` | failure |

This file must not import anything that transitively pulls in `apps/api/src/database`.

### 8.2 `apps/web/src/lib/estimate.test.ts` (new)

`import { describe, expect, it } from "vitest"` + `import { ... } from "./estimate";`. Style matches
`apps/web/src/lib/due-date-status.test.ts` — no jsdom dependency, no mocks.

- `formatEstimateMinutes`: every row of the §2.2 table, asserted exactly, including
  `formatEstimateMinutes(6000) === "100h"` and the four `null`-returning inputs
  (`null`, `undefined`, `0`, `-5`, `1.5`, `Number.NaN`).
- `parseEstimateHours`: `"1.5" → 90`, `"2" → 120`, `"0.25" → 15`, `"  1.5  " → 90`,
  `"0.02" → 1`; `null` for `""`, `"   "`, `"abc"`, `"-1"`, `"0"`, `"0.001"`, `"1,5"`, `"1e3"`,
  `"1.2.3"`, and `"35791394.13"` (exceeds `MAX_ESTIMATE_MINUTES`).
- `estimateMinutesToHoursInput`: `90 → "1.5"`, `120 → "2"`, `100 → "1.67"`, `null → ""`, `0 → ""`.
  Note: no `"h"` suffix.
- **Round-trip** (§2.4): for `[1, 30, 90, 100, 120, 4825, 6000, 2147483647]`, assert
  `parseEstimateHours(estimateMinutesToHoursInput(m)) === m`.
- `sumEstimateMinutes`: `[{estimatedMinutes: 100}, {estimatedMinutes: null}, {estimatedMinutes: 100}, {estimatedMinutes: 100}] → 300`;
  `[] → 0`; all-null `→ 0`; and the integer-purity assertion
  `Number.isInteger(sumEstimateMinutes([{estimatedMinutes: 10},{estimatedMinutes: 20}])) === true`.
- **The header-agrees-with-cards case**, written as an explicit test so the invariant is pinned:
  three tasks of `100` each render `"1.67h"` per card while
  `formatEstimateMinutes(sumEstimateMinutes(tasks)) === "5h"`, and assert it is **not** `"5.01h"`.

### 8.3 `apps/web/src/components/kanban-board/column/column-header.test.tsx` (new)

jsdom + `@testing-library/react`, mock style copied from
`apps/web/src/components/task/task-status-popover.test.tsx` (`vi.mock` at module scope, `cleanup()`
in `afterEach`). Required mocks:

```ts
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/mutations/task/use-update-task", () => ({ useUpdateTask: () => ({ mutate: vi.fn() }) }));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateTasks: () => false, canCreateTasks: () => false }),
}));
vi.mock("@/components/shared/modals/create-task-modal", () => ({ default: () => null }));
vi.mock("@/components/shared/modals/archive-tasks-modal", () => ({ ArchiveTasksModal: () => null }));
vi.mock("@/store/project", () => ({ default: () => ({ project: null, setProject: vi.fn() }) }));
```

Build a `makeTask(overrides)` helper producing a full `Task` literal (all required fields, including
`estimatedMinutes: null`). Cases:

1. **Mixed nulls** — column with tasks of `100`, `null`, `100`, `100` minutes renders `"5h"`, and the
   count badge still renders `"4"`.
2. **All null** — four tasks, every `estimatedMinutes: null` → `screen.queryByText(/h$/)` is `null`
   and no element carries `title="tasks:kanban.estimateTotal"`. Assert via
   `screen.queryByTitle("tasks:kanban.estimateTotal")` being `null`.
3. **Empty column** — `tasks: []` → no rollup badge, count badge reads `"0"`.
4. **Sum is not NaN** — a column of `[{estimatedMinutes: null}, {estimatedMinutes: 30}]` renders
   `"0.5h"`, proving null contributes `0` rather than poisoning the sum (FR-H3).
5. **Header agrees with cards** — same three-×-100 fixture as §8.2, asserting the header shows `"5h"`.

### 8.4 `apps/web/src/components/task/task-estimate-popover.test.tsx` (new)

Same mock style. Mock `@/hooks/mutations/task/use-update-task` with a captured
`mutateAsync = vi.fn().mockResolvedValue({})`, mock `@/lib/toast`, mock `react-i18next`, and mock
`@/hooks/use-workspace-permission` per-test. Cases:

1. **Saves hours as minutes** — task with `estimatedMinutes: null`; open the popover, type `"1.5"` in
   the field labelled `tasks:popover.estimate.label`, submit, assert
   `mutateAsync` was called with an object whose `estimatedMinutes === 90`.
2. **Prefills from stored minutes** — task with `estimatedMinutes: 90`; opening the popover shows
   input value `"1.5"`.
3. **Clear sends null** — task with `estimatedMinutes: 90`; click
   `tasks:popover.estimate.clear`, assert `mutateAsync` called with `estimatedMinutes: null`.
4. **Rejects bad input** — type `"-1"`; the save button is `disabled` and
   `tasks:popover.estimate.invalid` is visible; `mutateAsync` not called.
5. **Read-only (AC-7)** — `canUpdateTasks: () => false`; the children render, clicking the trigger
   opens nothing (`screen.queryByLabelText("tasks:popover.estimate.label")` stays `null`).

### 8.5 Existing tests

`apps/web/src/**/*.test.tsx` fixtures that construct a `Task` literal (at minimum
`task-status-popover.test.tsx`) need `estimatedMinutes: null,` added — the property is required
(§4.10). These files are allowlisted. Nothing else in the existing suites should change.

### 8.6 Verification commands

```
pnpm --filter @kaneo/api test        # baseline 374, must be >= 374 + new
pnpm --filter @kaneo/web test        # baseline 112, must be >= 112 + new
pnpm --filter @kaneo/api typecheck
pnpm --filter @kaneo/web typecheck
pnpm exec biome ci .
```

Do **not** run the `lint` scripts (`biome check --write`) — they rewrite unrelated files (NFR-5,
`AGENTS.md`).

---

## 9. Ordering and dependencies

Packets execute in this order. `→` means "must complete before".

```
P1  schema.ts                                     (db)
P2  db:generate → 0043_*.sql + meta/**            (db)          depends on P1
P3  estimate-schema.ts                            (api)         independent of P1/P2
P4  create-task.ts + update-task.ts               (api)         depends on P1
P5  get-tasks.ts + get-task.ts + schemas.ts       (api)         depends on P1
P6  task/index.ts                                 (api)         depends on P3, P4  — ATOMIC with P4
P7  types/task/index.ts + fetchers/task/update-task.ts
                                                  (web-data)    depends on P6      — ATOMIC pair
P8  lib/estimate.ts                               (web-ui)      depends on P7
P9  i18n/en-US.json                               (i18n)        independent
P10 task-estimate-popover.tsx                     (web-ui)      depends on P7, P8, P9
P11 task-properties-sidebar.tsx                   (web-ui)      depends on P10
P12 task-card.tsx                                 (web-ui)      depends on P7, P8, P9
P13 column-header.tsx                             (web-ui)      depends on P7, P8, P9
P14 tests/api/task/estimate-schema.test.ts        (test)        depends on P3
P15 apps/web/src/lib/estimate.test.ts             (test)        depends on P8
P16 column-header.test.tsx                        (test)        depends on P13
P17 task-estimate-popover.test.tsx                (test)        depends on P10
P18 existing Task-literal fixture updates         (test)        ATOMIC with P7
```

Atomic pairs (must land in the same commit or the repo does not typecheck between them):

- **P4 + P6.** `updateTask` gains a 12th parameter and its single call site passes it. Splitting
  these leaves either an unused parameter (harmless) or a call-site arity mismatch (breaks
  typecheck). Do them together.
- **P7 + P18.** `Task.estimatedMinutes` is a **required** property. The moment `types/task/index.ts`
  changes, every `Task` object literal in the web app must supply it. `apps/web/src/**/*.test.tsx`
  fixtures are the known consumers; if `pnpm --filter @kaneo/web typecheck` surfaces a construction
  site outside the allowlist, **stop and report** rather than widening the type to optional.
- **P6 → P7.** `@kaneo/libs` resolves to `packages/libs/src/index.ts` (source, not a build artifact),
  so the web app's `InferRequestType<(typeof client)["task"][":id"]["$put"]>["json"]` is derived
  directly from the API's Valibot validator. The fetcher in P7 cannot typecheck until P6 has added
  `estimatedMinutes` to the PUT validator. No `pnpm build` step is needed between them.
- **P9 before P10/P12/P13.** Not a typecheck dependency (i18n keys are string literals), but running
  the component tests before the keys exist produces confusing missing-key output.

---

## 10. Risks / ADR-style rationale

**ADR-1 — Storage is integer minutes, not decimal hours.**
*Context:* the estimate is entered and read in hours. *Decision:* store `integer("estimated_minutes")`.
*Rationale:* no `numeric`/`decimal`/`real` column exists anywhere in `schema.ts`; Drizzle returns
`numeric` as a **JS string**, which makes `+` string-concatenate silently in the rollup, and `real`
would put float artifacts (`0.30000000000000004`) in the DOM. Precedent: `timeEntryTable.duration:
integer("duration")` (`schema.ts:527`). *Consequences:* one conversion boundary, entirely in
`apps/web/src/lib/estimate.ts`; the API never sees hours; all summation is exact integer arithmetic.

**ADR-2 — Field name is `estimatedMinutes` / `estimated_minutes`, everywhere.**
*Decision:* the unit is in the name at every read site — schema, migration, controller params,
`taskSchema`, request bodies, `Task` type, formatter arguments. *Consequences:* no reader can
mistake the value for hours; the intent brief's "hours" refers only to the display unit. The Drizzle
field and the generated SQL must be verified to agree (§6, check 3) — a mismatch is silent at
compile time.

**ADR-3 — No new endpoint; the estimate rides the existing full `POST`/`PUT`.**
*Context:* the repo has both patterns — `TaskDueDatePopover` uses a dedicated
`PATCH`-style single-field route, `TaskStartDatePopover` uses the whole-task `PUT` via
`useUpdateTask()`. *Decision:* follow `TaskStartDatePopover`. *Consequences:* zero new routes, zero
new controllers, zero new permission wiring, and the existing `task.updated` event + `useUpdateTask`
invalidations cover realtime and cache refresh for free. Cost: the whole task round-trips on every
estimate edit, which is already true for start-date edits.

**ADR-4 — No index on `estimated_minutes`.**
*Context:* `taskTable` already carries four indexes plus a unique constraint. *Decision:* add none.
*Rationale:* the field is never a `WHERE` or `ORDER BY` target in this change; the rollup is computed
client-side over a set already fetched and already rendered. An unused index costs write throughput
on the hottest table in the product for zero read benefit. *Consequences:* if sorting or filtering by
estimate is added later, that change adds the index with its own migration.

**ADR-5 — No new event topic and no activity entry.**
*Decision:* reuse `task.updated` / `task.created`. *Rationale:* the estimate is a task property like
`priority` and `startDate`; `startDate` has no activity-feed entry either. The existing publications
already fire on every write path that can change the estimate. *Consequences:* the estimate changing
is visible in realtime but does not appear as a distinct line in task history. Accepted.

**ADR-6 — The rollup needs no plumbing.**
*Context:* board filtering happens in `use-task-filters-with-labels-support.ts`, which rebuilds each
column as `tasks: filterTasks(column.tasks)` (line 196) before `ColumnHeader` ever sees it.
*Decision:* compute the sum inline in `ColumnHeader` from `column.tasks`. *Consequences:* the header
total always matches the visible cards, including under active filters, with **no new prop, no new
query, no new store read, no `useEffect`, and no `useMemo`** — it is an O(n) reduce over a list that
is already re-rendered every frame (NFR-3). Any packet that proposes threading a total down from a
parent is wrong.

**ADR-7 — Sum raw minutes, format once.**
*Decision:* §2.3. *Consequences:* the header can legitimately disagree with the naive sum of the
displayed card values (three `"1.67h"` cards under a `"5h"` header). This is correct; the alternative
accumulates rounding error and reports totals no set of stored values can produce. The invariant is
pinned by an explicit test (§8.2, last bullet, and §8.3 case 5).

**R-1 (hazard) — the positional `updateTask` signature.**
`updateTask` takes **11 positional parameters** with two trailing optionals (`userId?`,
`currentUserId?`). Appending a 12th optional at the end is the only safe edit; inserting anywhere
else silently shifts `userId`/`currentUserId` and would, e.g., write a user id into the
`estimatedMinutes` column with no type error at some call sites. Mitigation: (a) append last,
(b) after the edit run `grep -rn "updateTask(" apps/api/src` and confirm the only genuine call site
is `apps/api/src/task/index.ts:378`, (c) the P4+P6 atomicity rule in §9.

**R-2 (hazard) — `Task.estimatedMinutes` is required, not optional.** Chosen deliberately so the
compiler enumerates every construction site. If typecheck surfaces a site outside the allowlist,
stop and report; do not make the property optional to dodge it.

**R-3 (hazard) — `format-duration.ts` is a decoy.** Zero importers, takes seconds, emits
`"1h 30m 0s"`, not allowlisted. See §2.1.

**R-4 (out of scope, flag only) — `.husky/pre-commit` runs `pnpm exec biome ci . && pnpm run build`,
and `.gitignore` is off-limits.** Committing `.sdlc/` artifacts on this branch will trip that hook.
Not fixed by this run; report it at the end.

---

## 11. Off-limits reminders

The PreToolUse hook refuses any write outside the allowlist. Specific temptations in this change:

| Tempting path | Why a worker might reach for it | Ruling |
|---|---|---|
| `apps/web/src/lib/format.ts`, `lib/format-duration.ts`, `lib/column.tsx` | "the formatter belongs with the other formatters" | **Blocked.** `apps/web/src/lib/estimate.ts` is the *only* writable file under `lib/`. |
| `apps/web/src/components/kanban-board/task-labels.tsx` and other kanban files | badge styling lives nearby | **Blocked.** Only `kanban-board/task-card.tsx` and `kanban-board/column/column-header.tsx` are allowlisted. |
| `apps/api/src/task/controllers/export-tasks.ts` | "the export should include the estimate" | **Blocked** and out of scope (§2.2 of requirements). |
| `apps/api/src/mcp/**`, `packages/mcp/**` | "expose the estimate as an MCP tool field" | **Blocked** and out of scope. |
| `apps/web/src/components/public-project/**` | the public board renders task cards too | **Blocked** and out of scope. |
| `apps/web/src/store/user-preferences.ts` | "add a `showEstimates` toggle like `showDueDates`" | **Blocked** and out of scope — the badge is unconditional. |
| `i18n/de-DE.json` and the 16 other locales | "the new keys are missing translations" | **Blocked.** English fallback is the repo's existing behavior (FR-I3). |
| `apps/docs/**`, `apps/site/**`, `charts/**` | documenting the new field | **Blocked** and out of scope. |
| `AGENTS.md`, `CLAUDE.md`, `.github/**`, `biome.json`, `.husky/**`, `.gitignore`, `.env*` | tooling friction | **Blocked**, unconditionally. |
| `apps/api/drizzle/0000_*.sql` … `0042_previous_the_executioner.sql` | drizzle regeneration churn | **Blocked.** Immutable; if `db:generate` touches them, discard and stop (§6). |

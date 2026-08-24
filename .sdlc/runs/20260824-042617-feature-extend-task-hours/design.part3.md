## Part 3 — Column rollup, i18n, tests, verification

### 10. DR-6 — Column-header estimate rollup (DECIDED)

**Visual form.** A second pill immediately to the right of the existing count pill, same pill geometry, containing a `Clock` glyph plus terse text. It is display-only: it lives in the header's left `div`, never inside `column-dropzone.tsx`, and does not participate in drag/drop.

**Rollup arithmetic.** Sum over `column.tasks` (already filter-narrowed, DR-1) of `estimatedHours` where `typeof task.estimatedHours === "number"`. `0` is a real estimate and counts toward *estimated task count* while adding nothing to the sum; `null`/`undefined` is *not estimated*. **Never** `task.estimatedHours || 0` inside the filter predicate — that would silently reclassify `0` as unestimated (DR-2, DR-5).

**Three states, distinguished without colour.** State is carried three redundant ways — visible text, a `data-estimate-state` attribute, and the accessible name. No colour, no icon-only difference.

| state | condition | visible text | `data-estimate-state` | accessible name |
|---|---|---|---|---|
| none | 0 tasks estimated | `—` | `none` | "No hours estimated" |
| partial | 0 < n < total | `12h · 2/5` | `partial` | "12h estimated across 2 of 5 tasks" |
| all | n === total | `12h` | `all` | "12h estimated across all 5 tasks" |

**Programmatic accessible name.** The pill is `role="img"` with `aria-label={estimateLabel}`, so the terse visible text is presentational to AT and the full sentence is the computed name. `aria-label` on a bare generic span is not reliably exposed; `role="img"` makes it so, and keeps `getByLabelText` working in the component test. `title` mirrors the label for sighted hover.

The pill renders only when `column.tasks.length > 0` (an empty column has nothing to roll up and the count pill already reads `0`).

#### 10.1 `apps/web/src/components/kanban-board/column/column-header.tsx`

Hunk A — import (anchor: line 2, existing lucide import):

```diff
-import { Archive, Plus } from "lucide-react";
+import { Archive, Clock, Plus } from "lucide-react";
```

Hunk B — derived values, inserted after `handleConfirmArchive` and before `return (`:

```tsx
  const estimatedTasks = column.tasks.filter(
    (task) => typeof task.estimatedHours === "number",
  );
  const estimatedTotal = estimatedTasks.reduce(
    (sum, task) => sum + (task.estimatedHours as number),
    0,
  );
  const estimateState =
    estimatedTasks.length === 0
      ? "none"
      : estimatedTasks.length === column.tasks.length
        ? "all"
        : "partial";
  const estimateArgs = {
    hours: estimatedTotal,
    done: estimatedTasks.length,
    total: column.tasks.length,
  };
  const estimateLabel =
    estimateState === "none"
      ? t("tasks:kanban.estimate.none")
      : t(`tasks:kanban.estimate.${estimateState}`, estimateArgs);
  const estimateText =
    estimateState === "none"
      ? t("tasks:kanban.estimate.noneShort")
      : t(`tasks:kanban.estimate.${estimateState}Short`, estimateArgs);
```

Hunk C — full modified render block. The count pill is byte-identical to HEAD; the archive and add buttons, both modals, and the wrapper classes are unchanged.

```tsx
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-muted-foreground">
          {getColumnIcon(column.id, column.isFinal, column.icon)}
        </span>
        <span className="truncate text-sm font-medium text-foreground/95">
          {column.name}
        </span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          {column.tasks.length}
        </span>
        {column.tasks.length > 0 && (
          <span
            role="img"
            aria-label={estimateLabel}
            title={estimateLabel}
            data-estimate-state={estimateState}
            className="flex shrink-0 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
          >
            <Clock className="h-3 w-3" />
            {estimateText}
          </span>
        )}
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
```

`handleConfirmArchive` is **not** modified: `updateTask({ ...task, status: "archived" })` spreads the whole task, so `estimatedHours` rides through the full-PUT fetcher patched in Part 2 §4.3b and is preserved. This is asserted, not assumed (T-6b).

### 11. i18n — `i18n/en-US.json` only

Only `i18n/en-US.json` is edited. `i18n/schema.json` is generated and off-limits; the other 16 locales are translated separately and are **not** hand-filled.

Add to `common.modals.createTask`:
```json
"estimatedHours": "Estimated hours"
```

Add to `tasks.properties`:
```json
"estimatedHoursLabel": "Estimated hours",
"estimatedHours_one": "{{count}} hour",
"estimatedHours_other": "{{count}} hours",
"noEstimate": "No estimate"
```

Add `tasks.popover.estimatedHours` (new sibling of `dueDate`):
```json
"estimatedHours": {
  "placeholder": "Hours (0–1000)",
  "clear": "Clear estimate",
  "updateSuccess": "Task estimate updated successfully",
  "updateError": "Failed to update task estimate"
}
```

Add `tasks.kanban.estimate` (DR-6):
```json
"estimate": {
  "none": "No hours estimated",
  "noneShort": "—",
  "partial": "{{hours}}h estimated across {{done}} of {{total}} tasks",
  "partialShort": "{{hours}}h · {{done}}/{{total}}",
  "all": "{{hours}}h estimated across all {{total}} tasks",
  "allShort": "{{hours}}h"
}
```

Conventions honoured: `estimatedHours_one`/`_other` follow the repo's no-base-key plural form (`permissionCount_one`, `pr.count_one`). Every two-number rollup string interpolates `{{hours}}`/`{{done}}`/`{{total}}` — **`{{count}}` is never used outside plural selection**, because i18next reserves it and a `count` present on the rollup label would hijack plural resolution.

### 12. Test plan → AC map

Every entry is inside the write contract.

**`tests/api-integration/task-estimated-hours.test.ts`** (the one permitted new integration file)
- **T-1 (AC-1)** `"persists estimatedHours on create and defaults to null when omitted"` — POST `/api/task/tasks/:projectId` with `estimatedHours: 8` → 200, body echoes `8`, DB row is `8`; second POST omitting the field → row is `null`.
- **T-2 (AC-2)** `"a full PUT that omits estimatedHours preserves the stored value"` — PUT sets `12`, then a second PUT with the complete task body minus `estimatedHours` → row still `12`, not `null`. Also asserts explicit `null` clears (DR-5).
- **T-3 (AC-3)** `"rejects out-of-range and wrongly-typed estimates with 400"` — `-1`, `1001`, `2.5`, `"8"` on both create and update → 400; the seeded row's value is re-read and unchanged, proving no DB write occurred.
- **T-4 (AC-4, AC-8)** `"board payload exposes estimatedHours on every task"` — GET `/api/task/tasks/:projectId` (wrapped `{ data, pagination }`, columns at `body.data.columns`); asserts the exact sorted `Object.keys()` of a returned task contains `estimatedHours`. This is what catches a missing entry in `get-tasks.ts` `taskSelection`, which `pnpm typecheck` cannot.
- **T-5 (AC-5)** `"single-task read returns estimatedHours"` — GET the single-task route with the workspace context the existing integration helpers supply (calling `/api/task/:projectId` bare 400s with "Workspace ID could not be determined" — that is the *board* path mistake, not a bug).
- **T-6 (AC-7)** `"board payload supports a correct client-side rollup"` — seed one column with `[8, null, 0, 4]`; assert sum-of-non-null `=== 12` and estimated-count `=== 3` (the `0` counts as estimated).
- **T-7 (AC-10)** `"pre-existing task rows read back as null"` — rows inserted without the field are `null` after migration; paired with manual migration SQL inspection (§13 step 2).
- **T-8 (AC-12)** `"a non-member cannot create or read a task estimate"` — existing `requireWorkspacePermission` middleware returns 403 with no new guard; `packages/permissions` is untouched.

**`tests/api/task/estimated-hours-validation.test.ts`** (new; `tests/api/task/` is currently empty)
- **T-9 (AC-3)** table-driven Valibot unit test over the create and update schemas: accepts `0`, `1`, `1000`, `undefined`, `null`; rejects `-1`, `1001`, `0.5`, `"8"`, `NaN`, `Infinity`.

**`tests/api/task/build-full-task-update-body.test.ts`** (new)
- **T-10 (AC-9)** `"an MCP patch omitting estimatedHours preserves the existing value"` — `buildFullTaskUpdateBody(existingTask, patchWithoutEstimatedHours)` emits a body whose `estimatedHours` equals the existing value; a patch with explicit `null` emits `null`; a patch with `0` emits `0` (guards against an `||` regression).

**`apps/web/src/components/kanban-board/column/column-header.test.tsx`** (new)
- **T-11 (AC-6)** three fixtures — none estimated, mixed, all estimated. Each asserts the rollup exists via `getByLabelText`, that its `data-estimate-state` is `none`/`partial`/`all` respectively, and that the visible text differs. A fourth assertion checks the count pill still renders `column.tasks.length` unchanged, and a fifth checks a `[0, null]` column reports state `partial` with total `0h`.
- **T-6b (AC-2, web side)** `"archive-all preserves estimatedHours"` — mock `useUpdateTask`, click archive, confirm, assert every `updateTask` call argument carries the task's original `estimatedHours`.

**`apps/web/src/components/shared/modals/create-task-modal.test.tsx`** (existing)
- **T-12 (AC-1, AC-11)** asserts the estimated-hours field renders and that omitting it submits without an `estimatedHours` key.

**`apps/web/src/components/task/estimated-hours-input.test.tsx`** (new)
- **T-13** `parseEstimatedHours`: `""` → `null`, `"0"` → `0`, `"8"` → `8`, `"8.5"`/`"-1"`/`"1001"`/`"abc"` → invalid.

**`apps/web/src/components/task/estimated-hours-i18n.test.ts`** (new)
- **T-14 (AC-11, plural proof)** — **component tests in this repo mock `react-i18next` so `t` merely echoes the key; `t("x", { count: 2 })` returns the literal `"x"`, which makes plural bugs invisible.** So plural selection is proved here instead, against a **real** i18next instance initialised from `i18n/en-US.json`: `estimatedHours` with `count: 1` → `"1 hour"`, `count: 2` → `"2 hours"`, `count: 0` → `"0 hours"`; and the rollup labels resolve with `{{hours}}/{{done}}/{{total}}` substituted and no stray `{{`.

**AC-11 / AC-12 as gates, not tests:** `git diff --name-only` must show `i18n/en-US.json` and no other locale, no `i18n/schema.json`, and nothing under `packages/permissions/`.

### 13. Verification gate — ordered commands

1. `pnpm --filter @kaneo/api db:generate`
2. Inspect the emitted SQL: it must be a single `ALTER TABLE "task" ADD COLUMN "estimated_hours" integer;` — **nullable, no `DEFAULT`, no `NOT NULL`, no backfill `UPDATE`** (AC-10).
3. **Immediately after every `db:generate`:**
   `npx biome format --write apps/api/drizzle/meta/_journal.json apps/api/drizzle/meta/<n>_snapshot.json`
   drizzle-kit writes those files with 2-space indent while `biome.json` sets `indentStyle: "tab"` for JSON and `apps/api/drizzle/**` is not excluded from Biome discovery; `_journal.json` gets rewritten wholesale (~313 insertions / 306 deletions for a 7-line append). `npx biome ci .` is the first CI job, so this reddens CI. Do **not** try to fix it by re-running `db:generate` — that is what produces the spaces. Corollary: lint the files a *generator* wrote, not only the files you edited.
4. `npx biome check apps/api/src apps/web/src tests i18n/en-US.json apps/api/drizzle` — targeted while iterating. Avoid `pnpm lint`; it runs Biome with `--write` and can modify unrelated files.
5. `pnpm typecheck`
6. `pnpm test` (or `pnpm --filter @kaneo/web test` / `--filter @kaneo/api test` while iterating).
7. Integration DB state — the container `kaneo-mmo-itest` on port **55432** is **shared**, and a previous benchmark arm of a different ticket used it. Two arms generate different migrations with the same number, and the second then fails en masse with `column ... already exists` because Drizzle sees its own migration as unapplied and re-runs the `ADD COLUMN`. **Verify migration state instead of assuming a clean DB**; dropping `kaneo_test` is safe because `ensureTestDatabaseExists` recreates and migrates it from zero.
8. `DATABASE_URL=postgresql://postgres:postgres@localhost:55432/kaneo_test pnpm test:integration` — `DATABASE_URL` must be exported **per shell**. There is no committed `apps/api/.env.test`, only `.env.test.example`, which points at the wrong default port.
9. AC-10 second half: apply the migration against a database that already holds task rows (seed rows, then migrate) and confirm it succeeds and leaves every existing row `NULL`.
10. `pnpm i18n:check` — **already red at HEAD** (`common:error.*` missing from `de-DE` and others). Never read a failure here as damage from this run; diff the failing set against the pre-existing set first. Adding `en-US` keys legitimately **widens** the per-locale missing list — expected and correct. **Never run `pnpm i18n:check:fix`**: it copies English strings into all 16 locale files, an explicit non-goal.
11. **Do not regenerate `apps/docs/openapi.json`.** It is ~11 route-groups stale; regenerating produces ~1,481 insertions / 166 deletions of unrelated churn. Document the contract gap (the new `estimatedHours` field is described in the route's OpenAPI metadata in code but not reflected in the checked-in artifact) and defer.
12. `git diff --name-only` — confirm only `i18n/en-US.json` among locales, no `i18n/schema.json`, nothing under `packages/permissions/` (AC-11, AC-12).

**This run stops at the working tree. No commit, no push, no pull request.**

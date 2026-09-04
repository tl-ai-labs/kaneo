# Code Review — `estimated_minutes` task estimate + per-column rollup

Run: `20260903-125223-feature-extend-task-estimated-hours` · Mode: brownfield · Intent: feature-extend
Reviewer scope: files in `provenance.json` (25 paths) + the compile/lint blast radius they create.

## Verdict

**CHANGES REQUIRED** — 2 blockers.

The design is right. The rounding rule, the positional-arity edit, the round-trip, both read
whitelists, the validation bounds, the permission gate and the migration are all correct, and the
new tests are substantive rather than vacuous. What is wrong is that **the deliverable does not
compile and does not lint**: `Task.estimatedMinutes` was made a required property (deliberately,
per ADR/R-2) but only 2 of the 7 construction sites the compiler flags were updated, and 5 of the
new/edited files fail `biome ci` on formatting. Both were foreseen by the plan (R-2 "stop and
report", NFR-5/AC-10) and neither gate was actually run before hand-off.

Evidence:

```
$ pnpm --filter @kaneo/api test        →  59 files, 385 passed   (baseline 374)  PASS
$ pnpm --filter @kaneo/web test        →  39 files, 132 passed   (baseline 112)  PASS
$ pnpm --filter @kaneo/api typecheck   →  clean                                  PASS
$ pnpm --filter @kaneo/web typecheck   →  7 errors in 5 files                    FAIL
$ pnpm exec biome ci <15 changed files> →  Found 5 errors (format)               FAIL
```

---

## Blocking defects

### B1 — `pnpm --filter @kaneo/web typecheck` fails: 7 errors, 5 files

`apps/web/src/types/task/index.ts` added `estimatedMinutes: number | null` as a **required**
property. Only two `Task` literal fixtures were updated (`task-status-popover.test.tsx`,
`list-view/task-row.test.tsx`). Five more construction sites — **three of them production
components, not fixtures** — were left broken.

```
src/components/shared/modals/create-task-modal.tsx(92,3): error TS2322:
  Types of property 'estimatedMinutes' are incompatible.
    Type 'number | null | undefined' is not assignable to type 'number | null'.
src/components/task/task-relations.tsx(241,16): error TS2741:
  Property 'estimatedMinutes' is missing ... but required in type 'Task'.
src/components/task/task-subtasks.tsx(120,74): error TS2741: (same)
src/hooks/mutations/label/sync-task-labels-cache.test.ts(72,7) and (165,7): error TS2345
src/hooks/use-task-filters-with-labels-support.test.tsx(94,39) and (176,41): error TS2345
```

Why it matters: `apps/web` does not typecheck, so the repo-wide `pnpm typecheck` is red and the
change cannot be merged. It is not caught by `pnpm test` (vitest transpiles without type checking)
nor by `pnpm run build` (`vite build`, no `tsc`), which is exactly why it slipped through — the
run's own green test counts are misleading.

Two of the five (`components/task/task-relations.tsx`, `components/task/task-subtasks.tsx`) were
**inside** the run's write allowlist (`apps/web/src/components/task/**`) and were simply missed.
The other three are outside it; this is precisely the R-2 "stop and report" path, which the run did
not take. The allowlist needs a minimal widening — the alternative (making the property optional)
is explicitly forbidden by ADR/R-2 and would silently reintroduce the drag-clears-estimate class of
bug the required property exists to prevent.

The exact edits, all one line each:

- `apps/web/src/components/shared/modals/create-task-modal.tsx` — inside `normalizeTask()`'s
  returned object literal (it spreads `Partial<Task>`, so the spread yields `undefined`), add
  alongside the sibling `?? null` normalizers:
  `estimatedMinutes: task.estimatedMinutes ?? null,`
- `apps/web/src/components/task/task-relations.tsx` — in `buildTaskObject`, which already
  hardcodes `description: null`, `startDate: null`, `createdAt: ""` because the relation query
  does not select them: `estimatedMinutes: null,`
- `apps/web/src/components/task/task-subtasks.tsx` — in `buildTaskObject`, same shape:
  `estimatedMinutes: null,`
- `apps/web/src/hooks/mutations/label/sync-task-labels-cache.test.ts` — add
  `estimatedMinutes: null,` to the task literals feeding the `ProjectWithTasks` fixtures at ~72
  and ~165.
- `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` — same, at ~94 and ~176.

Do **not** change `Task.estimatedMinutes` to optional, and do not add `as Task` / `as
ProjectWithTasks` casts to silence these.

### B2 — `pnpm exec biome ci .` fails on 5 files (AC-10, NFR-5)

```
$ pnpm exec biome ci --reporter=summary <changed files>
The following files need to be formatted:
- apps/web/src/lib/estimate.ts
- apps/web/src/components/task/task-estimate-popover.tsx
- apps/web/src/components/task/task-estimate-popover.test.tsx
- apps/web/src/components/kanban-board/column/column-header.test.tsx
- tests/api/task/estimate-schema.test.ts
Found 5 errors.
```

All five are **pure line-wrapping**, zero lint-rule violations. Verified by diffing each file
against `biome format --stdin-file-path=<real path>`:

- `estimate.ts` — three signatures exceed the print width and must break onto their own lines:
  `isStorableEstimate(minutes: number | null | undefined): minutes is number`,
  `formatEstimateMinutes(minutes: number | null | undefined): string | null`,
  `estimateMinutesToHoursInput(minutes: number | null | undefined): string`.
  (Note: the change_plan §2.5 reference implementation is itself unformatted — codegen copied it
  verbatim, which is correct behavior; the formatter is the tie-breaker.)
- `task-estimate-popover.tsx` — the `@/lib/estimate` import must become a multi-line specifier list.
- the three test files — long `expect(...).toBe(x)` / `.toHaveTextContent("5h")` calls must wrap.

Why it matters: AC-10 explicitly requires this to be clean, and `.husky/pre-commit` runs
`pnpm exec biome ci . && pnpm run build` — the change cannot be committed as it stands.
`biome check --write` on the repo root is forbidden by NFR-5 (it rewrites unrelated files); the fix
must be scoped to these five paths.

---

## Non-blocking nits (optional)

### N1 — hard-coded DOM `id` in a component mounted more than once
`apps/web/src/components/task/task-estimate-popover.tsx`:

```tsx
htmlFor="task-estimate-hours"
id="task-estimate-hours"
```

`task-properties-sidebar.tsx` renders the mobile block (`lg:hidden`, line 354) and the desktop
block (line ~610) **simultaneously in the DOM** — only CSS hides one. Two `TaskEstimatePopover`
instances therefore co-exist. In practice only one `PopoverContent` is mounted at a time (Radix
unmounts closed content and only one popover can be open), so this is latent rather than live, but
it is a duplicate-id/label-association hazard the moment that assumption changes.
Fix: `const inputId = useId();` and use it for both `htmlFor` and `id`. The tests use
`getByLabelText`, which keeps working.

### N2 — input re-seeds mid-typing on a concurrent realtime update
Same file:

```tsx
useEffect(() => {
  if (open) setValue(estimateMinutesToHoursInput(task.estimatedMinutes));
}, [open, task.estimatedMinutes]);
```

The dependency on `task.estimatedMinutes` means a websocket-driven refetch of the task while the
popover is open discards whatever the user has typed. Dropping the value dep and keying only on
`open` (with a ref for the previous open state) would preserve in-flight input. Low probability,
low harm; the comment above it only documents the discarded-edit case, not this one.

### N3 — `taskSchema` under-describes the type in OpenAPI
`apps/api/src/schemas.ts:43`: `estimatedMinutes: v.nullable(v.number())`. The wire value is always
an integer; `v.nullable(v.pipe(v.number(), v.integer()))` would document it accurately, matching
the precision the request validator already has. Advisory only.

Related, and explicitly **not** a finding: `taskSchema` is also used by `/search`
(`apps/api/src/search/index.ts:19`), whose task rows do not select `estimatedMinutes`. That shared
schema already over-declares `position` and `number` for that endpoint, so the new field joins a
pre-existing mismatch rather than creating one. Out of scope for this run.

### N4 — no test for the card badge (FR-G)
`task-card.tsx` renders the badge and hides it when null; FR-J does not require a test and none was
written. The behavior is one `formatEstimateMinutes` call already covered by
`apps/web/src/lib/estimate.test.ts`, so the marginal value is low. Noting for completeness only.

### N5 — loose negative assertion
`column-header.test.tsx`: `expect(screen.queryByText(/h$/)).toBeNull();` would also pass if the
badge rendered `"5 hours"`. The adjacent `queryByTitle("tasks:kanban.estimateTotal")` assertion is
the precise one and does the real work; the regex line is redundant.

### N6 — flaky web suite, unrelated to this change
The first full `pnpm --filter @kaneo/web test` run showed
`src/components/project/generic-webhook-integration-settings.test.tsx` timing out at 5000ms and a
vitest worker failing to start for `column-header.test.tsx`. A second run was fully green (39 files,
132 tests). Machine-load flake in a pre-existing file; not caused by this change and not in scope.

---

## Per-risk findings

1. **Rollup sums integers, formats once — PASS.**
   `column-header.tsx:26`: `const estimateTotal = formatEstimateMinutes(sumEstimateMinutes(column.tasks));`
   Exactly one formatter call, applied to the raw integer total. No per-task hour float, no string
   summation anywhere. `estimate.test.ts` pins the invariant: three 100-minute tasks →
   `expect(headerDisplay).toBe("5h"); expect(headerDisplay).not.toBe("5.01h");`. Derived inline per
   render — no `useEffect`, no `useMemo`, no new prop, no query (FR-H5, ADR-6).

2. **`updateTask` positional arity — PASS.** Read both files, not the diff.
   `update-task.ts:9-21` signature: `id, title, status, startDate, dueDate, projectId, description,
   priority, position, userId?, currentUserId?, estimatedMinutes?`. Every pre-existing parameter
   holds its original index, name and type; the new one is 12th and last.
   `task/index.ts:384-395` passes `id, title, status, parsedStartDate, parsedDueDate, projectId,
   description, priority, position, userId, currentUserId, estimatedMinutes` — 12 arguments, the
   new one after `currentUserId`. `grep -rn "updateTask(" apps/api/src packages` returns exactly
   two hits: the definition and that one call site. `.set()` writes `estimatedMinutes ?? null`,
   mapping both `undefined` and `null` to SQL NULL as §5 requires.

3. **Round-trip preservation — PASS.**
   `apps/web/src/fetchers/task/update-task.ts:25`: `estimatedMinutes: task.estimatedMinutes ?? null,`
   is in the PUT `json` body, so drag-reorder / archive / inline title edits (all of which round-trip
   the whole task through this single fetcher) carry the estimate rather than clearing it.
   `useUpdateTask` correctly left untouched — its existing invalidations
   (`["task", id]`, `["tasks", projectId]`, `["projects"]`, …) already cover every surface.

4. **Both read whitelists — PASS.**
   `get-tasks.ts:132` `estimatedMinutes: taskTable.estimatedMinutes,` inside `taskSelection`, with the
   three `...task` spreads at 234/243/251 propagating it. `get-task.ts:17` has the same entry in its
   separate inline whitelist. Independently corroborated by the compiler: `task-properties-sidebar.tsx`
   passes `useGetTask()`'s inferred response straight into `TaskEstimatePopover task={task}` (typed
   `Task`, required field) and that file is **not** among the 7 typecheck errors — the field
   demonstrably reaches the client on the single-task path. Same argument holds for the list path via
   `ProjectWithTasks`'s `tasks: Task[]` override in `types/project/index.ts`.

5. **Validation → 400 not 500 — PASS.**
   `apps/api/src/task/estimate-schema.ts`:
   `v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2147483647))`, wrapped as
   `estimatedMinutesFieldSchema = v.optional(v.nullable(estimatedMinutesSchema))`.
   Wired into **both** validators: `task/index.ts:199` (POST `/task/:projectId`) and `task/index.ts:345`
   (PUT `/task/:id`), both destructured and forwarded. `hono-openapi`'s `validator("json", …)` runs
   before the handler, so `1.5` / `2147483648` / `0` are rejected as 400 without touching the driver.
   `taskSchema` (`schemas.ts:43`) declares the field for the OpenAPI response (see N3 for precision).
   `MAX_ESTIMATED_MINUTES` carries the "matches int4, changes with the column type" comment.

6. **The formatter — PASS.** `estimate.ts:7`:
   `return (minutes / 60).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");` — §2.2 verbatim, two
   separate replaces in order. All boundary cases asserted and green:
   `6000 → "100h"` (the `.` blocks the trailing-zero run, so it is never `"1h"`), `120 → "2h"`,
   `100 → "1.67h"`, `1 → "0.02h"`, `2147483647 → "35791394.12h"`; `0`, `-5`, `1.5`, `null`,
   `undefined`, `NaN` all → `null` via the `isStorableEstimate` type guard.
   `sumEstimateMinutes` reduces with `+ (task.estimatedMinutes ?? 0)` from seed `0` — cannot produce
   `NaN` for any `number | null` input; explicitly asserted (`expect(Number.isNaN(sumMixed)).toBe(false)`).
   Round-trip `parseEstimateHours(estimateMinutesToHoursInput(m)) === m` tested over
   `[1, 30, 90, 100, 120, 4825, 6000, 2147483647]` (§2.4).
   Documented and accepted: `sumEstimateMinutes` does not clamp, so a column total above
   `MAX_ESTIMATE_MINUTES` hides the badge.

7. **Permission gating — PASS.** `task-estimate-popover.tsx`: `const canEdit = canUpdateTasks();`
   then `if (!canEdit) return <>{children}</>;` placed **before** the `return (<Popover …>` — byte-for-byte
   the `task-start-date-popover.tsx` / `task-due-date-popover.tsx` shape. API remains the authority:
   the PUT is behind `workspaceAccess.fromTask()` + `requireWorkspacePermission({ task: ["update"] })`
   + `requireTaskAssigneePermission` + `requireEntitlement` (`task/index.ts:352-355`), unchanged. No
   new permission verb, no `@kaneo/permissions` edit.

8. **Three mount sites — PASS.** `TaskEstimatePopover` at sidebar lines 331 (compact), 539 (mobile
   non-compact), 749 (desktop non-compact) — each inside the same `{task && (…)}` guard, immediately
   after the `TaskDueDatePopover` block, with the same `Button variant="ghost" size="sm"` shape.
   Class parity confirmed against siblings: 335 and 543 use `"justify-start h-7 px-1.5 gap-1.5"`
   matching lines 273/291 and 481/499; **753 carries `w-full`**, matching its desktop siblings at
   691/709.

9. **Migration safety — PASS.** `0043_public_malice.sql` is one statement, entire file:
   `ALTER TABLE "task" ADD COLUMN "estimated_minutes" integer;` — nullable, no `DEFAULT`, no
   `NOT NULL`, no backfill, no index; catalog-only on PG 11+.
   `git status apps/api/drizzle/` shows only ` M meta/_journal.json` plus the two new `0043` files —
   migrations `0000`–`0042` untouched (AC-1). `_journal.json` is appended, not rewritten (the `idx: 42`
   entry is byte-identical; the diff is `+7/-0`). SQL column name `estimated_minutes` agrees with the
   Drizzle field `integer("estimated_minutes")` at `schema.ts:429` and with `0043_snapshot.json:2757`.
   `0042_snapshot.json` contains no `estimated_minutes`, confirming the snapshot chain is coherent.

10. **i18n — PASS.** Exactly 9 static keys added to `i18n/en-US.json`: `tasks.properties.estimate`,
    `tasks.popover.estimate.{label,placeholder,save,clear,invalid,updateSuccess,updateError}`,
    `tasks.kanban.estimateTotal` — matching §7 verbatim, tab-indented, no new namespace, no template
    interpolation. Every user-facing string in the three touched components resolves through `t(…)`;
    the only untranslated text is the formatter output (`"1.5h"`), which §7 deliberately treats like
    `column.tasks.length`. `git status` shows no other locale file modified — the 17 non-English
    locales are untouched (FR-I3).

11. **Scope discipline — PASS.** `provenance.json` lists 25 touched paths; every one falls inside the
    allowlist. `git status --porcelain` adds nothing beyond those plus run bookkeeping
    (`.sdlc/**`, `.claude/settings.local.json`, `.hook-logs/`). No `.gitignore`, `biome.json`,
    `.husky/**`, `AGENTS.md`, `.env*`, `apps/api/src/mcp/**`, `export-tasks.ts`,
    `bulk-update-tasks.ts`, `import-tasks.ts`, or `apps/web/src/components/public-project/**`
    modification. Note: B1 requires a *deliberate, minimal* widening of the allowlist — that is a
    correction to the write contract, not a violation of it.

12. **Test quality — PASS (substantive, not vacuous).**
    `column-header.test.tsx` — 5 cases: mixed nulls asserting both the count (`"4"`) and the total
    (`getByTitle("tasks:kanban.estimateTotal")` → `"5h"`); the all-null hidden case
    (`queryByTitle(…)` → null); empty column; the never-NaN case (null + 30 → `"0.5h"`); and the
    three-100-minute invariant. Mocks at the right seam — the component's hooks and child modals,
    with the real `@/lib/estimate` and the real reduce exercised.
    `task-estimate-popover.test.tsx` — 5 cases: hours→minutes conversion asserted as
    `expect(mutateAsync).toHaveBeenCalledWith({ ...task, estimatedMinutes: 90 })` after typing
    `"1.5"`; prefill (`90` → input value `"1.5"`); clear (`{ ...task, estimatedMinutes: null }`);
    invalid input (save disabled, error message shown, `mutateAsync` not called); and the read-only
    path (`canUpdateTasks → false`: children render, clicking opens nothing). Mocks the mutation hook
    and permission hook, keeps the real component and real conversion.
    `estimate.test.ts` — the full §2.2 table, parse rejections (`"1,5"`, `"1e3"`, `"1.2.3"`, `"-1"`,
    `"0.001"`, `"35791394.13"`), the round-trip property, and the rollup invariant.
    `tests/api/task/estimate-schema.test.ts` — accepts `1` / `2147483647`; rejects `0`, `-5`, `1.5`,
    `2147483648`, `NaN`, `Infinity`, `"90"`, `null` on the bare schema; and `null` / `undefined`
    accepted on the field schema. Pure-function, no database, matching `tests/api/column/to-slug.test.ts`.

---

## Also assessed

**Realtime / cache — correctly judged as needing no change.** The estimate is written only through
`PUT /task/:id`, whose controller already ends in the existing `task.updated` `publishEvent()`; the
new column rides `.returning()` into that payload with no new topic and no activity-feed entry
(matching `startDate`, which likewise has none). On the client, `useUpdateTask`'s existing
invalidations (`["task", id]`, `["tasks", projectId]`, `["projects"]`, `["activities", id]`,
`["notifications"]`) already refresh the detail sidebar, the card and the column header. No change
needed and none made — correct.

**Unit ambiguity.** The name is `estimatedMinutes` / `estimated_minutes` at every layer — column,
migration, Drizzle field, controller params, `taskSchema`, request bodies, `Task` type, all four
`estimate.ts` function signatures. The only places the word "hours" appears are the display-side
identifiers (`parseEstimateHours`, `estimateMinutesToHoursInput`, the `tasks:popover.estimate.label`
copy), which is exactly where hours actually are. `estimate-schema.ts` carries the "int4 ceiling,
changes with the column type" comment. No site where a reader could mistake the integer for hours.

**Dead / redundant / inconsistent.** None found in the diff. `format-duration.ts` (the §2.1 decoy)
was correctly ignored — `grep` confirms `estimate.ts` has no import of it and it still has zero
importers. `estimate.ts` imports only the `Task` type; the import direction is one-way from the
three components into `@/lib/estimate`, as §2.5 requires. `<Input nativeInput …>` is a real prop of
`apps/web/src/components/ui/input.tsx:15`, not an invention. No parallel request layer — everything
goes through `@kaneo/libs`. Handlers stayed thin: validation in the Valibot schema, persistence in
the controller.

---

## Requirements traceability

| AC | Status | Pointer |
|---|---|---|
| AC-1 | **met** | `0043_public_malice.sql` = one `ALTER TABLE "task" ADD COLUMN "estimated_minutes" integer;`; `git status apps/api/drizzle/` shows `0000`–`0042` unmodified |
| AC-2 | **met** (400-vs-500 not end-to-end verifiable by reading) | `estimatedMinutesFieldSchema` wired at `task/index.ts:199` and `:345`; boundary rejection proven by `tests/api/task/estimate-schema.test.ts`. A live 400 response would need an integration test (none exists; `tests/api-integration/task.test.ts` has no PUT case) |
| AC-3 | **met** | `get-tasks.ts:132`, `get-task.ts:17`, `schemas.ts:43` |
| AC-4 | **met** | `types/task/index.ts:27` + `fetchers/task/update-task.ts:25` (`estimatedMinutes: task.estimatedMinutes ?? null`) |
| AC-5 | **met** (no dedicated test — N4) | `task-card.tsx:286` `{estimateLabel && (…)}` inside the unconditional metadata row `<div className="flex items-center gap-1.5">`; null ⇒ no element |
| AC-6 | **met** | `column-header.tsx:26` + `:67` `{estimateTotal && (…)}`; `column.tasks` is the filtered set (`use-task-filters-with-labels-support.ts:196`); proven by 5 cases in `column-header.test.tsx` |
| AC-7 | **met** | `task-estimate-popover.tsx` `if (!canEdit) return <>{children}</>;` before the `Popover`; asserted by the read-only test case |
| AC-8 | **met** | 9 keys in `i18n/en-US.json`; no literal user-facing string in any touched component |
| AC-9 | **met** | API 385 ≥ 374; web 132 ≥ 112 (both re-run and green) |
| AC-10 | **NOT MET** | `biome ci` → 5 format errors — **blocker B2** |
| AC-11 | **met** | `provenance.json` (25 paths) and `git status` contain no off-limits path. B1's fix requires a deliberate minimal allowlist amendment |

Additionally outside the AC list but required by `AGENTS.md` ("Cross-package contracts: typecheck
all affected consumers"): **`pnpm --filter @kaneo/web typecheck` fails — blocker B1.**

Not exercised in this review: `tests/api-integration/**` (needs PostgreSQL). Reviewed by reading —
no exact-shape (`toEqual({…})`) assertion on a task response and no OpenAPI snapshot exists, so the
added field should not break any of them.

---

## Refinement packets

```json
[
  {
    "task_type": "bugfix",
    "instruction": "Make apps/web typecheck clean after Task.estimatedMinutes became a required property. Add the field to the five remaining Task construction sites. Do NOT make Task.estimatedMinutes optional and do NOT add `as Task` / `as ProjectWithTasks` casts to silence the errors — the required property is deliberate (change_plan R-2) and exists so the compiler enumerates every construction site. Edits, one line each: (1) apps/web/src/components/shared/modals/create-task-modal.tsx — inside normalizeTask()'s returned object literal, alongside the sibling `?? null` normalizers such as `dueDate: task.dueDate ?? null`, add `estimatedMinutes: task.estimatedMinutes ?? null,` (the `...task` spread of Partial<Task> yields `number | null | undefined`, which is why TS2322 fires). (2) apps/web/src/components/task/task-relations.tsx — in buildTaskObject (~line 241), which already hardcodes `description: null` / `startDate: null` / `createdAt: \"\"` because the relation query does not select them, add `estimatedMinutes: null,`. (3) apps/web/src/components/task/task-subtasks.tsx — in buildTaskObject (~line 120), same shape, add `estimatedMinutes: null,`. (4) apps/web/src/hooks/mutations/label/sync-task-labels-cache.test.ts — add `estimatedMinutes: null,` to the task object literals in the ProjectWithTasks fixtures at ~line 72 and ~line 165. (5) apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx — add `estimatedMinutes: null,` to the task object literals at ~line 94 and ~line 176. Change nothing else in these files. This requires widening the run write allowlist by exactly these three paths: apps/web/src/components/shared/modals/create-task-modal.tsx, apps/web/src/hooks/mutations/label/sync-task-labels-cache.test.ts, apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx (the two components/task/** files are already allowlisted).",
    "inputs": [
      "apps/web/src/components/shared/modals/create-task-modal.tsx",
      "apps/web/src/components/task/task-relations.tsx",
      "apps/web/src/components/task/task-subtasks.tsx",
      "apps/web/src/hooks/mutations/label/sync-task-labels-cache.test.ts",
      "apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx",
      "apps/web/src/types/task/index.ts",
      ".sdlc/runs/20260903-125223-feature-extend-task-estimated-hours/change_plan.md"
    ],
    "acceptance": [
      "`pnpm --filter @kaneo/web typecheck` exits 0 with no output",
      "`pnpm --filter @kaneo/web test` still passes with at least 132 tests",
      "`apps/web/src/types/task/index.ts` still declares `estimatedMinutes: number | null` as a required (non-optional) property",
      "`git diff` shows no `as Task`, `as ProjectWithTasks`, or `as unknown as` cast added anywhere",
      "each of the five files gains only the estimatedMinutes lines described — no other behavioral change"
    ]
  },
  {
    "task_type": "lint-fix",
    "instruction": "Make `pnpm exec biome ci .` clean for this change. Exactly five files fail, all on formatting only (no lint-rule violations). Reformat ONLY these five paths — run `pnpm exec biome check --write <the five paths>` or `pnpm exec biome format --write <the five paths>` with the paths listed explicitly. Do NOT run the repo-root `pnpm lint` / `biome check --write .`: NFR-5 forbids it because it rewrites unrelated files. The required changes are pure line-wrapping: (a) apps/web/src/lib/estimate.ts — break the three over-width signatures `isStorableEstimate(minutes: number | null | undefined): minutes is number`, `formatEstimateMinutes(minutes: number | null | undefined): string | null`, and `estimateMinutesToHoursInput(minutes: number | null | undefined): string` onto multiple lines; (b) apps/web/src/components/task/task-estimate-popover.tsx — split the `import { estimateMinutesToHoursInput, parseEstimateHours } from \"@/lib/estimate\";` specifier list across lines; (c) apps/web/src/components/task/task-estimate-popover.test.tsx, (d) apps/web/src/components/kanban-board/column/column-header.test.tsx, (e) tests/api/task/estimate-schema.test.ts — wrap the over-width `expect(...).toBe(...)` / `.toHaveTextContent(...)` / `.toBeInTheDocument()` calls. No assertion, no test name, and no runtime behavior may change.",
    "inputs": [
      "apps/web/src/lib/estimate.ts",
      "apps/web/src/components/task/task-estimate-popover.tsx",
      "apps/web/src/components/task/task-estimate-popover.test.tsx",
      "apps/web/src/components/kanban-board/column/column-header.test.tsx",
      "tests/api/task/estimate-schema.test.ts"
    ],
    "acceptance": [
      "`pnpm exec biome ci apps/web/src/lib/estimate.ts apps/web/src/components/task/task-estimate-popover.tsx apps/web/src/components/task/task-estimate-popover.test.tsx apps/web/src/components/kanban-board/column/column-header.test.tsx tests/api/task/estimate-schema.test.ts` reports 0 errors",
      "`pnpm exec biome ci .` reports no error attributable to any file touched by this run",
      "`pnpm --filter @kaneo/api test` and `pnpm --filter @kaneo/web test` still pass with >= 385 and >= 132 tests",
      "`git status --porcelain` shows no file modified outside the five listed paths"
    ]
  },
  {
    "task_type": "polish",
    "instruction": "OPTIONAL, dispatch only if the two blocker packets land cleanly and budget allows. In apps/web/src/components/task/task-estimate-popover.tsx, replace the hard-coded DOM id `task-estimate-hours` with a generated one: import `useId` from react, add `const inputId = useId();` next to the other hooks, and use `inputId` for both the label's `htmlFor` and the Input's `id`. Rationale: task-properties-sidebar.tsx renders the mobile (`lg:hidden`) and desktop blocks simultaneously in the DOM, so two instances of this component co-exist and would emit duplicate ids if both popovers were ever open. Change nothing else — in particular leave the useEffect re-seed, the parse/format calls, and the `if (!canEdit) return <>{children}</>;` early return exactly as they are.",
    "inputs": [
      "apps/web/src/components/task/task-estimate-popover.tsx",
      "apps/web/src/components/task/task-estimate-popover.test.tsx",
      "apps/web/src/components/task/task-properties-sidebar.tsx"
    ],
    "acceptance": [
      "no string literal `task-estimate-hours` remains in the repo",
      "the existing task-estimate-popover.test.tsx cases still pass unmodified (they query via getByLabelText, which is id-agnostic)",
      "`pnpm --filter @kaneo/web typecheck` and `pnpm exec biome ci apps/web/src/components/task/task-estimate-popover.tsx` are both clean"
    ]
  }
]
```

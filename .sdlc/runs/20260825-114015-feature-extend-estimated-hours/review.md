# Code review — estimated hours on tasks with per-column rollup

- **Run:** `20260825-114015-feature-extend-estimated-hours`
- **Mode / intent:** brownfield · `feature-extend`
- **Scope:** the 33 files in `provenance.json` (verified to match `git status` exactly). Nothing
  outside the changed set was reviewed for smells.
- **Verdict:** `needs_changes` — 0 blockers, 2 majors, 6 minors (2 of which are report-only,
  outside the write contract).
- **Env-fixture check (line 19 of the reviewer contract):** **not applicable.** `apps/api` reads
  `process.env` directly with no validating config module (no Nest `ConfigModule`, no Joi/Zod/
  envalid/class-validator config schema); this change adds no environment variable and no feature
  flag. The integration harness derives its own `_test` database URL and mocks `dotenv-mono`.
  No `.env.example` / `.env.test` obligation is triggered.

---

## 1. What is correct (verified by reading, not by trusting the run report)

These are stated because each was a named risk in `change_plan.md` and each is genuinely closed.

- **The three explicit column selections all carry the field.** `get-tasks.ts:132` (board payload),
  `get-task.ts:17`, `export-tasks.ts:32`. The "unmissable item" of the plan is not missed, and
  integration case 7 asserts the board payload end-to-end.
- **Zero semantics are respected everywhere.** A grep of every `estimatedHours` reference in
  `apps/api/src` and `apps/web/src` finds no falsy check. Every coalescing site uses `??`
  (`create-task.ts:86`, `import-tasks.ts:76`, `export-tasks.ts:89`, `estimated-hours.ts:7`,
  `update-task.ts` fetcher:26) and every UI predicate uses `!= null`. `0 ?? undefined` is `0`, so
  an explicit zero survives the kanban-drag round trip.
- **No write path bypasses the Valibot transform.** The only four writers of the column are
  `create-task.ts`, `import-tasks.ts`, `update-task.ts` and `update-task-estimated-hours.ts`, and
  all four are reached only through route validators carrying
  `optionalEstimatedHoursSchema` / `nullableEstimatedHoursSchema` (`task/index.ts:206, 354, 460,
  648`). `bulk-update-tasks.ts` and `move-task.ts` do not touch the column. `importTasks` and
  `exportTasks` have exactly one caller each, both the validated route.
- **The conditional spread in `update-task.ts:81` is correct for every path that reaches
  `PUT /task/:id`.** Kanban drag, list/backlog/gantt inline edits, the context menu and the
  archive-all loop in `column-header.tsx:40` all spread a `Task` sourced from the board payload,
  so they re-affirm the real value; surfaces that construct a partial `Task` send `undefined` and
  the column is left alone. There is exactly **one** path where a user intends to clear and
  silently cannot — the create-task modal draft save — see finding **F-1** below.
- **Authorization matches the house idiom byte-for-byte.** The new route's chain
  (`task/index.ts:645-651`) is `validator("param")` → `validator("json")` →
  `workspaceAccess.fromTask()` → `requireWorkspacePermission({ task: ["update"] })` →
  `requireEntitlement`, identical to `/due-date/:id` at `task/index.ts:610-613`. No new permission
  verb, no hand-rolled role check, no reliance on UI gating (`TaskEstimatedHoursPopover:68` is
  presentational only). Two-segment path cannot shadow or be shadowed by `PUT /:id`.
- **Migration is safe on populated installations.** `0043_cultured_zaran.sql` is exactly
  `ALTER TABLE "task" ADD COLUMN "estimated_hours" numeric(7, 2);` — no `NOT NULL`, no `DEFAULT`,
  no `USING`, one table. `meta/0043_snapshot.json` records `notNull: false` and its `prevId`
  chains to `0042_snapshot.json`'s `id`. The 619-line `_journal.json` diff was verified
  semantically: the 43 prior entries are byte-identical in order and exactly one entry was
  appended (the noise is drizzle-kit's reindentation, correctly left as tool output).
- **Both signature conversions are complete.** `updateTask` has zero remaining callers besides
  `task/index.ts:389`, and every argument is mapped to the right key (`startDate:
  parsedStartDate`, `dueDate: parsedDueDate` — no transposition). `createTask` (web fetcher) has
  no positional caller left; the modal's two call sites and `use-create-task.ts` all pass the
  named object. The `startDate`/`dueDate` round-trip removal is behavior-preserving: callers
  already pass `toISOString()` output and the API re-parses with `new Date(...)`.
- **The badge's zero boundary is sound.** Stored values are always multiples of `0.01` (the
  Valibot `v.transform` rounds before the write and `numeric(7,2)` enforces the scale), so a sum
  of non-zero estimates can never round to `0`. The only badge-free states are "no estimates" and
  "every estimate is exactly 0", which is ADR-5 as written.
- **i18n discipline holds.** Every new visible string in `column-estimated-hours-badge.tsx`,
  `task-estimated-hours-popover.tsx`, the three sidebar branches and the modal chip resolves
  through `t()`; all 12 keys exist under `tasks.properties`, `tasks.popover.estimatedHours` and
  `tasks.kanban`. The `h` unit lives in the locale value, not in JSX.
- **AGENTS.md conformance.** Thin handlers, controller-owned domain logic, Valibot validation,
  `HTTPException` for 404/500, `type` over `interface`, `publishEvent("task.updated")` reusing
  existing vocabulary, no parallel untyped request layer (`@kaneo/libs` client only), no
  `relations.ts` change for a scalar column.
- **Realtime path is real.** `task.updated` is in `ws/index.ts:244`'s `taskUpdateEvents`, which
  broadcasts `TASK_UPDATED`, which `use-project-websocket.ts:60` handles with a query
  invalidation fan-out. FR-W7 / AC-11 is wired, not merely asserted.
- **Provenance is clean.** 33 files touched, matching `git status` exactly; no off-limits path was
  written. (`.claude/settings.local.json` and `.hook-logs/` are untracked session artifacts, not
  in `provenance.json`, not part of the change.)

---

## 2. Findings

### F-1 — major — clearing the estimate in the create-task modal silently does nothing once a draft task exists

**File:** `apps/web/src/components/shared/modals/create-task-modal.tsx:412` (the `draftTask`
branch of `handleSubmit`).

The draft-save call is:

```ts
await updateTask({
  ...draftTask,
  ...
  estimatedHours: estimatedHoursForRequest(estimatedHours),
})
```

`estimatedHoursForRequest("")` returns `undefined` (`lib/estimated-hours.ts:35`). The fetcher then
maps `estimatedHours: task.estimatedHours ?? undefined` (`fetchers/task/update-task.ts:26`), the
key is dropped by `JSON.stringify`, and `update-task.ts:81`'s conditional spread deliberately
leaves the column untouched. Net effect:

1. User types a title and sets the estimate to `3`.
2. User pastes an image into the description, which calls `ensureDraftTask()` and creates a real
   task row **with `estimated_hours = 3`** (`create-task-modal.tsx:350-360`).
3. User changes their mind and presses the modal's own **Clear estimate** button
   (`create-task-modal.tsx:~975`), emptying the input.
4. User submits. The task is saved **with `estimated_hours = 3`**.

The modal renders a Clear affordance that, on this path, is a no-op with no error. Setting and
changing work; only clearing fails. This is the one genuine gap in the otherwise-correct
"undefined preserves, explicit null clears" contract, and it exists because the modal has no route
through which it can express `null`.

**Fix (does not weaken the drag-preservation guarantee):** keep `PUT /task/:id`'s
undefined-preserving semantics and have the modal express an explicit clear through the dedicated
single-field route. In `handleSubmit`'s `draftTask` branch, after the `updateTask(...)` call
resolves, add:

```ts
const parsedEstimate = parseEstimatedHoursInput(estimatedHours);
if (parsedEstimate.ok && parsedEstimate.value == null && draftTask.estimatedHours != null) {
  await updateTaskEstimatedHours({
    id: draftTask.id,
    projectId: resolvedProjectId,
    estimatedHours: null,
  });
}
```

using `useUpdateTaskEstimatedHours()` (already built, `hooks/mutations/task/use-update-task-estimated-hours.ts`).
Do **not** "fix" this by changing `fetchers/task/update-task.ts:26` to forward `null` — that
re-opens the whole-task-replace wipe that integration case 8 was mutation-tested to prevent.

### F-2 — major — the new route's `requireWorkspacePermission` is never exercised by a test

**File:** `tests/api-integration/task.test.ts` (new `describe("API integration: task estimated
hours")` block, the AC-6 case "rejects an estimate update from a user outside the workspace").

The only authz-denied assertion uses an outsider with no workspace membership. That request is
rejected by `workspaceAccess.fromTask()`, which runs **before**
`requireWorkspacePermission({ task: ["update"] })` in the chain — so the permission check the
role matrix actually depends on is never reached and never proven for this route.

`change_plan.md` §8.3 case 6 made this conditional and explicit: *"if `@kaneo/permissions` ships a
built-in read-only workspace role, add a second case … If no such built-in exists, the outsider
case alone satisfies AC-6 and the run reports that plainly."* The built-in **does** exist —
`viewer` at `packages/permissions/src/index.ts:19` with `task: ["read"]` and no `update` — the
fixture already supports `createWorkspaceMember({ role: "viewer" })`
(`tests/api-integration/helpers/fixtures.ts:43`), and the repo has the exact idiom at
`tests/api-integration/workspace-rbac.test.ts:714` ("blocks a viewer from updating a task").
Neither the test nor the disclosure in `findings.md` was produced, so the obligation was dropped
silently.

**Fix:** add one case to the new block (or to `workspace-rbac.test.ts`'s
`resource coverage: task:update` describe, which is also allowlisted):

```ts
it("blocks a viewer from updating the estimate", async () => {
  const member = await createWorkspaceMember({ role: "viewer" });
  const { project, columns } = await createProjectFixture({ workspaceId: member.workspace.id });
  const task = await seedTask(project.id, columns.todo.id);
  mockAuthenticatedSession(member.user);
  const { app } = createApp();

  const response = await app.request(`/api/task/estimated-hours/${task.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ estimatedHours: 5 }),
  });

  expect(response.status).toBe(403);
});
```

and assert the stored value is unchanged.

### F-3 — minor — the 10000 ceiling is hardcoded in two inputs instead of importing `MAX_ESTIMATED_HOURS`

**Files:** `apps/web/src/components/task/task-estimated-hours-popover.tsx:80`
(`max={10000}`) and `apps/web/src/components/shared/modals/create-task-modal.tsx:~968`
(`max={10000}`).

`MAX_ESTIMATED_HOURS` is exported from `apps/web/src/lib/estimated-hours.ts:1` and is already the
bound `parseEstimatedHoursInput` enforces. Two literal copies of the same constant in the same
change is exactly the drift FR-W8 sought to avoid on the formatter. (The API-side duplicate in
`validate-task-fields.ts:74` is unavoidable — no shared package is in the allowlist — and is
acceptable.)

**Fix:** import `MAX_ESTIMATED_HOURS` in both components and use `max={MAX_ESTIMATED_HOURS}`.

### F-4 — minor — invalid input in the create-task modal is discarded with no feedback

**File:** `apps/web/src/components/shared/modals/create-task-modal.tsx:356, 412, 425` via
`estimatedHoursForRequest` (`lib/estimated-hours.ts:33-36`).

`estimatedHoursForRequest` collapses `{ ok: false }` and `{ ok: true, value: null }` to the same
`undefined`. A user who types `-5` or `20000` into the modal's numeric input (both typeable —
`min`/`max` on `<input type="number">` are not enforced outside form validation) creates the task
with **no estimate and no error**. The sidebar popover handles the same input correctly, showing
`tasks:popover.estimatedHours.invalid` (`task-estimated-hours-popover.tsx:56-58`), so the two
surfaces disagree on the same key.

**Fix:** in `handleSubmit` (and `ensureDraftTask`), branch on `parseEstimatedHoursInput` and
`toast.error(t("tasks:popover.estimatedHours.invalid"))` + `return` when `ok === false`, rather
than routing through `estimatedHoursForRequest`. No new i18n key is required.

### F-5 — minor — the popover's input value is seeded once and never resynced to the task

**File:** `apps/web/src/components/task/task-estimated-hours-popover.tsx:28-30`.

```ts
const [value, setValue] = useState(
  task.estimatedHours != null ? String(task.estimatedHours) : "",
);
```

`useState` initializers run only on mount. `TaskPropertiesSidebar` is rendered by the
`.../task/$taskId_` route (`routes/.../task/$taskId_.tsx:64`), which is not keyed on the param, so
navigating from task A to task B keeps this component instance mounted and the input keeps A's
value. Pressing Save then writes A's estimate onto B. Every sibling popover derives its displayed
state from props (`task-due-date-popover.tsx` holds only `open`), so this is the one new instance
of the pattern. The `TaskDetailsSheet` usage is safe because Radix unmounts sheet content on
close.

**Fix:** reset from the task when the popover opens:

```ts
<Popover
  open={open}
  onOpenChange={(next) => {
    if (next) {
      setValue(task.estimatedHours != null ? String(task.estimatedHours) : "");
    }
    setOpen(next);
  }}
>
```

### F-6 — minor — `.gitignore` still has no `.sdlc/` entry, and `git status` now shows `?? .sdlc/`

**File:** `/home/sangeetha/projects/kaneo/.gitignore`.

`change_plan.md` §2.20 made a one-line `.sdlc/` append conditional on a packet-time `git status`
showing `.sdlc/` as untracked, predicting it would be a no-op. It is not a no-op: `.gitignore`
contains no `sdlc` match and `git status --porcelain` reports `?? .sdlc/`. As the tree stands, a
`git add -A` sweeps the entire run's SDLC bookkeeping into the feature commit. `.gitignore` is in
the allowlist, so the condition the plan set is now met.

**Fix:** append the single line `.sdlc/` to `.gitignore`. Do not reformat the file.

### F-7 — minor (report-only, outside the write contract) — `apps/docs/openapi.json` is now stale

The committed, published spec (142 operations) contains neither `updateTaskEstimatedHours` nor any
`estimatedHours` property. It is produced by `pnpm --filter @kaneo/api openapi:export`, which
writes to `apps/docs/openapi.json` (`apps/api/scripts/export-openapi.ts:13`). `apps/docs/**` is
**off-limits** for this run, and no CI workflow regenerates or diffs it, so nothing is broken —
but the public API documentation no longer describes the API.

**Action for the user, post-run:** run `pnpm --filter @kaneo/api openapi:export` and commit the
regenerated spec. Not a packet; the path is outside the allowlist and widening the contract for it
would violate NFR-9.

### F-8 — minor (report-only) — `pnpm i18n:check` now exits 1, as disclosed in F-1 of `findings.md`

Independently confirmed by reading `scripts/i18n/check.mjs`: en-US is the reference, any key
missing from another locale sets `hasIssues`, and the script ends `process.exit(shouldFix ? 0 : 1)`.
All 16 other locales are off-limits, so the 12 new keys make the check fail. Confirmed **not**
wired into `.github/workflows/**` or any husky hook, so it blocks nothing automatically. The run's
own disclosure is accurate and complete; re-stated here only so it survives into the review record.

**Action for the user, post-run:** `pnpm i18n:check:fix` or supply real translations.

---

## 3. Test coverage assessment

| Surface | Happy path | Auth-denied | Edge / regression |
|---|---|---|---|
| Valibot boundary | ✅ `tests/api/task-estimated-hours-validation.test.ts` (13 cases incl. `0`, `null`, `10000` inclusive, `2.005 → 2.01`) | n/a | ✅ negative message asserted verbatim, `NaN`/`Infinity`, `undefined` rejected by the nullable schema |
| `POST /task/:projectId` | ✅ omitted → null; ✅ `2.5` persisted with `typeof === "number"` | ➖ covered by pre-existing suites | ✅ AC-2 regression: existing 7 cases still pass |
| `PUT /task/estimated-hours/:id` | ✅ set → change → clear in one case | ⚠️ **outsider only — see F-2** | ✅ `-1` → 400 with stored value re-read; ✅ explicit `0` stored as `0`, not null |
| `GET /task/tasks/:projectId` | ✅ field present in the board payload | ➖ | ✅ this is the assertion that catches a missing `taskSelection` entry |
| `PUT /task/:id` preservation | ✅ | ➖ | ✅ **mutation-tested** (F-6 of `findings.md`): the naive `?? null` makes it fail, the guard makes it pass — this test discriminates |
| `sumEstimatedHours` / parser | ✅ 12 cases | n/a | ✅ float artifact `0.1 + 0.2 → 0.3`; ✅ `""` vs `"0"` distinction |
| `ColumnEstimatedHoursBadge` | ✅ sum, mixed null/missing | n/a | ✅ zero-total hidden, no-estimate hidden, float artifact |
| `createTask` fetcher | ✅ | n/a | ✅ omitted → key absent; ✅ explicit `0` forwarded, not dropped as falsy |
| Sidebar popover / modal chip | ❌ none | ❌ none | Acknowledged in `change_plan.md` §8.4 (no harness for TanStack Query + Zustand + permission hooks). Accepted; the mutation path is covered end-to-end by integration case 3. **F-1 lives in this untested gap** — the added modal case in the F-1 packet should be an integration- or fetcher-level assertion, not a new component harness. |

PII: none. The field is non-personal planning metadata; the change adds no new personal data, no
new log line, no new webhook/MCP/event field. Public-project boards were confirmed safe by
inspection — `public-project/kanban-view.tsx:35` renders its own inline header with
`column.tasks.length` and does not import `ColumnHeader`, so the rollup cannot leak there. No
encryption or masking obligation is triggered.

---

## 4. Machine-readable result

```json
{
  "module": "task-estimated-hours",
  "verdict": "needs_changes",
  "findings": [
    {
      "severity": "major",
      "file": "apps/web/src/components/shared/modals/create-task-modal.tsx:412",
      "issue": "Clearing the estimate in the create-task modal is a silent no-op once a draft task exists. estimatedHoursForRequest(\"\") returns undefined, fetchers/task/update-task.ts:26 maps it away with ?? undefined, and update-task.ts:81's conditional spread leaves the column untouched. Set and change work; clear does not. The modal renders a Clear estimate button that cannot clear on this path.",
      "fix": "In handleSubmit's draftTask branch, after the updateTask(...) call, call useUpdateTaskEstimatedHours() with estimatedHours: null when parseEstimatedHoursInput(estimatedHours) yields { ok: true, value: null } and draftTask.estimatedHours != null. Do NOT change fetchers/task/update-task.ts to forward null - that re-opens the whole-task-replace wipe that integration case 8 guards."
    },
    {
      "severity": "major",
      "file": "tests/api-integration/task.test.ts (describe: API integration: task estimated hours)",
      "issue": "The only authz-denied assertion for PUT /task/estimated-hours/:id uses a user outside the workspace, which is rejected by workspaceAccess.fromTask() before requireWorkspacePermission({ task: [\"update\"] }) is ever reached. The permission check itself is untested. change_plan.md 8.3 case 6 required a read-only-role case if a built-in exists; viewer exists at packages/permissions/src/index.ts:19 with task:[\"read\"] only, the fixture supports createWorkspaceMember({ role: \"viewer\" }), and the idiom exists at tests/api-integration/workspace-rbac.test.ts:714. The obligation was neither met nor disclosed in findings.md.",
      "fix": "Add an integration case: createWorkspaceMember({ role: \"viewer\" }), seed a project and task, mockAuthenticatedSession, PUT /api/task/estimated-hours/:id with { estimatedHours: 5 }, expect 403, and re-read the row to assert estimatedHours is unchanged."
    },
    {
      "severity": "minor",
      "file": "apps/web/src/components/task/task-estimated-hours-popover.tsx:80, apps/web/src/components/shared/modals/create-task-modal.tsx:~968",
      "issue": "Both numeric inputs hardcode max={10000} instead of importing MAX_ESTIMATED_HOURS from @/lib/estimated-hours, where the same bound already lives and is enforced by parseEstimatedHoursInput. Two literal copies of one constant introduced by a single change.",
      "fix": "Import MAX_ESTIMATED_HOURS from @/lib/estimated-hours in both files and use max={MAX_ESTIMATED_HOURS}."
    },
    {
      "severity": "minor",
      "file": "apps/web/src/components/shared/modals/create-task-modal.tsx:356,412,425",
      "issue": "estimatedHoursForRequest collapses invalid input and empty input to the same undefined, so typing -5 or 20000 in the modal creates the task with no estimate and no error. The sidebar popover surfaces tasks:popover.estimatedHours.invalid for the same input, so the two surfaces disagree.",
      "fix": "Branch on parseEstimatedHoursInput in the modal: when ok === false, toast.error(t(\"tasks:popover.estimatedHours.invalid\")) and return without submitting. No new i18n key needed."
    },
    {
      "severity": "minor",
      "file": "apps/web/src/components/task/task-estimated-hours-popover.tsx:28",
      "issue": "The input's value is seeded by a useState initializer from task.estimatedHours and never resynced. The .../task/$taskId_ route is not keyed on the param, so navigating between two task pages keeps the component mounted and the input shows the previous task's estimate; pressing Save writes it to the new task. Every sibling popover derives displayed state from props instead.",
      "fix": "Reset value from the task inside onOpenChange when the popover opens: setValue(task.estimatedHours != null ? String(task.estimatedHours) : \"\") before setOpen(next)."
    },
    {
      "severity": "minor",
      "file": ".gitignore",
      "issue": "change_plan.md 2.20 made a .sdlc/ append conditional on git status showing .sdlc/ as untracked, predicting a no-op. It is not: .gitignore has no sdlc entry and git status --porcelain reports '?? .sdlc/'. A git add -A would sweep the run's SDLC bookkeeping into the feature commit.",
      "fix": "Append the single line '.sdlc/' to .gitignore. Do not reformat the file."
    },
    {
      "severity": "minor",
      "file": "apps/docs/openapi.json",
      "issue": "The committed published OpenAPI spec (142 operations) contains neither updateTaskEstimatedHours nor any estimatedHours property, so the documented API no longer matches the implemented API. REPORT-ONLY: apps/docs/** is off-limits for this run and no CI workflow regenerates or diffs the file, so nothing is broken automatically.",
      "fix": "User action post-run: pnpm --filter @kaneo/api openapi:export and commit the regenerated apps/docs/openapi.json. No packet - widening the write contract for this would violate NFR-9."
    },
    {
      "severity": "minor",
      "file": "i18n/en-US.json",
      "issue": "pnpm i18n:check now exits 1 because the 12 new keys are missing from the 16 off-limits locale files (scripts/i18n/check.mjs ends process.exit(shouldFix ? 0 : 1)). Confirmed not wired into .github/workflows/** or any husky hook. REPORT-ONLY: already disclosed accurately as F-1 in findings.md; re-stated so it survives into the review record.",
      "fix": "User action post-run: pnpm i18n:check:fix, or supply real translations for the 16 locales."
    }
  ],
  "refinement_packets": [
    {
      "task_type": "react_component",
      "subtype": "existing_file_edit",
      "instruction": "Fix the silent clear-failure in the create-task modal's draft-save path, and fix the modal's silent discard of invalid input, in one edit to apps/web/src/components/shared/modals/create-task-modal.tsx.\n\n(1) CLEAR PATH. Import { useUpdateTaskEstimatedHours } from \"@/hooks/mutations/task/use-update-task-estimated-hours\" and destructure `const { mutateAsync: updateTaskEstimatedHours } = useUpdateTaskEstimatedHours();` beside the existing `const { mutateAsync: updateTask } = useUpdateTask();` at line ~226. In handleSubmit's `draftTask` branch, keep the existing `await updateTask({ ...draftTask, ..., estimatedHours: estimatedHoursForRequest(estimatedHours) })` call exactly as it is, and immediately AFTER it resolves add:\n\n  const parsedEstimate = parseEstimatedHoursInput(estimatedHours);\n  if (parsedEstimate.ok && parsedEstimate.value == null && draftTask.estimatedHours != null) {\n    await updateTaskEstimatedHours({ id: draftTask.id, projectId: resolvedProjectId, estimatedHours: null });\n  }\n\nUse the result of that clear to keep `savedTask` consistent if the surrounding code reads estimatedHours back; otherwise leave savedTask as-is. `parseEstimatedHoursInput` is already imported in this file.\n\n(2) INVALID INPUT. At the top of handleSubmit, before `didSubmitRef.current = true`, add:\n\n  const parsedEstimateInput = parseEstimatedHoursInput(estimatedHours);\n  if (!parsedEstimateInput.ok) {\n    toast.error(t(\"tasks:popover.estimatedHours.invalid\"));\n    return;\n  }\n\nDo the same guard at the top of ensureDraftTask (returning null on the invalid branch, matching its existing error style). `toast` and `t` are already in scope in both.\n\n(3) CONSTANT. Replace the hardcoded `max={10000}` on the modal's estimate <Input type=\"number\"> with `max={MAX_ESTIMATED_HOURS}`, importing MAX_ESTIMATED_HOURS from \"@/lib/estimated-hours\" alongside the existing imports from that module.\n\nHARD CONSTRAINTS: do NOT modify apps/web/src/fetchers/task/update-task.ts - forwarding null there would re-open the whole-task-replace estimate wipe that tests/api-integration/task.test.ts case 8 was mutation-tested to prevent. Do NOT modify apps/api/src/task/controllers/update-task.ts. Do NOT add any i18n key; tasks:popover.estimatedHours.invalid already exists. Every path stays inside the write-contract allowlist.",
      "inputs": [
        "apps/web/src/components/shared/modals/create-task-modal.tsx",
        "apps/web/src/hooks/mutations/task/use-update-task-estimated-hours.ts",
        "apps/web/src/lib/estimated-hours.ts",
        "apps/web/src/fetchers/task/update-task.ts",
        ".sdlc/runs/20260825-114015-feature-extend-estimated-hours/change_plan.md"
      ],
      "acceptance": [
        "Setting an estimate, creating a draft task (image paste), then clearing the estimate and submitting results in a task whose estimatedHours is null.",
        "Setting and changing an estimate through the modal still persists the value on both the draft and the non-draft path.",
        "Submitting with an out-of-range or non-numeric estimate shows the tasks:popover.estimatedHours.invalid toast and does not create or update a task.",
        "apps/web/src/fetchers/task/update-task.ts and apps/api/src/task/controllers/update-task.ts are byte-identical to their pre-packet state.",
        "pnpm --filter @kaneo/web test passes (139/139 or more) and pnpm typecheck passes 6/6.",
        "npx biome check on the changed path is clean."
      ]
    },
    {
      "task_type": "controller_handler",
      "subtype": "test_add",
      "instruction": "Add role-level authorization coverage for the new PUT /api/task/estimated-hours/:id route to tests/api-integration/task.test.ts, inside the existing describe(\"API integration: task estimated hours\") block, immediately after the existing outsider case.\n\nThe existing outsider case proves workspaceAccess.fromTask() rejects a non-member, but that middleware runs BEFORE requireWorkspacePermission({ task: [\"update\"] }), so the permission check is currently unproven for this route. Add a case that reaches it:\n\nit(\"rejects an estimate update from a workspace viewer\", async () => {\n  const member = await createWorkspaceMember({ role: \"viewer\" });\n  const { project, columns } = await createProjectFixture({ workspaceId: member.workspace.id });\n  // seed the task directly via db.insert(schema.taskTable) - a viewer cannot POST /api/task/:projectId (viewer lacks task:create), so do NOT reuse the seedTask() helper in this block, which creates through the API.\n  mockAuthenticatedSession(member.user);\n  const { app } = createApp();\n  const response = await app.request(`/api/task/estimated-hours/${task.id}`, { method: \"PUT\", headers: { \"content-type\": \"application/json\" }, body: JSON.stringify({ estimatedHours: 5 }) });\n  expect(response.status).toBe(403);\n  // re-read the row and assert estimatedHours is unchanged from its seeded value\n});\n\nFollow the seeding idiom already used in tests/api-integration/workspace-rbac.test.ts (see its local seedTask helper and the \"blocks a viewer from updating a task\" case at ~line 714) so the task exists without needing task:create. Seed the task with a non-null estimate so the unchanged-value assertion is meaningful.\n\nAdd nothing else. Do not modify any file under apps/.",
      "inputs": [
        "tests/api-integration/task.test.ts",
        "tests/api-integration/workspace-rbac.test.ts",
        "tests/api-integration/helpers/fixtures.ts",
        "packages/permissions/src/index.ts",
        "apps/api/src/task/index.ts"
      ],
      "acceptance": [
        "A workspace member with role \"viewer\" receives 403 from PUT /api/task/estimated-hours/:id.",
        "The task row's estimated_hours is re-read after the denial and asserted unchanged.",
        "The new case fails if requireWorkspacePermission({ task: [\"update\"] }) is removed from the route (verify by temporary removal, then restore byte-identically).",
        "pnpm --filter @kaneo/api test:integration passes (190/190 or more) against real PostgreSQL.",
        "No file outside tests/api-integration/ is modified."
      ]
    },
    {
      "task_type": "react_component",
      "subtype": "patch_apply",
      "instruction": "Two small corrections in apps/web/src/components/task/task-estimated-hours-popover.tsx.\n\n(1) STALE VALUE. The input's value is seeded by a useState initializer (line ~28) and never resynced, so a mounted instance shown for a different task keeps the previous task's estimate and Save writes the wrong value. Change the Popover to reset on open:\n\n  <Popover\n    open={open}\n    onOpenChange={(next) => {\n      if (next) {\n        setValue(task.estimatedHours != null ? String(task.estimatedHours) : \"\");\n      }\n      setOpen(next);\n    }}\n  >\n\nKeep the useState initializer as-is. Do not add a useEffect.\n\n(2) CONSTANT. Replace the hardcoded max={10000} on the <Input type=\"number\"> (line ~80) with max={MAX_ESTIMATED_HOURS}, adding MAX_ESTIMATED_HOURS to the existing import from \"@/lib/estimated-hours\".\n\nChange nothing else - the permission gate, the toasts, the Clear button's `task.estimatedHours != null` condition and the Enter-to-save handler are all correct as written.",
      "inputs": [
        "apps/web/src/components/task/task-estimated-hours-popover.tsx",
        "apps/web/src/lib/estimated-hours.ts",
        "apps/web/src/components/task/task-due-date-popover.tsx"
      ],
      "acceptance": [
        "Opening the popover always shows the current task's estimate, including after the displayed task changes without a remount.",
        "The numeric input's max attribute derives from MAX_ESTIMATED_HOURS rather than a literal.",
        "Set, change and clear from the sidebar all still work and still toast through the existing i18n keys.",
        "pnpm --filter @kaneo/web test passes and pnpm typecheck passes 6/6.",
        "npx biome check on the changed path is clean."
      ]
    },
    {
      "task_type": "frontend_config",
      "subtype": "patch_apply",
      "instruction": "Append the single line `.sdlc/` to /home/sangeetha/projects/kaneo/.gitignore so this run's SDLC bookkeeping is not swept into the feature commit. change_plan.md 2.20 authorized exactly this append, conditional on a packet-time `git status` showing `.sdlc/` as untracked - which it now does (`?? .sdlc/`), and .gitignore contains no sdlc match.\n\nAppend one line at the end of the file. Do not reorder, reformat, deduplicate or otherwise touch any existing line. Do not add .hook-logs/ or .claude/settings.local.json - they are outside this change's scope.",
      "inputs": [
        ".gitignore",
        ".sdlc/runs/20260825-114015-feature-extend-estimated-hours/change_plan.md"
      ],
      "acceptance": [
        "git status --porcelain no longer lists .sdlc/ as untracked.",
        "git diff on .gitignore shows exactly one added line and zero removed or reflowed lines.",
        "No other file is modified."
      ]
    }
  ]
}
```

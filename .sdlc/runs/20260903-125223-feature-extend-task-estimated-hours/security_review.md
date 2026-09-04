# Security Review — brownfield, feature-extend (`task.estimated_minutes`)

Run: `20260903-125223-feature-extend-task-estimated-hours`
Scope: files written/edited by this run only (`git status` + `git diff HEAD`). Whole-repo audit intentionally not performed.
Enumeration method: `git status --porcelain`, `git diff HEAD -- apps/ i18n/`, `grep -rn` across `apps/api/src`, `apps/web/src`, `packages/`, `tests/`. Every negative claim below is backed by a search that actually ran; nothing is reported as absent on the strength of a listing I could not obtain.

## Verdict

**PASS WITH NOTES**

No confidentiality, authorization, or injection finding. The change is a nullable scalar column carried through two already-guarded write routes and two already-guarded read routes, with no new route, no new permission verb, no new dependency, and no middleware reordering. One **medium** data-integrity finding (silent estimate loss through the MCP `update_task` tool) should be fixed; it is a correctness/data-loss issue, not a security boundary break, so it does not by itself justify BLOCK.

## Findings

| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Medium | Data integrity / silent data loss | `apps/api/src/mcp/tools.ts:115-187` (`buildFullTaskUpdateBody`) → `apps/api/src/task/controllers/update-task.ts:68` | The MCP `update_task` tool does a read-merge-full-PUT. `buildFullTaskUpdateBody` explicitly preserves `title`, `description`, `status`, `priority`, `projectId`, `position`, `startDate`, `dueDate`, `userId` from the fetched task but **never carries `estimatedMinutes`**. The PUT body therefore omits the key, `estimatedMinutesFieldSchema` (`v.optional(...)`) accepts the omission, and `update-task.ts:68` `estimatedMinutes: estimatedMinutes ?? null` writes `NULL`. Any MCP-driven task edit silently deletes the estimate. Same class as the `startDate`/`dueDate` preservation the builder already implements — the new field was simply missed. | Add `estimatedMinutes` to `buildFullTaskUpdateBody`, mirroring the `startDate`/`dueDate` pattern: `const estimatedMinutes = patch.estimatedMinutes !== undefined ? patch.estimatedMinutes : existing.estimatedMinutes; if (estimatedMinutes !== undefined) body.estimatedMinutes = estimatedMinutes;` and add it to the tool's `inputSchema` as `z.number().int().positive().nullable().optional()`. |
| Low | API contract / lost update | `apps/api/src/task/index.ts:345`, `apps/api/src/task/controllers/update-task.ts:68` | `PUT /task/:id` is full-replacement: `estimatedMinutes` omitted → `undefined` → `?? null` → cleared. Any third-party API-key integration that PUTs a body built before this release will wipe estimates it never knew about. This is consistent with the route's existing semantics for `userId`/`startDate`/`dueDate`, so it is not a new class of bug, but it is a new field that can now be lost. | Document the full-replacement semantics in the route's `describeRoute` description, or (preferred, larger change) migrate the route to a partial-update contract. At minimum add an integration test asserting an omitted key clears the field, so the behavior is intentional rather than incidental. |
| Info | OpenAPI contract drift | `apps/api/src/schemas.ts:43` | `estimatedMinutes: v.nullable(v.number())` was added as a **required** key on `taskSchema`, while neighbouring optional fields use `v.optional(...)`. `taskSchema` is used only inside `resolver()` in `describeRoute` (`apps/api/src/task/index.ts` ×11, `apps/api/src/search/index.ts:19`) — it is documentation, never a runtime response validator — so nothing breaks. But `/api/search` responses do not contain `estimatedMinutes` (verified: no such key in `apps/api/src/search/controllers/global-search.ts`), so the published OpenAPI now over-promises the field for that endpoint. | Either use `v.optional(v.nullable(v.number()))`, or accept it as consistent with the schema's existing looseness for the search response. No security impact. |
| Info | Middleware ordering (pre-existing pattern) | `apps/api/src/task/index.ts:193-203`, `:339-350` | `validator("json", ...)` is registered **before** `workspaceAccess` / `requireWorkspacePermission`. A caller with a valid session but no `task:update` permission who sends a malformed `estimatedMinutes` receives `400` rather than `403`. This is the pre-existing pattern for every field on these routes (`title`, `priority`, `status`) and was not introduced by this change. It leaks only "this field name exists and is number-shaped", which the OpenAPI spec publishes anyway. | No action. Noted only because item 1 asked specifically about ordering on the touched routes. |
| Info | UI display quirk (not a vulnerability) | `apps/web/src/lib/estimate.ts:29-32, 57-59` | `sumEstimateMinutes` cannot produce `NaN`/`Infinity` (`?? 0` guard, all inputs are integers) and cannot lose precision below `2^53` (≈4.2 million tasks each at max int4 would be required). However, a single task with a large estimate can push the column sum above `MAX_ESTIMATE_MINUTES = 2147483647`, at which point `isStorableEstimate` returns false and `formatEstimateMinutes` returns `null`, so the column-total badge silently disappears rather than showing a huge number. Cosmetic. | Optional: clamp/format the rollup independently of the storable-value guard. |

No critical findings. No high findings.

## Per-item results

1. **Authorization reuse — PASS.** Both write paths verified unchanged and additive-only (`git diff` on `apps/api/src/task/index.ts` contains zero `-` lines other than context). Chains as they exist on disk:
   - `POST /task/:projectId` (`index.ts:175-243`): `describeRoute` → `validator("json", …)` → `workspaceAccess.fromProject("projectId")` → `requireWorkspacePermission({ task: ["create"] })` → `requireEntitlement` → handler.
   - `PUT /task/:id` (`index.ts:319-401`): `describeRoute` → `validator("param", …)` → `validator("json", …)` → `workspaceAccess.fromTask()` → `requireWorkspacePermission({ task: ["update"] })` → `requireTaskAssigneePermission` → `requireEntitlement` → handler.
   No route added, none removed, no middleware dropped, reordered, or weakened. All task routes sit behind the global authenticator: `api.use("*", … authenticateApiRequest(c) …)` at `apps/api/src/index.ts:573-600` is registered before `api.route("/task", task)` at `index.ts:607`. `updateTask` (the controller) has exactly one caller repo-wide — `apps/api/src/task/index.ts:384` — confirmed by `grep -rn "updateTask(" apps/api/src packages/`, so there is no unguarded back door into the write.

2. **Read-path exposure — PASS.** The field was added to exactly three places, all explicit whitelists: `get-tasks.ts:132` inside `taskSelection`, `get-task.ts:17` inside the inline select, and `schemas.ts:43`. Both selections are hand-listed column maps, not `select()` — the `userTable` columns reachable through `leftJoin(userTable, …)` are still only `name` (`assigneeName`), `id` (`assigneeId`), and, in `get-tasks` only, `image` (`assigneeImage`); no `email`, `emailVerified`, or auth column was added. Repo-wide `grep -rn "estimatedMinutes\|estimated_minutes"` returns 40 hits, all accounted for; no other endpoint's selection changed.

3. **Cross-workspace / IDOR — PASS.** `GET /task/tasks/:projectId` is guarded by `workspaceAccess.fromProject("projectId")` (`index.ts:243` region) and `GET /task/:id` by `workspaceAccess.fromTask()`. The column rollup consumes `column.tasks` from `ColumnHeader` (`column-header.tsx:25`), whose only non-test caller is `apps/web/src/components/kanban-board/column/index.tsx:23`; that column set is rebuilt as the filtered set at `apps/web/src/hooks/use-task-filters-with-labels-support.ts:196` (`tasks: filterTasks(column.tasks)`). The rollup is a pure client-side reduce over data the caller already received per-card. No new cross-boundary read or inference.

4. **Input validation / DoS — PASS.** `apps/api/src/task/estimate-schema.ts` pipes `v.number() → v.integer() → v.minValue(1) → v.maxValue(2147483647)`. `tests/api/task/estimate-schema.test.ts` covers `0`, `-5`, `1.5`, `2147483648`, `NaN`, `Infinity`, `"90"`, and `null` — all rejected. Rejection happens at the Hono `validator("json", …)` layer, so an out-of-range value returns 400 and never reaches the Postgres driver as an int4 range error → no unhandled 500. Global handler `app.onError` (`apps/api/src/index.ts:156-167`) returns `err.getResponse()` for `HTTPException` and a flat `{ message: "Internal Server Error" }` with no stack for anything else. `v.optional(v.nullable(...))` semantics confirmed by test (`undefined` accepted, `null` accepted): omission on PUT clears the field — see the Low finding; it requires `task:["update"]` plus `requireTaskAssigneePermission`, so it is not a privilege issue. Client-side sum overflow analysed — see Info finding; no `NaN`/`Infinity` reachable.

5. **Data integrity / migration safety — PASS.** `apps/api/drizzle/0043_public_malice.sql` is exactly `ALTER TABLE "task" ADD COLUMN "estimated_minutes" integer;` — one statement, additive, nullable, no `DEFAULT`, no `NOT NULL`, no backfill, no `DROP`/`UPDATE`/`DELETE`. On PostgreSQL 11+ this is a catalog-only change: brief `ACCESS EXCLUSIVE` lock, no table rewrite, no long lock on a large `task` table. Snapshot delta computed programmatically between `0042_snapshot.json` and `0043_snapshot.json`: `tables added set() removed set()`, and the only column delta is `public.task added {'estimated_minutes'}` (`{"type": "integer", "notNull": false, "primaryKey": false}`). `git status -- apps/api/drizzle/` shows migrations `0000`–`0042` untouched; the only tracked modification is the additive `_journal.json` entry `{"idx": 43, "tag": "0043_public_malice"}`.

6. **Secret / PII leakage — PASS, with one factual correction to the brief.** The brief states the change adds no new `publishEvent`; that is true, but `create-task.ts:101` publishes `task.created` with `{...createdTask}`, so the *event object* now carries `estimatedMinutes`. I traced every `task.created` subscriber and none of them forward it across a trust boundary:
   - WebSocket (`apps/api/src/ws/index.ts:242-330`): broadcast payload is `{ type: "TASK_CREATED", projectId, taskId }` only, and is project-scoped via `broadcastToProject`.
   - Generic webhook (`apps/api/src/plugins/generic-webhook/events.ts:263-284`): explicit whitelist `{ title, description, priority, status, number }` — `estimatedMinutes` is not sent.
   - Activity (`activity/index.ts:173-183`) and notification (`notification/index.ts:162-188`): both destructure named fields only.
   `task.updated` (`update-task.ts:97-103`) is an explicit five-field literal and is byte-identical to before. No `console.*` and no `dangerouslySetInnerHTML` in any new or changed web file (grep across `estimate.ts`, `task-estimate-popover.tsx`, `column-header.tsx`, `task-card.tsx`, `task-properties-sidebar.tsx` returned nothing). Secret grep over all six new source/test files returned no matches; `.env` is gitignored (`git check-ignore -v .env` → `.gitignore:9`), and `.env.sample` is present at the repo root.

7. **Client-side trust — PASS.** `task-estimate-popover.tsx:37,62` (`const canEdit = canUpdateTasks(); … if (!canEdit) return <>{children}</>;`) is UX only: it renders the trigger inert but performs no security function. The independent server-side enforcement is `requireWorkspacePermission({ task: ["update"] })` on `PUT /task/:id`. A caller who skips the UI and PUTs directly is rejected there before the handler runs. This satisfies AGENTS.md: "Hiding an action in the UI is not an authorization check."

8. **Dependency risk — PASS (no new dependency).** `git diff --stat HEAD -- '*package.json' pnpm-lock.yaml` is empty and `git status --porcelain` lists no `package.json` or lockfile. `pnpm audit --prod` reports 7 high / 4 moderate / 0 critical across 1220 prod deps — all transitive and all pre-existing, since no manifest changed. Listed under "Noted (pre-existing)" below; not attributable to this run.

9. **i18n injection — PASS.** The nine added keys (`tasks:properties.estimate`, `tasks:kanban.estimateTotal`, and the seven under `tasks:popover.estimate.*`) are static literals with no `{{…}}` interpolation placeholders. All new call sites use static key strings (`t("tasks:popover.estimate.label")` etc.); no template-literal key and no user-controlled interpolation. No `dangerouslySetInnerHTML` in any new or changed component. The one dynamic key in scope, `t(\`tasks:relations.types.${type}\`)` at `task-relations.tsx:304`, is pre-existing and untouched.

10. **Regression in touched non-feature files — PASS.** Each is a single added field with no logic, auth, or data-flow change, verified against the diff:
    - `create-task-modal.tsx:99` — `estimatedMinutes: task.estimatedMinutes ?? null` inside `normalizeTask`; this one is load-bearing in a good way, since it *preserves* the estimate on the modal's full-PUT path.
    - `task-relations.tsx:250` and `task-subtasks.tsx:129` — `estimatedMinutes: null` in `buildTaskObject`. I specifically checked whether these hard-nulled objects can reach a full PUT and wipe an estimate: they cannot. `task-subtasks.tsx` feeds `updateTaskStatus`, and `task-relations.tsx:310` feeds `SubtaskStatusPopover`, which uses `useUpdateTaskStatus` (`subtask-status-popover.tsx:11,40`) → `apps/web/src/fetchers/task/update-task-status.ts`, which calls the narrow `client.task.status[":id"].$put` with `{ status }` only. The null never reaches `PUT /task/:id`.
    - `task-row.test.tsx`, `task-status-popover.test.tsx`, `sync-task-labels-cache.test.ts`, `use-task-filters-with-labels-support.test.tsx` — fixture field additions only; no real credentials, no live endpoints.

## PII inventory delta

**No change to PII posture.** `task.estimated_minutes` is a nullable integer count of minutes of planned work on a task. It is not a direct or indirect identifier, contains no free text, and cannot be attributed to a person except through the already-existing `task.userId` assignee link, whose exposure is unchanged. It does not qualify as PII under the encryption-at-rest / role-masking checks in the standing checklist, so no encryption, masking, or audit-log requirement attaches to it. It inherits exactly the workspace-scoped confidentiality of the task record it lives on, and it is not forwarded to any external plugin or webhook.

## Authorization matrix delta

| Actor | Before | After | Enforcement |
|---|---|---|---|
| Role with `task:["create"]` in the workspace | Create a task | Additionally set `estimatedMinutes` at create time | `workspaceAccess.fromProject("projectId")` + `requireWorkspacePermission({ task: ["create"] })` + `requireEntitlement` on `POST /task/:projectId` |
| Role with `task:["update"]` in the workspace | Full-update a task | Additionally set/clear `estimatedMinutes` | `workspaceAccess.fromTask()` + `requireWorkspacePermission({ task: ["update"] })` + `requireTaskAssigneePermission` + `requireEntitlement` on `PUT /task/:id` |
| Any role with workspace read access to the project | Read task fields | Additionally read `estimatedMinutes` and see the per-column total | `workspaceAccess.fromProject` on `GET /task/tasks/:projectId`; `workspaceAccess.fromTask` on `GET /task/:id` |
| Non-member / other workspace | No access | No access | Unchanged — no new route, no new verb, no widened selection |

No new permission verb was introduced and no existing verb's scope was broadened. requirements.md §6 is accurate as written.

## Residual risks / follow-ups

- **Fix before merge (recommended, medium):** the MCP `update_task` estimate-wipe. It is reachable by any authenticated MCP client with `task:update`, needs no crafted input, and destroys user data silently. A regression test that round-trips `update_task` and asserts the estimate survives would lock it down.
- **Out of scope but adjacent:** the same read-merge-full-PUT hazard applies to any external integration built against `PUT /task/:id`. Whenever a nullable field is added to that route, every full-PUT builder in the repo needs the corresponding preservation line. Consider a shared "full task update body" helper so future fields cannot be forgotten in one place.
- **Not verified (out of scope for a changed-files review):** the correctness of `workspaceAccess.fromProject` / `fromTask` themselves, and of `requireWorkspacePermission`'s role resolution. This review confirms the new field rides on those guards; it does not re-audit them.
- **Not run:** the PostgreSQL-backed integration suite. `tests/api-integration` contains no `estimatedMinutes` coverage (verified by grep over `tests/`), so the 400-not-500 rejection at the HTTP layer and the omission-clears-field behavior are argued from the schema and the unit tests rather than proven end-to-end. An integration test on `PUT /task/:id` with `estimatedMinutes: 2147483648` (expect 400) and with the key omitted (expect the field cleared) would close that gap.

## Noted (pre-existing, out of scope — does not gate this run)

`pnpm audit --prod` on an unchanged manifest reports 0 critical, 7 high, 4 moderate across 1220 production dependencies. All are transitive and predate this run:

| Severity | Package | Vulnerable | Advisory |
|---|---|---|---|
| high | `nanoid` | `<3.3.18` | GHSA-2v37-7h3g-55p8 — infinite loop when size is zero |
| high | `deepmerge-ts` | `<8.0.0` | GHSA-ggr8-5vv4-36mx — stack exhaustion on recursive object graphs |
| high | `mysql2` | `<3.22.0` | GHSA-3f6p-5ww8-9rcr — auth plugin downgrade leaks plaintext password |
| high | `fast-uri` | `>=3.0.0 <3.1.6` | GHSA-f65p-4m7j-42xc, GHSA-jqff-g426-hqxp, GHSA-5jgf-p345-68v8, GHSA-fph4-wmhf-6fwf — SSRF and host confusion |

Kaneo is PostgreSQL-backed, so `mysql2` is almost certainly an unused transitive of a driver-agnostic package; worth confirming and pruning. `fast-uri` reaches 3.1.6 with a lockfile refresh. These belong in a separate `deps` run.

# Security Review — pass1

**Mode:** brownfield · **Intent:** feature-extend · **Run:** 20260825-114015-feature-extend-estimated-hours
**Scope:** the 33 paths in `.sdlc/runs/20260825-114015-feature-extend-estimated-hours/provenance.json` only. The wider Kaneo codebase was read for context (middleware definitions, event bus, permission vocabulary, public-project controller) but is not audited here.

## Summary

The change adds a nullable, non-personal `estimatedHours` field to tasks and is a low-risk, additive extension. Authorization on the new `PUT /task/estimated-hours/:id` route is byte-for-byte identical to its sibling single-field routes, workspace scope is derived server-side from the task id in the path (no IDOR), every write path that can reach the new column is Valibot-validated with bounds an order of magnitude inside the `numeric(7,2)` limit, no new permission verb or event type was introduced, the migration is a bare nullable `ADD COLUMN`, and no dependency was added. One genuine — but low-severity — divergence from `requirements.md` §5 was found: the field does reach the unauthenticated public-project payload, because `getPublicProject` reuses `getTasks`. There are two pre-existing high advisories in transitive `better-auth` dependencies which this run did not introduce and cannot fix without touching the off-limits lockfile.

## Findings

| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Low | Public data exposure | `apps/api/src/project/controllers/get-public-project.ts:5` (unchanged) consuming `apps/api/src/task/controllers/get-tasks.ts:132` (changed) | `requirements.md` §5 states the estimate "must not become visible on public boards as a side effect (OOS-11)". It does reach the payload: `getPublicProject()` calls `getTasks(id)` and returns `result.data` wholesale, and `taskSelection` now includes `estimatedHours: taskTable.estimatedHours`. `GET /api/public-project/:id` (`apps/api/src/index.ts:243`) is registered outside the auth-gated group, so the value is served unauthenticated for any project the owner explicitly marked public. No public UI component renders it — `apps/web/src/components/public-project/**` is untouched and contains no `estimatedHours` reference — so this is payload-only exposure, visible to anyone reading the JSON. | Assess as an explicit product decision rather than leave it implicit. The field is non-personal planning metadata and the same unauthenticated payload already carries task title, description, due dates, `assigneeName` and `assigneeImage`, so the estimate is strictly less sensitive than what is already published; accepting it is defensible. If OOS-11 is to be honored literally, omit the key in `getPublicProject` — note that file is **not** in this run's allowlist, so that is a follow-up, not an in-run fix. |
| Advisory (pre-existing) | Dependency risk | `pnpm-lock.yaml` (off-limits, untouched) | `pnpm audit --prod` reports 2 high: `nanoid <3.3.18` (GHSA-2v37-7h3g-55p8) via `apps__api > better-auth > vitest > vite > postcss > nanoid`, and `deepmerge-ts <8.0.0` (GHSA-ggr8-5vv4-36mx) via `apps__api > better-auth > prisma > @prisma/config > deepmerge-ts`. Both are transitive under `better-auth`. | Out of scope for this run — no `package.json` or lockfile was modified, so the run neither introduced nor can remediate these. Track as a separate deps-intent run. |
| Informational | Hygiene | `apps/api/drizzle/meta/_journal.json` | The drizzle generator rewrote the whole file from tab to two-space indentation and dropped the trailing newline, so the diff is 307 lines of churn around a 7-line semantic addition (`idx: 43`, tag `0043_cultured_zaran`). JSON semantics are unchanged; no security impact. | Cosmetic. Accept, or restore tab indentation to keep the diff reviewable. |

No high or critical findings were introduced by this run.

## Threat questions answered

**1. Authorization — verified, matches siblings exactly.** `apps/api/src/task/index.ts:630-667` declares the new route with, in order: `validator("param", …)`, `validator("json", v.object({ estimatedHours: nullableEstimatedHoursSchema }))`, `workspaceAccess.fromTask()` (line 650), `requireWorkspacePermission({ task: ["update"] })` (651), `requireEntitlement` (652). This is identical in composition and ordering to `/due-date/:id` (lines 612-614) and `/title/:id` (685-687). No middleware is missing, none is weaker, and the entitlement check is present. The permission verb `task: ["update"]` already exists in `packages/permissions/src/index.ts:12` and is granted to the member role at line 30 — **no new permission vocabulary was invented**, matching `requirements.md` §6.

**2. IDOR — not reachable.** `workspaceAccess.fromTask()` (`apps/api/src/utils/workspace-access-middleware.ts:294-300`) resolves via `{ type: "lookup", resource: "task", idKey: "id" }`, which reads the id from the path param, joins `taskTable → projectTable` and returns `projectTable.workspaceId`, then calls `validateWorkspaceAccess(userId, workspaceId, apiKeyId)`. The caller cannot supply the workspace. The middleware deliberately refuses to take the id from the query string (comment at lines 68-71 documents the authorize-one/act-on-another bug that motivated it). The integration suite exercises the new route directly: `tests/api-integration/task.test.ts:594-613` authenticates a freshly created outsider user, `PUT /api/task/estimated-hours/${task.id}` with `{estimatedHours: 9.5}`, and asserts `403`, the body `"You don't have access to this workspace"`, **and** that the persisted value is still `2.5` — i.e. it proves the write did not land, not merely that the status code was right.

**3. Input validation — no unvalidated path to the column.** `nullableEstimatedHoursSchema` (`apps/api/src/task/validate-task-fields.ts:74-87`) is `v.number → v.finite → v.minValue(0) → v.maxValue(10_000) → v.transform(v => Math.round(v*100)/100)`. `v.number` rejects strings and null-ish coercion; `v.finite` rejects `NaN`/`±Infinity`. All four write paths are covered:
- `POST /task/:projectId` — `optionalEstimatedHoursSchema` at index.ts:206; controller writes `estimatedHours ?? null` (`create-task.ts:86`).
- `PUT /task/:id` (whole task) — `optionalEstimatedHoursSchema` at index.ts:354; controller applies `...(estimatedHours !== undefined ? { estimatedHours } : {})` (`update-task.ts:81`), so an omitted field preserves the stored value rather than nulling it (asserted at `tests/api-integration/task.test.ts:653-685`).
- `POST /task/import/:projectId` — `optionalEstimatedHoursSchema` inside the per-task object at index.ts:460; `import-tasks.ts:76` writes only `taskData.estimatedHours ?? null` from that validated array. No raw passthrough.
- `PATCH /task/bulk` — `bulk-update-tasks.ts` contains **no** `estimatedHours` reference and its `operation` picklist (index.ts:129-137) has no estimate operation, so the column is unreachable there.

Overflow: validated max is `10000`, stored as `10000.00`, well inside `numeric(7,2)`'s `99999.99`; `minValue(0)` blocks the negative side. Because the transform rounds to 2dp *before* the insert, PostgreSQL never has to round the scale itself, so no `22003 numeric_field_overflow` and no unhandled 500 is reachable. `tests/api-integration/task.test.ts:543-557` confirms a rejected `-1` returns 400 and leaves the stored `2.5` untouched.

**4. Public exposure — stated plainly.** Yes, estimates do become part of the public board payload; see the Low finding above for the mechanism and the recommendation. `apps/web/src/components/public-project/**` is untouched and reads no `estimatedHours`, so nothing is *rendered* on a public board today — the exposure is in the JSON only. My assessment: acceptable. The field is non-personal planning metadata that inherits the project's existing public/private decision, and the same endpoint already publishes assignee names and images, which are materially more sensitive. But it contradicts the literal wording of OOS-11 and should be signed off knowingly rather than silently.

**5. Data exposure elsewhere — clean.** `apps/api/src/task/controllers/update-task-estimated-hours.ts:36-42` publishes the **existing** `task.updated` event with exactly `{taskId, projectId, title, status, userId}` — byte-identical to the payload in `update-task.ts:110-116`. **The estimate value itself is not in the event payload.** No new event type was introduced (`grep -rn "task.updated"` returns only the two controllers plus the WS forwarding list at `apps/api/src/ws/index.ts:244`, and `task.updated` was already in that list). The WebSocket `TaskEvent` shape (`ws/index.ts:232-240`) carries only ids. Nothing outside `apps/api/src/task/` references `estimatedHours` except the schema definition and the OpenAPI response schema. No webhook payload gained the field. `apps/api/src/mcp/tools.ts` is off-limits and confirmed unmodified (`git status apps/api/src/mcp/` is empty); its `get_task` tool (tools.ts:406-418) proxies `GET /api/task/:id` and returns the JSON verbatim, so MCP task reads **additively** gain the `estimatedHours` key — through the same authenticated, workspace-scoped route, exposing nothing the caller could not already read. No `console.*` call in any new or changed file logs the value.

**6. PII — agreed, no new personal data.** I independently confirm `requirements.md` §5: `estimatedHours` is an operator-entered planning number attached to a task, not to a person. It is not derived from, and cannot be correlated back to, any individual beyond the task's already-exposed `userId`/`assigneeName`. No new secret, no new credential, no new log line carrying user content.

**7. Migration safety — non-destructive.** `apps/api/drizzle/0043_cultured_zaran.sql` is the single statement `ALTER TABLE "task" ADD COLUMN "estimated_hours" numeric(7, 2);`. The column is nullable with no `DEFAULT` and no `NOT NULL`, so on PostgreSQL 11+ this is a catalog-only change: no table rewrite, no full-table scan, only a brief `ACCESS EXCLUSIVE` lock. It cannot fail on a populated production database — existing rows simply read `NULL`, which the API surfaces as `null` and the UI renders as "No estimate". There is no data backfill, no type change, no drop, and no constraint that existing rows could violate. Rollback would be a plain `DROP COLUMN`. Journal entry `idx: 43` is registered correctly.

**8. Dependency risk — nothing added.** `git diff --stat` and `git status --porcelain` over `package.json`, `**/package.json` and `pnpm-lock.yaml` are all empty. `pnpm-lock.yaml` is off-limits and untouched. No new runtime dependency; the feature is built entirely from Valibot, Drizzle, `Intl.NumberFormat` and existing UI primitives already in the tree. The two high advisories from `pnpm audit --prod` are therefore pre-existing by construction (see the advisory row).

**9. Write-contract adherence — clean.** All 33 provenance paths were matched programmatically against `.sdlc/local/write-contract.json`: every one falls inside an allowlist entry and none matches any off-limits glob. Confirmed untouched off-limits surfaces relevant to this change: `apps/api/src/mcp/tools.ts`, `pnpm-lock.yaml`, `apps/web/src/routeTree.gen.ts`, all non-`en-US` i18n files, `charts/**`, `apps/docs/**`, `apps/site/**`. `git status` shows exactly the provenance set plus `.claude/settings.local.json`, `.hook-logs/` and `.sdlc/` — pre-existing untracked artifacts, not writes by this run, and correctly excluded.

## Passing checks

- New route's middleware chain is exactly `workspaceAccess.fromTask()` → `requireWorkspacePermission({ task: ["update"] })` → `requireEntitlement`, matching `/due-date/:id` and `/title/:id`.
- Workspace scope derived server-side from the path task id; outsider 403 proven by integration test that also asserts non-persistence.
- No new permission verb; `task: ["update"]` is existing vocabulary from `@kaneo/permissions`.
- Every write path (create, whole-task update, single-field update, import) validates through the shared Valibot pipe; bulk update cannot reach the column at all.
- Numeric bound (10 000) sits an order of magnitude inside `numeric(7,2)`; 2dp rounding happens before the insert, so no overflow-driven 500.
- `0` is stored as `0`, not coerced to null (`tests/api-integration/task.test.ts:559-576`) — no silent data confusion between "zero hours" and "no estimate".
- Existing `task.updated` event reused; the estimate value is not in the payload; no new event type; WS forwarding unchanged.
- No `console.*`, `dangerouslySetInnerHTML` or `innerHTML` in any new or changed file; the badge renders a number through `Intl.NumberFormat` and an i18n interpolation.
- UI gating (`useWorkspacePermission().canUpdateTasks()` at `task-estimated-hours-popover.tsx:33-34`, early-return at line 68) mirrors the server check and is presentational only — the API remains authoritative.
- Export (`export-tasks.ts:89`) emits the value into JSON, not CSV, so no formula-injection surface.
- Secret grep over all changed `.ts`/`.tsx`/`.json`/`.sql` files returns nothing; no `.env`, `.env.example` or config file was touched.
- 12 new i18n keys added to `i18n/en-US.json` only; all are static UI copy with no interpolated user content beyond the numeric `{{hours}}`.
- Migration is a nullable `ADD COLUMN`, safe on populated databases.
- No dependency or lockfile change.
- All written paths inside the write-contract allowlist; no off-limits path touched.

## Required fixes before sign-off

None blocking. Gate 3 may pass on security grounds.

One item requires an explicit decision, not a code change:

- **Acknowledge the public-board payload exposure (Low).** `requirements.md` §5/OOS-11 asserted the estimate must not surface publicly; it does appear in the unauthenticated `GET /api/public-project/:id` JSON, though no public UI renders it. Either record acceptance (recommended — non-personal metadata, less sensitive than the assignee name already published there) or file a follow-up to strip the key in `get-public-project.ts`, which is outside this run's allowlist.

## Noted (pre-existing, out of scope)

- 2 high `pnpm audit --prod` advisories in transitive `better-auth` dependencies (`nanoid`, `deepmerge-ts`). Not introduced by this run; not fixable without the off-limits lockfile.
- `workspaceAccess.fromTask()` falls back to a caller-supplied `?workspaceId=` when the task lookup returns null (middleware lines 297-299). For a non-existent task id an attacker could pass the access check against their own workspace and then receive a 404 from the controller. No data is disclosed and every sibling single-field route shares this behavior; it is a pre-existing pattern, not a regression from this change.

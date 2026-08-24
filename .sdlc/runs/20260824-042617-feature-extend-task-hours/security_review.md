# Security Review — Task `estimatedHours` + column rollup

- **Run:** `20260824-042617-feature-extend-task-hours`
- **Scope:** changed files only (feature-extend intent)
- **Model:** claude-opus-5 (policy rule 4, "Risk-bearing, low volume")
- **Verdict:** **PASS WITH NOTES** — no material security impact

## Summary

The change adds a nullable integer `estimated_hours` column, 0..1000 bounded request
validators on the existing create/update task routes, matching Zod bounds on the two MCP
tools, read-through in the two task select lists, and a purely client-side per-column sum in
the kanban header. Assessed against all seven headings: no permission action added, no
middleware removed or reordered, no event/WebSocket/log payload change, no new query or
round trip, no secret, no injection or XSS path.

All four findings are severity **info**. None blocks.

## Findings

| # | Severity | Area | File | Risk | Remediation |
|---|---|---|---|---|---|
| 1 | info | authorization / data exposure | `get-tasks.ts` | The field rides the board route's `workspaceAccess.fromProject`-only read guard (no `requireWorkspacePermission`). Same guard already exposes title, description, priority, dates and assignee on those rows. An effort estimate is strictly less sensitive than the description beside it, so the effective read audience does not widen. | None required. Recorded so the inherited guard is a decision, not an accident. |
| 2 | info — **RESOLVED** | API contract accuracy | `schemas.ts` | Response `taskSchema` declares `v.nullable(v.number())` — required, unbounded, non-integer — while requests enforce optional/nullable int 0..1000. Published metadata understates the real contract. No security consequence: it documents responses and gates no write path. | **Done at Gate 3** — see revisions below. |
| 3 | info — **CLOSED** | review coverage limit | `task/index.ts` | The `requireWorkspacePermission` / `requireTaskAssigneePermission` / `requireEntitlement` lines sit outside the diff context window. "Guards unchanged" is evidenced by the file containing **only additions** — no middleware line deleted, moved or made conditional — rather than by direct inspection. | **Done at Gate 3** — both chains read directly and recorded verbatim; see revisions below. |
| 4 | info | migration operations | `0043_skinny_mockingbird.sql` | The `ADD COLUMN` is metadata-only but its brief `ACCESS EXCLUSIVE` lock queues behind any long-running transaction, blocking readers while it waits. | Operational hardening only: set a short `lock_timeout` for the migration session and retry, on installations with heavy sustained task traffic. |

## Authorization

**No new permission action — confirmed.** The diff touches no file under `packages/permissions`,
defines no new permission string, and adds no capability check. The web popover reuses the existing
`canUpdateTasks()` and hides only the editor; the API remains the authority.

**No guard weakened.** `apps/api/src/task/index.ts` contains additions only. The new integration
test asserts the assignee guard still fires — a PUT omitting `userId` escalates to `task:["assign"]`
and 403s for a default `member` — which is direct evidence the chain is intact.

**MCP additions are input-schema-only.** `create_task` / `update_task` gained an `estimatedHours`
field forwarded in the HTTP body to the same guarded routes, so MCP callers get exactly the authority
their credentials already carry. Zod bounds mirror the server's Valibot bounds. `buildFullTaskUpdateBody`
was widened to `export` for testing; it is a pure body-shaping helper with no authorization role, and
it degrades a non-numeric stored value to omission rather than writing it.

**Client-side `parseEstimatedHours` is convenience only** — every write path re-validates server-side.

## PII / data exposure

`estimatedHours` is a coarse whole-hour planning figure attached to a task, not a person. Not
personally identifying, not special-category. At worst a workload signal about an assignee, visible
only to principals who already see that task's title, description and assignee on the same response.

- **No new field in any `publishEvent` payload** — the diff contains no change to event publication,
  WebSocket delivery or Redis fan-out.
- **No logging statement added** anywhere in the diff.
- The rollup is computed in the browser from tasks already delivered, so it derives nothing new.
- **XSS:** locally computed numbers (guarded by `typeof === "number"`) interpolate through i18next into
  JSX text children and `aria-label`/`title`, all React-escaped. No `dangerouslySetInnerHTML`, no
  user-controlled string in these keys.
- **`interpolation: { escapeValue: false }` is TEST-ONLY** — it appears solely in
  `estimated-hours-i18n.test.ts`, which builds its own throwaway i18next instance. It does not affect
  the application's runtime i18n configuration.
- **DoS:** two O(n) passes per column over an in-memory array per header render, unmemoized. No new
  query, no per-column round trip, no N+1, no unbounded loop. The board payload's lack of pagination is
  pre-existing and unchanged. The sum cannot overflow meaningfully (1000 x task count).
- **Secrets:** none introduced. The test `DATABASE_URL` points at a local throwaway container and does
  not appear in the diff.

## Migration

`ALTER TABLE "task" ADD COLUMN "estimated_hours" integer;` — nullable, no default, no backfill:
catalog-only on all supported PostgreSQL versions. No table rewrite, no per-row work, duration
independent of table size. Existing rows read as NULL, which schema, controllers and UI all treat as
"not estimated".

**Rolling deploy is safe forward:** an older API instance uses explicit select lists and explicit
insert value objects, so an unknown extra nullable column is ignored — no `SELECT *` shape dependency,
no NOT NULL to violate. Backward code rollback is also safe; estimates simply become invisible.

**Rolling back the migration is data-destructive** — it drops the column and discards entered
estimates. There is no down migration, matching the repo's forward-only convention.

---

# Gate 3 revisions

Two items were returned at Gate 3. Both are now closed. Neither changed the overall verdict,
which remains **pass with notes**.

## Revision 1 — finding #2 resolved (`apps/api/src/schemas.ts`)

Reclassified from "informational" to a **hard project boundary**. AGENTS.md states: *"Public API
behavior must retain accurate Valibot validation and OpenAPI metadata."* A response schema declaring
`v.nullable(v.number())` — required, unbounded, non-integer — while requests enforce optional,
nullable, integer 0..1000 violates that boundary irrespective of security severity.

`taskSchema` now mirrors the request constraint exactly:

```ts
// Mirrors estimatedHoursValidator in apps/api/src/task/index.ts; the two must
// stay in step. Optional rather than required because this schema is also
// nested in the search response (apps/api/src/search/index.ts), whose
// controller does not select the column.
estimatedHours: v.optional(
  v.nullable(
    v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1000)),
  ),
),
```

**Why `v.optional` and not required.** `taskSchema` is documentation-only — it appears solely inside
`resolver(...)` for `describeRoute`, and nested as `v.optional(v.array(taskSchema))` in
`apps/api/src/search/index.ts`. Nothing calls `parse` / `safeParse` / `validator` against it, so this
is a zero-runtime-behaviour change. The global-search controller does **not** select
`estimatedHours`, so declaring the key required would have made the search response documentation
wrong. `v.optional` is accurate for both the task routes (key always present) and search (key
absent) — which also closes the senior reviewer's related minor finding about other
`taskSchema`-documented endpoints.

**`apps/docs/openapi.json` deliberately NOT regenerated.** That artifact is roughly 11 route-groups
stale; regenerating it currently produces ~1,481 insertions / 166 deletions of unrelated churn. The
contract gap is carried in the final report as a follow-up instead.

## Revision 2 — finding #3 closed by direct inspection (`apps/api/src/task/index.ts`)

The original finding rested on an additions-only inference. Both middleware chains have now been read
in full. Recorded verbatim:

**`POST /:projectId`**
```
validator("json", v.object({ …, userId, estimatedHours: estimatedHoursValidator }))
workspaceAccess.fromProject("projectId")
requireWorkspacePermission({ task: ["create"] })
requireEntitlement
async (c) => { … }
```

**`PUT /:id`**
```
validator("param", v.object({ id: v.string() }))
validator("json", v.object({ …, position, userId, estimatedHours: estimatedHoursValidator }))
workspaceAccess.fromTask()
requireWorkspacePermission({ task: ["update"] })
requireTaskAssigneePermission
requireEntitlement
async (c) => { … }
```

**Confirmed by eye:**

1. Every guard named in the requirements is present, in the expected order, on both routes. Nothing
   is deleted, reordered, or made conditional.
2. The only change to either chain is one added key *inside* the existing `v.object({...})` — the new
   field sits within the validator that was already there, not at a new middleware position.
3. Ordering is **validation → workspace scoping → permission → entitlement → handler**. The new
   validation therefore runs *ahead* of authorization, which can only narrow the set of requests
   reaching the guards. It cannot widen it.
4. `requireTaskAssigneePermission` sits between the permission check and entitlement on PUT only,
   matching the pre-existing design, and is independently exercised by the integration suite: a PUT
   omitting `userId` escalates to `task:["assign"]` and 403s for a default `member`.

**One honest note on the ordering**, unchanged by this diff and pre-existing for every field on these
routes: because Valibot runs before `requireWorkspacePermission`, a caller with project access but
without `task:["create"]` / `["update"]` can distinguish a 400 (malformed input) from a 403 (no
permission), disclosing a little about validation rules. This is the established pattern for all of
Kaneo's task fields, is not introduced or worsened here, and is flagged only for completeness.

**Verification re-run after both revisions:** `biome check` clean on `apps packages tests i18n`
(1186 files, 0 errors, 78 pre-existing warnings) · `pnpm typecheck` 6/6 · API unit **391/391** across
60 files. The integration suite was **not** re-run: `taskSchema` has no runtime parse path, so the
change cannot reach it. OpenAPI spec generation is covered by `tests/api/utils/openapi-spec.test.ts`
inside the passing API unit suite.

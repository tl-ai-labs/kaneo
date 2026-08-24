# Security Review — column-wip-limit (feature-extend)

Scope: the changed surface only, per the feature-extend intent matrix. Reviewed from the complete diff of tracked source changes.

**SECURITY VERDICT: PASS · highest severity: Informational**

## 1. Authorization

Both mutation routes retain their existing guards, unchanged by this diff:

- `POST /:projectId` -> `workspaceAccess.fromProject("projectId")` -> `requireWorkspacePermission({ project: ["update"] })`
- `PUT /:id` -> `workspaceAccess.fromColumn("id")` -> `requireWorkspacePermission({ project: ["update"] })`

Adding a settable, optional field to an already-guarded route does not widen the authorization surface: setting `wipLimit` is gated by the same `project:update` permission that already gates renaming a column, reordering it, or marking it final. Any caller who can already mutate a column can now also set its limit; no new capability reaches a lesser-privileged caller.

Read exposure: `get-tasks` projects `wipLimit` alongside the other column fields, from a query scoped by `eq(columnTable.projectId, projectId)` behind the endpoint's unchanged authorization. Users who could not read the board still cannot; users who could now additionally see an advisory integer per column.

**Severity: Informational.** No change required.

## 2. Input validation

Validator, applied identically on create and update:

```
v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2147483647))))
```

Storage type is `integer` (PostgreSQL int4, -2,147,483,648 .. 2,147,483,647). Case by case:

- **Numeric string** (`"5"`): rejected. `v.number()` requires the JS number type.
- **NaN / Infinity**: not representable in JSON, so they cannot arrive over the wire. Even in-process, `v.integer()` rejects both.
- **`1e10`** (10,000,000,000): parses to an integer per `Number.isInteger`, passes `v.number()` and `v.integer()`, then is **rejected by `v.maxValue(2147483647)`**. Does not reach the database.
- **`1e2`** (100): passes all four steps and is written as 100. Correct — exponent notation is a wire encoding, not a semantic distinction, and 100 is a valid int4.
- **int4 overflow**: the validator's max equals the storage max, so no value that passes validation can overflow the column. Values below 1, including 0 and negatives, are rejected by `v.minValue(1)`.
- **Non-integer** (`1.5`, `2.5`): rejected by `v.integer()`.

Ordering: the Valibot validator runs before `workspaceAccess.*` and `requireWorkspacePermission`, so a malformed body short-circuits with 400 before any DB read or authorization work. No oracle leak, no wasted work, and consistent with the existing fields.

**Prior-arm cross-check.** The sibling arm (run 20260820-123148, flash-agsdk-only) shipped without an upper bound and without an explicit `v.integer()`; its security review raised that as a Low finding conditioning Gate 3, and it closed with follow-up FU-4 (UI input unbounded) still open. Verified independently from this diff: `v.integer()` and `v.maxValue(2147483647)` are both present, the block is appended verbatim to **both** the create and the update validator, and the editor input mirrors `min`/`max`/`step`. **Both halves of the prior finding are closed on both routes.**

**Severity: Informational.** Validator is tight against the storage type.

## 3. Data exposure and PII

`wipLimit` is a non-personal integer chosen by a workspace member with `project:update`. It is not a secret, credential, internal identifier, or personal datum. The board projection already returned every other column field to anyone permitted to read the board; one more advisory integer on that row does not move the trust boundary or the viewer set.

**Severity: Informational.** No new exposure.

## 4. Denial of service and resource use

The value is advisory. It is written on mutation and read in the board projection; it never sizes an allocation, bounds a loop, parameterizes a query, or feeds a regex or template. Test evidence confirms an over-limit column is not blocked — the server does not act on the value at all. Submitting 2,147,483,647 costs exactly what submitting 1 costs. No amplification vector.

**Severity: Informational.**

## 5. Tenant isolation

The projection query is `db.select().from(columnTable).where(eq(columnTable.projectId, projectId))`, with `projectId` derived from the guarded route. `wipLimit` travels on the same row as its `projectId`; there is no join, no cross-project aggregation, and no cache-key change that could bleed a limit across workspaces.

**Severity: Informational.** Boundary intact.

## 6. Injection

Both controllers use Drizzle's query builder — `.values({ ..., wipLimit: wipLimit ?? null })` and `.set({ ...(data.wipLimit !== undefined && { wipLimit: data.wipLimit }) })` — which bind parameters. No string concatenation and no raw `sql` template was introduced for the new field; the pre-existing `sql` template in `create-column.ts` (duplicate-slug check) is untouched. i18n values render as React text nodes and accessible attributes, never via `dangerouslySetInnerHTML`.

**Severity: Informational.**

## 7. Audit and events

This diff publishes no event and writes no activity row when `wipLimit` is set, changed, or cleared. Assessed specifically:

- If `wipLimit` were an **access-control** setting, the absence of an audit trail would be a real gap — an administrator needs to answer "who removed the gate, and when" — and a Medium finding would be warranted.
- `wipLimit` is an **advisory display hint**. The API does not enforce it (proven by the integration test in which an over-limit column still accepts tasks), and the UI treats it as guidance. The blast radius of an unlogged change is a hint moving or disappearing; the underlying task data is unaffected and separately audited by existing task-mutation events.

Acceptable as shipped. Recorded for the follow-up log: **if `wipLimit` is ever promoted to a hard block, an event/activity entry must ship in the same change.**

**Severity: Informational today. Escalates to Medium if the field is ever made enforcing without audit.**

## 8. Client-side trust

The editor input carries `min={1}`, `max={2147483647}`, `step={1}`, and an `onBlur` re-check that reverts invalid values and fires no mutation. This is a UX affordance, not the enforcement point. Bypassing it — devtools, curl, or the typed client from a script — still hits the server validator in §2, which returns 400 before any authorization or database work.

**Severity: Informational.** Enforcement is server-side.

## 9. Dependency risk

No new dependency. `AlertTriangle` comes from `lucide-react`, already a direct dependency of `apps/web`; `cn` from the existing `@/lib/utils`. No package.json or lockfile churn.

**Severity: Informational.** Confirmed.

## 10. Migration safety

```sql
ALTER TABLE "column" ADD COLUMN "wip_limit" integer;
```

Nullable, no default, no constraint, no index. In PostgreSQL this is a catalog-only operation: it takes a brief `ACCESS EXCLUSIVE` lock but does not rewrite existing rows, so it completes in effectively constant time regardless of table size. Existing rows read back `NULL`, which the controllers and projections handle.

Caveats, none blocking:
- The brief `ACCESS EXCLUSIVE` lock queues behind any long-running transaction on the `column` table and queues new queries behind itself while held. Standard `ADD COLUMN` behavior, not specific to this change.
- No default means no backfill and no bloat — the right choice for a nullable advisory field.
- No index added; the field is never queried by.

**Severity: Informational.** Safe on a populated table.

## Summary

The change is small, tightly scoped, and rides on pre-existing authorization. The validator is aligned with the storage type on both mutation routes, closing the prior arm's unbounded-validator finding in full. No new data exposure, no DoS surface, no injection vector, no new dependency, no risky migration. The single judgment call is the absence of an event/activity entry, acceptable while `wipLimit` remains advisory and to be revisited if it is ever made enforcing.

**SECURITY VERDICT: PASS**

# Security Review — pass1

- **Run:** `20260820-123148-feature-extend-lane-wip-limit`
- **Intent:** `feature-extend` (brownfield — scope is CHANGED FILES ONLY)
- **Feature:** advisory per-column WIP limit (`wipLimit`, nullable int >= 1)
- **Verdict:** **pass_with_findings**
- **Findings:** 0 critical, 0 high, 0 medium, 1 low, 2 info (+ 3 pre-existing advisories, out of scope)

## Tooling note (read this before trusting the negative space)

`Glob` and `Grep` are not present on this build — the tool surface was `Read`, `Bash`, `Write`
only. Every search below was therefore run through `Bash` (`grep -rn`, `git diff`, `wc`), and each
"clean" claim in this document is backed by a command that actually produced output. No check is
marked clean on the basis of a search I could not run. Two checks were bounded by the run's
read-only / no-test-execution constraint and are labelled as such (PostgreSQL overflow behavior,
and any runtime verification of the middleware chain).

## Summary

The diff is small, well-shaped, and does not move any authorization boundary. Both mutating column
routes retain their pre-existing `workspaceAccess.* → requireWorkspacePermission({ project:
["update"] })` chain verbatim — the guard lines appear as unchanged context in `git diff`, and no
ad-hoc role check was introduced anywhere in the changed files. Tenant isolation for the new write
path is inherited from `workspaceAccess.fromColumn("id")`, which resolves the workspace by joining
`column → project → project.workspace_id` in the database rather than trusting client input, so a
member of workspace B cannot set a WIP limit on a column in workspace A. Input validation is
present and correctly rejects floats, strings, booleans, `NaN`, `Infinity`, `0`, and negatives; the
one real gap is a missing upper bound, which lets an already-privileged caller push a value past
PostgreSQL's 4-byte `integer` range and turn a should-be-400 into a 500. Migration 0043 is a single
nullable `ADD COLUMN` with no default and no backfill, which is metadata-only and safe for
self-hosted upgrades. The widened board projection now emits the internal column id on a route that
is also reachable unauthenticated via `/api/public-project/:id`; I traced that path and concluded it
is not exploitable, but it is documented below because it is the one genuinely new piece of data
crossing a trust boundary. Nothing in the diff blocks sign-off.

Per the run constraints, "WIP limit is not enforced server-side on task moves" is an intentional
product decision and is **not** reported as a vulnerability.

## Findings

| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Low | Input validation / error handling | `apps/api/src/column/index.ts:63-65` (create), `apps/api/src/column/index.ts:143-145` (update) | `wipLimit` has a lower bound but no upper bound, so values above PostgreSQL's `integer` max reach the driver and fail at the DB rather than at the validator. Verified by executing the exact schema against edge values inside the `apps/api` package: `2147483648 → PASS`, `9007199254740992 → PASS`, `1.7976931348623157e+308 → PASS` (`Number.isInteger(Number.MAX_VALUE)` is `true`, so `v.integer()` admits it). PG `integer` tops out at `2147483647`, so the write raises `22003 numeric_value_out_of_range`, which is not an `HTTPException` and falls through to the global handler at `apps/api/src/index.ts:156-168` — a generic 500 plus a `Sentry.captureException`. Impact is bounded: requires an authenticated caller who already holds `project:update`, no data is written, and no DB detail leaks (the handler returns a flat `{"message":"Internal Server Error"}`). Real effects are error-class confusion and attacker-controllable Sentry noise. The client-side path reaches it too — `column-header.tsx:110` uses bare `Number(trimmed)` with `Number.isInteger(parsed) && parsed >= 1` and no ceiling. | Add `v.maxValue(2147483647)` to the pipe on both routes: `v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2147483647))`. Optionally mirror a `max` on the UI input. Not executed against a live PostgreSQL (test execution was out of scope for this review), so the 500 is inferred from the type range and the confirmed absence of an intermediate catch. |
| Info | Data exposure | `apps/api/src/task/controllers/get-tasks.ts:225` (`columnId: column.id`), `:230` (`wipLimit`) | The board projection now emits the internal column identifier where previously only `id: column.slug` was exposed. This projection is reachable **unauthenticated** through `/api/public-project/:id` (`apps/api/src/index.ts:243-248` → `apps/api/src/project/controllers/get-public-project.ts:5`) for projects flagged `isPublic`. Assessed as non-exploitable: (a) `columnTable.id` is a cuid2 (`.$defaultFn(() => createId())`, `schema.ts:345-347`), not sequential, so it grants no enumeration capability; (b) every endpoint that consumes a column id — `PUT /column/:id` and `DELETE /column/:id` — is behind `workspaceAccess.fromColumn("id")` plus `requireWorkspacePermission({ project: ["update"] })`, so possessing the id confers nothing without permission, i.e. no IDOR; (c) the same response already exposes strictly more sensitive identifiers than this one (see pre-existing note P3), so the marginal disclosure is nil. No secret, credential, or cross-workspace field enters the projection — the added fields are exactly `column.id` and `column.wipLimit` from a query already scoped by `eq(columnTable.projectId, projectId)`. | No change required. Recorded so the trust-boundary crossing is on the record; if public boards are ever hardened, strip `columnId` in the public serializer rather than the shared one. |
| Info | Test coverage (negative authz) | `tests/api-integration/column-wip-limit.test.ts` | The suite proves the positive path and the unauthenticated rejection (AC-4, lines 137-186: anonymous `PUT` is rejected and the stored value is confirmed unchanged at `5`). It does not cover the two authorization cases that would actually regress if a future edit weakened the chain: a member of a *different* workspace writing `wipLimit`, and an authenticated member holding a role *without* `project:update` (e.g. viewer). Not a vulnerability — the guards are shared middleware verified by reading, and all fixtures seed `role: "owner"` without touching production permission code. | Add two cases to the integration file: cross-workspace member → expect 403/404 and unchanged stored value; under-privileged in-workspace role → expect 403. |

## What was checked and found clean (the negative space)

**Authorization on every changed route.** Read `apps/api/src/column/index.ts` end to end (183 lines,
all five routes). `POST /:projectId` → `workspaceAccess.fromProject("projectId")` +
`requireWorkspacePermission({ project: ["update"] })` (lines 68-69). `PUT /:id` →
`workspaceAccess.fromColumn("id")` + same permission (lines 148-149). Both appear as **unchanged
context lines** in `git diff` — the diff only inserts validator entries and destructures/forwards
`wipLimit`. `DELETE /:id` and `PUT /reorder/:projectId` are likewise still guarded. No route in the
changed set is unguarded, and `grep` over the changed API files found zero ad-hoc role comparisons.

**Authentication precedes the routes.** `api.use("*", ...)` at `apps/api/src/index.ts:573-599` calls
`authenticateApiRequest(c)` and is registered *before* `api.route("/column", column)` at line 608,
so an anonymous caller is rejected 401 before any column handler or validator runs. Confirmed by
reading the registration order, and corroborated by the AC-4 integration test.

**Tenant isolation resolves server-side.** `workspaceAccess.fromColumn` (`workspace-access-middleware.ts:347-353`)
uses `{ type: "lookup", resource: "column", idKey }`; the `column` case (lines 240-253) joins
`columnTable → projectTable` and returns `project.workspace_id`. The id is taken only from the path
param or JSON body — never the query string — with an in-file comment (lines 69-72) explaining that
accepting it from the query previously allowed authorizing against one resource while acting on
another. The workspace is then handed to `validateWorkspaceAccess(userId, workspaceId, apiKeyId)`.
Client input cannot name the workspace on this path. A workspace-B member cannot set `wipLimit` on a
workspace-A column.

**Input validation, positively exercised.** Rather than eyeball the schema, I ran it. `0`, `-1`,
`1.5`, `"3"`, `true`, `NaN`, and `Infinity` are all **rejected**; `4`, `null`, and `undefined` pass
with correct output. So no float, string, boolean, or sentinel value reaches the DB, and
optional/nullable semantics are exactly as specified. Only the unbounded upper end fails (Finding 1).

**No mass-assignment via the update path.** `update-column.ts:25-32` builds its `set()` from an
explicit allowlist of five conditional spreads; `wipLimit` is applied only when
`data.wipLimit !== undefined`, so omitting the field preserves the stored value rather than nulling
it (asserted in the integration test, lines 122-135, and the unit test "does not include wipLimit
when field is omitted"). A caller cannot smuggle `projectId`, `position`, or `id` through the JSON
body — Valibot strips unknown keys and the controller never spreads `data` wholesale.

**Migration safety.** `apps/api/drizzle/0043_known_night_thrasher.sql` is one statement:
`ALTER TABLE "column" ADD COLUMN "wip_limit" integer;`. Nullable, no `DEFAULT`, no `NOT NULL`, no
backfill, no index, no constraint, no data movement. On every supported PostgreSQL version this is a
catalog-only change — it takes a brief `ACCESS EXCLUSIVE` lock but performs no table rewrite, so
self-hosted upgrades on large `column` tables will not stall. The `_journal.json` diff is a clean
append of `idx: 43` with no renumbering or mutation of entries 0-42, so existing installations'
applied-migration state stays consistent. Non-destructive and reversible.

**Event omission is safe.** `grep -rn "publishEvent" apps/api/src/column/` returns nothing —
**column mutations have never published events**, so declining to publish for `wipLimit` is
consistent with the module, not a regression. Security-wise the omission is inert: `wipLimit` is
advisory display metadata and no authorization decision anywhere reads it, so a stale client cache
cannot produce a stale-authorization or cache-poisoning outcome. The worst case is a user seeing an
out-of-date badge until refetch, and `use-update-column.ts` already invalidates on success.

**Server is the authority; client check is cosmetic.** `column-header.tsx` gates the editor on
`canUpdateProjects()` and validates `>= 1` locally, but the same value is independently revalidated
by Valibot and independently authorized by `requireWorkspacePermission` on the server. Removing the
UI gate or calling the API directly yields 403, not a write. The client check is UX, not enforcement.

**No XSS in the new UI.** Read the full 172-line component diff: no `dangerouslySetInnerHTML`, no
`innerHTML`, no `eval`. `wipLimit` is rendered as a template-interpolated number inside JSX text
(`${column.tasks.length}/${wipLimit}`) and all `title`/`aria-label` values come from static i18n
keys. The error toast surfaces `err.message`, which for this API is either an `HTTPException`
message or the sanitized `"Internal Server Error"` — no DB or stack detail reaches the DOM.

**Global error filter sanitizes.** `apps/api/src/index.ts:156-168`: `HTTPException`s return their own
response (and are Sentry-reported only at >= 500); everything else returns a flat
`{"message": "Internal Server Error"}` with a 500. No stack traces, driver messages, or SQL fragments
escape — this is what bounds Finding 1 to a nuisance.

**Secrets.** Ran the checklist regex plus a `token` variant across every changed API file, web file,
and test file in scope: **zero matches**. No credentials, keys, or tokens in the new fixtures — the
integration tests build users through the existing `createWorkspaceMember` helper and
`mockAuthenticatedSession`, with no literal passwords. `.env` is gitignored (`.gitignore:9-13`).
No `package.json` or lockfile changes in this run, so no new dependency was introduced.

**No production code relaxed to make tests pass.** The full changed-file set contains no edit to any
guard, permission definition, or middleware. Test fixtures seed `role: "owner"`, which is a
legitimate use of the real permission system rather than a bypass of it. The two "also touched"
web test files were widened only for the `columnId` type addition.

**PII checklist items** (`government_id`, `bank_account`, `salary_base`, role-based response masking,
PII audit logging): not applicable — those fields do not exist anywhere in this repository, and this
diff introduces a single nullable integer of workflow metadata. Confirmed by grep rather than assumed.

## Noted (pre-existing, out of scope — advisory only, does not gate this run)

- **P1 — `fromColumn` query-string fallback (low).**
  `workspace-access-middleware.ts:347-353` configures sources as
  `[lookup column by id, query workspaceId]`, and `lookupWorkspaceId` swallows DB errors into `null`
  (lines 273-276). If the lookup returns `null` for a column that nevertheless exists — i.e. the
  lookup query errors while the controller's later `findFirst` succeeds — the middleware falls
  through to an attacker-supplied `?workspaceId=<their own>`, authorizes against that, and the
  handler then writes the victim's column. The window is narrow and requires inducing a query error,
  but it sits directly on the new `wipLimit` write path, which is why it is recorded here. Fixing it
  belongs in the middleware, not this diff: distinguish "not found" from "lookup failed" and fail
  closed instead of falling through.
- **P2 — `pnpm audit --prod`: 2 high, both transitive, both pre-existing.** `nanoid <3.3.18`
  (GHSA-2v37-7h3g-55p8) via `apps__api > better-auth > vitest > vite > postcss > nanoid`, and
  `deepmerge-ts <8.0.0` (GHSA-ggr8-5vv4-36mx) via `apps__api > better-auth > prisma > @prisma/config`.
  Neither is reachable from the WIP-limit code, both arrive through `better-auth`'s dependency tree,
  and this run changed no manifest or lockfile — so they are not introduced here. (`npm audit --omit=dev`
  is not meaningful against a pnpm workspace lockfile; `pnpm audit --prod` is the equivalent and is
  what was run.) Worth a separate dependency-bump ticket.
- **P3 — public board projection is broad (informational).**
  `/api/public-project/:id` returns `project.workspaceId` and spreads whole task rows (`...task`) to
  unauthenticated callers. This long predates the run and is the reason Finding 2 is rated `info`:
  the internal column id is strictly less sensitive than what that endpoint already emits. Deserves
  its own review of what a public board ought to expose.

## Required fixes before sign-off

None blocking. One recommended before merge:

- Add `v.maxValue(2147483647)` to the `wipLimit` pipe on both the create and update validators in
  `apps/api/src/column/index.ts` so an out-of-range value returns 400 from the validator instead of
  500 from the database driver. One-line change in two places; a `2147483648` case in
  `tests/api/column/*` would lock it in.

Suggested follow-ups (non-blocking): the two negative-authz integration cases from Finding 3, and
separate tickets for pre-existing items P1 and P2.

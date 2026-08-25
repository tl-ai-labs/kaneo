# Security Review — brownfield `feature-extend` — Per-lane WIP limit

**Verdict: PASS WITH FINDINGS** — 0 critical, 0 high, 0 medium, 2 low, 4 informational. Nothing blocks Gate 3.

Run: `20260824-095555-feature-extend-wip-limits` · Scope: changed files only (per the brownfield intent matrix) · Reviewed at working tree, branch `feature-extend-1/opus-flash`, base `5d1fc910`.

---

## Method / enumeration note

`Glob` and `Grep` were **not present** in this agent's tool surface — only `Read`, `Bash`, `Write`. All enumeration and search was therefore done with `Bash` (`git status --porcelain`, `git diff`, `grep -rn`, `ls -R`). Every "absent" claim below (no new events, no new deps, no secrets, no other write path into `columnTable`) is backed by a search that actually ran and whose output I inspected; none rests on a listing I could not obtain.

Changed-file set was taken from `git status --porcelain` and cross-checked against `.sdlc/runs/20260824-095555-feature-extend-wip-limits/provenance.json`. One discrepancy: provenance lists `apps/api/drizzle/0043_living_karen_page.sql`, but the file on disk is `apps/api/drizzle/0043_broken_weapon_omega.sql` and no `0043_living_karen_page.sql` exists. The migration was regenerated mid-run and the earlier artifact removed; the journal and snapshot on disk are internally consistent (verified below). Noted as informational, not a finding against the change.

Claims about PostgreSQL, drizzle and `pg` behaviour in F-1 were **empirically verified**, not assumed — see the evidence chain under Q3.

---

## Findings

| Severity | File:line | Threat | Impact | Remediation |
|---|---|---|---|---|
| **Low** | `apps/api/src/column/validators.ts:8-10` | `wipLimitSchema` has `v.minValue(1)` but **no `v.maxValue`**. Any JS integer up to `Number.MAX_VALUE` passes Valibot, is bound as a query parameter, and is rejected by PostgreSQL at the `int4` column. Reachable from `POST /column/:projectId` (`index.ts:65`), `PUT /column/:id` (`index.ts:144`), and from the UI itself — `handleUpdateWipLimit` (`column-editor.tsx:136`) also has no upper bound. | Authenticated caller holding `project:update` can force a reproducible unhandled DB error → HTTP 500 `{"message":"Internal Server Error"}` plus a `Sentry.captureException` per request (`apps/api/src/index.ts:165-166`). No auth bypass, no information disclosure (the global filter sanitizes), no partial write. Sentry quota burn / log noise is the real cost. Also: an in-range value such as `2147483647` **is** stored and renders as `3/2147483647` in the lane header (`column-task-count-badge.tsx:49`) — cosmetic layout only. | Add `v.maxValue(...)` to `wipLimitSchema` — `2147483647` at minimum to match `int4`, but a product-sane cap (e.g. `999` or `10000`) is better and turns the 500 into a clean 400. Mirror the bound in `handleUpdateWipLimit` and as `max=` on the `<Input>` (`column-editor.tsx:344-347`). |
| **Low** | `apps/api/src/task/controllers/get-tasks.ts:230` via `apps/api/src/project/controllers/get-public-project.ts:5,19` and `apps/api/src/index.ts:243-248` | `wipLimit` was added to the `projectColumns.map(...)` projection in `get-tasks.ts`. `getPublicProject()` returns `getTasks(id).data` wholesale, and `GET /api/public-project/:id` is registered at `index.ts:243`, **before** the `api.use("*")` authentication middleware at `index.ts:574` — so it is genuinely anonymous. A project's per-lane WIP configuration is therefore now readable by unauthenticated callers on any project whose owner set `isPublic`. | Very low. `wipLimit` is a small integer describing process policy, disclosed alongside data that is already public on the same response: column names, slugs, `isFinal`, `workspaceId`, and full task objects. It is **not** rendered — the public board uses its own components under `apps/web/src/components/public-project/`, which contain zero `wipLimit` references (verified by grep) — so this is a JSON-only disclosure. Requirements §5 did not anticipate the anonymous surface. | Accept as intended, or drop `wipLimit` from the projection inside `getPublicProject` if WIP policy is considered internal process detail. If accepted, amend requirements §5 to record that `wipLimit` reaches an anonymous endpoint. |
| Informational | `tests/api/column/wip-limit-authz.test.ts:6-21` | The authorization regression test asserts only `routes.filter(...).length >= 6` — a **count** of registered handlers, not their identity. Swapping `requireWorkspacePermission({project:["update"]})` for any other middleware, or replacing `workspaceAccess.fromColumn` with a no-op, keeps the count at 6 and the test green. | The guard chain is correct today (verified by reading `index.ts:68-69, 147-148`), but the test does not defend it. | Assert on guard identity — e.g. `handler.name`, a tagged symbol on the middleware factories, or an integration test that calls the route as a `viewer`/`member` and expects 403. |
| Informational | `apps/api/drizzle/meta/0043_snapshot.json` | The snapshot is serialized with **2-space indentation**; every prior snapshot (`0042_snapshot.json` and earlier) uses **tabs**. Structurally the file is correct (verified by JSON diff: 36 tables in both, only `public.column` differs, only `wip_limit` added), but the formatting change suggests it was hand-authored or reformatted rather than emitted verbatim by `drizzle-kit generate`. | None at runtime — drizzle-kit parses either. Risk is future drift: a hand-maintained snapshot that diverges from `schema.ts` makes the *next* `db:generate` emit wrong DDL. | Regenerate with `pnpm --filter @kaneo/api db:generate` and commit the tool's own output so the byte-for-byte provenance of the snapshot chain is preserved. |
| Informational | `apps/api/src/mcp/tools.ts:796-807` | The pre-existing `list_project_columns` tool proxies `GET /api/column/:projectId`, so its output now includes `wipLimit`. | No authorization change: the proxied request carries the caller's credentials and hits `workspaceAccess.fromProject` at `index.ts:34`. Non-sensitive field. No new MCP tool and no MCP write path to `wipLimit`. | None. Recorded for completeness against the AGENTS.md "do not expose … through MCP tools" boundary. |
| Informational | `.gitignore` (+3 lines) | The run also added `.sdlc/` to `.gitignore`. This file is **not** in `provenance.json`'s `files_touched` and is unrelated to the WIP-limit feature. | None. Side effect: this review artifact is itself gitignored and will not be committed. | Confirm the `.gitignore` edit is intentional and separate it from the feature commit. |

---

## Per-question answers

### 1. Authorization completeness — can `wipLimit` be written through any path that skips the guards?

**No.** I enumerated every write into `columnTable` across `apps/api/src`, `packages/`, and `tests/` with `grep -rn "insert(columnTable)\|update(columnTable)\|delete(columnTable)"`. Exactly five write sites exist:

| Write site | Reaches `wipLimit`? | Guard |
|---|---|---|
| `apps/api/src/column/controllers/create-column.ts:70-80` (`wipLimit ?? null` at :79) | **Yes** | `workspaceAccess.fromProject("projectId")` + `requireWorkspacePermission({project:["update"]})` — `index.ts:68-69` |
| `apps/api/src/column/controllers/update-column.ts:24-33` (conditional spread at :31) | **Yes** | `workspaceAccess.fromColumn("id")` + `requireWorkspacePermission({project:["update"]})` — `index.ts:147-148` |
| `apps/api/src/column/controllers/reorder-columns.ts:11-17` | **No** — `.set({ position: col.position })` only; the `wipLimit` field is not in the set object and the route validator (`index.ts:100-110`) accepts only `{id, position}` | `index.ts:111-112` (same pair) — moot |
| `apps/api/src/project/controllers/create-project.ts:46` — seeds default columns | **No** — `.values({...})` omits `wipLimit`, so the column defaults to `NULL` | Project-create authorization, unchanged |
| `apps/api/src/migrations/column-migration.ts:57-65` — boot-time legacy backfill | **No** — omits `wipLimit` | Not request-reachable |

**Gitea/GitHub column resolvers**: `plugins/gitea/utils/resolve-column.ts:12-17` and `plugins/github/utils/resolve-column.ts:12-17` project only `{id, slug}` and never write. `plugins/{gitea,github}/webhooks/issue-opened.ts` use `db.query.columnTable.findFirst` — read-only.
**Task import/export**: `task/controllers/import-tasks.ts:53-56` uses `findFirst` to resolve a status slug — read-only, never writes a column row.
**Workflow rules**: `workflowRuleTable` is joined in the resolvers but no code path writes `columnTable`.
**MCP**: `list_project_columns` is the only column tool and is a GET proxy.

The guard is meaningful: `hasWorkspacePermission` (`utils/require-workspace-permission.ts:88-131`) intersects an API key's own `permissions` (`:96-99`) before checking workspace role, so a scoped API key without `project:update` is rejected. Instance admins bypass (`:101-103`) — pre-existing and intentional.

### 2. Read exposure / IDOR

| Endpoint | Guard | Anonymous? |
|---|---|---|
| `GET /column/:projectId` (`index.ts:33-39`) | `workspaceAccess.fromProject("projectId")` only — **membership, no permission check** | No |
| `GET /task/tasks/:projectId` (`task/index.ts:96`) | `workspaceAccess.fromProject("projectId")` | No |
| `GET /api/public-project/:id` (`index.ts:243-248`) | **None** — registered before the `api.use("*")` auth middleware at `:574`; `getPublicProject` only asserts `result.data.isPublic` (`get-public-project.ts:13-17`) | **Yes** |

No IDOR: both authenticated paths resolve `workspaceId` from the requested `projectId` and verify the caller's membership before the handler runs, so a caller cannot read another workspace's columns. `workspaceAccessMiddleware` also refuses to take the resource id from the query string when the handler reads it from the param/body (`workspace-access-middleware.ts:69-73`) — the confused-deputy case is already closed.

The public-project leak is real but low — see F-2. It matters only if a self-hoster considers WIP policy confidential; it is disclosed alongside all column names and every task on the board.

### 3. Input validation — the unbounded upper value (definitive answer)

**Yes, `Number.MAX_SAFE_INTEGER` is accepted by the validator and causes a PostgreSQL error surfacing as an HTTP 500.** Proven, not reasoned, in four steps:

**Step 1 — Valibot accepts it.** Running the exact schema from `validators.ts:8-10`:

```
1                          accepted = true
2147483647                 accepted = true
2147483648                 accepted = true
9007199254740991           accepted = true   <- Number.MAX_SAFE_INTEGER
1e+21                      accepted = true
1.7976931348623157e+308    accepted = true   <- Number.MAX_VALUE
Infinity                   accepted = false  <- Number.isInteger(Infinity) === false
0                          accepted = false
```

`v.integer()` delegates to `Number.isInteger`, which is `true` for every finite float with no fractional part — including `1e21` and `Number.MAX_VALUE`. Only `Infinity`/`NaN` are filtered.

**Step 2 — drizzle binds it as a parameter, unchanged.** `.toSQL()` on the actual insert shape:

```
insert into "column" ("id","project_id","slug","name","position","icon","color","is_final","wip_limit")
  values (default,$1,$2,$3,$4,$5,$6,$7,$8)
params: ["p","s","n",0,null,null,false,2147483648]
```

`PgInteger` has no `mapToDriverValue` clamp — the raw JS number reaches `$8`.

**Step 3 — `pg` stringifies it as a text parameter.** `pg/lib/utils.prepareValue`:

```
2147483647       => "2147483647"
2147483648       => "2147483648"
9007199254740991 => "9007199254740991"
1e+21            => "1e+21"          <- exponential notation survives
```

**Step 4 — PostgreSQL 16 rejects it.** Executed read-only against the project's own `postgres:16` integration container:

```
SELECT '2147483647'::integer       -> 2147483647            (OK)
SELECT '2147483648'::integer       -> ERROR: value "2147483648" is out of range for type integer         [22003]
SELECT '9007199254740991'::integer -> ERROR: value "9007199254740991" is out of range for type integer   [22003]
SELECT '1e+21'::integer            -> ERROR: invalid input syntax for type integer: "1e+21"              [22P02]
```

**Result:** the driver error is not an `HTTPException`, so it falls to `app.onError` (`apps/api/src/index.ts:156-167`), which calls `Sentry.captureException(err)` and returns a sanitized `{"message":"Internal Server Error"}` with status 500. So: **500 + Sentry event, no stack trace or SQL leaked, no partial write** (the insert is a single statement; `create-column`'s slug and max-position reads happen before it and are non-mutating). Values `1..2147483647` store cleanly; the only downside at the top of that range is a wide badge string. Severity **low** — logged as F-1.

### 4. Injection

**None.** The `sql` template at `create-column.ts:50-52` is **unchanged by this run** (confirmed against `git diff`) and `wipLimit` does not appear in it. Verified by `.toSQL()` that drizzle parameterizes it — feeding `x' OR 1=1--` into both interpolation slots produces:

```
select "id" from "column" where "column"."project_id" = $1 AND "column"."slug" = $2
params: ["x' OR 1=1--", "x' OR 1=1--"]
```

Column references render as quoted identifiers, values as placeholders. `wipLimit` travels only through `.values({...})` (`create-column.ts:79`) and `.set({...})` (`update-column.ts:31`), both fully parameterized. No new string interpolation was introduced anywhere in the change.

No XSS on the web side either: `column-task-count-badge.tsx:49` renders `` `${count}/${wipLimit}` `` as a React text node and `:37-38` puts the i18n label into `title`/`aria-label` attributes — React escapes both. No `dangerouslySetInnerHTML` anywhere in the changed files.

### 5. Data exposure in logs / events / WebSockets / Redis / MCP

**Confirmed clean.**
- **Events**: `grep -rn "publishEvent" apps/api/src/column/ apps/api/src/task/controllers/get-tasks.ts` → zero matches. No event is published by column create/update, so nothing new enters the event → WebSocket → Redis fan-out.
- **WebSockets**: `grep -rn "column" apps/api/src/events/ apps/api/src/ws` → zero matches. The realtime layer does not carry column payloads at all.
- **Logs**: `grep -n "console\.\|logger\." ` across all changed API files → zero matches. `wipLimit` is never logged.
- **MCP**: no new tool; `list_project_columns` output now includes the field, behind the same guard — informational only (see findings table).

### 6. Migration safety

`apps/api/drizzle/0043_broken_weapon_omega.sql` is exactly one line:

```sql
ALTER TABLE "column" ADD COLUMN "wip_limit" integer;
```

Additive, nullable, **no `DEFAULT`**, no `NOT NULL`, no index, no backfill, no data movement. On PostgreSQL 11+ an `ADD COLUMN` with no default is a catalog-only change: an `ACCESS EXCLUSIVE` lock held for microseconds, no table rewrite. Existing rows read back `NULL` = "no limit", which `column-task-count-badge.tsx:17` maps to the byte-identical pre-change badge — so upgrading installs see zero behavioural or visual change until someone sets a limit.

**Chain integrity — verified, intact:**
- `_journal.json` last entry: `{"idx": 43, "version": "7", "when": 1787567988920, "tag": "0043_broken_weapon_omega", "breakpoints": true}` — `idx` follows 42 with no gap, and the `tag` matches the filename on disk exactly, so `drizzle-kit migrate` will find and run it.
- `0043_snapshot.json.prevId` = `9f67f0d6-b802-4751-9d9a-577ce21440a0` = `0042_snapshot.json.id`. Chain unbroken.
- JSON diff 42→43: both have 36 tables, identical table sets, and **only `public.column` differs**, with the single addition `{"name":"wip_limit","type":"integer","primaryKey":false,"notNull":false}`. No accidental drift into any other table.
- No existing migration file was edited or renumbered (`git status` shows `0043_*` as untracked-new and every `0000`–`0042` as unmodified).

### 7. Denial of service / resource use

**No new work that scales with board size.** `get-tasks.ts:220-224` already did `db.select()` on `columnTable` with **no projection** — every column of every row was already being fetched. Adding `wip_limit` to the schema costs one extra `int4` per column row on a query that already ran; adding `wipLimit: column.wipLimit` at `:230` is a property copy inside a `.map` over lanes (typically < 10), not over tasks. **Zero new queries, zero new round trips.** On the client, `ColumnTaskCountBadge` is one `O(1)` component per lane and uses `column.tasks.length` — the identical value the old inline badge used (`column-header.tsx:63-66`), so no new derived count and no new traversal. NFR-3 holds.

The only DoS-adjacent issue is F-1's forced 500 + Sentry event, which is rate-limited by the attacker needing `project:update` on a workspace they already administer.

### 8. Client-side trust boundary

**Confirmed presentation-only; the server is the authority.**
- `disabled={!canEdit}` (`column-editor.tsx:356`) derives from `useWorkspacePermission().canManageProjects()` (`:36-37`). Removing the attribute in devtools changes nothing server-side: `PUT /column/:id` still runs `workspaceAccess.fromColumn("id")` then `requireWorkspacePermission({project:["update"]})` (`index.ts:147-148`) and returns 403 for `viewer`/`member`.
- The `!Number.isInteger(parsed) || parsed < 1` guard (`column-editor.tsx:136`) merely reverts the input and skips the mutation. A hand-crafted `PUT /column/:id` with `{"wipLimit": 0}`, `{"wipLimit": -1}`, `{"wipLimit": 2.5}`, `{"wipLimit": "3"}`, or `{"wipLimit": true}` is rejected by `wipLimitSchema` at `index.ts:144` before the controller runs — covered by `tests/api/column/wip-limit-validator.test.ts:25-46`, which I ran: **30/30 passing across the 4 new/changed API test files**.
- The one gap is that the client guard and the server validator share the *same* missing upper bound, so the UI can trigger F-1 too — a user typing `9999999999` into the `type="number"` input gets a 500 toast rather than a validation message. That is a UX symptom of F-1, not a separate authorization issue.

The comment at `column-editor.tsx:135` (`"Client-side guard only; the Valibot validator on PUT /column/:id is the authority"`) correctly states the boundary, and the code matches the comment.

### 9. Supply chain

**No new dependencies.** `git status --porcelain | grep -iE "package.json|lock"` returns empty — no `package.json` and no `pnpm-lock.yaml` was modified by this run. `ColumnTaskCountBadge` imports only `lucide-react`, `react-i18next` and `@/lib/utils`, all already in use across the app.

`pnpm audit --prod` reports **2 high, 0 critical**, both **pre-existing and unrelated** to this change (no lockfile delta could have introduced them):

| Severity | Package | Path | Advisory |
|---|---|---|---|
| high | `nanoid <3.3.18` | `apps__api > better-auth > vitest > vite > postcss > nanoid` | GHSA-2v37-7h3g-55p8 |
| high | `deepmerge-ts <8.0.0` | `apps__api > better-auth > prisma > @prisma/config > deepmerge-ts` | GHSA-ggr8-5vv4-36mx (CVE-2026-40345) |

Both are dev-toolchain packages (`vitest`/`vite`, `prisma`) dragged into the production graph by `better-auth`'s dependency declarations, not reachable from Kaneo's request path. Out of scope for this run — listed as advisory below.

---

## PII / sensitive-data statement

**Requirements §5's claim of "no new PII" is verified and correct**, with one amendment.

`column.wipLimit` is a nullable `int4` describing a project's process policy. It is not personal data under any reading, not a credential, and not a secret. It is not derived from, correlated with, or joined to any user record. I traced it end to end — schema (`schema.ts:361`) → controllers (`create-column.ts:79`, `update-column.ts:31`) → projections (`get-tasks.ts:230`, `get-columns.ts` full-row select) → fetchers → component — and it never touches `userTable`, session data, or any encrypted field.

The change introduces **no** new logging, **no** new event, **no** new WebSocket message, and **no** new MCP tool, so it moves no existing PII across a new boundary either. Lane task counts (`column.tasks.length`) are unchanged and already rendered today.

The checklist's `government_id` / `bank_account` / `salary_base` items **do not apply** — those fields do not exist anywhere in this codebase (`grep -rn` across `apps/`, `packages/`, `tests/` returns nothing), and this change adds no field of comparable sensitivity. Likewise there is no audit-log table in scope: this change writes no audit entry because it publishes no event, consistent with the "advisory only, no new event" design.

**Amendment to §5:** the table should record that `wipLimit` is reachable anonymously via `GET /api/public-project/:id` on projects flagged `isPublic`, which §5's "Same workspace-scoped authorization as every other column field" phrasing does not currently cover. See F-2.

---

## Authorization matrix

**Write `wipLimit`** — `POST /column/:projectId`, `PUT /column/:id`:

| Principal | Can write? | Enforced by |
|---|---|---|
| Anonymous | No | `api.use("*")` auth middleware, `apps/api/src/index.ts:574` (both routes registered after it) |
| Authenticated non-member | No | `workspaceAccess.fromProject/fromColumn` → `validateWorkspaceAccess`, `index.ts:68, 147` |
| Workspace `viewer` | No | `requireWorkspacePermission({project:["update"]})` — `viewer.project = ["read"]`, `packages/permissions/src/index.ts:22` |
| Workspace `member` | No | same — `member.project = ["create","read"]`, `index.ts:29` |
| Workspace `admin` | **Yes** | `admin.project` includes `"update"`, `index.ts:37` |
| Workspace `owner` | **Yes** | `owner.project` includes `"update"`, `index.ts:45` |
| Custom workspace role | Yes iff its stored statements grant `project:update` | `customRoleStatements()` + `satisfies()`, `require-workspace-permission.ts:53-71, 74-86` |
| API key | Only if the key's own `permissions` also grant `project:update` | `require-workspace-permission.ts:96-99` (intersection before role check) |
| Instance admin | **Yes** (bypasses role check) | `isInstanceAdmin(c)`, `require-workspace-permission.ts:101-103` — pre-existing |
| MCP client | No write path exists | Only `list_project_columns` (GET) is registered, `mcp/tools.ts:796-807` |

This is **exactly** the permission that already gated renaming a column, changing its icon, or toggling `isFinal` — no new vocabulary, no widening. FR-11 satisfied.

**Read `wipLimit`:**

| Principal | Can read? | Path / enforced by |
|---|---|---|
| Any workspace member incl. `viewer` | **Yes** | `GET /column/:projectId` — `workspaceAccess.fromProject` only, no permission check (`index.ts:34`); pre-existing read model |
| Any workspace member incl. `viewer` | **Yes** | `GET /task/tasks/:projectId` — `workspaceAccess.fromProject` (`task/index.ts:96`) |
| Non-member, authenticated | No | workspace membership check on both paths |
| **Anonymous** | **Yes, on `isPublic` projects only** | `GET /api/public-project/:id` — no auth (`index.ts:243`, before the `:574` middleware); `isPublic` asserted at `get-public-project.ts:13-17`. **New surface introduced by this run** — F-2. |
| MCP client | Yes, with the caller's own credentials | `list_project_columns` proxies `/api/column/:projectId`, guard unchanged |

---

## Migration risk statement

**GO** — `0043_broken_weapon_omega.sql` is safe to run against a populated production database.

Justification: single `ALTER TABLE "column" ADD COLUMN "wip_limit" integer;`. Nullable, no `DEFAULT`, no `NOT NULL`, no constraint, no index, no `UPDATE`. On PostgreSQL 11 and later this is a catalog-only operation — the `ACCESS EXCLUSIVE` lock is held for the duration of a catalog row insert, with **no table rewrite and no per-row work**, so runtime is independent of the `column` table's size (and that table holds a handful of rows per project regardless). No downtime window is required beyond the momentary lock, which will only ever queue behind a long-running transaction already touching `column`.

Rollback is a plain `ALTER TABLE "column" DROP COLUMN "wip_limit";` with no data loss outside the new field itself.

Journal and snapshot chain verified intact (see Q6): `idx: 43` follows 42 contiguously, the journal `tag` matches the on-disk filename so `drizzle-kit migrate` will actually pick it up, `0043_snapshot.prevId === 0042_snapshot.id`, and the 42→43 structural diff touches only `public.column` and only adds `wip_limit`. No existing migration was edited or renumbered.

The **one caveat** is the snapshot's indentation style (informational finding above) — regenerate it with `db:generate` before merge so the committed artifact is provably tool-emitted. This does not affect whether `0043` runs correctly today.

---

## Passing checks

- Every changed/new route retains its full guard chain — `workspaceAccess` + `requireWorkspacePermission({project:["update"]})` on both write routes (`index.ts:68-69, 147-148`); confirmed by reading the code, not by assuming the test's presence.
- No new permission vocabulary; `packages/permissions` untouched.
- All five write paths into `columnTable` enumerated; only the two guarded ones reach `wipLimit`.
- No SQL injection surface — parameterization proven via `.toSQL()`; the pre-existing `sql` template in `create-column.ts` unchanged.
- No XSS — numeric text node + React-escaped `title`/`aria-label`; no `dangerouslySetInnerHTML`.
- No secrets in any changed file — targeted `grep -HnEi "(api[_-]?key|secret|password|token|bearer)[ \t]*[:=][ \t]*['\"][a-zA-Z0-9]"` across all 17 changed source/test files returned nothing.
- No credentials in the new test fixtures; the two modified pre-existing test files gained only `wipLimit: null` type-shape lines (`sync-task-labels-cache.test.ts:23`, `use-task-filters-with-labels-support.test.tsx:39,128`) — no assertion was weakened to make new code pass (FR-36 holds).
- No secrets in the new i18n copy; all 6 new `settings:columnEditor.*` and 2 new `tasks:kanban.wipLimit.*` keys are **static** (no interpolated key names, no dynamic lookup), and interpolated *values* (`{{current}}`, `{{limit}}`, `{{name}}`) land in React-escaped positions.
- Global error filter sanitizes — `app.onError` (`index.ts:156-167`) returns `{"message":"Internal Server Error"}` for any non-`HTTPException`, so the F-1 DB error leaks no SQL, no stack, no schema detail.
- No new dependency; `package.json` and `pnpm-lock.yaml` untouched.
- No `publishEvent`, no WebSocket payload, no Redis fan-out, no logging of `wipLimit`.
- No new query or per-task work on the board (NFR-3).
- Client-side gating is presentation-only and correctly documented as such at `column-editor.tsx:135`.
- Migration is additive, nullable, no-default, no-backfill, with an intact journal/snapshot chain.
- All 30 tests across the 4 new/changed API column test files pass (`vitest run tests/api/column`).

## Noted (pre-existing, out of scope)

These are **not** introduced by this run and do **not** gate it. Listed for visibility only.

- **`pnpm audit --prod`: 2 high, 0 critical.** `nanoid <3.3.18` (GHSA-2v37-7h3g-55p8) and `deepmerge-ts <8.0.0` (GHSA-ggr8-5vv4-36mx / CVE-2026-40345), both transitive under `better-auth` via `vitest`/`vite` and `prisma` respectively. Neither is on Kaneo's request path. No lockfile change in this run, so neither is attributable to it. Worth a separate `better-auth` bump ticket.
- **`GET /column/:projectId` has no `requireWorkspacePermission`** (`index.ts:33-39`) — any workspace member, including `viewer`, reads all column metadata. Consistent with the codebase's read model, but it means the guard on that route is membership-only rather than permission-checked.
- **No `.env.example` at the repository root** (`ls .env.example` → not found), though `.env` is correctly gitignored (`.gitignore:9-13`) and `ENVIRONMENT_SETUP.md` documents the variables. A committed `.env.example` would make the self-hosting story harder to get wrong.
- **`/api/public-project/:id` is unauthenticated by construction** — registered at `index.ts:243`, before the `api.use("*")` auth middleware at `:574`. Ordering-based auth exemption is fragile: any route added between those two lines is silently anonymous. An explicit allowlist inside the middleware (as already exists for `/api/mcp`, `/api/.well-known/`, `/api/billing/webhook` at `:576-581`) would make the exemption intentional rather than positional.
- **Fetcher error surfacing**: `update-column.ts:18-21` throws `new Error(await response.text())` and `column-editor.tsx:107-114` toasts `error.message`, so a 500 renders the raw JSON body to the user. Harmless given the sanitized filter, but it is why F-1 shows up as an ugly toast. Pre-existing pattern shared by every column edit.
- **Provenance/disk mismatch**: `provenance.json` records `0043_living_karen_page.sql`; the tree contains `0043_broken_weapon_omega.sql` and no `0043_living_karen_page.sql`. The migration was regenerated mid-run. On-disk artifacts are self-consistent, but provenance no longer describes the tree.

## Required fixes before sign-off

None block Gate 3. Recommended before merge, in priority order:

1. **Add an upper bound to `wipLimitSchema`** (`apps/api/src/column/validators.ts:8-10`) — `v.maxValue(...)`, ideally a product-sane cap rather than `2147483647`. Mirror it in `handleUpdateWipLimit` (`column-editor.tsx:136`) and as `max=` on the input. Turns a 500 + Sentry event into a clean 400. *(F-1)*
2. **Decide and record the public-project exposure** — either strip `wipLimit` in `getPublicProject`, or accept it and amend requirements §5 to state that `wipLimit` reaches an anonymous endpoint. *(F-2)*
3. **Regenerate `0043_snapshot.json`** with `pnpm --filter @kaneo/api db:generate` so the committed snapshot is byte-for-byte tool output. *(informational)*
4. **Strengthen `wip-limit-authz.test.ts`** to assert guard identity rather than handler count, so a deleted `requireWorkspacePermission` actually fails the suite. *(informational)*

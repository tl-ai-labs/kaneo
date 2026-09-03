# Security Review — brownfield (`feature-extend`)

- Run: `20260903-094517-feature-extend-column-wip-limit`
- Mode: brownfield · Intent: `feature-extend` · Scope: the 18 paths in `provenance.json` (verified to match `git status --porcelain` exactly — no extra file was touched)
- Repo HEAD at review: `5d1fc9104337786c3ef295ec0dc31656df371d8d`, worktree dirty with this run's changes
- Reviewer: security review pass (read-only on source; nothing outside `.sdlc/runs/<run-id>/` was written)

## Tooling note (enumeration honesty)

`Glob` and `Grep` were not available on this build. Every search below was run through `Bash`
(`git diff`, `git show HEAD:<path>`, `grep -rn`, `find`, `node -e`). Where a check could not be
executed empirically it is labelled **static analysis only** rather than reported as a pass.
One check — the PostgreSQL runtime behaviour in Finding 1 — could not be executed: no PostgreSQL
instance is reachable from this environment (`pg_isready` absent, no Docker). That finding's
*failure mode* is derived statically from the `node-postgres` parameter path and the Hono
`app.onError` handler, and is marked accordingly.

---

## 1. Verdict

**`pass-with-findings`** — authorization is byte-identical to HEAD, the migration is additive and
production-safe, no PII or secret is introduced, and the new UI has no injection sink; the single
substantive finding is an unbounded upper value on `wipLimit` that lets an *already-authorized*
workspace member turn a should-be-400 into a 500.

Nothing here blocks the merge.

---

## 2. Findings

### F-1 — `wipLimit` has no upper bound, so an out-of-range value becomes a 500 instead of a 400

- **Severity: low**
- **Location:** `apps/api/src/column/index.ts:63` (POST) and `apps/api/src/column/index.ts:141-143` (PUT); backing column `apps/api/src/database/schema.ts:360`
- **Description:** the validator is
  `v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)))` with no `v.maxValue()`. The
  destination column is PostgreSQL `integer` (max `2147483647`). I executed the schema directly
  against the repo's own valibot build to confirm which values pass:

  | input | valibot accepts |
  |---|---|
  | `1` | yes |
  | `2147483647` | yes (last in-range value) |
  | `2147483648` | **yes — out of range for `integer`** |
  | `4294967296` | **yes — out of range** |
  | `9007199254740991` (`MAX_SAFE_INTEGER`) | **yes — out of range** |
  | `1e308` | **yes — `Number.isInteger(1e308)` is `true`** |
  | `Infinity` / `NaN` / `-1` / `1.5` / `"5"` | no (correctly rejected) |

  So validation passes and the value reaches `db.insert(...)` / `db.update(...)`.
- **What actually happens (static analysis only — no DB was reachable to execute this):**
  `node-postgres` stringifies the numeric parameter, so PostgreSQL receives `"2147483648"` and
  raises `22003 numeric_value_out_of_range`, or receives `"1e+308"` and raises
  `22P02 invalid_text_representation`. Neither is an `HTTPException`, so it falls through to the
  global handler at `apps/api/src/index.ts` (`app.onError`), which returns a fixed
  `{"message":"Internal Server Error"}` with status 500 and calls `Sentry.captureException`.

  Therefore, concretely: **not a crash** (Hono catches it; the process survives and the request
  is isolated), **not a schema leak** (the response body is a constant string — no driver text,
  no SQL, no column names reach the client), **not a persistence problem**
  (`create-column.ts` performs a single `INSERT` as its last statement, so a failure leaves no
  partial row; `update-column.ts` is a single `UPDATE`). It is a **500 that should have been a
  400**, plus a low-value error-reporting sink: if the operator has configured a Sentry DSN, the
  drizzle error captured there may carry the offending query text and parameter — a value the
  attacker supplied themselves, so it discloses nothing they did not already know.
- **Exploitability in this deployment model:** **minimal, and I want to be plain about why.**
  The caller must already be an authenticated member of the workspace *and* hold
  `project: ["update"]` — i.e. someone who can already rename, recolour, reorder and **delete**
  every column in the project. Someone with that authority does not need a 500 to cause trouble.
  There is no amplification: one request, one failed statement, one 500, no resource exhaustion,
  no lock held, no unbounded allocation. This is a robustness and error-contract defect, not a
  privilege or availability issue, and it should not be inflated into one.
- **Remediation:** add the upper bound so the rejection happens in the validator, matching the
  storage type. In both routes:
  ```ts
  v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2147483647))
  ```
  A tighter product cap (e.g. `v.maxValue(9999)`) would be more defensible still — a WIP limit
  above four digits is meaningless for the feature — and would keep the UI's `w-16` input honest.
  Add a matching case to `tests/api/column/wip-limit-validation.test.ts` (see F-2).

### F-2 — the validation test suite does not cover the upper bound

- **Severity: info**
- **Location:** `tests/api/column/wip-limit-validation.test.ts:36-128`
- **Description:** the suite covers `5`, omitted, `0`, `-1`, `2.5`, `"5"` and `null`. It does not
  assert anything about `2147483648`, `MAX_SAFE_INTEGER` or `1e308`. That absence is exactly why
  F-1 survived into the run. This is a test-coverage gap, not a vulnerability.
- **Exploitability:** none directly.
- **Remediation:** when F-1 is fixed, add
  `it("rejects wipLimit 2147483648 with 400")` and a `1e308` case to the same suite. They will
  fail today and pass after the `maxValue` is added, which is the property you want from a
  regression test.

### F-3 — the validator runs before the authorization guard on both mutating routes

- **Severity: info (pre-existing repo pattern, not introduced by this run)**
- **Location:** `apps/api/src/column/index.ts:55-67` and `133-147`
- **Description:** Hono composes middleware in argument order, so `validator("json", ...)`
  executes before `workspaceAccess.*` and `requireWorkspacePermission`. A caller with no access to
  the target workspace who sends a malformed body receives `400` rather than `403`/`404`. This is
  an oracle only in the weakest sense: the 400 is produced purely from the request body and
  discloses nothing about whether the project or column exists, who owns it, or what its schema
  is. Critically for this review, **this ordering is unchanged from HEAD** — I diffed the guard
  and validator lines against `git show HEAD:apps/api/src/column/index.ts` and the sequence is
  identical on all five routes (see checklist item 1). It is also the pattern used by the
  untouched `reorder` and `delete` routes.
- **Exploitability:** none meaningful.
- **Remediation:** none required for this run. If the repo ever standardises on guards-before-
  validators it should be done across all routers at once, not smuggled into a feature branch.

### F-4 — `workspaceAccess.fromColumn("id")` falls back to a caller-supplied `?workspaceId=`

- **Severity: low (pre-existing, out of scope — see §5)**
- **Location:** `apps/api/src/utils/workspace-access-middleware.ts:347-353`, with the swallowed
  error path at `:273-276`
- **Description:** `fromColumn` is configured with two sources: the column→project→workspace
  lookup, and a fallback `{ type: "query", key: "workspaceId" }`. If the lookup returns `null` —
  which happens both when the column id does not exist *and* when the database query throws, since
  `lookupWorkspaceId` catches and returns `null` — the middleware falls through to the query
  string, validates the caller against a workspace they legitimately belong to, and calls `next()`.
  In practice the handler then hits `updateColumn`'s own `findFirst`/404 guard, so no cross-
  workspace write occurs. I am recording it because the pattern (authorize against A, act on B) is
  the exact class of bug the file's own comment at `:69-73` was written to prevent for the
  body-vs-query case, and the query fallback reintroduces a weaker version of it.
- **Exploitability:** no exploit found. The 404 in `update-column.ts` closes it for the routes in
  scope.
- **Remediation:** out of scope here. If addressed later, distinguish "column not found" from
  "lookup failed" and fail closed on the latter rather than falling through.

### F-5 — production dependency audit reports 7 high / 4 moderate advisories

- **Severity: medium as a repo posture item; out of scope as a gate for this run**
- **Location:** `pnpm-lock.yaml` (untouched by this run)
- **Description:** `pnpm audit --prod --json` completed successfully and reports
  `{ critical: 0, high: 7, moderate: 4, low: 0, info: 0 }` across 1220 production dependencies:
  `fast-uri` (4 high — SSRF and host-confusion, `<3.1.6`), `nanoid` (high, `<3.3.18`),
  `deepmerge-ts` (high, `<8.0.0`), `mysql2` (high — auth-plugin downgrade leaking plaintext
  credentials, `<3.22.0`; plus a moderate zlib issue), `qs` (2 moderate), `@tiptap/core`
  (moderate — prototype-pollution via `mergeAttributes`).
- **Attribution:** **none of these is introduced by this run.** `git status --porcelain` and
  `git diff --stat -- package.json pnpm-lock.yaml '*/package.json'` both show the dependency
  manifests and lockfile are untouched. Under the brownfield rule these are advisory and do not
  gate Gate 3. They are recorded here so the number is not lost.
- **Remediation:** schedule a `deps`-intent run. `fast-uri` and `nanoid` are transitive and should
  lift with a lockfile refresh; `mysql2` is worth confirming is even reachable in a PostgreSQL-only
  deployment.

### F-6 — `canManageProjects()` gates the UI while the API enforces `project: ["update"]`

- **Severity: info**
- **Location:** `apps/web/src/components/project/column-editor.tsx:36-37, 335`
- **Description:** the new WIP-limit `Input` uses `disabled={!canEdit}` where
  `canEdit = canManageProjects()`. The server requires `project: ["update"]`. These are not
  guaranteed to be the same predicate, so the UI could in principle disable the field for someone
  the API would allow, or vice versa. This is **exactly the pattern already used by every other
  control in the same editor** (rename at `:253`, done-toggle at `:303`, icon at `:377`, delete at
  `:381`), so the new field introduces no new inconsistency. Per AGENTS.md the direction that
  matters — API-as-authority — holds: bypassing the disabled input still lands on
  `requireWorkspacePermission({ project: ["update"] })`.
- **Exploitability:** none. The failure mode is a cosmetically-enabled input that gets a 403.
- **Remediation:** none for this run.

---

## 3. Threat model delta

**Essentially none.** I want to justify that rather than pad it.

The change adds one nullable `integer` column, threads it through two already-guarded mutating
routes and one already-guarded read route, and renders it as a number in an authenticated view.
Specifically:

- **No new route, no new verb, no new role.** Nothing in `@kaneo/permissions` changed. The set of
  reachable endpoints is identical to HEAD.
- **No new authentication surface.** `api.route("/column", column)` is mounted *after* the
  `api.use("*", ... authenticateApiRequest ...)` middleware in `apps/api/src/index.ts:572-600`,
  and the pre-auth allowlist in that middleware covers only `/api/mcp`, `/api/.well-known/` and
  `/api/billing/webhook`. Every column route, including the read, requires a session or API key.
- **No new data class.** The field is a small positive integer describing process policy. It is
  not free text, not user-identifying, not a credential, and cannot carry an attacker-chosen
  string. There is no new value that could be reflected anywhere.
- **No new egress.** No `publishEvent()` was added (`grep -rn "publishEvent" apps/api/src/column/`
  returns nothing), no logging was added (no `console.log`/`logger` in the same directory), no
  WebSocket payload was touched, and `grep -rn "wipLimit\|wip_limit"` across `apps/api/src`,
  `packages/` and `apps/web/src` shows the field appears in exactly the changed files — it reaches
  no MCP tool, no webhook, no integration payload.
- **No new unauthenticated exposure.** This was the one place the field *could* have leaked, and
  it does not: the public board is served by `getPublicProject` → `getTasks`, and `getTasks`
  constructs its `columns` array with an explicit five-field projection
  (`apps/api/src/task/controllers/get-tasks.ts:224-237`: `id`, `slug`, `name`, `icon`, `isFinal`,
  `tasks`). `wipLimit` is not in it. The `select *` that *does* pick up the new field is
  `get-columns.ts`, which is only reachable through the guarded `GET /column/:projectId`.

The only genuinely new thing an attacker can do that they could not do at HEAD is submit an
integer that PostgreSQL rejects — and only if they are already a workspace member with
`project:update`. That is F-1, and it is a 500 rather than a 400.

One second-order note, recorded for completeness rather than as a finding: `ColumnHeader` now
issues a `useGetColumns(project?.id ?? "")` query it did not issue before, so the authenticated
board makes one additional `GET /column/:projectId` request per mount. The hook is
`enabled: !!projectId` so it does not fire on an empty id, the response is React-Query-cached per
`["columns", projectId]`, and the endpoint is guarded. No security consequence; noted because it
is the only new outbound request in the diff.

---

## 4. Checklist results

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Authorization genuinely unchanged | **pass** | Extracted every route/validator/guard line from `git show HEAD:apps/api/src/column/index.ts` and from the working copy and compared. Sequences are identical on all five routes, only line offsets shift: GET `validator(param) → fromProject`; POST `validator(param) → validator(json) → fromProject → requireWorkspacePermission({project:["update"]})`; PUT `/reorder` and PUT `/:id` and DELETE likewise, with `fromColumn("id")` on the latter two. No guard moved, none was dropped, none was reordered relative to the validator. The `wipLimit` additions sit strictly inside the `v.object({...})` bodies. |
| 2 | No new IDOR or cross-workspace leak | **pass** | `get-columns.ts` is `select *` so it does return `wipLimit`, but it is reachable only via `GET /column/:projectId` behind `authenticateApiRequest` + `workspaceAccess.fromProject`, both unchanged. Public surface confirmed clean: `getTasks` projects columns to an explicit field list that omits `wipLimit` (`get-tasks.ts:224-237`), so `/api/public-project/:id` cannot return it. `apps/web/src/components/public-project/**` contains no `ColumnHeader` reference — `grep -rn "ColumnHeader" apps/web/src` shows its only consumer is `kanban-board/column/index.tsx`. Every other `columnTable` reader (github/gitea `resolve-column`, discord `events`, task-service) uses explicit projections or consumes only `slug`/`name`; no full column row is spread into an outbound payload (`grep` for `...column` / `...targetColumn` / `...columnById` across `plugins/`, `ws/`, `events/` returns nothing). |
| 3 | Input validation | **fail → F-1** | Executed the exact schema against the repo's valibot: `2147483648`, `4294967296`, `MAX_SAFE_INTEGER` and `1e308` all pass validation and reach a PostgreSQL `integer` column. `Infinity`, `NaN`, `-1`, `1.5`, `"5"` are correctly rejected (`Infinity` by `v.integer()`, since `Number.isInteger(Infinity)` is false — but `Number.isInteger(1e308)` is **true**, which is what lets `1e308` through). Resulting failure characterised in F-1: a clean 500 with a constant `{"message":"Internal Server Error"}` body, no schema leak, no crash, no partial write. |
| 4 | Migration safety | **pass** | `apps/api/drizzle/0043_gifted_lizard.sql` is one statement: `ALTER TABLE "column" ADD COLUMN "wip_limit" integer;`. Nullable, no `DEFAULT`, no `NOT NULL`, no backfill, no index, no constraint, no data movement, nothing destructive. On PostgreSQL 11+ this is a catalog-only change — it takes a brief `ACCESS EXCLUSIVE` lock but performs no table rewrite, so it is safe against a populated production table. `_journal.json` gains a single well-formed entry (`idx: 43`, `tag: 0043_gifted_lizard`) appended after `0042`; no existing entry was altered. |
| 5 | Data exposure / PII | **pass** | New field is a nullable `integer` — no free-text, no user-identifying data, no new string reaching any sink. `grep -rn "publishEvent\|console.log\|logger" apps/api/src/column/` returns nothing, confirming no `publishEvent()` was added (correct: a WIP limit is column configuration, not task activity). No WebSocket payload, event schema, or MCP tool touched — confirmed by the repo-wide `wipLimit` grep, which lands only in the changed files. Matches `requirements.md` §5. |
| 6 | Client-side trust boundary | **pass** | `disabled={!canEdit}` on the input is presentation-only; there is no client-side authorization decision that the server does not repeat. A caller bypassing the UI reaches `PUT /column/:id` → `workspaceAccess.fromColumn("id")` → `requireWorkspacePermission({ project: ["update"] })` (`apps/api/src/column/index.ts:146-147`), which resolves the role from `workspaceRoleTable`/`builtInRoles` server-side. AGENTS.md's "hiding an action in the UI is not an authorization check" is satisfied. Cosmetic predicate mismatch recorded as F-6. |
| 7 | XSS / injection in new UI | **pass** | i18next is initialised with `interpolation: { escapeValue: false }` (`apps/web/src/lib/i18n/index.ts:49-50`) — the standard and correct React setting, because React escapes at render. The interpolated results go to (a) the `title` prop, (b) the `aria-label` prop, and (c) a text child inside `<span className="sr-only">`. All three are escaped by React: props become attribute values via `setAttribute`, children become text nodes. `${taskCount}/${wipLimit}` is template-interpolated from two numbers. `grep -niE "dangerouslySetInnerHTML|<Trans"` over both changed components returns nothing, and neither imports `Trans`. The user-controlled `col.name` in `wipLimitAria` therefore cannot break out of the `aria-label` — there is no HTML-rendering path for it to reach. |
| 8 | Secrets | **pass** | Ran `grep -niE "dangerouslySetInnerHTML\|<Trans\|api[_-]?key\|secret\|password\|token\|postgres(ql)?://\|BEGIN (RSA\|PRIVATE)\|sk-[a-zA-Z0-9]\|Bearer [A-Za-z0-9]"` across all 18 changed paths. Zero credential hits. The `i18n/en-US.json` hits are pre-existing UI labels ("Show password", "Password is too short"). The `0043_snapshot.json` hits are *column names* (`access_token`, `refresh_token`, `id_token`) in the `account` table's schema metadata, not values — I parsed the file and confirmed its top level is `{id, prevId, version, dialect, tables, enums, schemas, sequences, roles, policies, views, _meta}` and that every `"default"` in it is a literal like `now()`, `true`, `0`, `'image'`. The new entry is `{"name":"wip_limit","type":"integer","primaryKey":false,"notNull":false}`. `.env` is gitignored (`git check-ignore -v .env` → `.gitignore:9`) and was not modified. |
| 9 | Dependency risk | **pass (no delta) / advisory** | `git status --porcelain` lists only the 18 in-scope paths plus untracked `.sdlc/`, `.hook-logs/`, `.claude/settings.local.json`. `git diff --stat -- package.json pnpm-lock.yaml '*/package.json'` is empty and no lockfile appears as untracked. No dependency was added, removed or bumped. `pnpm audit --prod` was run and its pre-existing results are recorded as F-5. |
| 10 | Test files as a surface | **pass** | The three `vi.mock` calls in `tests/api/column/wip-limit-validation.test.ts:7-21` are hoisted per-module by Vitest and scoped to that file's module graph; they never enter a build (`tests/` is outside both app builds) and cannot affect a production code path. Grepping all four new test files for `postgres`, `DATABASE_URL`, `localhost:5432`, `password`, `token`, `secret` and `process.env` returns **zero** matches — no real credential, no real database, no environment read. The API tests drive `column.request(...)` in-process with mocked controllers; the component test mocks `useGetColumns` and the create-task modal. Coverage gap recorded as F-2. |

---

## 5. Explicitly out of scope

- **The rest of the repository.** Per the brownfield rule this review covers only the 18 paths in
  `provenance.json`. I did read `apps/api/src/index.ts`, `utils/workspace-access-middleware.ts`,
  `utils/require-workspace-permission.ts`, `task/controllers/get-tasks.ts`,
  `column/controllers/get-columns.ts` and `lib/i18n/index.ts` — but **as evidence about the changed
  files**, to establish where `wipLimit` can and cannot travel. Findings originating in those files
  (F-3, F-4) are recorded as advisory and do not gate this run.
- **The generic checklist's PII-encryption section** (`government_id`, `bank_account`,
  `salary_base`, role-based response masking, audit-log append-only semantics, actor/target/
  request_id capture). None of these fields or tables exists in this codebase, and this run
  introduces no PII, no serializer, and no audit-log write. There was nothing to trace.
- **Authentication primitives** — JWT secret sourcing, password hashing cost factor, session
  handling. All are owned by Better Auth and none was touched by this run.
- **Helmet, rate limiting, and the global error filter as repo-posture items.** I inspected
  `app.onError` only far enough to characterise F-1's response body (it returns a constant string
  and does not leak driver detail). Whether the repo has Helmet or auth-endpoint rate limiting is a
  whole-repo question this brownfield scope does not cover, and I did not enumerate it — so I am
  making **no claim** either way rather than reporting a pass I did not earn.
- **`.env.example`.** `find -maxdepth 3` located no `.env.example` anywhere in the repo; AGENTS.md
  points to `ENVIRONMENT_SETUP.md` instead. Pre-existing, unrelated to this run, not assessed.
- **Runtime confirmation of F-1.** No PostgreSQL instance is reachable from this environment
  (`pg_isready` not installed, Docker unavailable), so the 22003/22P02 → 500 path is derived
  statically from the `node-postgres` parameter-stringification path and the Hono error handler,
  not observed. The valibot half of F-1 *was* executed and is empirical.
- **Product-level correctness of the indicator** (stale counts, filtered task counts). Covered by
  the senior review's N-1/N-2; not a security question.

---

## 6. Required fixes before sign-off

**None block the merge.**

Recommended, in priority order:

1. **F-1** — add `v.maxValue(2147483647)` (or a tighter product cap) to both `wipLimit` validators
   so an out-of-range value is a 400 from the validator rather than a 500 from the driver.
2. **F-2** — add upper-bound cases to `tests/api/column/wip-limit-validation.test.ts` alongside
   the fix.
3. **F-5** — schedule a separate `deps`-intent run for the 7 high advisories. Not this run's debt.

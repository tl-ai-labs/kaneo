# Security Review — brownfield (feature-extend: column `wipLimit`)

Run: `20260821-094808-feature-extend-lane-wip-limit`
Scope: files listed in `.sdlc/runs/20260821-094808-feature-extend-lane-wip-limit/provenance.json` (21 entries), diffed against clean base `5d1fc910`.

## 1. Verdict

**PASS (with observations).**

Risk statement: this change adds a nullable, advisory `int4` column reachable only through two
already-authenticated, already-permission-gated routes, with a Valibot bound that closes the
int4-overflow-to-500 path; no new authorization vocabulary, no new dependency, no secret, and no
`wipLimit`-proportional allocation on either client or server. The only genuine decision to
acknowledge is that `wipLimit` now rides along on the board projection consumed by the
unauthenticated `GET /api/public-project/:id` route — low impact and, in my read, acceptable.

Tooling note: `Glob`/`Grep` were absent from this build's tool surface, so all enumeration was done
with `Bash` (`git status`, `git diff`, `grep -rn`, `ls`). Every "absent" claim below is backed by a
command that actually ran and returned. Where I could not run something (the test suite), I say so
explicitly rather than inferring a pass.

## 2. Findings

| id | Severity | Title | file:line | Evidence | Recommendation |
|---|---|---|---|---|---|
| F-1 | low | `wipLimit` is served to unauthenticated viewers of a public project | `apps/api/src/task/controllers/get-tasks.ts:230` | The board projection is an explicit field allowlist; `wipLimit: column.wipLimit` was added to it. `getPublicProject()` (`apps/api/src/project/controllers/get-public-project.ts:5`) calls the same `getTasks()` and returns `result.data` wholesale; its route `api.get("/public-project/:id", ...)` is registered at `apps/api/src/index.ts:243`, ahead of the auth middleware at `apps/api/src/index.ts:574`, so it is genuinely anonymous. | Accept, or gate the field on `project.isPublic` if leaking team-process metadata is undesirable. Impact is honestly low: an anonymous viewer of a board already sees every column, every task and therefore the exact task count; the limit adds only the team's own target. Not a blocker. |
| F-2 | info | Body validation runs before the authz middleware, so a caller without `project:update` learns body-shape validity before being refused | `apps/api/src/column/index.ts:56-67` and `:134-145` | Chain order is `validator("param") → validator("json") → workspaceAccess → requireWorkspacePermission`. A workspace member lacking `project:update` who sends `{wipLimit: 2.5}` receives 400, not 403. | No action for this ticket. This is the pre-existing repo-wide ordering (identical for `name`/`icon`/`color` and for the reorder route), the change did not alter it, and the disclosure is a schema fact already published in the public OpenAPI document. |
| F-3 | info | Migration metadata was re-serialized with 2-space indentation while the repo's drizzle meta files use tabs, producing a 619-line diff on `_journal.json` | `apps/api/drizzle/meta/_journal.json`, `apps/api/drizzle/meta/0043_snapshot.json` | `od -c` shows the new journal and `0043_snapshot.json` start `{\n␠␠"…` whereas `0042_snapshot.json` starts `{\n\t"…`. Semantics are intact: journal has 44 entries ending at `idx: 43 / 0043_conscious_gambit`, `0043.prevId === 0042.id`, and the only table differing from the 0042 snapshot is `public.column`, with exactly `{'wip_limit'}` added and nothing removed. | Cosmetic/reviewability only — it inflates the diff and hints the files were written by a generic JSON serializer rather than `drizzle-kit generate`. Consider regenerating with `pnpm --filter @kaneo/api db:generate` so the whitespace matches, but nothing here is unsafe to ship. |
| F-4 | info | Integration tests cover role-based refusal but not cross-workspace isolation for the new field | `tests/api-integration/column-wip-limit.test.ts:244` | There is a `member`-role 403 case; there is no case where a user of workspace B targets a column in workspace A. | Add a cross-tenant case in a follow-up. The control itself is sound (see threat answer 5) — this is coverage, not a defect. |
| F-5 | info (pre-existing, out of scope) | `pnpm audit --prod` reports 2 high advisories, both transitive under `better-auth` | `pnpm-lock.yaml` (unmodified) | `nanoid <3.3.18` GHSA-2v37-7h3g-55p8 via `apps__api>better-auth>vitest>vite>postcss>nanoid`; `deepmerge-ts <8.0.0` GHSA-ggr8-5vv4-36mx via `apps__api>better-auth>prisma>@prisma/config>deepmerge-ts`. 0 critical. | Not introduced by this run — no `package.json` or `pnpm-lock.yaml` was modified (`git status --porcelain -- '*package.json' 'pnpm-lock.yaml'` returned empty). Advisory only; does not gate this run. |

No critical, high, or medium findings.

## 3. Threat question answers

### 1. Authorization — middleware chain intact, no new vocabulary

Not weakened, not reordered, not bypassed. `apps/api/src/column/index.ts:66-67` (POST) and `:144-145`
(PUT) still read `workspaceAccess.fromProject("projectId")` / `workspaceAccess.fromColumn("id")`
followed by `requireWorkspacePermission({ project: ["update"] })`; the diff against HEAD touches only
the validator object and the destructuring line in each route. All column routes are mounted at
`apps/api/src/index.ts:608`, i.e. *after* the blanket authentication middleware at
`apps/api/src/index.ts:574`, so authentication is unconditional for both.

`packages/` is untouched — `git status --porcelain -- packages/ charts/ apps/docs apps/site` returns
empty. No new permission string was introduced; the field reuses `project:update`.

**Can `wipLimit` be written through a less-protected path?** No. I enumerated every `columnTable`
reference in the API (`grep -rn "columnTable" apps/api/src`). Only four sites write to the table:
- `apps/api/src/column/controllers/create-column.ts:81` (`insert`) — behind the guarded POST;
- `apps/api/src/column/controllers/update-column.ts:25` (`update`) — behind the guarded PUT;
- `apps/api/src/column/controllers/reorder-columns.ts:12` (`update`) — sets `position` only;
- `apps/api/src/project/controllers/create-project.ts:46` and
  `apps/api/src/migrations/column-migration.ts:57` (`insert`) — server-side seeding of default
  columns; neither accepts nor sets `wipLimit`, so seeded columns get SQL `NULL`.

Every other reference is a read. No plugin, webhook, scheduler or MCP path writes the column.

### 2. Input validation / injection — out-of-range is a 400, never a PostgreSQL 500

The shared schema (`apps/api/src/column/controllers/create-column.ts:22-27`) is
`v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2147483647))`, wired into both routes as
`v.optional(v.nullable(wipLimitSchema))`.

I did not reason about Valibot's semantics — I executed the exact schema against the repo's own
installed `valibot` and recorded the result:

| input | result |
|---|---|
| omitted | ACCEPT (key absent from output) |
| `null` | ACCEPT |
| `1`, `2147483647` | ACCEPT |
| `0`, `-1`, `-0` | REJECT (`Expected >=1`) |
| `2147483648`, `1e300`, `Number.MAX_SAFE_INTEGER` | REJECT (`Expected <=2147483647`) |
| `2.5` | REJECT (`Invalid integer`) |
| `NaN` | REJECT (`Expected number but received NaN`) |
| `Infinity`, `-Infinity` | REJECT (`Invalid integer`) |
| `"5"` (numeric string) | REJECT (`Expected number`) |
| `true`, `[5]` | REJECT (`Expected number`) |

So floats are explicitly rejected, `-0` is rejected via the `minValue` gate, `NaN` fails `v.number()`
itself, and nothing above the int4 ceiling reaches PostgreSQL — the `integer out of range` 500 path is
closed. `tests/api-integration/column-wip-limit.test.ts:150-165` asserts 400 for `[0, -1, 1.5,
2147483648, "5"]` *and* that the previously stored value is unchanged.

Defence in depth beyond that: `db.update()`/`db.insert()` are parameterized Drizzle builders (no
string interpolation on this path), and even a hypothetical driver error would be sanitized —
`app.onError` at `apps/api/src/index.ts:156-165` returns a bare
`{ message: "Internal Server Error" }` for anything that is not an `HTTPException`.

**No mass-assignment via this body.** I probed Valibot's `v.object()` with extra keys
(`projectId`, `slug`, `position`, `id`) and confirmed it strips them: output was
`{"name":"x","wipLimit":5}`. Independently, `update-column.ts:26-31` builds its `set()` payload from
explicit per-field conditional spreads rather than spreading `data`, so an unknown key could not
reach the table even if the validator passed it.

**No path skips the validator.** The only two entry points to `createColumn`/`updateColumn` are the
two validated routes (`grep -rn "createColumn\|updateColumn"` across `apps/api/src` resolves to the
controllers and `column/index.ts`).

### 3. Data exposure — one anonymous surface, low sensitivity

- **Public project view:** yes, exposed. See F-1. Rating it low rather than medium is deliberate:
  the same anonymous response already carries every task in the column, so the count is derivable;
  the limit adds only the team's stated target.
- **Websockets / events:** not exposed. `grep -rn "publishEvent" apps/api/src/column/` returns
  nothing — column mutations publish no event, so nothing new crosses the WS or Redis fan-out.
- **MCP:** no new exposure. `apps/api/src/mcp/tools.ts:797-805` (`list_project_columns`) proxies
  `GET /api/column/:projectId`, which does a `select()` (all columns) at
  `apps/api/src/column/controllers/get-columns.ts:6-10` and is guarded by
  `workspaceAccess.fromProject`. The field is visible to workspace members who could already read the
  column row.
- **OpenAPI:** the request-body schema for `createColumn`/`updateColumn` now documents `wipLimit`.
  `GET /api/openapi` is registered at `apps/api/src/index.ts:438`, ahead of the auth middleware, so
  the spec is public — but that is the intended purpose of a published API document and the field is
  not sensitive. Responses are declared `resolver(v.any())`, so nothing new appears there.
- **Logs:** no logging statement was added in any changed file.
- **Exports:** `apps/api/src/task/controllers/import-tasks.ts` and the export paths touch tasks, not
  column metadata; unchanged by this run.

### 4. Denial of service — nothing scales with `wipLimit`

Confirmed by reading both components and by
`grep -nE "Array\.from|new Array|\.repeat\(|for \(|\.map\(|while \("` over them.

- `apps/web/src/components/kanban-board/column/column-header.tsx:63-91` renders the value as a single
  interpolated string, `` {`${taskCount} / ${wipLimit}`} ``, plus one conditional `AlertTriangle`
  icon. There is no segmented progress bar, no array construction, no loop. A limit of `2147483647`
  renders as ten glyphs.
- The only `for` loop in that file (`:42`) iterates `archivedColumn.tasks` and predates this change.
- `apps/web/src/components/project/column-editor.tsx:379-412` renders one `<Input type="number">`;
  its `map` calls (`:258`, `:302`, `:463`) iterate columns and icons, never the limit.
- Server side, `wipLimit` is a scalar passed to an insert/update — no iteration.

The accepted `2147483647` is therefore inert, which is exactly what you want from a bound chosen for
type-safety rather than for resource control.

### 5. Multi-tenant isolation — enforced by the column lookup, not by the caller

`workspaceAccess.fromColumn("id")` resolves the tenant from the *stored row*, not from anything the
caller supplies: `apps/api/src/utils/workspace-access-middleware.ts:240-252` selects
`projectTable.workspaceId` by joining `columnTable → projectTable` on
`eq(schema.columnTable.id, id)`. A cross-tenant `PUT /api/column/:id` therefore resolves to the
*victim's* workspace id, and `requireWorkspacePermission({ project: ["update"] })` then evaluates the
attacker's membership in that workspace — which does not exist — and refuses. On lookup failure the
middleware returns `null` (`:251`, and the catch at `:272-274`), which denies rather than falls open.

For create, `workspaceAccess.fromProject("projectId")` performs the equivalent resolution from the
path parameter. `updateColumn` additionally 404s on a non-existent column
(`apps/api/src/column/controllers/update-column.ts:20-22`), but that is reached only after the guards.

Reads are equally scoped: `getColumns` filters on `projectId` and its route carries
`workspaceAccess.fromProject`. So: no, a user cannot set or read a `wipLimit` outside their
workspace. F-4 notes only that this specific isolation case is untested, not that it is unenforced.

### 6. Migration safety — pure additive, safe on a populated table

`apps/api/drizzle/0043_conscious_gambit.sql` is exactly one statement:

```sql
ALTER TABLE "column" ADD COLUMN "wip_limit" integer;
```

No `NOT NULL`, no `DEFAULT`, no backfill, no `UPDATE`, no index, no constraint, no type change, no
data rewrite. A nullable `ADD COLUMN` without a default is a catalog-only operation in PostgreSQL —
it takes a brief `ACCESS EXCLUSIVE` lock and returns without touching heap pages, so it is safe
against a large populated `column` table. Existing rows read back as `NULL`, which the API surfaces as
"no limit" and which the web layer normalizes with `column.wipLimit ?? null`
(`column-header.tsx:30`). Rollback is a plain `DROP COLUMN`.

Journal/snapshot were **generated, not hand-authored, in substance** — but re-serialized in
formatting. Verified programmatically: `_journal.json` is version 7 / postgresql with 44 entries
ending in `{"idx": 43, "tag": "0043_conscious_gambit", "breakpoints": true}`; `0043_snapshot.json`
has `prevId === 0042_snapshot.id`; diffing the two snapshots table-by-table, `public.column` is the
*only* table that differs, and within it exactly one column was added:
`{"name": "wip_limit", "type": "integer", "primaryKey": false, "notNull": false}`. Nothing was
silently dropped or mutated. The whitespace discrepancy is F-3.

### 7. Client-side trust — the input attributes are convenience only

`min={1} max={2147483647} step={1} type="number"` on `column-editor.tsx:383-386` are UI affordances.
Stripping them in devtools changes nothing server-side: the value still traverses
`handleWipLimitChange` → `updateColumn` fetcher → `PUT /api/column/:id` → the Valibot validator
proven in answer 2. The implementation is honest about this — the comment at
`column-editor.tsx:141-143` states "The API re-validates; this is a convenience, not the enforcement
point."

The client-side `/^\d+$/` test (`:144`) is a reasonable pre-filter: without the `u` flag `\d` is
ASCII-only, so non-ASCII digits do not slip through, and it rejects the signs/exponent/decimal forms
that `Number()` would otherwise coerce. Leading zeros (`"007"` → `7`) are accepted, which is correct
behaviour, not a bypass.

Similarly, `disabled={!canEdit}` on the input (`:388`) is presentation; the real gate is
`requireWorkspacePermission({ project: ["update"] })`, and
`tests/api-integration/column-wip-limit.test.ts:244-255` demonstrates a `member`-role user getting a
403 with the stored value left at `null`.

### 8. Secrets and dependencies — clean

- Secret scan over every added line of the diff
  (`git diff HEAD -- . | grep -nE "^\+.*((api[_-]?key|secret|password|token|credential)[ \t]*[:=][ \t]*['\"][a-zA-Z0-9])"`)
  returned nothing.
- The four new test files contain no credential-like strings; the only hits for a
  `password|secret|token|api_key|postgres://`-style scan were three `toMatch(/destructive/)` CSS-class
  assertions in `column-header.test.tsx`.
- No internal field was introduced — `wipLimit` is user-configurable product data, and the board
  projection remains an explicit allowlist rather than a row spread.
- **No dependency was added.** `git status --porcelain -- '*package.json' '*/package.json'
  'pnpm-lock.yaml'` returns empty. `pnpm audit --prod`: 0 critical, 2 high, both pre-existing
  transitives under `better-auth` (F-5).

## 4. Explicitly cleared

Checked and genuinely fine:

- Both column route middleware chains, verified line-by-line against the HEAD diff — order preserved,
  guards present on POST, PUT, PUT /reorder and DELETE.
- Authentication is unconditional for `/api/column/*` (mounted at `index.ts:608`, after the
  `api.use("*")` authenticator at `index.ts:574`).
- `packages/permissions`, `packages/libs`, `packages/mcp`, `charts/`, `apps/docs`, `apps/site` — all
  untouched.
- Exhaustive enumeration of `columnTable` writers across `apps/api/src`; no unguarded writer exists.
- Valibot bound behaviour under 17 hostile inputs, executed rather than assumed.
- Unknown-key stripping by `v.object()`, executed rather than assumed — no mass assignment.
- `updateColumn`'s conditional-spread `set()` payload: omitting `wipLimit` preserves the stored value;
  explicit `null` clears it; neither can touch `projectId`, `slug`, `position` or `id`.
- Global error handler sanitizes non-`HTTPException` failures to `Internal Server Error`.
- No `publishEvent` in the column module — no new data on events, WebSockets, or Redis fan-out.
- MCP `list_project_columns` reuses the permission-guarded columns route.
- No `wipLimit`-proportional allocation, iteration, or rendering on client or server.
- i18n: five new `settings:columnEditor.*` and two new `tasks:kanban.*` keys, all static, all in
  `i18n/en-US.json`. `escapeValue: false` is set (`apps/web/src/lib/i18n/index.ts:50`), but the
  interpolated `{{name}}` lands in a React `aria-label` attribute and `{{current}}`/`{{limit}}` are
  numbers — no `dangerouslySetInnerHTML` anywhere in the changed components, so React's own escaping
  applies and there is no XSS vector from a hostile column name.
- Web types flow from `InferResponseType` (`apps/web/src/types/project/index.ts:15-27`) — no `any`
  cast or parallel untyped request layer was introduced.
- Fixture repairs in the two pre-existing test files add only `wipLimit: null` to column fixtures;
  nothing else changed.
- Migration SQL, journal and snapshot chain, verified structurally as described in answer 6.

**Not verified — stated so I am not credited with coverage I do not have:** I could not execute the
test suites. `vitest` is not installed in this sandbox (`apps/api/node_modules/.bin` contains no
`vitest`; `pnpm vitest` fails with `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL`). My assertions about the 400
and 403 responses rest on reading the test source plus the directly executed schema probe, not on
observed green runs. The verify phase should confirm.

---

## 4b. Gate 3 dispositions (added by the orchestrator after human review)

### F-1 — ACCEPTED DISCLOSURE DECISION, closed

Exposing `wipLimit` anonymously through `GET /api/public-project/:id` was put to the user at Gate 3
and **accepted as intended**. Recorded reasoning, so a future reader knows this was decided rather
than overlooked:

> An anonymous viewer of a public project already sees every task in the column, and therefore
> already sees the count. The limit adds only the team's internal target. Excluding it would require
> forking or post-processing the shared board projection for marginal benefit.

This is no longer an open finding. Revisit only if public boards later stop exposing task lists.

### Correction to this run's own discovery phase

The security reviewer's tracing of the public path **falsified a claim made by this run's discovery
phase**. `discovery.md` states that `get-public-project.ts` "does not build a columns projection, so
the public path is unaffected." That is wrong. The controller delegates straight to `getTasks`:

```ts
import getTasks from "../../task/controllers/get-tasks";
const result = await getTasks(id);
```

so it inherits the column projection wholesale, including any field added at `get-tasks.ts:224-230`.
The security review is authoritative here and the discovery claim is retracted. Recorded because a
discovery-phase assertion that a code path is *unaffected*, later falsified by review, is a failure
mode worth surfacing: had no reviewer traced it, the run would have shipped believing the public
surface was untouched.

### F-3 — superseded

F-3's recommended fix (regenerate via `db:generate` so the meta files match the repo's tab
convention) is **incorrect**: `db:generate` is precisely what emitted 2-space JSON. The senior review
raised the same issue as blocker B1 with the correct fix — `npx biome format --write` on the two meta
files — which has been applied. `npx biome ci apps packages tests i18n scripts` now reports 0 errors.

---

## 5. Residual risk / follow-ups (out of scope for this ticket)

1. ~~**F-1 decision**~~ — **CLOSED at Gate 3**, accepted as intended. See §4b.
2. **F-4 test gap** — add a cross-workspace 403 case for `PUT /api/column/:id` to
   `tests/api-integration/`. The control is sound; the coverage is missing.
3. **F-3 drizzle meta formatting** — regenerate via `pnpm --filter @kaneo/api db:generate` so meta
   files match the repo's tab convention and future migration diffs stay reviewable.
4. **F-5 dependency advisories** — `better-auth`'s transitive `nanoid` and `deepmerge-ts` highs
   deserve their own ticket (bump `better-auth` or add a pnpm override). Pre-existing; does not gate
   this run.
5. The validator-before-authz ordering (F-2) is a repo-wide pattern. If it is ever worth changing, it
   is a global middleware-ordering ticket, not a column one.

Explicitly *not* recommended, per the ticket's stated non-goals: enforcing the limit, per-project or
per-workspace defaults, breach analytics or notifications, additional locales, or drag-and-drop
changes.

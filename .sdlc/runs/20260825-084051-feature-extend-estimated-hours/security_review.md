# Security review — feature-extend — estimated hours with per-lane rollup

Run: `20260825-084051-feature-extend-estimated-hours` · Mode: **brownfield, changed-files only**
Base: `feature-extend-2/opus-only` @ `5d1fc910` (working tree; the change is uncommitted)
Scope: the 44 paths in `changed-files.txt`, plus read-only tracing into the middleware, event and
MCP code they call.

**Isolation statement.** Nothing outside this branch's worktree and this run directory was read. No
`git diff <branch>`, no `git show <other-ref>`, no `git log --all`, no `git branch -a`, no
`dist/` / `build/` / `.turbo/`, no other `.sdlc/runs/*` directory. No source file was modified by
this review. Note: `apps/api/src/task/estimated-minutes.ts`, `apps/api/src/schemas.ts`,
`apps/web/src/components/task/estimate.ts` and `import-tasks.ts` were edited by another actor
*during* this review (the senior reviewer's nits N-3, N-4, N-5, N-6, N-8 being applied). All
findings below are against the current on-disk state, re-read after those edits.

---

## Verdict

**pass.** The change adds one nullable non-sensitive integer, one write route whose middleware chain
is link-for-link identical to its `/due-date/:id` sibling, and read/export projections behind
unchanged authorization. No blocking finding. Three low/info observations and two one-line
pre-existing notes follow.

---

## Findings

### Blocking

None.

### Non-blocking

| # | Sev | Location | Issue | Remediation |
|---|---|---|---|---|
| S-1 | info | `apps/api/src/task/controllers/import-tasks.ts:79`, `:92` | The import path's `publishEvent("task.created", { ...createdTask, ... })` spreads the freshly inserted row, which now carries `estimatedMinutes`, into the in-process event payload. Requirements §5 states the field is "not emitted to events" — that sentence is now inaccurate for this one path. **Exposure is nil**: every `task.created` consumer projects explicit fields — `ws/index.ts:321-335` forwards only `{projectId, taskId, type}`, `plugins/generic-webhook/events.ts:275-286` sends only `title/description/priority/status/number`, `activity/index.ts:173-183` and `notification/index.ts:162-188` destructure named fields. The value never leaves the process. | No code change needed. Correct the §5 wording to "not emitted to any outbound event, WebSocket or webhook payload" so a future consumer that spreads `data` does not inherit a false guarantee. |
| S-2 | info | `apps/api/src/schemas.ts:43`; `apps/api/src/search/index.ts:19` | `taskSchema` gained `estimatedMinutes: v.nullable(v.number())` — a **required** member. `search/index.ts:19` documents its response as `v.array(taskSchema)`, but `search/controllers/global-search.ts:203-222` and `:272-291` project an explicit field list that does not include it. The published OpenAPI now advertises a field the search endpoint never returns. `resolver()` is documentation-only, so there is no runtime effect. The schema was already misaligned with the search response for `position`, `number` and `description`, so this widens a pre-existing inaccuracy rather than creating one. | Either give search its own response schema, or leave as-is and record the known drift. AGENTS.md ("Public API behavior must retain accurate ... OpenAPI metadata") makes this worth a line in the run report. |
| S-3 | info | `apps/api/src/mcp/tools.ts:399`, `:414` | Requirements §5 says the field is "not exposed via MCP". No MCP tool changed, but `list_tasks` and `get_task` are thin proxies over `/api/task/tasks/:projectId` and `/api/task/:id` and return the JSON body verbatim, so `estimatedMinutes` does now appear in MCP tool output. The proxy carries the caller's own token and passes through the same `workspaceAccess` checks, so this is the same data to the same principal — no boundary is crossed. | Wording fix only: §5 should say "exposed through MCP only as a passthrough of the already-authorized task read, adding no new MCP capability." |

### Pre-existing, not introduced here (one line each, not gating)

- `apps/api/src/task/index.ts:413` — `GET /task/export/:projectId` is guarded by `workspaceAccess.fromProject("projectId")` alone, with no `requireWorkspacePermission`; any workspace member can export every task in a project. This change adds one more field to that payload but does not change who can call it.
- `pnpm audit --prod` reports 2 high advisories, both transitive dev-tooling chains under `better-auth` (`better-auth>vitest>vite>postcss>nanoid` GHSA-2v37-7h3g-55p8; `better-auth>prisma>@prisma/config>deepmerge-ts` GHSA-ggr8-5vv4-36mx). `package.json` and `pnpm-lock.yaml` are untouched by this run (`git status` on both is empty), so neither is attributable here.

---

## Authorization assessment

### (1) The middleware chain on `PUT /task/estimate/:id` — correct

Compared link-for-link against `/due-date/:id` (`apps/api/src/task/index.ts:585-616` vs `:619-655`):

| position | `/due-date/:id` | `/estimate/:id` |
|---|---|---|
| 1 | `describeRoute(...)` | `describeRoute(...)` :621 |
| 2 | `validator("param", v.object({ id: v.string() }))` :600 | same :635 |
| 3 | `validator("json", ...)` :601 | `validator("json", v.object({ estimatedMinutes: v.optional(v.nullable(v.number())) }))` :636-639 |
| 4 | `workspaceAccess.fromTask()` :602 | `workspaceAccess.fromTask()` :639 |
| 5 | `requireWorkspacePermission({ task: ["update"] })` :603 | identical :640 |
| 6 | `requireEntitlement` :604 | identical :641 |
| 7 | thin handler | thin handler :642-653 |

`workspaceAccess.fromTask()` precedes `requireWorkspacePermission` — confirmed, and the order is
load-bearing: `requireWorkspacePermission` reads `c.get("workspaceId")`
(`utils/require-workspace-permission.ts:133-137`) and throws 500 if it is unset, so the two cannot
be silently transposed. `requireEntitlement` is present and, per its own doc comment
(`billing/require-entitlement-middleware.ts:5-8`), must run after a workspace-access middleware —
it does. Nothing the ten sibling `task: ["update"]` routes carry is missing here. The chain is
**correct**.

### (2) IDOR / tenancy — no cross-workspace write is reachable

`workspaceAccess.fromTask()` (`utils/workspace-access-middleware.ts:294-300`) resolves the workspace
by joining `task -> project` on the **path param `id`** (`:154-171`, `:66-74`), which is the exact
same string the handler passes to `updateTaskEstimate` (`task/index.ts:643`, `:646`). The
middleware comment at `:71-74` records that the query string was deliberately excluded as an id
source for precisely this confused-deputy reason. `validateWorkspaceAccess`
(`utils/validate-workspace-access.ts:42-57`) then requires a `workspaceUserTable` membership row
(or instance admin), and `requireWorkspacePermission` requires `task: ["update"]` in the caller's
role statements, failing closed on every branch (`:110-131`).

`fromTask` does list a `{ type: "query", key: "workspaceId" }` fallback source. It is unreachable
for an existing task — the loop breaks on the first truthy `workspaceId` (`:107-109`), and the task
lookup returns the victim's workspace. It applies only when the lookup yields null, i.e. the task
does not exist, in which case `updateTaskEstimate` returns 404 (`update-task-estimate.ts:17-21`)
before touching anything. This fallback is pre-existing and shared by every `fromTask`/`fromTaskId`
route.

`update-task-estimate.ts` **widens nothing**: it looks the task up by primary key (`:13-15`),
`.set({ estimatedMinutes })` touches one column (`:25`), and the `.where(eq(taskTable.id, id))`
(`:26`) is the same id the middleware authorized. No workspace/project id is accepted from the
caller, no field beyond the estimate is written.

### The untested-chain risk, stated plainly

Per Gate 1 OQ-4 there is **no executed test covering this middleware chain** — `tests/api-integration/**`
is outside the write contract, and the two new suites (`tests/api/task/estimated-minutes.test.ts`,
`estimate-import-export.test.ts`) are DB-free pure-function tests. My reading and the senior
reviewer's are the only checks in existence. Typecheck, biome, and both unit suites would all stay
green if a future edit deleted line 640.

What a regression would cost, bounded:

- **Deleting `requireWorkspacePermission` (line 640):** privilege escalation *within* a workspace. Any member — including a `viewer` with no `task: ["update"]` — could set or clear estimates on any task in a workspace they already belong to. **Not** cross-tenant: `workspaceAccess.fromTask()` -> `validateWorkspaceAccess` still enforces membership. Silent; nothing in CI would catch it.
- **Deleting `workspaceAccess.fromTask()` (line 639):** *fails loudly*. `requireWorkspacePermission` throws `HTTPException(500, "workspaceId not set in context")` when `c.get("workspaceId")` is unset (`require-workspace-permission.ts:134-138`), so the route breaks outright rather than opening. This is the one ordering mistake the code defends itself against.
- **Deleting `requireEntitlement` (line 641):** a cloud workspace with an expired trial or cancelled subscription could still write estimates. Billing bypass, not a data-boundary breach; no-ops on self-hosted.

Cheapest durable mitigation if the write contract is ever widened: one integration test asserting
403 for a `viewer` on `PUT /task/estimate/:id`. Until then this route's authorization is verified by
inspection only, and that fact belongs in the run's final report.

---

## Input validation and DoS surface

`apps/api/src/task/estimated-minutes.ts` — assessed clean, with the reasoning:

- **Type confusion.** Valibot rejects a non-number at the route (`task/index.ts:637`) with a 400 before the handler runs. `normalizeEstimatedMinutes` re-checks `typeof value !== "number"` (`:18`) so a caller reaching the function directly (the importer, a future controller) is still safe. Defence in depth, correctly placed.
- **`NaN` / `Infinity` cannot reach the DB.** JSON cannot express either literal. Independently, valibot 1.4.2's `number()` is `typeof === "number" && !isNaN(value)` (verified in the installed dist), so `NaN` is a 400 at the validator. And independently again, `Number.isInteger(value)` at `:24` is false for both. Three layers; the comment at `:22-23` states the reasoning correctly.
- **int32 overflow.** `MAX_ESTIMATED_MINUTES = 525_600` (`:7`) against a PostgreSQL `integer` ceiling of 2,147,483,647 — a 4,000x margin per row. `1e308` or `999999999` are rejected as 400 by the range check at `:24`, never handed to the driver, so no `integer out of range` 22003 can be provoked. `-0` is rejected by `value < 1`.
- **No invalid input produces a 500.** Every rejection is `HTTPException(400, ...)` with a static message. The only 500 in the controller (`update-task-estimate.ts:30-32`) is a fixed string on a failed write. `app.onError` (`apps/api/src/index.ts:156-166`) returns `{"message":"Internal Server Error"}` for any non-`HTTPException` and never serialises a stack. No stack trace is reachable through this route.
- **Client-side sum overflow.** `sumEstimatedMinutes` (`apps/web/src/components/task/estimate.ts:73-93`) would need ~1.7e10 maxed tasks in one lane to approach `Number.MAX_SAFE_INTEGER`. It additionally skips any value that is not a finite positive number (`:82-86`), so a hostile or stale API response cannot poison the rollup with `NaN`/`Infinity` — the chip degrades to omitting that task rather than rendering `NaNh`.
- **Not covered by the bound:** request volume. The new route has no per-route rate limit, matching all ten sibling task-update routes; rate limiting in this app exists only on the better-auth surface (`apps/api/src/auth.ts:505`, `:528`) and per-API-key (`database/schema.ts:1006-1008`). No delta.

## Import path

`import-tasks.ts` — assessed clean:

- **Cannot abort the import.** `coerceEstimatedMinutes` (`estimated-minutes.ts:29-46`) wraps the normalizer in `try/catch` and returns `{ estimatedMinutes: null, warning }` for anything invalid. It has no throwing path. The new test at `tests/api/task/estimate-import-export.test.ts:16-36` asserts non-throwing over `NaN`, `Infinity`, `999999999`, `"150"`, `true`, `{}`, `[]`.
- **Cannot inject a non-integer into the column.** The insert at `:79` receives only the coerced value, which is either `null` or an integer in `[1, 525600]`.
- **The warning string is not an injection or log-forging vector.** `JSON.stringify(value)` at `estimated-minutes.ts:45` embeds attacker-influenced input, so I traced where it surfaces: it is pushed into `results.tasks[].warnings` (`import-tasks.ts:55-57`, `:101`) and returned as JSON from `POST /task/import/:projectId`. It is never passed to `console.*` and never written to a log line, so log forging has no target. Even if it were: `JSON.stringify` escapes `\n`, `\r` and `"`, making newline injection impossible. Reaching the function with a string at all requires bypassing the route validator, which declares `estimatedMinutes: v.optional(v.nullable(v.number()))` (`task/index.ts:449`) — so via HTTP the interpolated value is always a JSON number. On the web side the warnings render as React text nodes; no `dangerouslySetInnerHTML` exists anywhere in the changed component trees (grep over `apps/web/src/components/task/` and `apps/web/src/components/kanban-board/` returns nothing).

## Web-side

- **`!canEdit` is an affordance, not a control — confirmed.** `task-estimate-popover.tsx:86` returns `<>{children}</>`, which merely omits the popover; the *only* enforcement is `requireWorkspacePermission({ task: ["update"] })` at `task/index.ts:640`. A user who strips the check in devtools, or calls the fetcher directly, gets a 403 from the API. This matches AGENTS.md ("Hiding an action in the UI is not an authorization check").
- **No XSS surface.** `formatEstimateHours` returns `` `${number}h` `` built from a `Number` (`estimate.ts:29-35`) — its output cannot contain markup regardless of input. It is interpolated as a JSX text child in `task-estimate-badge.tsx:22` and `column-estimate-total.tsx:30`, both auto-escaped, and neither file (nor any file in the two changed component trees) uses `dangerouslySetInnerHTML`.
- **`laneEstimate` `{{value}}` is not a template-injection path.** `column-estimate-total.tsx:28` passes `{ value }` to i18next, whose default `interpolation.escapeValue: true` escapes the substitution; the result lands in a JSX `title=` attribute, escaped again by React. `value` is `${number}h`, never user text. The one i18next construct that *would* matter here — `<Trans>` / `dangerouslySetInnerHTML` on a translated string — is not used.
- **Error surfacing.** `fetchers/task/update-task-estimate.ts:16-17` throws `new Error(await response.text())` and the popover shows `error.message` in a toast (`task-estimate-popover.tsx:52-57`). The API body for these failures is `{"message":"estimatedMinutes must be ..."}` — a static string, no stack. `toast` renders via `toastManager.add({ title })` as a text node. Identical to the `due-date` sibling.

## PII / data-classification assessment

Requirements §5 remains **substantively accurate**: `task.estimated_minutes` is a planning integer
with no personal, credential or financial content, it introduces no new PII, and it reclassifies
nothing existing. It rides the same workspace boundary as the rest of the task row.

Two sentences in §5 are now literally wrong and should be reworded (both zero-impact, both detailed
above): "not emitted to events" (S-1 — it is in the in-process `task.created` payload on the import
path, though no consumer forwards it) and "not exposed via MCP" (S-3 — it appears in `get_task` /
`list_tasks` passthrough output, under the caller's own authorization).

Checked and confirmed **absent** from: WebSocket messages (`ws/index.ts:321-335` sends only
`projectId`/`taskId`/`type`), generic webhook payloads (`plugins/generic-webhook/events.ts:275-286`),
activity rows (`activity/index.ts:181`), notification `eventData`
(`notification/index.ts:177-185`), search results (`search/controllers/global-search.ts:203-222`,
`:272-291`), and every log line (no `console.*` in any changed file).

The role matrix in §6 is accurate as shipped: write requires `task: ["update"]` API-side; read is
inherited from the existing `getTask`/`getTasks` workspace scoping; no new permission string enters
`@kaneo/permissions`.

## Attack surface delta

| Added | Auth | Input | Worst case |
|---|---|---|---|
| `PUT /task/estimate/:id` | session/API-key -> workspace membership -> `task: ["update"]` -> entitlement | one optional nullable number, bounded `[1, 525600]` | authorized member sets a wrong number on a task they can already fully edit |
| `estimated_minutes` in `GET /task/:id`, `GET /task/tasks/:projectId`, `GET /task/export/:projectId` (and therefore MCP `get_task`/`list_tasks`) | unchanged from those routes | n/a (read) | a nullable integer visible to principals who can already read the whole task row |
| `estimatedMinutes` accepted by `POST /task/import/:projectId` | unchanged (`task: ["create"]`) | validator-typed, then coerced to `null` on any invalid value | one task imports without its estimate, with a warning in the response |
| `ALTER TABLE "task" ADD COLUMN "estimated_minutes" integer` | n/a | n/a | metadata-only, nullable, no default, no rewrite, no lock escalation |

Net: one authenticated, permission-gated write endpoint; no new anonymous surface, no new
outbound channel, no new dependency.

## What I checked and found clean (negative space)

- **Secrets.** `grep -rniE "(api[_-]?key|secret|password|token)[ \t]*[:=][ \t]*['\"][a-zA-Z0-9]"` over `apps/api/src/task/`, `apps/web/src/components/task/`, `apps/web/src/components/kanban-board/`, `apps/web/src/fetchers/task/`, `apps/web/src/hooks/mutations/task/` and `tests/api/task/` — no match. The two new test files use no credentials, no fixtures with real data, and no network.
- **Dependencies.** `package.json`, `apps/api/package.json`, `apps/web/package.json` and `pnpm-lock.yaml` all report clean in `git status` — **no new dependency**, direct or transitive.
- **Env hygiene.** `.env` is gitignored (`.gitignore:9`) and untracked; this run touches neither it nor `.gitignore` nor `biome.json`.
- **No internal or private field newly exposed.** The three read projections gained exactly one column each (`get-task.ts:17`, `get-tasks.ts:132`, `export-tasks.ts:32`/`:89`) and nothing else; diff verified line by line.
- **Migration.** `apps/api/drizzle/0043_adorable_micromacro.sql` is a single additive `ALTER TABLE "task" ADD COLUMN "estimated_minutes" integer;` — nullable, no default, no index, no constraint, no data movement. Safe on a populated table.
- **No new event, no new WebSocket topic, no new webhook trigger** — `update-task-estimate.ts` contains no `publishEvent`, deliberately and with the reason recorded in-file (`:34-36`).
- **Fail-closed permission evaluation.** `require-workspace-permission.ts:22-49` drops malformed custom-role JSON rather than trusting it, `satisfies()` returns false on any missing resource or action (`:71-85`), and the API-key scope check runs independently of the role check (`:136-141`).
- **Error handling.** No changed file logs a request body, a task field, or a user identifier.

## Required before sign-off

Nothing blocking. Two documentation corrections, both to `requirements.md` §5, and one disclosure
that must appear in the run's final report:

1. Reword §5's "not emitted to events" and "not exposed via MCP" per S-1 and S-3.
2. State plainly that **no executed test covers the middleware chain on `PUT /task/estimate/:id`**, that a regression dropping `requireWorkspacePermission` would be silent and would permit intra-workspace privilege escalation (a `viewer` editing estimates), and that a regression dropping `workspaceAccess.fromTask()` would instead fail loudly with a 500.

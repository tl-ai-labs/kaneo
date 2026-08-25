# Code review — feature-extend: per-lane soft WIP limits

**VERDICT: CHANGES REQUIRED**

One blocker (CI format gate will fail), two majors, two minors, three nits. The feature logic itself
is correct, plan-faithful and well-scoped; every blocking item is an artifact/hygiene or
test-strength problem, not a behavioral defect. The core question the feature had to get right —
"nothing is ever blocked, and the no-limit lane renders exactly as before" — is answered correctly
and provably.

Scope: brownfield, limited to the 39 repo files in
`.sdlc/runs/20260824-095555-feature-extend-wip-limits/provenance.json` plus `.gitignore` (which is
*not* in provenance — see F-3). Pre-existing smells in untouched files are excluded.

---

## Findings

| # | Severity | File:line | What | Why it matters | Suggested fix |
|---|---|---|---|---|---|
| F-1 | **blocker** | `apps/api/drizzle/meta/_journal.json:1`, `apps/api/drizzle/meta/0043_snapshot.json:1` | Both files are raw `drizzle-kit` output: 2-space indent and no trailing newline. Every previously committed snapshot/journal in this repo is tab-indented. | `biome.json:10-31` includes `**` with `formatter.indentStyle: "tab"` and does **not** exclude `apps/api/drizzle`. CI runs `pnpm exec biome ci .` (`.github/workflows/ci.yml:33`). I ran `pnpm exec biome check` read-only on these two paths: **"Found 2 errors."** CI fails on this change as committed. Secondary harm: `_journal.json` shows as a 619-line rewrite for a 7-line append — the immediately preceding migration commit (`33e24240`) landed the same kind of append as `7 +++++++`, so this is a regression in diff hygiene and a guaranteed merge-conflict surface. The reported "biome check clean on all 36 changed paths" evidently did not include these two paths. | `pnpm exec biome format --write apps/api/drizzle/meta/_journal.json apps/api/drizzle/meta/0043_snapshot.json`. Confirm `git diff --stat -- apps/api/drizzle/meta/_journal.json` collapses to `7 +++++++`. |
| F-2 | **major** | `tests/api/column/wip-limit-authz.test.ts:12,20` | `expect(postRoutes.length).toBeGreaterThanOrEqual(6)` — a handler *count*, not an identity check. | Does not satisfy AC-3 ("enforced in the API… proven by test, not by UI absence"). It cannot tell *which* middleware is registered, and it is blind to the two most likely regressions: (a) deleting `requireWorkspacePermission` while adding any other middleware, (b) downgrading it to `{ project: ["read"] }`, which changes nothing about the count. The current count is exactly 6, so the "lower bound" has zero slack in the protective direction and unbounded slack in the permissive one. I agree with the security reviewer: near-worthless as a guard. | Replace with a request-level test. The repo already has the idiom: `tests/api-integration/workspace-rbac.test.ts:73` mounts real routes against Postgres and asserts `403`. Add a `tests/api-integration/column-wip-limit.test.ts` covering viewer → `PUT /column/:id {wipLimit:3}` → 403 **and the DB row unchanged**; member/admin → 200 with `wip_limit` persisted; then `GET /column/:projectId` returns it (which also discharges AC-4's "survives a reload"). Delete the route-count file. |
| F-3 | **major** | `.gitignore:58-60` | Adds `# AI-SDLC run artifacts` / `.sdlc/`. Not in `provenance.json`. | Two problems. (1) **AC-11 violation**: a repo file was modified outside the recorded write contract, so `/mmo:revert` cannot restore it. (2) **Scope**: ignoring agent-tooling artifacts has nothing to do with WIP limits, and it silently reverses a decision made elsewhere — the sibling branch handled the same problem by adding `!**/.sdlc` to `biome.json` file discovery (see `33e24240`'s message), which keeps `.sdlc` tracked. Gitignoring it instead is a different, unreviewed product decision about whether run artifacts are committed at all. | Revert `.gitignore` out of this change. If run artifacts genuinely must be excluded, land it as its own commit with its own rationale, and record it in provenance. |
| F-4 | minor | `apps/api/src/column/validators.ts:9` → surfaced at `apps/web/src/components/project/column-editor.tsx:112-116` | `wipLimitSchema` has no upper bound (security finding (a)). The client guard at `column-editor.tsx:136` is `Number.isInteger(parsed) && parsed >= 1`, which also has no ceiling. | Reachable end-to-end: type `2147483648` → passes the client guard → passes Valibot → PG `integer` overflow → 500. The web fetcher is `throw new Error(await response.text())` (`apps/web/src/fetchers/column/update-column.ts:19-20`), and `commitWipLimit`'s catch prefers `error.message`, so the **raw server error body lands in a user-visible toast**. The fetcher behavior is pre-existing, but this is the first code path that makes it trivially reachable by ordinary typing. | Add `v.maxValue(2_147_483_647)` to the pipe in `validators.ts:9` (turns 500 into a validated 400), mirror the ceiling in the client guard at `column-editor.tsx:136` so the input reverts instead of round-tripping, and add two cases to `wip-limit-validator.test.ts` (accepts 2147483647, rejects 2147483648). One fix closes both the security item and the toast leak. |
| F-5 | minor | `i18n/schema.json` (unmodified) | Six new `settings.columnEditor.*` keys and the `tasks.kanban.wipLimit.*` object were added to all 17 locale files, but the generated schema was not regenerated. Verified: `schema.json` is the only file in `i18n/` missing all of them. | `i18n/schema.json` is a checked-in generated artifact (`package.json:12` → `pnpm i18n:schema`; documented at `CONTRIBUTING.md:140` as the source for "editor and tooling validation") and it is `"additionalProperties": false`. Every new key is now a validation error for any contributor whose editor binds the schema. No CI gate catches it, which is exactly why it will rot. | Run `pnpm i18n:schema` and commit the regenerated `i18n/schema.json`. |
| F-6 | nit | `apps/web/src/components/kanban-board/column/column-task-count-badge.tsx:35` | `role="img"` is the only occurrence in `apps/web/src`; the repo has 15 `sr-only` usages. | See Q8 — the call is defensible and the lint rule it satisfies is real, but it is a novel local pattern where an established one exists, and it removes the visible `7/5` text from the accessibility tree. | Optional: drop `role`, keep the badge a bare `<span>` with the visible `{count}/{wipLimit}`, and add `<span className="sr-only">{label}</span>` as a sibling. Same lint outcome (no `aria-label` on a `generic`), conventional, and keeps the numeric text addressable. |
| F-7 | nit | `apps/web/src/components/project/column-editor.tsx:354` | `type="number"`: browsers sanitize unparseable typing (`"5x"`, `"-"`, `"e"`) to `value === ""`, which falls into the clear branch at line 127 and silently `PUT { wipLimit: null }`. | Explicitly analyzed and accepted by the plan (§6.3), so this is a recorded tradeoff, not an oversight. Noting only because the sibling `estimatedHours` work reached the **opposite** conclusion for the identical hazard ("input[type=number] sanitizes unparseable typing to '', which would parse as null and commit an accidental clear on blur" — commit `33e24240`), so the codebase now carries two contradictory answers. | Leave as is, or align on `type="text"` + `inputMode="numeric"`. Worth one line in the commit message either way. |
| F-8 | nit | `apps/web/src/components/kanban-board/column/column-task-count-badge.test.tsx:26-27,39-40` | The no-limit cases assert `data-over-limit` and `aria-label` are null, but not `title`. | `title` is the third attribute the limit branch attaches; asserting two of three leaves a gap in the AC-6 regression net that the test is specifically built to close. | Add `expect(el.getAttribute("title")).toBeNull();` to both no-limit cases. |

---

## Per-question answers

### Q1 — AC-6 byte-identity: **YES, and the test genuinely enforces it.**

Original (`git diff apps/web/src/components/kanban-board/column/column-header.tsx`, removed lines):

```tsx
<span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
  {column.tasks.length}
</span>
```

Early return at `column-task-count-badge.tsx:19-21` is character-for-character the same `className`
in the same order, same single text child, no extra attributes. It is a literal `<span>`, not a
`cn()` ternary — which is the whole point, since a ternary would have appended
`inline-flex items-center gap-1 tabular-nums` and reordered the list.

Test case 1 (`column-task-count-badge.test.tsx:23-27`) uses `expect(el.className).toBe(...)` — exact
string equality, not `toContain` — plus null assertions on `data-over-limit` and `aria-label`. Case 2
(lines 36-40) repeats it for the `undefined` prop, correctly exercising the `== null` branch for both
inhabitants. That is a real guard. Only gap: `title` is not asserted null (F-8).

### Q2 — Null-vs-omitted on PUT: **YES to both halves.**

`apps/api/src/column/controllers/update-column.ts:31`:

```ts
...(data.wipLimit !== undefined && { wipLimit: data.wipLimit }),
```

`!== undefined` (not truthiness, not `!= null`) is the correct discriminator: `{ wipLimit: null }`
→ `true && {wipLimit: null}` → key present → `SET wip_limit = NULL`. `{}` → `false` → spreading
`false` contributes nothing. The two cases are genuinely distinguished.

The test asserts **key presence**, not just value —
`wip-limit-persistence.test.ts:101` `expect("wipLimit" in values).toBe(true)`, and the two negative
cases at :108 and :114 `expect("wipLimit" in values).toBe(false)`. This is the assertion that
matters: `toEqual({...})` on the value alone would pass for both `null` and absent under several
matcher shapes. Correctly done, and the `{}` case (:111-115) is a nice addition beyond the plan.

### Q3 — Authorization: **chain intact; the test is near-worthless. I agree with the security reviewer.**

Both guarded, in the correct order (validators → `workspaceAccess` → `requireWorkspacePermission` →
handler):

- POST `/:projectId` — `apps/api/src/column/index.ts:68-69`: `workspaceAccess.fromProject("projectId")`, `requireWorkspacePermission({ project: ["update"] })`
- PUT `/:id` — `apps/api/src/column/index.ts:147-148`: `workspaceAccess.fromColumn("id")`, `requireWorkspacePermission({ project: ["update"] })`

(For completeness, unchanged and still guarded: PUT `/reorder/:projectId` at :111-112, DELETE
`/:id` at :172-173, GET `/:projectId` at :34 with `workspaceAccess` only.)

On the test: yes, `routes.length >= 6` is near-worthless as a security guard. `column.routes` is an
opaque array of registered handler entries; the assertion reads its length and nothing else. It
survives deleting `requireWorkspacePermission` and adding any other middleware, it survives
reordering the chain so the permission check runs after the handler, and — the likeliest real
regression — it survives downgrading the spec to `{ project: ["read"] }`, since the count is
unaffected. The current count is exactly 6, so the `>=` gives no headroom where headroom would
protect and unlimited headroom where it would not. Replacement: the integration test described in
F-2, following `tests/api-integration/workspace-rbac.test.ts`. A 403 on a real request is the only
thing that discharges AC-3 as written.

### Q4 — Nothing is enforced: **CONFIRMED.**

Repo-wide grep for `wipLimit|wip_limit|wip-limit` across `apps/ packages/ tests/ i18n/` returns
occurrences in exactly these categories: schema + migration, the two column controllers, the column
router + validator, the `get-tasks` projection (`get-tasks.ts:230`, a bare property copy into the
response object), the web type plumbing (fetchers/hooks — type widening only, no logic), the badge
component, the `ColumnEditor` input, and tests/i18n.

Zero occurrences in `column-dropzone.tsx`, `kanban-board/column/index.tsx`, any drag/drop handler,
`create-task`, `update-task`, `update-task-status`, or any archive path. No handler gained a
condition on `wipLimit`; no `if`, no early return, no disabled prop, no toast. The negative contract
of plan §7.6 holds.

MCP is also clean and needs no change: there is no column create/update tool, and
`list_project_columns` (`apps/api/src/mcp/tools.ts:797-805`) is a raw `client.json` passthrough of
`/api/column/:projectId`, so `wipLimit` flows through automatically. No Zod schema to widen.

### Q5 — `handleUpdateWipLimit` currentTarget hazard: **handled correctly on both counts.**

Synchronous and takes the element: declared `(id, current, input: HTMLInputElement) => {…}` at
`column-editor.tsx:120-124` — no `async`, no `await` anywhere in the body. The call site
(`:362-366`) reads `e.currentTarget` synchronously inside the `onBlur` arrow and passes the DOM node,
so the synthetic event is never touched after the handler returns. The async work is detached via
`void commitWipLimit(...)` (`:129`, `:143`), and `commitWipLimit` only ever touches `id`/`wipLimit`,
never the element. The revert write `input.value = …` (`:137`) is likewise on the DOM node and
happens before any promise exists. Nothing here can hit the nulled-`currentTarget` trap.

Empty-string check precedes the parse: `raw` is trimmed at `:125`, `if (raw === "")` at `:127`
returns on both sub-branches, and `Number(raw)` is not reached until `:133`. So `Number("")  === 0`
never reaches the `>= 1` guard, and whitespace-only input is normalized to the clear gesture rather
than to `0`. Ordering is correct and the plan's "do not reorder" note is respected.

### Q6 — i18n: **all three answers are correct.**

- **Static keys.** Every call is a string literal: `settings:columnEditor.wipLimit`,
  `.wipLimitPlaceholder`, `.wipLimitAria`, `.wipLimitTooltip`, `.toastWipLimitUpdated`,
  `.toastWipLimitCleared`, `tasks:kanban.wipLimit.withinLabel`, `.overLabel`. No template
  interpolation into a key, no computed key, no `${}` in any `t()` argument.
- **Interpolation vars.** `{{current}}` / `{{limit}}` (`i18n/en-US.json:1892-1895`,
  `column-task-count-badge.tsx:27-31`) — and specifically **not** `count`, which would have made
  i18next apply plural resolution and start looking for `_one`/`_other` suffixed keys that do not
  exist. Correct and deliberate (plan §8.1). `wipLimitAria` uses `{{name}}`, consistent with the
  neighbouring `markDoneAria`.
- **`toastUpdateError` reused.** `column-editor.tsx:115` uses the existing
  `settings:columnEditor.toastUpdateError`; no new error key was invented. The two new success keys
  (`toastWipLimitUpdated`/`Cleared`) follow the file's established per-action success-key pattern
  (`toastIconUpdated`, `toastFinalOn`/`Off`).
- Coverage: all six settings keys plus both kanban keys are present in all 17 locale files. The only
  `i18n/` file missing them is the generated `schema.json` (F-5).
- `pnpm i18n:check` currently **fails**, but this is **pre-existing and unrelated**: every reported
  missing key is under `common:error.*`, and the WIP keys appear zero times in its output. This
  change did not make it worse. AC-7's "`i18n:check` is clean" is therefore unachievable on this
  baseline and should not be held against the change.

### Q7 — The two modified fixtures: **legitimate contract-shape update, not a violation.**

Plainly: legitimate. `ProjectWithTasks` is not hand-written — `apps/web/src/types/project/index.ts:10-27`
derives it from `InferResponseType<typeof client.task.tasks[":projectId"].$get, 200>` and only
overrides the `tasks`/`archivedTasks`/`plannedTasks` arrays. Adding `wipLimit` to the `get-tasks`
projection (`apps/api/src/task/controllers/get-tasks.ts:230`) therefore makes `wipLimit` a
**required** property of the inferred column type. Any object literal typed as a column must supply
it; there is no way to add the field to the API response without this.

The distinction FR-36 is protecting against is *weakening an assertion so new code passes*. Neither
edit does that. Each adds exactly one line — `wipLimit: null` — to a fixture literal
(`sync-task-labels-cache.test.ts:23`, `use-task-filters-with-labels-support.test.tsx:39,128`). No
assertion, expectation, matcher or test name was touched, and `null` is the correct value for a
column with no limit, so the fixtures still describe the same scenario. Both tests still pass or
fail for exactly the reasons they did before. This is a typecheck-forced fixture update, which is a
different act from editing a test to accommodate a regression. FR-36 is satisfied in substance.

### Q8 — `role="img"`: **defensible and the diagnosis is right, but `sr-only` is the better fit here.**

The diagnosis behind it is correct. A bare `<span>` maps to ARIA role `generic`, which prohibits an
accessible name, so `aria-label` on it is discarded by conforming AT — the label really was being
silently dropped, and `lint/a11y/useAriaPropsSupportedByRole` was right to flag it. Something had to
change; `role="img"` is a legitimate and widely recommended fix for a composite icon+text badge.

**What a screen reader now announces**, over cap: *"7 of 5 tasks, over the WIP limit, graphic"*
(NVDA; VoiceOver says "image"). Under cap: *"2 of 5 tasks, image"*.

**Yes, `role="img"` suppresses the inner text node.** `img` is defined as *children presentational*
and *name from author only*, so the accessibility subtree is pruned: the `7/5` text node and the
`AlertTriangle` svg are both removed, and the accessible name is exactly the `aria-label`. That is
the intended outcome here — the label is a strict superset of the visible text — so nothing is lost
in announcement terms.

Two reasons I'd still prefer the `sr-only` variant:

1. **Convention.** `role="img"` is the only occurrence in `apps/web/src`; `sr-only` appears 15 times
   (`nav-projects.tsx:276`, `task-description.tsx:1419`, `theme-toggle-dropdown.tsx:32`, …). AGENTS.md
   asks for the established local pattern where it fits, and it fits.
2. **The pruning has a cost.** Removing `7/5` from the accessibility tree means the badge's visible
   text is no longer addressable — braille users lose the compact numeric form, and voice-control
   users cannot refer to what they see. Announcing the element as "graphic" is also mildly
   misleading for what is fundamentally a text badge.

Both are correct-enough; I'm filing it as a nit (F-6), not a change request. If it stays, the
`role="img"` line deserves a one-line comment recording *why* (generic role drops the name), because
the next reader will otherwise try to delete it.

### Q9 — Scope discipline: **one out-of-scope change, no speculative features, two convention misses.**

- **Out of scope:** `.gitignore:58-60` (F-3) — unrelated to WIP limits, absent from provenance,
  and reverses a decision made differently elsewhere in the project.
- **Convention misses:** unformatted drizzle artifacts (F-1, breaks the CI format gate) and the
  stale generated `i18n/schema.json` (F-5).
- **No speculative additions.** Create-side `wipLimit` support exists in the API/fetcher/hook but is
  deliberately *not* surfaced in the add-column form — plan §6.1 justifies this as API-contract
  completeness, and it is covered by tests (`wip-limit-persistence.test.ts:48-67`). That is a
  reasoned decision, not scope creep.
- **Conventions followed well:** Valibot validation with `HTTPException` semantics inherited;
  `requireWorkspacePermission` reused rather than a duplicated role check; schema in `schema.ts`
  with a generated migration alongside; fetchers under `apps/web/src/fetchers/`; `@kaneo/libs`
  client throughout with no parallel request layer; inferred types and `type` over `interface`; both
  new comments explain constraints rather than narrating code (`schema.ts:360`,
  `column-editor.tsx:135`). Migration `0043` is correctly numbered for this branch (based on
  `5d1fc910`; the sibling branch's `0043_skinny_mockingbird` is not an ancestor, so there is no
  collision to resolve here).
- **Correctly judged as not-applicable:** no event/WebSocket work (a soft display hint on a column
  needs no `publishEvent`; the value rides the existing tasks payload, so no new invalidation —
  plan §5.5), no `relations.ts` change, no MCP change (Q4), no new env var.

---

## Acceptance-criteria matrix

| AC | Status | Evidence |
|---|---|---|
| **AC-1** — nullable `wipLimit` integer + additive migration safe on populated DB | **MET** | `apps/api/src/database/schema.ts:361` `integer("wip_limit")` — nullable, no default, no backfill. `apps/api/drizzle/0043_broken_weapon_omega.sql:1` is a single `ALTER TABLE "column" ADD COLUMN "wip_limit" integer;`. Shape asserted at `wip-limit-persistence.test.ts:122-131` (name `wip_limit`, `notNull === false`, `hasDefault === false`). *Caveat: the migration's meta artifacts are unformatted — F-1.* |
| **AC-2** — API accepts/returns `wipLimit`, validated, accurate OpenAPI, rejects bad input | **MET** | Accepts: `index.ts:65` (POST), `:144` (PUT). Returns: `get-columns.ts:6` is a bare `select()` so the new column is included; board payload at `get-tasks.ts:230`. Validation: `validators.ts:8-9` `optional(nullable(pipe(number(), integer(), minValue(1))))`. OpenAPI: `index.ts:47,126` both describe the field and state it is advisory. Rejection proven for `0`, `-1`, `2.5`, `"3"`, `true`, `NaN` (`wip-limit-validator.test.ts:24-46`), acceptance for `3`, `1`, `null`, omitted (:8-22). *Caveat: no upper bound — F-4.* |
| **AC-3** — `project:update` enforced in API, proven by test | **PARTIAL** | Enforcement present and correct (`index.ts:68-69`, `:147-148`). **Not proven by test**: `wip-limit-authz.test.ts` only counts registered handlers (F-2). No request is ever made, no 403 is ever asserted. |
| **AC-4** — `ColumnEditor` can set / change / clear; survives reload | **PARTIAL** | All three paths implemented and traceable: set/change → `column-editor.tsx:141-143`; clear → `:127-131`; no-op guards at `:128` and `:141`. Round-trip is sound by construction (`defaultValue={col.wipLimit ?? ""}` at `:355` reading from `useGetColumns`, which returns the full row). **No test** exercises it — plan §9.5 waived `ColumnEditor` coverage as five module mocks for "a missing toast", which is reasonable in isolation but leaves "survives a reload" wholly unverified. The F-2 integration test would cover it for free. |
| **AC-5** — lane header shows count vs limit, distinct over-cap state | **MET** | `column-task-count-badge.tsx:25` `count > wipLimit` (strict, so at-cap is not over-cap), `:39-44` destructive vs muted styling, `:46-48` `AlertTriangle`, `:49` `${count}/${wipLimit}`. Tested under (`:43-57`), **at boundary** (`:59-70`), and over (`:72-87`). The at-cap case is the one most likely to be got wrong and it is explicitly covered. |
| **AC-6** — no-limit column renders identical markup | **MET** | See Q1. Early return `column-task-count-badge.tsx:17-23`; exact `className` string equality at `column-task-count-badge.test.tsx:23-25` and `:36-38`, for both `null` and `undefined`. Minor gap: `title` not asserted null (F-8). |
| **AC-7** — static i18n keys, `en-US.json` source of truth, `i18n:check` clean | **PARTIAL** | Static keys and correct interpolation vars confirmed (Q6); all 8 keys present in all 17 locales. Two deductions: generated `i18n/schema.json` not regenerated (F-5), and `pnpm i18n:check` exits 1 — though **entirely on pre-existing `common:error.*` gaps, zero WIP-related**, so the failure is not attributable to this change. |
| **AC-8** — drag/drop, task creation, archiving unchanged; nothing blocked | **MET** | Repo-wide grep confirms zero `wipLimit` occurrences in any drag, drop, create, or archive handler; no conditional anywhere outside the badge's own render branch. See Q4. |
| **AC-9** — focused API + web tests; suites green; no baseline test modified | **PARTIAL** | Coverage is real and well-targeted: 10 validator cases, 11 persistence cases (including the key-presence assertions that matter), 6 badge cases spanning all four render states. Suites green per the run report (API 61/397, web 37/118), not re-run here. Two deductions: the authz test does not test authorization (F-2), and two baseline fixtures were modified — **justified**, see Q7, but the criterion is literally not met as written. |
| **AC-10** — affected packages typecheck | **MET** (reported) | Both typechecks reported clean; not re-run per instruction. Consistent with the diff: every consumer of the widened column type was updated, which is precisely why the two fixtures needed the extra line. |
| **AC-11** — no file modified outside the write contract; every write has provenance | **NOT MET** | `provenance.json` records 39 repo paths. `git status --porcelain` shows those 39 **plus `.gitignore`**, which has no provenance record. `/mmo:revert` would leave it behind. See F-3. |

**Summary: 6 MET, 4 PARTIAL, 1 NOT MET.**

---

## Refinement packets

```json
[
  {
    "artifact_path": "apps/api/drizzle/meta/_journal.json, apps/api/drizzle/meta/0043_snapshot.json",
    "instruction": "Format both drizzle meta artifacts with the repo's Biome config so the CI format gate passes. Run exactly: pnpm exec biome format --write apps/api/drizzle/meta/_journal.json apps/api/drizzle/meta/0043_snapshot.json. This converts drizzle-kit's 2-space output to the repo-standard tab indentation and restores the trailing newline, matching every previously committed snapshot (compare apps/api/drizzle/meta/0042_snapshot.json). Do not edit the JSON content — no id, prevId, tag, idx or when value may change, and no journal entry may be added or removed. Change nothing else in the repo.",
    "acceptance": [
      "pnpm exec biome check apps/api/drizzle/meta/_journal.json apps/api/drizzle/meta/0043_snapshot.json exits 0 with no errors",
      "git diff --stat -- apps/api/drizzle/meta/_journal.json shows a 7-line insertion and no deletions",
      "head -3 apps/api/drizzle/meta/0043_snapshot.json | cat -A shows ^I tab indentation, matching 0042_snapshot.json",
      "git diff -- apps/api/drizzle/meta/_journal.json contains no change to any idx, when, tag or version value",
      "pnpm --filter @kaneo/api exec drizzle-kit check still reports no migration conflicts"
    ]
  },
  {
    "artifact_path": "tests/api-integration/column-wip-limit.test.ts (new); delete tests/api/column/wip-limit-authz.test.ts",
    "instruction": "Replace the handler-count assertion with a real authorization test that discharges AC-3. Delete tests/api/column/wip-limit-authz.test.ts entirely — a routes.length lower bound cannot detect a deleted guard, a reordered chain, or a permission spec downgraded from project:update to project:read. Add tests/api-integration/column-wip-limit.test.ts following the existing idiom in tests/api-integration/workspace-rbac.test.ts (same helpers, same setup, same seeding style). Cover, at minimum: (1) a viewer issuing PUT /column/:id with { wipLimit: 3 } receives 403 AND the column row's wip_limit is unchanged in the database afterwards — assert both, since the status alone does not prove the write did not happen; (2) a role holding project:update issuing the same request receives 200 and wip_limit is persisted; (3) a subsequent GET /column/:projectId returns wipLimit for that column, which also discharges AC-4's survives-a-reload requirement; (4) POST /column/:projectId with a wipLimit is likewise 403 for a viewer and 200 for an authorized role. Do not modify any application source file.",
    "acceptance": [
      "tests/api/column/wip-limit-authz.test.ts no longer exists",
      "The new test asserts response.status === 403 for a viewer on both PUT /column/:id and POST /column/:projectId",
      "The 403 case re-reads the column row and asserts wip_limit is unchanged, not merely that the status was 403",
      "An authorized role's PUT returns 200 and a follow-up GET /column/:projectId returns the persisted wipLimit",
      "Temporarily changing requireWorkspacePermission({ project: [\"update\"] }) to { project: [\"read\"] } in apps/api/src/column/index.ts makes the new test fail (verify, then revert)",
      "Temporarily deleting the requireWorkspacePermission line from the PUT chain makes the new test fail (verify, then revert)",
      "pnpm test:integration passes with the new file, and pnpm --filter @kaneo/api test still passes with the deleted file removed"
    ]
  },
  {
    "artifact_path": ".gitignore",
    "instruction": "Revert the out-of-scope .gitignore change. Remove the three added lines at the end of the file (the blank line, the '# AI-SDLC run artifacts' comment, and the '.sdlc/' pattern) so .gitignore matches its committed state exactly. This file is not in the run's provenance.json, so it falls outside the confirmed write contract (AC-11) and cannot be reverted by tooling; it is also unrelated to WIP limits and silently reverses the approach taken elsewhere in the project, which excluded .sdlc from Biome file discovery in biome.json rather than from git tracking. If run artifacts genuinely need to be gitignored, that belongs in its own separately reasoned change. Change nothing else.",
    "acceptance": [
      "git diff -- .gitignore produces no output",
      "git status --porcelain lists only paths that appear in .sdlc/runs/20260824-095555-feature-extend-wip-limits/provenance.json",
      "No other file is modified by this packet"
    ]
  }
]
```

**Not packetized** (minors/nits — operator's call, each is a small self-contained edit): F-4 upper
bound on `wipLimitSchema` plus the matching client-side ceiling (recommended — it is the one change
that closes both an open security finding and a raw-error-in-toast path); F-5 `pnpm i18n:schema`
regeneration (one command); F-6 `role="img"` → `sr-only`; F-7 `type="number"` → `type="text"`;
F-8 the missing `title` null assertion.

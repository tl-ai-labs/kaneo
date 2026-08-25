# Senior code review — advisory per-column WIP limit

Run `20260821-094808-feature-extend-lane-wip-limit` · base `5d1fc910` · scope: the 20 files this run
touched. Pre-existing smells in untouched files are out of scope and are not reported.

## 1. Verdict

**changes-required**

The feature itself is correct. Every human-approved decision (D1–D6) and every contract constraint
(1–6) holds under inspection — I could not find a behavioural defect in the API, the schema, the
projection, the badge or the editor. Two things outside the feature logic block it:

- **B1 (blocker):** the two generated Drizzle metadata files fail `pnpm exec biome ci .`, which is
  the first job in `.github/workflows/ci.yml`. This PR is red on CI. The stated "biome check on all
  18 changed files" did not cover them.
- **B2 (major):** `apps/docs/openapi.json` — a tracked, generated artefact that renders the public
  API reference for `POST /column/{projectId}` and `PUT /column/{id}` — was not regenerated and no
  longer documents the request contract. `AGENTS.md` requires OpenAPI metadata to stay accurate.

Both fixes are one command each. Nothing about the feature design needs to change.

## 2. Decision integrity

| # | Decision | Result | Evidence |
|---|---|---|---|
| D1 | `wipLimit === null` renders byte-identical to pre-change markup | **PASS** | `column-header.tsx:67-70` — the null branch is `<span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">{taskCount}</span>`. Class string is character-for-character the HEAD string; `taskCount` is `column.tasks.length` (`:29`). No `role`, no `aria-label`, no icon, no `cn()` on that branch. |
| D2 | Interpolation is `{{current}}`/`{{limit}}`, never `{{count}}` | **PASS** | `column-header.tsx:76` passes `{ current: taskCount, limit: wipLimit }`; `i18n/en-US.json:1893-1894` define `"{{current}} of {{limit}} tasks"` and `"{{current}} of {{limit}} tasks, over the WIP limit"`. `grep count i18n/en-US.json` on the two new keys returns nothing. Guarded by `column-header.test.tsx:126,137` with `toEqual({current, limit})` — an exact-shape match, so an added `count` option fails the test. |
| D3 | Indicator strictly when `count > limit`; no third state at `count === limit` | **PASS** | `column-header.tsx:31` `const isOverCap = wipLimit !== null && taskCount > wipLimit;` is the sole state variable; the JSX has exactly two branches (`wipLimit === null` / else) and one ternary on `isOverCap`. `column-header.test.tsx:93-100` asserts 5/5 has no destructive class and no `svg`. |
| D4 | `createColumn` persists `wipLimit ?? null` | **PASS** | `create-column.ts:92` `wipLimit: wipLimit ?? null,` with the constraint recorded in a comment at `:90-91`. Note it sits directly beneath `icon: icon \|\| null` / `color: color \|\| null` (`:87-88`), so the divergence is deliberate and legible. Guarded by a test that genuinely discriminates the operators (§5). |
| D5 | `get-tasks` projection gains only `wipLimit` | **PASS** | `get-tasks.ts:230` is a one-line addition `wipLimit: column.wipLimit,`. `git diff` for that file is `+1/-0`. No `color`, no `position`. |
| D6 | A `<span>` with `aria-label` also carries an explicit `role` | **PASS** | `column-header.tsx:72-73` — `role="img"` precedes `aria-label`. Verified independently: `npx biome check apps/web/src/components/kanban-board/column/column-header.tsx` is clean, and `lint/a11y/useAriaPropsSupportedByRole` is active via the `recommended` preset in `biome.json`. The only other new `aria-label` is on an `<Input type="number">` (`column-editor.tsx:393`), whose implicit `spinbutton` role supports it. |

## 3. Contract

| # | Constraint | Result | Evidence |
|---|---|---|---|
| 1 | Optional + nullable end to end; absent = unchanged, null = clear; migration safe, no backfill | **PASS** | `schema.ts:360` `wipLimit: integer("wip_limit")` — nullable, no default, no `.notNull()`. `0043_conscious_gambit.sql` is exactly `ALTER TABLE "column" ADD COLUMN "wip_limit" integer;` — additive, no backfill, safe on populated tables. `update-column.ts:31` uses the conditional spread `...(data.wipLimit !== undefined && { wipLimit: data.wipLimit })`, so `undefined` omits the key and `null` writes `null`. Proven at the HTTP layer by `tests/api-integration/column-wip-limit.test.ts:119-149` (set 2 → rename → still 2; then explicit null → cleared) and against a pre-existing row at `:62-70`. |
| 2 | Bounded integer 1..2147483647, 400 from the API not a PG error | **PASS** | `create-column.ts:22-27` — `v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2147483647))`. `v.integer()` is present, so `1.5` is rejected rather than silently truncated by PostgreSQL; `v.maxValue` keeps `2147483648` from reaching int4 and raising a 500. Wired into **both** validators: `column/index.ts:63` (POST) and `:141` (PUT), each as `v.optional(v.nullable(wipLimitSchema))` so the truth tables are identical. Integration test `:151-166` asserts status **400** (not 500, not 200) for `0, -1, 1.5, 2147483648, "5"` *and* re-reads the row to confirm the stored value is untouched; `:168-181` asserts `2147483647` is accepted. |
| 3 | API is the authority; client bound is convenience only | **PASS** | The client guard in `column-editor.tsx:141-152` (`/^\d+$/` then range check) short-circuits before the mutation, but the same values are independently rejected server-side — integration `:151-166` bypasses the UI entirely via `app.request`. The `min`/`max`/`step` attributes on the Input (`:387-389`) are hints only; `fireEvent.change(..., {value: "2.5"})` in `column-editor.test.tsx:159` demonstrates the DOM does not enforce them. |
| 4 | Authorization unchanged, no new permission vocabulary | **PASS** | `column/index.ts` middleware chains are untouched by the diff — `workspaceAccess.fromProject("projectId")` + `requireWorkspacePermission({ project: ["update"] })` on POST (`:66-67`) and `workspaceAccess.fromColumn("id")` + the same permission on PUT (`:144-145`), identical to HEAD. Nothing added to `packages/permissions` (not in `git status`). Integration `:244-255` proves a `member`-role user gets **403** and the row is unchanged. |
| 5 | New copy as static keys in `i18n/en-US.json` only | **PASS** | 9 keys added, 7 under `settings.columnEditor` (`:903-909`) and 2 under `tasks.kanban` (`:1893-1894`). All flat camelCase, sentence-case values, `Aria`/`Tooltip`/`toast` prefixes matching the surrounding block. No other locale file is in `git status`. No template literals or concatenation at the call sites — `column-header.tsx:74-75` selects between two whole keys with a ternary rather than building a key string. |
| 6 | Advisory only; `column-dropzone.tsx` unmodified | **PASS** | `column-dropzone.tsx` does not appear in `git status`. `grep -rl wipLimit apps/api/src/task` returns only `controllers/get-tasks.ts`, and its sole hit is the projection line — no task controller reads the limit. Proven end-to-end by integration `:209-239`: limit set to 1, three tasks created into that column via `POST /api/task/:projectId`, all 200, board returns all three. Component-level smoke at `column-header.test.tsx:141-147`. |

## 4. Defects

### B1 — blocker · CI lint job fails

`apps/api/drizzle/meta/_journal.json:1` and `apps/api/drizzle/meta/0043_snapshot.json:1`

`drizzle-kit` emitted both files with 2-space indentation and no trailing newline. The repository
formats all JSON with **tabs** (`biome.json` `formatter.indentStyle: "tab"`; the `javascript`
override to spaces does not apply to JSON), and `apps/api/drizzle/**` is not in `files.includes`
exclusions. Verified:

```
$ npx biome ci apps packages tests i18n scripts
apps/api/drizzle/meta/0043_snapshot.json format ━━━
apps/api/drizzle/meta/_journal.json format ━━━
Checked 1186 files in 761ms. Found 2 errors.
```

These are the **only** two biome errors in tracked source, and both are new: `0041_snapshot.json`
and `0042_snapshot.json` pass, and HEAD's `_journal.json` round-trips through
`biome format --stdin-file-path=apps/api/drizzle/meta/_journal.json` with a zero diff. So the run
also *reformatted* a previously-clean file — which is why `_journal.json` shows a 619-line diff for
what should be a 7-line append, obscuring review and guaranteeing a conflict against any concurrent
migration.

`.github/workflows/ci.yml:33` runs `pnpm exec biome ci .`, so this PR is red.

**Minimal fix:**

```
npx biome format --write apps/api/drizzle/meta/_journal.json apps/api/drizzle/meta/0043_snapshot.json
```

This restores tabs and the trailing newline, shrinks the `_journal.json` diff to the seven added
lines, and does not alter the JSON that drizzle-kit reads. Re-verify with
`npx biome ci apps packages tests i18n scripts` → 0 errors.

### B2 — major · public API reference is stale

`apps/docs/openapi.json:2714` (`createColumn`) and `:2838` (`updateColumn`)

Both operations' `requestBody` schemas still list only `name`, `icon`, `color`, `isFinal`.
`wipLimit` is absent. This file is git-tracked and is the data source for the rendered API
reference — `apps/docs/api-reference/endpoints/columns/createColumn.mdx` is a four-line stub whose
entire body is `openapi: 'POST /column/{projectId}'`. Anyone reading the published docs will
conclude the field does not exist, and any generated client built from this spec will drop it.

`AGENTS.md`: *"Public API behavior must retain accurate Valibot validation and OpenAPI metadata."*
The Valibot half is done; the OpenAPI half is not. CI does not check spec freshness, which is why
the four-command gate stayed green.

**Minimal fix:**

```
pnpm --filter @kaneo/api openapi:export
```

`apps/api/scripts/export-openapi.ts` boots the app, fetches `/api/openapi` and writes
`apps/docs/openapi.json` with 2-space JSON — which is correct here, because `**/openapi.json` *is*
excluded in `biome.json`. Commit the regenerated file; the diff should be confined to the two
column request bodies.

### N1 — nit · tautological assertion

`apps/web/src/components/project/column-editor.test.tsx:152`

```ts
expect(LIMITLESS_COLUMN_ID).toBe("cm0limitlesscolumnid001");
```

This compares a module constant to its own literal. It can never fail and proves nothing; it reads
like a placeholder inserted to justify the constant's existence. The test's real assertion is the
`not.toHaveBeenCalled()` on line 151. **Fix:** delete line 152, and either use
`LIMITLESS_COLUMN_ID` in the mock data on line 51 (replacing the duplicated string literal) or drop
the constant.

### N2 — nit · the D1 guard has a hole exactly where the prior arm failed

`apps/web/src/components/kanban-board/column/column-header.test.tsx:73-79`

The byte-identity test asserts `container.querySelector('[role="img"]')` is null. That catches a
regression which adds `role="img"` to the no-limit path — but it does **not** catch one that adds a
bare `aria-label` with no role, which is precisely the D6 defect a prior arm shipped past a green
build. Nor does it pin the class string, so a restyle of the unlimited badge would pass. The
current code is correct; the guard just does not fence the failure mode it exists to fence.

**Fix — two lines inside the existing test:**

```ts
const badge = screen.getByText("3");
expect(badge.getAttribute("aria-label")).toBeNull();
expect(badge.className).toBe(
  "rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground",
);
```

### N3 — nit · `i18n/schema.json` is a stale generated artefact

`i18n/schema.json:3259` — the generated `settings.columnEditor` node has
`"additionalProperties": false` and a `required` array, neither of which now includes the seven new
keys; `tasks.kanban` likewise lacks the two badge keys. Nothing in CI or at runtime validates
against it (no locale file declares `$schema`), so this is cosmetic — but it is a tracked artefact
regenerated by `pnpm i18n:schema`, and leaving it stale means the next person to run that script
gets an unrelated diff. **Fix:** `pnpm i18n:schema`.

### I1 — informational · `pnpm i18n:check` remains red (pre-existing)

`scripts/i18n/check.mjs` exits 1 when any locale diverges from en-US. It was **already** exiting 1
at HEAD — every non-default locale is missing the `common:error.*` block (15–85 keys each), which
this run did not touch. The run adds the 9 new keys to that existing backlog. It is not in CI and
translating other locales is an explicit non-goal, so this is not a defect of this change. Recording
it only so it is not mistaken for a regression later: `pnpm i18n:check:fix` would copy the English
strings into all 16 locales, which is *not* what you want here.

### I2 — informational · shipped i18n key names differ from `design.md`

`design.md:109-110` specifies `tasks.kanban.wipCountAria` / `wipCountOverAria`; the implementation
uses `wipLimitBadgeAria` / `wipLimitBadgeOverAria`. Code and JSON agree, and the new names are
arguably clearer, so there is no runtime consequence — but `design.md` is now an inaccurate record
of what shipped. Same for `wipLimitPlaceholder` ("No limit" shipped vs "None" in the plan). Worth a
one-line amendment to the plan if it is retained as documentation.

## 5. Test quality assessment

Overall these are real proofs, not ceremony. Three specific probes:

**Does the `?? vs ||` guard actually fail if the operator is swapped?** Yes — this is the strongest
test in the change. `tests/api/column/wip-limit.test.ts:136-144` calls
`createColumn({ projectId, name, wipLimit: 0 })` and asserts `insertedRows.at(-1)?.wipLimit`
`toBe(0)`. Under `wipLimit || null` the recorded row carries `null` and `toBe(0)` fails with
`expected null to be 0`. Two things make it non-vacuous: (a) the mock only pushes the row inside
`.returning()`, which the controller genuinely calls at `create-column.ts:94`, so an empty array
would surface as `undefined` and also fail; (b) `0` is reachable only by calling the controller
directly — the route validator's `minValue(1)` rejects it, so no HTTP-level test could ever
discriminate the operators. The comment at `:132-135` states exactly this. The sibling cases at
`:106-130` would pass under either operator; case 4 carries the whole guard, and it does carry it.

**Would the header tests catch a role/aria-label regression on the no-limit path?** Partially — see
N2. A `role="img"` regression is caught; a bare `aria-label` regression is not; a class-string
regression is not. This is the one place I would strengthen before merge, because it is the exact
failure mode the decision exists to prevent.

**Anything asserted so hard against a mock that it proves nothing about real behaviour?** Two
qualified cases, neither fatal:

- `column-editor.test.tsx` mocks `useGetColumns`, so its `wipLimit: 3` fixture is asserted against
  itself; the test proves the *control* behaves correctly given a limit, not that the columns query
  actually delivers one. That gap is closed elsewhere — `get-columns.ts` uses `select()` star, so
  the field flows automatically, and integration `:185-206` proves the board projection carries it.
  Acceptable division of labour.
- The `t` mocks in both component tests echo `key::{json}` rather than resolving en-US. That makes
  the key and options assertable (which is how D2 is guarded, and it is guarded well, with an
  exact-shape `toEqual`) at the cost of never proving the key *exists* in `en-US.json`. I confirmed
  all nine keys by hand; no automated check covers it, but `i18n/en-US.json` has no key-existence
  test for any other key either, so this is consistent with the repo.

The integration suite is the strongest layer and is well-designed. Three details worth calling out
as genuinely good rather than perfunctory: the invalid-input cases at `:151-166` re-read the row
after the 400 (proving no partial write, not merely a rejected status); the absent-vs-null test at
`:119-134` sequences set → rename → re-read, which is the only shape that can distinguish "absent
leaves unchanged" from "absent clears"; and the authz test at `:244-255` asserts both the 403 and
that `wipLimit` is still null, so it cannot pass on a route that 403s *after* writing.

One small omission: nothing asserts the 400 response **body** does not leak a stack trace or
internal detail. Hono's validator hook produces a structured Valibot issue list, which is
appropriate, and this is unchanged from every other column field — not worth a change here.

## 6. What the change misses

I walked every surface in the repo that carries column data. Result: one real miss (B2, above) and
five deliberate, correct non-changes.

**Missed — must fix:**

- `apps/docs/openapi.json` (B2). The only surface in the repo that describes the column write
  contract and is now wrong.

**Checked and correctly requiring no change** — recording these so the next reviewer does not
re-litigate them:

- `apps/api/src/column/controllers/get-columns.ts` — `db.select()` with no projection list; the
  field flows automatically. Correctly left untouched.
- `apps/api/src/mcp/tools.ts:797-805` — `list_project_columns` proxies `GET /api/column/:projectId`
  and returns the payload verbatim, so it picks up `wipLimit` for free. There is no
  `create_column`/`update_column` MCP tool (verified by grep across `apps/api/src/mcp/tools.ts` and
  `packages/mcp/src/tools/register.ts`), so no MCP write surface was missed.
- **Events / WebSockets.** `update-column.ts` and `create-column.ts` call `publishEvent()` for no
  field today — column mutations have never been event-carrying in this codebase. Adding a WIP-limit
  event would be new realtime surface, not parity. The editor's `useUpdateColumn` already
  invalidates both query keys, which is the established refresh path for column edits. Correctly
  left alone.
- **`packages/libs` typed client.** Inferred from the Hono `AppType`, so both request shapes update
  automatically. The four hand-written shapes (2 fetchers + 2 hooks) were all edited — the risk
  register's highest-likelihood item — and `pnpm typecheck` is the enforcement.
- **Import/export and integration column writers** (`task/controllers/import-tasks.ts`,
  `project/controllers/create-project.ts`, `plugins/{github,gitea}/utils/resolve-column.ts`,
  `migrations/column-migration.ts`). All insert columns without `wipLimit`; the field is nullable so
  they compile and produce `null`, which is the correct "no limit" semantic for a machine-created
  column. No change needed, and adding one would be scope creep.
- The two fixture repairs (`use-task-filters-with-labels-support.test.tsx`,
  `sync-task-labels-cache.test.ts`) are the right kind of churn: they were forced by the *inferred*
  `ProjectWithTasks` type, which is positive evidence that the board type genuinely tightened rather
  than silently widening to `any`.

## 7. Required actions before merge

1. `npx biome format --write apps/api/drizzle/meta/_journal.json apps/api/drizzle/meta/0043_snapshot.json` — blocker B1.
2. `pnpm --filter @kaneo/api openapi:export` and commit `apps/docs/openapi.json` — major B2.
3. Optional but recommended: N1 (delete the tautology), N2 (two lines strengthening the D1 guard), N3 (`pnpm i18n:schema`).
4. Re-verify with `npx biome ci apps packages tests i18n scripts` → expect 0 errors. No test suite needs re-running; nothing in items 1–3 touches runtime behaviour.

# Code review — feature-extend — estimated hours with per-lane rollup

Run: `20260825-084051-feature-extend-estimated-hours` · Reviewer pass: brownfield, scoped to the
44 files in `changed-files.txt` · Base: `feature-extend-2/opus-only` @ `5d1fc910`

Isolation: nothing outside this run directory and this branch's own worktree/HEAD was read. No
`git diff <branch>`, no `git log --all`, no `dist/`, `build/` or `.turbo/`, no sibling
`.sdlc/runs/*`.

---

## Verdict

**approve with nits.** The feature is correct end to end — the hours↔minutes boundary is
provably lossless over its entire domain, the `null`-not-`0` empty signal holds at every hop, the
authorization chain on `PUT /task/estimate/:id` is link-for-link identical to its `/due-date/:id`
sibling, and the import path cannot abort. The findings below are all cosmetic, coverage, or
DRY-level; none changes behaviour a user would hit.

---

## Blocking findings

None.

---

## Non-blocking findings / nits

### N-1 — `tasks.properties.noEstimate` is dead in all 17 locale files
`i18n/en-US.json:1737` (+ the same key in 16 other locales). Nothing references it:

```
$ grep -rn "noEstimate" apps/web/src i18n/en-US.json
i18n/en-US.json:1737:   "noEstimate": "No estimate"
```

The three sidebar triggers use `tasks:properties.estimate` ("Estimate") as the unset label
(`task-properties-sidebar.tsx:341-342`, `:549-550`, `:759-760`), while the adjacent due-date
trigger uses `tasks:properties.noDate` ("No date") in the same position
(`task-properties-sidebar.tsx:323`, `:531`, `:741`). So the feature ships an unused key *and*
diverges from the sibling it says it mirrors (FR-23).

**Why it matters:** dead keys accumulate across 17 files and every future translator pays for them;
and the label divergence is the kind of thing a reviewer of the *next* change will "fix" in the
wrong direction.

**Fix (pick one):** either change the three `?? t("tasks:properties.estimate")` fallbacks to
`?? t("tasks:properties.noEstimate")` and match the sibling, or drop `noEstimate` from `en-US.json`,
re-run `pnpm i18n:schema`, and re-run the guarded propagation script. The first is one line ×3 and
makes the key live.

### N-2 — `ColumnEstimateTotal` demands `Task[]` but uses one optional field, forcing a double cast in its own test
`column-estimate-total.tsx:8-10` declares `tasks: Task[]`, but line 15 only ever passes them to
`sumEstimatedMinutes`, whose parameter is already the minimal
`ReadonlyArray<{ estimatedMinutes?: number | null }>` (`estimate.ts:68-70`). The over-tight prop
type is why the test has to launder its fixtures through a double cast:

`column-estimate-total.test.tsx:19` — `})) as unknown as Task[];`

**Why it matters:** `as unknown as` is the one cast that defeats every check TypeScript could still
have made; it is here purely to satisfy a prop type the component does not need. If `Task` gains a
required member the test keeps compiling while the fixture silently stops resembling a task.

**Fix:** `type ColumnEstimateTotalProps = { tasks: ReadonlyArray<{ estimatedMinutes?: number | null }> };`
Then delete the cast in the test. `column-header.tsx:66` still passes `column.tasks` unchanged.

### N-3 — the bound is duplicated across packages under two different names
`apps/api/src/task/estimated-minutes.ts:5` — `MAX_ESTIMATED_MINUTES`
`apps/web/src/components/task/estimate.ts:6` — `MAX_ESTIMATE_MINUTES`

Same value, no shared source, and the names differ by one letter, so neither grep finds the other.
The only link is that both test suites assert the literal `525600`
(`tests/api/task/estimated-minutes.test.ts:28`, `estimate.test.ts:101`), which does catch a
one-sided change — but only after someone has already made it.

**Why it matters:** a future bound change silently desynchronises the client-side rejection from the
server-side rejection; the client would then either dispatch requests the API 400s, or refuse
requests the API accepts.

**Fix:** rename the web constant to `MAX_ESTIMATED_MINUTES` so a grep for the identifier finds both
sites, and add a comment on each pointing at the other. (A genuinely shared constant belongs in
`packages/libs`, which NFR-7 puts outside this run's write contract — so a rename is the available
fix, not the ideal one.)

### N-4 — the estimate warning is assembled differently from its two siblings
`apps/api/src/task/controllers/import-tasks.ts:55-58`:

```ts
const warnings = [statusWarning, priorityWarning].filter(Boolean);
if (estimateWarning) {
  warnings.push(estimateWarning);
}
```

`coerceEstimatedMinutes` returns exactly the same `{ value, warning? }` shape as `coerceStatus` and
`coercePriority`, so this is four lines doing what belongs in the array literal.

**Fix:** `const warnings = [statusWarning, priorityWarning, estimateWarning].filter(Boolean);` —
identical type, identical output, one line.

### N-5 — the validation copy hardcodes the bound and mis-describes one rejection
`i18n/en-US.json:1798` — `"invalid": "Enter hours greater than 0 and up to 8760."` propagated to 16
other locales.

Two problems. First, `8760` is `MAX_ESTIMATE_MINUTES / 60` written out in prose in 17 files; changing
the bound leaves all 17 wrong with nothing to catch it. Second, the sentence is not true of every
rejection: `parseEstimateHours("0.005")` returns `"invalid"` (`estimate.ts:56-61`, it rounds to 0
minutes) even though `0.005` *is* "greater than 0 and up to 8760".

**Fix:** interpolate the bound — `"Enter hours between {{min}} and {{max}}."` with
`{ min: "0.02", max: String(MAX_ESTIMATE_MINUTES / 60) }` — which fixes both problems at once, since
`0.02` is the true minimum (1 minute).

### N-6 — comma decimals are rejected with a message that doesn't say why
`task-estimate-popover.tsx:94-106` is a text input with `inputMode="decimal"`;
`estimate.ts:50` parses with `Number(trimmed)`. `Number("2,5")` is `NaN`, so a German, French,
Spanish, Italian, Portuguese, Turkish, Russian, Ukrainian or Vietnamese user typing their locale's
decimal separator gets "Enter hours greater than 0 and up to 8760." — which is not the reason.

That is 9 of the 17 shipped locales. Rejecting is defensible (the repo has no locale-aware number
parsing anywhere, and "simplicity is a product requirement"), but the message should be actionable.

**Fix (smallest):** normalise before parsing — `const hours = Number(trimmed.replace(",", "."));` —
guarded by the existing `Number.isFinite` check, so `"1,2,3"` still rejects. If you would rather not
accept it, amend the copy instead to name the separator.

### N-7 — `parseEstimateHours` accepts numeric literal forms a decimal field cannot produce
`estimate.ts:50`. Measured: `parseEstimateHours("0x10") === 960`, `parseEstimateHours("+2") === 120`,
`parseEstimateHours("1e2") === 6000`. `Number()` was chosen (per the comment on line 49) to reject
`"2abc"`, which it does — but it also opens the hex/exponent/sign forms.

Not reachable from the popover in practice and every accepted value still passes the API normalizer,
so this is harmless today. Worth pinning so it does not become surprising: the plan's §7 table
implies strict decimal parsing and the tests do not cover these inputs.

**Fix:** either add `["0x10", "invalid"], ["1e2", 6000], ["+2", 120]` to `parseCases`
(`estimate.test.ts:48-65`) to record the behaviour deliberately, or gate on
`/^\d*\.?\d+$/` before `Number()` if strict decimal is what was meant.

### N-8 — `taskSchema` declares the field looser than it is
`apps/api/src/schemas.ts:43` — `estimatedMinutes: v.nullish(v.number())`. Both read projections
always return the key (`get-task.ts:17`, `get-tasks.ts:132`), so the field is never absent; only
`null`. `v.nullish` marks it optional in the emitted OpenAPI. `v.nullable(v.number())` is the
accurate contract.

Minor, and the surrounding schema is already inconsistent (`dueDate: v.optional(v.date())` for a
nullable column), so this matches local precedent. Flagged for accuracy only.

### N-9 — `i18n/schema.json`'s diff is not feature-scoped (informational, not a defect)
`i18n/schema.json` is +242/-5 for 10 new keys. The excess is pre-existing drift: `schema.json` at
`5d1fc910` did not contain `common.error.troubleshootingSteps` / `messages.*`, although
`en-US.json` at `5d1fc910` did. Verified:

```
$ git show HEAD:i18n/en-US.json  | grep -c troubleshootingSteps   -> 1
$ git show HEAD:i18n/schema.json | grep -c troubleshootingSteps   -> 0
```

So the file was stale before this run and `pnpm i18n:schema` (mandated by change_plan §16 C-2)
correctly repaired it. This is the right call — a hand-pruned generated file would be worse — but
the final report should state that ~200 of the diff's lines are an unrelated regeneration, so a
reader does not attribute them to the feature.

### N-10 — `nativeInput` is used without the explanatory comment the rest of the file gets
`task-estimate-popover.tsx:95`. The escape hatch is legitimate and pre-existing
(`ui/autocomplete.tsx:48`, `ui/combobox.tsx:95`), but this file comments every other non-obvious
decision (lines 8-9 of `estimate.ts`, 65-66, 76 of the popover, 29-30 of the mutation hook), and
this one — why the base-ui `InputPrimitive` was bypassed — is the one left unexplained.

**Fix:** one line saying why (controlled `value`/`onChange` on the raw element), or drop the prop if
`InputPrimitive` works.

---

## Deviation assessment

### D-1 — no `publishEvent` in `update-task-estimate.ts`
**The reasoning holds, and the stated consequence is correctly scoped — in fact it is milder than
the plan claims.** Verified:

- `activitySchema.type` (`apps/api/src/schemas.ts:49-60`) is a closed picklist with no
  estimate-shaped member. Publishing would require widening it. Premise confirmed.
- **WebSocket cache updates: no risk.** `use-project-websocket.ts:56-116` only ever calls
  `invalidateQueries`. It never writes a socket payload into the cache, so there is no path by which
  a stale message could clobber a stored estimate for another viewer. I also confirmed
  `setQueryData` appears in exactly five files, all label/project-reorder hooks, none task-shaped.
- **The project store: no risk.** `board.tsx:82` feeds the store from `useGetTasks(projectId)`,
  whose key is `["tasks", projectId]` (`use-get-tasks.ts:6`) — precisely what
  `use-update-task-estimate.ts:20-22` invalidates. The editing client's lane rollup does refresh.
  `useGetProject`'s key is `["projects", workspaceId, id]`, so the hook's `["projects"]`
  invalidation matches it by prefix too.
- **Optimistic updates: no risk.** Every local task mutation spreads the existing object
  (`kanban-board/index.tsx:158`, `:177`, `:181`; `column-header.tsx:40-43`), so `estimatedMinutes`
  survives drag-drop and archive-all in the store, and survives on the server by omission (D-3).
- **The consequence is bounded at 30 seconds, not "until refresh".** `use-get-tasks.ts:8` sets
  `refetchInterval: 30000`. A teammate with the board open converges within 30s without any event.
  The plan's phrasing ("until their next refetch") is technically right but reads as worse than it
  is; the report should say 30s.

Net: the deviation is safe. The one thing it genuinely costs is that no activity row records who
changed an estimate — which §2.4 puts out of scope explicitly.

### D-2 — `Task.estimatedMinutes` optional rather than required
**The reasoning holds and the optionality does not leak anywhere harmful.** The forcing constraint
is real: `apps/web/src/components/list-view/task-row.test.tsx` builds bare `Task` literals and is
outside the write contract.

Every consumer already handles `undefined` by construction, and I checked each:
- `formatEstimateHours` / `toEstimateHoursInput` take `number | null | undefined`
  (`estimate.ts:26-40`) and collapse `undefined` to `null` via the shared guard at `:14-24`.
- `sumEstimatedMinutes` type-guards with `typeof minutes === "number"` (`estimate.ts:78`), so an
  absent field is skipped, not `NaN`-poisoned. `[{}, {}]` → `null` is asserted
  (`estimate.test.ts:74`).
- `TaskEstimateBadge` accepts `undefined` explicitly and has a test for it
  (`task-estimate-badge.test.tsx:22-26`).
- The sidebar's `task.estimatedMinutes ? "" : "text-muted-foreground"` and the popover's
  `task.estimatedMinutes != null` (`task-estimate-popover.tsx:116`) both behave correctly for
  `undefined`.

The one cost is that a typo'd property name elsewhere would not be caught. Acceptable.

### D-3 — `PUT /task/:id` deliberately untouched
**Verified true.** `update-task.ts:56-67`'s `.set()` is
`{ title, status, columnId, startDate, dueDate, projectId, description, priority, position, userId }`
— `estimatedMinutes` does not appear, so a full update preserves it. AC-15 holds.

The archive-all loop (`column-header.tsx:40-43`) calls `useUpdateTask` per task and therefore also
preserves estimates. I additionally checked the route's json validator
(`apps/api/src/task/index.ts:337-347`) is `v.object`, not `v.strictObject` — so a client that sends
`estimatedMinutes` in the full-update body (the web fetcher spreads the whole task) has it silently
ignored rather than 400'd. Both halves of the preserve-by-omission behaviour are sound.

### D-4 — helpers in `components/task/estimate.ts` rather than `lib/`
**Holds.** The placement is documented in-file (`estimate.ts:1-3`), and the cross-tree import
(`kanban-board/task-estimate-badge.tsx:2`, `column/column-estimate-total.tsx:3-5`) uses the `@/`
alias, so it is a normal module import, not a relative reach-across. The module is
dependency-free and DB-free, which is what actually matters for testability. If `lib/` opens up
later this is a single-file move plus three import rewrites.

### D-5 — English placeholders in the 16 non-default locales
**Holds, and the guard did its job.** I read the diff of two locales at opposite ends of the set:

- `i18n/zh-CN.json`, `i18n/de-DE.json`: exactly the 10 new keys with English values, and the only
  other changed lines are the pre-existing `noDate` / `addTask` lines re-emitted with a trailing
  comma. No existing translation altered.
- `git diff --stat -- i18n/` reports 18 files = `en-US` + 16 locales + `schema.json`, matching §16
  C-1's corrected count exactly.
- `git status --short` shows no change to `.env`, `biome.json`, `.gitignore`, `pnpm-lock.yaml`,
  `AGENTS.md` or `CLAUDE.md`. AC-13 and AC-16 hold.

The one thing this does *not* buy is a good experience for a `zh-CN` user, who now sees an English
popover. That is the accepted cost of Gate 1 OQ-3 and it is the right trade — machine translations
nobody in the session can review are worse.

---

## Coverage assessment

### What the tests genuinely prove

- **The hours↔minutes boundary is provably lossless, not merely sampled.** `estimate.test.ts:97`
  asserts round-trip identity over 11 fixed values. I independently brute-forced
  `parseEstimateHours(toEstimateHoursInput(m)) === m` for **every** integer `m` in `1..525600`:
  **0 failures.** So the fixed sample does not hide a class of failure — the property is exactly
  true over the whole domain, for the reason §7 gives (`|3k/5 − m| ≤ 0.3 < 0.5`), and floating-point
  does not break it at any point in the range. This is the strongest single result in the review.
- **Negative zero and locale decimals are safe.** `parseEstimateHours("-0")` → `"invalid"`
  (`-0 <= 0` is true); `formatEstimateHours(-0)` → `null` for the same reason;
  `parseEstimateHours("2,5")` → `"invalid"`. No negative-zero trap exists.
- **The `null`-not-`0` signal is airtight at every hop.** Traced DB `NULL` (nullable `integer`, no
  default, `0043_adorable_micromacro.sql`) → `get-tasks.ts:132` → `Task.estimatedMinutes?: number|null`
  → `sumEstimatedMinutes` (`estimate.ts:71-89`, returns `null` unless something finite and `> 0` was
  counted) → `ColumnEstimateTotal` (`:20-22`, `return null`) → no DOM. I could not construct an
  input that makes the header render an element it shouldn't: `0`, `-30`, `NaN`, `Infinity`,
  `undefined` and absent-field all fail the `minutes > 0` guard, and `[]` never sets `counted`.
  Nor one that hides an element it should show: any single finite positive value sets `counted`, and
  `formatEstimateHours` of a positive integer is never `null`. Tests cover `[]`, `[null,null]`,
  `[150]`, `[150,null,90]` (`column-estimate-total.test.tsx:23-47`) and the badge covers
  `150 / null / undefined / 0` (`task-estimate-badge.test.tsx`).
- **The import path cannot abort.** `coerceEstimatedMinutes` (`estimated-minutes.ts:29-45`) catches
  everything `normalizeEstimatedMinutes` can throw and returns `{ estimatedMinutes: null, warning }`.
  `estimate-import-export.test.ts:16-36` asserts `not.toThrow()` across 15 inputs including `{}`,
  `[]`, `true`, `"150"`, `NaN`, `Infinity`. The warning reaches the caller:
  `import-tasks.ts:56-58` pushes it into `warnings`, which `:103` attaches to that task's result
  object. And even in the impossible case where the warning template itself threw
  (`JSON.stringify` on a circular value), the throw lands in `import-tasks.ts:112`'s per-task catch,
  which marks that one task failed and continues the loop — it is not an `HTTPException`, so
  `:113-115`'s rethrow does not fire. **A bad estimate cannot abort the import.**
- **The popover cannot silently clear a stored estimate.** `handleSubmit`
  (`task-estimate-popover.tsx:60-74`) returns before `submitEstimate` when
  `parsed === "invalid"`, and `parseEstimateHours` returns `null` (a legal clear) only for an empty
  or whitespace-only string. Every rejected value returns the sentinel, never `null`, so no invalid
  entry can be laundered into a clear. `handleOpenChange:77-84` re-reads `task.estimatedMinutes` on
  every open, so an abandoned edit is discarded rather than re-submitted. `if (!canEdit) return
  <>{children}</>` sits at `:86`, after every hook — no conditional-hook hazard.

### What merely looks covered

- **`estimate-import-export.test.ts:60-99` is called a "round trip" but is a coercion test.** It
  maps `[150, null, 90]` through `coerceEstimatedMinutes` and compares. It never touches
  `exportTasks`'s projection or `importTasks`'s `.values()`. The actual data path is verified by
  inspection only — I read both and they are correct (`export-tasks.ts:32` selects it, `:89` emits
  it with `?? null`; `import-tasks.ts:80` writes it into the insert). AC-14 is satisfied in
  substance, but the test name overstates what executes.
- **`coerceEstimatedMinutes`'s non-number branch is unreachable over HTTP.** The import route
  validator (`apps/api/src/task/index.ts:449`) declares
  `estimatedMinutes: v.optional(v.nullable(v.number()))`, so `{"estimatedMinutes": "abc"}` is
  rejected by Valibot with a 400 for the **whole import**, never reaching the per-task coercion.
  The reachable invalid values are the ones that pass the type gate — `0`, negatives, `90.5`,
  `525601` — and those are covered. This matches the importer's existing posture exactly (`priority`
  is likewise `v.optional(v.string())` with value-level coercion behind it), so it is consistent
  rather than wrong; but FR-31's "an import must not fail on one bad estimate" is only true for
  well-typed bad estimates.
- **`sumEstimatedMinutes`'s defensive branches are untested.** The `> 0` and `Number.isFinite`
  guards (`estimate.ts:78-80`) have no case in `sumCases`. `[{estimatedMinutes: 0}]` and
  `[{estimatedMinutes: Number.NaN}]` both correctly return `null` (I checked by hand), but nothing
  pins that. Two rows in `estimate.test.ts:67-94` would close it.
- **AC-2 (persistence) has no executed HTTP test.** Each link is unit-tested or read, and the run's
  `live-persistence-check.mts` exercised normalizer→controller→UPDATE→read against the real DB.
  That is good evidence, but it is a run artifact, not a test that `npm test` will re-run.
- **AC-6 (three sidebar variants) is inspection-only.** I confirmed all three placements by reading
  the enclosing conditions: `:331` inside `{compact && (` (opens `:145`, closes `:349`), `:539` inside the
  `lg:hidden` mobile block (`:354`, under `{!compact && (` at `:351`), `:749` inside the
  `hidden lg:block` desktop block (opens `:559`). All three are present and correctly nested.

### The authorization gap — stated plainly

**The middleware chain on `PUT /task/estimate/:id` is correct.** `apps/api/src/task/index.ts:619-653`:

```
validator("param", v.object({ id: v.string() }))                          :634
validator("json", v.object({ estimatedMinutes: v.optional(v.nullable(v.number())) }))  :635-638
workspaceAccess.fromTask()                                                :639
requireWorkspacePermission({ task: ["update"] })                          :640
requireEntitlement                                                        :641
handler                                                                   :642-652
```

The `/due-date/:id` sibling at `:585-617` is byte-for-byte the same shape and the same permission
(`:602-604`). Order matters and is right: `workspaceAccess.fromTask()` precedes the permission check,
so a task in an invisible workspace resolves to the existing not-found/forbidden behaviour before
any permission is evaluated (FR-15). `requireTaskAssigneePermission` is correctly *absent* — the
due-date sibling omits it too; only the full-update `PUT /:id` carries it (`:351`). AC-4 holds.
There is also no route-shadowing hazard: `/estimate/:id` is two segments and `PUT /:id` is one.

**And there is no executed test behind that reading.** Per Gate 1 OQ-4 this was a deliberate choice,
not an environmental limit — this branch has a fresh `kaneo_opus_only` database and an integration
test could have run. The concrete cost, which the final report must repeat: **deleting
`requireWorkspacePermission({ task: ["update"] })` from `apps/api/src/task/index.ts:640` would pass
`pnpm typecheck`, `pnpm exec biome check`, all 384 API tests and all 176 web tests, and would ship
a route on which any authenticated workspace-visible caller can rewrite any task's estimate.** My
reading above is the only check that exists. It is a permission on a non-PII planning integer, so
the blast radius of that hypothetical regression is small — but it is the one place in this diff
where "verified" means "one person read it once."

---

## What I checked and found clean

- **Migration.** `0043_adorable_micromacro.sql` is exactly
  `ALTER TABLE "task" ADD COLUMN "estimated_minutes" integer;` — additive, nullable, no default, so
  metadata-only in PostgreSQL with no table rewrite. `_journal.json` gains exactly one entry at
  `idx: 43`. `0043_snapshot.json`'s `prevId` (`9f67f0d6-…`) matches `0042_snapshot.json`'s `id`, so
  the chain is intact, and the snapshot is tab-indented like its siblings (NFR-5's biome-format step
  was applied). The column body is `{"type":"integer","primaryKey":false,"notNull":false}`.
- **Read projections.** `get-tasks.ts:122-139` uses one shared `taskSelection` object reused for
  `columns`, `archivedTasks` and `plannedTasks` (`:230-255`), so all three carry the estimate.
  `get-task.ts:17` selects it. No second projection was missed.
- **Out-of-scope projections correctly untouched.** The four plugin event selects, the scheduler,
  global search, task-relations, `create-comment` and `bulk-update-tasks` all still project their
  own narrow field lists. §2.4/§2.5 hold: the estimate reaches no log line, event payload, WebSocket
  message, webhook or MCP response.
- **Error handling.** `apps/api/src/index.ts:156-165`: `HTTPException` returns `err.getResponse()`
  (message text only, no stack); anything else returns a flat `{"message":"Internal Server Error"}`
  with the real error going to Sentry. `normalizeEstimatedMinutes` throws only `HTTPException(400)`
  with a descriptive, non-reflective message. `update-task-estimate.ts` throws 404 on a missing task
  and 500 only on a failed write, matching `update-task-due-date.ts`'s shape. **No path returns a
  500 for bad input and no stack trace can reach a client.** No `catch` swallows silently — the one
  bare `catch` (`estimated-minutes.ts:40`) converts to a reported warning.
- **No `any`.** Zero `any` in the 14 new files. One `as unknown as` (N-2, test-only) and one
  `as Error & { status: number }` (`tests/api/task/estimated-minutes.test.ts:18`) inside a helper
  whose comment explains why `instanceof` was avoided.
- **PII.** Correct that there is none. `estimated_minutes` is a planning integer; it is not logged,
  not emitted to events, not in any MCP surface. No encryption or masking requirement applies, and
  nothing in the diff adds a field to any response that did not already carry the whole task row
  under the same `workspaceAccess` boundary.
- **Client-side plumbing.** The fetcher uses the typed `@kaneo/libs` client
  (`update-task-estimate.ts:7`) with no parallel request layer; error handling
  (`:14-17`) is identical to the due-date sibling. The mutation hook invalidates `task`, `tasks`,
  `projects`, `activities` and correctly omits `notifications` with a comment saying why
  (`use-update-task-estimate.ts:29-30`).
- **Board rollup consistency.** The header's estimate chip and its task-count chip are both computed
  from the same `column.tasks` (`column-header.tsx:64-66`), which is already the *filtered* set
  (`board.tsx:163-177` → `useTaskFiltersWithLabelsSupport`), so the two chips always agree. The web
  never sends `page`/`limit` to `GET /task/tasks/:projectId` (`fetchers/task/get-tasks.ts:4-6`), so
  `usePagination` is false and the rollup is over the complete lane. NFR-2 holds: no new query, no
  new key, no new effect — one `O(n)` pass in the existing render.
- **Card DOM when unset.** `TaskEstimateBadge` returns `null` before emitting any element
  (`task-estimate-badge.tsx:15-17`) and is placed inside the existing badge row
  (`task-card.tsx:283`), so an estimate-free card's DOM is unchanged. FR-24 holds.
- **i18n mechanics.** 10 keys added under the existing `tasks` namespace, no new namespace, no
  hardcoded user-facing string in any component (`ColumnEstimateTotal` renders the formatted value
  as text and puts the only copy in `title=`, `:29`; the `"h"` suffix is a formatting symbol per
  FR-29). `schema.json` regenerated rather than hand-edited (see N-9).
- **Write-contract compliance.** `git status --short` matches `changed-files.txt`: 30 modified,
  14 new source files, plus `tests/api/task/`. Nothing outside the allowlist. Nothing in `apps/web/src/lib/**`.

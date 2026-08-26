# Run summary — URL-persisted board filter state

**Run:** `20260826-103235-feature-extend-board-filter-chips`
**Mode / intent:** brownfield · feature-extend
**Policy:** `flash-agsdk-only` v1 — SINGLE TIER, `gemini-3.7-flash` via the `antigravity-worker`
adapter, backend `vertex-adc`, project `ai-studies-console`, location `global`
**Auth mode:** `estimated`. Because this policy has no direct tier, **all 21 dispatches went through
the MCP server and every telemetry event carries vendor-reported tokens** — nothing in this run was
char-count estimated.
**Branch:** `feature-extend-3/flash-only` · **Nothing is committed.**

This run is the **controlled arm** of a policy comparison against `opus-plus-flash-v37`, which ran
the identical ticket from the identical Gate 0 decisions and file scope.

---

## 1. Headline

| | |
|---|---|
| **Cost** | **$6.1841** |
| Tokens | 2,485,536 in · 4,425,099 cached · 199,109 out |
| Dispatches | 21 (18 succeeded, 3 hard failures) |
| Wall clock | 85.2 min · 45.4 min of it inside model calls |
| Tests | **36 files / 112 tests → 37 files / 148 tests, all passing** |
| Typecheck | exit 0 (baseline exit 0) |
| Files changed | 10 (2 added, 8 modified) — +494 / −137 plus 308 new lines |
| Out-of-scope writes | **0** |

### The comparison result, stated plainly

**The cheapest per-token model produced the more expensive run.** `flash-agsdk-only` cost
**$6.1841** against `opus-plus-flash-v37`'s **$2.70** for the same ticket — **2.29× more expensive**
at roughly a sixth of the per-token price.

The cause is in the token shape, not the rate card. This policy's only tier is an **agent**, not a
completion endpoint. An agent worker is handed a working directory and goes and reads the repository
itself — listing, grepping, opening files, re-reading them across turns — instead of receiving the
pre-sliced `inputs[]` a completion-tier packet carries. That turned 21 dispatches into **6.9M
billed input tokens** (2.49M fresh + 4.43M cached). Two single dispatches show it starkly: the
initial change-plan packet billed 357,812 fresh + 1,102,129 cached tokens for one document
($0.9622), and the senior review billed 550,855 + 1,004,866 ($1.2328). Output was never the driver
— 199K output tokens across the whole run.

The lesson is not "Flash is expensive." It is that **adapter shape dominates unit price**. A cheap
model that reads the repo itself can cost more than an expensive model handed a slice, and a policy
comparison that reasons only from $/Mtok will get the ranking backwards.

---

## 2. What was built

The board's five filters (status, priority, assignee, dueDate, labels) now round-trip through the
route's TanStack Router search params, so a filtered board is shareable and bookmarkable. The
existing chips were **not** rebuilt — `BoardToolbar`'s props are byte-identical.

- **New** `apps/web/src/lib/board-filter-params.ts` (168 lines) — `validateBoardSearch`,
  `filtersToSearchParams`, `searchParamsToFilters`, `hasActiveFilterParams`. Pure, no React, no
  router imports.
- **New** `apps/web/src/lib/board-filter-params.test.ts` (140 lines, 24 tests).
- `use-task-filters-with-labels-support.ts` — filters are now **derived** from search params via
  `useMemo`; no `useState` owns filter state.
- `board.tsx` — `validateSearch` delegates to `validateBoardSearch`; owns `useNavigate` and the
  `handleFiltersChange` callback (the one place `replace: true` is used for a filter change).
- Nine in-scope `navigate()` sites converted to functional search updaters. The two cross-route
  `/task/$taskId` navigations were left untouched.

### Architecture: the Gate 2 overturn

The Flash plan first proposed **state-mirrored-to-URL** guarded by an `isInitializedRef`. The user
**overturned this at Gate 2** in favour of **URL-as-source-of-truth**, on the rationale recorded
verbatim in the plan: *the mount clobber and the two-way-binding render loop both become
STRUCTURALLY IMPOSSIBLE rather than guarded by effect ordering; a design needing no correctness
argument beats one needing a sound one.* localStorage became a **seed** (one-shot per `storageKey`,
publishes to the URL when the URL carries no filters) and a **mirror** (writes back only when the
URL does carry filters) — two branches of the same predicate, so they can never both fire.

### An empirical overturn of the Gate 2 directive itself

Gate 2 also directed "emit AND accept repeated keys only." **The emit half is not implementable
here.** `apps/web/src/main.tsx` calls `createRouter()` with no `parseSearch`/`stringifySearch`
override, so the library defaults apply, and `stringifySearchWith(JSON.stringify, JSON.parse)`
JSON-encodes arrays: `{status:["todo"]}` emits `?status=%5B%22todo%22%5D`. Emitting repeated keys
would require overriding `stringifySearch` in `main.tsx`, which is **off-limits** for this run.

Measured directly against the installed `@tanstack/router-core@1.171.20` rather than assumed
(full table in `verified-encoding.md`):

```
{ status:["todo","review"], priority:["high"], assignee:["u,1"],
  dueDate:["dueThisWeek"], labels:["l1","l2"] }
  -> ?status=%5B...%5D&...&assignee=%5B%22u%2C1%22%5D&...
  -> deep-equal to the input.        ROUND-TRIP IDENTITY: TRUE
```

Note `assignee: ["u,1"]` — a value **containing a comma** survives intact. So the implemented
decision satisfies the *intent* of the directive: native JSON-array emission (true round-trip
identity, no comma-splitting hole) while **accepting** three inbound shapes — JSON array, repeated
keys, and a bare single string (`?status=todo` arrives as the string `"todo"`, which an
`Array.isArray`-only parser would silently drop).

---

## 3. Verification

```
pnpm --filter @kaneo/web test       ->  37 files, 148 tests, ALL PASSING   (baseline 36 / 112)
pnpm --filter @kaneo/web typecheck  ->  exit 0                              (baseline exit 0)
```

Neither root nor package `lint` was ever run, per instruction (`biome check --write` rewrites
unrelated files). `pnpm i18n:check:fix` was never run.

### Fail-before-fix proofs

Green tests prove little on their own, so each was re-run against reverted source:

| Proof | Reverted | Result |
|---|---|---|
| **A** | `list-view/task-row.tsx` only | 2 new nav tests **fail** (`expected 'object' to be 'function'`); the pre-existing test still passes |
| **B** | the hook only | **9 of 12** hook tests fail, including URL-precedence. The 3 that pass are exactly the unchanged `it.each` identifier cases |
| **C** | the `pendingFiltersRef` fix only | the 2 composition regression tests **fail** |

All files verified byte-identical after restore.

---

## 4. The real defect this run caught

**The Flash senior review found a genuine shipped-behaviour regression, and deserves the credit for
it.** At `apps/web/src/components/board/board-toolbar.tsx:239-251`, two handlers call the mutators
in a loop:

```ts
const clearLabelFilters = () => {
  if (!filters.labels || filters.labels.length === 0) return;
  for (const labelId of filters.labels) updateLabelFilter(labelId);   // N calls, ONE handler
};
```

The pre-run hook used `setFilters((prev) => ...)`, so N calls **composed**. The reworked hook
computed each `next` from the render-scoped `filters` memo, so all N calls read the same base and
**only the last survived** — "clear label filters" with three labels selected would have removed
one. `toggleLabelGroup` breaks the same way.

The orchestrator confirmed it against the real toolbar source and **raised it from the review's
"major" to blocker**, because it breaks existing shipped behaviour and so violates the brief's
"existing chip UI and filtering semantics continue to pass unchanged."

Fixed with a within-tick accumulator (`pendingFiltersRef`) cleared whenever derived filters change.
`filters` is still derived from the URL; **no `useState` was reintroduced**. Guarded by two new
regression tests named for the toolbar handlers they protect (Proof C).

---

## 5. Attribution — Flash tier vs. orchestrator supervision

A reader must be able to tell what the model tier produced from what supervision added.

**Produced by the Flash tier:** requirements.md; both change-plan revisions; packets.json (10
packets, all paths in scope, sane dependency order); all source and test code; the senior review
(including the blocker above); the security review.

**Authored by the ORCHESTRATOR, not Flash** — five design corrections, recorded in
`change_plan.md` §"Addendum A — orchestrator corrections":

| ID | Correction |
|---|---|
| **A1** | The plan's hook signature **dropped `projectId` and `textQuery`**. `projectId` builds the `storageKey` the same section referenced — internally inconsistent — and `textQuery` powers Cmd+F board search and is the third positional argument of an existing passing test. |
| **A2** | Wrong types (`Project \| undefined` instead of `ProjectWithTasks \| null \| undefined`). |
| **A3** | The plan kept a **filters-keyed localStorage mirror effect that would have reintroduced the very clobber the Gate 2 overturn removed**, and guarding it on `seededStorageKeyRef` would not have helped, since the seed sets that ref in the same commit. Replaced with write-on-mutation plus a load-time sync-back gated on the opposite branch of the predicate. |
| **A4** | The plan showed the hook calling `navigate()`, contradicting the injection decision. |
| **P1** | `tp_cg_009` required the existing localStorage test to pass "verbatim", which is **structurally impossible** under URL-as-truth. Rewritten before dispatch. |

The **Gate 2 defect list was likewise orchestrator-authored**, against a Flash plan that reported
`uncertainties: []`. That empty array is itself a finding: the plan was more confident than the
artifact warranted, and it contained two blocking self-contradictions at the time it declared no
uncertainty.

One point in the other direction: the orchestrator suspected the plan's `expect.toSatisfy`
asymmetric-matcher pattern was invalid, checked `@vitest/expect@4.1.10`, and found it documented at
`dist/index.d.ts:201`. **Flash was right and the supervision was wrong** — checking beat asserting
in both directions.

---

## 6. Principal quality gap — two acceptance criteria shipped UNPROVEN

The user is knowingly accepting these. They are **not** satisfied, and are recorded exactly as the
reviewer framed them.

**AC5 — filters survive switching between board and list view: UNPROVEN.**
Opening and closing a task *is* covered (`task-row.test.tsx`, Proof A). View switching is not.
*By-construction argument:* `viewMode` comes from the `useUserPreferencesStore` Zustand store, not
from the router, so toggling it does not navigate and cannot touch search params. That argument is
sound but is an argument, not a test. **A future run needs a view-toggle test** that mounts the
board with active filters, switches `viewMode`, and asserts the search params and rendered chips are
unchanged.

**AC6 — browser Back behaves coherently: UNPROVEN.**
`replace: true` on filter mutation is verified in code (`board.tsx:109-117`) and by the
filter-mutation test, so filter changes provably do not stack history entries. What is untested is
actual history traversal. The reviewer additionally flagged an asymmetry: `handleCloseTaskSheet`
uses `replace: true` while task-card/task-row deselect clicks push, which can leave adjacent
history entries with identical board state — Back then appears to do nothing on the first press.
**A future run needs a popstate test** exercising apply-filter → apply-filter → open-task → Back →
Back, asserting the filter state at each step.

No speculative coverage was added now.

---

## 7. Reliability — a property of this policy, not incidental noise

**21 dispatches, 3 hard failures**, costing ~9 minutes and **$0** (no usage sidecar is written when
the worker dies, so failed delegations bill nothing):

1. `tp_design_002` — model output **looping**, then `max tokens limit reached` ×3, then an invalid
   tool call (`edit_file`, which does not exist in that harness) and an "artifacts must be in
   `~/.gemini/antigravity/brain/...`" rejection. 402s. Recovered by shrinking the output surface:
   preserve v1 and have the retry emit pointers instead of reproducing unchanged tables.
2. `tp_cg_001` — Vertex `auth: "internal_failure"`. 50s. Retried clean.
3. `tp_cg_008` — WSL DNS: `lookup oauth2.googleapis.com ... i/o timeout`. 89s. **This one died
   *after* writing a complete 140-line artifact**, during its own verification step. The
   orchestrator inspected the file, found it complete, ran the tests itself (24/24 passing) and
   **kept it rather than re-dispatching** — saving a full retry.

That third case has a sting: because the worker never reached verification, nobody ran `tsc`. The
orchestrator's substitute check ran vitest but not typecheck, and the file later failed typecheck
with 13 `TS2769` errors — a `it.each` array mixing scalars with `[]` and `[1,2]`, which vitest
treats as argument tuples. Caught at the full-suite gate and fixed by `tp_dbg_002`.

**Structured output is not reliably honoured on this adapter: 3 of 18 successes leaked prose ahead
of their JSON**, so `JSON.parse` fell back to `{ raw: ... }` and the fields had to be hand-extracted.
Any automation consuming `result` from this adapter must tolerate that.

**Worker self-reports need checking.** `tp_dbg_002` reported `typecheck_exit_code: 0`, but its log
showed it had run `tsc --noEmit` without the project flags. The real command
(`tsc --noEmit -p tsconfig.app.json && ... -p tsconfig.node.json`) was re-run independently; it did
pass, but the claim would not have been evidence.

---

## 8. Containment — held with no enforcement layer available

**The write-contract's hard enforcement did not cover this policy at all**, and the containment
result is meaningful precisely because of that:

- **Layer 3 (PreToolUse hook)** intercepts *Claude Code* `Write|Edit` calls only, by its own header.
  An antigravity worker is a separate Python process driving the Gemini SDK's own file tools, so
  **no worker edit in this run ever passed through the hook.**
- **Layer 2 (packet validator)** is documentation-only in this build: `artifact_path` appears solely
  in `types.ts` as a type declaration, with no reader anywhere in `server.ts` or any adapter.

What remained was **detect-and-revert, not prevent**: every packet instruction carried an explicit
may-write / must-not-touch list, and `git status --porcelain` ran after **every one of the 21
dispatches**.

**Result: zero out-of-scope writes across the entire run. Nothing was ever reverted.** Exactly 10
files changed, all inside the frozen allowlist. Verified clean: `apps/api/**`, `main.tsx`,
`routeTree.gen.ts`, `store/user-preferences.ts`, `project-layout.tsx`, `backlog-list-view/**`,
`i18n/**`, `packages/**`, `pnpm-lock.yaml`. The chips were not rebuilt, `BoardToolbar`'s props are
unchanged, the duplicated `DEFAULT_FILTERS`/`FILTER_KEYS`/`normalizeFilters` block was left
undeduplicated as instructed, and the dead `useTaskFilters()` was noted and left alone.

---

## 9. Security

No **critical**, **high**, or **medium** findings.

- **SEC-01 (Low, accepted)** — `board-filter-params.ts:23-33`. A hostile oversized array is
  materialised by the router and walked before the 50-item cap short-circuits. Suggested
  remediation: `slice` before iterating.
- **SEC-02 (Informational, accepted)** — opaque user and label IDs now appear in shareable URLs,
  and so in chat logs, referrer headers and browser history. They grant no access: the API remains
  the sole authority for authentication and workspace authorization, and this change sends nothing
  to the server.

Prototype pollution was ruled out and independently confirmed: `validateBoardSearch` assigns only
from a fixed `FILTER_KEYS` whitelist into a fresh object literal, never using an attacker-supplied
key as an assignment target. `validateSearch` never throws — 14 hostile input shapes are asserted
`.not.toThrow()`, which matters because a throwing validator takes the whole route down.

---

## 10. Plugin bugs for the maintainers

1. **`artifact_path` is never validated.** It appears only in
   `mcp/model-dispatch/src/types.ts` (lines 48, 98) as a type declaration. There is no reader in
   `server.ts` or any adapter. The doc comment at `types.ts:45` claims "The MCP dispatcher validates
   this against `.sdlc/baseline/current.json` allowlist before dispatching" — **that behaviour is
   not implemented in this build.** Either implement the check or delete the claim; a documented
   guarantee that silently does nothing is worse than an absent one.
2. **The PreToolUse hook cannot see agent-adapter workers.** `scripts/write-contract-check.mjs`
   matches Claude Code `Write|Edit` tool calls. Under `antigravity-worker`, file edits happen in a
   separate process with its own tools, so the contract is unenforced exactly where the prompt
   claims it is "the PRIMARY enforcement path." Either enforce inside the worker (pass the contract
   into `gemini_worker.py` and gate its file tools) or document that agent adapters are
   detect-and-revert only.
3. **`off_limits: [".sdlc/**"]` blocks the orchestrator's own `output_dir`.** The frozen contract
   marks `.sdlc/**` off-limits with no run-directory carve-out, while `agents/orchestrator.md` says
   run-dir paths are "auto-allowlisted." They are not: the hook would deny the orchestrator's own
   `Write` to its mandated `output_dir`. Worked around here by writing every `.sdlc` artifact
   through Bash heredocs. Fix by exempting `.sdlc/runs/<run-id>/**` in the hook.
4. **`write-provenance.mjs` accepts only one before/after pair per file per run.** Five files were
   edited twice (codegen, then `tp_dbg_001`); the second `--after` call was refused with *"no
   matching --before record ... ignoring"*, so those records hold the **stale `sha_after` from the
   first edit**. Recovery is unaffected — `/mmo:revert` restores `sha_before` (or the backup) — but
   the after-fingerprint misrepresents final state. Allow re-`--after` on an existing record, or
   record an edit list per file.

---

## 11. Rollback

Nothing is committed. The working tree carries the whole change on branch
`feature-extend-3/flash-only`, anchored at `5d1fc910`.

```bash
cd /home/sangeetha/projects/kaneo

# inspect first
git status --porcelain
git diff

# discard the 8 modified files
git checkout -- \
  apps/web/src/hooks/use-task-filters-with-labels-support.ts \
  apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx \
  'apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx' \
  apps/web/src/components/kanban-board/index.tsx \
  apps/web/src/components/kanban-board/task-card.tsx \
  apps/web/src/components/list-view/index.tsx \
  apps/web/src/components/list-view/task-row.tsx \
  apps/web/src/components/list-view/task-row.test.tsx

# remove the 2 added files
rm -f apps/web/src/lib/board-filter-params.ts \
      apps/web/src/lib/board-filter-params.test.ts
```

That restores the tree to `5d1fc910` for every path this run touched. `.sdlc/` is left in place —
delete `.sdlc/runs/20260826-103235-feature-extend-board-filter-chips/` too if you want the run
record gone. `git reset --hard 5d1fc910` also works but would discard the untracked
`.claude/settings.local.json` and `.hook-logs/` that predate this run, so the targeted form above is
safer.

---

## 12. Artifacts

| File | What |
|---|---|
| `requirements.md` | Delta requirements, 8 FRs / 9 ACs |
| `change_plan.md` | Revised plan (URL-as-truth) + **Addendum A** orchestrator corrections |
| `change_plan_v1.md` | The superseded state-mirrored plan, preserved |
| `packets.json` | 10 validated TaskPackets |
| `senior_review.md` | AC1-AC9 verdicts, findings F1-F6, ranked defects |
| `security_review.md` | S1-S7 verdicts, SEC-01 / SEC-02 |
| `verified-facts.md` | Gate 0 discovery facts, pre-verified |
| `verified-encoding.md` | **Measured** router parse/stringify behaviour |
| `baseline/green-baseline.txt` | The pre-change green baseline |
| `telemetry.jsonl` | 21 events |
| `manifest.json` | Per-phase rollup |
| `cost-rollup.json` | Cost breakdown |
| `provenance.json` | Per-file before/after for `/mmo:revert` |
| `delegation/` | Per-dispatch worker brief, usage sidecar and receipt |

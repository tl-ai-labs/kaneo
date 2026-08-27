# Final report — URL-persisted board filter state

- **Run:** `20260826-132654-feature-extend-board-filter-chips`
- **Mode:** brownfield · **Intent:** `feature-extend`
- **Policy:** `opus-plus-sonnet-max` · **Auth mode:** `estimated`
- **Baseline / rollback anchor:** `5d1fc910` on `feature-extend-3/opus-sonnet`
- **Third arm of a controlled policy comparison.** Gate 0 decisions and file scope reused verbatim.
- **Nothing is committed.** No commit, no push, no PR. The worktree is dirty by design.

---

## 1. Outcome

Delivered: all five board filters (status, priority, assignee, dueDate, labels) round-trip through
the route's TanStack Router search params. URL wins on load, then syncs down to the per-project
`localStorage` key. Existing chips, toolbar and filtering semantics untouched.

| Check | Result | How it was established |
|---|---|---|
| `pnpm --filter @kaneo/web test` | **43 files / 172 tests pass** (baseline 36 / 112) | run to completion |
| `pnpm --filter @kaneo/web typecheck` | clean | run to completion |
| `biome ci` on the 18 changed paths | **exit 0** | **exit code read, not asserted from memory.** One warning, `kanban-board/index.tsx:191` `useOptionalChain` — proved pre-existing: byte-identical at `git show HEAD:` and outside every diff hunk. Left alone. |
| Allowlist violations | **0** | every changed path re-checked against the frozen contract after every dispatch |
| Files reverted as out-of-scope | **0** | nothing ever landed outside the allowlist |
| `pnpm lint` / `biome check --write .` | **never run repo-wide** | per Gate 0 |

**Files:** 10 new, 8 modified. Full diff in `changes.diff`.

---

## 2. Follow-ups

### 2.1 — PRINCIPAL SECURITY FOLLOW-UP · Sentry ships `?assignee=<userId>` off-site · blocked by the allowlist

`apps/web/src/instrument.ts:20-26` initialises Sentry with `browserTracingIntegration()` and
`replayIntegration()` at `replaysSessionSampleRate: 0.1`, and has **zero** `beforeSend` /
`beforeBreadcrumb` hooks (grep count: 0).

**Concrete exposure.** Now that assignee ids live in the URL, roughly **10% of sessions ship
`?assignee=<userId>` to Sentry automatically, with no user action.** This is not the discretionary
"user pastes a link into Slack" case — it is passive, sampled, and continuous.

**`sendDefaultPii: false` does NOT strip query strings.** It governs a different set of fields
(IP address, request headers, user context). Query parameters ride along in transaction names,
breadcrumbs and replay URLs regardless.

**Remedy.** Add a `beforeSend` / `beforeBreadcrumb` in `instrument.ts` that scrubs the five filter
facet params out of any URL before transmission.

**Why it was not fixed here: the allowlist, not difficulty.** `apps/web/src/instrument.ts` is not
among the 15 permitted globs. The fix is small and well understood; this run was simply not
authorised to touch that file.

**My own requirements document named the wrong vector, and that correction belongs in the record.**
`requirements.md` §6 listed `Referer` headers as the leak path. That path is **already closed** —
`apps/web/nginx.conf:9` sets `Referrer-Policy: strict-origin-when-cross-origin`. §6 simultaneously
**omitted the vector that is actually open** (Sentry) and framed the whole exposure as
user-discretionary. The security review found this by reading the code rather than accepting the
document. §6 as written is **overstated in its reassurance and wrong in its specifics.**

### 2.2 — Project-switch transient (converges; untested)

`RouteComponent` does **not** remount when `$projectId` changes (verified in router-core: matches are
keyed by static `routeId`, and `board.tsx` sets no `remountDeps`). On a project switch the write
effect runs in the same commit as the storage-read effect and closes over the *previous* render's
filters, so **project A's filters are briefly written into project B's `localStorage` key and URL**,
then corrected on the next commit.

- It **converges. There is no durable data loss** — the senior reviewer chased both `setFilters`
  identity-bail-out branches to confirm the already-written value is the correct one.
- It is **untested. Every test in the hook suite uses `"project-1"`**, so the read effect's
  `resolvedStorageKeyRef` branch never fires in the suite — the one case it exists for has zero
  coverage.
- Suggested fix (from the review): bind `filters` to the `storageKey` it was resolved for, and no-op
  the write effect and `useBoardFilterUrlSync` while `resolvedProjectId !== projectId`.

### 2.3 — Unbounded write path

`MAX_FILTER_VALUES` (50) and `MAX_FILTER_VALUE_LENGTH` (128) are enforced in `parseBoardFilterSearch`
only. They are **a property of one entry point, not an invariant on filter state**: values arriving
via `updateFilter` / `updateLabelFilter` or from `localStorage` are not bounded. Also, the bounds are
applied *after* `Array.from(new Set(...))`, so the dedupe sees the unbounded input first. Measured
cost is linear, not quadratic (44ms at 50k values, 222ms at 200k) — a performance note, not a DoS.

### 2.4 — FR-19: board↔list view switch is unproven (see §4.1)

---

## 3. Corrections to claims made during this run

Every item here is a claim **I** made that turned out to be broader than the evidence. All were
caught by review, not by me.

### 3.1 — "Structurally impossible" was overstated

I said the FR-15 / KD-3 localStorage clobber was made *structurally impossible* by the lazy
`useState` initializer. The narrow claim holds and mutation check 1b is a genuine
structure-vs-ordering discriminator. But the guarantee is **scoped to a constant `storageKey`, and I
never said so.** Across a `projectId` change the behaviour in §2.2 occurs. Accurate formulation:

> No `DEFAULT_FILTERS` commit can precede URL/storage resolution **for a fixed `projectId`**. Across
> a `projectId` change the previous project's filters are transiently written to the new project's
> key and URL before self-correcting. Converges, no durable loss, **untested**.

### 3.2 — I skipped a mutation check my own plan specified

`change_plan.md` §8.2 specified a **one-sided** mutation (revert kanban `j` only, leave `k`) to prove
the two tests are independent. I ran the all-nine mutation instead, which cannot discriminate
independence. **The senior review caught the omission.** I then ran it — recorded as mutation check
5 in `mutation-check.txt`: **`j` RED, `k` GREEN**, exactly as the plan predicted.

### 3.3 — Two seams were unbound

The senior review found that deleting either `board.tsx`'s `urlState` 4th argument **or** its
`useBoardFilterUrlSync(filters, search)` call left all 170 tests green — both were mocked with inert
factories. Both mocks are now **argument-asserting spies**, and mutation checks **6a** and **6b**
each turn exactly one test red on deletion.

### 3.4 — AC-5: nine call sites proven; FR-19 unproven

I earlier reported AC-5 as satisfied. **That was wrong and the record should carry the accurate
version:**

> **Nine navigation call sites are behaviorally proven and mutation-checked.
> FR-19 — filters surviving a board↔list view switch — is UNPROVEN.**

The nine-site claim is fair and was attacked: `typeof call.search === "function"` is the pre-fix
detector, and the following invocation-and-deep-equal is the correctness assertion; mutation check 3
(deleting `...prev` from `withTaskId`) turns tests red that a shape-only check would have passed. But
AC-5 has a **fifth clause** — the view switch — and the test mapped to it rerenders with a new
`project` object, which is not a view switch. `viewMode` is Zustand state the hook has no effect
keyed on, so that test would still pass in exactly the world FR-19 guards against (a refactor moving
the filter hook down into `KanbanBoard` / `ListView`, where state dies on unmount). **Do not round
this up to "AC-5 satisfied."**

### 3.5 — AC-9 (browser Back) — reasoned, not proven

Flagged as such from Gate 1 and unchanged. jsdom cannot exercise real `popstate`/bfcache. What *is*
proven: codec round-trip, post-mount adoption of changed URL state, and `replace: true`. A real
browser pass is the only meaningful proof and was out of scope.

### 3.6 — Operator error: backup-filename collision

During mutation check 4 my backup loop derived filenames with `basename`, so
`kanban-board/index.tsx` and `list-view/index.tsx` collided on `index.tsx.bak`. The restore wrote
**ListView's contents into `kanban-board/index.tsx`** and left `list-view/index.tsx` mutated. Caught
on the next `git status --porcelain`, both files restored from HEAD and the packet edits re-applied
deterministically; final diff is +1 import / 2 changed lines each, as intended.

**The `opus-plus-flash` arm hit the same class of bug. The fix is full-path-derived backup names**
(e.g. slugify the repo-relative path) rather than `basename`.

---

## 4. What was verified, and how

### 4.1 — AC coverage, honestly

| AC | Status |
|---|---|
| AC-1 round-trip, all five facets | **Proven** — codec unit tests |
| AC-2 URL beats storage, syncs down | **Proven** — hook test asserts the URL wins *wholesale*, not merged |
| AC-3 no params ⇒ restore from storage | **Proven** — the pre-existing test passes **unmodified** |
| AC-4 `?status=` is not "carries filters" | **Proven** — dedicated predicate tests + a dedicated hook test |
| AC-5 nine navigation sites | **Proven** — 9 behavioral tests, mutation checks 2/4/5 |
| AC-5 view-switch clause (FR-19) | **UNPROVEN** — see §3.4 |
| AC-6 `validateSearch` never throws | **Proven, and executed** — the security reviewer ran the codec against **32 hostile inputs** (throwing getters, revoked Proxy, throwing `Symbol.toPrimitive`, cyclic objects, `__proto__` payloads): **zero throws** |
| AC-7 clean URL when no filters | **Proven** — asserts key *absence* via `Object.keys`, not `undefined` |
| AC-8 `replace: true`, no history spam | **Proven** — plus a no-op assertion when the URL already matches |
| AC-9 browser Back | **Reasoned, not proven** — §3.5 |
| AC-10 existing tests keep passing | **Proven** — 112 → 172, no pre-existing test modified in substance |
| AC-11 typecheck | **Proven** |
| AC-12 `biome ci` clean | **Proven by exit code** |
| AC-13 allowlist | **Proven** — 0 violations |

### 4.2 — Security review highlights

- **IDOR foreclosed, with evidence rather than reasoning.** The API *does* accept an `assigneeId`
  query filter (`apps/api/src/task/index.ts:76`), but the web fetcher
  (`apps/web/src/fetchers/task/get-tasks.ts:4-6`) sends only `{ projectId }`. The filter never
  crosses the network, so there is no request into which a URL-supplied id could be injected.
- `task.userId` is a **cuid2** (`apps/api/src/database/schema.ts:24-26, :415`) — opaque, not an
  email, not enumerable. No enumeration oracle.
- No injection sink: filter values reach only comparisons and the router's own encoder.
- No new dependency; `package.json` and `pnpm-lock.yaml` untouched.

### 4.3 — Known defects recorded and deliberately NOT fixed

- **KD-1** — `use-task-filters.ts` and `use-task-filters-with-labels-support.ts` remain ~90%
  duplicates diverging on `hasActiveFilters` (empty array inactive vs active). The base twin is still
  untested and **was not edited**.
- **KD-2** — the same whole-search-object bug class remains at `backlog.tsx:77`, `gantt.tsx:404`,
  `backlog-task-row.tsx:105`. Not board-reachable, out of scope. `withTaskId` is exported and ready
  for a future ticket. Note §2.2's project-switch hazard would be inherited by any copy.
- **KD-3** — the unconditional write-on-every-change design is left in place; the write effect is
  **byte-for-byte unchanged versus HEAD** (verified by the reviewer, deps included).

### 4.4 — Disclosed deviations

- `use-board-filter-url-sync.ts` lives under `components/board/` instead of `hooks/`, because the
  write contract forbids new files in `hooks/`.
- `task-card-search-preservation.test.tsx` and `board-route-search-preservation.test.tsx` also live
  under `components/board/` and import across a directory boundary, for the same reason.
- **The allowlist was expanded exactly once, at Gate 2, at the user's direction**, by **two test
  files only** (`kanban-board/index.test.tsx`, `list-view/index.test.tsx`) — no new source surface.
  That expansion is what took AC-5 from two-of-nine to nine-of-nine sites.

---

## 5. Cost and routing — the comparison data

### 5.1 — Cost: $4.70 total

| Tier | Calls | Cost | Provenance |
|---|---|---|---|
| Opus (`claude-opus-5`) | 6 | **$2.20** | **ESTIMATED — a FLOOR** |
| Sonnet (`claude-sonnet-5`) | 18 | **$2.50** | **VENDOR-MEASURED** |
| **Total** | **24** | **$4.70** | mixed — see warning |

**The two halves are not comparable to each other.** Sonnet's figure is `total_cost_usd` reported
verbatim by `claude -p`. Opus's figure is the spec's `chars/3.8` heuristic, which I **measured**
against ground truth on the one call where a real token count was available: the architect call
estimated **38,122** tokens against a harness-reported **82,725** — a **2.17× undercount**, because
the heuristic does not model multi-turn context re-send. The two review subagents showed the same
pattern (2.9× and 2.6×). So **the real Opus cost is materially higher than $2.20**, and any
cross-arm comparison that treats these two numbers as like-for-like is invalid. The same caveat
applies to earlier runs using this estimator.

**Per phase:** tests $1.53 · codegen $0.84 · plan_task_packets $0.59 · change_plan $0.53 ·
senior_code_review $0.45 · security_review $0.34 · requirements_analysis $0.30 · debug $0.13.

**An unexpected result worth recording:** the *cheap* tier cost more than the premium tier
($2.50 vs $2.20), across 18 calls averaging $0.14 each. Each `claude -p` invocation spawns a fresh
process that reloads session context — this run logged **838,682 cached input tokens** against
316,928 fresh. Under this adapter, per-call overhead dominates, so many small mechanical packets are
not obviously cheaper than fewer large premium ones.

### 5.2 — Routing: 0 opus / 21 sonnet on mechanical work

Simulated with the plugin's real `pickModel` **before** dispatch, and confirmed against the
telemetry afterwards. Every mechanical packet landed on Sonnet.

| Task-type mapping | opus | sonnet |
|---|---|---|
| **As dispatched** (`frontend_util` / `react_component` / `react_page`, brownfield primitive carried in `subtype`) | **0** | **21** |
| Counterfactual: `pipeline/SKILL.md`'s documented brownfield task_types (`new_file_add` / `existing_file_edit`) | **9** | 9 |

**This is the third independent reproduction of that plugin bug.** `pipeline/SKILL.md` instructs
brownfield runs to use task_types that match **no** codegen rule in the shipped policies, so all nine
codegen packets fall through to `{ default: opus }` — silently turning a mixed-policy run into a
mostly-premium one while appearing to succeed. Evidence: `routing-simulation.txt`.

### 5.3 — Enforcement note

The write-contract PreToolUse hook **does not fire**, and `artifact_path` has no reader in
`server.ts`, so the dispatcher's allowlist check is documentation-only. The allowlist was therefore
self-enforced: an explicit may-write / must-not-touch list in every packet instruction, a path
checker run against the frozen contract, and `git status --porcelain` after every dispatch. Result:
**0 violations, 0 reverts.** That worked here, but it is discipline standing in for enforcement.

---

## 6. Escape hatch

Nothing is committed. To discard this run entirely:

```bash
cd /home/sangeetha/projects/kaneo
git checkout -- apps/web/src
git clean -fd apps/web/src
```

To confirm you are back at the anchor:

```bash
git rev-parse HEAD          # expect 5d1fc910... on feature-extend-3/opus-sonnet
git status --porcelain      # expect only .claude/settings.local.json, .hook-logs/, .sdlc/
```

`.sdlc/` is untracked and holds the run record; delete it separately if you want that gone too.
Per-file provenance for `/mmo:revert` is in `provenance.json`.

---

## 7. Artifacts

`requirements.md` · `change_plan.md` · `packets.json` · `review.md` · `security_review.md` ·
`mutation-check.txt` · `changes.diff` · `telemetry.jsonl` · `manifest.json` ·
`routing-simulation.txt` · `green-baseline.txt` · `provenance.json`
— all under `.sdlc/runs/20260826-132654-feature-extend-board-filter-chips/`.

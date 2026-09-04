# Final Report — Board filters in URL search params

Run `20260904-061318-feature-extend-board-filter-chips` · brownfield · `feature-extend`
Policy `opus-plus-flash-v37` · mechanical tier `flash-agsdk-worker` (Antigravity SDK agent) · `auth_mode=estimated`
Branch `feature-extend-3/opus-flash-sdk` · base `5d1fc910`

---

## 1. What shipped

The Board's five filters (`status`, `priority`, `assignee`, `dueDate`, `labels`) moved from
`localStorage` (`kaneo:board-filters:${projectId}`) into TanStack Router search params. A filtered
board is now a shareable URL. Chip UI, matching semantics and default unfiltered rendering are
unchanged.

**This was not the job as typed.** The request asked for assignee/label filter chips. Discovery
found the chips already existed and were fully implemented; the missing half was URL persistence.
The brief re-scoped accordingly, and Gate 0 confirmed it before any code was written.

Encoding is comma-joined (`?status=to-do&labels=l1,l2`), hand-rolled per repo precedent. No zod, no
valibot, no new dependency. Clean cutover — existing `kaneo:board-filters:*` values are not read and
are dropped on first load, accepted as known user-visible data loss at Gate 1.

## 2. Final state — verified, not assumed

| Gate | Result |
| --- | --- |
| `pnpm --filter @kaneo/web test` | **156 passed / 41 files** (baseline 143 / 39) |
| `pnpm --filter @kaneo/web typecheck` | **pass** (run separately; not implied by the others) |
| `pnpm exec biome ci <16 paths>` | **0 errors**, 1 pre-existing warning |

The one biome warning is `lint/complexity/useOptionalChain` at
`apps/web/src/components/kanban-board/index.tsx:202`. It is **pre-existing** — verified present in
the `HEAD` copy at line 190, shifted by the +12 lines of the B1 fix. Deliberately not fixed:
out of authorised scope.

`git status` re-checked at close (not from any earlier snapshot): **10 modified + 6 new**, plus
`.claude/settings.local.json` which was already untracked before the run.

**Modified (10):** `.gitignore` · `hooks/use-task-filters-with-labels-support.ts` + `.test.tsx` ·
`components/board/board-toolbar.tsx` · `components/kanban-board/index.tsx` ·
`components/kanban-board/task-card.tsx` · `components/list-view/index.tsx` ·
`components/list-view/task-row.tsx` + `.test.tsx` · `routes/.../board.tsx`

**New (6):** `lib/board-filter-search-params.ts` + `.test.ts` · `components/board/board-toolbar.test.tsx` ·
`components/kanban-board/index.test.tsx` · `components/kanban-board/task-card.test.tsx` ·
`components/list-view/index.test.tsx`

## 3. The three bugs found by review, not by tests

All three are the same class: **an object passed to TanStack Router's `search` replaces the entire
search object.** Once filters live in search params, every such site silently wipes them. None of
these was in the original brief.

1. **The task-sheet *open* branch** (`task-card.tsx`, `task-row.tsx`) — the brief and my own
   requirements named only the *close* branch (`search: {}`). But `search: { taskId: task.id }`
   wipes just as completely, and clicking a card to open a task is the far more common path.
   Caught by the architect at Gate 2, by reading.
2. **The R1 label-group loop** — `board-toolbar.tsx` called `updateLabelFilter` in a `for` loop.
   Safe under `setState`, broken under `navigate`: each synchronous call resolves against the same
   committed location, so a colour-group toggle would apply only the last label. Fixed by batching
   into one `updateFilter("labels", next)` call.
3. **B1: `j`/`k` keyboard navigation** (`kanban-board/index.tsx:67,74`,
   `list-view/index.tsx:97,104`) — one keystroke dropped every filter. Caught by the senior
   reviewer. **The `j`/`k` code is pre-existing; the breakage is not — this run is what turned
   dormant code into a live bug.**

## 4. A test that passed against the bug it existed to catch

The first delivery of the R1 regression test asserted
`expect(searchRef.current.labels).toBe("l1,l2,l3")` — the correct assertion, on search params
rather than a spy, exactly as specified. **It passed against the buggy for-loop implementation.**

The navigate mock applied each updater to the already-mutated `searchRef.current`, so N synchronous
calls composed correctly — the opposite of the real router. Only an incidental
`toHaveBeenCalledTimes(1)` was failing, i.e. a spy assertion was silently doing the work the
search-param assertion was supposed to do.

A debug packet rewrote the mock to resolve against a `committed` snapshot re-synced in the harness
render body. Re-verified by mutation: the mutant now dies at
`expected 'l3' to be 'l1,l2,l3'`, with 4 of 5 tests failing instead of 1.

**Every behavioural fix in this run was mutation-tested by the orchestrator directly** — reverting
the source and confirming the test fails — rather than trusted from the worker's self-report. That
check is what caught the above, and it is the single most valuable practice from this run.

## 5. Two known defects deliberately left in the repo

**5.1 — `apps/web/src/components/backlog-list-view/index.tsx:97,104`** carries the byte-identical
`j`/`k` filter-wipe pattern. It was pinned off-limits and is **untouched and still buggy**. The
backlog view is out of scope for this run; this is a real defect and should be picked up by a
follow-up run, not assumed fixed.

**5.2 — the spread caveat, now covering EIGHT navigation sites.** Every one uses
`search: (prev) => ({ ...prev, ... })`:

| File | Sites |
| --- | --- |
| `routes/.../board.tsx` | `handleCloseTaskSheet` |
| `components/kanban-board/task-card.tsx` | open + close |
| `components/list-view/task-row.tsx` | open + close |
| `components/kanban-board/index.tsx` | `j` + `k` |
| `components/list-view/index.tsx` | `j` + `k` |
| `hooks/use-task-filters-with-labels-support.ts` | `setFilters` |

> **Do not convert any of these to `Object.assign(prev, ...)`.** The security review empirically
> established that object spread is what keeps this off a prototype-pollution sink: `router-core`
> builds the search object with `Object.create(null)`, and spread creates a fresh object.
> `Object.assign(prev, ...)` would mutate the router's own object and make this a genuine sink.

## 6. Security — LOW risk, no fixes required

Prototype pollution was **empirically disproven**, not assumed: the reviewer ran the actually
installed `router-core@1.171.20` parser and `Object.prototype.polluted` stayed `undefined`. Three
independent defenses (null-prototype parse, spread not mutate, six-key whitelist).

URL exposure is a negligible marginal delta — the new params are opaque UUIDs of the same class as
the `taskId` already in the URL, and the `Referer`-leak vector is closed by
`Referrer-Policy: strict-origin-when-cross-origin` at `apps/web/nginx.conf:9`. DoS was measured, not
hand-waved: 1,000 tasks × 100k comma segments costs ~129 ms, client-side only.

One Low finding (non-gating): `board-toolbar.tsx:152-154` echoes a raw param as chip text when no
column matches. React escapes it, so text-only UI spoofing, not XSS. The echo is pre-existing; this
run changed its *reachability* from self-written localStorage to attacker-suppliable URL.

Advisory: `pnpm audit --prod` shows 7 high / 4 moderate, all pre-existing transitive, no manifest
changed. The `mysql2` advisories look tooling-transitive since Kaneo targets PostgreSQL — worth a
dedicated `deps` run.

## 7. Cost — the mechanical tier cost 2.5x the premium tier

| Tier | Dispatches | Input | Cached | Output | Cost | Provenance |
| --- | --- | --- | --- | --- | --- | --- |
| Flash `flash-agsdk-worker` | 18 | 2,147,090 | 9,036,934 | 131,538 | **$5.7600** | **vendor-reported** |
| Opus (phases 1–8) | 4 | 125,000 | 725,000 | 53,530 | **$2.3258** | **modelled (char/3.8)** |
| Opus — B1 fallback tail | 1 | 25,000 | 450,000 | 4,080 | **$0.4520** | **modelled** |
| **Run total** | | | | | **$8.5378** | cap $50 |

Plus $0.1683 of Gate 0 pre-check smokes predating this run.

**Stated plainly: through Phase 5 the "cheap" mechanical tier cost $5.76 against $2.33 for the
premium tier — roughly 2.5x — consuming 2.1M input tokens to produce 132k output.** The B1 tail is
listed separately so that comparison stays clean.

**The clearest single instance is `tp_008` at $1.21**, the most expensive packet of the run. It
**ran the full test suite despite an explicit single-file instruction** in its own packet
(`pnpm --filter @kaneo/web test src/components/board/board-toolbar.test.tsx`). 439k input tokens for
one test file. This is the main evidence for whether this policy is worth using again: the agsdk
path re-reads broad context per packet, and a packet that ignores its verification scope multiplies
that. It did not time out here, but the 540 s worker deadline means the same behaviour on a slower
suite would turn correct work into a reported failure.

Against that, the tier's *quality* was high: 17 of 19 dispatches succeeded on the first attempt,
zero escalations to Opus, and the only substantive defect (the R1 mock) was caught and fixed within
the same tier.

## 8. Two findings to report upstream to the plugin

**8.1 — `preflight_dispatch` is blind to a suspended consumer.** Mid-run, the mechanical tier began
failing with `403 Permission denied: Consumer 'projects/ai-studies-console' has been suspended`
(0 tokens billed, twice). `preflight_dispatch` re-run immediately afterwards still returned
`ok: true`, because it constructs adapters without making an API call. **The check that exists
specifically to catch credential problems at second zero cannot detect this class.** A minimal
zero-cost probe would close the gap.

**8.2 — `flash-completion` is not a fallback.** It was investigated and found **equally blocked**,
not merely unused: the policy has no `auth:` block, all four AI-Studio key env vars are unset, so it
falls through to Vertex ADC on the same suspended project and returns the identical 403. Both Flash
doors sit behind one wall. `gcloud projects describe` reports `ACTIVE`, so this is a service-consumer
suspension (typically billing), not project deletion.

Because of 8.1/8.2, B1 was completed in-session on the Opus tier under explicit Gate 3 option (C)
authorisation, scoped to four paths, with the write-contract hook unchanged for everything else.

## 9. Gates and provenance

| Gate | Outcome |
| --- | --- |
| Gate 1 — requirements | approved (comma-joined; toolbar batching; clean cutover; `replace: true`) |
| Gate 2 — design | approved, option (i) — both new test files |
| Gate 3 — security | approved, option (C) — B1 fixed in-session |
| Gate 4 — final report | pending |

Provenance: **19 `files_touched` entries, 0 incomplete.** Two entries for the failed `tp_016`/
`tp_017` dispatches correctly carry no `sha_after`, recording that no write occurred.

A factual error was corrected in `design.md` §11 at Gate 2: it claimed
`.sdlc/policies/opus-flash-sdk.yaml` was already staged. It was not — verified live
(`git diff --cached` empty, `.sdlc/policies/` absent). The claim came from a stale session-start
snapshot. `git status` was re-verified before the first write and again at close.

## 10. Escape hatch

```
/mmo:revert 20260904-061318-feature-extend-board-filter-chips
```

Restores every file recorded in
`.sdlc/runs/20260904-061318-feature-extend-board-filter-chips/provenance.json`. All 16 touched paths
were untracked-or-clean at run start, so revert is unambiguous. Nothing was committed or pushed;
`git_head_after` equals `git_head_before` with 0 commits recorded.

## 11. Suggested follow-ups

1. Fix `backlog-list-view/index.tsx:97,104` (§5.1) — a `bugfix` run.
2. `use-task-filters.ts` is now genuinely dead-ish: `updateLabelFilter` is exported but unused
   app-wide after the toolbar batching. Deduplication was an explicit non-goal here; worth its own
   `refactor` run.
3. A dedicated `deps` run for the `pnpm audit` advisories (§6).
4. Consider capping segment count in `decodeFilterValue` — cheap hardening, not a defect.

# AI-SDLC Run Ledger — kaneo

One row per completed `/mmo:*` run. Newest last. Created 2026-08-26 on branch
`feature-extend-3/opus-flash`; earlier rows for this project live on other branches and are not
reachable from here.

Machine-readable twin: [`ledger.json`](./ledger.json). Project fingerprint:
[`CLAUDE-SDLC.md`](./CLAUDE-SDLC.md).

| # | Date | Run ID | Branch | Intent | Policy / Auth | Packets (mech/premium) | Cost | Tests before → after | Outcome |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2026-08-26 | `20260826-064633-feature-extend-board-filter-chips` | `feature-extend-3/opus-flash` | feature-extend | `opus-plus-flash-v37` / estimated | 16 flash / 5 opus | **$2.7024** (opus $2.3076 est · flash $0.3948 vendor) | 112 → **155**, 0 regressions | Gate 4 `accept`, uncommitted |

---

## Run 1 — URL-persisted board filter state

**Shipped.** All five board filters (status, priority, assignee, dueDate, labels) persist in the
board route's search params. URL wins on load and syncs to `kaneo:board-filters:${projectId}`;
with no filter params the previous localStorage behaviour is preserved. After mount the URL is the
single source of truth. The filter chips already existed and were **not** rebuilt.

**Files:** 11 changed — 3 added (`lib/board-filter-search-params.ts` + its test,
`components/board/board-search-preservation.test.tsx`), 8 edited (`board.tsx`,
`use-task-filters-with-labels-support.ts` + test, `kanban-board/index.tsx`,
`kanban-board/task-card.tsx`, `list-view/index.tsx`, `list-view/task-row.tsx` + test).
HEAD at start `5d1fc910`, 0 staged, not committed.

**Off-limits boundary held under real pressure.** `main.tsx`, `project-layout.tsx` and
`routeTree.gen.ts` are all untouched — and each was a genuinely tempting shortcut: `main.tsx` for
the encoding deviation, `project-layout.tsx` for the F1 nav-button symptom, `routeTree.gen.ts` for
the widened search type. The fix went into the allowlisted route and hook instead, every time.

### The most instructive event: the F1 fix was wrong on the first attempt

The Gate-3 remedy (URL-authoritative filters) shipped a sync-down effect whose stated reasoning was
that it would bail on mount because `prev` would be the all-null default. That reasoning was wrong.
The effect runs *after* the localStorage-restore effect has queued its update, so the functional
updater received the **restored** filters; with an empty URL `boardFilterSearchMatches({}, restored)`
is false and it overwrote the restore with defaults — silently breaking AC-3.

Caught by the test written in the same batch:

```
× still restores from localStorage when the URL carries no filters
    Expected: [ "label-bug" ]   Received: null
```

Fixed with `hasSyncedFromUrlRef`, skipping the effect's first invocation so mount precedence stays
with the seed/restore path. **Had the reasoning been trusted instead of tested, this would have
shipped.** The user's Gate-3 instruction to "prove those two paths still hold rather than assuming"
is what forced the test that caught it.

### Routing simulation — empirical evidence for the plugin's F-3 gap

Computed with the real `pickModel()` from the compiled router, **before any dispatch**:

| | flash-completion | opus |
|---|---|---|
| As planned (policy-recognised `task_type`, brownfield primitive in `subtype`) | **16 / 16** | 0 |
| Counterfactual (SKILL.md's brownfield `task_type` names) | 5 | **9+** |

`new_file_add` / `existing_file_edit` / `patch_apply` match **no** codegen rule in the shipped
policies and fall through to `{ default: "opus" }`. Test packets ride the `phase: tests` rule and
were never at risk. This run is the empirical evidence for that gap.

### Cost caveat — the Opus figure is a floor, not a measurement

The two halves of the split are **not strictly comparable**. Flash events carry vendor-reported
tokens (`provenance: vendor`). Opus events are estimated: subagent phases derive input as reported
subagent total minus char-estimated output, so they include per-turn context re-sends, while the
orchestrator's own in-session phases use chars/3.8 on fresh content only and exclude them.

### Call-site count evolution: 6 → 9 → 10

The seed brief said six `navigate()` sites. Reading the five files found **nine** — the brief had
missed the two `search: {}` *close* branches in `task-card.tsx` and `task-row.tsx`, which were the
most destructive of the set (they blank the whole search object). The final count is **ten**,
because the feature itself added a tenth: `handleFiltersChange`'s filter-publish navigation in
`board.tsx`. Guard assertions are 2/2/2/2/2 = 10.

### Deviation from an approved decision: URL encoding

Gate 1 explicitly chose **repeated params**. What shipped writes TanStack's **JSON default**
(`?status=%5B%22todo%22%2C%22done%22%5D`), because `main.tsx` sets no `stringifySearch`. Reads
accept repeated params *and* bare strings, so every acceptance criterion still holds and the
bare-string branch remains load-bearing for hand-typed URLs. Accepted at Gate 3; not fixed, because
it would require `main.tsx` (not allowlisted) and would change encoding app-wide.

### Incidents

- **I1 — scratch-backup basename collision.** During the first mutation check,
  `kanban-board/index.tsx` and `list-view/index.tsx` both backed up to `index.tsx.FIXED`; the
  restore put list-view's content into kanban-board. Caught by an identity grep (`expandedSections`
  present in a file that should not have it), repaired from git HEAD, edits re-applied, fully
  re-verified. The second mutation run used **full-path-derived backup names** (`/` → `_`), which
  is what prevents recurrence.
- **I2 — the F1 first-attempt failure** (above).
- **I3 — `validateBoardSearch` threw on `null`**: read `search.taskId` before any object guard, an
  AC-5 violation. Caught by the AC-5 test in the same batch.
- **I4 — Flash emitted a stray CJK character** into a mock (`() => ({ 首`). Caught on read before
  the write landed.

### Verification

`pnpm --filter @kaneo/web test` → **38 files / 155 tests passing** (baseline 36/112, captured before
any codegen). `typecheck` clean. `biome check` on changed paths clean, one pre-existing
`useOptionalChain` warning in untouched code. Root/package `lint` never run.

AC-7 mutation-checked twice, both tiers: against pre-fix sources **16 of 17 fail** (the single pass
is the pre-existing render test); restored, all 155 pass.

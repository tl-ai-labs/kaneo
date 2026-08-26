# Run Summary — URL-persisted board filter state

**Run** `20260826-064633-feature-extend-board-filter-chips` · brownfield · intent `feature-extend`
**Policy** `opus-plus-flash-v37` · **Auth** `estimated` · **Total cost $2.70** against a $50 cap (5.4%)

## What shipped

All five board filters (status, priority, assignee, dueDate, labels) now persist in the board
route's search params, so a filtered board is shareable as a link. On load the URL wins and is
written back to `kaneo:board-filters:${projectId}`; with no filter params the previous
localStorage behaviour is preserved. After mount the URL is the single source of truth.

The filter chips were **not** rebuilt — they already existed. This run added only URL persistence
plus the search-preservation fixes that make it survive contact with the rest of the board.

### Files added
- `apps/web/src/lib/board-filter-search-params.ts` — pure encode/decode/predicate + `validateBoardSearch`
- `apps/web/src/lib/board-filter-search-params.test.ts` — 17 unit tests
- `apps/web/src/components/board/board-search-preservation.test.tsx` — AC-7 guard (2 behavioural + 12 source-text)

### Files edited
`board.tsx` · `use-task-filters-with-labels-support.ts` (+ its test) · `kanban-board/index.tsx` ·
`kanban-board/task-card.tsx` · `list-view/index.tsx` · `list-view/task-row.tsx` (+ its test)

## Verification

| | Baseline (before codegen) | Final |
|---|---|---|
| Test files | 36 | 38 |
| Tests | 112 passing | **155 passing** |
| Regressions | — | **0** |

`pnpm --filter @kaneo/web typecheck` clean. `biome check` on changed paths clean (one pre-existing
`useOptionalChain` warning in untouched code). Root/package `lint` never run.

## Cost

| Tier | Model | Calls | Cost |
|---|---|---|---|
| Premium | `claude-opus-5` (in-session, estimated) | 5 | $2.3076 |
| Mechanical | `gemini-3.7-flash` (vendor tokens) | 18 | $0.3948 |
| | | **23** | **$2.7024** |

Per phase: change_plan $0.85 · senior_review $0.46 · security_review $0.41 · plan_packets $0.30 ·
requirements $0.28 · codegen $0.21 · tests $0.14 · debug $0.04.

## Routing simulation (run before any dispatch)

| | flash | opus |
|---|---|---|
| As planned | **14/14** | 0 |
| Counterfactual (SKILL.md brownfield task_types) | 5 | **9** |

Empirical confirmation of the plugin's F-3 routing gap: `new_file_add` / `existing_file_edit` /
`patch_apply` match no codegen rule in the shipped policies and fall through to
`{ default: "opus" }`. Using policy-recognised `task_type` values with the brownfield primitive in
`subtype` kept the entire mechanical tier on Flash.

## Key artifacts
`requirements.md` · `change_plan.md` · `packets.json` · `review.json` · `security_review.md` ·
`manifest.json` · `telemetry.jsonl` · `provenance.json` · `evidence/ac7-mutation-check.txt` ·
`evidence/full-diff.patch`

## Read `manifest.json` for
6 recorded deviations (incl. the encoding deviation D3), 5 accepted risks, 4 incidents, and the
list of deliberately-untouched code.

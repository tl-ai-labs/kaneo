## Task tp_review_001 — senior_code_review / module_review
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Senior code review of a completed brownfield change. Be adversarial: your job is to find what is WRONG, not to confirm it is fine. There is no reviewer after you.

STEP 1 — run `git diff` plus `git status` in the working directory to see every change, and read these files in full:
  apps/web/src/lib/board-filter-params.ts            (new)
  apps/web/src/lib/board-filter-params.test.ts       (new)
  apps/web/src/hooks/use-task-filters-with-labels-support.ts
  apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx
  apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx
  apps/web/src/components/{kanban-board,list-view}/*.tsx
Also read .sdlc/runs/20260826-103235-feature-extend-board-filter-chips/change_plan.md INCLUDING its '## Addendum A', which is binding.

STEP 2 — write your review to .sdlc/runs/20260826-103235-feature-extend-board-filter-chips/senior_review.md

VERDICT PER ACCEPTANCE CRITERION. For each of the nine below, state PASS / FAIL / UNPROVEN and cite the specific line or test that justifies it. UNPROVEN means the code looks right but nothing verifies it — say so rather than calling it PASS.
  AC1 all five filters round-trip through the URL
  AC2 URL params win on load and are written back to localStorage
  AC3 no filter params in URL restores from localStorage
  AC4 an empty param such as ?status= does NOT count as "URL carries filters"
  AC5 filters survive opening a task, closing a task, and switching board/list view
  AC6 browser Back behaves coherently
  AC7 validateSearch never throws on malformed, hostile or null input
  AC8 a board with no active filters produces a clean URL with no empty params
  AC9 filter changes do not push a history entry per interaction

PAY SPECIAL ATTENTION TO, and give each its own finding:
  F1 THE SEED/SYNC-BACK PAIR. The seed effect fires when hasActiveFilterParams is false; the sync-back when it is true. Are they genuinely mutually exclusive on every render, including the render immediately after the seed navigates? Can the seed's own navigation cause a loop? Can a returning user's stored filters ever be overwritten with an empty set? Trace it concretely.
  F2 THE ONE-SHOT REF. seededStorageKeyRef is set BEFORE the localStorage read. Is that right? What happens when projectId changes, when the component remounts, and when localStorage is empty?
  F3 STALE CLOSURES. filters is derived by useMemo from searchFilters. updateFilter/updateLabelFilter/clearFilters close over `filters`. If two filter chips are toggled in rapid succession before the URL round-trips, is the second update computed from stale filters, losing the first? This is the most likely real defect — examine it properly and say plainly whether it can happen.
  F4 VIEW SWITCHING. viewMode comes from the user-preferences zustand store, not the router. Confirm whether switching board/list actually preserves filters, and whether any test covers it.
  F5 THE BACK BUTTON. Given filter mutations use replace:true and task open uses push, walk the actual history stack. Is there a sequence where Back appears to do nothing?
  F6 board.tsx's handleFiltersChange spreads filtersToSearchParams(next) over prev. Does clearing a filter actually REMOVE the key, or leave a stale value? Check what filtersToSearchParams returns for an inactive filter and what spreading undefined does.

Also check: BoardToolbar's props are unchanged; useTaskFilters() dead code untouched; DEFAULT_FILTERS/FILTER_KEYS/normalizeFilters still duplicated and NOT deduplicated; no off-limits file touched (apps/api, main.tsx, routeTree.gen.ts, store/user-preferences.ts, project-layout.tsx, backlog-list-view, i18n).

End with a RANKED defect list. For each: severity (blocker/major/minor/nit), file:line, why it is wrong, and the concrete fix. If you find no blockers, say so explicitly rather than inventing one.

STEP 3 — SCOPE. Write exactly ONE file: the senior_review.md above. Modify NO source file — you are reviewing, not fixing. You may run read-only commands and `pnpm --filter @kaneo/web test` / `typecheck` to confirm current state. Do NOT run biome, prettier, eslint, `pnpm lint` or `pnpm i18n:check:fix`.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### VERIFICATION-STATE
_Included because: Current measured state of the branch, so you do not have to re-derive it. Baseline before the change was 36 files / 112 tests green, typecheck exit 0._

```
AFTER the change:
  pnpm --filter @kaneo/web test       -> 37 files, 146 tests, ALL PASSING
  pnpm --filter @kaneo/web typecheck  -> exit 0

MUST-FAIL-BEFORE PROOFS (already executed by the orchestrator):
  Reverting ONLY apps/web/src/components/list-view/task-row.tsx to its pre-change form makes the
  two new navigation tests fail with "expected 'object' to be 'function'" while the pre-existing
  test still passes.
  Reverting ONLY the hook to its pre-change form makes 9 of the 12 hook tests fail, including the
  URL-precedence test. The 3 that still pass are the unchanged issue-identifier it.each cases.

FILES CHANGED IN THIS RUN (git status):
  M apps/web/src/components/kanban-board/index.tsx
  M apps/web/src/components/kanban-board/task-card.tsx
  M apps/web/src/components/list-view/index.tsx
  M apps/web/src/components/list-view/task-row.tsx
  M apps/web/src/components/list-view/task-row.test.tsx
  M apps/web/src/hooks/use-task-filters-with-labels-support.ts
  M apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx
  M apps/web/src/routes/.../project/$projectId/board.tsx
  ?? apps/web/src/lib/board-filter-params.ts
  ?? apps/web/src/lib/board-filter-params.test.ts
Nothing else. No off-limits path was touched.
```
### Acceptance criteria
- senior_review.md gives an explicit PASS/FAIL/UNPROVEN verdict with evidence for each of AC1-AC9
- Findings F1-F6 each appear with a concrete trace, not a restatement
- F3 states plainly whether rapid successive filter toggles can lose an update
- The defect list is ranked by severity with file:line and a concrete fix for each
- No source file was modified
- files_written contains exactly one path, senior_review.md
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "artifact_path": {
      "type": "string"
    },
    "ac_verdicts": {
      "type": "object",
      "description": "AC1..AC9 mapped to PASS | FAIL | UNPROVEN"
    },
    "blockers": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "majors": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "f3_stale_closure_possible": {
      "type": "boolean",
      "description": "true if rapid successive filter toggles can lose an update"
    },
    "off_limits_violations": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "files_written": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "artifact_path",
    "ac_verdicts",
    "blockers",
    "majors",
    "f3_stale_closure_possible",
    "off_limits_violations",
    "files_written"
  ]
}
```
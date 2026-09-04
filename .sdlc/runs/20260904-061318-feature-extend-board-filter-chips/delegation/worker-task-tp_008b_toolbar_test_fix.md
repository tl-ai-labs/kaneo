## Task tp_008b_toolbar_test_fix — debug / test_fix
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
The R1 regression test in apps/web/src/components/board/board-toolbar.test.tsx does NOT actually catch the bug it exists to catch. Fix the navigate mock. Change ONLY this file.

PROVEN DEFECT. I reverted board-toolbar.tsx to the old buggy for-loop implementation and ran this test. The assertion on line 152, expect(searchRef.current.labels).toBe('l1,l2,l3'), PASSED against the buggy code. Only line 154, expect(navigateSpy).toHaveBeenCalledTimes(1), failed. The search-param assertion is therefore worthless and a spy call-count is doing the real work - which is exactly what this test was written to avoid.

ROOT CAUSE, at lines 131-137. The mock does:
  searchRef.current = opts.search(searchRef.current)
Each navigate() resolves the updater against the ALREADY-MUTATED searchRef.current, so N synchronous navigate calls compose correctly. The real TanStack Router does the OPPOSITE: every navigate() in one synchronous tick resolves against the SAME committed location, so the last write wins. The mock is more forgiving than reality and hides the bug.

REQUIRED FIX. Model the committed location honestly:
1. Add a module-level 'committed' snapshot alongside searchRef in the vi.hoisted block.
2. In the navigate mock, ALWAYS apply the functional updater to 'committed', never to searchRef.current. Assign the result to searchRef.current, then bumpHarness().
3. Re-sync committed = searchRef.current during the Harness component's RENDER body (not in the click handler). Because React batches state updates, all navigate calls fired inside one click handler then correctly observe the same committed value, exactly like the real router.
4. Reset both searchRef.current and committed in beforeEach.

ACCEPTANCE PROOF YOU MUST PERFORM. After fixing, verify BOTH directions:
  (a) With the CURRENT batched board-toolbar.tsx, all tests pass.
  (b) Temporarily edit board-toolbar.tsx's toggleLabelGroup back to the old for-loop calling updateLabelFilter(l.id) per matching label, re-run, and CONFIRM that expect(searchRef.current.labels).toBe('l1,l2,l3') is the assertion that FAILS (it should see only the last label). Then RESTORE board-toolbar.tsx exactly as it was - it must end byte-identical to how you found it. Report the observed failing value in mutant_observed_labels.

Keep expect(navigateSpy).toHaveBeenCalledTimes(1) but place it AFTER the search-param assertions so the search-param assertion is the one that fails first.

Format so 'pnpm exec biome ci' is clean. Verify with EXACTLY (NO '--' before the path):
pnpm --filter @kaneo/web test src/components/board/board-toolbar.test.tsx
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/components/board/board-toolbar.test.tsx
_Included because: the file to fix; defect at lines 131-137_

```
undefined
```

#### apps/web/src/components/board/board-toolbar.tsx
_Included because: component under test; must end byte-identical after the mutation check_

```
undefined
```

#### apps/web/src/hooks/use-task-filters-with-labels-support.ts
_Included because: the real hook whose setFilters navigates_

```
undefined
```
### Acceptance criteria
- the navigate mock applies the updater to a committed snapshot, never to the live searchRef.current
- committed is re-synced during the Harness render body, not in the click handler
- with the batched implementation all tests pass
- with the for-loop mutant the search-param assertion is the assertion that fails
- board-toolbar.tsx is left byte-identical to its pre-packet state
- pnpm --filter @kaneo/web test src/components/board/board-toolbar.test.tsx passes
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string"
    },
    "passed": {
      "type": "boolean"
    },
    "mutant_kills_search_param_assertion": {
      "type": "boolean"
    },
    "mutant_observed_labels": {
      "type": "string"
    },
    "toolbar_restored": {
      "type": "boolean"
    }
  },
  "required": [
    "path",
    "passed",
    "mutant_kills_search_param_assertion",
    "mutant_observed_labels",
    "toolbar_restored"
  ]
}
```
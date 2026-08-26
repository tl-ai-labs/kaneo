## Task tp_design_001 — change_plan / delta_change_plan
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
You are the architect for a brownfield feature-extend ticket on the Kaneo repo (React 19 + Vite + TanStack Router v1.170.21 + vitest/jsdom).

STEP 1 — read, in full, in the working directory:
  .sdlc/runs/20260826-103235-feature-extend-board-filter-chips/intent_brief.md
  .sdlc/runs/20260826-103235-feature-extend-board-filter-chips/verified-facts.md
  .sdlc/runs/20260826-103235-feature-extend-board-filter-chips/requirements.md  (approved at Gate 1)
Then open the real source files you are designing against — at minimum board.tsx, use-task-filters-with-labels-support.ts, all four navigate() component files, and both existing test files. The facts file is verified; do not re-derive it.

STEP 2 — write a DELTA change plan to:
  .sdlc/runs/20260826-103235-feature-extend-board-filter-chips/change_plan.md
This is a plan for an implementer, not an essay. Every decision must be concrete enough that a coder with no further context can execute it. Where you are UNCERTAIN, write 'UNCERTAIN:' and say why — do not present a guess as settled. There is no senior tier reviewing this; an honest uncertainty is worth more than a confident error.

The plan MUST decide, and justify, each of these. Do not restate the requirement — make the call:

  D1 STATE OWNERSHIP. Who owns filter state after this change: the URL (filters derived from search params each render) or React state mirrored to the URL? Give the mount-time sequence as a numbered list of effects/renders, and show why the existing UNCONDITIONAL localStorage save effect (which fires on mount with the all-null default) cannot clobber URL-supplied filters under your design. This is the crux of the ticket. Name the guard.

  D2 ENCODING. How each of the five filters is encoded in the query string. Repeated keys (?status=a&status=b) or a delimited single value (?status=a,b)? State what TanStack Router hands validateSearch for a single-value case and how you disambiguate string from string[]. Show one worked example URL with all five filters set.

  D3 validateSearch CONTRACT. Exact signature and behaviour. It must never throw on null, undefined, a non-object, wrong-typed values, deeply nested junk, or a hostile giant array. Re-test the Gate-1 recommendation of hand-rolled typeof predicates over zod and either confirm or overturn it, with reasoning about which one makes never-throw structural rather than incidental. State whether you cap array length and why.

  D4 EMPTY-PARAM PREDICATE. Write the exact predicate for 'the URL carries filters'. It must be false for ?status= , for ?status=&priority= , and for ?status=%20 . State whether it is computed from raw params or from parsed values, and why that ordering matters.

  D5 THE NINE navigate() SITES. A table: file:line, today's code, the replacement, one sentence why. All nine from the facts file. Verify the API you propose actually exists in TanStack Router 1.170.21 — check node_modules/@tanstack/react-router types before asserting it, and say in the plan that you checked.

  D6 BACK BUTTON. What the user sees after: apply filter, apply second filter, open a task, press Back — twice. Be specific about how many history entries exist and why.

  D7 CLEAN URL + replace-not-push. How a cleared filter leaves no key behind, and exactly which navigations use replace:true and which do not. Do not change push/replace semantics of task open/close — that is out of scope.

  D8 FILE-BY-FILE PLAN. Table of path x new-or-edit x what changes. Any new file must be under apps/web/src/lib/ and be listed with its exported API.

  D9 TEST PLAN. One row per test file, each naming the assertions. It must include: (a) a test that FAILS against today's hook because it ignores URL params; (b) a test that FAILS against today's navigate sites because they replace the whole search object; (c) a CONCRETE home and assertion for replace:true — name the file and what is asserted, the Gate-1 doc left this vague; (d) how you will give the hook test a router harness, or why it does not need one. For (a) and (b) state the exact expected failure message shape.

  D10 REQUIREMENTS CORRECTIONS. The approved requirements.md has three defects. Correct them here: (i) its AC-8 names no test file — fixed by D9(c); (ii) its FR-2 says 'asynchronously sync', which is imprecise about the ordering that is the whole difficulty — restate FR-2 precisely; (iii) its AC traceability cites a brief 'AC #10' that does not exist (the brief lists nine bullets) — print the corrected AC-to-brief-bullet mapping table.

  D11 RISKS. Ranked, each with the mitigation and how it would be detected in test.

STEP 3 — SCOPE. This packet writes exactly ONE file: the change_plan.md above. Create, edit or delete NOTHING else. Do not modify any file under apps/, packages/, i18n/, or .sdlc/ other than that one file. Do not write code yet. Do not run the test suite, any lint command, or any formatter. You may READ anything and you may run read-only commands (cat, grep, ls).

HARD NON-GOALS — a plan that proposes any of these is wrong: rebuilding or restyling the filter chips / BoardToolbar; changing BoardToolbar's props; deduplicating the DEFAULT_FILTERS / FILTER_KEYS / normalizeFilters block duplicated across the two hooks; deleting or refactoring the dead useTaskFilters(); changing which task field assignee matches (task.userId); touching apps/web/src/main.tsx, project-layout.tsx, routeTree.gen.ts, store/user-preferences.ts, components/backlog-list-view/**, or any backlog/list/gantt route; any API, schema or server change.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/hooks/use-task-filters-with-labels-support.ts
_Included because: The exact effect pair whose ordering D1 must resolve. Note the save effect has no guard: it fires on first commit with DEFAULT_FILTERS._

```
  const storageKey = projectId ? `kaneo:board-filters:${projectId}` : null;
  const [filters, setFilters] = useState<BoardFilters>(DEFAULT_FILTERS);

  useEffect(() => {              // (1) RESTORE, deps [storageKey]
    if (!storageKey || typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) { setFilters(DEFAULT_FILTERS); return; }
      setFilters(normalizeFilters(JSON.parse(stored)));
    } catch { setFilters(DEFAULT_FILTERS); }
  }, [storageKey]);

  useEffect(() => {              // (2) SAVE, deps [filters, storageKey] — NO GUARD
    if (!storageKey || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(filters));
  }, [filters, storageKey]);

  const clearFilters = () => setFilters(DEFAULT_FILTERS);
  const updateFilter = (key: keyof BoardFilters, value: BoardFilters[keyof BoardFilters]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));
  const updateLabelFilter = (labelId: string) => setFilters((prev) => { /* toggle labelId in prev.labels, null when empty */ });

  return { filters, setFilters, updateFilter, updateLabelFilter, filteredProject, hasActiveFilters, clearFilters };
```

#### apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx
_Included because: The route definition D3 must rewrite and the BoardToolbar wiring D1 must keep prop-compatible._

```
type BoardSearchParams = { taskId?: string };

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): BoardSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

// line 80:  const { taskId } = Route.useSearch();
// line 96:
  const handleCloseTaskSheet = useCallback(() => {
    navigate({ to: ".", search: {}, replace: true });
  }, [navigate]);

// line 159: the hook call whose shape D1 may change
  const { filters, updateFilter, updateLabelFilter, filteredProject, hasActiveFilters, clearFilters } =
    useTaskFiltersWithLabelsSupport(project, projectId, boardSearchQuery);

// line 220: props that MUST NOT change
  <BoardToolbar project={project} filters={filters} updateFilter={updateFilter}
    updateLabelFilter={updateLabelFilter} clearFilters={clearFilters}
    hasActiveFilters={hasActiveFilters} users={users} workspaceLabels={workspaceLabels}
    viewMode={viewMode} setViewMode={setViewMode} sort={sort} onSortChange={setSort} />
```

#### apps/web/src/components/kanban-board/index.tsx
_Included because: Two of the nine navigate() sites (67, 74). The two sites at 79+ leave the board route and are OUT of scope — D5 must not touch them._

```
// line 67:
          navigate({ to: ".", search: { taskId: state.focusedTaskId } });
// line 74:
          navigate({ to: ".", search: { taskId: state.focusedTaskId } });
// line 79: OUT OF SCOPE — different route
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
            params: { ... },
          });
```

#### apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx
_Included because: The existing hook test. It has no router harness and asserts localStorage directly — D9(d) must say how this is reworked without losing its two current assertions._

```
describe("useTaskFiltersWithLabelsSupport", () => {
  const storageKey = "kaneo:board-filters:project-1";
  beforeEach(() => { window.localStorage.clear(); });
  afterEach(() => { window.localStorage.clear(); });

  it("restores persisted label filters from storage and matches tasks from project data", async () => {
    window.localStorage.setItem(storageKey, JSON.stringify({ labels: ["label-bug"] }));
    const project = { /* one column, task-1 has label-bug, task-2 has none */ };
    const { result } = renderHook(() => useTaskFiltersWithLabelsSupport(project, "project-1"));
    await waitFor(() => { expect(result.current.filters.labels).toEqual(["label-bug"]); });
    expect(result.current.filteredProject?.columns[0]?.tasks).toHaveLength(1);
  });

  it.each(["#123", "proj-123", "proj-"])("matches a task by its issue identifier when searching for %s", (textQuery) => {
    const { result } = renderHook(() => useTaskFiltersWithLabelsSupport(project, "project-1", textQuery));
    expect(result.current.filteredProject?.columns[0]?.tasks).toEqual([expect.objectContaining({ id: "task-123" })]);
  });
});
```
### Acceptance criteria
- change_plan.md exists and contains sections D1 through D11, each making a concrete decision rather than restating the requirement
- D1 gives a numbered mount-time sequence and names the specific guard that prevents the unconditional save effect from clobbering URL-supplied filters
- D4 gives a predicate that is demonstrably false for ?status= and for ?status=%20
- D5 lists all nine in-scope navigate sites with file:line and a concrete replacement, and does NOT include the two out-of-scope task-route navigations
- d5_api_verified is true and d5_api_evidence quotes a real type signature from node_modules/@tanstack/react-router
- D9 names a concrete test file and assertion for replace:true, and states the expected failure message for the two must-fail-first tests
- D10 prints a corrected AC-to-brief-bullet mapping over the brief's NINE acceptance bullets
- The plan proposes no change to BoardToolbar props, no dedup of normalizeFilters, no change to useTaskFilters(), and touches none of the off-limits paths
- files_written contains exactly one path, the change_plan.md itself
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
    "d1_state_ownership": {
      "type": "string",
      "description": "one line: 'url-source-of-truth' or 'state-mirrored-to-url', plus the name of the guard"
    },
    "d2_encoding": {
      "type": "string",
      "description": "one line: 'repeated-keys' or 'delimited', plus the delimiter if delimited"
    },
    "d3_validator": {
      "type": "string",
      "description": "one line: 'hand-rolled' or 'zod', plus confirm-or-overturn of the Gate-1 recommendation"
    },
    "d5_api_verified": {
      "type": "boolean",
      "description": "true only if you actually opened the TanStack Router types in node_modules and confirmed the navigate/search API you propose exists in 1.170.21"
    },
    "d5_api_evidence": {
      "type": "string",
      "description": "the file path and the type signature you found"
    },
    "new_files": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "edited_files": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "source files the IMPLEMENTATION will edit (not files you edited)"
    },
    "uncertainties": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "every 'UNCERTAIN:' you wrote, verbatim. Empty array only if you genuinely have none."
    },
    "files_written": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "every path YOU created or modified in this session"
    }
  },
  "required": [
    "artifact_path",
    "d1_state_ownership",
    "d2_encoding",
    "d3_validator",
    "d5_api_verified",
    "d5_api_evidence",
    "new_files",
    "edited_files",
    "uncertainties",
    "files_written"
  ]
}
```
## Task tp_design_002 — change_plan / delta_change_plan_revision
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
REVISE the change plan you wrote. Gate 2 approved it WITH ONE OVERTURN plus five mandated corrections. The plan must now describe the design that will actually be built.

STEP 1 — read in the working directory:
  .sdlc/runs/.../change_plan.md          (your previous plan — you are rewriting it in place)
  .sdlc/runs/.../verified-encoding.md    (NEW. MEASURED router behaviour. Authoritative. Do not contradict or re-derive it.)
  .sdlc/runs/.../verified-facts.md
  .sdlc/runs/.../requirements.md
Run id prefix is 20260826-103235-feature-extend-board-filter-chips.

STEP 2 — apply these six changes and rewrite .sdlc/runs/.../change_plan.md in full.

O1. OVERTURN OF D1 — URL IS THE SOLE SOURCE OF TRUTH.
Delete the state-mirrored-to-url model and the isInitializedRef guard. There is NO useState owning filter state. `filters` is DERIVED from the route's search params every render (a pure function of search, e.g. useMemo). Rationale to record verbatim in the plan: the mount clobber and the two-way-binding render loop both become STRUCTURALLY IMPOSSIBLE instead of guarded by effect ordering; a design needing no correctness argument beats one needing a sound one.
Work these consequences through EXPLICITLY, do not assume them:
  (a) localStorage becomes a SEED and a MIRROR, never an owner. On mount, if the URL carries no filters, read localStorage and PUBLISH those filters into the URL via ONE replace navigation. After that the URL is the only source.
  (b) Writing filters back to localStorage still happens, so AC-2's intentional overwrite of the viewer's stored filters by a shared link still occurs.
  (c) The seed publish must be ONE-SHOT PER storageKey and must not feed back into itself. State the exact mechanism (ref? key comparison?) and explain why it cannot re-fire when the URL it just wrote flows back in.
  (d) Re-check EVERY acceptance criterion against this new model. Some assertions written for a guarded useState no longer make sense. Say which ones you changed and why.

O2. INJECTION. useTaskFiltersWithLabelsSupport must NOT call useNavigate or any router hook. It receives `searchFilters` and an `onFiltersChange` callback as arguments; board.tsx owns useNavigate and Route.useSearch. This resolves the contradiction between your old D8 (useNavigate inside the hook) and old D9 (no router harness needed) — the existing renderHook test stays router-free. Give the hook's exact new signature.

O3. replace:true IS ASSERTED IN THE FILTER-MUTATION TEST, not in task-row.test.tsx. task-row.test.tsx asserts push + filter preservation only. Record explicitly that this is the Gate-1 AC-8 vagueness being corrected a SECOND time — your first fix confidently assigned it to a file that D7 says uses push, i.e. it asserted the opposite of the design.

O4. ENCODING — REWRITE D2 AGAINST THE MEASURED FACTS. Your old D2 said 'repeated-keys with comma-delimited fallback'. verified-encoding.md shows that is not achievable and not desirable:
  - The app CANNOT emit repeated keys; stringifySearch JSON-encodes arrays, and overriding it needs main.tsx, which is off-limits. Emission is the router's native JSON-array form and is not this ticket's choice.
  - Accepting repeated keys is free — they already parse to an array.
  - The comma fallback is DROPPED; `?status=todo,review` is ONE opaque string and splitting it reintroduces the round-trip hole that JSON encoding does not have.
  - Round-trip identity is measured TRUE for JSON encoding, including values containing commas.
  - `?status=todo` arrives as the bare STRING "todo", not an array — an Array.isArray-only parser silently drops it.
State inbound tolerance as exactly three accepted shapes, and the worked example URL in the router's REAL emitted form.

O5. TEST ASSERTIONS MUST INVOKE THE UPDATER. Nowhere may a test assert `search: expect.any(Function)` — that passes for a WRONG updater. Every navigate assertion captures the function argument, CALLS it with a prior search object containing filters, and asserts the returned object. Show the assertion pattern once, concretely, in code.

O6. RANKED RISKS. D11 must now rank the risks of the URL-as-truth design, not the old one. Include any risk this model introduces (e.g. a navigation on mount, or search-param churn) and drop risks that no longer exist — say which you dropped and why.

Also add a short section '## Gate 2 overturn record' at the top capturing O1-O5 and who decided what.

Keep every section that is still correct (D5's nine-site table and its verified API evidence, D6, D7, D8, D10's corrected traceability). Renumber nothing — keep the D1..D11 headings.

STEP 3 — SCOPE. Write exactly ONE file: the change_plan.md. Create/edit/delete NOTHING else. No code. No test run, no lint, no formatter. Read-only commands are fine.

NON-GOALS unchanged: do not rebuild the chips or BoardToolbar; do not change BoardToolbar props; do not dedup DEFAULT_FILTERS/FILTER_KEYS/normalizeFilters; do not touch useTaskFilters(); do not touch main.tsx, project-layout.tsx, routeTree.gen.ts, store/user-preferences.ts, backlog-list-view/**, or any backlog/list/gantt route.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260826-103235-feature-extend-board-filter-chips/verified-encoding.md
_Included because: MEASURED router behaviour that overturns your old D2. Authoritative. The full file is in the working directory; this is the decisive extract._

```
PARSE:  ?status=todo -> { status: "todo" }  (STRING not array)
        ?status=todo&status=review -> { status: ["todo","review"] }  (repeated keys DO parse)
        ?status=["todo","review"] -> { status: ["todo","review"] }
        ?status=            -> { status: "" }
        ?status=%20         -> { status: " " }
        ?status=todo,review -> { status: "todo,review" }   (ONE string; no comma splitting)

STRINGIFY: { status:["todo"] }  -> ?status=%5B%22todo%22%5D     (i.e. ?status=["todo"])
           { taskId:"abc" }     -> ?taskId=abc
           {}                   -> ""                            (clean URL for free)
           { status: undefined } -> key DROPPED, not emitted as status=

ROUND-TRIP: {status:["todo","review"], assignee:["u,1"], ...} -> stringify -> parse
            == deep-equal to input. identity TRUE, including the comma-containing value.

CAUSE: apps/web/src/main.tsx createRouter() sets NO parseSearch/stringifySearch, so the
defaults apply: parseSearchWith(JSON.parse) / stringifySearchWith(JSON.stringify, JSON.parse).
```

#### apps/web/src/hooks/use-task-filters-with-labels-support.ts
_Included because: The hook being redesigned. Under O1 the useState and BOTH effects shown here are removed or repurposed; under O2 it must take searchFilters + onFiltersChange instead of reaching for the router._

```
  const storageKey = projectId ? `kaneo:board-filters:${projectId}` : null;
  const [filters, setFilters] = useState<BoardFilters>(DEFAULT_FILTERS);   // <-- O1 REMOVES THIS

  useEffect(() => { /* RESTORE from localStorage, deps [storageKey] */ }, [storageKey]);
  useEffect(() => { /* SAVE to localStorage, deps [filters, storageKey], NO GUARD */ }, [filters, storageKey]);

  const clearFilters = () => setFilters(DEFAULT_FILTERS);
  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const updateLabelFilter = (labelId) => setFilters((prev) => /* toggle labelId, null when empty */);

  // filterTasks + filteredProject + hasActiveFilters are PURE over `filters` and stay as they are.
  return { filters, setFilters, updateFilter, updateLabelFilter, filteredProject, hasActiveFilters, clearFilters };
```
### Acceptance criteria
- change_plan.md contains a '## Gate 2 overturn record' section at the top listing O1-O5
- D1 describes filters DERIVED from search params with no useState owning filter state, and contains no isInitializedRef
- D1 states the one-shot-per-storageKey seed mechanism and explains why the seed cannot re-fire when its own navigation flows back in
- D2 states the emitted form as the router's native JSON array encoding and lists exactly three accepted inbound shapes, with NO comma splitting
- The hook signature takes searchFilters and onFiltersChange and calls no router hook
- No test assertion anywhere in the plan uses expect.any(Function); the plan shows a concrete capture-and-invoke pattern
- D11 ranks risks of the URL-as-truth design and names which old risks were dropped
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
      "description": "must now be url-source-of-truth"
    },
    "seed_oneshot_mechanism": {
      "type": "string",
      "description": "the exact mechanism preventing the localStorage seed publish from re-firing"
    },
    "hook_signature": {
      "type": "string",
      "description": "the hook's exact new TypeScript signature"
    },
    "d2_encoding": {
      "type": "string",
      "description": "emitted form, and the accepted inbound shapes"
    },
    "acs_changed": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "acceptance criteria whose assertions changed because of the overturn, each with why"
    },
    "risks_dropped": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "risks_added": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "uncertainties": {
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
    "d1_state_ownership",
    "seed_oneshot_mechanism",
    "hook_signature",
    "d2_encoding",
    "acs_changed",
    "risks_dropped",
    "risks_added",
    "uncertainties",
    "files_written"
  ]
}
```
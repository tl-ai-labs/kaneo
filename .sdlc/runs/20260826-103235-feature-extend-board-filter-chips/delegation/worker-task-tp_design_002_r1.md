## Task tp_design_002_r1 — change_plan / delta_change_plan_revision
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
RETRY. Your previous attempt at this task FAILED: it looped, hit the max-token limit three times, and tried a tool named `edit_file` that does not exist here. Avoid all three:
  - Write the output file with ONE call to your normal file-writing tool, the same way you successfully wrote change_plan.md earlier in this run. Do not use `edit_file`. Do not use any artifact tool.
  - Produce a SHORT document. Target 150-200 lines. Brevity is a requirement, not a preference.
  - Do not restate sections that are unchanged — point at them instead (see below).

Gate 2 approved the plan WITH ONE OVERTURN plus four corrections. The plan must describe the design that will actually be built.

STEP 1 — read ONLY these, then stop reading:
  .sdlc/runs/20260826-103235-feature-extend-board-filter-chips/verified-encoding.md  (MEASURED router behaviour — authoritative, never contradict)
  .sdlc/runs/20260826-103235-feature-extend-board-filter-chips/change_plan_v1.md     (your previous plan, preserved)
Do not re-explore the repo. Everything you need is in those two files and in the excerpts below.

STEP 2 — write .sdlc/runs/20260826-103235-feature-extend-board-filter-chips/change_plan.md containing, in order:

'## Gate 2 overturn record' — O1..O5 below, one short paragraph each, naming who decided.

'## D1. State ownership' — REWRITTEN. URL IS THE SOLE SOURCE OF TRUTH. No useState owns filter state; `filters` is derived from the route search params every render (pure function, useMemo). Delete isInitializedRef entirely. Record the rationale verbatim: the mount clobber and the two-way-binding render loop both become STRUCTURALLY IMPOSSIBLE rather than guarded by effect ordering; a design needing no correctness argument beats one needing a sound one. Then work through, explicitly:
  (a) localStorage is now a SEED and a MIRROR, never an owner. On mount with no filters in the URL, read localStorage and publish those filters into the URL with ONE replace navigation.
  (b) Filters are still written back to localStorage, so AC-2's intentional overwrite of a viewer's stored filters by a shared link still happens.
  (c) The seed publish is ONE-SHOT PER storageKey. State the exact mechanism and explain in one or two sentences why it cannot re-fire when the navigation it just performed flows back in as new search params.
  (d) Which acceptance criteria changed shape because of the overturn, and why.

'## D2. Encoding' — REWRITTEN against verified-encoding.md. Emission is the router's NATIVE JSON-array form and is not this ticket's choice (overriding stringifySearch needs main.tsx, which is off-limits). Inbound tolerance is EXACTLY THREE accepted shapes — name them. NO comma splitting: `?status=todo,review` is one opaque string. Give one worked example URL in the router's real emitted form.

'## D3. validateSearch contract' — keep hand-rolled; restate the signature and the never-throw guarantees in <=15 lines. Note that a bare single string must be accepted (`?status=todo` arrives as the STRING "todo").

'## D4. Empty-param predicate' — restate; must be computed from NORMALIZED values because `?status=` yields `{status: ""}` and the key IS present.

'## D5-D8, D10' — write ONLY: 'UNCHANGED from change_plan_v1.md §D5 / §D6 / §D7 / §D8 / §D10', plus a 3-line delta note recording the two edits that DO apply: (i) in §D8 the hook row now reads per O2 below; (ii) in §D10.1 the replace:true home moves per O3 below. Do NOT reproduce the nine-site table or any other table from v1.

'## D9. Test plan' — REWRITTEN, but as a compact table, one row per test file. Must satisfy O3 and O5.

'## D11. Risks' — REWRITTEN for the URL-as-truth design. Say which v1 risks you DROPPED and why, and name any risk this new model INTRODUCES.

THE FIVE DECISIONS TO ENCODE:
O1 (overturn, decided by the user at Gate 2): URL-as-source-of-truth, as detailed in D1 above.
O2 (injection): useTaskFiltersWithLabelsSupport calls NO router hook. It takes `searchFilters` and an `onFiltersChange` callback as arguments; board.tsx owns useNavigate and Route.useSearch. This resolves v1's contradiction between §D8 (useNavigate inside the hook) and §D9 (no router harness needed) — the existing renderHook test stays router-free. Give the hook's exact new signature.
O3 (replace:true home): asserted in the FILTER-MUTATION test, not in task-row.test.tsx. task-row.test.tsx asserts push + filter preservation only. Record explicitly that this is the Gate-1 AC-8 vagueness being corrected a SECOND time — v1's fix confidently assigned it to a file that v1's own §D7 says uses push, i.e. it asserted the opposite of the design.
O4 (encoding): as in D2 above.
O5 (assertions): no test may assert `search: expect.any(Function)` — that passes for a WRONG updater. Every navigate assertion CAPTURES the function argument, CALLS it with a prior search object containing filters, and asserts the returned object. Show that pattern once, in code, in D9.

STEP 3 — SCOPE. Write exactly ONE file: change_plan.md. Create/edit/delete nothing else. No code, no tests, no lint, no formatter.

NON-GOALS unchanged: do not rebuild the chips or BoardToolbar; do not change BoardToolbar props; do not dedup DEFAULT_FILTERS/FILTER_KEYS/normalizeFilters; do not touch useTaskFilters(); do not touch main.tsx, project-layout.tsx, routeTree.gen.ts, store/user-preferences.ts, or backlog-list-view/**.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260826-103235-feature-extend-board-filter-chips/verified-encoding.md
_Included because: Measured router behaviour. Authoritative for D2/D3/D4. This extract is enough; the full file is in the working directory if you need it._

```
PARSE:  ?status=todo               -> { status: "todo" }   (STRING, not an array)
        ?status=todo&status=review -> { status: ["todo","review"] }  (repeated keys parse to an array)
        ?status=["todo","review"]  -> { status: ["todo","review"] }
        ?status=                   -> { status: "" }        (key IS present)
        ?status=%20                -> { status: " " }
        ?status=todo,review        -> { status: "todo,review" }  (ONE string; nothing splits commas)

STRINGIFY: { status:["todo"] }      -> ?status=%5B%22todo%22%5D   (i.e. ?status=["todo"])
           { taskId:"abc" }         -> ?taskId=abc
           {}                       -> ""                          (clean URL for free)
           { status: undefined }    -> key DROPPED, never emitted as ?status=

ROUND-TRIP identity measured TRUE for JSON encoding, including a value containing a comma
(assignee: ["u,1"] survives intact).

CAUSE: apps/web/src/main.tsx createRouter() sets NO parseSearch/stringifySearch override, so the
library defaults apply: parseSearchWith(JSON.parse) / stringifySearchWith(JSON.stringify, JSON.parse).
main.tsx is OFF-LIMITS for this run, so the emitted form is not a choice available to this ticket.
```

#### apps/web/src/hooks/use-task-filters-with-labels-support.ts
_Included because: The hook being redesigned. Under O1 the useState and both effects go away or change role; under O2 it must take searchFilters + onFiltersChange rather than reach for the router._

```
  const storageKey = projectId ? `kaneo:board-filters:${projectId}` : null;
  const [filters, setFilters] = useState<BoardFilters>(DEFAULT_FILTERS);   // O1 REMOVES THIS
  useEffect(() => { /* RESTORE from localStorage, deps [storageKey] */ }, [storageKey]);
  useEffect(() => { /* SAVE to localStorage, deps [filters, storageKey], NO GUARD */ }, [filters, storageKey]);
  const clearFilters = () => setFilters(DEFAULT_FILTERS);
  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const updateLabelFilter = (labelId) => setFilters((prev) => /* toggle labelId, null when empty */);
  // filterTasks / filteredProject / hasActiveFilters are PURE over `filters` and are UNCHANGED.
  return { filters, setFilters, updateFilter, updateLabelFilter, filteredProject, hasActiveFilters, clearFilters };
```
### Acceptance criteria
- change_plan.md is 150-250 lines and opens with '## Gate 2 overturn record' covering O1-O5
- D1 has no useState owning filters and no isInitializedRef; filters are derived from search params
- D1 states the one-shot-per-storageKey seed mechanism and why it cannot re-fire
- D2 names exactly three accepted inbound shapes and does no comma splitting
- The hook signature takes searchFilters and onFiltersChange and calls no router hook
- D5-D8 and D10 are pointers to change_plan_v1.md plus a 3-line delta note, not reproductions
- D9 shows a capture-and-invoke assertion pattern in code and uses expect.any(Function) nowhere
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
      "type": "string"
    },
    "seed_oneshot_mechanism": {
      "type": "string"
    },
    "hook_signature": {
      "type": "string"
    },
    "d2_accepted_shapes": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "acs_changed": {
      "type": "array",
      "items": {
        "type": "string"
      }
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
    "d2_accepted_shapes",
    "acs_changed",
    "risks_dropped",
    "risks_added",
    "uncertainties",
    "files_written"
  ]
}
```
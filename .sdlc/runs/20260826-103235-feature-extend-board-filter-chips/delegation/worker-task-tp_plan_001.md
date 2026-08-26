## Task tp_plan_001 — plan_task_packets / decomposition
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Decompose the approved change plan into an ORDERED list of implementation TaskPackets and write it as JSON.

STEP 1 — read ONLY these, then stop reading:
  .sdlc/runs/20260826-103235-feature-extend-board-filter-chips/change_plan.md  (READ ALL OF IT, INCLUDING '## Addendum A' at the end — Addendum A is BINDING and OVERRIDES the sections it names)
  .sdlc/runs/20260826-103235-feature-extend-board-filter-chips/verified-encoding.md
  .sdlc/runs/20260826-103235-feature-extend-board-filter-chips/change_plan_v1.md  (ONLY §D5's nine-site table and §D8's file list; the rest is superseded)
Do not re-explore the repo beyond opening the files you are planning edits to.

STEP 2 — write .sdlc/runs/20260826-103235-feature-extend-board-filter-chips/packets.json
It must be a JSON ARRAY of packet objects. Every element must have EXACTLY these keys:
  id            string, "tp_cg_001" style, unique, numbered in dependency order
  phase         one of: "codegen" | "tests"
  task_type     one of: "new_file_add" | "existing_file_edit" | "test_add" | "test_backfill"
  subtype       short hint, e.g. "lib_helper" | "react_hook" | "route_definition" | "nav_call_sites" | "unit"
  module        "board-filters"
  artifact_path the ONE repo-relative file this packet writes
  depends_on    array of packet ids that must complete first (may be empty)
  instruction   imperative, self-contained, UNDER 250 WORDS. Must name the exact functions/props to add and the exact behaviour. Assume the worker has NOT read the change plan.
  acceptance    array of testable bullets
  budget        { "maxInputTokens": number, "maxOutputTokens": number }
No other keys. Valid JSON only — no comments, no trailing commas.

STEP 3 — CONSTRAINTS ON THE PLAN ITSELF:
  - ORDER MATTERS. Packets are dispatched sequentially and each worker sees the previous ones' edits on disk. Put pure helpers first, then the hook, then the route, then the nav sites, then tests.
  - ONE artifact_path per packet. A packet that needs to touch two files must be split.
  - Every artifact_path MUST be one of these EXACT paths and nothing else:
      apps/web/src/lib/board-filter-params.ts
      apps/web/src/lib/board-filter-params.test.ts
      apps/web/src/hooks/use-task-filters-with-labels-support.ts
      apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx
      apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx
      apps/web/src/components/kanban-board/index.tsx
      apps/web/src/components/kanban-board/task-card.tsx
      apps/web/src/components/list-view/index.tsx
      apps/web/src/components/list-view/task-row.tsx
      apps/web/src/components/list-view/task-row.test.tsx
    Any other path is a planning error. Do NOT plan a packet for main.tsx, routeTree.gen.ts, project-layout.tsx, store/user-preferences.ts, backlog-list-view/**, i18n/**, or anything under apps/api, packages/, apps/site, apps/docs.
  - The four nav-site component files are four SEPARATE packets (one artifact_path each), all making the same mechanical change from §D5's table.
  - Include a packet to rework use-task-filters-with-labels-support.test.tsx that keeps its two EXISTING tests passing verbatim and adds the new ones.
  - Budgets: codegen packets maxOutputTokens 4000; test packets 5000; maxInputTokens 30000 throughout.

STEP 4 — SCOPE. Write exactly ONE file: packets.json. Create/edit/delete NOTHING else. Do not implement any of the packets. Do not run tests, lint, or a formatter.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260826-103235-feature-extend-board-filter-chips/change_plan.md
_Included because: The decisions the packets must implement. This is the BINDING summary; the full file including Addendum A is in the working directory and you must read it._

```
URL IS THE SOLE SOURCE OF TRUTH. No useState owns filter state; `filters` is derived from route
search params via useMemo.

NEW FILE apps/web/src/lib/board-filter-params.ts exports:
  validateBoardSearch(search: Record<string, unknown>): BoardSearchParams   // never throws
  filtersToSearchParams(filters: BoardFilters): Partial<BoardSearchParams>  // omits inactive keys (undefined)
  searchParamsToFilters(params: BoardSearchParams): BoardFilters
  hasActiveFilterParams(params): boolean
  type BoardSearchParams = { taskId?: string; status?: string[]; priority?: string[]; assignee?: string[]; dueDate?: string[]; labels?: string[] }

ENCODING (measured, authoritative): emission is the router's native JSON-array form. Inbound
tolerance is exactly three shapes: JSON array `?status=["todo"]`; repeated keys
`?status=todo&status=review`; bare single string `?status=todo` -> ["todo"]. NO comma splitting.
`?status=` parses to { status: "" } and must normalize to no-filter. Cap arrays at 50.

ADDENDUM A (BINDING, overrides D1):
 A1 hook signature keeps its existing params and APPENDS the new ones:
    useTaskFiltersWithLabelsSupport(project, projectId?, textQuery?, searchFilters?, onFiltersChange?)
    so the two existing tests calling (project,"project-1") and (project,"project-1",textQuery) still pass.
 A2 types are ProjectWithTasks | null | undefined  and  filteredProject: ProjectWithTasks | null.
 A3 DELETE the filters-keyed localStorage mirror effect. Persist in exactly two mutually exclusive places:
    (1) write-on-mutation — updateFilter/updateLabelFilter/clearFilters each write localStorage AND call onFiltersChange(next);
    (2) load-time sync-back — ONE effect that runs only when hasActiveFilterParams(searchFilters) is true.
    The localStorage SEED effect runs only when hasActiveFilterParams is false, so seed and sync-back are mutually exclusive.
    Seed is one-shot per storageKey via seededStorageKeyRef.
 A4 the hook NEVER calls navigate. board.tsx owns the router:
    const handleFiltersChange = useCallback((next) => navigate({ to: ".", search: (prev) => ({ ...prev, ...filtersToSearchParams(next) }), replace: true }), [navigate]);

TESTS: no assertion may use `search: expect.any(Function)`. Capture the updater and INVOKE it.
`expect.toSatisfy` IS available in vitest 4.1.10 and is the sanctioned pattern.
```

#### .sdlc/runs/20260826-103235-feature-extend-board-filter-chips/change_plan_v1.md
_Included because: The nine navigate() sites the four nav packets must change. Line numbers are pre-edit; find the calls by their code shape._

```
board.tsx:97                     navigate({ to: ".", search: {}, replace: true })
kanban-board/task-card.tsx:148   navigate({ to: ".", search: {} })
kanban-board/task-card.tsx:153   navigate({ to: ".", search: { taskId: task.id } })
kanban-board/index.tsx:67        navigate({ to: ".", search: { taskId: state.focusedTaskId } })
kanban-board/index.tsx:74        navigate({ to: ".", search: { taskId: state.focusedTaskId } })
list-view/task-row.tsx:147       navigate({ to: ".", search: {} })
list-view/task-row.tsx:152       navigate({ to: ".", search: { taskId: task.id } })
list-view/index.tsx:97           navigate({ to: ".", search: { taskId: state.focusedTaskId } })
list-view/index.tsx:104          navigate({ to: ".", search: { taskId: state.focusedTaskId } })

Replacement shape: search: (prev) => ({ ...prev, taskId: <id> })
            or for the clear case: search: (prev) => { const { taskId, ...rest } = prev; return rest; }
Do NOT touch kanban-board/index.tsx:79 or list-view/index.tsx:109 — those navigate to the
/task/$taskId route and are out of scope. Do NOT change push/replace semantics of task open/close.
```
### Acceptance criteria
- packets.json parses as a JSON array where every element has exactly the ten specified keys
- Every artifact_path is drawn from the ten allowed paths and no others
- Packets are ordered so that pure helpers precede the hook, the hook precedes the route, and tests come after the code they exercise
- The four nav-site component files are four separate packets
- Each instruction is under 250 words and is self-contained for a worker that has not read the change plan
- files_written contains exactly one path, packets.json
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
    "packet_count": {
      "type": "integer"
    },
    "packet_ids_in_order": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "artifact_paths": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "the artifact_path of each packet, in the same order"
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
    "packet_count",
    "packet_ids_in_order",
    "artifact_paths",
    "files_written"
  ]
}
```
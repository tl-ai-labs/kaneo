## Task tp_req_001 — requirements_analysis / delta_requirements
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
You are the requirements analyst for a brownfield feature-extend ticket on the Kaneo repo.

STEP 1 — read these two files in the working directory, in full:
  .sdlc/runs/20260826-103235-feature-extend-board-filter-chips/intent_brief.md
  .sdlc/runs/20260826-103235-feature-extend-board-filter-chips/verified-facts.md
The brief's acceptance criteria are binding. The facts file is already verified — build on it, do not re-derive it. You may also open any file under apps/web/src to check a detail.

STEP 2 — write a DELTA requirements document (what changes, not a spec of the whole board) to:
  .sdlc/runs/20260826-103235-feature-extend-board-filter-chips/requirements.md
Sections, in this order:
  1. Summary (3 sentences max)
  2. In scope (numbered, each testable)
  3. Out of scope (numbered) — include the explicit non-goals from the brief
  4. Functional requirements FR-1..FR-n — cover: encode/decode of all five filters; URL-wins-on-load precedence and the write-back to localStorage; the no-params case restoring localStorage; empty-param handling; filter survival across the nine listed navigate() sites; Back-button behaviour; clean URL when no filters; replace-not-push
  5. Non-functional requirements NFR-1..NFR-n — include the never-throw validateSearch constraint and no-regression on the existing 112 tests
  6. Affected surfaces — a table of file path x what changes x why, drawn from the facts file
  7. Acceptance criteria AC-1..AC-n — numbered, each one stating HOW it will be proven (which test file, what it asserts). At least one AC must be a test that FAILS against today's code.
  8. Risks and open questions

Every FR and AC must be traceable to a bullet in the brief's '## Acceptance criteria'. Do not invent scope. Do not propose new filter types, new UI, or API changes.

STEP 3 — write NOTHING else. This packet creates exactly one file, the requirements.md above. Do not create, edit or delete any file under apps/, packages/, i18n/, or anywhere else in the repo. Do not run any lint or format command. Do not run the test suite.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx
_Included because: The route whose search params must carry the filters. Shows today's BoardSearchParams, the hand-rolled validateSearch, and the close-task navigate that drops search state._

```
type BoardSearchParams = {
  taskId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): BoardSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

// ... line 96:
  const handleCloseTaskSheet = useCallback(() => {
    navigate({
      to: ".",
      search: {},
      replace: true,
    });
  }, [navigate]);

// ... line 159:
  const {
    filters,
    updateFilter,
    updateLabelFilter,
    filteredProject,
    hasActiveFilters,
    clearFilters,
  } = useTaskFiltersWithLabelsSupport(project, projectId, boardSearchQuery);
```

#### apps/web/src/hooks/use-task-filters-with-labels-support.ts
_Included because: The sole production filter hook. Shows the localStorage restore/save effects whose precedence must change, and the public API (filters/setFilters/updateFilter/updateLabelFilter/filteredProject/hasActiveFilters/clearFilters) that BoardToolbar depends on and that must not change shape._

```
const DEFAULT_FILTERS: BoardFilters = { status: null, priority: null, assignee: null, dueDate: null, labels: null };
const FILTER_KEYS: Array<keyof BoardFilters> = ["status","priority","assignee","dueDate","labels"];

function normalizeFilters(raw: unknown): BoardFilters { /* returns DEFAULT_FILTERS unless raw is an object; per key, keeps string[] with length>0 else null */ }

export function useTaskFiltersWithLabelsSupport(project, projectId?, textQuery?) {
  const storageKey = projectId ? `kaneo:board-filters:${projectId}` : null;
  const [filters, setFilters] = useState<BoardFilters>(DEFAULT_FILTERS);

  useEffect(() => {   // RESTORE — on storageKey change
    if (!storageKey || typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) { setFilters(DEFAULT_FILTERS); return; }
      setFilters(normalizeFilters(JSON.parse(stored)));
    } catch { setFilters(DEFAULT_FILTERS); }
  }, [storageKey]);

  useEffect(() => {   // SAVE — UNCONDITIONAL, fires on mount with the all-null default
    if (!storageKey || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(filters));
  }, [filters, storageKey]);

  // filterTasks(...) applies status/priority/assignee(userId)/dueDate/labels + textQuery
  return { filters, setFilters, updateFilter, updateLabelFilter, filteredProject, hasActiveFilters, clearFilters };
}
```

#### apps/web/src/hooks/use-task-filters.ts
_Included because: Exports the BoardFilters type and DUE_DATE_FILTER_VALUES that the encoder must serialize. The hook itself is dead code and must not be refactored._

```
export type BoardFilters = {
  status: string[] | null;
  priority: string[] | null;
  assignee: string[] | null;
  dueDate: string[] | null;
  labels: string[] | null;
};

export const DUE_DATE_FILTER_VALUES = {
  dueNextWeek: "dueNextWeek",
  dueThisWeek: "dueThisWeek",
  noDueDate: "noDueDate",
} as const;
```

#### apps/web/src/components/list-view/task-row.tsx
_Included because: One of the nine navigate() sites that replaces the whole search object. Representative of the pattern in kanban-board/task-card.tsx, kanban-board/index.tsx and list-view/index.tsx._

```
// line 145-157
    if (isSelected) {
      navigate({
        to: ".",
        search: {},
      });
    } else {
      navigate({
        to: ".",
        search: { taskId: task.id },
      });
    }
```
### Acceptance criteria
- requirements.md exists at the stated path and contains all 8 numbered sections in order
- Every one of the brief's nine acceptance-criteria bullets is traceable to at least one FR and at least one AC
- At least one AC is a test that must FAIL against the current code before the fix
- The document states that BoardToolbar's props must not change
- The document does NOT propose deleting or refactoring useTaskFilters(), deduplicating normalizeFilters, changing the assignee field, or touching backlog/list/gantt routes
- files_written contains exactly one path, the requirements.md itself
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "artifact_path": {
      "type": "string",
      "description": "path of the requirements file you wrote"
    },
    "fr_count": {
      "type": "integer"
    },
    "ac_count": {
      "type": "integer"
    },
    "validator_recommendation": {
      "type": "string",
      "description": "zod | hand-rolled | deferred-to-design, plus one sentence of reasoning"
    },
    "open_questions": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "files_written": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "every path you created or modified"
    }
  },
  "required": [
    "artifact_path",
    "fr_count",
    "ac_count",
    "open_questions",
    "files_written"
  ]
}
```
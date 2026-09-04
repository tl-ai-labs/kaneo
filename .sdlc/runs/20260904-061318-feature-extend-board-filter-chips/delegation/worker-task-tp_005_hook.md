## Task tp_005_hook — codegen / frontend_util
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Rewrite the STATE LAYER of apps/web/src/hooks/use-task-filters-with-labels-support.ts per section 4 (4.1 through 4.7) of .sdlc/runs/20260904-061318-feature-extend-board-filter-chips/design.md. That section writes out the code - transcribe it, do not redesign.

DELETE: both useEffect localStorage blocks, the storageKey line, the useState, and the now-unused local DEFAULT_FILTERS/FILTER_KEYS/normalizeFilters if the design says so. Do NOT read localStorage anywhere - this is a clean cutover.

DERIVE: filters from useSearch({ strict: false }) via decodeBoardFilters from '@/lib/board-filter-search-params'. Memoise on the FIVE EXTRACTED RAW STRINGS, not on the search object - memoising on the object gives a fresh identity every render, churns filteredProject, and trips Biome useExhaustiveDependencies.

MUTATORS: setFilters is the SINGLE primitive and must accept BOTH a plain value and an updater function (prev) => next. updateFilter, updateLabelFilter and clearFilters all delegate to it. Every navigation uses to: '.', a functional search updater, and replace: true.

HARD CONSTRAINTS:
- The returned object shape stays byte-identical: { filters, setFilters, updateFilter, updateLabelFilter, filteredProject, hasActiveFilters, clearFilters }.
- updateLabelFilter STAYS exported with an unchanged signature (labelId: string) => void.
- filterTasks and filteredProject bodies are COPIED VERBATIM from the current file. AND across filter types, OR within a type, all columns preserved even when empty. ZERO behaviour change there.
- Rename the projectId parameter to _projectId (tsconfig sets noUnusedParameters: true).
- Import useSearch and useNavigate as plain named top-level imports from '@tanstack/react-router'.

Format so 'pnpm exec biome ci' would be clean. Verify with: pnpm --filter @kaneo/web typecheck
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260904-061318-feature-extend-board-filter-chips/design.md
_Included because: section 4 gives the exact code_

```
undefined
```

#### apps/web/src/hooks/use-task-filters-with-labels-support.ts
_Included because: edit target; filterTasks must be copied verbatim from here_

```
undefined
```

#### apps/web/src/lib/board-filter-search-params.ts
_Included because: codec_

```
undefined
```
### Acceptance criteria
- no reference to localStorage or 'kaneo:board-filters' remains
- returns exactly filters, setFilters, updateFilter, updateLabelFilter, filteredProject, hasActiveFilters, clearFilters
- filters memoised on the five raw strings, not the search object
- every mutator navigates with replace: true and a functional updater
- filterTasks body unchanged from the original
- pnpm --filter @kaneo/web typecheck passes
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
    "returned_keys": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "localstorage_removed": {
      "type": "boolean"
    },
    "typecheck_passed": {
      "type": "boolean"
    }
  },
  "required": [
    "path",
    "returned_keys",
    "localstorage_removed",
    "typecheck_passed"
  ]
}
```
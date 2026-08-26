## Task tp_cg_001_r1 — codegen / new_file_add
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
RETRY after a transient vendor auth failure. Note: the target file does NOT exist yet — you are CREATING it. Do not try to read it first; go straight to writing it.

Create apps/web/src/lib/board-filter-params.ts — pure helpers for encoding board filters in TanStack Router search params. No React, no router imports.

Import the existing type: `import type { BoardFilters } from "@/hooks/use-task-filters";`

Export:
1. `type BoardSearchParams = { taskId?: string; status?: string[]; priority?: string[]; assignee?: string[]; dueDate?: string[]; labels?: string[] }`
2. `validateBoardSearch(search: Record<string, unknown>): BoardSearchParams` — MUST NEVER THROW, for any input including null, undefined, a number, a string, an array, or deeply nested junk. Wrap the body defensively. For each of the five filter keys: if the value is an array, keep only string items, trim each, drop empties; if the value is a single string, trim it and wrap in a one-element array when non-empty; anything else → omit the key entirely (leave it `undefined`, never `[]`). NEVER split on commas — "todo,review" is ONE value. Cap each array at 50 items. Carry `taskId` through only when it is a non-empty string.
3. `filtersToSearchParams(filters: BoardFilters): Partial<BoardSearchParams>` — for each key, emit the array when it is a non-empty string array, otherwise set the key to `undefined` so the router drops it from the URL. Never emit an empty array.
4. `searchParamsToFilters(params: BoardSearchParams | undefined | null): BoardFilters` — inverse; absent or empty → `null` for that key. Must never throw.
5. `hasActiveFilterParams(params: Partial<BoardSearchParams> | undefined | null): boolean` — true only when some filter key holds an array with at least one non-empty, non-whitespace string. Must be false for `undefined`, `null`, `{}`, `{status: []}`, `{status: ""}`, `{status: [""]}`, `{status: ["  "]}`.

Match the repo's style: `type` over `interface`, named exports, no default export, no comments narrating code. TypeScript strict.

SCOPE — you may create or modify EXACTLY ONE file: apps/web/src/lib/board-filter-params.ts. Create, edit or delete NO other file. Do not write tests here. Do not run the test suite. Do not run biome, prettier, eslint, `pnpm lint`, or any formatter or fixer. Read-only commands (cat, ls, grep) are fine.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/hooks/use-task-filters.ts
_Included because: The BoardFilters type to import and the dueDate vocabulary the encoder round-trips. Do not modify this file._

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

#### .sdlc/runs/20260826-103235-feature-extend-board-filter-chips/verified-encoding.md
_Included because: MEASURED behaviour of this app's router. Authoritative — these are the exact shapes validateBoardSearch will receive and the exact reason inactive keys must be undefined rather than []._

```
The router parses BEFORE validateSearch sees the object. Measured:
  ?status=todo               -> { status: "todo" }          A BARE STRING, not an array
  ?status=todo&status=review -> { status: ["todo","review"] }
  ?status=["todo","review"]  -> { status: ["todo","review"] }
  ?status=                   -> { status: "" }              the key IS present
  ?status=%20                -> { status: " " }
  ?status=todo,review        -> { status: "todo,review" }   ONE opaque string

On the way out, the router stringifies:
  { status: ["todo"] }    -> ?status=%5B%22todo%22%5D
  { status: undefined }   -> key DROPPED entirely, never emitted as ?status=
  {}                      -> ""   (a genuinely clean URL)

So: emit `undefined` for an inactive filter, NEVER `[]`. That is what keeps the URL clean.
```
### Acceptance criteria
- File exports BoardSearchParams, validateBoardSearch, filtersToSearchParams, searchParamsToFilters, hasActiveFilterParams
- validateBoardSearch cannot throw for any input value whatsoever
- A bare single string is normalized to a one-element array
- No comma splitting anywhere in the file
- Inactive filters are emitted as undefined, never as an empty array
- hasActiveFilterParams is false for {status: []}, {status: ""} and {status: ["  "]}
- Arrays are capped at 50 items
- files_written contains exactly one path, apps/web/src/lib/board-filter-params.ts
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
    "exports": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "never_throws_strategy": {
      "type": "string"
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
    "exports",
    "never_throws_strategy",
    "files_written"
  ]
}
```
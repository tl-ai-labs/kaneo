## Task tp_cg_010 — codegen / new_file_add
Module: web-data
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

Create ONLY apps/web/src/lib/format-estimated-hours.ts. It is a pure module: no React, no i18n, no imports at all.

Named-export two functions.

1. formatEstimatedHours(minutes: number | null | undefined): string | null
   Return null when minutes is null, undefined, not a finite number, or <= 0. Otherwise compute minutes / 60, round to at most 2 decimal places, strip trailing zeros, and return that number followed by "h". Exactly: 150 -> "2.5h", 120 -> "2h", 60 -> "1h", 45 -> "0.75h".

2. sumEstimatedMinutes(tasks: ReadonlyArray<{ estimatedMinutes?: number | null }>): number
   Return the sum of estimatedMinutes across the array, treating null, undefined and non-finite values as 0. Return 0 for an empty array.

Both are used by the board card and the column header. Add a short comment explaining that minutes are the storage unit so lane sums stay exact, which is why formatting happens only at the display boundary. Create no other file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/lib/due-date-status.ts (style reference)
_Included because: The established shape for a pure task-field helper in this directory: named exports, no framework imports, comments that explain constraints rather than narrate._

```
export type DueDateStatus =
  | "overdue"
  | "due-soon"
  | "far-future"
  | "no-due-date";

type CompletionColumn = { slug: string; isFinal: boolean };

// Columns are user-configurable, so completion comes from the column's isFinal
// flag. The slug check is the fallback for surfaces that render before columns
// load, or that never have them.
export function isTaskCompleted(
  status: string,
  columns?: CompletionColumn[],
): boolean {
  if (columns?.length) {
    return columns.find((column) => column.slug === status)?.isFinal ?? false;
  }
  return status === "done" || status === "archived";
}
```
### Acceptance criteria
- Named-exports formatEstimatedHours and sumEstimatedMinutes
- formatEstimatedHours returns null for null, undefined, 0 and negatives, and strips trailing zeros
- sumEstimatedMinutes treats null and undefined as 0 and returns 0 for an empty array
- The module has no imports and no React or i18n dependency
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "created": {
      "type": "boolean"
    },
    "exports": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "created",
    "exports",
    "summary"
  ]
}
```
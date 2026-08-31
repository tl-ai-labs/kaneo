## Task tp_cg_003 — codegen / existing_file_edit
Module: api-validation
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

Edit ONLY apps/api/src/task/validate-task-fields.ts. Add `import * as v from "valibot";` to the imports, then export exactly these two bindings, placed after the VIRTUAL_STATUSES constant:

export const ESTIMATED_MINUTES_MAX = 525_600;

export const estimatedMinutesSchema = v.nullable(
  v.pipe(
    v.number(),
    v.integer(),
    v.minValue(0),
    v.maxValue(ESTIMATED_MINUTES_MAX),
  ),
);

This schema is the single source of truth for the route validator and for its unit test. Do NOT add an assert-style helper function — a standalone assert would never be called by production code and would make its test meaningless. Add a brief comment noting that 525_600 is one year in minutes. Change nothing else in the file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/api/src/task/validate-task-fields.ts (exact current head)
_Included because: Current imports and the constants your additions go after. Note valibot is not yet imported here._

```
import { asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { columnTable } from "../database/schema";

export const VALID_PRIORITIES = [
  "no-priority",
  "low",
  "medium",
  "high",
  "urgent",
] as const;

export const VIRTUAL_STATUSES = ["planned", "archived"] as const;

export function assertValidPriority(priority: string): void {
  if (!(VALID_PRIORITIES as readonly string[]).includes(priority)) {
    throw new HTTPException(400, {
      message: `Invalid priority "${priority}". Valid values: ${VALID_PRIORITIES.join(", ")}`,
    });
  }
}
```
### Acceptance criteria
- ESTIMATED_MINUTES_MAX and estimatedMinutesSchema are both exported
- estimatedMinutesSchema is v.nullable wrapping a v.pipe of number, integer, minValue(0), maxValue(ESTIMATED_MINUTES_MAX)
- valibot is imported as v
- No assert-style helper was added and existing exports are unchanged
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "edited": {
      "type": "boolean"
    },
    "exports_added": {
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
    "edited",
    "exports_added",
    "summary"
  ]
}
```
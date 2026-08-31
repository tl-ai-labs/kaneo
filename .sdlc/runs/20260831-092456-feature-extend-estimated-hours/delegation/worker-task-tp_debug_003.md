## Task tp_debug_003 — debug / review_refinement
Module: cross
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

Senior review found the bound 525600 triplicated. Give it one source of truth per package. Edit exactly four files and nothing else.

API SIDE - the dependency direction matters and is NOT negotiable. apps/api/src/task/validate-task-fields.ts imports `db` from "../database"; apps/api/src/schemas.ts imports only valibot. So the constant must live in schemas.ts and flow OUTWARD. Doing it the other way would pull the database into a module that every schema consumer imports.

1. apps/api/src/schemas.ts — add, above taskSchema:
     // 525_600 is one year in minutes
     export const ESTIMATED_MINUTES_MAX = 525_600;
   and change taskSchema's estimatedMinutes to use v.maxValue(ESTIMATED_MINUTES_MAX) instead of the literal.

2. apps/api/src/task/validate-task-fields.ts — DELETE its own `export const ESTIMATED_MINUTES_MAX = 525_600;` and its comment, and instead re-export the one from schemas: add `import { ESTIMATED_MINUTES_MAX } from "../schemas";` and `export { ESTIMATED_MINUTES_MAX };` so existing importers keep working. estimatedMinutesSchema keeps using v.maxValue(ESTIMATED_MINUTES_MAX) unchanged. Do NOT change the schema's shape.

WEB SIDE - the browser cannot import from the API package, so the web gets its own constant.

3. apps/web/src/lib/format-estimated-hours.ts — add:
     // Mirrors ESTIMATED_MINUTES_MAX in apps/api/src/schemas.ts; the API is the authority and rejects anything above this.
     export const MAX_ESTIMATED_MINUTES = 525_600;

4. apps/web/src/components/task/task-estimated-hours-popover.tsx — import MAX_ESTIMATED_MINUTES from "@/lib/format-estimated-hours" (extend the existing import if one is already there) and replace the literal 525600 on line 55 with it.

Afterwards run and report the output of:
  pnpm --filter @kaneo/api typecheck
  pnpm --filter @kaneo/web typecheck
  pnpm exec biome ci apps/api/src/schemas.ts apps/api/src/task/validate-task-fields.ts apps/web/src/lib/format-estimated-hours.ts apps/web/src/components/task/task-estimated-hours-popover.tsx

All three must pass. Do not touch tests/api/task/validate-task-fields.test.ts — it imports ESTIMATED_MINUTES_MAX from validate-task-fields and must keep working via the re-export. Do not change any bound VALUE; 525600 stays 525600 everywhere.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/api/src/task/validate-task-fields.ts (current, lines 1-27)
_Included because: Shows the db import that fixes the dependency direction, and the constant to delete and replace with a re-export._

```
import { asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";
import db from "../database";
import { columnTable } from "../database/schema";

export const VALID_PRIORITIES = [...] as const;

export const VIRTUAL_STATUSES = ["planned", "archived"] as const;

// 525_600 is one year in minutes
export const ESTIMATED_MINUTES_MAX = 525_600;

export const estimatedMinutesSchema = v.nullable(
  v.pipe(
    v.number(),
    v.integer(),
    v.minValue(0),
    v.maxValue(ESTIMATED_MINUTES_MAX),
  ),
);
```

#### apps/api/src/schemas.ts (current, the field to change)
_Included because: The literal to replace; note this file imports only valibot, which is why the constant belongs here._

```
import * as v from "valibot";

export const taskSchema = v.object({
  // ...
  estimatedMinutes: v.optional(
    v.nullable(
      v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(525_600)),
    ),
  ),
  // ...
});
```

#### apps/web/src/components/task/task-estimated-hours-popover.tsx (line 55)
_Included because: The web literal to replace._

```
    if (Number.isNaN(hours) || hours < 0 || Math.round(hours * 60) > 525600) {
```
### Acceptance criteria
- ESTIMATED_MINUTES_MAX is defined once in apps/api/src/schemas.ts and re-exported from validate-task-fields.ts
- schemas.ts does not import from apps/api/src/task, preserving its dependency-free position
- MAX_ESTIMATED_MINUTES is defined once in format-estimated-hours.ts and used by the popover
- No numeric literal 525600 or 525_600 remains outside the two constant definitions and the test
- Both typechecks and biome ci pass
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "files_changed": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "api_typecheck_ok": {
      "type": "boolean"
    },
    "web_typecheck_ok": {
      "type": "boolean"
    },
    "biome_ok": {
      "type": "boolean"
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "files_changed",
    "api_typecheck_ok",
    "web_typecheck_ok",
    "biome_ok",
    "summary"
  ]
}
```
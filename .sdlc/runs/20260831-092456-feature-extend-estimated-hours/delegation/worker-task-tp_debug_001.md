## Task tp_debug_001 — debug / lint_fix
Module: cross
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

`pnpm exec biome ci` reports 3 errors and 2 warnings on this run's changed files. Fix exactly these and nothing else.

1. apps/api/src/task/controllers/update-task-estimated-minutes.ts:9 lint/correctness/noUnusedFunctionParameters — `currentUserId` is accepted but never used, because this controller deliberately does not publishEvent. Remove `currentUserId` from BOTH the destructured parameter and its type. Then update the single call site in apps/api/src/task/index.ts inside the PUT /estimated-minutes/:id handler to call updateTaskEstimatedMinutes({ id, estimatedMinutes }) and delete the now-unused `const currentUserId = c.get("userId");` line in THAT handler only — every other route still needs its own.

2. apps/web/src/components/task/task-estimated-hours-popover.tsx:55 lint/suspicious/noGlobalIsNan — replace `isNaN(hours)` with `Number.isNaN(hours)`.

3. Formatting: run
     pnpm exec biome format --write apps/api/src/schemas.ts apps/web/src/components/task/task-estimated-hours-popover.tsx apps/web/src/fetchers/task/update-task-estimated-minutes.ts

Then re-run and report the output of:
     pnpm exec biome ci apps/api/src/task apps/api/src/schemas.ts apps/web/src/lib/format-estimated-hours.ts apps/web/src/lib/format-estimated-hours.test.ts apps/web/src/components/task/task-estimated-hours-popover.tsx apps/web/src/components/kanban-board apps/web/src/fetchers/task apps/web/src/hooks/mutations/task apps/web/src/types/task tests/api/task

It must report zero errors. Do not touch any file not named above. Do not run biome with --write on a whole directory.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/api/src/task/controllers/update-task-estimated-minutes.ts (current, lines 6-18)
_Included because: The unused parameter to remove, in both the destructuring and the type._

```
async function updateTaskEstimatedMinutes({
  id,
  estimatedMinutes,
  currentUserId,
}: {
  id: string;
  estimatedMinutes: number | null;
  currentUserId: string;
}) {
```

#### apps/api/src/task/index.ts (the new handler, current)
_Included because: The single call site to update. Only this handler loses its currentUserId line._

```
    async (c) => {
      const { id } = c.req.valid("param");
      const { estimatedMinutes } = c.req.valid("json");
      const currentUserId = c.get("userId");

      const task = await updateTaskEstimatedMinutes({
        id,
        estimatedMinutes,
        currentUserId,
      });

      return c.json(task);
    },
```
### Acceptance criteria
- currentUserId is removed from the controller signature, its type, and the single call site
- Number.isNaN replaces the global isNaN
- The three named files are biome-formatted
- biome ci reports zero errors over the run's changed paths
- No file outside the named set is modified
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "fixed": {
      "type": "boolean"
    },
    "biome_clean": {
      "type": "boolean"
    },
    "biome_output": {
      "type": "string"
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "fixed",
    "biome_clean",
    "biome_output",
    "summary"
  ]
}
```
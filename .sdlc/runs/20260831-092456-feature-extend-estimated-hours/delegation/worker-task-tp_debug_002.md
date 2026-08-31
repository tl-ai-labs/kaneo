## Task tp_debug_002 — debug / lint_fix
Module: api-schema
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

`pnpm exec biome ci` reports exactly 2 formatting errors, both in drizzle-kit-generated files from this run:
  apps/api/drizzle/meta/0043_snapshot.json
  apps/api/drizzle/meta/_journal.json

The repo's previously committed equivalents (0040/0041/0042_snapshot.json) pass biome, so this repo commits drizzle output in biome-formatted form. Bring the two new files in line by running exactly:

  pnpm exec biome format --write apps/api/drizzle/meta/0043_snapshot.json apps/api/drizzle/meta/_journal.json

Then confirm with:

  pnpm exec biome ci apps/api/drizzle

Do NOT edit the JSON by hand and do NOT alter any value — only whitespace may change. Do not touch apps/api/drizzle/0043_odd_random.sql. Report the final biome output.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- Both files were reformatted by biome format --write, not by hand
- biome ci on apps/api/drizzle reports zero errors
- No JSON value changed, only whitespace
- The .sql migration file is untouched
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "formatted": {
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
    "formatted",
    "biome_clean",
    "biome_output",
    "summary"
  ]
}
```
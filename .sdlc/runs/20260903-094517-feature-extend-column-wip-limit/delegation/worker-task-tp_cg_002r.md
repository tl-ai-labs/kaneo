## Task tp_cg_002r — codegen / migration
Module: api-database
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
drizzle-kit wrote its JSON output with 2-space indentation, but this repo's biome.json sets formatter.indentStyle = "tab" and every pre-existing drizzle JSON artifact (e.g. apps/api/drizzle/meta/0042_snapshot.json) is tab-indented. Normalize the two new files ONLY.

Run exactly this one command:

pnpm exec biome format --write apps/api/drizzle/meta/_journal.json apps/api/drizzle/meta/0043_snapshot.json

Then confirm with: pnpm exec biome ci apps/api/drizzle/meta/_journal.json apps/api/drizzle/meta/0043_snapshot.json

STRICTLY FORBIDDEN: do NOT run `pnpm lint`, `pnpm -r lint`, `biome check --write`, or biome with a directory or `.` argument — those rewrite unrelated files across the repo. Pass only the two explicit file paths. Do not change the JSON content, key order, or any value; this is a whitespace-only reformat. Do not touch the .sql file or any migration 0000-0042.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### biome.json
_Included because: why the reformat is required_

```
formatter.indentStyle is "tab" repo-wide; javascript.formatter.indentStyle is "space" but that applies to JS/TS only, not JSON.
```

#### apps/api/drizzle/meta/0042_snapshot.json
_Included because: reference for expected formatting_

```
Pre-existing drizzle snapshot, tab-indented and passing biome ci — the target format.
```
### Acceptance criteria
- pnpm exec biome ci apps/api/drizzle/meta/_journal.json apps/api/drizzle/meta/0043_snapshot.json exits 0
- Both files are tab-indented
- No JSON key, value or ordering changed — whitespace only
- No file outside apps/api/drizzle/meta/ was modified
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
    "biome_ci_output": {
      "type": "string"
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "files_changed",
    "summary"
  ]
}
```
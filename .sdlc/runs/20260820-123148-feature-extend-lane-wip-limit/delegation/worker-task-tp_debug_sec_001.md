## Task tp_debug_sec_001 — debug / security_refinement
Module: column
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Security review finding (Low, input validation): the `wipLimit` Valibot pipe has a lower bound but no upper bound, so values above PostgreSQL `integer` max (2147483647) pass validation and fail at the DB driver as an unhandled 22003, producing a generic 500 plus Sentry noise instead of a clean 400.

Edit apps/api/src/column/index.ts. There are exactly TWO occurrences of the line:
  v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))),
One in the create-column POST json validator (~line 63-65) and one in the update-column PUT json validator (~line 143-145). Change BOTH to:
  v.nullable(
    v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2_147_483_647)),
  ),

House style reference (do not change these files, they only show ordering + numeric-separator convention): apps/api/src/generic-webhook-integration/index.ts:150 uses `v.pipe(v.number(), v.integer(), v.minValue(5), v.maxValue(43_200))` — maxValue goes last in the pipe, and large integer literals use `_` separators.

Change NOTHING else in the file. Do not touch imports, route metadata, OpenAPI descriptions, controllers, or any other file. Keep Biome formatting (2-space indent, trailing commas).
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/api/src/column/index.ts
_Included because: The file to edit; both wipLimit validators live here._

```
(read the file directly from the working directory)
```
### Acceptance criteria
- apps/api/src/column/index.ts contains exactly two occurrences of v.maxValue(2_147_483_647)
- Both occurrences are inside a v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1), ...)) for the wipLimit field
- maxValue is the last element of the pipe, after minValue
- No other line in the file is modified
- File still parses as valid TypeScript
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
    "occurrences_changed": {
      "type": "number"
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "path",
    "occurrences_changed",
    "summary"
  ]
}
```
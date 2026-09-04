## Task tp_013_format_fix — debug / format_fix
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
apps/web/src/lib/board-filter-search-params.ts fails the repo formatter. Running 'pnpm exec biome ci apps/web/src/lib/board-filter-search-params.ts' reports 'File content differs from formatting output'.

The offending line is the decodeBoardFilters signature, which exceeds the 80-column line width and must be wrapped:

  export function decodeBoardFilters(search: Record<string, unknown>): BoardFilters {

must become:

  export function decodeBoardFilters(
    search: Record<string, unknown>,
  ): BoardFilters {

Apply that wrap, plus any other purely formatting change Biome wants in this ONE file. Change formatting ONLY - do not alter any logic, any exported name, any signature type, or any behaviour.

IMPORTANT: run the formatter scoped to this single file only. Use 'pnpm exec biome check --write apps/web/src/lib/board-filter-search-params.ts' - NEVER 'pnpm lint', NEVER any package lint script, NEVER 'biome check --write .' on a directory. Those rewrite unrelated files across the repo and destroy the ability to report an honest diff.

Then verify BOTH of these are clean:
  pnpm exec biome ci apps/web/src/lib/board-filter-search-params.ts
  pnpm --filter @kaneo/web test src/lib/board-filter-search-params.test.ts
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/lib/board-filter-search-params.ts
_Included because: the file to reformat_

```
undefined
```
### Acceptance criteria
- pnpm exec biome ci apps/web/src/lib/board-filter-search-params.ts is clean
- pnpm --filter @kaneo/web test src/lib/board-filter-search-params.test.ts still passes
- only formatting changed - no logic, name or signature type altered
- no other file in the repo was modified
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
    "biome_clean": {
      "type": "boolean"
    },
    "tests_pass": {
      "type": "boolean"
    },
    "logic_unchanged": {
      "type": "boolean"
    }
  },
  "required": [
    "path",
    "biome_clean",
    "tests_pass",
    "logic_unchanged"
  ]
}
```
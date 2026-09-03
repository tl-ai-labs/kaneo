## Task tp_cg_013 — codegen / react_component
Module: web-board
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Senior review finding N-1. The `column` prop reaching ColumnHeader is the FILTERED project (board.tsx passes sortedProject, derived from useTaskFiltersWithLabelsSupport), so `column.tasks.length` is the post-filter count. Today an over-cap column stops looking over-cap the moment a user filters or searches. Fix: decide on the TRUE count, display the FILTERED count.

Edit apps/web/src/components/kanban-board/column/column-header.tsx only. Replace the current derivation block with:

  const { data: columnsData } = useGetColumns(project?.id ?? "");
  const wipLimit =
    columnsData?.find((entry) => entry.slug === column.slug)?.wipLimit ?? null;
  const displayCount = column.tasks.length;
  // `column` is the filtered project's column; the store holds the unfiltered
  // one. Filters must never clear a breach that is genuinely true.
  const totalCount =
    project?.columns?.find((entry) => entry.slug === column.slug)?.tasks
      .length ?? displayCount;
  const isOverCap = wipLimit !== null && totalCount > wipLimit;
  const isFiltered = totalCount !== displayCount;

`project` is the store project, already destructured from useProjectStore() in this component.

Then in the JSX badge: keep rendering `${displayCount}/${wipLimit}` as the visible text, keep the wipLimit === null branch byte-identical to today, and pick the title / sr-only message like this:

  const badgeMessage = isOverCap
    ? isFiltered
      ? t("tasks:kanban.wipLimitOverCapFiltered", { taskCount: displayCount, total: totalCount, limit: wipLimit })
      : t("tasks:kanban.wipLimitOverCap", { taskCount: displayCount, limit: wipLimit })
    : isFiltered
      ? t("tasks:kanban.wipLimitFiltered", { taskCount: displayCount, total: totalCount, limit: wipLimit })
      : t("tasks:kanban.wipLimitTitle", { taskCount: displayCount, limit: wipLimit });

Use badgeMessage for both the `title` and the over-cap `sr-only` span, so the duplicated t() call is gone. Keep the aria-hidden TriangleAlert, the cn() class logic and the existing theme tokens exactly as they are.

Invariant that must survive: the `?? displayCount` fallback means a store miss degrades to the filtered count, which can only UNDER-report. Filters can never manufacture a breach. Do not add an isLoading/isError branch.

Then run: pnpm --filter @kaneo/web typecheck  and  pnpm exec biome ci apps/web/src/components/kanban-board/column/column-header.tsx
Do NOT run any test suite — the 9-minute worker timeout killed an earlier packet that did.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/components/kanban-board/column/column-header.tsx
_Included because: file to edit_

```
Current derivation is at lines 31-35; the badge JSX is at lines 70-96. project/setProject come from useProjectStore() at line 20.
```

#### i18n/en-US.json
_Included because: the i18n keys to use_

```
tasks.kanban now holds addTask, wipLimitTitle, wipLimitOverCap, wipLimitFiltered, wipLimitOverCapFiltered. The two Filtered keys interpolate {{taskCount}}, {{total}} and {{limit}}.
```
### Acceptance criteria
- isOverCap compares totalCount (from the store's unfiltered project) against wipLimit with strict >
- The visible badge text still renders displayCount/wipLimit, not totalCount
- totalCount falls back to displayCount when the store has no matching column, so filters can never manufacture a breach
- When a filter is active and the column is over cap, the title and sr-only text disclose the true total via tasks:kanban.wipLimitOverCapFiltered
- The wipLimit === null branch is byte-identical to before
- No isLoading or isError branch; no hard-coded colour; t() is not called twice for the same message
- pnpm --filter @kaneo/web typecheck passes and biome ci on the file exits 0
- No file other than column-header.tsx was modified
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
    "summary": {
      "type": "string"
    },
    "verified": {
      "type": "string"
    }
  },
  "required": [
    "files_changed",
    "summary"
  ]
}
```
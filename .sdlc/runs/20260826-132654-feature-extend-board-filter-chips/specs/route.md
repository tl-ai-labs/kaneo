### E2 — the board route, precisely

1. Delete the local `type BoardSearchParams` (L24-26); import the type from the codec.
2. `validateSearch: (search) => ({...})` (L32-34) becomes `validateSearch: readBoardSearchParams,`.
   One line. The whole AC-6 surface is now covered by A2.
3. `const { taskId } = Route.useSearch();` (L80) becomes `const search = Route.useSearch();` plus
   `const { taskId } = search;`.
4. New memo, placed above the hook call:
   ```ts
   const urlState = useMemo(
     () => ({ filters: parseBoardFilterSearch(search), carriesFilters: searchCarriesBoardFilters(search) }),
     [search],
   );
   ```
5. `useTaskFiltersWithLabelsSupport(project, projectId, boardSearchQuery, urlState)` (L166).
6. `useBoardFilterUrlSync(filters, search)` immediately after the hook call.
7. `handleCloseTaskSheet` (L96-102): `search: {}` → `search: withTaskId(undefined)`. `replace: true`
   and the `[navigate]` dep array stay.
### 8.1 AC → test map

Every criterion maps to a named test in a named file. Roughly 24 new tests after the Gate 2 widening (16 planned pre-amendment + 8 behavioral AC-5 cases for sites 1-5 and 8-9). The exact final count is whatever `pnpm --filter @kaneo/web test` reports and is recorded in the final report; it must be **greater than 112** (NFR-5), and the number claimed must be the number observed.

| AC | Test name | File |
|---|---|---|
| **AC-1** | `round-trips every facet through serialize and parse, including multi-value` | A2 |
| **AC-1** | `parses a single occurrence and a repeated key to the same array shape` (FR-5) | A2 |
| **AC-2** | `applies URL filters over stored filters and writes them back to storage` | E3 |
| **AC-2 / FR-15 / KD-3** | `never commits the default filter set before URL or storage is resolved` | E3 |
| **AC-3** | `restores persisted label filters from storage and matches tasks from project data` — **existing, unmodified**, L16-105 | E3 |
| **AC-4** | `reports no carried filters for an empty-string facet` + `…for an array of only empty strings` + `reports carried filters when at least one facet has a non-empty value` | A2 |
| **AC-4** | `restores stored filters when the URL carries only an empty facet` — dedicated hook test | E3 |
| **AC-5** sites 6-7 | `passes a search updater that preserves unrelated params when opening a task` + `…when closing an open task` | E4 `list-view/task-row.test.tsx` |
| **AC-5** sites 4-5 | `j preserves filter params while focusing the next task` + `k …previous…` | **T-C** `kanban-board/index.test.tsx` (Gate 2) |
| **AC-5** sites 8-9 | same pair for the list view | **T-E** `list-view/index.test.tsx` (Gate 2) |
| **AC-5** sites 2-3 | `opening a task from a card preserves filter params` + `…closing…` | **T-B** `components/board/task-card-search-preservation.test.tsx` |
| **AC-5** site 1 | `closing the task sheet preserves filter params` — highest-risk test, dropped-and-reported if unreliable | **T-A** `components/board/board-route-search-preservation.test.tsx` |
| **AC-5** | `withTaskId preserves every unrelated search key` + `…clears taskId while preserving unrelated search keys` + `…does not mutate the previous search object` | A4 |
| **AC-5** (view switch, FR-19) | `keeps filter state across a project data re-render` | E3 |
| **AC-5** (task sheet) | `preserves taskId when writing filters to the URL` | A6 |
| **AC-6** | `returns the default filter set for %s without throwing` — table-driven | A2 |
| **AC-6** | `does not copy a prototype-polluting key into the parsed result` | A2 |
| **AC-6 / FR-7** | `caps a facet at MAX_FILTER_VALUES and drops over-long values` + `dedupes repeated values while preserving order` | A2 |
| **AC-7** | `omits every facet key when no filter is active` | A2 |
| **AC-7 / IS-7** | `removes facet keys that are no longer active while preserving unrelated keys` | A2 (`applyBoardFiltersToSearch`) |
| **AC-7 / IS-7** | `removes facet params from the URL when the last filter is cleared` | A6 |
| **AC-8** | `writes active filters to the URL with replace: true` | A6 |
| **AC-8** | `does not navigate when the URL already matches the filter state` | A6 |
| **AC-9** | see §8.4 — **partially proven, and reported as such** | E3 (read direction only) |
| **AC-10** | full `pnpm --filter @kaneo/web test` — 112 → 128 | — |
| **AC-11** | `pnpm --filter @kaneo/web typecheck` | — |
| **AC-12** | `biome ci` on exactly the 14 changed paths | — |
| **AC-13** | `git status --porcelain` after every dispatch | — |

Supporting codec tests not tied to a single AC: `drops empty-string values instead of preserving
them` (FR-6), `areBoardFiltersEqual distinguishes null from an empty array and detects reordering`.
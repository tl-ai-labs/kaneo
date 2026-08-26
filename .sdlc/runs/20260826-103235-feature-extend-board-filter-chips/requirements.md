# Delta Requirements — URL-Persisted Board Filter State

## 1. Summary
This ticket extends the Kaneo board route to persist active board filter state (status, priority, assignee, dueDate, and labels) in TanStack Router search parameters, enabling shareable, bookmarkable filtered board URLs. URL search parameters take precedence on page load and synchronize back to project localStorage, while preserving existing localStorage fallback for parameterless URLs and retaining existing chip UI and filtering semantics. All in-route navigations across board and list views are updated to retain filter search parameters without clobbering query state or polluting browser history.

## 2. In scope
1. Encoding and decoding all five board filter dimensions (`status`, `priority`, `assignee`, `dueDate`, `labels`) to and from TanStack Router search parameters on the board route.
2. Precedence handling on load: URL filter parameters override local storage and write back to `kaneo:board-filters:${projectId}`.
3. Fallback handling on load: URLs without filter parameters restore filter state from project localStorage.
4. Empty parameter handling: empty parameter values (e.g., `?status=`) are ignored and do not count as active filters or suppress localStorage restoration.
5. In-route navigation preservation: updating all 9 `navigate()` call sites across board and list views to preserve search parameters when modifying `taskId` or view mode.
6. History navigation: updating filter search parameters using `replace: true` so filter adjustments do not create individual history entries, while supporting coherent browser Back/Forward navigation.
7. Clean URLs: omitting filter parameters entirely when no filters are active rather than emitting empty query parameters.
8. Resilient search validation: ensuring `validateSearch` never throws on malformed, unexpected, or hostile inputs, degrading safely to default values.
9. Colocated unit and integration tests covering parameter serialization, route validation, navigation parameter preservation, and hook synchronization.

## 3. Out of scope
1. Redesigning, restyling, or rebuilding the filter chips, `ActiveFilterChip` components, or `BoardToolbar` UI.
2. Changing `BoardToolbar`'s props interface or its downstream component hierarchy.
3. Adding new filter categories or altering filtering logic, predicate matching, or the `assignee` filter field (which matches `task.userId`).
4. Extending URL search parameter persistence to backlog, list, or gantt routes outside the board route (`.../project/$projectId/board.tsx`).
5. Modifying backend APIs, database schemas, or server endpoints (`apps/api/**`).
6. Modifying global router initialization, app-wide router configuration (`apps/web/src/main.tsx`), or user preferences store (`apps/web/src/store/user-preferences.ts`).
7. Refactoring or deleting the unused `useTaskFilters()` hook in `apps/web/src/hooks/use-task-filters.ts`.
8. Deduplicating shared filter helper functions (`DEFAULT_FILTERS`, `FILTER_KEYS`, `normalizeFilters`) across filter hook files.

## 4. Functional requirements
- **FR-1 (Filter Parameter Serialization):** The system shall serialize all five filter dimensions (`status`, `priority`, `assignee`, `dueDate`, `labels`) as array-valued search parameters in TanStack Router search state, and parse valid parameter values into `BoardFilters` format (`string[] | null`).
  - *Traceability:* Brief AC: "All five filters round-trip through the URL."
- **FR-2 (URL Load Precedence & Sync-Back):** When the board route loads with one or more non-empty filter parameters present in the URL, the system shall apply those filter parameters immediately (ignoring pre-existing stored filters) and asynchronously sync the resolved filters back to `kaneo:board-filters:${projectId}` in `localStorage`.
  - *Traceability:* Brief AC: "Opening a board URL carrying filter params applies exactly those filters regardless of stored state, then writes them to localStorage for that project."
- **FR-3 (LocalStorage Fallback on Empty Query):** When the board route loads with no filter parameters in the URL, the system shall restore active filters from `kaneo:board-filters:${projectId}` in `localStorage`, maintaining default behavior for users navigating without filter query strings.
  - *Traceability:* Brief AC: "Opening the board with no filter params restores the localStorage state, preserving today's behavior for users who never share a link."
- **FR-4 (Empty Parameter Normalization):** The system shall treat empty or whitespace-only parameter values (e.g., `?status=`, `?labels=`, `?priority=&status=`) as absent/null. Empty parameters shall not be considered active filters and shall not suppress localStorage restoration.
  - *Traceability:* Brief AC: "An empty param (e.g. ?status=) must not count as 'the URL carries filters' — treating it as truthy would suppress the localStorage restore and silently blank a returning user's board."
- **FR-5 (Search Parameter Preservation on Navigation):** The system shall preserve all active filter search parameters across all 9 in-route `navigate()` call sites on the board route when opening task sheets, closing task sheets, focusing tasks, or switching views (`board.tsx:97`, `kanban-board/task-card.tsx:148`, `kanban-board/task-card.tsx:153`, `kanban-board/index.tsx:67`, `kanban-board/index.tsx:74`, `list-view/task-row.tsx:147`, `list-view/task-row.tsx:152`, `list-view/index.tsx:97`, `list-view/index.tsx:104`).
  - *Traceability:* Brief AC: "Filters survive every in-app navigation on the board route — opening a task, closing a task, and switching between the board and list views."
- **FR-6 (Replace History on Filter Mutation):** The system shall update route search parameters using history replacement (`replace: true`) whenever filter chips are toggled, updated, or cleared, preventing search parameter mutations from polluting the browser session history stack.
  - *Traceability:* Brief AC: "Filter changes do not push a history entry per interaction."
- **FR-7 (Clean URL Generation):** When all filter dimensions are empty or cleared (or when `clearFilters()` is invoked), the system shall remove all filter keys from the URL search query, producing a clean route URL containing no empty filter keys.
  - *Traceability:* Brief AC: "A board with no active filters produces a clean URL with no empty filter params."
- **FR-8 (Browser History Navigation Coherence):** When the user triggers browser Back or Forward navigation between distinct board filter states or task sheet states, the system shall re-synchronize the active board filter UI and task filtering logic with the updated search parameters.
  - *Traceability:* Brief AC: "Browser Back behaves coherently with respect to filter state."

## 5. Non-functional requirements
- **NFR-1 (Never-Throw Search Validation):** `validateSearch` for the board route shall never throw uncaught exceptions on malformed, invalid, unexpected data types, array mutations, or hostile input. Invalid values shall degrade safely to `undefined`/null defaults to prevent route crashing.
  - *Traceability:* Brief AC: "validateSearch degrades malformed, hostile, or null input to the default filter set rather than throwing; a throwing validator takes the route down."
- **NFR-2 (Zero Regression in Test Suite):** All existing 112 unit/integration tests across 36 test files in `@kaneo/web` shall continue to pass without regression, and `pnpm --filter @kaneo/web typecheck` shall complete with 0 diagnostic errors.
  - *Traceability:* Brief AC: "Existing chip UI, filtering semantics, and all current tests continue to pass unchanged."
- **NFR-3 (Component Interface Stability):** The props contract for `<BoardToolbar />` (`filters`, `updateFilter`, `updateLabelFilter`, `clearFilters`, `hasActiveFilters`) and the return signature of `useTaskFiltersWithLabelsSupport` shall remain backward-compatible to avoid ripple refactors across consuming components.
  - *Traceability:* Brief AC: "Existing chip UI, filtering semantics, and all current tests continue to pass unchanged."

## 6. Affected surfaces

| File Path | What Changes | Why |
|---|---|---|
| `apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx` | Extend `BoardSearchParams` type with optional filter fields (`status`, `priority`, `assignee`, `dueDate`, `labels`); update `validateSearch` to safely parse filter parameters; update `handleCloseTaskSheet` (line 97) to preserve filter search params; sync filter state with URL. | Route entry point must declare, validate, and synchronize filter search parameters and avoid clobbering search state on task sheet closure. |
| `apps/web/src/lib/board-filter-params.ts` *(new)* | Introduce serialization, deserialization, and normalization helpers for converting between `BoardFilters` and URL search parameters. | Encapsulates parameter parsing, array normalization, empty value stripping, and clean URL generation with dedicated unit tests. |
| `apps/web/src/hooks/use-task-filters-with-labels-support.ts` | Update initial state resolution and synchronization effects to respect URL search parameter precedence on mount, trigger sync-back to localStorage, and avoid unconditional initial clobber writes. | Hook manages filter state lifecycle, reconciling URL search parameters with per-project `localStorage` persistence. |
| `apps/web/src/components/kanban-board/index.tsx` | Update `navigate` calls at lines 67 and 74 to merge/preserve existing search parameters rather than overwriting with `{ taskId: ... }`. | Prevents task focus and keyboard navigation in Kanban view from stripping active URL filters. |
| `apps/web/src/components/kanban-board/task-card.tsx` | Update `navigate` calls at lines 148 and 153 to merge/preserve existing search parameters when opening or closing task sheets. | Prevents card click interactions in Kanban view from stripping active URL filters. |
| `apps/web/src/components/list-view/index.tsx` | Update `navigate` calls at lines 97 and 104 to merge/preserve existing search parameters rather than overwriting with `{ taskId: ... }`. | Prevents task focus and keyboard navigation in List view from stripping active URL filters. |
| `apps/web/src/components/list-view/task-row.tsx` | Update `navigate` calls at lines 147 and 152 to merge/preserve existing search parameters when opening or closing task sheets. | Prevents row click interactions in List view from stripping active URL filters. |
| `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` | Update test harness to supply route/search context or parameters, verifying URL precedence and localStorage synchronization. | Ensures hook unit tests validate URL-first precedence and persistence without regressions. |
| `apps/web/src/components/list-view/task-row.test.tsx` | Update mock navigate assertions to expect preserved search parameters alongside `taskId`. | Ensures component-level navigation tests assert search parameter preservation. |
| `apps/web/src/lib/board-filter-params.test.ts` *(new)* | Add unit test suite for filter search parameter parsing, serialization, empty-string handling, and non-throwing validation edge cases. | Directly verifies round-tripping, boundary conditions, and resilient error recovery. |

## 7. Acceptance criteria
- **AC-1 (Filter Round-Trip Serialization):** `apps/web/src/lib/board-filter-params.test.ts` asserts that a `BoardFilters` object with values for all five dimensions (`status`, `priority`, `assignee`, `dueDate`, `labels`) serializes to search params and deserializes back to an identical `BoardFilters` structure.
  - *Traceability:* Brief AC #1.
- **AC-2 (URL Parameter Precedence on Load):** `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` asserts that when initialized with URL search params containing `status=["in_progress"]` and localStorage containing `status=["todo"]`, the hook resolves `filters.status` to `["in_progress"]` and writes `["in_progress"]` to localStorage.
  - *Traceability:* Brief AC #2.
  - *Failing Baseline Test:* **FAILS against today's code** because today's hook does not inspect URL search parameters and unconditionally restores `["todo"]` from localStorage.
- **AC-3 (LocalStorage Restoration on No-Filter URL):** `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` asserts that when no filter params exist in the URL and localStorage contains `priority=["high"]`, the hook resolves `filters.priority` to `["high"]`.
  - *Traceability:* Brief AC #3.
- **AC-4 (Empty Parameter Immunity):** `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` and `apps/web/src/lib/board-filter-params.test.ts` assert that query inputs with empty strings (e.g. `?status=`) are parsed as empty/absent filters and do not suppress localStorage restoration.
  - *Traceability:* Brief AC #4.
- **AC-5 (Filter Survival Across In-Route Navigation):** `apps/web/src/components/list-view/task-row.test.tsx` asserts that clicking a task row when active filters exist in search params invokes `navigate` with both `taskId` and all existing filter search params preserved (not an isolated `{ taskId: task.id }`).
  - *Traceability:* Brief AC #5.
  - *Failing Baseline Test:* **FAILS against today's code** because today's `task-row.tsx` replaces the search object with `{ taskId: task.id }` or `{}`.
- **AC-6 (Clean URL on Clear Filters):** `apps/web/src/lib/board-filter-params.test.ts` asserts that passing `DEFAULT_FILTERS` or invoking clear filters yields a search params object without any filter keys (`status`, `priority`, `assignee`, `dueDate`, `labels`).
  - *Traceability:* Brief AC #8.
- **AC-7 (Never-Throw Search Validator Robustness):** `apps/web/src/lib/board-filter-params.test.ts` asserts that `validateSearch` accepts corrupted inputs (`null`, `{ status: 123 }`, `{ priority: {} }`, `{ unknownKey: ["bad"] }`) without throwing exceptions and returns clean, normalized parameters.
  - *Traceability:* Brief AC #7.
- **AC-8 (Replace History Configuration):** Component integration tests for filter updates verify that search navigation is invoked with `{ replace: true }`.
  - *Traceability:* Brief AC #9.
- **AC-9 (Zero Test Suite & Typecheck Regressions):** Running `pnpm --filter @kaneo/web test` passes all test suites (baseline 112 tests plus new tests) and `pnpm --filter @kaneo/web typecheck` exits with status code 0.
  - *Traceability:* Brief AC #10.

## 8. Risks and open questions

### Architectural Decision: Search Param Validator Implementation
- **Convention context:** discovery found an even 5:5 split in `apps/web` between Zod schemas (`import { z } from "zod/v4"`) and hand-rolled `typeof` parsing functions in `validateSearch`.
- **Recommendation: Hand-rolled parser helper functions (`hand-rolled`).**
  - *Reasoning:* Hand-rolled parsing functions (e.g. `parseStringArrayParam(raw)`) offer zero runtime exception risk, match existing `board.tsx` convention, cleanly enforce `never-throw` semantics without complex Zod transform/catch layers, and provide exact type narrowing for TanStack Router search definitions.

### Risks
1. **Unconditional Initial LocalStorage Write:** Today's `useTaskFiltersWithLabelsSupport` has an unconditional save effect firing on mount that can overwrite valid localStorage state with default nulls before restoration settles. The URL and localStorage synchronization must use an explicit initialization guard to prevent clobbering.
2. **Navigate Functional Search Updater:** TanStack Router supports functional search parameter updates `search: (prev) => ({ ...prev, taskId: ... })`. Using functional updaters or helper utilities across all 9 navigate call sites avoids race conditions against concurrent search state changes.
3. **Test Harness Compatibility:** Existing hook tests in `use-task-filters-with-labels-support.test.tsx` use `renderHook` without a TanStack Router context wrapper. The hook design should allow optional router injection or maintain standalone testability to avoid brittle mocking.

### Open Questions
- None. Scope, precedence rules, and non-goals are fully frozen by Gate 0 decisions.

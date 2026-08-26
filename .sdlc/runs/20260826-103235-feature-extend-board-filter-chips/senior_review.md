# Senior Code Review: Board Filters (Module Review)

**Target:** `board-filters` (`apps/web`)  
**Run:** `20260826-103235-feature-extend-board-filter-chips`  
**Reviewer:** Senior Staff Adversarial Reviewer  
**Overall Verdict:** APPROVED WITH FINDINGS (No Blockers, 2 Major Defects, 2 Minor Defects)

---

## 1. Acceptance Criteria Verification (AC1 – AC9)

| ID | Acceptance Criterion | Verdict | Evidence / Line Citation |
|---|---|---|---|
| **AC1** | All five filters round-trip through the URL | **PASS** | Implemented in [`board-filter-params.ts:80-143`](file:///home/sangeetha/projects/kaneo/apps/web/src/lib/board-filter-params.ts#L80-L143) via `filtersToSearchParams` and `searchParamsToFilters`. Proven by [`board-filter-params.test.ts:11-30`](file:///home/sangeetha/projects/kaneo/apps/web/src/lib/board-filter-params.test.ts#L11-L30) (verifying all five dimensions including comma-containing strings). |
| **AC2** | URL params win on load and are written back to localStorage | **PASS** | Implemented in [`use-task-filters-with-labels-support.ts:59-62`](file:///home/sangeetha/projects/kaneo/apps/web/src/hooks/use-task-filters-with-labels-support.ts#L59-L62) (synchronous derivation) and [lines 88-92](file:///home/sangeetha/projects/kaneo/apps/web/src/hooks/use-task-filters-with-labels-support.ts#L88-L92) (mirror effect). Proven by [`use-task-filters-with-labels-support.test.tsx:139-157`](file:///home/sangeetha/projects/kaneo/apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx#L139-L157). |
| **AC3** | No filter params in URL restores from localStorage | **PASS** | Implemented in [`use-task-filters-with-labels-support.ts:64-86`](file:///home/sangeetha/projects/kaneo/apps/web/src/hooks/use-task-filters-with-labels-support.ts#L64-L86) (seed effect) and published via `onFiltersChange`. Proven by [`use-task-filters-with-labels-support.test.tsx:87-107`](file:///home/sangeetha/projects/kaneo/apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx#L87-L107). |
| **AC4** | An empty param such as `?status=` does NOT count as "URL carries filters" | **PASS** | Implemented in [`board-filter-params.ts:22-45, 145-168`](file:///home/sangeetha/projects/kaneo/apps/web/src/lib/board-filter-params.ts#L22-L45) where `hasActiveFilterParams` filters out empty / whitespace strings. Proven by [`board-filter-params.test.ts:90-113`](file:///home/sangeetha/projects/kaneo/apps/web/src/lib/board-filter-params.test.ts#L90-L113) and [`use-task-filters-with-labels-support.test.tsx:197-218`](file:///home/sangeetha/projects/kaneo/apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx#L197-L218). |
| **AC5** | Filters survive opening a task, closing a task, and switching board/list view | **UNPROVEN** | Task opening ([`task-card.tsx:154-157`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/kanban-board/task-card.tsx#L154-L157), [`task-row.tsx:155-158`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/list-view/task-row.tsx#L155-L158)) and closing ([`board.tsx:98-105`](file:///home/sangeetha/projects/kaneo/apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx#L98-L105)) preserve filter parameters via functional updater and are proven in [`task-row.test.tsx:115-155`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/list-view/task-row.test.tsx#L115-L155). However, while `viewMode` toggles purely within Zustand ([`board.tsx:85, 258-268`](file:///home/sangeetha/projects/kaneo/apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx#L85)) leaving search params untouched, there is **zero automated test coverage** exercising view switching with active filters. |
| **AC6** | Browser Back behaves coherently | **UNPROVEN** | `replace: true` is set for filter mutations in [`board.tsx:114`](file:///home/sangeetha/projects/kaneo/apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx#L114), but there are no integration or popstate tests for browser Back. Furthermore, an asymmetry between `handleCloseTaskSheet` (`replace: true`) and task-card/row deselect clicks (`push`) creates a dead/duplicate history entry scenario on Back (see Finding F5). |
| **AC7** | `validateSearch` never throws on malformed, hostile or null input | **PASS** | Implemented in [`board-filter-params.ts:47-76`](file:///home/sangeetha/projects/kaneo/apps/web/src/lib/board-filter-params.ts#L47-L76). Proven extensively by [`board-filter-params.test.ts:54-79`](file:///home/sangeetha/projects/kaneo/apps/web/src/lib/board-filter-params.test.ts#L54-L79) with null, undefined, primitives, cyclic-like shapes, deep objects, and arrays. |
| **AC8** | A board with no active filters produces a clean URL with no empty params | **PASS** | Implemented in [`board-filter-params.ts:78-108`](file:///home/sangeetha/projects/kaneo/apps/web/src/lib/board-filter-params.ts#L78-L108) which returns `undefined` for inactive dimensions, causing TanStack Router to omit them. Proven by [`board-filter-params.test.ts:116-139`](file:///home/sangeetha/projects/kaneo/apps/web/src/lib/board-filter-params.test.ts#L116-L139). |
| **AC9** | Filter changes do not push a history entry per interaction | **PASS** | Implemented in [`board.tsx:109-117`](file:///home/sangeetha/projects/kaneo/apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx#L109-L117) where `handleFiltersChange` explicitly passes `replace: true` to `navigate`. |

---

## 2. In-Depth Findings (F1 – F6)

### Finding F1: The Seed / Sync-Back Pair
* **Trace & Exclusivity:**
  - **Render 1 (Cold Start, empty URL):** `hasActiveFilterParams(searchFilters)` is `false`. The sync-back effect ([`use-task-filters-with-labels-support.ts:89`](file:///home/sangeetha/projects/kaneo/apps/web/src/hooks/use-task-filters-with-labels-support.ts#L89)) immediately returns `undefined` without executing `localStorage.setItem`. The seed effect ([lines 64-86](file:///home/sangeetha/projects/kaneo/apps/web/src/hooks/use-task-filters-with-labels-support.ts#L64-L86)) checks `!hasActiveFilterParams` (passes), sets `seededStorageKeyRef.current = storageKey`, reads `localStorage`, and triggers `onFiltersChange(normalized)`.
  - **Render 2 (Post-Navigation):** `searchFilters` now contains active filters. `hasActiveFilterParams(searchFilters)` evaluates to `true`. The seed effect immediately returns on line 65 without executing. The sync-back effect evaluates `hasActiveFilterParams` as `true` and synchronizes the active filters back to `localStorage.setItem`.
  - **Mutual Exclusivity:** Seed and sync-back effects branch on `hasActiveFilterParams(searchFilters)`. Because this boolean expression is strictly binary, on any single render pass exactly one effect body can proceed while the other short-circuits.
  - **Loop Prevention:** The seed navigation transitions `hasActiveFilterParams` from `false` to `true`, permanently disabling the seed effect. Furthermore, `seededStorageKeyRef.current === storageKey` blocks re-execution even if the URL remained empty.
  - **No Clobber of Stored Filters:** A returning user with stored filters will not have their storage overwritten with an empty set on Render 1 because the sync-back effect is completely inert when `hasActiveFilterParams` is `false`.

### Finding F2: The One-Shot Ref
* **Setting Ref Before Read:** In [`use-task-filters-with-labels-support.ts:69`](file:///home/sangeetha/projects/kaneo/apps/web/src/hooks/use-task-filters-with-labels-support.ts#L69), `seededStorageKeyRef.current = storageKey` is executed before reading `localStorage`. This is correct: it prevents re-entrant or duplicate executions during intermediate render cycles or if storage parsing fails.
* **Project Switch (`projectId` changes):** When the user switches projects (e.g., from `proj-1` to `proj-2`), `storageKey` changes from `kaneo:board-filters:proj-1` to `kaneo:board-filters:proj-2`. The guard `seededStorageKeyRef.current === storageKey` evaluates to `false`, allowing the seed effect to run once for the new project.
* **Component Remount:** On unmount and fresh remount, `seededStorageKeyRef` re-initializes to `null`, correctly permitting the initial seed for that session.
* **Empty LocalStorage:** When storage is empty, `seededStorageKeyRef` is assigned, `getItem` returns `null`, and line 73 exits cleanly without publishing. Subsequent renders on the same page hit `seededStorageKeyRef.current === storageKey` and bypass storage checks.

### Finding F3: Stale Closures (Defect Verified)
* **Plain Statement:** **YES**, rapid successive filter toggles or synchronous multi-filter mutations can lose updates (`f3_stale_closure_possible: true`).
* **Trace:**
  - `filters` is derived from `searchFilters` via `useMemo` ([`use-task-filters-with-labels-support.ts:59-62`](file:///home/sangeetha/projects/kaneo/apps/web/src/hooks/use-task-filters-with-labels-support.ts#L59-L62)).
  - In `updateFilter` ([lines 116-122](file:///home/sangeetha/projects/kaneo/apps/web/src/hooks/use-task-filters-with-labels-support.ts#L116-L122)) and `updateLabelFilter` ([lines 124-138](file:///home/sangeetha/projects/kaneo/apps/web/src/hooks/use-task-filters-with-labels-support.ts#L124-L138)), the next filter object is computed by spreading the render-scoped `filters` constant: `const next = { ...filters, [key]: value }`.
  - **Concrete Failure Scenario 1 (Multi-label group toggle):** In [`board-toolbar.tsx:233-247`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/board/board-toolbar.tsx#L233-L247), `toggleLabelGroup` iterates over matching labels in a loop, calling `updateLabelFilter(l.id)` sequentially. Iteration 1 computes `{ ...filters, labels: [l1.id] }` and triggers navigation. Iteration 2 executes in the same tick where `filters` is STILL the old render-scoped state (null); it computes `{ ...filters, labels: [l2.id] }`, completely dropping `l1.id`.
  - **Concrete Failure Scenario 2 (Clear all labels):** In [`board-toolbar.tsx:249-252`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/board/board-toolbar.tsx#L249-L252), `clearLabelFilters` executes `for (const labelId of filters.labels) updateLabelFilter(labelId)`. If two labels `["A", "B"]` are active, iteration 1 toggles off "A" producing `["B"]`. Iteration 2 toggles off "B" against the stale closure `["A", "B"]` producing `["A"]`. The function finishes with `["A"]` active instead of clearing!
  - **Concrete Failure Scenario 3 (Rapid User Clicks):** If a user clicks "Status: In Progress" and immediately clicks "Priority: High" before TanStack Router's URL change re-renders the component, the second click calculates `{ ...filters, priority: ["high"] }` where `status` is still `null`, discarding the status filter.

### Finding F4: View Switching
* **Mechanism:** `viewMode` is stored in the Zustand store via `useUserPreferencesStore` ([`board.tsx:85`](file:///home/sangeetha/projects/kaneo/apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx#L85)), completely independent of TanStack Router's search parameters.
* **Filter Preservation:** Toggling between Kanban and List views does not invoke `navigate` and leaves `search` intact. `useTaskFiltersWithLabelsSupport` continues to receive the unchanged `searchFilters` and filters tasks identically for both [`KanbanBoard`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/kanban-board/index.tsx#L34) and [`ListView`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/list-view/index.tsx#L46).
* **Test Coverage:** While functionally correct in code, there are **no unit or integration tests** in the codebase asserting that filters remain active after switching `viewMode`.

### Finding F5: The Back Button & History Stack Walk
* **History Trace:**
  1. User navigates to `/board` $\rightarrow$ History Stack: `[State 0: /board]`, Index: 0.
  2. User applies filter `status=in_progress` $\rightarrow$ `replace: true` replaces State 0 $\rightarrow$ Stack: `[State 0: /board?status=["in_progress"]]`, Index: 0.
  3. User clicks task card `task-1` $\rightarrow$ `task-card.tsx:154` performs `push` $\rightarrow$ Stack: `[State 0: /board?status=["in_progress"], State 1: /board?status=["in_progress"]&taskId=task-1]`, Index: 1.
  4. User closes task details sheet via `handleCloseTaskSheet` $\rightarrow$ [`board.tsx:104`](file:///home/sangeetha/projects/kaneo/apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx#L104) navigates with `replace: true` $\rightarrow$ Stack: `[State 0: /board?status=["in_progress"], State 1: /board?status=["in_progress"]]`, Index: 1.
  5. **The Bug:** Stack Index 0 and Index 1 now have **identical URLs**. When the user clicks the browser Back button, the browser transitions from Index 1 to Index 0. Because both entries have the identical URL, **the Back button appears to do nothing on the first click**.
  6. **Secondary Anomaly:** If instead of closing via the sheet, the user clicks the task card/row again to deselect, [`task-card.tsx:148-152`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/kanban-board/task-card.tsx#L148-L152) and [`task-row.tsx:147-154`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/list-view/task-row.tsx#L147-L154) execute `navigate` *without* `replace: true` (`push`). This appends State 2: `[State 0 (board), State 1 (board+task), State 2 (board)]`. Clicking Back from State 2 unexpectedly re-opens the task sheet.

### Finding F6: Clearing Filters and Spreading Undefined over `prev`
* **Mechanism:** In [`board-filter-params.ts:94-96`](file:///home/sangeetha/projects/kaneo/apps/web/src/lib/board-filter-params.ts#L94-L96), `filtersToSearchParams` sets inactive filter keys to `undefined` (via `parseFilterParam(null)` returning `undefined`).
* **Search Param Construction:** In [`board.tsx:112-113`](file:///home/sangeetha/projects/kaneo/apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx#L112-L113), `({ ...prev, ...filtersToSearchParams(next) })` spreads an object with `{ status: undefined, priority: undefined, ... }` over `prev`.
* **Behavior:** Setting object properties to `undefined` causes TanStack Router's search serializer to drop the key entirely from the emitted query string. When parsed on subsequent renders, `validateBoardSearch` sees `undefined` and omits the key.
* **Verdict:** Verified correct. Clearing a filter cleanly removes the parameter from the URL rather than leaving stale values or empty string artifacts.

---

## 3. Structural & Architectural Compliance Checks

- **`BoardToolbar` Props:** Unchanged. Verified that [`BoardToolbarProps`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/board/board-toolbar.tsx#L46-L62) retains its exact original prop signature.
- **`useTaskFilters()` Dead Code:** Untouched. [`apps/web/src/hooks/use-task-filters.ts`](file:///home/sangeetha/projects/kaneo/apps/web/src/hooks/use-task-filters.ts) is preserved verbatim and unmodified.
- **Constant Duplication:** `DEFAULT_FILTERS`, `FILTER_KEYS`, and `normalizeFilters` remain intentionally duplicated across `use-task-filters.ts` and `use-task-filters-with-labels-support.ts` without premature deduplication.
- **Off-Limits Directories:** Verified via `git status` that no protected paths (`apps/api`, `main.tsx`, `routeTree.gen.ts`, `store/user-preferences.ts`, `project-layout.tsx`, `backlog-list-view`, `i18n`) were modified.

---

## 4. Ranked Defect List

### Blocker Defects
* **None.** The test suite passes (37 files, 146 tests) and TypeScript typecheck exits with 0.

### Major Defects

1. **Stale closure in filter mutation handlers (`updateFilter`, `updateLabelFilter`, `clearLabelFilters`)**
   - **Location:** [`apps/web/src/hooks/use-task-filters-with-labels-support.ts:116-138`](file:///home/sangeetha/projects/kaneo/apps/web/src/hooks/use-task-filters-with-labels-support.ts#L116-L138) & [`apps/web/src/components/board/board-toolbar.tsx:233-252`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/board/board-toolbar.tsx#L233-L252)
   - **Why it is wrong:** `updateFilter` and `updateLabelFilter` compute updates against render-scoped `filters`. In `BoardToolbar`, `clearLabelFilters` and `toggleLabelGroup` invoke `updateLabelFilter` in loops, resulting in dropped updates and failure to clear labels. Rapid user interactions also drop intermediate filter selections.
   - **Concrete Fix:** Maintain a mutable `currentFiltersRef` inside the hook updated synchronously on every mutation, or pass functional updates to `onFiltersChange`. In `BoardToolbar`, replace the loop in `clearLabelFilters` with `updateFilter("labels", null)` and add a bulk `updateLabelFilters(labelIds: string[])` helper.

2. **Asymmetric task sheet navigation creating phantom/dead browser history entries**
   - **Location:** [`apps/web/src/routes/.../board.tsx:104`](file:///home/sangeetha/projects/kaneo/apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx#L104), [`apps/web/src/components/kanban-board/task-card.tsx:148-157`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/kanban-board/task-card.tsx#L148-L157), and [`apps/web/src/components/list-view/task-row.tsx:147-159`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/list-view/task-row.tsx#L147-L159)
   - **Why it is wrong:** Task opening uses `push` navigation, but sheet close via `handleCloseTaskSheet` uses `replace: true`, creating two consecutive identical URLs in the history stack `[Board, Board]` where browser Back does nothing on first click. Conversely, deselecting by clicking the card/row pushes a 3rd entry `[Board, Board+Task, Board]`, making Back re-open the sheet.
   - **Concrete Fix:** Standardize sheet open/close: either open and close both use `replace: true` (modals as ephemeral query state), or close navigates via `window.history.back()` when opened via `push`.

### Minor Defects

3. **Direct access to `window.location.search` instead of router search state**
   - **Location:** [`apps/web/src/components/kanban-board/task-card.tsx:144`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/kanban-board/task-card.tsx#L144) & [`apps/web/src/components/list-view/task-row.tsx:143`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/list-view/task-row.tsx#L143)
   - **Why it is wrong:** Parsing `window.location.search` directly bypasses TanStack Router's internal state machine, risking race conditions during transitions or when running in memory router test environments.
   - **Concrete Fix:** Pass `activeTaskId` as a prop or read from `Route.useSearch()`.

4. **Missing automated tests for view switching filter preservation and Back navigation**
   - **Location:** [`apps/web/src/routes/.../board.tsx:122-123`](file:///home/sangeetha/projects/kaneo/apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx#L122-L123)
   - **Why it is wrong:** AC5 (view switching) and AC6 (browser Back) lack automated test coverage in the test suite.
   - **Concrete Fix:** Add integration tests rendering `RouteComponent` that verify active filters remain applied when toggling `viewMode` and when navigating history entries.

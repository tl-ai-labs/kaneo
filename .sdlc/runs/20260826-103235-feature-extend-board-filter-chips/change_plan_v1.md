# Delta Change Plan — URL-Persisted Board Filter State
**Run:** `20260826-103235-feature-extend-board-filter-chips`  
**Target:** Kaneo `@kaneo/web` (`apps/web`)  
**Status:** Approved for Implementation

---

## D1. State Ownership & Mount-Time Synchronization

### Decision
**State ownership model:** `state-mirrored-to-url` (Controlled React state in `useTaskFiltersWithLabelsSupport` synchronized with URL search parameters and localStorage).

### Mount-Time Execution Sequence
1. **Render 1 (Synchronous State Initialization):**
   - The hook receives `searchFilters` (parsed by `validateSearch` / route search params).
   - The predicate `hasActiveFilterParams(searchFilters)` is evaluated synchronously during initial state computation:
     - If `true` (URL carries non-empty filters): `useState(() => normalizeFilters(searchFilters))` initializes `filters` directly to the URL filters.
     - If `false` (URL carries no filter params or only empty/whitespace values): `useState(() => DEFAULT_FILTERS)` initializes `filters` to `DEFAULT_FILTERS`.
   - `isInitializedRef.current` is initialized to `false`.

2. **Commit Phase 1 (Effects Run):**
   - **Hydration & Precedence Effect:**
     - If `hasActiveFilterParams(searchFilters)` was `true`:
       - The hook writes the URL filters directly to `localStorage.setItem(storageKey, JSON.stringify(filters))`. This establishes URL precedence on load and syncs the shared/bookmarked state to `localStorage`.
       - Sets `isInitializedRef.current = true`.
     - If `hasActiveFilterParams(searchFilters)` was `false`:
       - The hook reads `localStorage.getItem(storageKey)`.
       - If valid stored filters exist, it calls `setFilters(normalizeFilters(JSON.parse(stored)))`.
       - Sets `isInitializedRef.current = true`.
   - **Save Effect (Guarded):**
     - The save effect executes: `if (!isInitializedRef.current || !storageKey) return;`.
     - Because `isInitializedRef.current` was `false` at the start of the initial commit, this effect immediately returns and **does not write** `DEFAULT_FILTERS` to `localStorage`.

3. **Render 2 (Only if localStorage restoration occurred):**
   - If stored filters were found, `setFilters` triggers a second render with the restored filters.
   - On this commit, `isInitializedRef.current` is `true`, so future changes to `filters` safely persist to `localStorage`.

4. **URL Navigation / History Sync Effect:**
   - Listens to changes in `searchFilters` (e.g. user pressing browser Back or Forward). If `searchFilters` differs from current `filters`, updates `filters` and syncs to `localStorage`.

### Guard Name & Mechanism
- **Guard Name:** `isInitializedRef` (`useRef<boolean>(false)`).
- **Protection:** Prevents the unconditional localStorage save effect from executing on mount with un-hydrated default filter state before URL precedence or localStorage restoration has completed.

---

## D2. Parameter Encoding & Worked Example

### Encoding Format
- **Format:** `repeated-keys` with comma-delimited fallback support.
- **TanStack Router Behavior:** When decoding query strings, TanStack Router (`qss` / `searchParams`):
  - Returns a single `string` for single-value params (e.g., `?status=todo` $\rightarrow$ `{ status: "todo" }`).
  - Returns an `Array` of strings for repeated keys (e.g., `?status=todo&status=in_progress` $\rightarrow$ `{ status: ["todo", "in_progress"] }`).
  - Returns JSON-parsed values if serialized with JSON brackets (e.g., `?status=["todo"]` $\rightarrow$ `{ status: ["todo"] }`).
- **Disambiguation Logic:** The validator normalizes all inputs using `parseFilterArray(val)`:
  - If `Array.isArray(val)`: filters items to non-empty strings `val.filter(v => typeof v === 'string' && v.trim() !== '')`.
  - If `typeof val === "string"`: trims the string; if it contains comma delimiters (e.g. `todo,in_progress`), splits on `,`; otherwise wraps in `[val.trim()]`.
  - If empty or invalid: returns `undefined`.

### Worked Example URL (All 5 Filters Set)
```
http://localhost:3000/dashboard/workspace/ws-1/project/proj-1/board?status=in_progress&status=review&priority=high&priority=urgent&assignee=usr-123&dueDate=dueThisWeek&labels=lbl-bug&labels=lbl-ui
```

---

## D3. validateSearch Contract & Validator Decision

### Validator Decision
- **Decision:** `hand-rolled` (Confirming Gate 1 recommendation).
- **Reasoning:** Hand-rolled `typeof` / structural predicate functions provide guaranteed `never-throw` semantics by construction without complex schema transformations or catch boundaries. In TanStack Router, a thrown error inside `validateSearch` crashes the entire route match and displays an unhandled error boundary. Hand-rolled parsing guarantees that any malformed, corrupted, deeply nested, or unexpected data structure returns default clean parameters.

### Signature & Contract
```ts
export type BoardSearchParams = {
  taskId?: string;
  status?: string[];
  priority?: string[];
  assignee?: string[];
  dueDate?: string[];
  labels?: string[];
};

export function validateBoardSearch(search: Record<string, unknown>): BoardSearchParams;
```
- **Guarantees:**
  - Never throws on `null`, `undefined`, non-objects, numbers, booleans, or prototype pollution keys.
  - Array length is capped at **50 items per filter dimension** (`parsed.slice(0, 50)`) to prevent CPU / memory exhaustion attacks from hostile URLs.
  - Strips empty strings and whitespace-only strings.

---

## D4. Empty-Param Predicate

### Definition & Implementation
```ts
export function hasActiveFilterParams(search: Partial<BoardSearchParams> | undefined | null): boolean {
  if (!search || typeof search !== "object") return false;
  const filterKeys: Array<keyof Omit<BoardSearchParams, "taskId">> = [
    "status",
    "priority",
    "assignee",
    "dueDate",
    "labels",
  ];
  return filterKeys.some((key) => {
    const val = search[key];
    return Array.isArray(val) && val.length > 0 && val.some((item) => typeof item === "string" && item.trim().length > 0);
  });
}
```

### Truth Table for Edge Cases
- `?status=` $\rightarrow$ `validateBoardSearch` yields `{}` $\rightarrow$ `hasActiveFilterParams` is `false`.
- `?status=&priority=` $\rightarrow$ `validateBoardSearch` yields `{}` $\rightarrow$ `hasActiveFilterParams` is `false`.
- `?status=%20` $\rightarrow$ `validateBoardSearch` yields `{}` $\rightarrow$ `hasActiveFilterParams` is `false`.
- `?status=todo` $\rightarrow$ `validateBoardSearch` yields `{ status: ["todo"] }` $\rightarrow$ `hasActiveFilterParams` is `true`.

### Parsing Order
`hasActiveFilterParams` is computed **from parsed and sanitized values** (after `validateBoardSearch` runs). This ordering is essential because raw query parameters can contain encoded empty strings, trailing ampersands, or empty array keys that look structurally present but carry zero active filter semantics.

---

## D5. The Nine In-Scope `navigate()` Call Sites

### Verification of TanStack Router API
- **Verified:** `d5_api_verified: true`
- **Evidence:** `node_modules/@tanstack/router-core/dist/esm/link.d.ts` lines 124–170 define:
  ```ts
  export type ParamsReducerFn<in out TRouter extends AnyRouter, in out TParamVariant extends ParamVariant, in out TFrom, in out TTo> = (current: Expand<ResolveFromParams<TRouter, TParamVariant, TFrom>>) => Expand<ResolveRelativeToParams<TRouter, TParamVariant, TFrom, TTo>>;
  export interface MakeOptionalSearchParams<in out TRouter extends AnyRouter, in out TFrom, in out TTo> {
      search?: true | (ParamsReducer<TRouter, 'SEARCH', TFrom, TTo> & {});
  }
  ```
  TanStack Router explicitly supports functional search updaters: `search: (prev: Record<string, unknown>) => Record<string, unknown>`.

### Replacement Table

| # | File & Line | Today's Code | Replacement Code | Rationale |
|---|---|---|---|---|
| 1 | `apps/web/src/routes/.../board.tsx:97` | `navigate({ to: ".", search: {}, replace: true })` | `navigate({ to: ".", search: (prev: any) => { const { taskId, ...rest } = prev; return rest; }, replace: true })` | Removes `taskId` to close task sheet while retaining all active filter params with history replacement. |
| 2 | `apps/web/src/components/kanban-board/task-card.tsx:148` | `navigate({ to: ".", search: {} })` | `navigate({ to: ".", search: (prev: any) => { const { taskId, ...rest } = prev; return rest; } })` | Deselects task card without clearing active filter params. |
| 3 | `apps/web/src/components/kanban-board/task-card.tsx:153` | `navigate({ to: ".", search: { taskId: task.id } })` | `navigate({ to: ".", search: (prev: any) => ({ ...prev, taskId: task.id }) })` | Selects task card and opens sheet while preserving active filter params. |
| 4 | `apps/web/src/components/kanban-board/index.tsx:67` | `navigate({ to: ".", search: { taskId: state.focusedTaskId } })` | `navigate({ to: ".", search: (prev: any) => ({ ...prev, taskId: state.focusedTaskId }) })` | Updates focused task on `j` shortcut while preserving active filter params. |
| 5 | `apps/web/src/components/kanban-board/index.tsx:74` | `navigate({ to: ".", search: { taskId: state.focusedTaskId } })` | `navigate({ to: ".", search: (prev: any) => ({ ...prev, taskId: state.focusedTaskId }) })` | Updates focused task on `k` shortcut while preserving active filter params. |
| 6 | `apps/web/src/components/list-view/task-row.tsx:147` | `navigate({ to: ".", search: {} })` | `navigate({ to: ".", search: (prev: any) => { const { taskId, ...rest } = prev; return rest; } })` | Deselects task row without clearing active filter params. |
| 7 | `apps/web/src/components/list-view/task-row.tsx:152` | `navigate({ to: ".", search: { taskId: task.id } })` | `navigate({ to: ".", search: (prev: any) => ({ ...prev, taskId: task.id }) })` | Selects task row and opens sheet while preserving active filter params. |
| 8 | `apps/web/src/components/list-view/index.tsx:97` | `navigate({ to: ".", search: { taskId: state.focusedTaskId } })` | `navigate({ to: ".", search: (prev: any) => ({ ...prev, taskId: state.focusedTaskId }) })` | Updates focused task in list view on `j` shortcut while preserving filter params. |
| 9 | `apps/web/src/components/list-view/index.tsx:104` | `navigate({ to: ".", search: { taskId: state.focusedTaskId } })` | `navigate({ to: ".", search: (prev: any) => ({ ...prev, taskId: state.focusedTaskId }) })` | Updates focused task in list view on `k` shortcut while preserving filter params. |

*(Note: Out-of-scope cross-route navigations at `kanban-board/index.tsx:79` and `list-view/index.tsx:109` navigate to `/task/$taskId` and are left untouched).*

---

## D6. Back Button Navigation Walkthrough

### Scenario
1. User lands on `/board` (Entry #1: `search = {}`).
2. User applies filter `status=in_progress` via filter chip $\rightarrow$ Uses `replace: true` (Entry #1 modified to `search = { status: ["in_progress"] }`).
3. User applies second filter `priority=high` via filter chip $\rightarrow$ Uses `replace: true` (Entry #1 modified to `search = { status: ["in_progress"], priority: ["high"] }`).
4. User clicks a task card $\rightarrow$ Uses standard `push` navigation (Entry #2: `search = { status: ["in_progress"], priority: ["high"], taskId: "task-1" }`).
5. User presses **Back (1st time)**:
   - Navigates from Entry #2 to Entry #1.
   - The task sheet closes (`taskId` is removed).
   - The board remains filtered by `status=in_progress` and `priority=high`.
6. User presses **Back (2nd time)**:
   - Navigates from Entry #1 to the page visited *prior* to opening `/board` (e.g. Workspace Dashboard or Project Overview).
   - **Total History Entries on Board Route:** Exactly 2 (the board page itself and the opened task sheet). Filter mutations do not add entries.

---

## D7. Clean URLs & History Mutation Semantics

### Clean URL Strategy
- When a filter is toggled off or `clearFilters()` is called, the corresponding key is omitted / set to `undefined` in the search parameters.
- Empty filter arrays (`[]`) and `null` values are deleted from the search object rather than serialized as `?status=&priority=`.
- When all filters are inactive and no `taskId` is set, the navigation passes an empty search object `{}`.

### Replace vs Push Policy
- **`replace: true` is used for:**
  1. Filter chip toggle/addition/removal in `BoardToolbar` (`updateFilter`, `updateLabelFilter`, `clearFilters`).
  2. Closing the task details sheet in `board.tsx:handleCloseTaskSheet`.
- **`push` (default `replace: false`) is used for:**
  1. Opening a task sheet or focusing a task by clicking a task card / row (`task-card.tsx`, `task-row.tsx`).
  2. View switching (board $\leftrightarrow$ list), which is handled via `userPreferencesStore` without replacing history.

---

## D8. File-by-File Implementation Plan

| Path | Status | Changes & Exports |
|---|---|---|
| `apps/web/src/lib/board-filter-params.ts` | **NEW** | Exports:<br>• `validateBoardSearch(search: Record<string, unknown>): BoardSearchParams`<br>• `filtersToSearchParams(filters: BoardFilters): Partial<BoardSearchParams>`<br>• `searchParamsToFilters(params: BoardSearchParams): BoardFilters`<br>• `hasActiveFilterParams(params: Partial<BoardSearchParams> \| undefined \| null): boolean` |
| `apps/web/src/lib/board-filter-params.test.ts` | **NEW** | Unit tests for `board-filter-params.ts` covering round-tripping, never-throw edge cases, empty params, array capping, and clean URL generation. |
| `apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx` | **EDIT** | • Import `validateBoardSearch`, `filtersToSearchParams`, `hasActiveFilterParams` from `@/lib/board-filter-params`<br>• Update `Route` definition with `validateBoardSearch`<br>• Pass search params to `useTaskFiltersWithLabelsSupport`<br>• Update `handleCloseTaskSheet` with functional search updater |
| `apps/web/src/hooks/use-task-filters-with-labels-support.ts` | **EDIT** | • Accept optional search params parameter<br>• Implement `isInitializedRef` guard to protect localStorage save effect<br>• Implement synchronous initial state from URL params<br>• Implement mount sync-back of URL params to localStorage<br>• Update filter setters to synchronize with URL via `useNavigate` (`replace: true`) |
| `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` | **EDIT** | • Add URL precedence over localStorage test<br>• Add localStorage fallback test for parameterless URL<br>• Add empty param immunity test (`?status=`)<br>• Retain existing 2 test cases |
| `apps/web/src/components/kanban-board/task-card.tsx` | **EDIT** | Update `navigate` calls at lines 148 and 153 to use functional search updaters |
| `apps/web/src/components/kanban-board/index.tsx` | **EDIT** | Update `navigate` calls at lines 67 and 74 to use functional search updaters |
| `apps/web/src/components/list-view/task-row.tsx` | **EDIT** | Update `navigate` calls at lines 147 and 152 to use functional search updaters |
| `apps/web/src/components/list-view/index.tsx` | **EDIT** | Update `navigate` calls at lines 97 and 104 to use functional search updaters |
| `apps/web/src/components/list-view/task-row.test.tsx` | **EDIT** | Add test verifying task row click preserves active filter search params in navigate call |

---

## D9. Test Plan & Baseline Failure Signatures

### Test Matrix

| Test File | Assertions & Scenarios | Expected Baseline Failure |
|---|---|---|
| `apps/web/src/lib/board-filter-params.test.ts` | 1. Round-trips all 5 filter dimensions.<br>2. `validateBoardSearch` never throws on `null`, numbers, booleans, malicious arrays, or prototype pollution.<br>3. Caps array length at 50.<br>4. `hasActiveFilterParams` is false for `?status=`, `?status=&priority=`, `?status=%20`.<br>5. Returns clean search object (no empty keys) when filters are cleared. | New file testing library utilities. |
| `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` | 1. **(Must-Fail Test A)**: URL param precedence over localStorage (`URL: status=["in_progress"]`, `localStorage: status=["todo"]`) $\rightarrow$ expects `filters.status === ["in_progress"]` and localStorage updated to `["in_progress"]`.<br>2. Restores from localStorage when URL has no filters.<br>3. Ignores empty URL params (`?status=`) and restores from localStorage.<br>4. Preserves existing 2 test cases. | **Test (a) Failure Shape:**<br>`AssertionError: expected 'todo' to deeply equal 'in_progress'` (Today's hook ignores URL params and unconditionally restores from localStorage). |
| `apps/web/src/components/list-view/task-row.test.tsx` | 1. **(Must-Fail Test B)**: Clicking task row when search has `{ status: ["in_progress"] }` calls `navigate` with functional updater that retains `status` alongside `taskId: "task-1"`.<br>2. **(Concrete replace:true home)**: Closing task row calls `navigate` with functional search updater returning search without `taskId`. | **Test (b) Failure Shape:**<br>`AssertionError: expected mockNavigate to have been called with [objectContaining({ search: expect.any(Function) })] but received [{ to: '.', search: { taskId: 'task-1' } }]` |

### Router Test Harness Strategy
`useTaskFiltersWithLabelsSupport` accepts search params as an optional argument (`searchFilters?: Partial<BoardSearchParams>`) or router navigation callback. In tests using `@testing-library/react`'s `renderHook`, search parameters are passed directly as hook arguments, requiring **no heavy router mocking harness** while ensuring 100% deterministic, standalone unit testability.

---

## D10. Requirements Corrections

### 1. AC-8 Test File Specification
- **Correction:** AC-8 is concretely assigned to `apps/web/src/components/list-view/task-row.test.tsx` and `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx`, asserting that filter modifications and sheet close navigations invoke router navigation with `{ replace: true }`.

### 2. Precise Restatement of FR-2
- **Original FR-2:** *"When the board route loads with one or more non-empty filter parameters present in the URL, the system shall apply those filter parameters immediately (ignoring pre-existing stored filters) and asynchronously sync the resolved filters back to `kaneo:board-filters:${projectId}` in `localStorage`."*
- **Corrected FR-2:** *"When the board route mounts with one or more non-empty filter parameters present in the URL (`hasActiveFilterParams(searchFilters) === true`), the system shall initialize React filter state synchronously from those URL parameters on Render 1 (ignoring any pre-existing stored filters for that project), and during the initial commit phase, write the resolved filter state to `kaneo:board-filters:${projectId}` in `localStorage` while guarding against uninitialized default state overwrites."*

### 3. Corrected AC-to-Brief-Bullet Traceability Mapping

| Brief Acceptance Bullet | Requirements AC | Description |
|---|---|---|
| 1. All five filters round-trip through the URL | AC-1 | Parameter serialization and round-trip verification |
| 2. URL params take precedence on load and sync back to localStorage | AC-2 | URL-first resolution and localStorage sync-back on load |
| 3. No filter params in URL restores localStorage state | AC-3 | LocalStorage fallback preservation for direct board navigation |
| 4. Empty param (e.g. `?status=`) does not suppress localStorage restore | AC-4 | Empty parameter immunity and whitespace normalization |
| 5. Filters survive every in-app navigation on the board route | AC-5 | Search parameter preservation across all 9 `navigate()` sites |
| 6. Browser Back behaves coherently | FR-8 / AC-8 | History stack coherence and filter re-synchronization |
| 7. validateSearch degrades malformed/hostile input without throwing | AC-7 | Resilient never-throw search validator contract |
| 8. Clean URL when no filters are active | AC-6 | Omission of empty filter keys in query strings |
| 9. Filter changes do not push a history entry per interaction | AC-8 | History replacement (`replace: true`) on filter updates |
| *(Overall Suite Quality & Type Safety)* | AC-9 | All 112 baseline tests pass and typecheck exits 0 |

---

## D11. Ranked Risks & Mitigations

| Rank | Risk | Impact | Mitigation Strategy | Detection in Test |
|---|---|---|---|---|
| **1** | **Unconditional initial localStorage clobber** | Critical: Returning users lose stored filters when opening `/board` | Implement `isInitializedRef` guard that prevents save effect from executing during initial un-hydrated mount. | `use-task-filters-with-labels-support.test.tsx` test case mounting with empty URL and asserting stored localStorage data is not wiped. |
| **2** | **In-route navigations dropping filter params** | High: Filtered board resets to unfiltered whenever a task is opened/closed | Replace static `{ taskId: ... }` / `{}` objects with TanStack Router functional search updaters `(prev) => ({ ...prev, taskId })` across all 9 call sites. | `task-row.test.tsx` asserting functional search updater preserves existing query keys. |
| **3** | **Search validator throwing on hostile input** | High: Route crashes with unhandled application error | Implement hand-rolled pure function validator capping array length at 50, strictly checking primitive types, and stripping non-string elements. | `board-filter-params.test.ts` fuzz tests with `null`, objects, numbers, and 1000-item arrays. |
| **4** | **Empty string query parameter falsely detected as active filter** | Medium: Visiting `?status=` blanks user's board instead of restoring saved filters | Normalize strings with `.trim()` and check `.length > 0` before classifying any search parameter as active. | `board-filter-params.test.ts` testing `?status=`, `?status=&priority=`, `?status=%20`. |

# Delta Change Plan — URL-Persisted Board Filter State (Revision 1)
**Run:** `20260826-103235-feature-extend-board-filter-chips`  
**Target:** Kaneo `@kaneo/web` (`apps/web`)  
**Status:** Approved for Implementation (Gate 2 Overturn Applied)

---

## Gate 2 overturn record

**O1 (State Ownership Overturn — decided by User at Gate 2):**
URL is designated as the sole source of truth. The previous `state-mirrored-to-url` architecture is replaced with direct derivation of filter state from route search parameters. React `useState` for filters and `isInitializedRef` are deleted entirely from `useTaskFiltersWithLabelsSupport`.

**O2 (Hook Dependency Injection — decided by User and Lead at Gate 2):**
`useTaskFiltersWithLabelsSupport` calls no router hooks directly (`useNavigate` / `Route.useSearch`). Instead, it accepts `searchFilters` and `onFiltersChange` as explicit arguments. The parent route component `board.tsx` owns router interactions, keeping unit tests completely router-free.

**O3 (replace:true Home Correction — decided at Gate 2):**
History replacement (`replace: true`) is asserted in the filter mutation unit tests where filters are changed, not in `task-row.test.tsx`. `task-row.test.tsx` asserts `push` navigation and search parameter preservation. This resolves the Gate-1 AC-8 ambiguity without contradicting the navigation design.

**O4 (Router Encoding Alignment — decided at Gate 2):**
URL emission strictly uses TanStack Router's native JSON-array encoding (`stringifySearchWith(JSON.stringify, JSON.parse)`). Inbound tolerance supports exactly three shapes with no comma splitting, matching measured router behavior from `verified-encoding.md`.

**O5 (Strict Search Assertion Pattern — decided at Gate 2):**
Tests must never assert `search: expect.any(Function)`. Every navigation test captures the functional search updater callback, invokes it with a fixture prior search object containing active filters, and asserts the exact returned search structure.

---

## D1. State ownership

**State ownership model:** `url-as-source-of-truth`.

The URL search parameters are the sole source of truth for board filter state. No React `useState` owns filter state in `useTaskFiltersWithLabelsSupport`; `filters` is derived synchronously from route search params on every render via pure memoization (`useMemo(() => searchParamsToFilters(searchFilters), [searchFilters])`). The guard ref `isInitializedRef` is deleted entirely.

**Rationale verbatim:**
*the mount clobber and the two-way-binding render loop both become STRUCTURALLY IMPOSSIBLE rather than guarded by effect ordering; a design needing no correctness argument beats one needing a sound one.*

### State Synchronization Lifecycle
- **(a) LocalStorage as Seed and Mirror:**
  LocalStorage serves strictly as a cold-start seed on mount and a mirror on filter change, never an owner. On mount, if `hasActiveFilterParams(searchFilters)` evaluates to `false`, a mount effect reads `localStorage.getItem(storageKey)`. If stored filters exist, it publishes them into the URL via a single replace navigation:
  `navigate({ to: '.', search: (prev) => ({ ...prev, ...filtersToSearchParams(storedFilters) }), replace: true })`.
- **(b) LocalStorage Sync-back (Mirror):**
  An effect synchronizes active `filters` back to `localStorage.setItem(storageKey, JSON.stringify(filters))`. When a user opens a bookmarked or shared URL carrying active filter parameters, this mirror effect updates their `localStorage` for that project, ensuring AC-2 is satisfied.
- **(c) One-shot Seed Mechanism per storageKey:**
  The seed publish is guarded by a ref tracking the seeded storage key: `const seededStorageKeyRef = useRef<string | null>(null);`. The seed effect checks `if (seededStorageKeyRef.current === storageKey || !storageKey) return;` before reading `localStorage`. As soon as the check runs, it assigns `seededStorageKeyRef.current = storageKey`. When the resulting replace navigation updates search params and re-renders the component, the seed effect does not re-fire because `seededStorageKeyRef.current === storageKey`.
- **(d) Acceptance Criteria Shape Changes:**
  - **FR-2 / AC-2:** Changes from a mount-time React state hydration effect with precedence guards to direct search param derivation on Render 1, with asynchronous mirror write to `localStorage`.
  - **AC-3:** Changes from setting internal React state from `localStorage` to issuing a one-shot seed replace navigation to the URL when search params are empty.

### Hook Signature (O2)
```ts
export function useTaskFiltersWithLabelsSupport(
  project: Project | undefined,
  searchFilters?: BoardSearchParams,
  onFiltersChange?: (filters: BoardFilters) => void
): {
  filters: BoardFilters;
  setFilters: (filters: BoardFilters | ((prev: BoardFilters) => BoardFilters)) => void;
  updateFilter: <K extends keyof BoardFilters>(key: K, value: BoardFilters[K]) => void;
  updateLabelFilter: (labelId: string) => void;
  filteredProject: Project | undefined;
  hasActiveFilters: boolean;
  clearFilters: () => void;
};
```

---

## D2. Encoding

URL emission uses TanStack Router's native JSON-array format (`defaultStringifySearch = stringifySearchWith(JSON.stringify, JSON.parse)`). Custom serialization format overrides are out of scope because `apps/web/src/main.tsx` is off-limits.

### Inbound Tolerance (Exactly Three Accepted Shapes)
1. **JSON-encoded array:** `?status=["todo","review"]` $\rightarrow$ parsed natively by `JSON.parse` to `["todo", "review"]`.
2. **Repeated query keys:** `?status=todo&status=review` $\rightarrow$ parsed natively by query string parser to `["todo", "review"]`.
3. **Bare single string:** `?status=todo` $\rightarrow$ parsed to string `"todo"`, normalized by validator to `["todo"]`.

### No Comma Splitting
`?status=todo,review` is parsed as a single opaque string `"todo,review"` and normalized to `["todo,review"]`. Comma splitting is rejected to preserve values containing commas (e.g. `assignee: ["u,1"]`) without round-trip data loss.

### Worked Example URL (All 5 Filter Dimensions Emitted)
```
http://localhost:3000/dashboard/workspace/ws-1/project/proj-1/board?status=%5B%22in_progress%22%2C%22review%22%5D&priority=%5B%22high%22%2C%22urgent%22%5D&assignee=%5B%22usr-123%22%5D&dueDate=%5B%22dueThisWeek%22%5D&labels=%5B%22lbl-bug%22%2C%22lbl-ui%22%5D
```

---

## D3. validateSearch contract

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
**Never-Throw Guarantees & Contract:** Hand-rolled validator checks structural types and never throws on `null`, `undefined`, primitives, objects, or malicious payloads. Bare single strings (`?status=todo` arriving as `"todo"`) are normalized to `["todo"]`. Array length is capped at 50 elements per dimension to prevent memory exhaustion. Inactive or empty filter keys are omitted (`undefined`), yielding clean query strings.

---

## D4. Empty-param predicate

```ts
export function hasActiveFilterParams(search: Partial<BoardSearchParams> | undefined | null): boolean {
  if (!search || typeof search !== "object") return false;
  const filterKeys: Array<keyof Omit<BoardSearchParams, "taskId">> = ["status", "priority", "assignee", "dueDate", "labels"];
  return filterKeys.some((key) => {
    const val = search[key];
    return Array.isArray(val) && val.length > 0 && val.some((item) => typeof item === "string" && item.trim().length > 0);
  });
}
```
`hasActiveFilterParams` MUST run on normalized search values produced by `validateBoardSearch`. Because `?status=` parses to `{ status: "" }` (the key is present in the object), key-presence checks are insufficient; only non-empty, non-whitespace string contents signify active filters.

---

## D5-D8, D10

UNCHANGED from change_plan_v1.md §D5 / §D6 / §D7 / §D8 / §D10

*Delta note:*
1. In §D8, `use-task-filters-with-labels-support.ts` receives `searchFilters` and `onFiltersChange` via props per O2 and imports no router hooks.
2. In §D10.1, the `replace: true` assertion home moves to filter mutation tests per O3, while `task-row.test.tsx` asserts `push` and filter preservation.

---

## D9. Test plan

| Test File | Scenarios & Scope | Failure Signature without Implementation |
|---|---|---|
| `apps/web/src/lib/board-filter-params.test.ts` | 1. Round-trips all 5 filter dimensions.<br>2. `validateBoardSearch` never throws on primitives/corrupted input.<br>3. Normalizes bare strings, repeated keys, and JSON arrays.<br>4. Rejects comma-splitting.<br>5. `hasActiveFilterParams` returns `false` for `?status=`, `?status=&priority=`, `?status=%20`. | Module not found / assertions fail on missing helper functions. |
| `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` | 1. Synchronously derives filters from `searchFilters` prop.<br>2. When URL has no active filters, reads `localStorage` and seeds URL via `onFiltersChange`.<br>3. Empty URL param (`?status=`) triggers `localStorage` seed.<br>4. Mirror effect persists active filters to `localStorage`.<br>5. Filter update helpers invoke `onFiltersChange` with updated filters. | `AssertionError`: hook filters do not reflect search parameter input. |
| `apps/web/src/components/list-view/task-row.test.tsx` | Clicking a task row invokes `navigate` with a functional updater that preserves existing filter params (`status: ["in_progress"]`) alongside `taskId`. | `AssertionError`: `navigate` called with static `{ taskId: "task-1" }` dropping filter parameters. |

**Strict Search Assertion Pattern (Capture-and-Invoke for O5):**
```ts
// Enforces O5 across all navigation tests:
expect(mockNavigate).toHaveBeenCalledWith(
  expect.objectContaining({
    search: expect.toSatisfy((updater: (prev: Record<string, unknown>) => Record<string, unknown>) => {
      const result = updater({ status: ["in_progress"], priority: ["high"] });
      return result.status?.[0] === "in_progress" && result.priority?.[0] === "high" && result.taskId === "task-1";
    }),
  })
);
```

---

## D11. Risks

**Dropped Risks (from v1):**
- *Unconditional initial localStorage clobber (v1 Risk 1):* Dropped because URL is the sole truth; the hook has no un-hydrated React filter state to flush over stored data.
- *Two-way binding render loops / race conditions:* Dropped because state flows unidirectionally from URL $\rightarrow$ derived filters $\rightarrow$ UI.

**Introduced Risks & Mitigations:**
- *Storage Key Seed Re-trigger on Workspace/Project Navigation:* Switching projects could fail to re-seed if the ref is a boolean. **Mitigation:** Ref stores `storageKey` string (`seededStorageKeyRef.current = storageKey`), re-enabling one-shot seed per project.
- *Updater Function Shallow Merge Dropping Custom Search Keys:* Custom updaters could drop unmanaged params. **Mitigation:** All functional updaters spread `...prev` before setting/removing keys.

---

## Addendum A — orchestrator corrections (NOT authored by the Flash tier)

**Attribution matters for this run's policy comparison.** Everything above §Addendum A was produced
by `gemini-3.7-flash` via the antigravity-worker. The four corrections below were authored by the
ORCHESTRATOR tier after review, because they are blocking defects that no downstream phase in this
single-tier policy would have caught. They are binding on implementation and override the sections
they name. Counted in the final report as orchestrator-authored design corrections.

### A1 — the hook signature in §D1 drops two existing parameters (BLOCKING)

§D1 gives `useTaskFiltersWithLabelsSupport(project, searchFilters?, onFiltersChange?)`. That is
wrong twice over:

- It has no `projectId`, yet §D1(a) and §D1(c) both reference `storageKey`, which is
  `kaneo:board-filters:${projectId}`. The section is internally inconsistent.
- It drops `textQuery`, which powers the board's Cmd+F search and is the third positional argument
  in the existing passing test (`it.each(["#123","proj-123","proj-"])`). Dropping it breaks a
  green baseline test and removes a shipped feature.

**Binding signature — append, do not replace, so both existing tests keep passing unchanged:**

```ts
export function useTaskFiltersWithLabelsSupport(
  project: ProjectWithTasks | null | undefined,
  projectId?: string,
  textQuery?: string,
  searchFilters?: BoardSearchParams,
  onFiltersChange?: (next: BoardFilters) => void,
): {
  filters: BoardFilters;
  setFilters: (next: BoardFilters | ((prev: BoardFilters) => BoardFilters)) => void;
  updateFilter: (key: keyof BoardFilters, value: BoardFilters[keyof BoardFilters]) => void;
  updateLabelFilter: (labelId: string) => void;
  filteredProject: ProjectWithTasks | null;
  hasActiveFilters: boolean;
  clearFilters: () => void;
};
```

### A2 — wrong types in §D1 (BLOCKING typecheck)

§D1 writes `project: Project | undefined` and `filteredProject: Project | undefined`. The real
types are `ProjectWithTasks | null | undefined` and `ProjectWithTasks | null` respectively
(`@/types/project`). Use the types in A1.

### A3 — the clobber is NOT yet structurally impossible; §D1(b) reintroduces it (BLOCKING)

This is the most important correction. The overturn removed the `useState` clobber, but §D1(b)
keeps a **mirror effect keyed on `filters`** that writes `localStorage` on every render-with-new-
filters. On a cold mount with an empty URL and non-empty storage, that effect writes the derived
`DEFAULT_FILTERS` over the user's stored filters. Whether the seed effect wins is once again an
argument about effect ordering within a commit — exactly what the overturn was meant to abolish.
Guarding the mirror on `seededStorageKeyRef` does NOT fix it: the seed sets that ref in the same
commit, before the seed's replace-navigation has re-rendered, so the mirror still sees
`filters === DEFAULT_FILTERS` and still writes it.

**Binding replacement for §D1(b). Delete the filters-keyed mirror effect. Persist in exactly two
places, which are mutually exclusive by construction:**

1. **Write-on-mutation.** `updateFilter`, `updateLabelFilter` and `clearFilters` each compute the
   next filters, write them to `localStorage` synchronously, and call `onFiltersChange(next)`.
   No effect, no ordering question — the user changed something, so we persist it.
2. **Load-time sync-back.** One effect that runs only when `hasActiveFilterParams(searchFilters)`
   is `true`, writing the URL-derived filters to `localStorage`. This is what satisfies AC-2's
   intentional overwrite of a viewer's stored filters by a shared link.

The seed effect (§D1(c)) runs only when `hasActiveFilterParams(searchFilters)` is `false`. Since
(2) runs only when it is `true`, seed and sync-back can never both fire on the same render, and
neither can ever observe an un-settled `filters` value. That is structural, not ordered.

### A4 — §D1(a) shows the hook calling navigate, contradicting O2

The snippet in §D1(a) has `navigate({ to: '.', search: ..., replace: true })` inside the hook's
mount effect. O2 forbids the hook from touching the router. Binding: the hook calls
`onFiltersChange(next)` and nothing else. `board.tsx` owns the router and implements the callback:

```ts
const handleFiltersChange = useCallback((next: BoardFilters) => {
  navigate({ to: ".", search: (prev) => ({ ...prev, ...filtersToSearchParams(next) }), replace: true });
}, [navigate]);
```

This is also the single place where `replace: true` for filter mutation lives, per O3.

### Verified, NOT a defect

§D9's `expect.toSatisfy(...)` asymmetric-matcher pattern was checked against the installed
`@vitest/expect@4.1.10`: `dist/index.d.ts:201` documents
`expect(age).toEqual(expect.toSatisfy(val => val >= 18))`. The pattern is valid here. Use it.

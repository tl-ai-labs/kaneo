# Change Plan — URL-persisted board filter state

Run: `20260826-064633-feature-extend-board-filter-chips`
Intent: `feature-extend` · Mode: brownfield · Stack: React 19 + Vite + TanStack Router/Query (per
`.sdlc/baseline/stack-profile.md`). **Not** NestJS, **not** Prisma, **not** Django.

This is a delta document. Anything not named here is unchanged and must stay unchanged.
Every item traces to a numbered FR/AC/IS in `requirements.md`.

**Frozen decisions this plan is designed to (not relitigated):** repeated params
(`?status=todo&status=done`); URL wins on load and overwrites the viewer's stored filters;
`replace: true` on all filter-driven navigation; zero active filters ⇒ zero filter params;
nine `navigate()` call sites across five files.

---

## 1. Files added

| Path | Allowlist glob | Purpose |
|---|---|---|
| `apps/web/src/lib/board-filter-search-params.ts` | `apps/web/src/lib/**` | IS-2 / FR-1..FR-8. Pure encode/decode/predicate module for `BoardFilters` ⇄ TanStack search params. Named exports, no React, no I/O, no new dependency. |
| `apps/web/src/lib/board-filter-search-params.test.ts` | `apps/web/src/lib/**` | Colocated unit tests for the above. House-style reference: `apps/web/src/lib/get-task-label-options.test.ts`. |
| `apps/web/src/components/board/board-search-preservation.test.tsx` | `apps/web/src/components/board/**` | AC-7 regression guard (behavioral tier for `TaskCard`, structural tier for the four `j`/`k` sites and the sheet-close site). See §8 for why this file lives under `components/board/` and not next to the components it guards. |

No other file is created. No new i18n key (NFR-4): the toolbar's props and copy are untouched.

### 1.1 Public surface of `lib/board-filter-search-params.ts`

Named exports (multi-export utility module → named exports, per stack profile):

```ts
export const MAX_BOARD_FILTER_VALUES = 50;
export const MAX_BOARD_FILTER_VALUE_LENGTH = 128;

export const BOARD_FILTER_SEARCH_KEYS = [
  "status", "priority", "assignee", "dueDate", "labels",
] as const satisfies ReadonlyArray<keyof BoardFilters>;

export type BoardFilterSearchKey = (typeof BOARD_FILTER_SEARCH_KEYS)[number];

export function parseBoardFilterSearch(search: Record<string, unknown>): BoardFilters;
export function serializeBoardFilters(
  filters: BoardFilters,
): Partial<Record<BoardFilterSearchKey, string[]>>;
export function hasAnyBoardFilterParam(search: Record<string, unknown>): boolean;
export function boardFilterSearchMatches(
  search: Record<string, unknown>,
  filters: BoardFilters,
): boolean;
```

`BoardFilters` is imported **type-only** from `@/hooks/use-task-filters`
(`import type { BoardFilters } from "@/hooks/use-task-filters";`). This is the existing owner of
the type — `components/board/board-toolbar.tsx` already imports it from there. Type-only import ⇒
erased at runtime ⇒ no import cycle is possible even in principle. Do **not** relocate
`BoardFilters` into `apps/web/src/types/**`; that is scope the run did not ask for.

Behavioral contract, exactly:

- **`parseBoardFilterSearch`** (FR-2..FR-5). Never throws. Returns a fully-populated `BoardFilters`
  (all five keys present, each `string[] | null`).
  - If `search` is null/not an object → all keys `null`.
  - Iterates **only** `BOARD_FILTER_SEARCH_KEYS`. `__proto__`, `constructor`, `status[]` and every
    other key is never read (AC-5 prototype-pollution case is structurally impossible, not
    defended against at runtime). Result object is a fresh literal.
  - **Primary path, not a defensive branch:** for each key the raw value is normalised as
    - `Array.isArray(value)` → the array,
    - `typeof value === "string"` → `[value]`,
    - anything else → `[]`.
    The bare-string branch is the *common* case under repeated-param encoding: TanStack's default
    search parser collapses a single occurrence of `?status=todo` to the scalar `"todo"` and only
    produces an array from two or more occurrences. A parser that only accepted arrays would break
    every single-value filter.
  - Members are then filtered: keep only `typeof v === "string" && v !== "" && v.length <= MAX_BOARD_FILTER_VALUE_LENGTH`.
    Nothing is trimmed (FR-4). Over-long values are **dropped**, not truncated — a truncated ID
    would look legitimate and silently match nothing.
  - `.slice(0, MAX_BOARD_FILTER_VALUES)` (FR-5).
  - Empty result → `null` (FR-4, matching the hooks' `normalizeFilters` contract).
  - **No de-duplication.** `normalizeFilters` does not dedupe today; parity is deliberate. Noted in §9.
  - Consequence that AC-5 depends on: `?status=` parses to `{ status: "" }`, the `""` fails the
    member filter, the array is empty, the key collapses to `null`.
- **`serializeBoardFilters`** (FR-6). Returns an object that **always carries all five keys**, with
  value `filters[key]` when it is a non-empty array and **`undefined` otherwise**.
  - **FR-6 wording vs frozen decision 4 — resolved in favour of decision 4.** FR-6 says "emits a key
    only when that filter is a non-empty array"; read as `Object.hasOwn`, that is *wrong* and would
    make clearing impossible: the route merges with `{ ...prev, ...serializeBoardFilters(next) }`,
    so an omitted key leaves the stale value in `prev` untouched and the filter can never be
    cleared. The key must be **present with value `undefined`** so TanStack drops it from the URL.
    FR-6's "emits a key" is therefore implemented as "emits a *value*". Codegen must not "fix" this
    back to conditional key omission.
  - `Partial<Record<K, string[]>>` permits `{ status: undefined }` under this tsconfig
    (`exactOptionalPropertyTypes` is **not** enabled in `apps/web/tsconfig.app.json` — verified).
- **`hasAnyBoardFilterParam`** (FR-7) is **derived from the parser**, not from an independent scan:
  `BOARD_FILTER_SEARCH_KEYS.some((key) => parseBoardFilterSearch(search)[key] !== null)`.
  Deriving it makes the predicate and the parser incapable of disagreeing, which is the entire
  point of FR-1. `?status=` ⇒ parser yields `null` ⇒ predicate `false` ⇒ localStorage restore is
  **not** suppressed. This is the dedicated empty-param test in §8.
- **`boardFilterSearchMatches`** — "does this search object already encode exactly these filters?"
  Implemented as a key-by-key ordered comparison of `parseBoardFilterSearch(search)` against
  `filters`. Used only by `board.tsx` as the redundant-navigation guard (§2.1). Reusing the parser
  means there is one equality semantics in the codebase, not two.

House style is mandatory here: hand-written `typeof` / `Array.isArray` narrowing (FR-8). **Note:**
`zod@^4.4.3` *is* present in `apps/web/package.json` (used elsewhere). It is not the house style for
search params and must not be reached for. NFR-3 forbids touching `package.json` anyway.

---

## 2. Files edited

| Path | Edit tool | Shape of change |
|---|---|---|
| `apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx` | `existing_file_edit` | 5 hunks: imports; `BoardSearchParams` + `validateSearch`; URL-seed snapshot + publish callback; hook call gains a 4th arg; `handleCloseTaskSheet` becomes the functional form (site 9 of 9). |
| `apps/web/src/hooks/use-task-filters-with-labels-support.ts` | `existing_file_edit` | Additive 4th optional param; lazy `useState` seed; one-shot guard on the restore effect; two new effects (latest-callback ref, publish). `filterTasks`, `filteredProject`, `hasActiveFilters`, `updateFilter`, `updateLabelFilter`, `clearFilters` and the write-back effect are **byte-identical**. |
| `apps/web/src/components/kanban-board/index.tsx` | `patch_apply` | 2 hunks (`j`, `k` shortcut handlers) — sites 1–2. |
| `apps/web/src/components/kanban-board/task-card.tsx` | `patch_apply` | 1 hunk (`handleTaskCardClick` close+open branches) — sites 3–4. |
| `apps/web/src/components/list-view/index.tsx` | `patch_apply` | 2 hunks (`j`, `k` shortcut handlers) — sites 5–6. |
| `apps/web/src/components/list-view/task-row.tsx` | `patch_apply` | 1 hunk (`handleClick` close+open branches) — sites 7–8. |
| `apps/web/src/components/list-view/task-row.test.tsx` | `existing_file_edit` | Router mock rewritten to a `vi.hoisted` capturing mock; 2 new `it` blocks. The existing `it` is byte-identical. |
| `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` | `patch_apply` | **Append-only.** New `describe` block for URL seeding / restore suppression / publish. The two existing `it` blocks (2-arg and 3-arg calls) are byte-identical — H3 depends on it. |

**Explicitly NOT edited**, and codegen must not touch them:
- `apps/web/src/hooks/use-task-filters.ts` — FR-16. The board route uses the labels variant; the
  non-label variant has other callers and needs nothing. A signature change here is a defect.
- `apps/web/src/components/board/board-toolbar.tsx` — OS-1. Its props (`filters`, `updateFilter`,
  `updateLabelFilter`, `clearFilters`, `hasActiveFilters`) are unchanged in type and in meaning.
  Zero wiring is required in the toolbar.
- `i18n/en-US.json` — no new user-facing copy.
- `apps/web/package.json`, `pnpm-lock.yaml` — NFR-3.

### 2.1 `board.tsx` — exact shape

**Hunk A — route types and validation (FR-9, FR-10, IS-1).**

```ts
type BoardSearchParams = {
  taskId?: string;
  status?: string[];
  priority?: string[];
  assignee?: string[];
  dueDate?: string[];
  labels?: string[];
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): BoardSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
    ...serializeBoardFilters(parseBoardFilterSearch(search)),
  }),
});
```

The `taskId` narrowing is preserved **verbatim** (FR-10). The filter keys are handled by
parse→serialize round-trip, which makes AC-1 structurally true rather than something to hope for:
`validateSearch`'s output is produced by the same encoder the route writes with. `parse` never
throws and `serialize` is total, so `validateSearch` cannot throw (AC-5).

**Hunk B — URL-wins-on-load snapshot (FR-11, AC-2).**

```ts
const search = Route.useSearch();
const { taskId } = search;
...
const [urlSeededFilters] = useState<BoardFilters | null>(() =>
  hasAnyBoardFilterParam(search) ? parseBoardFilterSearch(search) : null,
);
```

Lazy `useState` initializer, setter deliberately not destructured (no unused local under
`noUnusedLocals`). This snapshots the **first-render** search and never re-seeds, which is what
makes the loop analysis in §2.3 hold.

**Hunk C — publish callback (FR-12, FR-13, IS-7, AC-4, AC-6).**

```ts
const handleFiltersChange = useCallback(
  (next: BoardFilters) => {
    if (boardFilterSearchMatches(search, next)) return;

    navigate({
      to: ".",
      search: (prev) => ({ ...prev, ...serializeBoardFilters(next) }),
      replace: true,
    });
  },
  [navigate, search],
);

const filterSyncOptions = useMemo(
  () => ({
    initialFilters: urlSeededFilters,
    onFiltersChange: handleFiltersChange,
  }),
  [urlSeededFilters, handleFiltersChange],
);
```

`replace: true` is mandatory (NFR-5): browser Back must leave the board, not unwind chip clicks.
The `boardFilterSearchMatches` early return is the redundant-navigation guard — see §2.3.

**Hunk D — hook call.**

```ts
const { filters, updateFilter, updateLabelFilter, filteredProject, hasActiveFilters, clearFilters } =
  useTaskFiltersWithLabelsSupport(project, projectId, boardSearchQuery, filterSyncOptions);
```

**Hunk E — sheet close, site 9 of 9.** See §2.4.

### 2.2 `use-task-filters-with-labels-support.ts` — exact shape (H3 + H2)

**Signature (H3 — additive and optional, positional args 1–3 untouched):**

```ts
export type BoardFilterSyncOptions = {
  initialFilters?: BoardFilters | null;
  onFiltersChange?: (filters: BoardFilters) => void;
};

export function useTaskFiltersWithLabelsSupport(
  project: ProjectWithTasks | null | undefined,
  projectId?: string,
  textQuery?: string,
  options?: BoardFilterSyncOptions,
) {
```

`use-task-filters-with-labels-support.test.tsx` calls this with 2 args
(`(project, "project-1")`) and 3 args (`(project, "project-1", textQuery)`). A 4th optional
parameter satisfies both without a single character of change to those calls. **Do not** convert
the existing positional parameters to an options object; that breaks the frozen test file.

**Hook-call order inside the body — this exact order is load-bearing (H2):**

```ts
const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
const storageKey = projectId ? `kaneo:board-filters:${projectId}` : null;

const initialFilters = options?.initialFilters ?? null;
const onFiltersChange = options?.onFiltersChange;

// 1. state — seeded from the URL on the very first render, never re-seeded
const [filters, setFilters] = useState<BoardFilters>(
  () => initialFilters ?? DEFAULT_FILTERS,
);

// 2. one-shot suppression token for the restore effect
const skipRestoreForKeyRef = useRef<string | null>(
  initialFilters ? storageKey : null,
);

// 3. latest-callback holder
const onFiltersChangeRef = useRef(onFiltersChange);

// 4. EFFECT A — restore (EDITED: guard prepended, remaining body verbatim)
useEffect(() => {
  if (!storageKey || typeof window === "undefined") return;

  if (skipRestoreForKeyRef.current === storageKey) {
    skipRestoreForKeyRef.current = null;
    return;
  }

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      setFilters(DEFAULT_FILTERS);
      return;
    }
    const parsed = JSON.parse(stored) as unknown;
    setFilters(normalizeFilters(parsed));
  } catch {
    setFilters(DEFAULT_FILTERS);
  }
}, [storageKey]);

// 5. EFFECT B — write-back (UNCHANGED, not one character)
useEffect(() => {
  if (!storageKey || typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(filters));
}, [filters, storageKey]);

// 6. EFFECT C — keep the callback ref current (NEW)
useEffect(() => {
  onFiltersChangeRef.current = onFiltersChange;
}, [onFiltersChange]);

// 7. EFFECT D — publish (NEW)
useEffect(() => {
  onFiltersChangeRef.current?.(filters);
}, [filters]);
```

**Why each piece, and why not the obvious alternative:**

- *Seed via the lazy `useState` initializer, not via an effect.* An effect-based seed would race
  Effect A. A lazy initializer runs during the first render, strictly before any effect, so the
  URL-seeded value is already the committed state by the time Effect A is scheduled. There is no
  ordering to reason about for the seed itself.
- *Guard is a `useRef`, not state and not a conditional dependency.* State would force an extra
  render and would itself need to settle before Effect A. A conditional dependency
  (`[storageKey, initialFilters]`) would re-run the restore whenever `initialFilters` identity
  changed. A ref is read and cleared inside the effect, causes no re-render, and is
  React-Compiler-safe: the initial value is passed to `useRef` and `.current` is **only** mutated
  inside effects — never during render.
- *Guard lifetime is exactly one restore, scoped to one `storageKey`.* The ref holds the storage
  key that was URL-seeded at mount. Effect A runs once per `storageKey` change. On mount with a
  seeded key it matches → skip and clear. If `storageKey` later changes (a different project on a
  reused component instance), the ref is `null` and the restore runs normally — the URL seed must
  not leak across projects.
- *Effect B is untouched and this is what satisfies AC-2.* In the seeded case Effect A returns
  early, then Effect B fires on mount with the seeded value and writes it to
  `kaneo:board-filters:${projectId}` — the URL overwrites the viewer's stored filters, which is the
  confirmed, intentional side effect. No extra write path is needed.
- *Effect C is declared before Effect D.* Effects run in declaration order, so on any render where
  the callback identity changed, the ref is refreshed before the publish reads it. Effect D depends
  only on `[filters]`, so a changing `handleFiltersChange` identity (which happens on every
  navigation, since it closes over `search`) cannot re-trigger a publish.
- *Precondition on `initialFilters`.* A caller may pass `initialFilters` only if it has a stable
  `projectId` on the first render. `board.tsx` reads `projectId` from `Route.useParams()`, so this
  always holds. If `storageKey` were `null` on the first render, the ref would initialise to `null`
  and a later-arriving key would restore over the seed. No caller in this codebase can reach that
  state; the constraint is documented rather than defended.

**Non-seeded mount is behaviourally identical to today (AC-3).** Effect A restores, Effect B writes
DEFAULT then re-runs and writes the restored value — exactly today's sequence, which the existing
`restores persisted label filters from storage` test already pins.

### 2.3 Loop and redundant-navigation analysis (mandatory reasoning, not optional)

Effect D publishes on **every** `filters` change including the mount value. Three cases:

1. **URL-seeded mount.** Publishes the seeded filters. `boardFilterSearchMatches(search, seeded)` is
   `true` (the seed came from `search`) → early return → **no navigation**.
2. **Clean mount, no stored filters.** Publishes `DEFAULT_FILTERS` (all `null`).
   `parseBoardFilterSearch(search)` is also all `null` → match → **no navigation**. This is what
   keeps AC-6/FR-13 true: a board with no active filters never emits a filter param.
3. **localStorage restore.** Publishes `DEFAULT` on mount (no-op per case 2), then publishes the
   restored filters after Effect A's state update. No match → one `replace: true` navigation that
   writes the restored filters into the URL.

**Case 3 is a deliberate behaviour addition beyond the literal AC list, and Gate 2 may veto it.**
It establishes the invariant *the URL always mirrors the visible filter state*. Without it, a user
whose filters came from localStorage sees a filtered board, copies the URL, and ships an unfiltered
view to a colleague — the exact defect this feature exists to remove. Cost: one extra
`replace: true` URL rewrite on board mount for users with stored filters. No history entry, no
refetch (`useGetTasks` keys on `projectId`, not on search).

No feedback loop exists in any case: navigation changes `search`, which changes
`handleFiltersChange` identity and therefore `filterSyncOptions` identity, which re-runs Effect C
(a ref write) but **not** Effect D (deps `[filters]`). `urlSeededFilters` is a first-render snapshot
and is never recomputed, so navigation cannot re-seed the hook.

### 2.4 The nine `navigate()` call sites — H1, the `prev` widening trap

**Root cause, verified against the installed `@tanstack/router-core@1.171.20` type definitions:**

- `link.d.ts:130` — `ParamsReducerFn<..., TFrom, TTo> = (current: Expand<ResolveFromParams<TRouter, TParamVariant, TFrom>>) => Expand<ResolveRelativeToParams<...>>`.
- `link.d.ts:136` — `ResolveFromParams<..., TFrom> = string extends TFrom ? ResolveFromAllParams<...> : ...`.
  All nine sites call `useNavigate()` with **no `from`**, so `TFrom = string` and `prev` resolves to
  `FullSearchSchema<routeTree>` — the router-wide `PartialMergeAll` of every route's search schema,
  **not** `BoardSearchParams`.
- `to: "."` ∈ `CatchAllPaths`, so the required **return** type is `FullSearchSchemaInput<routeTree>`.
- `validators.d.ts:46` — for a plain `(search: Record<string, unknown>) => T` validator (the house
  style everywhere in this repo), `TSchemaInput` does not extend the `SearchSchemaInput` brand, so
  the input schema falls back to the **output** schema. Therefore `FullSearchSchema` and
  `FullSearchSchemaInput` are structurally identical for this router.

**Decision: the plain inline spread typechecks. Use it. No `from`. No cast. No shared helper.**

```ts
search: (prev) => ({ ...prev, taskId: <value> }),
```

Justification for each rejected alternative, so codegen does not improvise:
- **Do not add `from`.** It would narrow `prev` to `BoardSearchParams`, but `FromPathOption`
  constrains it to a literal route path, and `kanban-board/*` and `list-view/*` are shared
  components that must not hard-code the board route. It is also a behavioural change to relative
  `to` resolution, which FR-18 forbids.
- **Do not add a cast** (`prev as BoardSearchParams`). It is unnecessary given the analysis above
  and would silently paper over a genuine schema conflict if one is ever introduced.
- **Do not add a shared `withTaskId(prev, id)` helper.** It cannot improve assignability (the same
  contextual type applies at the return) and it would add a module for nine one-line spreads.

**Second, independent H1 hazard — narrowing is lost inside the closure at the four `j`/`k` sites.**
`useBulkSelectionStore.getState()` returns `BulkSelectionState`, whose `focusedTaskId: string | null`
is **not** `readonly` (`apps/web/src/store/bulk-selection.ts:7`). TypeScript's `isConstantReference`
rule does not preserve a narrowing of `state.focusedTaskId` inside a function expression created
after the `if`. So the naive conversion

```ts
if (state.focusedTaskId) {
  navigate({ to: ".", search: (prev) => ({ ...prev, taskId: state.focusedTaskId }) });
}
```

leaves `state.focusedTaskId` as `string | null` inside the arrow and **fails** to assign to
`taskId?: string`. Four of the nine sites would break the batch. Hoist to a `const` identifier
(narrowing of a `const` identifier *is* preserved into closures) and drop the now-redundant `state`
local. Naming avoids shadowing the component-scope `focusedTaskId` already destructured from
`useBulkSelectionStore()`.

**Sites 1–2 — `apps/web/src/components/kanban-board/index.tsx` (lines 63–76), `j` and `k`:**

```ts
j: () => {
  focusNext();
  const nextFocusedTaskId = useBulkSelectionStore.getState().focusedTaskId;
  if (nextFocusedTaskId) {
    navigate({
      to: ".",
      search: (prev) => ({ ...prev, taskId: nextFocusedTaskId }),
    });
  }
},
```

`k` is identical with `focusPrevious()`. The `Enter` handler below is **untouched** — it navigates
to the task full-page route with `params`, not `search`.

**Sites 5–6 — `apps/web/src/components/list-view/index.tsx` (lines 93–106):** identical shape to
sites 1–2. Its `Enter` handler is likewise untouched.

**Sites 3–4 — `apps/web/src/components/kanban-board/task-card.tsx` (lines 147–157):**

```ts
if (currentTaskId === task.id) {
  navigate({
    to: ".",
    search: (prev) => ({ ...prev, taskId: undefined }),
  });
} else {
  navigate({
    to: ".",
    search: (prev) => ({ ...prev, taskId: task.id }),
  });
}
```

The close branch clears **only** `taskId` (FR-17) — `search: {}` was the single most destructive
form in the set, wiping every filter on a second click of an already-open card. `task.id` is
`string` unconditionally, so no hoist is required here. The `!project || !task || !workspace`
guard, the meta/ctrl branch and the `window.location.search` read above are unchanged (FR-18).

**Sites 7–8 — `apps/web/src/components/list-view/task-row.tsx` (lines 146–156):** identical to
sites 3–4.

**Site 9 — `board.tsx` `handleCloseTaskSheet` (lines 96–102):**

```ts
const handleCloseTaskSheet = useCallback(() => {
  navigate({
    to: ".",
    search: (prev) => ({ ...prev, taskId: undefined }),
    replace: true,
  });
}, [navigate]);
```

`replace: true` was already there and stays.

**Note on spreading the router-wide `prev` at runtime:** it carries every search key currently on
the URL, not just the board's. Because `to: "."` stays on the board route, TanStack runs the board's
`validateSearch` over the merged object and that function returns only
`{ taskId, status, priority, assignee, dueDate, labels }` — foreign keys are dropped on the way out.
No cross-route search leakage.

---

## 3. Files removed

None.

---

## 4. Data-layer changes

**None. Client-only change.** No schema, no migration, no ORM model, no server-side state.
`apps/api/**` is off-limits for this run (OS-4).

---

## 5. API contract changes

**None. Client-only change.** No new endpoint, no changed request/response shape, no deprecated
route. Filtering is a pure client-side view over data `useGetTasks` already fetched under the
existing workspace authorization. A shared filtered URL grants a non-member nothing: the underlying
task query is denied by the API and the filter params are inert (requirements §8).

---

## 6. Framework-owned wiring

This stack's wiring surfaces are TanStack Router's generated route tree and Vite module resolution —
there is no module-registration file to touch. Packet plan entries:

1. **No `routeTree.gen.ts` write, and none is needed.** The board route's search type is declared
   *inside* `board.tsx` via `validateSearch`; the generated tree only re-exports route modules and
   carries no search-schema literal. Widening `BoardSearchParams` therefore propagates through
   `Route['types']` at compile time with the generated file untouched. `routeTree.gen.ts` is
   off-limits (OS-8) — see §9 for the escalation path if typecheck proves otherwise.
2. **No route file added, so `@tanstack/router-plugin` regeneration is not triggered.** The plugin
   runs under `vite dev`/`vite build`, not under `tsc --noEmit`; the verification command
   `pnpm --filter @kaneo/web typecheck` does not regenerate anything.
3. **No barrel/index registration for the new lib module.** `apps/web/src/lib/` has no barrel file;
   consumers import the path directly (`@/lib/board-filter-search-params`), matching
   `@/lib/sort-tasks` and `@/lib/get-task-label-options`.
4. **No i18n registration.** `i18n/en-US.json` is unchanged, so `pnpm i18n:check` has nothing new to
   validate — and `pnpm i18n:check:fix` must not be run (OS-9).
5. **No vitest config change.** `include: ["src/**/*.test.{ts,tsx}"]` already covers all three test
   paths in this plan.

---

## 7. Config schema — env variables added

**None. Client-only change.** No `VITE_*` variable is read, added, or changed. Filter state lives in
the URL and in `window.localStorage`; neither is configurable.

---

## 8. Testing surface

Baseline to beat: **36 test files / 112 tests passing** (NFR-2 — ≥112, zero regressions).
Commands (context only, not run in this phase): `pnpm --filter @kaneo/web test`,
`pnpm --filter @kaneo/web typecheck`.

### 8.1 `apps/web/src/lib/board-filter-search-params.test.ts` — NEW

Pure, no DOM, no mocks. Mirrors `get-task-label-options.test.ts` in shape (`describe`/`it`,
explicit `expect`, no setup).

| # | Assertion | Covers |
|---|---|---|
| 1 | `BOARD_FILTER_SEARCH_KEYS` deep-equals `["status","priority","assignee","dueDate","labels"]` | FR-1 exhaustiveness (the `as const satisfies` clause covers "no extras"; this test covers "none missing") |
| 2 | `parseBoardFilterSearch({ status: ["todo","done"], labels: ["l1"] })` → those arrays, other keys `null` | FR-2, FR-3 array form |
| 3 | **`parseBoardFilterSearch({ status: "todo" })` → `{ status: ["todo"], ... }`** | FR-3 bare-string form — the primary single-value path under repeated-param encoding, not a defensive branch |
| 4 | `parseBoardFilterSearch({ status: ["todo", 1, null, {}] })` → `["todo"]` | FR-4 non-string members dropped |
| 5 | `parseBoardFilterSearch({ status: [] })` and `{ status: [1] }` → `null` | FR-4 empty collapse |
| 6 | **`hasAnyBoardFilterParam({ status: "" })` is `false`, and `parseBoardFilterSearch({ status: "" }).status` is `null`** — dedicated test, own `it` | FR-7, AC-5. This is the predicate that must not suppress the localStorage restore. It is the one that a naive `key in search` implementation gets wrong. |
| 7 | `hasAnyBoardFilterParam({})` / `({ taskId: "t1" })` → `false`; `({ status: "todo" })` → `true` | FR-7 |
| 8 | `parseBoardFilterSearch({ status: ["x".repeat(MAX_BOARD_FILTER_VALUE_LENGTH + 1)] })` → `null`; an array of 200 values → length `MAX_BOARD_FILTER_VALUES` | FR-5 |
| 9 | Hostile inputs `{ "status[]": "x" }`, `{ labels: {} }`, `{ __proto__: ["x"] }`, `null`, `undefined`, `"string"`, `42` → all keys `null`, never throws; and `Object.prototype` is unpolluted afterwards | AC-5 |
| 10 | `serializeBoardFilters({ status: ["todo"], priority: null, assignee: null, dueDate: null, labels: null })` → `status: ["todo"]`, and **`Object.hasOwn(result, "priority")` is `true` with `result.priority === undefined`** | FR-6 + frozen decision 4. This is the assertion that pins the §1.1 conflict resolution; a conditional-key-omission implementation fails it. |
| 11 | `serializeBoardFilters(all-null)` → all five keys present, all `undefined` | FR-13, AC-6 |
| 12 | Round-trip: for a populated `BoardFilters`, `parseBoardFilterSearch(serializeBoardFilters(f))` deep-equals `f` | **AC-1** |
| 13 | `boardFilterSearchMatches({ status: "todo" }, { status: ["todo"], ...nulls })` → `true`; against `{ status: ["done"], ... }` → `false`; `boardFilterSearchMatches({}, DEFAULT)` → `true` | §2.3 guard correctness |

### 8.2 `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` — EDITED (append-only)

The two existing `it` blocks stay **byte-identical** (H3: 2-arg and 3-arg positional calls must keep
compiling and passing). Appended `describe("url-seeded filters")` block, same `renderHook` +
`waitFor` + `window.localStorage` seed/clear harness already used in the file:

| # | Assertion | Covers |
|---|---|---|
| 1 | Seed `localStorage` with `{ labels: ["label-stored"] }`, render with `{ initialFilters: { ...nulls, status: ["todo"] } }`; `result.current.filters.status` is `["todo"]` and `filters.labels` is `null` — the stored value never appears, not even transiently across a `waitFor` | **FR-15, H2, AC-2 (part 1)** — fails if Effect A's guard is missing or if the seed is done via an effect instead of a lazy initializer |
| 2 | Same setup; after `waitFor`, `JSON.parse(localStorage.getItem("kaneo:board-filters:project-1"))` equals the URL-seeded filters | **AC-2 (part 2)** — the intentional clobber of the viewer's stored filters |
| 3 | Seed `localStorage` with `{ labels: ["label-bug"] }`, render with `{ initialFilters: null }`; filters restore to `["label-bug"]` | **AC-3** — the guard must not fire when there is no URL seed |
| 4 | Render with `onFiltersChange`; `act(() => result.current.updateFilter("status", ["todo"]))`; the callback is called with the full next `BoardFilters` | FR-12, FR-14 |
| 5 | Render with `onFiltersChange`; `act(() => result.current.clearFilters())` from a seeded state; the callback receives all-`null` filters | FR-13 |
| 6 | Re-render with a **new** `onFiltersChange` identity but the same `filters`; the callback is not invoked by the identity change alone | Effect C/D separation — pins that a naive `[filters, onFiltersChange]` dependency list is wrong |

### 8.3 `apps/web/src/components/list-view/task-row.test.tsx` — EDITED

**The existing router mock cannot capture arguments.** It is
`vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }))` — a *fresh* spy per
call, unreachable from the test body. Replace with a hoisted, shared spy (matching the hoisted-mock
convention the stack profile documents for API tests):

```tsx
const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));
```

`vi.hoisted` is required: `vi.mock` factories are hoisted above module-scope `const`s. The existing
`afterEach` already calls `vi.clearAllMocks()`. Every other mock in the file is unchanged, and the
existing `renders labels and pull requests…` test is byte-identical.

Two new `it` blocks:

| # | Assertion | Covers |
|---|---|---|
| 1 | **open** — click the row title; then `const options = navigateMock.mock.calls[0][0]`; assert `typeof options.search === "function"` **and** `options.search({ status: ["todo"], taskId: undefined })` deep-equals `{ status: ["todo"], taskId: "task-1" }` | AC-7 (open), sites 7–8 |
| 2 | **close** — `window.history.replaceState({}, "", "/?taskId=task-1")` in the test body so `handleClick` takes the close branch; click; assert `options.search({ status: ["todo"], taskId: "task-1" })` deep-equals `{ status: ["todo"], taskId: undefined }` | AC-7 (close) — pins that the close branch clears **only** `taskId` (FR-17) |

**Why these fail before the fix, by construction.** Against the unmodified `task-row.tsx`,
`options.search` is the object literal `{ taskId: "task-1" }` (or `{}`). `typeof options.search`
is `"object"`, so assertion 1 fails immediately; and `options.search(...)` throws
`TypeError: options.search is not a function`. There is no value of a literal-object `search` that
can satisfy an assertion which *invokes* it as a reducer and inspects the merged result. The
`status: ["todo"]` key in the seeded `prev` is what proves *preservation* rather than merely
*shape*: a reducer that returned `{ taskId }` without spreading `prev` would pass the `typeof`
check and fail the deep-equal.

### 8.4 `apps/web/src/components/board/board-search-preservation.test.tsx` — NEW

**Placement rationale — read before relocating this file.** The write contract allowlists
`apps/web/src/components/kanban-board/index.tsx` and `task-card.tsx` and
`apps/web/src/components/list-view/index.tsx` as **individual files**, not as `**` globs. There is
therefore **no legal path** for `kanban-board/index.test.tsx`, `kanban-board/task-card.test.tsx` or
`list-view/index.test.tsx`. `apps/web/src/components/board/**` is a directory allowlist and is the
only lawful home for a board-level regression suite. Do not attempt to create a test file next to
the components it guards — the write-contract validator will reject the packet.

**Tier 1 — behavioural, for `TaskCard` (sites 3–4).** Same construction as §8.3: `vi.hoisted`
capturing `navigateMock`, render `<TaskCard task={...} />`, click, invoke the captured reducer
against a seeded `prev` carrying `status: ["todo"]`, assert preservation on both the open and the
close branch. Mock surface (mirrors `task-row.test.tsx`, ~11 modules): `@dnd-kit/sortable`
(`useSortable`), `@dnd-kit/utilities` (`CSS`), `@tanstack/react-router`, `react-i18next`,
`@/store/project`, `@/store/user-preferences`, `@/store/bulk-selection`,
`@/hooks/queries/workspace/use-active-workspace`,
`@/hooks/queries/workspace-users/use-get-active-workspace-users`,
`@/hooks/mutations/task/use-delete-task`, `@/query-client`, `@/lib/toast`, and
`./task-card-context-menu/task-card-context-menu-content` → `() => null`.

**Tier 2 — structural, for the five sites with no lawful render harness (1–2, 5–6, 9).** Mounting
`KanbanBoard`/`ListView` requires a full dnd-kit context, keyboard-shortcut registration and a
project fixture, and the `j`/`k` handlers fire through `useRegisterShortcuts` — a brittle,
expensive harness for a one-line invariant, and one whose test file cannot be placed next to the
component anyway. Compensating control: assert on the **source text** of the five files.

```ts
const sources = {
  "kanban-board/index.tsx": readFileSync(new URL("../kanban-board/index.tsx", import.meta.url), "utf8"),
  "kanban-board/task-card.tsx": readFileSync(new URL("../kanban-board/task-card.tsx", import.meta.url), "utf8"),
  "list-view/index.tsx": readFileSync(new URL("../list-view/index.tsx", import.meta.url), "utf8"),
  "list-view/task-row.tsx": readFileSync(new URL("../list-view/task-row.tsx", import.meta.url), "utf8"),
  "board.tsx": readFileSync(
    new URL("../../routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx",
      import.meta.url), "utf8"),
};
```

`readFileSync` accepts a `URL` directly, so no `fileURLToPath` import is needed.

| # | Assertion | Covers |
|---|---|---|
| 1 | For each of the five files: `expect(source).not.toMatch(/search:\s*\{/)` | AC-7 — **9 occurrences before the fix, 0 after** |
| 2 | Total count of `/search:\s*\(prev\)\s*=>/g` across the five files is exactly **9** | AC-7 — pins the verified count against the brief's undercount of six |
| 3 | Per-file counts are `2 / 2 / 2 / 2 / 1` | localises a regression to a file |
| 4 | `sources["board.tsx"]` matches `/replace:\s*true/` at least twice (sheet close + filter publish) | AC-4, IS-7, NFR-5 |

**Why tier 2 fails before the fix:** the unmodified sources contain nine `search: {` literals and
zero `search: (prev) =>`. Assertions 1 and 2 both fail hard. Failure-before-fix is demonstrable by
checking out `5d1fc910` and running the file. This tier is a lint-shaped test, not a behaviour test,
and it is a deliberate compensating control — recorded in §9 as such.

### 8.5 Existing tests affected

- `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` — 3 existing assertions
  (1 `it` + 1 `it.each` × 3 cases). Must pass **unchanged**; H3 and AC-8 both depend on it.
- `apps/web/src/components/list-view/task-row.test.tsx` — 1 existing test. The mock rewrite changes
  `useNavigate` from a throwaway spy to a shared spy; `TaskRow` calls `useNavigate()` at render but
  the existing test never clicks, so it is unaffected.
- Everything else in the 36-file baseline is untouched. `filterTasks` semantics are frozen (OS-2) —
  no test that exercises filtering behaviour may change.

---

## 9. Off-limits reminders

1. **`apps/web/src/routeTree.gen.ts` — off-limits (OS-8), and this plan does not need it.** Reasoning
   in §6.1. **Gate-3 escalation path if `pnpm --filter @kaneo/web typecheck` disagrees:** stop, do
   not hand-edit the generated file, and surface it. The correct remedy would be running the router
   plugin (`pnpm --filter @kaneo/web build`/`dev`), which is a user-run step, not a plugin write.
2. **`apps/api/**` — off-limits.** Zero API, schema, migration or server change (OS-4). Sections 4,
   5 and 7 of this document are empty for exactly this reason.
3. **`apps/web/src/components/backlog-list-view/**` — off-limits and out of scope (OS-3, OS-5).**
   It contains the *same* `search: {}` / `search: { taskId }` literal pattern. It belongs to the
   backlog route, which has no filter params. Do **not** "helpfully" convert it — that is a
   write-contract violation and a scope breach. The same applies to
   `apps/web/src/components/task/task-details-sheet.tsx:55`, which navigates to the task full-page
   route with `params` and is a verified non-hazard.
4. **`apps/web/src/store/user-preferences.ts` — off-limits.** The hook reads `weekStartsOn` from it
   and the read is unchanged.
5. **Allowlist granularity trap.** `apps/web/src/components/kanban-board/**` and
   `.../list-view/**` are **not** allowlisted; only four specific files plus
   `list-view/task-row.test.tsx` are. This forbids new test files in those directories and is the
   sole reason §8.4 exists in `components/board/` with a structural tier. Any packet that proposes
   `kanban-board/index.test.tsx` will be rejected.
6. **`i18n/*.json` except `en-US.json` — off-limits**, and `en-US.json` is not being edited.
7. **Never run `pnpm lint`, `biome check --write .`, or `pnpm i18n:check:fix`** (OS-9, NFR-6).
   Formatting verification is targeted `biome check <changed paths>` only.
8. **Deliberately retained duplication.** `normalizeFilters` and `DEFAULT_FILTERS` are copy-pasted
   across `use-task-filters.ts` and `use-task-filters-with-labels-support.ts`. This plan edits only
   the labels variant and leaves both copies in place (OS-6, Gate 0). It is tempting to have the new
   lib module absorb them — **do not.** That would drag `use-task-filters.ts` into the blast radius
   in violation of FR-16.
9. **Deliberately retained latent issue.** Assignee filtering matches `task.userId`, not
   `task.assigneeId` (`use-task-filters-with-labels-support.ts:119`). Left alone (OS-7). Note that
   URL-persisting the assignee filter makes this *more visible* — a shared link's assignee filter
   behaves identically to the local one, so it is consistently wrong rather than newly wrong. Not a
   blocker; flagged for a follow-up run.
10. **PII surface, new this run.** Assignee `userId`s and label IDs move from origin-scoped
    localStorage into a URL that users are encouraged to share — and therefore into browser history,
    `Referer` headers and any reverse-proxy access log (requirements §7). They are opaque
    workspace-scoped IDs already visible to the authenticated client, and FR-5's count/length caps
    bound injection. This is the one genuinely new exposure surface; carry it into the Phase 8
    security review. No mitigation is planned in this run.
11. **No new runtime dependency (NFR-3).** `zod` is present in `apps/web/package.json` but is not
    the house style for search params and must not be introduced here; hand-written `typeof` /
    `Array.isArray` narrowing only (FR-8).
12. **§8.4 tier 2 is a source-text assertion, not a behaviour assertion.** Recorded here as a known,
    accepted compromise forced by the allowlist granularity in reminder 5, not as an oversight.

---

## 10. Cross-cutting sequencing

Strict dependency order. Packets in the same wave have no shared files and no compile-time
dependency on each other — they are parallel-safe.

**Wave 1 — no dependencies (3 packets, fully parallel):**

- **P1 — pure lib.** `apps/web/src/lib/board-filter-search-params.ts` +
  `board-filter-search-params.test.ts`. Depends on nothing but the existing `BoardFilters` type.
  This is the foundation of both FR-10 and FR-12 and must land first on the critical path.
- **P2 — hook.** `apps/web/src/hooks/use-task-filters-with-labels-support.ts`. Independent of P1:
  `BoardFilterSyncOptions` is declared inside the hook file and imports nothing new. Do not import
  the lib module here.
- **P4 — the eight component call sites.** `kanban-board/index.tsx`, `kanban-board/task-card.tsx`,
  `list-view/index.tsx`, `list-view/task-row.tsx`. Purely local edits; independent of P1, P2 and P3
  at compile time. Generate all four in one packet so the `search: (prev) =>` shape and the
  `nextFocusedTaskId` hoist are applied uniformly — a partial conversion is worse than none, because
  the §8.4 tier-2 count assertions are all-or-nothing.

**Wave 2 — depends on wave 1:**

- **P3 — route wiring.** `board.tsx`. **Requires P1** (imports `parseBoardFilterSearch`,
  `serializeBoardFilters`, `hasAnyBoardFilterParam`, `boardFilterSearchMatches`,
  `BOARD_FILTER_SEARCH_KEYS`) **and P2** (passes the 4th positional argument). Also carries site 9
  of 9. Cannot start before both.
- **P5 — task-row test.** `list-view/task-row.test.tsx`. **Requires P4** — the assertions fail
  against the unmodified `task-row.tsx` by design, so P4 must have landed for the suite to be green.
- **P7 — hook tests.** Append to `use-task-filters-with-labels-support.test.tsx`. **Requires P2.**
  Independent of P3, P4, P5 — parallel-safe with them.

P5 and P7 are parallel-safe with each other and with P3.

**Wave 3 — last:**

- **P6 — AC-7 guard suite.** `components/board/board-search-preservation.test.tsx`. **Requires P3**
  (its tier-2 assertions read `board.tsx`'s source, including the `replace: true` count) **and P4**
  (tier 1 renders `TaskCard`; tier 2 reads all four component sources). Must be last.

**Critical path:** P1 → P3 → P6. **Longest parallel branch:** P2 → P3 → P6.

**Mutation-check step, between waves 2 and 3 (AC-7, IS-6).** Before P6 is accepted, run its tier-2
assertions against the pre-fix sources (`git stash` P4, or check out `5d1fc910` in a scratch
worktree) and record the failure — 9 `search: {` matches, 0 `search: (prev) =>` matches — in the
final report. A guard that passes both before and after does not satisfy AC-7 and the run should
not close without this evidence.

**Verification after every wave:** `pnpm --filter @kaneo/web typecheck` (NFR-1, AC-9 — the nine
converted sites use the functional-search form for the first time in this repo, so typecheck is the
gate, not a formality) then `pnpm --filter @kaneo/web test` (NFR-2, ≥112 tests, 0 regressions).

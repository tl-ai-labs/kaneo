# Change Plan — Board filter chips with URL-persisted state

- **Run:** `20260827-043436-feature-extend-board-filter-chips`
- **Intent:** `feature-extend` · **Mode:** brownfield · **Policy:** `opus-only-v5`
- **Baseline commit:** `5d1fc9104337786c3ef295ec0dc31656df371d8d`
- **Authority order:** `intent_brief.md` > Gate-1 decisions (OQ-1..OQ-4) > `requirements.md` > this document.
- **Stack (verified this phase):** React 19.2 + Vite 8 + `@tanstack/react-router` ^1.170.21 (file-based,
  **default** `parseSearch`/`stringifySearch` — `main.tsx` passes no overrides) + TanStack Query 5 +
  Tailwind 4 + Vitest 4 / Testing Library / jsdom. React Compiler runs in the **Vite build only**
  (`vite.config.ts` → `babel({ presets: [reactCompilerPreset()] })`); `vitest.config.ts` uses plain
  `@vitejs/plugin-react`, so tests execute un-compiled code.
- **Typecheck strictness (verified):** `tsconfig.app.json` sets `noUnusedLocals: true` and
  `noUnusedParameters: true`. Every symbol this plan orphans in `board-toolbar.tsx` is a **hard
  `tsc` failure**, not a lint warning. Section 5.6 enumerates them exhaustively.

---

## 0. Write-contract conformance (read this before anything else)

Every path this plan writes, checked against the 7 allowlist globs:

| Path | Allowlist glob it matches |
|---|---|
| `apps/web/src/components/board/board-search-params.ts` | `apps/web/src/components/board/**` |
| `apps/web/src/components/board/board-search-params.test.ts` | `apps/web/src/components/board/**` |
| `apps/web/src/components/board/board-search-params.router.test.tsx` | `apps/web/src/components/board/**` |
| `apps/web/src/components/board/board-filter-chips.tsx` | `apps/web/src/components/board/**` |
| `apps/web/src/components/board/board-filter-chips.test.tsx` | `apps/web/src/components/board/**` |
| `apps/web/src/components/board/board-toolbar.tsx` | `apps/web/src/components/board/**` |
| `apps/web/src/hooks/use-task-filters-with-labels-support.ts` | exact-path glob |
| `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` | exact-path glob |
| `.../project/$projectId/board.tsx` | exact-path glob |
| `i18n/en-US.json` | exact-path glob |
| `.sdlc/runs/<run-id>/change_plan.md` (this file) | `.sdlc/**` |

**`apps/web/src/hooks/use-task-filters.ts` is NOT written.** It is read-only for the shared
`BoardFilters` type and `DUE_DATE_FILTER_VALUES` (E-7). Deduplication remains a non-goal.

**Contract-forced design decision — flagged loudly.** The allowlist grants the *file*
`.../$projectId/board.tsx`, not the directory `apps/web/src/routes/**`. A colocated
`board.test.tsx` is therefore **not writable** — even though the tooling would accept it
(`vite.config.ts` sets `routeFileIgnorePattern: "\\.test\\.tsx?$"` precisely so colocated route
tests are excluded from the generated route tree). Consequence: **all testable route logic —
`validateSearch`, the search-param serializer, the navigate-payload builders, and the
`handleCloseTaskSheet` fix — is extracted into `apps/web/src/components/board/board-search-params.ts`
and unit-tested there.** `board.tsx` keeps only wiring: it imports pure functions and calls
`navigate`. This is the single largest structural decision in the plan and it is driven by the
write contract, not by taste. It is also good design independently: it makes FR-15/FR-16/FR-19
testable as pure functions instead of requiring a full route render.

No write outside the 7 globs is required. `main.tsx` (router config), `routeTree.gen.ts`,
`apps/web/package.json`, `pnpm-lock.yaml`, `biome.json`, `.gitignore`, `i18n/schema.json` and the
16 non-`en-US` locale files are all untouched.

---

## 1. Delta summary

`useTaskFiltersWithLabelsSupport` gains an optional fourth argument that lets an external owner
control the `assignee` and `labels` keys; the board route becomes that owner by putting both keys
in its search params as comma-joined id lists. The existing chip block is lifted out of
`board-toolbar.tsx` into a new `BoardFilterChips` component, where the `assignee` and `labels`
subjects are decomposed into one chip per value (per label **group**, per OQ-3) and a **clear all**
control is added. `status`, `priority` and `dueDate` keep their current aggregate chips verbatim,
keep living in `localStorage` only, and get no URL representation. `localStorage` stops being a
writer of the URL-owned keys and becomes (a) a first-mount seed for a URL that carries neither
param, and (b) a mirror of whatever is actually applied.

**A chip row already exists.** `board-toolbar.tsx:527-637` renders five *aggregate* chips
(`[subject | operator | value-or-"{{count}} selected" | X]`), each with a single X that clears the
whole subject. This work does **not** add a chip row where none existed. It (1) extracts that row
into its own component, (2) decomposes only the `assignee` and `labels` chips into per-value chips
with per-value removal, (3) adds a clear-all control, and (4) leaves the `status`/`priority`/
`dueDate` chips byte-for-byte identical in markup and behavior.

### Files touched

| File | Kind | Reason |
|---|---|---|
| `apps/web/src/components/board/board-search-params.ts` | **new** | Pure URL contract: `BoardSearchParams`, `validateBoardSearch`, `parseFilterList`, `serializeFilterList`, `applyFilterSearch`, `clearTaskId`. Lives here (not next to the route) because the routes directory is off-limits — see §0. |
| `apps/web/src/components/board/board-search-params.test.ts` | **new** | Table-driven malformed-input suite (AC-5), determinism (FR-16), `taskId` preservation (FR-17/FR-19). |
| `apps/web/src/components/board/board-search-params.router.test.tsx` | **new** | Real `createRouter` + `createMemoryHistory` round trip: proves the comma format survives TanStack's default stringifier, and that back/forward walks filter states (AC-2/AC-4). |
| `apps/web/src/components/board/board-filter-chips.tsx` | **new** | The extracted chip row. Owns `ActiveFilterChip` + `StackedIcons` (moved, not copied) plus per-value assignee/label chips and clear-all. |
| `apps/web/src/components/board/board-filter-chips.test.tsx` | **new** | All five subjects, per-value removal, clear-all, empty case, a11y (AC-1, AC-8). |
| `apps/web/src/components/board/board-toolbar.tsx` | `existing_file_edit` | Delete the 111-line inline chip block + two moved helpers + three now-dead display helpers; render `<BoardFilterChips />` in its place; rewrite `toggleLabelGroup`/`clearLabelFilters` to single-commit form; drop the `updateLabelFilter` prop. |
| `apps/web/src/hooks/use-task-filters-with-labels-support.ts` | `existing_file_edit` | Add the optional controlled 4th argument, compute `effectiveFilters` during render, route commits for the two controlled keys through the callback, mirror `effectiveFilters` (not internal state) to storage, export `readStoredBoardFilters`. |
| `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` | `patch_apply` (append) | New `describe("controlled mode")` block. **The two existing tests are not edited.** |
| `.../$projectId/board.tsx` | `existing_file_edit` | `validateSearch: validateBoardSearch`; derive controlled filters from `Route.useSearch()`; `navigate` on change; first-mount storage seed; **`handleCloseTaskSheet` fix**; stop passing `updateLabelFilter`. |
| `i18n/en-US.json` | `patch_apply` | Three new keys under `tasks.boardFilters`. |

No files removed.

---

## 2. URL contract

### 2.1 Why the search value is a `string`, not a `string[]`

`requirements.md` FR-14 says `BoardSearchParams` gains `assignee?: string[]`. **This plan deviates
and stores `assignee?: string` (a canonical comma-joined list).** Reason, and it is forced:

`main.tsx` calls `createRouter({ routeTree, defaultPreload, defaultPreloadStaleTime, context })`
with **no** `parseSearch`/`stringifySearch` override, so TanStack Router's defaults apply:
`parseSearchWith(JSON.parse)` and `stringifySearchWith(JSON.stringify, JSON.parse)`. The default
stringifier JSON-encodes any value for which `typeof val === "object" && val !== null`. Passing
`{ assignee: ["u1","u2"] }` to `navigate` therefore produces
`?assignee=%5B%22u1%22%2C%22u2%22%5D`, which is exactly the encoding OQ-2 rejected. The only place
to change that behavior is the `createRouter` call in `apps/web/src/main.tsx`, which is **off-limits**.

Passing a plain string works because the default stringifier's string branch is:
try `JSON.parse(val)`; if it **throws**, emit the raw string; if it **succeeds**, emit
`JSON.stringify(val)` so the value round-trips as a string. `"u1,u2"` is not valid JSON → emitted
raw → `?assignee=u1,u2`. Human-readable, pasteable, OQ-2 satisfied.

The `string[]` shape survives where it belongs: the route component derives it during render with
`parseFilterList(search.assignee)` and hands `string[] | null` to the hook. The array never touches
the URL boundary. Gate-1's OQ-2 decision outranks FR-14's incidental typing; this deviation is
deliberate and is the only one in the plan.

> **Verify-first obligation.** This rests on a claim about TanStack Router 1.170's default
> stringifier. Packet P2 (`board-search-params.router.test.tsx`) is a real router test that asserts
> `router.history.location.href` contains a literal `assignee=u1,u2`. It is sequenced **before**
> the `board.tsx` packet so a wrong assumption fails fast and cheap, not in review. See R-8.

### 2.2 `board-search-params.ts` — exact code

```ts
export type BoardSearchParams = {
  taskId?: string;
  /** Canonical, comma-joined, sorted, deduped list of workspace-member ids. */
  assignee?: string;
  /** Canonical, comma-joined, sorted, deduped list of workspace-label ids. */
  labels?: string;
};

/** A filter subject's value in the shape the filter hook speaks. */
export type ControlledBoardFilterValues = {
  assignee: string[] | null;
  labels: string[] | null;
};

/** Hard caps. Both exist to bound work done on attacker-supplied URLs. */
export const MAX_FILTER_VALUES = 50;
export const MAX_FILTER_VALUE_LENGTH = 128;
const MAX_RAW_LENGTH = MAX_FILTER_VALUES * (MAX_FILTER_VALUE_LENGTH + 1);

/**
 * Tolerant reader for one filter search param.
 *
 * Accepts, in this order of tolerance:
 *   - a comma-joined string  ("u1,u2")            — the canonical form we write
 *   - a bare string          ("u1")
 *   - a number               (123)                — TanStack's JSON.parse turns a numeric-only
 *                                                   hand-typed param into a number
 *   - an array of the above  (["u1","u2"])        — repeated `?assignee=`/JSON-array links
 * Anything else yields null. Never throws: no JSON.parse, no regex, bounded allocation.
 */
export function parseFilterList(raw: unknown): string[] | null {
  const entries: unknown[] = Array.isArray(raw) ? raw : [raw];
  const seen = new Set<string>();

  for (const entry of entries) {
    const text =
      typeof entry === "string"
        ? entry
        : typeof entry === "number" && Number.isFinite(entry)
          ? String(entry)
          : null;

    if (text === null || text.length > MAX_RAW_LENGTH) continue;

    for (const part of text.split(",")) {
      const value = part.trim();
      if (!value || value.length > MAX_FILTER_VALUE_LENGTH) continue;
      seen.add(value);
      if (seen.size >= MAX_FILTER_VALUES) break;
    }

    if (seen.size >= MAX_FILTER_VALUES) break;
  }

  return seen.size > 0 ? Array.from(seen) : null;
}

/**
 * Canonical writer. Sorted so the same filter set always produces the same string (FR-16):
 * toggling a value on and then off returns the URL to its exact prior text.
 * Empty yields `undefined`, which TanStack deletes from the query string entirely (FR-15) —
 * never `""` and never `[]`.
 */
export function serializeFilterList(
  values: readonly string[] | null | undefined,
): string | undefined {
  if (!values || values.length === 0) return undefined;
  const unique = Array.from(new Set(values.filter((value) => value.length > 0)));
  if (unique.length === 0) return undefined;
  return unique.sort().join(",");
}

/**
 * Route `validateSearch`. Total function — every input path returns; nothing throws (AC-5).
 * `taskId` keeps its exact current predicate so AC-6 cannot regress.
 */
export function validateBoardSearch(
  search: Record<string, unknown>,
): BoardSearchParams {
  return {
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
    assignee: serializeFilterList(parseFilterList(search.assignee)),
    labels: serializeFilterList(parseFilterList(search.labels)),
  };
}

/** navigate() payload builder for a filter change. Preserves `taskId` (FR-17). */
export function applyFilterSearch(
  previous: BoardSearchParams,
  next: ControlledBoardFilterValues,
): BoardSearchParams {
  return {
    ...previous,
    assignee: serializeFilterList(next.assignee),
    labels: serializeFilterList(next.labels),
  };
}

/** navigate() payload builder for closing the task sheet. Clears ONLY `taskId` (FR-19). */
export function clearTaskId(previous: BoardSearchParams): BoardSearchParams {
  return { ...previous, taskId: undefined };
}
```

### 2.3 Serialization rules

1. **Format.** `?assignee=u1,u2&labels=l7,l9`. Comma-joined, unencoded commas, no brackets, no
   quotes.
2. **Dedup.** On read (`Set` in `parseFilterList`) and again on write (`Set` in
   `serializeFilterList`). A duplicate can therefore never reach the filter predicate or the chip
   row, so `React key` collisions are impossible.
3. **Order.** Canonical order is `Array.prototype.sort()` (UTF-16 code-unit, stable since ES2019).
   Chips render in URL order, i.e. sorted order, not click order. This is what makes FR-16's
   "toggle twice returns to the original URL" true.
4. **Empty ⇒ absent.** `serializeFilterList` returns `undefined`; TanStack's stringifier deletes
   `undefined` keys before building the query string. The URL shows no `assignee=` at all.
5. **No canonicalizing redirect.** `validateSearch` normalizes the *parsed value* but the plan
   never navigates just to rewrite the address bar. `?assignee=u2,u1` renders correctly with a
   non-canonical URL until the user's next filter change. This is deliberate: a canonicalizing
   redirect is exactly the shape of the R-1 loop.
6. **Trim.** Each comma segment is `.trim()`-ed, so `?assignee=u1, u2` works.

### 2.4 Malformed input → result

`search.<key>` below is what TanStack's default `parseSearchWith(JSON.parse)` hands `validateSearch`.
"Renders" means the board mounts and paints; nothing in the chain can throw.

| URL fragment | `search.assignee` sees | `parseFilterList` | Validated `assignee` | Why it renders |
|---|---|---|---|---|
| `?assignee=` | `""` (JSON.parse throws → raw string) | `"".split(",")` → `[""]` → all trimmed-empty | `undefined` | Total function; empty `Set` → `null` → `undefined`. |
| `?assignee=,,` | `",,"` | three empty segments | `undefined` | Same path. |
| `?assignee[]=x` | `undefined` (the key is literally `"assignee[]"`) | `[undefined]` → non-string, non-number | `undefined` | `validateBoardSearch` returns a **fresh** object, so the stray `assignee[]` key is dropped from the validated search entirely. |
| `?assignee=true` | `true` (boolean) | non-string, non-number → skipped | `undefined` | No coercion of booleans; `null` result. |
| `?assignee=null` | `null` | `Array.isArray(null)` false → `[null]` → skipped | `undefined` | Same. |
| `?assignee={"a":1}` (encoded) | `{ a: 1 }` (object) | not an array → `[obj]` → skipped | `undefined` | Objects never enter the value path. |
| `?assignee=123` | `123` (number) | number branch → `["123"]` | `"123"` | Numeric-only ids survive; on the write side `JSON.parse("123")` succeeds so TanStack emits `%22123%22`, which parses back to the string `"123"`. Round-trips. |
| `?assignee=["u1","u2"]` (encoded) | `["u1","u2"]` | array branch | `"u1,u2"` | Forward-compatible with any JSON-encoded link. |
| `?assignee=u1&assignee=u2` | `"u2"` or `["u1","u2"]` depending on parser behavior | both branches handled | `"u2"` or `"u1,u2"` | Handled either way — this is why the array branch exists. |
| `?assignee=u1,u1,u1` | `"u1,u1,u1"` | `Set` dedups | `"u1"` | Duplicate ids cannot reach the chip row. |
| `?assignee=<200 KB of "a,">` | huge string | `text.length > MAX_RAW_LENGTH` → whole entry skipped | `undefined` | Length is checked **before** `split`, so no large allocation. |
| `?assignee=<130-char id>` | that string | per-value length cap → skipped | `undefined` | Bounded per value. |
| `?assignee=u1,<130-char>,u2` | that string | long segment skipped, others kept | `"u1,u2"` | Per-segment, not all-or-nothing. |
| `?assignee=<60 ids>` | that string | `MAX_FILTER_VALUES` cap → first 50 | first 50, sorted | Bounded, still renders. |
| `?assignee=ghost-user` (unknown id) | `"ghost-user"` | `["ghost-user"]` | `"ghost-user"` | **Not dropped.** `validateSearch` runs before the workspace member list is loaded and cannot know membership. The filter matches zero tasks; the chip renders with `common:people.unknown` (FR-2). For an unknown **label** id, no chip renders at all (FR-3) because it belongs to no label group. Board renders either way. |

That last row is the important nuance for AC-5: "unknown values are dropped" is enforced at the
**presentation** layer (chip row) and is *inert* at the filter layer, not enforced in
`validateSearch`. `validateSearch` drops values that are structurally invalid; it cannot drop
values that are merely stale.

---

## 3. Hook API

### 3.1 New signature

```ts
import type { BoardFilters } from "./use-task-filters"; // unchanged import (E-7)

export type ControlledBoardFilters = Pick<BoardFilters, "assignee" | "labels">;

export type UseTaskFiltersOptions = {
  /**
   * When present, `assignee` and `labels` are owned by the caller. Presence of the OBJECT is the
   * controlled switch — not presence of its values, because `{ assignee: null }` legitimately
   * means "the caller says: no assignee filter".
   * Must be referentially stable across renders (memoize it) or `filteredProject` de-memoizes.
   */
  controlled?: ControlledBoardFilters;
  /** Called with the full next value of BOTH controlled keys whenever either changes. */
  onControlledChange?: (next: ControlledBoardFilters) => void;
};

export function useTaskFiltersWithLabelsSupport(
  project: ProjectWithTasks | null | undefined,
  projectId?: string,
  textQuery?: string,
  options?: UseTaskFiltersOptions,
): {
  filters: BoardFilters;
  setFilters: (next: BoardFilters | ((prev: BoardFilters) => BoardFilters)) => void;
  updateFilter: (
    key: keyof BoardFilters,
    value: BoardFilters[keyof BoardFilters],
  ) => void;
  updateLabelFilter: (labelId: string) => void;
  filteredProject: ProjectWithTasks | null;
  hasActiveFilters: boolean;
  clearFilters: () => void;
};
```

**Backward compatibility (FR-11).** The 4th parameter is optional and the return-object keys are
unchanged. `useTaskFiltersWithLabelsSupport(project, "project-1")` and
`useTaskFiltersWithLabelsSupport(project, "project-1", textQuery)` behave exactly as today. The
existing test file is **not edited** — only appended to.

`setFilters`'s type widens from React's `Dispatch<SetStateAction<BoardFilters>>` to the union above.
It has zero consumers (`board.tsx` does not destructure it; `board-toolbar.tsx` does not receive
it), so this is a safe widening. It stays in the return so nothing that might exist off-tree breaks.

### 3.2 Two new module-level exports (used by the route's storage seed)

```ts
export function boardFiltersStorageKey(projectId: string): string {
  return `kaneo:board-filters:${projectId}`;
}

/** Total: never throws, never returns a partial object. */
export function readStoredBoardFilters(projectId: string): BoardFilters {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const stored = window.localStorage.getItem(boardFiltersStorageKey(projectId));
    if (!stored) return DEFAULT_FILTERS;
    return normalizeFilters(JSON.parse(stored) as unknown);
  } catch {
    return DEFAULT_FILTERS;
  }
}
```

The storage key string is byte-identical to today's (`kaneo:board-filters:${projectId}`), so the
existing test's `storageKey` constant and every user's stored data keep working.

### 3.3 First render is already filtered (FR-9 / NFR-1 / AC-3)

```ts
const [internalFilters, setInternalFilters] = useState<BoardFilters>(DEFAULT_FILTERS);

const controlled = options?.controlled;
const onControlledChange = options?.onControlledChange;

// Render-phase, not an effect. This is the whole of FR-9.
const filters = useMemo<BoardFilters>(
  () =>
    controlled
      ? {
          ...internalFilters,
          assignee: controlled.assignee,
          labels: controlled.labels,
        }
      : internalFilters,
  [internalFilters, controlled],
);
```

`filters` (the value returned as `filters`, and the value `filterTasks` closes over) is derived
**during the first render pass** from the `controlled` argument, which `board.tsx` derives during
*its* first render pass from `Route.useSearch()`. `Route.useSearch()` returns the validated search
of the already-matched route — TanStack Router runs `validateSearch` before the route component
renders. So the chain

```
URL string → validateBoardSearch (pre-render) → Route.useSearch() (render) →
parseFilterList (render, memo) → controlled (render, memo) → filters (render, memo) →
filterTasks (render, memo) → filteredProject (render, memo) → <KanbanBoard/>
```

is entirely render-phase. There is **no `useEffect` anywhere on that path**, so the first committed
DOM already reflects the URL's filters. No flash is structurally possible, not merely unlikely.
§8 AC-3 gives the assertion that pins this.

Note the deliberate absence of any render-phase ref write (a tempting way to give event handlers
"the latest filters"). React Compiler runs in the production build and treats render-phase mutation
as a bail-out/UB hazard; §3.4 avoids the need for one entirely by keeping the mutators as plain
non-memoized closures, exactly as they are today.

### 3.4 The single writer per key (NFR-2)

All four mutators funnel through one private helper:

```ts
// NOT wrapped in useCallback: it closes over `filters` from the current render, exactly like
// today's plain-function mutators. See the INVARIANT note below.
const commit = (updater: (previous: BoardFilters) => BoardFilters) => {
  if (!controlled) {
    setInternalFilters(updater);
    return;
  }

  const next = updater(filters);

  // Uncontrolled keys keep living in React state (and therefore in localStorage).
  setInternalFilters((previous) => ({
    ...previous,
    status: next.status,
    priority: next.priority,
    dueDate: next.dueDate,
  }));

  // Controlled keys are handed to the owner. This is the ONLY write path for them.
  if (
    !sameIdList(next.assignee, filters.assignee) ||
    !sameIdList(next.labels, filters.labels)
  ) {
    onControlledChange?.({ assignee: next.assignee, labels: next.labels });
  }
};

function sameIdList(a: string[] | null, b: string[] | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}
```

```ts
const setFilters = (next: BoardFilters | ((prev: BoardFilters) => BoardFilters)) =>
  commit(typeof next === "function" ? next : () => next);

const clearFilters = () => commit(() => DEFAULT_FILTERS);

const updateFilter = (
  key: keyof BoardFilters,
  value: BoardFilters[keyof BoardFilters],
) => commit((previous) => ({ ...previous, [key]: value }));

const updateLabelFilter = (labelId: string) =>
  commit((previous) => {
    const current = previous.labels ?? [];
    const isSelected = current.includes(labelId);
    const nextLabels = isSelected
      ? current.filter((id) => id !== labelId)
      : [...current, labelId];
    return { ...previous, labels: nextLabels.length > 0 ? nextLabels : null };
  });
```

**Writers, stated plainly:**

| Key | Single writer | Storage role |
|---|---|---|
| `assignee` | `navigate()` in `board.tsx`, reached only via `onControlledChange`. Plus the one-shot seed of §4. | mirror only, never read after first mount |
| `labels` | same | same |
| `status`, `priority`, `dueDate` | `setInternalFilters` inside the hook | authoritative store |

Nothing else writes `assignee`/`labels`. In particular the localStorage **hydrate** effect still
writes them into `internalFilters` — and those writes are provably inert, because `filters` (§3.3)
unconditionally overrides both keys from `controlled` when controlled. `internalFilters.assignee`
and `internalFilters.labels` are dead fields in controlled mode: written, never read.

> **INVARIANT (must be a code comment in the hook).** *At most one `commit` per event handler.*
> In controlled mode `commit` reads `filters` from the current render's closure, so N sequential
> calls in one handler all see the same pre-change value and only the last one's `navigate` wins.
> Today's `board-toolbar.tsx` violates this twice (`toggleLabelGroup` and `clearLabelFilters` loop
> over `updateLabelFilter`); §5.5 rewrites both into single-commit form. This is R-9, and it is a
> real bug that this plan found while reading the code, not a hypothetical.

### 3.5 Exactly what changes in the two existing effects (E-2)

**Effect 1 — hydrate (lines 52-67). Body simplified, semantics identical, controlled-safe by
construction.**

```ts
// before                                   // after
useEffect(() => {                           useEffect(() => {
  if (!storageKey || ...) return;             if (!projectId || typeof window === "undefined") return;
  try {                                       setInternalFilters(readStoredBoardFilters(projectId));
    const stored = localStorage.getItem(...); }, [projectId]);
    if (!stored) { setFilters(DEFAULT); return; }
    setFilters(normalizeFilters(JSON.parse(stored)));
  } catch { setFilters(DEFAULT); }
}, [storageKey]);
```

Equivalence argument: `readStoredBoardFilters` returns the **module-constant** `DEFAULT_FILTERS`
reference on the no-storage / parse-error / `JSON.parse("null")` paths (because
`normalizeFilters(null)` returns `DEFAULT_FILTERS` itself, line 26), so the `setState` bail-out on
identical reference that today's code relies on is preserved and the render count does not change.
`storageKey` was `projectId ? key : null`, so `[storageKey]` and `[projectId]` fire identically.
**No guard against controlled mode is added here on purpose** — a guard would be dead code, and
adding one would imply the hydrate could clobber, which it structurally cannot (§3.4).

**Effect 2 — mirror (lines 69-72). One word changes, and it is the word that resolves DR-13.**

```ts
useEffect(() => {
  if (!storageKey || typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(filters)); // was: internal state
}, [filters, storageKey]);
```

`filters` here is the §3.3 `useMemo` — the *effective* filters. Consequences:

- **Uncontrolled:** `filters === internalFilters`, so this is byte-identical to today. FR-11 holds.
- **Controlled:** storage mirrors what is actually applied, which is the URL. This is what makes
  reload-persistence work after **back/forward** — a history pop changes the URL without any
  `commit` call, and the mirror still tracks it, so storage never goes stale.
- It **cannot clobber the URL**: this effect calls `localStorage.setItem` and nothing else. It never
  calls `setState` and never calls `navigate`.

An earlier draft of this design used a third effect to sync `controlled` → `internalFilters` so the
mirror could keep reading internal state. That effect is **not** in the plan: mirroring
`effectiveFilters` directly removes the need for it, removes a `setState`-inside-effect, removes a
render, and removes the only place a loop could have formed. Do not reintroduce it.

### 3.6 No loop is possible (NFR-3, R-1)

Enumerate every writer in the cycle and its trigger:

| Writer | Triggered by | Writes | Can it re-trigger itself? |
|---|---|---|---|
| hydrate effect | `[projectId]` change | `internalFilters` | No — `projectId` is a route param, unaffected by filters. |
| mirror effect | `[filters, storageKey]` change | `localStorage` only | No — localStorage is read only by the hydrate effect (deps: `projectId`) and the seed effect (one-shot). Neither is deps-connected to `filters`. |
| `commit` | user event only | `internalFilters` + `onControlledChange` | No — not an effect; nothing re-invokes it. |
| `onControlledChange` → `navigate` | `commit` only | URL | `navigate` → `search` changes → `controlled` changes → `filters` changes → mirror effect writes storage → **terminates**. |
| seed effect (§4) | mount | URL, once | `seededRef` short-circuits every subsequent run. |

The search→state→navigate cycle is one-way and finite: search changes cause *render* work only; the
only thing that causes a `navigate` is a user event or the one-shot seed. Idempotence also holds at
the value level: `commit` compares with `sameIdList` and skips `onControlledChange` when neither
controlled key actually changed, so a redundant toggle produces no navigation at all.

### 3.7 Untouched (FR-12, NFR-4)

`filterTasks` keeps its body verbatim — text/identifier matching, `weekStartsOn` due-date windows,
label-id membership. Only its `useCallback` dep list reads `filters` (the memo) instead of the raw
state. `filteredProject` keeps its `useMemo(…, [project, filterTasks])`. `hasActiveFilters` keeps
its expression, now over `filters`. **De-memoization guard:** `controlled` must be referentially
stable — `board.tsx` memoizes it on the two primitive search strings (§4.1). If a future caller
passes an object literal, `filters` → `filterTasks` → `filteredProject` all invalidate every render
and NFR-4 breaks silently. This is stated in the `UseTaskFiltersOptions` doc comment above.

---

## 4. First-mount storage seed (OQ-1 / DR-13(b))

### 4.1 Where it lives and the exact guard

In `board.tsx`, immediately after the search derivations:

```ts
const search = Route.useSearch();
const taskId = search.taskId;

const assigneeFilter = useMemo(
  () => parseFilterList(search.assignee),
  [search.assignee],
);
const labelsFilter = useMemo(
  () => parseFilterList(search.labels),
  [search.labels],
);
const controlledFilters = useMemo(
  () => ({ assignee: assigneeFilter, labels: labelsFilter }),
  [assigneeFilter, labelsFilter],
);

const didSeedFromStorageRef = useRef(false);

// First mount only: if the URL carries neither filter param, adopt whatever the previous session
// left in localStorage. `replace` so no history entry is created for something the user did not do.
useEffect(() => {
  if (didSeedFromStorageRef.current) return;
  didSeedFromStorageRef.current = true;

  if (search.assignee !== undefined || search.labels !== undefined) return;

  const stored = readStoredBoardFilters(projectId);
  const assignee = serializeFilterList(stored.assignee);
  const labels = serializeFilterList(stored.labels);
  if (!assignee && !labels) return;

  navigate({
    to: ".",
    search: (previous) => ({ ...previous, assignee, labels }),
    replace: true,
  });
}, [navigate, projectId, search.assignee, search.labels]);
```

Guard, clause by clause:

- **`didSeedFromStorageRef`** — the ref is set *before* any other check, so the effect body is a
  true one-shot per mounted route component regardless of how many times React re-runs it. Under
  React 19 StrictMode (`main.tsx` wraps the app in `<StrictMode>`), effects mount → clean up →
  mount again **on the same fiber**, so the ref survives and the second invocation returns
  immediately. Exactly one seed.
- **`search.assignee !== undefined || search.labels !== undefined`** — the values compared are the
  *validated* ones. If the URL carries a usable value for **either** key, the seed is skipped
  **entirely**, including for the other key. That is the literal reading of the brief's "must not
  clobber a URL that does [carry params]": a link that shares only an assignee filter must not
  silently acquire the recipient's stored label filters.
- **`?assignee=` (empty) counts as "URL carries nothing"**, because it validates to `undefined`.
  A genuinely cleared filter omits the param entirely, so this only arises from hand-editing, where
  seeding is harmless.
- **`if (!assignee && !labels) return;`** — the "user cleared all filters, storage holds nulls"
  path. `clearFilters()` sets `internalFilters` to `DEFAULT_FILTERS` and navigates both params away;
  the §3.5 mirror then writes `{status:null, priority:null, assignee:null, dueDate:null, labels:null}`
  to storage. On the next cold load with a bare URL, `serializeFilterList(null)` is `undefined` for
  both, this clause fires, **no navigate happens**, and the board renders unfiltered. Cleared stays
  cleared. Without this clause the effect would navigate to a search object identical to the current
  one, which TanStack would treat as a real navigation.

### 4.2 Why `replace: true`

FR-18 requires that non-user-initiated writes create no history entry. The seed is triggered by
mounting, not by an action. With `replace`, pressing Back from the seeded board goes to whatever
page the user came from, not to the same board minus filters — which would be an infinite-feeling
trap, since re-mounting would seed again. This is the one place `replace` is mandatory; a genuine
filter change (§5.7) deliberately omits it.

### 4.3 Why it cannot fight the URL

The effect writes the URL exactly once, only when the URL had nothing to say, and it reads its input
from `localStorage` — a source that no other code path in this change writes *before* the first
commit. Its own navigation changes `search.assignee`, which re-runs the effect, which returns at the
ref guard. And because it runs in an effect (post-commit) rather than during render, the first
committed paint of a bare URL is an unfiltered board that then becomes filtered — which is
**correct**: AC-3's "no flash" contract applies to *"loading a board URL carrying `assignee` and/or
`labels` params"*, which is precisely the case this effect skips.

---

## 5. Chip row component

### 5.1 File and placement (OQ-4)

`apps/web/src/components/board/board-filter-chips.tsx`, rendered **inline in the existing toolbar
row**, in the exact position the chips occupy today: inside
`<div className="flex flex-wrap items-center gap-1.5">`, immediately after `<SortControl />`. No
second row, no new wrapper element, no layout shift.

The component returns a **Fragment** of chips (not a wrapping `<div>`) so the parent's
`flex-wrap gap-1.5` keeps laying the chips out exactly as it does today, and so the FR-7 empty case
is a literal `return null` with zero DOM footprint.

### 5.2 Props

```ts
import type { BoardFilters } from "@/hooks/use-task-filters";
import type { ProjectWithTasks } from "@/types/project";

type WorkspaceLabel = { id: string; name: string; color: string };

type ActiveUsers = {
  members?: Array<{
    userId: string;
    user?: { image?: string | null; name?: string | null } | null;
  }>;
};

type BoardFilterChipsProps = {
  project?: ProjectWithTasks | null;
  filters: BoardFilters;
  updateFilter: (
    key: keyof BoardFilters,
    value: BoardFilters[keyof BoardFilters],
  ) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  users?: ActiveUsers;
  workspaceLabels: WorkspaceLabel[];
};

export default function BoardFilterChips(props: BoardFilterChipsProps): ReactNode;
```

Note the absence of `updateLabelFilter`: the chip row removes a whole label **group** in one
commit and must therefore use `updateFilter("labels", next)` (the §3.4 invariant). See §5.5.

`WorkspaceLabel` and `ActiveUsers` are declared **privately here as well as in
`board-toolbar.tsx`** — 11 duplicated lines of structurally identical type aliases. This is
deliberate: extracting them into a shared module or re-exporting one from the other would add churn
to `board-toolbar.tsx`'s type block for no runtime benefit, TypeScript's structural typing makes the
prop pass-through compile as-is, and deduplication is an explicit non-goal of this run.

### 5.3 Render rules, all five subjects

`ActiveFilterChip` (the `[subject | operator | value | X]` shell) is used for **every** chip so the
row keeps one visual grammar. Chips render in this order:

| # | Subject | Cardinality | Subject key | Operator key | Value | Remove action |
|---|---|---|---|---|---|---|
| 1 | status | **one aggregate chip** (unchanged) | `tasks:boardFilters.subjects.status` | `tasks:boardFilters.operators.isAnyOf` | `StackedIcons` of column icons + column name or `{{count}} selected` | `updateFilter("status", null)` |
| 2 | priority | **one aggregate chip** (unchanged) | `…subjects.priority` | `…operators.isAnyOf` | `StackedIcons` of priority icons + label or count | `updateFilter("priority", null)` |
| 3 | dueDate | **one aggregate chip** (unchanged) | `…subjects.dueDate` | `…operators.isAnyOf` | `tasks:backlog.filters.*` label or count | `updateFilter("dueDate", null)` |
| 4 | assignee | **one chip per selected `userId`** | `…subjects.assignee` | `…operators.is` *(new key)* | 16px `<Avatar>` + display name, or `common:people.unknown` when the id resolves to no member | remove just that id |
| 5 | labels | **one chip per selected label group** | `…subjects.labels` | `…operators.includes` *(new key)* | color dot (`labelColors.find(c => c.value === group.color)?.color`, fallback `var(--color-neutral-400)`) + group name | remove every id in that group |
| 6 | — | **clear all**, when `hasActiveFilters` | — | — | `common:actions.clearAllFilters` | `clearFilters()` |

Rows 1-3 are lifted verbatim from `board-toolbar.tsx:533-632` — same JSX, same class strings, same
`t()` keys, same `StackedIcons` usage. That is what makes R-4 tractable: the untouched subjects are
a *move*, not a rewrite, and §8's chip test covers all five subjects, not just the two that change.

Rows 4-5 replace `board-toolbar.tsx:584-607` and `634-643`. `StackedIcons` survives only because
rows 1-3 still use it.

React keys: assignee chips key on `userId`; label chips key on the **group key** (§5.4), never on
`label.id` — a group holds several ids and keying on one of them would produce an unstable key when
the workspace's label rows change (R-12). Both are collision-free because §2.3 dedups on read.

### 5.4 Label group ⇄ URL id list (OQ-3)

A "label" as the user sees it is a `(name, color)` pair; the database has one row per
project/workspace instance, so one visible label maps to N ids (E-8). The dropdown already works
this way (`toggleLabelGroup` / `isLabelGroupSelected`); the chips must match or the two controls
disagree.

```ts
type LabelGroup = { key: string; name: string; color: string; ids: string[] };

// U+0000 separator: cannot appear in a label name, so no key collision between
// ("a b", "c") and ("a", "b c").
const groupKey = (name: string, color: string) => `${name} ${color}`;

function buildLabelGroups(workspaceLabels: WorkspaceLabel[]): LabelGroup[] {
  const byKey = new Map<string, LabelGroup>();
  for (const label of workspaceLabels) {
    const key = groupKey(label.name, label.color);
    const existing = byKey.get(key);
    if (existing) existing.ids.push(label.id);
    else byKey.set(key, { key, name: label.name, color: label.color, ids: [label.id] });
  }
  return Array.from(byKey.values());
}
```

- **id list → chips.** `selected = new Set(filters.labels ?? [])`; render one chip for each group
  where `group.ids.some(id => selected.has(id))`. A selected id belonging to **no** group (the
  label was deleted, or the URL is stale) contributes no chip and throws nothing (FR-3). It stays
  in the URL and in `filters.labels`, where it is inert — it simply matches no task.
- **chip → id list (remove).** Remove **all** of the group's ids:
  ```ts
  const removeLabelGroup = (group: LabelGroup) => {
    const current = filters.labels ?? [];
    const next = current.filter((id) => !group.ids.includes(id));
    updateFilter("labels", next.length > 0 ? next : null);
  };
  ```
  Exactly one `commit`, so exactly one `navigate` (§3.4 invariant).
- **Round-trip.** `buildLabelGroups` iterates `workspaceLabels` in server order, so group order is
  stable within a session; the URL's own order is sorted (§2.3). Chip order follows group order —
  deterministic, and independent of selection order.

### 5.5 Remove-one semantics (FR-4)

Assignee:

```ts
const removeAssignee = (userId: string) => {
  const current = filters.assignee ?? [];
  const next = current.filter((id) => id !== userId);
  updateFilter("assignee", next.length > 0 ? next : null);
};
```

`next.length > 0 ? next : null` in both removers is the FR-4 requirement: the last value of a
subject clears the subject to **`null`, never `[]`**. This matters three levels down —
`serializeFilterList([])` returns `undefined`, TanStack deletes the key, and the URL comes back to
`?` with no `assignee` at all rather than `?assignee=`. Round-trip is exact (FR-16).

Every other active filter is untouched because `commit`'s updater spreads `previous` and replaces
one key.

### 5.6 What happens to `ActiveFilterChip` and `StackedIcons`

**Moved, not shared, not duplicated.** Both are file-private in `board-toolbar.tsx` today and both
are used *only* by the chip block. After extraction `board-toolbar.tsx` renders no chip, so it has
no use for either — they move wholesale into `board-filter-chips.tsx` and stay file-private there.
No shared module, no barrel, no export surface. The dependency direction (toolbar → chips) already
exists via the `<BoardFilterChips />` import, so nothing circular is introduced.

**Exhaustive orphan list for `board-toolbar.tsx` — every one of these is a `tsc` error under
`noUnusedLocals` if left behind:**

| Symbol | Lines today | Action | Why |
|---|---|---|---|
| `ActiveFilterChipProps` | 78-83 | delete | moves to the chip file |
| `ActiveFilterChip` | 85-108 | delete | moves |
| `StackedIcons` | 110-131 | delete | moves |
| `getStatusDisplayName` | 153-156 | delete | only consumer was the status chip (line 548) |
| `getAssigneeDisplayName` | 165-168 | delete | only consumer was the assignee chip (line 598) |
| `getAssigneeAvatar` | 169-182 | delete | only consumer was the assignee chip (line 593) |
| `X` (lucide import) | 1 | remove from the import list | only used inside `ActiveFilterChip` |
| `import type { ReactNode } from "react"` | 2 | **delete the whole import** | `ReactNode` appears only at lines 81 and 114, both in moved code |

**Explicitly retained in `board-toolbar.tsx`** (still used by the dropdown — do not delete):
`CheckSlot`, `getStatusIcon` (line 312), `getPriorityDisplayName` (line 357), `getPriorityIcon`
(line 354), `Avatar`/`AvatarImage`/`AvatarFallback` (400-408), `getInitials` (406), `labelColors`
(497), `uniqueLabels` (184-193), `isLabelGroupSelected` (195-199), `DUE_DATE_FILTER_VALUES`
(438-440), `Filter`/`PanelsTopLeft`/`Rows3` icons, `hasActiveFilters` (517), `clearFilters` (521).

`getStatusIcon`, `getPriorityIcon`/`getPriorityDisplayName` and the avatar/`getInitials` pattern are
now needed in **both** files. The chip component re-derives its own three-line lookups locally
rather than importing them from the toolbar; ~15 lines of trivial `find()` lookups are duplicated.
Accepted for the same reason as §5.2: it keeps the toolbar diff to deletions plus one JSX line.

### 5.7 Two behavior fixes forced into `board-toolbar.tsx` (R-9)

Both of these are correct today and **silently broken** the moment `assignee`/`labels` live in the
URL, because they issue N sequential `updateLabelFilter` calls that each read the same pre-change
`filters` and each fire a separate `navigate` — last write wins, so only one id changes and N-1
history entries are created. They must be rewritten to single-commit form **in the same packet**
that introduces the controlled hook path.

```ts
// before: for (const l of matching) updateLabelFilter(l.id);
const toggleLabelGroup = (label: { name: string; color: string }) => {
  const matchingIds = workspaceLabels
    .filter((l) => l.name === label.name && l.color === label.color)
    .map((l) => l.id);
  const current = filters.labels ?? [];
  const anySelected = matchingIds.some((id) => current.includes(id));
  const next = anySelected
    ? current.filter((id) => !matchingIds.includes(id))
    : [...current, ...matchingIds.filter((id) => !current.includes(id))];
  updateFilter("labels", next.length > 0 ? next : null);
};

// before: for (const labelId of filters.labels) updateLabelFilter(labelId);
const clearLabelFilters = () => {
  if (!filters.labels || filters.labels.length === 0) return;
  updateFilter("labels", null);
};
```

Both are end-state-equivalent to today's loops, so the dropdown's observable behavior is unchanged.
After this rewrite `updateLabelFilter` has no consumer in the UI: **remove it from
`BoardToolbarProps` and stop passing it from `board.tsx`.** It stays exported from the hook (FR-11).
Because TypeScript excess-property-checks JSX props, `board-toolbar.tsx` and `board.tsx` must land
in the **same packet** or `tsc` fails in between (§9).

### 5.8 Accessibility (FR-8)

- Every remove control and the clear-all control is a real `<button type="button">` — reachable by
  Tab, activated by Enter/Space, no `onClick` on a `<div>`. `ActiveFilterChip`'s existing button
  markup already satisfies this and is reused unchanged.
- Each remove button carries `aria-label={t("tasks:boardFilters.removeFilter", { subject, value })}`,
  where `subject` is the already-translated subject string and `value` is the resolved display name
  (member name / label name / status name / priority label / due-date label) — never a raw id, and
  never an email (NFR-10). Aggregate chips pass the same key with the aggregate value string.
- The clear-all control renders visible text `t("common:actions.clearAllFilters")`, so it needs no
  `aria-label`.
- The `<X>` icons stay `aria-hidden` by virtue of being inline SVG with no accessible text; the
  button's `aria-label` is the accessible name.
- FR-7: `if (!hasActiveFilters) return null;` — no empty row, nothing focusable, no layout shift.

---

## 6. `handleCloseTaskSheet` — the sharpest regression risk (FR-19 / R-2)

Today (`board.tsx:96-102`):

```ts
const handleCloseTaskSheet = useCallback(() => {
  navigate({
    to: ".",
    search: {},          // ← correct today; destroys every filter the moment filters live here
    replace: true,
  });
}, [navigate]);
```

`search: {}` means *"the new search is the empty object"*, not *"merge nothing"*. Today the only
search param is `taskId`, so wiping everything is indistinguishable from clearing `taskId`. The
instant `assignee`/`labels` join the search object, closing the task details sheet silently throws
the user's filters away — a full board re-render from filtered to unfiltered, with no undo and no
visible cause. It fails AC-6 and it is the single easiest thing in this ticket to miss, because
nothing about the line looks wrong.

**Replacement:**

```ts
const handleCloseTaskSheet = useCallback(() => {
  navigate({
    to: ".",
    search: (previous) => clearTaskId(previous),
    replace: true,
  });
}, [navigate]);
```

- The functional form receives the current validated search and returns it minus `taskId`.
- `clearTaskId` lives in `board-search-params.ts` (§2.2) so it is unit-testable without rendering
  the route — the whole reason that module exists.
- `replace: true` is **kept**: closing a sheet should not add a history entry. Only genuine filter
  changes push (§7 of the URL contract / FR-18).
- The arrow wrapper `(previous) => clearTaskId(previous)` rather than bare `search: clearTaskId` is
  intentional: it keeps TanStack's inferred `prev`/return types flexible if `to: "."` widens them.

**Pinned by** `board-search-params.test.ts` → `"clearTaskId drops only taskId and preserves the
filter params"`, and again end-to-end by the router test
`"closing the task sheet keeps assignee and labels in the URL"`, which navigates to
`/board?taskId=t1&assignee=u1,u2&labels=l1`, invokes the same payload builder, and asserts the
resulting `href` still contains `assignee=u1,u2` and `labels=l1` and no longer contains `taskId`.
Two independent tests, because this is the regression most likely to ship unnoticed.

---

## 7. i18n keys

Source of truth is repo-root **`i18n/en-US.json`** (the `tasks.boardFilters` block currently spans
lines 1833-1852). Only that file is written (FR-23); the 16 other locales fall back to en-US at
runtime (E-11) and are a documented follow-up, as is the stale generated `i18n/schema.json`.

| Dotted path | English value | Status | Consumed by |
|---|---|---|---|
| `tasks.boardFilters.removeFilter` | `Remove {{subject}} filter: {{value}}` | **NEW** | `aria-label` on every chip's remove button, all five subjects (`board-filter-chips.tsx`) |
| `tasks.boardFilters.operators.is` | `is` | **NEW** | per-value **assignee** chip operator segment |
| `tasks.boardFilters.operators.includes` | `includes` | **NEW** | per-value **label** chip operator segment |
| `common.actions.clearAllFilters` | `Clear all filters` | reused | visible text of the chip row's clear-all button |
| `common.people.unknown` | `Unknown` | reused | assignee chip whose id resolves to no workspace member (FR-2) |
| `tasks.boardFilters.subjects.status` | `Status` | reused | status chip subject |
| `tasks.boardFilters.subjects.priority` | `Priority` | reused | priority chip subject |
| `tasks.boardFilters.subjects.assignee` | `Assignee` | reused | assignee chip subject + `removeFilter` `{{subject}}` |
| `tasks.boardFilters.subjects.dueDate` | `Due date` | reused | due-date chip subject |
| `tasks.boardFilters.subjects.labels` | `Labels` | reused | label chip subject + `removeFilter` `{{subject}}` |
| `tasks.boardFilters.operators.isAnyOf` | `is any of` | reused | status / priority / dueDate aggregate chips |
| `tasks.boardFilters.selectedCount` | `{{count}} selected` | reused | aggregate chips with >1 value |
| `tasks.backlog.filters.dueThisWeek` / `dueNextWeek` / `noDueDate` | existing | reused | due-date chip value |

**Three new keys, and only three.** `operators.includeAnyOf` is *not* removed — the dropdown does
not use it, but leaving it costs nothing and removing a key from a shared locale file is a wider
blast radius than this run wants. No add-filter affordance is introduced (OQ-4 keeps the existing
Filter dropdown as the only add path), so FR-22's conditional second key is not needed.

Why `operators.is` / `operators.includes` rather than reusing `isAnyOf`: a per-value chip carries
exactly one value, and "Assignee is any of Alice" is wrong English for a one-element set. Two
three-character values are cheaper than shipping bad copy.

Insert the two operator values into the existing `tasks.boardFilters.operators` object and
`removeFilter` as a sibling of `selectedCount`, preserving the file's **tab** indentation.

---

## 8. Test plan

### 8.1 Conventions

- **Router unit strategy — decided: both, at different seams.** `validateSearch` and the navigate
  payload builders are tested as **pure functions** (`board-search-params.test.ts`) because that is
  where the malformed-input matrix belongs and it needs no DOM. Separately, a **real
  `createRouter` + `createMemoryHistory` + `RouterProvider`** test
  (`board-search-params.router.test.tsx`) mounts a *synthetic* route that uses the **production**
  `validateBoardSearch` and `applyFilterSearch` on a trivial probe component. It does **not** mount
  the real board route: `board.tsx` drags in `ProjectLayout`, `KanbanBoard`, dnd-kit, TanStack
  Query, three zustand stores and i18n, and mocking that surface would produce a slow, brittle test
  that proves less than the synthetic route does. The synthetic route exercises the exact two things
  a full render could not prove any better: that TanStack's default stringifier emits
  `assignee=u1,u2` (not JSON), and that `history.back()` restores the prior filter state.
- **i18n stub** (repo convention, `components/list-view/task-row.test.tsx:67`), extended to keep
  interpolated names distinguishable:
  ```ts
  vi.mock("react-i18next", () => ({
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) =>
        options ? [key, ...Object.values(options)].join(" ") : key,
    }),
    initReactI18next: { type: "3rdParty", init: vi.fn() },
  }));
  ```
  With `t(key) === key`, every remove button would otherwise share the accessible name
  `tasks:boardFilters.removeFilter` and be untargetable.
- **`getPriorityLabel` must be mocked** in the chip test: `@/lib/i18n/domain` calls the *global*
  `i18next` instance directly (`i18n.t`), not `useTranslation`, so the `react-i18next` stub does not
  cover it and the instance is uninitialized under Vitest.
  ```ts
  vi.mock("@/lib/i18n/domain", () => ({ getPriorityLabel: (priority: string) => priority }));
  ```
- Tests live under `apps/web/src/**` to match `vitest.config.ts`'s
  `include: ["src/**/*.test.{ts,tsx}"]`.

### 8.2 Acceptance criteria → tests

| AC | File | Test name | Assertion that proves it |
|---|---|---|---|
| **AC-1** chip row, per-value, removable, clear-all | `board-filter-chips.test.tsx` | `"renders one chip per assignee and one chip per label group"` | Fixture: 2 members, 3 label rows forming 2 groups (`bug` ×2 ids, `docs` ×1), `filters = { assignee: ["u1","u2"], labels: ["l-bug-a","l-docs"] }`. Assert `screen.getAllByRole("button", { name: /removeFilter/ })` has length 4 and that the four accessible names contain `Alice`, `Bob`, `bug`, `docs`. |
| | same | `"renders status, priority and dueDate as single aggregate chips"` | With all five subjects active, assert exactly **one** button whose name contains `subjects.status`, one for `priority`, one for `dueDate` — proving R-4 did not decompose the untouched subjects. |
| | same | `"renders a clear all control only when a filter is active"` | `getByText("common:actions.clearAllFilters")` present with filters; `queryByText(...)` null when `hasActiveFilters` is false. |
| | same | `"removing the last value of a subject clears it to null"` | `updateFilter = vi.fn()`; `filters.assignee = ["u1"]`; click its remove button; `expect(updateFilter).toHaveBeenCalledWith("assignee", null)` — **`null`, not `[]`** (FR-4). |
| | same | `"removing one of several assignees keeps the others"` | `filters.assignee = ["u1","u2"]`; remove `u1`; `toHaveBeenCalledWith("assignee", ["u2"])`; also assert `updateFilter` was called **once** (§3.4 invariant). |
| | same | `"removing a label chip removes every id in its group"` | `workspaceLabels` has `bug` under ids `l-bug-a`,`l-bug-b`; `filters.labels = ["l-bug-a","l-bug-b","l-docs"]`; remove the `bug` chip; `toHaveBeenCalledWith("labels", ["l-docs"])` (OQ-3). |
| | same | `"ignores selected label ids that resolve to no workspace label"` | `filters.labels = ["ghost"]`, `workspaceLabels = []`; renders without throwing; zero label chips. (FR-3) |
| | same | `"falls back to the unknown-person copy for an unresolvable assignee"` | `filters.assignee = ["ghost"]`, `users.members = []`; a chip renders whose text contains `common:people.unknown`. (FR-2) |
| | same | `"renders nothing when no filter is active"` | `const { container } = render(...)` with `DEFAULT_FILTERS`; `expect(container).toBeEmptyDOMElement()` (FR-7). |
| | same | `"every control is a focusable button element"` | For each `screen.getAllByRole("button")`: `expect(el.tagName).toBe("BUTTON")` and `expect(el).toHaveAttribute("type", "button")` (FR-8). |
| **AC-2** filter change updates the URL | `board-search-params.router.test.tsx` | `"a filter change writes comma-joined search params"` | Memory history at `/board`; probe button calls `navigate({ to: ".", search: (p) => applyFilterSearch(p, { assignee: ["u2","u1"], labels: null }) })`; assert `router.state.location.searchStr` contains **literal** `assignee=u1,u2` (sorted, comma-joined, unencoded) and contains no `%5B`. This is the OQ-2 proof and the R-8 canary. |
| | `board-filter-chips.test.tsx` | (the remove tests above) | prove the chip → `updateFilter` half; the hook test below proves `updateFilter` → `onControlledChange`. |
| | `use-task-filters-with-labels-support.test.tsx` | `"routes assignee and label changes through onControlledChange instead of internal state"` | `onControlledChange = vi.fn()`; call `result.current.updateFilter("assignee", ["u1"])` in `act`; assert `onControlledChange` called once with `{ assignee: ["u1"], labels: null }` **and** that `result.current.filters.assignee` is still the controlled prop's value (the hook did not self-apply — the owner must). |
| | same | `"keeps status, priority and dueDate in internal state while controlled"` | `updateFilter("status", ["todo"])` → `result.current.filters.status` becomes `["todo"]` immediately and `onControlledChange` is **not** called. Proves NFR-2's split. |
| **AC-3** first render already filtered, no flash, no storage clobber | `use-task-filters-with-labels-support.test.tsx` | `"applies controlled filters on the first committed render"` | **How "no flash" is asserted:** do not use `renderHook` (it hides render history). Use a probe that records every render: `function Probe({ controlled }) { const { filteredProject } = useTaskFiltersWithLabelsSupport(project, "project-1", undefined, { controlled }); renders.push(filteredProject?.columns[0]?.tasks.length ?? -1); return null; }`. Pre-seed `localStorage["kaneo:board-filters:project-1"]` with `{"assignee":["user-b"]}` (a *different* value). Render with `controlled = { assignee: ["user-a"], labels: null }`. Then: `expect(renders[0]).toBe(1)` — the very first render is already filtered; and `expect(renders.every(n => n === 1)).toBe(true)` — **no intermediate render ever showed the unfiltered count**, which is the operational meaning of "no flash". |
| | same | `"never lets stored values override controlled values"` | Same fixture; after `await waitFor(...)`, `expect(result.filters.assignee).toEqual(["user-a"])` and `expect(JSON.parse(localStorage.getItem(storageKey)).assignee).toEqual(["user-a"])` — storage was *overwritten by* the controlled value, not the reverse (FR-13, §3.5). |
| **AC-4** back/forward walks filter states | `board-search-params.router.test.tsx` | `"browser back restores the previous filter state"` | **What jsdom + TanStack Router can actually verify, and it is more than expected:** `createMemoryHistory` is a full history implementation with a real entry stack, and `RouterProvider` re-renders on pop. Test: start at `/board?assignee=u1`; assert probe shows `u1`; click the probe's filter button (navigate **without** `replace`) → assert URL and probe show `u2`; `act(() => router.history.back())`; `await waitFor(() => …)` → assert the probe shows `u1` again and `router.state.location.searchStr` contains `assignee=u1`. This proves both that a push entry was created and that a pop re-derives the filter from the URL. What it **cannot** verify is real Chrome `popstate`/bfcache behavior — noted as manual verification. |
| | `board-search-params.test.ts` | `"serialization is order-independent and round-trips exactly"` | `serializeFilterList(["u2","u1"]) === serializeFilterList(["u1","u2"]) === "u1,u2"`; and `serializeFilterList(parseFilterList("u1,u2,u3")!.filter(id => id !== "u3")) === "u1,u2"` — toggle on/off returns the identical string (FR-16), which is what makes a history entry stable and a copied link reproducible. |
| **AC-5** malformed params degrade safely | `board-search-params.test.ts` | `it.each([...])("validateBoardSearch(%s) yields %s without throwing")` | The full §2.4 table as the `it.each` table, asserting the exact validated output for each row. Wrap each case so a throw fails the test explicitly. |
| | same | `"drops values that exceed the length and count caps"` | 200 KB input → `undefined`; 60 ids → exactly 50, sorted. |
| | `board-search-params.router.test.tsx` | `"renders a board route with garbage search params"` | Memory history at `/board?assignee=&labels=,,&taskId=`; assert the probe mounts and `router.state.location` resolved — i.e. the board renders rather than throwing. |
| **AC-6** `taskId` keeps working with filters active | `board-search-params.test.ts` | `"applyFilterSearch preserves taskId"` | `applyFilterSearch({ taskId: "t1", assignee: "u9" }, { assignee: ["u1"], labels: null })` → `{ taskId: "t1", assignee: "u1", labels: undefined }` (FR-17). |
| | same | `"clearTaskId drops only taskId"` | `clearTaskId({ taskId: "t1", assignee: "u1,u2", labels: "l1" })` → `{ taskId: undefined, assignee: "u1,u2", labels: "l1" }` (FR-19). |
| | same | `"validateBoardSearch keeps taskId's current predicate"` | `taskId: 42` → `undefined`; `taskId: "t1"` → `"t1"`; `taskId: ""` → `""` (unchanged from today — deliberately *not* strengthened). |
| | `board-search-params.router.test.tsx` | `"closing the task sheet keeps assignee and labels in the URL"` | Start at `/board?taskId=t1&assignee=u1,u2&labels=l1`; probe invokes `navigate({ to: ".", search: (p) => clearTaskId(p), replace: true })`; assert `searchStr` contains `assignee=u1,u2` and `labels=l1` and **not** `taskId`. This is R-2's end-to-end pin. |
| **AC-7** realtime + dnd-kit still work | `use-task-filters-with-labels-support.test.tsx` | `"re-filters when the project prop changes while a controlled filter is active"` | This is the *testable* half of AC-7. `rerender` the probe with a project object containing one extra task assigned to the filtered user and one assigned to someone else; assert `filteredProject.columns[0].tasks` gained exactly the matching task. This pins the realtime contract precisely: the WebSocket path is `useGetTasks → setProject(zustand) → project prop → filteredProject`. |
| | — | **reasoned argument, no test** | The rest of AC-7 is argued, not tested, and this plan says so plainly. (a) *Realtime:* nothing in this change touches `useGetTasks`, the `useEffect` that calls `setProject`, `publishEvent`, the WebSocket subscription, or Redis fan-out. Filtering is strictly downstream of the project store and always was; `filteredProject`'s `useMemo` lists `project` as a dependency, so a store update recomputes it through the same predicate. The one new failure mode would be de-memoization, which §3.7/NFR-4 addresses. (b) *dnd-kit:* drag-and-drop operates on `sortedProject` — computed *after* `filteredProject` and unchanged by this plan — and `KanbanBoard`'s `disableDragDrop={sort.field !== "position"}` prop is untouched. Reordering mutates `task.position`, which is not a filter input for any of the five subjects, so a drop cannot change which tasks match. Writing a dnd-kit test would require simulating pointer sensors against a full board render — high cost, and it would exercise dnd-kit rather than this delta. Recommended instead: one manual browser pass (filter by an assignee, drag a card between columns, confirm it stays visible and the URL is unchanged) recorded in the final report. |
| **AC-8** static i18n keys only | `board-filter-chips.test.tsx` | `"renders only i18n keys, never literal English copy"` | With the stub, every translated string renders as its key. Assert `getByText("common:actions.clearAllFilters")` exists and `expect(container.textContent).not.toMatch(/Clear all|Remove .* filter/i)`. A hardcoded string would fail this. Backed by a manual grep of the four changed source files in the final report. |
| **AC-9** suite green | — | `pnpm --filter @kaneo/web test` | ≥ 112 passing / 0 failing (E-9 baseline). Plus targeted `biome check` (non-writing, NFR-7) and `tsc --noEmit -p tsconfig.app.json` (NFR-8). |
| **AC-10** no API/package/dep change | — | `git status` in the final report | Diff confined to the 10 paths in §1. |

### 8.3 Tests that must keep passing unchanged

- `apps/web/src/hooks/use-task-filters-with-labels-support.test.tsx` — both existing tests
  (`"restores persisted label filters from storage…"` and the three-case
  `"matches a task by its issue identifier…"`). They call the hook with 2 and 3 positional arguments
  and no options, so they exercise the uncontrolled path. **Do not edit them; append a new
  `describe` block below.** If either needs a change, the FR-11 contract has been broken and the
  hook change is wrong.
- The full 36-file / 112-test baseline. Any failure in a suite this run did not touch is this run's
  regression (NFR-6). No existing test renders `BoardToolbar` (verified — there is no
  `board-toolbar.test.tsx`), so removing the `updateLabelFilter` prop breaks no test.

---

## 9. Packet decomposition

Ordered units of work for Phase 4. Each is one `TaskPacket` unless marked atomic.

| # | Packet | Files | Depends on | Notes |
|---|---|---|---|---|
| **P1** | i18n keys | `i18n/en-US.json` | — | 3 keys, tab-indented, into the existing `tasks.boardFilters` block. Independent; do it first so no later packet is tempted to hardcode copy. |
| **P2** | URL contract module + pure tests **(atomic)** | `board-search-params.ts` (new), `board-search-params.test.ts` (new) | — | Ship the module and its table-driven test together; a module with no test here is untestable later by design (§0). |
| **P3** | Router round-trip test | `board-search-params.router.test.tsx` (new) | P2 | **Run early on purpose.** This is the R-8 canary that empirically confirms TanStack 1.170's default stringifier emits `assignee=u1,u2`. If it fails, §2.1's whole encoding decision must be revisited *before* P6 is written. |
| **P4** | Controlled hook + hook tests **(atomic)** | `use-task-filters-with-labels-support.ts`, `use-task-filters-with-labels-support.test.tsx` | — | Independent of P1-P3 (the hook imports nothing from them). Append-only to the test file. Must land with its tests because the "no flash" probe is the only thing that pins FR-9. |
| **P5** | Chip row component + tests **(atomic)** | `board-filter-chips.tsx` (new), `board-filter-chips.test.tsx` (new) | P1 (keys exist) | Compiles standalone — it imports only `BoardFilters`, `ProjectWithTasks`, existing `ui/avatar`, `lib/column`, `lib/priority`, `lib/i18n/domain`, `lib/get-initials`, `constants/label-colors`. Not yet imported by anything, so `tsc` is green at this point. |
| **P6** | Toolbar extraction + route wiring **(ATOMIC PAIR — must land together)** | `board-toolbar.tsx`, `.../board.tsx` | P2, P4, P5 | **Flagged:** P6 removes `updateLabelFilter` from `BoardToolbarProps` (§5.7) while `board.tsx` still passes it. TypeScript excess-property-checks JSX props, so splitting these into two packets leaves `tsc --noEmit` failing in between and the intermediate commit is not shippable. Also contains the §6 `handleCloseTaskSheet` fix and the §4 storage seed. This is the largest and riskiest packet; everything it depends on is already tested by P2-P5. |
| **P7** | Verification sweep | — | P1-P6 | `pnpm --filter @kaneo/web test`; `tsc --noEmit -p tsconfig.app.json`; targeted **non-writing** `biome check` on the 10 changed paths only (never `pnpm lint`, which is `biome check --write .` and will reformat unrelated files — NFR-7/R-6); manual browser pass for the AC-7 dnd-kit argument and real back/forward. |

Critical path: **P2 → P3 → P6**. P1, P4 and P5 can proceed in parallel with P2/P3.

---

## 10. Risk register

| # | Risk | Status | Concrete mitigation now that OQ-1..OQ-4 are decided |
|---|---|---|---|
| **R-1** | Dual-writer loop between the storage mirror and the URL | **Closed by design** | OQ-1(b) implemented as: URL is the only writer of `assignee`/`labels` (§3.4); the storage mirror writes `localStorage` and *nothing else*, and mirrors `effectiveFilters` rather than internal state (§3.5); the storage *reader* runs on `[projectId]` only, a dep that filters cannot change. The third "controlled → internal sync" effect an obvious implementation would add is explicitly forbidden (§3.5). §3.6 enumerates every writer and shows the graph is acyclic. Backed by the AC-3 render-count probe, which fails loudly on an oscillation (it would record more than a handful of renders and, on a real loop, hang the test). |
| **R-2** | `handleCloseTaskSheet` silently drops filters | **Open until P6; highest severity** | Its own section (§6), its own packet requirement, and **two** independent tests: `clearTaskId` as a pure function and an end-to-end router assertion that `assignee`/`labels` survive the close navigation. Reviewer instruction: if `search: {}` still appears anywhere in `board.tsx`, the packet is rejected. |
| **R-3** | Flash of unfiltered content | **Closed by design** | The entire URL→DOM chain is render-phase with no `useEffect` on it (§3.3). Pinned by an assertion stronger than "the final state is right": the probe records *every* render's filtered task count and asserts none of them was the unfiltered count. |
| **R-4** | Extracting the chip row regresses status/priority/dueDate | **Open until P5** | Rows 1-3 are a verbatim move of `board-toolbar.tsx:533-632` (same JSX, class strings and `t()` keys) — a move, not a rewrite. `ActiveFilterChip`/`StackedIcons` move with them so their markup cannot drift. The chip test covers **all five** subjects, including an assertion that the three untouched subjects still render as exactly one aggregate chip each. |
| **R-5** | i18n key drift into 16 non-en-US locales; stale `i18n/schema.json` | **Accepted, documented** | Only 3 new keys. `fallbackLng` renders them in en-US everywhere (E-11). `pnpm i18n:check` and `pnpm i18n:schema` are not wired into `turbo test`, so neither can fail this run. Both files are off-limits. Record in the final report as a follow-up with the exact three key paths so the follow-up is mechanical. |
| **R-6** | `biome ci` formatting trip-wire in `.husky/pre-commit` | **Open, procedural** | P7 runs `biome check` (non-writing) scoped to the 10 changed paths. Never `pnpm lint` / `biome check --write .`. This run makes no commit. |
| **R-7** | `.sdlc/**` appeared in both allowlist and off-limits; the hook resolves off-limits first, so the run could not write its own artifacts through `Write`/`Edit` | **Closed at Gate 1** | Raised at Gate 1; the user removed `.sdlc/**` from `off_limits` in `.sdlc/local/write-contract.json`. Re-verified this phase: `active: true`, `strict: true`, 7 allowlist globs unchanged, 36 off-limits entries remaining, `.sdlc/**` no longer among them. Source scope is unchanged — the shell-redirection workaround is retired and every write, artifact or source, now goes through the validated tool path. |
| **R-8** | *(new)* The comma format depends on TanStack Router 1.170's default `stringifySearch` behavior for string values. If it quotes or JSON-encodes, OQ-2 is unsatisfiable without touching the off-limits `main.tsx` | **Open until P3** | P3 is sequenced immediately after P2, before any board wiring, and asserts a literal `assignee=u1,u2` in `router.state.location.searchStr`. If it fails, escalate to the user rather than silently falling back to JSON encoding — OQ-2 was a user decision. Verified statically: `main.tsx:45-53` passes no `parseSearch`/`stringifySearch`, so defaults are in play. |
| **R-9** | *(new, found while reading)* `toggleLabelGroup` and `clearLabelFilters` in `board-toolbar.tsx:233-252` loop over `updateLabelFilter`. Under the controlled model each call reads the same pre-change `filters` and fires its own `navigate` → last write wins, so a multi-id label group half-toggles and N-1 junk history entries are created | **Open until P6; high severity, easy to miss** | §5.7 rewrites both to single-commit `updateFilter("labels", next)` form (end-state-equivalent to today). The "at most one `commit` per event handler" invariant is a required code comment in the hook. Verified that the other four toggles (`toggleStatusFilter`, `togglePriorityFilter`, `toggleAssigneeFilter`, `toggleDueDateFilter`) each call `updateFilter` exactly once and need no change. |
| **R-10** | *(new)* `board.test.tsx` is not writable — the allowlist grants the route *file*, not the routes directory — so no test can be colocated with the route | **Closed by design** | All testable route logic extracted to `components/board/board-search-params.ts` (§0). Note the tooling would have allowed a colocated route test (`routeFileIgnorePattern` in `vite.config.ts`); the constraint is the write contract alone. Do not attempt to widen it. |
| **R-11** | *(new)* `noUnusedLocals`/`noUnusedParameters` are **on** in `tsconfig.app.json`, so every symbol orphaned by the chip extraction is a hard `tsc` failure, not a warning | **Open until P6** | §5.6 lists all eight orphans (`ActiveFilterChipProps`, `ActiveFilterChip`, `StackedIcons`, `getStatusDisplayName`, `getAssigneeDisplayName`, `getAssigneeAvatar`, the `X` icon import, the whole `ReactNode` type import) and, equally important, the twelve symbols that must be **retained**. P7 runs `tsc --noEmit`. |
| **R-12** | *(new)* Chip `React key` collisions for label groups if keyed on `label.id` (a group holds N ids) | **Closed by design** | Label chips key on the `name color` group key (§5.4); assignee chips key on `userId`; §2.3 dedups on both read and write so neither list can contain a repeat. |
| **R-13** | *(new)* `controlled` object identity churn de-memoizes `filterTasks` → `filteredProject`, silently breaking NFR-4 on task-heavy boards | **Closed by design** | `board.tsx` memoizes `parseFilterList` results on the **primitive** `search.assignee`/`search.labels` strings and memoizes the `controlled` object on those two arrays (§4.1). The stability requirement is a doc comment on `UseTaskFiltersOptions`. Note React Compiler runs in the Vite build but **not** under Vitest, so the hand-memoization is what tests and production both rely on — do not remove it on the assumption that the compiler covers it. |
| **R-14** | *(new)* An unknown/stale id stays in the URL and in `filters` forever, matching nothing, with no chip for the label case — a user could see an "empty board" with no visible cause | **Accepted, mitigated** | For **assignee** the chip *does* render (with `common:people.unknown`), so the user can see and remove it. For **labels** no chip renders, but the clear-all control is still visible because `hasActiveFilters` is true — so there is always a visible escape hatch. `validateSearch` deliberately does not drop unknown ids because it runs before the member/label lists load (§2.4, last row). Documented rather than engineered around; a "prune unknown ids once the lists load" effect would be a second URL writer and would violate NFR-2. |

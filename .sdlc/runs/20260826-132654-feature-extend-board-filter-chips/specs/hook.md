### E1 — the filter hook, precisely

New optional parameter (FR-12). It is the 4th positional argument and is optional, so every existing
call site — `board.tsx:166` and both existing test call sites — compiles and behaves identically:

```ts
export type BoardFilterUrlState = { filters: BoardFilters; carriesFilters: boolean };

export function useTaskFiltersWithLabelsSupport(
  project: ProjectWithTasks | null | undefined,
  projectId?: string,
  textQuery?: string,
  urlState?: BoardFilterUrlState,
)
```

**a. Structural fix for KD-3 / FR-15 — this is the chosen mechanism, not ordering.**

`useState<BoardFilters>(DEFAULT_FILTERS)` at L50 becomes a lazy initializer that resolves the full
precedence chain synchronously, before the first commit:

```ts
const [filters, setFilters] = useState<BoardFilters>(() =>
  urlState?.carriesFilters ? urlState.filters : readStoredFilters(storageKey),
);
```

There is therefore **no render in which `filters` is `DEFAULT_FILTERS` while the URL or storage
carries a value**. The unconditional write effect at L69-72 cannot clobber anything, because the
value it writes on mount is already the resolved value. This is the structural option the brief
asked for; no effect-ordering argument is load-bearing anywhere in this design.

The write effect at L69-72 stays **byte-for-byte unchanged**. It is also what satisfies FR-14: when
the URL wins, its filters are the mount-time state, so the effect writes them to
`kaneo:board-filters:${projectId}` with no new code. KD-3's underlying "write unconditionally on
every change" design is left in place, as recorded in requirements §8.

**b. `readStoredFilters(storageKey: string | null): BoardFilters`** — new module-local function in
this file. `typeof window === "undefined"` guard, `getItem`, `JSON.parse`, `normalizeFilters`, all
inside `try/catch`, returning `DEFAULT_FILTERS` on any failure. This is the existing L52-67 effect
body lifted into a function **within the same file**. It is deliberately *not* shared with
`use-task-filters.ts` — see §9.

**c. Storage read effect (replaces L52-67).** Still needed for `storageKey` changes (project switch),
but must not re-run for the key the initializer already resolved:

```ts
const urlStateRef = useRef(urlState);
urlStateRef.current = urlState;
const resolvedStorageKeyRef = useRef(storageKey);

useEffect(() => {
  if (resolvedStorageKeyRef.current === storageKey) return;
  resolvedStorageKeyRef.current = storageKey;
  const current = urlStateRef.current;
  setFilters(current?.carriesFilters ? current.filters : readStoredFilters(storageKey));
}, [storageKey]);
```

`urlState` is read through a ref so the dep array stays `[storageKey]` and Biome's
`useExhaustiveDependencies` has nothing to complain about (AC-12 runs `biome ci` on changed paths).

**d. URL → state after mount (IS-9, the read half of Back).**

```ts
const urlFilters = urlState?.carriesFilters ? urlState.filters : null;
useEffect(() => {
  if (!urlFilters) return;
  setFilters((prev) => (areBoardFiltersEqual(prev, urlFilters) ? prev : urlFilters));
}, [urlFilters]);
```

Requires `urlState.filters` to be referentially stable across renders that do not change the search —
E2 guarantees that with a `useMemo` keyed on the `useSearch()` result, which TanStack Router keeps
structurally shared.

**e. Unchanged (FR-16):** `filterTasks`, `filteredProject`, `hasActiveFilters` (including its
empty-array-is-inactive behavior), `clearFilters`, `updateFilter`, `updateLabelFilter`, and the
returned object's shape. `board-toolbar.tsx` consumes exactly these props and therefore **needs no
change at all** — confirmed against `BoardToolbarProps` at `board-toolbar.tsx:46-62`.
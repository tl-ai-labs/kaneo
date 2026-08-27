### A1 — codec surface (exact)

```ts
// value/count bounds — FR-7, hostile-input half of IS-6
export const MAX_FILTER_VALUES = 50;          // per facet, after dedupe
export const MAX_FILTER_VALUE_LENGTH = 128;   // ids are cuid/uuid-sized; over-long values are DROPPED, not truncated

export const BOARD_FILTER_KEYS = ["status", "priority", "assignee", "dueDate", "labels"] as const;

export type BoardFilterSearchParams = {
  status?: string[]; priority?: string[]; assignee?: string[]; dueDate?: string[]; labels?: string[];
};
export type BoardSearchParams = BoardFilterSearchParams & { taskId?: string };

export function parseBoardFilterSearch(search: unknown): BoardFilters;              // FR-1, total
export function toBoardFilterSearchParams(filters: BoardFilters): BoardFilterSearchParams; // FR-2, key omitted when null/[]
export function searchCarriesBoardFilters(search: unknown): boolean;               // FR-3
export function areBoardFiltersEqual(a: BoardFilters, b: BoardFilters): boolean;
export function applyBoardFiltersToSearch<T extends Record<string, unknown>>(prev: T, filters: BoardFilters): T & BoardFilterSearchParams;
export function readBoardSearchParams(search: unknown): BoardSearchParams;         // FR-8/FR-9, what validateSearch becomes
```

Normalization rules for each facet, in order — O(values), no regex, no `JSON.parse`, satisfying NFR-2:

1. `string` → `[value]`; `string[]` → keep only `typeof === "string"` entries; anything else (number,
   object, `null`, nested array) → treated as absent.
2. Drop `""` entries (FR-6 — empty segments dropped, never preserved as `""`).
3. Drop entries with `length > MAX_FILTER_VALUE_LENGTH`. Dropping, not truncating: a truncated id
   could accidentally prefix-match a real one.
4. Dedupe with `Array.from(new Set(values))` — preserves insertion order, so round-trip (FR-4) is
   order-stable.
5. `slice(0, MAX_FILTER_VALUES)`.
6. Empty result → `null`. Result is assembled into a fresh object literal keyed only by
   `BOARD_FILTER_KEYS`, so no attacker-supplied key (`__proto__`, `constructor`) can reach it.

`searchCarriesBoardFilters` is implemented as
`Object.values(parseBoardFilterSearch(search)).some((v) => v !== null)`. Deriving the predicate from
the parser makes "predicate true ⟺ parse yields at least one non-null facet" an invariant that
cannot drift, and makes `?status=` answer `false` for free (IS-4/AC-4).

`readBoardSearchParams` = `try { return { taskId: typeof s.taskId === "string" ? s.taskId : undefined,
...toBoardFilterSearchParams(parseBoardFilterSearch(s)) } } catch { return { taskId: undefined } }`.
The `taskId` expression is byte-identical to today's `board.tsx:33` (FR-8). The `try/catch` is
belt-and-braces over an already-total parser and is the **hard non-throwing mechanism** (see ADR-1);
it lives in the codec, not the route, precisely so that AC-6 can be a real test — `board.tsx` has no
allowlisted test file.

`applyBoardFiltersToSearch` **deletes** the five facet keys from a copy of `prev` before spreading
the serialized facets in. It does not set them to `undefined`. Deletion is unambiguous regardless of
how the router's `stringifySearch` treats `undefined`, and it is what makes "clearing the last
filter produces a clean URL" (IS-7/AC-7) true rather than hopeful.
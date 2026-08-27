/**
 * URL contract for the project Board route.
 *
 * `assignee` and `labels` live in the URL so a filtered board is linkable and survives
 * reload and back/forward. `status`, `priority` and `dueDate` deliberately do not — they
 * stay in `localStorage` (see `use-task-filters-with-labels-support.ts`).
 *
 * This module lives beside the board components rather than next to the route because
 * every function here has to be unit-testable without mounting the route, which drags in
 * dnd-kit, TanStack Query and three stores.
 *
 * Values are carried as canonical dot-joined strings (`?assignee=u1.u2`) rather than
 * arrays. The router is created without a `stringifySearch` override, so its default
 * stringifier JSON-encodes anything object-typed — an array would surface as
 * `?assignee=%5B%22u1%22%5D`. A plain string fails `JSON.parse` and is emitted raw, which
 * is what keeps the URL readable and pasteable. The `string[]` shape is derived one layer
 * in, during render, and never touches the URL boundary.
 *
 * Why `.` and not `,`: the router's `stringifySearch` hands the raw string to
 * `URLSearchParams.toString()`, whose form-urlencoding turns a comma into `%2C`. The value
 * still round-trips exactly, but `?assignee=u1%2Cu2` is not the readable URL this feature
 * exists to produce. Of the characters that survive that encoding unescaped
 * (`.`, `*`, `-`, `_`), only `.` and `*` cannot occur inside an id — ids are cuid2, i.e.
 * `[a-z0-9]{24}` — and `.` reads better. The reader below accepts BOTH `.` and `,` so
 * hand-typed and previously-shared comma URLs keep working.
 */

export type BoardSearchParams = {
  taskId?: string;
  /** Canonical, dot-joined, sorted, deduped list of workspace-member ids. */
  assignee?: string;
  /** Canonical, dot-joined, sorted, deduped list of workspace-label ids. */
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
 *   - a dot-joined string    ("u1.u2")     — the canonical form we write
 *   - a comma-joined string  ("u1,u2")     — hand-typed, or a link shared before the
 *                                            separator changed; still supported
 *   - a bare string          ("u1")
 *   - a number               (123)         — the router's JSON.parse turns a numeric-only
 *                                            hand-typed param into a number
 *   - an array of the above  (["u1","u2"]) — repeated `?assignee=` or JSON-array links
 *
 * Anything else yields null. Never throws: no JSON.parse, no regex. Work is bounded twice —
 * the entry count is capped before iterating and each entry's raw length is checked before
 * `split` — so neither a megabyte-long string nor a many-element array can block the main
 * thread.
 */
export function parseFilterList(raw: unknown): string[] | null {
  // Sliced, not just length-checked per entry: `?assignee=a&assignee=b` and a JSON-array
  // link both arrive here as arrays, and an array of N inert entries would otherwise walk
  // all N regardless of the per-entry length cap or the `seen` early-break.
  const entries: unknown[] = (Array.isArray(raw) ? raw : [raw]).slice(
    0,
    MAX_FILTER_VALUES,
  );
  const seen = new Set<string>();

  for (const entry of entries) {
    const text =
      typeof entry === "string"
        ? entry
        : typeof entry === "number" && Number.isFinite(entry)
          ? String(entry)
          : null;

    if (text === null || text.length > MAX_RAW_LENGTH) continue;

    // Split on both separators without a regex: `.` is canonical, `,` is legacy.
    for (const commaPart of text.split(",")) {
      for (const part of commaPart.split(".")) {
        const value = part.trim();
        if (!value || value.length > MAX_FILTER_VALUE_LENGTH) continue;
        seen.add(value);
        if (seen.size >= MAX_FILTER_VALUES) break;
      }
      if (seen.size >= MAX_FILTER_VALUES) break;
    }

    if (seen.size >= MAX_FILTER_VALUES) break;
  }

  return seen.size > 0 ? Array.from(seen) : null;
}

/**
 * Canonical writer. Sorted so the same filter set always produces the same string:
 * toggling a value on and then off returns the URL to its exact prior text, which is what
 * makes a history entry stable and a copied link reproducible.
 *
 * Empty yields `undefined`, which the router deletes from the query string entirely —
 * never `""` and never `[]`.
 *
 * Joins with `.` so the value survives `URLSearchParams` encoding unescaped. See the
 * module header.
 */
export function serializeFilterList(
  values: readonly string[] | null | undefined,
): string | undefined {
  if (!values || values.length === 0) return undefined;
  const unique = Array.from(
    new Set(values.filter((value) => value.length > 0)),
  );
  if (unique.length === 0) return undefined;
  return unique.sort().join(".");
}

/**
 * Route `validateSearch`. Total function — every input path returns, nothing throws.
 *
 * Returns a fresh object, so unknown search keys (`?assignee[]=x`) are dropped rather than
 * carried through. Structurally invalid values become `undefined`; ids that are merely
 * stale (a removed member, a deleted label) cannot be detected here, because this runs
 * before the member and label lists have loaded. Those stay in the URL and are inert —
 * they match no task, and the chip row is what surfaces them to the user.
 *
 * `taskId` keeps its exact current predicate, deliberately unstrengthened.
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

/** `navigate()` payload builder for a filter change. Preserves `taskId`. */
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

/**
 * Decides whether a bare board URL should adopt the previous session's stored filters.
 *
 * Returns the search to navigate to, or `null` for "do nothing". Pure, so the decision is
 * unit-testable without mounting the route, and so the caller can read storage during
 * render rather than racing the hook's storage-mirror effect.
 *
 * The URL wins whenever it carries EITHER param — a link that shares only an assignee
 * filter must not silently acquire the recipient's stored label filters.
 */
export function buildStorageSeedSearch(
  current: BoardSearchParams,
  stored: ControlledBoardFilterValues,
): BoardSearchParams | null {
  if (current.assignee !== undefined || current.labels !== undefined) {
    return null;
  }

  const assignee = serializeFilterList(stored.assignee);
  const labels = serializeFilterList(stored.labels);
  if (!assignee && !labels) return null;

  return { ...current, assignee, labels };
}

/**
 * `navigate()` payload builder for closing the task details sheet. Clears ONLY `taskId`.
 *
 * The board used to close the sheet with `search: {}`, which meant "the new search is the
 * empty object". That was indistinguishable from clearing `taskId` while `taskId` was the
 * only search param, and it silently discards every filter now that filters live here.
 */
export function clearTaskId(previous: BoardSearchParams): BoardSearchParams {
  return { ...previous, taskId: undefined };
}

import type { BoardFilters } from "@/hooks/use-task-filters";

export const MAX_BOARD_FILTER_VALUES = 50;
export const MAX_BOARD_FILTER_VALUE_LENGTH = 128;

export const BOARD_FILTER_SEARCH_KEYS = [
  "status",
  "priority",
  "assignee",
  "dueDate",
  "labels",
] as const satisfies ReadonlyArray<keyof BoardFilters>;

export type BoardFilterSearchKey = (typeof BOARD_FILTER_SEARCH_KEYS)[number];

export function parseBoardFilterSearch(
  search: Record<string, unknown>,
): BoardFilters {
  const result: BoardFilters = {
    status: null,
    priority: null,
    assignee: null,
    dueDate: null,
    labels: null,
  };

  if (!search || typeof search !== "object") {
    return result;
  }

  for (const key of BOARD_FILTER_SEARCH_KEYS) {
    const raw = search[key];
    // A single occurrence of a repeated param arrives as a bare string, so the
    // string branch is the common single-value case, not a defensive fallback.
    const rawArray = Array.isArray(raw)
      ? raw
      : typeof raw === "string"
        ? [raw]
        : [];

    const validValues: string[] = [];
    for (const item of rawArray) {
      // Over-long values are dropped rather than truncated: a truncated id
      // would look legitimate and silently match nothing.
      if (
        typeof item === "string" &&
        item !== "" &&
        item.length <= MAX_BOARD_FILTER_VALUE_LENGTH
      ) {
        validValues.push(item);
      }
    }

    const sliced = validValues.slice(0, MAX_BOARD_FILTER_VALUES);
    result[key] = sliced.length > 0 ? sliced : null;
  }

  return result;
}

export function serializeBoardFilters(
  filters: BoardFilters,
): Partial<Record<BoardFilterSearchKey, string[]>> {
  // Every key is present with an explicit undefined so that merging into the
  // previous search object clears a filter instead of leaving it stale.
  const serialized: Partial<Record<BoardFilterSearchKey, string[]>> = {
    status: undefined,
    priority: undefined,
    assignee: undefined,
    dueDate: undefined,
    labels: undefined,
  };

  for (const key of BOARD_FILTER_SEARCH_KEYS) {
    const value = filters[key];
    if (Array.isArray(value) && value.length > 0) {
      serialized[key] = value;
    }
  }

  return serialized;
}

export function hasAnyBoardFilterParam(
  search: Record<string, unknown>,
): boolean {
  // Derived from the parser so the predicate and the parser cannot disagree:
  // an empty param such as `?status=` yields null and therefore false.
  const parsed = parseBoardFilterSearch(search);
  for (const key of BOARD_FILTER_SEARCH_KEYS) {
    if (parsed[key] !== null) {
      return true;
    }
  }
  return false;
}

export function boardFilterSearchMatches(
  search: Record<string, unknown>,
  filters: BoardFilters,
): boolean {
  const parsed = parseBoardFilterSearch(search);

  for (const key of BOARD_FILTER_SEARCH_KEYS) {
    const parsedVal = parsed[key];
    const filterVal = filters[key];

    if (parsedVal === null && filterVal === null) {
      continue;
    }

    if (Array.isArray(parsedVal) && Array.isArray(filterVal)) {
      if (parsedVal.length !== filterVal.length) {
        return false;
      }
      for (let i = 0; i < parsedVal.length; i++) {
        if (parsedVal[i] !== filterVal[i]) {
          return false;
        }
      }
      continue;
    }

    return false;
  }

  return true;
}

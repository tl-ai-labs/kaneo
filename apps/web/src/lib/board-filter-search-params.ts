import type { BoardFilters } from "@/hooks/use-task-filters";

// value/count bounds - FR-7, hostile-input half of IS-6
export const MAX_FILTER_VALUES = 50;
export const MAX_FILTER_VALUE_LENGTH = 128;

export const BOARD_FILTER_KEYS = [
  "status",
  "priority",
  "assignee",
  "dueDate",
  "labels",
] as const;

export type BoardFilterSearchParams = {
  status?: string[];
  priority?: string[];
  assignee?: string[];
  dueDate?: string[];
  labels?: string[];
};

export type BoardSearchParams = BoardFilterSearchParams & { taskId?: string };

function normalizeFacetValues(rawValue: unknown): string[] | null {
  let values: string[];

  if (typeof rawValue === "string") {
    values = [rawValue];
  } else if (Array.isArray(rawValue)) {
    values = rawValue.filter(
      (entry): entry is string => typeof entry === "string",
    );
  } else {
    return null;
  }

  const nonEmpty = values.filter((value) => value !== "");
  const withinLength = nonEmpty.filter(
    (value) => value.length <= MAX_FILTER_VALUE_LENGTH,
  );
  const deduped = Array.from(new Set(withinLength));
  const limited = deduped.slice(0, MAX_FILTER_VALUES);

  return limited.length > 0 ? limited : null;
}

function readFacetProperty(
  source: Record<string, unknown>,
  key: string,
): unknown {
  return Object.hasOwn(source, key) ? source[key] : undefined;
}

export function parseBoardFilterSearch(search: unknown): BoardFilters {
  const source =
    typeof search === "object" && search !== null
      ? (search as Record<string, unknown>)
      : {};

  return {
    status: normalizeFacetValues(readFacetProperty(source, "status")),
    priority: normalizeFacetValues(readFacetProperty(source, "priority")),
    assignee: normalizeFacetValues(readFacetProperty(source, "assignee")),
    dueDate: normalizeFacetValues(readFacetProperty(source, "dueDate")),
    labels: normalizeFacetValues(readFacetProperty(source, "labels")),
  };
}

export function toBoardFilterSearchParams(
  filters: BoardFilters,
): BoardFilterSearchParams {
  const params: BoardFilterSearchParams = {};

  for (const key of BOARD_FILTER_KEYS) {
    const value = filters[key];
    if (value !== null && value.length > 0) {
      params[key] = value;
    }
  }

  return params;
}

export function searchCarriesBoardFilters(search: unknown): boolean {
  return Object.values(parseBoardFilterSearch(search)).some(
    (value) => value !== null,
  );
}

export function areBoardFiltersEqual(
  a: BoardFilters,
  b: BoardFilters,
): boolean {
  return BOARD_FILTER_KEYS.every((key) => {
    const valueA = a[key];
    const valueB = b[key];

    if (valueA === null || valueB === null) {
      return valueA === valueB;
    }

    if (valueA.length !== valueB.length) {
      return false;
    }

    return valueA.every((entry, index) => entry === valueB[index]);
  });
}

export function applyBoardFiltersToSearch<T extends Record<string, unknown>>(
  prev: T,
  filters: BoardFilters,
): T & BoardFilterSearchParams {
  const next: Record<string, unknown> = { ...prev };

  for (const key of BOARD_FILTER_KEYS) {
    delete next[key];
  }

  return { ...next, ...toBoardFilterSearchParams(filters) } as T &
    BoardFilterSearchParams;
}

export function readBoardSearchParams(search: unknown): BoardSearchParams {
  try {
    const source = search as { taskId?: unknown };

    return {
      taskId: typeof source.taskId === "string" ? source.taskId : undefined,
      ...toBoardFilterSearchParams(parseBoardFilterSearch(search)),
    };
  } catch {
    return { taskId: undefined };
  }
}

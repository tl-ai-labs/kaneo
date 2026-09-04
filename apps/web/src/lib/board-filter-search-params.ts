import type { BoardFilters } from "@/hooks/use-task-filters";

export type BoardFilterSearchKey = keyof BoardFilters;

export const BOARD_FILTER_SEARCH_KEYS: ReadonlyArray<BoardFilterSearchKey> = [
  "status",
  "priority",
  "assignee",
  "dueDate",
  "labels",
];

export type BoardFilterSearchParams = {
  status?: string;
  priority?: string;
  assignee?: string;
  dueDate?: string;
  labels?: string;
};

export const EMPTY_BOARD_FILTERS: BoardFilters = {
  status: null,
  priority: null,
  assignee: null,
  dueDate: null,
  labels: null,
};

export function readRawFilterParam(
  search: Record<string, unknown>,
  key: BoardFilterSearchKey,
): string | undefined {
  const value = search[key];
  return typeof value === "string" ? value : undefined;
}

export function decodeFilterValue(raw: unknown): string[] | null {
  if (typeof raw !== "string") return null;

  const seen = new Set<string>();
  for (const segment of raw.split(",")) {
    const trimmed = segment.trim();
    if (trimmed.length === 0) continue;
    seen.add(trimmed);
  }

  return seen.size > 0 ? [...seen] : null;
}

export function decodeBoardFilters(
  search: Record<string, unknown>,
): BoardFilters {
  return {
    status: decodeFilterValue(search.status),
    priority: decodeFilterValue(search.priority),
    assignee: decodeFilterValue(search.assignee),
    dueDate: decodeFilterValue(search.dueDate),
    labels: decodeFilterValue(search.labels),
  };
}

export function encodeFilterValue(
  values: string[] | null | undefined,
): string | undefined {
  if (!Array.isArray(values)) return undefined;

  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    // A legal filter value is a slug or a UUID and can never contain a comma.
    // Dropping such a value keeps the emitted URL unambiguous.
    if (trimmed.length === 0 || trimmed.includes(",")) continue;
    seen.add(trimmed);
  }

  return seen.size > 0 ? [...seen].join(",") : undefined;
}

export function encodeBoardFilters(
  filters: BoardFilters,
): Record<BoardFilterSearchKey, string | undefined> {
  return {
    status: encodeFilterValue(filters.status),
    priority: encodeFilterValue(filters.priority),
    assignee: encodeFilterValue(filters.assignee),
    dueDate: encodeFilterValue(filters.dueDate),
    labels: encodeFilterValue(filters.labels),
  };
}

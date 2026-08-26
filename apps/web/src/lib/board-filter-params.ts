import type { BoardFilters } from "@/hooks/use-task-filters";

export type BoardSearchParams = {
  taskId?: string;
  status?: string[];
  priority?: string[];
  assignee?: string[];
  dueDate?: string[];
  labels?: string[];
};

const FILTER_KEYS = [
  "status",
  "priority",
  "assignee",
  "dueDate",
  "labels",
] as const;

const MAX_ARRAY_LENGTH = 50;

function parseFilterParam(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const cleaned: string[] = [];
    for (const item of value) {
      if (typeof item === "string") {
        const trimmed = item.trim();
        if (trimmed.length > 0) {
          cleaned.push(trimmed);
          if (cleaned.length === MAX_ARRAY_LENGTH) {
            break;
          }
        }
      }
    }
    return cleaned.length > 0 ? cleaned : undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : undefined;
  }

  return undefined;
}

export function validateBoardSearch(
  search: Record<string, unknown>,
): BoardSearchParams {
  try {
    if (!search || typeof search !== "object") {
      return {};
    }

    const result: BoardSearchParams = {};

    const rawTaskId = search.taskId;
    if (typeof rawTaskId === "string") {
      const trimmed = rawTaskId.trim();
      if (trimmed.length > 0) {
        result.taskId = trimmed;
      }
    }

    for (const key of FILTER_KEYS) {
      const parsed = parseFilterParam(search[key]);
      if (parsed !== undefined) {
        result[key] = parsed;
      }
    }

    return result;
  } catch {
    return {};
  }
}

export function filtersToSearchParams(
  filters: BoardFilters,
): Partial<BoardSearchParams> {
  try {
    if (!filters || typeof filters !== "object") {
      return {
        status: undefined,
        priority: undefined,
        assignee: undefined,
        dueDate: undefined,
        labels: undefined,
      };
    }

    const result: Partial<BoardSearchParams> = {};

    for (const key of FILTER_KEYS) {
      result[key] = parseFilterParam(filters[key]);
    }

    return result;
  } catch {
    return {
      status: undefined,
      priority: undefined,
      assignee: undefined,
      dueDate: undefined,
      labels: undefined,
    };
  }
}

export function searchParamsToFilters(
  params: BoardSearchParams | undefined | null,
): BoardFilters {
  try {
    const defaultFilters: BoardFilters = {
      status: null,
      priority: null,
      assignee: null,
      dueDate: null,
      labels: null,
    };

    if (!params || typeof params !== "object") {
      return defaultFilters;
    }

    const result: BoardFilters = { ...defaultFilters };

    for (const key of FILTER_KEYS) {
      const parsed = parseFilterParam(params[key]);
      result[key] = parsed ?? null;
    }

    return result;
  } catch {
    return {
      status: null,
      priority: null,
      assignee: null,
      dueDate: null,
      labels: null,
    };
  }
}

export function hasActiveFilterParams(
  params: Partial<BoardSearchParams> | undefined | null,
): boolean {
  try {
    if (!params || typeof params !== "object") {
      return false;
    }

    for (const key of FILTER_KEYS) {
      const value = params[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string" && item.trim().length > 0) {
            return true;
          }
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

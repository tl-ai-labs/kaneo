import { addWeeks, endOfWeek, isWithinInterval, startOfWeek } from "date-fns";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  type BoardSearchParams,
  hasActiveFilterParams,
  searchParamsToFilters,
} from "@/lib/board-filter-params";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { type BoardFilters, DUE_DATE_FILTER_VALUES } from "./use-task-filters";

const DEFAULT_FILTERS: BoardFilters = {
  status: null,
  priority: null,
  assignee: null,
  dueDate: null,
  labels: null,
};

const FILTER_KEYS: Array<keyof BoardFilters> = [
  "status",
  "priority",
  "assignee",
  "dueDate",
  "labels",
];

function normalizeFilters(raw: unknown): BoardFilters {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_FILTERS;
  }

  const candidate = raw as Partial<Record<keyof BoardFilters, unknown>>;
  const normalized = { ...DEFAULT_FILTERS };

  for (const key of FILTER_KEYS) {
    const value = candidate[key];
    if (Array.isArray(value)) {
      const values = value.filter((v): v is string => typeof v === "string");
      normalized[key] = values.length > 0 ? values : null;
    }
  }

  return normalized;
}

export function useTaskFiltersWithLabelsSupport(
  project: ProjectWithTasks | null | undefined,
  projectId?: string,
  textQuery?: string,
  searchFilters?: BoardSearchParams,
  onFiltersChange?: (next: BoardFilters) => void,
) {
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const storageKey = projectId ? `kaneo:board-filters:${projectId}` : null;
  const seededStorageKeyRef = useRef<string | null>(null);
  const pendingFiltersRef = useRef<BoardFilters | null>(null);

  const filters = useMemo(
    () => searchParamsToFilters(searchFilters ?? null),
    [searchFilters],
  );

  // `filters` is a change trigger here, not a read dependency. Dropping it
  // would run this effect only on mount, leaving pendingFiltersRef stale
  // between handlers — exactly what the accumulator exists to prevent, since
  // board-toolbar calls updateLabelFilter N times within a single handler.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional change trigger, see above
  useEffect(() => {
    pendingFiltersRef.current = null;
  }, [filters]);

  const currentFilters = () => pendingFiltersRef.current ?? filters;

  useEffect(() => {
    if (hasActiveFilterParams(searchFilters)) return;
    if (!storageKey || typeof window === "undefined") return;
    if (seededStorageKeyRef.current === storageKey) return;

    seededStorageKeyRef.current = storageKey;

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return;

      const parsed = JSON.parse(stored) as unknown;
      const normalized = normalizeFilters(parsed);
      const hasActive = Object.values(normalized).some(
        (v) => Array.isArray(v) && v.length > 0,
      );
      if (hasActive) {
        onFiltersChange?.(normalized);
      }
    } catch {
      // ignore parse errors
    }
  }, [searchFilters, storageKey, onFiltersChange]);

  useEffect(() => {
    if (!hasActiveFilterParams(searchFilters)) return;
    if (!storageKey || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(filters));
  }, [searchFilters, storageKey, filters]);

  const persistAndNotify = (next: BoardFilters) => {
    pendingFiltersRef.current = next;
    if (storageKey && typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    }
    onFiltersChange?.(next);
  };

  const setFilters = (
    nextOrUpdater: BoardFilters | ((prev: BoardFilters) => BoardFilters),
  ) => {
    const next =
      typeof nextOrUpdater === "function"
        ? nextOrUpdater(currentFilters())
        : nextOrUpdater;
    persistAndNotify(next);
  };

  const clearFilters = () => {
    const next = DEFAULT_FILTERS;
    persistAndNotify(next);
  };

  const updateFilter = (
    key: keyof BoardFilters,
    value: BoardFilters[keyof BoardFilters],
  ) => {
    const next: BoardFilters = { ...currentFilters(), [key]: value };
    persistAndNotify(next);
  };

  const updateLabelFilter = (labelId: string) => {
    const base = currentFilters();
    const currentLabels = base.labels || [];
    const isSelected = currentLabels.includes(labelId);

    let newLabels: string[] | null;
    if (isSelected) {
      newLabels = currentLabels.filter((id) => id !== labelId);
      if (newLabels.length === 0) newLabels = null;
    } else {
      newLabels = [...currentLabels, labelId];
    }

    const next: BoardFilters = { ...base, labels: newLabels };
    persistAndNotify(next);
  };

  const filterTasks = useCallback(
    (tasks: Task[]): Task[] => {
      const normalizedTextQuery = textQuery?.trim().toLowerCase();

      return tasks.filter((task) => {
        if (normalizedTextQuery) {
          const title = task.title?.toLowerCase() ?? "";
          const description = task.description?.toLowerCase() ?? "";
          const taskNumber = task.number?.toString() ?? "";
          const taskIdentifier =
            taskNumber && project?.slug
              ? `${project.slug}-${taskNumber}`.toLowerCase()
              : "";
          const taskShortIdentifier = taskNumber ? `#${taskNumber}` : "";
          const matchesText =
            title.includes(normalizedTextQuery) ||
            description.includes(normalizedTextQuery) ||
            taskNumber.includes(normalizedTextQuery) ||
            taskIdentifier.startsWith(normalizedTextQuery) ||
            taskShortIdentifier.startsWith(normalizedTextQuery);

          if (!matchesText) {
            return false;
          }
        }

        if (
          filters.status &&
          filters.status.length > 0 &&
          !filters.status.includes(task.status)
        ) {
          return false;
        }

        if (
          filters.priority &&
          filters.priority.length > 0 &&
          !filters.priority.includes(task.priority ?? "")
        ) {
          return false;
        }

        if (
          filters.assignee &&
          filters.assignee.length > 0 &&
          !filters.assignee.includes(task.userId ?? "")
        ) {
          return false;
        }

        if (filters.dueDate && filters.dueDate.length > 0) {
          const today = new Date();
          const taskDate = task.dueDate ? new Date(task.dueDate) : null;

          const matchesAnyDueDate = filters.dueDate.some((dueDateFilter) => {
            if (dueDateFilter === DUE_DATE_FILTER_VALUES.noDueDate) {
              return !task.dueDate;
            }

            if (!taskDate) {
              return false;
            }

            switch (dueDateFilter) {
              case DUE_DATE_FILTER_VALUES.dueThisWeek: {
                const weekStart = startOfWeek(today, { weekStartsOn });
                const weekEnd = endOfWeek(today, { weekStartsOn });
                return isWithinInterval(taskDate, {
                  start: weekStart,
                  end: weekEnd,
                });
              }
              case DUE_DATE_FILTER_VALUES.dueNextWeek: {
                const nextWeekStart = startOfWeek(addWeeks(today, 1), {
                  weekStartsOn,
                });
                const nextWeekEnd = endOfWeek(addWeeks(today, 1), {
                  weekStartsOn,
                });
                return isWithinInterval(taskDate, {
                  start: nextWeekStart,
                  end: nextWeekEnd,
                });
              }
              default:
                return false;
            }
          });

          if (!matchesAnyDueDate) {
            return false;
          }
        }

        // Label filtering
        if (filters.labels && filters.labels.length > 0) {
          const taskLabelIds = (task.labels ?? []).map((label) => label.id);

          // Check if task has at least one of the selected labels
          const hasMatchingLabel = filters.labels.some((labelId) =>
            taskLabelIds.includes(labelId),
          );

          if (!hasMatchingLabel) {
            return false;
          }
        }

        return true;
      });
    },
    [filters, project?.slug, textQuery, weekStartsOn],
  );

  const filteredProject = useMemo(() => {
    if (!project) return null;

    return {
      ...project,
      columns:
        project.columns?.map((column) => ({
          ...column,
          tasks: filterTasks(column.tasks),
        })) ?? [],
    };
  }, [project, filterTasks]);

  const hasActiveFilters = Object.values(filters).some((filter) =>
    Array.isArray(filter) ? filter.length > 0 : filter !== null,
  );

  return {
    filters,
    setFilters,
    updateFilter,
    updateLabelFilter,
    filteredProject,
    hasActiveFilters,
    clearFilters,
  };
}

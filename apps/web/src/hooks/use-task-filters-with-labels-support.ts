import { addWeeks, endOfWeek, isWithinInterval, startOfWeek } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
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

export function boardFiltersStorageKey(projectId: string): string {
  return `kaneo:board-filters:${projectId}`;
}

/** Total: never throws, never returns a partial object. */
export function readStoredBoardFilters(projectId: string): BoardFilters {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const stored = window.localStorage.getItem(
      boardFiltersStorageKey(projectId),
    );
    if (!stored) return DEFAULT_FILTERS;
    return normalizeFilters(JSON.parse(stored) as unknown);
  } catch {
    return DEFAULT_FILTERS;
  }
}

/** The subset of filters an external owner (the board route's URL) can drive. */
export type ControlledBoardFilters = Pick<BoardFilters, "assignee" | "labels">;

export type UseTaskFiltersOptions = {
  /**
   * When present, `assignee` and `labels` are owned by the caller. Presence of the
   * OBJECT is the controlled switch — not presence of its values, because
   * `{ assignee: null }` legitimately means "the caller says: no assignee filter".
   *
   * Must be referentially stable across renders (memoize it on primitives), or
   * `filterTasks` and `filteredProject` de-memoize on every render and filtering stops
   * being free on task-heavy boards.
   */
  controlled?: ControlledBoardFilters;
  /** Called with the full next value of BOTH controlled keys whenever either changes. */
  onControlledChange?: (next: ControlledBoardFilters) => void;
};

function sameIdList(a: string[] | null, b: string[] | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

export function useTaskFiltersWithLabelsSupport(
  project: ProjectWithTasks | null | undefined,
  projectId?: string,
  textQuery?: string,
  options?: UseTaskFiltersOptions,
) {
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const storageKey = projectId ? boardFiltersStorageKey(projectId) : null;
  const [internalFilters, setInternalFilters] =
    useState<BoardFilters>(DEFAULT_FILTERS);

  const controlled = options?.controlled;
  const onControlledChange = options?.onControlledChange;

  // Render-phase, deliberately not an effect: a controlled value must be the rendered
  // truth on the FIRST render, or the board paints unfiltered for a frame before the
  // URL's filters land.
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

  useEffect(() => {
    if (!projectId || typeof window === "undefined") return;
    setInternalFilters(readStoredBoardFilters(projectId));
  }, [projectId]);

  // Mirrors the EFFECTIVE filters, not internal state. That is what lets storage track a
  // history pop (which changes the URL without any commit) and what stops storage from
  // ever holding a value the URL contradicts. This effect writes localStorage and nothing
  // else — no setState, no navigate — so it cannot participate in a loop.
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(filters));
  }, [filters, storageKey]);

  /**
   * The single write path for every filter change.
   *
   * INVARIANT: at most one `commit` per RENDER, not merely per event handler. In
   * controlled mode `commit` reads `filters` from the current render's closure, so every
   * call made before the owner's navigate has re-rendered this hook sees the same
   * pre-change value and only the last one survives. That covers N calls in one handler
   * (compute the whole next value and commit it once) AND two separate user actions
   * landing inside the same pre-navigate window — the second silently reverts the first.
   */
  const commit = (updater: (previous: BoardFilters) => BoardFilters) => {
    if (!controlled) {
      setInternalFilters(updater);
      return;
    }

    const next = updater(filters);

    // Uncontrolled keys keep living in React state, and therefore in localStorage.
    setInternalFilters((previous) => ({
      ...previous,
      status: next.status,
      priority: next.priority,
      dueDate: next.dueDate,
    }));

    // Controlled keys are handed to the owner. This is their ONLY write path.
    if (
      !sameIdList(next.assignee, filters.assignee) ||
      !sameIdList(next.labels, filters.labels)
    ) {
      onControlledChange?.({ assignee: next.assignee, labels: next.labels });
    }
  };

  const setFilters = (
    next: BoardFilters | ((prev: BoardFilters) => BoardFilters),
  ) => commit(typeof next === "function" ? next : () => next);

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

  const clearFilters = () => commit(() => DEFAULT_FILTERS);

  const updateFilter = (
    key: keyof BoardFilters,
    value: BoardFilters[keyof BoardFilters],
  ) => commit((previous) => ({ ...previous, [key]: value }));

  const updateLabelFilter = (labelId: string) =>
    commit((previous) => {
      const currentLabels = previous.labels || [];
      const isSelected = currentLabels.includes(labelId);

      let newLabels: string[] | null;
      if (isSelected) {
        newLabels = currentLabels.filter((id) => id !== labelId);
        if (newLabels.length === 0) newLabels = null;
      } else {
        newLabels = [...currentLabels, labelId];
      }

      return { ...previous, labels: newLabels };
    });

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

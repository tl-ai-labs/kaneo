import { useNavigate, useSearch } from "@tanstack/react-router";
import { addWeeks, endOfWeek, isWithinInterval, startOfWeek } from "date-fns";
import { type SetStateAction, useCallback, useMemo } from "react";
import {
  decodeBoardFilters,
  EMPTY_BOARD_FILTERS,
  encodeBoardFilters,
  readRawFilterParam,
} from "@/lib/board-filter-search-params";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { type BoardFilters, DUE_DATE_FILTER_VALUES } from "./use-task-filters";

export function useTaskFiltersWithLabelsSupport(
  project: ProjectWithTasks | null | undefined,
  _projectId?: string,
  textQuery?: string,
) {
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;

  const rawStatus = readRawFilterParam(search, "status");
  const rawPriority = readRawFilterParam(search, "priority");
  const rawAssignee = readRawFilterParam(search, "assignee");
  const rawDueDate = readRawFilterParam(search, "dueDate");
  const rawLabels = readRawFilterParam(search, "labels");

  const filters = useMemo(
    () =>
      decodeBoardFilters({
        status: rawStatus,
        priority: rawPriority,
        assignee: rawAssignee,
        dueDate: rawDueDate,
        labels: rawLabels,
      }),
    [rawStatus, rawPriority, rawAssignee, rawDueDate, rawLabels],
  );

  const setFilters = useCallback(
    (update: SetStateAction<BoardFilters>) => {
      navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => {
          const current = decodeBoardFilters(prev);
          const next = typeof update === "function" ? update(current) : update;
          return { ...prev, ...encodeBoardFilters(next) };
        },
        replace: true,
      });
    },
    [navigate],
  );

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_BOARD_FILTERS);
  }, [setFilters]);

  const updateFilter = useCallback(
    (key: keyof BoardFilters, value: BoardFilters[keyof BoardFilters]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [setFilters],
  );

  const updateLabelFilter = useCallback(
    (labelId: string) => {
      setFilters((prev) => {
        const currentLabels = prev.labels || [];
        const isSelected = currentLabels.includes(labelId);

        let newLabels: string[] | null;
        if (isSelected) {
          newLabels = currentLabels.filter((id) => id !== labelId);
          if (newLabels.length === 0) newLabels = null;
        } else {
          newLabels = [...currentLabels, labelId];
        }

        return { ...prev, labels: newLabels };
      });
    },
    [setFilters],
  );

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

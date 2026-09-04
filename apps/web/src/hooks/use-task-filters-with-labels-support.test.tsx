import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_BOARD_FILTERS } from "@/lib/board-filter-search-params";
import { useTaskFiltersWithLabelsSupport } from "./use-task-filters-with-labels-support";

const { navigateSpy, searchRef } = vi.hoisted(() => ({
  navigateSpy: vi.fn(),
  searchRef: { current: {} as Record<string, unknown> },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateSpy,
  useSearch: () => searchRef.current,
}));

vi.mock("@/store/user-preferences", () => ({
  useUserPreferencesStore: (
    selector: (s: { weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 }) => unknown,
  ) => selector({ weekStartsOn: 1 }),
}));

describe("useTaskFiltersWithLabelsSupport", () => {
  const project = {
    id: "project-1",
    name: "Project",
    slug: "PROJ",
    icon: null,
    description: null,
    isPublic: false,
    createdAt: "2026-04-16T00:00:00.000Z",
    updatedAt: "2026-04-16T00:00:00.000Z",
    workspaceId: "workspace-1",
    columns: [
      {
        id: "todo",
        slug: "todo",
        name: "Todo",
        icon: null,
        isFinal: false,
        tasks: [
          {
            id: "task-1",
            title: "Bug task",
            number: 1,
            description: null,
            status: "todo",
            priority: null,
            startDate: null,
            dueDate: null,
            position: 0,
            createdAt: "2026-04-16T00:00:00.000Z",
            updatedAt: "2026-04-16T00:00:00.000Z",
            userId: null,
            assigneeId: null,
            assigneeName: null,
            assigneeImage: null,
            projectId: "project-1",
            labels: [
              {
                id: "label-bug",
                name: "bug",
                color: "red",
              },
            ],
            externalLinks: [],
          },
          {
            id: "task-2",
            title: "Other task",
            number: 2,
            description: null,
            status: "todo",
            priority: null,
            startDate: null,
            dueDate: null,
            position: 1,
            createdAt: "2026-04-16T00:00:00.000Z",
            updatedAt: "2026-04-16T00:00:00.000Z",
            userId: null,
            assigneeId: null,
            assigneeName: null,
            assigneeImage: null,
            projectId: "project-1",
            labels: [],
            externalLinks: [],
          },
        ],
      },
    ],
    plannedTasks: [],
    archivedTasks: [],
  };

  beforeEach(() => {
    searchRef.current = {};
    navigateSpy.mockReset();
    navigateSpy.mockImplementation((opts: { search: unknown }) => {
      if (typeof opts.search === "function") {
        searchRef.current = (
          opts.search as (p: Record<string, unknown>) => Record<string, unknown>
        )(searchRef.current);
      }
    });
  });

  it("restores label filters from search params and matches tasks from project data", () => {
    searchRef.current = { labels: "label-bug" };

    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(project, "project-1"),
    );

    expect(result.current.filters.labels).toEqual(["label-bug"]);
    expect(result.current.filteredProject?.columns[0]?.tasks).toHaveLength(1);
    expect(result.current.filteredProject?.columns[0]?.tasks[0]?.id).toBe(
      "task-1",
    );
  });

  it.each(["#123", "proj-123", "proj-"])(
    "matches a task by its issue identifier when searching for %s",
    (textQuery) => {
      const searchProject = {
        id: "project-1",
        name: "Project",
        slug: "PROJ",
        icon: null,
        description: null,
        isPublic: false,
        createdAt: "2026-04-16T00:00:00.000Z",
        updatedAt: "2026-04-16T00:00:00.000Z",
        workspaceId: "workspace-1",
        columns: [
          {
            id: "todo",
            slug: "todo",
            name: "Todo",
            icon: null,
            isFinal: false,
            tasks: [
              {
                id: "task-123",
                title: "Unrelated title",
                number: 123,
                description: null,
                status: "todo",
                priority: null,
                startDate: null,
                dueDate: null,
                position: 0,
                createdAt: "2026-04-16T00:00:00.000Z",
                updatedAt: "2026-04-16T00:00:00.000Z",
                userId: null,
                assigneeId: null,
                assigneeName: null,
                assigneeImage: null,
                projectId: "project-1",
                labels: [],
                externalLinks: [],
              },
              {
                id: "task-without-number",
                title: "Another unrelated title",
                number: null,
                description: null,
                status: "todo",
                priority: null,
                startDate: null,
                dueDate: null,
                position: 1,
                createdAt: "2026-04-16T00:00:00.000Z",
                updatedAt: "2026-04-16T00:00:00.000Z",
                userId: null,
                assigneeId: null,
                assigneeName: null,
                assigneeImage: null,
                projectId: "project-1",
                labels: [],
                externalLinks: [],
              },
            ],
          },
        ],
        plannedTasks: [],
        archivedTasks: [],
      };

      const { result } = renderHook(() =>
        useTaskFiltersWithLabelsSupport(searchProject, "project-1", textQuery),
      );

      expect(result.current.filteredProject?.columns[0]?.tasks).toEqual([
        expect.objectContaining({ id: "task-123" }),
      ]);
    },
  );

  it("renders unfiltered and injects no search keys when there are no filter params", () => {
    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(project, "project-1"),
    );

    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.filters).toEqual(EMPTY_BOARD_FILTERS);
    expect(result.current.filteredProject?.columns[0]?.tasks).toHaveLength(2);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("empty columns are preserved when a filter matches nothing", () => {
    searchRef.current = { labels: "nope" };

    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(project, "project-1"),
    );

    expect(result.current.filteredProject?.columns).toHaveLength(1);
    expect(result.current.filteredProject?.columns[0]?.tasks).toHaveLength(0);
  });

  it("filters keep a stable identity across re-renders", () => {
    searchRef.current = { labels: "label-bug" };

    const { result, rerender } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(project, "project-1"),
    );

    const initialFilters = result.current.filters;
    const initialFilteredProject = result.current.filteredProject;

    rerender();

    expect(result.current.filters).toBe(initialFilters);
    expect(result.current.filteredProject).toBe(initialFilteredProject);
  });

  it("updateFilter navigates with replace and clears the key when the value is empty", () => {
    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(project, "project-1"),
    );

    act(() => {
      result.current.updateFilter("status", ["to-do", "in-progress"]);
    });

    expect(searchRef.current.status).toBe("to-do,in-progress");
    expect(navigateSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ replace: true }),
    );

    act(() => {
      result.current.updateFilter("status", null);
    });

    expect(searchRef.current.status).toBeUndefined();
    expect(navigateSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ replace: true }),
    );

    for (const call of navigateSpy.mock.calls) {
      expect(call[0]).toEqual(expect.objectContaining({ replace: true }));
    }
  });

  it("mutating a filter preserves taskId", () => {
    searchRef.current = { taskId: "task-9" };

    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(project, "project-1"),
    );

    act(() => {
      result.current.updateFilter("priority", ["high"]);
    });

    expect(searchRef.current.taskId).toBe("task-9");
    expect(searchRef.current.priority).toBe("high");
  });

  it("setFilters accepts both a value and an updater function", () => {
    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(project, "project-1"),
    );

    act(() => {
      result.current.setFilters({ ...EMPTY_BOARD_FILTERS, status: ["a"] });
    });
    expect(searchRef.current.status).toBe("a");

    act(() => {
      result.current.setFilters((prev) => {
        expect(prev.status).toEqual(["a"]);
        return { ...prev, priority: ["high"] };
      });
    });
    expect(searchRef.current.status).toBe("a");
    expect(searchRef.current.priority).toBe("high");
  });

  it("hostile search params degrade to unfiltered without throwing", () => {
    searchRef.current = {
      status: 42,
      labels: ["arr"],
      priority: "",
      dueDate: ",,,",
      assignee: { nested: true },
    };

    let hookResult:
      | ReturnType<typeof useTaskFiltersWithLabelsSupport>
      | undefined;

    expect(() => {
      const { result } = renderHook(() =>
        useTaskFiltersWithLabelsSupport(project, "project-1"),
      );
      hookResult = result.current;
    }).not.toThrow();

    expect(hookResult?.hasActiveFilters).toBe(false);
    expect(hookResult?.filteredProject?.columns[0]?.tasks).toHaveLength(2);
  });
});

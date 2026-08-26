import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTaskFiltersWithLabelsSupport } from "./use-task-filters-with-labels-support";

describe("useTaskFiltersWithLabelsSupport", () => {
  const storageKey = "kaneo:board-filters:project-1";

  const mockProject = {
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
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("restores persisted label filters from storage by publishing to onFiltersChange", () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ labels: ["label-bug"] }),
    );
    const onFiltersChange = vi.fn();

    renderHook(() =>
      useTaskFiltersWithLabelsSupport(
        mockProject,
        "project-1",
        undefined,
        undefined,
        onFiltersChange,
      ),
    );

    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ labels: ["label-bug"] }),
    );
  });

  it("applies label filters from searchFilters and matches tasks from project data", () => {
    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(mockProject, "project-1", undefined, {
        labels: ["label-bug"],
      }),
    );

    expect(result.current.filters.labels).toEqual(["label-bug"]);
    expect(result.current.filteredProject?.columns[0]?.tasks).toHaveLength(1);
    expect(result.current.filteredProject?.columns[0]?.tasks[0]?.id).toBe(
      "task-1",
    );
  });

  it("derives filters synchronously from searchFilters on first render without waitFor", () => {
    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(mockProject, "project-1", undefined, {
        status: ["in_progress"],
      }),
    );

    expect(result.current.filters.status).toEqual(["in_progress"]);
  });

  it("prioritizes URL searchFilters over localStorage and writes URL filters back to storage", () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ status: ["todo"] }),
    );

    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(mockProject, "project-1", undefined, {
        status: ["in_progress"],
      }),
    );

    expect(result.current.filters.status).toEqual(["in_progress"]);
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
    expect(stored.status).toEqual(["in_progress"]);
  });

  it("seeds from localStorage only once across rerenders", () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ status: ["todo"] }),
    );
    const onFiltersChange = vi.fn();

    const { rerender } = renderHook(
      (props) =>
        useTaskFiltersWithLabelsSupport(
          props.project,
          props.projectId,
          props.textQuery,
          props.searchFilters,
          props.onFiltersChange,
        ),
      {
        initialProps: {
          project: mockProject,
          projectId: "project-1",
          textQuery: undefined,
          searchFilters: undefined,
          onFiltersChange,
        },
      },
    );

    expect(onFiltersChange).toHaveBeenCalledTimes(1);
    rerender({
      project: mockProject,
      projectId: "project-1",
      textQuery: undefined,
      searchFilters: undefined,
      onFiltersChange,
    });
    expect(onFiltersChange).toHaveBeenCalledTimes(1);
  });

  it("fires seed when searchFilters contains empty param array", () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ status: ["todo"] }),
    );
    const onFiltersChange = vi.fn();

    renderHook(() =>
      useTaskFiltersWithLabelsSupport(
        mockProject,
        "project-1",
        undefined,
        { status: [] },
        onFiltersChange,
      ),
    );

    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: ["todo"] }),
    );
    expect(onFiltersChange).toHaveBeenCalledTimes(1);
  });

  it("persists to localStorage and notifies on updateFilter", () => {
    const onFiltersChange = vi.fn();
    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(
        mockProject,
        "project-1",
        undefined,
        undefined,
        onFiltersChange,
      ),
    );

    act(() => {
      result.current.updateFilter("status", ["todo"]);
    });

    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
    expect(stored.status).toEqual(["todo"]);
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: ["todo"] }),
    );
  });

  it("persists to localStorage and notifies on updateLabelFilter", () => {
    const onFiltersChange = vi.fn();
    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(
        mockProject,
        "project-1",
        undefined,
        undefined,
        onFiltersChange,
      ),
    );

    act(() => {
      result.current.updateLabelFilter("label-bug");
    });

    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
    expect(stored.labels).toEqual(["label-bug"]);
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ labels: ["label-bug"] }),
    );
  });

  it("persists to localStorage and notifies on clearFilters", () => {
    const onFiltersChange = vi.fn();
    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(
        mockProject,
        "project-1",
        undefined,
        { status: ["in_progress"] },
        onFiltersChange,
      ),
    );

    act(() => {
      result.current.clearFilters();
    });

    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
    expect(stored).toEqual({
      status: null,
      priority: null,
      assignee: null,
      dueDate: null,
      labels: null,
    });
    expect(onFiltersChange).toHaveBeenCalledWith({
      status: null,
      priority: null,
      assignee: null,
      dueDate: null,
      labels: null,
    });
  });

  it.each(["#123", "proj-123", "proj-"])(
    "matches a task by its issue identifier when searching for %s",
    (textQuery) => {
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
        useTaskFiltersWithLabelsSupport(project, "project-1", textQuery),
      );

      expect(result.current.filteredProject?.columns[0]?.tasks).toEqual([
        expect.objectContaining({ id: "task-123" }),
      ]);
    },
  );

  it("guards toolbar loop handlers: composes multiple updateLabelFilter calls in a single act()", () => {
    const onFiltersChange = vi.fn();
    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(
        mockProject,
        "project-1",
        undefined,
        { labels: ["a", "b", "c"] },
        onFiltersChange,
      ),
    );

    act(() => {
      result.current.updateLabelFilter("a");
      result.current.updateLabelFilter("b");
      result.current.updateLabelFilter("c");
    });

    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ labels: null }),
    );
  });

  it("guards toolbar loop handlers: composes successive updateFilter calls on different keys in a single act()", () => {
    const onFiltersChange = vi.fn();
    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(
        mockProject,
        "project-1",
        undefined,
        undefined,
        onFiltersChange,
      ),
    );

    act(() => {
      result.current.updateFilter("status", ["todo"]);
      result.current.updateFilter("priority", ["high"]);
    });

    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: ["todo"],
        priority: ["high"],
      }),
    );
  });
});
